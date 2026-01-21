#!/usr/bin/env node
/**
 * TESTE FINAL: DCA Puro vs HOLD
 * Simula acumulo de BTC sem vendas (apenas DCA)
 * Verifica se filters melhoram o resultado de longo prazo
 */

const fs = require('fs');
const chalk = require('chalk');

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📈 TESTE FINAL: Estratégia DCA vs HOLD'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

// Carregar preços reais
const rawData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
const pricesRaw = rawData.c || [];
const allPrices = pricesRaw.map(p => typeof p === 'string' ? parseFloat(p) : p);

// Usar últimos 1000 preços para teste rápido
const prices = allPrices.slice(-1000);

console.log(chalk.green(`✅ Carregados ${prices.length} preços de teste`));
console.log(chalk.yellow(`  Período: R$ ${prices[0].toFixed(2)} → R$ ${prices[prices.length - 1].toFixed(2)}`));
console.log(chalk.yellow(`  Variação: ${(((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2)}%\n`));

const INITIAL_BRL = 150;
const INITIAL_BTC = 0.0001;

// Função para calcular RSI
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

// Estratégia 1: DCA SEM FILTROS
console.log(chalk.blue.bold('Strategy 1: DCA SEM FILTROS\n'));

let btc1 = INITIAL_BTC;
let brl1 = INITIAL_BRL;
let buys1 = 0;
let totalSpent1 = 0;

for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
    
    // Simular DCA agressivo (compra sempre que cai 0.5%)
    if (i > 0) {
        const change = (price - prices[i - 1]) / prices[i - 1];
        
        // Comprar se caiu 0.5% e temos BRL
        if (change < -0.005 && brl1 > 50) {
            const amount = Math.min(30, brl1 * 0.15);
            const btcAmount = amount / price;
            
            if (btcAmount > 0.00001) {
                btc1 += btcAmount;
                brl1 -= amount;
                buys1++;
                totalSpent1 += amount;
            }
        }
    }
}

const pnl1 = (btc1 * prices[prices.length - 1]) + brl1 - (INITIAL_BTC * prices[0] + INITIAL_BRL);
const initialValue = INITIAL_BTC * prices[0] + INITIAL_BRL;
const roi1 = (pnl1 / initialValue) * 100;

console.log(chalk.yellow(`  Compras: ${buys1}`));
console.log(chalk.yellow(`  BTC acumulado: ${btc1.toFixed(8)}`));
console.log(chalk.yellow(`  BRL restante: R$ ${brl1.toFixed(2)}`));
console.log(chalk.yellow(`  Total gasto em BTC: R$ ${totalSpent1.toFixed(2)}`));
console.log(chalk.yellow(`  Valor final: R$ ${((btc1 * prices[prices.length - 1]) + brl1).toFixed(2)}`));
console.log(chalk.yellow(`  PnL: R$ ${pnl1.toFixed(2)} (${roi1.toFixed(3)}%)\n`));

// Estratégia 2: DCA COM FILTROS (mais conservador)
console.log(chalk.blue.bold('Strategy 2: DCA COM FILTROS\n'));

let btc2 = INITIAL_BTC;
let brl2 = INITIAL_BRL;
let buys2 = 0;
let totalSpent2 = 0;
let blockedCount = 0;

// Simular pause de quedas fortes
let strongDropPaused = false;
let pauseCycles = 0;

for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
    
    const rsi = calculateRSI(priceHistory);
    
    // Determinar se está em queda forte (>3%)
    if (i > 20) {
        const recent = priceHistory.slice(-5);
        const maxRecent = Math.max(...recent);
        const minRecent = Math.min(...recent);
        const dropPct = (maxRecent - minRecent) / maxRecent;
        
        if (dropPct > 0.03) {
            strongDropPaused = true;
            pauseCycles = 5;
        }
    }
    
    if (pauseCycles > 0) {
        pauseCycles--;
        blockedCount++;
    }
    
    // Comprar se condições atendidas
    if (i > 0 && !strongDropPaused && pauseCycles === 0 && brl2 > 50) {
        const change = (price - prices[i - 1]) / prices[i - 1];
        const rsiOk = rsi >= 20 && rsi <= 80; // Não overbought/oversold
        
        // Comprar se caiu 1.2% e RSI está ok
        if (change < -0.012 && rsiOk) {
            const amount = Math.min(30, brl2 * 0.15);
            const btcAmount = amount / price;
            
            if (btcAmount > 0.00001) {
                btc2 += btcAmount;
                brl2 -= amount;
                buys2++;
                totalSpent2 += amount;
            }
        }
    }
}

const pnl2 = (btc2 * prices[prices.length - 1]) + brl2 - (INITIAL_BTC * prices[0] + INITIAL_BRL);
const roi2 = (pnl2 / initialValue) * 100;

console.log(chalk.yellow(`  Compras: ${buys2}`));
console.log(chalk.yellow(`  Bloqueadas: ${blockedCount}`));
console.log(chalk.yellow(`  BTC acumulado: ${btc2.toFixed(8)}`));
console.log(chalk.yellow(`  BRL restante: R$ ${brl2.toFixed(2)}`));
console.log(chalk.yellow(`  Total gasto em BTC: R$ ${totalSpent2.toFixed(2)}`));
console.log(chalk.yellow(`  Valor final: R$ ${((btc2 * prices[prices.length - 1]) + brl2).toFixed(2)}`));
console.log(chalk.yellow(`  PnL: R$ ${pnl2.toFixed(2)} (${roi2.toFixed(3)}%)\n`));

// HOLD Benchmark
const finalPrice = prices[prices.length - 1];
const holdValue = INITIAL_BTC * finalPrice + INITIAL_BRL;
const holdPnL = holdValue - initialValue;
const holdROI = (holdPnL / initialValue) * 100;

console.log(chalk.blue.bold('HOLD Benchmark\n'));
console.log(chalk.yellow(`  Valor final: R$ ${holdValue.toFixed(2)}`));
console.log(chalk.yellow(`  PnL: R$ ${holdPnL.toFixed(2)} (${holdROI.toFixed(3)}%)\n`));

// Comparação
console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📊 COMPARAÇÃO'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold('┌──────────────────┬──────────┬────────┬──────┬─────────────┐'));
console.log(chalk.bold('│ Estratégia       │ PnL (R$) │ ROI %  │ Buys │ vs HOLD     │'));
console.log(chalk.bold('├──────────────────┼──────────┼────────┼──────┼─────────────┤'));

const printRow = (name, pnl, roi, buys) => {
    const diff = pnl - holdPnL;
    const status = diff > 0 ? chalk.green : chalk.red;
    console.log(chalk.bold('│ ') +
        name.padEnd(17) + chalk.bold('│ ') +
        chalk.yellow(pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(roi.toFixed(3).padStart(5)) + chalk.bold(' │ ') +
        String(buys).padStart(4) + chalk.bold(' │ ') +
        status((diff >= 0 ? '+' : '') + diff.toFixed(2).padStart(9)) + chalk.bold(' │'));
};

printRow('HOLD', holdPnL, holdROI, 0);
printRow('DCA Sem Filtros', pnl1, roi1, buys1);
printRow('DCA Com Filtros', pnl2, roi2, buys2);

console.log(chalk.bold('└──────────────────┴──────────┴────────┴──────┴─────────────┘\n'));

// Análise final
console.log(chalk.cyan.bold('✅ ANÁLISE FINAL\n'));

const improvement = pnl2 - pnl1;
const improvementPct = (improvement / Math.abs(pnl1 || 1)) * 100;

console.log(chalk.white(`Comparação entre estratégias:`));
console.log(chalk.yellow(`  DCA Sem Filtros: R$ ${pnl1.toFixed(2)} (${buys1} compras)`));
console.log(chalk.yellow(`  DCA Com Filtros: R$ ${pnl2.toFixed(2)} (${buys2} compras)`));
console.log(chalk.yellow(`  Diferença:       R$ ${improvement.toFixed(2)} (${improvementPct > 0 ? '+' : ''}${improvementPct.toFixed(1)}%)\n`));

console.log(chalk.white(`Performance vs HOLD:`));
if (pnl1 > holdPnL) {
    console.log(chalk.green(`  ✅ DCA Sem Filtros SUPEROU HOLD: +R$ ${(pnl1 - holdPnL).toFixed(2)}`));
} else {
    console.log(chalk.red(`  ❌ DCA Sem Filtros ABAIXO de HOLD: -R$ ${Math.abs(pnl1 - holdPnL).toFixed(2)}`));
}

if (pnl2 > holdPnL) {
    console.log(chalk.green(`  ✅ DCA Com Filtros SUPEROU HOLD: +R$ ${(pnl2 - holdPnL).toFixed(2)}`));
} else {
    console.log(chalk.red(`  ❌ DCA Com Filtros ABAIXO de HOLD: -R$ ${Math.abs(pnl2 - holdPnL).toFixed(2)}`));
}

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO\n'));

// Recomendação
console.log(chalk.green.bold('🚀 RECOMENDAÇÃO PARA PRODUÇÃO:\n'));

if (pnl2 >= pnl1) {
    console.log(chalk.green(`✅ Usar Estratégia COM FILTROS (mais segura)`));
    console.log(chalk.green(`   - Mesma performance: ${pnl2.toFixed(2)}`));
    console.log(chalk.green(`   - Melhor proteção contra volatilidade`));
    console.log(chalk.green(`   - RSI filter evita overbought/oversold`));
    console.log(chalk.green(`   - Strong drop pause evita comprar no pior momento\n`));
} else {
    console.log(chalk.yellow(`⚠️  DCA Sem Filtros tem melhor PnL: +R$ ${Math.abs(pnl1 - pnl2).toFixed(2)}`));
    console.log(chalk.yellow(`   Porém, COM FILTROS oferece mais proteção\n`));
}

process.exit(0);
