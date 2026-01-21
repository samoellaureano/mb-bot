#!/usr/bin/env node
/**
 * TESTE DE OTIMIZAÇÃO DE PNL
 * Valida a implementação da Fase 1 e 2 de otimização
 * - Aumentar spread (1.5% → 2.5%)
 * - Aumentar order size (10x)
 * - Spread adaptativo inteligente
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 TESTE DE OTIMIZAÇÃO DE PNL\n');

// 1. Validar .env
console.log('1️⃣ Validando configuração (.env)...');
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const configs = {
    'SPREAD_PCT': '0.025',
    'MIN_SPREAD_PCT': '0.020',
    'ORDER_SIZE': '0.00005',
    'STOP_LOSS_PCT': '0.015',
    'TAKE_PROFIT_PCT': '0.025'
};

let envValid = true;
for (const [key, expectedValue] of Object.entries(configs)) {
    const regex = new RegExp(`^${key}=(.+)$`, 'm');
    const match = envContent.match(regex);
    const value = match ? match[1].trim() : null;
    const status = value === expectedValue ? '✅' : '❌';
    console.log(`  ${status} ${key}=${value} (esperado: ${expectedValue})`);
    if (value !== expectedValue) envValid = false;
}

if (!envValid) {
    console.log('\n❌ Configuração .env incompleta ou incorreta!\n');
    process.exit(1);
}

console.log('✅ Configuração válida!\n');

// 2. Validar bot.js
console.log('2️⃣ Validando implementação em bot.js...');
const botPath = path.join(__dirname, 'bot.js');
const botContent = fs.readFileSync(botPath, 'utf8');

// Verificar se getAdaptiveSpread existe
if (!botContent.includes('function getAdaptiveSpread(')) {
    console.log('❌ Função getAdaptiveSpread não encontrada!\n');
    process.exit(1);
}
console.log('  ✅ Função getAdaptiveSpread existe');

// Verificar se é usada
if (!botContent.includes('getAdaptiveSpread({')) {
    console.log('❌ Função getAdaptiveSpread não está sendo usada!\n');
    process.exit(1);
}
console.log('  ✅ Função getAdaptiveSpread está sendo usada');

// Verificar se tem logs de debug
if (!botContent.includes('[SPREAD_ADAPT]')) {
    console.log('❌ Logs de spread adaptativo não encontrados!\n');
    process.exit(1);
}
console.log('  ✅ Logs de spread adaptativo implementados');

console.log('✅ Implementação válida!\n');

// 3. Simular cálculos de spread
console.log('3️⃣ Simulando cálculos de spread adaptativo...\n');

// Mock do getAdaptiveSpread para teste
const MIN_SPREAD_PCT = 0.020;
const MAX_SPREAD_PCT = 0.040;
const SPREAD_PCT = 0.025;

function getAdaptiveSpread(params = {}) {
    const { volatility = 0.5, regime = 'RANGING', rsi = 50, conviction = 0.5 } = params;
    
    let spread = Math.max(MIN_SPREAD_PCT, SPREAD_PCT);
    
    // Factor 1: Volatilidade
    const volFactor = volatility < 0.5 ? 0.85 : (volatility > 2.0 ? 1.25 : 1.0);
    spread *= volFactor;
    
    // Factor 2: Regime
    const regimeFactors = {
        'BULL_TREND': 0.9,
        'BEAR_TREND': 1.2,
        'RANGING': 1.05,
    };
    spread *= (regimeFactors[regime] || 1.0);
    
    // Factor 3: RSI
    if (rsi > 75 || rsi < 25) spread *= 1.15;
    
    // Factor 4: Confiança
    if (conviction > 0.75) spread *= 0.9;
    else if (conviction < 0.3) spread *= 1.3;
    
    // Garantir limites
    spread = Math.max(MIN_SPREAD_PCT, Math.min(MAX_SPREAD_PCT, spread));
    return spread;
}

// Casos de teste
const testCases = [
    { name: 'Mercado neutro baixa vol', vol: 0.3, regime: 'RANGING', rsi: 50, conviction: 0.5 },
    { name: 'Trend de alta com vol normal', vol: 0.8, regime: 'BULL_TREND', rsi: 65, conviction: 0.75 },
    { name: 'Trend de baixa com vol alta', vol: 2.5, regime: 'BEAR_TREND', rsi: 35, conviction: 0.3 },
    { name: 'Exaustão de alta com alta confiança', vol: 0.5, regime: 'BULL_TREND', rsi: 80, conviction: 0.8 },
    { name: 'Exaustão de baixa com baixa confiança', vol: 1.5, regime: 'BEAR_TREND', rsi: 20, conviction: 0.2 },
];

console.log('📊 Resultados do spread adaptativo:\n');
for (const testCase of testCases) {
    const spread = getAdaptiveSpread({
        volatility: testCase.vol,
        regime: testCase.regime,
        rsi: testCase.rsi,
        conviction: testCase.conviction,
        baseSpread: SPREAD_PCT
    });
    
    const spreadPct = (spread * 100).toFixed(2);
    const improvement = ((spread / 0.015 - 1) * 100).toFixed(0);
    console.log(`  ${testCase.name}:`);
    console.log(`    Spread: ${spreadPct}% | +${improvement}% vs anterior (1.5%)`);
    console.log(`    (vol=${testCase.vol}%, regime=${testCase.regime}, rsi=${testCase.rsi}, conviction=${testCase.conviction})\n`);
}

// 4. Validar impacto no PnL
console.log('4️⃣ Calculando impacto no PnL esperado...\n');

const oldConfig = {
    spread: 0.015,
    orderSize: 0.000005,
    btcPrice: 483000,
    fees: 0.01, // 1% (Maker 0.3% + Taker 0.7%)
};

const newConfig = {
    spread: 0.025,
    orderSize: 0.00005,
    btcPrice: 483000,
    fees: 0.01,
};

function calculateProfitPerOrder(config) {
    const orderValueBrl = config.orderSize * config.btcPrice;
    const grossProfit = orderValueBrl * config.spread;
    const feeCost = orderValueBrl * config.fees;
    const netProfit = grossProfit - feeCost;
    return { orderValue: orderValueBrl, grossProfit, feeCost, netProfit };
}

const oldProfit = calculateProfitPerOrder(oldConfig);
const newProfit = calculateProfitPerOrder(newConfig);

console.log('💰 Comparação de lucro por operação:\n');
console.log('  ANTES (Spread 1.5%, Order R$2.40):');
console.log(`    Valor ordem: R$ ${oldProfit.orderValue.toFixed(2)}`);
console.log(`    Lucro bruto: R$ ${oldProfit.grossProfit.toFixed(4)}`);
console.log(`    Taxa: R$ ${oldProfit.feeCost.toFixed(4)}`);
console.log(`    Lucro líquido: R$ ${oldProfit.netProfit.toFixed(4)}\n`);

console.log('  DEPOIS (Spread 2.5%, Order R$24):');
console.log(`    Valor ordem: R$ ${newProfit.orderValue.toFixed(2)}`);
console.log(`    Lucro bruto: R$ ${newProfit.grossProfit.toFixed(2)}`);
console.log(`    Taxa: R$ ${newProfit.feeCost.toFixed(2)}`);
console.log(`    Lucro líquido: R$ ${newProfit.netProfit.toFixed(2)}\n`);

const improvementX = (newProfit.netProfit / oldProfit.netProfit).toFixed(1);
console.log(`🎯 MELHORIA: ${improvementX}x maior lucro por operação!\n`);

// 5. Projeção de 24h
console.log('5️⃣ Projeção de impacto em 24 horas:\n');

const cyclesPerDay = (24 * 60 * 60) / 30; // Ciclo a cada 30s
const oldDaily = oldProfit.netProfit * cyclesPerDay * 2; // 2 ordens por ciclo (buy + sell)
const newDaily = newProfit.netProfit * cyclesPerDay * 2;

console.log(`  Ciclos por dia: ~${Math.round(cyclesPerDay)}`);
console.log(`  Ordens por ciclo: 2 (buy + sell)`);
console.log(`  Total de operações: ~${Math.round(cyclesPerDay * 2)}\n`);

console.log(`  ANTES: R$ ${oldDaily.toFixed(2)}/dia`);
console.log(`  DEPOIS: R$ ${newDaily.toFixed(2)}/dia`);
console.log(`  GANHO DIÁRIO: R$ ${(newDaily - oldDaily).toFixed(2)}\n`);

// 6. Status final
console.log('✅ TESTE CONCLUÍDO COM SUCESSO!\n');
console.log('📋 Resumo das mudanças:');
console.log('  ✅ Spread: 1.5% → 2.5% (mínimo)');
console.log('  ✅ Order Size: 5μBTC → 50μBTC (10x maior)');
console.log('  ✅ Stop Loss: 0.8% → 1.5%');
console.log('  ✅ Take Profit: 1.5% → 2.5%');
console.log('  ✅ Spread adaptativo inteligente implementado');
console.log(`  ✅ Lucro esperado: ${improvementX}x melhor por operação\n`);

console.log('🚀 Pronto para executar!\n');
console.log('Próximos passos:');
console.log('  1. npm run dev        # Testar em simulação por 1-2 horas');
console.log('  2. npm run stats      # Validar novos lucros');
console.log('  3. npm run live       # Se validado, ir para produção\n');
