#!/usr/bin/env node
/**
 * TESTE COM DADOS REAIS DOS CANDLES
 * Analisa performance com dados históricos reais do Mercado Bitcoin
 * Compara: HOLD vs SEM FILTROS vs COM FILTROS V2
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
console.log(chalk.green(`✅ Extraídos ${prices.length} preços`));
console.log(chalk.yellow(`  Preço inicial: R$ ${prices[0].toFixed(2)}`));
console.log(chalk.yellow(`  Preço final: R$ ${prices[prices.length - 1].toFixed(2)}`));
console.log(chalk.yellow(`  Variação: ${(((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2)}%\n`));

// Configurações dos testes
const initialBRL = 150;
const initialBTC = 0.0001;

const configs = {
    'SEM FILTROS': {
        name: 'SEM FILTROS (Baseline)',
        options: {
            dcaDropThreshold: 0.005,  // 0.5% (original)
            strongDropThreshold: 0.02, // 2% (original)
            trendFilterEnabled: false,
            rsiFilterEnabled: false,
            stopLossEnabled: false,
        }
    },
    'COM FILTROS V2': {
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

// Função para calcular RSI
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// Função para determinar tendência (simples: EMA)
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
    let totalSold = 0;
    const trades = [];
    
    console.log(chalk.blue(`\n--- ${configName} ---`));
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const priceHistory = prices.slice(Math.max(0, i - 49), i + 1);
        
        // Calcular indicadores
        const rsi = calculateRSI(priceHistory, 14);
        const trend = getTrend(priceHistory, 20);
        
        // Registrar preço
        accumulator.recordPrice(price, {
            rsi: rsi,
            externalTrend: trend,
            orderbook: { 
                bids: [[price, 1]], 
                asks: [[price * 1.001, 1]]
            }
        });
        
        // DCA: tentar comprar
        const shouldBuy = accumulator.shouldDCA(trend, rsi, brlBalance, initialBRL + initialBTC * price);
        
        if (shouldBuy && brlBalance > 100) {
            const orderSize = Math.max(100, brlBalance * accumulator.config.orderSize);
            const orderSize_BTC = Math.min(orderSize / price, brlBalance / price);
            
            if (orderSize_BTC > 0.00001) {
                btcBalance += orderSize_BTC;
                brlBalance -= orderSize_BTC * price;
                totalBought += orderSize_BTC * price;
                
                trades.push({
                    type: 'BUY',
                    price: price,
                    btc: orderSize_BTC,
                    brl: orderSize_BTC * price,
                    cycle: i
                });
            }
        }
        
        // Tentar vender se tiver lucro
        if (btcBalance > 0.00001 && accumulator.shouldSell(price, initialBTC + totalBought / price)) {
            const sellAmount = Math.min(btcBalance * 0.5, btcBalance);
            brlBalance += sellAmount * price;
            btcBalance -= sellAmount;
            totalSold += sellAmount * price;
            
            trades.push({
                type: 'SELL',
                price: price,
                btc: sellAmount,
                brl: sellAmount * price,
                cycle: i
            });
        }
    }
    
    // Calcular PnL
    const finalPrice = prices[prices.length - 1];
    const btcValue = btcBalance * finalPrice;
    const totalValue = brlBalance + btcValue;
    const initialValue = initialBRL + initialBTC * prices[0];
    const pnl = totalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    console.log(chalk.yellow(`  Trades executados: ${trades.length}`));
    console.log(chalk.yellow(`  BTC final: ${btcBalance.toFixed(8)}`));
    console.log(chalk.yellow(`  BRL final: R$ ${brlBalance.toFixed(2)}`));
    console.log(chalk.yellow(`  Valor total: R$ ${totalValue.toFixed(2)}`));
    console.log(chalk.yellow(`  PnL: R$ ${pnl.toFixed(2)}`));
    console.log(chalk.yellow(`  ROI: ${roi.toFixed(2)}%`));
    
    return {
        name: configName,
        pnl: pnl,
        roi: roi,
        trades: trades.length,
        btcFinal: btcBalance,
        brlFinal: brlBalance,
        totalValue: totalValue
    };
}

// Executar testes
console.log(chalk.cyan.bold('\n🧪 EXECUTANDO TESTES COM DADOS REAIS\n'));

const results = [];
for (const [key, config] of Object.entries(configs)) {
    const result = simulateStrategy(prices, config.name, config);
    results.push(result);
}

// HOLD benchmark
console.log(chalk.blue('\n--- HOLD (Benchmark) ---'));
const holdValue = (initialBRL + initialBTC * prices[prices.length - 1]);
const holdPnL = holdValue - (initialBRL + initialBTC * prices[0]);
const holdROI = (holdPnL / (initialBRL + initialBTC * prices[0])) * 100;
console.log(chalk.yellow(`  PnL: R$ ${holdPnL.toFixed(2)}`));
console.log(chalk.yellow(`  ROI: ${holdROI.toFixed(2)}%`));

// Comparação
console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('📊 COMPARAÇÃO DE RESULTADOS'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold('┌─────────────────────────┬──────────┬────────┬────────┬──────────┐'));
console.log(chalk.bold('│ Estratégia              │ PnL (R$) │ ROI %  │ Trades │ vs HOLD  │'));
console.log(chalk.bold('├─────────────────────────┼──────────┼────────┼────────┼──────────┤'));

console.log(chalk.bold('│ HOLD (Benchmark)        │ ') + 
    chalk.yellow(holdPnL.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
    chalk.yellow(holdROI.toFixed(2).padStart(5)) + chalk.bold(' │ ') +
    chalk.bold('0      │ Ref      │'));

results.forEach((r, i) => {
    const diff = r.pnl - holdPnL;
    const status = diff >= 0 ? chalk.green : chalk.red;
    
    console.log(chalk.bold('│ ') + 
        r.name.padEnd(24) + chalk.bold('│ ') +
        chalk.yellow(r.pnl.toFixed(2).padStart(7)) + chalk.bold(' │ ') +
        chalk.yellow(r.roi.toFixed(2).padStart(5)) + chalk.bold(' │ ') +
        String(r.trades).padStart(6) + chalk.bold(' │ ') +
        status((diff >= 0 ? '+' : '') + diff.toFixed(2).padStart(7)) + chalk.bold(' │'));
});

console.log(chalk.bold('└─────────────────────────┴──────────┴────────┴────────┴──────────┘\n'));

// Recomendações
console.log(chalk.cyan.bold('📈 ANÁLISE E RECOMENDAÇÕES\n'));

const comFiltros = results.find(r => r.name.includes('V2'));
const semFiltros = results.find(r => r.name.includes('Baseline'));

if (comFiltros && semFiltros) {
    const melhoria = ((comFiltros.pnl - semFiltros.pnl) / Math.abs(semFiltros.pnl)) * 100;
    
    if (comFiltros.pnl > holdPnL) {
        console.log(chalk.green(`✅ COM FILTROS V2 SUPEROU O HOLD em R$ ${(comFiltros.pnl - holdPnL).toFixed(2)}`));
        console.log(chalk.green(`   Melhoria vs Sem Filtros: ${melhoria.toFixed(1)}%`));
    } else {
        console.log(chalk.yellow(`⚠️  COM FILTROS V2 ainda não superou HOLD`));
        console.log(chalk.yellow(`   Diferença: R$ ${(holdPnL - comFiltros.pnl).toFixed(2)}`));
    }
}

console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════════════════════════'));
console.log(chalk.cyan.bold('✅ TESTE CONCLUÍDO'));
console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════════════════════════\n'));

process.exit(0);
