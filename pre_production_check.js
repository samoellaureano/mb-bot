#!/usr/bin/env node
/**
 * pre_production_check.js
 * 
 * Script de validação pré-produção
 * Verifica configuração antes de rodar em modo LIVE
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🔍 PRÉ-VALIDAÇÃO PARA MODO LIVE');
console.log('='.repeat(80) + '\n');

let checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function checkPass(msg) {
    console.log(`✅ ${msg}`);
    checks.passed++;
}

function checkFail(msg) {
    console.log(`❌ ${msg}`);
    checks.failed++;
}

function checkWarn(msg) {
    console.log(`⚠️  ${msg}`);
    checks.warnings++;
}

// 1. Verificar variáveis de ambiente
console.log('📋 VERIFICANDO CONFIGURAÇÃO:\n');

if (process.env.SIMULATE === 'false') {
    checkPass('SIMULATE=false (Modo LIVE ativado)');
} else if (process.env.SIMULATE !== 'true') {
    checkWarn('SIMULATE não definido (usar false para produção)');
} else {
    checkFail('SIMULATE=true (Modo SIMULAÇÃO - não é produção!)');
}

if (process.env.USE_SWING_TRADING === 'true') {
    checkPass('USE_SWING_TRADING=true (Estratégia ativada)');
} else {
    checkFail('USE_SWING_TRADING não está ativado');
}

// 2. Verificar credenciais
console.log('\n🔐 VERIFICANDO CREDENCIAIS:\n');

if (process.env.API_KEY && process.env.API_KEY.length > 20) {
    checkPass(`API_KEY configurada (${process.env.API_KEY.substring(0, 10)}...)`);
} else {
    checkFail('API_KEY não configurada ou inválida');
}

if (process.env.API_SECRET && process.env.API_SECRET.length > 20) {
    checkPass(`API_SECRET configurada (${process.env.API_SECRET.substring(0, 10)}...)`);
} else {
    checkFail('API_SECRET não configurada ou inválida');
}

// 3. Verificar módulos
console.log('\n📦 VERIFICANDO MÓDULOS:\n');

try {
    require('./swing_trading_strategy');
    checkPass('swing_trading_strategy.js encontrado');
} catch (e) {
    checkFail(`swing_trading_strategy.js não encontrado: ${e.message}`);
}

try {
    require('./bot');
    checkPass('bot.js encontrado e válido');
} catch (e) {
    checkFail(`bot.js inválido: ${e.message}`);
}

try {
    require('./db');
    checkPass('db.js encontrado');
} catch (e) {
    checkFail(`db.js não encontrado: ${e.message}`);
}

// 4. Verificar configurações de risco
console.log('\n⚠️  CONFIGURAÇÕES DE RISCO:\n');

const minOrderSize = parseFloat(process.env.MIN_ORDER_SIZE || '0.000005');
const maxPosition = parseFloat(process.env.MAX_POSITION || '0.0003');
const stopLossDefault = parseFloat(process.env.STOP_LOSS_PCT || '0.008');

if (minOrderSize >= 0.00001) {
    checkPass(`MIN_ORDER_SIZE=${minOrderSize} (proteção de micro-ordens)`);
} else {
    checkWarn(`MIN_ORDER_SIZE=${minOrderSize} (muito pequeno)`);
}

if (maxPosition <= 0.001) {
    checkPass(`MAX_POSITION=${maxPosition} (limite de posição)`);
} else {
    checkWarn(`MAX_POSITION=${maxPosition} (posição grande)`);
}

if (stopLossDefault <= 0.01) {
    checkPass(`STOP_LOSS=${(stopLossDefault * 100).toFixed(2)}% (proteção)`);
} else {
    checkWarn(`STOP_LOSS=${(stopLossDefault * 100).toFixed(2)}% (risco alto)`);
}

// 5. Verificar banco de dados
console.log('\n📊 VERIFICANDO BANCO DE DADOS:\n');

const dbPath = './database/orders.db';
if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    checkPass(`Banco de dados encontrado (${(stats.size / 1024).toFixed(1)} KB)`);
} else {
    checkWarn('Banco de dados não encontrado (será criado na primeira execução)');
}

// 6. Parâmetros da estratégia
console.log('\n🎯 PARÂMETROS DA ESTRATÉGIA:\n');

console.log('   Drop Threshold: 0.3% (compra em quedas)');
console.log('   Profit Target: 0.4% (venda com lucro)');
console.log('   Stop Loss: -0.8% (proteção)');
console.log('   Capital Inicial: 200 BRL (simulação) / Saldo atual (live)');

// RESUMO
console.log('\n' + '='.repeat(80));
console.log('📊 RESUMO:');
console.log('='.repeat(80));
console.log(`✅ Passou: ${checks.passed}`);
console.log(`❌ Falhou: ${checks.failed}`);
console.log(`⚠️  Avisos: ${checks.warnings}`);
console.log('');

if (checks.failed > 0) {
    console.log('❌ NÃO PODE RODAR EM PRODUÇÃO!');
    console.log('   Corrija os erros acima e tente novamente.\n');
    process.exit(1);
}

console.log('✅ PRÉ-VALIDAÇÃO OK!');
console.log('\n⚠️  AVISOS CRÍTICOS:');
console.log('   1. Isso usará CAPITAL REAL');
console.log('   2. Verifique saldo na Mercado Bitcoin');
console.log('   3. Esteja pronto para parar (Ctrl+C)');
console.log('   4. Monitore os logs continuamente');
console.log('   5. Começe com valor PEQUENO (50 BRL)\n');

if (checks.warnings > 0) {
    console.log(`📝 ${checks.warnings} aviso(s) - revise acima\n`);
}

console.log('✅ Pronto para executar em modo LIVE\n');
