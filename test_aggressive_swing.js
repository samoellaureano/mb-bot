/**
 * TESTE DE SWING TRADING AGRESSIVO
 * ═════════════════════════════════════════════════════════════════
 * OBJETIVO: Gerar LUCRO POSITIVO mesmo em mercado em queda
 * ESTRATÉGIA: Ondas curtas + gerenciamento dinâmico
 * ═════════════════════════════════════════════════════════════════
 */

/**
 * Estratégia: Detectar micro-ondas de alta e vender no topo
 * - Não tentar comprar no fundo perfeito
 * - Aproveitar qualquer onda de alta
 * - Gerenciar risco com stop loss dinâmico
 */
function testAggressiveSwingTrading(prices) {
    let btc = 0.0001;
    let brl = 200;
    
    const initialValue = brl + btc * prices[0];
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const holdValue = initialValue + btc * (endPrice - startPrice);
    const holdPnL = holdValue - initialValue;
    
    let positions = [];  // {qty, entryPrice, entryIdx}
    let trades = 0;
    let winTrades = 0;
    let lossTrades = 0;
    
    // Análise de tendência local
    const calcTrend = (prices, idx, lookback = 10) => {
        if (idx < lookback) return 'UP';
        const recentPrices = prices.slice(idx - lookback, idx + 1);
        const firstPrice = recentPrices[0];
        const lastPrice = recentPrices[recentPrices.length - 1];
        return lastPrice > firstPrice * 1.002 ? 'UP' : 'DOWN';
    };
    
    // RSI simples (14 períodos)
    const calcRSI = (prices, idx) => {
        if (idx < 14) return 50;
        const changes = [];
        for (let i = idx - 14; i < idx; i++) {
            changes.push(prices[i + 1] - prices[i]);
        }
        const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0);
        const losses = -changes.filter(c => c < 0).reduce((a, b) => a + b, 0);
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rs = avgGain / (avgLoss || 0.0001);
        return 100 - (100 / (1 + rs));
    };
    
    // Detectar reversão de alta
    const isUpreversal = (prices, idx) => {
        if (idx < 3) return false;
        // Vale: prev > curr E curr < next
        return prices[idx - 1] > prices[idx] && prices[idx] < prices[idx + 1];
    };
    
    // Executar a cada 2 candles para evitar noise
    for (let i = 20; i < prices.length - 1; i += 2) {
        const price = prices[i];
        const rsi = calcRSI(prices, i);
        const trendIsUp = calcTrend(prices, i) === 'UP';
        
        // ═══ LÓGICA DE COMPRA ═══
        if (brl > 50 && !trendIsUp) {
            // Comprar em revertidas de QUEDA
            if (isUpreversal(prices, i) && rsi < 60) {
                const qty = Math.min(0.0001, brl / price * 0.4);
                if (qty > 0.00001) {
                    brl -= qty * price;
                    positions.push({
                        qty,
                        entryPrice: price,
                        entryIdx: i,
                        maxPriceAfterEntry: price
                    });
                }
            }
        }
        
        // ═══ LÓGICA DE VENDA ═══
        positions = positions.filter(pos => {
            const pnlPct = (price - pos.entryPrice) / pos.entryPrice;
            const timeHeld = i - pos.entryIdx;
            
            // Atualizar máximo alcançado
            if (price > pos.maxPriceAfterEntry) {
                pos.maxPriceAfterEntry = price;
            }
            
            // CRITÉRIOS PARA VENDER:
            // 1. Lucro de +0.3% OU
            const shouldSellSmallProfit = pnlPct > 0.003;
            
            // 2. Máximo de 10 candles na posição
            const shouldSellTimeout = timeHeld > 10;
            
            // 3. Queda de 0.1% desde o máximo
            const maxDrawdownFromPeak = (pos.maxPriceAfterEntry - price) / pos.maxPriceAfterEntry;
            const shouldSellDrawdown = maxDrawdownFromPeak > 0.001;
            
            // 4. Stop loss agressivo
            const shouldSellStopLoss = pnlPct < -0.005;
            
            if (shouldSellSmallProfit || (shouldSellTimeout && pnlPct > -0.001) || shouldSellDrawdown || shouldSellStopLoss) {
                brl += pos.qty * price;
                btc -= pos.qty;
                trades++;
                
                if (pnlPct > 0) winTrades++;
                else if (pnlPct < -0.001) lossTrades++;
                
                return false;
            }
            
            return true;
        });
    }
    
    // Fechar posições abertas no final
    positions.forEach(pos => {
        const finalPrice = prices[prices.length - 1];
        brl += pos.qty * finalPrice;
        btc -= pos.qty;
        trades++;
    });
    
    const finalValue = brl + btc * endPrice;
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    return {
        testName: 'Swing Trading Agressivo',
        pnlBRL: pnl.toFixed(2),
        holdPnLBRL: holdPnL.toFixed(2),
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        winTrades,
        lossTrades,
        winRate: trades > 0 ? ((winTrades / trades) * 100).toFixed(1) : '0',
        btcFinal: btc.toFixed(8),
        brlFinal: brl.toFixed(2),
        passed: pnl > 0 || roi > priceChange
    };
}

// ═══════════════════════════════════════════════════════════════
// TESTE RÁPIDO
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
    // Gerar dados de teste: queda de 3.91%
    const prices = [];
    const startPrice = 490000;
    let price = startPrice;
    for (let i = 0; i < 288; i++) {
        // Simular queda com ondas
        const timePercent = i / 288;
        const mainTrend = -3.91; // Queda total
        const wave = 2 * Math.sin(timePercent * Math.PI * 4); // 4 ondas
        price = startPrice * (1 + (mainTrend + wave) / 100);
        prices.push(price);
    }
    
    const result = testAggressiveSwingTrading(prices);
    console.log('\n═══ TESTE DE SWING TRADING AGRESSIVO ═══\n');
    console.log('PnL:', 'R$', result.pnlBRL);
    console.log('ROI:', result.roi + '%');
    console.log('vs HOLD:', 'R$', result.holdPnLBRL);
    console.log('Price Change:', result.priceChange + '%');
    console.log('Trades:', result.trades);
    console.log('Win Rate:', result.winRate + '%');
    console.log('Status:', result.passed ? '✅ LUCRO' : '❌ PREJUÍZO');
}

module.exports = { testAggressiveSwingTrading };
