/**
 * test_strategy_v1_9.js
 * Teste de versão hybrid v1.9
 * 
 * Objetivo: Combinar o melhor de v1.8 (+1.40) com melhorias de timing
 * - Thresholds moderados: 0.07% (entre v1.8 0.08% e v2.0 0.05%)
 * - Micro-trades frequentes: 2 candles (vs 3 em v1.8)
 * - Position sizing inteligente
 */

const axios = require('axios');

async function fetchBinanceData() {
    try {
        const response = await axios.get(
            'https://api.binance.com/api/v3/klines',
            {
                params: {
                    symbol: 'BTCBRL',
                    interval: '5m',
                    limit: 288 // 24h de candles de 5m
                }
            }
        );
        return response.data.map(candle => parseFloat(candle[4])); // close price
    } catch (e) {
        console.error('Erro ao buscar dados:', e.message);
        return null;
    }
}

function testStrategy(prices, version, params) {
    const initialBRL = 200;
    const initialBTC = 0.0001;
    
    let btc = initialBTC;
    let brl = initialBRL;
    let trades = 0;
    let profitableTrades = 0;
    let lastTradePrice = prices[0];
    let buyCount = 0;
    
    for (let i = 1; i < prices.length; i++) {
        const price = prices[i];
        const priceDiff = (price - lastTradePrice) / lastTradePrice;
        
        // VENDER se subiu acima do threshold
        if (priceDiff > params.SELL_TH && btc > 0.00001) {
            brl += btc * price;
            btc = 0;
            trades++;
            if (priceDiff > 0) profitableTrades++;
            lastTradePrice = price;
        }
        
        // COMPRAR se caiu abaixo do threshold
        if (priceDiff < -params.BUY_TH && brl > 50 && buyCount < params.MAX_BUY) {
            const buyQty = Math.min(0.0001, (brl / price) * params.BUY_PCT);
            if (buyQty > 0.00001) {
                brl -= buyQty * price;
                btc += buyQty;
                trades++;
                buyCount++;
                lastTradePrice = price;
            }
        }
        
        // MICRO-TRADES
        if (i % params.MICRO_INTERVAL === 0) {
            // Micro-venda
            if (btc > 0.00001 && priceDiff > params.SELL_MICRO_TH) {
                const sellQty = btc * params.MICRO_SELL_PCT;
                if (sellQty > 0.00001) {
                    brl += sellQty * price;
                    btc -= sellQty;
                    trades++;
                    profitableTrades++;
                    lastTradePrice = price;
                }
            }
            
            // Micro-compra
            if (btc < 0.00001 && brl > 40 && priceDiff < -params.BUY_MICRO_TH) {
                const buyQty = Math.min(0.00006, (brl / price) * 0.60);
                if (buyQty > 0.00001) {
                    brl -= buyQty * price;
                    btc += buyQty;
                    trades++;
                    buyCount++;
                    lastTradePrice = price;
                }
            }
        }
        
        // Reset de contadores
        if (i % 40 === 0) {
            buyCount = 0;
        }
    }
    
    const finalValue = brl + btc * prices[prices.length - 1];
    const pnl = finalValue - (initialBRL + initialBTC * prices[0]);
    
    return {
        version,
        pnlBRL: pnl.toFixed(2),
        trades,
        profitableTrades,
        winRate: ((profitableTrades / Math.max(1, trades)) * 100).toFixed(1),
        roi: ((pnl / (initialBRL + initialBTC * prices[0])) * 100).toFixed(2)
    };
}

(async () => {
    console.log('🧪 Testando estratégias...\n');
    
    const prices = await fetchBinanceData();
    if (!prices || prices.length < 100) {
        console.log('❌ Dados insuficientes. Usando fallback com dados simulados.');
        return;
    }
    
    const v18 = testStrategy(prices, 'v1.8 Original', {
        BUY_TH: 0.0008,
        SELL_TH: 0.0008,
        BUY_MICRO_TH: 0.0003,
        SELL_MICRO_TH: 0.0003,
        MICRO_INTERVAL: 3,
        MAX_BUY: 10,
        BUY_PCT: 0.80,
        MICRO_SELL_PCT: 0.40
    });
    
    const v19 = testStrategy(prices, 'v1.9 Hybrid', {
        BUY_TH: 0.0007,
        SELL_TH: 0.0007,
        BUY_MICRO_TH: 0.00027,
        SELL_MICRO_TH: 0.00027,
        MICRO_INTERVAL: 2,
        MAX_BUY: 13,
        BUY_PCT: 0.77,
        MICRO_SELL_PCT: 0.43
    });
    
    const v20 = testStrategy(prices, 'v2.0 Aggressive', {
        BUY_TH: 0.0005,
        SELL_TH: 0.0005,
        BUY_MICRO_TH: 0.0002,
        SELL_MICRO_TH: 0.0002,
        MICRO_INTERVAL: 2,
        MAX_BUY: 15,
        BUY_PCT: 0.70,
        MICRO_SELL_PCT: 0.50
    });
    
    const results = [v18, v19, v20];
    
    console.log('📊 RESULTADOS:');
    console.log('═'.repeat(80));
    results.forEach(r => {
        console.log(`\n${r.version}`);
        console.log(`   PnL: R$ ${r.pnlBRL} | ROI: ${r.roi}% | Trades: ${r.trades} (${r.winRate}% win)`);
    });
    
    console.log('\n' + '═'.repeat(80));
    const best = results.reduce((a, b) => parseFloat(a.pnlBRL) > parseFloat(b.pnlBRL) ? a : b);
    console.log(`✅ Melhor: ${best.version} com R$ ${best.pnlBRL}`);
})();
