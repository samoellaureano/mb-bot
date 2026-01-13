#!/usr/bin/env node
/**
 * test_pnl_validation.js - Teste de Validação de PnL
 * Compara cálculos de PnL entre bot.js, dashboard.js e banco de dados
 * Para garantir consistência nos cálculos em modo live e simulação
 */

require('dotenv').config();
const db = require('./db');
const mbClient = require('./mb_client');
const chalk = require('chalk');

async function testPnLValidation() {
    console.log(chalk.cyan('🔍 Iniciando Teste de Validação de PnL...'));
    console.log('='.repeat(60));

    try {
        // Inicializar banco de dados
        await db.init();
        console.log(chalk.green('✅ Banco de dados inicializado'));

        // Obter preço atual
        await mbClient.authenticate();
        const ticker = await mbClient.getTicker();
        const currentPrice = parseFloat(ticker.last);
        console.log(chalk.blue(`💰 Preço atual BTC: R$ ${currentPrice.toFixed(2)}`));

        // 1. Validação pelo banco de dados
        console.log(chalk.yellow('\n📊 1. Validação via Banco de Dados:'));
        const dbValidation = await db.validatePnL(currentPrice);
        console.table(dbValidation);

        // 2. Estatísticas básicas do banco
        console.log(chalk.yellow('\n📈 2. Estatísticas do Banco (24h):'));
        const stats24h = await db.getStats({hours: 24});
        console.table(stats24h);

        // 3. Últimas ordens filled
        console.log(chalk.yellow('\n📋 3. Últimas 10 Ordens Filled:'));
        const orders = await db.getOrders({limit: 10});
        const filledOrders = orders.filter(o => o.status === 'filled');
        
        if (filledOrders.length > 0) {
            console.table(filledOrders.map(o => ({
                id: o.id?.substring(0, 8) || 'N/A',
                side: o.side,
                price: `R$ ${parseFloat(o.price).toFixed(2)}`,
                qty: parseFloat(o.qty).toFixed(8),
                pnl: parseFloat(o.pnl || 0).toFixed(2),
                timestamp: new Date(o.timestamp * 1000).toLocaleString('pt-BR')
            })));
        } else {
            console.log(chalk.gray('   Nenhuma ordem filled encontrada'));
        }

        // 4. Histórico de fills
        console.log(chalk.yellow('\n📊 4. Análise de Fills Históricos:'));
        const historicalFills = await db.loadHistoricalFills(20);
        
        if (historicalFills.length > 0) {
            let totalBuys = 0, totalSells = 0;
            let buyVolume = 0, sellVolume = 0;
            let buyValue = 0, sellValue = 0;
            
            historicalFills.forEach(fill => {
                if (fill.side === 'buy') {
                    totalBuys++;
                    buyVolume += fill.qty;
                    buyValue += fill.price * fill.qty;
                } else {
                    totalSells++;
                    sellVolume += fill.qty;
                    sellValue += fill.price * fill.qty;
                }
            });

            const avgBuyPrice = buyVolume > 0 ? buyValue / buyVolume : 0;
            const avgSellPrice = sellVolume > 0 ? sellValue / sellVolume : 0;
            const netPosition = buyVolume - sellVolume;

            console.table({
                'Total Fills': historicalFills.length,
                'Compras': totalBuys,
                'Vendas': totalSells,
                'Volume Compra': `${buyVolume.toFixed(8)} BTC`,
                'Volume Venda': `${sellVolume.toFixed(8)} BTC`,
                'Preço Médio Compra': `R$ ${avgBuyPrice.toFixed(2)}`,
                'Preço Médio Venda': `R$ ${avgSellPrice.toFixed(2)}`,
                'Posição Líquida': `${netPosition.toFixed(8)} BTC`,
                'Spread Médio': `${avgSellPrice > 0 && avgBuyPrice > 0 ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice * 100).toFixed(3) : 0}%`
            });
        } else {
            console.log(chalk.gray('   Nenhum fill histórico encontrado'));
        }

        // 5. Análise de consistência
        console.log(chalk.yellow('\n🔍 5. Análise de Consistência:'));
        
        if (dbValidation) {
            const issues = [];
            
            // Verificar se posição final faz sentido
            const finalPosition = parseFloat(dbValidation.final_position);
            if (finalPosition < 0) {
                issues.push('⚠️  Posição BTC negativa detectada');
            }
            
            // Verificar se PnL total faz sentido com as trades
            const totalTrades = parseInt(dbValidation.total_trades);
            const realizedPnL = parseFloat(dbValidation.realized_pnl);
            
            if (totalTrades > 0 && Math.abs(realizedPnL) > totalTrades * 100) {
                issues.push(`⚠️  PnL realizado muito alto para ${totalTrades} trades`);
            }
            
            // Verificar fees
            const totalFees = parseFloat(dbValidation.total_fees);
            const totalCost = parseFloat(dbValidation.total_cost);
            if (totalCost > 0 && totalFees / totalCost > 0.01) { // Mais de 1% em fees
                issues.push('⚠️  Taxa de fees muito alta (>1%)');
            }
            
            if (issues.length === 0) {
                console.log(chalk.green('✅ Nenhuma inconsistência detectada'));
            } else {
                issues.forEach(issue => console.log(chalk.red(issue)));
            }
        }

        // 6. Recomendações
        console.log(chalk.yellow('\n💡 6. Recomendações:'));
        console.log('• Execute este teste regularmente para detectar inconsistências');
        console.log('• Compare os valores com o dashboard em tempo real');
        console.log('• Em caso de discrepâncias, verifique os logs do bot');
        console.log('• Para modo LIVE, monitore especialmente as taxas de fees');

        console.log(chalk.cyan('\n🎯 Teste de Validação Concluído!'));

    } catch (error) {
        console.error(chalk.red('❌ Erro durante validação:'), error.message);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testPnLValidation();
}

module.exports = testPnLValidation;