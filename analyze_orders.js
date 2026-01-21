const db = require('./db');

async function analyzeOrders() {
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║         📋 ANÁLISE DE ORDENS E PnL - RELATÓRIO COMPLETO          ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    try {
        // Get all open orders
        const openOrders = await db.getOrders({ status: 'open' });
        console.log('📋 ORDENS ABERTAS:');
        console.log(`   Total: ${openOrders.length}\n`);
        
        if (openOrders.length > 0) {
            openOrders.forEach((order, i) => {
                console.log(`   #${i + 1} ${order.side.toUpperCase()}`);
                console.log(`       ID: ${order.id}`);
                console.log(`       Preço: R$ ${order.price}`);
                console.log(`       Qtd: ${order.qty} BTC`);
                console.log(`       Status: ${order.status}`);
                console.log(`       Criada: ${order.timestamp}\n`);
            });
        }

        // Get recent closed orders
        const allOrders = await db.getOrders({ limit: 50 });
        const closedOrders = allOrders.filter(o => o.status === 'filled');
        console.log('✅ ORDENS FECHADAS (últimas 10):');
        console.log(`   Total: ${closedOrders.length}\n`);
        
        closedOrders.slice(0, 10).forEach((order, i) => {
            console.log(`   #${i + 1} ${order.side.toUpperCase()}`);
            console.log(`       Preço: R$ ${order.price} | Qtd: ${order.qty} BTC`);
            console.log(`       PnL: R$ ${order.pnl || '0.00'}`);
            console.log(`       Fechada: ${order.timestamp}\n`);
        });

        // Get stats
        const stats = await db.getStats({ hours: 24 });
        console.log('📊 ESTATÍSTICAS (24h):');
        console.log(`   Total Lucro: R$ ${stats.totalProfit || 0}`);
        console.log(`   Total Ordens: ${stats.totalOrders || 0}`);
        console.log(`   Taxa de Fill: ${stats.fillRate || '0%'}`);
        console.log(`   Spread Médio: ${stats.avgSpread || '0%'}\n`);

        // Analyze why PnL is low
        console.log('🔍 ANÁLISE DE PnL BAIXO:\n');
        
        const totalClosed = closedOrders.length;
        const totalOpen = openOrders.length;
        const totalPnL = stats.totalProfit || 0;
        
        console.log(`   Ordens fechadas: ${totalClosed}`);
        console.log(`   Ordens abertas: ${totalOpen}`);
        console.log(`   PnL total: R$ ${totalPnL}`);
        
        if (totalClosed > 0) {
            const avgPnLPerOrder = totalPnL / totalClosed;
            console.log(`   PnL médio/ordem: R$ ${avgPnLPerOrder.toFixed(2)}`);
        }
        
        if (totalOpen > 0) {
            console.log(`\n   ⚠️  ${totalOpen} ordem(ns) aberta(s) podem estar em loss`);
            console.log(`   Esperar que fechem com lucro pode melhorar PnL total`);
        }

        // Recommendations
        console.log('\n📈 RECOMENDAÇÕES:\n');
        
        if (totalClosed === 0) {
            console.log('   ❌ Nenhuma ordem fechada ainda');
            console.log('   → Aguardar mais ciclos para validação\n');
        }
        
        if (totalOpen > 3) {
            console.log('   ⚠️  Muitas ordens abertas (pode estar acumulando loss)');
            console.log('   → Considerar aumentar spread com apply_adjustments.sh\n');
        }
        
        if (totalPnL < -2) {
            console.log('   ❌ PnL negativo significativo');
            console.log('   → Opção 1: Aumentar SPREAD_PCT para 3.0%');
            console.log('   → Opção 2: Reduzir ORDER_SIZE');
            console.log('   → Opção 3: Esperar mercado estabilizar\n');
        }
        
        if (totalPnL > 0) {
            console.log('   ✅ PnL positivo! Sistema funcionando bem');
            console.log('   → Continuar monitorando\n');
        }

        console.log('════════════════════════════════════════════════════════════════════\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

analyzeOrders();
