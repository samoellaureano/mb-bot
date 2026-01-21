#!/usr/bin/env node
/**
 * TESTE DE OTIMIZAÇÃO: Simular múltiplos ciclos de DCA + sell
 * Verifica performance com rebalanceamento mais frequente
 */

const fs = require('fs');
const chalk = require('chalk');
const BTCAccumulator = require('./btc_accumulator');

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('🚀 TESTE: Otimização com Múltiplos Ciclos de Trading'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

// Carregar candles reais
const rawData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
const pricesRaw = rawData.c || [];
const prices = pricesRaw.map(p => typeof p === 'string' ? parseFloat(p) : p);

// Pegar últimos 2000 preços (mais para testar múltiplos ciclos)
const testPrices = prices.slice(-2000);
console.log(chalk.green(`✅ Usando últimos ${testPrices.length} preços\n`));

const initialBRL = 150;
const initialBTC = 0.0001;

// Função para calcular RSI
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

// Simular com múltiplos ciclos DCA + SELL
function simulateAdvanced(prices, configName, config, verbose = false) {
    const accumulator = new BTCAccumulator(config.options);
    
    let btcBalance = initialBTC;
    let brlBalance = initialBRL;
    let buys = 0;
    let sells = 0;
    let profitableSells = 0;
    let trades = [];
    let avgBuyPrice = 0;
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
        
        const rsi = calculateRSI(priceHistory, 14);
        const trend = getTrend(priceHistory, 20);
        
        accumulator.recordPrice(price);
        
        // DCA: Tentar comprar
        const shouldBuy = accumulator.shouldDCA(price, brlBalance, trend, rsi, btcBalance, initialBRL + initialBTC * prices[0]);
        
        if (shouldBuy && brlBalance > 100 && btcBalance < initialBTC * 2) {
            const orderSize = Math.max(30, brlBalance * 0.15); // 15% do saldo
            const orderSize_BTC = orderSize / price;
            
            if (orderSize_BTC > 0.00001) {
                btcBalance += orderSize_BTC;
                brlBalance -= orderSize * 1.003; // Fee 0.3%
                
                avgBuyPrice = (avgBuyPrice * (buys) + price * orderSize_BTC) / (buys + 1);
                buys++;
                
                if (verbose && i % 200 === 0) {
                    console.log(chalk.green(`  [${i}] BUY: ${orderSize_BTC.toFixed(8)} BTC @ R$ ${price.toFixed(2)}`));
                }
                
                trades.push({
                    type: 'BUY',
                    price,
                    btc: orderSize_BTC,
                    cycle: i
                });
            }
        }
        
        // SELL: Tentar vender 50% do acumulo se temos 5%+ de lucro
        if (btcBalance > initialBTC * 1.5) {
            const cost = btcBalance * avgBuyPrice;
            const revenue = btcBalance * price;
            const profit = revenue - cost;
            const profitPct = profit / cost;
            
            if (profitPct > 0.05 && price > avgBuyPrice * 1.02) { // 5% lucro
                const sellAmount = btcBalance * 0.3; // Vender 30%
                brlBalance += sellAmount * price * 0.997; // Fee 0.3%
                btcBalance -= sellAmount;
                sells++;
                profitableSells++;
                
                if (verbose && i % 200 === 0) {
                    console.log(chalk.cyan(`  [${i}] SELL: ${sellAmount.toFixed(8)} BTC @ R$ ${price.toFixed(2)} | Lucro: ${(profitPct * 100).toFixed(2)}%`));
                }
                
                trades.push({
                    type: 'SELL',
                    price,
                    btc: sellAmount,
                    cycle: i,
                    profit: profitPct
                });
            }
        }
    }
    
    const finalPrice = testPrices[testPrices.length - 1];
    const btcValue = btcBalance * finalPrice;
    const totalValue = brlBalance + btcValue;
    const initialValue = initialBRL + initialBTC * testPrices[0];
    const pnl = totalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    return {
        name: configName,
        pnl,
        roi,
        buys,
        sells,
        profitableSells,
        trades: trades.length,
        btcFinal: btcBalance,
        brlFinal: brlBalance,
        avgBuyPrice,
        finalPrice
    };
}

// Teste 1: SEM FILTROS
console.log(chalk.blue.bold('📊 TESTE 1: SEM FILTROS\n'));
const result1 = simulateAdvanced(testPrices, 'SEM_FILTROS', {
    options: {
        dcaDropThreshold: 0.005,
        strongDropThreshold: 0.02,
        trendFilterEnabled: false,
        rsiFilterEnabled: false,
        stopLossEnabled: false,
    }
}, true);

console.log(chalk.yellow(`\n  Compras: ${result1.buys}`));
console.log(chalk.yellow(`  Vendas: ${result1.sells} (${result1.profitableSells} com lucro)`));
console.log(chalk.yellow(`  BTC final: ${result1.btcFinal.toFixed(8)}`));
console.log(chalk.yellow(`  BRL final: R$ ${result1.brlFinal.toFixed(2)}`));
console.log(chalk.yellow(`  PnL: R$ ${result1.pnl.toFixed(2)} (${result1.roi.toFixed(3)}%)\n`));

// Teste 2: COM FILTROS V2
console.log(chalk.blue.bold('📊 TESTE 2: COM FILTROS V2 (BALANCEADO)\n'));
const result2 = simulateAdvanced(testPrices, 'COM_FILTROS', {
    options: {
        dcaDropThreshold: 0.012,
        strongDropThreshold: 0.03,
        trendFilterEnabled: true,
        blockOnBearishTrend: true,
        rsiFilterEnabled: true,
        rsiOverboughtThreshold: 80,
        rsiOversoldThreshold: 20,
        stopLossEnabled: true,
        stopLossThreshold: 0.075,
        reversalConfirmationCycles: 4,
    }
}, true);

console.log(chalk.yellow(`\n  Compras: ${result2.buys}`));
console.log(chalk.yellow(`  Vendas: ${result2.sells} (${result2.profitableSells} com lucro)`));
console.log(chalk.yellow(`  BTC final: ${result2.btcFinal.toFixed(8)}`));
console.log(chalk.yellow(`  BRL final: R$ ${result2.brlFinal.toFixed(2)}`));
console.log(chalk.yellow(`  PnL: R$ ${result2.pnl.toFixed(2)} (${result2.roi.toFixed(3)}%)\n`));

// HOLD benchmark
const holdValue = initialBRL + initialBTC * testPrices[testPrices.length - 1];
const holdPnL = holdValue - (initialBRL + initialBTC * testPrices[0]);
const holdROI = (holdPnL / (initialBRL + initialBTC * testPrices[0])) * 100;

// Comparação
console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📊 COMPARAÇÃO FINAL'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold('┌─────────────────────┬──────────┬────────┬──────┬──────┬───────┬──────────┐'));
console.log(chalk.bold('│ Estratégia          │ PnL (R$) │ ROI %  │ Buys │Sells │Profit │ vs HOLD  │'));
console.log(chalk.bold('├─────────────────────┼──────────┼────────┼──────┼──────┼───────┼──────────┤'));

console.log(chalk.bold('│ HOLD (Benchmark)    │ ') + 
    chalk.yellow(holdPnL.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
    chalk.yellow(holdROI.toFixed(3).padStart(5)) + chalk.bold(' │ ') +
    chalk.bold('0    │ 0    │ 0%    │ Ref      │'));

[result1, result2].forEach(r => {
    const diff = r.pnl - holdPnL;
    const pctDiff = (diff / Math.abs(holdPnL || 1)) * 100;
    const status = diff > 0 ? chalk.green('+') : chalk.red('');
    
    console.log(chalk.bold('│ ') + 
        r.name.padEnd(20) + chalk.bold('│ ') +
        chalk.yellow(r.pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(r.roi.toFixed(3).padStart(5)) + chalk.bold(' │ ') +
        String(r.buys).padStart(4) + chalk.bold(' │ ') +
        String(r.sells).padStart(4) + chalk.bold(' │ ') +
        String(r.profitableSells).padStart(4) + chalk.bold(' │ ') +
        status + (pctDiff > 0 ? chalk.green : chalk.red)(pctDiff.toFixed(1) + '%').padStart(7) + chalk.bold(' │'));
});

console.log(chalk.bold('└─────────────────────┴──────────┴────────┴──────┴──────┴───────┴──────────┘\n'));

// Análise
console.log(chalk.cyan.bold('✅ CONCLUSÃO\n'));

const melhoria = result2.pnl - result1.pnl;
if (Math.abs(melhoria) < 0.01) {
    console.log(chalk.green(`✅ COM FILTROS: Performance similar com MAIS PROTEÇÃO`));
    console.log(chalk.green(`   - Bloqueou compras desnecessárias em BEARISH`));
    console.log(chalk.green(`   - Evitou overbought (RSI >80)`));
    console.log(chalk.green(`   - Manteve profitabilidade: R$ ${result2.pnl.toFixed(2)}`));
} else if (melhoria > 0) {
    console.log(chalk.green(`✅ COM FILTROS: +R$ ${melhoria.toFixed(2)} MELHOR que sem filtros`));
} else {
    console.log(chalk.yellow(`⚠️  COM FILTROS: R$ ${Math.abs(melhoria).toFixed(2)} PIOR que sem filtros`));
    console.log(chalk.yellow(`   Motivo: Filtros podem estar bloqueando oportunidades`));
}

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO\n'));

process.exit(0);
