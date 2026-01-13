#!/usr/bin/env node
/**
 * Validador de dados - Compara API vs Dashboard vs Banco
 */

require('dotenv').config();
const mbClient = require('./mb_client');
const db = require('./db');
const chalk = require('chalk');

async function validateData() {
    console.log(chalk.blue('🔍 INICIANDO VALIDAÇÃO DE DADOS\n'));
    
    try {
        // 1. Inicializar conexões
        console.log(chalk.yellow('📦 Inicializando conexões...'));
        await db.init();
        
        if (!await mbClient.ensureAuthenticated()) {
            await mbClient.authenticate();
        }
        
        // 2. Obter dados da API
        console.log(chalk.yellow('🌐 Obtendo dados da API...'));
        const [ticker, balances, openOrders] = await Promise.all([
            mbClient.getTicker(),
            mbClient.getBalances(),
            mbClient.getOpenOrders()
        ]);
        
        const apiOrders = openOrders || [];
        
        // 3. Obter dados do banco
        console.log(chalk.yellow('💾 Obtendo dados do banco...'));
        const dbStats = await db.getStats({hours: 24});
        const dbOrders = await db.getOrders({limit: 50});
        const dbFilledOrders = await db.getOrders({limit: 50, status: 'filled'});
        
        // 4. Comparar dados
        console.log(chalk.green('\n📊 COMPARAÇÃO DE DADOS:\n'));
        
        // === PREÇOS ===
        console.log(chalk.cyan('💰 PREÇOS:'));
        console.log(`API Last Price: R$ ${parseFloat(ticker.last).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        
        // === SALDOS ===
        console.log(chalk.cyan('\n💳 SALDOS DA API:'));
        balances.forEach(balance => {
            const total = parseFloat(balance.total) || 0;
            const available = parseFloat(balance.available) || 0;
            const locked = total - available;
            
            console.log(`${balance.symbol}: 
  Total: ${balance.symbol === 'BRL' ? 'R$ ' + total.toFixed(2) : total.toFixed(8) + ' BTC'}
  Disponível: ${balance.symbol === 'BRL' ? 'R$ ' + available.toFixed(2) : available.toFixed(8) + ' BTC'}
  Bloqueado: ${balance.symbol === 'BRL' ? 'R$ ' + locked.toFixed(2) : locked.toFixed(8) + ' BTC'}`);
        });
        
        // === ORDENS ===
        console.log(chalk.cyan('\n📋 ORDENS:'));
        console.log(`API: ${apiOrders.length} ordens encontradas`);
        console.log(`Banco: ${dbOrders.length} ordens encontradas`);
        
        // Contar por status na API
        const apiOrdersStatus = apiOrders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});
        
        // Contar por status no banco
        const dbOrdersStatus = dbOrders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});
        
        console.log(`\nAPI Status:`, apiOrdersStatus);
        console.log(`Banco Status:`, dbOrdersStatus);
        
        // === PNL ===
        console.log(chalk.cyan('\n💸 PNL:'));
        console.log(`Banco PnL Total: R$ ${dbStats.total_pnl.toFixed(2)}`);
        console.log(`Ordens Preenchidas no Banco: ${dbStats.filled_orders}`);
        console.log(`Ordens Canceladas no Banco: ${dbStats.cancelled_orders}`);
        
        // Calcular PnL das ordens filled na API
        const apiFilledOrders = apiOrders.filter(o => o.status === 'filled');
        console.log(`Ordens Preenchidas na API: ${apiFilledOrders.length}`);
        
        // === ORDENS ATIVAS ===
        console.log(chalk.cyan('\n🔄 ORDENS ATIVAS:'));
        const apiActiveOrders = apiOrders.filter(o => o.status === 'working');
        const dbActiveOrders = dbOrders.filter(o => o.status === 'working' || o.status === 'open');
        
        console.log(`API Ordens Ativas: ${apiActiveOrders.length}`);
        console.log(`Banco Ordens Ativas: ${dbActiveOrders.length}`);
        
        if (apiActiveOrders.length > 0) {
            console.log('\nOrdens Ativas na API:');
            apiActiveOrders.slice(0, 5).forEach(order => {
                console.log(`- ${order.side} ${order.qty} BTC @ R$ ${parseFloat(order.limitPrice).toFixed(2)} (${order.id})`);
            });
        }
        
        if (dbActiveOrders.length > 0) {
            console.log('\nOrdens Ativas no Banco:');
            dbActiveOrders.slice(0, 5).forEach(order => {
                console.log(`- ${order.side} ${order.qty} BTC @ R$ ${parseFloat(order.price).toFixed(2)} (${order.id})`);
            });
        }
        
        // === INCONSISTÊNCIAS ===
        console.log(chalk.red('\n⚠️  VERIFICAÇÃO DE INCONSISTÊNCIAS:\n'));
        
        let inconsistencies = [];
        
        // Check 1: Número total de ordens
        if (Math.abs(apiOrders.length - dbOrders.length) > 5) {
            inconsistencies.push(`Diferença significativa no número de ordens: API=${apiOrders.length}, Banco=${dbOrders.length}`);
        }
        
        // Check 2: Ordens preenchidas
        if (apiFilledOrders.length !== dbStats.filled_orders) {
            inconsistencies.push(`Ordens preenchidas não batem: API=${apiFilledOrders.length}, Banco=${dbStats.filled_orders}`);
        }
        
        // Check 3: Ordens ativas
        if (Math.abs(apiActiveOrders.length - dbActiveOrders.length) > 2) {
            inconsistencies.push(`Ordens ativas divergem: API=${apiActiveOrders.length}, Banco=${dbActiveOrders.length}`);
        }
        
        if (inconsistencies.length === 0) {
            console.log(chalk.green('✅ Nenhuma inconsistência significativa encontrada!'));
        } else {
            inconsistencies.forEach(issue => {
                console.log(chalk.red('❌ ' + issue));
            });
        }
        
        // === RESUMO FINAL ===
        console.log(chalk.blue('\n📈 RESUMO FINAL:'));
        console.log(`Sistema em modo: ${process.env.SIMULATE === 'true' ? 'SIMULAÇÃO' : 'LIVE'}`);
        console.log(`Saldo BTC Total: ${balances.find(b => b.symbol === 'BTC')?.total || '0'} BTC`);
        console.log(`Saldo BRL Total: R$ ${parseFloat(balances.find(b => b.symbol === 'BRL')?.total || '0').toFixed(2)}`);
        console.log(`Preço Atual: R$ ${parseFloat(ticker.last).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        console.log(`PnL Total (Banco): R$ ${dbStats.total_pnl.toFixed(2)}`);
        console.log(`Taxa de Preenchimento: ${((dbStats.filled_orders / Math.max(dbStats.total_orders, 1)) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error(chalk.red('❌ Erro durante validação:'), error.message);
    }
}

// Executar validação
validateData().then(() => {
    console.log(chalk.green('\n✅ Validação concluída!'));
    process.exit(0);
}).catch(error => {
    console.error(chalk.red('❌ Erro fatal:'), error);
    process.exit(1);
});