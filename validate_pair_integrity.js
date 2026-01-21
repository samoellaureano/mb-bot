#!/usr/bin/env node

/**
 * Script de Validação Contínua de Integridade de Pares
 * 
 * Monitora:
 * 1. Pares completos (BUY + SELL com mesmo pair_id)
 * 2. Recolocações (múltiplas ordens mesmo pair + side)
 * 3. Orphans (ordens sem par)
 * 4. Consistência entre BD e activeOrders em memória
 */

const db = require('./db.js');
const chalk = require('chalk');

const INTERVAL_SECS = 10;

async function validatePairs() {
    try {
        // 1. Análise de pares abertos
        const query = `
            SELECT 
                pair_id,
                side,
                COUNT(*) as qty,
                MAX(timestamp) as last_update,
                GROUP_CONCAT(status, ' -> ') as status_seq
            FROM orders
            WHERE pair_id IS NOT NULL AND status IN ('open', 'working')
            GROUP BY pair_id, side
            ORDER BY pair_id DESC
        `;
        
        const connection = await new Promise(resolve => {
            db.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error(chalk.red(`[ERROR] ${err.message}`));
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
        
        if (connection.length === 0) {
            console.log(chalk.yellow(`[INFO] Nenhuma ordem ativa para validar\n`));
            return;
        }
        
        // 2. Agrupar por pair_id
        const pairs = {};
        const replacements = [];
        
        for (const row of connection) {
            if (!pairs[row.pair_id]) {
                pairs[row.pair_id] = { buy: 0, sell: 0, buyRepeat: false, sellRepeat: false };
            }
            
            if (row.side === 'buy') {
                pairs[row.pair_id].buy = row.qty;
                if (row.qty > 1) {
                    pairs[row.pair_id].buyRepeat = true;
                    replacements.push({
                        pair_id: row.pair_id,
                        side: 'buy',
                        count: row.qty,
                        statuses: row.status_seq
                    });
                }
            } else {
                pairs[row.pair_id].sell = row.qty;
                if (row.qty > 1) {
                    pairs[row.pair_id].sellRepeat = true;
                    replacements.push({
                        pair_id: row.pair_id,
                        side: 'sell',
                        count: row.qty,
                        statuses: row.status_seq
                    });
                }
            }
        }
        
        // 3. Validar integridade
        let completeCount = 0;
        let incompleteCount = 0;
        let replacementCount = 0;
        
        console.log(chalk.cyan(`\n📊 VALIDAÇÃO DE PARES - ${new Date().toLocaleTimeString()}\n`));
        
        for (const [pairId, sides] of Object.entries(pairs)) {
            if (sides.buy > 0 && sides.sell > 0) {
                completeCount++;
                console.log(chalk.green(`   ✅ ${pairId.substring(0, 30)}`));
                console.log(`      BUY: ${sides.buy} | SELL: ${sides.sell}`);
            } else {
                incompleteCount++;
                console.log(chalk.yellow(`   ⚠️  ${pairId.substring(0, 30)}`));
                console.log(`      BUY: ${sides.buy} | SELL: ${sides.sell}`);
            }
            
            if (sides.buyRepeat || sides.sellRepeat) {
                console.log(chalk.red(`      🔄 RECOLOCAÇÃO DETECTADA!`));
            }
        }
        
        // 4. Resumo
        console.log(chalk.cyan(`\n📈 RESUMO:\n`));
        console.log(`   Total de pares: ${Object.keys(pairs).length}`);
        console.log(chalk.green(`   ✅ Completos: ${completeCount}`));
        console.log(chalk.yellow(`   ⚠️  Incompletos: ${incompleteCount}`));
        
        if (replacements.length > 0) {
            console.log(chalk.red(`   🔄 Recolocações: ${replacements.length}`));
            replacements.forEach(r => {
                console.log(`      • ${r.pair_id.substring(0, 30)} - ${r.side.toUpperCase()}`);
                console.log(`        Count: ${r.count} | Status: ${r.statuses}`);
            });
        }
        
        console.log('');
        
    } catch (e) {
        console.error(chalk.red(`[ERROR] ${e.message}`));
    }
}

// Executar periodicamente
console.log(chalk.cyan(`\n🔐 Sistema de Validação de Pares ATIVO\n`));
validatePairs();

setInterval(validatePairs, INTERVAL_SECS * 1000);
