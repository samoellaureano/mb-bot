const axios = require('axios');
(async () => {
  try {
    const base = 'http://localhost:3001';
    console.log('GET /api/recovery');
    let r = await axios.get(`${base}/api/recovery`, {timeout:5000});
    const before = r.data;
    console.log('Active before:', before.activeSession ? `${before.activeSession.id} baseline=${before.activeSession.baseline}` : 'null');

    // compute current pnl from /api/data (stats.totalPnL)
    console.log('GET /api/data to obtain current PnL');
    const dataR = await axios.get(`${base}/api/data`, {timeout:5000});
    const current = dataR.data && dataR.data.stats ? parseFloat(dataR.data.stats.totalPnL) : null;
    console.log('Computed current pnl from /api/data:', current);

    console.log('POST /api/recovery/reset');
    const resetR = await axios.post(`${base}/api/recovery/reset`, {} , {timeout:5000});
    console.log('Reset response:', resetR.data);

    r = await axios.get(`${base}/api/recovery`, {timeout:5000});
    const after = r.data;
    console.log('Active after:', after.activeSession ? `${after.activeSession.id} baseline=${after.activeSession.baseline}` : 'null');

    if (!after.activeSession) {
      console.error('FAIL: No active session after reset');
      process.exit(2);
    }

    const afterBaseline = parseFloat(after.activeSession.baseline);
    if (current !== null) {
      if (Math.abs(afterBaseline - current) < 0.001) {
        console.log('PASS: Baseline updated to current PnL from /api/data');
        process.exit(0);
      } else {
        console.error(`FAIL: Baseline ${afterBaseline} != current ${current}`);
        process.exit(3);
      }
    } else {
      console.log('No current PnL available from /api/data; ensured session still active. PASS');
      process.exit(0);
    }
  } catch (err) {
    console.error('ERROR', err.message);
    process.exit(1);
  }
})();