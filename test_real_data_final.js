#!/usr/bin/env node
/**
 * TESTE COM DADOS REAIS DOS CANDLES
 * Simula DCA (Dollar Cost Averaging) com dados históricos reais
 * Compara: SEM FILTROS vs COM FILTROS V2
 */

const fs = require('fs');
const chalk = require('chalk');
const BTCAccumulator = require('./btc_accumulator');

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('🧪 TESTE: BTCAccumulator COM DADOS REAIS'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

// Carregar candles reais
let rawData;
try {
    rawData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
} catch (err) {
    console.error(chalk.red(`❌ Erro ao carregar candles: ${err.message}`));
    process.exit(1);
}

// Extrair preços (formato OHLCV)
const pricesRaw = rawData.c || []; // 'c' é close price
const prices = pricesRaw.map(p => typeof p === 'string' ? parseFloat(p) : p);
console.log(chalk.green(`✅ Carregados ${prices.length} preços reais`));
console.log(chalk.yellow(`  Preço inicial: R$ ${prices[0].toFixed(2)}`));
console.log(chalk.yellow(`  Preço final: R$ ${prices[prices.length - 1].toFixed(2)}`));
console.log(chalk.yellow(`  Variação: ${(((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2)}%\n`));

// Tomar apenas últimos 1000 preços para teste mais rápido
const testPrices = prices.slice(-1000);
console.log(chalk.blue(`📊 Usando últimos ${testPrices.length} preços para teste rápido\n`));

// Configurações dos testes
const initialBRL = 150;
const initialBTC = 0.0001;

const configs = {
    'SEM_FILTROS': {
        name: 'SEM FILTROS (Baseline)',
        options: {
            dcaDropThreshold: 0.005,  // 0.5% (original)
            strongDropThreshold: 0.02, // 2% (original)
            trendFilterEnabled: false,
            rsiFilterEnabled: false,
            stopLossEnabled: false,
        }
    },
    'COM_FILTROS': {
        name: 'COM FILTROS V2 (BALANCEADO)',
        options: {
            dcaDropThreshold: 0.012,  // 1.2% (BALANCEADO)
            strongDropThreshold: 0.03, // 3% (BALANCEADO)
            trendFilterEnabled: true,
            blockOnBearishTrend: true,
            rsiFilterEnabled: true,
            rsiOverboughtThreshold: 80,
            rsiOversoldThreshold: 20,
            stopLossEnabled: true,
            stopLossThreshold: 0.075,  // 7.5% (BALANCEADO)
            reversalConfirmationCycles: 4,
        }
    }
};

// Função para calcular RSI simples
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    for (let i = Math.max(0, prices.length - period); i < prices.length; i++) {
        if (i === 0) continue;
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 1);
    return 100 - (100 / (1 + rs));
}

// Função para determinar tendência
function getTrend(prices, period = 20) {
    if (prices.length < period) return 'NEUTRAL';
    
    let ema = prices[0];
    const k = 2 / (period + 1);
    
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    
    const currentPrice = prices[prices.length - 1];
    if (currentPrice > ema * 1.01) return 'BULLISH';
    if (currentPrice < ema * 0.99) return 'BEARISH';
    return 'NEUTRAL';
}

// Simular estratégia
function simulateStrategy(prices, configName, config) {
    const accumulator = new BTCAccumulator(config.options);
    
    let btcBalance = initialBTC;
    let brlBalance = initialBRL;
    let totalBought = 0;
    let totalBoughtCount = 0;
    let blockedCount = 0;
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
        
        // Calcular indicadores
        const rsi = calculateRSI(priceHistory, 14);
        const trend = getTrend(priceHistory, 20);
        
        // Registrar preço
        accumulator.recordPrice(price);
        
        // Tentar DCA
        const shouldBuy = accumulator.shouldDCA(
            price,
            brlBalance,
            trend,
            rsi,
            btcBalance,
            initialBRL + initialBTC * prices[0]
        );
        
        if (shouldBuy && brlBalance > 100) {
            const orderSize = Math.max(50, brlBalance * 0.1); // 10% do saldo
            const orderSize_BTC = orderSize / price;
            
            if (orderSize_BTC > 0.00001) {
                btcBalance += orderSize_BTC;
                brlBalance -= orderSize_BTC * price;
                totalBought += orderSize_BTC * price;
                totalBoughtCount++;
            }
        } else if (!shouldBuy) {
            blockedCount++;
        }
    }
    
    // Calcular PnL
    const finalPrice = prices[prices.length - 1];
    const btcValue = btcBalance * finalPrice;
    const totalValue = brlBalance + btcValue;
    const initialValue = initialBRL + initialBTC * prices[0];
    const pnl = totalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    return {
        name: configName,
        pnl: pnl,
        roi: roi,
        trades: totalBoughtCount,
        blocked: blockedCount,
        btcFinal: btcBalance,
        brlFinal: brlBalance,
        totalValue: totalValue,
        initialValue: initialValue
    };
}

// Executar testes
console.log(chalk.cyan.bold('🧪 EXECUTANDO TESTES COM DADOS REAIS\n'));

const results = [];
for (const [key, config] of Object.entries(configs)) {
    const result = simulateStrategy(testPrices, config.name, config);
    results.push(result);
    
    console.log(chalk.blue(`\n--- ${result.name} ---`));
    console.log(chalk.yellow(`  Compras executadas: ${result.trades}`));
    console.log(chalk.yellow(`  Ciclos bloqueados: ${result.blocked}`));
    console.log(chalk.yellow(`  BTC final: ${result.btcFinal.toFixed(8)}`));
    console.log(chalk.yellow(`  BRL final: R$ ${result.brlFinal.toFixed(2)}`));
    console.log(chalk.yellow(`  Valor total: R$ ${result.totalValue.toFixed(2)}`));
    console.log(chalk.yellow(`  PnL: R$ ${result.pnl.toFixed(2)}`));
    console.log(chalk.yellow(`  ROI: ${result.roi.toFixed(4)}%`));
}

// HOLD benchmark
console.log(chalk.blue('\n--- HOLD (Benchmark) ---'));
const holdValue = (initialBRL + initialBTC * testPrices[testPrices.length - 1]);
const holdInitialValue = (initialBRL + initialBTC * testPrices[0]);
const holdPnL = holdValue - holdInitialValue;
const holdROI = (holdPnL / holdInitialValue) * 100;
console.log(chalk.yellow(`  PnL: R$ ${holdPnL.toFixed(2)}`));
console.log(chalk.yellow(`  ROI: ${holdROI.toFixed(4)}%`));

// Comparação
console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📊 COMPARAÇÃO DE RESULTADOS'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold('┌─────────────────────────────┬──────────┬────────┬────────┬──────┬─────────────┐'));
console.log(chalk.bold('│ Estratégia                  │ PnL (R$) │ ROI %  │ Compras│Bloq. │ Melhoria    │'));
console.log(chalk.bold('├─────────────────────────────┼──────────┼────────┼────────┼──────┼─────────────┤'));

console.log(chalk.bold('│ HOLD (Benchmark)            │ ') + 
    chalk.yellow(holdPnL.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
    chalk.yellow(holdROI.toFixed(4).padStart(6)) + chalk.bold(' │ ') +
    chalk.bold('0      │ 0    │ Referência  │'));

results.forEach((r, i) => {
    const diff = r.pnl - holdPnL;
    const pctDiff = ((r.pnl - holdPnL) / Math.abs(holdPnL || 1)) * 100;
    const status = diff >= 0 ? chalk.green('+') : chalk.red('');
    
    console.log(chalk.bold('│ ') + 
        r.name.padEnd(28) + chalk.bold('│ ') +
        chalk.yellow(r.pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(r.roi.toFixed(4).padStart(6)) + chalk.bold(' │ ') +
        String(r.trades).padStart(6) + chalk.bold(' │ ') +
        String(r.blocked).padStart(4) + chalk.bold(' │ ') +
        status + (pctDiff >= 0 ? chalk.green : chalk.red)(pctDiff.toFixed(1) + '%').padStart(10) + chalk.bold(' │'));
});

console.log(chalk.bold('└─────────────────────────────┴──────────┴────────┴────────┴──────┴─────────────┘\n'));

// Análise final
const semFiltros = results[0];
const comFiltros = results[1];

console.log(chalk.cyan.bold('📈 ANÁLISE E CONCLUSÕES\n'));

if (semFiltros && comFiltros) {
    const melhoria_absol = comFiltros.pnl - semFiltros.pnl;
    const melhoria_pct = (melhoria_absol / Math.abs(semFiltros.pnl || 1)) * 100;
    
    console.log(chalk.white(`Comparação entre estratégias:`));
    console.log(chalk.yellow(`  Sem Filtros: R$ ${semFiltros.pnl.toFixed(2)} (${semFiltros.roi.toFixed(4)}%)`));
    console.log(chalk.yellow(`  Com Filtros: R$ ${comFiltros.pnl.toFixed(2)} (${comFiltros.roi.toFixed(4)}%)`));
    console.log(chalk.yellow(`  Diferença:   R$ ${melhoria_absol.toFixed(2)} (${melhoria_pct > 0 ? '+' : ''}${melhoria_pct.toFixed(1)}%)\n`));
    
    if (comFiltros.pnl > semFiltros.pnl) {
        console.log(chalk.green(`✅ FILTROS MELHORARAM PERFORMANCE em R$ ${melhoria_absol.toFixed(2)}`));
        console.log(chalk.green(`   Reduziram compras bloqueadas: ${semFiltros.blocked} → ${comFiltros.blocked}`));
    } else {
        console.log(chalk.yellow(`⚠️  FILTROS PIORARAM ou MANTIVERAM PERFORMANCE`));
        console.log(chalk.yellow(`   Diferença: R$ ${Math.abs(melhoria_absol).toFixed(2)}`));
    }
    
    const vsHold_sem = semFiltros.pnl - holdPnL;
    const vsHold_com = comFiltros.pnl - holdPnL;
    
    console.log(chalk.white(`\nComparação vs HOLD:`));
    if (vsHold_sem > 0) console.log(chalk.green(`  Sem Filtros: +R$ ${vsHold_sem.toFixed(2)} (ACIMA de HOLD) ✅`));
    else console.log(chalk.red(`  Sem Filtros: R$ ${vsHold_sem.toFixed(2)} (ABAIXO de HOLD) ❌`));
    
    if (vsHold_com > 0) console.log(chalk.green(`  Com Filtros: +R$ ${vsHold_com.toFixed(2)} (ACIMA de HOLD) ✅`));
    else console.log(chalk.red(`  Com Filtros: R$ ${vsHold_com.toFixed(2)} (ABAIXO de HOLD) ❌`));
}

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

process.exit(0);
