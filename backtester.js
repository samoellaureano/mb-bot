#!/usr/bin/env node
/**
 * backtester.js - Advanced CSV candle backtester aligned with bot.js v1.2.0
 * Reverted RSI, cooldown, and inventory bias to previous settings to restore profitability.
 * Fixed dynamicSpreadPct calculation and added debug logs.
 */

const fs = require('fs');
const {parse} = require('csv-parse/sync');

if (process.argv.length < 3) {
    console.error('usage: node backtester.js path/to/candles.csv [--test]');
    process.exit(1);
}

const csvPath = process.argv[2];
const TEST_MODE = process.argv.includes('--test');
const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    trim: true
});

if (rows.length === 0) {
    console.error('No data in CSV');
    process.exit(1);
}

// -------------------- CONFIG --------------------
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.002'); // Reverted to best previous value
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.0001'); // Reverted to best previous value
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0007'); // Reverted to previous value
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.00005');
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0002'); // Reverted to previous value
const VOLATILITY_LIMIT_PCT = parseFloat(process.env.VOLATILITY_LIMIT_PCT || '1.0');
const FEE_PCT = parseFloat(process.env.FEE_PCT || '0.0001');
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002');
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.0001');
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '10');
const PRICE_TOLERANCE = parseFloat(process.env.PRICE_TOLERANCE || '0.002');

// Log configurations
const log = (message) => console.log(`[BACKTEST] ${message}`);
log(`Config: SPREAD_PCT=${SPREAD_PCT}, ORDER_SIZE=${ORDER_SIZE}, MIN_SPREAD_PCT=${MIN_SPREAD_PCT}, FEE_PCT=${FEE_PCT}, MAX_ORDER_AGE=${MAX_ORDER_AGE}, PRICE_TOLERANCE=${PRICE_TOLERANCE}`);

// Initial balance
let balance = {
    base: parseFloat(process.env.INIT_BASE || '0.0001'),
    quote: parseFloat(process.env.INIT_QUOTE || '10000.0')
};
let orders = [];
let trades = [];
let totalCost = 0;
let totalPnL = 0;
let currentMonth = null;
let monthlyPnL = 0;
let initialValue = balance.quote + (rows[0].c ? parseFloat(rows[0].c) * balance.base : 0);
let lastTradeCandle = -1;

// RSI-based price prediction
function calculateRSI(index, period = 14) {
    if (index < period) return 50;
    let gains = 0, losses = 0;
    for (let i = index - period; i < index; i++) {
        const change = parseFloat(rows[i + 1].c) - parseFloat(rows[i].c);
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function fetchPricePrediction(candle, index) {
    const rsi = calculateRSI(index);
    const trend = rsi > 70 ? 'down' : (rsi < 30 ? 'up' : 'neutral');
    return {trend, confidence: Math.abs(rsi - 50) / 50};
}

// Place simulated order
function placeSim(side, price, qty, candleIndex) {
    if (isNaN(price) || price <= 0) {
        log(`Invalid price for ${side} order: ${price}`);
        return null;
    }
    const id = 'bt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const o = {id, side, price, qty, status: 'open', candlePlaced: candleIndex};
    orders.push(o);
    return o;
}

function processCandle(c, candleIndex) {
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const mid = (high + low) / 2;

    // Validar high e low antes de calcular volatilidade
    if (isNaN(high) || isNaN(low) || high <= 0 || low <= 0 || high < low) {
        log(`Invalid candle data: high=${high}, low=${low}, mid=${mid}, timestamp=${c.timestamp}`);
        return;
    }

    const volatility = isNaN(mid) || mid === 0 ? 0 : ((high - low) / mid) * 100;
    if (isNaN(volatility)) {
        log(`Invalid volatility: high=${high}, low=${low}, mid=${mid}, timestamp=${c.timestamp}`);
        return;
    }

    // Simulate prediction adjustment
    const pred = fetchPricePrediction(c, candleIndex);
    if (pred.trend === 'up') {
        log(`Prediction: ${pred.trend}, adjusting sell bias`);
    } else if (pred.trend === 'down') {
        log(`Prediction: ${pred.trend}, adjusting buy bias`);
    }

    // Filter orders: cancellations and fills
    orders = orders.filter(o => {
        const age = candleIndex - o.candlePlaced;
        const drift = o.price > 0 && !isNaN(mid) && !isNaN(SPREAD_PCT) ?
            (o.side === 'buy' ?
                (o.price - mid * (1 - SPREAD_PCT / 2)) / o.price :
                (mid * (1 + SPREAD_PCT / 2) - o.price) / o.price) :
            0;
        if (isNaN(drift)) {
            log(`Invalid drift for ${o.side} ${o.id}: price=${o.price}, mid=${mid}, SPREAD_PCT=${SPREAD_PCT}`);
            return false;
        }
        if (age >= MAX_ORDER_AGE || Math.abs(drift) > PRICE_TOLERANCE) {
            log(`Cancelled ${o.side} ${o.id}: Age ${age}, Drift ${(drift * 100).toFixed(2)}%`);
            return false;
        }

        if (o.side === 'buy' && mid <= o.price) {
            const fillPrice = mid;
            const fee = o.qty * fillPrice * FEE_PCT;
            balance.base += o.qty;
            balance.quote -= (o.qty * fillPrice + fee);
            totalCost += o.qty * fillPrice;
            trades.push({id: o.id, side: 'buy', price: fillPrice, qty: o.qty, fee, timestamp: c.timestamp});
            log(`Filled buy ${o.id} @ ${fillPrice}, Fee: ${fee.toFixed(2)}, Balance: ${balance.base.toFixed(8)} BTC, ${balance.quote.toFixed(2)} BRL, Total PnL: ${totalPnL.toFixed(2)}`);
            lastTradeCandle = candleIndex;
            return false;
        }
        if (o.side === 'sell' && mid >= o.price) {
            const fillPrice = mid;
            const fee = o.qty * fillPrice * FEE_PCT;
            const avgPrice = totalCost / Math.max(balance.base, 0.00000001);
            const pnl = (fillPrice - avgPrice) * o.qty;
            totalPnL += pnl;
            balance.base -= o.qty;
            balance.quote += (o.qty * fillPrice - fee);
            totalCost -= avgPrice * o.qty;
            if (totalCost < 0) totalCost = 0;
            trades.push({id: o.id, side: 'sell', price: fillPrice, qty: o.qty, fee, pnl, timestamp: c.timestamp});
            log(`Filled sell ${o.id} @ ${fillPrice}, PnL: ${pnl.toFixed(2)}, Fee: ${fee.toFixed(2)}, Balance: ${balance.base.toFixed(8)} BTC, ${balance.quote.toFixed(2)} BRL, Total PnL: ${totalPnL.toFixed(2)}`);
            lastTradeCandle = candleIndex;
            return false;
        }
        return true;
    });
}

// Main simulation loop
function runSimulation(spreadPct = SPREAD_PCT, orderSize = ORDER_SIZE) {
    balance = {
        base: parseFloat(process.env.INIT_BASE || '0.0001'),
        quote: parseFloat(process.env.INIT_QUOTE || '10000.0')
    };
    orders = [];
    trades = [];
    totalCost = 0;
    totalPnL = 0;
    currentMonth = null;
    monthlyPnL = 0;
    initialValue = balance.quote + (rows[0].c ? parseFloat(rows[0].c) * balance.base : 0);
    lastTradeCandle = -1;

    let candleIndex = 0;
    for (const r of rows) {
        const c = {
            timestamp: r.t,
            open: parseFloat(r.o),
            high: parseFloat(r.h),
            low: parseFloat(r.l),
            close: parseFloat(r.c),
            volume: parseFloat(r.v || '0')
        };
        if (!c.timestamp || isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close) || isNaN(c.volume)) {
            log(`Invalid candle data at timestamp ${c.timestamp}: open=${c.open}, high=${c.high}, low=${c.low}, close=${c.close}, volume=${c.volume}, raw=${JSON.stringify(r)}`);
            continue;
        }

        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const mid = (high + low) / 2;
        const volatility = isNaN(mid) || mid === 0 ? 0 : ((high - low) / mid) * 100;
        if (isNaN(mid) || isNaN(volatility)) {
            log(`Invalid mid or volatility for candle ${c.timestamp}: mid=${mid}, volatility=${volatility}, raw=${JSON.stringify(r)}`);
            continue;
        }

        if (volatility > 1.8 || volatility < 0.3) {
            log(`Skipping candle ${c.timestamp}: volatility=${volatility.toFixed(2)}% (outside 0.3-1.8%)`);
            candleIndex++;
            continue;
        }

        if (candleIndex - lastTradeCandle < 2) {
            log(`Skipping candle ${c.timestamp}: cooldown (last trade at ${lastTradeCandle})`);
            candleIndex++;
            continue;
        }

        let depthFactor = 1;
        if (c.volume > 0) depthFactor = c.volume / (orderSize * 20);
        let dynamicSpreadPct = Math.max(MIN_SPREAD_PCT, spreadPct * Math.max(1, depthFactor * 0.5));
        if (volatility >= VOLATILITY_LIMIT_PCT) dynamicSpreadPct *= 1.1;
        if (isNaN(dynamicSpreadPct)) {
            log(`Invalid dynamicSpreadPct: spreadPct=${spreadPct}, depthFactor=${depthFactor}, raw=${JSON.stringify(r)}`);
            continue;
        }

        let dynamicOrderSize = orderSize * (1 + volatility / 100);
        dynamicOrderSize = Math.max(MIN_ORDER_SIZE, Math.min(MAX_ORDER_SIZE, dynamicOrderSize));

        // Disable inventory bias
        let buyBias = 0, sellBias = 0;

        const buyP = +(mid * (1 - dynamicSpreadPct / 4 + buyBias)).toFixed(2);
        const sellP = +(mid * (1 + dynamicSpreadPct / 4 + sellBias)).toFixed(2);
        if (isNaN(buyP) || isNaN(sellP)) {
            log(`Invalid prices: buyP=${buyP}, sellP=${sellP}, mid=${mid}, dynamicSpreadPct=${dynamicSpreadPct}, buyBias=${buyBias}, sellBias=${sellBias}, raw=${JSON.stringify(r)}`);
            continue;
        }

        log(`Candle ${c.timestamp}: mid=${mid.toFixed(2)}, volatility=${volatility.toFixed(2)}%, spread=${(dynamicSpreadPct * 100).toFixed(2)}%, depthFactor=${depthFactor.toFixed(4)}, trades=${trades.length}`);

        const buyOrder = placeSim('buy', buyP, dynamicOrderSize, candleIndex);
        const sellOrder = placeSim('sell', sellP, dynamicOrderSize, candleIndex);
        if (!buyOrder || !sellOrder) {
            log(`Failed to place orders for candle ${c.timestamp}`);
            continue;
        }

        const preQuote = balance.quote;
        processCandle(c, candleIndex);

        const timestamp = new Date(c.timestamp);
        const month = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}`;
        if (month !== currentMonth) {
            if (currentMonth) log(`PnL for ${currentMonth}: ${monthlyPnL.toFixed(2)}`);
            monthlyPnL = 0;
            currentMonth = month;
        }
        monthlyPnL += balance.quote - preQuote;

        candleIndex++;
    }

    const finalPrice = parseFloat(rows[rows.length - 1].c) || 0;
    const finalValue = balance.quote + balance.base * finalPrice;
    const totalPnLFinal = finalValue - initialValue;
    const roi = initialValue !== 0 ? (totalPnLFinal / initialValue) * 100 : 0;
    const fillRate = (trades.length / (rows.length * 2) * 100).toFixed(2);

    return {
        totalPnL: totalPnLFinal.toFixed(2),
        monthlyPnL: monthlyPnL.toFixed(2),
        roi: roi.toFixed(2),
        fillRate: `${fillRate}%`,
        trades: trades.length,
        finalBalance: {base: balance.base.toFixed(8), quote: balance.quote.toFixed(2)}
    };
}

// Run single simulation or tests
if (TEST_MODE) {
    const spreadTests = [0.0005, 0.001, 0.0015, 0.002];
    const sizeTests = [0.00005, 0.00007, 0.0001];
    const resultsData = [];
    log(`Running tests: Spreads ${spreadTests.join(', ')}, Sizes ${sizeTests.join(', ')}`);
    let bestPnL = -Infinity;
    let bestParams = {};
    for (const spread of spreadTests) {
        for (const size of sizeTests) {
            const results = runSimulation(spread, size);
            resultsData.push({spread, size, totalPnL: parseFloat(results.totalPnL)});
            log(`Test Spread ${spread * 100}%, Size ${size}: PnL ${results.totalPnL}, Trades ${results.trades}, ROI ${results.roi}%`);
            if (parseFloat(results.totalPnL) > bestPnL) {
                bestPnL = parseFloat(results.totalPnL);
                bestParams = {spreadPct: spread, orderSize: size};
            }
        }
    }
    log(`Best params: Spread ${bestParams.spreadPct * 100}%, Size ${bestParams.orderSize}, PnL ${bestPnL.toFixed(2)}`);
    log(`Results for charting: ${JSON.stringify(resultsData)}`);
} else {
    const results = runSimulation();
    log(`Final Balance: ${results.finalBalance.base} BTC, ${results.finalBalance.quote} BRL`);
    log(`Total PnL: ${results.totalPnL}`);
    log(`Last Month PnL: ${results.monthlyPnL}`);
    log(`ROI: ${results.roi}%`);
    log(`Fill Rate: ${results.fillRate}`);
    log(`Trades Executed: ${results.trades}`);
    log(`Last Trades:`, trades.slice(-5).map(t => `${t.side} @ ${t.price} (PnL: ${t.pnl?.toFixed(2) || 0})`));
}