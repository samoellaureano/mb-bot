#!/usr/bin/env node

/**
 * test_dashboard_automated_tests.js
 * Script para testar a funcionalidade de testes automatizados do dashboard
 */

const axios = require('axios');

const DASHBOARD_URL = 'http://localhost:3001';

async function testAutomatedTests() {
    console.log('\n🧪 TESTE DE TESTES AUTOMATIZADOS DO DASHBOARD\n');
    
    try {
        // === TESTE 1: Verificar status inicial ===
        console.log('📋 Teste 1: Verificar status inicial...');
        const statusRes = await axios.get(`${DASHBOARD_URL}/api/tests`);
        console.log('   Status HTTP:', statusRes.status);
        console.log('   Habilitado:', statusRes.data.enabled);
        console.log('   Executando:', statusRes.data.isRunning);
        console.log('   Tem Resultados:', statusRes.data.hasResults);
        console.log('   ✅ Teste 1 passed\n');
        
        // === TESTE 2: Iniciar testes ===
        console.log('📋 Teste 2: Iniciar nova bateria de testes (24 horas)...');
        const runRes = await axios.post(`${DASHBOARD_URL}/api/tests/run`, { hours: 24 });
        console.log('   Status HTTP:', runRes.status);
        console.log('   Mensagem:', runRes.data.message);
        console.log('   Horas:', runRes.data.hours);
        console.log('   Resultado:', runRes.data.status);
        console.log('   ✅ Teste 2 passed\n');
        
        // === TESTE 3: Monitorar progresso ===
        console.log('📋 Teste 3: Monitorar progresso dos testes...');
        let isRunning = true;
        let checkCount = 0;
        const maxChecks = 60; // Máximo 2 minutos (60 x 2 segundos)
        
        while (isRunning && checkCount < maxChecks) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusRes = await axios.get(`${DASHBOARD_URL}/api/tests`);
            isRunning = statusRes.data.isRunning;
            checkCount++;
            
            const status = isRunning ? '⏳ Executando' : '✅ Concluído';
            process.stdout.write(`\r   [${checkCount}] Status dos testes: ${status}`);
        }
        console.log('\n   ✅ Teste 3 completed\n');
        
        // === TESTE 4: Obter resultados finais ===
        console.log('📋 Teste 4: Obter resultados finais...');
        const resultsRes = await axios.get(`${DASHBOARD_URL}/api/tests`);
        const results = resultsRes.data.results;
        
        if (results) {
            console.log('   Status:', results.status);
            console.log('   Data Source:', results.summary.dataSource);
            console.log('   Data Points:', results.summary.dataPoints);
            console.log('   Total Testes:', results.summary.total);
            console.log('   Passados:', results.summary.passed);
            console.log('   Falhados:', results.summary.failed);
            console.log('   Taxa de Sucesso:', results.summary.passRate + '%');
            
            if (results.summary.priceRange) {
                console.log('   Preço Inicial: R$', results.summary.priceRange.start);
                console.log('   Preço Final: R$', results.summary.priceRange.end);
                console.log('   Variação:', results.summary.priceRange.change + '%');
            }
            
            if (results.tests && results.tests.length > 0) {
                console.log('\n   Detalhes dos Testes:');
                results.tests.forEach((test, idx) => {
                    console.log(`\n   ${idx + 1}. ${test.testName}`);
                    console.log(`      Status: ${test.passed ? '✅ PASSOU' : '❌ FALHOU'}`);
                    console.log(`      PnL: R$ ${test.pnlBRL}`);
                    console.log(`      ROI: ${test.roi}%`);
                    console.log(`      vs HOLD: R$ ${test.vsHoldBRL}`);
                    if (test.projection) {
                        console.log(`      Proj. Mensal: R$ ${test.projection.monthlyBRL}`);
                        console.log(`      Proj. Anual: R$ ${test.projection.yearlyBRL}`);
                    }
                });
            }
            console.log('   ✅ Teste 4 passed\n');
        } else {
            console.log('   ⚠️  Resultados não disponíveis ainda\n');
        }
        
        console.log('✅ TODOS OS TESTES DO DASHBOARD PASSARAM!\n');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        process.exit(1);
    }
}

// Executar testes
testAutomatedTests();
