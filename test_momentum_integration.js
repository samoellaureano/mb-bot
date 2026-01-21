const db = require('./db');
const { v4: uuidv4 } = require('uuid');

async function testMomentumIntegration() {
    console.log('🧪 Testando integração de Momentum Orders...\n');

    try {
        // Inicializar banco
        await db.init();
        console.log('✅ Banco de dados inicializado\n');

        // Criar uma ordem momentum de teste
        const testOrder = {
            id: uuidv4(),
            side: 'buy',
            createdPrice: 480000,
            currentPrice: 481000,
            status: 'simulated',
            qty: 0.0001,
            peaks: [481000, 481500],
            valleys: [480000, 480500],
            confirmationReversals: 2,
            reason: null,
            reversalThreshold: 0.01,
            createdAt: Math.floor(Date.now() / 1000),
            priceHistory: [480000, 480500, 481000]
        };

        console.log('📝 Salvando ordem momentum:', testOrder.id);
        await db.saveMomentumOrder(testOrder);
        console.log('✅ Ordem salva com sucesso\n');

        // Recuperar ordem
        console.log('🔍 Recuperando ordens momentum...');
        const orders = await db.getMomentumOrders({ limit: 10 });
        console.log(`✅ Encontradas ${orders.length} ordens`);
        if (orders.length > 0) {
            console.log('📊 Primeira ordem:', JSON.stringify(orders[0], null, 2));
        }
        console.log();

        // Atualizar status
        const updatedOrder = { ...testOrder, status: 'confirmed', currentPrice: 482000 };
        console.log('🔄 Atualizando para status "confirmed"...');
        await db.saveMomentumOrder(updatedOrder);
        console.log('✅ Status atualizado\n');

        // Obter stats
        console.log('📈 Obtendo estatísticas...');
        const stats = await db.getMomentumStats(24);
        console.log('✅ Estatísticas:', JSON.stringify(stats, null, 2));
        console.log();

        // Verificar no banco diretamente
        console.log('🔎 Verificação direta no SQLite:');
        const result = await new Promise((resolve, reject) => {
            db.db.all('SELECT id, side, status, current_price FROM momentum_orders LIMIT 5', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`✅ ${result.length} registros encontrados:`);
        result.forEach(r => console.log(`   - ${r.id.substring(0, 8)}... ${r.side} ${r.status} R$ ${r.current_price}`));

        console.log('\n✨ Teste concluído com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante teste:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMomentumIntegration();
