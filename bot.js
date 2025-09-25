#!/usr/bin/env node
// bot.js - Market Making Bot v1.1.0 - Robust Version

require('dotenv').config();
const axios = require('axios');
const MB = require('./mb_client');
const db = require('./db');

// -------------------- CONFIG --------------------
const SIMULATE = process.env.SIMULATE === 'true';
const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4';
const PAIR = process.env.PAIR || 'BTC-BRL';
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.002');
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.0001');
const CYCLE_SEC = Math.max(1, parseInt(process.env.CYCLE_SEC || '5'));
const PRICE_TOLERANCE = parseFloat(process.env.PRICE_TOLERANCE || '0.001');

// Validate critical config
if (!REST_BASE.startsWith('http')) {
  console.error('❌ FATAL: REST_BASE invalid');
  process.exit(1);
}

// -------------------- LOGGING --------------------
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  const prefix = `[${level}]`.padEnd(8);
  const logLine = `${timestamp} ${prefix} ${message}`;
  console.log(logLine, data ? `| ${JSON.stringify(data).slice(0, 80)}${JSON.stringify(data).length > 80 ? '...' : ''}` : '');
};

// Safe stats log
const safeStatsLog = (label, statsObj) => {
  if (!statsObj) {
    log('WARN', `${label}: stats not initialized`);
    return;
  }
  log('INFO', label, statsObj);
};

// -------------------- GLOBAL STATE --------------------
let cycleCount = 0;
let activeOrders = new Map();
let totalFills = 0;
let totalPnL = 0.0;
let lastObUpdate = 0;
const OB_REFRESH_SEC = 30;
const startTime = Date.now();

let stats = {
  cycles: 0,
  totalOrders: 0,
  filledOrders: 0,
  cancels: 0,
  totalPnL: 0.0,
  avgFillPrice: 0.0,
  fillRate: '0.0%',
  avgSpread: SPREAD_PCT * 100,
  uptime: '0min'
};

// -------------------- HELPER FUNCTIONS --------------------
const saveOrderSafe = async (order, note) => {
  try {
    await db.saveOrder({ ...order, note, timestamp: Math.floor(Date.now()/1000) });
  } catch (e) {
    log('WARN', `Failed to save order ${order.id}:`, e.message);
  }
};

const generateSyntheticOrderbook = () => {
  const mid = 300000 + Math.sin(cycleCount * 0.1) * 1000;
  const spread = mid * SPREAD_PCT;
  return {
    bids: [
      [(mid - spread * 0.8).toFixed(2), (ORDER_SIZE*2).toFixed(8)],
      [(mid - spread * 1.2).toFixed(2), (ORDER_SIZE*3).toFixed(8)],
      [(mid - spread * 1.8).toFixed(2), (ORDER_SIZE*1.5).toFixed(8)]
    ],
    asks: [
      [(mid + spread * 0.8).toFixed(2), (ORDER_SIZE*2).toFixed(8)],
      [(mid + spread * 1.2).toFixed(2), (ORDER_SIZE*3).toFixed(8)],
      [(mid + spread * 1.8).toFixed(2), (ORDER_SIZE*1.5).toFixed(8)]
    ]
  };
};

// -------------------- ORDERBOOK --------------------
async function fetchOrderbookRest() {
  try {
    const url = `${REST_BASE}/${PAIR}/orderbook?limit=10`;
    log('DEBUG', `Fetching orderbook from: ${url}`);
    const response = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'MB-Bot/1.0.0' }});
    const data = response.data;

    const orderbook = {
      bids: Array.isArray(data.bids) ? data.bids.slice(0,10) : [],
      asks: Array.isArray(data.asks) ? data.asks.slice(0,10) : []
    };

    if (orderbook.bids.length && orderbook.asks.length) {
      lastObUpdate = Date.now();
      log('INFO', `Orderbook refreshed: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
      return orderbook;
    } else throw new Error('Empty orderbook');
  } catch (e) {
    log('WARN', `[ORDERBOOK] Fetch failed: ${e.message}`);
    if (SIMULATE) {
      const ob = generateSyntheticOrderbook();
      lastObUpdate = Date.now();
      log('INFO', `[SIMULATE] Synthetic orderbook generated`);
      return ob;
    }
    return null;
  }
}

// -------------------- ORDERS --------------------
async function tryCancel(orderKey) {
  const order = activeOrders.get(orderKey);
  if (!order) return;

  try {
    log('INFO', `Cancelling ${order.side} order ${order.id.substring(0,8)} @ R$${order.price.toFixed(0)}`);
    if (SIMULATE) {
      await saveOrderSafe({ ...order, status:'cancelled' }, 'simulated_cancel');
    } else {
      const result = await MB.cancelOrder(order.id);
      await saveOrderSafe({ ...order, status: result.status || 'cancelled' }, 'live_cancel');
    }
    activeOrders.delete(orderKey);
  } catch (e) {
    log('WARN', `Cancel error ${order.id}:`, e.message);
    activeOrders.delete(orderKey);
  }
}

async function checkOrderStatus(orderKey, side) {
  const order = activeOrders.get(orderKey);
  if (!order) return { status:'unknown', filledQty:0 };

  if (SIMULATE) {
    const fillChance = 0.08 + Math.random()*0.07;
    if (Math.random() < fillChance) {
      const slippage = (Math.random()-0.5)*0.002;
      const fillPrice = order.price*(1+slippage);
      totalPnL += side==='sell'? fillPrice*ORDER_SIZE : -fillPrice*ORDER_SIZE;
      totalFills++;
      await saveOrderSafe({ ...order, status:'filled', filledQty:ORDER_SIZE }, `simulated_fill ${slippage.toFixed(3)}`);
      activeOrders.delete(orderKey);
      return { status:'filled', filledQty:ORDER_SIZE };
    }
    return { status:'working', filledQty:0 };
  }

  try {
    const status = await MB.getOrderStatus(order.id);
    if (status.status==='filled') {
      const pnl = status.side==='sell'? status.avgPrice*status.filledQty : -status.avgPrice*status.filledQty;
      totalPnL += pnl;
      totalFills++;
      await saveOrderSafe({ ...order, status:'filled', filledQty:status.filledQty, avgPrice:status.avgPrice }, 'live_fill');
      activeOrders.delete(orderKey);
      return { status:'filled', filledQty:status.filledQty };
    }
    return { status:status.status, filledQty:status.filledQty||0 };
  } catch(e) {
    log('WARN', `Status check failed ${order.id}:`, e.message);
    return { status:'error', filledQty:0 };
  }
}

// -------------------- CYCLE --------------------
async function runCycle() {
  cycleCount++;
  stats.cycles = cycleCount;

  // Fetch orderbook
  const obAge = (Date.now() - lastObUpdate)/1000;
  let orderbook = obAge>OB_REFRESH_SEC || lastObUpdate===0 ? await fetchOrderbookRest() : null;
  if (!orderbook) {
    log('WARN', `Cycle ${cycleCount} skipped - no orderbook`);
    return;
  }

  const bestBid = parseFloat(orderbook.bids[0][0]);
  const bestAsk = parseFloat(orderbook.asks[0][0]);
  if (isNaN(bestBid) || isNaN(bestAsk) || bestBid>=bestAsk) return;

  const mid = (bestBid+bestAsk)/2;
  const buyPrice = Math.floor(mid*(1-SPREAD_PCT/2)*100)/100;
  const sellPrice = Math.ceil(mid*(1+SPREAD_PCT/2)*100)/100;

  // Check fills
  const buyStatus = activeOrders.has('buy') ? await checkOrderStatus('buy','buy') : {status:'none'};
  const sellStatus = activeOrders.has('sell') ? await checkOrderStatus('sell','sell') : {status:'none'};

  // Cancel stale
  if (activeOrders.has('buy') && Math.abs((activeOrders.get('buy').price-buyPrice)/buyPrice)>PRICE_TOLERANCE) await tryCancel('buy');
  if (activeOrders.has('sell') && Math.abs((activeOrders.get('sell').price-sellPrice)/sellPrice)>PRICE_TOLERANCE) await tryCancel('sell');

  // Place new orders
  if (!activeOrders.has('buy') && buyStatus.status!=='filled') {
    try {
      const order = await MB.placeOrder('buy', buyPrice, ORDER_SIZE);
      const orderId = order.id || `buy_${Date.now()}`;
      const newOrder = { id:orderId, side:'buy', price:buyPrice, qty:ORDER_SIZE, timestamp:Date.now() };
      activeOrders.set('buy', newOrder);
      await saveOrderSafe({ id:orderId, side:'buy', price:buyPrice, qty:ORDER_SIZE, status:'working' }, 'market_making_buy');
    } catch(e){ log('ERROR','Buy placement failed',e.message); }
  }

  if (!activeOrders.has('sell') && sellStatus.status!=='filled') {
    try {
      const order = await MB.placeOrder('sell', sellPrice, ORDER_SIZE);
      const orderId = order.id || `sell_${Date.now()}`;
      const newOrder = { id:orderId, side:'sell', price:sellPrice, qty:ORDER_SIZE, timestamp:Date.now() };
      activeOrders.set('sell', newOrder);
      await saveOrderSafe({ id:orderId, side:'sell', price:sellPrice, qty:ORDER_SIZE, status:'working' }, 'market_making_sell');
    } catch(e){ log('ERROR','Sell placement failed',e.message); }
  }

  // Update stats
  stats.totalOrders = activeOrders.size + stats.filledOrders;
  stats.filledOrders = totalFills;
  stats.totalPnL = totalPnL;
  stats.fillRate = ((totalFills/(cycleCount||1))*100).toFixed(1)+'%';
  stats.uptime = `${Math.round((Date.now()-startTime)/60000)}min`;
  stats.avgSpread = SPREAD_PCT*100;

  safeStatsLog(`Cycle ${cycleCount} summary`, stats);
}

// -------------------- MAIN --------------------
async function main() {
  try {
    log('INFO','Initializing DB...');
    await db.init();
    log('SUCCESS','DB initialized');

    log('INFO','Fetching initial orderbook...');
    await fetchOrderbookRest();

    log('INFO', `Starting main loop - cycle every ${CYCLE_SEC}s`);
    await runCycle();
    setInterval(runCycle, CYCLE_SEC*1000);

    log('SUCCESS','Bot operational - SIMULATE='+SIMULATE);
  } catch(e){
    log('ERROR','Fatal initialization error:',e.message);
    process.exit(1);
  }
}

// -------------------- GRACEFUL SHUTDOWN --------------------
process.on('SIGINT', async () => {
  log('WARN','SIGINT received - shutting down...');
  for (let key of activeOrders.keys()) await tryCancel(key);
  await db.close();
  log('SUCCESS','Shutdown complete');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  log('ERROR','Uncaught exception:',error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR','Unhandled promise rejection:',reason);
});

main();