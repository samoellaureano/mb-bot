#!/usr/bin/env node

const http = require('http');

let lastPnL = null;
let cycleCount = 0;
let startTime = Date.now();

function fetchData(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getTrendColor(trend) {
  if (trend === 'up') return '\x1b[32m↑ UP\x1b[0m';
  if (trend === 'down') return '\x1b[31m↓ DOWN\x1b[0m';
  return '\x1b[33m↔ NEUTRAL\x1b[0m';
}

function getPnLColor(pnl) {
  if (pnl > 0) return `\x1b[32m+${pnl.toFixed(2)}\x1b[0m`;
  return `\x1b[31m${pnl.toFixed(2)}\x1b[0m`;
}

async function monitor() {
  console.clear();
  
  while (true) {
    try {
      cycleCount++;
      const elapsed = Date.now() - startTime;
      const now = new Date();
      
      const [marketData, momentumData] = await Promise.all([
        fetchData('http://localhost:3001/api/data'),
        fetchData('http://localhost:3001/api/momentum')
      ]);

      console.clear();
      
      console.log('\n🤖 MONITORAMENTO DE CICLOS - MB BOT LIVE\n');
      console.log('═'.repeat(110));
      console.log(`\n⏱️  TEMPO: ${now.toLocaleTimeString('pt-BR')} | Uptime: ${formatTime(elapsed)} | Ciclos: ${cycleCount}`);
      console.log('\n' + '─'.repeat(110));
      
      // Mercado
      console.log('\n📊 DADOS DE MERCADO:');
      const bid = Number(marketData.market?.bid || 0);
      const ask = Number(marketData.market?.ask || 0);
      const spread = ask - bid;
      const mid = (bid + ask) / 2;
      console.log(`   💹 Mid: ${mid.toFixed(2)} BRL | Bid: ${bid.toFixed(2)} | Ask: ${ask.toFixed(2)}`);
      console.log(`   📏 Spread: ${spread.toFixed(2)} BRL (${(spread / mid * 100).toFixed(3)}%)`);
      
      // Indicadores
      console.log(`\n📈 INDICADORES:`);
      const rsi = Number(marketData.indicators?.rsi || 0);
      const vol = Number(marketData.indicators?.volatility || 0);
      const conf = Number(marketData.indicators?.confidence || 0);
      console.log(`   RSI: ${rsi.toFixed(2)} | Vol: ${vol.toFixed(2)}% | Conf: ${(conf * 100).toFixed(1)}%`);
      console.log(`   Bot Trend: ${getTrendColor(marketData.indicators?.trend)} | External: ${marketData.externalTrend?.trend} (${marketData.externalTrend?.score}/100)`);
      
      // Posição
      console.log(`\n💰 POSIÇÃO E PERFORMANCE:`);
      const btcPos = Number(marketData.balances?.btc || 0);
      const brlBal = Number(marketData.balances?.brl || 0);
      console.log(`   Position: ${btcPos.toFixed(8)} BTC | Balance: ${brlBal.toFixed(2)} BRL`);
      const pnlTotal = Number(marketData.stats?.pnl_total || 0);
      const pnlChange = lastPnL !== null ? pnlTotal - lastPnL : 0;
      const pnlChangeStr = pnlChange !== 0 ? ` ${pnlChange > 0 ? '✅' : '❌'} (${pnlChange > 0 ? '+' : ''}${pnlChange.toFixed(4)})` : '';
      const roi = Number(marketData.stats?.roi || 0);
      const pnlReal = Number(marketData.stats?.pnl_realized || 0);
      console.log(`   PnL: ${getPnLColor(pnlTotal)}${pnlChangeStr} | ROI: ${roi.toFixed(2)}% | Real: ${pnlReal.toFixed(2)}`);
      lastPnL = pnlTotal;
      
      // Ordens
      const numOrders = marketData.activeOrders?.length || 0;
      const fills = marketData.stats?.fills || 0;
      const cancs = marketData.stats?.cancels || 0;
      const fillRate = marketData.stats?.fillRate || '0%';
      console.log(`\n📋 ORDENS ATIVAS: ${numOrders} | Fills: ${fills} | Canc: ${cancs} | Taxa: ${fillRate}`);
      
      if (marketData.activeOrders && marketData.activeOrders.length > 0) {
        const lastOrders = marketData.activeOrders.slice(-3);
        lastOrders.forEach((order, idx) => {
          const side = order.side === 'buy' ? '📈' : '📉';
          const status = order.status === 'open' ? '🔵' : order.status === 'filled' ? '✅' : '❌';
          const age = order.ageSecMinHour?.ageMin ? `${order.ageSecMinHour.ageMin}m` : 'new';
          const price = Number(order.price || 0).toFixed(0);
          const qty = Number(order.qty || 0).toFixed(8);
          console.log(`   ${idx+1}. ${side} ${order.side.toUpperCase()} @ ${price} | ${qty} BTC | ${status} ${age}`);
        });
      }
      
      // Momentum
      const momTotal = momentumData.simulatedOrders?.length || 0;
      const momSim = momentumData.status?.simulated || 0;
      const momPend = momentumData.status?.pending || 0;
      const momConf = momentumData.status?.confirmed || 0;
      const momRej = momentumData.status?.rejected || 0;
      console.log(`\n🎯 MOMENTUM: ${momTotal} | Sim: ${momSim} | Pend: ${momPend} | Conf: ${momConf} | Rej: ${momRej}`);
      
      if (momentumData.simulatedOrders && momentumData.simulatedOrders.length > 0) {
        const lastMomentum = momentumData.simulatedOrders.slice(-2);
        lastMomentum.forEach((order, idx) => {
          const type = order.side === 'BUY' ? '📈' : '📉';
          const statusIcon = order.status === 'confirmed' ? '✅' : order.status === 'pending' ? '⏳' : '🔄';
          const price = Number(order.created_price || 0).toFixed(0);
          const rev = Number(order.confirmation_reversals || 0);
          console.log(`   ${idx+1}. ${type} ${order.side} @ ${price} | Rev: ${rev} | ${statusIcon} ${order.status}`);
        });
      }
      
      const spread_pct = Number(marketData.config?.spreadPct || 0) * 100;
      const orderSize = Number(marketData.config?.orderSize || 0).toFixed(8);
      const cycleSec = marketData.config?.cycleSec || 30;
      console.log(`\n⚙️  CONFIG: Spread ${spread_pct.toFixed(2)}% | Size ${orderSize} BTC | Ciclo ${cycleSec}s`);
      console.log('\n' + '═'.repeat(110));
      console.log(`\n⏳ Próxima atualização em 5s... (Ctrl+C para parar)\n`);
      
      await new Promise(r => setTimeout(r, 5000));
      
    } catch (error) {
      console.error('\n❌ Erro:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Monitoramento finalizado.');
  console.log(`📊 Total de ciclos: ${cycleCount} | Uptime: ${formatTime(Date.now() - startTime)}`);
  process.exit(0);
});

monitor().catch(console.error);
