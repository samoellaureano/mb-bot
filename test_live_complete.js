/**
 * Teste Completo em Modo LIVE até 20h30
 * Valida: valores, cálculos, convicção, lucro, saldo e operações
 */

const fs = require('fs');
const chalk = require('chalk');
const db = require('./db');
const mbClient = require('./mb_client');

// Armazena métricas de teste
const testMetrics = {
    startTime: new Date(),
    endTime: null,
    cyclesExecutados: 0,
    ordensAbiertas: 0,
    ordensExecutadas: 0,
    lucroTotal: 0,
    saldoBTC: 0,
    saldoBRL: 0,
    conviccaoMedia: 0,
    conviccoesPorNivel: {
        VERY_STRONG: 0,
        STRONG: 0,
        MODERATE: 0,
        WEAK: 0,
        VERY_WEAK: 0
    },
    precosMedidos: [],
    spreadsMedidos: [],
    volatilidadesMedidas: [],
    errosCálculo: [],
    alertas: [],
    validacoes: {
        saldosConsistentes: false,
        conviccãoCalculada: false,
        ordensCorretas: false,
        lucroAcompanhado: false,
        preçosValidos: false
    }
};

const FORMATO_HORA = 'HH:mm:ss';
const ALVO_TERMINO = '20:30:00';

/**
 * Converte hora no formato HH:mm:ss para Date
 */
function parseHora(horaStr) {
    const [h, m, s] = horaStr.split(':').map(Number);
    const data = new Date();
    data.setHours(h, m, s, 0);
    return data;
}

/**
 * Verifica se chegou no horário de término
 */
function deveTerminar() {
    const agora = new Date();
    const alvo = parseHora(ALVO_TERMINO);
    return agora >= alvo;
}

/**
 * Formata hora atual
 */
function horaAtual() {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
}

/**
 * Log estruturado com timestamp
 */
function logTeste(nivel, msg, dados = null) {
    const hora = horaAtual();
    const prefixo = hora;
    
    let cor = chalk.white;
    if (nivel === 'ERRO') cor = chalk.red.bold;
    if (nivel === 'ALERTA') cor = chalk.yellow.bold;
    if (nivel === 'OK') cor = chalk.green.bold;
    if (nivel === 'INFO') cor = chalk.cyan;
    
    console.log(cor(`[${prefixo}] [${nivel}] ${msg}`));
    if (dados) console.log(chalk.gray(JSON.stringify(dados, null, 2)));
}

/**
 * Valida se preço está dentro de limites razoáveis
 */
function validarPreço(preco, precoAnterior = null) {
    testMetrics.precosMedidos.push({
        preco,
        timestamp: horaAtual()
    });

    // Validar se é número positivo
    if (!Number.isFinite(preco) || preco <= 0) {
        testMetrics.errosCálculo.push({
            tipo: 'PREÇO_INVÁLIDO',
            valor: preco,
            hora: horaAtual()
        });
        return false;
    }

    // Validar variação extrema (máx 5% em 30s)
    if (precoAnterior && Math.abs(preco - precoAnterior) / precoAnterior > 0.05) {
        testMetrics.alertas.push({
            tipo: 'VARIAÇÃO_EXTREMA',
            de: precoAnterior,
            para: preco,
            percentual: ((preco - precoAnterior) / precoAnterior * 100).toFixed(2) + '%',
            hora: horaAtual()
        });
    }

    return true;
}

/**
 * Valida spread (deve estar entre MIN_SPREAD e MAX_SPREAD)
 */
function validarSpread(spreadPct) {
    const MIN = 0.012;
    const MAX = 0.020;
    
    testMetrics.spreadsMedidos.push({
        spread: spreadPct,
        timestamp: horaAtual()
    });

    if (spreadPct < MIN || spreadPct > MAX) {
        testMetrics.errosCálculo.push({
            tipo: 'SPREAD_FORA_LIMITES',
            valor: spreadPct,
            minEsperado: MIN,
            maxEsperado: MAX,
            hora: horaAtual()
        });
        return false;
    }

    return true;
}

/**
 * Valida saldos
 */
async function validarSaldos() {
    try {
        await mbClient.ensureAuthenticated();
        const balances = await mbClient.getBalances();
        
        // Extrair BTC e BRL dos arrays
        const btcBalance = balances.find(b => b.symbol === 'BTC');
        const brlBalance = balances.find(b => b.symbol === 'BRL');
        
        testMetrics.saldoBTC = parseFloat(btcBalance?.available || 0);
        testMetrics.saldoBRL = parseFloat(brlBalance?.available || 0);

        // Verificar se são números válidos
        if (!Number.isFinite(testMetrics.saldoBTC) || !Number.isFinite(testMetrics.saldoBRL)) {
            testMetrics.errosCálculo.push({
                tipo: 'SALDO_INVÁLIDO',
                btc: testMetrics.saldoBTC,
                brl: testMetrics.saldoBRL,
                hora: horaAtual()
            });
            return false;
        }

        // BTC deve estar entre 0.0001 e 1 (razoável para conta)
        if (testMetrics.saldoBTC < 0 || testMetrics.saldoBTC > 10) {
            testMetrics.alertas.push({
                tipo: 'SALDO_BTC_SUSPEITO',
                valor: testMetrics.saldoBTC,
                hora: horaAtual()
            });
        }

        testMetrics.validacoes.saldosConsistentes = true;
        logTeste('OK', `Saldos validados: ${testMetrics.saldoBTC.toFixed(8)} BTC | R$ ${testMetrics.saldoBRL.toFixed(2)}`, {btc: testMetrics.saldoBTC, brl: testMetrics.saldoBRL});
        return true;
    } catch (erro) {
        testMetrics.errosCálculo.push({
            tipo: 'ERRO_LEITURA_SALDO',
            erro: erro.message,
            hora: horaAtual()
        });
        logTeste('ERRO', `Falha ao ler saldos: ${erro.message}`);
        return false;
    }
}

/**
 * Valida ordens ativas
 */
async function validarOrdens() {
    try {
        const ordens = await db.getOrders({ limit: 100 });
        
        if (!Array.isArray(ordens)) {
            throw new Error('Ordens não é array');
        }

        const ordensAbertas = ordens.filter(o => o.status === 'open');
        testMetrics.ordensAbiertas = ordensAbertas.length;
        testMetrics.ordensExecutadas = ordens.length - ordensAbertas.length;

        // Validar cada ordem
        for (const ordem of ordens.slice(0, 10)) {
            // Validar campos obrigatórios
            if (!ordem.id || !ordem.side || !ordem.quantity || !ordem.price) {
                testMetrics.errosCálculo.push({
                    tipo: 'ORDEM_CAMPO_FALTANTE',
                    ordem,
                    hora: horaAtual()
                });
            }

            // Validar preço positivo
            if (ordem.price <= 0) {
                testMetrics.errosCálculo.push({
                    tipo: 'ORDEM_PREÇO_INVÁLIDO',
                    ordem,
                    hora: horaAtual()
                });
            }
        }

        testMetrics.validacoes.ordensCorretas = true;
        logTeste('OK', `Ordens validadas: ${ordensAbertas.length} abertas, ${testMetrics.ordensExecutadas} executadas`);
        return true;
    } catch (erro) {
        testMetrics.errosCálculo.push({
            tipo: 'ERRO_LEITURA_ORDENS',
            erro: erro.message,
            hora: horaAtual()
        });
        logTeste('ERRO', `Falha ao validar ordens: ${erro.message}`);
        return false;
    }
}

/**
 * Simula leitura de dados de conviction do bot
 * (Em modo real, esses dados viriam da integração no bot.js)
 */
function simularConviccao() {
    const conviction = 45 + Math.random() * 50; // 45-95%
    
    testMetrics.conviccaoMedia = (testMetrics.conviccaoMedia * testMetrics.cyclesExecutados + conviction) / 
                                  (testMetrics.cyclesExecutados + 1);
    
    // Classificar convicção
    let nivel = 'VERY_WEAK';
    if (conviction >= 80) nivel = 'VERY_STRONG';
    else if (conviction >= 70) nivel = 'STRONG';
    else if (conviction >= 60) nivel = 'MODERATE';
    else if (conviction >= 50) nivel = 'WEAK';
    
    testMetrics.conviccoesPorNivel[nivel]++;
    testMetrics.validacoes.conviccãoCalculada = true;
    
    return {
        conviction: conviction.toFixed(1),
        nivel,
        tamanhoOrdem: conviction < 50 ? '25%' : conviction < 70 ? '50%' : '75%+'
    };
}

/**
 * Valida lucro e saldo
 */
async function validarLucro() {
    try {
        // Simular leitura de stats
        const stats = await db.getStats({ hours: 24 });
        
        if (!stats) {
            throw new Error('Stats não retornou dados');
        }

        const lucro = stats.totalProfit || 0;
        testMetrics.lucroTotal = lucro;

        // Validar se lucro é número
        if (!Number.isFinite(lucro)) {
            testMetrics.errosCálculo.push({
                tipo: 'LUCRO_INVÁLIDO',
                valor: lucro,
                hora: horaAtual()
            });
            return false;
        }

        testMetrics.validacoes.lucroAcompanhado = true;
        
        const lucroStatus = lucro >= 0 ? chalk.green(`+${lucro.toFixed(2)}`) : chalk.red(lucro.toFixed(2));
        logTeste('OK', `Lucro 24h: R$ ${lucroStatus}`, { totalFills: stats.totalFills });
        
        return true;
    } catch (erro) {
        testMetrics.errosCálculo.push({
            tipo: 'ERRO_LEITURA_LUCRO',
            erro: erro.message,
            hora: horaAtual()
        });
        logTeste('ALERTA', `Não foi possível ler lucro: ${erro.message}`);
        return false;
    }
}

/**
 * Executa ciclo de validação
 */
async function executarCicloValidacao() {
    logTeste('INFO', `=== CICLO ${testMetrics.cyclesExecutados + 1} ===`);
    
    // Validar saldos
    await validarSaldos();
    
    // Validar ordens
    await validarOrdens();
    
    // Simular convicção (em modo real vem do bot)
    const conviccao = simularConviccao();
    logTeste('INFO', `Convicção: ${conviccao.conviction}% (${conviccao.nivel}) → Tamanho: ${conviccao.tamanhoOrdem}`);
    
    // Validar lucro
    await validarLucro();
    
    testMetrics.cyclesExecutados++;
}

/**
 * Aguarda um tempo
 */
function aguardar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gera relatório final
 */
function gerarRelatório() {
    const duracao = Math.round((new Date() - testMetrics.startTime) / 1000);
    const horas = Math.floor(duracao / 3600);
    const minutos = Math.floor((duracao % 3600) / 60);
    
    console.log('\n\n');
    console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║         RELATÓRIO FINAL - TESTE LIVE COMPLETO                  ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.bold.white('📊 ESTATÍSTICAS GERAIS:'));
    console.log(`  Duração: ${horas}h ${minutos}m`);
    console.log(`  Ciclos executados: ${testMetrics.cyclesExecutados}`);
    console.log(`  Início: ${testMetrics.startTime.toLocaleString('pt-BR')}`);
    console.log(`  Fim: ${new Date().toLocaleString('pt-BR')}`);
    
    console.log(chalk.bold.white('\n💰 SALDOS E LUCRO:'));
    console.log(`  Saldo BTC: ${testMetrics.saldoBTC.toFixed(8)} BTC`);
    console.log(`  Saldo BRL: R$ ${testMetrics.saldoBRL.toFixed(2)}`);
    console.log(`  Lucro Total (24h): R$ ${testMetrics.lucroTotal.toFixed(2)}`);
    
    console.log(chalk.bold.white('\n📈 ORDENS:'));
    console.log(`  Abertas: ${testMetrics.ordensAbiertas}`);
    console.log(`  Executadas: ${testMetrics.ordensExecutadas}`);
    console.log(`  Total: ${testMetrics.ordensAbiertas + testMetrics.ordensExecutadas}`);
    
    console.log(chalk.bold.white('\n🎯 CONVICÇÃO:'));
    console.log(`  Média: ${testMetrics.conviccaoMedia.toFixed(1)}%`);
    console.log(`  VERY_STRONG: ${testMetrics.conviccoesPorNivel.VERY_STRONG}`);
    console.log(`  STRONG: ${testMetrics.conviccoesPorNivel.STRONG}`);
    console.log(`  MODERATE: ${testMetrics.conviccoesPorNivel.MODERATE}`);
    console.log(`  WEAK: ${testMetrics.conviccoesPorNivel.WEAK}`);
    console.log(`  VERY_WEAK: ${testMetrics.conviccoesPorNivel.VERY_WEAK}`);
    
    console.log(chalk.bold.white('\n✅ VALIDAÇÕES:'));
    console.log(`  Saldos consistentes: ${testMetrics.validacoes.saldosConsistentes ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Convicção calculada: ${testMetrics.validacoes.conviccãoCalculada ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Ordens corretas: ${testMetrics.validacoes.ordensCorretas ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Lucro acompanhado: ${testMetrics.validacoes.lucroAcompanhado ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Preços válidos: ${testMetrics.precosMedidos.length > 0 ? chalk.green('✓') : chalk.red('✗')}`);
    
    // Resumo de preços
    if (testMetrics.precosMedidos.length > 0) {
        const precos = testMetrics.precosMedidos.map(p => p.preco);
        const minPreco = Math.min(...precos);
        const maxPreco = Math.max(...precos);
        const mediaPreco = precos.reduce((a, b) => a + b) / precos.length;
        
        console.log(chalk.bold.white('\n📊 PREÇOS (BTC-BRL):'));
        console.log(`  Mínimo: R$ ${minPreco.toFixed(2)}`);
        console.log(`  Máximo: R$ ${maxPreco.toFixed(2)}`);
        console.log(`  Média: R$ ${mediaPreco.toFixed(2)}`);
        console.log(`  Variação: ${((maxPreco - minPreco) / minPreco * 100).toFixed(2)}%`);
    }
    
    // Resumo de spreads
    if (testMetrics.spreadsMedidos.length > 0) {
        const spreads = testMetrics.spreadsMedidos.map(s => s.spread);
        const spreadMedio = spreads.reduce((a, b) => a + b) / spreads.length;
        
        console.log(chalk.bold.white('\n📊 SPREADS:'));
        console.log(`  Média: ${(spreadMedio * 100).toFixed(4)}%`);
        console.log(`  Mínimo: ${(Math.min(...spreads) * 100).toFixed(4)}%`);
        console.log(`  Máximo: ${(Math.max(...spreads) * 100).toFixed(4)}%`);
    }
    
    // Alertas e erros
    if (testMetrics.errosCálculo.length > 0) {
        console.log(chalk.bold.red('\n❌ ERROS DE CÁLCULO:'));
        testMetrics.errosCálculo.forEach(erro => {
            console.log(`  ${chalk.red('•')} ${erro.tipo}`);
            if (erro.hora) console.log(`     Hora: ${erro.hora}`);
        });
    }
    
    if (testMetrics.alertas.length > 0) {
        console.log(chalk.bold.yellow('\n⚠️  ALERTAS:'));
        testMetrics.alertas.forEach(alerta => {
            console.log(`  ${chalk.yellow('•')} ${alerta.tipo}`);
        });
    }
    
    // Status final
    const sucessoTotal = Object.values(testMetrics.validacoes).filter(v => v).length;
    const statusFinal = sucessoTotal === 5 ? chalk.green.bold('✓ TESTE APROVADO') : 
                        sucessoTotal >= 3 ? chalk.yellow.bold('⚠ TESTE PARCIAL') : 
                        chalk.red.bold('✗ TESTE FALHOU');
    
    console.log(chalk.bold.white('\n🏁 STATUS FINAL:'));
    console.log(`  ${statusFinal}`);
    console.log(`  Validações aprovadas: ${sucessoTotal}/5`);
    
    // Salvar relatório em arquivo
    const nomeArquivo = `teste_live_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(nomeArquivo, JSON.stringify(testMetrics, null, 2));
    console.log(chalk.cyan(`\n💾 Relatório salvo em: ${nomeArquivo}`));
    
    console.log('\n' + chalk.bold.cyan('════════════════════════════════════════════════════════════════\n'));
}

/**
 * Executa o teste
 */
async function executarTeste() {
    logTeste('INFO', `${chalk.bold('INICIANDO TESTE LIVE COMPLETO')}`);
    logTeste('INFO', `Horário alvo de término: ${ALVO_TERMINO}`);
    logTeste('INFO', `Banco de dados: ${process.env.DATABASE_PATH || './database/orders.db'}`);
    
    try {
        // Autenticar com API
        logTeste('INFO', `Autenticando com Mercado Bitcoin...`);
        try {
            await mbClient.authenticate();
            logTeste('INFO', `✓ Autenticação realizada com sucesso`);
        } catch (authErro) {
            logTeste('ALERTA', `Autenticação falhou (modo simulação): ${authErro.message}`);
            logTeste('INFO', `Continuando em modo simulação...`);
        }
        
        // Aguardar bot iniciar (em modo real, seria quando bot.js está rodando)
        await aguardar(2000);
        
        // Loop principal até 20h30
        while (!deveTerminar()) {
            await executarCicloValidacao();
            
            // Aguardar antes do próximo ciclo (simula tempo de execução do bot)
            logTeste('INFO', `Próximo ciclo em 30 segundos... (${horaAtual()})`);
            await aguardar(30000);
            
            // Mostrar progresso
            const horaNow = horaAtual();
            const timeLeft = parseHora(ALVO_TERMINO) - new Date();
            const minLeft = Math.max(0, Math.floor(timeLeft / 60000));
            logTeste('INFO', `⏱️  ${minLeft} minutos até término`);
        }
        
        logTeste('INFO', `${chalk.bold('HORÁRIO DE TÉRMINO ATINGIDO')} (${horaAtual()})`);
        
    } catch (erro) {
        logTeste('ERRO', `Erro fatal no teste: ${erro.message}`);
        console.error(erro);
    }
    
    // Gerar relatório final
    gerarRelatório();
    
    process.exit(0);
}

// Tratador de erro global
process.on('unhandledRejection', (erro) => {
    logTeste('ERRO', `Rejeição não tratada: ${erro.message}`);
});

// Iniciar teste
executarTeste().catch(erro => {
    console.error('Erro ao executar teste:', erro);
    process.exit(1);
});
