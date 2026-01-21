#!/usr/bin/env node
/**
 * place_pending_orders.js - Coloca todas as ordens pendentes na exchange
 * Sincroniza BD local com Mercado Bitcoin
 */

require('dotenv').config();
const db = require('./db');
const MB = require('./mb_client');

(async () => {
  try {
    // Inicializar
    await db.init();
    
    // Autenticar na MB
    console.log('🔐 Autenticando na Mercado Bitcoin...');
    await MB.authenticate();
    console.log('✅ Autenticado com sucesso\n');
    
    // Encontrar todas as ordens pendentes (sem external_id)
    const allOrders = await db.getOrders({ limit: 1000 });
    const pendingOrders = allOrders.filter(o => o.status === 'open' && (!o.external_id || o.external_id === ''));
    
    console.log(`📋 Total de ordens pendentes: ${pendingOrders.length}`);
    
    if (pendingOrders.length === 0) {
      console.log('✅ Nenhuma ordem pendente!');
      await db.close();
      process.exit(0);
    }
    
    // Agrupar por par para manter balanceamento
    const pairMap = {};
    pendingOrders.forEach(order => {
      if (!pairMap[order.pair_id]) {
        pairMap[order.pair_id] = { buy: [], sell: [] };
      }
      pairMap[order.pair_id][order.side].push(order);
    });
    
    // Processar cada par
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = './database/orders.db';
    const dbConn = new sqlite3.Database(dbPath);
    
    let placed = 0;
    let failed = 0;
    
    for (const [pairId, sides] of Object.entries(pairMap)) {
      console.log(`\n📍 Par: ${pairId}`);
      
      // Colocar BUYs primeiro
      for (const buyOrder of sides.buy) {
        try {
          console.log(`  🔵 Colocando BUY: R$ ${buyOrder.price.toFixed(2)} | ${buyOrder.qty.toFixed(8)} BTC`);
          
          const result = await MB.placeOrder({
            pair: 'BTC-BRL',
            side: 'buy',
            limitPrice: buyOrder.price,
            qty: buyOrder.qty.toString(),
            type: 'limit'
          });
          
          console.log(`     ✅ ID Exchange: ${result.orderId}`);
          
          // Atualizar BD
          await new Promise((resolve, reject) => {
            dbConn.run(
              'UPDATE orders SET external_id = ? WHERE id = ?',
              [result.orderId, buyOrder.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          placed++;
        } catch (e) {
          console.log(`     ❌ Erro: ${e.message}`);
          failed++;
        }
      }
      
      // Depois colocar SELLs
      for (const sellOrder of sides.sell) {
        try {
          console.log(`  🔴 Colocando SELL: R$ ${sellOrder.price.toFixed(2)} | ${sellOrder.qty.toFixed(8)} BTC`);
          
          const result = await MB.placeOrder({
            pair: 'BTC-BRL',
            side: 'sell',
            limitPrice: sellOrder.price,
            qty: sellOrder.qty.toString(),
            type: 'limit'
          });
          
          console.log(`     ✅ ID Exchange: ${result.orderId}`);
          
          // Atualizar BD
          await new Promise((resolve, reject) => {
            dbConn.run(
              'UPDATE orders SET external_id = ? WHERE id = ?',
              [result.orderId, sellOrder.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          placed++;
        } catch (e) {
          console.log(`     ❌ Erro: ${e.message}`);
          failed++;
        }
      }
    }
    
    dbConn.close();
    
    console.log(`\n📊 RESUMO:`);
    console.log(`  ✅ Colocadas: ${placed}`);
    console.log(`  ❌ Falhadas: ${failed}`);
    console.log(`\n🎉 Sincronização concluída!`);
    
    await db.close();
    process.exit(0);
    
  } catch (e) {
    console.error('\n❌ Erro:', e.message);
    if (e.response?.data) {
      console.error('Detalhes:', e.response.data);
    }
    process.exit(1);
  }
})();
