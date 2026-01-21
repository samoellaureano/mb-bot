#!/usr/bin/env node
/**
 * test_momentum_validation.js
 * 
 * Script de teste para validar o sistema de confirmação por momentum
 * Simula movimento de preço e valida se as ordens são confirmadas/rejeitadas corretamente
 */

const MomentumOrderValidator = require('./momentum_order_validator');

// Mock logger
const mockLogger = (level, msg) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] [${level}] ${msg}`);
};

function testVendaNoTopo() {
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 1: VENDA NO TOPO (Ideal)');
    console.log('='.repeat(60));

    const validator = new MomentumOrderValidator(mockLogger);
    
    // Simular movimento de preço subindo
    const prices = [
        100000, 100500, 101000, 101500, 101800, 101500, 101000, 100800
    ];

    console.log('\n📊 Cenário: Preço subindo, esperamos VENDA no topo com CONFIRMAÇÃO');
    console.log(`Preços simulados: ${prices.join(' → ')}`);
    
    // Registrar histórico de preços
    prices.slice(0, 3).forEach(p => validator.recordPrice(p));
    
    // Criar ordem SELL simulada
    const sellOrder = validator.createSimulatedOrder('TEST_SELL_1', 'sell', 101000, 0.05);
    console.log(`\n✓ Ordem SELL criada: ${JSON.stringify(sellOrder, null, 2)}`);
    
    // Simular movimento de preço
    console.log('\n📈 Movimento de preço após criação da ordem:');
    const testPrices = prices.slice(3);
    
    testPrices.forEach((price, idx) => {
        validator.recordPrice(price);
        const update = validator.updateOrderWithPrice('TEST_SELL_1', price);
        
        console.log(`\nCiclo ${idx + 1}: Preço R$${price}`);
        console.log(`  Status: ${update.status}`);
        console.log(`  Motivo: ${update.reason}`);
        
        if (update.shouldConfirm) {
            console.log(`  ✅ RESULTADO FINAL: ${update.shouldConfirm ? 'CONFIRMADA ✓' : 'REJEITADA ✗'}`);
        }
    });

    const finalOrder = validator.simulatedOrders.get('TEST_SELL_1');
    console.log(`\n📊 Status Final: ${finalOrder.status}`);
    console.log(`   Pico atingido: R$${finalOrder.peakPrice}`);
    console.log(`   Ciclos esperados: 3 | Reais: ${finalOrder.confirmationCycles}`);
}

function testCompraNoFundo() {
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 2: COMPRA NO FUNDO (Ideal)');
    console.log('='.repeat(60));

    const validator = new MomentumOrderValidator(mockLogger);
    
    // Simular movimento de preço caindo
    const prices = [
        100000, 99500, 99000, 98500, 98300, 98500, 99000, 99200
    ];

    console.log('\n📊 Cenário: Preço caindo, esperamos COMPRA no fundo com CONFIRMAÇÃO');
    console.log(`Preços simulados: ${prices.join(' → ')}`);
    
    // Registrar histórico de preços
    prices.slice(0, 3).forEach(p => validator.recordPrice(p));
    
    // Criar ordem BUY simulada
    const buyOrder = validator.createSimulatedOrder('TEST_BUY_1', 'buy', 99000, 0.05);
    console.log(`\n✓ Ordem BUY criada: ${JSON.stringify(buyOrder, null, 2)}`);
    
    // Simular movimento de preço
    console.log('\n📉 Movimento de preço após criação da ordem:');
    const testPrices = prices.slice(3);
    
    testPrices.forEach((price, idx) => {
        validator.recordPrice(price);
        const update = validator.updateOrderWithPrice('TEST_BUY_1', price);
        
        console.log(`\nCiclo ${idx + 1}: Preço R$${price}`);
        console.log(`  Status: ${update.status}`);
        console.log(`  Motivo: ${update.reason}`);
        
        if (update.shouldConfirm) {
            console.log(`  ✅ RESULTADO FINAL: CONFIRMADA ✓`);
        }
    });

    const finalOrder = validator.simulatedOrders.get('TEST_BUY_1');
    console.log(`\n📊 Status Final: ${finalOrder.status}`);
    console.log(`   Vale atingido: R$${finalOrder.valleyPrice}`);
    console.log(`   Ciclos esperados: 3 | Reais: ${finalOrder.confirmationCycles}`);
}

function testVendaRejeitada() {
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 3: VENDA REJEITADA (Preço Cai)');
    console.log('='.repeat(60));

    const validator = new MomentumOrderValidator(mockLogger);
    
    // Preço sobe mas depois cai abaixo do entry
    const prices = [
        100000, 100500, 101000, 100200, 100000, 99800, 99500
    ];

    console.log('\n📊 Cenário: Preço sobe, VENDA criada, mas depois cai → REJEIÇÃO');
    console.log(`Preços simulados: ${prices.join(' → ')}`);
    
    prices.slice(0, 3).forEach(p => validator.recordPrice(p));
    
    const sellOrder = validator.createSimulatedOrder('TEST_SELL_2', 'sell', 100500, 0.05);
    console.log(`\n✓ Ordem SELL criada @ R$100500`);
    
    console.log('\n📈 Movimento de preço:');
    const testPrices = prices.slice(3);
    
    let rejected = false;
    testPrices.forEach((price, idx) => {
        validator.recordPrice(price);
        const update = validator.updateOrderWithPrice('TEST_SELL_2', price);
        
        console.log(`\nCiclo ${idx + 1}: Preço R$${price}`);
        console.log(`  Status: ${update.status}`);
        console.log(`  Motivo: ${update.reason}`);
        
        if (update.status === 'rejected' && !rejected) {
            console.log(`  ❌ RESULTADO: REJEITADA ✗`);
            console.log(`     Motivo: Preço desceu abaixo do entry`);
            rejected = true;
        }
    });

    const finalOrder = validator.simulatedOrders.get('TEST_SELL_2');
    console.log(`\n📊 Status Final: ${finalOrder.status}`);
    console.log(`   Razão rejeição: ${finalOrder.rejectionReason}`);
}

function testCompraRejeitada() {
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 4: COMPRA REJEITADA (Preço Sobe)');
    console.log('='.repeat(60));

    const validator = new MomentumOrderValidator(mockLogger);
    
    // Preço cai mas depois sobe acima do entry
    const prices = [
        100000, 99500, 99000, 99800, 100100, 100500, 101000
    ];

    console.log('\n📊 Cenário: Preço cai, COMPRA criada, mas depois sobe → REJEIÇÃO');
    console.log(`Preços simulados: ${prices.join(' → ')}`);
    
    prices.slice(0, 3).forEach(p => validator.recordPrice(p));
    
    const buyOrder = validator.createSimulatedOrder('TEST_BUY_2', 'buy', 99500, 0.05);
    console.log(`\n✓ Ordem BUY criada @ R$99500`);
    
    console.log('\n📉 Movimento de preço:');
    const testPrices = prices.slice(3);
    
    let rejected = false;
    testPrices.forEach((price, idx) => {
        validator.recordPrice(price);
        const update = validator.updateOrderWithPrice('TEST_BUY_2', price);
        
        console.log(`\nCiclo ${idx + 1}: Preço R$${price}`);
        console.log(`  Status: ${update.status}`);
        console.log(`  Motivo: ${update.reason}`);
        
        if (update.status === 'rejected' && !rejected) {
            console.log(`  ❌ RESULTADO: REJEITADA ✗`);
            console.log(`     Motivo: Preço subiu acima do entry (bounce falso)`);
            rejected = true;
        }
    });

    const finalOrder = validator.simulatedOrders.get('TEST_BUY_2');
    console.log(`\n📊 Status Final: ${finalOrder.status}`);
    console.log(`   Razão rejeição: ${finalOrder.rejectionReason}`);
}

function testMultiplaSimultanea() {
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 5: MÚLTIPLAS ORDENS SIMULTÂNEAS');
    console.log('='.repeat(60));

    const validator = new MomentumOrderValidator(mockLogger);
    
    console.log('\n📊 Cenário: Múltiplas ordens sendo validadas ao mesmo tempo');
    
    // Registrar histórico base
    const baseHistory = [100000, 100200, 100400];
    baseHistory.forEach(p => validator.recordPrice(p));
    
    // Criar múltiplas ordens
    validator.createSimulatedOrder('SELL_A', 'sell', 100400, 0.02);
    validator.createSimulatedOrder('SELL_B', 'sell', 100500, 0.02);
    validator.createSimulatedOrder('BUY_A', 'buy', 100200, 0.03);
    validator.createSimulatedOrder('BUY_B', 'buy', 99900, 0.03);
    
    console.log(`\n✓ 4 ordens simuladas criadas`);
    
    // Simular movimento misto
    const movimentos = [
        { price: 100600, desc: 'Continuou subindo' },
        { price: 100800, desc: 'Pico forte' },
        { price: 100500, desc: 'Começou a cair' },
        { price: 100000, desc: 'Caída significativa' },
        { price: 99500, desc: 'Vale' },
        { price: 99800, desc: 'Recuperação' }
    ];
    
    console.log('\n📊 Movimento de preço:');
    movimentos.forEach((mov, idx) => {
        validator.recordPrice(mov.price);
        console.log(`\nCiclo ${idx + 1}: R$${mov.price} - ${mov.desc}`);
        
        const status = validator.getSimulatedOrdersStatus();
        if (status.total > 0) {
            console.log(`   Status: Simuladas=${status.byStatus.simulated}, Confirmadas=${status.byStatus.confirmed}, Rejeitadas=${status.byStatus.rejected}`);
            
            // Processar atualizações
            for (const [orderId, order] of validator.simulatedOrders) {
                if (order.status === 'simulated' || order.status === 'pending') {
                    const update = validator.updateOrderWithPrice(orderId, mov.price);
                    if (update.shouldConfirm || update.status === 'rejected') {
                        console.log(`   → ${orderId}: ${update.status.toUpperCase()}`);
                    }
                }
            }
        }
    });
    
    console.log('\n📊 Resultado Final:');
    const finalStatus = validator.getSimulatedOrdersStatus();
    console.log(JSON.stringify(finalStatus, null, 2));
}

// Executar testes
if (require.main === module) {
    console.log('🧪 TESTE COMPLETO: MOMENTUM ORDER VALIDATOR');
    
    testVendaNoTopo();
    testCompraNoFundo();
    testVendaRejeitada();
    testCompraRejeitada();
    testMultiplaSimultanea();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TODOS OS TESTES CONCLUÍDOS');
    console.log('='.repeat(60));
}

module.exports = {
    testVendaNoTopo,
    testCompraNoFundo,
    testVendaRejeitada,
    testCompraRejeitada,
    testMultiplaSimultanea
};
