#!/usr/bin/env node
/**
 * test_confidence_system.js - Teste do novo Sistema de Convicção
 * Demonstra como o sistema de convicção funciona com diferentes cenários
 */

const chalk = require('chalk');
const ConfidenceSystem = require('./confidence_system');

console.log(chalk.bold.cyan('\n🧪 TESTE COMPLETO: Sistema de Convicção Aprimorado\n'));

const system = new ConfidenceSystem();

// ============= CENÁRIO 1: Tendência BULLISH Forte =============
console.log(chalk.bold.yellow('📈 CENÁRIO 1: Tendência BULLISH Forte'));
console.log(chalk.gray('Todos os indicadores apontam para alta com forte confiança\n'));

system.reset();
system.priceHistory = [654800, 654900, 655000, 655100, 655200];

const bullishIndicators = {
    rsi: 72,
    emaShort: 655300,
    emaLong: 654500,
    macd: 1200,
    signal: 900,
    price: 655250,
    volatility: 0.8 / 100,
    trend: 'up'
};

const bullishConviction = system.calculateConviction(bullishIndicators);
console.log(system.generateReport(bullishConviction));

// ============= CENÁRIO 2: Tendência BEARISH Forte =============
console.log(chalk.bold.red('📉 CENÁRIO 2: Tendência BEARISH Forte'));
console.log(chalk.gray('Todos os indicadores apontam para baixa com forte confiança\n'));

system.reset();
system.priceHistory = [655200, 655100, 655000, 654900, 654800];

const bearishIndicators = {
    rsi: 28,
    emaShort: 654500,
    emaLong: 655300,
    macd: -1200,
    signal: -900,
    price: 654550,
    volatility: 1.0 / 100,
    trend: 'down'
};

const bearishConviction = system.calculateConviction(bearishIndicators);
console.log(system.generateReport(bearishConviction));

// ============= CENÁRIO 3: Mercado Neutro/Indeciso =============
console.log(chalk.bold.cyan('➡️ CENÁRIO 3: Mercado Neutro/Indeciso'));
console.log(chalk.gray('Indicadores divergem - baixa convicção e confiabilidade\n'));

system.reset();
system.priceHistory = [655000, 655010, 655005, 655015, 655010];

const neutralIndicators = {
    rsi: 50,
    emaShort: 655000,
    emaLong: 654980,
    macd: 10,
    signal: 5,
    price: 655000,
    volatility: 0.3 / 100,
    trend: 'neutral'
};

const neutralConviction = system.calculateConviction(neutralIndicators);
console.log(system.generateReport(neutralConviction));

// ============= CENÁRIO 4: Volatilidade Extrema =============
console.log(chalk.bold.magenta('⚠️ CENÁRIO 4: Volatilidade Extrema'));
console.log(chalk.gray('Mercado muito volátil - operações de alto risco\n'));

system.reset();
system.priceHistory = [654000, 656000, 653000, 657000, 654000];

const extremeVolIndicators = {
    rsi: 65,
    emaShort: 655000,
    emaLong: 655100,
    macd: 500,
    signal: 400,
    price: 655000,
    volatility: 3.5 / 100,
    trend: 'up'
};

const extremeConviction = system.calculateConviction(extremeVolIndicators);
console.log(system.generateReport(extremeConviction));

// ============= CENÁRIO 5: Divergência de Indicadores =============
console.log(chalk.bold.cyan('⚡ CENÁRIO 5: Divergência entre Indicadores'));
console.log(chalk.gray('RSI bullish mas MACD bearish - sinal fraco/ambíguo\n'));

system.reset();
system.priceHistory = [654900, 654800, 654700, 654600, 654500];

const divergenceIndicators = {
    rsi: 68, // RSI bullish
    emaShort: 654800,
    emaLong: 654700,
    macd: -300, // MACD bearish - DIVERGÊNCIA
    signal: -200,
    price: 654700,
    volatility: 0.6 / 100,
    trend: 'down'
};

const divergenceConviction = system.calculateConviction(divergenceIndicators);
console.log(system.generateReport(divergenceConviction));

// ============= COMPARATIVO: Tamanho de Posição Recomendado =============
console.log(chalk.bold.green('\n📊 COMPARATIVO: Tamanho de Posição Recomendado\n'));

const convictions = [
    { name: 'Bullish Forte', conviction: bullishConviction },
    { name: 'Bearish Forte', conviction: bearishConviction },
    { name: 'Neutro', conviction: neutralConviction },
    { name: 'Volatilidade Extrema', conviction: extremeConviction },
    { name: 'Divergência', conviction: divergenceConviction }
];

console.log(chalk.cyan('Convicção'.padEnd(25)) + 
            chalk.cyan('Confiança%'.padEnd(15)) +
            chalk.cyan('Força'.padEnd(15)) +
            chalk.cyan('Tamanho Pos.'.padEnd(15)));
console.log(chalk.gray('─'.repeat(70)));

convictions.forEach(item => {
    const confAdjusted = item.conviction.overallConfidence * 100;
    const color = item.conviction.overallConfidence > 0.7 ? chalk.green :
                 item.conviction.overallConfidence > 0.5 ? chalk.yellow : chalk.red;
    
    console.log(
        color(item.name.padEnd(25)) +
        color((confAdjusted.toFixed(1) + '%').padEnd(15)) +
        color(item.conviction.strength.padEnd(15)) +
        color((item.conviction.details.recommendedPositionSize * 100).toFixed(0) + '%'.padEnd(15))
    );
});

// ============= ESTATÍSTICAS =============
console.log(chalk.bold.green('\n📈 ANÁLISE DE CONSISTÊNCIA\n'));

console.log(chalk.cyan('Cenário | Indicadores Concordam | Consenso | Implicação'));
console.log(chalk.gray('─'.repeat(65)));

convictions.forEach(item => {
    const consensus = item.conviction.components.consistency;
    const consensusScore = (consensus.confidence * 100).toFixed(0);
    const implication = consensus.confidence > 0.8 ? '✅ Muito Confiável' :
                       consensus.confidence > 0.6 ? '⚠️ Moderadamente Confiável' :
                       '❌ Baixa Confiabilidade';
    
    console.log(
        item.name.padEnd(20) + '|' +
        item.conviction.details.numIndicatorsAgreed + '/' + item.conviction.details.totalIndicators + 
        ' ' + '|' +
        consensusScore.padStart(7) + '%' + ' |' +
        ' ' + implication
    );
});

console.log(chalk.bold.green('\n✅ Teste Completado!\n'));
console.log(chalk.gray('O novo sistema de convicção está operacional e pronto para uso.\n'));
