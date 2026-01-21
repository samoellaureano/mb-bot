/**
 * TESTE DO SISTEMA ADAPTATIVO
 * Script para validar o funcionamento do AdaptiveMarketManager
 */

const AdaptiveMarketManager = require('./adaptive_market_manager');

async function testAdaptiveSystem() {
    console.log('🔬 INICIANDO TESTE DO SISTEMA ADAPTATIVO');
    console.log('=' .repeat(50));
    
    // Simular instância do bot
    const mockBot = {};
    const adaptiveManager = new AdaptiveMarketManager(mockBot);
    
    // Cenários de teste
    const testScenarios = [
        {
            name: 'Mercado em Alta',
            marketData: {
                last: 500000,
                volatility: 1.2,
                tendency: { trend: 'up' }
            },
            technicalIndicators: {
                rsi: 65,
                emaShort: 501000,
                emaLong: 499000,
                macd: 150,
                macdSignal: 100
            },
            positions: { btc: 0.00001, brl: 100 },
            orders: [
                { external_id: 'test1', side: 'buy', price: 485000 },
                { external_id: 'test2', side: 'sell', price: 520000 }
            ],
            currentPnL: 2.5
        },
        {
            name: 'Mercado em Queda',
            marketData: {
                last: 485000,
                volatility: 2.8,
                tendency: { trend: 'down' }
            },
            technicalIndicators: {
                rsi: 25,
                emaShort: 484000,
                emaLong: 490000,
                macd: -200,
                macdSignal: -150
            },
            positions: { btc: 0.00005, brl: 50 },
            orders: [
                { external_id: 'test3', side: 'buy', price: 520000 }, // Órfã!
                { external_id: 'test4', side: 'sell', price: 480000 }
            ],
            currentPnL: -1.8
        },
        {
            name: 'Mercado Neutro',
            marketData: {
                last: 490000,
                volatility: 0.8,
                tendency: { trend: 'neutral' }
            },
            technicalIndicators: {
                rsi: 52,
                emaShort: 490500,
                emaLong: 489500,
                macd: 50,
                macdSignal: 45
            },
            positions: { btc: 0.00003, brl: 75 },
            orders: [
                { external_id: 'test5', side: 'buy', price: 488000 },
                { external_id: 'test6', side: 'sell', price: 492000 }
            ],
            currentPnL: 0.5
        }
    ];
    
    for (const scenario of testScenarios) {
        console.log(`\\n🎯 TESTANDO: ${scenario.name}`);
        console.log('-'.repeat(30));
        
        try {
            const result = await adaptiveManager.executeAdaptation(
                scenario.marketData,
                scenario.technicalIndicators,
                scenario.positions,
                scenario.orders,
                scenario.currentPnL
            );
            
            console.log(`✅ Adaptado: ${result.adapted}`);
            if (result.adapted) {
                console.log(`📊 Tendência: ${result.trend} (${result.confidence})`);
                console.log(`📋 Resumo: ${result.summary}`);
                
                if (result.newConfig) {
                    const config = result.newConfig;
                    console.log(`⚙️  Nova Config:`);
                    console.log(`   Spread: ${(config.spread_pct * 100).toFixed(2)}%`);
                    console.log(`   Tamanho: ${config.order_size} BTC`);
                    console.log(`   Max Posição: ${config.max_position} BTC`);
                    console.log(`   Estratégia: ${config.strategy}`);
                }
                
                if (result.positionActions && result.positionActions.length > 0) {
                    console.log(`💼 Ações de Posição:`);
                    result.positionActions.forEach(action => {
                        console.log(`   ${action.type}: ${action.reason}`);
                    });
                }
                
                if (result.cancelActions && result.cancelActions.length > 0) {
                    console.log(`❌ Cancelamentos:`);
                    result.cancelActions.forEach(action => {
                        console.log(`   ${action.side.toUpperCase()}: ${action.reason}`);
                    });
                }
                
                if (result.pnlOptimizations && result.pnlOptimizations.length > 0) {
                    console.log(`📈 Otimizações PnL:`);
                    result.pnlOptimizations.forEach(opt => {
                        console.log(`   ${opt.type}: ${opt.reason} -> ${opt.action}`);
                    });
                }
            } else {
                console.log(`⏳ Razão: ${result.reason || result.error || 'N/A'}`);
            }
            
        } catch (error) {
            console.log(`❌ Erro: ${error.message}`);
        }
    }
    
    console.log('\\n🎉 TESTE CONCLUÍDO!');
    console.log('📁 Verifique adaptive_manager_log.json para logs detalhados');
}

if (require.main === module) {
    testAdaptiveSystem().catch(console.error);
}

module.exports = testAdaptiveSystem;