require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mbClient = require('./mb_client'); // seu mb_client.js

// Config
const SIMULATE = mbClient.SIMULATE;
const PORT = parseInt(process.env.PORT) || 3001;
const CACHE_TTL = parseInt(process.env.DASHBOARD_CACHE_TTL) || 180000; // 3 minutos
const DEBUG = process.env.DEBUG === 'true';

// Logging
const log = (level, message, data) => {
  if (!DEBUG && level === 'DEBUG') return;
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] [DASHBOARD ${level}] ${message}`, data || '');
};

log('INFO', `Starting Dashboard - SIMULATE=${SIMULATE}, PORT=${PORT}`);

// Express app
const app = express();
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.use(express.json({ limit: '1mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(200).end();
  }
  next();
});

// Counters
let requestCount = 0;
let errorCount = 0;
const serverStartTime = Date.now();

// Cache
let cache = { timestamp: 0, data: null, valid: false };

// ===== Função para gerar dados simulados =====
function generateSimulatedData() {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - serverStartTime) / 1000);
  const cycleDuration = parseInt(process.env.CYCLE_SEC || 5);
  const cycles = Math.floor(uptimeSeconds / cycleDuration);
  const basePrice = 300000 + Math.sin(uptimeSeconds / 25) * 1500;
  const tradingSpread = basePrice * parseFloat(process.env.SPREAD_PCT || '0.002');

  const brlBalance = (10000 + Math.sin(uptimeSeconds / 60) * 100).toFixed(2);
  const btcBalance = (0.05 + Math.sin(uptimeSeconds / 120) * 0.002).toFixed(8);

  const orders = [];
  const numOrders = Math.floor(Math.random() * 3);
  for (let i = 0; i < numOrders; i++) {
    const side = i === 0 ? 'buy' : (i === 1 ? 'sell' : (Math.random() > 0.5 ? 'buy' : 'sell'));
    const priceOffset = side === 'buy' ? -tradingSpread / 2 : tradingSpread / 2;
    const price = Math.round((basePrice + priceOffset) * 100) / 100;
    orders.push({
      id: 'SIM_' + (now - i * 60000).toString().slice(-6) + String(i).padStart(2, '0'),
      side,
      price: price.toFixed(2),
      qty: parseFloat(process.env.ORDER_SIZE || '0.0001'),
      status: 'working',
      timestamp: now - i * 60000,
      type: 'limit'
    });
  }

  const fills = Math.floor(cycles * 0.1);
  const totalOrders = Math.floor(cycles * 2);
  const cancels = Math.floor(fills * 0.25);
  const pnlPerFill = parseFloat(process.env.ORDER_SIZE || '0.0001') * tradingSpread;
  const totalPnL = (fills * pnlPerFill * (0.95 + Math.random() * 0.05)).toFixed(2);

  return {
    timestamp: new Date().toISOString(),
    mode: 'SIMULATE',
    market: {
      pair: mbClient.PAIR,
      last: basePrice.toFixed(2),
      bid: (basePrice - tradingSpread / 2).toFixed(2),
      ask: (basePrice + tradingSpread / 2).toFixed(2),
      spread: ((tradingSpread) / basePrice * 100).toFixed(2)
    },
    balances: { brl: brlBalance, btc: btcBalance },
    orders,
    stats: {
      cycles,
      uptime: Math.floor(uptimeSeconds / 60) + 'min',
      fills,
      totalOrders,
      cancels,
      totalPnL,
      fillRate: ((fills / Math.max(1, totalOrders)) * 100).toFixed(1) + '%',
      avgSpread: (parseFloat(process.env.SPREAD_PCT || 0.002) * 100).toFixed(2)
    },
    config: {
      simulate: true,
      spreadPct: (parseFloat(process.env.SPREAD_PCT || 0.002) * 100).toFixed(1),
      orderSize: process.env.ORDER_SIZE || '0.0001',
      cycleSec: process.env.CYCLE_SEC || '5'
    }
  };
}

// ===== Função para dados LIVE via mb_client =====
async function getLiveData() {
  try {
    const [ticker, balances, orders] = await Promise.all([
      mbClient.getTicker(),
      mbClient.getBalances(),
      mbClient.getOpenOrders()
    ]);

    const fills = orders.filter(o => o.status === 'filled').length;
    const now = Date.now();

    // ===== Cálculo de P&L =====
    let btcPosition = 0;
    let costBasis = 0;
    let totalPnL = 0;

    orders.forEach(o => {
      if (o.status !== 'filled') return;

      const qty = parseFloat(o.qty);
      const price = parseFloat(o.limitPrice || o.price);

      if (o.side === 'buy') {
        // Aumenta posição e custo médio
        costBasis = ((btcPosition * costBasis) + (qty * price)) / (btcPosition + qty);
        btcPosition += qty;
      } else if (o.side === 'sell') {
        // Lucro da venda
        totalPnL += (price - costBasis) * qty;
        btcPosition -= qty;
        if (btcPosition < 0) btcPosition = 0; // evita posição negativa
      }
    });

    totalPnL = totalPnL.toFixed(2); // em BRL

    return {
      timestamp: new Date().toISOString(),
      mode: 'LIVE',
      market: {
        pair: mbClient.PAIR,
        last: parseFloat(ticker.last),
        bid: parseFloat(ticker.buy),
        ask: parseFloat(ticker.sell),
        spread: (((parseFloat(ticker.sell) - parseFloat(ticker.buy)) / parseFloat(ticker.last)) * 100).toFixed(2)
      },
      balances: {
        brl: balances.find(b => b.symbol === 'BRL')?.available || 0,
        btc: balances.find(b => b.symbol === 'BTC')?.available || 0
      },
      orders: orders.map(o => ({
        id: o.id,
        side: o.side,
        price: parseFloat(o.limitPrice || o.price),
        qty: parseFloat(o.qty),
        status: o.status,
        type: o.type,
        timestamp: o.created_at || o.timestamp
      })),
      stats: {
        cycles: 0,
        uptime: Math.floor((now - serverStartTime) / 1000) + 's',
        fills,
        totalOrders: orders.length,
        cancels: 0,
        totalPnL,
        fillRate: orders.length ? ((fills / orders.length) * 100).toFixed(1) + '%' : '0%',
        avgSpread: (parseFloat(process.env.SPREAD_PCT || 0.002) * 100).toFixed(2)
      },
      config: {
        simulate: false,
        spreadPct: (parseFloat(process.env.SPREAD_PCT || 0.002) * 100).toFixed(1),
        orderSize: process.env.ORDER_SIZE || '0.0001',
        cycleSec: process.env.CYCLE_SEC || '5'
      }
    };

  } catch (err) {
    log('ERROR', 'LIVE fetch failed:', err.message);
    return { error: err.message, mode: 'LIVE' };
  }
}

// ===== API status atualizado =====
app.get('/api/status', async (req, res) => {
  requestCount++;
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  // Calcular uptime e ciclos
  const uptimeSeconds = Math.floor((now - serverStartTime) / 1000);
  const cycleDuration = parseInt(process.env.CYCLE_SEC || 5);
  const cycles = Math.floor(uptimeSeconds / cycleDuration);

  const cacheValid = cache.timestamp > 0 && cache.valid && (now - cache.timestamp) <= CACHE_TTL;

  if (!cacheValid || forceRefresh) {
    try {
      let data;
      if (SIMULATE) {
        data = generateSimulatedData();
      } else {
        data = await getLiveData();
      }

      // Atualiza stats de uptime e cycles
      data.stats = data.stats || {};
      data.stats.uptime = Math.floor(uptimeSeconds / 60) + 'min';
      data.stats.cycles = cycles;

      cache.data = data;
      cache.timestamp = now;
      cache.valid = true;

    } catch (err) {
      log('ERROR', 'Cache update failed:', err.message);
      cache.data = { error: err.message, mode: SIMULATE ? 'SIMULATE' : 'LIVE' };
      cache.timestamp = now;
      cache.valid = false;
      errorCount++;
    }
  } else {
    // Atualiza apenas uptime e cycles no cache existente
    cache.data.stats = cache.data.stats || {};
    cache.data.stats.uptime = Math.floor(uptimeSeconds / 60) + 'min';
    cache.data.stats.cycles = cycles;
  }

  res.json(cache.data);
});

// Health check
app.get('/health', (req, res) => {
  const now = Date.now();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(1) + 's',
    simulate: SIMULATE,
    port: PORT,
    cache: { valid: cache.valid, ageMs: now - cache.timestamp, ttlMs: CACHE_TTL },
    requests: { total: requestCount, sinceStart: Math.round(requestCount / (process.uptime() / 60)) },
    errors: errorCount
  });
});

// Serve HTML
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(200).send('<!DOCTYPE html><html><body><h1>Dashboard Setup Required</h1></body></html>');
});

// 404
app.use('/api/*', (req, res) => res.status(404).json({ error: 'API endpoint not found', path: req.path }));

// Error handler
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: 'Internal Server Error', message: err.message, path: req.path }));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  log('INFO', `Dashboard ready at ${url} - Mode: ${SIMULATE ? 'SIMULATE' : 'LIVE'}`);
});

module.exports = app;
