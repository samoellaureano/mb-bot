#!/usr/bin/env node
/**
 * cancel_all_orders.js
 * Cancela todas as ordens abertas para liberar capital
 */

require('dotenv').config();
const MB = require('./mb_client');
const chalk = require('chalk');

const log = (level, msg, data = null) => {
    const ts = new Date().toISOString().substring(11, 23);
    const prefix = `[${level}]`.padEnd(10);
    const icon = { INFO: 'ℹ️ ', WARN: '⚠️ ', ERROR: '❌', SUCCESS: '✅' }[level] || '';
    console.log(chalk.cyan(`${ts}`) + ` ${icon} ${prefix} ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`);
};

(async () => {
    try {
        log('INFO', 'Iniciando cancelamento de ordens...');
        
        // Autenticar
        await MB.authenticate();
        log('SUCCESS', 'Autenticação OK');
        
        // Obter ordens abertas
        const orders = await MB.getOpenOrders();
        log('INFO', `Total de ordens abertas: ${orders.length}`);
        
        if (orders.length === 0) {
            log('SUCCESS', 'Nenhuma ordem aberta. Nada para cancelar!');
            process.exit(0);
        }
        
        // Cancelar todas
        log('INFO', 'Cancelando ordens...');
        let cancelledCount = 0;
        let failedCount = 0;
        
        for (const order of orders) {
            try {
                await MB.cancelOrder(order.id);
                cancelledCount++;
                if (cancelledCount % 10 === 0) {
                    log('INFO', `Progresso: ${cancelledCount}/${orders.length} canceladas`);
                }
                // Rate limiting
                await new Promise(r => setTimeout(r, 100));
            } catch (e) {
                failedCount++;
                log('WARN', `Erro ao cancelar ${order.id}: ${e.message}`);
            }
        }
        
        log('SUCCESS', `Cancelamento concluído!`, {
            canceladas: cancelledCount,
            falhadas: failedCount,
            total: orders.length
        });
        
        // Verificar saldos finais
        const balances = await MB.getBalances();
        log('SUCCESS', 'Saldos após cancelamento:', {
            BTC: balances.btc,
            BRL: balances.brl
        });
        
        process.exit(0);
    } catch (error) {
        log('ERROR', error.message);
        process.exit(1);
    }
})();
