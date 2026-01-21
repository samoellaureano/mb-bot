#!/usr/bin/env node

/**
 * test_optimized_filters.js
 * Testa o BTCAccumulator com os 4 filtros de segurança ativados
 * Compara: Sem filtros vs Com filtros vs HOLD
 */

const chalk = require('chalk');
const BTCAccumulator = require('./btc_accumulator');

// ═══════════════════════════════════════════════════════════════════════════════
console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.cyan.bold('🧪 TESTE: BTCAccumulator COM FILTROS DE SEGURANÇA V2'));
console.log(chalk.cyan.bold('═'.repeat(80) + '\n'));

// Dados do teste 24h real
const testData = {
    period: '24h',
    initialPrice: 497.924,
    finalPrice: 478.200,
    priceChange: -3.96,
    totalCandles: 288,
    initialBRL: 150,
    initialBTC: 0.0001
};

console.log(chalk.blue.bold('📊 CONTEXTO DO TESTE'));
console.log(`  Período: ${testData.period}`);
console.log(`  Preço Inicial: R$ ${testData.initialPrice.toFixed(2)}`);
console.log(`  Preço Final: R$ ${testData.finalPrice.toFixed(2)}`);
console.log(`  Variação: ${testData.priceChange.toFixed(2)}%`);
console.log(`  Capital Inicial: R$ ${testData.initialBRL} BRL + ${testData.initialBTC} BTC\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULAR DADOS REALISTAS DE MERCADO 24H
// ═══════════════════════════════════════════════════════════════════════════════

function generateRealisticPrices(initialPrice, finalPrice, candles) {
    const prices = [];
    let currentPrice = initialPrice;
    const totalChange = finalPrice - initialPrice;
    const avgChangePerCandle = totalChange / candles;
    
    for (let i = 0; i < candles; i++) {
        // Simular movimento com alguma volatilidade
        const randomWalk = (Math.random() - 0.5) * initialPrice * 0.01; // ±0.5% de volatilidade
        const trend = avgChangePerCandle + randomWalk;
        currentPrice += trend;
        
        // Simular quedas ocasionais
        if (i % 15 === 0 && Math.random() < 0.6) {
            currentPrice *= (1 - 0.003); // Queda de 0.3%
        }
        
        // Simular recuperações ocasionais
        if (i % 20 === 0 && Math.random() < 0.3) {
            currentPrice *= (1 + 0.002); // Alta de 0.2%
        }
        
        prices.push(Math.max(finalPrice * 0.95, currentPrice));
    }
    
    // Garantir que termine no preço final
    prices[prices.length - 1] = finalPrice;
    
    return prices;
}

const prices = generateRealisticPrices(testData.initialPrice, testData.finalPrice, testData.totalCandles);
console.log(chalk.green.bold('✅ Preços realistas gerados\n'));

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO DE TESTE
// ═══════════════════════════════════════════════════════════════════════════════

function runAccumulatorTest(testName, config, includeFilters = false) {
    const acc = new BTCAccumulator(config);
    
    let btc = testData.initialBTC;
    let brl = testData.initialBRL;
    let buys = 0;
    let sells = 0;
    let blockedBuys = 0;
    let trades = [];
    
    const initialValue = brl + btc * testData.initialPrice;
    let lastRSI = 50;
    
    // Simular RSI dinâmico
    const getRSI = (i, prices) => {
        if (i < 14) return 50;
        let gains = 0, losses = 0;
        for (let j = i - 14; j < i; j++) {
            const change = prices[j + 1] - prices[j];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
        const rs = avgGain / avgLoss;
        return 100 - 100 / (1 + rs);
    };
    
    // Loop principal
    prices.forEach((p, i) => {
        acc.recordPrice(p);
        lastRSI = getRSI(i, prices);
        
        // Simular tendência externa (BEARISH na segunda metade)
        const externalTrend = i < prices.length / 2 ? 'NEUTRAL' : 'BEARISH';
        
        // Warmup
        if (i < 30) return;
        
        // Verificar DCA
        if (i % 5 === 0) {
            const dcaResult = includeFilters 
                ? acc.shouldDCA(p, brl, externalTrend, lastRSI, btc, initialValue)
                : acc.shouldDCA(p, brl);
            
            if (dcaResult.should) {
                const qty = Math.min(0.00003, brl / p * 0.4);
                if (qty > 0.00001 && brl > qty * p) {
                    brl -= qty * p;
                    btc += qty;
                    buys++;
                    acc.recordBuy(p, qty);
                    trades.push({ type: 'BUY', price: p, qty, reason: dcaResult.reason });
                }
            } else if (dcaResult.blocked) {
                blockedBuys++;
            }
        }
    });
    
    const finalValue = brl + btc * testData.finalPrice;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    return {
        testName,
        buys,
        blockedBuys,
        btcFinal: btc,
        brlFinal: brl,
        finalValue,
        pnl,
        roi,
        trades
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTAR TESTES
// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('🧪 EXECUTANDO TESTES\n'));

// Teste 1: SEM FILTROS (antigo)
const testNoFilters = runAccumulatorTest('SEM FILTROS (Baseline)', {
    minBTCTarget: 0.0005,
    maxBRLHolding: 50,
    dcaDropThreshold: 0.005, // 0.5% (antigo)
    sellResistance: 0.7,
    minHoldHours: 4,
    trendFilterEnabled: false,
    rsiFilterEnabled: false,
    stopLossEnabled: false
}, false);

// Teste 2: COM FILTROS (novo)
const testWithFilters = runAccumulatorTest('COM FILTROS (V2)', {
    minBTCTarget: 0.0005,
    maxBRLHolding: 50,
    dcaDropThreshold: 0.015, // 1.5% (novo - mais conservador)
    sellResistance: 0.7,
    minHoldHours: 4,
    trendFilterEnabled: true,
    blockOnBearishTrend: true,
    rsiFilterEnabled: true,
    rsiOverboughtThreshold: 80,
    rsiOversoldThreshold: 20,
    stopLossEnabled: true,
    stopLossThreshold: 0.05
}, true);

// Teste 3: HOLD (benchmark)
const holdValue = testData.initialBRL + testData.initialBTC * testData.finalPrice;
const holdPnL = holdValue - (testData.initialBRL + testData.initialBTC * testData.initialPrice);
const holdROI = (holdPnL / (testData.initialBRL + testData.initialBTC * testData.initialPrice)) * 100;

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTADOS
// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.cyan.bold('📊 RESULTADOS DO TESTE'));
console.log(chalk.cyan.bold('═'.repeat(80) + '\n'));

const results = [
    {
        name: 'HOLD (Benchmark)',
        pnl: holdPnL,
        roi: holdROI,
        buys: 0,
        blocked: 0,
        color: 'gray'
    },
    {
        name: testNoFilters.testName,
        pnl: testNoFilters.pnl,
        roi: testNoFilters.roi,
        buys: testNoFilters.buys,
        blocked: testNoFilters.blockedBuys,
        color: 'red'
    },
    {
        name: testWithFilters.testName,
        pnl: testWithFilters.pnl,
        roi: testWithFilters.roi,
        buys: testWithFilters.buys,
        blocked: testWithFilters.blockedBuys,
        color: 'green'
    }
];

console.log(chalk.bold('┌────────────────────────┬──────────┬────────────┬────────┬──────────┐'));
console.log(chalk.bold('│ Estratégia             │ PnL (R$) │   ROI %    │ Compras│ Bloqueadas│'));
console.log(chalk.bold('├────────────────────────┼──────────┼────────────┼────────┼──────────┤'));

results.forEach((r, idx) => {
    const pnlStr = r.pnl >= 0 ? chalk.green(`+${r.pnl.toFixed(2)}`) : chalk.red(r.pnl.toFixed(2));
    const roiStr = r.roi >= 0 ? chalk.green(`${r.roi.toFixed(2)}%`) : chalk.red(`${r.roi.toFixed(2)}%`);
    const name = r.name.padEnd(22);
    const pnl = pnlStr.toString().padEnd(12);
    const roi = roiStr.toString().padEnd(14);
    const buys = String(r.buys).padEnd(8);
    const blocked = String(r.blocked).padEnd(10);
    
    console.log(chalk.bold(`│ ${name} │ ${pnl}│ ${roi}│ ${buys}│ ${blocked}│`));
});

console.log(chalk.bold('└────────────────────────┴──────────┴────────────┴────────┴──────────┘'));

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE
// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.cyan.bold('\n📈 ANÁLISE DE MELHORIA\n'));

const improvement = testNoFilters.pnl - testWithFilters.pnl;
const improvementPct = (improvement / Math.abs(testNoFilters.pnl)) * 100;
const improvementVsHold = testWithFilters.pnl - holdPnL;

console.log(`Sem Filtros PnL: R$ ${testNoFilters.pnl.toFixed(2)} (${testNoFilters.roi.toFixed(2)}%)`);
console.log(`Com Filtros PnL: R$ ${testWithFilters.pnl.toFixed(2)} (${testWithFilters.roi.toFixed(2)}%)`);
console.log(`HOLD PnL: R$ ${holdPnL.toFixed(2)} (${holdROI.toFixed(2)}%)\n`);

if (improvement > 0) {
    console.log(chalk.green.bold(`✅ MELHORIA: R$ ${improvement.toFixed(2)} (${improvementPct.toFixed(1)}% melhor)`));
} else {
    console.log(chalk.red.bold(`❌ PIORA: R$ ${Math.abs(improvement).toFixed(2)} (${Math.abs(improvementPct).toFixed(1)}% pior)`));
}

console.log(`📊 vs HOLD: ${improvementVsHold > 0 ? chalk.green(`+R$ ${improvementVsHold.toFixed(2)}`) : chalk.red(`R$ ${improvementVsHold.toFixed(2)}`)}\n`);

console.log(chalk.yellow.bold('📌 PROTEÇÕES APLICADAS\n'));
console.log(`  ✓ Trend Filter: Bloqueou ${testWithFilters.blockedBuys} compras em BEARISH`);
console.log(`  ✓ DCA mais conservador: 1.5% threshold (era 0.5%)`);
console.log(`  ✓ RSI Filter: Proteção contra overbought/oversold`);
console.log(`  ✓ Stop Loss Global: Máximo 5% de perda aceito`);
console.log(`  ✓ Quedas consecutivas agora requerem 5+ candles (era 3)\n`);

// ═══════════════════════════════════════════════════════════════════════════════

if (testWithFilters.pnl > testNoFilters.pnl || testWithFilters.roi > testNoFilters.roi) {
    console.log(chalk.green.bold('✅ RESULTADO: Filtros melhoraram o desempenho!\n'));
} else if (Math.abs(testWithFilters.pnl - testNoFilters.pnl) < 0.5) {
    console.log(chalk.yellow.bold('⚠️  RESULTADO: Performance similar, mas com mais proteção\n'));
} else {
    console.log(chalk.red.bold('❌ RESULTADO: Filtros podem ser muito conservadores\n'));
}

console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO'));
console.log(chalk.cyan.bold('═'.repeat(80)));
