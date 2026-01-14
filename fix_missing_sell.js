#!/usr/bin/env node
/**
 * fix_missing_sell.js - Correção de pares desbalanceados
 * Cria SELL faltante para BUY órfã
 */

require('dotenv').config();
const db = require('./db');

(async () => {
  try {
    // Inicializar DB
    await db.init();
    
    // 1. Encontrar todos os pares abertos
    const allOrders = await db.getOrders({ status: 'open', limit: 1000 });
    console.log(`📋 Total de ordens abertas: ${allOrders.length}`);
    
    // 2. Agrupar por pair_id e side
    const pairMap = {};
    allOrders.forEach(order => {
      if (!pairMap[order.pair_id]) {
        pairMap[order.pair_id] = { buy: [], sell: [] };
      }
      pairMap[order.pair_id][order.side].push(order);
    });
    
    // 3. Encontrar pares com BUY mas sem SELL
    const buyOnlyPairs = [];
    Object.entries(pairMap).forEach(([pairId, sides]) => {
      console.log(`  ${pairId}: ${sides.buy.length} BUY, ${sides.sell.length} SELL`);
      if (sides.buy.length > 0 && sides.sell.length === 0) {
        buyOnlyPairs.push(pairId);
      }
    });
    
    console.log('\n🚨 Pares desbalanceados (BUY sem SELL):');
    buyOnlyPairs.forEach(p => console.log(`  - ${p}`));
    
    if (buyOnlyPairs.length === 0) {
      console.log('\n✅ Nenhum par desbalanceado encontrado!');
      await db.close();
      process.exit(0);
    }
    
    // 4. Para cada par com BUY órfã, criar SELL
    for (const pairId of buyOnlyPairs) {
      const buyOrder = pairMap[pairId].buy[0];
      
      if (!buyOrder) {
        console.log(`⚠️ BUY não encontrada para ${pairId}`);
        continue;
      }
      
      // Calcular preço SELL com spread apropriado (0.8%)
      const spread = 0.008;
      const sellPrice = buyOrder.price * (1 + spread);
      
      console.log(`\n📍 Par: ${pairId}`);
      console.log(`   BUY: ${buyOrder.price.toFixed(2)} (Qty: ${buyOrder.qty.toFixed(8)})`);
      console.log(`   SELL: ${sellPrice.toFixed(2)} (a ser criada)`);
      
      // Criar SELL
      const sellId = `SELL_FIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const sellOrder = {
        id: sellId,
        side: 'sell',
        price: sellPrice,
        qty: buyOrder.qty,
        status: 'open',
        filledQty: 0,
        timestamp: Date.now(),
        pair_id: pairId,
        sessionId: null,
        pnl: 0
      };
      
      await db.saveOrder(sellOrder);
      console.log(`   ✅ SELL criada: ${sellId}`);
    }
    
    await db.close();
    console.log('\n🎉 Correção concluída!');
    process.exit(0);
    
  } catch (e) {
    console.error('❌ Erro:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
