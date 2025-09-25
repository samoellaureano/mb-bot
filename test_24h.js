#!/usr/bin/env node
/**
 * test_24h.js - Teste completo de MB Bot por 24h
 * Executa ordens simuladas, loga saldo, ticker e open orders
 */

require('dotenv').config();
const MB = require('./mb_client');

const SIMULATE = MB.SIMULATE;
const ORDER_INTERVAL_MS = parseInt(process.env.ORDER_INTERVAL_MS || 60_000); // 1 min
const TEST_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const SPREAD_PCT = MB.SPREAD_PCT;
const ORDER_SIZE = MB.ORDER_SIZE;

async function runTest24h() {
    console.log('🟢 Iniciando teste de 24h do MB Bot...');
    const startTime = Date.now();
    const endTime = startTime + TEST_DURATION_MS;

    while (Date.now() < endTime) {
        try {
            // 1️⃣ Atualiza ticker
            const ticker = await MB.getTicker();
            const lastPrice = parseFloat(ticker.last);
            console.log(`💰 Ticker ${MB.PAIR}: R$ ${lastPrice.toLocaleString('pt-BR')}`);

            // 2️⃣ Atualiza saldo
            let balances = await MB.getBalances();
            if (!Array.isArray(balances)) balances = balances.data || [];
            const brl = balances.find(b => b.symbol === 'BRL')?.available || 0;
            const btc = balances.find(b => b.symbol === 'BTC')?.available || 0;
            console.log(`💵 Saldo BRL: ${parseFloat(brl).toLocaleString('pt-BR')} | ₿ BTC: ${parseFloat(btc).toFixed(8)}`);

            // 3️⃣ Cria ordens simuladas
            const buyPrice = lastPrice * (1 - SPREAD_PCT);
            const sellPrice = lastPrice * (1 + SPREAD_PCT);

            const buyOrder = await MB.placeOrder('buy', buyPrice, ORDER_SIZE);
            const sellOrder = await MB.placeOrder('sell', sellPrice, ORDER_SIZE);

            console.log(`📋 Ordens criadas -> Buy: ${buyOrder.orderId || 'N/A'} | Sell: ${sellOrder.orderId || 'N/A'}`);

            // 4️⃣ Checa open orders
            if (MB.getOpenOrders) {
                const openOrders = await MB.getOpenOrders();
                console.log(`📌 Open Orders: ${openOrders.length === undefined ? 'N/A' : openOrders.length}`);
            }

            // 5️⃣ Cancela ordens antigas (simulação)
            if (buyOrder.orderId) {
                await MB.cancelOrder(buyOrder.orderId);
                console.log(`❌ Buy order cancelada: ${buyOrder.orderId == undefined ? 'N/A' : buyOrder.orderId}`);
            }
            if (sellOrder.orderId) {
                await MB.cancelOrder(sellOrder.orderId);
                console.log(`❌ Sell order cancelada: ${sellOrder.orderId == undefined ? 'N/A' : sellOrder.orderId}`);
            }

        } catch (err) {
            console.error('⚠️ Erro no loop:', err.message);
        }

        // Espera intervalo antes da próxima rodada
        await new Promise(r => setTimeout(r, ORDER_INTERVAL_MS));
    }

    console.log('🛑 Teste de 24h finalizado!');
}

// Executa
runTest24h().catch(err => {
    console.error('💥 Erro crítico:', err);
    process.exit(1);
});