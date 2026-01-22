#!/usr/bin/env node
/**
 * teste_estrategia_v1.9.js - Teste detalhado da estratégia v1.9 com 24h de histórico
 * 
 * Simula a execução completa da estratégia de Cash Management v1.9
 * com dados reais dos últimos 24 horas
 */

const axios = require('axios');
const CashManagementStrategy = require('./cash_management_strategy');

const chalk = require('chalk');

async function fetchBinancePrices() {
    console.log(chalk.blue('📊 Buscando dados de 24h da Binance...'));
    
    try {
        // Buscar 288 candles de 5 minutos (24h)
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: 'BTCBRL',
                interval: '5m',
                limit: 288
            }
        });
        
        return response.data.map(candle => ({
            time: new Date(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[7])
        }));
    } catch (error) {
        console.log(chalk.yellow('⚠️  Binance API falhou, usando preços simulados'));
        return generateSimulatedPrices();
    }
}

function generateSimulatedPrices() {
    const prices = [];
    let price = 479000;
    
    for (let i = 0; i < 288; i++) {
        const change = (Math.random() - 0.5) * 200; // ±100 de variação
        price += change;
        prices.push({
            time: new Date(Date.now() - (288 - i) * 5 * 60 * 1000),
            close: price,
            volume: Math.random() * 100
        });
    }
    return prices;
}

async function runBacktest() {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║  🧪 TESTE DE ESTRATÉGIA v1.9 - 24 HORAS                         ║'));
    console.log(chalk.cyan.bold('║  Cash Management Strategy com Histórico Completo                ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));
    
    // Buscar preços
    const prices = await fetchBinancePrices();
    
    console.log(chalk.green(`✅ Obtidos ${prices.length} candles de preço\n`));
    
    // Criar estratégia
    const strategy = new CashManagementStrategy();
    
    // Simular estado inicial
    let brlBalance = 220.00; // R$ 220
    let btcBalance = 0;
    let trades = [];
    let buyCount = 0;
    
    console.log(chalk.blue.bold('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue.bold('📈 SIMULAÇÃO DE TRADING'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════════════════════\n'));
    
    console.log(chalk.gray(`Capital Inicial: R$ ${brlBalance.toFixed(2)}`));
    console.log(chalk.gray(`BTC Inicial: ${btcBalance.toFixed(8)}\n`));
    
    // Simular cada ciclo (30 segundos = ~12 ciclos por hora = 288 ciclos em 24h)
    let cycleCount = 0;
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i].close;
        cycleCount++;
        
        // Atualizar preço na estratégia
        strategy.updatePrice(price);
        
        // Verificar sinais de compra
        const buySignal = strategy.shouldBuy(price, brlBalance, btcBalance, 'neutral', buyCount);
        if (buySignal.shouldBuy) {
            const buyQty = (brlBalance * 0.60) / price; // 60% do capital
            
            if (buyQty >= 0.00001) {
                brlBalance -= buyQty * price;
                btcBalance += buyQty;
                buyCount++;
                
                trades.push({
                    type: 'BUY',
                    price,
                    qty: buyQty,
                    cycle: cycleCount,
                    reason: buySignal.reason
                });
                
                console.log(chalk.green(`[${cycleCount}] 📉 COMPRA: ${buyQty.toFixed(8)} BTC @ R$ ${price.toFixed(2)}`));
            }
        }
        
        // Verificar sinais de venda
        if (btcBalance > 0) {
            const sellSignal = strategy.shouldSell(price, btcBalance, 'neutral', null);
            if (sellSignal.shouldSell) {
                const sellQty = btcBalance * sellSignal.qty;
                
                if (sellQty >= 0.00001) {
                    brlBalance += sellQty * price;
                    btcBalance -= sellQty;
                    
                    trades.push({
                        type: 'SELL',
                        price,
                        qty: sellQty,
                        cycle: cycleCount,
                        reason: sellSignal.reason
                    });
                    
                    console.log(chalk.red(`[${cycleCount}] 📈 VENDA: ${sellQty.toFixed(8)} BTC @ R$ ${price.toFixed(2)}`));
                    
                    // Reset buyCount após venda
                    buyCount = Math.max(0, buyCount - 1);
                }
            }
        }
    }
    
    // Calcular resultado final
    const finalPrice = prices[prices.length - 1].close;
    const unrealizedPnL = btcBalance * finalPrice;
    const totalValue = brlBalance + unrealizedPnL;
    const pnl = totalValue - 220;
    const roi = (pnl / 220) * 100;
    
    console.log(chalk.blue.bold('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue.bold('📊 RESULTADO FINAL'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════════════════════\n'));
    
    console.log(chalk.gray(`Preço Final: R$ ${finalPrice.toFixed(2)}`));
    console.log(chalk.gray(`\nSaldo Final:`));
    console.log(chalk.gray(`  BRL: R$ ${brlBalance.toFixed(2)}`));
    console.log(chalk.gray(`  BTC: ${btcBalance.toFixed(8)}`));
    console.log(chalk.gray(`  Total em BRL: R$ ${totalValue.toFixed(2)}`));
    
    console.log(chalk.gray(`\nResultado:`));
    if (pnl >= 0) {
        console.log(chalk.green(`  ✅ PnL: +R$ ${pnl.toFixed(2)} (+${roi.toFixed(2)}%)`));
    } else {
        console.log(chalk.red(`  ❌ PnL: -R$ ${Math.abs(pnl).toFixed(2)} (${roi.toFixed(2)}%)`));
    }
    
    console.log(chalk.gray(`\nTrades Executados: ${trades.length}`));
    console.log(chalk.gray(`  Compras: ${trades.filter(t => t.type === 'BUY').length}`));
    console.log(chalk.gray(`  Vendas: ${trades.filter(t => t.type === 'SELL').length}`));
    
    // Análise de pares
    const buys = trades.filter(t => t.type === 'BUY');
    const sells = trades.filter(t => t.type === 'SELL');
    const pairs = Math.min(buys.length, sells.length);
    
    console.log(chalk.gray(`\nAnálise de Pares:`));
    console.log(chalk.gray(`  Pares Fechados: ${pairs}`));
    
    if (buys.length > sells.length) {
        console.log(chalk.yellow(`  ⚠️  ${buys.length - sells.length} compra(s) ainda aberta(s)`));
    } else if (sells.length > buys.length) {
        console.log(chalk.red(`  ❌ ${sells.length - buys.length} venda(s) sem compra correspondente!`));
    } else {
        console.log(chalk.green(`  ✅ Todos os pares estão balanceados`));
    }
    
    // Estatísticas da estratégia
    const report = strategy.generateReport();
    console.log(chalk.gray(`\nEstatísticas da Estratégia:`));
    console.log(chalk.gray(`  Win Rate: ${report.winRate}%`));
    console.log(chalk.gray(`  Trades Internos: ${report.trades}`));
    
    console.log(chalk.blue.bold('\n═══════════════════════════════════════════════════════════════\n'));
    
    if (pnl >= 0) {
        console.log(chalk.green.bold('🎉 TESTE PASSOU - Estratégia é rentável!\n'));
    } else if (pnl > -1) {
        console.log(chalk.yellow.bold('⚠️  TESTE NEUTRO - Pequeno prejuízo, mas próximo do breakeven\n'));
    } else {
        console.log(chalk.red.bold('❌ TESTE FALHOU - Prejuízo significativo\n'));
    }
    
    return {
        pnl,
        roi,
        trades: trades.length,
        pairs,
        finalBalance: totalValue
    };
}

// Executar backtesting
runBacktest().then(result => {
    process.exit(result.pnl >= 0 ? 0 : 1);
}).catch(error => {
    console.error(chalk.red('❌ Erro durante o teste:'), error.message);
    process.exit(1);
});
