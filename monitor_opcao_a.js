#!/usr/bin/env node
/**
 * monitor_opcao_a.js
 * Monitora execução da OPÇÃO A em tempo real
 * Mostra: Ordens abertas, capital liberado, ciclos executados
 */

require('dotenv').config();
const MB = require('./mb_client');
const db = require('./db');
const chalk = require('chalk');

const log = (msg, color = 'cyan') => {
  const ts = new Date().toLocaleTimeString('pt-BR');
  console.log(chalk[color](`[${ts}] ${msg}`));
};

const displayStatus = async () => {
  try {
    await MB.authenticate();
    
    const orders = await MB.getOpenOrders();
    const balances = await MB.getBalances();
    const stats = await db.getStats({hours: 24});
    
    console.clear();
    
    console.log(chalk.bold.cyan(`
╔════════════════════════════════════════════════════════════════╗
║           🟢 OPÇÃO A - MONITORAMENTO EM TEMPO REAL            ║
║       Bot Gerenciando 100 Ordens Automaticamente               ║
╚════════════════════════════════════════════════════════════════╝
    `));
    
    // Status das Ordens
    console.log(chalk.bold.yellow('📊 ORDENS ABERTAS:'));
    console.log(`   Total:     ${orders.length}/100`);
    console.log(`   Restantes: ${100 - orders.length} (sendo canceladas)`);
    console.log(`   Taxa de Cancelamento: ${(((100 - orders.length) / 100) * 100).toFixed(1)}%`);
    
    // Capital
    console.log(chalk.bold.yellow('\n💰 CAPITAL:'));
    const btcAvailable = parseFloat(balances.available_btc) || 0;
    const brlAvailable = parseFloat(balances.available_brl) || 0;
    const btcBlocked = (parseFloat(balances.btc) || 0) - btcAvailable;
    
    console.log(`   BTC Disponível:  ${btcAvailable.toFixed(8)} BTC (~R$ ${(btcAvailable * 490315).toFixed(2)})`);
    console.log(`   BTC Bloqueado:   ${btcBlocked.toFixed(8)} BTC (~R$ ${(btcBlocked * 490315).toFixed(2)})`);
    console.log(`   BRL Disponível:  R$ ${parseFloat(brlAvailable).toFixed(2)}`);
    console.log(`   Total Estimado:  R$ ${((parseFloat(balances.btc) || 0) * 490315 + parseFloat(brlAvailable)).toFixed(2)}`);
    
    // Ciclos e Performance
    console.log(chalk.bold.yellow('\n⚙️  PERFORMANCE:'));
    console.log(`   Ciclos Executados: ${stats.cycles || 0}`);
    console.log(`   Ordens Criadas:    ${stats.total_orders || 0}`);
    console.log(`   Preenchidas:       ${stats.filled_orders || 0}`);
    console.log(`   Canceladas:        ${stats.cancelled_orders || 0}`);
    console.log(`   PnL Total:         R$ ${stats.total_pnl || 0}`);
    console.log(`   Fill Rate:         ${stats.fill_rate || '0'}%`);
    
    // Timeline
    console.log(chalk.bold.yellow('\n⏱️  TIMELINE ESPERADO:'));
    const minutos = Math.floor(orders.length / 33.33);
    console.log(`   Ordens restantes: ~${minutos} minuto(s) até liberar capital`);
    console.log(`   MAX_ORDER_AGE:    120 segundos (4 ciclos de 30s)`);
    console.log(`   Próxima verificação: em 30 segundos`);
    
    console.log(chalk.bold.cyan('\n📱 Dashboard: http://localhost:3001'));
    console.log(chalk.bold.cyan('⏸️  Pressione Ctrl+C para parar monitoramento'));
    console.log(chalk.gray('\nAtualizando em 30 segundos...\n'));
    
  } catch (error) {
    log(`❌ Erro: ${error.message}`, 'red');
  }
};

// Executar continuamente
(async () => {
  log('🟢 Iniciando monitoramento OPÇÃO A...', 'green');
  await displayStatus();
  
  // Atualizar a cada 30 segundos
  setInterval(async () => {
    await displayStatus();
  }, 30000);
})();
