const SPREAD_PCT = 0.0006;
const trendScore = 0.5;
const volatility = 2.5;

console.log('=== TEST NEW FORMULA ===');
console.log('Inputs:');
console.log('  SPREAD_PCT:', SPREAD_PCT);
console.log('  trendScore:', trendScore);
console.log('  volatility:', volatility);
console.log('');

const spreadBase = SPREAD_PCT * 1000;
const volMultiplier = 1 + (volatility / 10);
const trendBonus = trendScore > 1.5 ? 1.5 : (trendScore > 0.5 ? 1.0 : 0.5);
const expectedProfit = spreadBase * volMultiplier * trendBonus;
const normalizedExpectedProfit = Math.min(Math.max(expectedProfit / 1000, 0), 1);

console.log('Calculation:');
console.log('  spreadBase:', spreadBase, '(SPREAD_PCT * 1000)');
console.log('  volMultiplier:', volMultiplier, '(1 + volatility/10)');
console.log('  trendBonus:', trendBonus, '(based on trendScore)');
console.log('  expectedProfit (raw):', expectedProfit);
console.log('  normalizedExpectedProfit:', normalizedExpectedProfit);
console.log('');
console.log('Threshold:', 0.005);
console.log('Pass?', normalizedExpectedProfit >= 0.005);
