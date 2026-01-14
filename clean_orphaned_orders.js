const db = require('./db.js');

(async function cleanOrphanedOrders() {
    try {
        console.log('🔍 Buscando ordens órfãs...');
        
        // Buscar todas as ordens ativas
        const orders = await db.getOrders({ status: 'active' });
        console.log(`📊 Total de ordens ativas: ${orders.length}`);
        
        // Agrupar por pair_id
        const pairs = {};
        orders.forEach(order => {
            const pairId = order.pair_id || 'NO_PAIR';
            if (!pairs[pairId]) {
                pairs[pairId] = { buy: [], sell: [] };
            }
            pairs[pairId][order.side].push(order);
        });
        
        console.log(`📋 Pares identificados: ${Object.keys(pairs).length}`);
        
        // Identificar ordens órfãs
        const orphanedOrders = [];
        let completePairs = 0;
        
        Object.entries(pairs).forEach(([pairId, sides]) => {
            const hasBuy = sides.buy.length > 0;
            const hasSell = sides.sell.length > 0;
            
            if (hasBuy && hasSell) {
                completePairs++;
                console.log(`✅ Par completo: ${pairId.substring(0, 20)}... (${sides.buy.length} BUY + ${sides.sell.length} SELL)`);
            } else if (hasBuy && !hasSell) {
                orphanedOrders.push(...sides.buy);
                console.log(`❌ Órfão BUY: ${pairId.substring(0, 20)}... (${sides.buy.length} ordens)`);
            } else if (!hasBuy && hasSell) {
                orphanedOrders.push(...sides.sell);
                console.log(`❌ Órfão SELL: ${pairId.substring(0, 20)}... (${sides.sell.length} ordens)`);
            }
        });
        
        console.log(`\n📈 RESUMO:`);
        console.log(`   ✅ Pares completos: ${completePairs}`);
        console.log(`   ❌ Ordens órfãs: ${orphanedOrders.length}`);
        
        if (orphanedOrders.length > 0) {
            console.log('\n🧹 Cancelando ordens órfãs...');
            
            let cancelledCount = 0;
            for (const order of orphanedOrders) {
                try {
                    await db.updateOrderStatus(order.id, 'cancelled');
                    console.log(`   ✅ Cancelada: ${order.side.toUpperCase()} R$ ${order.price.toFixed(0)} (ID: ${order.id})`);
                    cancelledCount++;
                } catch (e) {
                    console.log(`   ❌ Erro ao cancelar ${order.id}: ${e.message}`);
                }
            }
            
            console.log(`\n🎯 Limpeza concluída! ${cancelledCount} ordens órfãs canceladas.`);
            console.log('📊 Agora o bot pode criar novos pares...');
        } else {
            console.log('✨ Não há ordens órfãs para limpar.');
        }
        
        process.exit(0);
        
    } catch (e) {
        console.error('❌ Erro:', e.message);
        process.exit(1);
    }
})();