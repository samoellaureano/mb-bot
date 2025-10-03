#!/usr/bin/env node
/**
 * backtester.js - Advanced CSV candle backtester aligned with bot.js v1.2.0
 * Melhorias para aumentar frequência de negociações e lucratividade:
 * - Filtro de volatilidade ajustado para 0.1% < volatility < 2.5%.
 * - Cooldown dinâmico (0 para volatilidade < 0.4%, 1 caso contrário).
 * - Escalonamento de spread com mínimo de 0.05% e ampliação limitada a 1.1x.
 * - Tamanho de ordem com multiplicador 1 + volatility/120.
 * - Stop-loss reduzido para 0.8%.
 * - RSI (período 12) com peso 80%, SMA (período 8) com peso 20%.
 * - Filtro de volume mínimo reduzido para 0.00005.
 * - Spreads testados em [0.0005, 0.0007, 0.001, 0.0012].
 * - Tamanhos de ordem testados em [0.0002, 0.0003, 0.0004].
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');

if (process.argv.length < 3) {
    console.error('uso: node backtester.js path/to/candles.csv [--test]');
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
    console.error('Nenhum dado no CSV');
    process.exit(1);
}

// -------------------- CONFIGURAÇÃO --------------------
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.0007'); // Alinhado ao melhor parâmetro
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.0003'); // Alinhado ao melhor parâmetro
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0005'); // Reduzido para spreads mais apertados
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.0001');
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0004'); // Aumentado para explorar lucros
const VOLATILITY_LIMIT_PCT = parseFloat(process.env.VOLATILITY_LIMIT_PCT || '1.5');
const FEE_PCT = parseFloat(process.env.FEE_PCT || '0.0001');
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002');
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.00015');
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '10');
const PRICE_TOLERANCE = parseFloat(process.env.PRICE_TOLERANCE || '0.002');
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '0.008'); // Stop-loss de 0.8%
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005'); // Filtro de volume reduzido

const log = (message) => console.log(`[BACKTEST] ${message}`);
log(`Configuração: SPREAD_PCT=${SPREAD_PCT}, ORDER_SIZE=${ORDER_SIZE}, MIN_SPREAD_PCT=${MIN_SPREAD_PCT}, FEE_PCT=${FEE_PCT}, MAX_ORDER_AGE=${MAX_ORDER_AGE}, PRICE_TOLERANCE=${PRICE_TOLERANCE}, STOP_LOSS_PCT=${STOP_LOSS_PCT}, MIN_VOLUME=${MIN_VOLUME}`);

// -------------------- SALDO INICIAL --------------------
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

// -------------------- INDICADORES --------------------
function calculateRSI(index, period = 12) { // Período reduzido para 12
    if (index < period) return 50;
    let gains = 0, losses = 0;
    for (let i = index - period; i < index; i++) {
        const change = parseFloat(rows[i + 1].c) - parseFloat(rows[i].c);
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : (avgGain === 0 ? 0 : avgGain / avgLoss);
    return 100 - (100 / (1 + rs));
}

function calculateSMA(index, period = 20) {
    if (index < period) return parseFloat(rows[index].c);
    let sum = 0;
    for (let i = index - period; i < index; i++) {
        sum += parseFloat(rows[i].c);
    }
    return sum / period;
}

function fetchPricePrediction(candle, index) {
    const rsi = calculateRSI(index);
    const smaShort = calculateSMA(index, 8); // Período reduzido para 8
    const smaLong = calculateSMA(index, 20);
    let trend = 'neutral';
    let rsiConfidence = Math.abs(rsi - 50) / 50;
    let smaConfidence = Math.abs(smaShort - smaLong) / smaLong;

    // Peso: 80% RSI, 20% SMA
    let confidence = 0.8 * rsiConfidence + 0.2 * smaConfidence;
    if (rsi > 70 || (smaShort > smaLong && rsi > 50)) {
        trend = 'down';
    } else if (rsi < 30 || (smaShort < smaLong && rsi < 50)) {
        trend = 'up';
    }
    return { trend, confidence: Math.min(confidence, 1) };
}

// -------------------- GERENCIAMENTO DE ORDENS --------------------
function placeSim(side, price, qty, candleIndex) {
    if (isNaN(price) || price <= 0) {
        log(`Preço inválido para ordem ${side}: ${price}`);
        return null;
    }
    const id = 'bt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const o = { id, side, price, qty, status: 'open', candlePlaced: candleIndex };
    orders.push(o);
    log(`Ordem ${side} colocada ${id}: Preço=${price}, Quantidade=${qty.toFixed(6)}, CandleIndex=${candleIndex}`);
    return o;
}

function processCandle(c, candleIndex) {
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const mid = (high + low) / 2;

    if (isNaN(high) || isNaN(low) || high <= 0 || low <= 0 || high < low) {
        log(`Dados de candle inválidos: high=${high}, low=${low}, mid=${mid}, timestamp=${c.timestamp}`);
        return;
    }

    const volatility = ((high - low) / mid) * 100;
    const pred = fetchPricePrediction(c, candleIndex);
    if (pred.trend === 'up') log(`Previsão: ${pred.trend}, ajustando viés de venda`);
    else if (pred.trend === 'down') log(`Previsão: ${pred.trend}, ajustando viés de compra`);

    orders = orders.filter(o => {
        const age = candleIndex - o.candlePlaced;
        const drift = o.price > 0 ?
            (o.side === 'buy' ? (o.price - mid) / o.price : (mid - o.price) / o.price) : 0;
        if (isNaN(drift)) {
            log(`Drift inválido para ${o.side} ${o.id}: preço=${o.price}, mid=${mid}`);
            return false;
        }
        const stopLossTriggered = o.side === 'buy' ? (mid >= o.price * (1 + STOP_LOSS_PCT)) :
            (mid <= o.price * (1 - STOP_LOSS_PCT));
        if (age >= MAX_ORDER_AGE || Math.abs(drift) > PRICE_TOLERANCE || stopLossTriggered) {
            log(`Cancelada ${o.side} ${o.id}: Idade=${age}, Drift=${(drift * 100).toFixed(2)}%, StopLoss=${stopLossTriggered}`);
            return false;
        }

        if (o.side === 'buy' && mid <= o.price) {
            const fillPrice = mid;
            const fee = o.qty * fillPrice * FEE_PCT;
            balance.base += o.qty;
            balance.quote -= (o.qty * fillPrice + fee);
            totalCost += o.qty * fillPrice;
            trades.push({ id: o.id, side: 'buy', price: fillPrice, qty: o.qty, fee, timestamp: c.timestamp });
            log(`Compra preenchida ${o.id} @ ${fillPrice}, Taxa: ${fee.toFixed(2)}, Base: ${balance.base.toFixed(8)}, Quote: ${balance.quote.toFixed(2)}, TotalPnL: ${totalPnL.toFixed(2)}`);
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
            trades.push({ id: o.id, side: 'sell', price: fillPrice, qty: o.qty, fee, pnl, timestamp: c.timestamp });
            log(`Venda preenchida ${o.id} @ ${fillPrice}, PnL: ${pnl.toFixed(2)}, Taxa: ${fee.toFixed(2)}, Base: ${balance.base.toFixed(8)}, Quote: ${balance.quote.toFixed(2)}, TotalPnL: ${totalPnL.toFixed(2)}`);
            lastTradeCandle = candleIndex;
            return false;
        }
        return true;
    });
}

// -------------------- SIMULAÇÃO --------------------
function runSimulation(spreadPct = SPREAD_PCT, orderSize = ORDER_SIZE) {
    balance = { base: parseFloat(process.env.INIT_BASE || '0.0001'), quote: parseFloat(process.env.INIT_QUOTE || '10000.0') };
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

        if (!c.timestamp || c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 || isNaN(c.volume)) {
            log(`Ignorando candle inválido em ${c.timestamp}`);
            candleIndex++;
            continue;
        }

        if (c.volume < MIN_VOLUME) {
            log(`Ignorando candle ${c.timestamp}: volume=${c.volume} abaixo do limite ${MIN_VOLUME}`);
            candleIndex++;
            continue;
        }

        let low = c.low;
        if (candleIndex > 0) {
            const prevClose = parseFloat(rows[candleIndex - 1].c);
            if (!isNaN(prevClose) && prevClose > 0) {
                low = Math.min(low, prevClose);
            }
        }

        if (low <= 0) {
            log(`Ignorando candle ${c.timestamp}: preço baixo inválido ${low}`);
            candleIndex++;
            continue;
        }

        const mid = (c.high + low) / 2;
        const volatility = ((c.high - c.low) / mid) * 100;

        if (volatility > 2.5 || volatility < 0.1) {
            log(`Ignorando candle ${c.timestamp}: volatilidade=${volatility.toFixed(2)}%`);
            candleIndex++;
            continue;
        }

        const dynamicCooldown = volatility < 0.4 ? 0 : 1; // Ajustado para 0.4%
        if (candleIndex - lastTradeCandle < dynamicCooldown) {
            log(`Ignorando candle ${c.timestamp}: cooldown (última negociação em ${lastTradeCandle})`);
            candleIndex++;
            continue;
        }

        let depthFactor = c.volume > 0 ? c.volume / (orderSize * 20) : 1;
        let dynamicSpreadPct = Math.max(MIN_SPREAD_PCT, spreadPct * Math.max(1, depthFactor * 0.5));
        if (volatility >= VOLATILITY_LIMIT_PCT) dynamicSpreadPct *= 1.1; // Reduzido de 1.15x
        else if (volatility < 0.5) dynamicSpreadPct *= 0.9;
        dynamicSpreadPct = Math.min(dynamicSpreadPct, 0.01);

        let dynamicOrderSize = Math.max(MIN_ORDER_SIZE, Math.min(MAX_ORDER_SIZE, orderSize * (1 + volatility / 120)));

        const currentBaseValue = mid * balance.base;
        const currentQuoteValue = balance.quote;
        const totalValue = currentBaseValue + currentQuoteValue;
        const imbalance = totalValue > 0 ? (currentBaseValue - currentQuoteValue) / totalValue : 0;
        let inventoryBias = 0;
        if (Math.abs(imbalance) > INVENTORY_THRESHOLD) {
            inventoryBias = -imbalance * BIAS_FACTOR;
        }

        const pred = fetchPricePrediction(c, candleIndex);
        let trendBias = 0;
        if (pred.trend === 'up') {
            trendBias = pred.confidence * BIAS_FACTOR * 1.5;
        } else if (pred.trend === 'down') {
            trendBias = -pred.confidence * BIAS_FACTOR * 1.5;
        }

        const totalBias = inventoryBias + trendBias;
        const refPrice = mid * (1 + totalBias);

        const halfSpread = dynamicSpreadPct / 2;
        const buyP = +(refPrice * (1 - halfSpread)).toFixed(2);
        const sellP = +(refPrice * (1 + halfSpread)).toFixed(2);

        log(`Candle ${c.timestamp}: mid=${mid.toFixed(2)}, volatilidade=${volatility.toFixed(2)}%, spread=${(dynamicSpreadPct * 100).toFixed(2)}%, depthFactor=${depthFactor.toFixed(4)}, negociações=${trades.length}, viés=${totalBias.toFixed(6)}`);

        const buyOrder = placeSim('buy', buyP, dynamicOrderSize, candleIndex);
        const sellOrder = placeSim('sell', sellP, dynamicOrderSize, candleIndex);
        if (!buyOrder || !sellOrder) continue;

        const preQuote = balance.quote;
        processCandle(c, candleIndex);

        const timestamp = new Date(c.timestamp);
        const month = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}`;
        if (month !== currentMonth) {
            if (currentMonth) log(`PnL para ${currentMonth}: ${monthlyPnL.toFixed(2)}`);
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
        finalBalance: { base: balance.base.toFixed(8), quote: balance.quote.toFixed(2) }
    };
}

// -------------------- EXECUÇÃO --------------------
if (TEST_MODE) {
    const spreadTests = [0.0005, 0.0007, 0.001, 0.0012]; // Spreads ajustados
    const sizeTests = [0.0002, 0.0003, 0.0004]; // Tamanhos ajustados
    const resultsData = [];
    log(`Executando testes: Spreads ${spreadTests.join(', ')}, Tamanhos ${sizeTests.join(', ')}`);
    let bestPnL = -Infinity;
    let bestParams = {};
    for (const spread of spreadTests) {
        for (const size of sizeTests) {
            const results = runSimulation(spread, size);
            resultsData.push({ spread, size, totalPnL: parseFloat(results.totalPnL) });
            log(`Teste Spread ${spread * 100}%, Tamanho ${size}: PnL ${results.totalPnL}, Negociações ${results.trades}, ROI ${results.roi}%`);
            if (parseFloat(results.totalPnL) > bestPnL) {
                bestPnL = parseFloat(results.totalPnL);
                bestParams = { spreadPct: spread, orderSize: size };
            }
        }
    }
    log(`Melhores parâmetros: Spread ${bestParams.spreadPct * 100}%, Tamanho ${bestParams.orderSize}, PnL ${bestPnL.toFixed(2)}`);
    log(`Resultados para gráfico: ${JSON.stringify(resultsData)}`);
} else {
    const results = runSimulation();
    log(`Saldo Final: ${results.finalBalance.base} BTC, ${results.finalBalance.quote} BRL`);
    log(`PnL Total: ${results.totalPnL}`);
    log(`PnL do Último Mês: ${results.monthlyPnL}`);
    log(`ROI: ${results.roi}%`);
    log(`Taxa de Preenchimento: ${results.fillRate}`);
    log(`Negociações Executadas: ${results.trades}`);
    log(`Últimas Negociações:`, trades.slice(-5).map(t => `${t.side} @ ${t.price} (PnL: ${t.pnl?.toFixed(2) || 0})`));
}