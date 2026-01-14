#!/usr/bin/env node

const db = require('./db');

async function main() {
    try {
        console.log('\n🔄 Iniciando backfill de pair_ids para ordens legadas...\n');
        
        // Inicializar banco de dados
        await db.init();
        console.log('✅ Banco de dados inicializado\n');
        
        // Executar backfill
        const result = await db.backfillLegacyPairs();
        
        console.log('\n📊 Resultado do Backfill:');
        console.log(`   Total de ordens legadas: ${result.totalLegacy}`);
        console.log(`   Ordens pareadas: ${result.updated}`);
        
        if (result.updated > 0) {
            console.log('\n✅ Backfill concluído com sucesso!');
            console.log('   As ordens agora devem aparecer com pair_id no dashboard.');
        } else {
            console.log('\n⚠️  Nenhuma ordem foi pareada.');
            console.log('   Isso pode acontecer se:');
            console.log('   - Não há ordens BUY/SELL pareadas');
            console.log('   - SELL estava muito distante de BUY (> 1 hora)');
        }
        
        console.log('\n🚀 Para ver o resultado, recarregue o dashboard em:');
        console.log('   http://localhost:3001\n');
        
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Erro durante backfill:', err.message);
        process.exit(1);
    }
}

main();
