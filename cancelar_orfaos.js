#!/usr/bin/env node

/**
 * SCRIPT: Cancelar Ordens Órfãs
 * 
 * Função: Analisa ordens ativas vs pares e cancela ordens órfãs
 * Órfã = Ordem sem par correspondente do outro lado
 */

const db = require('./db.js');
const mbClient = require('./mb_client.js');

const colors = require('chalk');

async function main() {
    console.log(colors.cyan('\n' + '='.repeat(90)));
    console.log(colors.cyan('🗑️  CANCELADOR DE ORDENS ÓRFÃS'));
    console.log(colors.cyan('='.repeat(90)));

    try {
        // Inicializar BD
        await db.init();
        console.log(colors.green('✅ BD inicializado'));

        // Buscar todas as ordens abertas
        const orders = await db.getOrders({ status: 'open' });
        const buys = orders.filter(o => o.side.toLowerCase() === 'buy');
        const sells = orders.filter(o => o.side.toLowerCase() === 'sell');

        console.log(colors.yellow(`\n📊 ORDENS ABERTAS:`));
        console.log(`   🟢 BUY: ${buys.length}`);
        console.log(`   🔴 SELL: ${sells.length}`);
        console.log(`   Total: ${orders.length}`);

        // Identificar ordens em pares
        const buysInPairs = new Set();
        const sellsInPairs = new Set();

        // Verificar pares
        for (const buy of buys) {
            // Um BUY tem par se há pelo menos um SELL aberto
            const hasPair = sells.length > 0;
            if (hasPair) {
                buysInPairs.add(buy.id);
                // Primeiro SELL encontrado é o par
                sellsInPairs.add(sells[0].id);
                break;
            }
        }

        // Ordens órfãs
        const orphanBuys = buys.filter(o => !buysInPairs.has(o.id));
        const orphanSells = sells.filter(o => !sellsInPairs.has(o.id));

        console.log(colors.yellow(`\n🔗 ANÁLISE DE PARES:`));
        console.log(`   Em pares: ${buysInPairs.size + sellsInPairs.size}`);
        console.log(`   Órfãs: ${orphanBuys.length + orphanSells.length}`);

        if (orphanBuys.length === 0 && orphanSells.length === 0) {
            console.log(colors.green('\n✅ Nenhuma ordem órfã encontrada!'));
            process.exit(0);
        }

        // Listar órfãs
        console.log(colors.red(`\n⚠️  ORDENS ÓRFÃS A CANCELAR:`));

        if (orphanBuys.length > 0) {
            console.log(colors.red(`\n🟢 BUY Órfãs (${orphanBuys.length}):`));
            orphanBuys.forEach((o, idx) => {
                console.log(`   ${idx + 1}. ${o.id} | R$${parseFloat(o.price).toFixed(2)} | ${parseFloat(o.qty).toFixed(8)} BTC`);
            });
        }

        if (orphanSells.length > 0) {
            console.log(colors.red(`\n🔴 SELL Órfãs (${orphanSells.length}):`));
            orphanSells.forEach((o, idx) => {
                console.log(`   ${idx + 1}. ${o.id} | R$${parseFloat(o.price).toFixed(2)} | ${parseFloat(o.qty).toFixed(8)} BTC`);
            });
        }

        // Perguntar confirmação
        console.log(colors.yellow(`\n\n⚠️  ATENÇÃO: Você está prestes a cancelar ${orphanBuys.length + orphanSells.length} ordem(ns)!`));
        console.log(colors.yellow('   Digite "CANCELAR" para confirmar:'));

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('   > ', async (answer) => {
            rl.close();

            if (answer.trim().toUpperCase() !== 'CANCELAR') {
                console.log(colors.yellow('\n❌ Cancelamento abortado pelo usuário'));
                process.exit(0);
            }

            console.log(colors.cyan('\n🔄 Cancelando ordens órfãs...\n'));

            // Garantir autenticação
            await mbClient.ensureAuthenticated();

            let canceled = 0;
            let failed = 0;

            // Cancelar BUYs órfãs
            for (const order of orphanBuys) {
                try {
                    console.log(`   Cancelando BUY ${order.id}...`);
                    await mbClient.cancelOrder(order.id);
                    await db.updateOrderStatus(order.id, 'canceled');
                    canceled++;
                    console.log(colors.green(`   ✅ BUY ${order.id.substring(0, 12)}... cancelada`));
                } catch (err) {
                    failed++;
                    console.log(colors.red(`   ❌ ERRO ao cancelar BUY ${order.id.substring(0, 12)}...: ${err.message}`));
                }
            }

            // Cancelar SELLs órfãs
            for (const order of orphanSells) {
                try {
                    console.log(`   Cancelando SELL ${order.id}...`);
                    await mbClient.cancelOrder(order.id);
                    await db.updateOrderStatus(order.id, 'canceled');
                    canceled++;
                    console.log(colors.green(`   ✅ SELL ${order.id.substring(0, 12)}... cancelada`));
                } catch (err) {
                    failed++;
                    console.log(colors.red(`   ❌ ERRO ao cancelar SELL ${order.id.substring(0, 12)}...: ${err.message}`));
                }
            }

            console.log(colors.cyan('\n' + '='.repeat(90)));
            console.log(colors.green(`✅ Canceladas: ${canceled}`));
            if (failed > 0) {
                console.log(colors.red(`❌ Falhas: ${failed}`));
            }
            console.log(colors.cyan('='.repeat(90) + '\n'));

            process.exit(0);
        });

    } catch (err) {
        console.error(colors.red('❌ ERRO:'), err.message);
        process.exit(1);
    }
}

main();
