const SPREAD_PCT = 0.0006;
const trendScore = 0.5;
const volatility = 2.5;

const spreadBase = SPREAD_PCT * 10000;
const volMultiplier = 1 + (volatility / 5);
const trendBonus = trendScore > 1.5 ? 2.0 : (trendScore > 0.5 ? 1.5 : 1.0);
const expectedProfit = spreadBase * volMultiplier * trendBonus;
const normalizedExpectedProfit = Math.min(Math.max(expectedProfit / 10000, 0), 1);

console.log('spreadBase:', spreadBase);
console.log('volMultiplier:', volMultiplier);
console.log('trendBonus:', trendBonus);
console.log('expectedProfit (raw):', expectedProfit);
console.log('normalizedExpectedProfit:', normalizedExpectedProfit);
console.log('Threshold: 0.005');
console.log('Pass?', normalizedExpectedProfit >= 0.005);
