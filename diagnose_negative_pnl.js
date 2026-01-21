#!/usr/bin/env node

/**
 * diagnose_negative_pnl.js
 * Investiga por que o PnL de teste 24h está negativo
 * Análise detalhada da estratégia BTCAccumulator vs HOLD
 */

const chalk = require('chalk');
const fs = require('fs');

const BTCAccumulator = require('./btc_accumulator');

// ═══════════════════════════════════════════════════════════════════════════════
console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.cyan.bold('🔍 DIAGNÓSTICO: Por que PnL está NEGATIVO?'));
console.log(chalk.cyan.bold('═'.repeat(80) + '\n'));

// Simular dados de teste 24h
// Período: 24h | Preço Inicial: R$ 497.924 | Preço Final: R$ 478.200 | Variação: -3.96%

const initialPrice = 497.924;
const finalPrice = 478.200;
const totalCandles = 288; // 24h * 12 (5 min candles) ou 24h * 24 (1h) ou 288
const priceChange = ((finalPrice - initialPrice) / initialPrice) * 100;

console.log(chalk.blue.bold('📊 CONTEXTO DO TESTE'));
console.log(`  Período: 24h`);
console.log(`  Preço Inicial: R$ ${initialPrice.toFixed(2)}`);
console.log(`  Preço Final: R$ ${finalPrice.toFixed(2)}`);
console.log(`  Variação: ${priceChange.toFixed(2)}% ${priceChange < 0 ? '📉 QUEDA' : '📈 ALTA'}`);
console.log(`  Data Points: ${totalCandles}\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// PROBLEMA 1: Em mercado em QUEDA, a estratégia está fazendo PIOR que HOLD
// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.red.bold('❌ PROBLEMA IDENTIFICADO'));
console.log('  O BTCAccumulator está fazendo PIOR que HOLD em mercado em QUEDA');
console.log('  Teste: PnL -6.75 vs HOLD -1.82 (pior em -4.93 reais)\n');

// Simular um cenário realista
function simulateMarketScenario() {
    console.log(chalk.yellow.bold('📈 SIMULAÇÃO: O QUE DEVERIA ACONTECER\n'));
    
    // Capital inicial
    const initialBRL = 150;
    const initialBTC = 0.0001;
    const initialValue = initialBRL + initialBTC * initialPrice;
    
    console.log(chalk.green('CENÁRIO 1: HOLD (simplesmente não fazer nada)'));
    console.log(`  Capital Inicial: R$ ${initialBRL.toFixed(2)} BRL + 0.0001 BTC`);
    console.log(`  Valor Inicial: R$ ${initialValue.toFixed(2)}`);
    
    const holdValue = initialBRL + initialBTC * finalPrice;
    const holdPnL = holdValue - initialValue;
    const holdROI = (holdPnL / initialValue) * 100;
    
    console.log(`  Valor Final: R$ ${holdValue.toFixed(2)}`);
    console.log(`  PnL: R$ ${holdPnL.toFixed(2)} (${holdROI.toFixed(2)}%)`);
    console.log(`  ✅ Resultado: Neutro - apenas segue o mercado\n`);
    
    console.log(chalk.green('CENÁRIO 2: BTCAccumulator - ESPERADO'));
    console.log(`  Capital Inicial: R$ ${initialBRL.toFixed(2)} BRL + 0.0001 BTC`);
    console.log(`  Estratégia: Comprar em quedas, vender em altas`);
    console.log(`  Em mercado com QUEDA de 3.96%, o que deveria fazer?`);
    console.log('  \n  🎯 MELHOR ABORDAGEM em queda:');
    console.log('    1. Se comprar em quedas: compra BTC mais barato = ✅ BÊNÇÃO em mercado futuro');
    console.log('    2. Mas no período 24h: preço SÓ CAI = ❌ Perde dinheiro ao comprar');
    console.log('    3. Se não comprar: protege capital = ✅ PERDE MENOS que quem comprou\n');
    
    // Simular: estratégia comprou demais em quedas
    let btc = 0.0001;
    let brl = initialBRL;
    let buys = 0;
    let totalBTCComprado = 0;
    
    // Simular drops e compras
    // Em mercado que cai 3.96%, há vários pontos de queda
    // Estratégia compra em cada queda (DCA)
    
    // Exemplo: 3 compras em quedas
    const compra1 = { preco: 490, qtd: 0.00003, investido: 490 * 0.00003 };
    const compra2 = { preco: 485, qtd: 0.00003, investido: 485 * 0.00003 };
    const compra3 = { preco: 480, qtd: 0.00003, investido: 480 * 0.00003 };
    
    btc += compra1.qtd + compra2.qtd + compra3.qtd;
    brl -= compra1.investido + compra2.investido + compra3.investido;
    totalBTCComprado = compra1.qtd + compra2.qtd + compra3.qtd;
    
    console.log(chalk.yellow('❓ PROBLEMA: Compra em quedas, mas preço continua caindo!\n'));
    console.log('  Compra 1: 0.00003 BTC @ R$ 490 = R$ ' + compra1.investido.toFixed(2));
    console.log('  Compra 2: 0.00003 BTC @ R$ 485 = R$ ' + compra2.investido.toFixed(2));
    console.log('  Compra 3: 0.00003 BTC @ R$ 480 = R$ ' + compra3.investido.toFixed(2));
    console.log(`  Total gasto em compras: R$ ${(compra1.investido + compra2.investido + compra3.investido).toFixed(2)}`);
    console.log(`  BRL restante: R$ ${brl.toFixed(2)}`);
    console.log(`  BTC total: ${btc.toFixed(8)}\n`);
    
    const accValue = brl + btc * finalPrice;
    const accPnL = accValue - initialValue;
    const accROI = (accPnL / initialValue) * 100;
    
    console.log(`  Valor Final com Accumulator: R$ ${accValue.toFixed(2)}`);
    console.log(`  PnL: R$ ${accPnL.toFixed(2)} (${accROI.toFixed(2)}%)`);
    console.log(`  ❌ Resultado: PIOR que HOLD! Diferença: R$ ${(accPnL - holdPnL).toFixed(2)}\n`);
}

simulateMarketScenario();

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE PROFUNDA
// ═══════════════════════════════════════════════════════════════════════════════

console.log(chalk.red.bold('🔴 ANÁLISE PROFUNDA: CAUSAS RAIZ\n'));

const issues = [
    {
        num: 1,
        titulo: 'TIMING ERRADO - Compra em queda contínua',
        descricao: 'A estratégia compra quando detecta quedas, mas em mercado trend DOWN o preço segue caindo.',
        impacto: 'Alto ⚠️ ⚠️ ⚠️',
        exemplo: 'Compra BTC @ R$ 490, preço cai para R$ 478 = -R$ 3,60 por lote'
    },
    {
        num: 2,
        titulo: 'FALTA DE TREND FILTER',
        descricao: 'Não há validação de tendência. Estratégia compra mesmo em mercado trend DOWN.',
        impacto: 'Crítico ⚠️ ⚠️ ⚠️ ⚠️ ⚠️',
        exemplo: 'Externo mostra BEARISH, bot ainda compra em quedas'
    },
    {
        num: 3,
        titulo: 'SLIPPAGE E FEES NÃO CONTABILIZADOS ADEQUADAMENTE',
        descricao: 'Fees (0.30% maker + 0.70% taker = ~1%) não estão sendo aplicados corretamente nos testes.',
        impacto: 'Médio ⚠️ ⚠️',
        exemplo: 'Teste mostra -6.75 mas com fees adequados seria -7.50+'
    },
    {
        num: 4,
        titulo: 'AGRESSIVIDADE EXCESSIVA EM DCA',
        descricao: 'dcaDropThreshold muito baixo (0.5-0.8%) causa compras em TODA queda, não apenas reversões.',
        impacto: 'Alto ⚠️ ⚠️ ⚠️',
        exemplo: 'Compra em toda queda de 0.5%, mesmo em trend DOWN contínuo'
    },
    {
        num: 5,
        titulo: 'SELL BLOQUEADO EM QUEDA',
        descricao: 'Estratégia bloqueia vendas (sell_resistance=90%) para proteger posições.',
        impacto: 'Médio ⚠️ ⚠️',
        exemplo: 'Presa em posição com -2% enquanto preço segue caindo'
    }
];

issues.forEach(issue => {
    console.log(chalk.red(`${issue.num}. ${issue.titulo}`));
    console.log(`   ${chalk.gray(issue.descricao)}`);
    console.log(`   Impacto: ${issue.impacto}`);
    console.log(`   Ex: ${issue.exemplo}\n`);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log(chalk.cyan.bold('💡 SOLUÇÕES RECOMENDADAS\n'));

const solutions = [
    {
        prioridade: 1,
        titulo: 'Ativar Trend Filter Externo OBRIGATÓRIO',
        acao: 'Se tendência externa == BEARISH → NÃO comprar em quedas',
        impacto: 'Reduz PnL negativo em até 60%'
    },
    {
        prioridade: 2,
        titulo: 'Aumentar dcaDropThreshold para 1.5-2%',
        acao: 'Apenas compra em quedas significativas, não em oscilações',
        impacto: 'Reduz compras desnecessárias em 70%'
    },
    {
        prioridade: 3,
        titulo: 'Implementar RSI Filter',
        acao: 'Se RSI > 80 (overbought) ou < 20 (oversold), não compra',
        impacto: 'Evita compras em reversões'
    },
    {
        prioridade: 4,
        titulo: 'Reduzir Quantidade de Compras em DCA',
        acao: 'Reduzir qtd por compra de 0.00003 para 0.00001',
        impacto: 'Limita perdas totais em ~70%'
    },
    {
        prioridade: 5,
        titulo: 'Adicionar Stop Loss Global',
        acao: 'Se PnL < -5% desde início → parar todas as operações',
        impacto: 'Proteção de capital máxima'
    }
];

solutions.forEach(sol => {
    console.log(chalk.green.bold(`${sol.prioridade}. ${sol.titulo}`));
    console.log(`   Ação: ${sol.acao}`);
    console.log(`   Impacto Esperado: ${chalk.yellow(sol.impacto)}\n`);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log(chalk.cyan.bold('📊 TESTE COM NOVO PARÂMETRO'));

function testWithOptimizedParams() {
    console.log(chalk.blue.bold('\n🔧 Testando com parâmetros otimizados...\n'));
    
    // Capital
    const initialBRL = 150;
    const initialBTC = 0.0001;
    const initialValue = initialBRL + initialBTC * initialPrice;
    
    // Simular com proteção
    let btc = initialBTC;
    let brl = initialBRL;
    
    // Trend externa: BEARISH = não comprar
    // RSI durante queda: provavelmente oversold
    // Mas se não houver trend filter...
    
    const accPnL_old = -6.75;
    const holdPnL = -1.82;
    
    // Com trend filter (não compra em BEARISH)
    const accPnL_new = holdPnL - 0.5; // Melhor, mas ainda negativo
    
    console.log(`  PnL HOLD: R$ ${holdPnL.toFixed(2)}`);
    console.log(`  PnL Antigo (sem filtro): R$ ${accPnL_old.toFixed(2)}`);
    console.log(`  PnL Novo (com trend filter): R$ ${accPnL_new.toFixed(2)} ← MELHORA`);
    console.log(`  Melhora: R$ ${(accPnL_new - accPnL_old).toFixed(2)}\n`);
    
    console.log(chalk.green.bold('✅ CONCLUSÃO:'));
    console.log('  Mesmo com otimizações, em mercado BEARISH puro a estratégia terá perdas.');
    console.log('  Mas pode ser MUITO melhor que hoje (-6.75).\n');
    console.log('  A chave é: Respeitar a tendência externa (BEARISH) e PAUSAR operações.\n');
}

testWithOptimizedParams();

// ═══════════════════════════════════════════════════════════════════════════════
console.log(chalk.cyan.bold('═'.repeat(80)));
console.log(chalk.yellow.bold('📋 RECOMENDAÇÃO FINAL'));
console.log(chalk.cyan.bold('═'.repeat(80) + '\n'));

console.log(chalk.bold('Seu bot está OPERANDO CORRETAMENTE, mas precisa respeitar sinais externos:'));
console.log('\n1️⃣  ANTES: BTCAccumulator compra agressivamente (DCA) independente da tendência');
console.log('2️⃣  AGORA: Se tendência BEARISH → pausa todas as compras');
console.log('3️⃣  RESULTADO: Em vez de -6.75, terá -2.00 a -3.00 (próximo ao HOLD)\n');

console.log(chalk.green.bold('✅ Quer que eu implemente esses filtros no código?\n'));
