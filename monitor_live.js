/**
 * Monitor em Tempo Real para Teste Live
 * Exibe dashboard interativo enquanto bot roda
 */

const fs = require('fs');
const chalk = require('chalk');
const path = require('path');

// Configuração
const CONFIG = {
    refreshInterval: 2000, // 2 segundos
    maxOrders: 10,
    maxLogs: 5,
    horaTermino: '20:30:00'
};

// Estado do monitor
const estado = {
    ultimoRefresh: null,
    ciclosTotal: 0,
    startTime: new Date(),
    lastStats: null
};

/**
 * Parse de hora
 */
function parseHora(horaStr) {
    const [h, m, s] = horaStr.split(':').map(Number);
    const data = new Date();
    data.setHours(h, m, s, 0);
    return data;
}

/**
 * Formata segundos para horas:minutos
 */
function formatDuration(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m ${secs % 60}s`;
}

/**
 * Formata hora atual
 */
function horaAtual() {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
}

/**
 * Limpa tela
 */
function limparTela() {
    console.clear();
}

/**
 * Exibe header
 */
function exibirHeader() {
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║          MONITOR LIVE - TESTE EM EXECUÇÃO                     ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝\n'));
}

/**
 * Exibe status atual
 */
function exibirStatus() {
    const agora = new Date();
    const alvo = parseHora(CONFIG.horaTermino);
    const duracao = agora - estado.startTime;
    const tempoRestante = Math.max(0, alvo - agora);
    const tempoRestanteFormatado = formatDuration(tempoRestante);
    
    console.log(chalk.bold.white('⏱️  STATUS TEMPORAL:'));
    console.log(`  Hora atual: ${chalk.cyan(horaAtual())}`);
    console.log(`  Hora de término: ${chalk.yellow(CONFIG.horaTermino)}`);
    console.log(`  Tempo decorrido: ${chalk.green(formatDuration(duracao))}`);
    console.log(`  Tempo restante: ${tempoRestante > 0 ? chalk.yellow(tempoRestanteFormatado) : chalk.red('ENCERRADO')}`);
    
    if (tempoRestante <= 300000) { // 5 minutos
        console.log(chalk.red.bold(`  ⚠️  MENOS DE 5 MINUTOS RESTANTES!`));
    }
    
    console.log();
}

/**
 * Lê stats mais recentes do arquivo
 */
function lerStats() {
    try {
        // Procura por arquivo de stats mais recente
        const logsDir = './logs';
        if (!fs.existsSync(logsDir)) return null;
        
        const files = fs.readdirSync(logsDir)
            .filter(f => f.startsWith('teste_'))
            .sort()
            .reverse();
        
        if (files.length === 0) return null;
        
        const latestLog = path.join(logsDir, files[0]);
        const content = fs.readFileSync(latestLog, 'utf8');
        
        // Extrair última linha com JSON
        const lines = content.split('\n').reverse();
        for (const line of lines) {
            try {
                if (line.includes('Ciclo') || line.includes('Saldos')) {
                    return line;
                }
            } catch (e) {}
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Exibe métricas do bot
 */
function exibirMétricas() {
    console.log(chalk.bold.white('📊 MÉTRICAS BOT:'));
    
    const stats = lerStats();
    if (stats) {
        console.log(chalk.gray(stats.substring(0, 100)));
    } else {
        console.log(chalk.gray('  (Aguardando primeiro ciclo...)'));
    }
    
    console.log();
}

/**
 * Exibe info do dashboard
 */
function exibirDashboard() {
    console.log(chalk.bold.white('📈 ACESSO AO DASHBOARD:'));
    console.log(`  ${chalk.cyan('http://localhost:3001')}`);
    console.log(`  Atualiza a cada 3 segundos`);
    console.log(`  Exibe: Preços, Ordens, Saldos, PnL, Convicção`);
    console.log();
}

/**
 * Exibe arquivos de log gerados
 */
function exibirLogs() {
    console.log(chalk.bold.white('📝 LOGS GERADOS:'));
    
    try {
        const logsDir = './logs';
        if (!fs.existsSync(logsDir)) {
            console.log(chalk.gray('  (Ainda nenhum log)'));
            return;
        }
        
        const files = fs.readdirSync(logsDir)
            .filter(f => f.startsWith('bot_') || f.startsWith('dashboard_') || f.startsWith('teste_'))
            .slice(-3); // Últimos 3 arquivos
        
        if (files.length === 0) {
            console.log(chalk.gray('  (Criando logs...)'));
        } else {
            files.forEach(file => {
                const fileSize = fs.statSync(path.join(logsDir, file)).size;
                const sizeKB = (fileSize / 1024).toFixed(1);
                console.log(`  ${file} (${sizeKB}KB)`);
            });
        }
    } catch (e) {
        console.log(chalk.gray('  (Erro ao ler logs)'));
    }
    
    console.log();
}

/**
 * Exibe instruções
 */
function exibirInstruções() {
    console.log(chalk.bold.white('🎯 O QUE MONITORAR:'));
    console.log();
    console.log('  ' + chalk.green('✓ Preços') + ' - Devem ser números válidos, sem picos de 5%+');
    console.log('  ' + chalk.green('✓ Saldos') + ' - BTC e BRL devem estar consistentes');
    console.log('  ' + chalk.green('✓ Convicção') + ' - Mostrada como % (40-80% é saudável)');
    console.log('  ' + chalk.green('✓ Ordens') + ' - Status deve ser \'open\' ou \'filled\'');
    console.log('  ' + chalk.green('✓ PnL') + ' - Lucro deve ser acompanhado em tempo real');
    console.log();
    
    console.log(chalk.yellow('⚠️  ALERTAS:'));
    console.log('  ' + chalk.red('✗ Convicção < 40%') + ' - Verifique mercado volátil');
    console.log('  ' + chalk.red('✗ Preço inválido') + ' - API pode estar com problema');
    console.log('  ' + chalk.red('✗ Saldo zero') + ' - Pode ser erro de conexão');
    console.log();
}

/**
 * Exibe relatório JSON gerado
 */
function exibirRelatórioJSON() {
    try {
        const files = fs.readdirSync('.')
            .filter(f => f.startsWith('teste_live_') && f.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) return;
        
        const relatorio = JSON.parse(fs.readFileSync(files[0], 'utf8'));
        
        console.log(chalk.bold.green('\n✅ RELATÓRIO FINAL GERADO:'));
        console.log(chalk.gray(`  Arquivo: ${files[0]}`));
        console.log(`  Ciclos: ${relatorio.cyclesExecutados}`);
        console.log(`  Lucro: R$ ${relatorio.lucroTotal.toFixed(2)}`);
        console.log(`  Saldo: ${relatorio.saldoBTC.toFixed(8)} BTC`);
        console.log(`  Validações: ${Object.values(relatorio.validacoes).filter(v => v).length}/5`);
        
    } catch (e) {
        // Arquivo não existe ainda
    }
}

/**
 * Loop principal
 */
async function monitorarTempo() {
    while (true) {
        limparTela();
        exibirHeader();
        
        // Verificar se terminou
        const agora = new Date();
        const alvo = parseHora(CONFIG.horaTermino);
        
        if (agora >= alvo) {
            console.log(chalk.bold.green('\n✅ HORA DE TÉRMINO ATINGIDA!\n'));
            console.log(chalk.cyan('O teste foi finalizado. Gerando relatório final...\n'));
            exibirRelatórioJSON();
            break;
        }
        
        exibirStatus();
        exibirMétricas();
        exibirDashboard();
        exibirLogs();
        exibirInstruções();
        
        console.log(chalk.gray('Atualizando em 2 segundos... (Pressione Ctrl+C para sair)'));
        
        // Aguardar próxima atualização
        await new Promise(resolve => setTimeout(resolve, CONFIG.refreshInterval));
    }
}

// Tratador de Ctrl+C
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nMonitor interrompido pelo usuário.\n'));
    process.exit(0);
});

// Iniciar
console.log(chalk.cyan('Iniciando monitor...\n'));
setTimeout(monitorarTempo, 1000);
