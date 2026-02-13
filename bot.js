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
const path = require('path');
const db = require('./db');
const MB = require('./mb_client');
const ConfidenceSystem = require('./confidence_system');
const CashManagementStrategy = require('./cash_management_strategy_v2');


// ================== INSTÂNCIAS GLOBAIS ==================
// MomentumSync removido (2025-01-21)
// const momentumSync = new MomentumSync();
let autoOptimizer = null;
let lossAnalyzer = null;
let improvedEntryExit = null;
let cashManagementStrategy = null; // Estratégia de gerenciamento de caixa - PRIMÁRIA
const orderLoadTimestamps = new Map(); // Armazena loadTimestamp de cada ordem para não resetar

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
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '86400'); // Máximo 86400s (1 dia) antes de cancelar - tempo generoso para preenchimento
const MIN_REPRICE_AGE_SEC = parseInt(process.env.MIN_REPRICE_AGE_SEC || '86400'); // Aguardar 24h antes de repricing
const BUY_REPRICE_AGE_SEC = parseInt(process.env.BUY_REPRICE_AGE_SEC || '900'); // 15 min para recolocar BUY
const MIN_VOLATILITY_PCT = parseFloat(process.env.MIN_VOLATILITY_PCT || '0.1'); // Limitado a 0.1% mínimo para evitar pular ciclos
const MAX_VOLATILITY_PCT = parseFloat(process.env.MAX_VOLATILITY_PCT || '2.5'); // Limitado a 2.5% máximo para evitar excessos
const VOL_LIMIT_PCT = parseFloat(process.env.VOL_LIMIT_PCT || '1.5'); // 1.5% volume para filtrar
const EXPECTED_PROFIT_THRESHOLD = parseFloat(process.env.EXPECTED_PROFIT_THRESHOLD || '-0.0005'); // Negativo = coloca ordem mesmo com pequena perda esperada
const HISTORICAL_FILLS_WINDOW = parseInt(process.env.HISTORICAL_FILLS_WINDOW || '20'); // Últimos 20 fills
const RECENT_WEIGHT_FACTOR = parseFloat(process.env.RECENT_WEIGHT_FACTOR || '0.7'); // Peso decrescente
const ALERT_PNL_THRESHOLD = parseFloat(process.env.ALERT_PNL_THRESHOLD || '-50'); // Alerta se PnL < -50 BRL
const ALERT_ROI_THRESHOLD = parseFloat(process.env.ALERT_ROI_THRESHOLD || '-5'); // Alerta se ROI < -5%
const EXTERNAL_TREND_TIGHTEN_MAX = parseFloat(process.env.EXTERNAL_TREND_TIGHTEN_MAX || '0.35');
const EXTERNAL_TREND_WIDEN_MAX = parseFloat(process.env.EXTERNAL_TREND_WIDEN_MAX || '0.20');
const EXTERNAL_TREND_DIVERGENCE_CONF = parseFloat(process.env.EXTERNAL_TREND_DIVERGENCE_CONF || '0.60');
const EXTERNAL_TREND_VOLATILITY_DAMP = parseFloat(process.env.EXTERNAL_TREND_VOLATILITY_DAMP || '0.50');
const EXTERNAL_TREND_WEIGHT_BINANCE = parseFloat(process.env.EXTERNAL_TREND_WEIGHT_BINANCE || '1.0');
const EXTERNAL_TREND_WEIGHT_COINGECKO = parseFloat(process.env.EXTERNAL_TREND_WEIGHT_COINGECKO || '0.7');
const EXTERNAL_TREND_WEIGHT_COINBASE = parseFloat(process.env.EXTERNAL_TREND_WEIGHT_COINBASE || '0.7');
const EXTERNAL_TREND_WEIGHT_KRAKEN = parseFloat(process.env.EXTERNAL_TREND_WEIGHT_KRAKEN || '0.7');
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
const RESET_INITIAL_BALANCE_ON_START = process.env.RESET_INITIAL_BALANCE_ON_START === 'true';

// -------- LIMITE DE PARES (DINÂMICO) --------
const MAX_CONCURRENT_PAIRS = parseInt(process.env.MAX_CONCURRENT_PAIRS || '10');     // Máx pares simultâneos abertos
const MAX_ACTIVE_BUYS = parseInt(process.env.MAX_ACTIVE_BUYS || '5');                // Máx BUYs simultâneas
const MAX_PAIRS_PER_CYCLE = parseInt(process.env.MAX_PAIRS_PER_CYCLE || '1');        // Máx novos pares por ciclo
const MIN_FILL_RATE_FOR_NEW = parseFloat(process.env.MIN_FILL_RATE_FOR_NEW || '30'); // Mínimo 30% taxa preenchimento
const PAIRS_THROTTLE_CYCLES = parseInt(process.env.PAIRS_THROTTLE_CYCLES || '5');    // Mínimo ciclos entre novos pares
let lastNewPairCycle = -PAIRS_THROTTLE_CYCLES; // Allowing immediate pair creation
let pairsCreatedThisCycle = 0; // Counter para pares criados no ciclo atual

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

if (RESET_INITIAL_BALANCE_ON_START) {
    try {
        const initialBalanceFile = path.join(__dirname, '.initial_balance.json');
        if (fs.existsSync(initialBalanceFile)) {
            fs.unlinkSync(initialBalanceFile);
        }
        log('INFO', 'RESET_INITIAL_BALANCE_ON_START ativo. Base inicial sera recapturada no primeiro ciclo.');
    } catch (e) {
        log('WARN', `Falha ao resetar .initial_balance.json: ${e.message}`);
    }
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
let initialBRLBalance = null;  // ✅ Registra saldo inicial em BRL
let initialBTCBalance = null;  // ✅ Registra saldo inicial em BTC
let initialBalanceCaptureCycle = -1;  // ✅ Marca quando foi capturado
let priceHistory = [];
let historicalFills = [];
let performanceHistory = [];
let testPhase = true;
let pairMapping = new Map(); // Mapeia pair_id -> {buyOrder, sellOrder}
let confidenceSystem = new ConfidenceSystem();
let adaptiveManager = null; // Será inicializado no startBot
let lastExternalCheck = 0;
let externalTrendData = null;
const EXTERNAL_TREND_FILE = path.join(__dirname, '.external_trend.json');
let currentSpreadPct = MIN_SPREAD_PCT;
let currentBaseSize = ORDER_SIZE;
let currentMaxPosition = MAX_POSITION;
let currentStopLoss = STOP_LOSS_PCT;
// módulos não disponíveis removidos

function getActiveOrdersBySide(side) {
    return Array.from(activeOrders.values()).filter(order => order.side === side);
}

function getActiveOrderCount(side) {
    return getActiveOrdersBySide(side).length;
}

function hasActiveOrder(side) {
    return getActiveOrderCount(side) > 0;
}

function getOldestActiveOrder(side) {
    const orders = getActiveOrdersBySide(side);
    if (orders.length === 0) return null;
    orders.sort((a, b) => {
        const tsA = a.loadTimestamp || a.timestamp || 0;
        const tsB = b.loadTimestamp || b.timestamp || 0;
        return tsA - tsB;
    });
    return orders[0];
}

function getAvailablePairIdForSell() {
    let selected = null;
    let selectedTs = Infinity;
    for (const [pairId, pair] of pairMapping.entries()) {
        if (pair.buyOrder && !pair.sellOrder) {
            const ts = pair.buyOrder.timestamp || 0;
            if (ts < selectedTs) {
                selectedTs = ts;
                selected = pairId;
            }
        }
    }
    return selected;
}

async function hasFilledBuyForPair(pairId) {
    if (!pairId) return false;
    try {
        const filledOrders = await db.getOrders({ status: 'filled', limit: 2000 });
        return filledOrders.some(order => order.pair_id === pairId && order.side === 'buy');
    } catch (e) {
        log('WARN', `Falha ao verificar BUY preenchida para pair ${pairId.substring(0, 20)}...: ${e.message}`);
        return false;
    }
}

// ========== MÉTRICAS PARA CONTROLE DINÂMICO ==========
let totalPairsCreated = 0;  // Total histórico de pares criados
let totalPairsCompleted = 0; // Total histórico de pares completados
let pairsCompletedThisCycle = 0; // Pares que terminaram neste ciclo
let sellFirstExecuted = false;
let cycleSinceSellFirst = 0; // Contador: quantos ciclos desde SELL_FIRST. Se > 3 e sem BUY, força BUY

let stats = {
    cycles: 0,
    totalOrders: 0,
    filledOrders: 0,
    cancels: 0,
    totalPnL: 0.0,
    avgFillPrice: 0.0,
    fillRate: '0.0%',
    avgSpread: SPREAD_PCT * 100,
    uptime: '0min',
    initialBRL: 0.0,     // ✅ Saldo inicial em BRL
    initialBTC: 0.0,     // ✅ Saldo inicial em BTC
    initialCapital: 0.0  // ✅ Capital inicial total em BRL
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
async function fetchBinanceTrend() {
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24';
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    if (!Array.isArray(data) || data.length < 2) {
        throw new Error('Dados insuficientes da Binance');
    }
    const firstOpen = parseFloat(data[0][1]);
    const lastClose = parseFloat(data[data.length - 1][4]);
    if (!firstOpen || !lastClose) {
        throw new Error('Dados invalidos da Binance');
    }
    const changePct = ((lastClose - firstOpen) / firstOpen) * 100;
    return { changePct };
}

async function fetchCoinGeckoTrend() {
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false';
    const response = await axios.get(url, { timeout: 10000 });
    const changePct = response.data?.market_data?.price_change_percentage_24h;
    if (typeof changePct !== 'number') {
        throw new Error('Dados insuficientes do CoinGecko');
    }
    return { changePct };
}

async function fetchCoinbaseTrend() {
    const url = 'https://api.exchange.coinbase.com/products/BTC-USD/stats';
    const response = await axios.get(url, { timeout: 10000 });
    const open = parseFloat(response.data?.open || response.data?.open_price);
    const last = parseFloat(response.data?.last || response.data?.last_price);
    if (!open || !last) {
        throw new Error('Dados insuficientes da Coinbase');
    }
    const changePct = ((last - open) / open) * 100;
    return { changePct };
}

async function fetchKrakenTrend() {
    const url = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';
    const response = await axios.get(url, { timeout: 10000 });
    const result = response.data?.result;
    const pairKey = result ? Object.keys(result)[0] : null;
    const stats = pairKey ? result[pairKey] : null;
    const open = parseFloat(stats?.o?.[0]);
    const last = parseFloat(stats?.c?.[0]);
    if (!open || !last) {
        throw new Error('Dados insuficientes da Kraken');
    }
    const changePct = ((last - open) / open) * 100;
    return { changePct };
}

function getTrendSpreadFactors(trend, confidence) {
    const normalizedTrend = trend || 'neutral';
    const normalizedConfidence = Math.max(0, Math.min(1, confidence || 0));
    const tightenMax = EXTERNAL_TREND_TIGHTEN_MAX;
    const widenMax = EXTERNAL_TREND_WIDEN_MAX;

    let buyFactor = 1.0;
    let sellFactor = 1.0;

    if (normalizedTrend === 'up') {
        buyFactor = 1 - (tightenMax * normalizedConfidence);
        sellFactor = 1 + (widenMax * normalizedConfidence);
    } else if (normalizedTrend === 'down') {
        buyFactor = 1 + (widenMax * normalizedConfidence);
        sellFactor = 1 - (tightenMax * normalizedConfidence);
    }

    buyFactor = Math.min(1.5, Math.max(0.5, buyFactor));
    sellFactor = Math.min(1.5, Math.max(0.5, sellFactor));

    return { buyFactor, sellFactor };
}

function getExternalSpreadFactors(externalTrend, fallbackTrend, fallbackConfidence, volatilityPct) {
    const hasExternal = !!(externalTrend && !externalTrend.error);
    const externalTrendValue = externalTrend?.trend || 'neutral';
    const externalConfidenceValue = externalTrend?.confidence ?? 0;
    const internalTrendValue = fallbackTrend || 'neutral';
    const internalConfidenceValue = fallbackConfidence ?? 0;

    const isDivergent = hasExternal && internalTrendValue !== 'neutral' && externalTrendValue !== 'neutral'
        && internalTrendValue !== externalTrendValue;
    const shouldFallback = isDivergent
        && externalConfidenceValue >= EXTERNAL_TREND_DIVERGENCE_CONF
        && internalConfidenceValue >= EXTERNAL_TREND_DIVERGENCE_CONF;

    const trend = shouldFallback ? internalTrendValue : (hasExternal ? externalTrendValue : internalTrendValue);
    const confidence = shouldFallback ? internalConfidenceValue : (hasExternal ? externalConfidenceValue : internalConfidenceValue);
    const source = shouldFallback || !hasExternal ? 'bot' : 'external';

    const baseFactors = getTrendSpreadFactors(trend, confidence);
    const volRatio = VOL_LIMIT_PCT > 0 ? Math.min(Math.max(volatilityPct || 0, 0) / VOL_LIMIT_PCT, 1) : 0;
    const damp = Math.min(Math.max(EXTERNAL_TREND_VOLATILITY_DAMP, 0), 1);
    const scale = Math.max(0.5, Math.min(1, 1 - (volRatio * damp)));
    const buyFactor = 1 + (baseFactors.buyFactor - 1) * scale;
    const sellFactor = 1 + (baseFactors.sellFactor - 1) * scale;

    return {
        buyFactor,
        sellFactor,
        trend,
        confidence,
        source,
        divergent: isDivergent,
        volatilityScale: scale
    };
}

async function checkExternalTrends() {
    const now = Date.now();
    // Verificar tendências externas a cada 10 minutos (600000ms), mas sempre na primeira vez
    const isFirstCheck = lastExternalCheck === 0;
    if (!isFirstCheck && now - lastExternalCheck < 600000) {
        return externalTrendData;
    }

    const sources = { binance: false, coinGecko: false, coinbase: false, kraken: false, fearGreed: false };
    const changes = [];
    const weightedChanges = [];
    const errors = [];

    try {
        const binance = await fetchBinanceTrend();
        sources.binance = true;
        changes.push(binance.changePct);
        weightedChanges.push({ value: binance.changePct, weight: EXTERNAL_TREND_WEIGHT_BINANCE });
    } catch (e) {
        errors.push(`Binance: ${e.message}`);
        log('DEBUG', `[EXTERNAL] Binance indisponivel: ${e.message}`);
    }

    try {
        const coinGecko = await fetchCoinGeckoTrend();
        sources.coinGecko = true;
        changes.push(coinGecko.changePct);
        weightedChanges.push({ value: coinGecko.changePct, weight: EXTERNAL_TREND_WEIGHT_COINGECKO });
    } catch (e) {
        errors.push(`CoinGecko: ${e.message}`);
        log('DEBUG', `[EXTERNAL] CoinGecko indisponivel: ${e.message}`);
    }

    try {
        const coinbase = await fetchCoinbaseTrend();
        sources.coinbase = true;
        changes.push(coinbase.changePct);
        weightedChanges.push({ value: coinbase.changePct, weight: EXTERNAL_TREND_WEIGHT_COINBASE });
    } catch (e) {
        errors.push(`Coinbase: ${e.message}`);
        log('DEBUG', `[EXTERNAL] Coinbase indisponivel: ${e.message}`);
    }

    try {
        const kraken = await fetchKrakenTrend();
        sources.kraken = true;
        changes.push(kraken.changePct);
        weightedChanges.push({ value: kraken.changePct, weight: EXTERNAL_TREND_WEIGHT_KRAKEN });
    } catch (e) {
        errors.push(`Kraken: ${e.message}`);
        log('DEBUG', `[EXTERNAL] Kraken indisponivel: ${e.message}`);
    }

    if (!changes.length) {
        const errorMessage = errors.length ? errors.join(' | ') : 'Fontes externas indisponiveis';
        externalTrendData = externalTrendData || {
            trend: 'neutral',
            score: 0,
            confidence: 0,
            sources: {}
        };
        externalTrendData = {
            ...externalTrendData,
            sources,
            timestamp: new Date().toISOString(),
            error: errorMessage
        };
        lastExternalCheck = now;
        try {
            fs.writeFileSync(EXTERNAL_TREND_FILE, JSON.stringify(externalTrendData), 'utf8');
        } catch (e) {
            log('WARN', `[EXTERNAL] Falha ao salvar tendencia externa: ${e.message}`);
        }
        return externalTrendData;
    }

    const totalWeight = weightedChanges.reduce((sum, entry) => sum + entry.weight, 0);
    const avgChangePct = totalWeight > 0
        ? weightedChanges.reduce((sum, entry) => sum + (entry.value * entry.weight), 0) / totalWeight
        : changes.reduce((sum, value) => sum + value, 0) / changes.length;
    const score = Math.max(-1, Math.min(1, avgChangePct / 1.5));
    const confidence = Math.min(1, Math.abs(score));
    const trend = score > 0.15 ? 'up' : score < -0.15 ? 'down' : 'neutral';

    externalTrendData = {
        trend,
        score: parseFloat(score.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(2)),
        sources,
        timestamp: new Date().toISOString()
    };

    lastExternalCheck = now;

    try {
        fs.writeFileSync(EXTERNAL_TREND_FILE, JSON.stringify(externalTrendData), 'utf8');
    } catch (e) {
        log('WARN', `[EXTERNAL] Falha ao salvar tendencia externa: ${e.message}`);
    }

    return externalTrendData;
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
    
    // Análise simplificada (módulo decisionEngine removido)
    // Permitir trade por padrão - market making sempre tenta colocar pares
    let shouldTrade = true;
    let reason = 'Market making operando normalmente';
    
    // Log simplificado
    const DEBUG = process.env.DEBUG === 'true';
    if (DEBUG) {
        log('INFO', `[DECISION] ✅ PERMITIDO | Confiança: ${(botConfidence * 100).toFixed(1)}%`);
    }
    
    // Verificar se a ação recomendada é compatível com o side solicitado
    // MARKET MAKING: Operamos SEMPRE para ambos os lados (BUY e SELL)
    // A lógica é: colocar pares BUY/SELL para manter spread tight e capturar lucro
    
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

// ✅ FIX CRÍTICO 2: Função de Repricing - Gerencia se ordens precisam ser recolocadas
async function managePrices(mid, volatility, spreadPct) {
    try {
        const spreadAmount = mid * spreadPct;
        const now = Date.now();

        for (const [key, order] of activeOrders.entries()) {
            if (!order || !order.timestamp) continue;

            // ✅ FIX: Converter timestamp se necessário (pode ser segundos ou milissegundos)
            const effectiveTimestamp = order.loadTimestamp || (order.timestamp < 1e11 ? order.timestamp * 1000 : order.timestamp);
            const ageMs = now - effectiveTimestamp;
            if (ageMs < MIN_REPRICE_AGE_SEC * 1000) {
                continue;
            }

            const orderMid = (order.side === 'buy') ? (mid - spreadAmount) : (mid + spreadAmount);
            const priceDiff = Math.abs(order.price - orderMid) / orderMid;

            // ✅ Recolocar APENAS se preço mudou mais que a volatilidade
            const volatilityThreshold = volatility / 100; // Converter % para decimal
            const shouldReprice = priceDiff > volatilityThreshold;

            if (shouldReprice) {
                log('INFO', `🔄 [REPRICING] ${order.side.toUpperCase()} ${order.id}: Preço mudou ${(priceDiff*100).toFixed(2)}% > Volatilidade ${volatility.toFixed(2)}%. Recolocando...`);
                
                try {
                    // ✅ FIX: Guardar pair_id antiga ANTES de cancelar
                    const oldPairId = order.pairId;
                    
                    await tryCancel(key);
                    activeOrders.delete(key);
                    
                    // ✅ FIX: LIMPAR REFERÊNCIA DE PAR ANTIGA DO pairMapping
                    if (oldPairId && pairMapping.has(oldPairId)) {
                        const pair = pairMapping.get(oldPairId);
                        if (order.side === 'buy') {
                            pair.buyOrder = null;
                        } else {
                            pair.sellOrder = null;
                        }
                        
                        // Se ambos nulos, remover par
                        if (!pair.buyOrder && !pair.sellOrder) {
                            pairMapping.delete(oldPairId);
                            log('DEBUG', `[REPRICING] Par órfã ${oldPairId.substring(0, 20)}... removida`);
                        }
                    }
                    
                    // Recolocar com novo preço
                    const newPrice = (order.side === 'buy') ? (mid - spreadAmount) : (mid + spreadAmount);
                    if (newPrice > 0 && order.qty > MIN_ORDER_SIZE) {
                        await placeOrder(order.side, newPrice, order.qty);
                        log('SUCCESS', `✅ [REPRICING] Ordem ${order.side.toUpperCase()} recolocada: ${order.qty.toFixed(8)} BTC @ R$${newPrice.toFixed(2)}`);
                    }
                } catch (e) {
                    log('WARN', `Erro ao fazer repricing de ${key}: ${e.message}`);
                }
            }
        }
    } catch (e) {
        log('WARN', `Erro em managePrices: ${e.message}`);
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
async function cancelPairOrder(filledSide, pairId = null) {
    /**
     * Quando uma ordem é preenchida, cancela a ordem par
     * Exemplo: Se BUY foi preenchida, cancela SELL
     */
    const pairSide = filledSide === 'buy' ? 'sell' : 'buy';
    const candidates = getActiveOrdersBySide(pairSide).filter(order => {
        if (!pairId) return true;
        return order.pairId === pairId;
    });

    if (candidates.length > 0) {
        const target = candidates[0];
        log('INFO', `[SYNC] Ordem ${filledSide.toUpperCase()} preenchida. Cancelando ${pairSide.toUpperCase()} par ${target.id}...`);
        await tryCancel(target.id);
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
    const buyCount = getActiveOrderCount('buy');
    const sellCount = getActiveOrderCount('sell');
    
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

// ============ VALIDAÇÃO DE INTEGRIDADE DE PARES ============
/**
 * Valida e loga o status de integridade de todos os pares
 * Retorna: { totalPairs: N, completePairs: N, incompletePairs: N, orphanedPairs: N }
 */
function validatePairIntegrity() {
    let completePairCount = 0;
    let incompletePairCount = 0;
    let orphanedPairs = [];
    
    for (const [pairId, pair] of pairMapping.entries()) {
        const hasBuy = !!pair.buyOrder;
        const hasSell = !!pair.sellOrder;
        
        if (hasBuy && hasSell) {
            completePairCount++;
        } else if (hasBuy || hasSell) {
            incompletePairCount++;
        } else {
            orphanedPairs.push(pairId);
        }
    }
    
    const result = {
        totalPairs: pairMapping.size,
        completePairs: completePairCount,
        incompletePairs: incompletePairCount,
        orphanedPairs: orphanedPairs.length
    };
    
    if (incompletePairCount > 0) {
        log('WARN', `[PAIR_CHECK] Pares Incompletas: ${incompletePairCount} (BUY sem SELL ou vice-versa)`);
        for (const [pairId, pair] of pairMapping.entries()) {
            if ((pair.buyOrder && !pair.sellOrder) || (!pair.buyOrder && pair.sellOrder)) {
                const side = pair.buyOrder ? 'BUY' : 'SELL';
                log('DEBUG', `  → ${pairId.substring(0, 20)}...: Só tem ${side}`);
            }
        }
    }
    
    if (orphanedPairs.length > 0) {
        log('ERROR', `[PAIR_CHECK] Pares Órfãs encontradas: ${orphanedPairs.length} (nenhum BUY/SELL)`);
        for (const pairId of orphanedPairs) {
            pairMapping.delete(pairId);
            log('DEBUG', `  → Removida: ${pairId.substring(0, 20)}...`);
        }
    }
    
    return result;
}

async function checkOrderStatus(orderKey, side, mid = null, spreadAmount = null, sessionId = null) {
    const order = activeOrders.get(orderKey);
    if (!order) return {status: 'unknown', filledQty: 0};
    const midPrice = mid || order.price;
    const spread = spreadAmount || (midPrice * SPREAD_PCT);
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
            
            // ✅ FIX CRÍTICO: Criar SELL pareada SINCRONAMENTE quando BUY é preenchida
            if (side === 'buy' && order.pairId) {
                // Preservar dados do BUY antes de deletar
                const buyOrderData = {
                    price: fillPrice,
                    qty: qty,
                    id: order.id,
                    pairId: order.pairId
                };
                // ✅ Criar SELL IMEDIATAMENTE com spread calculado
                const buyPrice = parseFloat(fillPrice);
                const minSellPrice = buyPrice * (1 + MIN_SPREAD_PCT);
                const targetSellPrice = Math.max(
                    (midPrice + spread) || midPrice,
                    minSellPrice
                );
                if (targetSellPrice > 0 && qty > 0) {
                    await placeOrder('sell', targetSellPrice, qty, null, order.pairId);
                    log('SUCCESS', `[AUTO_SELL] ✅ SELL pareada criada: ${qty.toFixed(8)} BTC @ R$${targetSellPrice.toFixed(2)} (Spread: ${(((targetSellPrice - buyPrice) / buyPrice) * 100).toFixed(2)}%)`);
                }
            }
            
            activeOrders.delete(orderKey);
            log('INFO', `Fill simulado ${side.toUpperCase()} ${order.id} @ R$${fillPrice.toFixed(2)}, Qty: ${qty.toFixed(8)}, PnL Total: ${totalPnL.toFixed(2)}, Taxa: ${(feeRate * 100).toFixed(2)}%`);
            
            // SINCRONIZAÇÃO: Opcionalmente cancelar a ordem par (apenas se ainda existir)
            // await cancelPairOrder(side);
            
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
                
                // BTC Accumulator removido
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
            
            // ✅ FIX CRÍTICO: Criar SELL pareada SINCRONAMENTE quando BUY é preenchida
            if (status.side === 'buy' && order.pairId) {
                // Preservar dados do BUY antes de deletar
                const buyOrderData = {
                    price: price,
                    qty: qty,
                    id: order.id,
                    pairId: order.pairId
                };
                // ✅ Criar SELL IMEDIATAMENTE com spread calculado
                const buyPrice = parseFloat(price);
                const minSellPrice = buyPrice * (1 + MIN_SPREAD_PCT);
                const targetSellPrice = Math.max(
                    (midPrice + spread) || midPrice,
                    minSellPrice
                );
                if (targetSellPrice > 0 && qty > 0) {
                    await placeOrder('sell', targetSellPrice, qty, null, order.pairId);
                    log('SUCCESS', `[AUTO_SELL] ✅ SELL pareada criada: ${qty.toFixed(8)} BTC @ R$${targetSellPrice.toFixed(2)} (Spread: ${(((targetSellPrice - buyPrice) / buyPrice) * 100).toFixed(2)}%)`);
                }
            }
            
            activeOrders.delete(orderKey);
            log('INFO', `Fill real ${status.side.toUpperCase()} ${order.id} @ R$${price.toFixed(2)}, Qty: ${qty.toFixed(8)}, PnL Total: ${totalPnL.toFixed(2)}, Taxa: ${(feeRate * 100).toFixed(2)}%`);
            
            // SINCRONIZAÇÃO: Opcionalmente cancelar a ordem par (apenas se ainda existir)
            // await cancelPairOrder(status.side);
            
            // ✅ FIX: LIMPAR REFERÊNCIA DE PAR PREENCHIDA DO pairMapping
            const pairId = order.pairId;
            if (pairId && pairMapping.has(pairId)) {
                const pair = pairMapping.get(pairId);
                if (status.side.toLowerCase() === 'buy') {
                    pair.buyOrder = null;
                    log('DEBUG', `[PAIRCLEAN] Limpado buyOrder da pair ${pairId.substring(0, 20)}...`);
                } else {
                    pair.sellOrder = null;
                    log('DEBUG', `[PAIRCLEAN] Limpado sellOrder da pair ${pairId.substring(0, 20)}...`);
                }
                
                // Se ambos nulos, remover par completamente
                if (!pair.buyOrder && !pair.sellOrder) {
                    pairMapping.delete(pairId);
                    log('DEBUG', `[PAIRCLEAN] Par ${pairId.substring(0, 20)}... removida (ambos preenchidos ou cancelados)`);
                }
            }
            
            return {status: 'filled', filledQty: qty};
        }
        return {status: status.status, filledQty: status.filledQty || 0};
    } catch (e) {
        log('WARN', `Erro ao verificar status da ordem ${order.id}: ${e.message}.`);
        return {status: 'error', filledQty: 0};
    }
}

// ============ CRIAR SELL PAREADA AUTOMATICAMENTE APÓS BUY PREENCHIDA ============
/**
 * Cria automaticamente uma ordem SELL quando uma BUY é preenchida
 * Garante que BUY e SELL sejam sempre pareadas
 */
async function createPairedSellOrder(buyOrderData, currentMid, pairId) {
    try {
        if (!buyOrderData || !buyOrderData.qty || buyOrderData.qty <= 0) {
            log('WARN', `[AUTO_SELL] Quantidade de BUY inválida para criar SELL: ${buyOrderData?.qty}`);
            return;
        }
        
        // Calcular preço de venda com spread mínimo para garantir lucro
        // BUY foi preenchida a buyOrderData.price
        // SELL deve ser colocada ACIMA para lucrar
        const buyPrice = parseFloat(buyOrderData.price);
        const minSellPrice = buyPrice * (1 + MIN_SPREAD_PCT); // Mínimo para cobrir fees
        const targetSellPrice = Math.max(
            currentMid * (1 + currentSpreadPct / 2),  // Spread normal
            minSellPrice                              // Mínimo obrigatório
        );
        
        const sellQty = parseFloat(buyOrderData.qty);
        
        log('INFO', `[AUTO_SELL] 🔗 Criando SELL pareada automaticamente:`);
        log('INFO', `  - BUY preenchido: ${sellQty.toFixed(8)} BTC @ R$${buyPrice.toFixed(2)}`);
        log('INFO', `  - Mínimo SELL: R$${minSellPrice.toFixed(2)} (BUY + fees)`);
        log('INFO', `  - Target SELL: R$${targetSellPrice.toFixed(2)} (spread ${(((targetSellPrice - buyPrice) / buyPrice) * 100).toFixed(3)}%)`);
        
        // Chamar placeOrder com pairId para associar ao BUY
        await placeOrder('sell', targetSellPrice, sellQty, null, pairId);
        
        log('SUCCESS', `[AUTO_SELL] ✅ SELL pareada criada com sucesso para pair ${pairId.substring(0, 20)}...`);
    } catch (e) {
        log('ERROR', `[AUTO_SELL] Falha ao criar SELL pareada: ${e.message}`);
    }
}

// ============ RECOVERY: CRIAR SELL PARA BUY JÁ PREENCHIDA ============
const AUTO_SELL_RECOVERY_COOLDOWN_MS = 60000; // evita recriação em loop
const AUTO_SELL_RECOVERY_LIMIT = 2; // limita SELLs recuperadas por ciclo
const autoSellRecoveryAttempts = new Map();

async function recoverMissingPairedSells(mid, spreadAmount, btcBalance) {
    try {
        const orders = await db.getOrders({ limit: 2000 });
        const pairs = new Map();

        for (const order of orders) {
            if (!order.pair_id) continue;
            if (!pairs.has(order.pair_id)) {
                pairs.set(order.pair_id, { buyFilled: null, hasSell: false });
            }
            const entry = pairs.get(order.pair_id);

            if (order.side === 'buy' && order.status === 'filled') {
                if (!entry.buyFilled || order.timestamp > entry.buyFilled.timestamp) {
                    entry.buyFilled = order;
                }
            }
            if (order.side === 'sell' && (order.status === 'open' || order.status === 'filled')) {
                entry.hasSell = true;
            }
        }

        let availableBtc = btcBalance;
        let created = 0;

        for (const [pairId, entry] of pairs.entries()) {
            if (!entry.buyFilled || entry.hasSell) continue;

            const lastAttempt = autoSellRecoveryAttempts.get(pairId) || 0;
            if (Date.now() - lastAttempt < AUTO_SELL_RECOVERY_COOLDOWN_MS) {
                continue;
            }

            const qty = parseFloat(entry.buyFilled.qty || entry.buyFilled.filledQty || 0);
            const buyPrice = parseFloat(entry.buyFilled.price || entry.buyFilled.avgPrice || 0);
            if (qty <= MIN_ORDER_SIZE || buyPrice <= 0) continue;
            if (availableBtc < qty) {
                log('WARN', `[AUTO_SELL_RECOVERY] BTC insuficiente para pair ${pairId.substring(0, 20)}... Necessario=${qty.toFixed(8)} Disponivel=${availableBtc.toFixed(8)}`);
                continue;
            }

            const minSellPrice = buyPrice * (1 + MIN_SPREAD_PCT);
            const targetSellPrice = Math.max((mid + spreadAmount) || mid, minSellPrice);
            if (targetSellPrice <= 0) continue;

            await placeOrder('sell', targetSellPrice, qty, null, pairId);
            log('SUCCESS', `[AUTO_SELL_RECOVERY] ✅ SELL recuperada criada: ${qty.toFixed(8)} BTC @ R$${targetSellPrice.toFixed(2)} | pair ${pairId.substring(0, 20)}...`);

            autoSellRecoveryAttempts.set(pairId, Date.now());
            availableBtc -= qty;
            created++;
            if (created >= AUTO_SELL_RECOVERY_LIMIT) break;
        }
    } catch (e) {
        log('WARN', `[AUTO_SELL_RECOVERY] Falha ao recuperar SELLs: ${e.message}`);
    }
}

// ============ VALIDAÇÃO DINÂMICA DE LIMITE DE PARES ============
/**
 * Verifica se é permitido criar um novo par baseado em:
 * 1. Número máximo de pares simultâneos
 * 2. Taxa de preenchimento mínima
 * 3. Throttling (mínimo ciclos entre criações)
 */
function canCreateNewPair() {
    // Contar pares abertos incompletos
    let incompletePairs = 0;
    for (const [pairId, pair] of pairMapping.entries()) {
        const hasBuy = pair.buyOrder !== null;
        const hasSell = pair.sellOrder !== null;
        // Contar como "incompleto" se pelo menos uma ordem estiver aberta
        if ((hasBuy || hasSell) && !(hasBuy && hasSell)) {
            incompletePairs++;
        }
    }
    
    // 1️⃣ Verificar limite de pares simultâneos
    if (incompletePairs >= MAX_CONCURRENT_PAIRS) {
        log('WARN', `🚫 Limite de pares atingido: ${incompletePairs}/${MAX_CONCURRENT_PAIRS}. Aguardando completamento.`);
        return false;
    }
    
    // 2️⃣ Verificar taxa de preenchimento
    const completedPairs = totalPairsCompleted;
    const totalCreated = totalPairsCreated;
    const fillRate = totalCreated > 0 ? (completedPairs / totalCreated) * 100 : 100;
    
    // Não bloquear se não há ordens abertas
    if (incompletePairs > 0 && totalCreated > 5 && fillRate < MIN_FILL_RATE_FOR_NEW) {
        log('WARN', `⚠️  Taxa preenchimento baixa: ${fillRate.toFixed(1)}% < ${MIN_FILL_RATE_FOR_NEW}%. Aguardando melhoria.`);
        return false;
    }
    
    // 3️⃣ Verificar throttling (mínimo ciclos entre criações)
    if (cycleCount - lastNewPairCycle < PAIRS_THROTTLE_CYCLES) {
        const cyclesToWait = PAIRS_THROTTLE_CYCLES - (cycleCount - lastNewPairCycle);
        log('DEBUG', `⏳ Throttling ativo: aguarde ${cyclesToWait} ciclo(s) antes de novo par.`);
        return false;
    }
    
    // ✅ Todos os critérios atendidos
    log('INFO', `✅ Permitido criar novo par (Pares abertos: ${incompletePairs}/${MAX_CONCURRENT_PAIRS}, Taxa fill: ${fillRate.toFixed(1)}%)`);
    return true;
}

/**
 * Calcula métricas dinâmicas de pares para logging/dashboard
 */
function getPairMetrics() {
    let incomplete = 0, buyWaiting = 0, sellWaiting = 0, complete = 0;
    
    for (const [pairId, pair] of pairMapping.entries()) {
        const hasBuy = pair.buyOrder !== null;
        const hasSell = pair.sellOrder !== null;
        
        if (hasBuy && hasSell) {
            complete++;
        } else if (hasBuy && !hasSell) {
            buyWaiting++;
            incomplete++;
        } else if (!hasBuy && hasSell) {
            sellWaiting++;
            incomplete++;
        }
    }
    
    return { incomplete, buyWaiting, sellWaiting, complete };
}

// ---------------- PLACE ORDER ----------------
// Nota: Lógica de validação momentum removida (2025-01-21)
// Agora o bot coloca ordens diretamente sem fase de simulação

// Funções de momentum simulado removidas (2025-01-21)

async function placeOrder(side, price, qty, sessionId = null, pairIdInput = null) {
    try {
        if (qty * price < MIN_VOLUME) {
            log('WARN', `Ordem ${side.toUpperCase()} ignorada: volume baixo (${(qty * price).toFixed(8)} < ${MIN_VOLUME}).`);
            return false;
        }
        const feeRate = getFeeRate(false); // Assume Maker para ordens limite - ADICIONADO

        if (side.toLowerCase() === 'sell') {
            if (!pairIdInput) {
                log('ERROR', `❌ SELL manual bloqueada. Permitida apenas se a BUY do par estiver preenchida na exchange.`);
                return false;
            }
            const hasFilledBuy = await hasFilledBuyForPair(pairIdInput);
            if (!hasFilledBuy) {
                log('WARN', `⏳ SELL bloqueada: BUY do par ${pairIdInput.substring(0, 20)}... ainda nao foi executada na exchange.`);
                return false;
            }
        }
        
        // ===== VALIDAÇÃO DINÂMICA: LIMITE DE PARES =====
        // Bloquear nova BUY se atingir limite de pares simultâneos
        if (side.toLowerCase() === 'buy' && !pairIdInput) {
            if (getActiveOrderCount('buy') >= MAX_ACTIVE_BUYS) {
                log('WARN', `❌ Limite de BUYs simultâneas atingido: ${getActiveOrderCount('buy')}/${MAX_ACTIVE_BUYS}.`);
                return false;
            }
            if (!canCreateNewPair()) {
                log('WARN', `❌ Nova BUY bloqueada por limite dinâmico de pares. Aguarde completamento dos pares existentes.`);
                return false;
            }
            // Registrar que foi criado um novo par
            lastNewPairCycle = cycleCount;
            totalPairsCreated++;
            pairsCreatedThisCycle++;
        }
        
        // ===== IDENTIFICAÇÃO DE PAR =====
        // Se é BUY, gerar novo pair_id
        // Se é SELL, usar pair_id existente (OBRIGATÓRIO)
        let pairId = pairIdInput;
        if (!pairId) {
            if (side.toLowerCase() === 'buy') {
                // Gerar novo pair_id para BUY
                pairId = `PAIR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            } else if (side.toLowerCase() === 'sell') {
                // Para SELL, pairIdInput deve ser fornecido e validado acima
                log('ERROR', `Erro crítico: SELL sem pairId fornecido. Abortando.`);
                return false;
            }
        }
        
        // ===== VALIDAÇÃO RIGOROSA: UMA BUY E UMA SELL POR PAIR =====
        // Impedir colocar múltiplas ordens BUY ou SELL na mesma pair_id
        const pair = pairMapping.get(pairId);
        if (pair) {
            if (side.toLowerCase() === 'buy' && pair.buyOrder !== null) {
                log('ERROR', `Tentativa de colocar segundo BUY na pair ${pairId}. Bloqueando para manter 1 BUY + 1 SELL por pair.`);
                return false;
            }
            if (side.toLowerCase() === 'sell' && pair.sellOrder !== null) {
                log('ERROR', `Tentativa de colocar segundo SELL na pair ${pairId}. Bloqueando para manter 1 BUY + 1 SELL por pair.`);
                return false;
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
        activeOrders.set(orderId, {
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
        const orderWithPairId = { ...activeOrders.get(orderId), pairId, external_id: orderId };
        await db.saveOrderSafe(orderWithPairId, `market_making_${side}`, sessionId);
        
        log('SUCCESS', `Ordem ${side.toUpperCase()} ${orderId} colocada @ R$${price.toFixed(2)}, Qty: ${qty.toFixed(8)}, Pair: ${pairId.substring(0, 20)}..., Taxa Estimada: ${(feeRate * 100).toFixed(2)}%`);
        return true;
    } catch (e) {
        log('ERROR', `Falha ao colocar ordem ${side.toUpperCase()}: ${e.message}.`);
        return false;
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

// ============= ESTRATÉGIA ADAPTATIVA REMOVIDA =============
// Módulo AdaptiveStrategy não disponível - uso de parâmetros padrão

// ============= FIM ESTRATÉGIA =============

// -------------- CHECK ORDERS ----------------
async function checkOrders(mid, volatility, pred, orderbook, sellSignal) {
    log('DEBUG', `🔍 checkOrders iniciado. ${activeOrders.size} ordem(s) ativa(s).`);
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
        log('DEBUG', `  [checkOrders] Verificando ${order.side.toUpperCase()} ${order.id}: age=${timeAge.toFixed(1)}s, MAX_ORDER_AGE=${MAX_ORDER_AGE}s`);
        const targetPrice = order.side === 'buy' ? mid * (1 - currentSpreadPct / 2) : mid * (1 + currentSpreadPct / 2);
        const priceDrift = Math.abs(targetPrice - order.price) / order.price;
        const hasInterest = orderbook.bids[0][1] > order.qty * 2 || orderbook.asks[0][1] > order.qty * 2;

        const stopPrice = order.side === 'buy' ? order.price * (1 - dynamicStopLoss) : order.price * (1 + dynamicStopLoss);
        const takePrice = order.side === 'buy' ? order.price * (1 + dynamicTakeProfit) : order.price * (1 - dynamicTakeProfit);

        if ((order.side === 'buy' && mid <= stopPrice) || (order.side === 'sell' && mid >= stopPrice)) {
            await tryCancel(key);
            log('ALERT', `Stop-loss acionado para ordem ${order.side.toUpperCase()} ${order.id}.`);
            continue;
        }
        if ((order.side === 'buy' && mid >= takePrice) || (order.side === 'sell' && mid <= takePrice)) {
            await tryCancel(key);
            log('SUCCESS', `Take-profit acionado para ordem ${order.side.toUpperCase()} ${order.id}.`);
            continue;
        }
        // SISTEMA SIMPLIFICADO: Cancelar APENAS por IDADE
        // A lógica de drift/stuck foi removida porque causava churn desnecessário
        // em mercados dinâmicos com spreads que mudam a cada ciclo
        // O bot irá aguardar MAX_ORDER_AGE (20 minutos) antes de cancelar qualquer ordem
        const isStuck = false; // Desabilitado - não há "stuck" real, apenas mercado dinâmico
        
        if (order.side === 'buy' && timeAge > BUY_REPRICE_AGE_SEC) {
            log('INFO', `🔄 BUY ${order.id} com ${timeAge.toFixed(1)}s sem execução. Recolocando...`);

            const oldPairId = order.pairId;
            await tryCancel(key);

            if (oldPairId && pairMapping.has(oldPairId)) {
                const pair = pairMapping.get(oldPairId);
                pair.buyOrder = null;
                if (!pair.sellOrder) {
                    pairMapping.delete(oldPairId);
                }
            }

            const newBuyPrice = targetPrice;
            if (newBuyPrice > 0 && order.qty > MIN_ORDER_SIZE) {
                await placeOrder('buy', newBuyPrice, order.qty, null, oldPairId);
                log('SUCCESS', `✅ BUY recolocada: ${order.qty.toFixed(8)} BTC @ R$${newBuyPrice.toFixed(2)}`);
            }
            continue;
        }

        if (timeAge > MAX_ORDER_AGE) {
            log('WARN', `⏰ Ordem ${order.side.toUpperCase()} ${order.id} com idade ${timeAge.toFixed(1)}s > MAX_ORDER_AGE ${MAX_ORDER_AGE}s. CANCELANDO.`);
            await tryCancel(key);
            log('INFO', `Ordem ${order.side.toUpperCase()} ${order.id} cancelada por idade (${timeAge.toFixed(1)}s > ${MAX_ORDER_AGE}s).`);
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
        // ===== VERIFICAR E APLICAR RESET DE MÉTRICAS =====
        const resetFile = path.join(__dirname, '.reset_metrics');
        if (fs.existsSync(resetFile)) {
            try {
                const resetData = JSON.parse(fs.readFileSync(resetFile, 'utf8'));
                if (resetData.resetTotalPairsCreated) {
                    log('WARN', `🔄 RESETANDO MÉTRICAS: totalPairsCreated: ${totalPairsCreated} → 0`);
                    totalPairsCreated = 0;
                }
                if (resetData.resetTotalPairsCompleted) {
                    log('WARN', `🔄 RESETANDO MÉTRICAS: totalPairsCompleted: ${totalPairsCompleted} → 0`);
                    totalPairsCompleted = 0;
                }
                // Delete reset file after applying
                fs.unlinkSync(resetFile);
                log('SUCCESS', `✅ Métricas resetadas com sucesso. Bot pode criar novos pares agora.`);
            } catch (err) {
                log('WARN', `Erro ao ler arquivo de reset: ${err.message}`);
            }
        }

        cycleCount++;
        stats.cycles = cycleCount;
        pairsCreatedThisCycle = 0; // Reset contador de pares criados neste ciclo
        log('INFO', `Iniciando ciclo ${cycleCount}.`);

        // ===== OBTER PARES COMPLETADOS DO DASHBOARD (se em modo SIMULATE) =====
        if (SIMULATE) {
            try {
                const dashboardData = await axios.get('http://localhost:3001/api/data', { timeout: 2000 });
                if (dashboardData.data && dashboardData.data.pairsCompletedThisCycle) {
                    totalPairsCompleted += dashboardData.data.pairsCompletedThisCycle;
                    log('DEBUG', `📊 Pares completados (acumulado): ${totalPairsCompleted}, Criados: ${totalPairsCreated}`);
                }
            } catch (e) {
                log('DEBUG', `Não conseguiu acessar dashboard para pares completados (ok em modo offline).`);
            }
        }

        // ===== SINCRONIZAÇÃO COM BANCO DE DADOS =====
        // Recarregar ordens abertas para manter activeOrders atualizado
        try {
            const openOrders = await db.getOrders({ status: 'open', limit: 2000 });
            const allOrders = await db.getOrders({ limit: 2000 });
            activeOrders.clear();
            pairMapping.clear(); // Reconstruir mapa de pares

            // Cancelar ordens orfas (sem ordem correspondente). Ignorar se correspondente ja foi executado.
            if (allOrders.length > 0) {
                const pairIndex = new Map();
                for (const order of allOrders) {
                    if (!order.pair_id) continue;
                    if (!pairIndex.has(order.pair_id)) {
                        pairIndex.set(order.pair_id, {
                            buyAny: false,
                            sellAny: false,
                            buyFilled: false,
                            sellFilled: false
                        });
                    }
                    const entry = pairIndex.get(order.pair_id);
                    if (order.side === 'buy') {
                        entry.buyAny = true;
                        if (order.status === 'filled') entry.buyFilled = true;
                    }
                    if (order.side === 'sell') {
                        entry.sellAny = true;
                        if (order.status === 'filled') entry.sellFilled = true;
                    }
                }

                for (const order of openOrders) {
                    if (!order.pair_id) continue;
                    const entry = pairIndex.get(order.pair_id);
                    if (!entry) continue;

                    const isBuy = order.side === 'buy';
                    const hasOppositeAny = isBuy ? entry.sellAny : entry.buyAny;
                    const hasOppositeFilled = isBuy ? entry.sellFilled : entry.buyFilled;

                    // Ignorar se o correspondente ja foi executado
                    if (hasOppositeFilled) continue;

                    // Cancelar apenas SELL orfa (sem BUY algum). BUY sem SELL permanece.
                    if (!isBuy && !hasOppositeAny) {
                        log('WARN', `[ORPHAN_CANCEL] SELL ${order.id} sem BUY correspondente no par ${order.pair_id.substring(0, 20)}...`);
                        try {
                            if (SIMULATE) {
                                await db.saveOrderSafe({
                                    ...order,
                                    status: 'cancelled'
                                }, 'orphan_cancel');
                            } else {
                                const result = await MB.cancelOrder(order.id);
                                await db.saveOrderSafe({
                                    ...order,
                                    status: result.status || 'cancelled'
                                }, 'orphan_cancel');
                            }
                        } catch (e) {
                            log('WARN', `[ORPHAN_CANCEL] Falha ao cancelar ${order.id}: ${e.message}`);
                        }
                    }
                }
            }
            
            // Contar ordens por tipo e carregar todas no mapa
            let buyOrders = openOrders.filter(o => o.side.toLowerCase() === 'buy');
            let sellOrders = openOrders.filter(o => o.side.toLowerCase() === 'sell');

            for (const order of openOrders) {
                const loadKey = `${order.side}_${order.id}`;
                const loadTs = orderLoadTimestamps.get(loadKey) || Date.now();
                orderLoadTimestamps.set(loadKey, loadTs);
                activeOrders.set(order.id, {
                    id: order.id,
                    side: order.side.toLowerCase(),
                    price: parseFloat(order.price),
                    qty: parseFloat(order.qty),
                    timestamp: order.timestamp,
                    loadTimestamp: loadTs,
                    cyclePlaced: cycleCount - 1,
                    pairId: order.pair_id
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
                        pair.buyOrder = { id: order.id, price: order.price, qty: order.qty, status: order.status, timestamp: order.timestamp };
                    } else {
                        pair.sellOrder = { id: order.id, price: order.price, qty: order.qty, status: order.status, timestamp: order.timestamp };
                    }
                } else {
                    log('WARN', `[SYNC] Ordem aberta ${order.id} (${order.side}) não tem pair_id! Pulando...`);
                }
            }
            
            // ✅ FIX: VALIDAR INTEGRIDADE DE PARES - detectar órfãos
            {
                let completePairCount = 0;
                let incompletePairCount = 0;
                let orphanedPairsRemoved = 0;
                
                for (const [pairId, pair] of pairMapping.entries()) {
                    const hasBuy = !!pair.buyOrder;
                    const hasSell = !!pair.sellOrder;
                    
                    if (hasBuy && hasSell) {
                        completePairCount++;
                    } else if (hasBuy || hasSell) {
                        incompletePairCount++;
                        log('WARN', `[PAIRSYNC] Par incompleta: ${pairId.substring(0, 20)}... | BUY: ${hasBuy ? '✓' : '✗'} | SELL: ${hasSell ? '✓' : '✗'}`);
                    } else {
                        // Ambos nulos - remover
                        pairMapping.delete(pairId);
                        orphanedPairsRemoved++;
                    }
                }
                
                if (orphanedPairsRemoved > 0) {
                    log('INFO', `[PAIRSYNC] Removidas ${orphanedPairsRemoved} pares órfãs (ambos preenchidos/cancelados)`);
                }
                
                if (completePairCount > 0 || incompletePairCount > 0) {
                    log('DEBUG', `[PAIRSYNC] Status de Pares: ${completePairCount} completa(s), ${incompletePairCount} incompleta(s), ${orphanedPairsRemoved} órfã(s) removida(s)`);
                }
            }
            
            if (openOrders.length > 0) {
                log('DEBUG', `Sincronização: Carregadas ${openOrders.length} ordens da BD (BUY: ${buyOrders.length}✓, SELL: ${sellOrders.length}✓). Pares no mapa: ${pairMapping.size}`);

            }
        } catch (e) {
            log('WARN', `Erro ao sincronizar ordens com BD: ${e.message}`);
        }

        // ✅ FIX: Validar integridade de pares após sincronização
        const pairIntegrity = validatePairIntegrity();
        if (cycleCount % 5 === 0) {
            // A cada 5 ciclos, logar resumo de integridade
            log('INFO', `[PAIR_INTEGRITY] Pares: ${pairIntegrity.totalPairs} totais | ${pairIntegrity.completePairs} completa(s) | ${pairIntegrity.incompletePairs} incompleta(s) | ${pairIntegrity.orphanedPairs} órfã(s)`);
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
        const spreadAmount = mid * SPREAD_PCT;
        let buySpreadAmount = spreadAmount;
        let sellSpreadAmount = spreadAmount;

        // Atualizar priceHistory com o preço atual
        priceHistory.push(mid);
        if (priceHistory.length > 100) priceHistory.shift();

        // ===== MOMENTUM VALIDATION REMOVIDO (2025-01-21) =====
        // Momentum validation desativado - usar Cash Management Strategy em seu lugar

        // NOTA: Swing trading removido (desativado por redundância com CashManagement)

        // Calcular indicadores básicos
        const pred = fetchPricePrediction(mid, orderbook);
        marketTrend = pred.trend;
        const externalSpread = getExternalSpreadFactors(externalTrendData, pred.trend, pred.confidence, pred.volatility);
        buySpreadAmount = spreadAmount * externalSpread.buyFactor;
        sellSpreadAmount = spreadAmount * externalSpread.sellFactor;
        log('INFO', `[SPREAD_TREND] source=${externalSpread.source} trend=${externalSpread.trend} conf=${externalSpread.confidence.toFixed(2)} buyFactor=${externalSpread.buyFactor.toFixed(2)} sellFactor=${externalSpread.sellFactor.toFixed(2)} diverge=${externalSpread.divergent} volScale=${externalSpread.volatilityScale.toFixed(2)}`);

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

        // 1. Otimizador automático removido (módulo não disponível)

        // 2. Analisador de perdas removido (módulo não disponível)

        // 3. Lógica de entrada/saída
        let buySignal = { shouldEnter: false, score: 0, reasons: [] };
        let sellSignal = { shouldExit: false, score: 0, reasons: [] };
        // =====================================================

        // ✅ FIX: Aplicar repricing de ordens ANTES de checkOrders
        await managePrices(mid, pred.volatility, SPREAD_PCT);

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

        // ✅ CAPTURAR SALDO INICIAL NO PRIMEIRO CICLO
        if (initialBRLBalance === null && initialBTCBalance === null) {
            initialBRLBalance = brlBalance;
            initialBTCBalance = btcBalance;
            initialBalanceCaptureCycle = cycleCount;
            log('SUCCESS', `✅ SALDO INICIAL CAPTURADO (Ciclo ${cycleCount}): BRL=R$ ${initialBRLBalance.toFixed(2)} + BTC=${initialBTCBalance.toFixed(8)}`);
            
            // ✅ Atualizar stats com saldo inicial
            stats.initialBRL = parseFloat(initialBRLBalance.toFixed(2));
            stats.initialBTC = parseFloat(initialBTCBalance.toFixed(8));
            stats.initialCapital = parseFloat((initialBRLBalance + (initialBTCBalance * mid)).toFixed(2));
            
            // ✅ Salvar saldo inicial em arquivo para o dashboard usar
            try {
                const initialBalanceFile = path.join(__dirname, '.initial_balance.json');
                if (!RESET_INITIAL_BALANCE_ON_START && fs.existsSync(initialBalanceFile)) {
                    log('INFO', 'Saldo inicial ja existe; mantendo .initial_balance.json atual.');
                } else {
                    fs.writeFileSync(initialBalanceFile, JSON.stringify({
                        brl: stats.initialBRL,
                        btc: stats.initialBTC,
                        total: stats.initialCapital,
                        capturedAt: new Date().toISOString(),
                        capturedAtCycle: cycleCount
                    }), 'utf8');
                    log('DEBUG', `✅ Saldo inicial salvo em arquivo para dashboard`);
                }
            } catch (e) {
                log('WARN', `Falha ao salvar saldo inicial em arquivo: ${e.message}`);
            }
        }

        // ✅ CALCULAR PnL CORRETO = Saldo Atual - Saldo Inicial
        const totalBalanceNow = brlBalance + (btcBalance * mid);  // Saldo total atual em BRL
        const totalBalanceInitial = initialBRLBalance + (initialBTCBalance * mid);  // Saldo inicial em BRL
        const totalPnLCorrect = totalBalanceNow - totalBalanceInitial;  // PnL = Diferença
        
        // Atualizar stats com PnL correto
        stats.totalPnL = totalPnLCorrect.toFixed(2);

        // ===== RECUPERAR SELLs FALTANTES PARA BUYs PREENCHIDAS =====
        await recoverMissingPairedSells(mid, spreadAmount, btcBalance);

        // ===== ATUALIZAR CASH MANAGEMENT STRATEGY =====
        if (cashManagementStrategy) {
            cashManagementStrategy.updatePrice(mid);
        }

        // ===== EXECUTAR LÓGICA DE CASH MANAGEMENT (Estratégia ativa se USE_CASH_MANAGEMENT=true) =====
        // ⚠️ PROTEÇÃO: SELL-FIRST foi desabilitado - causava INVERSÃO DE SPREAD!
        // Histórico: 21/01 colocava SELL @ 476.220 primeiro, depois BUY @ 476.949 (9h depois) = PERDA total
        if (cashManagementStrategy && process.env.USE_CASH_MANAGEMENT === 'true') {
            log('DEBUG', `[CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...`);

            // ✅ FIX: Calcular preços corretamente com spread
            const cashMgmtBuyPrice = mid - buySpreadAmount;    // Comprar ABAIXO do mid
            const cashMgmtSellPrice = mid + sellSpreadAmount;  // Vender ACIMA do mid

            if (!cashManagementStrategy.lastTradePrice && mid > 0) {
                cashManagementStrategy.lastTradePrice = mid;
                cashManagementStrategy.lastBuyPrice = mid;
                cashManagementStrategy.lastSellPrice = mid;
                log('DEBUG', `[CASH_MGT] Preco base inicializado em R$ ${mid.toFixed(2)}.`);
            }

            // Buscar último preço de compra do histórico para melhor decisão
            const recentBuyOrders = Array.from(activeOrders.values()).filter(o => o.side === 'buy');
            const lastBuyPrice = recentBuyOrders.length > 0 ? 
                Math.min(...recentBuyOrders.map(o => o.price)) : 
                null;

            const avgBuyPrice = btcPosition > 0 ? (totalCost / btcPosition) : null;
            const minProfitPct = MIN_SPREAD_PCT;
            const sellSignalCash = cashManagementStrategy.shouldSell(mid, btcBalance, pred.trend, avgBuyPrice, minProfitPct);
            if (avgBuyPrice) {
                const minSellPrice = avgBuyPrice * (1 + minProfitPct);
                log('DEBUG', `[CASH_MGT] AvgBuy=R$${avgBuyPrice.toFixed(2)} | MinSell=R$${minSellPrice.toFixed(2)} | Mid=R$${mid.toFixed(2)}`);
            }

            // ⚠️ SELL-FIRST DESABILITADO! Causava pairs invertidas
            // Only proceed with normal logic:
            if (false && (SELL_FIRST_ENABLED || sellSignalCash.shouldSell) && !sellFirstExecuted && !hasActiveOrder('sell') && !hasActiveOrder('buy') && btcBalance > MIN_ORDER_SIZE) {
                const sellQty = Math.min(btcBalance, btcBalance * (sellSignalCash.qty || cashManagementStrategy.SELL_AMOUNT_PCT));
                log('WARN', `[SELL_FIRST] SELL inicial habilitado. Vendendo ${sellQty.toFixed(8)} BTC a R$ ${cashMgmtSellPrice.toFixed(2)}${sellSignalCash.reason ? ` | ${sellSignalCash.reason}` : ''}`);
                await placeOrder('sell', cashMgmtSellPrice, sellQty);
                stats.sells = (stats.sells || 0) + 1;
                sellFirstExecuted = true;
                cycleSinceSellFirst = 1; // Começar contador
                log('WARN', `[SELL_FIRST] ⏱️ Contador iniciado. Força BUY após ${3} ciclos se nenhuma BUY for colocada.`);
            }
            
            // ✅ PROTEÇÃO: Se SELL_FIRST foi executada mas nenhuma BUY após 3 ciclos, FORÇA BUY
            // (Also disabled to prevent forced orders)
            if (false && sellFirstExecuted && !hasActiveOrder('buy')) {
                cycleSinceSellFirst++;
                if (cycleSinceSellFirst > 3) {
                    const forcedBuyQty = Math.min(0.0001, (brlBalance * 0.40) / cashMgmtBuyPrice);
                    if (forcedBuyQty > MIN_ORDER_SIZE && brlBalance >= forcedBuyQty * cashMgmtBuyPrice) {
                        log('WARN', `[SELL_FIRST] 🔄 Força BUY PARA PAREAR com SELL (${cycleSinceSellFirst} ciclos transcorridos)`);
                        await placeOrder('buy', cashMgmtBuyPrice, forcedBuyQty);
                        log('SUCCESS', `[SELL_FIRST] ✅ BUY pareada colocada: ${forcedBuyQty.toFixed(8)} BTC a R$ ${cashMgmtBuyPrice.toFixed(2)}`);
                        cycleSinceSellFirst = 0; // Reset para próximo SELL_FIRST
                    }
                }
            }
            
            // Verificar sinal de COMPRA
            const buySignalCash = cashManagementStrategy.shouldBuy(mid, brlBalance, btcBalance, pred.trend);
            log('DEBUG', `[CASH_MGT] shouldBuy=${buySignalCash.shouldBuy}, reason=${buySignalCash.reason}, activeBuys=${getActiveOrderCount('buy')}/${MAX_ACTIVE_BUYS}`);
            if (buySignalCash.shouldBuy && getActiveOrderCount('buy') < MAX_ACTIVE_BUYS) {
                const buyQty = Math.min(0.0002, (brlBalance * buySignalCash.qty) / cashMgmtBuyPrice);
                if (buyQty > MIN_ORDER_SIZE && brlBalance >= buyQty * cashMgmtBuyPrice) {
                    log('SUCCESS', `[CASH_MGT_BUY] ${buySignalCash.reason}`);
                    const placed = await placeOrder('buy', cashMgmtBuyPrice, buyQty);
                    if (placed) {
                        log('SUCCESS', `[CASH_MGT_BUY] Ordem de compra colocada: ${buyQty.toFixed(8)} BTC a R$ ${cashMgmtBuyPrice.toFixed(2)}`);
                        stats.buys = (stats.buys || 0) + 1;
                        cycleSinceSellFirst = 0; // Reset contador se BUY foi colocada
                    }
                }
            }
            
            // Verificar sinal de VENDA
            if (sellSignalCash.shouldSell && !hasActiveOrder('sell')) {
                let sellQty = Math.min(btcBalance, btcBalance * sellSignalCash.qty);
                if (sellSignalCash.minReserve && btcBalance - sellQty < sellSignalCash.minReserve) {
                    sellQty = btcBalance - sellSignalCash.minReserve;
                }
                if (sellQty > MIN_ORDER_SIZE) {
                    log('SUCCESS', `[CASH_MGT_SELL] ${sellSignalCash.reason}`);
                    const placed = await placeOrder('sell', cashMgmtSellPrice, sellQty);
                    if (placed) {
                        log('SUCCESS', `[CASH_MGT_SELL] Ordem de venda colocada: ${sellQty.toFixed(8)} BTC a R$ ${cashMgmtSellPrice.toFixed(2)}`);
                        stats.sells = (stats.sells || 0) + 1;
                    }
                }
            }
            
            // Micro trades (pequenas operações para aproveitar volatilidade)
            const microTradeSignals = cashManagementStrategy.shouldMicroTrade(cycleCount, mid, btcBalance, brlBalance, avgBuyPrice, minProfitPct);
            if (microTradeSignals.buy && getActiveOrderCount('buy') < MAX_ACTIVE_BUYS) {
                const microBuyQty = Math.min(0.00006, (brlBalance * microTradeSignals.buy.qty) / cashMgmtBuyPrice);
                if (microBuyQty > MIN_ORDER_SIZE) {
                    log('INFO', `[CASH_MGT_MICRO] ${microTradeSignals.buy.reason}`);
                    await placeOrder('buy', cashMgmtBuyPrice, microBuyQty);
                }
            }
            if (microTradeSignals.sell && !hasActiveOrder('sell') && btcBalance > 0.00001) {
                let microSellQty = btcBalance * microTradeSignals.sell.qty;
                if (microTradeSignals.sell.minReserve && btcBalance - microSellQty < microTradeSignals.sell.minReserve) {
                    microSellQty = btcBalance - microTradeSignals.sell.minReserve;
                }
                if (microSellQty > MIN_ORDER_SIZE) {
                    log('INFO', `[CASH_MGT_MICRO] ${microTradeSignals.sell.reason}`);
                    await placeOrder('sell', cashMgmtSellPrice, microSellQty);
                }
            }
        } else {
            // ===== LÓGICA PADRÃO DE ENTRADA/SAÍDA (FALLBACK quando cash management desativado) =====
            // Calcular spread para colocação correta de ordens
            const spreadAmount = mid * SPREAD_PCT;
            const marketMakingBuyPrice = mid - buySpreadAmount;   // Compra ABAIXO do mid
            const marketMakingSellPrice = mid + sellSpreadAmount; // Venda ACIMA do mid
            
            if (buySignal.shouldEnter && getActiveOrderCount('buy') < MAX_ACTIVE_BUYS) {
                const { isValid, errors } = improvedEntryExit.validateOrderPlacement('buy', marketMakingBuyPrice, marketData);
                if (isValid) {
                    const positionSizeBRL = improvedEntryExit.calculatePositionSize(brlBalance, pred.volatility, buySignal.confidence);
                    const buyQty = positionSizeBRL / marketMakingBuyPrice;
                    
                    if (buyQty >= MIN_ORDER_SIZE && positionSizeBRL <= brlBalance) {
                        log('SUCCESS', `[ENTRY/EXIT] Sinal de COMPRA forte (Score: ${buySignal.score.toFixed(2)}). Razões: ${buySignal.reasons.join(', ')}`);
                        await placeOrder('buy', marketMakingBuyPrice, buyQty);
                    } else {
                        log('WARN', `[ENTRY/EXIT] Compra ignorada. Qtd: ${buyQty.toFixed(8)} (min: ${MIN_ORDER_SIZE}) ou Saldo BRL insuficiente.`);
                    }
                } else {
                    log('WARN', `[ENTRY/EXIT] Compra bloqueada por validação: ${errors.join(', ')}`);
                }
            }

            if (sellSignal.shouldExit) {
                const openPositionOrder = getOldestActiveOrder('buy');
                if (openPositionOrder) {
                    log('SUCCESS', `[ENTRY/EXIT] Sinal de SAÍDA forte (Score: ${sellSignal.score.toFixed(2)}). Razões: ${sellSignal.reasons.join(', ')}`);
                    await tryCancel(openPositionOrder.id);
                    const sellQty = openPositionOrder.qty;
                    if (sellQty >= MIN_ORDER_SIZE && sellQty <= btcBalance) {
                        await placeOrder('sell', marketMakingSellPrice, sellQty);
                    } else {
                        log('WARN', `[ENTRY/EXIT] Venda de saída ignorada. Qtd: ${sellQty.toFixed(8)} (min: ${MIN_ORDER_SIZE}) ou Saldo BTC insuficiente.`);
                    }
                }
            }
        }  // Fim do else (lógica fallback quando cash management desativado)

        // ========== MINI-DASHBOARD: DINÂMICA DE PARES ==========
        if (cycleCount % 10 === 0) {
            const metricas = getPairMetrics();
            const fillRate = totalPairsCreated > 0 ? ((totalPairsCompleted / totalPairsCreated) * 100).toFixed(1) : '0.0';
            const canCreateStr = canCreateNewPair() ? '✅ SIM' : '❌ NÃO';
            log('INFO', `📊 PARES | Ativos: ${metricas.incomplete}/${MAX_CONCURRENT_PAIRS} | Criados: ${totalPairsCreated} | Completos: ${totalPairsCompleted} | Taxa: ${fillRate}% | Pode criar: ${canCreateStr}`);
        }

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

    // Inicializar estratégia principal
    cashManagementStrategy = new CashManagementStrategy();
    
    log('SUCCESS', '[CASH_MANAGEMENT] Estratégia de gerenciamento de caixa inicializada (PRIMÁRIA).');

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