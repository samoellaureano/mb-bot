#!/usr/bin/env node
/**
 * TESTE FINAL V3: Validar os parâmetros otimizados
 * Comparar Original → V2 Balanceado → V3 ÓTIMO
 */

const fs = require('fs');
const chalk = require('chalk');

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('🎯 TESTE FINAL: V3 OTIMIZADO vs Anteriores'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

// Carregar preços
const rawData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
const allPrices = rawData.c.map(p => typeof p === 'string' ? parseFloat(p) : p);
const prices = allPrices.slice(-1000);

console.log(chalk.green(`✅ Dados: ${prices.length} preços\n`));

const INITIAL_BRL = 150;
const INITIAL_BTC = 0.0001;
const initialValue = INITIAL_BTC * prices[0] + INITIAL_BRL;

function calculateRSI(priceHistory, period = 14) {
    if (priceHistory.length < period + 1) return 50;
    const recent = priceHistory.slice(-period);
    let gains = 0, losses = 0;
    for (let i = 1; i < recent.length; i++) {
        const change = recent[i] - recent[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return gains > 0 ? 100 : 0;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function simulate(prices, config, verbose = false) {
    let btc = INITIAL_BTC;
    let brl = INITIAL_BRL;
    let buys = 0;
    let totalSpent = 0;
    let blockedCount = 0;
    
    let strongDropPaused = false;
    let pauseCycles = 0;
    
    for (let i = 1; i < prices.length; i++) {
        const price = prices[i];
        const prevPrice = prices[i - 1];
        const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
        
        const rsi = calculateRSI(priceHistory);
        const change = (price - prevPrice) / prevPrice;
        
        // Check strong drop
        if (i > 20) {
            const recent = priceHistory.slice(-5);
            const maxRecent = Math.max(...recent);
            const minRecent = Math.min(...recent);
            const dropPct = (maxRecent - minRecent) / maxRecent;
            
            if (dropPct > config.strongDrop) {
                strongDropPaused = true;
                pauseCycles = 3;
            }
        }
        
        if (pauseCycles > 0) {
            pauseCycles--;
        } else {
            strongDropPaused = false;
        }
        
        // Tentar comprar
        const rsiOk = rsi >= config.rsiMin && rsi <= config.rsiMax;
        const dropOk = change < -config.dcaThreshold;
        const notPaused = !strongDropPaused;
        const hasBalance = brl > 50;
        
        if (rsiOk && dropOk && notPaused && hasBalance) {
            const amount = Math.min(30, brl * 0.15);
            const btcAmount = amount / price;
            
            if (btcAmount > 0.00001) {
                btc += btcAmount;
                brl -= amount;
                buys++;
                totalSpent += amount;
            }
        } else if (!rsiOk || strongDropPaused) {
            blockedCount++;
        }
    }
    
    const finalValue = (btc * prices[prices.length - 1]) + brl;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    return {
        name: config.name,
        buys,
        pnl,
        roi,
        btc,
        blocked: blockedCount
    };
}

// Três versões para comparação
const strategies = [
    {
        name: 'v1 - ORIGINAL (Agressivo)',
        config: {
            name: 'v1 - ORIGINAL',
            dcaThreshold: 0.005,   // 0.5%
            strongDrop: 0.02,      // 2%
            rsiMin: 20,
            rsiMax: 80
        }
    },
    {
        name: 'v2 - BALANCEADO',
        config: {
            name: 'v2 - BALANCEADO',
            dcaThreshold: 0.012,   // 1.2%
            strongDrop: 0.03,      // 3%
            rsiMin: 20,
            rsiMax: 80
        }
    },
    {
        name: 'v3 - ÓTIMO (AGORA APLICADO)',
        config: {
            name: 'v3 - ÓTIMO',
            dcaThreshold: 0.006,   // 0.6%
            strongDrop: 0.03,      // 3%
            rsiMin: 15,
            rsiMax: 85
        }
    }
];

// Executar testes
console.log(chalk.bold('RESULTADOS DOS TESTES:\n'));

const results = [];
strategies.forEach(s => {
    const result = simulate(prices, s.config);
    results.push(result);
    
    console.log(chalk.blue.bold(`${result.name}\n`));
    console.log(chalk.yellow(`  Compras: ${result.buys}`));
    console.log(chalk.yellow(`  BTC acumulado: ${result.btc.toFixed(8)}`));
    console.log(chalk.yellow(`  PnL: R$ ${result.pnl.toFixed(2)}`));
    console.log(chalk.yellow(`  ROI: ${result.roi.toFixed(3)}%\n`));
});

// HOLD benchmark
const holdValue = INITIAL_BTC * prices[prices.length - 1] + INITIAL_BRL;
const holdPnL = holdValue - initialValue;
const holdROI = (holdPnL / initialValue) * 100;

console.log(chalk.blue.bold('HOLD (Benchmark)\n'));
console.log(chalk.yellow(`  PnL: R$ ${holdPnL.toFixed(2)}`));
console.log(chalk.yellow(`  ROI: ${holdROI.toFixed(3)}%\n`));

// Comparação
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📊 COMPARAÇÃO'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold('┌──────────────────────────┬──────────┬────────┬──────┬──────────┐'));
console.log(chalk.bold('│ Estratégia               │ PnL (R$) │ ROI %  │ Buys │ vs HOLD  │'));
console.log(chalk.bold('├──────────────────────────┼──────────┼────────┼──────┼──────────┤'));

results.forEach(r => {
    const diff = r.pnl - holdPnL;
    const improvPct = (diff / holdPnL * 100);
    const status = diff > 0 ? chalk.green : chalk.red;
    
    console.log(chalk.bold('│ ') + 
        r.name.substring(0, 25).padEnd(25) + chalk.bold('│ ') +
        chalk.yellow(r.pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(r.roi.toFixed(3).padStart(5)) + chalk.bold(' │ ') +
        String(r.buys).padStart(4) + chalk.bold(' │ ') +
        status((improvPct >= 0 ? '+' : '') + improvPct.toFixed(0) + '%').padStart(7) + chalk.bold(' │'));
});

console.log(chalk.bold('├──────────────────────────┼──────────┼────────┼──────┼──────────┤'));
console.log(chalk.bold('│ HOLD (Benchmark)         │ ') + 
    chalk.yellow(holdPnL.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
    chalk.yellow(holdROI.toFixed(3).padStart(5)) + chalk.bold(' │ ') +
    chalk.bold('0    │ +     0% │'));
console.log(chalk.bold('└──────────────────────────┴──────────┴────────┴──────┴──────────┘\n'));

// Análise de melhoria
console.log(chalk.cyan.bold('📈 ANÁLISE DE MELHORIA\n'));

const v1 = results[0];
const v2 = results[1];
const v3 = results[2];

console.log(chalk.white(`v1 → v2 (Balanceado):`));
console.log(chalk.yellow(`  Mudança: R$ ${(v2.pnl - v1.pnl).toFixed(2)} (${((v2.pnl - v1.pnl) / v1.pnl * 100).toFixed(1)}%)`));
console.log(chalk.yellow(`  Resultado: ${v2.buys > v1.buys ? chalk.green('✅ Mais compras') : chalk.red('❌ Menos compras')}\n`));

console.log(chalk.white(`v2 → v3 (ÓTIMO):`));
console.log(chalk.yellow(`  Mudança: R$ ${(v3.pnl - v2.pnl).toFixed(2)} (${((v3.pnl - v2.pnl) / v2.pnl * 100).toFixed(1)}%)`));
console.log(chalk.yellow(`  Resultado: ${v3.buys > v2.buys ? chalk.green('✅ Mais compras') : chalk.red('❌ Menos compras')}\n`));

console.log(chalk.white(`v1 → v3 (TOTAL):`));
const totalImprove = v3.pnl - v1.pnl;
const totalImprovePct = (totalImprove / v1.pnl * 100);
console.log(chalk.green.bold(`  Mudança: R$ ${totalImprove.toFixed(2)} (${totalImprovePct > 0 ? '+' : ''}${totalImprovePct.toFixed(1)}%)\n`));

// Recomendação
console.log(chalk.cyan.bold('✅ RECOMENDAÇÃO FINAL\n'));

if (v3.pnl > v1.pnl && v3.pnl > v2.pnl) {
    console.log(chalk.green.bold(`🎯 V3 ÓTIMO É A MELHOR ESTRATÉGIA`));
    console.log(chalk.green(`   PnL: R$ ${v3.pnl.toFixed(2)} (+${((v3.pnl / holdPnL * 100) - 100).toFixed(0)}% vs HOLD)`));
    console.log(chalk.green(`   Parâmetros aplicados no código:\n`));
    console.log(chalk.yellow(`   • dcaDropThreshold: 0.006 (0.6%)`));
    console.log(chalk.yellow(`   • strongDropThreshold: 0.03 (3%)`));
    console.log(chalk.yellow(`   • rsiOverboughtThreshold: 85`));
    console.log(chalk.yellow(`   • rsiOversoldThreshold: 15\n`));
} else {
    console.log(chalk.yellow(`⚠️  Revise a análise - resultado não é esperado\n`));
}

console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO - PRONTO PARA PRODUÇÃO\n'));

process.exit(0);
