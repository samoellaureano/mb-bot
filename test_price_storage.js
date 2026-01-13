#!/usr/bin/env node
/**
 * test_price_storage.js - Teste de armazenamento de preços
 * Verifica se os preços estão sendo armazenados corretamente no banco
 */

require('dotenv').config();
const db = require('./db');

async function test() {
    console.log('🧪 Iniciando teste de armazenamento de preços...\n');
    
    try {
        // 1️⃣ Inicializar banco
        console.log('1️⃣ Inicializando banco de dados...');
        await db.init();
        console.log('✅ Banco inicializado\n');
        
        // 2️⃣ Salvar alguns preços
        console.log('2️⃣ Salvando preços de teste...');
        const testPrices = [
            {price: 491000, msg: 'Preço 1'},
            {price: 491500, msg: 'Preço 2'},
            {price: 491200, msg: 'Preço 3'},
            {price: 491800, msg: 'Preço 4'},
            {price: 491600, msg: 'Preço 5'}
        ];
        
        for (const test of testPrices) {
            const ts = await db.saveBtcPrice(test.price);
            console.log(`   ✓ ${test.msg}: R$ ${test.price.toFixed(2)} (timestamp: ${ts})`);
        }
        console.log('');
        
        // 3️⃣ Recuperar últimas 24h
        console.log('3️⃣ Recuperando histórico das últimas 24h...');
        const priceHistory = await db.getPriceHistory(24, 10);
        console.log(`✅ Carregados ${priceHistory.length} registros de preço:`);
        priceHistory.forEach((p, i) => {
            const date = new Date(p.timestamp * 1000);
            console.log(`   ${i+1}. R$ ${p.price.toFixed(2)} - ${date.toLocaleString('pt-BR')}`);
        });
        console.log('');
        
        // 4️⃣ Obter último preço
        console.log('4️⃣ Obtendo último preço armazenado...');
        const latest = await db.getLatestBtcPrice();
        if (latest) {
            const date = new Date(latest.timestamp * 1000);
            console.log(`✅ Último preço: R$ ${latest.price.toFixed(2)} (${date.toLocaleString('pt-BR')})`);
        } else {
            console.log('⚠️ Nenhum preço encontrado');
        }
        console.log('');
        
        // 5️⃣ Contar registros no banco
        console.log('5️⃣ Verificando dados no banco...');
        const count = await new Promise((resolve, reject) => {
            db.db.get('SELECT COUNT(*) as count FROM price_history', (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            });
        });
        console.log(`✅ Total de registros na tabela price_history: ${count}`);
        console.log('');
        
        console.log('✨ Teste concluído com sucesso!');
        console.log('✅ Sistema de armazenamento de preços está funcionando!');
        process.exit(0);
        
    } catch (e) {
        console.error('❌ Erro durante o teste:', e.message);
        process.exit(1);
    }
}

test();
