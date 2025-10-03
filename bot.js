#!/usr/bin/env node
/**
 * bot.js - Market Making Bot v1.2.2
 * Ajustes: volatilidade unificada + cooldown adaptativo + SL/TP dinâmico + ajuste por profundidade.
 */

require('dotenv').config();
const axios = require('axios');
const MB = require('./mb_client');
const db = require('./db');

// -------------------- CONFIG --------------------
const SIMULATE = process.env.SIMULATE === 'true';
const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4';
const PAIR = process.env.PAIR || 'BTC-BRL';
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.002'); // base spread pct (ex: 0.002 = 0.2%)
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.0001');
const CYCLE_SEC = Math.max(1, parseInt(process.env.CYCLE_SEC || '15'));
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.0003');
const PRICE_DRIFT_BOOST = parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0');
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0007');
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '2.0');
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || '5.0');
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005');
const VOLATILITY_LIMIT_PCT = parseFloat(process.env.VOLATILITY_LIMIT_PCT || '1.0');
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.00005');
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0002');
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002');
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.0001');
const MIN_ORDER_CYCLES = parseInt(process.env.MIN_ORDER_CYCLES || '2');
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '10');
const PRICE_TOLERANCE = parseFloat(process.env.PRICE_TOLERANCE || '0.002');

// Volatility control (configurable via .env)
const MIN_VOLATILITY_PCT = parseFloat(process.env.MIN_VOLATILITY_PCT || '0.3');
const MAX_VOLATILITY_PCT = parseFloat(process.env.MAX_VOLATILITY_PCT || '1.8');
const VOL_LIMIT_PCT = parseFloat(process.env.VOL_LIMIT_PCT || process.env.VOLATILITY_LIMIT_PCT || '1.2');

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
    console.log(logLine, data ? `| ${JSON.stringify(data).slice(0, 120)}${JSON.stringify(data).length > 120 ? '...' : ''}` : '');
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

// -------------------- HELPERS --------------------
const saveOrderSafe = async (order, note) => {
    try {
        await db.saveOrder({...order, note, timestamp: Math.floor(Date.now() / 1000)});
    } catch (e) {
        log('WARN', `Failed to save order ${order.id}:`, e.message);
    }
};

// -------------------- RSI --------------------
let priceHistory = []; // Store mid/close prices
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
            if (priceHistory.length > 60) priceHistory.shift(); // keep reasonably sized history for indicators
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

// -------------------- ORDERS (simulate + live) --------------------
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
        log('WARN', `Status check failed ${order.id}: ${e.message}`);
        return {status: 'error', filledQty: 0};
    }
}

// -------------------- CYCLE --------------------
async function runCycle() {
    try {
        cycleCount++;
        stats.cycles = cycleCount;
        log('DEBUG', `⏳ Starting cycle ${cycleCount}, Time: ${new Date().toISOString()}`);

        // basic cooldown after a trade
        if (cycleCount - lastTradeCycle < 2) {
            log('INFO', `Skipping cycle ${cycleCount}: cooldown (last trade at cycle ${lastTradeCycle})`);
            return;
        }

        // fetch/refresh orderbook if necessary
        const obAge = (Date.now() - lastObUpdate) / 1000;
        let orderbook = (obAge > OB_REFRESH_SEC || lastObUpdate === 0) ? await fetchOrderbookRest() : lastOrderbook;
        if (!orderbook.bids.length || !orderbook.asks.length) {
            log('WARN', `⏭️ Cycle ${cycleCount} skipped - no valid orderbook`);
            return;
        }

        // best levels
        const bestBid = orderbook.bids.length ? parseFloat(orderbook.bids[0][0]) : NaN;
        const bestAsk = orderbook.asks.length ? parseFloat(orderbook.asks[0][0]) : NaN;
        if (isNaN(bestBid) || isNaN(bestAsk) || bestBid >= bestAsk) {
            log('WARN', `⚠️ Invalid orderbook data - Best Bid: ${bestBid}, Best Ask: ${bestAsk}`);
            return;
        }
        const mid = (bestBid + bestAsk) / 2;
        const spreadPct = ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100;

        log('INFO', `📊 Orderbook updated - Best Bid: ${bestBid}, Best Ask: ${bestAsk}, Mid: ${mid}, Volume Bid: ${orderbook.bids[0][1]}, Volume Ask: ${orderbook.asks[0][1]}`);
        log('INFO', `🔍 Current Spread (top-1): ${spreadPct.toFixed(3)}% (Configured base: ${SPREAD_PCT * 100}%)`);

        // volatility based on top-10 orderbook prices range
        const obPrices = [
            ...orderbook.bids.map(b => parseFloat(b[0])),
            ...orderbook.asks.map(a => parseFloat(a[0]))
        ];
        let volatilityPct = 0;
        if (obPrices.length > 1) {
            const max = Math.max(...obPrices);
            const min = Math.min(...obPrices);
            volatilityPct = ((max - min) / ((max + min) / 2)) * 100;
        }

        // volatility limits (configurable)
        if (volatilityPct > MAX_VOLATILITY_PCT || volatilityPct < MIN_VOLATILITY_PCT) {
            log('INFO', `Skipping cycle ${cycleCount}: volatility=${volatilityPct.toFixed(2)}% (outside ${MIN_VOLATILITY_PCT}-${MAX_VOLATILITY_PCT}%)`);
            return;
        }

        // trend label (simple)
        marketTrend = volatilityPct > VOL_LIMIT_PCT ? 'Alta' : 'Neutra';
        log('INFO', `📈 Tendência atual: ${marketTrend} (Volatilidade: ${volatilityPct.toFixed(2)}%)`);

        // ---------- Unified volatility + depth adjustments ----------
        // volFactor grows with volatility (1..2), caps at 2
        let volFactor = Math.min(2, 1 + (volatilityPct / VOL_LIMIT_PCT) * 0.5);

        // dynamic order size: shrink when vol increases
        let dynamicOrderSize = ORDER_SIZE / volFactor;
        dynamicOrderSize = Math.max(MIN_ORDER_SIZE, Math.min(MAX_ORDER_SIZE, dynamicOrderSize));

        // base spread adjusted by volatility
        let dynamicSpreadPct = Math.max(MIN_SPREAD_PCT, SPREAD_PCT * volFactor);

        // depth effect: if book is deep, we can be tighter; if shallow, widen
        const bidDepth = orderbook.bids.reduce((sum, [, vol]) => sum + parseFloat(vol), 0);
        const askDepth = orderbook.asks.reduce((sum, [, vol]) => sum + parseFloat(vol), 0);
        const depthFactor = (bidDepth + askDepth) / (dynamicOrderSize * 20); // heuristic
        // depthFactor ~1 means reasonable; <1 shallow, >1 deep
        if (depthFactor > 0) {
            // make dynamicSpreadPct smaller when depth is large (more liquidity)
            const depthAdjustment = Math.max(0.5, 1 / Math.max(0.5, depthFactor * 0.5));
            dynamicSpreadPct *= (1 + (1 - depthAdjustment)); // if deep (depthAdjustment small), spread reduces a bit
        }

        // further penalize spread if volatility passes the configured limit
        if (volatilityPct >= VOLATILITY_LIMIT_PCT) dynamicSpreadPct *= 1.1;

        // dynamic SL / TP
        const dynamicStopLoss = STOP_LOSS_PCT * (1 + volatilityPct / 100); // widen stop in higher vol (as %)
        const dynamicTakeProfit = TAKE_PROFIT_PCT * (1 - Math.min(0.5, volatilityPct / 100)); // reduce TP in very high vol

        // adaptive cooldown: more volatile => longer cooldown
        const cooldown = Math.max(2, Math.ceil(volatilityPct / 0.5));
        if (cycleCount - lastTradeCycle < cooldown) {
            log('INFO', `Skipping cycle ${cycleCount}: adaptive cooldown=${cooldown}, lastTradeCycle=${lastTradeCycle}, volatility=${volatilityPct.toFixed(2)}%`);
            return;
        }

        log('INFO', `⚖️ VolAdj -> OrderSize: ${dynamicOrderSize.toFixed(8)} BTC | Spread%: ${(dynamicSpreadPct * 100).toFixed(3)} | Vol: ${volatilityPct.toFixed(2)}% | DepthFactor: ${depthFactor.toFixed(2)} | SL: ${dynamicStopLoss.toFixed(2)}% | TP: ${dynamicTakeProfit.toFixed(2)}%`);

        // compute buy/sell target prices using dynamic spread pct
        let buyPrice = parseFloat((mid * (1 - dynamicSpreadPct / 2)).toFixed(2));
        let sellPrice = parseFloat((mid * (1 + dynamicSpreadPct / 2)).toFixed(2));

        // safety: if buy >= sell, expand to natural spread
        if (buyPrice >= sellPrice) {
            log('WARN', `⚠️ Spread too tight - Buy Price: ${buyPrice}, Sell Price: ${sellPrice}, Adjusting to natural spread`);
            const naturalSpreadPct = ((bestAsk - bestBid) / mid) / 2;
            dynamicSpreadPct = Math.max(dynamicSpreadPct, naturalSpreadPct);
            buyPrice = parseFloat((mid * (1 - dynamicSpreadPct / 2)).toFixed(2));
            sellPrice = parseFloat((mid * (1 + dynamicSpreadPct / 2)).toFixed(2));
            log('DEBUG', `Adjusted dynamicSpreadPct to ${dynamicSpreadPct * 100}% (naturalSpreadPct: ${naturalSpreadPct * 100}%)`);
        }

        // ---- check existing active orders status ----
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

        // ---- manage placed orders (drift adjustments / cancels) ----
        for (let key of ['buy', 'sell']) {
            if (!activeOrders.has(key)) continue;

            const order = activeOrders.get(key);
            const targetPrice = key === 'buy' ? buyPrice : sellPrice;
            const priceDrift = (targetPrice - order.price) / targetPrice;
            const age = cycleCount - (order.cyclePlaced || cycleCount);
            const hasInterest = (orderbook.bids[0][1] > dynamicOrderSize * 2) || (orderbook.asks[0][1] > dynamicOrderSize * 2);

            log('DEBUG', `📊 ${key.toUpperCase()} order - ID: ${order.id.substring(0, 8)}, Price: ${order.price}, Target: ${targetPrice}, Drift: ${(priceDrift * 100).toFixed(2)}%, Age: ${age} cycles, HasInterest: ${hasInterest}`);

            const adjustedDrift = PRICE_DRIFT * (1 + PRICE_DRIFT_BOOST) * 2;
            const ADJUST_STEP = 0.0002;
            const ADJUST_STEP_AGGRESSIVE = ADJUST_STEP * 2;

            if (age >= MIN_ORDER_CYCLES && Math.abs(priceDrift) > adjustedDrift) {
                const adjustment = targetPrice * Math.sign(priceDrift) * Math.min(Math.abs(priceDrift), ADJUST_STEP_AGGRESSIVE);
                const newPrice = order.price + adjustment;
                log('INFO', `🔄 Adjusting ${key.toUpperCase()} order ${order.id.substring(0, 8)}: ${order.price.toFixed(0)} → ${newPrice.toFixed(0)} (Drift Boost)`);
                await tryCancel(key);
                // Place new order
                if (SIMULATE) {
                    const orderId = `${key}_SIM_${Date.now()}`;
                    activeOrders.set(key, {
                        id: orderId,
                        side: key,
                        price: newPrice,
                        qty: dynamicOrderSize,
                        status: 'working',
                        cyclePlaced: cycleCount,
                        timestamp: Date.now()
                    });
                    await saveOrderSafe(activeOrders.get(key), `simulated_reprice_${key}`);
                } else {
                    try {
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
                    } catch (e) {
                        log('ERROR', `Failed to place adjusted ${key} order: ${e.message}`);
                    }
                }
            }

            const shouldCancel = (Math.abs(priceDrift) > PRICE_TOLERANCE || age >= MAX_ORDER_AGE) && age >= MIN_ORDER_CYCLES;
            if (shouldCancel && !hasInterest) {
                log('INFO', `❌ Cancelling ${key.toUpperCase()} - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles (low interest)`);
                await tryCancel(key);
                continue;
            } else if (hasInterest && Math.abs(priceDrift) < 0.001) {
                log('INFO', `✅ Order ${key.toUpperCase()} OK - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles`);
                continue;
            }
        }

        // ---- fetch balances (simulate/live) ----
        let balances;
        try {
            balances = SIMULATE ? [{symbol: 'BRL', available: 1000}, {
                symbol: 'BTC',
                available: 0.001
            }] : await MB.getBalances();
            log('DEBUG', `💰 Fetched balances - BRL: ${balances.find(b => b.symbol === 'BRL')?.available || 'N/A'}, BTC: ${balances.find(b => b.symbol === 'BTC')?.available || 'N/A'}`);
        } catch (e) {
            log('ERROR', `❌ Failed to fetch account balance: ${e.message}`);
            balances = [{symbol: 'BRL', available: '0'}, {symbol: 'BTC', available: '0'}];
        }
        const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
        const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);

        // Compute buy cost & checks
        const buyCost = buyPrice * dynamicOrderSize * 1.003;
        const sellAmount = dynamicOrderSize;

        log('DEBUG', `💸 Buy Cost Calc - Price: ${buyPrice}, Size: ${dynamicOrderSize.toFixed(8)}, Fee incl: ${buyCost.toFixed(2)}`);
        log('INFO', `📊 Inventory: BTC ${btcPosition.toFixed(8)}, Avg Cost ${(btcPosition > 0 ? totalCost / btcPosition : 0).toFixed(2)}, PnL ${totalPnL.toFixed(2)}`);

        // risk checks: stop loss / take profit dynamic
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

        // ---- place buy order if none active ----
        if (!activeOrders.has('buy') && brlBalance >= buyCost && dynamicOrderSize >= MIN_VOLUME) {
            try {
                if (SIMULATE) {
                    const orderId = `buy_SIM_${Date.now()}`;
                    activeOrders.set('buy', {
                        id: orderId,
                        side: 'buy',
                        price: buyPrice,
                        qty: dynamicOrderSize,
                        status: 'working',
                        cyclePlaced: cycleCount,
                        timestamp: Date.now()
                    });
                    await saveOrderSafe(activeOrders.get('buy'), 'simulated_buy');
                    log('INFO', `✅ Simulated BUY placed ${orderId} @ R$${buyPrice}, Qty: ${dynamicOrderSize.toFixed(8)}`);
                } else {
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
                    await saveOrderSafe(activeOrders.get('buy'), 'market_making_buy');
                    log('INFO', `✅ Placed BUY order ${orderId.substring(0, 8)} @ R$${buyPrice}, Qty: ${dynamicOrderSize.toFixed(8)}`);
                }
            } catch (e) {
                log('ERROR', `❌ Buy placement failed | ${e.message}`);
            }
        } else if (!activeOrders.has('buy')) {
            log('WARN', `💰 Cannot place BUY - BRL ${brlBalance.toFixed(2)} < Cost ${buyCost.toFixed(2)} or size < MIN_VOLUME`);
        }

        // ---- place sell order if none active ----
        if (!activeOrders.has('sell') && btcBalance >= sellAmount && dynamicOrderSize >= MIN_VOLUME) {
            try {
                if (SIMULATE) {
                    const orderId = `sell_SIM_${Date.now()}`;
                    activeOrders.set('sell', {
                        id: orderId,
                        side: 'sell',
                        price: sellPrice,
                        qty: dynamicOrderSize,
                        status: 'working',
                        cyclePlaced: cycleCount,
                        timestamp: Date.now()
                    });
                    await saveOrderSafe(activeOrders.get('sell'), 'simulated_sell');
                    log('INFO', `✅ Simulated SELL placed ${orderId} @ R$${sellPrice}, Qty: ${dynamicOrderSize.toFixed(8)}`);
                } else {
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
                    await saveOrderSafe(activeOrders.get('sell'), 'market_making_sell');
                    log('INFO', `✅ Placed SELL order ${orderId.substring(0, 8)} @ R$${sellPrice}, Qty: ${dynamicOrderSize.toFixed(8)}`);
                }
            } catch (e) {
                log('ERROR', `❌ Sell placement failed | ${e.message}`);
            }
        } else if (!activeOrders.has('sell')) {
            log('WARN', `💰 Cannot place SELL - BTC ${btcBalance.toFixed(8)} < Amount ${sellAmount.toFixed(8)} or size < MIN_VOLUME`);
        }

        // ---- update stats ----
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
                const response = await axios.get(`http://localhost:${process.env.PORT || 3001}/api/status`);
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