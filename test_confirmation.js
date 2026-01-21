/**
 * TESTE FORÇANDO CONFIRMAÇÃO DE TENDÊNCIA
 */

const AdaptiveMarketManager = require('./adaptive_market_manager');

async function testWithConfirmation() {
    console.log('🔬 TESTE COM CONFIRMAÇÃO DE TENDÊNCIA (3 CICLOS)');
    console.log('=' .repeat(50));
    
    const mockBot = {};
    const adaptiveManager = new AdaptiveMarketManager(mockBot);
    
    const marketDataDown = {
        last: 485000,
        volatility: 2.2,
        tendency: { trend: 'down' }
    };
    
    const technicalIndicators = {
        rsi: 25,
        emaShort: 484000,
        emaLong: 490000,
        macd: -200,
        macdSignal: -150
    };
    
    const positions = { btc: 0.00005, brl: 50 };
    const orders = [
        { external_id: 'test3', side: 'buy', price: 520000 }, // Órfã muito acima!
        { external_id: 'test4', side: 'sell', price: 480000 }
    ];
    const currentPnL = -1.8;
    
    // Simular 3 ciclos consecutivos para confirmar tendência
    for (let cycle = 1; cycle <= 3; cycle++) {
        console.log(`\\n📊 CICLO ${cycle}:`);
        
        const result = await adaptiveManager.executeAdaptation(
            marketDataDown,
            technicalIndicators,
            positions,
            orders,
            currentPnL
        );
        
        console.log(`✅ Adaptado: ${result.adapted}`);
        
        if (result.adapted) {
            console.log(`🎯 Tendência: ${result.trend} (${result.confidence})`);
            console.log(`💡 Estratégia: ${result.newConfig?.strategy}`);
            console.log(`📋 ${result.summary}`);
            
            if (result.cancelActions?.length > 0) {
                console.log(`❌ ${result.cancelActions.length} ordens para cancelar:`);
                result.cancelActions.forEach(action => {
                    console.log(`   ${action.side.toUpperCase()}: ${action.reason}`);
                });
            }
            
            if (result.positionActions?.length > 0) {
                console.log(`💼 Ações de posição:`);
                result.positionActions.forEach(action => {
                    console.log(`   ${action.type}: ${action.reason}`);
                });
            }
            break;
        } else {
            console.log(`⏳ ${result.reason}`);
        }
    }
    
    console.log('\\n🎉 TESTE CONCLUÍDO!');
}

testWithConfirmation().catch(console.error);