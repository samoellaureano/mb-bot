// dashboard.js - Servidor Express para o Dashboard de Monitoramento
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mbClient = require('./mb_client');
const axios = require('axios');

// Config
const SIMULATE = mbClient.SIMULATE;
const PORT = parseInt(process.env.PORT) || 3001;
const CACHE_TTL = parseInt(process.env.DASHBOARD_CACHE_TTL) || 30000; // 30 segundos
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
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '1h', etag: true}));
app.use(express.json({limit: '1mb'}));

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
let cache = {timestamp: 0, data: null, valid: false};

// ===== Função auxiliar para calcular idade =====
const computeAge = (timestamp) => {
    const now = Date.now();
    const ageMs = now - new Date(timestamp).getTime();
    const ageSec = Math.floor(ageMs / 1000);
    const ageMin = Math.floor(ageSec / 60);
    const ageHour = Math.floor(ageMin / 60);
    const ageDay = Math.floor(ageHour / 24);
    return {ageSec, ageMin, ageHour, ageDay};
};

// ===== Função para gerar dados simulados =====
function generateSimulatedData() {
    const now = Date.now();
    const last = 626225 + (Math.random() - 0.5) * 500;
    const bid = last - Math.random() * 100;
    const ask = last + Math.random() * 100;
    const mid = (bid + ask) / 2;
    const spread = ((ask - bid) / last) * 100;
    const volatility = ((ask - bid) / mid).toFixed(2);

    const brlAvailable = 500 + Math.random() * 200;
    const btcAvailable = 0.000008 + Math.random() * 0.00002;
    const buyCost = 43.97;
    const canBuy = true;

    const activeOrders = [
        {
            id: "SIM_SELL_01",
            side: "sell",
            price: parseFloat((mid + 300 + Math.random() * 50).toFixed(2)),
            qty: 0.00007 + Math.random() * 0.00003,
            status: "working",
            timestamp: new Date(now - 32 * 60 * 1000).toISOString(),
            drift: 0
        },
        {
            id: "SIM_BUY_01",
            side: "buy",
            price: parseFloat((mid - 300 - Math.random() * 50).toFixed(2)),
            qty: 0.00007 + Math.random() * 0.00003,
            status: "working",
            timestamp: new Date(now - 32 * 60 * 1000).toISOString(),
            drift: 0
        }
    ];

    activeOrders.forEach(o => {
        o.drift = o.side === 'buy' ? (mid - o.price).toFixed(2) : (o.price - mid).toFixed(2);
        o.ageSecMinHour = computeAge(o.timestamp);
    });

    const executedOrders = Array.from({length: 10}, (_, i) => ({
        id: `SIM_ORDER_${i}`,
        side: i % 2 === 0 ? "buy" : "sell",
        price: parseFloat((mid + (Math.random() - 0.5) * 500).toFixed(2)),
        qty: parseFloat((0.00005 + Math.random() * 0.00002).toFixed(8)),
        status: i % 3 === 0 ? "cancelled" : "filled",
        timestamp: new Date(now - (i + 1) * 60000).toISOString(),
        ageSecMinHour: computeAge(new Date(now - (i + 1) * 60000).toISOString())
    }));

    const pnlHistory = [];
    let pnlValue = 0;
    for (let i = 0; i < 30; i++) {
        pnlValue += (Math.random() - 0.5) * 0.1;
        pnlHistory.push(parseFloat(pnlValue.toFixed(2)));
    }

    const bids = Array.from({length: 5}, (_, i) => parseFloat((mid - (i + 1) * 50 - Math.random() * 20).toFixed(2)));
    const asks = Array.from({length: 5}, (_, i) => parseFloat((mid + (i + 1) * 50 + Math.random() * 20).toFixed(2)));

    return {
        timestamp: new Date().toISOString(),
        mode: "SIMULATE",
        market: {
            pair: "BTC-BRL",
            last: parseFloat(last.toFixed(2)),
            bid: parseFloat(bid.toFixed(2)),
            ask: parseFloat(ask.toFixed(2)),
            mid: mid.toFixed(2),
            spread: spread.toFixed(2),
            volatility: volatility + "%"
        },
        balances: {
            brl: parseFloat(brlAvailable.toFixed(2)),
            btc: parseFloat(btcAvailable.toFixed(8)),
            total: parseFloat((brlAvailable + btcAvailable * last).toFixed(2)),
            brlAvailable: parseFloat(brlAvailable.toFixed(2)),
            btcAvailable: parseFloat(btcAvailable.toFixed(8)),
            buyCost: buyCost.toFixed(2),
            canBuy
        },
        activeOrders,
        orders: [...activeOrders, ...executedOrders],
        stats: {
            cycles: 384,
            uptime: "51min",
            fills: 30,
            totalOrders: 100,
            cancels: 68,
            totalPnL: pnlValue.toFixed(2),
            pnlHistory,
            fillRate: "30.0%",
            avgSpread: "0.20",
            dynamicSpread: "0.10%"
        },
        config: {
            simulate: true,
            spreadPct: 0.2,
            orderSize: 0.00007,
            cycleSec: 8,
            maxOrderAgeSecMinHour: {ageSec: 900, ageMin: 15, ageHour: 0, ageDay: 0},
            maxDailyVolume: "0.01",
            maxPosition: "0.0003",
            minOrderSize: "0.00001",
            emergencyStopPnL: "-10",
            priceDrift: "0.08",
            priceDriftBoost: "60.00",
            stopLoss: 2.0,
            takeProfit: 5.0,
            minVolume: 0.00005000,
            volatilityLimit: 1.0
        },
        debug: {marketInterest: true, lastObUpdate: new Date().toISOString(), bids, asks}
    };
}

// ===== Função para dados LIVE via mb_client =====
async function getLiveData() {
    try {
        if (!await mbClient.ensureAuthenticated()) await mbClient.authenticate();
        const accountId = mbClient.getAccountId();
        const [ticker, balances] = await Promise.all([
            mbClient.getTicker(),
            mbClient.getBalances(accountId)
        ]);

        // Fetch all orders using direct API call (status='all' to include open, filled, cancelled)
        const ordersResponse = await axios.get(`https://api.mercadobitcoin.net/api/v4/accounts/${accountId}/orders`, {
            params: {
                status: 'all',
                symbol: mbClient.PAIR, // e.g., 'BTC-BRL'
                limit: 100 // Adjust limit as needed; add pagination if more orders are required
            },
            headers: {'Authorization': `Bearer ${mbClient.getAccessToken()}`},
            timeout: 10000
        });

// Safely handle the API response structure
        let orders = [];
        if (ordersResponse.data && Array.isArray(ordersResponse.data.items)) {
            orders = ordersResponse.data.items; // Use the 'items' array from the response
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data)) {
            orders = ordersResponse.data; // Fallback to direct array if no 'items'
        } else {
            log('WARN', 'Unexpected orders response structure:', ordersResponse.data);
            orders = []; // Fallback to empty array if structure is unknown
        }

// ===== Orderbook com fallback =====
        let orderbook;
        try {
            const response = await axios.get(`https://api.mercadobitcoin.net/api/v4/${mbClient.PAIR}/orderbook?limit=100`, {
                timeout: 10000,
                headers: {'Authorization': `Bearer ${mbClient.getAccessToken()}`}
            });
            orderbook = {bids: response.data.bids.slice(0, 10), asks: response.data.asks.slice(0, 10)};
        } catch (e) {
            const mid = parseFloat(ticker.last);
            const baseSpreadPct = parseFloat(process.env.SPREAD_PCT || '0.002');
            const qty = 0.01;
            const levels = 5;
            const bids = [], asks = [];
            for (let i = 1; i <= levels; i++) {
                const multiplier = i + Math.random() * 0.3;
                bids.push([(mid * (1 - baseSpreadPct * multiplier)).toFixed(2), qty.toFixed(4)]);
                asks.push([(mid * (1 + baseSpreadPct * multiplier)).toFixed(2), qty.toFixed(4)]);
            }
            orderbook = {bids, asks, fallback: true};
        }

        const fills = orders.filter(o => o.status === 'filled').length;
        const now = Date.now();
        const bid = parseFloat(ticker.buy);
        const ask = parseFloat(ticker.sell);
        const mid = (bid + ask) / 2;
        const volatility = ((ask - bid) / mid) * 100;
        let dynamicSpreadPct = volatility >= 0.5 ? Math.min(0.008, parseFloat(process.env.MAX_SPREAD_PCT || 0.01))
            : volatility >= 0.1 ? 0.003 : volatility >= 0.05 ? 0.002 : 0.001;

// ===== PnL e histórico =====
        let btcPosition = 0, totalCost = 0, totalPnL = 0;
        const pnlHistory = [];
        orders.filter(o => o.status === 'filled').sort((a, b) => (a.created_at || 0) - (b.created_at || 0)).forEach(o => {
            const qty = parseFloat(o.qty);
            const price = parseFloat(o.limitPrice || o.price);
            if (o.side === 'buy') {
                btcPosition += qty;
                totalCost += qty * price;
                totalPnL += 0;
            } else if (o.side === 'sell' && btcPosition > 0) {
                const avgPrice = totalCost / btcPosition;
                totalPnL += (price - avgPrice) * qty;
                btcPosition -= qty;
                totalCost -= avgPrice * qty;
            }
            pnlHistory.push(parseFloat(totalPnL.toFixed(8)));
        });
        totalPnL = totalPnL.toFixed(8);

// ===== Corrigir timestamps =====
        const correctedOrders = orders.map(o => {
            const createdAt = o.created_at ? new Date(o.created_at * 1000).toISOString() : null;
            const updatedAt = o.updated_at ? new Date(o.updated_at * 1000).toISOString() : null;
            return {
                id: o.order_id || o.id, // Ajustado para 'order_id' baseado na documentação da API
                side: o.side,
                price: parseFloat(o.limitPrice || o.price),
                qty: parseFloat(o.qty),
                status: o.status,
                type: o.type,
                timestamp: createdAt,
                updated_at: updatedAt
            };
        });

        const activeOrders = correctedOrders.filter(o => o.status === 'working');
        const buyCost = bid * parseFloat(process.env.ORDER_SIZE || '0.00002') * 1.003;
        const canBuy = balances.find(b => b.symbol === 'BRL')?.available >= buyCost;
        const marketInterest = orderbook.bids[0][1] > parseFloat(process.env.ORDER_SIZE || '0.00002') * 5
            || orderbook.asks[0][1] > parseFloat(process.env.ORDER_SIZE || '0.00002') * 5;

        return {
            timestamp: new Date().toISOString(),
            mode: 'LIVE',
            market: {
                pair: mbClient.PAIR,
                last: parseFloat(ticker.last),
                bid,
                ask,
                spread: (((ask - bid) / parseFloat(ticker.last)) * 100).toFixed(2),
                mid: mid.toFixed(2),
                volatility: volatility.toFixed(2) + '%'
            },
            balances: {
                brl: balances.find(b => b.symbol === 'BRL')?.total || 0,
                btc: balances.find(b => b.symbol === 'BTC')?.total || 0,
                total: balances.reduce((sum, b) => sum + parseFloat(b.total) * (b.symbol === 'BRL' ? 1 : (b.symbol === 'BTC' ? parseFloat(ticker.last) : 0)), 0).toFixed(2),
                brlAvailable: balances.find(b => b.symbol === 'BRL')?.available || 0,
                btcAvailable: balances.find(b => b.symbol === 'BTC')?.available || 0,
                buyCost: buyCost.toFixed(2),
                canBuy
            },
            activeOrders: activeOrders.map(order => ({
                ...order,
                ageSecMinHour: order.timestamp ? computeAge(order.timestamp) : null,
                drift: order.side === 'buy'
                    ? (((mid - order.price) / order.price) * 100).toFixed(2) + '%'
                    : (((order.price - mid) / mid) * 100).toFixed(2) + '%'
            })),
            orders: correctedOrders.map(o => ({...o, ageSecMinHour: o.timestamp ? computeAge(o.timestamp) : null})),
            stats: {
                cycles: 0,
                uptime: Math.floor((now - serverStartTime) / 60) + 'min',
                fills,
                totalOrders: orders.length,
                cancels: orders.filter(o => o.status === 'cancelled').length,
                totalPnL,
                pnlHistory,
                fillRate: orders.length ? ((fills / orders.length) * 100).toFixed(1) + '%' : '0%',
                avgSpread: (parseFloat(process.env.SPREAD_PCT || 0.002) * 100).toFixed(2),
                dynamicSpread: (dynamicSpreadPct * 100).toFixed(2) + '%'
            },
            config: {
                simulate: false,
                spreadPct: 0.2,
                orderSize: 0.00007,
                cycleSec: 8,
                maxOrderAgeSecMinHour: (() => {
                    const ageSec = parseInt(process.env.MAX_ORDER_AGE || '300');
                    const ageMin = Math.floor(ageSec / 60);
                    const ageHour = Math.floor(ageMin / 60);
                    const ageDay = Math.floor(ageHour / 24);
                    return {ageSec, ageMin, ageHour, ageDay};
                })(),
                maxDailyVolume: process.env.MAX_DAILY_VOLUME || '0.01',
                maxPosition: process.env.MAX_POSITION || '0.0003',
                minOrderSize: process.env.MIN_ORDER_SIZE || '0.00001',
                emergencyStopPnL: process.env.EMERGENCY_STOP_PNL || '-10',
                priceDrift: (parseFloat(process.env.PRICE_DRIFT_PCT || 0.0003) * 100).toFixed(2),
                priceDriftBoost: (parseFloat(process.env.PRICE_DRIFT_BOOST_PCT || 0.3) * 100).toFixed(2),
                stopLoss: 2.0,
                takeProfit: 5.0,
                minVolume: 0.00005000,
                volatilityLimit: 1.0
            },
            debug: {
                marketInterest,
                lastObUpdate: new Date().toISOString(),
                activeOrdersCount: activeOrders.length,
                totalOrdersCount: orders.length
            }
        };
    } catch (err) {
        log('ERROR', 'LIVE fetch failed:', err.message);
        return {error: err.message, mode: 'LIVE'};
    }
}

// ===== API status atualizado =====
app.get('/api/status', async (req, res) => {
    requestCount++;
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - serverStartTime) / 1000);
    const cycleDuration = parseInt(process.env.CYCLE_SEC || 5);
    const cycles = Math.floor(uptimeSeconds / cycleDuration);

    const cacheValid = cache.timestamp > 0 && cache.valid && (now - cache.timestamp) <= CACHE_TTL;

    if (!cacheValid || forceRefresh) {
        try {
            let data = SIMULATE ? generateSimulatedData() : await getLiveData();
            data.stats = data.stats || {};
            data.stats.uptime = Math.floor(uptimeSeconds / 60) + 'min';
            data.stats.cycles = cycles;
            cache.data = data;
            cache.timestamp = now;
            cache.valid = true;
        } catch (err) {
            log('ERROR', 'Cache update failed:', err.message);
            cache.data = {error: err.message, mode: SIMULATE ? 'SIMULATE' : 'LIVE'};
            cache.timestamp = now;
            cache.valid = false;
            errorCount++;
        }
    } else {
        cache.data.stats = cache.data.stats || {};
        cache.data.stats.uptime = Math.floor(uptimeSeconds / 60) + 'min';
        cache.data.stats.cycles = cycles;
        // atualizar drift das ordens
        if (cache.data.activeOrders) {
            const mid = parseFloat(cache.data.market.mid);
            cache.data.activeOrders.forEach(o => o.drift = o.side === 'buy' ? (mid - o.price).toFixed(2) : (o.price - mid).toFixed(2));
        }
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
        cache: {valid: cache.valid, ageMs: now - cache.timestamp, ttlMs: CACHE_TTL},
        requests: {total: requestCount, sinceStart: Math.round(requestCount / (process.uptime() / 60))},
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
app.use('/api/*', (req, res) => res.status(404).json({error: 'API endpoint not found', path: req.path}));

// Error handler
app.use((err, req, res, next) => res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    path: req.path
}));

// Start server
app.listen(PORT, '0.0.0.0', () => log('INFO', `Dashboard ready at http://localhost:${PORT} - Mode: ${SIMULATE ? 'SIMULATE' : 'LIVE'}`));

module.exports = app;