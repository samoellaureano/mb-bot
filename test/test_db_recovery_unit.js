const DB = require('../db');
(async () => {
  try {
    await DB.init();
    // Criar sessão ativa de teste
    const baseline = -191.05;
    const initialPnL = -191.05;
    const sessionId = await DB.startRecoverySession(baseline, initialPnL);
    console.log('Started test session:', sessionId);

    // Inserir alguns pontos com piores PnLs
    await DB.appendRecoveryPoint(sessionId, -195.00, 10, baseline);
    await DB.appendRecoveryPoint(sessionId, -196.31, 15, baseline);
    await DB.appendRecoveryPoint(sessionId, -194.00, 5, baseline);

    const worst = await DB.getWorstPnLInSession(sessionId);
    console.log('Worst PnL from points:', worst);

    // Aplicar atualização de baseline para pior valor
    await DB.updateRecoveryBaseline(sessionId, worst);

    const active = await DB.getActiveRecoverySession();
    console.log('Active session baseline now:', active.baseline);

    if (Math.abs(parseFloat(active.baseline) - worst) < 0.0001) {
      console.log('PASS: baseline atualizado corretamente no DB');
      process.exit(0);
    } else {
      console.error('FAIL: baseline não corresponde ao pior PnL');
      process.exit(2);
    }
  } catch (err) {
    console.error('ERROR', err.message);
    process.exit(1);
  }
})();