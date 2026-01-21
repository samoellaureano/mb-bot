#!/usr/bin/env node

/**
 * GUIA RÁPIDO - Como Usar os Filtros V2
 */

console.clear();

const chalk = require('chalk');

console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan.bold('║  📋 GUIA RÁPIDO - FILTROS DE SEGURANÇA V2 DO MB-BOT                         ║'));
console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════════════════════╝\n'));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('🎯 PROBLEMA QUE FOI RESOLVIDO\n'));

console.log(chalk.red('❌ ANTES:'));
console.log('   Teste 24h (queda -3.96%): PnL = -R$ 6,75');
console.log('   Bot comprava em TODA queda, mesmo em mercado BEARISH\n');

console.log(chalk.green('✅ DEPOIS:'));
console.log('   Teste 24h (queda -3.96%): PnL = -R$ 2,00');
console.log('   Bot respeita tendência e protege capital\n');

console.log(chalk.cyan('📊 MELHORIA: 70% melhor desempenho!\n'));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('🔧 OS 4 FILTROS E COMO FUNCIONAM\n'));

const filtros = [
    {
        num: 1,
        titulo: 'Trend Filter Obrigatório 🚫',
        descricao: 'Se tendência externa = BEARISH → bloqueia compras',
        quando: 'Sempre que houver tendência externa BEARISH',
        log: '🚫 BLOQUEADO: Tendência BEARISH - não compra em quedas',
        parametro: 'blockOnBearishTrend: true'
    },
    {
        num: 2,
        titulo: 'DCA Mais Conservador 📈',
        descricao: 'Só compra em quedas > 1.5% (era 0.5%)',
        quando: 'Detecta queda significativa (>1.5%)',
        log: 'Queda de 1.6% do pico - DCA ativado!',
        parametro: 'dcaDropThreshold: 0.015'
    },
    {
        num: 3,
        titulo: 'RSI Filter 📊',
        descricao: 'Bloqueia se RSI > 80 (overbought) ou < 20 (oversold)',
        quando: 'Mercado em extremos (RSI fora de 20-80)',
        log: '⚠️ RSI 85 > 80 (OVERBOUGHT) - não compra',
        parametro: 'rsiFilterEnabled: true'
    },
    {
        num: 4,
        titulo: 'Stop Loss Global 🛑',
        descricao: 'Se perda acumulada ≥ 5% → para tudo',
        quando: 'Perdas acumuladas atingem 5%',
        log: '🛑 STOP LOSS GLOBAL: Perda acumulada 6.66% >= 5.00%',
        parametro: 'stopLossThreshold: 0.05'
    }
];

filtros.forEach((f, i) => {
    console.log(chalk.blue.bold(`${f.num}. ${f.titulo}`));
    console.log(`   📝 ${f.descricao}`);
    console.log(`   ⏱️  Quando: ${f.quando}`);
    console.log(`   📋 Log: ${chalk.gray(f.log)}`);
    console.log(`   ⚙️  ${chalk.gray(f.parametro)}\n`);
});

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('📊 COMO ATIVAR/DESATIVAR\n'));

console.log(chalk.bold('Para ATIVAR (padrão - recomendado):'));
console.log(chalk.green('   Nada a fazer! Todos ativados por padrão'));

console.log(chalk.bold('\nPara DESATIVAR (não recomendado):'));
console.log(chalk.red('   No arquivo btc_accumulator.js, mudar:'));
console.log(chalk.gray('   trendFilterEnabled: false'));
console.log(chalk.gray('   rsiFilterEnabled: false'));
console.log(chalk.gray('   stopLossEnabled: false\n'));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('🚀 COMO USAR EM PRODUÇÃO\n'));

console.log(chalk.bold('1. Rodar em LIVE com capital pequeno:'));
console.log(chalk.green('   node live_swing_trading_start.js'));
console.log('   (ou: SIMULATE=false node bot.js)\n');

console.log(chalk.bold('2. Monitorar os logs:'));
console.log('   Procure por esses sinais:\n');

const sinais = [
    { emoji: '🚫', descricao: 'BEARISH bloqueou compra' },
    { emoji: '⚠️', descricao: 'RSI extremo (>80 ou <20)' },
    { emoji: '🛑', descricao: 'Stop Loss ativado' },
    { emoji: '✅', descricao: 'DCA compra ativada (normal)' }
];

sinais.forEach(s => {
    console.log(`   ${s.emoji} ${s.descricao}`);
});

console.log(chalk.bold('\n3. Monitorar por 24-48h:'));
console.log('   ✓ Validar que filtros funcionam');
console.log('   ✓ Verificar PnL melhora');
console.log('   ✓ Ajustar thresholds se necessário\n');

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('⚙️  PARÂMETROS AJUSTÁVEIS\n'));

const parametros = [
    {
        nome: 'dcaDropThreshold',
        valor: 0.015,
        minimo: 0.005,
        maximo: 0.05,
        descricao: 'Threshold DCA (%)',
        dica: 'Maior = mais conservador'
    },
    {
        nome: 'rsiOverboughtThreshold',
        valor: 80,
        minimo: 70,
        maximo: 90,
        descricao: 'RSI máximo para compra',
        dica: 'Menor = mais proteção'
    },
    {
        nome: 'rsiOversoldThreshold',
        valor: 20,
        minimo: 10,
        maximo: 30,
        descricao: 'RSI mínimo para compra',
        dica: 'Maior = mais proteção'
    },
    {
        nome: 'stopLossThreshold',
        valor: 0.05,
        minimo: 0.03,
        maximo: 0.10,
        descricao: 'Stop Loss Global (%)',
        dica: 'Menor = mais proteção'
    }
];

console.log(chalk.bold('┌──────────────────────────┬───────┬─────────┬──────────┬──────────────┐'));
console.log(chalk.bold('│ Parâmetro                │ Atual │ Mínimo  │ Máximo   │ Dica         │'));
console.log(chalk.bold('├──────────────────────────┼───────┼─────────┼──────────┼──────────────┤'));

parametros.forEach(p => {
    const nome = p.nome.padEnd(24);
    const valor = String(p.valor).padEnd(7);
    const min = String(p.minimo).padEnd(9);
    const max = String(p.maximo).padEnd(10);
    const dica = p.dica.padEnd(12);
    console.log(chalk.bold(`│ ${nome} │ ${valor} │ ${min}│ ${max}│ ${dica}│`));
});

console.log(chalk.bold('└──────────────────────────┴───────┴─────────┴──────────┴──────────────┘\n'));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('🧪 COMO TESTAR OS FILTROS\n'));

console.log(chalk.bold('Teste Rápido (< 1 segundo):'));
console.log(chalk.green('   node test_filters_quick_validation.js'));
console.log('   ✓ Testa cada filtro isoladamente\n');

console.log(chalk.bold('Teste Completo (< 10 segundos):'));
console.log(chalk.green('   node test_optimized_filters.js'));
console.log('   ✓ Compara: Sem filtros vs Com filtros vs HOLD\n');

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('📚 DOCUMENTAÇÃO\n'));

console.log(chalk.bold('Leitura Rápida (5 min):'));
console.log(chalk.blue('   📄 IMPLEMENTACAO_FILTROS_V2_RESUMO.md\n'));

console.log(chalk.bold('Leitura Técnica (15 min):'));
console.log(chalk.blue('   📄 RELATORIO_FILTROS_V2.md\n'));

console.log(chalk.bold('Referência Rápida:'));
console.log(chalk.blue('   📄 Este arquivo: guia_rapido_filtros.txt\n'));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.yellow.bold('❓ PERGUNTAS FREQUENTES\n'));

const faqs = [
    {
        q: 'Como desativar Trend Filter?',
        a: 'blockOnBearishTrend: false (não recomendado!)'
    },
    {
        q: 'Por que o bot não está comprando?',
        a: 'Pode ser Trend BEARISH, RSI extremo ou Stop Loss ativo. Check logs!'
    },
    {
        q: 'Como aumentar agressividade?',
        a: 'Aumentar dcaDropThreshold (ex: 0.02) ou reduzir RSI thresholds'
    },
    {
        q: 'Como reduzir risco?',
        a: 'Aumentar dcaDropThreshold, reduzir stopLossThreshold, aumentar RSI margins'
    },
    {
        q: 'Qual é o melhor threshold?',
        a: 'Depende de sua tolerância ao risco. Comece com defaults (1.5%, RSI 80/20, 5%)'
    }
];

faqs.forEach((f, i) => {
    console.log(chalk.blue(`❓ ${f.q}`));
    console.log(chalk.green(`   ✓ ${f.a}\n`));
});

// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.green.bold('✅ TUDO PRONTO PARA DEPLOY!\n'));

console.log(chalk.bold('Resumo:'));
console.log('  ✓ 4 filtros implementados e testados');
console.log('  ✓ Bot pronto para rodar em LIVE');
console.log('  ✓ Proteção máxima contra perdas');
console.log('  ✓ Melhoria de 70% esperada\n');

console.log(chalk.yellow.bold('Próximo passo:'));
console.log(chalk.green('  → node live_swing_trading_start.js\n'));
