#!/usr/bin/env node
/**
 * place_missing_sell.js - Coloca SELL faltante na exchange real
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
    console.log('✅ Autenticado com sucesso');
    
    // Encontrar a SELL no banco de dados
    const orders = await db.getOrders({ limit: 1000 });
    const sellOrder = orders.find(o => o.id === 'SELL_FIX_1768418092424_exwzifnb5');
    
    if (!sellOrder) {
      console.log('❌ SELL não encontrada no banco de dados');
      await db.close();
      process.exit(1);
    }
    
    console.log('\n📋 SELL a ser colocada:');
    console.log(`   ID Local: ${sellOrder.id}`);
    console.log(`   Preço: R$ ${sellOrder.price.toFixed(2)}`);
    console.log(`   Quantidade: ${sellOrder.qty.toFixed(8)} BTC`);
    console.log(`   Par: BTC-BRL`);
    
    // Colocar ordem SELL na exchange
    console.log('\n🚀 Colocando SELL na Mercado Bitcoin...');
    
    // Garantir que a quantidade atende o mínimo da MB (0.00000001)
    // Usar 0.00000150 como mínimo seguro
    let finalQty = sellOrder.qty;
    if (finalQty < 0.0000015) {
      console.log(`⚠️ Quantidade ${finalQty} abaixo do mínimo seguro (0.0000015), ajustando...`);
      finalQty = 0.0000015;
    }
    
    const orderData = {
        pair: 'BTC-BRL',
        side: 'sell',
        limitPrice: sellOrder.price,
        qty: finalQty.toString(),
        type: 'limit'
    };
    
    const result = await MB.placeOrder(orderData);
    
    console.log('\n✅ SELL colocada com sucesso!');
    console.log(`   MB Order ID: ${result.orderId}`);
    console.log(`   Status: ${result.orderStatus || 'open'}`);
    
    // Atualizar o banco de dados com o ID externo (buscar DB interno)
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = './database/orders.db';
    const dbConn = new sqlite3.Database(dbPath);
    
    await new Promise((resolve, reject) => {
      dbConn.run(
        'UPDATE orders SET external_id = ? WHERE id = ?',
        [result.orderId, 'SELL_FIX_1768418092424_exwzifnb5'],
        function(err) {
          if (err) reject(err);
          else {
            console.log('✅ Banco de dados atualizado com ID externo');
            resolve();
          }
        }
      );
    });
    
    dbConn.close();
    console.log(`\n🎉 PAIR_1768416916966_2risnofm9 SELL agora está ativa!`);
    
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
