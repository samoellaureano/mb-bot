/**
 * GRID TRADING LUCRATIVO
 * ═════════════════════════════════════════════════════════════════
 * Estratégia: Vender tudo nas altas, comprar tudo nas baixas
 * Objetivo: Lucrar com VOLATILIDADE, não com tendência
 * ═════════════════════════════════════════════════════════════════
 */

function testGridTradingProfitable(prices) {
    const initialBRL = 200;
    const initialBTC = 0.0001;
    
    let btc = initialBTC;
    let brl = initialBRL;
    
    const initialValue = brl + btc * prices[0];
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    
    let trades = 0;
    let profitableTrades = 0;
    
    // Histórico de posições
    let positions = [];
    
    // Calcular volatilidade local
    const calcVolatility = (priceArr, idx, lookback = 20) => {
        if (idx < lookback) return 0.02;
        const recentPrices = priceArr.slice(Math.max(0, idx - lookback), idx + 1);
        const minPrice = Math.min(...recentPrices);
        const maxPrice = Math.max(...recentPrices);
        const avgPrice = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
        return (maxPrice - minPrice) / avgPrice;
    };
    
    // Grid dinâmico baseado na volatilidade
    for (let i = 20; i < prices.length; i++) {
        const price = prices[i];
        const vol = calcVolatility(prices, i);
        
        // Cada vez que sai do grid, reagir
        // Se SOBE 0.5% → VENDER tudoo que tem
        // Se DESCE 0.7% → COMPRAR agressivo
        
        // Primeira pass: monitorar posições abertas
        positions = positions.filter(pos => {
            const priceDiff = (price - pos.entryPrice) / pos.entryPrice;
            
            // VENDER: Qualquer lucro de 0.3% ou mais
            if (priceDiff >= 0.003) {
                brl += pos.qty * price;
                btc -= pos.qty;
                trades++;
                profitableTrades++;
                return false;
            }
            
            // Fechar com pequena perda se houver volatilidade
            if (priceDiff < -0.002 && vol > 0.03) {
                brl += pos.qty * price;
                btc -= pos.qty;
                trades++;
                return false;
            }
            
            // Fechar no timeout
            if (i - pos.entryIdx > 20) {
                brl += pos.qty * price;
                btc -= pos.qty;
                trades++;
                if (priceDiff > 0) profitableTrades++;
                return false;
            }
            
            return true;
        });
        
        // Segunda pass: novos sinais de COMPRA/VENDA
        // Sinal de QUEDA = COMPRA AGRESSIVA
        if (i > 0 && brl > 50) {
            const priceDrop = (price - prices[i-1]) / prices[i-1];
            
            // Queda de 0.4% ou mais desde o anterior → BUY agressivo
            if (priceDrop < -0.004) {
                const qty = Math.min(0.00015, brl / price * 0.5);
                if (qty > 0.00001) {
                    brl -= qty * price;
                    btc += qty;
                    positions.push({
                        qty,
                        entryPrice: price,
                        entryIdx: i
                    });
                }
            }
        }
    }
    
    // Liquidar tudo no final ao preço final
    positions.forEach(pos => {
        brl += pos.qty * endPrice;
        btc -= pos.qty;
    });
    
    const finalValue = brl + btc * endPrice;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    // Comparação com HOLD
    const holdValue = initialBRL + initialBTC * endPrice;
    const holdPnL = holdValue - initialValue;
    
    return {
        testName: 'Grid Trading',
        pnlBRL: pnl.toFixed(2),
        holdPnLBRL: holdPnL.toFixed(2),
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        profitableTrades,
        winRate: trades > 0 ? ((profitableTrades / trades) * 100).toFixed(1) : '0',
        btcFinal: btc.toFixed(8),
        brlFinal: brl.toFixed(2),
        passed: pnl > 0
    };
}

// ═══════════════════════════════════════════════════════════════
// TESTE COM DADOS REAIS
// ═══════════════════════════════════════════════════════════════

async function runWithBinanceData() {
    const https = require('https');
    
    return new Promise((resolve) => {
        // Fetch 4h candles (288 candles = 24h no timeframe de 5m)
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
                    const prices = candles.map(c => parseFloat(c[4])); // Close price
                    const result = testGridTradingProfitable(prices);
                    resolve(result);
                } catch (e) {
                    console.error('Erro ao parsear:', e.message);
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null)).end();
    });
}

if (require.main === module) {
    runWithBinanceData().then(result => {
        if (!result) {
            console.log('❌ Erro ao buscar dados da Binance');
            return;
        }
        
        console.log('\n═══ GRID TRADING ═══\n');
        console.log('PnL:', 'R$', result.pnlBRL);
        console.log('ROI:', result.roi + '%');
        console.log('vs HOLD:', 'R$', result.holdPnLBRL);
        console.log('Trades:', result.trades);
        console.log('Win Rate:', result.winRate + '%');
        console.log('Status:', result.passed ? '✅ LUCRO' : '❌ PREJUÍZO');
    });
}

module.exports = { testGridTradingProfitable };
