#!/usr/bin/env node
/**
 * test_watch.js - Monitor de mudanças que roda testes automaticamente
 * 
 * Usa o próprio Node.js fs.watch para monitorar alterações
 * Mais portável que bash scripts (funciona em Windows, Mac, Linux)
 * 
 * Uso:
 *   npm run test:watch
 *   node test_watch.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═════════════════════════════════════════════════════════════════════════════

const WATCH_FILES = [
    'momentum_order_validator.js',
    'bot.js',
    'cash_management_strategy.js',
    'swing_trading_strategy.js',
    'adaptive_strategy.js',
    'decision_engine.js',
    'confidence_system.js'
];

const MIN_INTERVAL = 3000; // 3 segundos entre testes
let lastTestTime = 0;
let isRunningTest = false;

// ═════════════════════════════════════════════════════════════════════════════
// FUNÇÃO: Executar testes
// ═════════════════════════════════════════════════════════════════════════════

function runTests(reason) {
    const now = Date.now();
    
    // Evitar rodar testes muito rapidamente
    if (now - lastTestTime < MIN_INTERVAL) {
        console.log(chalk.yellow(`⏳ Aguardando ${Math.ceil((MIN_INTERVAL - (now - lastTestTime)) / 1000)}s antes do próximo teste...`));
        return;
    }
    
    if (isRunningTest) {
        console.log(chalk.yellow('⏳ Teste já em execução...'));
        return;
    }
    
    isRunningTest = true;
    lastTestTime = now;
    
    console.log('');
    console.log(chalk.blue.bold('════════════════════════════════════════════════════════════════'));
    console.log(chalk.blue.bold(`🔄 Executando testes de 24h às ${new Date().toLocaleTimeString()}`));
    console.log(chalk.blue.bold(`📝 Motivo: ${reason}`));
    console.log(chalk.blue.bold('════════════════════════════════════════════════════════════════'));
    console.log('');
    
    // Executar o teste CLI
    const testProcess = spawn('node', ['run_24h_test_cli.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    testProcess.on('close', (code) => {
        isRunningTest = false;
        
        if (code === 0) {
            console.log(chalk.green.bold('\n✅ Testes passaram! Continuando monitoramento...\n'));
        } else {
            console.log(chalk.red.bold('\n❌ Testes falharam! Verifique o código.\n'));
        }
        
        console.log(chalk.yellow('🔍 Aguardando próximas alterações...\n'));
    });
    
    testProcess.on('error', (err) => {
        isRunningTest = false;
        console.error(chalk.red('❌ Erro ao executar testes:'), err.message);
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═════════════════════════════════════════════════════════════════════════════

console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
console.log(chalk.blue.bold('║  🧪 MONITOR DE TESTES - MB BOT                                 ║'));
console.log(chalk.blue.bold('║  Roda testes automaticamente ao alterar arquivos críticos      ║'));
console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

console.log(chalk.yellow('🔍 Monitorando alterações em arquivos críticos...\n'));
console.log('Arquivos sendo monitorados:');
WATCH_FILES.forEach(file => {
    console.log(`  • ${file}`);
});

console.log('');
console.log(chalk.yellow('⚠️  Pressione Ctrl+C para parar.\n'));

// Rodar teste inicial
console.log(chalk.cyan('Executando teste inicial...\n'));
runTests('Inicialização');

// ═════════════════════════════════════════════════════════════════════════════
// MONITORES DE ARQUIVO
// ═════════════════════════════════════════════════════════════════════════════

const watchers = [];

WATCH_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
        console.log(chalk.yellow(`⚠️  Arquivo não encontrado: ${file}`));
        return;
    }
    
    // Configurar watcher
    const watcher = fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
            console.log(chalk.cyan(`\n📝 ${filename} foi modificado\n`));
            runTests(`Alteração em ${filename}`);
        }
    });
    
    watcher.on('error', (err) => {
        console.error(chalk.red(`Erro ao monitorar ${file}:`), err.message);
    });
    
    watchers.push({ file, watcher });
});

// ═════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═════════════════════════════════════════════════════════════════════════════

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Parando monitor de testes...\n'));
    
    watchers.forEach(({ file, watcher }) => {
        watcher.close();
    });
    
    console.log(chalk.green('✅ Monitor finalizado.\n'));
    process.exit(0);
});

console.log(chalk.green('✅ Monitoramento ativo!\n'));
