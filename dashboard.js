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
const ExternalTrendValidator = require('./external_trend_validator');

// Instância do validador externo
const trendValidator = new ExternalTrendValidator();

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
let priceHistoryWithTimestamps = []; // NOVO: histórico de preço com timestamps para gráfico
let historicalFills = []; // ADICIONADO para análise de fills

// ===== CARREGAR HISTÓRICO DE PREÇOS DO BANCO =====
async function loadPriceHistoryFromDB() {
    try {
        log('INFO', 'Iniciando carregamento de histórico de preços...');
        const prices = await Promise.race([
            db.getPriceHistory(24, 500),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        
        if (prices && prices.length > 0) {
            priceHistory = prices.map(p => p.price);
            priceHistoryWithTimestamps = prices.map(p => ({
                price: p.price,
                timestamp: new Date(p.timestamp * 1000).toISOString()
            }));
            log('INFO', `Carregados ${prices.length} preços históricos do banco de dados.`);
        } else {
            log('INFO', 'Nenhum histórico de preço encontrado no banco. Iniciando novo histórico.');
        }
    } catch (e) {
        log('WARN', `Erro ao carregar histórico de preços: ${e.message}. Continuando com histórico vazio.`);
        priceHistory = [];
        priceHistoryWithTimestamps = [];
    }
}

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
    priceHistoryWithTimestamps.push({
        price: midPrice,
        timestamp: new Date().toISOString()
    });
    if (priceHistory.length > 60) priceHistory.shift();
    if (priceHistoryWithTimestamps.length > 120) priceHistoryWithTimestamps.shift();

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
        // NOVO: Carregar do banco de dados em vez do arquivo JSON
        log('INFO', 'Carregando histórico de PnL do banco de dados...');
        const dbPnlHistory = await db.getPnLHistory(24, MAX_PNL_HISTORY_POINTS);
        
        if (dbPnlHistory && dbPnlHistory.length > 0) {
            pnlHistory = dbPnlHistory.map(item => parseFloat(item.value));
            pnlTimestamps = dbPnlHistory.map(item => item.iso);
            log('INFO', `Carregados ${pnlHistory.length} pontos de PnL do banco de dados`);
        } else {
            log('INFO', 'Nenhum histórico de PnL encontrado no banco de dados. Inicializando vazio.');
            pnlHistory = [];
            pnlTimestamps = [];
        }
    } catch (err) {
        log('WARN', `Falha ao carregar histórico PnL do banco: ${err.message}. Inicializando vazio.`);
        pnlHistory = [];
        pnlTimestamps = [];
    }
}

async function savePnlHistory() {
    try {
        // O PnL agora é salvo diretamente pelo bot.js no banco de dados
        // O dashboard apenas consome os dados
        log('DEBUG', `Dashboard: ${pnlHistory.length} pontos de PnL em memória (salvos pelo bot no BD)`);
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

        // Buscar ordens do banco de dados SEMPRE para ter acesso ao pair_id
        const localOrders = await db.getOrders({limit: 100}) || [];
        const localOrderMap = new Map(localOrders.map(o => [o.id, o])); // Map para busca rápida por ID

        if (SIMULATE) {
            // Em modo simulação, usar ordens locais
            ticker = await mbClient.getTicker();
            balances = await mbClient.getBalances();
            orders = localOrders;
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
            
            // Adicionar pair_id das ordens locais
            orders = orders.map(order => ({
                ...order,
                pair_id: localOrderMap.get(order.id)?.pair_id || null
            }));

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
        let realizedPnL = 0; // PnL realizado das vendas
        let totalInvested = 0; // Capital total investido
        const newPnlHistoryWithTimestamps = [];

        // Carregar PnL realizado do banco de dados (sem valores hardcoded)
        const dbStats = await db.getStats({hours: 24});
        realizedPnL = dbStats.total_pnl || 0;
        
        // IMPORTANTE: Capital inicial FIXO de R$ 220,00 para cálculo de ROI
        const INITIAL_CAPITAL = 220.00; // Capital inicial fixo para cálculo de performance
        const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.total || 0);
        const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.total || 0);
        const currentBalance = brlBalance + (btcBalance * mid); // Saldo atual em BRL
        const initialCapitalInvested = INITIAL_CAPITAL; // Sempre usar R$ 220,00 como base
        
        log('DEBUG', `Database PnL: ${realizedPnL}, Capital Base: R$ ${INITIAL_CAPITAL.toFixed(2)}, Saldo Atual: R$ ${currentBalance.toFixed(2)}`);

        // Re-calcular posição e custo médio usando FIFO para PnL não realizado
        let filledOrders = orders
            .filter(o => o.status === 'filled')
            .map(o => ({
                side: o.side,
                qty: parseFloat(o.qty),
                price: parseFloat(o.limitPrice || o.price),
                feeRate: o.feeRate || (o.isTaker ? FEE_RATE_TAKER : FEE_RATE_MAKER),
                timestamp: o.created_at ? new Date(o.created_at * 1000).toISOString() : new Date().toISOString()
            }))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Ordenar por timestamp para FIFO

        // Calcular posição atual e custo base usando FIFO
        filledOrders.forEach(o => {
            const fee = o.qty * o.price * o.feeRate;
            if (o.side === 'buy') {
                btcPosition += o.qty;
                const cost = o.qty * o.price + fee;
                totalCost += cost;
                totalInvested += cost; // Capital total que entrou na estratégia
            } else if (o.side === 'sell' && btcPosition > 0) {
                const sellAmount = Math.min(o.qty, btcPosition);
                const avgPrice = totalCost / btcPosition;
                btcPosition -= sellAmount;
                totalCost -= avgPrice * sellAmount;
                
                // Garantir que não fique negativo
                if (btcPosition <= 0) {
                    btcPosition = 0;
                    totalCost = 0;
                }
            }
        });
        
        // Garantir valores positivos
        btcPosition = Math.max(0, btcPosition);
        totalCost = Math.max(0, totalCost);

        if (historicalFills.length > HISTORICAL_FILLS_WINDOW * 2) historicalFills.shift();

        // Calcular PnL não realizado
        const unrealizedPnL = btcPosition > 0 && totalCost > 0 ? 
            (btcPosition * mid) - totalCost : 0;
        
        // PnL CORRETO = Variação do Patrimônio Total (Saldo Atual - Capital Inicial)
        const totalPnL = currentBalance - INITIAL_CAPITAL;
        
        log('DEBUG', `PnL Real: Saldo Atual=${currentBalance.toFixed(2)} - Capital Inicial=${INITIAL_CAPITAL.toFixed(2)} = ${totalPnL.toFixed(2)} | DB PnL=${realizedPnL.toFixed(2)} | Unrealized=${unrealizedPnL.toFixed(2)} | Position=${btcPosition.toFixed(8)} BTC`);

        const lastTimestamp = pnlTimestamps.length > 0 ? new Date(pnlTimestamps[pnlTimestamps.length - 1]) : null;
        const currentTime = new Date(now);
        if (!lastTimestamp || (currentTime - lastTimestamp) >= 60000) {
            const newPnlValue = parseFloat(totalPnL.toFixed(8));
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
        // NOTA: PnL agora é salvo pelo bot.js, não pelo dashboard

        // Usar o totalPnL já calculado (não recalcular novamente)

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
                feeRate: o.isTaker ? FEE_RATE_TAKER : FEE_RATE_MAKER, // ADICIONADO
                pair_id: o.pair_id || null // ADICIONADO: incluir pair_id
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

        // Obter dados de tendência externa - ADICIONADO
        let externalTrend = null;
        try {
            externalTrend = await trendValidator.analyzeCombinedTrend();
            log('DEBUG', 'External trend data obtained', {
                trend: externalTrend.trend,
                score: externalTrend.score,
                confidence: externalTrend.confidence
            });
        } catch (error) {
            log('WARN', 'Failed to get external trend data:', error.message);
        }

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
                priceHistory: priceHistoryWithTimestamps.map(p => p.price),
                priceTimestamps: priceHistoryWithTimestamps.map(p => p.timestamp),
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
                roi: initialCapitalInvested > 0 ? parseFloat(((totalPnL / initialCapitalInvested) * 100).toFixed(4)) : 0,
                initialCapital: parseFloat(initialCapitalInvested.toFixed(2)),
                totalInvestedInOrders: totalInvested,
                debugCapital: initialCapitalInvested
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
            },
            externalTrend: externalTrend ? {
                trend: externalTrend.trend,
                score: externalTrend.score,
                confidence: externalTrend.confidence,
                sources: {
                    coinGecko: externalTrend.sources?.coinGecko || null,
                    binance: externalTrend.sources?.binance || null,
                    fearGreed: externalTrend.sources?.fearGreed || null
                },
                timestamp: externalTrend.timestamp,
                botAlignment: pred.trend === externalTrend.trend ? 'aligned' : 'divergent',
                details: {
                    botTrend: pred.trend,
                    externalTrend: externalTrend.trend,
                    botConfidence: pred.confidence,
                    externalConfidence: externalTrend.confidence
                }
            } : {
                error: 'Dados externos não disponíveis',
                sources: {
                    coinGecko: null,
                    binance: null,
                    fearGreed: null
                },
                botTrend: pred.trend,
                botConfidence: pred.confidence
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

// ===== API: Sessões de Recuperação =====
app.get('/api/recovery', async (req, res) => {
    try {
        const active = await db.getActiveRecoverySession();
        const points = active ? await db.getRecoveryPoints(active.id, {limit: 500}) : [];
        const sessions = await db.getRecoverySessions({limit: 10});
        res.json({activeSession: active || null, points, sessions});
    } catch (err) {
        log('ERROR', 'Erro ao consultar recuperação:', err.message);
        res.status(500).json({error: err.message});
    }
});

// Reset manual de sessão de recuperação (atualiza baseline para PnL atual do portfólio, mantém sessão ativa)
app.post('/api/recovery/reset', async (req, res) => {
    try {
        const active = await db.getActiveRecoverySession();
        if (active) {
            // Preferir PnL atual calculado pela função getLiveData (totalPnL)
            let newBaseline = null;
            try {
                const live = await getLiveData();
                log('DEBUG', 'Live data for reset', {liveStats: live && live.stats ? live.stats.totalPnL : null});
                if (live && live.stats && typeof live.stats.totalPnL === 'number') {
                    newBaseline = parseFloat(live.stats.totalPnL.toFixed(2));
                }
            } catch (e) {
                log('WARN', 'Não foi possível obter PnL ao vivo:', e.message);
            }

            // Se não conseguimos o PnL ao vivo, fallback para último ponto
            if (newBaseline === null) {
                const lastPoint = await db.getLastRecoveryPoint(active.id);
                newBaseline = lastPoint ? parseFloat(lastPoint.pnl) : (active.initial_pnl !== undefined ? parseFloat(active.initial_pnl) : parseFloat(active.baseline));
            }

            // Atualizar baseline da sessão ativa para o novo valor (não encerrar)
            await db.updateRecoveryBaseline(active.id, newBaseline);
            // Registrar timestamp do reset manual para evitar reversões imediatas
            const now = Math.floor(Date.now() / 1000);
            await db.updateManualBaselineTimestamp(active.id, now);

            log('INFO', `[API] Baseline da sessão ${active.id} atualizado para: R$ ${newBaseline.toFixed(2)}`);
            log('INFO', `[API] Sessão permanece ativa com novo baseline`);
            res.json({success: true, message: 'Baseline atualizado para o PnL atual (ou último ponto se indisponível). Sessão permanece ativa.', baseline: newBaseline});
            return;
        }
        res.json({success: false, message: 'Nenhuma sessão ativa encontrada.'});
    } catch (err) {
        log('ERROR', 'Erro ao resetar baseline:', err.message);
        res.status(500).json({error: err.message});
    }
});

// ========== ENDPOINT DE PARES ==========
app.get('/api/pairs', async (req, res) => {
    try {
        // Consultar BD diretamente
        const openOrders = await db.getOrders({ status: 'open' });
        const pairMap = {};
        
        // Agrupar por pair_id
        for (const order of openOrders) {
            const pairId = order.pair_id || `PAIR_LEGACY_${order.id}`;
            if (!pairMap[pairId]) {
                pairMap[pairId] = { buyOrder: null, sellOrder: null };
            }
            
            if (order.side.toLowerCase() === 'buy') {
                pairMap[pairId].buyOrder = {
                    id: order.id,
                    price: parseFloat(order.price),
                    qty: parseFloat(order.qty)
                };
            } else {
                pairMap[pairId].sellOrder = {
                    id: order.id,
                    price: parseFloat(order.price),
                    qty: parseFloat(order.qty)
                };
            }
        }
        
        // Formatar resposta
        const pairs = [];
        for (const [pairId, pair] of Object.entries(pairMap)) {
            const hasBuy = pair.buyOrder !== null;
            const hasSell = pair.sellOrder !== null;
            const isComplete = hasBuy && hasSell;
            
            let spread = 0, roi = 0;
            if (isComplete) {
                spread = ((pair.sellOrder.price - pair.buyOrder.price) / pair.buyOrder.price) * 100;
                roi = spread - (0.006 * 100); // Descontar 0.6% de fees
            }
            
            pairs.push({
                pairId: pairId.substring(0, 50),
                status: isComplete ? 'COMPLETO' : (hasBuy ? 'AGUARDANDO_SELL' : 'AGUARDANDO_BUY'),
                buyOrder: hasBuy ? {
                    id: pair.buyOrder.id.substring(0, 20),
                    price: pair.buyOrder.price.toFixed(2),
                    qty: pair.buyOrder.qty.toFixed(8)
                } : null,
                sellOrder: hasSell ? {
                    id: pair.sellOrder.id.substring(0, 20),
                    price: pair.sellOrder.price.toFixed(2),
                    qty: pair.sellOrder.qty.toFixed(8)
                } : null,
                spread: spread.toFixed(3) + '%',
                roi: roi.toFixed(3) + '%'
            });
        }
        
        const pairsReport = {
            timestamp: new Date().toISOString(),
            totalPairs: pairs.length,
            completePairs: pairs.filter(p => p.status === 'COMPLETO').length,
            incompletePairs: pairs.filter(p => p.status !== 'COMPLETO').length,
            pairs: pairs.sort((a, b) => a.status.localeCompare(b.status))
        };
        
        res.json(pairsReport);
    } catch (err) {
        log('ERROR', 'Erro ao consultar pares:', err.message);
        res.status(500).json({error: err.message});
    }
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
    Promise.all([loadPnlHistory(), loadHistoricalFills(), loadPriceHistoryFromDB()]).then(() => {
        app.listen(PORT, '0.0.0.0', () => log('INFO', `Dashboard ready at http://localhost:${PORT} - Mode: ${SIMULATE ? 'SIMULATE' : 'LIVE'}`));
    });
});

module.exports = app;