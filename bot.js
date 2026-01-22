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
const AdaptiveStrategy = require('./adaptive_strategy');
const AdaptiveMarketManager = require('./adaptive_market_manager');
const MomentumOrderValidator = require('./momentum_order_validator');
const BTCAccumulator = require('./btc_accumulator');
const MomentumSync = require('./momentum_sync');
const AutoOptimizer = require('./auto_optimizer');
const LossAnalyzer = require('./loss_analyzer');
const ImprovedEntryExit = require('./improved_entry_exit');
const CashManagementStrategy = require('./cash_management_strategy');


// ================== INSTÂNCIAS GLOBAIS ==================
// MomentumSync removido (2025-01-21)
// const momentumSync = new MomentumSync();
let autoOptimizer = null;
let lossAnalyzer = null;
let improvedEntryExit = null;
let cashManagementStrategy = null; // Estratégia de gerenciamento de caixa - PRIMÁRIA

// ---------------- CONFIGURAÇÃO ----------------
const SIMULATE = process.env.SIMULATE === 'true'; // Modo simulação
const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4'; // Padrão API v4
const PAIR = process.env.PAIR || 'BTC-BRL'; // Par padrão BTC-BRL
const CYCLE_SEC = Math.max(1, parseInt(process.env.CYCLE_SEC || '15')); // Mínimo 1s
let SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.005'); // Spread maior = 0.5% (captura mais spread, menos sensível a fill)
let ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.02'); // Reduzido para 2% (ordens menores = mais frequentes, menos perda/ordem)
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.00005'); // Reduzido para 0.005% (menos sensível a drift)
const PRICE_DRIFT_BOOST = parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0'); // Desativado por padrão
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.0005'); // Atualizado para 0.05%
const MAX_SPREAD_PCT = parseFloat(process.env.MAX_SPREAD_PCT || '0.040'); // Máximo 4.0%
let STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || '0.008'); // Atualizado para 0.8%
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || '0.001'); // Atualizado para 0.1%
const MIN_VOLUME = parseFloat(process.env.MIN_VOLUME || '0.00005'); // Limitado a 0.00005 BTC
const MIN_ORDER_SIZE = parseFloat(process.env.MIN_ORDER_SIZE || '0.000005'); // Permitir micro-ordens
const MAX_ORDER_SIZE = parseFloat(process.env.MAX_ORDER_SIZE || '0.0004'); // Limitado a 0.04 BTC
const MAX_POSITION = parseFloat(process.env.MAX_POSITION || '0.0003'); // Posição máxima em BTC
const DAILY_LOSS_LIMIT = parseFloat(process.env.DAILY_LOSS_LIMIT || '10'); // Limite de perda diária em BRL
const INVENTORY_THRESHOLD = parseFloat(process.env.INVENTORY_THRESHOLD || '0.0002'); // Ajustado para 0.02%
const BIAS_FACTOR = parseFloat(process.env.BIAS_FACTOR || '0.00015'); // Ajustado para 0.015%
const SELL_FIRST_ENABLED = process.env.SELL_FIRST === 'true'; // Permite SELL sem BUY inicial
const MIN_ORDER_CYCLES = parseInt(process.env.MIN_ORDER_CYCLES || '2'); // Mínimo 2 ciclos antes de reprecificar/cancelar
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '1800'); // Máximo 1800s (30min) antes de cancelar - tempo generoso para preenchimento
const MIN_VOLATILITY_PCT = parseFloat(process.env.MIN_VOLATILITY_PCT || '0.1'); // Limitado a 0.1% mínimo para evitar pular ciclos
const MAX_VOLATILITY_PCT = parseFloat(process.env.MAX_VOLATILITY_PCT || '2.5'); // Limitado a 2.5% máximo para evitar excessos
const VOL_LIMIT_PCT = parseFloat(process.env.VOL_LIMIT_PCT || '1.5'); // 1.5% volume para filtrar
const EXPECTED_PROFIT_THRESHOLD = parseFloat(process.env.EXPECTED_PROFIT_THRESHOLD || '-0.0005'); // Negativo = coloca ordem mesmo com pequena perda esperada
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

// -------- ESTRATÉGIA ADAPTATIVA --------
// Ativa/desativa ajuste automático de parâmetros conforme tendência
const ADAPTIVE_STRATEGY_ENABLED = process.env.ADAPTIVE_STRATEGY !== 'false'; // Default: true
let adaptiveParams = null; // Será calculado dinamicamente
let lastAdaptiveUpdate = 0;

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
let lastCycleTimestamp = Date.now();
let priceHistory = [];
let historicalFills = [];
let performanceHistory = [];
let testPhase = true;
let externalTrendValidator = new ExternalTrendValidator();
let pairMapping = new Map(); // Mapeia pair_id -> {buyOrder, sellOrder}
let decisionEngine = new DecisionEngine();
let confidenceSystem = new ConfidenceSystem();
let adaptiveManager = null; // Será inicializado no startBot
let lastExternalCheck = 0;
let externalTrendData = null;
let currentSpreadPct = MIN_SPREAD_PCT;
let currentBaseSize = ORDER_SIZE;
let currentMaxPosition = MAX_POSITION;
let currentStopLoss = STOP_LOSS_PCT;
let momentumValidator = new MomentumOrderValidator(log); // Sistema de validação por momentum
let MOMENTUM_VALIDATION_ENABLED = process.env.MOMENTUM_VALIDATION === 'true'; // Default: desativado para não quebrar lógica
let sellFirstExecuted = false;

// ============= SISTEMA DE ACUMULAÇÃO BTC =============
const BTC_ACCUMULATOR_ENABLED = process.env.BTC_ACCUMULATOR !== 'false'; // Default: habilitado
let btcAccumulator = new BTCAccumulator({
    minBTCTarget: parseFloat(process.env.MIN_BTC_TARGET || '0.0005'),
    maxBRLHolding: parseFloat(process.env.MAX_BRL_HOLDING || '50'),
    dcaDropThreshold: parseFloat(process.env.DCA_DROP_THRESHOLD || '0.005'),
    sellResistance: parseFloat(process.env.SELL_RESISTANCE || '0.7'),
    minProfitToSell: parseFloat(process.env.MIN_PROFIT_TO_SELL || '0.008'),
    minHoldHours: parseFloat(process.env.MIN_HOLD_HOURS || '2'),
    brlDepletionUrgency: parseFloat(process.env.BRL_DEPLETION_URGENCY || '0.8'),
    enabled: BTC_ACCUMULATOR_ENABLED,
    log: (level, msg) => log(level, `[ACCUMULATOR] ${msg}`)
});

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

/**
 * NOVO: Cálculo adaptativo inteligente de spread
 * Otimiza spread baseado em volatilidade, regime, RSI e confiança
 * Garante margem mínima de lucro acima das taxas
 */
function getAdaptiveSpread(params = {}) {
    const { volatility = 0.5, regime = 'RANGING', rsi = 50, conviction = 0.5, baseSpread = 0.0006, minSpread = 0.0005, maxSpread = 0.040 } = params;
    
    let spread = Math.max(minSpread, baseSpread);
    
    // Factor 1: Volatilidade
    // Baixa vol (<0.5%): reduz spread para capturar mais trades
    // Alta vol (>2%): aumenta spread para compensar risco
    const volFactor = volatility < 0.5 ? 0.85 : (volatility > 2.0 ? 1.25 : 1.0);
    spread *= volFactor;
    
    // Factor 2: Regime de mercado
    const regimeFactors = {
        'BULL_TREND': 0.9,      // Trend alta: spread menor para não perder movimento
        'BEAR_TREND': 1.2,      // Trend baixa: spread maior para proteção
        'RANGING': 1.05,        // Lateral: spread neutro
    };
    spread *= (regimeFactors[regime] || 1.0);
    
    // Factor 3: RSI (zonas de exaustão)
    // RSI extremo (>75 ou <25): aumenta spread por incerteza
    if (rsi > 75 || rsi < 25) spread *= 1.15;
    
    // Factor 4: Confiança do sistema
    // Alta confiança: permite spread menor
    // Baixa confiança: aumenta spread para segurança
    if (conviction > 0.75) spread *= 0.9;        // Muito confiante
    else if (conviction < 0.3) spread *= 1.3;    // Pouco confiante
    
    // Garantir limites
    spread = Math.max(minSpread, Math.min(maxSpread, spread));
    
    log('DEBUG', `[SPREAD_ADAPT] vol=${volatility.toFixed(2)}% regime=${regime} rsi=${rsi.toFixed(0)} conviction=${conviction.toFixed(2)} => spread=${(spread*100).toFixed(2)}%`);
    
    return spread;
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
    // Verificar tendências externas a cada 10 minutos (600000ms), mas sempre na primeira vez
    const isFirstCheck = lastExternalCheck === 0;
    if (!isFirstCheck && now - lastExternalCheck < 600000) {
        return externalTrendData;
    }
    
    try {
        log('INFO', 'Consultando tendências externas do Bitcoin...');
        externalTrendData = await externalTrendValidator.analyzeCombinedTrend();
        lastExternalCheck = now;
        
        if (externalTrendData) {
            log('SUCCESS', `Tendência Externa: ${externalTrendData.trend} (Score: ${externalTrendData.score}/100, Confiança: ${externalTrendData.confidence}%)`);
        } else {
            log('WARN', 'Falha ao obter tendências externas - usando fallback conservador');
            externalTrendData = { trend: 'NEUTRAL', score: 50, confidence: 50, sources: {} };
        }
        
        return externalTrendData;
    } catch (error) {
        log('WARN', `Erro ao consultar tendências externas: ${error.message}`);
        if (!externalTrendData) {
            externalTrendData = { trend: 'NEUTRAL', score: 50, confidence: 50, sources: {} };
        }
        return externalTrendData;
    }
}

async function validateTradingDecision(botTrend, botConfidence, side) {
    // Garante que temos dados externos (carrega se necessário)
    if (!externalTrendData) {
        await checkExternalTrends();
    }
    
    // Se ainda não temos dados, rejeita o trade
    if (!externalTrendData) {
        return { shouldTrade: false, reason: 'Dados externos indisponíveis - operação bloqueada' };
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
    // MARKET MAKING: Operamos SEMPRE para ambos os lados (BUY e SELL)
    // A lógica é: colocar pares BUY/SELL para manter spread tight e capturar lucro
    let shouldTrade = true; // Market making sempre tenta colocar pares
    let reason = 'Market making operando normalmente';
    
    // Adicionar validação específica do side
    if (side === 'buy') {
        // BUY: Permitido em qualquer condição para iniciar novo par
        shouldTrade = true;
        reason = `BUY para iniciar novo par de market making`;
    } else if (side === 'sell') {
        // SELL: Muito flexível - market making precisa fechar posições
        shouldTrade = true;
        reason = `Market making fechando/rebalanceando posição`;
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

// ============ SINCRONIZAÇÃO DE PARES BUY/SELL ============
async function cancelPairOrder(filledSide) {
    /**
     * Quando uma ordem é preenchida, cancela a ordem par
     * Exemplo: Se BUY foi preenchida, cancela SELL
     */
    const pairSide = filledSide === 'buy' ? 'sell' : 'buy';
    const pairKey = pairSide;
    
    if (activeOrders.has(pairKey)) {
        const pairOrder = activeOrders.get(pairKey);
        log('INFO', `[SYNC] Ordem ${filledSide.toUpperCase()} preenchida. Cancelando ${pairSide.toUpperCase()} par ${pairOrder.id}...`);
        await tryCancel(pairKey);
    }
}

// ============ VALIDAÇÃO DE PARES ANTES DE COLOCAR ORDEM ============
function validateOrderPairs() {
    /**
     * Valida se há pares balanceados antes de colocar nova ordem
     * Evita acumular múltiplos BUY sem SELL correspondente ou vice-versa
     * 
     * REGRA: Para cada BUY aberta, deve haver uma SELL aberta
     * Se há desbalanceamento (ex: 3 BUY, 2 SELL), bloqueia novas ordens
     */
    const buyOrder = activeOrders.get('buy');
    const sellOrder = activeOrders.get('sell');
    
    const buyCount = buyOrder ? (buyOrder.count || 1) : 0;
    const sellCount = sellOrder ? (sellOrder.count || 1) : 0;
    
    // Se há mais BUY que SELL, precisa completar SELL antes de nova BUY
    if (buyCount > sellCount) {
        return { isBalanced: false, needsSell: true, message: `Aguardando SELL para completar par BUY (${buyCount} BUY vs ${sellCount} SELL)` };
    }
    
    // Se há mais SELL que BUY, precisa completar BUY antes de nova SELL
    if (sellCount > buyCount) {
        if (SELL_FIRST_ENABLED && buyCount === 0) {
            return { isBalanced: true, sellFirst: true, message: `SELL-first ativo (${sellCount} SELL vs ${buyCount} BUY)` };
        }
        return { isBalanced: false, needsBuy: true, message: `Aguardando BUY para completar par SELL (${sellCount} SELL vs ${buyCount} BUY)` };
    }
    
    // Se não há nenhuma ordem, pode colocar par novo
    if (buyCount === 0 && sellCount === 0) {
        return { isBalanced: true, message: 'Sem ordens abertas - pode colocar novo par' };
    }
    
    // Se há igual número de BUY e SELL (pares completos)
    return { isBalanced: true, hasPair: true, message: `Pares balanceados (${buyCount} BUY = ${sellCount} SELL)` };
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
            
            // SINCRONIZAÇÃO: Cancelar a ordem par quando uma ordem é preenchida
            await cancelPairOrder(side);
            
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
                
                // ===== BTC ACCUMULATOR: Registrar compra bem-sucedida =====
                if (BTC_ACCUMULATOR_ENABLED) {
                    btcAccumulator.recordBuy(price, qty);
                    log('SUCCESS', `[ACCUMULATOR] 💰 BUY registrada: ${qty.toFixed(8)} BTC @ R$${price.toFixed(2)} | Preço médio: R$${btcAccumulator.state.avgBuyPrice.toFixed(2)}`);
                }
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
            
            // SINCRONIZAÇÃO: Cancelar a ordem par quando uma ordem é preenchida
            await cancelPairOrder(status.side);
            
            return {status: 'filled', filledQty: qty};
        }
        return {status: status.status, filledQty: status.filledQty || 0};
    } catch (e) {
        log('WARN', `Erro ao verificar status da ordem ${order.id}: ${e.message}.`);
        return {status: 'error', filledQty: 0};
    }
}

// ---------------- PLACE ORDER ----------------
// Nota: Lógica de validação momentum removida (2025-01-21)
// Agora o bot coloca ordens diretamente sem fase de simulação

// Funções de momentum simulado removidas (2025-01-21)

async function placeOrder(side, price, qty, sessionId = null, pairIdInput = null) {
    try {
        if (qty * price < MIN_VOLUME) {
            log('WARN', `Ordem ${side.toUpperCase()} ignorada: volume baixo (${(qty * price).toFixed(8)} < ${MIN_VOLUME}).`);
            return;
        }
        const feeRate = getFeeRate(false); // Assume Maker para ordens limite - ADICIONADO
        
        // ===== IDENTIFICAÇÃO DE PAR =====
        // Se é BUY, gerar novo pair_id
        // Se é SELL, usar pair_id existente (se houver)
        let pairId = pairIdInput;
        if (!pairId) {
            if (side.toLowerCase() === 'buy') {
                // Gerar novo pair_id para BUY
                const { v4: uuidv4 } = require('uuid');
                pairId = `PAIR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            } else if (side.toLowerCase() === 'sell') {
                // Para SELL, tentar encontrar BUY aberta
                const buyOrder = activeOrders.get('buy');
                if (buyOrder && buyOrder.pairId) {
                    // Tem BUY aberta - SEMPRE reusar seu pair_id para formar par
                    pairId = buyOrder.pairId;
                } else {
                    // Nenhuma BUY para parear, criar novo pair_id
                    pairId = `PAIR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
            }
        }
        
        // ===== VALIDAÇÃO RIGOROSA: UMA BUY E UMA SELL POR PAIR =====
        // Impedir colocar múltiplas ordens BUY ou SELL na mesma pair_id
        const pair = pairMapping.get(pairId);
        if (pair) {
            if (side.toLowerCase() === 'buy' && pair.buyOrder !== null) {
                log('ERROR', `Tentativa de colocar segundo BUY na pair ${pairId}. Bloqueando para manter 1 BUY + 1 SELL por pair.`);
                return;
            }
            if (side.toLowerCase() === 'sell' && pair.sellOrder !== null) {
                log('ERROR', `Tentativa de colocar segundo SELL na pair ${pairId}. Bloqueando para manter 1 BUY + 1 SELL por pair.`);
                return;
            }
        }
        
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
        
        // Salvar no mapa de ordens ativas
        activeOrders.set(side, {
            id: orderId,
            side,
            price,
            qty,
            status: 'open',
            cyclePlaced: cycleCount,
            timestamp: Date.now(),
            feeRate: feeRate,
            pairId: pairId,  // NOVO: identificador do par
            external_id: orderId
        });
        
        // Registrar no mapa de pares
        if (!pairMapping.has(pairId)) {
            pairMapping.set(pairId, { buyOrder: null, sellOrder: null });
        }
        const newPair = pairMapping.get(pairId);
        if (side.toLowerCase() === 'buy') {
            newPair.buyOrder = { id: orderId, price, qty, timestamp: Date.now() };
        } else {
            newPair.sellOrder = { id: orderId, price, qty, timestamp: Date.now() };
        }
        
        stats.totalOrders++;
        
        // Salvar no BD com pair_id
        const orderWithPairId = { ...activeOrders.get(side), pairId, external_id: orderId };
        await db.saveOrderSafe(orderWithPairId, `market_making_${side}`, sessionId);
        
        log('SUCCESS', `Ordem ${side.toUpperCase()} ${orderId} colocada @ R$${price.toFixed(2)}, Qty: ${qty.toFixed(8)}, Pair: ${pairId.substring(0, 20)}..., Taxa Estimada: ${(feeRate * 100).toFixed(2)}%`);
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

// ============= ESTRATÉGIA ADAPTATIVA =============
/**
 * Aplica ajustes adaptativos de parâmetros conforme tendência
 * ALTA: Acumula BTC (spread estreito, viés +, max_position alto)
 * BAIXA: Protege BRL (spread largo, viés -, max_position baixo)
 */
function applyAdaptiveStrategy(trend, confidence = 0.5) {
    if (!ADAPTIVE_STRATEGY_ENABLED) return;
    
    const now = Date.now();
    if ((now - lastAdaptiveUpdate) < 5000) return; // Atualizar máximo a cada 5s
    lastAdaptiveUpdate = now;
    
    try {
        const params = AdaptiveStrategy.getAdaptiveParameters(trend, confidence);
        adaptiveParams = params;
        
        // Aplicar parâmetros adaptativos
        currentSpreadPct = params.spread;
        currentBaseSize = params.orderSize;
        currentMaxPosition = params.maxPosition;
        currentStopLoss = params.stopLoss;
        
        const ratio = AdaptiveStrategy.getAdaptiveOrderRatio(trend);
        
        log('INFO', AdaptiveStrategy.logAdaptiveStrategy(trend, params, ratio));
        
    } catch (e) {
        log('WARN', `Erro ao aplicar estratégia adaptativa: ${e.message}`);
    }
}

// ============= FIM ESTRATÉGIA ADAPTATIVA =============

// ---------------- CHECK ORDERS ----------------
async function checkOrders(mid, volatility, pred, orderbook, sellSignal) {
    const now = Date.now();
    const dynamicStopLoss = STOP_LOSS_PCT * (1 + volatility / 120);
    const dynamicTakeProfit = TAKE_PROFIT_PCT * (1 - Math.min(0.5, volatility / 120));
    for (const [key, order] of activeOrders.entries()) {
        const age = cycleCount - (order.cyclePlaced || cycleCount);
        // IMPORTANTE: Para recargas do BD, usar loadTimestamp (quando foi recarregada)
        // Para ordens novas, usar timestamp (quando foi colocada)
        // Se loadTimestamp existe, usa ele (ordem recarregada); senão usa timestamp (ordem nova)
        const effectiveTimestamp = order.loadTimestamp || (order.timestamp < 1e11 ? order.timestamp * 1000 : order.timestamp);
        const timeAge = (now - effectiveTimestamp) / 1000;
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
        // SISTEMA SIMPLIFICADO: Cancelar APENAS por IDADE
        // A lógica de drift/stuck foi removida porque causava churn desnecessário
        // em mercados dinâmicos com spreads que mudam a cada ciclo
        // O bot irá aguardar MAX_ORDER_AGE (20 minutos) antes de cancelar qualquer ordem
        const isStuck = false; // Desabilitado - não há "stuck" real, apenas mercado dinâmico
        
        if (timeAge > MAX_ORDER_AGE) {
            await tryCancel(key);
            log('INFO', `Ordem ${key.toUpperCase()} cancelada por idade (${timeAge.toFixed(1)}s > ${MAX_ORDER_AGE}s).`);
            continue;
        }
        // NOTA: Reprecificação automática por drift removida
        // Razão: Duplicava a lógica de stuck detection acima
        // As ordens serão apenas canceladas se VERDADEIRAMENTE stuck (muita idade)
        // Isso evita churn desnecessário e deixa o mercado trabalhar
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

        // ===== SINCRONIZAÇÃO COM BANCO DE DADOS =====
        // Recarregar ordens abertas para manter activeOrders atualizado
        try {
            const openOrders = await db.getOrders({ status: 'open' });
            activeOrders.clear();
            pairMapping.clear(); // Reconstruir mapa de pares
            
            // Contar ordens por tipo e carregar a mais recente de cada
            let buyOrders = openOrders.filter(o => o.side.toLowerCase() === 'buy');
            let sellOrders = openOrders.filter(o => o.side.toLowerCase() === 'sell');
            
            // Carregar a BUY mais recente
            if (buyOrders.length > 0) {
                const latestBuy = buyOrders[0]; // getOrders retorna ordenado por timestamp DESC
                activeOrders.set('buy', {
                    id: latestBuy.id,
                    side: 'buy',
                    price: parseFloat(latestBuy.price),
                    qty: parseFloat(latestBuy.qty),
                    timestamp: latestBuy.timestamp,
                    loadTimestamp: Date.now(), // ← NOVO: marca quando foi recarregada
                    cyclePlaced: cycleCount - 1,
                    count: buyOrders.length,
                    pairId: latestBuy.pair_id // NOVO: carregar pair_id
                });
            }
            
            // Carregar a SELL mais recente
            if (sellOrders.length > 0) {
                const latestSell = sellOrders[0];
                activeOrders.set('sell', {
                    id: latestSell.id,
                    side: 'sell',
                    price: parseFloat(latestSell.price),
                    qty: parseFloat(latestSell.qty),
                    timestamp: latestSell.timestamp,
                    loadTimestamp: Date.now(), // ← NOVO: marca quando foi recarregada
                    cyclePlaced: cycleCount - 1,
                    count: sellOrders.length,
                    pairId: latestSell.pair_id // NOVO: carregar pair_id
                });
            }
            
            // Reconstruir mapa de pares a partir das ordens abertas
            for (const order of openOrders) {
                const pairId = order.pair_id;
                if (pairId) {
                    if (!pairMapping.has(pairId)) {
                        pairMapping.set(pairId, { buyOrder: null, sellOrder: null });
                    }
                    const pair = pairMapping.get(pairId);
                    if (order.side.toLowerCase() === 'buy') {
                        pair.buyOrder = { id: order.id, price: order.price, qty: order.qty, status: order.status };
                    } else {
                        pair.sellOrder = { id: order.id, price: order.price, qty: order.qty, status: order.status };
                    }
                } else {
                    log('WARN', `[SYNC] Ordem aberta ${order.id} (${order.side}) não tem pair_id! Pulando...`);
                }
            }
            
            if (openOrders.length > 0) {
                log('DEBUG', `Sincronização: Carregadas ${openOrders.length} ordens da BD (BUY: ${buyOrders.length}✓, SELL: ${sellOrders.length}✓). Pares no mapa: ${pairMapping.size}`);

            }
        } catch (e) {
            log('WARN', `Erro ao sincronizar ordens com BD: ${e.message}`);
        }

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
        if (priceHistory.length > 100) priceHistory.shift();

        // ===== MOMENTUM VALIDATION REMOVIDO (2025-01-21) =====
        // Momentum validation desativado - usar Cash Management Strategy em seu lugar

        // NOTA: Swing trading removido (desativado por redundância com CashManagement)

        // Calcular indicadores básicos
        const pred = fetchPricePrediction(mid, orderbook);
        marketTrend = pred.trend;

        // ===== NOVOS MÓDULOS DE ANÁLISE E OTIMIZAÇÃO =====
        const marketData = {
            rsi: pred.rsi,
            emaShort: pred.emaShort,
            emaLong: pred.emaLong,
            macd: pred.macd,
            signal: pred.signal,
            volatility: pred.volatility,
            trend: pred.trend,
            midPrice: mid,
            spread: spreadPct / 100,
            adx: calculateADX(priceHistory), // Supondo que calculateADX exista
            orderbook: { imbalance: calculateOrderbookImbalance(orderbook) } // Supondo que calculateOrderbookImbalance exista
        };

        // 1. Otimizador automático de parâmetros
        if (cycleCount > 1 && cycleCount % 20 === 0 && autoOptimizer) { // A cada 20 ciclos, exceto o primeiro
            log('INFO', '[OPTIMIZER] Iniciando ciclo de otimização de parâmetros.');
            const recentOrders = await db.getOrders({ limit: 50 });
            const optimizationResult = autoOptimizer.optimizeParameters(stats, recentOrders, marketData);
            if (optimizationResult.adjustmentsMade) {
                log('SUCCESS', `[OPTIMIZER] Parâmetros ajustados: ${JSON.stringify(optimizationResult.params)}`);
                // Aplicar novos parâmetros (exemplo, pode ser necessário ajustar as variáveis globais)
                SPREAD_PCT = optimizationResult.params.spreadPct || SPREAD_PCT;
                ORDER_SIZE = optimizationResult.params.orderSize || ORDER_SIZE;
                STOP_LOSS_PCT = optimizationResult.params.stopLoss || STOP_LOSS_PCT;
            } else {
                log('INFO', '[OPTIMIZER] Nenhuma otimização necessária neste ciclo.');
            }
        }

        // 2. Analisador de perdas (analisa ordens preenchidas recentemente)
        if (lossAnalyzer) {
            try {
                const recentFilledOrders = await db.getOrders({ status: 'filled', limit: 10 });
                for (const order of recentFilledOrders) {
                    if (order.pnl && order.pnl < 0) {
                        lossAnalyzer.analyzeOrder(order, marketData);
                    }
                }
            } catch (e) {
                log('WARN', `[ANALYZER] Erro ao analisar perdas: ${e.message}`);
            }
            if (cycleCount > 1 && cycleCount % 50 === 0) { // A cada 50 ciclos
                log('INFO', '[ANALYZER] Gerando relatório de perdas...');
                try {
                    console.log(lossAnalyzer.generateReport());
                } catch (e) {
                    log('WARN', `[ANALYZER] Erro ao gerar relatório: ${e.message}`);
                }
            }
        }

        // 3. Lógica de entrada/saída melhorada
        let buySignal = { shouldEnter: false, score: 0, reasons: [] };
        let sellSignal = { shouldExit: false, score: 0, reasons: [] };
        if (improvedEntryExit) {
            buySignal = improvedEntryExit.shouldEnter(marketData);
            
            // Simula uma posição aberta se houver uma ordem de compra ativa
            const openBuyOrder = activeOrders.get('buy');
            if (openBuyOrder) {
                // A lógica de saída deve considerar a posição real, aqui simulada pela ordem
                const pseudoPosition = { entryPrice: openBuyOrder.price, qty: openBuyOrder.qty, timestamp: openBuyOrder.timestamp };
                sellSignal = improvedEntryExit.shouldExit(pseudoPosition, marketData);
            }
        }
        // =====================================================

        // Gerenciar ordens ativas (lógica de cancelamento, stop-loss, etc.)
        await checkOrders(mid, pred.volatility, pred, orderbook, sellSignal);

        // Verificar saldos
        let balances;
        try {
            balances = SIMULATE ? [{symbol: 'BRL', available: '10000'}, { symbol: 'BTC', available: '0.1' }] : await MB.getBalances();
        } catch (e) {
            log('ERROR', `Falha ao buscar saldos: ${e.message}.`, e);
            return; // Pula o ciclo se não conseguir buscar saldos
        }
        const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
        const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);

        // ===== ATUALIZAR CASH MANAGEMENT STRATEGY =====
        if (cashManagementStrategy) {
            cashManagementStrategy.updatePrice(mid);
        }

        // ===== EXECUTAR LÓGICA DE CASH MANAGEMENT (Estratégia ativa se USE_CASH_MANAGEMENT=true) =====
        if (cashManagementStrategy && process.env.USE_CASH_MANAGEMENT === 'true') {
            log('DEBUG', `[CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...`);

            // Buscar último preço de compra do histórico para melhor decisão
            const recentBuyOrders = Array.from(activeOrders.values()).filter(o => o.side === 'buy');
            const lastBuyPrice = recentBuyOrders.length > 0 ? 
                Math.min(...recentBuyOrders.map(o => o.price)) : 
                null;

            const sellSignalCash = cashManagementStrategy.shouldSell(mid, btcBalance, pred.trend, lastBuyPrice);

            // SELL-first: permite uma venda inicial mesmo sem BUY quando alinhado com a estratégia
            if ((SELL_FIRST_ENABLED || sellSignalCash.shouldSell) && !sellFirstExecuted && !activeOrders.has('sell') && !activeOrders.has('buy') && btcBalance > MIN_ORDER_SIZE) {
                const sellQty = Math.min(btcBalance, btcBalance * (sellSignalCash.qty || cashManagementStrategy.SELL_AMOUNT_PCT));
                log('WARN', `[SELL_FIRST] SELL inicial habilitado. Vendendo ${sellQty.toFixed(8)} BTC a R$ ${mid.toFixed(2)}${sellSignalCash.reason ? ` | ${sellSignalCash.reason}` : ''}`);
                await placeOrder('sell', mid, sellQty);
                stats.sells = (stats.sells || 0) + 1;
                sellFirstExecuted = true;
            }
            
            // Verificar sinal de COMPRA
            const buySignalCash = cashManagementStrategy.shouldBuy(mid, brlBalance, btcBalance, pred.trend);
            if (buySignalCash.shouldBuy && !activeOrders.has('buy')) {
                const buyQty = Math.min(0.0002, (brlBalance * buySignalCash.qty) / mid);
                if (buyQty > MIN_ORDER_SIZE && brlBalance >= buyQty * mid) {
                    log('SUCCESS', `[CASH_MGT_BUY] ${buySignalCash.reason}`);
                    await placeOrder('buy', mid, buyQty);
                    log('SUCCESS', `[CASH_MGT_BUY] Ordem de compra colocada: ${buyQty.toFixed(8)} BTC a R$ ${mid.toFixed(2)}`);
                    stats.buys = (stats.buys || 0) + 1;
                }
            }
            
            // Verificar sinal de VENDA
            if (sellSignalCash.shouldSell && !activeOrders.has('sell')) {
                const sellQty = Math.min(btcBalance, btcBalance * sellSignalCash.qty);
                if (sellQty > MIN_ORDER_SIZE) {
                    log('SUCCESS', `[CASH_MGT_SELL] ${sellSignalCash.reason}`);
                    await placeOrder('sell', mid, sellQty);
                    log('SUCCESS', `[CASH_MGT_SELL] Ordem de venda colocada: ${sellQty.toFixed(8)} BTC a R$ ${mid.toFixed(2)}`);
                    stats.sells = (stats.sells || 0) + 1;
                }
            }
            
            // Micro-trades
            const microTradeSignals = cashManagementStrategy.shouldMicroTrade(cycleCount, mid, btcBalance, brlBalance);
            if (microTradeSignals.buy && !activeOrders.has('buy')) {
                const microBuyQty = Math.min(0.00006, (brlBalance * microTradeSignals.buy.qty) / mid);
                if (microBuyQty > MIN_ORDER_SIZE) {
                    log('INFO', `[CASH_MGT_MICRO] ${microTradeSignals.buy.reason}`);
                    await placeOrder('buy', mid, microBuyQty);
                }
            }
            if (microTradeSignals.sell && !activeOrders.has('sell') && btcBalance > 0.00001) {
                const microSellQty = btcBalance * microTradeSignals.sell.qty;
                if (microSellQty > MIN_ORDER_SIZE) {
                    log('INFO', `[CASH_MGT_MICRO] ${microTradeSignals.sell.reason}`);
                    await placeOrder('sell', mid, microSellQty);
                }
            }
        } else {
            // ===== LÓGICA PADRÃO DE ENTRADA/SAÍDA (FALLBACK quando cash management desativado) =====
            if (buySignal.shouldEnter && !activeOrders.has('buy')) {
                const { isValid, errors } = improvedEntryExit.validateOrderPlacement('buy', bestBid, marketData);
                if (isValid) {
                    const positionSizeBRL = improvedEntryExit.calculatePositionSize(brlBalance, pred.volatility, buySignal.confidence);
                    const buyQty = positionSizeBRL / bestBid;
                    
                    if (buyQty >= MIN_ORDER_SIZE && positionSizeBRL <= brlBalance) {
                        log('SUCCESS', `[ENTRY/EXIT] Sinal de COMPRA forte (Score: ${buySignal.score.toFixed(2)}). Razões: ${buySignal.reasons.join(', ')}`);
                        await placeOrder('buy', bestBid, buyQty);
                    } else {
                        log('WARN', `[ENTRY/EXIT] Compra ignorada. Qtd: ${buyQty.toFixed(8)} (min: ${MIN_ORDER_SIZE}) ou Saldo BRL insuficiente.`);
                    }
                } else {
                    log('WARN', `[ENTRY/EXIT] Compra bloqueada por validação: ${errors.join(', ')}`);
                }
            }

            if (sellSignal.shouldExit) {
                const openPositionOrder = activeOrders.get('buy');
                if (openPositionOrder) {
                    log('SUCCESS', `[ENTRY/EXIT] Sinal de SAÍDA forte (Score: ${sellSignal.score.toFixed(2)}). Razões: ${sellSignal.reasons.join(', ')}`);
                    await tryCancel('buy');
                    const sellQty = openPositionOrder.qty;
                    if (sellQty >= MIN_ORDER_SIZE && sellQty <= btcBalance) {
                        await placeOrder('sell', bestAsk, sellQty);
                    } else {
                        log('WARN', `[ENTRY/EXIT] Venda de saída ignorada. Qtd: ${sellQty.toFixed(8)} (min: ${MIN_ORDER_SIZE}) ou Saldo BTC insuficiente.`);
                    }
                }
            }
        }  // Fim do else (lógica fallback quando cash management desativado)

        // Atualiza o timestamp do ciclo para a próxima iteração
        lastCycleTimestamp = Date.now();

        // Imprimir dashboard do ciclo (função não definida, comentada)
        // printCycleDashboard(mid, spreadPct, pred, brlBalance, btcBalance);
    } catch (e) {
        log('ERROR', `Erro fatal no ciclo ${cycleCount}: ${e.message}`);
        if (e.stack) console.error(e.stack);
    }
}

// ============ RELATÓRIO DE PARES ============
async function getPairReport() {
    /**
     * Retorna um relatório detalhado dos pares BUY/SELL
     * Exibe: pair_id, status de preenchimento, spread, duração, etc
     */
    const report = {
        timestamp: new Date().toISOString(),
        totalPairs: pairMapping.size,
        completePairs: 0,
        incompletePairs: 0,
        pairs: []
    };
    
    for (const [pairId, pair] of pairMapping.entries()) {
        const hasBuy = pair.buyOrder !== null;
        const hasSell = pair.sellOrder !== null;
        const isComplete = hasBuy && hasSell;
        
        if (isComplete) report.completePairs++;
        else report.incompletePairs++;
        
        let spread = 0, roi = 0;
        if (hasBuy && hasSell) {
            spread = ((pair.sellOrder.price - pair.buyOrder.price) / pair.buyOrder.price) * 100;
            roi = spread - (FEE_RATE_MAKER * 2 * 100); // Descontar fees de maker em ambas as ordens
        }
        
        const pairStatus = {
            pairId: pairId.substring(0, 30), // Truncar para exibição
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
        };
        
        report.pairs.push(pairStatus);
    }
    
    return report;
}

// ============ EXPORTAR PARA FRONTEND ============
// Adicionar função ao módulo para exposição via HTTP
module.exports = {
    getPairReport: getPairReport,
    pairMapping: pairMapping
};

// ---------------- MAIN ----------------
async function main() {
    log('INFO', '================================================');
    log('INFO', '=        MB BOT - INICIANDO EXECUÇÃO           =');
    log('INFO', '================================================');
    
    // Carregar configurações e inicializar banco de dados
    await db.init();
    // await loadConfigFromDB(); // Usar configurações do .env

    // Autenticar no modo LIVE antes de iniciar ciclos
    if (!SIMULATE) {
        try {
            await MB.authenticate();
            log('SUCCESS', '[AUTH] Autenticação LIVE concluída.');
        } catch (e) {
            log('ERROR', `[AUTH] Falha na autenticação LIVE: ${e.message}`);
            process.exit(1);
        }
    }
    
    // Inicializar módulos
    if (ADAPTIVE_STRATEGY_ENABLED) {
        // Adaptivemanager seria inicializado aqui se disponível
        log('INFO', '[ADAPTIVE] Sistema adaptativo está ativado.');
    }

    // Inicializar novos módulos
    autoOptimizer = new AutoOptimizer(db);
    lossAnalyzer = new LossAnalyzer();
    improvedEntryExit = new ImprovedEntryExit();
    cashManagementStrategy = new CashManagementStrategy();
    
    log('SUCCESS', '[CASH_MANAGEMENT] Estratégia de gerenciamento de caixa inicializada (PRIMÁRIA).');
    log('SUCCESS', '[CORE] Módulos de Otimização, Análise de Perda e Entrada/Saída inicializados.');


    // Carregar histórico de preenchimentos
    await db.loadHistoricalFills();
    
    // Limpar ordens antigas se necessário
    if (process.argv.includes('--clean')) {
        await cleanAndSyncOrders();
    }
    
    // Iniciar ciclo principal
    log('SUCCESS', `Bot iniciado em modo ${SIMULATE ? 'SIMULAÇÃO' : 'PRODUÇÃO'}. Ciclo a cada ${CYCLE_SEC}s.`);
    setInterval(runCycle, CYCLE_SEC * 1000);
    runCycle(); // Executa imediatamente na primeira vez
}

// ================== EXECUÇÃO PRINCIPAL ==================
main().catch(err => {
    console.error('[FATAL] Erro ao iniciar o bot:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});