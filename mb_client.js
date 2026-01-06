require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const REST_BASE = process.env.REST_BASE || 'https://api.mercadobitcoin.net/api/v4';
const PAIR = process.env.PAIR || 'BTC-BRL';
const SIMULATE = (process.env.SIMULATE === 'true');
const API_KEY = process.env.API_KEY || '';
const API_SECRET = process.env.API_SECRET || '';
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT) || 0.002;
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE) || 0.0001;
const RATE_LIMIT_PER_SEC = parseInt(process.env.RATE_LIMIT_PER_SEC) || 3;
const DEBUG = process.env.DEBUG === 'true';

const log = (level = 'INFO', ...args) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${level}]`;
    console.log(`${timestamp} ${prefix.padEnd(8)}`, ...args);
};

// Armazenamento global do token e account
let accessToken = null;
let tokenExpiration = 0;
let accountId = null;

// Rate limiting simples
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000 / RATE_LIMIT_PER_SEC;

// ===== Saldo SIMULADO dinâmico =====
let simulatedBalances = {
    BRL: parseFloat(process.env.SIMULATED_BRL || 10000),
    BTC: parseFloat(process.env.SIMULATED_BTC || 0.05)
};

// =========================================
// ===== MercadoBitcoinAuth Class ==========
class MercadoBitcoinAuth {
    static sha256Hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    static async authenticate() {
        if (SIMULATE) {
            accessToken = 'SIMULATE_BEARER_TOKEN_123';
            tokenExpiration = Date.now() + 24 * 60 * 60 * 1000; // 24h
            accountId = 'simulate-account-001';
            log('INFO', 'Authentication (SIMULATE): Bearer token generated');
            return {access_token: accessToken, expiration: Math.floor(tokenExpiration / 1000)};
        }

        if (!API_KEY || !API_SECRET) throw new Error('API_KEY and API_SECRET required for live trading');

        log('INFO', 'API_KEY:', API_KEY.substring(0, 8) + '...');
        log('INFO', 'API_SECRET:', API_SECRET.substring(0, 8) + '...');

        try {
            const authResponse = await axios.post(
                `${REST_BASE}/authorize`,
                {login: API_KEY, password: API_SECRET},
                {headers: {'Content-Type': 'application/json', 'User-Agent': 'MB-Bot/1.2.1'}, timeout: 15000}
            );

            if (!authResponse.data.access_token) throw new Error('Authentication failed: no access token received');

            accessToken = authResponse.data.access_token;
            tokenExpiration = authResponse.data.expiration * 1000;

            const accountsResponse = await axios.get(
                `${REST_BASE}/accounts`,
                {headers: {Authorization: `Bearer ${accessToken}`, 'User-Agent': 'MB-Bot/1.2.1'}, timeout: 10000}
            );

            if (accountsResponse.data && accountsResponse.data.length > 0) {
                accountId = accountsResponse.data[0].id;
                log('INFO', `Account ID: ${accountId.substring(0, 8)}...`);
                log('INFO', `Access Token: ${accessToken.substring(0, 8)}...`);
            } else throw new Error('No accounts found');

            const expiresIn = Math.floor((tokenExpiration - Date.now()) / (1000 * 60));
            log('SUCCESS', `Authentication OK - Token expires in ${expiresIn} minutes`);
            return authResponse.data;

        } catch (error) {
            const status = error.response?.status || 'UNKNOWN';
            const errorMsg = error.response?.data?.message || error.message;
            log('ERROR', `Authentication failed [${status}]:`, errorMsg);
            throw new Error(`Authentication failed: ${errorMsg}`);
        }
    }

    static async ensureAuthenticated() {
        const now = Date.now();
        if (!accessToken || now >= tokenExpiration - 60000) {
            log('WARN', 'Token expired/near expiry, reauthenticating...');
            await this.authenticate();
        }
        return true;
    }

    static getAccessToken() {
        if (!accessToken) throw new Error('Access token not available. Call authenticate() first.');
        return accessToken;
    }

    static getAccountId() {
        if (!accountId) throw new Error('Account ID not available. Call authenticate() first.');
        return accountId;
    }
}

// =========================================
// ===== Rate Limit ========================
async function rateLimit() {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL) {
        const delay = MIN_REQUEST_INTERVAL - timeSinceLast;
        if (DEBUG) {
            log('DEBUG', `Rate limit: waiting ${delay.toFixed(0)}ms`);
        }
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    lastRequestTime = now;
    return Promise.resolve();
}

// =========================================
// ===== makeRequest =======================
async function makeRequest(endpoint, method = 'GET', params = {}, body = null) {
    await rateLimit();
    await MercadoBitcoinAuth.ensureAuthenticated();

    const accountId = MercadoBitcoinAuth.getAccountId(); // Garantir accountId válido
    const url = new URL(`${REST_BASE}${endpoint.replace('{accountId}', accountId).replace('{symbol}', PAIR.replace('-', ''))}`);
    if (method === 'GET' && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.append(key, value.toString());
        });
    }

    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MercadoBitcoinAuth.getAccessToken()}`,
        'User-Agent': 'MB-Bot/1.2.1'
    };

    const config = {
        method: method.toUpperCase(),
        url: url.toString(),
        headers,
        timeout: 10000,
        validateStatus: () => true
    };
    if (body && ['POST', 'PUT', 'DELETE'].includes(method)) config.data = body;
    if (SIMULATE) return simulateResponse(endpoint, method, params, body);

    try {
        if (DEBUG) {
            log('DEBUG', 'CURL:', `curl -X ${method} '${url.toString()}' -H 'Authorization: Bearer ${accessToken}' -H 'User-Agent: MB-Bot/1.2.1'`);
        }
        const response = await axios(config);
        if (response.status >= 400) throw new Error(response.data?.message || `HTTP ${response.status}`);
        return response.data;
    } catch (error) {
        throw new Error(error.message || 'Unknown error');
    }
}

// =========================================
// ===== Simulação dinâmica =================
function simulateResponse(endpoint, method, params, body) {
    const now = Date.now();
    const marketPrice = 300000 + Math.sin(now / 15000) * 5000;
    const spread = marketPrice * SPREAD_PCT;

    let ep = endpoint.replace(/\{accountId\}/g, accountId || 'simulate-account-001');
    ep = ep.replace(/\{symbol\}/g, PAIR);
    ep = ep.replace(/\{orderId\}/g, params?.orderId || 'SIM_ORDER_001');

    const genAvgPrice = (side, basePrice) => {
        const slippage = (Math.random() - 0.5) * 0.002;
        return side === 'buy' ? (basePrice * (1 + slippage)) : (basePrice * (1 + slippage));
    };

    const simulations = {
        '/tickers': {
            GET: () => [{
                pair: PAIR,
                last: marketPrice.toFixed(2),
                buy: (marketPrice - spread * 0.5).toFixed(2),
                sell: (marketPrice + spread * 0.5).toFixed(2),
                high: (marketPrice * 1.005).toFixed(2),
                low: (marketPrice * 0.995).toFixed(2),
                open: (marketPrice * 0.998).toFixed(2),
                vol: (15 + Math.random() * 25).toFixed(3),
                date: now * 1000000000
            }]
        },

        '/accounts/{accountId}/balances': {
            GET: () => [
                {
                    symbol: 'BRL',
                    available: simulatedBalances.BRL.toFixed(2),
                    on_hold: '0.00',
                    total: simulatedBalances.BRL.toFixed(2)
                },
                {
                    symbol: 'BTC',
                    available: simulatedBalances.BTC.toFixed(8),
                    on_hold: '0.00000000',
                    total: simulatedBalances.BTC.toFixed(8)
                }
            ]
        },

        '/accounts/{accountId}/{symbol}/orders': {
            POST: () => {
                const qty = parseFloat(body.qty);
                const price = parseFloat(body.limitPrice) || marketPrice;
                const side = (body.side || 'buy').toLowerCase();
                const avgPrice = genAvgPrice(side, price);
                if (side === 'buy') {
                    simulatedBalances.BRL = Math.max(0, simulatedBalances.BRL - avgPrice * qty);
                    simulatedBalances.BTC += qty;
                } else {
                    simulatedBalances.BRL += avgPrice * qty;
                    simulatedBalances.BTC = Math.max(0, simulatedBalances.BTC - qty);
                }
                const orderId = `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
                log('INFO', `[SIMULATE] Order executed - balances updated`, simulatedBalances);
                return {
                    orderId,
                    status: 'filled',
                    side,
                    qty: qty.toString(),
                    limitPrice: price.toFixed(2),
                    filledQty: qty.toString(),
                    avgPrice: avgPrice.toFixed(2)
                };
            },
            GET: () => {
                const numOrders = Math.floor(Math.random() * 3);
                const orders = [];
                for (let i = 0; i < numOrders; i++) {
                    const side = Math.random() > 0.5 ? 'buy' : 'sell';
                    const price = side === 'buy' ? (marketPrice - spread).toFixed(2) : (marketPrice + spread).toFixed(2);
                    orders.push({
                        id: `SIM_OPEN_${Date.now() - i * 60000}`,
                        side,
                        type: 'limit',
                        status: 'working',
                        qty: ORDER_SIZE.toString(),
                        limitPrice: price,
                        created_at: Math.floor((now - i * 60000) / 1000),
                        updated_at: Math.floor(now / 1000)
                    });
                }
                return orders;
            }
        },

        '/accounts/{accountId}/{symbol}/orders/{orderId}': {
            DELETE: () => ({status: 'cancelled', orderId: params.orderId, message: 'Order cancelled (simulated)'}),
            GET: () => {
                const qty = ORDER_SIZE;
                const avgPrice = (marketPrice + spread).toFixed(2);
                return {
                    id: params.orderId,
                    status: 'filled',
                    side: 'sell',
                    qty: qty.toString(),
                    filledQty: qty.toString(),
                    avgPrice: avgPrice,
                    limitPrice: avgPrice,
                    updated_at: Math.floor(now / 1000)
                };
            }
        },

        '/{symbol}/orderbook': {
            GET: () => {
                const levels = params.limit ? parseInt(params.limit) : 10;
                const asks = [], bids = [];
                for (let i = 0; i < levels; i++) {
                    asks.push([(marketPrice + spread + i * 25).toFixed(2), (0.01 + Math.random() * 0.05).toFixed(8)]);
                    bids.push([(marketPrice - spread - i * 25).toFixed(2), (0.01 + Math.random() * 0.05).toFixed(8)]);
                }
                return {asks, bids, timestamp: Math.floor(now / 1000)};
            }
        }
    };

    const handler = simulations[ep]?.[method];
    if (handler && typeof handler === 'function') return handler();
    return {success: true, data: null};
}

// =========================================
// ===== Trading Functions =================
async function placeOrder(orderDataOrSide, price, quantity = ORDER_SIZE, stopPrice = 0, cost = 100, externalId = null) {
    const MIN_QTY = 0.0000015;
    
    // Suporte para ambos: objeto orderData ou parâmetros individuais
    let orderData;
    if (typeof orderDataOrSide === 'object') {
        // Recebeu objeto orderData
        orderData = orderDataOrSide;
    } else {
        // Recebeu parâmetros individuais (modo legado)
        const side = orderDataOrSide;
        const qty = Math.max(quantity, MIN_QTY);
        const finalExternalId = externalId || `ORD_${Date.now()}`;
        
        orderData = {
            async: true,
            externalId: finalExternalId,
            limitPrice: price,
            qty: qty.toString(),
            side: side.toLowerCase(),
            stopPrice,
            type: 'limit'
        };
        if (side === 'buy') orderData.cost = cost;
    }

    log('INFO', `Placing ${orderData.side.toUpperCase()} order: ${orderData.qty} ${PAIR} at ${orderData.limitPrice || 'market price'}`);

    if (SIMULATE) {
        return simulateResponse(`/accounts/{accountId}/{symbol}/orders`, 'POST', {}, orderData);
    }

    await MercadoBitcoinAuth.ensureAuthenticated();
    const ticker = await getTicker();
    const limitPrice = Math.round(orderData.limitPrice || (orderData.side === 'buy' ? ticker.last * (1 - SPREAD_PCT) : ticker.last * (1 + SPREAD_PCT)));

    const finalOrderData = {
        ...orderData,
        limitPrice
    };
    log('INFO', `Final order parameters:`, finalOrderData);

    return makeRequest(`/accounts/${accountId}/${PAIR}/orders`, 'POST', {}, finalOrderData);
}

async function cancelOrder(orderId) {
    if (SIMULATE) return simulateResponse(`/accounts/{accountId}/{symbol}/orders/{orderId}`, 'DELETE', {orderId});
    return makeRequest(`/accounts/${accountId}/${PAIR}/orders/${orderId}`, 'DELETE');
}

async function getBalances() {
    if (SIMULATE) return simulateResponse(`/accounts/{accountId}/balances`, 'GET');
    if (!accountId) throw new Error('Account ID not set. Call authenticate() first.');
    return makeRequest(`/accounts/${accountId}/balances`);
}

async function getTicker() {
    const data = await makeRequest(`/tickers`, 'GET', {symbols: [PAIR]});
    return data[0];
}

async function getOrderBook(limit = 10) {
    if (SIMULATE) return simulateResponse(`/${PAIR}/orderbook`, 'GET', {limit});
    return makeRequest(`/${PAIR.replace('-', '')}/orderbook`, 'GET', {limit});
}

async function getOpenOrders() {
    if (SIMULATE) return simulateResponse(`/accounts/{accountId}/${PAIR}/orders`, 'GET');
    if (!accountId) throw new Error('Account ID not set. Call authenticate() first.');
    return makeRequest(`/accounts/${accountId}/${PAIR}/orders`, 'GET');
}

async function getOrderStatus(orderId) {
    if (SIMULATE) return simulateResponse(`/accounts/{accountId}/${PAIR}/orders/{orderId}`, 'GET', {orderId});
    return makeRequest(`/accounts/${accountId}/${PAIR}/orders/${orderId}`, 'GET');
}

async function getOrderHistory(limit = 10, status = 'filled') {
    if (SIMULATE) {
        // Histórico simulado → sempre retorna uma venda finalizada
        return [
            {
                id: `SIM_HIST_${Date.now()}`,
                side: 'sell',
                status: 'filled',
                qty: ORDER_SIZE.toString(),
                limitPrice: (300000 + Math.random() * 1000).toFixed(2),
                avgPrice: (300000 + Math.random() * 1000).toFixed(2),
                updated_at: Math.floor(Date.now() / 1000)
            }
        ];
    }

    if (!accountId) throw new Error('Account ID not set. Call authenticate() first.');

    return makeRequest(
        `/accounts/${accountId}/${PAIR}/orders`,
        'GET',
        {limit, status} // usa parâmetros da API
    );
}

async function sellAfterLastFilled() {
    const history = await getOrderHistory(5, 'filled');

    const lastFilledSell = history
        .filter(o => o.side === 'sell' && o.status === 'filled')
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];

    if (!lastFilledSell) {
        log('WARN', 'Nenhuma ordem de venda finalizada encontrada');
        return;
    }

    const price = parseFloat(lastFilledSell.limitPrice || lastFilledSell.avgPrice) * (1 + SPREAD_PCT);
    const qty = parseFloat(lastFilledSell.qty);

    const balances = await getBalances();
    const btcBalance = parseFloat(balances.find(b => b.symbol === 'BTC')?.available || 0);

    if (btcBalance < qty) {
        log('WARN', `Saldo insuficiente para emitir nova venda: disponível ${btcBalance}, necessário ${qty}`);
        return;
    }

    try {
        const newOrder = await placeOrder('sell', price, qty);
        log('INFO', `Nova venda emitida após venda finalizada:`, newOrder);
    } catch (err) {
        log('ERROR', 'Falha ao emitir nova venda:', err.message);
    }
}

// =========================================
// ===== Exports ===========================
module.exports = {
    authenticate: MercadoBitcoinAuth.authenticate,
    ensureAuthenticated: MercadoBitcoinAuth.ensureAuthenticated,
    getAccessToken: MercadoBitcoinAuth.getAccessToken,
    getAccountId: MercadoBitcoinAuth.getAccountId,
    placeOrder,
    cancelOrder,
    getBalances,
    getTicker,
    getOrderBook,
    getOpenOrders,
    getOrderStatus,
    getOrderHistory,
    sellAfterLastFilled,
    SIMULATE,
    PAIR,
    RATE_LIMIT_PER_SEC,
    ORDER_SIZE,
    SPREAD_PCT
};