#!/usr/bin/env node
/**
 * run_24h_test_cli.js - Script CLI para rodar testes de 24h
 * 
 * Usa o mesmo AutomatedTestRunner do frontend
 * Executar: node run_24h_test_cli.js
 * 
 * Rodará automaticamente:
 * ✅ BTCAccumulator (período completo)
 * ✅ BTCAccumulator (primeira metade)
 * ✅ BTCAccumulator (segunda metade) 
 * ✅ Momentum
 * ✅ Cash Management Strategy
 * 
 * Ideal para rodar após cada alteração no código
 */

const chalk = require('chalk');
const AutomatedTestRunner = require('./automated_test_runner');

// ═════════════════════════════════════════════════════════════════════════════
// FUNCÃO MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║  🧪 TESTE AUTOMATIZADO DE 24 HORAS - MB BOT                    ║'));
    console.log(chalk.blue.bold('║  Usando dados reais da Binance & CoinGecko                     ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));
    
    const startTime = Date.now();
    
    try {
        // Executar bateria de testes (24h)
        console.log(chalk.yellow('⏳ Iniciando bateria de testes...\n'));
        
        const results = await AutomatedTestRunner.runTestBattery(24);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        
        // ═══════════════════════════════════════════════════════════════
        // EXIBIR SUMÁRIO
        // ═══════════════════════════════════════════════════════════════
        
        console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('📊 RESUMO DOS TESTES'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════\n'));
        
        const { summary, tests, priceInfo } = results;
        
        console.log(chalk.white(`Total de Testes:  ${chalk.blue.bold(summary.total)}`));
        console.log(chalk.white(`✅ Passou:         ${chalk.green.bold(summary.passed)}`));
        console.log(chalk.white(`❌ Falhou:         ${chalk.red.bold(summary.failed)}`));
        console.log(chalk.white(`Taxa de Sucesso:  ${chalk.yellow.bold(summary.passRate + '%')}`));
        console.log(chalk.white(`Tempo de Execução: ${chalk.cyan.bold(duration + 's')}`));
        
        // ═══════════════════════════════════════════════════════════════
        // DETALHES POR TESTE
        // ═══════════════════════════════════════════════════════════════
        
        console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('📈 RESULTADOS DETALHADOS'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════\n'));
        
        tests.forEach((test, idx) => {
            const status = test.passed 
                ? chalk.green.bold('✅ PASSOU') 
                : chalk.red.bold('❌ FALHOU');
            
            const pnl = parseFloat(test.pnlBRL || test.pnl || 0);
            const roi = parseFloat(test.roi || 0);
            const trades = test.trades || 0;
            
            console.log(chalk.white.bold(`${idx + 1}. ${test.testName || test.name || 'Teste ' + (idx + 1)}`));
            console.log(chalk.white(`   Status:          ${status}`));
            console.log(chalk.white(`   PnL:             ${pnl >= 0 ? chalk.green('+' + pnl.toFixed(2)) : chalk.red(pnl.toFixed(2))} BRL`));
            console.log(chalk.white(`   ROI:             ${roi >= 0 ? chalk.green('+' + roi.toFixed(2)) : chalk.red(roi.toFixed(2))}%`));
            console.log(chalk.white(`   Trades:          ${trades}`));
            console.log(chalk.white(`   vs Hold:         ${chalk.cyan((parseFloat(test.vsHoldBRL) || 0).toFixed(2))} BRL`));
            console.log('');
        });
        
        // ═══════════════════════════════════════════════════════════════
        // INFO DE PREÇO
        // ═══════════════════════════════════════════════════════════════
        
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('💱 DADOS DE PREÇO (Últimas 24h)'));
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════\n'));
        
        const priceRange = results.summary.priceRange || {};
        const priceChange = parseFloat(priceRange.change || 0);
        
        console.log(chalk.white(`Mínimo:  ${chalk.blue.bold('R$' + (priceRange.min || '0.00'))}`));
        console.log(chalk.white(`Máximo:  ${chalk.yellow.bold('R$' + (priceRange.max || '0.00'))}`));
        console.log(chalk.white(`Inicial: ${chalk.cyan.bold('R$' + (priceRange.start || '0.00'))}`));
        console.log(chalk.white(`Final:   ${chalk.cyan.bold('R$' + (priceRange.end || '0.00'))}`));
        console.log(chalk.white(`Variação: ${priceChange >= 0 ? chalk.green('+' + priceChange.toFixed(2) + '%') : chalk.red(priceChange.toFixed(2) + '%')}`));
        console.log(chalk.white(`Candles:  ${results.summary.dataPoints || 0} (dados de ${results.summary.dataSource || 'API'})\n`));
        
        // ═══════════════════════════════════════════════════════════════
        // CONCLUSÃO
        // ═══════════════════════════════════════════════════════════════
        
        const allPassed = summary.failed === 0;
        
        console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
        
        if (allPassed) {
            console.log(chalk.green.bold('🎉 TODOS OS TESTES PASSARAM! ✅\n'));
            console.log(chalk.green('O código está pronto para produção.\n'));
            process.exit(0);
        } else {
            console.log(chalk.red.bold('⚠️  ALGUNS TESTES FALHARAM ❌\n'));
            console.log(chalk.red(`${summary.failed} teste(s) não atendeu(ram) aos critérios.\n`));
            process.exit(1);
        }
        
    } catch (error) {
        console.error(chalk.red.bold('\n❌ ERRO DURANTE OS TESTES:\n'));
        console.error(chalk.red(error.message));
        console.error(chalk.red(error.stack));
        process.exit(1);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// EXECUTAR
// ═════════════════════════════════════════════════════════════════════════════

main();
