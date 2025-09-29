#!/usr/bin/env node
// bot.js - Market Making Bot v1.2.0 - PnL com custo médio + cancels inteligentes

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
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '5'); // em ciclos

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
let btcPosition = 0;   // posição líquida em BTC
let totalCost = 0;     // custo acumulado em BRL
let lastObUpdate = 0;
const OB_REFRESH_SEC = 10;
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
    await db.saveOrder({ ...order, note, timestamp: Math.floor(Date.now() / 1000) });
  } catch (e) {
    log('WARN', `Failed to save order ${order.id}:`, e.message);
  }
};

const generateSyntheticOrderbook = () => {
  const mid = 300000 + Math.sin(cycleCount * 0.1) * 1000;
  const spread = mid * SPREAD_PCT;
  return {
    bids: [
      [(mid - spread * 0.8).toFixed(2), (ORDER_SIZE * 2).toFixed(8)],
      [(mid - spread * 1.2).toFixed(2), (ORDER_SIZE * 3).toFixed(8)],
      [(mid - spread * 1.8).toFixed(2), (ORDER_SIZE * 1.5).toFixed(8)]
    ],
    asks: [
      [(mid + spread * 0.8).toFixed(2), (ORDER_SIZE * 2).toFixed(8)],
      [(mid + spread * 1.2).toFixed(2), (ORDER_SIZE * 3).toFixed(8)],
      [(mid + spread * 1.8).toFixed(2), (ORDER_SIZE * 1.5).toFixed(8)]
    ]
  };
};

// -------------------- ORDERBOOK --------------------
async function fetchOrderbookRest() {
  try {
    const url = `${REST_BASE}/${PAIR}/orderbook?limit=10`;
    log('DEBUG', `Fetching orderbook from: ${url}`);
    const response = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'MB-Bot/1.0.0' } });
    const data = response.data;

    const orderbook = {
      bids: Array.isArray(data.bids) ? data.bids.slice(0, 10) : [],
      asks: Array.isArray(data.asks) ? data.asks.slice(0, 10) : []
    };

    if (orderbook.bids.length && orderbook.asks.length) {
      lastObUpdate = Date.now();
      log('INFO', `📊 Orderbook refreshed: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
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
    log('INFO', `❌ Cancelling ${order.side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${order.price.toFixed(0)}`);
    if (SIMULATE) {
      await saveOrderSafe({ ...order, status: 'cancelled' }, 'simulated_cancel');
    } else {
      const result = await MB.cancelOrder(order.id);
      await saveOrderSafe({ ...order, status: result.status || 'cancelled' }, 'live_cancel');
    }
    stats.cancels++;
    activeOrders.delete(orderKey);
    log('SUCCESS', `✅ Cancelled ${order.side.toUpperCase()} order ${order.id.substring(0, 8)} successfully`);
  } catch (e) {
    log('WARN', `⚠️ Cancel error ${order.id}: ${e.message}`);
    activeOrders.delete(orderKey);
  }
}

async function checkOrderStatus(orderKey, side) {
  const order = activeOrders.get(orderKey);
  if (!order) return { status: 'unknown', filledQty: 0 };

  if (SIMULATE) {
    const fillChance = 0.08 + Math.random() * 0.07;
    if (Math.random() < fillChance) {
      const slippage = (Math.random() - 0.5) * 0.002;
      const fillPrice = order.price * (1 + slippage);
      const qty = ORDER_SIZE;

      if (side === 'buy') {
        btcPosition += qty;
        totalCost += qty * fillPrice;
      } else if (side === 'sell') {
        const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
        const pnl = (fillPrice - avgPrice) * qty;
        totalPnL += pnl;
        btcPosition -= qty;
        totalCost -= avgPrice * qty;
        if (btcPosition < 0) btcPosition = 0;
        if (totalCost < 0) totalCost = 0;
      }

      totalFills++;
      await saveOrderSafe({ ...order, status: 'filled', filledQty: qty }, `simulated_fill ${slippage.toFixed(3)}`);
      activeOrders.delete(orderKey);
      return { status: 'filled', filledQty: qty };
    }
    return { status: 'working', filledQty: 0 };
  }

  try {
    const status = await MB.getOrderStatus(order.id);
    if (status.status === 'filled') {
      const qty = parseFloat(status.filledQty);
      const price = parseFloat(status.avgPrice || order.price);

      if (status.side === 'buy') {
        btcPosition += qty;
        totalCost += qty * price;
      } else if (status.side === 'sell') {
        const avgPrice = btcPosition > 0 ? totalCost / btcPosition : 0;
        const pnl = (price - avgPrice) * qty;
        totalPnL += pnl;
        btcPosition -= qty;
        totalCost -= avgPrice * qty;
        if (btcPosition < 0) btcPosition = 0;
        if (totalCost < 0) totalCost = 0;
      }

      totalFills++;
      await saveOrderSafe({ ...order, status: 'filled', filledQty: qty, avgPrice: price }, 'live_fill');
      activeOrders.delete(orderKey);
      return { status: 'filled', filledQty: qty };
    }
    return { status: status.status, filledQty: status.filledQty || 0 };
  } catch (e) {
    log('WARN', `Status check failed ${order.id}:`, e.message);
    return { status: 'error', filledQty: 0 };
  }
}

// -------------------- CYCLE --------------------
async function runCycle() {
  try {
    cycleCount++;
    stats.cycles = cycleCount;
    log('DEBUG', `⏳ Starting cycle ${cycleCount}`);

    const obAge = (Date.now() - lastObUpdate) / 1000;
    let orderbook = obAge > OB_REFRESH_SEC || lastObUpdate === 0 ? await fetchOrderbookRest() : null;
    if (!orderbook) {
      log('WARN', `⏭️ Cycle ${cycleCount} skipped - no orderbook`);
      return;
    }
    log('INFO', `📊 Orderbook updated - Best Bid: ${orderbook.bids[0][0]}, Best Ask: ${orderbook.asks[0][0]}`);

    const bestBid = parseFloat(orderbook.bids[0][0]);
    const bestAsk = parseFloat(orderbook.asks[0][0]);
    if (isNaN(bestBid) || isNaN(bestAsk) || bestBid >= bestAsk) {
      log('WARN', `⚠️ Invalid orderbook data - Best Bid: ${bestBid}, Best Ask: ${bestAsk}`);
      return;
    }

    const mid = (bestBid + bestAsk) / 2;
    const volatility = ((bestAsk - bestBid) / mid) * 100;
    let dynamicSpreadPct = SPREAD_PCT;
    if (volatility >= 0.7) dynamicSpreadPct = Math.min(0.008, parseFloat(process.env.MAX_SPREAD_PCT || 0.01));
    else if (volatility >= 0.3) dynamicSpreadPct = 0.006;

    const buyPrice = Math.floor(orderbook.bids[0][0] * (1 + dynamicSpreadPct) * 100) / 100;
    const sellPrice = Math.ceil(orderbook.asks[0][0] * (1 + dynamicSpreadPct) * 100) / 100;

    log('INFO', `📈 Cycle ${cycleCount}: Volatility ${volatility.toFixed(2)}%, Spread ${dynamicSpreadPct * 100}%, Buy: ${buyPrice}, Sell: ${sellPrice}`);

    // Verificar status das ordens ativas
    for (let key of ['buy', 'sell']) {
      if (activeOrders.has(key)) {
        log('DEBUG', `🔍 Checking status for ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)}`);
        const statusResult = await checkOrderStatus(key, key);
        log('DEBUG', `📋 Status for ${key.toUpperCase()}: ${statusResult.status}, Filled Qty: ${statusResult.filledQty || 0}`);
        if (statusResult.status === 'filled' || statusResult.status === 'error') {
          log('INFO', `✅ ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)} completed (Status: ${statusResult.status})`);
          activeOrders.delete(key);
        }
      }
    }

    // Cancelamento inteligente
    for (let key of ['buy', 'sell']) {
      log('DEBUG', `⚠️ Checking ${key.toUpperCase()} order for cancellation...`);
      log('DEBUG', `⚠️ Active Orders: ${JSON.stringify(Array.from(activeOrders.entries()))}`);

      if (!activeOrders.has(key)) {
        log('DEBUG', `⏳ No ${key.toUpperCase()} order to cancel`);
        continue;
      }

      const order = activeOrders.get(key);
      const targetPrice = key === 'buy' ? buyPrice : sellPrice;
      const priceDrift = Math.abs((order.price - targetPrice) / targetPrice);
      const age = cycleCount - (order.cyclePlaced || cycleCount);

      log('DEBUG', `📊 ${key.toUpperCase()} order - ID: ${order.id.substring(0, 8)}, Price: ${order.price}, Target: ${targetPrice}, Drift: ${(priceDrift * 100).toFixed(2)}%, Age: ${age} cycles`);

      if (priceDrift > PRICE_TOLERANCE || age >= MAX_ORDER_AGE) {
        log('INFO', `❌ Cancelling ${key.toUpperCase()} - drift=${(priceDrift * 100).toFixed(2)}% age=${age} cycles`);
        await tryCancel(key);
      } else {
        log('INFO', `✅ Order ${key.toUpperCase()} OK - drift=${(priceDrift * 100).toFixed(2)}% age=${age} cycles`);
      }
    }

    // Place new orders
    let buyStatus = activeOrders.has('buy') ? await checkOrderStatus('buy', 'buy') : { status: 'unknown' };
    let sellStatus = activeOrders.has('sell') ? await checkOrderStatus('sell', 'sell') : { status: 'unknown' };

    // Verificar saldo
    let balances;
    try {
      balances = await MB.getBalances(); // Corrigido para getBalances
      log('DEBUG', `💰 Fetched balances successfully - BRL: ${balances.find(b => b.symbol === 'BRL')?.available || 'N/A'}, BTC: ${balances.find(b => b.symbol === 'BTC')?.available || 'N/A'}`);
    } catch (e) {
      log('ERROR', `❌ Failed to fetch account balance: ${e.message} - Check API_KEY and API_SECRET in .env`);
      balances = [{ symbol: 'BRL', available: '0' }, { symbol: 'BTC', available: '0' }]; // Fallback seguro
    }
    const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
    const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);
    const buyCost = buyPrice * ORDER_SIZE * 1.003; // Inclui taxa estimada de 0.3%
    log('DEBUG', `💸 Estimated fee: ${(buyCost - buyPrice * ORDER_SIZE).toFixed(2)} for BUY order`);
    const sellAmount = ORDER_SIZE;
    log('DEBUG', `💰 Checking balances - BRL: ${brlBalance.toFixed(2)}, BTC: ${btcBalance.toFixed(8)}, Buy Cost: ${buyCost.toFixed(2)}, Sell Amount: ${sellAmount}`);

    if (!activeOrders.has('buy') && buyStatus.status !== 'filled' && brlBalance >= buyCost) {
      try {
        const order = await MB.placeOrder('buy', buyPrice, ORDER_SIZE);
        const orderId = order.orderId || `buy_${Date.now()}`;
        const newOrder = { id: orderId, side: 'buy', price: buyPrice, qty: ORDER_SIZE, status: 'working', cyclePlaced: cycleCount, timestamp: Date.now() };
        activeOrders.set('buy', newOrder);
        log('INFO', `✅ Placed BUY order ${orderId.substring(0, 8)} @ R$${buyPrice.toFixed(0)} (Cost: ${buyCost.toFixed(2)}, Balance: ${brlBalance.toFixed(2)})`);
        await saveOrderSafe(newOrder, 'market_making_buy');
      } catch (e) { log('ERROR', `❌ Buy placement failed | ${e.message}`); }
    } else if (!activeOrders.has('buy')) {
      log('WARN', `💰 Insufficient BRL balance (${brlBalance.toFixed(2)}) for buy order, required: ${buyCost.toFixed(2)}`);
    }

    if (!activeOrders.has('sell') && sellStatus.status !== 'filled' && btcBalance >= sellAmount) {
      try {
        const order = await MB.placeOrder('sell', sellPrice, ORDER_SIZE);
        const orderId = order.orderId || `sell_${Date.now()}`;
        const newOrder = { id: orderId, side: 'sell', price: sellPrice, qty: ORDER_SIZE, status: 'working', cyclePlaced: cycleCount, timestamp: Date.now() };
        activeOrders.set('sell', newOrder);
        log('INFO', `✅ Placed SELL order ${orderId.substring(0, 8)} @ R$${sellPrice.toFixed(0)} (Balance: ${btcBalance.toFixed(8)})`);
        await saveOrderSafe(newOrder, 'market_making_sell');
      } catch (e) { log('ERROR', `❌ Sell placement failed | ${e.message}`); }
    } else if (!activeOrders.has('sell')) {
      log('WARN', `💰 Insufficient BTC balance (${btcBalance.toFixed(8)}) for sell order, required: ${sellAmount}`);
    }

    // Update stats
    stats.totalOrders = activeOrders.size + stats.filledOrders;
    stats.filledOrders = totalFills;
    stats.totalPnL = parseFloat(totalPnL.toFixed(2));
    stats.fillRate = ((totalFills / (cycleCount || 1)) * 100).toFixed(1) + '%';
    stats.uptime = `${Math.round((Date.now() - startTime) / 60000)}min`;
    stats.avgSpread = dynamicSpreadPct * 100;

    safeStatsLog(`📊 Cycle ${cycleCount} summary`, stats);
  } catch (e) {
    log('ERROR', `❌ Critical error in cycle ${cycleCount}: ${e.message}`);
  }
}

// -------------------- MAIN --------------------
async function main() {
  try {
    log('INFO', 'Initializing DB...');
    await db.init();
    log('SUCCESS', 'DB initialized');

    log('INFO', 'Authenticating with Mercado Bitcoin...');
    await MB.authenticate(); // Inicializa o token e accountId
    log('SUCCESS', 'Authentication completed');

    log('INFO', 'Fetching initial orderbook...');
    await fetchOrderbookRest();

    log('INFO', `Starting main loop - cycle every ${CYCLE_SEC}s`);
    await runCycle();
    setInterval(runCycle, CYCLE_SEC * 1000);

    log('SUCCESS', 'Bot operational - SIMULATE=' + SIMULATE);
  } catch (e) {
    log('ERROR', 'Fatal initialization error:', e.message);
    process.exit(1);
  }
}

// -------------------- GRACEFUL SHUTDOWN --------------------
process.on('SIGINT', async () => {
  log('WARN', 'SIGINT received - shutting down...');
  for (let key of activeOrders.keys()) await tryCancel(key);
  await db.close();
  log('SUCCESS', 'Shutdown complete');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled promise rejection:', reason);
});

main();