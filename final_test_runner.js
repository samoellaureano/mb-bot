const runner = require('./automated_test_runner.js');

console.log('\n📊 TESTE FINAL COM DADOS REAIS\n');

runner.runTestBattery(24).then(results => {
  console.log('\n✅ TESTE COMPLETO!\n');
  console.log('═════════════════════════════════════════════════════════');
  console.log('RESUMO EXECUTIVO:');
  console.log('═════════════════════════════════════════════════════════\n');
  
  console.log(`📊 Resultados: ${results.summary.total} testes | ${results.summary.passed} sucesso | ${results.summary.passRate}% taxa\n`);
  
  console.log('🏆 Melhor Performance vs HOLD:');
  
  let best = null;
  results.tests.forEach(t => {
    if (t.vsHoldBRL !== undefined) {
      const vsHold = parseFloat(t.vsHoldBRL);
      if (!best || vsHold > parseFloat(best.vsHoldBRL)) {
        best = t;
      }
    }
  });
  
  if (best) {
    const vsHold = parseFloat(best.vsHoldBRL);
    console.log(`   ${best.testName}`);
    console.log(`   Ganho vs HOLD: R$ ${vsHold.toFixed(2)} ${vsHold > 0 ? '✅' : ''}`);
    console.log(`   PnL: R$ ${best.pnlBRL}`);
    console.log(`   ROI: ${best.roi}%\n`);
  }
  
  console.log('═════════════════════════════════════════════════════════');
  console.log('✨ TESTE FINAL COMPLETO COM SUCESSO!\n');
  
}).catch(e => {
  console.error('❌ Erro:', e.message);
});
