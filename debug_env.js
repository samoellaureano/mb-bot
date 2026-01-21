#!/usr/bin/env node
// Debug script para verificar USE_SWING_TRADING

console.log('=== DEBUG: Variáveis de Ambiente ===');
console.log('SIMULATE:', process.env.SIMULATE);
console.log('USE_SWING_TRADING:', process.env.USE_SWING_TRADING);
console.log('USE_SWING_TRADING === "true":', process.env.USE_SWING_TRADING === 'true');
console.log('typeof USE_SWING_TRADING:', typeof process.env.USE_SWING_TRADING);

// Teste de require
console.log('\n=== DEBUG: Teste de Require ===');
try {
    const SwingTradingStrategy = require('./swing_trading_strategy');
    console.log('✓ SwingTradingStrategy carregado');
    const strategy = new SwingTradingStrategy();
    console.log('✓ Estratégia instanciada');
    console.log('✓ shouldBuy tipo:', typeof strategy.shouldBuy);
    console.log('✓ shouldSell tipo:', typeof strategy.shouldSell);
} catch (e) {
    console.error('✗ Erro:', e.message);
}

console.log('\n=== DEBUG: Teste de Condicional ===');
if (process.env.USE_SWING_TRADING === 'true') {
    console.log('✓ Condicional ativado: USE_SWING_TRADING === "true"');
} else {
    console.log('✗ Condicional NÃO ativado');
    console.log('  Valor recebido:', JSON.stringify(process.env.USE_SWING_TRADING));
}
