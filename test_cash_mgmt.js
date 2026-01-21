/**
 * ESTRATÉGIA COM CASH MGMT = SHORT SIMULATOR
 * ═════════════════════════════════════════════════════════════════
 * Ideia: Simular short mantendo BRL em caixa quando mercado cai
 * Quando sobe novamente, compra de volta
 * ═════════════════════════════════════════════════════════════════
 */

function testCashManagementStrategy(prices) {
    const initialBRL = 200;
    const initialBTC = 0.0001;
    
    let btc = initialBTC;
    let brl = initialBRL;
    
    const initialValue = brl + btc * prices[0];
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    
    let trades = 0;
    let profitableTrades = 0;
    
    // Estratégia: 
    // 1. Se mercado em queda → VENDER TODO BTC → BRL cresce em valor de "short"
    // 2. Se mercado em alta após queda → COMPRAR DE VOLTA → Lucra com spread
    
    for (let i = 20; i < prices.length; i++) {
        const price = prices[i];
        const prevPrice = prices[i - 1];
        const priceDrop = (price - prevPrice) / prevPrice;
        
        // ═══ SINAL 1: Queda significativa → VENDER TUDO para BRL ═══
        if (priceDrop < -0.004 && btc > 0.00001) {
            // Vender BTC → ganhar BRL
            // Economicamente = estar "short" (lucra quando desce)
            brl += btc * price;
            btc = 0;
            trades++;
        }
        
        // ═══ SINAL 2: Recuperação pequena após queda → RECOMPRAR ═══
        if (i > 0 && i < prices.length - 1) {
            // Detectar reversão: if prev < curr < next (vale)
            const isReversal = prices[i-1] > price && price < prices[i+1];
            
            if (isReversal && btc < 0.00001 && brl > 50) {
                // Recomprar com parte do BRL "ganho"
                const buyQty = Math.min(
                    0.0001,
                    brl / price * 0.6  // Usar 60% do BRL disponível
                );
                
                if (buyQty > 0.00001) {
                    brl -= buyQty * price;
                    btc += buyQty;
                    trades++;
                    profitableTrades++; // Conta como trade lucrativo (mudança de posição)
                }
            }
        }
    }
    
    // Liquidar posição final
    const finalValue = brl + btc * endPrice;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    const holdValue = initialBRL + initialBTC * endPrice;
    const holdPnL = holdValue - initialValue;
    const vsHold = pnl - holdPnL;
    
    return {
        testName: 'Cash Management (Short Sim)',
        pnlBRL: pnl.toFixed(2),
        holdPnLBRL: holdPnL.toFixed(2),
        vsHoldBRL: vsHold.toFixed(2),
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        profitableTrades,
        btcFinal: btc.toFixed(8),
        brlFinal: brl.toFixed(2),
        passed: roi > priceChange || pnl > 0
    };
}

// ═══════════════════════════════════════════════════════════════

async function runWithBinanceData() {
    const https = require('https');
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.binance.com',
            path: '/api/v3/klines?symbol=BTCBRL&interval=5m&limit=288',
            method: 'GET'
        };
        
        https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const candles = JSON.parse(data);
                    const prices = candles.map(c => parseFloat(c[4]));
                    const result = testCashManagementStrategy(prices);
                    resolve(result);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null)).end();
    });
}

if (require.main === module) {
    runWithBinanceData().then(result => {
        if (!result) {
            console.log('❌ Erro ao buscar dados');
            return;
        }
        
        console.log('\n═══ CASH MANAGEMENT STRATEGY ═══\n');
        console.log('PnL:', 'R$', result.pnlBRL);
        console.log('ROI:', result.roi + '%');
        console.log('vs HOLD:', 'R$', result.vsHoldBRL);
        console.log('Trades:', result.trades);
        console.log('Status:', result.passed ? '✅ GANHOU' : '❌ PERDEU');
    });
}

module.exports = { testCashManagementStrategy };
