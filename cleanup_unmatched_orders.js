#!/usr/bin/env node
/**
 * Script para limpar ordens desbalanceadas (BUY/SELL não emparelhadas)
 * Uso: node cleanup_unmatched_orders.js
 */

const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

const db = new sqlite3.Database('./database/orders.db');
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const PAIR = process.env.PAIR || 'BTC-BRL';

let accessToken = null;

async function authenticate() {
  try {
    const response = await axios.post('https://www.mercadobitcoin.net/api/v4/auth/jwt', {
      client_id: API_KEY,
      client_secret: API_SECRET
    }, { timeout: 15000 });
    
    accessToken = response.data.access_token;
    console.log(chalk.green('✓ Autenticado'));
    return true;
  } catch (e) {
    console.log(chalk.red('✗ Falha na autenticação: ' + e.message));
    return false;
  }
}

async function cancelOrder(orderId) {
  try {
    await axios.delete(`https://www.mercadobitcoin.net/api/v4/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000
    });
    return true;
  } catch (e) {
    console.log(chalk.yellow(`⚠ Falha ao cancelar ${orderId}: ${e.message}`));
    return false;
  }
}

async function main() {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.bold('🧹 Limpeza de Ordens Desbalanceadas\n'));

  // 1. Verificar ordens abertas
  const openOrders = db.prepare(`
    SELECT id, side, price, qty 
    FROM orders 
    WHERE status = 'open'
    ORDER BY timestamp DESC
  `).all();

  const buys = openOrders.filter(o => o.side === 'buy');
  const sells = openOrders.filter(o => o.side === 'sell');

  console.log(`📊 Status Atual:`);
  console.log(`   🔵 BUY: ${buys.length} ordens`);
  console.log(`   🔴 SELL: ${sells.length} ordens`);
  console.log(`   ⚖️ Diferença: ${Math.abs(buys.length - sells.length)} ordens desbalanceadas\n`);

  // 2. Determinar quais cancelar
  let toCancel = [];
  
  if (buys.length > sells.length) {
    console.log(chalk.yellow(`⚠️  Há ${buys.length - sells.length} BUY sem SELL correspondente\n`));
    // Cancelar BUY extras (mais antigos)
    toCancel = buys.slice(sells.length);
  } else if (sells.length > buys.length) {
    console.log(chalk.yellow(`⚠️  Há ${sells.length - buys.length} SELL sem BUY correspondente\n`));
    // Cancelar SELL extras (mais antigos)
    toCancel = sells.slice(buys.length);
  } else {
    console.log(chalk.green('✓ Ordens balanceadas!\n'));
    process.exit(0);
  }

  // 3. Mostrar ordens a cancelar
  console.log(chalk.bold('Ordens a Cancelar:\n'));
  toCancel.forEach((order, i) => {
    const abbr = order.id.substring(0, 8) + '...';
    console.log(`  ${i + 1}. ${chalk.blue(order.side.toUpperCase())} | ${order.id} | R$ ${order.price.toFixed(2)} | ${order.qty.toFixed(8)} BTC`);
  });

  // 4. Confirmar ação
  console.log(chalk.yellow('\n⚠️  AVISO: Esta ação será irreversível!\n'));
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(chalk.bold('Deseja continuar? (SIM/não): '), async (answer) => {
    rl.close();

    if (answer.toLowerCase() !== 'sim') {
      console.log(chalk.cyan('\n✓ Operação cancelada.\n'));
      process.exit(0);
    }

    // 5. Autenticar e cancelar
    const auth = await authenticate();
    if (!auth) process.exit(1);

    let cancelledCount = 0;
    console.log(chalk.cyan('\n📤 Cancelando ordens...\n'));

    for (const order of toCancel) {
      const abbr = order.id.substring(0, 8) + '...';
      console.log(`   Cancelando ${order.side.toUpperCase()} ${abbr}...`);
      
      const success = await cancelOrder(order.id);
      
      if (success) {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', order.id);
        console.log(chalk.green(`   ✓ Cancelado\n`));
        cancelledCount++;
      }
      
      await new Promise(r => setTimeout(r, 500)); // Throttle
    }

    console.log(chalk.green(`\n✓ Total cancelado: ${cancelledCount}/${toCancel.length}\n`));
    process.exit(0);
  });
}

main().catch(e => {
  console.error(chalk.red('Erro: ' + e.message));
  process.exit(1);
});
