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
const MAX_ORDER_AGE = parseInt(process.env.MAX_ORDER_AGE || '5');
const PRICE_DRIFT = parseFloat(process.env.PRICE_DRIFT_PCT || '0.0003');
const PRICE_DRIFT_BOOST = parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || '0.0');
const MIN_SPREAD_PCT = parseFloat(process.env.MIN_SPREAD_PCT || '0.001'); // Reduzido de 0.002


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
let lastOrderbook = { bids: [], asks: [] };
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

// -------------------- ORDERBOOK --------------------
async function fetchOrderbookRest() {
  try {
    const url = `${REST_BASE}/${PAIR}/orderbook?limit=10`;
    log('DEBUG', `Fetching orderbook from: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'MB-Bot/1.0.0' }
    });
    const data = response.data;

    const orderbook = {
      bids: Array.isArray(data.bids) ? data.bids.slice(0, 10) : [],
      asks: Array.isArray(data.asks) ? data.asks.slice(0, 10) : []
    };

    if (orderbook.bids.length && orderbook.asks.length) {
      lastObUpdate = Date.now();
      lastOrderbook = orderbook; // Atualiza o último orderbook válido
      log('INFO', `📊 Orderbook refreshed: Best Bid: ${orderbook.bids[0][0]}, Best Ask: ${orderbook.asks[0][0]}, Depth: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
      return orderbook;
    } else {
      throw new Error('Empty orderbook response');
    }
  } catch (e) {
    log('WARN', `Orderbook fetch failed, using last valid: ${e.message}, Last Update: ${new Date(lastObUpdate).toISOString()}`);
    if (!lastOrderbook.bids.length && !lastOrderbook.asks.length) {
      log('ERROR', 'No valid orderbook available, consider initializing or retrying');
    }
    return lastOrderbook;
  }
}

// -------------------- ORDERS --------------------
async function tryCancel(orderKey) {
  const order = activeOrders.get(orderKey);
  if (!order) return;

  try {
    log('INFO', `❌ Cancelling ${order.side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${order.price.toFixed(0)}, Qty: ${order.qty}`);
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
      await saveOrderSafe({ ...order, status: 'filled', filledQty: qty, fillPrice: fillPrice.toFixed(2) }, `simulated_fill ${slippage.toFixed(3)}`);
      activeOrders.delete(orderKey);
      log('INFO', `🎉 Filled ${side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${fillPrice.toFixed(0)}, Qty: ${qty}`);
      return { status: 'filled', filledQty: qty };
    }
    return { status: 'working', filledQty: 0 };
  }

  try {
    const status = await MB.getOrderStatus(order.id);
    log('DEBUG', `🔍 Order ${order.id.substring(0, 8)} status: ${status.status}, Filled Qty: ${status.filledQty || 0}`);
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
      log('INFO', `🎉 Filled ${status.side.toUpperCase()} order ${order.id.substring(0, 8)} @ R$${price.toFixed(0)}, Qty: ${qty}`);
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
    log('DEBUG', `⏳ Starting cycle ${cycleCount}, Time: ${new Date().toISOString()}`);

    const obAge = (Date.now() - lastObUpdate) / 1000;
    let orderbook = (obAge > OB_REFRESH_SEC || lastObUpdate === 0) ? await fetchOrderbookRest() : lastOrderbook;
    if (!orderbook.bids.length || !orderbook.asks.length) {
      log('WARN', `⏭️ Cycle ${cycleCount} skipped - no valid orderbook`);
      return;
    }

    // Calcular bestBid e bestAsk antes de usar
    const bestBid = parseFloat(orderbook.bids[0][0]);
    const bestAsk = parseFloat(orderbook.asks[0][0]);
    if (isNaN(bestBid) || isNaN(bestAsk) || bestBid >= bestAsk) {
      log('WARN', `⚠️ Invalid orderbook data - Best Bid: ${bestBid}, Best Ask: ${bestAsk}`);
      return;
    }

    log('INFO', `📊 Orderbook updated - Best Bid: ${bestBid}, Best Ask: ${bestAsk}, Mid: ${(bestBid + bestAsk) / 2}, Volume Bid: ${orderbook.bids[0][1]}, Volume Ask: ${orderbook.asks[0][1]}`);

    const mid = (bestBid + bestAsk) / 2;
    const volatility = ((bestAsk - bestBid) / mid) * 100;

    let dynamicSpreadPct = Math.max(0.0005, 0.0005 + volatility / 200); // Mínimo 0.05%, mais sensível a vol baixa
    if (volatility >= 0.5) dynamicSpreadPct = Math.min(0.005, parseFloat(process.env.MAX_SPREAD_PCT || 0.01)); // 0.5% no máximo

    log('DEBUG', `📉 Market Analysis - Volatility: ${volatility.toFixed(2)}%, Dynamic Spread: ${dynamicSpreadPct * 100}%, Mid Price: ${mid.toFixed(0)}`);

    let minSpreadPct = MIN_SPREAD_PCT * (volatility < 0.1 ? 0.5 : 1); // Reduz minSpread em baixa vol (metade se vol<0.1%)
    log('DEBUG', `Calculated minSpreadPct: ${minSpreadPct * 100}% (based on volatility ${volatility.toFixed(2)}% < 0.1? ${volatility < 0.1})`);

    const INVENTORY_THRESHOLD = 0.0002;
    const BIAS_FACTOR = 0.0005;
    let buyBias = 0;
    let sellBias = 0;
    log('DEBUG', `Checking inventory bias - btcPosition: ${btcPosition.toFixed(8)}, threshold: ${INVENTORY_THRESHOLD}`);
    if (btcPosition > INVENTORY_THRESHOLD) {
      buyBias = -BIAS_FACTOR; // lower buyPrice to afasta buy
      sellBias = -BIAS_FACTOR; // lower sellPrice to aperto sell
      log('DEBUG', `📉 Inventory high (${btcPosition.toFixed(8)} BTC) - Applying bias: Buy ${(buyBias * 100).toFixed(2)}%, Sell ${(sellBias * 100).toFixed(2)}%`);
    } else if (btcPosition < -INVENTORY_THRESHOLD) {
      buyBias = BIAS_FACTOR; // higher buyPrice to aperto buy
      sellBias = BIAS_FACTOR; // higher sellPrice to afasta sell
      log('DEBUG', `📉 Inventory low (${btcPosition.toFixed(8)} BTC) - Applying bias: Buy ${(buyBias * 100).toFixed(2)}%, Sell ${(sellBias * 100).toFixed(2)}%`);
    } else {
      log('DEBUG', `Inventory within threshold - No bias applied`);
    }

    let buyPrice = Math.floor(bestBid * (1 - dynamicSpreadPct - minSpreadPct + buyBias) * 100) / 100;
    let sellPrice = Math.ceil(bestAsk * (1 + dynamicSpreadPct + minSpreadPct + sellBias) * 100) / 100;

    if (buyPrice >= sellPrice) {
      log('WARN', `⚠️ Spread too tight - Buy Price: ${buyPrice}, Sell Price: ${sellPrice}, Adjusting to natural spread`);
      const naturalSpreadPct = ((bestAsk - bestBid) / mid) * 100 / 200; // Metade do spread natural
      dynamicSpreadPct = Math.max(dynamicSpreadPct, naturalSpreadPct);
      buyPrice = parseFloat((bestBid * (1 - dynamicSpreadPct)).toFixed(2));
      sellPrice = parseFloat((bestAsk * (1 + dynamicSpreadPct)).toFixed(2));
      log('DEBUG', `Adjusted dynamicSpreadPct to ${dynamicSpreadPct * 100}% (naturalSpreadPct: ${naturalSpreadPct * 100}%)`);
    }

    log('INFO', `📈 Cycle ${cycleCount}: Volatility ${volatility.toFixed(2)}%, Spread ${dynamicSpreadPct * 100}%, Buy: ${buyPrice}, Sell: ${sellPrice}`);

    // Verificar status das ordens ativas
    for (let key of ['buy', 'sell']) {
      if (activeOrders.has(key) && activeOrders.get(key)) {
        log('DEBUG', `🔍 Checking status for ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)}, Price: ${activeOrders.get(key).price}`);
        const statusResult = await checkOrderStatus(key, key);
        log('DEBUG', `📋 Status for ${key.toUpperCase()}: ${statusResult.status}, Filled Qty: ${statusResult.filledQty || 0}`);
        if (statusResult.status === 'filled' || statusResult.status === 'error') {
          log('INFO', `✅ ${key.toUpperCase()} order ${activeOrders.get(key).id.substring(0, 8)} completed (Status: ${statusResult.status})`);
          activeOrders.delete(key);
        }
      }
    }

    // Config extra
    const MIN_ORDER_CYCLES = 2; // mínimo de ciclos antes de ajustar ou cancelar
    const ADJUST_STEP = 0.0002; // percentual do ajuste gradual
    const MAX_ORDER_AGE = 10; // Aumentado para reduzir cancels
    const PRICE_TOLERANCE = 0.002; // Aumentado para mais tolerância

    // Cancelamento inteligente PROATIVO
    for (let key of ['buy', 'sell']) {
      log('DEBUG', `⚠️ Checking ${key.toUpperCase()} order for pro-active adjustment...`);

      if (!activeOrders.has(key)) {
        log('DEBUG', `⏳ No ${key.toUpperCase()} order to process`);
        continue;
      }

      const order = activeOrders.get(key);
      const targetPrice = key === 'buy' ? buyPrice : sellPrice;
      const priceDrift = (targetPrice - order.price) / targetPrice;
      const age = cycleCount - (order.cyclePlaced || cycleCount);
      const hasInterest = orderbook.bids[0][1] > ORDER_SIZE * 2 || orderbook.asks[0][1] > ORDER_SIZE * 2;
      log('DEBUG', `hasInterest calculation: Bid volume ${orderbook.bids[0][1]} > ${ORDER_SIZE * 2}? ${orderbook.bids[0][1] > ORDER_SIZE * 2}, Ask volume ${orderbook.asks[0][1]} > ${ORDER_SIZE * 2}? ${orderbook.asks[0][1] > ORDER_SIZE * 2}, Result: ${hasInterest}`);

      log('DEBUG', `📊 ${key.toUpperCase()} order - ID: ${order.id.substring(0, 8)}, Price: ${order.price}, Target: ${targetPrice}, Drift: ${(priceDrift * 100).toFixed(2)}%, Age: ${age} cycles`);

      // --- Ajuste gradual do preço com drift boost da variável env ---
      const adjustedDrift = PRICE_DRIFT * (1 + PRICE_DRIFT_BOOST) * 2; // dobro do drift
      log('DEBUG', `Adjustment check - adjustedDrift: ${adjustedDrift}, age >= ${MIN_ORDER_CYCLES}? ${age >= MIN_ORDER_CYCLES}, |drift| > adjustedDrift? ${Math.abs(priceDrift) > adjustedDrift} (|${priceDrift}| > ${adjustedDrift})`);
      const ADJUST_STEP_AGGRESSIVE = ADJUST_STEP * 2; // ajuste maior
      if (age >= MIN_ORDER_CYCLES && Math.abs(priceDrift) > adjustedDrift) {
        const adjustment = targetPrice * Math.sign(priceDrift) * Math.min(Math.abs(priceDrift), ADJUST_STEP_AGGRESSIVE);
        const newPrice = order.price + adjustment;

        log('INFO', `🔄 Gradually adjusting ${key.toUpperCase()} order ${order.id.substring(0, 8)}: ${order.price.toFixed(0)} → ${newPrice.toFixed(0)} (Drift Boost: ${(PRICE_DRIFT_BOOST * 100).toFixed(0)}%, Adjustment amount: ${adjustment.toFixed(2)})`);

        await tryCancel(key);
        const newOrder = await MB.placeOrder(key, newPrice, ORDER_SIZE);
        const orderId = newOrder.orderId || `${key}_${Date.now()}`;
        activeOrders.set(key, { id: orderId, side: key, price: newPrice, qty: ORDER_SIZE, status: 'working', cyclePlaced: cycleCount, timestamp: Date.now() });
        await saveOrderSafe(activeOrders.get(key), `market_making_${key}_adjust`);
      } else {
        log('DEBUG', `No adjustment needed for ${key.toUpperCase()} order`);
      }

      // --- Cancelamento inteligente ---
      log('DEBUG', `Cancel check - |drift| > ${PRICE_TOLERANCE}? ${Math.abs(priceDrift) > PRICE_TOLERANCE}, age >= ${MAX_ORDER_AGE}? ${age >= MAX_ORDER_AGE}, age >= ${MIN_ORDER_CYCLES}? ${age >= MIN_ORDER_CYCLES}, shouldCancel: ${ (Math.abs(priceDrift) > PRICE_TOLERANCE || age >= MAX_ORDER_AGE) && age >= MIN_ORDER_CYCLES }, !hasInterest: ${!hasInterest}`);
      const shouldCancel = (Math.abs(priceDrift) > PRICE_TOLERANCE || age >= MAX_ORDER_AGE) && age >= MIN_ORDER_CYCLES;
      if (shouldCancel && !hasInterest) {
        log('INFO', `❌ Cancelling ${key.toUpperCase()} - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles (low interest)`);
        await tryCancel(key);
        continue;
      } else {
        log('DEBUG', `No cancel needed for ${key.toUpperCase()} order (shouldCancel: ${shouldCancel}, hasInterest: ${hasInterest})`);
      }

      log('DEBUG', `Keep order check - hasInterest: ${hasInterest}, |drift| < 0.001? ${Math.abs(priceDrift) < 0.001}`);
      if (hasInterest && Math.abs(priceDrift) < 0.001) {
        log('DEBUG', `Keeping ${key.toUpperCase()} order due to high interest and low drift`);
        continue;
      } // Manter se liquidez alta e drift baixo

      // --- Ordem OK ---
      log('INFO', `✅ Order ${key.toUpperCase()} OK - drift=${(priceDrift * 100).toFixed(2)}%, age=${age} cycles`);
    }

    // Place new orders
    let buyStatus = activeOrders.has('buy') ? await checkOrderStatus('buy', 'buy') : { status: 'unknown' };
    let sellStatus = activeOrders.has('sell') ? await checkOrderStatus('sell', 'sell') : { status: 'unknown' };

    // Verificar saldo
    let balances;
    try {
      balances = await MB.getBalances();
      log('DEBUG', `💰 Fetched balances - BRL: ${balances.find(b => b.symbol === 'BRL')?.available || 'N/A'}, BTC: ${balances.find(b => b.symbol === 'BTC')?.available || 'N/A'}, Total BRL: ${balances.find(b => b.symbol === 'BRL')?.total || 'N/A'}, Total BTC: ${balances.find(b => b.symbol === 'BTC')?.total || 'N/A'}`);
    } catch (e) {
      log('ERROR', `❌ Failed to fetch account balance: ${e.message} - Check API_KEY and API_SECRET in .env`);
      balances = [{ symbol: 'BRL', available: '0', total: '0' }, { symbol: 'BTC', available: '0', total: '0' }];
    }
    const brlBalance = parseFloat(balances.find(b => b.symbol === 'BRL')?.available || 0);
    const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);
    const buyCost = buyPrice * ORDER_SIZE * 1.003;
    log('DEBUG', `💸 Buy Cost Calculation - Price: ${buyPrice}, Size: ${ORDER_SIZE}, Fee: ${(buyCost - buyPrice * ORDER_SIZE).toFixed(2)}, Total: ${buyCost.toFixed(2)}`);
    const sellAmount = ORDER_SIZE;
    log('DEBUG', `💰 Checking balances - BRL: ${brlBalance.toFixed(2)}, BTC: ${btcBalance.toFixed(8)}, Buy Cost: ${buyCost.toFixed(2)}, Sell Amount: ${sellAmount}`);
    log('INFO', `📊 Inventory: BTC ${btcPosition.toFixed(8)}, Avg Cost ${(btcPosition > 0 ? totalCost / btcPosition : 0).toFixed(0)}, PnL ${totalPnL.toFixed(2)}`);

    log('DEBUG', `Buy placement check - hasActiveBuy: ${activeOrders.has('buy')}, buyStatus: ${buyStatus.status}, brlBalance >= buyCost? ${brlBalance >= buyCost} (${brlBalance.toFixed(2)} >= ${buyCost.toFixed(2)})`);
    if (!activeOrders.has('buy') && buyStatus.status !== 'filled' && brlBalance >= buyCost) {
      try {
        const order = await MB.placeOrder('buy', buyPrice, ORDER_SIZE);
        const orderId = order.orderId || `buy_${Date.now()}`;
        const newOrder = { id: orderId, side: 'buy', price: buyPrice, qty: ORDER_SIZE, status: 'working', cyclePlaced: cycleCount, timestamp: Date.now() };
        activeOrders.set('buy', newOrder);
        log('INFO', `✅ Placed BUY order ${orderId.substring(0, 8)} @ R$${buyPrice.toFixed(0)}, Qty: ${ORDER_SIZE}, Cost: ${buyCost.toFixed(2)}, BRL Balance: ${brlBalance.toFixed(2)}`);
        await saveOrderSafe(newOrder, 'market_making_buy');
      } catch (e) {
        log('ERROR', `❌ Buy placement failed | ${e.message}, BRL Balance: ${brlBalance.toFixed(2)}`);
      }
    } else if (!activeOrders.has('buy')) {
      log('WARN', `💰 Insufficient BRL balance (${brlBalance.toFixed(2)}) for buy order, required: ${buyCost.toFixed(2)}`);
    } else {
      log('DEBUG', `No new BUY order placed (active or filled status)`);
    }

    log('DEBUG', `Sell placement check - hasActiveSell: ${activeOrders.has('sell')}, sellStatus: ${sellStatus.status}, btcBalance >= sellAmount? ${btcBalance >= sellAmount} (${btcBalance.toFixed(8)} >= ${sellAmount})`);
    if (!activeOrders.has('sell') && sellStatus.status !== 'filled' && btcBalance >= sellAmount) {
      try {
        const order = await MB.placeOrder('sell', sellPrice, ORDER_SIZE);
        const orderId = order.orderId || `sell_${Date.now()}`;
        const newOrder = { id: orderId, side: 'sell', price: sellPrice, qty: ORDER_SIZE, status: 'working', cyclePlaced: cycleCount, timestamp: Date.now() };
        activeOrders.set('sell', newOrder);
        log('INFO', `✅ Placed SELL order ${orderId.substring(0, 8)} @ R$${sellPrice.toFixed(0)}, Qty: ${ORDER_SIZE}, BTC Balance: ${btcBalance.toFixed(8)}`);
        await saveOrderSafe(newOrder, 'market_making_sell');
      } catch (e) {
        log('ERROR', `❌ Sell placement failed | ${e.message}, BTC Balance: ${btcBalance.toFixed(8)}`);
      }
    } else if (!activeOrders.has('sell')) {
      log('WARN', `💰 Insufficient BTC balance (${btcBalance.toFixed(8)}) for sell order, required: ${sellAmount}`);
    } else {
      log('DEBUG', `No new SELL order placed (active or filled status)`);
    }

    // Update stats
    stats.totalOrders = activeOrders.size + stats.filledOrders;
    stats.filledOrders = totalFills;
    stats.totalPnL = parseFloat(totalPnL.toFixed(2));
    stats.fillRate = ((totalFills / (cycleCount || 1)) * 100).toFixed(1) + '%';
    stats.uptime = `${Math.round((Date.now() - startTime) / 60000)}min`;
    stats.avgSpread = dynamicSpreadPct * 100;
    log('DEBUG', `📊 Stats Update - Total Orders: ${stats.totalOrders}, Fills: ${stats.filledOrders}, PnL: ${stats.totalPnL}, Fill Rate: ${stats.fillRate}`);

    safeStatsLog(`📊 Cycle ${cycleCount} summary`, stats);
  } catch (e) {
    log('ERROR', `❌ Critical error in cycle ${cycleCount}: ${e.message}, Stack: ${e.stack}`);
  }
}

// -------------------- MAIN --------------------
async function main() {
  try {
    log('INFO', 'Initializing DB...');
    await db.init();
    log('SUCCESS', 'DB initialized');

    log('INFO', 'Authenticating with Mercado Bitcoin...');
    await MB.authenticate();
    log('SUCCESS', 'Authentication completed');

    log('INFO', 'Fetching initial orderbook...');
    await fetchOrderbookRest();

    log('INFO', `Starting main loop - cycle every ${CYCLE_SEC}s, Start Time: ${new Date(startTime).toISOString()}`);
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