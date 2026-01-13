#!/usr/bin/env node
/**
 * bot.js - Bot de Market Making Pro v2.0.1
 * Versão corrigida para tratar erros de inicialização (velas históricas e DB).
 * - Validação de configs, orderbook, saldos.
 * - Spread/tamanho dinâmicos com volatilidade, depthFactor, viés inventário/tendência, score lucro esperado.
 * - Indicadores: RSI, EMA curta/longa, volatilidade, MACD.
 * - Gestão ordens: Reprecificação drift, cancelamento idade/liquidez, stop-loss/take-profit dinâmicos.
 * - PnL/ROI real com alertas.
 * - Logs detalhados em PT-BR, mini-dashboard por ciclo.
 * - Warmup com velas históricas, fase teste inicial com ordens pequenas.
 * - Otimização params baseada em desempenho real.
 * - Armazenamento histórico fills com pesos para análise.
 * - Testes: Backtest integrado usando candles.
 * - Robustez: Tratamento erros, safeguards contra perdas.
 * - Estrutura: Classe principal, funções modulares, comentários PT-BR.
 */

require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const db = require('./db');
const MB = require('./mb_client');
const ExternalTrendValidator = require('./external_trend_validator');
const DecisionEngine = require('./decision_engine');
const ConfidenceSystem = require('./confidence_system');


// ---------------- CONFIGURAÇÃO ----------------
const SIMULATE = process.env.SIMULATE === 'true'; // Modo simulação
const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4'; // Padrão API v4
const PAIR = process.env.PAIR || 'BTC-BRL'; // Par padrão BTC-BRL
const CYCLE_SEC = Math.max(1, parseInt(process.env.CYCLE_SEC || '15')); // Mínimo 1s
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.0006'); // Atualizado para 0.06%
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.05'); // Atualizado para 5%
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.0003'); // Atualizado para 0.03%
const PRICE_DRIFT_BOOST = parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0'); // Desativado por padrão
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0005'); // Atualizado para 0.05%
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '0.008'); // Atualizado para 0.8%
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || '0.001'); // Atualizado para 0.1%
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005'); // Limitado a 0.00005 BTC
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.0001'); // Limitado a 0.01 BTC
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0004'); // Limitado a 0.04 BTC
const MAX_POSITION = parseFloat(process.env.MAX_POSITION || '0.0003'); // Posição máxima em BTC
const DAILY_LOSS_LIMIT = parseFloat(process.env.DAILY_LOSS_LIMIT || '10'); // Limite de perda diária em BRL
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002'); // Ajustado para 0.02%
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.00015'); // Ajustado para 0.015%
const MIN_ORDER_CYCLES = parseInt(process.env.MIN_ORDER_CYCLES || '2'); // Mínimo 2 ciclos antes de reprecificar/cancelar
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '120'); // Máximo 120s antes de cancelar
const MIN_VOLATILITY_PCT = parseFloat(process.env.MIN_VOLATILITY_PCT || '0.1'); // Limitado a 0.1% mínimo para evitar pular ciclos
const MAX_VOLATILITY_PCT = parseFloat(process.env.MAX_VOLATILITY_PCT || '2.5'); // Limitado a 2.5% máximo para evitar excessos
const VOL_LIMIT_PCT = parseFloat(process.env.VOL_LIMIT_PCT || '1.5'); // 1.5% volume para filtrar
const EXPECTED_PROFIT_THRESHOLD = parseFloat(process.env.EXPECTED_PROFIT_THRESHOLD || '0.0005'); // 0.05% de lucro esperado (ajustado)
const HISTORICAL_FILLS_WINDOW = parseInt(process.env.HISTORICAL_FILLS_WINDOW || '20'); // Últimos 20 fills
const RECENT_WEIGHT_FACTOR = parseFloat(process.env.RECENT_WEIGHT_FACTOR || '0.7'); // Peso decrescente
const ALERT_PNL_THRESHOLD = parseFloat(process.env.ALERT_PNL_THRESHOLD || '-50'); // Alerta se PnL < -50 BRL
const ALERT_ROI_THRESHOLD = parseFloat(process.env.ALERT_ROI_THRESHOLD || '-5'); // Alerta se ROI < -5%
const WARMUP_CANDLES = 50; // Velas para warmup
const TEST_PHASE_CYCLES = 10; // Ciclos de fase teste
const PARAM_ADJUST_FACTOR = 0.05; // 5% de ajuste
const PERFORMANCE_WINDOW = 5; // Últimos 5 ciclos para otimização
const OB_REFRESH_SEC = 10; // Atualiza orderbook a cada 10s
const startTime = Date.now(); // Para cálculo de uptime
const FEE_RATE_MAKER = 0.003; // 0,30%
const FEE_RATE_TAKER = 0.007; // 0,70%
const FEE_RATE = FEE_RATE_MAKER; // Padrão para ordens limite
const INITIAL_CAPITAL = 220.00; // Capital inicial em BRL (mesmo valor do dashboard)

// -------- AJUSTE DINÂMICO DO RECOVERY BUFFER --------
const RECOVERY_BUFFER_BASE = 0.0005; // Buffer base de recuperação: 0.05%
const VOL_MIN_RECOVERY = 0.002; // Volatilidade mínima: 0.20%
const VOL_MAX_RECOVERY = 0.02; // Volatilidade máxima: 2.00%
const RECOVERY_FATOR_MIN = 1.0; // Fator mínimo: 1.0x
const RECOVERY_FATOR_MAX = 2.0; // Fator máximo: 2.0x

function calculateDynamicRecoveryBuffer(volatilityPct) {
    const volDecimal = volatilityPct / 100;
    if (volDecimal <= VOL_MIN_RECOVERY) return RECOVERY_BUFFER_BASE * RECOVERY_FATOR_MIN;
    if (volDecimal >= VOL_MAX_RECOVERY) return RECOVERY_BUFFER_BASE * RECOVERY_FATOR_MAX;
    const fator = RECOVERY_FATOR_MIN + (RECOVERY_FATOR_MAX - RECOVERY_FATOR_MIN) * ((volDecimal - VOL_MIN_RECOVERY) / (VOL_MAX_RECOVERY - VOL_MIN_RECOVERY));
    const adjustedBuffer = RECOVERY_BUFFER_BASE * fator;
    return adjustedBuffer;
}

// Validação configs
if (!REST_BASE.startsWith('http')) {
    log('ERROR', 'REST_BASE inválido. Encerrando.');
    process.exit(1);
}
if (!PAIR.includes('-')) {
    log('ERROR', 'PAIR inválido. Use formato como BTC-BRL. Encerrando.');
    process.exit(1);
}

// ---------------- LOGGING ----------------
function log(level, message, data = null) {
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${level}]`.padEnd(8);
    const colors = {
        INFO: chalk.cyan,
        WARN: chalk.yellow,
        ERROR: chalk.red,
        SUCCESS: chalk.green,
        DEBUG: chalk.blue,
        ALERT: chalk.bgRed.white
    };
    const colorFn = colors[level] || (text => text);
    const logLine = `${timestamp} ${prefix} [Bot] ${message}`;
    const styledMessage = colorFn(logLine);
    console.log(styledMessage, data ? `| ${JSON.stringify(data).slice(0, 120)}${JSON.stringify(data).length > 120 ? '...' : ''}` : '');
    fs.appendFileSync('bot.log', logLine + (data ? ` | ${JSON.stringify(data)}` : '') + '\n');
}

// ---------------- GLOBAL STATE ----------------
let cycleCount = 0;
let activeOrders = new Map();
let totalFills = 0;
let totalPnL = 0.0;
let btcPosition = 0;
let totalCost = 0;
let lastObUpdate = 0;
let lastOrderbook = {bids: [], asks: []};
let marketTrend = 'Neutra';
let lastTradeCycle = -1;
let priceHistory = [];
let historicalFills = [];
let performanceHistory = [];
let testPhase = true;
let externalTrendValidator = new ExternalTrendValidator();
let decisionEngine = new DecisionEngine();
let confidenceSystem = new ConfidenceSystem();
let lastExternalCheck = 0;
let externalTrendData = null;
let currentSpreadPct = MIN_SPREAD_PCT;
let currentBaseSize = ORDER_SIZE;
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

// Contador de confirmações de baseline inferior por sessão para evitar reversões imediatas
const BASELINE_DEBOUNCE_SEC = parseInt(process.env.BASELINE_DEBOUNCE_SEC || '30');
let baselineLowerCount = {};

// ---------------- WARMUP ----------------
async function initWarmup() {
    log('INFO', 'Iniciando warmup com velas históricas para evitar decisões ruins iniciais.');
    const historicalPrices = await fetchHistoricalCandles(PAIR);
    if (historicalPrices.length >= WARMUP_CANDLES) {
        priceHistory = historicalPrices;
        log('SUCCESS', `Warmup completo com ${historicalPrices.length} velas históricas.`);
    } else {
        log('WARN', `Dados históricos insuficientes (${historicalPrices.length}/${WARMUP_CANDLES}). Preenchendo com preços simulados.`);
        const missing = WARMUP_CANDLES - historicalPrices.length;
        const lastPrice = historicalPrices.length > 0 ? historicalPrices[historicalPrices.length - 1] : 300000;
        const filler = Array(missing).fill().map(() => lastPrice);
        priceHistory = [...historicalPrices, ...filler];
    }
}

// Função auxiliar para determinar a taxa com base no tipo de ordem - ADICIONADO
function getFeeRate(isTaker = false) {
    return isTaker ? FEE_RATE_TAKER : FEE_RATE_MAKER;
}

async function fetchHistoricalCandles(pair, resolution = '1m', limit = 100) {
    if (SIMULATE) {
        const candles = Array(limit).fill().map((_, i) => ({close: 300000 + i * 1000}));
        log('INFO', `Simulando ${candles.length} velas históricas.`);
        return candles.map(c => parseFloat(c.close));
    }
    try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - (limit * 60);
        const url = `${REST_BASE}/candles?symbol=${pair}&resolution=${resolution}&from=${from}&to=${to}`;
        const {data} = await axios.get(url, {timeout: 15000, headers: {'User-Agent': 'MB-Bot/2.0.1'}});
        if (!data || !Array.isArray(data.t) || !Array.isArray(data.c)) {
            throw new Error(`Formato de resposta inválido: ${JSON.stringify(data).slice(0, 100)}`);
        }
        const closes = data.c
            .map(c => parseFloat(c))
            .filter(p => !isNaN(p) && p > 0);
        if (closes.length === 0) {
            throw new Error('Nenhum preço válido encontrado nas velas.');
        }
        log('INFO', `Buscadas ${closes.length} velas históricas válidas.`);
        return closes.slice(-60); // Limita a 60 preços mais recentes
    } catch (e) {
        log('ERROR', `Falha ao buscar velas históricas: ${e.message}. Usando simulação como fallback.`);
        const candles = Array(limit).fill().map((_, i) => ({close: 300000 + i * 1000}));
        return candles.map(c => parseFloat(c.close)).slice(-60);
    }
}

// ---------------- INDICADORES ----------------
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

function calculateADX(prices, period = 14) {
    if (prices.length < period * 2) {
        log('WARN', `Histórico insuficiente para ADX (${prices.length}/${period * 2}). Retornando força neutra (20).`);
        return 20;
    }
    
    let tr = [];
    let dmPlus = [];
    let dmMinus = [];
    
    for (let i = 1; i < prices.length; i++) {
        const high = prices[i] * 1.0001; // Simulação de High/Low baseada no Close
        const low = prices[i] * 0.9999;
        const prevHigh = prices[i-1] * 1.0001;
        const prevLow = prices[i-1] * 0.9999;
        const prevClose = prices[i-1];
        
        const trVal = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        tr.push(trVal);
        
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        
        dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
        dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    
    const smooth = (arr, p) => {
        let result = [arr.slice(0, p).reduce((a, b) => a + b, 0) / p];
        for (let i = p; i < arr.length; i++) {
            result.push((result[result.length - 1] * (p - 1) + arr[i]) / p);
        }
        return result;
    };
    
    const smoothedTR = smooth(tr, period);
    const smoothedDMPlus = smooth(dmPlus, period);
    const smoothedDMMinus = smooth(dmMinus, period);
    
    let dx = [];
    for (let i = 0; i < smoothedTR.length; i++) {
        const diPlus = (smoothedDMPlus[i] / smoothedTR[i]) * 100;
        const diMinus = (smoothedDMMinus[i] / smoothedTR[i]) * 100;
        dx.push(Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100);
    }
    
    const adx = smooth(dx, period).pop();
    log('INFO', `ADX calculado: ${adx.toFixed(2)}.`);
    return adx || 20;
}

function calculateVolatility(prices) {
    if (!prices || prices.length < 2) {
        log('WARN', 'Dados insuficientes para calcular volatilidade. Retornando 0.1%.');
        return 0.001; // 0.1% para evitar pular ciclos
    }
    const returns = prices.slice(1).map((price, i) => {
        const prevPrice = prices[i];
        return prevPrice > 0 ? Math.log(price / prevPrice) : 0;
    }).filter(r => !isNaN(r) && r !== 0); // Filtra retornos inválidos
    if (returns.length < 1) {
        log('WARN', 'Nenhum retorno válido para calcular volatilidade. Retornando 0.1%.');
        return 0.001;
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(24 * 60) * 100; // Diária
    const maxVolatilityPct = parseFloat(process.env.MAX_VOLATILITY_PCT || '50'); // Usa valor do .env
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

function calculateOrderbookImbalance(orderbook) {
    if (!orderbook || !orderbook.bids.length || !orderbook.asks.length) return 0;
    const bidVol = orderbook.bids.slice(0, 5).reduce((sum, b) => sum + b[1], 0);
    const askVol = orderbook.asks.slice(0, 5).reduce((sum, a) => sum + a[1], 0);
    return (bidVol - askVol) / (bidVol + askVol); // -1 a 1
}

function identifyMarketRegime(rsi, volatility, trendScore, adx) {
    const strongTrend = adx > 25;
    if (volatility < 0.3 && !strongTrend) return 'RANGING'; // Lateral
    if (trendScore > 2.5 && strongTrend) return 'BULL_TREND'; // Tendência Forte de Alta
    if (trendScore < 0.5 && strongTrend) return 'BEAR_TREND'; // Tendência Forte de Baixa
    if (trendScore > 1.5) return 'BULLISH'; // Tendência Leve de Alta
    if (trendScore < 1.5) return 'BEARISH'; // Tendência Leve de Baixa
    return 'NEUTRAL';
}

function fetchPricePrediction(midPrice, orderbook) {
    priceHistory.push(midPrice);
    // Otimização de memória: Mantém apenas o necessário para os indicadores (60 períodos)
    if (priceHistory.length > 100) priceHistory.splice(0, priceHistory.length - 60);
    const rsi = calculateRSI(priceHistory, 12);
    const emaShort = calculateEMA(priceHistory, 8);
    const emaLong = calculateEMA(priceHistory, 20);
    const {macd, signal} = calculateMACD(priceHistory);
    const volatility = calculateVolatility(priceHistory); // Já em % (e.g., 0.87)
    const imbalance = calculateOrderbookImbalance(orderbook);
    const histAnalysis = analyzeHistoricalFills();
    
    let trendScore = 0;
    if (emaShort > emaLong) trendScore += 1;
    if (rsi > 50) trendScore += 1;
    if (macd > signal) trendScore += 1;
    if (imbalance > 0.2) trendScore += 0.5; // Pressão de compra
    if (imbalance < -0.2) trendScore -= 0.5; // Pressão de venda
    if (histAnalysis.recentBias > 0) trendScore += 0.5;
    
    const adx = calculateADX(priceHistory, 14);
    const regime = identifyMarketRegime(rsi, volatility, trendScore, adx);
    const trend = trendScore > 2 ? 'up' : (trendScore < 1.5 ? 'down' : 'neutral');
    let rsiConf = Math.abs(rsi - 50) / 50; // 0-1
    let emaConf = Math.abs(emaShort - emaLong) / (emaLong || 1); // Normalizado pelo preço
    // Corrigir macdConf: normalizar pela média dos preços, não pelo MACD
    let macdConf = Math.abs(macd - signal) / (midPrice || 1); // Normalizado pelo preço médio
    let volConf = Math.min(volatility / MAX_VOLATILITY_PCT, 1); // 0-1
    let histConf = histAnalysis.successRate; // 0-1
    let confidence = 0.3 * rsiConf + 0.25 * emaConf + 0.2 * macdConf + 0.15 * volConf + 0.1 * histConf;
    
    // Fórmula simplificada e eficaz para expectedProfit
    // Base: spread (potencial de lucro por operação) em percentual
    const spreadBase = SPREAD_PCT * 10000; // Ex: 0.0006 -> 6
    // Multiplicador de volatilidade (mais vol = mais oportunidade)
    const volMultiplier = 1 + (volatility / 5); // Ex: 2.5% -> 1.5
    // Bonus de tendência (sempre permite operação, mas favorece tendências)
    const trendBonus = trendScore > 1.5 ? 2.0 : (trendScore > 0.5 ? 1.5 : 1.0);
    // Fórmula final: spread * vol * tendência
    const expectedProfit = spreadBase * volMultiplier * trendBonus;
    // Normaliza para 0-1 (100 = 0.01 = 1%)
    const normalizedExpectedProfit = Math.min(Math.max(expectedProfit / 10000, 0), 1);
    log('INFO', 'Previsão de preço', {
        trend,
        confidence: confidence.toFixed(2),
        expectedProfit: normalizedExpectedProfit.toFixed(2),
        rsi: rsi.toFixed(2),
        emaShort: emaShort.toFixed(2),
        emaLong: emaLong.toFixed(2),
        volatility: volatility.toFixed(2), // Exibe como 0.87% diretamente
        macd: macd.toFixed(2),
        signal: signal.toFixed(2)
    });
    return {
        trend,
        regime,
        confidence,
        rsi,
        emaShort,
        emaLong,
        volatility,
        expectedProfit: normalizedExpectedProfit,
        histBias: histAnalysis.recentBias
    };
}

// ---------------- VALIDAÇÃO EXTERNA DE TENDÊNCIAS ----------------
async function checkExternalTrends() {
    const now = Date.now();
    // Verificar tendências externas a cada 10 minutos (600000ms)
    if (now - lastExternalCheck < 600000) {
        return externalTrendData;
    }
    
    try {
        log('INFO', 'Consultando tendências externas do Bitcoin...');
        externalTrendData = await externalTrendValidator.analyzeCombinedTrend();
        lastExternalCheck = now;
        
        if (externalTrendData) {
            log('SUCCESS', `Tendência Externa: ${externalTrendData.trend} (Score: ${externalTrendData.score}/100, Confiança: ${externalTrendData.confidence}%)`);
        }
        
        return externalTrendData;
    } catch (error) {
        log('WARN', `Erro ao consultar tendências externas: ${error.message}`);
        return externalTrendData; // Retorna dados anteriores se houver erro
    }
}

async function validateTradingDecision(botTrend, botConfidence, side) {
    if (!externalTrendData) {
        return { shouldTrade: true, reason: 'Sem dados externos disponíveis' };
    }
    
    // Usar o motor de decisão para análise completa
    const botAnalysis = {
        trend: botTrend,
        confidence: botConfidence
    };
    
    const decision = decisionEngine.analyzeDecision(botAnalysis, externalTrendData);
    
    // Log detalhado da decisão
    const DEBUG = process.env.DEBUG === 'true';
    if (DEBUG) {
        console.log(chalk.cyan('\n' + decisionEngine.generateReport(decision)));
    } else {
        const status = decision.canTrade ? chalk.green('✅ PERMITIDO') : chalk.red('🚫 BLOQUEADO');
        log('INFO', `[DECISION] ${status} | Ação: ${decision.action} | Confiança: ${(decision.confidence * 100).toFixed(1)}% | ${decision.reason}`);
    }
    
    // Verificar se a ação recomendada é compatível com o side solicitado
    let shouldTrade = decision.canTrade;
    let reason = decision.reason;
    
    // Adicionar validação específica do side
    if (decision.canTrade) {
        if (side === 'buy' && decision.action === 'SELL_SIGNAL') {
            shouldTrade = false;
            reason = `Motor de decisão recomenda VENDA mas tentando comprar`;
        } else if (side === 'sell' && decision.action === 'BUY_SIGNAL') {
            shouldTrade = false;
            reason = `Motor de decisão recomenda COMPRA mas tentando vender`;
        } else if (decision.action === 'HOLD') {
            // HOLD (regime NEUTRAL) NÃO bloqueia mais - apenas usa como informação
            // Market making pode operar normalmente em consolidação
            reason = `Market making em regime NEUTRAL (consenso entre bot e externo)`;
        }
    }
    
    return { 
        shouldTrade,
        reason,
        decision: decision // Incluir decisão completa para logs
    };
}

// ---------------- ORDERBOOK ----------------
async function fetchOrderbookRest() {
    try {
        const url = `${REST_BASE}/${PAIR}/orderbook?limit=10`;
        const response = await axios.get(url, {timeout: 15000, headers: {'User-Agent': 'MB-Bot/2.0.1'}});
        const data = response.data;
        const orderbook = {
            bids: Array.isArray(data.bids) ? data.bids.slice(0, 10).map(b => [parseFloat(b[0]), parseFloat(b[1])]) : [],
            asks: Array.isArray(data.asks) ? data.asks.slice(0, 10).map(a => [parseFloat(a[0]), parseFloat(a[1])]) : []
        };
        if (orderbook.bids.length && orderbook.asks.length && orderbook.bids[0][0] < orderbook.asks[0][0]) {
            lastObUpdate = Date.now();
            lastOrderbook = orderbook;
            log('SUCCESS', `Orderbook atualizado: Best Bid=${orderbook.bids[0][0].toFixed(2)}, Best Ask=${orderbook.asks[0][0].toFixed(2)}.`);
            return orderbook;
        } else {
            throw new Error('Orderbook inválido ou vazio');
        }
    } catch (e) {
        log('WARN', `Falha ao atualizar orderbook: ${e.message}. Usando último orderbook válido.`);
        return lastOrderbook;
    }
}

// ---------------- ORDENS ----------------
async function tryCancel(orderKey) {
    const order = activeOrders.get(orderKey);
    if (!order) return;
    try {
        log('INFO', `Cancelando ordem ${order.side.toUpperCase()} ${order.id} @ R$${order.price.toFixed(2)}, Qty: ${order.qty.toFixed(8)}.`);
        if (SIMULATE) {
            await db.saveOrderSafe({...order, status: 'cancelled'}, 'simulated_cancel');
        } else {
            const result = await MB.cancelOrder(order.id);
            await db.saveOrderSafe({...order, status: result.status || 'cancelled'}, 'live_cancel');
        }
        stats.cancels++;
        activeOrders.delete(orderKey);
        log('SUCCESS', `Ordem ${order.side.toUpperCase()} ${order.id} cancelada com sucesso.`);
    } catch (e) {
        log('WARN', `Erro ao cancelar ordem ${order.id}: ${e.message}. Removendo localmente para evitar loops.`);
        activeOrders.delete(orderKey);
    }
}

async function checkOrderStatus(orderKey, side, sessionId = null) {
    const order = activeOrders.get(orderKey);
    if (!order) return {status: 'unknown', filledQty: 0};
    if (SIMULATE) {
        const fillChance = 0.08 + Math.random() * 0.07;
        const isTaker = Math.random() < 0.2; // 20% de chance de ser Taker na simulação - ADICIONADO
        const feeRate = getFeeRate(isTaker); // ALTERADO
        if (Math.random() < fillChance) {
            const slippage = (Math.random() - 0.5) * 0.002;
            const fillPrice = order.price * (1 + slippage);
            let qty = order.qty;
            let pnl = 0;
            if (side === 'buy') {
                qty = qty * (1 - feeRate); // Deduz fee do qty recebido - ALTERADO
                btcPosition += qty;
                totalCost += qty * fillPrice;
            } else if (side === 'sell') {
                const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
                pnl = (fillPrice - avgPrice) * qty - (qty * fillPrice * feeRate); // Deduz fee do pnl - ALTERADO
                totalPnL += pnl;
                btcPosition -= qty;
                totalCost -= avgPrice * qty;
                if (btcPosition < 0) btcPosition = 0;
                if (totalCost < 0) totalCost = 0;
            }
            totalFills++;
            stats.filledOrders = totalFills;
            lastTradeCycle = cycleCount;
            await db.saveOrderSafe({
                ...order, status: 'filled', filledQty: qty, fillPrice: fillPrice.toFixed(2), pnl: pnl, feeRate: feeRate
            }, `simulated_fill_${slippage.toFixed(3)}`, sessionId); // Passa o sessionId
            historicalFills.push({side, price: fillPrice, qty, timestamp: Date.now(), pnl, feeRate});
            if (historicalFills.length > HISTORICAL_FILLS_WINDOW * 2) historicalFills.shift();
            activeOrders.delete(orderKey);
            log('INFO', `Fill simulado ${side.toUpperCase()} ${order.id} @ R$${fillPrice.toFixed(2)}, Qty: ${qty.toFixed(8)}, PnL Total: ${totalPnL.toFixed(2)}, Taxa: ${(feeRate * 100).toFixed(2)}%`);
            return {status: 'filled', filledQty: qty};
        }
        return {status: 'working', filledQty: 0};
    }
    try {
        const status = await MB.getOrderStatus(order.id);
        log('DEBUG', `Status ordem ${order.id}: ${status.status}, Filled: ${status.filledQty || 0}.`);
        if (status.status === 'filled') {
            const qty = parseFloat(status.filledQty);
            const price = parseFloat(status.avgPrice || order.price);
            const isTaker = status.isTaker || false; // Supõe que API retorna se é Taker - ADICIONADO
            const feeRate = getFeeRate(isTaker); // ALTERADO
            let pnl = 0;
            if (status.side === 'buy') {
                btcPosition += qty;
                totalCost += qty * price + (qty * price * feeRate); // Adiciona fee ao custo - ALTERADO
            } else if (status.side === 'sell') {
                const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
                pnl = (price - avgPrice) * qty - (qty * price * feeRate); // Deduz fee do pnl - ALTERADO
                totalPnL += pnl;
                btcPosition -= qty;
                totalCost -= avgPrice * qty;
                if (btcPosition < 0) btcPosition = 0;
                if (totalCost < 0) totalCost = 0;
            }
            totalFills++;
            stats.filledOrders = totalFills;
            lastTradeCycle = cycleCount;
            await db.saveOrderSafe({
                ...order, status: 'filled', filledQty: qty, avgPrice: price, pnl: pnl, feeRate: feeRate
            }, 'live_fill', sessionId); // Passa o sessionId
            historicalFills.push({side: status.side, price, qty, timestamp: Date.now(), pnl, feeRate});
            if (historicalFills.length > HISTORICAL_FILLS_WINDOW * 2) historicalFills.shift();
            activeOrders.delete(orderKey);
            log('INFO', `Fill real ${status.side.toUpperCase()} ${order.id} @ R$${price.toFixed(2)}, Qty: ${qty.toFixed(8)}, PnL Total: ${totalPnL.toFixed(2)}, Taxa: ${(feeRate * 100).toFixed(2)}%`);
            return {status: 'filled', filledQty: qty};
        }
        return {status: status.status, filledQty: status.filledQty || 0};
    } catch (e) {
        log('WARN', `Erro ao verificar status da ordem ${order.id}: ${e.message}.`);
        return {status: 'error', filledQty: 0};
    }
}

// ---------------- PLACE ORDER ----------------
async function placeOrder(side, price, qty, sessionId = null) {
    try {
        if (qty * price < MIN_VOLUME) {
            log('WARN', `Ordem ${side.toUpperCase()} ignorada: volume baixo (${(qty * price).toFixed(8)} < ${MIN_VOLUME}).`);
            return;
        }
        const feeRate = getFeeRate(false); // Assume Maker para ordens limite - ADICIONADO
        const orderData = {
            async: true,
            externalId: `ORD_${Date.now()}`,
            limitPrice: price,
            qty: qty.toFixed(8),
            side: side.toLowerCase(),
            stopPrice: 0,
            type: 'limit'
        };
        const orderId = SIMULATE ? `${side}_SIM_${Date.now()}` : (await MB.placeOrder(orderData)).orderId;
        activeOrders.set(side, {
            id: orderId,
            side,
            price,
            qty,
            status: 'open',
            cyclePlaced: cycleCount,
            timestamp: Date.now(),
            feeRate: feeRate
        });
        stats.totalOrders++;
        await db.saveOrderSafe(activeOrders.get(side), `market_making_${side}`, sessionId); // Passa o sessionId
        log('SUCCESS', `Ordem ${side.toUpperCase()} ${orderId} colocada @ R$${price.toFixed(2)}, Qty: ${qty.toFixed(8)}, Taxa Estimada: ${(feeRate * 100).toFixed(2)}%`);
    } catch (e) {
        log('ERROR', `Falha ao colocar ordem ${side.toUpperCase()}: ${e.message}.`);
    }
}

// ---------------- BIAS ----------------
function getInventoryBias(mid) {
    const currentBaseValue = mid * btcPosition;
    const currentQuoteValue = totalPnL;
    const totalValue = currentBaseValue + currentQuoteValue;
    const imbalance = totalValue > 0 ? (currentBaseValue - currentQuoteValue) / totalValue : 0;
    const bias = Math.abs(imbalance) > INVENTORY_THRESHOLD ? -imbalance * BIAS_FACTOR : 0;
    log('INFO', `Viés de inventário: ${bias.toFixed(6)}.`);
    return bias;
}

function getTrendBias(pred) {
    const bias = pred.trend === 'up' ? pred.confidence * BIAS_FACTOR * 1.5 : (pred.trend === 'down' ? -pred.confidence * BIAS_FACTOR * 1.5 : 0);
    log('INFO', `Viés de tendência: ${bias.toFixed(6)} (Tendência: ${pred.trend}).`);
    return bias;
}

// ---------------- CHECK ORDERS ----------------
async function checkOrders(mid, volatility, pred, orderbook, sessionId = null) {
    const now = Date.now();
    const dynamicStopLoss = STOP_LOSS_PCT * (1 + volatility / 120);
    const dynamicTakeProfit = TAKE_PROFIT_PCT * (1 - Math.min(0.5, volatility / 120));
    for (const [key, order] of activeOrders.entries()) {
        const age = cycleCount - (order.cyclePlaced || cycleCount);
        const timeAge = (now - order.timestamp) / 1000;
        const targetPrice = key === 'buy' ? mid * (1 - currentSpreadPct / 2) : mid * (1 + currentSpreadPct / 2);
        const priceDrift = Math.abs(targetPrice - order.price) / order.price;
        const hasInterest = orderbook.bids[0][1] > order.qty * 2 || orderbook.asks[0][1] > order.qty * 2;

        const stopPrice = order.side === 'buy' ? order.price * (1 - dynamicStopLoss) : order.price * (1 + dynamicStopLoss);
        const takePrice = order.side === 'buy' ? order.price * (1 + dynamicTakeProfit) : order.price * (1 - dynamicTakeProfit);

        if ((order.side === 'buy' && mid <= stopPrice) || (order.side === 'sell' && mid >= stopPrice)) {
            await tryCancel(key);
            log('ALERT', `Stop-loss acionado para ordem ${key.toUpperCase()}.`);
            continue;
        }
        if ((order.side === 'buy' && mid >= takePrice) || (order.side === 'sell' && mid <= takePrice)) {
            await tryCancel(key);
            log('SUCCESS', `Take-profit acionado para ordem ${key.toUpperCase()}.`);
            continue;
        }
        // Melhoria: Sistema Anti-Stuck Agressivo para destravar capital
        const isStuck = !SIMULATE && (timeAge > 300 || priceDrift > 0.01); // Cancela se > 5min ou > 1% de drift
        if (timeAge > MAX_ORDER_AGE || (age >= MIN_ORDER_CYCLES && !hasInterest) || isStuck) {
            await tryCancel(key);
            log('INFO', `Ordem ${key.toUpperCase()} cancelada por ${isStuck ? 'travamento (stuck/obsoleta)' : 'idade/liquidez'}.`);
            continue;
        }
        if (age >= MIN_ORDER_CYCLES && priceDrift > PRICE_DRIFT * (1 + PRICE_DRIFT_BOOST)) {
            await tryCancel(key);
            log('WARN', `Reprecificando ordem ${key.toUpperCase()} por drift (${(priceDrift * 100).toFixed(2)}%).`);
            const newPrice = key === 'buy' ? mid * (1 - currentSpreadPct / 2) : mid * (1 + currentSpreadPct / 2);
            if (pred.expectedProfit >= EXPECTED_PROFIT_THRESHOLD) {
                await placeOrder(key, newPrice, order.qty, sessionId); // Passa o sessionId
            }
        }
    }
}

// ---------------- COMPUTE PnL ----------------
async function computePnL(mid, sessionId = null) {
    let realizedPnL = 0;
    let totalBtcPosition = 0;
    let totalCostBasis = 0;
    let totalInvested = 0;

    // Carrega fills históricos, filtrando por sessão se um ID for fornecido
    const sessionFills = await db.loadHistoricalFills({ sessionId: sessionId });

    // Calcular PnL baseado exclusivamente no histórico de fills do banco de dados
    const orders = sessionFills.map(f => ({
        side: f.side,
        qty: parseFloat(f.qty),
        price: parseFloat(f.price),
        limitPrice: parseFloat(f.limitPrice || f.price),
        status: 'filled',
        feeRate: f.feeRate || FEE_RATE_MAKER,
        timestamp: f.timestamp
    })).sort((a, b) => a.timestamp - b.timestamp); // Ordenar por timestamp para FIFO

    // Recalcular posição e PnL realizado usando FIFO
    orders.forEach(o => {
        const qty = o.qty;
        const price = o.limitPrice || o.price;
        const fee = qty * price * o.feeRate;
        
        if (o.side === 'buy') {
            totalBtcPosition += qty;
            const cost = qty * price + fee;
            totalCostBasis += cost;
            totalInvested += cost;
        } else if (o.side === 'sell' && totalBtcPosition > 0) {
            const avgBuyPrice = totalCostBasis / totalBtcPosition;
            const sellAmount = Math.min(qty, totalBtcPosition);
            realizedPnL += (price * sellAmount) - (avgBuyPrice * sellAmount) - fee;
            totalBtcPosition -= sellAmount;
            totalCostBasis -= avgBuyPrice * sellAmount;
            
            // Garantir que não fique negativo
            if (totalBtcPosition <= 0) {
                totalBtcPosition = 0;
                totalCostBasis = 0;
            }
        }
    });

    // Atualizar posição global
    btcPosition = totalBtcPosition;
    
    // PnL não realizado (apenas se tiver posição aberta)
    const unrealizedPnL = totalBtcPosition > 0 && totalCostBasis > 0 ? 
        (mid * totalBtcPosition) - totalCostBasis : 0;

    // PnL total
    const totalPnL = realizedPnL + unrealizedPnL;

    // ROI baseado no capital investido
    const roi = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    // Preço médio de preenchimento
    const avgFillPrice = totalInvested > 0 && totalBtcPosition > 0 ? 
        totalCostBasis / totalBtcPosition : mid;

    // Atualizar stats
    stats.avgFillPrice = avgFillPrice.toFixed(2);
    stats.totalPnL = totalPnL.toFixed(2);
    stats.realizedPnL = realizedPnL.toFixed(2);
    stats.unrealizedPnL = unrealizedPnL.toFixed(2);
    stats.totalInvested = totalInvested.toFixed(2);

    // Enviar alerta
    sendAlert(totalPnL, roi);

    // Log detalhado para validação
    log('DEBUG', `PnL Calculation: Realized=${realizedPnL.toFixed(2)} | Unrealized=${unrealizedPnL.toFixed(2)} | Total=${totalPnL.toFixed(2)} | Position=${totalBtcPosition.toFixed(8)} BTC | Cost Basis=${totalCostBasis.toFixed(2)} BRL`);

    return {
        pnl: totalPnL.toFixed(2),
        roi: roi.toFixed(2),
        unrealized: unrealizedPnL.toFixed(2),
        realized: realizedPnL.toFixed(2),
        avgFillPrice: avgFillPrice.toFixed(2),
        position: totalBtcPosition.toFixed(8),
        costBasis: totalCostBasis.toFixed(2),
        invested: totalInvested.toFixed(2)
    };
}

// ---------------- SEND ALERT ----------------
function sendAlert(currentPnL, roi) {
    if (currentPnL <= ALERT_PNL_THRESHOLD) {
        log('ALERT', `PnL baixo: ${currentPnL.toFixed(2)} BRL (limite: ${ALERT_PNL_THRESHOLD}). Verifique a estratégia!`);
    }
    if (roi <= ALERT_ROI_THRESHOLD) {
        log('ALERT', `ROI baixo: ${roi.toFixed(2)}% (limite: ${ALERT_ROI_THRESHOLD}). Atenção ao desempenho!`);
    }
    if (currentPnL > 0 && Math.abs(currentPnL) >= Math.abs(ALERT_PNL_THRESHOLD)) {
        log('SUCCESS', `PnL positivo: ${currentPnL.toFixed(2)} BRL. Bom desempenho!`);
    }
}

// ---------------- OPTIMIZE PARAMS ----------------
function optimizeParams() {
    if (performanceHistory.length < PERFORMANCE_WINDOW) {
        log('INFO', `Aguardando mais ciclos para otimização (${performanceHistory.length}/${PERFORMANCE_WINDOW}).`);
        return;
    }
    const recentPnL = performanceHistory.slice(-PERFORMANCE_WINDOW).reduce((sum, p) => sum + p, 0) / PERFORMANCE_WINDOW;
    if (recentPnL > 0) {
        currentBaseSize = Math.min(MAX_ORDER_SIZE, currentBaseSize * (1 + PARAM_ADJUST_FACTOR));
        currentSpreadPct = Math.max(MIN_SPREAD_PCT, currentSpreadPct * (1 - PARAM_ADJUST_FACTOR / 2));
        log('SUCCESS', `Otimização: Aumentando tamanho para ${currentBaseSize.toFixed(6)}, reduzindo spread para ${(currentSpreadPct * 100).toFixed(3)}% (PnL positivo).`);
    } else if (recentPnL < 0) {
        currentBaseSize = Math.max(MIN_ORDER_SIZE, currentBaseSize * (1 - PARAM_ADJUST_FACTOR));
        currentSpreadPct = currentSpreadPct * (1 + PARAM_ADJUST_FACTOR);
        log('WARN', `Otimização: Reduzindo tamanho para ${currentBaseSize.toFixed(6)}, aumentando spread para ${(currentSpreadPct * 100).toFixed(3)}% (PnL negativo).`);
    } else {
        log('INFO', `Desempenho estável. Sem ajustes nos parâmetros.`);
    }
}

// ---------------- BACKTEST ----------------
async function runBacktest(candlesPath) {
    try {
        log('INFO', `Iniciando backtest com arquivo ${candlesPath}.`);
        const candles = JSON.parse(fs.readFileSync(candlesPath, 'utf8'));
        if (!Array.isArray(candles) || !candles.every(c => c.close && !isNaN(parseFloat(c.close)))) {
            throw new Error('Formato de candles inválido.');
        }
        // Reset estados
        cycleCount = 0;
        activeOrders = new Map();
        totalFills = 0;
        totalPnL = 0.0;
        btcPosition = 0;
        totalCost = 0;
        historicalFills = [];
        priceHistory = [];
        performanceHistory = [];
        testPhase = true;
        currentSpreadPct = MIN_SPREAD_PCT;
        currentBaseSize = ORDER_SIZE;
        stats = {
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
        // Simular orderbook básico
        lastOrderbook = {bids: [], asks: []};
        for (let i = 0; i < candles.length; i++) {
            const midPrice = parseFloat(candles[i].close);
            lastOrderbook = {
                bids: [[midPrice * 0.999, ORDER_SIZE * 2]], asks: [[midPrice * 1.001, ORDER_SIZE * 2]]
            };
            priceHistory.push(midPrice);
            if (priceHistory.length > 60) priceHistory.shift();
            await runCycle();
        }
        log('SUCCESS', `Backtest concluído. Ciclos: ${cycleCount}, PnL Final: ${totalPnL.toFixed(2)} BRL, ROI: ${(totalPnL / (totalCost || 1) * 100).toFixed(2)}%.`);
    } catch (e) {
        log('ERROR', `Erro no backtest: ${e.message}.`);
    }
}

// ---------------- CICLO PRINCIPAL ----------------
async function runCycle() {
    try {
        cycleCount++;
        stats.cycles = cycleCount;
        log('INFO', `Iniciando ciclo ${cycleCount}.`);

        // Verificar tendências externas (a cada 10min)
        await checkExternalTrends();

        // Atualizar orderbook
        const obAge = (Date.now() - lastObUpdate) / 1000;
        let orderbook = (obAge > OB_REFRESH_SEC || lastObUpdate === 0) ? await fetchOrderbookRest() : lastOrderbook;
        if (!orderbook.bids.length || !orderbook.asks.length) {
            log('WARN', `Ciclo ${cycleCount} pulado: orderbook inválido.`);
            return;
        }

        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        if (bestBid >= bestAsk) {
            log('WARN', `Orderbook inválido: Best Bid (${bestBid}) >= Best Ask (${bestAsk}). Pulando ciclo.`);
            return;
        }
        const mid = (bestBid + bestAsk) / 2;
        const spreadPct = ((bestAsk - bestBid) / mid) * 100;

        // Atualizar priceHistory com o preço atual
        priceHistory.push(mid);
        if (priceHistory.length > 100) priceHistory.shift(); // Limita a 100 preços

        // ===== ARMAZENAR PREÇO NO BANCO DE DADOS =====
        try {
            await db.saveBtcPrice(mid);
        } catch (e) {
            log('WARN', `Erro ao armazenar preço BTC: ${e.message}`);
        }

        // Verificar volatilidade
        if (priceHistory.length < 2) {
            log('WARN', `Ciclo ${cycleCount} pulado: priceHistory insuficiente (${priceHistory.length} preços).`);
            return;
        }
        const volatility = calculateVolatility(priceHistory);
        const volatilityPct = volatility; // Usar valor direto
        log('DEBUG', `Volatilidade no ciclo ${cycleCount}: ${volatilityPct.toFixed(2)}%`);
        if (volatilityPct > MAX_VOLATILITY_PCT || volatilityPct < MIN_VOLATILITY_PCT) {
            log('WARN', `Ciclo ${cycleCount} pulado: volatilidade=${volatilityPct.toFixed(2)}% fora do intervalo [${MIN_VOLATILITY_PCT}, ${MAX_VOLATILITY_PCT}].`);
            return;
        }

        // Verificar fase de teste
        if (testPhase && cycleCount >= TEST_PHASE_CYCLES) {
            testPhase = false;
            log('INFO', 'Fase de teste concluída. Iniciando operação normal.');
        }

        // Calcular indicadores e previsão
        const pred = fetchPricePrediction(mid, orderbook);
        marketTrend = pred.trend;

        // Calcular convicção com o novo sistema aprimorado
        const indicators = {
            rsi: pred.rsi,
            emaShort: pred.emaShort,
            emaLong: pred.emaLong,
            macd: pred.macd,
            signal: pred.signal,
            price: mid,
            volatility: volatilityPct / 100,
            trend: marketTrend
        };

        const conviction = confidenceSystem.calculateConviction(indicators, {
            volatilityLevel: volatilityPct,
            regime: pred.regime
        });

        log('DEBUG', `Convicção calculada: ${(conviction.overallConfidence * 100).toFixed(1)}% | Tendência: ${conviction.trend} | Força: ${conviction.strength}`);

        // Usar convicção para ajustar tamanho da ordem dinamicamente
        const confidenceMultiplier = conviction.details.recommendedPositionSize;

        // Melhoria: Spread dinâmico agressivo baseado em volatilidade e RSI
        const depthFactor = orderbook.bids[0][1] > 0 ? Math.min(orderbook.bids[0][1] / (ORDER_SIZE * 20), 2) : 1;
        let dynamicSpreadPct = Math.max(MIN_SPREAD_PCT, SPREAD_PCT * (1 + volatilityPct / 10));
        
        // Ajuste baseado em volatilidade (mais conservador)
        if (volatilityPct >= VOL_LIMIT_PCT) dynamicSpreadPct *= 1.15; 
        else if (volatilityPct < 0.5) dynamicSpreadPct *= 0.9;
        
        // Ajuste baseado em RSI (zonas de exaustão)
        if (pred.rsi > 70 || pred.rsi < 30) dynamicSpreadPct *= 1.1;
        
        // Profit Guard: Garantir lucro líquido real acima das taxas (Maker: 0.30%, Taker: 0.70%)
        // Usamos 0.8% como spread mínimo de segurança para cobrir taxas e slippage
        const minSafetySpread = 0.008; 
        if (dynamicSpreadPct < minSafetySpread) dynamicSpreadPct = minSafetySpread;
        
        // Limita spread máximo a 1.5% (mais flexível para capturar lucro em alta volatilidade)
        dynamicSpreadPct = Math.min(dynamicSpreadPct, 0.015);
        currentSpreadPct = dynamicSpreadPct;

        let dynamicOrderSize = testPhase ? MIN_ORDER_SIZE : Math.max(MIN_ORDER_SIZE, Math.min(MAX_ORDER_SIZE, ORDER_SIZE * (1 + volatilityPct / 100)));
        dynamicOrderSize *= (1 + (pred.expectedProfit - EXPECTED_PROFIT_THRESHOLD) * 2);
        dynamicOrderSize *= confidenceMultiplier; // Aplicar multiplicador de convicção
        dynamicOrderSize = Math.min(MAX_ORDER_SIZE, dynamicOrderSize);
        currentBaseSize = dynamicOrderSize;

        // Otimização de Regime de Mercado (Trend Specialist)
        let regimeSpreadMult = 1.0;
        let regimeBiasMult = 1.0;
        let regimeSizeMult = 1.0;

        switch (pred.regime) {
            case 'BULL_TREND':
                regimeSpreadMult = 0.8; // Spread mais curto para não perder o bonde
                regimeBiasMult = 1.5;   // Viés de compra mais forte
                regimeSizeMult = 1.2;   // Aumenta a mão na alta
                break;
            case 'BEAR_TREND':
                regimeSpreadMult = 2.0; // Spread 2x maior para garantir lucro na recuperação
                regimeBiasMult = 1.8;   // Viés de venda/proteção muito forte
                regimeSizeMult = 0.7;   // Mão bem leve na queda
                break;
            case 'RANGING':
                regimeSpreadMult = 1.2; // Spread maior para capturar oscilação lateral
                regimeBiasMult = 0.5;   // Viés neutro
                regimeSizeMult = 1.0;
                break;
        }

        dynamicSpreadPct *= regimeSpreadMult;

        const targetBtc = MAX_POSITION / 2;
        const inventoryDeviation = (btcPosition - targetBtc) / MAX_POSITION;
        const inventorySkew = -inventoryDeviation * 0.01 * regimeBiasMult;
        
        const avgPrice = stats.avgFillPrice > 0 ? parseFloat(stats.avgFillPrice) : mid;
        const dcaBias = mid < avgPrice * 0.95 ? 0.005 : 0;
        
        const trendFactor = (parseFloat(pred.confidence) > 2.0 ? 0.003 : 0.0015) * regimeBiasMult;
        const trendBias = pred.trend === 'up' ? trendFactor : (pred.trend === 'down' ? -trendFactor : 0);
        
        const totalBias = Math.min(0.03, Math.max(-0.03, inventorySkew + trendBias + dcaBias));
        dynamicOrderSize *= regimeSizeMult;
        const refPrice = mid * (1 + totalBias);
        
        // Buffer de Recuperação de Resíduo: Aumenta dinamicamente o spread se o PnL estiver negativo
        const pnlResidueBuffer = stats.totalPnL < 0 ? calculateDynamicRecoveryBuffer(pred.volatility * 100) : 0;
        const finalSpreadPct = dynamicSpreadPct + pnlResidueBuffer;

        // Filtro de Convicção: Evitar operar em baixa confiança + volatilidade extrema
        if (!testPhase && conviction.overallConfidence < 0.4 && conviction.details.volatilityLevel === 'EXTREME') {
            log('WARN', `Ciclo ${cycleCount} pulado: Convicção muito baixa (${(conviction.overallConfidence * 100).toFixed(1)}%) + volatilidade extrema. Aguardando melhores condições.`);
            return;
        }

        // Alerta de confiança baixa mas opera em modo conservador
        if (conviction.overallConfidence < 0.5 && !testPhase) {
            log('WARN', `Confiança baixa (${(conviction.overallConfidence * 100).toFixed(1)}%). Operando em modo conservador com spread expandido.`);
            dynamicSpreadPct *= 1.2; // Expandir spread
            dynamicOrderSize *= 0.6; // Reduzir tamanho
        }

        // Arredondamento Favorável: Compra (Floor), Venda (Ceil) para evitar perdas por precisão
        let buyPrice = Math.min(Math.floor(refPrice * (1 - finalSpreadPct / 2) * 100) / 100, bestBid);
        let sellPrice = Math.max(Math.ceil(refPrice * (1 + finalSpreadPct / 2) * 100) / 100, bestAsk);
        
        if (buyPrice >= sellPrice || Math.abs(buyPrice - sellPrice) / mid < MIN_SPREAD_PCT) {
            log('WARN', 'Spread inválido ou muito estreito. Ajustando para spread natural.');
            buyPrice = Math.floor(mid * (1 - finalSpreadPct / 2) * 100) / 100;
            sellPrice = Math.ceil(mid * (1 + finalSpreadPct / 2) * 100) / 100;
        }

        // Verificar cooldown
        const cooldown = volatilityPct < 0.4 ? 0 : 1;
        if (cycleCount - lastTradeCycle < cooldown) {
            log('INFO', `Ciclo ${cycleCount} pulado: cooldown ativo após última negociação.`);
            return;
        }

        // Verificar ordens ativas
        for (const key of ['buy', 'sell']) {
            if (activeOrders.has(key)) {
                const statusResult = await checkOrderStatus(key, key);
                if (statusResult.status === 'filled' || statusResult.status === 'error') {
                    activeOrders.delete(key);
                }
            }
        }

        // Gerenciar ordens ativas
        await checkOrders(mid, volatility, pred, orderbook, activeSession ? activeSession.id : null);

        // Verificar saldos
        let balances;
        try {
            balances = SIMULATE ? [{symbol: 'BRL', available: '1000'}, {
                symbol: 'BTC', available: '0.001'
            }] : await MB.getBalances();
        } catch (e) {
            log('ERROR', `Falha ao buscar saldos: ${e.message}. Usando saldos zerados.`);
            balances = [{symbol: 'BRL', available: '0'}, {symbol: 'BTC', available: '0'}];
        }
        const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
        const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);
        
        // Alerta de saldo insuficiente
        const minBrlBalance = MIN_ORDER_SIZE * mid * 2; // Saldo mínimo para 2 ordens
        const minBtcBalance = MIN_ORDER_SIZE * 2;
        if (brlBalance < minBrlBalance) {
            log('ALERT', `Saldo BRL muito baixo (${brlBalance.toFixed(2)} < ${minBrlBalance.toFixed(2)}). Considere depositar mais fundos.`);
        }
        if (btcBalance < minBtcBalance) {
            log('WARN', `Saldo BTC muito baixo (${btcBalance.toFixed(8)} < ${minBtcBalance.toFixed(8)}). Apenas ordens de compra serão colocadas.`);
        }

        // Colocar ordens (com validação externa)
        if (pred.expectedProfit >= EXPECTED_PROFIT_THRESHOLD) {
            let buyQty = dynamicOrderSize;
            const buyCost = buyPrice * buyQty * (1 + FEE_RATE); // Taxa estimada de 0.3%
            if (buyCost > brlBalance) {
                buyQty = Math.floor((brlBalance / (buyPrice * (1 + FEE_RATE))) * 1e8) / 1e8;
                if (buyQty < MIN_ORDER_SIZE) {
                    buyQty = 0;
                    log('WARN', `Saldo BRL insuficiente (${brlBalance.toFixed(2)} < ${buyCost.toFixed(2)}). Ignorando compra.`);
                }
            }
            
            // Validar ordem de compra com tendências externas
            if (!activeOrders.has('buy') && buyQty >= MIN_ORDER_SIZE) {
                const buyValidation = await validateTradingDecision(pred.trend, pred.confidence, 'buy');
                if (buyValidation.shouldTrade) {
                    await placeOrder('buy', buyPrice, buyQty, activeSession ? activeSession.id : null);
                    log('SUCCESS', `Ordem BUY validada: ${buyValidation.reason}`);
                } else {
                    log('WARN', `Ordem BUY cancelada por validação externa: ${buyValidation.reason}`);
                }
            }

            let sellQty = dynamicOrderSize;
            if (sellQty > btcBalance) {
                sellQty = Math.floor(btcBalance * 1e8) / 1e8;
            }
            if (sellQty > 0) {
                sellQty = Math.max(MIN_ORDER_SIZE, Math.floor(sellQty * (1 - FEE_RATE) * 1e8) / 1e8); // Buffer para fee deduzida do BTC
            }
            if (sellQty < MIN_ORDER_SIZE) {
                sellQty = 0;
                log('WARN', `Saldo BTC insuficiente (${btcBalance.toFixed(8)} < ${dynamicOrderSize.toFixed(8)}). Ignorando venda.`);
            }
            
            // Validar ordem de venda com tendências externas
            if (!activeOrders.has('sell') && sellQty >= MIN_ORDER_SIZE) {
                const sellValidation = await validateTradingDecision(pred.trend, pred.confidence, 'sell');
                if (sellValidation.shouldTrade) {
                    await placeOrder('sell', sellPrice, sellQty, activeSession ? activeSession.id : null);
                    log('SUCCESS', `Ordem SELL validada: ${sellValidation.reason}`);
                } else {
                    log('WARN', `Ordem SELL cancelada por validação externa: ${sellValidation.reason}`);
                }
            }
        } else {
            log('INFO', `Score de lucro baixo (${pred.expectedProfit.toFixed(2)} < ${EXPECTED_PROFIT_THRESHOLD}). Não colocando ordens.`);
        }

        // ===== GESTÃO DE SESSÃO DE RECUPERAÇÃO =====
        const activeSession = await db.getActiveRecoverySession();
        if (activeSession) {
            // Calcula o PnL apenas para a sessão atual
            const pnlData = await computePnL(mid, activeSession.id);
            const currentPnL = parseFloat(pnlData.pnl);

            const progress = (1 - (Math.abs(currentPnL) / Math.abs(activeSession.baseline))) * 100;

            log('INFO', `[RECOVERY] Sessão ${activeSession.id} ativa. PnL da Sessão: ${currentPnL.toFixed(2)} BRL. Baseline: ${activeSession.baseline}. Progresso: ${progress.toFixed(1)}%`);

            // Se o PnL da sessão ficar positivo, fecha a sessão de recuperação.
            if (currentPnL >= 0) {
                await db.endRecoverySession(activeSession.id);
                log('SUCCESS', `[RECOVERY] Sessão ${activeSession.id} concluída com sucesso! PnL final da sessão: ${currentPnL.toFixed(2)} BRL.`);
            } else {
                // Se o PnL atual for estritamente pior (mais negativo) que a linha de base, atualize a linha de base.
                if (currentPnL < parseFloat(activeSession.baseline)) {
                    log('INFO', `[RECOVERY] PnL piorou. Atualizando baseline de ${activeSession.baseline} para ${currentPnL.toFixed(2)}.`);
                    await db.updateRecoveryBaseline(activeSession.id, currentPnL);
                }
                // Salva o ponto de dados para o gráfico
                await db.appendRecoveryPoint(activeSession.id, currentPnL, progress, activeSession.baseline);
            }
        } else {
            // Lógica para iniciar uma nova sessão de recuperação se o PnL total ficar negativo
            const totalPnlData = await computePnL(mid, null); // PnL Total
            if (parseFloat(totalPnlData.pnl) < -1) { // Inicia se a perda for maior que R$1.00
                const newSessionId = await db.startRecoverySession(totalPnlData.pnl, totalPnlData.pnl);
                log('WARN', `[RECOVERY] PnL total negativo (${totalPnlData.pnl} BRL). Nova sessão de recuperação #${newSessionId} iniciada.`);
            }
        }


        // Verificar e gerenciar ordens ativas
        await checkOrders(mid, volatilityPct, pred, orderbook, activeSession ? activeSession.id : null);

        // Colocar novas ordens se não houver ordens ativas
        const bias = getInventoryBias(mid) + getTrendBias(pred) + pred.histBias;
        if (!activeOrders.has('buy') && !activeOrders.has('sell')) {
            let buyPrice = mid * (1 - currentSpreadPct / 2) + bias;
            let sellPrice = mid * (1 + currentSpreadPct / 2) + bias;

            if (buyPrice >= sellPrice || Math.abs(buyPrice - sellPrice) / mid < MIN_SPREAD_PCT) {
                log('WARN', 'Spread inválido ou muito estreito. Ajustando para spread natural.');
                buyPrice = Math.floor(mid * (1 - currentSpreadPct / 2) * 100) / 100;
                sellPrice = Math.ceil(mid * (1 + currentSpreadPct / 2) * 100) / 100;
            }

            const decisionBuy = await validateTradingDecision('up', 1, 'buy');
            if (decisionBuy.shouldTrade) {
                await placeOrder('buy', buyPrice, currentBaseSize, activeSession ? activeSession.id : null);
            }

            const decisionSell = await validateTradingDecision('down', 1, 'sell');
            if (decisionSell.shouldTrade) {
                await placeOrder('sell', sellPrice, currentBaseSize, activeSession ? activeSession.id : null);
            }
        }

        // Calcular PnL e outras estatísticas (agora usando o PnL total)
        const pnlData = await computePnL(mid, null); // Passa null para obter PnL total

        // Atualizar histórico de performance para otimização
        performanceHistory.push(parseFloat(pnlData.pnl));
        if (performanceHistory.length > PERFORMANCE_WINDOW * 2) performanceHistory.shift();

        stats.fillRate = totalFills > 0 ? ((totalFills / stats.totalOrders) * 100).toFixed(1) + '%' : '0.0%';
        stats.avgSpread = dynamicSpreadPct * 100;
        stats.uptime = `${Math.round((Date.now() - startTime) / 60000)}min`;

        // Persistência de sessão de recuperação e pontos por ciclo
        // IMPORTANTE: Usar PnL portfolio-based (saldo total - capital inicial) 
        // para sincronizar com o dashboard e ativar recuperação corretamente
        try {
            const totalBalance = brlBalance + (btcBalance * mid);
            const portfolioPnL = totalBalance - INITIAL_CAPITAL;
            const currentPnL = parseFloat(portfolioPnL.toFixed(2));
            
            let activeSession = await db.getActiveRecoverySession();
            if (currentPnL < 0) {
                // Iniciar sessão se não existir
                if (!activeSession) {
                    await db.startRecoverySession(currentPnL, currentPnL);
                    activeSession = await db.getActiveRecoverySession();
                    // Inicializar contador local de confirmações
                    baselineLowerCount[activeSession.id] = 0;
                    log('SUCCESS', `[RECOVERY] Sessão de recuperação iniciada | Baseline: R$ ${currentPnL.toFixed(2)}`);
                } else if (currentPnL < parseFloat(activeSession.baseline)) {
                    // Atualizar baseline quando a perda aumentar (mais negativa)
                    const oldBaseline = parseFloat(activeSession.baseline);
                    const nowSec = Math.floor(Date.now() / 1000);
                    const lastManual = activeSession.last_manual_baseline_at ? parseInt(activeSession.last_manual_baseline_at) : null;

                    // Se houve um reset manual recente, exigir confirmação em 2 ciclos antes de aceitar baseline inferior
                    if (lastManual && (nowSec - lastManual) < BASELINE_DEBOUNCE_SEC) {
                        baselineLowerCount[activeSession.id] = (baselineLowerCount[activeSession.id] || 0) + 1;
                        log('DEBUG', `[RECOVERY] Detected lower PnL (${currentPnL}) but recent manual reset at ${lastManual}. consecutive=${baselineLowerCount[activeSession.id]}`);
                        if (baselineLowerCount[activeSession.id] >= 2) {
                            await db.updateRecoveryBaseline(activeSession.id, currentPnL);
                            activeSession.baseline = currentPnL;
                            baselineLowerCount[activeSession.id] = 0;
                            log('WARN', `[RECOVERY] Baseline atualizado após confirmação: R$ ${oldBaseline.toFixed(2)} → R$ ${currentPnL.toFixed(2)}`);
                        } else {
                            log('INFO', `[RECOVERY] Ignorando atualização de baseline por debounce (cycle ${baselineLowerCount[activeSession.id]}).`);
                        }
                    } else {
                        // Sem reset recente, atualizar imediatamente
                        await db.updateRecoveryBaseline(activeSession.id, currentPnL);
                        activeSession.baseline = currentPnL;
                        baselineLowerCount[activeSession.id] = 0;
                        log('WARN', `[RECOVERY] Baseline atualizado: R$ ${oldBaseline.toFixed(2)} → R$ ${currentPnL.toFixed(2)}`);
                    }
                }

                const baseline = parseFloat(activeSession.baseline);
                const percentage = baseline < 0 ? ((currentPnL - baseline) / (0 - baseline)) * 100 : 0;
                await db.appendRecoveryPoint(activeSession.id, currentPnL, percentage, baseline);
                log('DEBUG', `[RECOVERY] Ponto registrado: PnL=R$ ${currentPnL.toFixed(2)}, Progresso=${percentage.toFixed(1)}%, Baseline=R$ ${baseline.toFixed(2)}`);
            } else if (activeSession) {
                // Encerrar sessão ao atingir ou ultrapassar o break-even
                await db.endRecoverySession(activeSession.id);
                log('SUCCESS', `[RECOVERY] Sessão de recuperação encerrada | PnL Final: R$ ${currentPnL.toFixed(2)}`);
            }
        } catch (err) {
            log('WARN', `Falha ao persistir sessão de recuperação: ${err.message}`);
        }

        // Otimizar parâmetros
        if (cycleCount % PERFORMANCE_WINDOW === 0) optimizeParams();

        // Validação de PnL a cada 20 ciclos (para auditoria)
        if (cycleCount > 0 && cycleCount % 20 === 0) {
            try {
                const validation = await db.validatePnL(mid);
                if (validation) {
                    const botPnL = parseFloat(pnlData.pnl);
                    const dbPnL = parseFloat(validation.total_pnl);
                    const difference = Math.abs(botPnL - dbPnL);
                    
                    if (difference > 1.0) { // Diferença maior que R$ 1,00
                        log('WARN', `DISCREPÂNCIA DE PnL DETECTADA: Bot=${botPnL} | DB=${dbPnL} | Diff=${difference.toFixed(2)} BRL`);
                    } else {
                        log('SUCCESS', `Validação PnL OK: Bot=${botPnL} | DB=${dbPnL} | Diff=${difference.toFixed(2)} BRL`);
                    }
                }
            } catch (error) {
                log('ERROR', `Erro na validação de PnL: ${error.message}`);
            }
        }

        // Trava de Segurança: Perda Máxima Diária
        const dailyPnl = parseFloat(pnlData.pnl);
        if (dailyPnl <= -DAILY_LOSS_LIMIT) {
            log('ALERT', `CRÍTICO: Limite de perda diária atingido (${dailyPnl.toFixed(2)} <= -${DAILY_LOSS_LIMIT}). Encerrando bot por segurança.`);
            process.exit(1);
        }

        // Mini-dashboard
        log('INFO', '────────────── Mini Dashboard ──────────────');
        log('INFO', `Ciclo: ${cycleCount} | Mid Price: ${mid.toFixed(2)} | Tendência: ${marketTrend} | Regime: ${pred.regime}`);
        
        // Informações de Convicção
        const convictionColor = conviction.overallConfidence > 0.7 ? '🟢' : 
                               conviction.overallConfidence > 0.5 ? '🟡' : '🔴';
        log('INFO', `${convictionColor} Convicção: ${(conviction.overallConfidence * 100).toFixed(1)}% | Tendência Convicção: ${conviction.trend} | Força: ${conviction.strength}`);
        log('INFO', `   Indicadores concordam: ${conviction.details.numIndicatorsAgreed}/${conviction.details.totalIndicators} | Nível volatilidade: ${conviction.details.volatilityLevel}`);
        if (conviction.signals.length > 0 && conviction.signals.length <= 3) {
            conviction.signals.slice(0, 3).forEach(sig => log('INFO', `   📍 ${sig}`));
        }
        
        // Informações de tendência externa
        if (externalTrendData) {
            const extTrend = externalTrendData;
            log('INFO', `🌐 Tendência Externa: ${extTrend.trend} (Score: ${extTrend.score}/100, Confiança: ${extTrend.confidence}%)`);
            const alignment = pred.trend === 'up' && extTrend.trend === 'BULLISH' ? '✅' : 
                             pred.trend === 'down' && extTrend.trend === 'BEARISH' ? '✅' : 
                             pred.trend === 'neutral' && extTrend.trend === 'NEUTRAL' ? '✅' : '⚠️';
            log('INFO', `${alignment} Alinhamento: Bot=${pred.trend?.toUpperCase()} vs Externo=${extTrend.trend}`);
        } else {
            log('INFO', '🌐 Tendência Externa: Não disponível');
        }
        
        log('INFO', `RSI: ${pred.rsi.toFixed(2)} | EMA Curta: ${pred.emaShort.toFixed(2)} | EMA Longa: ${pred.emaLong.toFixed(2)}`);
        log('INFO', `MACD: ${pred.macd?.toFixed(2) || 'N/A'} | Signal: ${pred.signal?.toFixed(2) || 'N/A'} | Volatilidade: ${pred.volatility.toFixed(2)}%`);
        log('INFO', `Score Lucro Esperado: ${pred.expectedProfit.toFixed(2)} | Confiança: ${pred.confidence.toFixed(2)}`);
        log('INFO', `Spread: ${(dynamicSpreadPct * 100).toFixed(3)}% | Buy Price: ${buyPrice.toFixed(2)} | Sell Price: ${sellPrice.toFixed(2)}`);
        log('INFO', `Tamanho Ordens: ${dynamicOrderSize.toFixed(8)} BTC | Depth Factor: ${depthFactor.toFixed(2)}`);
        log('INFO', `Viés Inventário (Skew): ${inventorySkew.toFixed(6)} | Viés Tendência: ${trendBias.toFixed(6)} | Total Bias: ${totalBias.toFixed(6)}`);
        log('INFO', `PnL Total: ${pnlData.pnl} BRL | ROI: ${pnlData.roi}% | PnL Não Realizado: ${pnlData.unrealized} BRL`);
        log('INFO', `Posição BTC: ${btcPosition.toFixed(8)} | Saldo BRL: ${brlBalance.toFixed(2)} | Saldo BTC: ${btcBalance.toFixed(8)}`);
        log('INFO', `Ordens Ativas: ${activeOrders.size} | Fills: ${totalFills} | Cancelamentos: ${stats.cancels}`);
        log('INFO', `Taxa de Fill: ${stats.fillRate} | Preço Médio Fill: ${stats.avgFillPrice} BRL | Uptime: ${stats.uptime}`);
        log('INFO', '────────────────────────────────────────────');
    } catch (e) {
        log('ERROR', `Erro no ciclo ${cycleCount}: ${e.message}.`);
    }
}

// ---------------- MAIN ----------------
async function main() {
    try {
        log('INFO', 'Inicializando bot...');
        log('INFO', 'Inicializando banco de dados...');
        await db.init();
        log('SUCCESS', 'Banco de dados inicializado.');
        log('INFO', 'Autenticando Mercado Bitcoin...');
        await MB.authenticate();
        log('SUCCESS', 'Autenticado com sucesso.');
        await initWarmup();
        log('INFO', 'Carregando fills históricos...');
        historicalFills = await db.loadHistoricalFills() || [];
        log('SUCCESS', `Carregados ${historicalFills.length} fills históricos.`);
        log('INFO', 'Iniciando loop principal.');
        await runCycle();
        setInterval(runCycle, CYCLE_SEC * 1000);
        log('SUCCESS', `Bot operacional - SIMULATE=${SIMULATE}`);
    } catch (e) {
        log('ERROR', `Erro na inicialização: ${e.message}. Encerrando.`);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    log('WARN', 'SIGINT recebido. Encerrando com segurança...');
    for (const key of activeOrders.keys()) {
        await tryCancel(key);
    }
    await db.saveHistoricalFills(historicalFills);
    await db.close();
    log('SUCCESS', 'Encerramento concluído.');
    process.exit(0);
});

main();