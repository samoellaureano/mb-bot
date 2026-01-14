#!/usr/bin/env node
/**
 * cancel_open_orders.js - Cancela todas as ordens abertas no Mercado Bitcoin
 */

require('dotenv').config();
const MB = require('./mb_client');

(async () => {
  try {
    console.log('🔐 Autenticando no Mercado Bitcoin...');
    await MB.authenticate();
    console.log('✅ Autenticado com sucesso!\n');

    console.log('📋 Buscando ordens abertas...');
    const openOrders = await MB.getOpenOrders();
    
    if (!openOrders || openOrders.length === 0) {
      console.log('✅ Nenhuma ordem aberta para cancelar.');
      process.exit(0);
    }

    console.log(`\n🔔 Encontradas ${openOrders.length} ordem(ns) aberta(s):\n`);
    openOrders.forEach((order, idx) => {
      console.log(`${idx + 1}. ID: ${order.id}`);
      console.log(`   Lado: ${order.side.toUpperCase()}`);
      console.log(`   Preço: ${order.price} BRL`);
      console.log(`   Quantidade: ${order.qty} BTC`);
      console.log(`   Status: ${order.status}\n`);
    });

    console.log('⚠️ CANCELANDO todas as ordens...\n');
    
    for (const order of openOrders) {
      try {
        await MB.cancelOrder(order.id);
        console.log(`✅ Cancelada: ${order.id}`);
      } catch (err) {
        console.error(`❌ Erro ao cancelar ${order.id}: ${err.message}`);
      }
    }

    console.log('\n✨ Operação concluída!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
