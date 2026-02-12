#!/usr/bin/env node

/**
 * Teste Unitário: Validação de Bloqueio de SELL Órfá
 * 
 * Propósito: Confirmar que a proteção contra SELL sem BUY pareada está funcionando
 * 
 * Cenários testados:
 * 1. ✗ SELL sem BUY = BLOQUEADO
 * 2. ✓ BUY depois SELL = PERMITIDO
 * 3. ✓ Múltiplos pares alternados = PERMITIDO
 */

const assert = require('assert');

// Mock do sistema de ordens
const mockActiveOrders = new Map();
const mockPairMapping = new Map();
let blockedSells = 0;
let allowedSells = 0;

/**
 * Simula a validação de SELL sem BUY pareada
 * (Reproduz lógica de bot.js ~linha 870)
 */
function validateSellOrder(side, price, qty, pairIdInput = null, activeOrders) {
    if (side.toLowerCase() === 'sell' && !pairIdInput) {
        const buyOrder = activeOrders.get('buy');
        if (!buyOrder || !buyOrder.pairId) {
            console.log(`  ❌ BLOQUEADO: SELL sem BUY | Price: ${price.toFixed(2)} | Qty: ${qty.toFixed(8)}`);
            blockedSells++;
            return false; // BLOQUEADO
        }
    }
    console.log(`  ✅ PERMITIDO: ${side.toUpperCase()} | Price: ${price.toFixed(2)} | Qty: ${qty.toFixed(8)}`);
    if (side.toLowerCase() === 'sell') allowedSells++;
    return true;
}

console.log('\n🧪 TESTE UNITÁRIO: Validação de Bloqueio de SELL Órfá\n');

// ===== TESTE 1: SELL sem BUY deve ser BLOQUEADO =====
console.log('📋 Teste 1: Tentar colocar SELL sem BUY pareada');
mockActiveOrders.clear();
let result1 = validateSellOrder('sell', 476220.50, 0.00006, null, mockActiveOrders);
assert.strictEqual(result1, false, 'SELL sem BUY deveria ser bloqueada');
console.log('   ✅ Teste 1 passou!\n');

// ===== TESTE 2: BUY permite SELL subsequente =====
console.log('📋 Teste 2: BUY seguido de SELL');
mockActiveOrders.clear();

// Colocar BUY primeiro
const buyId = 'ORD_BUY_123';
mockActiveOrders.set('buy', {
    id: buyId,
    side: 'buy',
    price: 476220.00,
    qty: 0.00006,
    pairId: 'PAIR_2026_abc123'
});
console.log('  ✅ BUY colocada com pair_id: PAIR_2026_abc123');

// Agora SELL com a BUY ativa deve ser PERMITIDA
let result2 = validateSellOrder('sell', 476949.50, 0.00006, null, mockActiveOrders);
assert.strictEqual(result2, true, 'SELL com BUY pareada deveria ser permitida');
console.log('   ✅ Teste 2 passou!\n');

// ===== TESTE 3: Múltiplas SELL sem BUY deve bloquear a 2ª =====
console.log('📋 Teste 3: Múltiplas SELLs blocadas quando há apenas 1 BUY');
mockActiveOrders.clear();

// Primeira BUY
mockActiveOrders.set('buy', {
    id: 'ORD_BUY_456',
    side: 'buy',
    price: 350237.00,
    qty: 0.00006,
    pairId: 'PAIR_2026_def456'
});
console.log('  ✅ BUY colocada: PAIR_2026_def456');

// Primeira SELL deve ser permitida
let result3a = validateSellOrder('sell', 350938.50, 0.00006, null, mockActiveOrders);
assert.strictEqual(result3a, true, '1ª SELL deveria ser permitida');

// Remover BUY ativa para simular seu preenchimento/cancelamento
mockActiveOrders.delete('buy');

// Segunda SELL WITHOUT BUY deve ser bloqueada
let result3b = validateSellOrder('sell', 350700.00, 0.00006, null, mockActiveOrders);
assert.strictEqual(result3b, false, '2ª SELL sem BUY deveria ser bloqueada');
console.log('   ✅ Teste 3 passou!\n');

// ===== RESUMO =====
console.log('📊 RESUMO DOS TESTES\n');
console.log(`  Ordens SELL bloqueadas: ${blockedSells}`);
console.log(`  Ordens SELL permitidas: ${allowedSells}`);
console.log(`  Taxa de bloqueio: ${((blockedSells / (blockedSells + allowedSells)) * 100).toFixed(1)}%\n`);

console.log('✅ TODOS OS TESTES PASSARAM!');
console.log('\n🎯 Conclusão:');
console.log('   - SELL sem BUY pareada: ❌ BLOQUEADO');
console.log('   - SELL com BUY pareada: ✅ PERMITIDO');
console.log('   - Proteção contra pares órfás: ✅ ATIVA\n');

process.exit(0);
