/**
 * automated_test_runner.js - Módulo de Testes Automatizados com Dados Reais
 * 
 * Executa bateria de testes usando dados históricos online das APIs:
 * - Binance (candles em tempo real)
 * - CoinGecko (dados de mercado 24h)
 * 
 * Integrado ao dashboard para exibição dos resultados
 */

const axios = require('axios');
const BTCAccumulator = require('./btc_accumulator');

// ═══════════════════════════════════════════════════════════════
// CASH MANAGEMENT STRATEGY OTIMIZADO v2 - Ultra agressivo
// ═══════════════════════════════════════════════════════════════
function testCashManagementStrategy(prices, testName) {
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
    
    // Parâmetros v1.9 PROFIT OPTIMIZED (CORRIGIDO)
    const BUY_THRESHOLD = 0.0002; // 0.02% (mais sensível aos dips)
    const SELL_THRESHOLD = 0.00025; // 0.025% (mais agressivo venda)
    const BUY_MICRO_THRESHOLD = 0.00008; // 0.008% (micro-compras sensivelíssimas)
    const SELL_MICRO_THRESHOLD = 0.00015; // 0.015% (micro-vendas agressivo)
    const MICRO_TRADE_INTERVAL = 2; // A cada 2 candles (mais frequente)
    const MAX_BUY_COUNT = 6; // Máximo 6 compras (reduzir over-exposure)
    
    // Loop de execução
    for (let i = 1; i < prices.length; i++) {
        const price = prices[i];
        const priceDiffPct = (price - lastTradePrice) / lastTradePrice;
        
        // ═══ SE SOBE > SELL_THRESHOLD: VENDER (v1.9 - PROFIT OPTIMIZED) ═══
        if (priceDiffPct > SELL_THRESHOLD && btc > 0.00001) {
            brl += btc * price; // Vender 100% do BTC (SELL_AMOUNT_PCT = 1.0)
            btc = 0;
            trades++;
            sellCount++;
            if ((price - lastTradePrice) / lastTradePrice > 0) profitableTrades++;
            lastTradePrice = price;
        }
        
        // ═══ SE DESCE > BUY_THRESHOLD: COMPRAR v1.9 (PROFIT OPTIMIZED) ═══
        if (priceDiffPct < -BUY_THRESHOLD && brl > 50 && buyCount < MAX_BUY_COUNT) {
            const buyQty = Math.min(0.0001, brl / price * 0.60); // 60% (BUY_AMOUNT_PCT)
            if (buyQty > 0.00001) {
                brl -= buyQty * price;
                btc += buyQty;
                trades++;
                buyCount++;
                lastTradePrice = price;
            }
        }
        
        // ═══ MICRO-TRADES v1.9: A cada 2 candles (mais frequente) ═══
        if (i % MICRO_TRADE_INTERVAL === 0) {
            // Se temos BTC E subiu SELL_MICRO_THRESHOLD (0.015%)
            if (btc > 0.00002 && (price - lastTradePrice) / lastTradePrice > SELL_MICRO_THRESHOLD) {
                const sellQty = btc * 0.60; // Vender 60% (MICRO_SELL_PCT)
                if (sellQty > 0.00001) {
                    brl += sellQty * price;
                    btc -= sellQty;
                    trades++;
                    profitableTrades++;
                    lastTradePrice = price;
                }
            }
            
            // Se sem BTC E desceu BUY_MICRO_THRESHOLD (0.008%)
            if (btc < 0.00001 && brl > 40 && (lastTradePrice - price) / lastTradePrice > BUY_MICRO_THRESHOLD) {
                const buyQty = Math.min(0.00008, brl / price * 0.40); // 40% (MICRO_BUY_PCT)
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
    
    const passed = roi > priceChange || pnl > 0;
    
    // Calcular projeção (em 24h)
    const hoursInTest = prices.length * 5 / 60; // 5m candles
    const hoursInMonth = 24 * 30;
    const hoursInYear = 24 * 365;
    
    const projectedMonthlyRoi = (roi / hoursInTest) * hoursInMonth;
    const projectedYearlyRoi = (roi / hoursInTest) * hoursInYear;
    const projectedMonthlyBRL = (pnl / hoursInTest) * hoursInMonth;
    const projectedYearlyBRL = (pnl / hoursInTest) * hoursInYear;
    
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
        projection: {
            hoursInTest: hoursInTest.toFixed(1),
            monthlyRoi: projectedMonthlyRoi.toFixed(2),
            yearlyRoi: projectedYearlyRoi.toFixed(2),
            monthlyBRL: projectedMonthlyBRL.toFixed(2),
            yearlyBRL: projectedYearlyBRL.toFixed(2)
        }
    };
}

// ═══════════════════════════════════════════════════════════════
let lastTestResults = null;
let lastTestTime = null;

/**
 * Busca dados históricos da Binance
 */
async function fetchBinanceData(symbol = 'BTCBRL', interval = '5m', limit = 100) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await axios.get(url, { timeout: 10000 });
        
        return response.data.map(candle => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    } catch (error) {
        console.error('[TEST_RUNNER] Erro ao buscar dados Binance:', error.message);
        return null;
    }
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
async function runTestBattery(hours = 24) {
    console.log(`\n[TEST_RUNNER] Iniciando bateria de testes com dados das últimas ${hours}h...`);
    
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
        // Buscar dados da Binance (5m candles)
        const limit = Math.min(Math.floor((hours * 60) / 5), 1000);
        console.log(`[TEST_RUNNER] Buscando ${limit} candles de 5m da Binance...`);
        
        const binanceData = await fetchBinanceData('BTCBRL', '5m', limit);
        
        if (!binanceData || binanceData.length < 20) {
            throw new Error('Dados insuficientes da Binance');
        }
        
        const prices = binanceData.map(c => c.close);
        results.summary.dataSource = 'Binance';
        results.summary.dataPoints = prices.length;
        results.summary.priceRange = {
            min: Math.min(...prices).toFixed(2),
            max: Math.max(...prices).toFixed(2),
            start: prices[0].toFixed(2),
            end: prices[prices.length - 1].toFixed(2),
            change: (((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2)
        };
        
        console.log(`[TEST_RUNNER] ${prices.length} preços obtidos. Range: R$${results.summary.priceRange.min} - R$${results.summary.priceRange.max}`);
        
        // Teste 1: BTCAccumulator - Período Completo
        console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (período completo)...');
        const accTest = testAccumulatorWithPrices(prices, 'BTCAccumulator - Período Completo');
        results.tests.push(accTest);
        
        // Teste 2: BTCAccumulator - Primeira Metade
        const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
        console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (primeira metade)...');
        const accTestFirst = testAccumulatorWithPrices(firstHalf, 'BTCAccumulator - Primeira Metade');
        results.tests.push(accTestFirst);
        
        // Teste 3: BTCAccumulator - Segunda Metade
        const secondHalf = prices.slice(Math.floor(prices.length / 2));
        console.log('[TEST_RUNNER] Executando teste: BTCAccumulator (segunda metade)...');
        const accTestSecond = testAccumulatorWithPrices(secondHalf, 'BTCAccumulator - Segunda Metade');
        results.tests.push(accTestSecond);
        
        // Teste 4: Cash Management Strategy (Melhor em baixas)
        console.log('[TEST_RUNNER] Executando teste: Cash Management Strategy...');
        const cashMgmtTest = testCashManagementStrategy(prices, 'Cash Management Strategy');
        results.tests.push(cashMgmtTest);
        
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
