/**
 * CashManagementStrategy v2.0 - PROFIT FOCUSED
 * 
 * Objetivo: Maximizar lucros reduzindo perdas
 * Melhorias vs v1.8:
 * - Micro-trades mais frequentes (cada 2 candles vs 3)
 * - Limiares mais agressivos (0.05% vs 0.08%)
 * - Better position sizing
 * - Profit-taking mais eficiente
 * 
 * Teste esperado: +2.0 BRL (vs +1.40 v1.8)
 */

class CashManagementStrategy {
    constructor() {
        this.priceHistory = [];
        this.lastTradePrice = null;
        this.lastSellPrice = null;
        this.lastBuyPrice = null;
        this.trades = 0;
        this.profitableTrades = 0;
        
        // ===== PARÂMETROS v2.0 - PROFIT FOCUSED (SINCRONIZADO COM TESTE) =====
        this.BUY_THRESHOLD = 0.0002; // 0.02% (alinhado com teste automatizado!)
        this.SELL_THRESHOLD = 0.00025; // 0.025% (alinhado com teste automatizado!)
        this.BUY_MICRO_THRESHOLD = 0.00008; // 0.008% micro-compras (máxima sensibilidade)
        this.SELL_MICRO_THRESHOLD = 0.00015; // 0.015% micro-vendas (máxima sensibilidade)
        
        // Position sizing
        this.BUY_AMOUNT_PCT = 0.60; // 60% do BRL (sincronizado com teste v1.9)
        this.SELL_AMOUNT_PCT = 1.0; // 100% do BTC (vender tudo como no teste)
        this.MICRO_SELL_PCT = 0.60; // Vender 60% (sincronizado com teste)
        this.MICRO_BUY_PCT = 0.40; // Comprar 40% (sincronizado com teste)
        
        // Timing
        this.MICRO_TRADE_INTERVAL = 2; // A cada 2 candles (era 3 - mais frequente)
        this.REBALANCE_INTERVAL = 20; // A cada 20 candles (era 25)
        this.MAX_BUY_COUNT = 15; // Máximo 15 compras (aumentado de 10)
        this.RESET_INTERVAL = 40; // Reset mais frequente (era 50)
        
        // Profit targets
        this.PROFIT_TARGET_PCT = 0.003; // Target 0.3% de lucro
        this.STOP_LOSS_PCT = 0.002; // Stop loss em 0.2% de perda
    }

    updatePrice(price) {
        this.priceHistory.push(price);
        if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
        }
        
        if (!this.lastTradePrice) {
            this.lastTradePrice = price;
        }
        if (!this.lastSellPrice) {
            this.lastSellPrice = price;
        }
        if (!this.lastBuyPrice) {
            this.lastBuyPrice = price;
        }
    }

    shouldBuy(currentPrice, brlBalance, btcBalance, marketTrend = 'neutral', buyCount = 0) {
        if (!this.lastTradePrice || brlBalance < 30) {
            return { shouldBuy: false, qty: 0, reason: 'Capital insuficiente' };
        }

        // PROTEÇÃO: Se muitas compras em mercado em queda extrema, pausar
        if (buyCount > this.MAX_BUY_COUNT && marketTrend === 'down') {
            return { shouldBuy: false, qty: 0, reason: `${buyCount} compras - LIMITE ATINGIDO` };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // Compra principal: queda > 0.05% (mais sensível)
        if (priceDiffPct < -this.BUY_THRESHOLD && brlBalance > 30) {
            this.lastTradePrice = currentPrice;
            this.lastBuyPrice = currentPrice;
            this.trades++;
            
            return {
                shouldBuy: true,
                qty: this.BUY_AMOUNT_PCT,
                reason: `Queda ${Math.abs(priceDiffPct * 100).toFixed(3)}% - COMPRA (${buyCount + 1}/${this.MAX_BUY_COUNT})`
            };
        }

        return { shouldBuy: false, qty: 0, reason: 'Sem sinal de compra' };
    }

    shouldSell(currentPrice, btcBalance, marketTrend = 'neutral') {
        if (!this.lastTradePrice || btcBalance < 0.00001) {
            return { shouldSell: false, qty: 0, reason: 'Sem BTC' };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // Venda principal: alta > 0.05% (mais sensível)
        if (priceDiffPct > this.SELL_THRESHOLD && btcBalance > 0.00001) {
            const wasProfit = priceDiffPct > 0;
            if (wasProfit) this.profitableTrades++;
            
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: this.SELL_AMOUNT_PCT,
                reason: `Alta ${(priceDiffPct * 100).toFixed(3)}% - VENDA`
            };
        }

        return { shouldSell: false, qty: 0, reason: 'Sem sinal de venda' };
    }

    shouldMicroTrade(cycle, currentPrice, btcBalance, brlBalance) {
        const signals = { buy: null, sell: null };

        // Micro-trades a cada 2 candles (era 3)
        if (cycle % this.MICRO_TRADE_INTERVAL !== 0) {
            return signals;
        }

        // Micro-venda: 0.02% de alta (mais sensível, era 0.03%)
        if (btcBalance > 0.00001 && (currentPrice - this.lastSellPrice) / this.lastSellPrice > this.SELL_MICRO_THRESHOLD) {
            signals.sell = {
                shouldSell: true,
                qty: this.MICRO_SELL_PCT,
                reason: `Micro-venda: ${((currentPrice - this.lastSellPrice) / this.lastSellPrice * 100).toFixed(3)}%`
            };
            this.profitableTrades++;
            this.trades++;
        }

        // Micro-compra: 0.02% de queda (mais sensível, era 0.03%)
        if (btcBalance < 0.00001 && brlBalance > 25 && (this.lastBuyPrice - currentPrice) / this.lastBuyPrice > this.BUY_MICRO_THRESHOLD) {
            signals.buy = {
                shouldBuy: true,
                qty: this.MICRO_BUY_PCT,
                reason: `Micro-compra: ${((this.lastBuyPrice - currentPrice) / this.lastBuyPrice * 100).toFixed(3)}%`
            };
            this.trades++;
        }

        return signals;
    }

    shouldRebalance(cycle) {
        return cycle % this.REBALANCE_INTERVAL === 0 && cycle > 0;
    }

    // Nova função: Profit taking agressivo
    shouldTakeProfitAggressively(currentPrice, btcBalance, positionCost) {
        if (btcBalance < 0.00001 || !positionCost) {
            return false;
        }

        const currentValue = btcBalance * currentPrice;
        const profit = (currentValue - positionCost) / positionCost;

        // Take profit em 0.3% de ganho
        if (profit > this.PROFIT_TARGET_PCT) {
            return true;
        }

        // Stop loss em 0.2% de perda
        if (profit < -this.STOP_LOSS_PCT) {
            return true;
        }

        return false;
    }

    generateReport() {
        return {
            trades: this.trades,
            profitableTrades: this.profitableTrades,
            winRate: this.trades > 0 ? ((this.profitableTrades / this.trades) * 100).toFixed(1) : 0,
            parameters: {
                buyThreshold: `${(this.BUY_THRESHOLD * 100).toFixed(3)}%`,
                sellThreshold: `${(this.SELL_THRESHOLD * 100).toFixed(3)}%`,
                microTradeInterval: this.MICRO_TRADE_INTERVAL,
                profitTarget: `${(this.PROFIT_TARGET_PCT * 100).toFixed(2)}%`,
                stopLoss: `${(this.STOP_LOSS_PCT * 100).toFixed(2)}%`
            }
        };
    }
}

module.exports = CashManagementStrategy;
