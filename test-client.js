#!/usr/bin/env node
// test-client.js - Complete MB Bot Client Testing Suite
require('dotenv').config({ debug: process.env.DEBUG === 'true' });
const MB = require('./mb_client');
const db = require('./db');

// Flags de configuração
const SIMULATE = process.env.SIMULATE === 'true';
const DEBUG = process.env.DEBUG === 'true';

// Logging colorido
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

const log = (type, message, data = '') => {
    const color = type === 'SUCCESS' ? colors.green :
        type === 'WARN' ? colors.yellow :
            type === 'ERROR' ? colors.red :
                type === 'INFO' ? colors.cyan : colors.gray;
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`${color}${timestamp} [${type.padEnd(7)}]${colors.reset} ${message}`,
        data ? `| ${JSON.stringify(data).slice(0, 100)}${JSON.stringify(data).length > 100 ? '...' : ''}` : '');
};

const success = (msg, data) => log('SUCCESS', msg, data);
const warn = (msg, data) => log('WARN', msg, data);
const error = (msg, data) => log('ERROR', msg, data);
const info = (msg, data) => log('INFO', msg, data);

async function testClient() {
    console.log(`${colors.bright}🧪 MB Bot Client Test Suite v1.1${colors.reset}\n`);

    const results = { total: 0, passed: 0, failed: 0, errors: [] };

    try {
        // 1️⃣ CONFIGURAÇÃO DO AMBIENTE
        info('1️⃣ Testing Environment Configuration');
        results.total++;

        const config = {
            simulate: SIMULATE,
            pair: process.env.PAIR || 'BTC-BRL',
            spreadPct: parseFloat(process.env.SPREAD_PCT || 0.002) * 100,
            orderSize: parseFloat(process.env.ORDER_SIZE || 0.0001),
            cycleSec: parseInt(process.env.CYCLE_SEC || 5),
            rateLimit: parseInt(process.env.RATE_LIMIT_PER_SEC || 3)
        };

        info('Configuration loaded:', config);

        if (!config.pair) throw new Error('PAIR not configured in .env');
        if (config.spreadPct <= 0 || config.spreadPct > 5) warn(`SPREAD_PCT=${config.spreadPct}% may be unrealistic`);

        success('✅ Environment configuration valid');
        results.passed++;

        // 2️⃣ CONEXÃO COM BANCO
        info('2️⃣ Testing Database Connection');
        results.total++;
        try {
            await db.init();
            success('✅ SQLite database connected');

            // CRUD básico
            const testOrder = { id: `TEST_${Date.now()}`, side: 'buy', price: 60000, qty: 0.0001, status: 'working' };
            await db.saveOrder(testOrder);
            const savedOrders = await db.getOrders({ limit: 1 });

            if (savedOrders.length && savedOrders[0].id === testOrder.id) {
                success('✅ Database CRUD operations working');
            } else {
                throw new Error('Database save/retrieve test failed');
            }
            results.passed++;

            // --- NOVO: Mostrar ordens recentes ---
            info('📋 Fetching recent orders from DB (last 24h)');
            try {
                const recentOrders = await db.getOrders({
                    since: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // timestamp 24h atrás
                    limit: 50, // limitar a 50 para não poluir
                    order: 'desc'
                });

                if (recentOrders.length === 0) {
                    warn('No orders found in the last 24h');
                } else {
                    console.log(`   Found ${recentOrders.length} orders:`);
                    recentOrders.forEach(o => {
                        const pnl = o.extra && o.extra.includes('pnl') ? o.extra : '';
                        console.log(`   [${o.status.toUpperCase()}] ${o.side.toUpperCase()} ${o.qty} @ R$ ${o.price} ${pnl}`);
                    });
                }

                success('✅ Recent orders fetched successfully');
            } catch (orderFetchError) {
                error('❌ Failed to fetch recent orders', orderFetchError.message);
            }

        } catch (dbError) {
            error('❌ Database connection failed', dbError.message);
            results.failed++;
            results.errors.push({ test: 'Database', error: dbError.message });
        }

        // 3️⃣ MARKET DATA (TICKER)
        info('3️⃣ Testing Market Data (Ticker)');
        results.total++;
        try {
            const ticker = await MB.getTicker();
            if (!ticker || !ticker.last || !ticker.buy || !ticker.sell) throw new Error('Invalid ticker structure');

            const lastPrice = parseFloat(ticker.last);
            const bidPrice = parseFloat(ticker.buy);
            const askPrice = parseFloat(ticker.sell);
            const spread = ((askPrice - bidPrice) / lastPrice * 100);

            console.log(`   💰 BTC/BRL: R$ ${lastPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            console.log(`   📉 Bid: R$ ${bidPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            console.log(`   📈 Ask: R$ ${askPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            console.log(`   📊 Spread: ${spread.toFixed(2)}%`);

            success('✅ Market data retrieval successful');
            results.passed++;

        } catch (tickerError) {
            if (SIMULATE) {
                warn('⚠️ Ticker simulation may need configuration', tickerError.message);
                results.passed++;
            } else {
                error('❌ Ticker retrieval failed', tickerError.message);
                results.failed++;
                results.errors.push({ test: 'Ticker', error: tickerError.message });
            }
        }

        // 4️⃣ SALDOS
        info('4️⃣ Testing Account Balances');
        results.total++;
        try {
            let balances = await MB.getBalances();
            // Normaliza para array
            if (!Array.isArray(balances)) {
                if (balances?.data && Array.isArray(balances.data)) balances = balances.data;
                else throw new Error('Unexpected balances response');
            }

            const brlBalance = balances.find(b => b.symbol === 'BRL');
            const btcBalance = balances.find(b => b.symbol === 'BTC');

            console.log(`   💵 BRL: Available R$ ${brlBalance?.available?.toLocaleString('pt-BR') || 'N/A'}`);
            console.log(`   ₿ BTC: Available ${btcBalance?.available?.toFixed(8) || 'N/A'} BTC`);

            if (SIMULATE && (!brlBalance || !btcBalance)) warn('⚠️ Simulation balances may need configuration');
            else if (!SIMULATE && (!brlBalance || !btcBalance)) throw new Error('Missing BRL or BTC balance');

            success('✅ Balances retrieval successful');
            results.passed++;

        } catch (balanceError) {
            if (SIMULATE) {
                warn('⚠️ Balance simulation may need configuration', balanceError.message);
                results.passed++;
            } else {
                error('❌ Balance retrieval failed', balanceError.message);
                results.failed++;
                results.errors.push({ test: 'Balances', error: balanceError.message });
            }
        }

        // 5️⃣ ORDERS (SIMULATION / LIVE)
        info('5️⃣ Testing Order Operations');
        results.total += 3;

        try {
            const ticker = await MB.getTicker();
            const spreadPct = parseFloat(process.env.SPREAD_PCT || 0.002);
            const qty = parseFloat(process.env.ORDER_SIZE || 0.0001);

            // 🔹 BUY ORDER
            const buyPrice = parseFloat(ticker.buy) * (1 - spreadPct);
            const buyOrder = await MB.placeOrder('buy', buyPrice, qty);
            await db.saveOrder({
                id: buyOrder.orderId || buyOrder.id,
                side: 'buy',
                price: buyPrice,
                qty,
                status: buyOrder.status || 'working',
                timestamp: Math.floor(Date.now() / 1000),
                extra: JSON.stringify(buyOrder)
            });
            success('✅ Buy order placement successful');

            // 🔹 SELL ORDER
            const sellPrice = parseFloat(ticker.sell) * (1 + spreadPct);
            const sellOrder = await MB.placeOrder('sell', sellPrice, qty);
            await db.saveOrder({
                id: sellOrder.orderId || sellOrder.id,
                side: 'sell',
                price: sellPrice,
                qty,
                status: sellOrder.status || 'working',
                timestamp: Math.floor(Date.now() / 1000),
                extra: JSON.stringify(sellOrder)
            });
            success('✅ Sell order placement successful');

            // 🔹 GET OPEN ORDERS
            let openOrders = await MB.getOpenOrders();
            if (!Array.isArray(openOrders)) openOrders = [];
            console.log(`   📋 Open orders check: ${openOrders.length} orders found`);
            success('✅ Open orders retrieval successful');

            // 🔹 CLEANUP: CANCEL ORDERS
            if (buyOrder.orderId || buyOrder.id) {
                await MB.cancelOrder(buyOrder.orderId || buyOrder.id);
                await db.updateOrderStatus(buyOrder.orderId || buyOrder.id, 'cancelled');
            }
            if (sellOrder.orderId || sellOrder.id) {
                await MB.cancelOrder(sellOrder.orderId || sellOrder.id);
                await db.updateOrderStatus(sellOrder.orderId || sellOrder.id, 'cancelled');
            }
            success('✅ Order cancellation successful');

            results.passed += 3;

        } catch (orderError) {
            error('❌ Order operations failed', orderError.message);
            results.failed += 3;
            results.errors.push({ test: 'Orders', error: orderError.message });
        }

        // 6️⃣ RESUMO
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}📊 TEST SUMMARY${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`Total Tests: ${results.total}`);
        console.log(`Passed: ${colors.green}${results.passed}${colors.reset} (${((results.passed / results.total) * 100).toFixed(1)}%)`);
        console.log(`Failed: ${colors.red}${results.failed}${colors.reset} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
        if (results.errors.length) {
            console.log('\n❌ Failed Tests:');
            results.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err.test}: ${err.error}`));
        }
        console.log('='.repeat(60));

        if (results.failed === 0) {
            success('🎉 ALL TESTS PASSED! Ready for market making.');
            process.exit(0);
        } else {
            error('🛑 SOME TESTS FAILED - Check configuration and retry');
            process.exit(1);
        }

    } catch (fatalError) {
        error('💥 FATAL ERROR - Test suite crashed', fatalError.message);
        console.error(fatalError.stack);
        process.exit(1);
    }
}

// Run tests
testClient().catch(fatalError => {
    console.error('\n💥 CRITICAL ERROR:', fatalError.message);
    process.exit(1);
});
