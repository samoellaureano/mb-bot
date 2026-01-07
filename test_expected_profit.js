// Test script para debug do cálculo de expectedProfit

const SPREAD_PCT = 0.0006;
const MAX_VOLATILITY_PCT = 2.5;

// Valores do ciclo 2
const rsi = 32.22;
const emaShort = 507614.48;
const emaLong = 507950.14;
const macd = -532.14;
const signal = 507606.89;
const volatility = 2.50;
const histAnalysis = {successRate: 0.5714, avgWeightedPnL: 5.85};

// Cálculo de trendScore
let trendScore = 0;
if (emaShort > emaLong) trendScore += 1;
if (rsi > 50) trendScore += 1;
if (macd > signal) trendScore += 1;
if (histAnalysis.successRate > 0.5) trendScore += 0.5;

console.log('=== DEBUG EXPECTED PROFIT ===');
console.log('Inputs:');
console.log('  RSI:', rsi);
console.log('  EMA Short:', emaShort);
console.log('  EMA Long:', emaLong);
console.log('  MACD:', macd);
console.log('  Signal:', signal);
console.log('  Volatility:', volatility);
console.log('  Hist Success Rate:', histAnalysis.successRate);
console.log('');

console.log('Trend Score Calculation:');
console.log('  emaShort > emaLong?', emaShort > emaLong, '-> +1 if true');
console.log('  rsi > 50?', rsi > 50, '-> +1 if true');
console.log('  macd > signal?', macd > signal, '-> +1 if true');
console.log('  histAnalysis.successRate > 0.5?', histAnalysis.successRate > 0.5, '-> +0.5 if true');
console.log('  Total trendScore:', trendScore);
console.log('  Trend:', trendScore > 2 ? 'up' : (trendScore < 1.5 ? 'down' : 'neutral'));
console.log('');

// Cálculo de confidence
let rsiConf = Math.abs(rsi - 50) / 50;
let emaConf = Math.abs(emaShort - emaLong) / (emaLong || 1);
let macdConf = Math.abs(macd - signal) / Math.max(Math.abs(macd), 1);
let volConf = Math.min(volatility / MAX_VOLATILITY_PCT, 1);
let histConf = histAnalysis.successRate;
let confidence = 0.3 * rsiConf + 0.25 * emaConf + 0.2 * macdConf + 0.15 * volConf + 0.1 * histConf;

console.log('Confidence Components:');
console.log('  rsiConf:', rsiConf.toFixed(4), '(weight: 0.3) =', (0.3 * rsiConf).toFixed(4));
console.log('  emaConf:', emaConf.toFixed(4), '(weight: 0.25) =', (0.25 * emaConf).toFixed(4));
console.log('  macdConf:', macdConf.toFixed(4), '(weight: 0.2) =', (0.2 * macdConf).toFixed(4));
console.log('  volConf:', volConf.toFixed(4), '(weight: 0.15) =', (0.15 * volConf).toFixed(4));
console.log('  histConf:', histConf.toFixed(4), '(weight: 0.1) =', (0.1 * histConf).toFixed(4));
console.log('  Total confidence:', confidence.toFixed(4));
console.log('');

// Cálculo de expectedProfit (fórmula atual)
const spreadBase = SPREAD_PCT * 100;
const volFactor = 1 + (volatility / 100);
const trendFactor = trendScore / 3;
const confFactor = Math.min(confidence, 1);
const expectedProfit = spreadBase * volFactor * trendFactor * confFactor;
const normalizedExpectedProfit = Math.min(Math.max(expectedProfit / 100, 0), 1);

console.log('Expected Profit Calculation:');
console.log('  spreadBase:', spreadBase, '(SPREAD_PCT * 100)');
console.log('  volFactor:', volFactor.toFixed(4), '(1 + volatility/100)');
console.log('  trendFactor:', trendFactor.toFixed(4), '(trendScore / 3)');
console.log('  confFactor:', confFactor.toFixed(4), '(min(confidence, 1))');
console.log('  expectedProfit (raw):', expectedProfit.toFixed(6));
console.log('  normalizedExpectedProfit:', normalizedExpectedProfit.toFixed(6));
console.log('');

console.log('Threshold Comparison:');
console.log('  EXPECTED_PROFIT_THRESHOLD:', 0.005);
console.log('  normalizedExpectedProfit >= threshold?', normalizedExpectedProfit >= 0.005);
console.log('');

// Teste com ajustes
console.log('=== PROPOSED FIX ===');
console.log('Problem: confidence is too high (', confidence.toFixed(2), '), causing confFactor to always be 1.0');
console.log('Solution: Remove confFactor from formula, or normalize confidence properly');
console.log('');

// Fórmula alternativa 1: sem confidence
const expectedProfit_v2 = spreadBase * volFactor * trendFactor;
const normalizedExpectedProfit_v2 = Math.min(Math.max(expectedProfit_v2 / 100, 0), 1);
console.log('Alternative 1 (without confidence):');
console.log('  expectedProfit:', expectedProfit_v2.toFixed(6));
console.log('  normalized:', normalizedExpectedProfit_v2.toFixed(6));
console.log('  >= threshold?', normalizedExpectedProfit_v2 >= 0.005);
console.log('');

// Fórmula alternativa 2: simplificada
const expectedProfit_v3 = spreadBase * (1 + volatility/10) * (trendScore > 0 ? 1 : 0.5);
const normalizedExpectedProfit_v3 = Math.min(Math.max(expectedProfit_v3 / 100, 0), 1);
console.log('Alternative 2 (simplified):');
console.log('  expectedProfit:', expectedProfit_v3.toFixed(6));
console.log('  normalized:', normalizedExpectedProfit_v3.toFixed(6));
console.log('  >= threshold?', normalizedExpectedProfit_v3 >= 0.005);
