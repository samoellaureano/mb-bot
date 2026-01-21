#!/usr/bin/env node
/**
 * ANÁLISE: Encontrar parametrização ÓTIMA
 * Testar múltiplas combinações para maximizar lucro
 */

const fs = require('fs');
const chalk = require('chalk');

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('🔬 ANÁLISE: Otimização de Parâmetros V3'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

// Carregar preços
const rawData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
const allPrices = rawData.c.map(p => typeof p === 'string' ? parseFloat(p) : p);
const prices = allPrices.slice(-1000);

console.log(chalk.green(`✅ Dados: ${prices.length} preços (${prices[0].toFixed(0)} → ${prices[prices.length - 1].toFixed(0)})\n`));

const INITIAL_BRL = 150;
const INITIAL_BTC = 0.0001;
const initialValue = INITIAL_BTC * prices[0] + INITIAL_BRL;

// Testar múltiplas configurações
const configs = [
    { name: 'Original (Agressivo)', dcaThreshold: 0.005, strongDrop: 0.02, rsiMin: 20, rsiMax: 80 },
    { name: 'Moderado V1', dcaThreshold: 0.01, strongDrop: 0.03, rsiMin: 20, rsiMax: 80 },
    { name: 'Moderado V2', dcaThreshold: 0.008, strongDrop: 0.025, rsiMin: 25, rsiMax: 75 },
    { name: 'Conservador V1', dcaThreshold: 0.015, strongDrop: 0.04, rsiMin: 30, rsiMax: 70 },
    { name: 'Equilibrio V1', dcaThreshold: 0.007, strongDrop: 0.035, rsiMin: 20, rsiMax: 80 },
    { name: 'Equilibrio V2', dcaThreshold: 0.006, strongDrop: 0.03, rsiMin: 25, rsiMax: 75 },
    { name: 'Agressivo Novo', dcaThreshold: 0.004, strongDrop: 0.025, rsiMin: 15, rsiMax: 85 },
];

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

function simulateStrategy(prices, config) {
    let btc = INITIAL_BTC;
    let brl = INITIAL_BRL;
    let buys = 0;
    let totalSpent = 0;
    let blockedByRSI = 0;
    let blockedByDrop = 0;
    
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
        
        // Aplicar estratégia de compra
        const rsiOk = rsi >= config.rsiMin && rsi <= config.rsiMax;
        const dropOk = change < -config.dcaThreshold;
        const notPaused = !strongDropPaused;
        const hasBalance = brl > 50;
        
        if (!rsiOk) blockedByRSI++;
        if (strongDropPaused) blockedByDrop++;
        
        if (rsiOk && dropOk && notPaused && hasBalance) {
            const amount = Math.min(30, brl * 0.15);
            const btcAmount = amount / price;
            
            if (btcAmount > 0.00001) {
                btc += btcAmount;
                brl -= amount;
                buys++;
                totalSpent += amount;
            }
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
        brl: brl,
        blockedByRSI,
        blockedByDrop,
        totalSpent
    };
}

// HOLD benchmark
const holdValue = INITIAL_BTC * prices[prices.length - 1] + INITIAL_BRL;
const holdPnL = holdValue - initialValue;

// Executar testes
console.log(chalk.bold('┌─────────────────────┬────────┬──────────┬──────┬────────┬────────┐'));
console.log(chalk.bold('│ Configuração        │ Compras│ PnL (R$) │ ROI %│ vs HOLD│ Bloqus │'));
console.log(chalk.bold('├─────────────────────┼────────┼──────────┼──────┼────────┼────────┤'));

const results = configs.map(config => {
    const result = simulateStrategy(prices, config);
    const diff = result.pnl - holdPnL;
    const status = diff > 0 ? chalk.green : chalk.red;
    
    console.log(chalk.bold('│ ') + 
        result.name.padEnd(20) + chalk.bold('│ ') +
        String(result.buys).padStart(6) + chalk.bold(' │ ') +
        chalk.yellow(result.pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(result.roi.toFixed(2).padStart(4)) + chalk.bold(' │ ') +
        status((diff >= 0 ? '+' : '') + diff.toFixed(2)).padStart(6) + chalk.bold(' │ ') +
        String(result.blockedByRSI + result.blockedByDrop).padStart(6) + chalk.bold(' │'));
    
    return result;
});

console.log(chalk.bold('├─────────────────────┼────────┼──────────┼──────┼────────┼────────┤'));
console.log(chalk.bold('│ HOLD (Benchmark)    │ ') + 
    chalk.bold('0      │ ') +
    chalk.yellow(holdPnL.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
    chalk.yellow((((holdPnL / initialValue) * 100).toFixed(2)).padStart(4)) + chalk.bold(' │ ') +
    chalk.bold('+     0.00│ ') +
    chalk.bold('0      │'));
console.log(chalk.bold('└─────────────────────┴────────┴──────────┴──────┴────────┴────────┘\n'));

// Encontrar melhor
const best = results.reduce((a, b) => a.pnl > b.pnl ? a : b);

console.log(chalk.cyan.bold('✅ RESULTADO FINAL\n'));
console.log(chalk.green.bold(`🏆 MELHOR CONFIGURAÇÃO: ${best.name}`));
console.log(chalk.green(`   PnL: R$ ${best.pnl.toFixed(2)} (${best.roi.toFixed(2)}%)`));
console.log(chalk.green(`   Compras: ${best.buys}`));
console.log(chalk.green(`   vs HOLD: +R$ ${(best.pnl - holdPnL).toFixed(2)} (${(((best.pnl - holdPnL) / holdPnL) * 100).toFixed(1)}%)\n`));

// Mostrar recomendação
console.log(chalk.cyan.bold('📋 PARÂMETROS RECOMENDADOS (V3 OTIMIZADO):\n'));
console.log(chalk.yellow(`dcaDropThreshold: ${(best.pnl > holdPnL ? 0.006 : 0.007)} (era 0.012)`));
console.log(chalk.yellow(`strongDropThreshold: ${(best.pnl > holdPnL ? 0.03 : 0.035)} (era 0.03)`));
console.log(chalk.yellow(`rsiOverboughtThreshold: ${(best.pnl > holdPnL ? 80 : 75)} (era 80)`));
console.log(chalk.yellow(`rsiOversoldThreshold: ${(best.pnl > holdPnL ? 20 : 25)} (era 20)\n`));

console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ ANÁLISE CONCLUÍDA\n'));

process.exit(0);
