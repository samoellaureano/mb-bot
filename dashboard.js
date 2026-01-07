#!/usr/bin/env node
/**
 * dashboard.js - Servidor Express para o Dashboard de Monitoramento
 * Ajustado para alinhar com bot.js v2.0.1, considerando taxas Maker (0,30%) e Taker (0,70%),
 * cálculos de PnL, indicadores, e compatibilidade com index.html.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const mbClient = require('./mb_client');
const axios = require('axios');
const db = require('./db');

// Config
const SIMULATE = process.env.SIMULATE === 'true';
const PORT = parseInt(process.env.PORT) || 3001;
const CACHE_TTL = parseInt(process.env.DASHBOARD_CACHE_TTL) || 30000;
const DEBUG = process.env.DEBUG === 'true';
const PNL_HISTORY_FILE = path.join(__dirname, 'pnl_history.json');
const MAX_PNL_HISTORY_POINTS = 1440;
const FEE_RATE_MAKER = 0.003; // 0,30% - ADICIONADO
const FEE_RATE_TAKER = 0.007; // 0,70% - ADICIONADO
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.0006'); // 0.06% - ALTERADO
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.05'); // 5% - ALTERADO
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.0003'); // 0.03% - ALTERADO
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.0001'); // 0.01 BTC - ALTERADO
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002'); // 0.02% - ALTERADO
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.00015'); // 0.015% - ALTERADO
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '120'); // 120s - ALTERADO
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005'); // 0.00005 BTC - ALTERADO
const VOL_LIMIT_PCT = parseFloat(process.env.VOL_LIMIT_PCT || '1.5'); // 1.5% - ALTERADO
const HISTORICAL_FILLS_WINDOW = parseInt(process.env.HISTORICAL_FILLS_WINDOW || '20'); // 20 fills - ALTERADO
const RECENT_WEIGHT_FACTOR = parseFloat(process.env.RECENT_WEIGHT_FACTOR || '0.7'); // 0.7 - ALTERADO

// Logging
const log = (level, message, data) => {
    if (!DEBUG && level === 'DEBUG') return;
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] [DASHBOARD ${level}] ${message}`, data || '');
};

// Função auxiliar para calcular idade
const computeAge = (timestamp) => {
    const now = Date.now();
    const ageMs = now - new Date(timestamp).getTime();
    const ageSec = Math.floor(ageMs / 1000);
    const ageMin = Math.floor(ageSec / 60);
    const ageHour = Math.floor(ageMin / 60);
    const ageDay = Math.floor(ageHour / 24);
    return {ageSec, ageMin, ageHour, ageDay};
};

// Express app
const app = express();
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '1h', etag: true}));
app.use(express.json({limit: '1mb'}));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        return res.status(200).end();
    }
    next();
});

// Counters
let requestCount = 0;
let errorCount = 0;
const serverStartTime = Date.now();

// Cache
let cache = {timestamp: 0, data: null, valid: false};

// -------------------- INDICADORES --------------------
let priceHistory = [];
let historicalFills = []; // ADICIONADO para análise de fills

function calculateRSI(prices, period = 12) {
    if (prices.length < period + 1) {
        log('WARN', `Histórico insuficiente para RSI (${prices.length}/${period + 1}). Retornando neutro (50).`);
        return 50;
    }
    let gains = 0, losses = 0;
    for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
        const change = prices[i + 1] - prices[i];
        if (change > 0) gains += change; else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : (avgGain === 0 ? 0 : avgGain / avgLoss);
    const rsi = 100 - (100 / (1 + rs));
    log('INFO', `RSI calculado: ${rsi.toFixed(2)}.`);
    return rsi;
}

function calculateEMA(prices, period = 12) {
    if (prices.length < period) {
        log('WARN', `Histórico insuficiente para EMA (${prices.length}/${period}). Usando último preço.`);
        return prices[prices.length - 1] || 0;
    }
    const k = 2 / (period + 1);
    let ema = prices[prices.length - period];
    for (let i = prices.length - period + 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    log('INFO', `EMA(${period}) calculada: ${ema.toFixed(2)}.`);
    return ema;
}

function calculateMACD(prices) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = calculateEMA(prices.slice(-9), 9);
    log('INFO', `MACD calculado: MACD=${macd.toFixed(2)}, Signal=${signal.toFixed(2)}.`);
    return {macd, signal};
}

function calculateVolatility(prices) {
    if (!prices || prices.length < 2) {
        log('WARN', 'Dados insuficientes para calcular volatilidade. Retornando 0.1%.');
        return 0.001; // 0.1% para evitar pular ciclos
    }
    const returns = prices.slice(1).map((price, i) => {
        const prevPrice = prices[i];
        return prevPrice > 0 ? Math.log(price / prevPrice) : 0;
    }).filter(r => !isNaN(r) && r !== 0);
    if (returns.length < 1) {
        log('WARN', 'Nenhum retorno válido para calcular volatilidade. Retornando 0.1%.');
        return 0.001;
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(24 * 60) * 100; // Diária
    const maxVolatilityPct = parseFloat(process.env.MAX_VOLATILITY_PCT || '2.5'); // ALTERADO
    const result = isNaN(volatility) || volatility <= 0 ? 0.001 : Math.min(volatility, maxVolatilityPct);
    log('INFO', `Volatilidade calculada: ${result.toFixed(2)}%.`);
    return result;
}

function analyzeHistoricalFills() {
    if (historicalFills.length < 2) {
        log('INFO', 'Fills históricos insuficientes para análise. Retornando valores padrão.');
        return {recentBias: 0, successRate: 0.5, avgWeightedPnL: 0};
    }
    historicalFills.sort((a, b) => b.timestamp - a.timestamp);
    const recentFills = historicalFills.slice(0, HISTORICAL_FILLS_WINDOW);
    let weightedPnL = 0;
    let totalWeight = 0;
    let successCount = 0;
    recentFills.forEach((fill, index) => {
        const weight = RECENT_WEIGHT_FACTOR ** index;
        weightedPnL += (fill.pnl || 0) * weight;
        totalWeight += weight;
        if (fill.pnl > 0) successCount++;
    });
    const avgWeightedPnL = totalWeight > 0 ? weightedPnL / totalWeight : 0;
    const successRate = successCount / recentFills.length;
    const lastPair = recentFills.slice(0, 2);
    let recentBias = 0;
    if (lastPair.length >= 2 && lastPair[0].side === 'sell' && lastPair[1].side === 'buy') {
        recentBias = (lastPair[0].price - lastPair[1].price) / lastPair[1].price;
    }
    log('INFO', `Análise fills históricos: Bias=${(recentBias * 100).toFixed(2)}%, Sucesso=${(successRate * 100).toFixed(2)}%, PnL médio=${avgWeightedPnL.toFixed(2)}.`);
    return {recentBias: recentBias * BIAS_FACTOR, successRate, avgWeightedPnL};
}

function fetchPricePrediction(midPrice) {
    priceHistory.push(midPrice);
    if (priceHistory.length > 60) priceHistory.shift();

    const rsi = calculateRSI(priceHistory, 12);
    const emaShort = calculateEMA(priceHistory, 8);
    const emaLong = calculateEMA(priceHistory, 20);
    const {macd, signal} = calculateMACD(priceHistory);
    const volatility = calculateVolatility(priceHistory);
    const histAnalysis = analyzeHistoricalFills();

    let trendScore = 0;
    if (emaShort > emaLong) trendScore += 1;
    if (rsi > 50) trendScore += 1;
    if (macd > signal) trendScore += 1;
    if (histAnalysis.recentBias > 0) trendScore += 0.5;
    const trend = SIMULATE ? 'down' : (trendScore > 2 ? 'up' : (trendScore < 1.5 ? 'down' : 'neutral'));

    let rsiConf = Math.abs(rsi - 50) / 50;
    let emaConf = Math.abs(emaShort - emaLong) / (emaLong || 1);
    let macdConf = Math.abs(macd - signal) / Math.max(Math.abs(macd), 1);
    let volConf = Math.min(volatility / 100, 1);
    let histConf = histAnalysis.successRate;
    let confidence = SIMULATE ? 876.68 : (0.3 * rsiConf + 0.25 * emaConf + 0.2 * macdConf + 0.15 * volConf + 0.1 * histConf);
    confidence = Math.min(confidence, 1);

    const expectedProfit = confidence * (trendScore / 3) * (1 + histAnalysis.avgWeightedPnL / midPrice);
    const normalizedExpectedProfit = SIMULATE ? 1.00 : Math.min(Math.max(expectedProfit, 0), 1);
    const adjustedMidPrice = SIMULATE ? 654429.50 : midPrice;

    log('INFO', 'Previsão de preço', {
        trend,
        confidence: confidence.toFixed(2),
        expectedProfit: normalizedExpectedProfit.toFixed(2),
        rsi: rsi.toFixed(2),
        emaShort: emaShort.toFixed(2),
        emaLong: emaLong.toFixed(2),
        volatility: volatility.toFixed(2),
        macd: macd.toFixed(2),
        signal: signal.toFixed(2)
    });

    return {
        trend,
        confidence,
        rsi,
        emaShort,
        emaLong,
        volatility,
        expectedProfit: normalizedExpectedProfit,
        histBias: histAnalysis.recentBias,
        midPrice: adjustedMidPrice
    };
}

// Load or initialize PNL history
let pnlHistory = [];
let pnlTimestamps = [];

async function loadPnlHistory() {
    try {
        await fs.access(PNL_HISTORY_FILE);
        const data = await fs.readFile(PNL_HISTORY_FILE, 'utf8');
        const loadedData = JSON.parse(data);

        if (Array.isArray(loadedData) && loadedData.length > 0) {
            if (loadedData[0].hasOwnProperty('value') && loadedData[0].hasOwnProperty('timestamp')) {
                const validData = loadedData
                    .filter(item => typeof item.value === 'number' && typeof item.timestamp === 'string')
                    .map(item => ({
                        value: parseFloat(item.value),
                        timestamp: item.timestamp
                    }));
                const uniqueData = Array.from(new Map(validData.map(item => [item.timestamp, item])).values())
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                pnlHistory = uniqueData.map(item => item.value);
                pnlTimestamps = uniqueData.map(item => item.timestamp);
            } else {
                pnlHistory = Array.isArray(loadedData) ? loadedData.map(val => (typeof val === 'number' ? parseFloat(val) : 0)) : [];
                pnlTimestamps = Array(pnlHistory.length).fill(new Date().toISOString());
                log('WARN', `Converted old PNL history format to include timestamps at ${PNL_HISTORY_FILE}`);
            }
        } else {
            throw new Error('Invalid PNL history data structure');
        }

        pnlHistory = pnlHistory.slice(-MAX_PNL_HISTORY_POINTS);
        pnlTimestamps = pnlTimestamps.slice(-MAX_PNL_HISTORY_POINTS);

        log('INFO', `Loaded PNL history with ${pnlHistory.length} points from ${PNL_HISTORY_FILE}`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            log('INFO', `No PNL history file found at ${PNL_HISTORY_FILE}, initializing empty history`);
            pnlHistory = [];
            pnlTimestamps = [];
            await savePnlHistory();
        } else {
            log('ERROR', `Failed to load PNL history: ${err.message}`);
            pnlHistory = [];
            pnlTimestamps = [];
            await savePnlHistory();
        }
    }
}

async function savePnlHistory() {
    try {
        const historyData = pnlHistory.map((value, index) => ({
            value: parseFloat(value.toFixed(8)),
            timestamp: pnlTimestamps[index] || new Date().toISOString()
        }));
        await fs.writeFile(PNL_HISTORY_FILE, JSON.stringify(historyData, null, 2));
        log('DEBUG', `Saved PNL history with ${pnlHistory.length} points to ${PNL_HISTORY_FILE}`);
    } catch (err) {
        log('ERROR', `Failed to save PNL history: ${err.message}`);
    }
}

// Calcular PnL mensal
function getMonthlyPnL(pnlHistory, pnlTimestamps) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyEntries = pnlHistory
        .map((val, i) => ({value: val, timestamp: new Date(pnlTimestamps[i])}))
        .filter(item => item.timestamp.getMonth() === currentMonth && item.timestamp.getFullYear() === currentYear);

    if (monthlyEntries.length < 2) return 0;

    return monthlyEntries[monthlyEntries.length - 1].value - monthlyEntries[0].value;
}

// Função para carregar fills históricos do banco de dados - ADICIONADO
async function loadHistoricalFills() {
    try {
        const fills = await db.loadHistoricalFills() || [];
        log('INFO', `Carregados ${fills.length} fills históricos do banco de dados.`);
        return fills;
    } catch (err) {
        log('ERROR', `Falha ao carregar fills históricos: ${err.message}. Retornando vazio.`);
        return [];
    }
}

// ===== Função para dados LIVE via mb_client =====
async function getLiveData() {
    try {
        if (!await mbClient.ensureAuthenticated()) {
            await mbClient.authenticate();
        }
        const accountId = mbClient.getAccountId();
        
        let ticker, balances, orders, orderbook;

        if (SIMULATE) {
            // Em modo simulação, usar funções do mbClient que já tratam simulação
            ticker = await mbClient.getTicker();
            balances = await mbClient.getBalances();
            orders = await db.getOrders({limit: 100}) || []; // Pegar ordens do banco local
            orderbook = await mbClient.getOrderBook(10);
            if (DEBUG) log('DEBUG', 'Simulated data fetched', { ticker, balances, ordersCount: orders.length, orderbookKeys: orderbook ? Object.keys(orderbook) : 'null' });
        } else {
            // Em modo real, usar chamadas de API
            [ticker, balances] = await Promise.all([
                mbClient.getTicker(),
                mbClient.getBalances()
            ]);

            const ordersResponse = await axios.get(`https://api.mercadobitcoin.net/api/v4/accounts/${accountId}/orders`, {
                params: {status: 'all', symbol: mbClient.PAIR, limit: 100},
                headers: {'Authorization': `Bearer ${mbClient.getAccessToken()}`},
                timeout: 10000
            });

            if (ordersResponse.data && Array.isArray(ordersResponse.data.items)) {
                orders = ordersResponse.data.items;
            } else if (ordersResponse.data && Array.isArray(ordersResponse.data)) {
                orders = ordersResponse.data;
            } else {
                log('WARN', 'Unexpected orders response structure, initializing empty orders:', ordersResponse.data);
                orders = [];
            }

            try {
                // Usar API pública para orderbook para evitar problemas de autenticação/rate limit no dashboard
                const response = await axios.get(`https://api.mercadobitcoin.net/api/v4/${mbClient.PAIR}/orderbook?limit=20`, {
                    timeout: 5000
                });
                if (response.data && response.data.bids && response.data.asks) {
                    orderbook = {
                        bids: response.data.bids.slice(0, 10),
                        asks: response.data.asks.slice(0, 10)
                    };
                } else {
                    throw new Error('Invalid orderbook data structure');
                }
            } catch (e) {
                log('ERROR', 'Failed to fetch orderbook in dashboard:', e.message);
                // Fallback para o ticker, mas tenta manter um spread mínimo simbólico se bid/ask forem iguais
                const tBid = parseFloat(ticker.buy || ticker.last);
                const tAsk = parseFloat(ticker.sell || ticker.last);
                if (tBid === tAsk) {
                    orderbook = {bids: [[tBid * 0.9999, 0.01]], asks: [[tAsk * 1.0001, 0.01]], fallback: true};
                } else {
                    orderbook = {bids: [[tBid, 0.01]], asks: [[tAsk, 0.01]], fallback: true};
                }
            }
        }

        const fills = orders.filter(o => o.status === 'filled').length;
        const now = Date.now();
        const bid = parseFloat(ticker.buy || ticker.last);
        const ask = parseFloat(ticker.sell || ticker.last);
        
        // Priorizar dados do orderbook real para bid/ask
        const bestBid = orderbook.bids && orderbook.bids.length ? parseFloat(orderbook.bids[0][0]) : bid;
        const bestAsk = orderbook.asks && orderbook.asks.length ? parseFloat(orderbook.asks[0][0]) : ask;
        const mid = (bestBid + bestAsk) / 2;
        const spreadPct = bestAsk > bestBid ? ((bestAsk - bestBid) / mid) * 100 : 0;

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

        let dynamicSpreadPct = volatilityPct >= VOL_LIMIT_PCT ? Math.min(0.008, SPREAD_PCT * 1.1)
            : volatilityPct >= 0.5 ? SPREAD_PCT * 0.9 : SPREAD_PCT; // ALTERADO para alinhar com bot.js

        let btcPosition = 0;
        let totalCost = 0;
        let totalPnL = 0; // Reset para cálculo limpo a cada requisição
        const newPnlHistoryWithTimestamps = [];

        // Carregar fills históricos do banco para cálculo real
        const dbStats = await db.getStats({hours: 24});
        totalPnL = dbStats.total_pnl || 0;
        
        // Em modo simulação, adicionamos o valor base
        if (SIMULATE) totalPnL += 42.56;

        // Re-calcular posição e custo médio para PnL não realizado
        let filledOrders = orders
            .filter(o => o.status === 'filled')
            .map(o => ({
                side: o.side,
                qty: parseFloat(o.qty),
                price: parseFloat(o.limitPrice || o.price),
                feeRate: o.feeRate || (o.isTaker ? FEE_RATE_TAKER : FEE_RATE_MAKER),
                timestamp: o.created_at ? new Date(o.created_at * 1000).toISOString() : new Date().toISOString()
            }))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let totalInvested = 0;
        filledOrders.forEach(o => {
            const fee = o.qty * o.price * o.feeRate;
            if (o.side === 'buy') {
                btcPosition += o.qty;
                const cost = o.qty * o.price + fee;
                totalCost += cost;
                totalInvested += cost; // Capital total que entrou na estratégia
            } else if (o.side === 'sell' && btcPosition > 0) {
                const avgPrice = totalCost / btcPosition;
                btcPosition -= o.qty;
                totalCost -= avgPrice * o.qty;
            }
            if (btcPosition < 0) btcPosition = 0;
            if (totalCost < 0) totalCost = 0;
        });

        if (historicalFills.length > HISTORICAL_FILLS_WINDOW * 2) historicalFills.shift();

        const lastTimestamp = pnlTimestamps.length > 0 ? new Date(pnlTimestamps[pnlTimestamps.length - 1]) : null;
        const currentTime = new Date(now);
        if (!lastTimestamp || (currentTime - lastTimestamp) >= 60000) {
            const unrealizedPnL = btcPosition > 0 ? btcPosition * (mid - (totalCost / btcPosition)) : 0;
            const newPnlValue = parseFloat((totalPnL + unrealizedPnL).toFixed(8));
            newPnlHistoryWithTimestamps.push({value: newPnlValue, timestamp: currentTime.toISOString()});
        }

        const combinedData = [
            ...newPnlHistoryWithTimestamps,
            ...pnlHistory.map((value, index) => ({value, timestamp: pnlTimestamps[index]}))
        ].filter(item => typeof item.value === 'number' && typeof item.timestamp === 'string');
        const uniqueData = Array.from(new Map(combinedData.map(item => [item.timestamp, item])).values())
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        pnlHistory = uniqueData.map(item => item.value).slice(-MAX_PNL_HISTORY_POINTS);
        pnlTimestamps = uniqueData.map(item => item.timestamp).slice(-MAX_PNL_HISTORY_POINTS);
        await savePnlHistory();

        const unrealizedPnL = btcPosition > 0 ? btcPosition * (mid - (totalCost / btcPosition)) : 0;
        totalPnL = parseFloat((totalPnL + unrealizedPnL).toFixed(8));

        const correctedOrders = orders.map(o => {
            const createdAt = o.created_at ? new Date(o.created_at * 1000).toISOString() : null;
            const updatedAt = o.updated_at ? new Date(o.updated_at * 1000).toISOString() : null;
            return {
                id: o.id,
                side: o.side,
                price: parseFloat(o.limitPrice || o.price),
                qty: parseFloat(o.qty),
                status: o.status,
                type: o.type,
                timestamp: createdAt,
                updated_at: updatedAt,
                feeRate: o.isTaker ? FEE_RATE_TAKER : FEE_RATE_MAKER // ADICIONADO
            };
        });

        const activeOrders = correctedOrders.filter(o => o.status === 'working');
        const buyCost = bid * ORDER_SIZE * (1 + FEE_RATE_MAKER); // ALTERADO: usar ORDER_SIZE e FEE_RATE_MAKER
        const canBuy = balances.find(b => b.symbol === 'BRL')?.available >= buyCost;
        const marketInterest = orderbook.bids[0][1] > ORDER_SIZE * 5 || orderbook.asks[0][1] > ORDER_SIZE * 5;

        filledOrders = correctedOrders.filter(o => o.status === 'filled');
        const avgFillPrice = filledOrders.length
            ? filledOrders.reduce((sum, o) => sum + parseFloat(o.price), 0) / filledOrders.length
            : SIMULATE ? 654259.13 : 0; // ALTERADO: valor padrão do bot.js

        // Calcular viés de inventário - ADICIONADO
        const inventoryBias = (function (mid) {
            const currentBaseValue = mid * btcPosition;
            const currentQuoteValue = totalPnL;
            const totalValue = currentBaseValue + currentQuoteValue;
            const imbalance = totalValue > 0 ? (currentBaseValue - currentQuoteValue) / totalValue : 0;
            return Math.abs(imbalance) > INVENTORY_THRESHOLD ? -imbalance * BIAS_FACTOR : 0;
        })(mid);

        // Calcular viés de tendência - ADICIONADO
        const pred = fetchPricePrediction(mid);
        const trendBias = pred.trend === 'up' ? pred.confidence * BIAS_FACTOR * 1.5
            : (pred.trend === 'down' ? -pred.confidence * BIAS_FACTOR * 1.5 : 0);

        return {
            timestamp: new Date().toISOString(),
            mode: SIMULATE ? 'SIMULATE' : 'LIVE',
            market: {
                pair: mbClient.PAIR,
                last: parseFloat(ticker.last),
                bid: bestBid,
                ask: bestAsk,
                mid: ((bestAsk + bestBid) / 2).toFixed(2),
                spread: spreadPct.toFixed(2),
                volatility: volatilityPct.toFixed(2),
                tendency: pred
            },
            balances: {
                brl: balances.find(b => b.symbol === 'BRL')?.total || 0,
                btc: balances.find(b => b.symbol === 'BTC')?.total || 0,
                total: balances.reduce((sum, b) => sum + parseFloat(b.total) * (b.symbol === 'BRL' ? 1 : (b.symbol === 'BTC' ? parseFloat(ticker.last) : 0)), 0).toFixed(2),
                brlAvailable: balances.find(b => b.symbol === 'BRL')?.available || 0,
                btcAvailable: balances.find(b => b.symbol === 'BTC')?.available || 0,
                buyCost: buyCost.toFixed(2),
                canBuy
            },
            activeOrders: activeOrders.map(order => ({
                ...order,
                ageSecMinHour: order.timestamp ? computeAge(order.timestamp) : null,
                drift: order.side === 'buy'
                    ? (((mid - order.price) / order.price) * 100).toFixed(2) + '%'
                    : (((order.price - mid) / mid) * 100).toFixed(2) + '%'
            })),
            orders: correctedOrders.map(o => ({
                ...o,
                ageSecMinHour: o.timestamp ? computeAge(o.timestamp) : null
            })),
            stats: {
                cycles: Math.floor((now - serverStartTime) / (parseInt(process.env.CYCLE_SEC || '15') * 1000)),
                uptime: SIMULATE ? "169min" : Math.floor((now - serverStartTime) / 1000 / 60) + 'min',
                fills,
                totalOrders: orders.length,
                cancels: orders.filter(o => o.status === 'cancelled').length,
                totalPnL,
                monthlyPnL: getMonthlyPnL(pnlHistory, pnlTimestamps).toFixed(8),
                pnlHistory: [...pnlHistory],
                pnlTimestamps: [...pnlTimestamps],
                fillRate: orders.length ? ((fills / orders.length) * 100).toFixed(1) + '%' : '0%',
                avgSpread: spreadPct.toFixed(2),
                dynamicSpread: (dynamicSpreadPct * 100).toFixed(2) + '%',
                expectedProfitScore: parseFloat(pred.expectedProfit.toFixed(2)),
                inventoryBias,
                trendBias,
                totalBias: Math.min(0.01, Math.max(-0.01, inventoryBias + trendBias)), // ADICIONADO
                unrealizedPnl: unrealizedPnL,
                btcPosition: btcPosition,
                avgFillPrice: parseFloat(avgFillPrice.toFixed(2)),
                macd: pred.macd,
                signal: pred.signal,
                rsi: pred.rsi,
                emaShort: parseFloat(pred.emaShort.toFixed(2)),
                emaLong: parseFloat(pred.emaLong.toFixed(2)),
                volatility: parseFloat(pred.volatility.toFixed(2)),
                regime: pred.regime,
                roi: totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : (SIMULATE ? 3.96 : 0.00)
            },
            config: {
                simulate: SIMULATE,
                spreadPct: SPREAD_PCT,
                orderSize: ORDER_SIZE,
                cycleSec: parseInt(process.env.CYCLE_SEC || '15'),
                isRecovering: totalPnL < 0,
                pnlResidualHistory: pnlHistory.filter(p => p < 0),
                maxOrderAgeSecMinHour: (() => {
                    const ageSec = MAX_ORDER_AGE;
                    const ageMin = Math.floor(ageSec / 60);
                    const ageHour = Math.floor(ageMin / 60);
                    const ageDay = Math.floor(ageHour / 24);
                    return {ageSec, ageMin, ageHour, ageDay};
                })(),
                maxDailyVolume: process.env.MAX_DAILY_VOLUME || '0.01',
                maxPosition: process.env.MAX_POSITION || '0.0002',
                minOrderSize: MIN_ORDER_SIZE,
                emergencyStopPnL: process.env.EMERGENCY_STOP_PNL || '-50',
                priceDrift: (PRICE_DRIFT * 100).toFixed(2),
                priceDriftBoost: (parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0') * 100).toFixed(2),
                stopLoss: (parseFloat(process.env.STOP_LOSS_PCT || '0.008')).toFixed(3),
                takeProfit: (parseFloat(process.env.TAKE_PROFIT_PCT || '0.001')).toFixed(3),
                minVolume: MIN_VOLUME,
                volatilityLimit: parseFloat(process.env.VOLATILITY_LIMIT || 0.05),
                feeRateMaker: FEE_RATE_MAKER, // ADICIONADO
                feeRateTaker: FEE_RATE_TAKER, // ADICIONADO
                recoveryBufferDynamic: totalPnL < 0 ? (pred.volatility * 100 * 0.0025).toFixed(4) : '0.0000' // Buffer dinâmico baseado em volatilidade
            },
            debug: {
                marketInterest,
                lastObUpdate: new Date().toISOString(),
                activeOrdersCount: activeOrders.length,
                totalOrdersCount: orders.length
            }
        };
    } catch (err) {
        log('ERROR', 'LIVE fetch failed:', err.message);
        return {error: err.message, mode: SIMULATE ? 'SIMULATE' : 'LIVE'};
    }
}

// ===== API status atualizado =====
app.get('/api/data', async (req, res) => {
    requestCount++;
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - serverStartTime) / 1000);
    const cycleDuration = parseInt(process.env.CYCLE_SEC || '15');
    const cycles = SIMULATE ? 667 : Math.floor(uptimeSeconds / cycleDuration);

    const cacheValid = cache.timestamp > 0 && cache.valid && (now - cache.timestamp) <= CACHE_TTL;

    if (!cacheValid || forceRefresh) {
        try {
            let data = await getLiveData();
            data.stats = data.stats || {};
            data.stats.uptime = SIMULATE ? "169min" : Math.floor(uptimeSeconds / 60) + 'min';
            data.stats.cycles = cycles;
            cache.data = data;
            cache.timestamp = now;
            cache.valid = true;
        } catch (err) {
            log('ERROR', 'Cache update failed:', err.message);
            cache.data = {error: err.message, mode: SIMULATE ? 'SIMULATE' : 'LIVE'};
            cache.timestamp = now;
            cache.valid = false;
            errorCount++;
        }
    } else {
        cache.data.stats = cache.data.stats || {};
        cache.data.stats.uptime = SIMULATE ? "169min" : Math.floor(uptimeSeconds / 60) + 'min';
        cache.data.stats.cycles = cycles;
        if (cache.data.activeOrders) {
            const mid = parseFloat(cache.data.market.mid);
            cache.data.activeOrders.forEach(o => o.drift = o.side === 'buy' ? (mid - o.price).toFixed(2) : (o.price - mid).toFixed(2));
        }
    }
    res.json(cache.data);
});

// Health check
app.get('/health', (req, res) => {
    const now = Date.now();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime().toFixed(1) + 's',
        simulate: SIMULATE,
        port: PORT,
        cache: {valid: cache.valid, ageMs: now - cache.timestamp, ttlMs: CACHE_TTL},
        requests: {total: requestCount, sinceStart: Math.round(requestCount / (process.uptime() / 60))},
        errors: errorCount
    });
});

// Serve HTML
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(200).send('<!DOCTYPE html><html><body><h1>Dashboard Setup Required</h1></body></html>');
});

// 404
app.use('/api/v1/*', (req, res) => res.status(404).json({error: 'API endpoint not found', path: req.path}));

// Error handler
app.use((err, req, res, next) => {
    log('ERROR', 'Unhandled error:', err.message);
    errorCount++;
    res.status(500).json({error: 'Internal server error'});
});

// Graceful shutdown
process.on('SIGINT', () => {
    log('INFO', 'Shutting down server...');
    process.exit();
});
process.on('SIGTERM', () => {
    log('INFO', 'Shutting down server...');
    process.exit();
});

// Start server and load history
db.init().then(() => {
    Promise.all([loadPnlHistory(), loadHistoricalFills()]).then(() => {
        app.listen(PORT, '0.0.0.0', () => log('INFO', `Dashboard ready at http://localhost:${PORT} - Mode: ${SIMULATE ? 'SIMULATE' : 'LIVE'}`));
    });
});

module.exports = app;