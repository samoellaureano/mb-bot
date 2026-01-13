#!/usr/bin/env node
/**
 * Script para limpar dados antigos e ressincronizar com API
 * Garante que PnL e saldos sejam rastreados corretamente
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const mbClient = require('./mb_client');
const db = require('./db');
const chalk = require('chalk');

const DB_PATH = path.join(__dirname, 'database', 'orders.db');
const BACKUP_PATH = path.join(__dirname, 'database', 'orders_backup.db');
const PNL_HISTORY_FILE = path.join(__dirname, 'pnl_history.json');

async function cleanAndSync() {
    console.log(chalk.blue('🧹 INICIANDO LIMPEZA E SINCRONIZAÇÃO\n'));
    
    try {
        // 1. Fazer backup do banco atual
        console.log(chalk.yellow('📦 Fazendo backup do banco atual...'));
        try {
            await fs.copyFile(DB_PATH, BACKUP_PATH);
            console.log(chalk.green('✅ Backup criado em:', BACKUP_PATH));
        } catch (err) {
            console.log(chalk.yellow('⚠️ Não foi possível fazer backup (arquivo pode não existir)'));
        }
        
        // 2. Limpar banco de dados (remover arquivo)
        console.log(chalk.yellow('🗑️ Limpando banco de dados...'));
        try {
            await fs.unlink(DB_PATH);
            console.log(chalk.green('✅ Banco limpo'));
        } catch (err) {
            console.log(chalk.yellow('⚠️ Banco já estava limpo'));
        }
        
        // 3. Limpar histórico de PnL
        console.log(chalk.yellow('📊 Limpando histórico de PnL...'));
        try {
            await fs.unlink(PNL_HISTORY_FILE);
            console.log(chalk.green('✅ Histórico de PnL limpo'));
        } catch (err) {
            console.log(chalk.yellow('⚠️ Histórico já estava limpo'));
        }
        
        // 4. Inicializar novo banco
        console.log(chalk.yellow('🔄 Inicializando novo banco...'));
        await db.init();
        console.log(chalk.green('✅ Novo banco inicializado'));
        
        // 5. Autenticar na API
        console.log(chalk.yellow('🔐 Conectando à API...'));
        if (!await mbClient.ensureAuthenticated()) {
            await mbClient.authenticate();
        }
        console.log(chalk.green('✅ Conectado à API'));
        
        // 6. Sincronizar ordens da API
        console.log(chalk.yellow('📥 Sincronizando ordens da API...'));
        const openOrders = await mbClient.getOpenOrders();
        console.log(`Encontradas ${openOrders.length} ordens ativas na API`);
        
        let syncedCount = 0;
        for (const order of openOrders) {
            try {
                // Determinar se é simulação baseado no ID
                const isSimulated = order.id.includes('_SIM_');
                
                const orderData = {
                    id: order.id,
                    side: order.side,
                    qty: parseFloat(order.qty),
                    price: parseFloat(order.limitPrice || order.price),
                    status: order.status === 'working' ? 'open' : order.status,
                    type: order.type || 'limit',
                    symbol: 'BTC-BRL',
                    created_at: Math.floor(Date.now() / 1000), // timestamp atual para ordens já existentes
                    updated_at: Math.floor(Date.now() / 1000),
                    is_simulated: isSimulated,
                    fee_rate: 0.003 // taxa maker padrão
                };
                
                await db.saveOrder(orderData);
                syncedCount++;
            } catch (err) {
                console.log(chalk.red(`❌ Erro ao sincronizar ordem ${order.id}:`, err.message));
            }
        }
        
        console.log(chalk.green(`✅ ${syncedCount} ordens sincronizadas`));
        
        // 7. Verificar saldos atuais
        console.log(chalk.yellow('💰 Verificando saldos...'));
        const balances = await mbClient.getBalances();
        const btcBalance = balances.find(b => b.symbol === 'BTC');
        const brlBalance = balances.find(b => b.symbol === 'BRL');
        
        console.log(chalk.cyan('Saldos atuais:'));
        console.log(`BTC: ${parseFloat(btcBalance?.total || 0).toFixed(8)} (Disponível: ${parseFloat(btcBalance?.available || 0).toFixed(8)})`);
        console.log(`BRL: R$ ${parseFloat(brlBalance?.total || 0).toFixed(2)} (Disponível: R$ ${parseFloat(brlBalance?.available || 0).toFixed(2)})`);
        
        // 8. Inicializar PnL tracking
        console.log(chalk.yellow('📈 Inicializando rastreamento de PnL...'));
        const initialPnlData = [{
            value: 0,
            timestamp: new Date().toISOString()
        }];
        
        await fs.writeFile(PNL_HISTORY_FILE, JSON.stringify(initialPnlData, null, 2));
        console.log(chalk.green('✅ PnL tracking inicializado'));
        
        // 9. Validação final
        console.log(chalk.yellow('🔍 Validação final...'));
        const stats = await db.getStats({hours: 24});
        const dbOrders = await db.getOrders({limit: 100});
        
        console.log(chalk.green('\n📊 ESTADO FINAL:'));
        console.log(`Total de ordens no banco: ${dbOrders.length}`);
        console.log(`Ordens ativas: ${dbOrders.filter(o => o.status === 'open').length}`);
        console.log(`PnL total: R$ ${stats.total_pnl.toFixed(2)}`);
        console.log(`Sistema limpo e sincronizado ✅`);
        
        // 10. Criar arquivo de controle de limpeza
        const cleanupInfo = {
            cleaned_at: new Date().toISOString(),
            orders_synced: syncedCount,
            btc_balance: parseFloat(btcBalance?.total || 0),
            brl_balance: parseFloat(brlBalance?.total || 0),
            api_orders_found: openOrders.length
        };
        
        await fs.writeFile(
            path.join(__dirname, 'last_cleanup.json'), 
            JSON.stringify(cleanupInfo, null, 2)
        );
        
        console.log(chalk.blue('\n🎉 LIMPEZA E SINCRONIZAÇÃO CONCLUÍDA!'));
        console.log(chalk.green('✅ Sistema pronto para operação'));
        
    } catch (error) {
        console.error(chalk.red('❌ Erro durante limpeza:'), error.message);
        
        // Tentar restaurar backup se algo deu errado
        try {
            console.log(chalk.yellow('🔄 Tentando restaurar backup...'));
            await fs.copyFile(BACKUP_PATH, DB_PATH);
            console.log(chalk.green('✅ Backup restaurado'));
        } catch (restoreErr) {
            console.log(chalk.red('❌ Não foi possível restaurar backup'));
        }
        
        throw error;
    }
}

// Executar limpeza
cleanAndSync().then(() => {
    console.log(chalk.green('\n✅ Script concluído com sucesso!'));
    process.exit(0);
}).catch(error => {
    console.error(chalk.red('\n❌ Script falhou:'), error);
    process.exit(1);
});