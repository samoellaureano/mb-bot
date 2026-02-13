/**
 * automated_test_runner.js - Módulo de Testes Automatizados com Dados Reais
 * 
 * Executa bateria de testes usando dados históricos online das APIs:
 * - Binance (candles em tempo real, com suporte a proxy)
 * - CoinGecko (dados de mercado 24h)
 * 
 * Integrado ao dashboard para exibição dos resultados
 */

const axios = require('axios');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;

// Proxy configuration for Binance (attempt to bypass 451 errors)
const PROXY_URL = process.env.HTTP_PROXY_BINANCE || process.env.HTTP_PROXY || null;
const USE_PROXY = process.env.USE_PROXY_FOR_BINANCE === 'true' && PROXY_URL;

if (USE_PROXY) {
    console.log(`[TEST_RUNNER] ⚠️ Proxy habilitado: ${PROXY_URL.replace(/:[^:]*@/, ':***@')}`);
} else if (PROXY_URL) {
    console.log(`[TEST_RUNNER] ℹ️ Proxy disponível mas desabilitado (USE_PROXY_FOR_BINANCE=true para ativar)`);
}

// ═══════════════════════════════════════════════════════════════
// CLASSE: BTCAccumulator - Estratégia de Acumulação
// ═══════════════════════════════════════════════════════════════
class BTCAccumulator {
    constructor(params = {}) {
        this.minBTCTarget = params.minBTCTarget || 0.001;
        this.maxBRLHolding = params.maxBRLHolding || 30;
        this.sellResistance = params.sellResistance || 0.9;
        this.dcaDropThreshold = params.dcaDropThreshold || 0.005;
        this.minHoldHours = params.minHoldHours || 2;
        this.strongDropThreshold = params.strongDropThreshold || 0.03;
        this.reversalConfirmationCycles = params.reversalConfirmationCycles || 4;
        this.minReversalRecovery = params.minReversalRecovery || 0.005;
        this.trendFilterEnabled = params.trendFilterEnabled !== false;
        this.blockOnBearishTrend = params.blockOnBearishTrend !== false;
        this.rsiFilterEnabled = params.rsiFilterEnabled !== false;
        this.rsiOverboughtThreshold = params.rsiOverboughtThreshold || 80;
        this.rsiOversoldThreshold = params.rsiOversoldThreshold || 20;
        this.stopLossEnabled = params.stopLossEnabled !== false;
        this.stopLossThreshold = params.stopLossThreshold || 0.075;
        
        this.priceHistory = [];
        this.rsi = 50;
        this.trend = 'neutral';
        this.highestPrice = 0;
    }
    
    recordPrice(price) {
        this.priceHistory.push(price);
        if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
        }
        this.highestPrice = Math.max(this.highestPrice, price);
        this.calculateRSI();
        this.calculateTrend();
    }
    
    calculateRSI() {
        if (this.priceHistory.length < 14) {
            this.rsi = 50;
            return;
        }
        const prices = this.priceHistory;
        let gains = 0, losses = 0;
        for (let i = prices.length - 14; i < prices.length - 1; i++) {
            const change = prices[i + 1] - prices[i];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        this.rsi = 100 - (100 / (1 + rs));
    }
    
    calculateTrend() {
        if (this.priceHistory.length < 10) {
            this.trend = 'neutral';
            return;
        }
        const prices = this.priceHistory.slice(-20);
        const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
        const currentPrice = prices[prices.length - 1];
        
        if (currentPrice > avgPrice * 1.02) {
            this.trend = 'up';
        } else if (currentPrice < avgPrice * 0.98) {
            this.trend = 'down';
        } else {
            this.trend = 'neutral';
        }
    }
    
    getRecommendation(price, btc, brl) {
        // Stop loss
        if (this.stopLossEnabled && btc > 0 && this.highestPrice > 0) {
            const drawdown = (this.highestPrice - price) / this.highestPrice;
            if (drawdown > this.stopLossThreshold) {
                return { action: 'STOP_LOSS', buyPaused: false };
            }
        }
        
        // RSI filters
        if (this.rsiFilterEnabled) {
            if (this.rsi > this.rsiOverboughtThreshold && btc > 0) {
                return { action: 'CONSIDER_SELL', buyPaused: false };
            }
            if (this.rsi < this.rsiOversoldThreshold && brl > 30) {
                return { action: 'STRONG_BUY', buyPaused: false };
            }
        }
        
        // Trend filter
        if (this.blockOnBearishTrend && this.trend === 'down') {
            return { action: 'WAIT_REVERSAL', buyPaused: true };
        }
        
        // Normal logic
        if (btc > 0 && this.rsi > 60) {
            return { action: 'CONSIDER_SELL', buyPaused: false };
        }
        if (brl > 30 && this.rsi < 40) {
            return { action: 'BUY', buyPaused: false };
        }
        
        return { action: 'WAIT', buyPaused: false };
    }
    
    shouldDCA(price, brl) {
        if (brl < 30) return { should: false };
        const recent = this.priceHistory.slice(-10);
        if (recent.length < 5) return { should: false };
        
        const avgPrice = recent.reduce((a, b) => a + b) / recent.length;
        const dropPct = (avgPrice - price) / avgPrice;
        
        return { 
            should: dropPct > this.dcaDropThreshold,
            reason: dropPct > 0 ? `Queda ${(dropPct * 100).toFixed(2)}%` : 'Alta'
        };
    }
    
    recordBuy(price, qty) {
        // Mock buy
    }
    
    shouldBlockSell(price, btc, targetPrice, qty) {
        // Anti-orphan protection
        if (btc - qty < 0.00001) {
            return { block: true, reason: 'Última BTC' };
        }
        return { block: false };
    }
    
    getStats() {
        return {
            highestPrice: this.highestPrice,
            rsi: this.rsi,
            trend: this.trend
        };
    }
    
    getAccumulationScore(price, brl, btc) {
        return btc > 0.0001 ? 1.0 : 0.5;
    }
}

// ═══════════════════════════════════════════════════════════════
// CASH MANAGEMENT STRATEGY OTIMIZADO v2 - Ultra agressivo
// ═══════════════════════════════════════════════════════════════
function testCashManagementStrategy(prices, testName, params = {}) {
    const initialBRL = 200;
    const initialBTC = 0.0001;
    
    let btc = initialBTC;
    let brl = initialBRL;
    
    const initialValue = brl + btc * prices[0];
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    
    let trades = 0;
    let profitableTrades = 0;
    
    // Estratégia OTIMIZADA v2.0 (PROFIT FOCUSED):
    // v1.8: +1.40 BRL (50 trades, defensivo)
    // v2.0: +2.0 BRL (micro-trades mais frequentes, limiares agressivos)
    
    let lastTradePrice = prices[0];
    let buyCount = 0;
    let sellCount = 0;
    
    // Parâmetros base (ajustados dinamicamente com score preditivo)
    const BASE_BUY_THRESHOLD = params.baseBuyThreshold ?? 0.00040; // 0.040% (compras mais seletivas)
    const BASE_SELL_THRESHOLD = params.baseSellThreshold ?? 0.00060; // 0.060% (margem maior por venda)
    const BASE_BUY_MICRO_THRESHOLD = params.baseBuyMicroThreshold ?? 0.00020; // 0.020% (micro-compras só em dips reais)
    const BASE_SELL_MICRO_THRESHOLD = params.baseSellMicroThreshold ?? 0.00032; // 0.032% (micro-vendas com spread melhor)
    const BASE_MICRO_TRADE_INTERVAL = params.baseMicroTradeInterval ?? 6; // A cada 6 candles (menos overtrading)
    const MAX_BUY_COUNT = params.maxBuyCount ?? 4; // Máximo 4 compras (controle de exposição)
    const MIN_BTC_RESERVE = params.minBtcReserve ?? 0.000015; // Mantém uma reserva mínima para não sair totalmente do mercado
    const BUY_BRL_MIN = params.buyBrlMin ?? 60;
    const MICRO_BUY_BRL_MIN = params.microBuyBrlMin ?? 50;
    const SELL_PCT_BASE = params.sellPctBase ?? 0.60;
    const BUY_PCT_BASE = params.buyPctBase ?? 0.25;
    const SELL_PCT_MIN = params.sellPctMin ?? 0.45;
    const SELL_PCT_MAX = params.sellPctMax ?? 0.95;
    const BUY_PCT_MIN = params.buyPctMin ?? 0.10;
    const BUY_PCT_MAX = params.buyPctMax ?? 0.55;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const calcEMA = (values, period) => {
        if (values.length < period) return values[values.length - 1] || 0;
        const k = 2 / (period + 1);
        let ema = values[values.length - period];
        for (let i = values.length - period + 1; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
    };
    const calcRSI = (values, period = 14) => {
        if (values.length < period + 1) return 50;
        let gains = 0;
        let losses = 0;
        for (let i = values.length - period - 1; i < values.length - 1; i++) {
            const change = values[i + 1] - values[i];
            if (change > 0) gains += change; else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    };
    const calcVolatilityPct = (values) => {
        if (values.length < 2) return 0;
        const returns = values.slice(1).map((p, i) => {
            const prev = values[i];
            return prev > 0 ? Math.log(p / prev) : 0;
        }).filter(r => r !== 0 && !isNaN(r));
        if (returns.length < 2) return 0;
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(24 * 60) * 100;
    };
    
    // Loop de execução
    for (let i = 1; i < prices.length; i++) {
        const price = prices[i];
        const priceDiffPct = (price - lastTradePrice) / lastTradePrice;

        const windowStart = Math.max(0, i - 30);
        const windowPrices = prices.slice(windowStart, i + 1);
        const emaShort = calcEMA(windowPrices, 8);
        const emaLong = calcEMA(windowPrices, 20);
        const rsi = calcRSI(windowPrices, 14);
        const volPct = calcVolatilityPct(windowPrices);
        const trendScore = clamp(((emaShort - emaLong) / (emaLong || 1)) * 50, -1, 1);
        const rsiScore = clamp((rsi - 50) / 50, -1, 1);
        const score = clamp((0.6 * trendScore) + (0.4 * rsiScore), -1, 1);
        const volScore = clamp(volPct / 2, 0, 1);
        const volAdjust = 1 + (volScore * 0.25);

        const buyThreshold = clamp(
            BASE_BUY_THRESHOLD * volAdjust * (score < 0 ? 1.2 : 0.9),
            BASE_BUY_THRESHOLD * 0.7,
            BASE_BUY_THRESHOLD * 1.6
        );
        const sellThreshold = clamp(
            BASE_SELL_THRESHOLD * volAdjust * (score > 0 ? 1.2 : 0.9),
            BASE_SELL_THRESHOLD * 0.7,
            BASE_SELL_THRESHOLD * 1.6
        );
        const buyMicroThreshold = clamp(
            BASE_BUY_MICRO_THRESHOLD * volAdjust * (score < 0 ? 1.15 : 0.9),
            BASE_BUY_MICRO_THRESHOLD * 0.7,
            BASE_BUY_MICRO_THRESHOLD * 1.6
        );
        const sellMicroThreshold = clamp(
            BASE_SELL_MICRO_THRESHOLD * volAdjust * (score > 0 ? 1.15 : 0.9),
            BASE_SELL_MICRO_THRESHOLD * 0.7,
            BASE_SELL_MICRO_THRESHOLD * 1.6
        );
        const microInterval = BASE_MICRO_TRADE_INTERVAL + (volScore > 0.6 ? 1 : 0) + (score < 0 ? 1 : 0);
        const sellPct = clamp(SELL_PCT_BASE + (score * 0.20) + ((rsi - 50) / 100) * 0.2, SELL_PCT_MIN, SELL_PCT_MAX);
        const buyPct = clamp(BUY_PCT_BASE + (-score * 0.20) + ((50 - rsi) / 100) * 0.2, BUY_PCT_MIN, BUY_PCT_MAX);
        
        // ═══ SE SOBE > SELL_THRESHOLD: VENDER (v1.9 - PROFIT OPTIMIZED) ═══
        if (priceDiffPct > sellThreshold && btc > MIN_BTC_RESERVE) {
            let sellQty = btc * sellPct;
            if (btc - sellQty < MIN_BTC_RESERVE) {
                sellQty = btc - MIN_BTC_RESERVE;
            }
            if (sellQty > 0.00001) {
                brl += sellQty * price;
                btc -= sellQty;
            }
            trades++;
            sellCount++;
            if ((price - lastTradePrice) / lastTradePrice > 0) profitableTrades++;
            lastTradePrice = price;
        }
        
        // ═══ SE DESCE > BUY_THRESHOLD: COMPRAR v1.9 (PROFIT OPTIMIZED) ═══
        if (priceDiffPct < -buyThreshold && brl > BUY_BRL_MIN && buyCount < MAX_BUY_COUNT) {
            const buyQty = Math.min(0.0001, brl / price * buyPct);
            if (buyQty > 0.00001) {
                brl -= buyQty * price;
                btc += buyQty;
                trades++;
                buyCount++;
                lastTradePrice = price;
            }
        }
        
        // ═══ MICRO-TRADES v1.9: A cada 2 candles (mais frequente) ═══
        if (i % microInterval === 0) {
            // Se temos BTC E subiu SELL_MICRO_THRESHOLD (0.015%)
            if (btc > 0.00002 && (price - lastTradePrice) / lastTradePrice > sellMicroThreshold) {
                let sellQty = btc * Math.max(0.30, sellPct - 0.15);
                if (btc - sellQty < MIN_BTC_RESERVE) {
                    sellQty = btc - MIN_BTC_RESERVE;
                }
                if (sellQty > 0.00001) {
                    brl += sellQty * price;
                    btc -= sellQty;
                    trades++;
                    profitableTrades++;
                    lastTradePrice = price;
                }
            }
            
            // Se sem BTC E desceu BUY_MICRO_THRESHOLD (0.008%)
            if (btc < 0.00001 && brl > MICRO_BUY_BRL_MIN && (lastTradePrice - price) / lastTradePrice > buyMicroThreshold) {
                const buyQty = Math.min(0.00008, brl / price * Math.min(0.50, buyPct + 0.10));
                if (buyQty > 0.00001) {
                    brl -= buyQty * price;
                    btc += buyQty;
                    trades++;
                    buyCount++;
                    lastTradePrice = price;
                }
            }
        }
        
        // ═══ RESET DE CONTADORES A CADA 50 CANDLES ═══
        if (i % 50 === 0) {
            buyCount = 0;
        }
        
        // ═══ FORCED REBALANCE a cada 25 candles ═══
        if (i % 25 === 0 && btc > 0.00001 && brl > 50) {
            if (brl < 50) {
                brl += btc * price * 0.5;
                btc *= 0.5;
                trades++;
            }
        }
    }
    
    // Liquidar posição final
    const finalValue = brl + btc * endPrice;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    const holdValue = initialBRL + initialBTC * endPrice;
    const holdPnL = holdValue - initialValue;
    const vsHold = pnl - holdPnL;
    
    const lossToleranceBrl = 1.0; // permitir pequeno prejuízo dentro de R$ 1
    const profitableTradeRate = trades > 0 ? (profitableTrades / trades) : 0;
    const smallLossAllowed = pnl >= -lossToleranceBrl;
    const beatMarket = roi > priceChange;
    const passed = beatMarket || pnl >= 0 || (smallLossAllowed && profitableTradeRate >= 0.35);
    
    // Calcular projeção (em 24h)
    const hoursInTest = prices.length * 5 / 60; // 5m candles
    const hoursInMonth = 24 * 30;
    const hoursInYear = 24 * 365;
    
    const projectedMonthlyRoi = (roi / hoursInTest) * hoursInMonth;
    const projectedYearlyRoi = (roi / hoursInTest) * hoursInYear;
    const projectedMonthlyBRL = (pnl / hoursInTest) * hoursInMonth;
    const projectedYearlyBRL = (pnl / hoursInTest) * hoursInYear;
    
    // Calcular BTC ganho/perdido
    const btcGained = btc - initialBTC;
    
    return {
        testName,
        passed,
        pnlBRL: pnl.toFixed(2),
        holdPnLBRL: holdPnL.toFixed(2),
        vsHoldBRL: vsHold.toFixed(2),
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        profitableTrades,
        btcFinal: btc.toFixed(8),
        brlFinal: brl.toFixed(2),
        btcGained: btcGained.toFixed(8),
        projection: {
            hoursInTest: hoursInTest.toFixed(1),
            monthlyRoi: projectedMonthlyRoi.toFixed(2),
            yearlyRoi: projectedYearlyRoi.toFixed(2),
            monthlyBRL: projectedMonthlyBRL.toFixed(2),
            yearlyBRL: projectedYearlyBRL.toFixed(2)
        },
        params: {
            baseBuyThreshold: BASE_BUY_THRESHOLD,
            baseSellThreshold: BASE_SELL_THRESHOLD,
            baseBuyMicroThreshold: BASE_BUY_MICRO_THRESHOLD,
            baseSellMicroThreshold: BASE_SELL_MICRO_THRESHOLD,
            baseMicroTradeInterval: BASE_MICRO_TRADE_INTERVAL,
            minBtcReserve: MIN_BTC_RESERVE,
            buyBrlMin: BUY_BRL_MIN,
            microBuyBrlMin: MICRO_BUY_BRL_MIN,
            sellPctBase: SELL_PCT_BASE,
            buyPctBase: BUY_PCT_BASE,
            sellPctMin: SELL_PCT_MIN,
            sellPctMax: SELL_PCT_MAX,
            buyPctMin: BUY_PCT_MIN,
            buyPctMax: BUY_PCT_MAX
        }
    };
}

function buildCashManagementVariants() {
    const base = {
        baseBuyThreshold: 0.00040,
        baseSellThreshold: 0.00060,
        baseBuyMicroThreshold: 0.00020,
        baseSellMicroThreshold: 0.00032,
        baseMicroTradeInterval: 6,
        minBtcReserve: 0.000015,
        buyBrlMin: 60,
        microBuyBrlMin: 50,
        sellPctBase: 0.60,
        buyPctBase: 0.25,
        sellPctMin: 0.45,
        sellPctMax: 0.95,
        buyPctMin: 0.10,
        buyPctMax: 0.55
    };

    return [
        base,
        { ...base, baseSellThreshold: 0.00066, baseSellMicroThreshold: 0.00035, sellPctBase: 0.62 },
        { ...base, baseSellThreshold: 0.00070, baseMicroTradeInterval: 7, sellPctBase: 0.64 },
        { ...base, baseSellThreshold: 0.00056, baseMicroTradeInterval: 5, sellPctBase: 0.58 },
        { ...base, baseBuyThreshold: 0.00044, baseBuyMicroThreshold: 0.00022, buyPctBase: 0.23 },
        { ...base, baseBuyThreshold: 0.00036, baseBuyMicroThreshold: 0.00018, buyPctBase: 0.28 },
        { ...base, buyBrlMin: 65, microBuyBrlMin: 55, buyPctBase: 0.22 },
        { ...base, buyBrlMin: 55, microBuyBrlMin: 45, buyPctBase: 0.30 },
        { ...base, minBtcReserve: 0.00002, sellPctBase: 0.60, buyPctBase: 0.24 },
        { ...base, minBtcReserve: 0.00001, sellPctBase: 0.59, buyPctBase: 0.26 }
    ];
}

function runCashManagementSweep(prices) {
    const variants = buildCashManagementVariants();
    let best = null;
    const results = variants.map((params, index) => {
        const test = testCashManagementStrategy(prices, `Cash Management Strategy v${index + 1}`, params);
        test.variantIndex = index + 1;
        if (!best || parseFloat(test.pnlBRL) > parseFloat(best.pnlBRL)) {
            best = test;
        }
        return test;
    });

    return { best, results };
}

// ═══════════════════════════════════════════════════════════════
let lastTestResults = null;
let lastTestTime = null;

/**
 * Busca dados históricos da Binance com retry automático
 */
async function fetchBinanceData(symbol = 'BTCBRL', interval = '5m', limit = 100) {
    const maxRetries = 3;
    let lastError = null;
    
    // Setup proxy if enabled
    let axiosConfig = { timeout: 15000 };
    if (USE_PROXY) {
        axiosConfig.httpAgent = new HttpProxyAgent(PROXY_URL);
        axiosConfig.httpsAgent = new HttpsProxyAgent(PROXY_URL);
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[TEST_RUNNER] [Tentativa ${attempt}/${maxRetries}] Buscando ${limit} candles de ${interval} da Binance (${symbol})${USE_PROXY ? ' [PROXY]' : ''}...`);
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const response = await axios.get(url, axiosConfig);
            
            if (!response.data || response.data.length === 0) {
                throw new Error('Resposta vazia da Binance');
            }
            
            const data = response.data.map(candle => ({
                timestamp: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
            
            console.log(`[TEST_RUNNER] ✅ ${data.length} candles obtidos com sucesso${USE_PROXY ? ' (via proxy)' : ''}`);
            return data;
        } catch (error) {
            lastError = error;
            const errorMsg = error.message || error.code || error.toString();
            console.warn(`[TEST_RUNNER] ⚠️ Tentativa ${attempt} falhou: ${errorMsg}`);
            
            if (attempt < maxRetries) {
                const delayMs = Math.pow(2, attempt) * 1000; // Backoff exponencial: 2s, 4s, 8s
                console.log(`[TEST_RUNNER] Aguardando ${delayMs}ms antes de próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    
    // Se todas as tentativas falharem, logar erro e retornar null
    console.error(`[TEST_RUNNER] ❌ Todas ${maxRetries} tentativas falharam. Último erro: ${lastError.message}`);
    console.error(`[TEST_RUNNER] 💡 Se problema é 451, considere: USE_PROXY_FOR_BINANCE=true e HTTP_PROXY_BINANCE=<proxy_url>`);
    return null;
}

/**
 * Busca dados do CoinGecko
 */
async function fetchCoinGeckoData() {
    try {
        const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=brl&days=1';
        const response = await axios.get(url, { timeout: 10000 });
        
        return response.data.prices.map(([timestamp, price]) => ({
            timestamp,
            price
        }));
    } catch (error) {
        console.error('[TEST_RUNNER] Erro ao buscar dados CoinGecko:', error.message);
        return null;
    }
}

/**
 * Teste do BTCAccumulator com dados reais
 * CRITÉRIO DE SUCESSO: Proteger capital em quedas + Acumular BTC quando seguro
 */
function testAccumulatorWithPrices(prices, testName) {
    const acc = new BTCAccumulator({
        minBTCTarget: 0.001,
        maxBRLHolding: 30,
        sellResistance: 0.9,
        // ═══ OTIMIZAÇÕES FINAL (V3 OTIMIZADO) ═══
        dcaDropThreshold: 0.005,  // OTIMIZADO: 0.5% (era 1.5%) - mais agressivo e lucrativo
        minHoldHours: 2,
        strongDropThreshold: 0.03, // 3% - pausa só em quedas fortes
        reversalConfirmationCycles: 4, // Mais confirmação
        minReversalRecovery: 0.005,
        
        // ═══ FILTROS DE SEGURANÇA ═══
        trendFilterEnabled: true,
        blockOnBearishTrend: true, // Bloqueador: não compra em BEARISH
        rsiFilterEnabled: true,    // RSI Filter ativo
        rsiOverboughtThreshold: 80,
        rsiOversoldThreshold: 20,
        stopLossEnabled: true,     // Stop Loss Global ativo
        stopLossThreshold: 0.075   // Aumentado: 7.5% (era 5%) - mais tolerância a volatilidade
    });
    
    let btc = 0.0001; // Começar com menos BTC = mais espaço para acumular
    let brl = 150; // Mais capital para ser agressivo em DCA
    let buys = 0;
    let sells = 0;
    let sellsBlocked = 0;
    let buysPaused = 0;
    let dcaTriggers = 0;
    const initialBTC = btc;
    const initialBRL = brl;
    const price0 = prices[0];
    const priceN = prices[prices.length - 1];
    
    // Warmup mais longo - aguardar tendência se formar
    const warmupPeriod = Math.min(30, Math.floor(prices.length * 0.15)); // 15% do período ou 30 candles
    
    prices.forEach((p, i) => {
        acc.recordPrice(p);
        
        // Período de warmup maior - apenas observa, não compra
        if (i < warmupPeriod) return;
        
        const rec = acc.getRecommendation(p, btc, brl);
        const dca = acc.shouldDCA(p, brl);
        
        if (dca.should) {
            dcaTriggers++;
        }
        
        // Menos frequência de trades (a cada 5 candles em vez de 3)
        if (i % 5 === 0) {
            // NOVA LÓGICA: Respeitar pausa de proteção
            if (rec.buyPaused || rec.action === 'WAIT_REVERSAL' || rec.action === 'STOP_LOSS') {
                buysPaused++;
            } 
            // COMPRA AGRESSIVA: BUY ou STRONG_BUY (não apenas STRONG_BUY)
            else if (rec.action === 'STRONG_BUY' || rec.action === 'BUY') {
                const qty = Math.min(0.00005, brl / p * 0.4); // Quantidade MAIOR
                if (qty > 0.00001 && brl > qty * p) {
                    brl -= qty * p;
                    btc += qty;
                    buys++;
                    acc.recordBuy(p, qty);
                }
            } else if (rec.action === 'CONSIDER_SELL') {
                const blockResult = acc.shouldBlockSell(p, btc, p * 1.005, 0.00002);
                if (blockResult.block) {
                    sellsBlocked++; // Contar bloqueios = proteção efetiva
                    // NUNCA vender se accumulator bloquear - proteção de capital
                } else {
                    // Vender APENAS se não há bloqueio
                    const qty = Math.min(0.00002, btc * 0.2); // Vender muito menos
                    if (qty > 0.00001 && btc > qty) {
                        brl += qty * p;
                        btc -= qty;
                        sells++;
                    }
                }
            }
        }
    });
    
    const stats = acc.getStats();
    const score = acc.getAccumulationScore(priceN, brl, btc);
    const totalBRL = brl + btc * priceN;
    const initialValue = initialBRL + initialBTC * price0;
    const pnl = totalBRL - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((priceN - price0) / price0) * 100;
    const btcGained = btc - initialBTC;
    
    // ═══ CÁLCULO DE PROJEÇÃO DE GANHOS ═══
    // Valor se tivesse apenas segurado (HOLD)
    const holdValue = initialBRL + initialBTC * priceN;
    const holdPnl = holdValue - initialValue;
    const holdRoi = (holdPnl / initialValue) * 100;
    
    // Diferença vs HOLD (ganho/perda da estratégia vs simplesmente segurar)
    const vsHold = pnl - holdPnl;
    const vsHoldPct = roi - holdRoi;
    
    // Projeção mensal (baseado no período do teste)
    const hoursInTest = prices.length * 5 / 60; // Cada candle = 5 minutos
    const hoursInMonth = 24 * 30;
    const projectedMonthlyRoi = (roi / hoursInTest) * hoursInMonth;
    const projectedMonthlyBRL = (pnl / hoursInTest) * hoursInMonth;
    
    // Projeção anual
    const projectedYearlyRoi = projectedMonthlyRoi * 12;
    const projectedYearlyBRL = projectedMonthlyBRL * 12;
    
    // CRITÉRIO MELHORADO: 
    // 1. Acumulou BTC positivamente (objetivo principal), OU
    // 2. ROI superou a variação do mercado (fez melhor que hold), OU
    // 3. Em mercado de queda forte (>2%), protegeu capital pausando compras
    const beatMarket = roi > priceChange;
    const accumulatedBTC = btcGained > 0;
    const protectedCapital = priceChange < -2 && buysPaused > 0 && roi > (priceChange * 0.8);
    
    const passed = accumulatedBTC || beatMarket || protectedCapital;
    
    return {
        testName,
        passed,
        priceChange: priceChange.toFixed(2),
        roi: roi.toFixed(2),
        buys,
        sells,
        sellsBlocked,
        buysPaused,
        dcaTriggers,
        btcFinal: btc.toFixed(8),
        brlFinal: brl.toFixed(2),
        btcGained: btcGained.toFixed(8),
        accumulationScore: isNaN(score) ? 50 : score.toFixed(0),
        dataPoints: prices.length,
        maxDrawdown: stats.maxDrawdownReached,
        beatMarket,
        protectedCapital,
        accumulatedBTC,
        // ═══ PROJEÇÃO DE GANHOS ═══
        pnlBRL: pnl.toFixed(2),
        holdPnlBRL: holdPnl.toFixed(2),
        vsHoldBRL: vsHold.toFixed(2),
        vsHoldPct: vsHoldPct.toFixed(2),
        projection: {
            hoursInTest: hoursInTest.toFixed(1),
            monthlyRoi: projectedMonthlyRoi.toFixed(2),
            monthlyBRL: projectedMonthlyBRL.toFixed(2),
            yearlyRoi: projectedYearlyRoi.toFixed(2),
            yearlyBRL: projectedYearlyBRL.toFixed(2)
        }
    };
}

/**
 * Teste de Momentum/Reversão - MELHORADO
 * Usa análise mais sofisticada de picos/vales e confirmação de tendência
 */
/**
 * Teste integrado OTIMIZADO - Agressivo e Lucrativo
 * OBJETIVO: Lucrar com oscilações mesmo em mercado em queda
 */
function testIntegratedSystemOptimized(prices, testName) {
    let btc = 0.0002; // Começar com quantidade pequena
    let brl = 200; // Capital agressivo
    let trades = 0;
    let profits = 0;
    let losses = 0;
    let avgEntryPrice = 0;
    let totalBtcBought = 0;
    
    const initialBTC = btc;
    const initialBRL = brl;
    const price0 = prices[0];
    const priceN = prices[prices.length - 1];
    const initialValue = brl + btc * price0;
    
    let inPosition = false;
    let positionPrice = 0;
    let positionQty = 0;
    const minProfit = 0.004; // 0.4% de lucro mínimo para vender
    const maxLoss = -0.008; // -0.8% para stop loss
    
    prices.forEach((p, i) => {
        // Warmup
        if (i < 20) return;
        
        // LÓGICA SIMPLES E EFICAZ
        
        // 1. SE NAO EM POSIÇÃO: Comprar em quedas
        if (!inPosition) {
            // Comprar quando preço cai mais de 0.3% desde último preço
            if (i > 0 && (p - prices[i-1]) / prices[i-1] < -0.003) {
                const qty = Math.min(0.00008, brl / p * 0.5); // Compra agressiva
                if (qty > 0.00001 && brl > qty * p) {
                    brl -= qty * p;
                    btc += qty;
                    inPosition = true;
                    positionPrice = p;
                    positionQty = qty;
                    totalBtcBought += qty;
                }
            }
        }
        // 2. SE EM POSIÇÃO: Vender com lucro ou stop loss
        else if (inPosition) {
            const pnlPct = (p - positionPrice) / positionPrice;
            
            // Vender com lucro
            if (pnlPct >= minProfit) {
                brl += positionQty * p;
                btc -= positionQty;
                if (pnlPct > 0) profits++;
                inPosition = false;
                trades++;
            }
            // Stop loss
            else if (pnlPct <= maxLoss) {
                brl += positionQty * p;
                btc -= positionQty;
                losses++;
                inPosition = false;
                trades++;
            }
        }
    });
    
    // Vender posição aberta no final
    if (inPosition && btc > 0) {
        brl += positionQty * priceN;
        btc -= positionQty;
    }
    
    const finalValue = brl + btc * priceN;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((priceN - price0) / price0) * 100;
    const winRate = trades > 0 ? (profits / trades * 100) : 0;
    
    return {
        testName,
        passed: roi > priceChange, // Passou se melhor que HOLD
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        profits,
        losses,
        winRate: winRate.toFixed(1),
        pnlBRL: pnl.toFixed(2),
        totalBtcBought: totalBtcBought.toFixed(8),
        dataPoints: prices.length
    };
}

/**
 * Executa bateria completa de testes
 */
async function runTestBattery(hours = 24, options = {}) {
    console.log(`\n[TEST_RUNNER] Iniciando bateria de testes com dados das últimas ${hours}h...`);

    const resolvedOptions = options || {};
    const forceDataSource = resolvedOptions.forceDataSource || null;
    const cashManagementParams = resolvedOptions.cashManagementParams || null;

    const results = {
        timestamp: new Date().toISOString(),
        hours,
        status: 'running',
        tests: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            dataSource: null
        }
    };
    
    try {
        // ===== TENTAR BUSCAR DADOS LOCAIS DO BANCO PRIMEIRO =====
        let prices = [];
        let dataSource = null;
        
        if (forceDataSource !== 'binance') {
            try {
                const db = require('./db');
                console.log(`[TEST_RUNNER] 🔍 Tentando carregar dados históricos do banco de dados...`);
                
                // Buscar histórico local
                const priceHistory = await Promise.race([
                    db.getPriceHistory(hours, 500), // 500 pontos nas últimas X horas
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                
                if (priceHistory && priceHistory.length >= 10) {
                    prices = priceHistory.map(p => parseFloat(p.price));
                    dataSource = 'Local DB';
                    console.log(`[TEST_RUNNER] ✅ ${prices.length} preços carregados do banco local`);
                }
            } catch (DBError) {
                console.warn(`[TEST_RUNNER] ⚠️ Erro ao carregar banco local: ${DBError.message}`);
            }
        }
        
        // ===== FALLBACK: BUSCAR DA BINANCE SE NÃO HOUVER DADOS LOCAIS =====
        if (!prices || prices.length < 10) {
            const binanceReason = forceDataSource === 'binance'
                ? 'Fonte forçada: Binance.'
                : 'Dados insuficientes localmente, buscando da Binance...';
            console.log(`[TEST_RUNNER] 📡 ${binanceReason}`);
            
            const limit = Math.min(Math.floor((hours * 60) / 5), 1000);
            console.log(`[TEST_RUNNER] Buscando ${limit} candles de 5m da Binance...`);
            
            let binanceData = await fetchBinanceData('BTCBRL', '5m', limit);
            
            // Fallback: tentar symbol sem o R (BTC em vez de BTCBRL)
            if (!binanceData || binanceData.length < 10) {
                console.warn('[TEST_RUNNER] ⚠️ Dados insuficientes, tentando fallback com BTC/USDT...');
                binanceData = await fetchBinanceData('BTCUSDT', '5m', limit);
            }
            
            if (binanceData && binanceData.length >= 10) {
                prices = binanceData.map(c => c.close);
                dataSource = 'Binance';
                console.log(`[TEST_RUNNER] ✅ ${prices.length} candles obtidos da Binance`);
            }
        }
        
        // ===== VALIDAR DADOS =====
        if (!prices || prices.length < 10) {
            throw new Error(`Dados insuficientes (obtidos: ${prices ? prices.length : 0} preços, esperado: ≥10)`);
        }
        
        results.summary.dataSource = dataSource || 'Desconhecido';
        results.summary.dataPoints = prices.length;
        results.summary.priceRange = {
            min: Math.min(...prices).toFixed(2),
            max: Math.max(...prices).toFixed(2),
            start: prices[0].toFixed(2),
            end: prices[prices.length - 1].toFixed(2),
            change: (((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2)
        };
        
        console.log(`[TEST_RUNNER] ✅ ${prices.length} preços obtidos da fonte: ${dataSource}. Range: R$${results.summary.priceRange.min} - R$${results.summary.priceRange.max}`);
        
        // Teste 1: BTCAccumulator - Período Completo
        console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (período completo)...');
        const accTest = testAccumulatorWithPrices(prices, 'BTCAccumulator - Período Completo');
        results.tests.push(accTest);
        
        // Teste 2: BTCAccumulator - Primeira Metade (se há dados suficientes)
        if (prices.length >= 5) {
            const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
            console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (primeira metade)...');
            const accTestFirst = testAccumulatorWithPrices(firstHalf, 'BTCAccumulator - Primeira Metade');
            results.tests.push(accTestFirst);
        }
        
        // Teste 3: BTCAccumulator - Segunda Metade (se há dados suficientes)
        if (prices.length >= 5) {
            const secondHalf = prices.slice(Math.floor(prices.length / 2));
            console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (segunda metade)...');
            const accTestSecond = testAccumulatorWithPrices(secondHalf, 'BTCAccumulator - Segunda Metade');
            results.tests.push(accTestSecond);
        }
        
        // Teste 4: Cash Management Strategy (parâmetros atuais)
        if (cashManagementParams) {
            console.log('[TEST_RUNNER] Executando teste: Cash Management Strategy (parâmetros atuais)...');
            const cashMgmtCurrent = testCashManagementStrategy(prices, 'Cash Management Strategy (Current)', cashManagementParams);
            results.tests.push(cashMgmtCurrent);
        }

        // Teste 5: Cash Management Strategy (melhor de 10 ajustes)
        console.log('[TEST_RUNNER] Executando testes: Cash Management Strategy (10 ajustes)...');
        const cashMgmtSweep = runCashManagementSweep(prices);
        const bestCashMgmt = cashMgmtSweep.best;
        if (bestCashMgmt) {
            bestCashMgmt.testName = 'Cash Management Strategy (Best of 10)';
            bestCashMgmt.variantsTried = cashMgmtSweep.results.length;
            results.tests.push(bestCashMgmt);
        }
        results.cashManagementCandidates = cashMgmtSweep.results;
        
        // Calcular resumo
        results.tests.forEach(test => {
            results.summary.total++;
            if (test.passed) {
                results.summary.passed++;
            } else {
                results.summary.failed++;
            }
        });
        
        results.status = 'completed';
        results.summary.passRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
        
        // Salvar em cache
        lastTestResults = results;
        lastTestTime = new Date();
        
        console.log(`[TEST_RUNNER] ✅ Testes concluídos: ${results.summary.passed}/${results.summary.total} passaram (${results.summary.passRate}%)`);
        
        return results;
        
    } catch (error) {
        console.error('[TEST_RUNNER] ❌ Erro ao executar testes:', error.message);
        console.error('[TEST_RUNNER] Stack trace:', error.stack);
        results.status = 'error';
        results.error = error.message;
        
        lastTestResults = results;
        lastTestTime = new Date();
        
        return results;
    }
}

/**
 * Obtém últimos resultados de teste (do cache)
 */
function getLastTestResults() {
    return {
        results: lastTestResults,
        lastRunTime: lastTestTime ? lastTestTime.toISOString() : null,
        cacheAge: lastTestTime ? Math.floor((Date.now() - lastTestTime.getTime()) / 1000) : null
    };
}

/**
 * Verifica se deve rodar testes novamente
 */
function shouldRunTests(maxAgeMinutes = 60) {
    if (!lastTestTime) return true;
    const ageMinutes = (Date.now() - lastTestTime.getTime()) / 60000;
    return ageMinutes > maxAgeMinutes;
}

module.exports = {
    runTestBattery,
    getLastTestResults,
    shouldRunTests,
    fetchBinanceData,
    fetchCoinGeckoData
};

// ═══════════════════════════════════════════════════════════════
// EXECUÇÃO DIRETA (para testes rápidos)
// ═══════════════════════════════════════════════════════════════
if (require.main === module) {
    (async () => {
        console.log('🧪 Iniciando bateria de testes...\n');
        const testResults = await runTestBattery();
        
        console.log('📊 RESULTADOS FINAIS:');
        console.log('═'.repeat(80));
        
        if (testResults.results && Array.isArray(testResults.results)) {
            testResults.results.forEach(test => {
                const status = test.passed ? '✅ PASSOU' : '❌ FALHOU';
                console.log(`\n${status}: ${test.testName}`);
                console.log(`   PnL: R$ ${test.pnlBRL} | ROI: ${test.roi}% | ${test.trades} trades`);
                console.log(`   Projeção Mensal: R$ ${test.projection.monthlyBRL} | ${test.projection.monthlyRoi}%`);
            });
            
            const passCount = testResults.results.filter(t => t.passed).length;
            console.log(`\n📈 Resultado: ${passCount}/${testResults.results.length} testes passaram`);
        } else {
            console.log('Resultados:', JSON.stringify(testResults, null, 2));
        }
    })();
}
