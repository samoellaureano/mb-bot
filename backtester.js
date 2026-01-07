#!/usr/bin/env node
/**
 * backtester_v12_aggressive_tuned.js
 * Versão agressiva com tuning automático de parâmetros.
 */

const fs = require('fs');
const path = require('path');
const {parse} = require('csv-parse/sync');

const ARGV = process.argv.slice(2);
if (ARGV.length < 1) {
    console.error('Uso: node backtester.js path/to/candles.csv [--test]');
    process.exit(1);
}
const INPUT = ARGV[0];
ARGV.includes('--test');
Date.now();
const START_BALANCE = 630.0;
// ---------------- CONFIG ----------------
const CONFIG = {
    ORDER_SIZE_MIN: 0.0001,
    ORDER_SIZE_MAX: 0.1,
    MAX_ORDER_AGE: 20,
    MAX_ORDER_AGE_FORCED: 10,
    FORCE_SELL_THRESHOLD: 0.0001,
    NO_TRADE_THRESHOLD: 5,
    MIN_VOLATILITY_PCT: 0.01,
    PRICE_TOLERANCE: 0.005,
    FEE_PCT: 0.0005,
    BIAS_FACTOR: 0.003,
    AVG_VOLUME_WINDOW: 14,
    MIN_VOLUME: 0.0001,
    MIN_QUOTE: 0,
    // parâmetros que serão otimizados
    MIN_PROFIT_BASE: 0.001,
    SPREAD_BASE: 0.0006,
    ORDER_QUOTE_FRACTION: 0.1
};

// ---------------- util ----------------
const log = (...args) => console.log('[BACKTEST]', ...args);

// ---------------- CSV loader ----------------
function readCSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = parse(raw, {columns: true, skip_empty_lines: true, trim: true});
    return rows.map(r => ({
        timestamp: r.t || r.timestamp || r.time || '',
        o: parseFloat(r.o || r.open || '0'),
        h: parseFloat(r.h || r.high || '0'),
        l: parseFloat(r.l || r.low || '0'),
        c: parseFloat(r.c || r.close || '0'),
        v: parseFloat(r.v || r.volume || '0')
    }));
}

// ---------------- indicators ----------------
function smaFromRows(rows, idx, period) {
    if (idx < period) return rows[idx].c || 0;
    let sum = 0, count = 0;
    for (let i = idx - period; i < idx; i++) {
        const v = parseFloat(rows[i].c || 0);
        if (isFinite(v)) {
            sum += v;
            count++;
        }
    }
    return count > 0 ? sum / count : rows[idx].c || 0;
}

function rsiFromRows(rows, idx, period = 20) {
    if (idx < period) return 50;
    let gains = 0, losses = 0;
    for (let i = idx - period; i < idx; i++) {
        const d = rows[i + 1].c - rows[i].c;
        if (d > 0) gains += d; else losses -= d;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function atrFromRows(rows, idx, period = 14) {
    if (idx <= 0) return 0;
    let sum = 0, count = 0;
    for (let i = Math.max(1, idx - period + 1); i <= idx; i++) {
        const high = rows[i].h, low = rows[i].l, prevClose = rows[i - 1].c;
        if (!isFinite(high) || !isFinite(low) || !isFinite(prevClose)) continue;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        sum += tr;
        count++;
    }
    return count > 0 ? sum / count : 0;
}

function pricePrediction(rows, idx) {
    const rsi = rsiFromRows(rows, idx);
    const smaShort = smaFromRows(rows, idx, 3);
    const smaLong = smaFromRows(rows, idx, 10);
    let trend = 'neutral';
    let confidence = 0.6 * Math.abs(rsi - 50) / 50 + 0.4 * Math.abs(smaShort - smaLong) / (Math.abs(smaLong) + 1e-8);
    confidence = Math.min(confidence, 1);
    if (rsi > 70 || (smaShort > smaLong && rsi > 65)) trend = 'down';
    else if (rsi < 30 || (smaShort < smaLong && rsi < 25)) trend = 'up';
    return {trend, confidence, rsi};
}

// ---------------- simulate single pair ----------------
function simulatePair(pairName, rows) {
    const balanceSnapshots = [];
    const heatmap = [];
    const trades = [];

    let balance = {base: 0.0, quote: START_BALANCE};
    let orders = [];
    let totalCost = 0;
    let totalPnL = 0;
    let rejected = 0, forced = 0;

    const volWindow = [];
    const AVG_VW = CONFIG.AVG_VOLUME_WINDOW;
    const peakValue = {val: START_BALANCE};
    let maxDrawdown = 0;
    let lastExecCandle = -1;

    // Parâmetros dinâmicos que serão ajustados por candle
    let dynamicConfig = {...CONFIG};

    for (let i = 0; i < rows.length; i++) {
        const c = rows[i];
        if (!c || !isFinite(c.h) || !isFinite(c.l) || !isFinite(c.c) || c.h <= 0 || c.l <= 0) {
            const val = balance.quote + balance.base * (rows[Math.max(0, i - 1)]?.c || 0);
            balanceSnapshots.push({quote: balance.quote, base: balance.base, value: val, cumRoi: ((val - START_BALANCE)/START_BALANCE)*100});
            continue;
        }

        // Atualiza janela de volatilidade
        volWindow.push(c.v || 0);
        if (volWindow.length > AVG_VW) volWindow.shift();
        const avgVol = volWindow.reduce((a,b)=>a+b,0)/Math.max(1, volWindow.length);

        // Ajuste dinâmico de parâmetros por candle
        dynamicConfig.MIN_PROFIT_BASE = CONFIG.MIN_PROFIT_BASE * (1 + avgVol*0.01);
        dynamicConfig.SPREAD_BASE = CONFIG.SPREAD_BASE * (1 + avgVol*0.008);
        dynamicConfig.ORDER_QUOTE_FRACTION = Math.min(CONFIG.ORDER_QUOTE_FRACTION * (1 + avgVol*0.005), 0.25);

        const mid = (c.h + c.l)/2;
        const vol = ((c.h - c.l)/mid)*100;

        const pred = pricePrediction(rows, i);
        if(pred.confidence < 0.5){
            const val = balance.quote + balance.base * c.c;
            balanceSnapshots.push({quote: balance.quote, base: balance.base, value: val, cumRoi: ((val-START_BALANCE)/START_BALANCE)*100});
            heatmap.push({i, timestamp:c.timestamp, vol:+vol.toFixed(3), openOrders:orders.length});
            continue;
        }

        const bias = pred.trend === 'up' ? +pred.confidence * 0.002 : pred.trend === 'down' ? -pred.confidence * 0.003 : 0;
        const refPrice = mid*(1+bias);

        let sizeByQuote = (balance.quote * dynamicConfig.ORDER_QUOTE_FRACTION)/Math.max(1e-8, mid);
        let size = Math.min(sizeByQuote, dynamicConfig.ORDER_SIZE_MAX);
        size = Math.max(dynamicConfig.ORDER_SIZE_MIN, size);

        const spread = Math.max(dynamicConfig.SPREAD_BASE, dynamicConfig.SPREAD_BASE*(1+vol*0.1));
        const profitPct = Math.max(dynamicConfig.MIN_PROFIT_BASE, dynamicConfig.MIN_PROFIT_BASE*(1+pred.confidence*0.5));

        const buyPrice = +(refPrice*(1-spread/2)).toFixed(8);
        const sellPrice = +(refPrice*(1+spread/2+profitPct)).toFixed(8);

        if(balance.quote >= size*buyPrice) orders.push({side:'buy', price:buyPrice, qty:size, candleIndex:i});
        if(balance.base >= size) orders.push({side:'sell', price:sellPrice, qty:size, candleIndex:i});

        // processamento de ordens (igual ao código existente)
        orders = orders.filter(o => {
            const age = i - o.candleIndex;
            const drift = o.side==='buy' ? (o.price-mid)/(o.price||1) : (mid-o.price)/(o.price||1);

            if(age >= dynamicConfig.MAX_ORDER_AGE || Math.abs(drift) > dynamicConfig.PRICE_TOLERANCE) return false;

            if(o.side==='buy' && mid<=o.price){
                const fee = o.qty*mid*dynamicConfig.FEE_PCT;
                balance.base += o.qty;
                balance.quote -= o.qty*mid + fee;
                totalCost += o.qty*mid;
                trades.push({side:'buy', price:mid, qty:o.qty, fee, candleIndex:i, timestamp:c.timestamp});
                lastExecCandle = i;
                return false;
            }

            if(o.side==='sell' && balance.base>=o.qty && mid>=o.price){
                const avgPrice = balance.base>0 ? totalCost/balance.base : 0;
                const pnl = (mid-avgPrice)*o.qty - o.qty*mid*dynamicConfig.FEE_PCT;
                const target = o.qty*mid*profitPct;
                const acceptByPartial = pnl>=(target*0.3); // aceita se lucro >= 30% do alvo
                const acceptByAge = age>=dynamicConfig.MAX_ORDER_AGE_FORCED && pnl>-o.qty*mid*0.01;

                if(!acceptByPartial && !acceptByAge){
                    rejected++;
                    trades.push({side:'sell', price:mid, qty:o.qty, rejected:true, candleIndex:i, timestamp:c.timestamp});
                    return true;
                }

                balance.base -= o.qty;
                balance.quote += o.qty*mid - o.qty*mid*dynamicConfig.FEE_PCT;
                totalCost -= avgPrice*o.qty;
                totalPnL += pnl;
                trades.push({side:'sell', price:mid, qty:o.qty, pnl, fee:o.qty*mid*dynamicConfig.FEE_PCT, candleIndex:i, timestamp:c.timestamp});
                lastExecCandle = i;
                return false;
            }

            return true;
        });

        // força venda se não houve trade
        if(balance.base > dynamicConfig.FORCE_SELL_THRESHOLD && (i - lastExecCandle) >= dynamicConfig.NO_TRADE_THRESHOLD){
            const sellQty = Math.min(balance.base, Math.max(dynamicConfig.ORDER_SIZE_MIN, balance.base*0.7));
            const sellPrice = +(mid*0.999).toFixed(8);
            const fee = sellQty*sellPrice*dynamicConfig.FEE_PCT;
            const avgPrice = balance.base>0 ? totalCost/balance.base : 0;
            const pnl = (sellPrice-avgPrice)*sellQty - fee;

            if(pnl>=-sellQty*sellPrice*0.005){
                balance.base -= sellQty;
                balance.quote += sellQty*sellPrice - fee;
                totalCost -= avgPrice*sellQty;
                totalPnL += pnl;
                forced++;
                trades.push({id:'forced-'+i, side:'sell', price:sellPrice, qty:sellQty, pnl, fee, candleIndex:i, forced:true, timestamp:c.timestamp});
                lastExecCandle = i;
            }
        }

        const snapshotValue = balance.quote + balance.base*c.c;
        if(snapshotValue > peakValue.val) peakValue.val = snapshotValue;
        const drawdown = ((peakValue.val-snapshotValue)/peakValue.val)*100;
        if(drawdown>maxDrawdown) maxDrawdown = drawdown;

        balanceSnapshots.push({quote:balance.quote, base:balance.base, value:snapshotValue, cumRoi:((snapshotValue-START_BALANCE)/START_BALANCE)*100, drawdown:+drawdown.toFixed(2)});
        heatmap.push({i, timestamp:c.timestamp, vol:+vol.toFixed(3), spread:+spread.toFixed(6), profitPct:+profitPct.toFixed(6), size:+size.toFixed(6), openOrders:orders.length});
    }

    const finalSnapshot = balanceSnapshots[balanceSnapshots.length-1] || {value:START_BALANCE};
    const finalValue = finalSnapshot.value;
    const totalROI = ((finalValue-START_BALANCE)/START_BALANCE)*100;

    console.log(`[RESULT] Final ROI: ${totalROI.toFixed(2)}%, Total PnL: ${totalPnL.toFixed(2)}, Rejected: ${rejected}, Forced: ${forced}`);

    return {
        pair: pairName,
        totalPnL: +totalPnL.toFixed(2),
        roi: +totalROI.toFixed(2),
        trades: trades.length,
        rejected,
        forced,
        finalBalance: {base: +(balanceSnapshots[balanceSnapshots.length-1]?.base || 0).toFixed(8), quote: +(balanceSnapshots[balanceSnapshots.length-1]?.quote || 0).toFixed(2)},
        volatilityAvg: volWindow.length>0 ? +(volWindow.reduce((a,b)=>a+b,0)/volWindow.length).toFixed(3) : 0,
        tradesDetails: trades,
        heatmap,
        balanceSnapshots,
        maxDrawdown: +maxDrawdown.toFixed(2)
    };
}

// ---------------- automatic param tuning ----------------
async function paramTuning(pairName, rows) {
    // Calcular volatilidade média do dataset
    let volSum = 0, volCount = 0;
    for (let i = 1; i < rows.length; i++) {
        const c = rows[i];
        if (!c || !isFinite(c.h) || !isFinite(c.l)) continue;
        const mid = (c.h + c.l) / 2;
        const vol = ((c.h - c.l) / mid) * 100;
        volSum += vol;
        volCount++;
    }
    const avgVol = volCount > 0 ? volSum / volCount : 0;

    const MIN_PROFIT_BASE_LIST = [0.0005, 0.0007, 0.001].map(v => v * (1 + avgVol * 0.01));
    const SPREAD_BASE_LIST = [0.0004, 0.0005, 0.0006].map(v => v * (1 + avgVol * 0.008));
    const ORDER_QUOTE_FRACTION_LIST = [0.05, 0.1, 0.2].map(v => Math.min(v * (1 + avgVol * 0.005), 0.25));

    let bestConfig = {roi: -Infinity, params: {}};

    for (let mpb of MIN_PROFIT_BASE_LIST) {
        for (let sb of SPREAD_BASE_LIST) {
            for (let oqf of ORDER_QUOTE_FRACTION_LIST) {
                CONFIG.MIN_PROFIT_BASE = mpb;
                CONFIG.SPREAD_BASE = sb;
                CONFIG.ORDER_QUOTE_FRACTION = oqf;

                const result = simulatePair(pairName, rows);

                if (result.roi > bestConfig.roi ||
                    (result.roi === bestConfig.roi && result.maxDrawdown < bestConfig.maxDrawdown)) {
                    bestConfig = {
                        roi: result.roi,
                        maxDrawdown: result.maxDrawdown,
                        totalPnL: result.totalPnL,
                        params: {MIN_PROFIT_BASE: mpb, SPREAD_BASE: sb, ORDER_QUOTE_FRACTION: oqf}
                    };
                }
            }
        }
    }

    CONFIG.MIN_PROFIT_BASE = bestConfig.params.MIN_PROFIT_BASE;
    CONFIG.SPREAD_BASE = bestConfig.params.SPREAD_BASE;
    CONFIG.ORDER_QUOTE_FRACTION = bestConfig.params.ORDER_QUOTE_FRACTION;

    console.log('[PARAM TUNING] Melhor configuração encontrada (ajustada pela volatilidade média):', bestConfig.params,
        `ROI: ${bestConfig.roi.toFixed(2)}%, Max Drawdown: ${bestConfig.maxDrawdown.toFixed(2)}%`);

    return bestConfig;
}

// ---------------- main ----------------
async function main() {
    const rows = readCSV(INPUT);
    await paramTuning('BTC-BRL', rows);
    const finalResult = simulatePair('BTC-BRL', rows);
    console.log('[FINAL RESULT]', finalResult);
}

main().then(r => {
}).catch(err => console.error(err));

module.exports = {simulatePair, CONFIG};