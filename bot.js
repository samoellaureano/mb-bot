#!/usr/bin/env node
/**
 * bot.js - Market Making Bot v1.2.1
 * Aligned with backtester.js for profitability (RSI period 14, thresholds 70/30, no inventory bias, fixed dynamicSpreadPct).
 */

require('dotenv').config();
const axios = require('axios');
const MB = require('./mb_client');
const db = require('./db');

// -------------------- CONFIG --------------------
const SIMULATE = process.env.SIMULATE === 'true';
const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4';
const PAIR = process.env.PAIR || 'BTC-BRL';
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.002'); // Aligned with best backtest
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.0001'); // Aligned with best backtest
const CYCLE_SEC = Math.max(1, parseInt(process.env.CYCLE_SEC || '15'));
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.0003');
const PRICE_DRIFT_BOOST = parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0');
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0007'); // Aligned with backtest
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '2.0');
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || '5.0');
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005'); // Reduced to align with backtest
const VOLATILITY_LIMIT_PCT = parseFloat(process.env.VOLATILITY_LIMIT_PCT || '1.0');
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.00005');
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0002'); // Aligned with backtest
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002');
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.0001');
const MIN_ORDER_CYCLES = 2;
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '10');
const PRICE_TOLERANCE = parseFloat(process.env.PRICE_TOLERANCE || '0.002');

// Validate critical config
if (!REST_BASE.startsWith('http')) {
    console.error('❌ FATAL: REST_BASE invalid');
    process.exit(1);
}

// -------------------- LOGGING --------------------
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${level}]`.padEnd(8);
    const logLine = `${timestamp} ${prefix} ${message}`;
    console.log(logLine, data ? `| ${JSON.stringify(data).slice(0, 80)}${JSON.stringify(data).length > 80 ? '...' : ''}` : '');
};

// Safe stats log
const safeStatsLog = (label, statsObj) => {
    if (!statsObj) {
        log('WARN', `${label}: stats not initialized`);
        return;
    }
    log('INFO', label, statsObj);
};

// -------------------- GLOBAL STATE --------------------
let cycleCount = 0;
let activeOrders = new Map();
let totalFills = 0;
let totalPnL = 0.0;
let btcPosition = 0;
let totalCost = 0;
let lastObUpdate = 0;
let lastOrderbook = {bids: [], asks: []};
let marketTrend = 'Neutra';
let lastTradeCycle = -1; // Added for cooldown
const OB_REFRESH_SEC = 10;
const startTime = Date.now();

let stats = {
    cycles: 0,
    totalOrders: 0,
    filledOrders: 0,
    cancels: 0,
    totalPnL: 0.0,
    avgFillPrice: 0.0,
    fillRate: '0.0%',
    avgSpread: SPREAD_PCT * 100,
    uptime: '0min'
};

// -------------------- HELPER FUNCTIONS --------------------
const saveOrderSafe = async (order, note) => {
    try {
        await db.saveOrder({...order, note, timestamp: Math.floor(Date.now() / 1000)});
    } catch (e) {
        log('WARN', `Failed to save order ${order.id}:`, e.message);
    }
};

// -------------------- RSI CALCULATION --------------------
let priceHistory = []; // Store closing prices for RSI
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
        const change = prices[i + 1] - prices[i];
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// -------------------- ORDERBOOK --------------------
async function fetchOrderbookRest() {
    try {
        const url = `${REST_BASE}/${PAIR}/orderbook?limit=10`;
        log('DEBUG', `Fetching orderbook from: ${url}`);
        const response = await axios.get(url, {
            timeout: 15000, headers: {'User-Agent': 'MB-Bot/1.0.0'}
        });
        const data = response.data;

        const orderbook = {
            bids: Array.isArray(data.bids) ? data.bids.slice(0, 10) : [],
            asks: Array.isArray(data.asks) ? data.asks.slice(0, 10) : []
        };

        if (orderbook.bids.length && orderbook.asks.length) {
            const closePrice = (parseFloat(orderbook.bids[0][0]) + parseFloat(orderbook.asks[0][0])) / 2;
            priceHistory.push(closePrice);
            if (priceHistory.length > 15) priceHistory.shift(); // Keep only last 15 prices for RSI
            lastObUpdate = Date.now();
            lastOrderbook = orderbook;
            log('INFO', `📊 Orderbook refreshed: Best Bid: ${orderbook.bids[0][0]}, Best Ask: ${orderbook.asks[0][0]}, Depth: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
            return orderbook;
        } else {
            throw new Error('Empty orderbook response');
        }
    } catch (e) {
        log('WARN', `Orderbook fetch failed, using last valid: ${e.message}, Last Update: ${new Date(lastObUpdate).toISOString()}`);
        return lastOrderbook;
    }
}

// -------------------- PREDICTION --------------------
async function fetchPricePrediction() {
    try {
        const rsi = calculateRSI(priceHistory);
        const trend = rsi > 70 ? 'down' : (rsi < 30 ? 'up' : 'neutral');
        log('DEBUG', `RSI: ${rsi.toFixed(2)}, Trend: ${trend}`);
        return {trend, confidence: Math.abs(rsi - 50) / 50};
    } catch (e) {
        log('WARN', `RSI calculation failed: ${e.message}`);
        return {trend: 'neutral'};
    }
}

// -------------------- ORDERS --------------------
async function tryCancel(orderKey) {
    const order = activeOrders.get(orderKey);
    if (!order) return;

    try {
        log('INFO', `❌ Cancelling ${order.side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${order.price.toFixed(0)}, Qty: ${order.qty}`);
        if (SIMULATE) {
            await saveOrderSafe({...order, status: 'cancelled'}, 'simulated_cancel');
        } else {
            const result = await MB.cancelOrder(order.id);
            await saveOrderSafe({...order, status: result.status || 'cancelled'}, 'live_cancel');
        }
        stats.cancels++;
        activeOrders.delete(orderKey);
        log('SUCCESS', `✅ Cancelled ${order.side.toUpperCase()} order ${order.id.substring(0, 8)} successfully`);
    } catch (e) {
        log('WARN', `⚠️ Cancel error ${order.id}: ${e.message}`);
        activeOrders.delete(orderKey);
    }
}

async function checkOrderStatus(orderKey, side) {
    const order = activeOrders.get(orderKey);
    if (!order) return {status: 'unknown', filledQty: 0};

    if (SIMULATE) {
        const fillChance = 0.08 + Math.random() * 0.07;
        if (Math.random() < fillChance) {
            const slippage = (Math.random() - 0.5) * 0.002;
            const fillPrice = order.price * (1 + slippage);
            const qty = order.qty;

            if (side === 'buy') {
                btcPosition += qty;
                totalCost += qty * fillPrice;
            } else if (side === 'sell') {
                const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
                const pnl = (fillPrice - avgPrice) * qty;
                totalPnL += pnl;
                btcPosition -= qty;
                totalCost -= avgPrice * qty;
                if (btcPosition < 0) btcPosition = 0;
                if (totalCost < 0) totalCost = 0;
            }

            totalFills++;
            lastTradeCycle = cycleCount; // Update cooldown
            await saveOrderSafe({
                ...order, status: 'filled', filledQty: qty, fillPrice: fillPrice.toFixed(2)
            }, `simulated_fill ${slippage.toFixed(3)}`);
            activeOrders.delete(orderKey);
            log('INFO', `🎉 Filled ${side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${fillPrice.toFixed(0)}, Qty: ${qty}, Total PnL: ${totalPnL.toFixed(2)}`);
            return {status: 'filled', filledQty: qty};
        }
        return {status: 'working', filledQty: 0};
    }

    try {
        const status = await MB.getOrderStatus(order.id);
        log('DEBUG', `🔍 Order ${order.id.substring(0, 8)} status: ${status.status}, Filled Qty: ${status.filledQty || 0}`);
        if (status.status === 'filled') {
            const qty = parseFloat(status.filledQty);
            const price = parseFloat(status.avgPrice || order.price);

            if (status.side === 'buy') {
                btcPosition += qty;
                totalCost += qty * price;
            } else if (status.side === 'sell') {
                const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
                const pnl = (price - avgPrice) * qty;
                totalPnL += pnl;
                btcPosition -= qty;
                totalCost -= avgPrice * qty;
                if (btcPosition < 0) btcPosition = 0;
                if (totalCost < 0) totalCost = 0;
            }

            totalFills++;
            lastTradeCycle = cycleCount; // Update cooldown
            await saveOrderSafe({...order, status: 'filled', filledQty: qty, avgPrice: price}, 'live_fill');
            activeOrders.delete(orderKey);
            log('INFO', `🎉 Filled ${status.side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${price.toFixed(0)}, Qty: ${qty}, Total PnL: ${totalPnL.toFixed(2)}`);
            return {status: 'filled', filledQty: qty};
        }
        return {status: status.status, filledQty: status.filledQty || 0};
    } catch (e) {
        log('WARN', `Status check failed ${order.id}:`, e.message);
        return {status: 'error', filledQty: 0};
    }
}

// -------------------- CYCLE --------------------
async function runCycle() {
    try {
        cycleCount++;
        stats.cycles = cycleCount;
        log('DEBUG', `⏳ Starting cycle ${cycleCount}, Time: ${new Date().toISOString()}`);

        if (cycleCount - lastTradeCycle < 2) {
            log('INFO', `Skipping cycle ${cycleCount}: cooldown (last trade at cycle ${lastTradeCycle})`);
            return;
        }

        const obAge = (Date.now() - lastObUpdate) / 1000;
        let orderbook = (obAge > OB_REFRESH_SEC || lastObUpdate === 0) ? await fetchOrderbookRest() : lastOrderbook;
        if (!orderbook.bids.length || !orderbook.asks.length) {
            log('WARN', `⏭️ Cycle ${cycleCount} skipped - no valid orderbook`);
            return;
        }

        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        if (isNaN(bestBid) || isNaN(bestAsk) || bestBid >= bestAsk) {
            log('WARN', `⚠️ Invalid orderbook data - Best Bid: ${bestBid}, Best Ask: ${bestAsk}`);
            return;
        }

        log('INFO', `📊 Orderbook updated - Best Bid: ${bestBid}, Best Ask: ${bestAsk}, Mid: ${(bestBid + bestAsk) / 2}, Volume Bid: ${orderbook.bids[0][1]}, Volume Ask: ${orderbook.asks[0][1]}`);

        const mid = (bestBid + bestAsk) / 2;
        const volatility = ((bestAsk - bestBid) / mid) * 100;

        if (volatility > 1.8 || volatility < 0.3) {
            log('INFO', `Skipping cycle ${cycleCount}: volatility=${volatility.toFixed(2)}% (outside 0.3-1.8%)`);
            return;
        }

        marketTrend = volatility > VOLATILITY_LIMIT_PCT ? 'Alta' : (volatility < -VOLATILITY_LIMIT_PCT ? 'Baixa' : 'Neutra');
        log('INFO', `📈 Tendência atual: ${marketTrend} (Volatilidade: ${volatility.toFixed(2)}%)`);

        let dynamicOrderSize = ORDER_SIZE * (1 + volatility / 100);
        dynamicOrderSize = Math.max(MIN_ORDER_SIZE, Math.min(MAX_ORDER_SIZE, dynamicOrderSize));
        log('INFO', `Dynamic Order Size: ${dynamicOrderSize.toFixed(8)} BTC (Vol: ${volatility.toFixed(2)}%)`);

        const bidDepth = orderbook.bids.reduce((sum, [, vol]) => sum + parseFloat(vol), 0);
        const askDepth = orderbook.asks.reduce((sum, [, vol]) => sum + parseFloat(vol), 0);
        const depthFactor = (bidDepth + askDepth) / (dynamicOrderSize * 20);
        let dynamicSpreadPct = Math.max(MIN_SPREAD_PCT, SPREAD_PCT * Math.max(1, depthFactor * 0.5));
        if (volatility >= VOLATILITY_LIMIT_PCT) dynamicSpreadPct *= 1.1;
        log('DEBUG', `Dynamic Spread adjusted by depth: ${dynamicSpreadPct * 100}% (Depth Factor: ${depthFactor.toFixed(2)}, Total Fills: ${totalFills})`);

        let buyBias = 0, sellBias = 0; // Inventory bias disabled

        let buyPrice = parseFloat((mid * (1 - dynamicSpreadPct / 4 + buyBias)).toFixed(2));
        let sellPrice = parseFloat((mid * (1 + dynamicSpreadPct / 4 + sellBias)).toFixed(2));

        if (buyPrice >= sellPrice) {
            log('WARN', `⚠️ Spread too tight - Buy Price: ${buyPrice}, Sell Price: ${sellPrice}, Adjusting to natural spread`);
            const naturalSpreadPct = ((bestAsk - bestBid) / mid) / 2;
            dynamicSpreadPct = Math.max(dynamicSpreadPct, naturalSpreadPct);
            buyPrice = parseFloat((mid * (1 - dynamicSpreadPct / 4)).toFixed(2));
            sellPrice = parseFloat((mid * (1 + dynamicSpreadPct / 4)).toFixed(2));
            log('DEBUG', `Adjusted dynamicSpreadPct to ${dynamicSpreadPct * 100}% (naturalSpreadPct: ${naturalSpreadPct * 100}%)`);
        }

        log('INFO', `📈 Cycle ${cycleCount}: Volatility ${volatility.toFixed(2)}%, Spread ${dynamicSpreadPct * 100}%, Buy: ${buyPrice}, Sell: ${sellPrice}`);

        for (let key of ['buy', 'sell']) {
            if (activeOrders.has(key)) {
                log('DEBUG', `🔍 Checking status for ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)}, Price: ${activeOrders.get(key).price}`);
                const statusResult = await checkOrderStatus(key, key);
                log('DEBUG', `📋 Status for ${key.toUpperCase()}: ${statusResult.status}, Filled Qty: ${statusResult.filledQty || 0}`);
                if (statusResult.status === 'filled' || statusResult.status === 'error') {
                    log('INFO', `✅ ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)} completed (Status: ${statusResult.status})`);
                    activeOrders.delete(key);
                }
            }
        }

        for (let key of ['buy', 'sell']) {
            if (!activeOrders.has(key)) continue;

            const order = activeOrders.get(key);
            const targetPrice = key === 'buy' ? buyPrice : sellPrice;
            const priceDrift = (targetPrice - order.price) / targetPrice;
            const age = cycleCount - (order.cyclePlaced || cycleCount);
            const hasInterest = orderbook.bids[0][1] > dynamicOrderSize * 2 || orderbook.asks[0][1] > dynamicOrderSize * 2;
            log('DEBUG', `hasInterest calculation: Bid volume ${orderbook.bids[0][1]} > ${dynamicOrderSize * 2}? ${orderbook.bids[0][1] > dynamicOrderSize * 2}, Ask volume ${orderbook.asks[0][1]} > ${dynamicOrderSize * 2}? ${orderbook.asks[0][1] > dynamicOrderSize * 2}, Result: ${hasInterest}`);
            log('DEBUG', `📊 ${key.toUpperCase()} order - ID: ${order.id.substring(0, 8)}, Price: ${order.price}, Target: ${targetPrice}, Drift: ${(priceDrift * 100).toFixed(2)}%, Age: ${age} cycles`);

            const adjustedDrift = PRICE_DRIFT * (1 + PRICE_DRIFT_BOOST) * 2;
            log('DEBUG', `Adjustment check - adjustedDrift: ${adjustedDrift}, age >= ${MIN_ORDER_CYCLES}? ${age >= MIN_ORDER_CYCLES}, |drift| > adjustedDrift? ${Math.abs(priceDrift) > adjustedDrift} (|${priceDrift}| > ${adjustedDrift})`);
            const ADJUST_STEP = 0.0002;
            const ADJUST_STEP_AGGRESSIVE = ADJUST_STEP * 2;
            if (age >= MIN_ORDER_CYCLES && Math.abs(priceDrift) > adjustedDrift) {
                const adjustment = targetPrice * Math.sign(priceDrift) * Math.min(Math.abs(priceDrift), ADJUST_STEP_AGGRESSIVE);
                const newPrice = order.price + adjustment;
                log('INFO', `🔄 Adjusting ${key.toUpperCase()} order ${order.id.substring(0, 8)}: ${order.price.toFixed(0)} → ${newPrice.toFixed(0)} (Drift Boost)`);
                await tryCancel(key);
                const newOrder = await MB.placeOrder(key, newPrice, dynamicOrderSize);
                const orderId = newOrder.orderId || `${key}_${Date.now()}`;
                activeOrders.set(key, {
                    id: orderId,
                    side: key,
                    price: newPrice,
                    qty: dynamicOrderSize,
                    status: 'working',
                    cyclePlaced: cycleCount,
                    timestamp: Date.now()
                });
                await saveOrderSafe(activeOrders.get(key), `market_making_${key}_adjust`);
            }

            const shouldCancel = (Math.abs(priceDrift) > PRICE_TOLERANCE || age >= MAX_ORDER_AGE) && age >= MIN_ORDER_CYCLES;
            log('DEBUG', `Cancel check - |drift| > ${PRICE_TOLERANCE}? ${Math.abs(priceDrift) > PRICE_TOLERANCE}, age >= ${MAX_ORDER_AGE}? ${age >= MAX_ORDER_AGE}, age >= ${MIN_ORDER_CYCLES}? ${age >= MIN_ORDER_CYCLES}, shouldCancel: ${shouldCancel}, !hasInterest: ${!hasInterest}`);
            if (shouldCancel && !hasInterest) {
                log('INFO', `❌ Cancelling ${key.toUpperCase()} - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles (low interest)`);
                await tryCancel(key);
                continue;
            } else if (hasInterest && Math.abs(priceDrift) < 0.001) {
                log('INFO', `✅ Order ${key.toUpperCase()} OK - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles`);
                continue;
            }
        }

        let buyStatus = activeOrders.has('buy') ? await checkOrderStatus('buy', 'buy') : {status: 'unknown'};
        let sellStatus = activeOrders.has('sell') ? await checkOrderStatus('sell', 'sell') : {status: 'unknown'};

        let balances;
        try {
            balances = await MB.getBalances();
            log('DEBUG', `💰 Fetched balances - BRL: ${balances.find(b => b.symbol === 'BRL')?.available || 'N/A'}, BTC: ${balances.find(b => b.symbol === 'BTC')?.available || 'N/A'}, Total BRL: ${balances.find(b => b.symbol === 'BRL')?.total || 'N/A'}, Total BTC: ${balances.find(b => b.symbol === 'BTC')?.total || 'N/A'}`);
        } catch (e) {
            log('ERROR', `❌ Failed to fetch account balance: ${e.message}`);
            balances = [{symbol: 'BRL', available: '0'}, {symbol: 'BTC', available: '0'}];
        }
        const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
        const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);
        const buyCost = buyPrice * dynamicOrderSize * 1.003;
        log('DEBUG', `💸 Buy Cost Calculation - Price: ${buyPrice}, Size: ${dynamicOrderSize}, Fee: ${(buyCost - buyPrice * dynamicOrderSize).toFixed(2)}, Total: ${buyCost.toFixed(2)}`);
        const sellAmount = dynamicOrderSize;
        log('DEBUG', `💰 Checking balances - BRL: ${brlBalance.toFixed(2)}, BTC: ${btcBalance.toFixed(8)}, Buy Cost: ${buyCost.toFixed(2)}, Sell Amount: ${sellAmount}`);
        log('INFO', `📊 Inventory: BTC ${btcPosition.toFixed(8)}, Avg Cost ${(btcPosition > 0 ? totalCost / btcPosition : 0).toFixed(0)}, PnL ${totalPnL.toFixed(2)}`);

        const currentPnL = totalPnL;
        const avgCost = btcPosition > 0 ? totalCost / btcPosition : mid;
        if (currentPnL <= -avgCost * STOP_LOSS_PCT / 100) {
            log('WARN', `⚠️ Stop-Loss triggered: PnL ${currentPnL.toFixed(2)} <= -${avgCost.toFixed(0)} * ${STOP_LOSS_PCT}%`);
            for (let key of activeOrders.keys()) await tryCancel(key);
            return;
        }
        if (currentPnL >= avgCost * TAKE_PROFIT_PCT / 100) {
            log('INFO', `🎉 Take-Profit triggered: PnL ${currentPnL.toFixed(2)} >= ${avgCost.toFixed(0)} * ${TAKE_PROFIT_PCT}%`);
            for (let key of activeOrders.keys()) await tryCancel(key);
            return;
        }

        log('DEBUG', `Buy placement check - hasActiveBuy: ${activeOrders.has('buy')}, buyStatus: ${buyStatus.status}, brlBalance >= buyCost? ${brlBalance >= buyCost} (${brlBalance.toFixed(2)} >= ${buyCost.toFixed(2)})`);
        if (!activeOrders.has('buy') && buyStatus.status !== 'filled' && brlBalance >= buyCost && dynamicOrderSize >= MIN_VOLUME) {
            try {
                const order = await MB.placeOrder('buy', buyPrice, dynamicOrderSize);
                const orderId = order.orderId || `buy_${Date.now()}`;
                activeOrders.set('buy', {
                    id: orderId,
                    side: 'buy',
                    price: buyPrice,
                    qty: dynamicOrderSize,
                    status: 'working',
                    cyclePlaced: cycleCount,
                    timestamp: Date.now()
                });
                log('INFO', `✅ Placed BUY order ${orderId.substring(0, 8)} @ R$${buyPrice.toFixed(0)}, Qty: ${dynamicOrderSize}, Cost: ${buyCost.toFixed(2)}, BRL Balance: ${brlBalance.toFixed(2)}`);
                await saveOrderSafe(activeOrders.get('buy'), 'market_making_buy');
            } catch (e) {
                log('ERROR', `❌ Buy placement failed | ${e.message}, BRL Balance: ${brlBalance.toFixed(2)}`);
            }
        } else if (!activeOrders.has('buy')) {
            log('WARN', `💰 Insufficient BRL balance (${brlBalance.toFixed(2)}) for buy order, required: ${buyCost.toFixed(2)} or dynamicOrderSize ${dynamicOrderSize} < MIN_VOLUME ${MIN_VOLUME}`);
        }

        log('DEBUG', `Sell placement check - hasActiveSell: ${activeOrders.has('sell')}, sellStatus: ${sellStatus.status}, btcBalance >= sellAmount? ${btcBalance >= sellAmount} (${btcBalance.toFixed(8)} >= ${sellAmount})`);
        if (!activeOrders.has('sell') && sellStatus.status !== 'filled' && btcBalance >= sellAmount && dynamicOrderSize >= MIN_VOLUME) {
            try {
                const order = await MB.placeOrder('sell', sellPrice, dynamicOrderSize);
                const orderId = order.orderId || `sell_${Date.now()}`;
                activeOrders.set('sell', {
                    id: orderId,
                    side: 'sell',
                    price: sellPrice,
                    qty: dynamicOrderSize,
                    status: 'working',
                    cyclePlaced: cycleCount,
                    timestamp: Date.now()
                });
                log('INFO', `✅ Placed SELL order ${orderId.substring(0, 8)} @ R$${sellPrice.toFixed(0)}, Qty: ${dynamicOrderSize}, BTC Balance: ${btcBalance.toFixed(8)}`);
                await saveOrderSafe(activeOrders.get('sell'), 'market_making_sell');
            } catch (e) {
                log('ERROR', `❌ Sell placement failed | ${e.message}, BTC Balance: ${btcBalance.toFixed(8)}`);
            }
        } else if (!activeOrders.has('sell')) {
            log('WARN', `💰 Insufficient BTC balance (${btcBalance.toFixed(8)}) for sell order, required: ${sellAmount} or dynamicOrderSize ${dynamicOrderSize} < MIN_VOLUME ${MIN_VOLUME}`);
        }

        stats.totalOrders = activeOrders.size + stats.filledOrders;
        stats.filledOrders = totalFills;
        stats.totalPnL = parseFloat(totalPnL.toFixed(2));
        stats.fillRate = ((totalFills / (cycleCount || 1)) * 100).toFixed(1) + '%';
        stats.uptime = `${Math.round((Date.now() - startTime) / 60000)}min`;
        stats.avgSpread = dynamicSpreadPct * 100;
        log('DEBUG', `📊 Stats Update - Total Orders: ${stats.totalOrders}, Fills: ${stats.filledOrders}, PnL: ${stats.totalPnL}, Fill Rate: ${stats.fillRate}`);
        safeStatsLog(`📊 Cycle ${cycleCount} summary`, stats);
    } catch (e) {
        log('ERROR', `❌ Critical error in cycle ${cycleCount}: ${e.message}, Stack: ${e.stack}`);
    }
}

// -------------------- MAIN --------------------
async function main() {
    try {
        log('INFO', 'Initializing DB...');
        await db.init();
        log('SUCCESS', 'DB initialized');

        log('INFO', 'Authenticating with Mercado Bitcoin...');
        await MB.authenticate();
        log('SUCCESS', 'Authentication completed');

        log('INFO', 'Fetching initial orderbook...');
        await fetchOrderbookRest();

        async function syncWithDashboard() {
            try {
                const response = await axios.get('http://localhost:3001/api/status');
                const data = response.data;
                if (data && data.stats && data.stats.totalPnL) {
                    totalPnL = parseFloat(data.stats.totalPnL);
                    log('INFO', `📊 Synchronized PnL with dashboard: ${totalPnL}`);
                }
            } catch (e) {
                log('WARN', `Failed to sync with dashboard: ${e.message}`);
            }
        }

        await syncWithDashboard();

        log('INFO', `Starting main loop - cycle every ${CYCLE_SEC}s, Start Time: ${new Date(startTime).toISOString()}`);
        await runCycle();
        setInterval(runCycle, CYCLE_SEC * 1000);

        log('SUCCESS', 'Bot operational - SIMULATE=' + SIMULATE);
    } catch (e) {
        log('ERROR', 'Fatal initialization error:', e.message);
        process.exit(1);
    }
}

// -------------------- GRACEFUL SHUTDOWN --------------------
process.on('SIGINT', async () => {
    log('WARN', 'SIGINT received - shutting down...');
    for (let key of activeOrders.keys()) await tryCancel(key);
    await db.close();
    log('SUCCESS', 'Shutdown complete');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log('ERROR', 'Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', 'Unhandled promise rejection:', reason);
});

main();