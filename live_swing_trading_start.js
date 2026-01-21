#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.clear();
  
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log(chalk.red.bold('╔════════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.red.bold('║                                                                                ║'));
  console.log(chalk.red.bold('║              ⚠️  ATENÇÃO: MODO LIVE COM CAPITAL REAL ⚠️                        ║'));
  console.log(chalk.red.bold('║                                                                                ║'));
  console.log(chalk.red.bold('╚════════════════════════════════════════════════════════════════════════════════╝\n'));

  // Verificar configurações
  require('dotenv').config();
  
  if (process.env.SIMULATE === 'true') {
    console.log(chalk.red.bold('❌ ERRO: SIMULATE=true\n'));
    console.log('Você está tentando rodar em LIVE, mas SIMULATE está ativado!');
    console.log('Corrija .env e tente novamente.\n');
    process.exit(1);
  }

  if (process.env.USE_SWING_TRADING !== 'true') {
    console.log(chalk.red.bold('❌ ERRO: USE_SWING_TRADING=false\n'));
    console.log('Estratégia swing trading não está ativada!\n');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  console.log(chalk.yellow.bold('📋 CHECKLIST PRÉ-EXECUÇÃO\n'));

  const checks = [
    { label: 'API_KEY configurada', check: !!process.env.API_KEY },
    { label: 'API_SECRET configurada', check: !!process.env.API_SECRET },
    { label: 'SIMULATE=false', check: process.env.SIMULATE === 'false' },
    { label: 'USE_SWING_TRADING=true', check: process.env.USE_SWING_TRADING === 'true' },
    { label: 'swing_trading_strategy.js existe', check: fs.existsSync('./swing_trading_strategy.js') },
    { label: 'bot.js existe', check: fs.existsSync('./bot.js') },
  ];

  let allPassed = true;
  for (const item of checks) {
    const icon = item.check ? chalk.green('✅') : chalk.red('❌');
    console.log(`${icon} ${item.label}`);
    if (!item.check) allPassed = false;
  }

  if (!allPassed) {
    console.log(chalk.red.bold('\n❌ Alguns checks falharam. Corrija e tente novamente.\n'));
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  console.log(chalk.cyan.bold('\n📊 PARÂMETROS DA ESTRATÉGIA\n'));
  
  const params = [
    { name: 'Drop Threshold', value: '0.3%', desc: 'Queda necessária para compra' },
    { name: 'Profit Target', value: '0.4%', desc: 'Alvo de lucro para venda' },
    { name: 'Stop Loss', value: '-0.8%', desc: 'Proteção contra perdas' },
    { name: 'Ciclo', value: process.env.CYCLE_SEC + 's', desc: 'Intervalo entre operações' },
    { name: 'Spread', value: process.env.SPREAD_PCT + '%', desc: 'Spread no orderbook' },
  ];

  params.forEach(p => {
    console.log(`  ${chalk.blue(p.name)}: ${chalk.bold(p.value)} (${p.desc})`);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  console.log(chalk.red.bold('\n⚠️  AVISOS CRÍTICOS\n'));
  
  const warnings = [
    '💰 Isso usará CAPITAL REAL da sua conta Mercado Bitcoin',
    '📊 Não há garantia de lucro - você pode PERDER dinheiro',
    '🔄 Ordens reais serão colocadas e executadas',
    '⏱️  Não feche a janela durante a execução',
    '🛑 Pressione Ctrl+C para parar (mas isso NÃO cancela ordens ativas)',
    '📈 Monitore os logs continuamente para sinais de [SWING]',
    '⚡ Comece com saldo pequeno (50-100 BRL) para testar',
  ];

  warnings.forEach((w, i) => {
    console.log(`  ${i + 1}. ${chalk.yellow(w)}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  console.log(chalk.cyan.bold('\n🔐 CONFIRMAÇÕES NECESSÁRIAS\n'));

  return new Promise((resolve) => {
    const question1 = () => {
      rl.question(chalk.red.bold('❓ Entendo os riscos e quero continuar? (sim/não): '), (answer) => {
        if (answer.toLowerCase() !== 'sim') {
          console.log(chalk.red('\n❌ Abortado pelo usuário.\n'));
          process.exit(0);
        }
        
        const question2 = () => {
          rl.question(chalk.red.bold('❓ Meu saldo está abaixo de 500 BRL para testes? (sim/não): '), (answer2) => {
            if (answer2.toLowerCase() !== 'sim') {
              console.log(chalk.yellow('\n⚠️  Recomendo usar valor pequeno para validar a estratégia.\n'));
            }
            
            const question3 = () => {
              rl.question(chalk.red.bold('❓ Digite "RODAR EM LIVE" para confirmar: '), (answer3) => {
                if (answer3 !== 'RODAR EM LIVE') {
                  console.log(chalk.red('\n❌ Confirmação incorreta. Abortado.\n'));
                  process.exit(0);
                }
                
                console.log(chalk.green.bold('\n✅ Confirmação recebida! Iniciando bot em modo LIVE...\n'));
                console.log(chalk.cyan('═'.repeat(80)));
                console.log(chalk.cyan.bold('🚀 INICIANDO BOT COM SWING TRADING EM MODO LIVE'));
                console.log(chalk.cyan('═'.repeat(80) + '\n'));
                
                rl.close();
                
                // Aguardar um pouco e iniciar bot
                setTimeout(() => {
                  const { spawn } = require('child_process');
                  const bot = spawn('node', ['bot.js'], {
                    stdio: 'inherit',
                    env: { ...process.env, FORCE_COLOR: '1' }
                  });
                  
                  bot.on('error', (err) => {
                    console.error(chalk.red(`Erro ao iniciar bot: ${err.message}`));
                    process.exit(1);
                  });
                  
                  bot.on('exit', (code) => {
                    console.log(chalk.yellow(`\nBot finalizado com código: ${code}`));
                    process.exit(code);
                  });
                  
                  // Capture Ctrl+C para avisar
                  process.on('SIGINT', () => {
                    console.log(chalk.yellow('\n\n⚠️  Parando bot... (ordens ativas não serão canceladas automaticamente)\n'));
                    setTimeout(() => process.exit(0), 1000);
                  });
                }, 500);
              });
            };
            
            question3();
          });
        };
        
        question2();
      });
    };
    
    question1();
  });
}

main().catch(err => {
  console.error(chalk.red('Erro:'), err);
  process.exit(1);
});
