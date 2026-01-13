#!/usr/bin/env node
/**
 * exemplos_conviccao.js - Exemplos práticos de uso do Sistema de Convicção
 * Demonstra casos reais de aplicação com mercado simulado
 */

const chalk = require('chalk');
const ConfidenceSystem = require('./confidence_system');

console.log(chalk.bold.cyan('\n📚 EXEMPLOS PRÁTICOS: Sistema de Convicção\n'));

const system = new ConfidenceSystem();

// ============= EXEMPLO 1: Confirmação de Tendência Ascending =============
console.log(chalk.bold.green('📈 EXEMPLO 1: Confirmação de Tendência Ascendente'));
console.log(chalk.gray('Mercado em recuperação após queda. Todos os indicadores confirmam.\n'));

system.reset();
system.priceHistory = [654500, 654700, 654900, 655100, 655300];

const bullishConfirmed = {
    rsi: 65,
    emaShort: 655200,
    emaLong: 654800,
    macd: 950,
    signal: 750,
    price: 655300,
    volatility: 0.6 / 100,
    trend: 'up'
};

const conv1 = system.calculateConviction(bullishConfirmed);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv1.overallConfidence * 100).toFixed(1)}% (${conv1.strength})`);
console.log(`  Ação: COMPRAR com tamanho FULL (${conv1.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: BAIXO`);
console.log(`  Spread recomendado: Normal (${(0.0006 * 100).toFixed(3)}%)`);
console.log('');

// ============= EXEMPLO 2: Recuperação de Sobrevenda =============
console.log(chalk.bold.red('📉 EXEMPLO 2: Recuperação de Sobrevenda'));
console.log(chalk.gray('RSI muito baixo (<30) mas EMA ainda em tendência de baixa.\n'));

system.reset();
system.priceHistory = [655500, 655300, 655100, 654900, 654700];

const oversold = {
    rsi: 28,
    emaShort: 654800,
    emaLong: 655200,
    macd: -500,
    signal: -300,
    price: 654700,
    volatility: 1.0 / 100,
    trend: 'down'
};

const conv2 = system.calculateConviction(oversold);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv2.overallConfidence * 100).toFixed(1)}% (${conv2.strength})`);
console.log(`  Ação: MANTER CAUTELA - possível reversão`);
console.log(`  Tamanho: REDUZIDO (${conv2.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: MODERADO (divergência RSI vs MACD)`);
console.log(`  Spread recomendado: Expandido 20%`);
console.log('');

// ============= EXEMPLO 3: Mercado Lateral Sem Direção =============
console.log(chalk.bold.yellow('➡️ EXEMPLO 3: Mercado Lateral (Ranging)'));
console.log(chalk.gray('Preço oscila, indicadores neutros. Operações devem ser conservadoras.\n'));

system.reset();
system.priceHistory = [655000, 655020, 654980, 655010, 654990];

const ranging = {
    rsi: 50,
    emaShort: 654998,
    emaLong: 655005,
    macd: 15,
    signal: 10,
    price: 655000,
    volatility: 0.2 / 100,
    trend: 'neutral'
};

const conv3 = system.calculateConviction(ranging);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv3.overallConfidence * 100).toFixed(1)}% (${conv3.strength})`);
console.log(`  Ação: SCALPING ou ESPERA`);
console.log(`  Tamanho: PEQUENO (${conv3.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: BAIXO (mas pouco lucro)`);
console.log(`  Estratégia: Grid de compra/venda nos extremos do range`);
console.log('');

// ============= EXEMPLO 4: Sobrecompra - Risco de Reversão =============
console.log(chalk.bold.magenta('⚡ EXEMPLO 4: Sobrecompra - Reversão Eminente'));
console.log(chalk.gray('RSI > 70 (sobrecomprado) enquanto preço sobe. Típico de top.\n'));

system.reset();
system.priceHistory = [654000, 654500, 655000, 655500, 656000];

const overbought = {
    rsi: 78,
    emaShort: 655900,
    emaLong: 655200,
    macd: 1100,
    signal: 950,
    price: 656000,
    volatility: 1.5 / 100,
    trend: 'up'
};

const conv4 = system.calculateConviction(overbought);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv4.overallConfidence * 100).toFixed(1)}% (${conv4.strength})`);
console.log(`  ⚠️  ALERTA: RSI SOBRECOMPRADO - risco de reversão`);
console.log(`  Ação: VENDER ou REDUZIR posição`);
console.log(`  Tamanho: MÍNIMO (${conv4.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: CRÍTICO - próxima vela pode virar`);
console.log(`  Stop-loss: ACIMA DO PREÇO (proteção de lucro)`);
console.log('');

// ============= EXEMPLO 5: Mudança de Regime - Bull para Bear =============
console.log(chalk.bold.red('🔄 EXEMPLO 5: Mudança de Regime (Bull → Bear)'));
console.log(chalk.gray('EMA cruzou para baixo. Indicadores ainda mistos. Transitório.\n'));

system.reset();
system.priceHistory = [655200, 655100, 655000, 654900, 654800];

const regimeChange = {
    rsi: 55,
    emaShort: 654950,
    emaLong: 655050,
    macd: -100,
    signal: 50,
    price: 654900,
    volatility: 0.8 / 100,
    trend: 'down'
};

const conv5 = system.calculateConviction(regimeChange);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv5.overallConfidence * 100).toFixed(1)}% (${conv5.strength})`);
console.log(`  ⚠️  ALERTA: Mudança de regime detectada`);
console.log(`  Ação: ESPERAR por confirmação ou reduzir`);
console.log(`  Tamanho: REDUZIDO (${conv5.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: MODERADO-ALTO (transição)`);
console.log(`  Estratégia: Esperar 3-5 velas de confirmação`);
console.log('');

// ============= EXEMPLO 6: Volatilidade Explosiva =============
console.log(chalk.bold.magenta('💥 EXEMPLO 6: Volatilidade Explosiva'));
console.log(chalk.gray('Mercado com grande variação. Sinais podem ser falsos.\n'));

system.reset();
system.priceHistory = [655000, 656500, 653500, 657000, 654000];

const explosive = {
    rsi: 62,
    emaShort: 655000,
    emaLong: 654500,
    macd: 600,
    signal: 400,
    price: 655000,
    volatility: 2.8 / 100,
    trend: 'up'
};

const conv6 = system.calculateConviction(explosive);
console.log(chalk.bold('Recomendação:'));
console.log(`  Convicção: ${(conv6.overallConfidence * 100).toFixed(1)}% (${conv6.strength})`);
console.log(`  🚨 ALERTA: Volatilidade EXTREMA`);
console.log(`  Ação: EVITAR operações ou posições MÍNIMAS`);
console.log(`  Tamanho: CRÍTICO (${conv6.details.recommendedPositionSize * 100}%)`);
console.log(`  Risco: MUITO ALTO`);
console.log(`  Motivo: Indicadores podem ser enganosos em spike volatilidade`);
console.log('');

// ============= TABELA COMPARATIVA =============
console.log(chalk.bold.cyan('\n📊 TABELA COMPARATIVA DE CENÁRIOS\n'));

const exemplos = [
    { nome: 'Bull Confirmado', conv: conv1, acao: 'COMPRAR FULL', cor: 'green' },
    { nome: 'Oversold', conv: conv2, acao: 'CAUTELA', cor: 'yellow' },
    { nome: 'Range', conv: conv3, acao: 'SCALP', cor: 'cyan' },
    { nome: 'Overbought', conv: conv4, acao: 'VENDER/REDUZIR', cor: 'red' },
    { nome: 'Regime Change', conv: conv5, acao: 'ESPERAR', cor: 'yellow' },
    { nome: 'Volatilidade Extrema', conv: conv6, acao: 'EVITAR', cor: 'red' }
];

console.log(chalk.cyan('Cenário'.padEnd(20)) + 
            chalk.cyan('Convicção'.padEnd(15)) + 
            chalk.cyan('Força'.padEnd(15)) + 
            chalk.cyan('Tamanho'.padEnd(10)) + 
            chalk.cyan('Ação'.padEnd(20)));

console.log(chalk.gray('─'.repeat(80)));

exemplos.forEach(ex => {
    const confAdjusted = (ex.conv.overallConfidence * 100).toFixed(1) + '%';
    const size = (ex.conv.details.recommendedPositionSize * 100).toFixed(0) + '%';
    
    const colorFunc = chalk[ex.cor];
    console.log(
        colorFunc(ex.nome.padEnd(20)) +
        colorFunc(confAdjusted.padEnd(15)) +
        colorFunc(ex.conv.strength.padEnd(15)) +
        colorFunc(size.padEnd(10)) +
        colorFunc(ex.acao.padEnd(20))
    );
});

// ============= REGRAS DE OURO =============
console.log(chalk.bold.cyan('\n\n⚡ REGRAS DE OURO DO SISTEMA DE CONVICÇÃO\n'));

const regras = [
    { 
        num: 1, 
        titulo: 'Convicção > 70%', 
        acao: 'Operar com tamanho COMPLETO',
        exemplo: 'Bull Confirmado',
        risk: 'BAIXO'
    },
    { 
        num: 2, 
        titulo: 'Convicção 50-70%', 
        acao: 'Operar com CUIDADO, tamanho 25-50%',
        exemplo: 'Oversold, Regime Change',
        risk: 'MODERADO'
    },
    { 
        num: 3, 
        titulo: 'Convicção < 50%', 
        acao: 'REDUZIR muito ou ESPERAR',
        exemplo: 'Range, Overbought',
        risk: 'ALTO'
    },
    { 
        num: 4, 
        titulo: 'Volatilidade EXTREME (>3%)', 
        acao: 'EVITAR operações',
        exemplo: 'Volatilidade Explosiva',
        risk: 'CRÍTICO'
    },
    { 
        num: 5, 
        titulo: 'RSI DIVERGÊNCIA', 
        acao: 'ALERTA de reversão',
        exemplo: 'Sobrecompra',
        risk: 'MUITO ALTO'
    }
];

regras.forEach(regra => {
    console.log(chalk.yellow(`${regra.num}. ${regra.titulo}`));
    console.log(`   Ação: ${regra.acao}`);
    console.log(`   Exemplo: ${regra.exemplo}`);
    console.log(`   Risco: ${regra.risk}`);
    console.log('');
});

// ============= DICAS PRÁTICAS =============
console.log(chalk.bold.cyan('💡 DICAS PRÁTICAS\n'));

const dicas = [
    'Sempre respeite o tamanho recomendado da convicção',
    'Em modo conservador (convicção < 50%), use spread 20% maior',
    'Divergências (RSI alto + MACD baixo) = prepare para reversão',
    'Mercados com volatilidade extrema frequentemente geram sinais falsos',
    'O sistema aprende: quanto mais dados, melhor a precisão',
    'Use o analisador para verificar histórico: accuracy por nível de confiança',
    'Em períodos de lucro, aumente posição com convicção > 70%',
    'Em períodos de loss, reduza posição até convicção > 60%'
];

dicas.forEach((dica, idx) => {
    console.log(chalk.green(`${idx + 1}. ${dica}`));
});

console.log(chalk.bold.cyan('\n✅ Exemplos Completados!\n'));
console.log(chalk.gray('Para mais detalhes, veja: GUIA_CONVICCAO.md'));
