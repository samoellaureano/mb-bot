/**
 * CashManagementStrategy.js
 * 
 * Estratégia de gerenciamento de caixa para trading de curto prazo
 * Objetivo: Maximizar lucros através de micro-trades frequentes
 * 
 * Lógica:
 * - Compra agressivamente em quedas > 0.075%
 * - Vende tudo em altas > 0.075%
 * - Executa micro-trades a cada 3 candles
 * - Rebalanceia a cada 20 candles
 */

class CashManagementStrategy {
    constructor() {
        this.priceHistory = [];
        this.lastTradePrice = null;
        this.lastSellPrice = null;
        this.lastBuyPrice = null;
        this.trades = 0;
        this.profitableTrades = 0;
        
        // Parâmetros da estratégia (ajustados para otimizar PnL)
        this.BUY_THRESHOLD = 0.00075; // 0.075% de queda
        this.SELL_THRESHOLD = 0.00075; // 0.075% de alta
        this.BUY_MICRO_THRESHOLD = 0.0004; // 0.04% para micro-compra
        this.SELL_MICRO_THRESHOLD = 0.0004; // 0.04% para micro-venda
        this.BUY_AMOUNT_PCT = 0.85; // 85% do BRL disponível
        this.SELL_AMOUNT_PCT = 1.0; // 100% do BTC
        this.MICRO_SELL_PCT = 0.35; // Vender 35% em micro-trades
        this.MICRO_BUY_PCT = 0.45; // Comprar 45% da capacidade em micro-trades
        this.MICRO_TRADE_INTERVAL = 3; // A cada 3 candles
        this.REBALANCE_INTERVAL = 20; // A cada 20 candles
    }

    /**
     * Atualiza histórico de preços
     */
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

    /**
     * Determina se deve fazer uma compra principal
     * Retorna: { shouldBuy: boolean, qty: number (em % do capital), reason: string }
     */
    shouldBuy(currentPrice, brlBalance, btcBalance) {
        if (!this.lastTradePrice || brlBalance < 50) {
            return { shouldBuy: false, qty: 0, reason: 'Capital insuficiente ou sem histórico' };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // Compra principal: queda > 0.075%
        if (priceDiffPct < -this.BUY_THRESHOLD && brlBalance > 50) {
            this.lastTradePrice = currentPrice;
            this.lastBuyPrice = currentPrice;
            this.trades++;
            
            return {
                shouldBuy: true,
                qty: this.BUY_AMOUNT_PCT,
                reason: `Queda de ${Math.abs(priceDiffPct * 100).toFixed(3)}% - COMPRA AGRESSIVA`
            };
        }

        return { shouldBuy: false, qty: 0, reason: 'Sem sinal de compra' };
    }

    /**
     * Determina se deve fazer uma venda principal
     * Retorna: { shouldSell: boolean, qty: number (em % do BTC), reason: string }
     */
    shouldSell(currentPrice, btcBalance) {
        if (!this.lastTradePrice || btcBalance < 0.00001) {
            return { shouldSell: false, qty: 0, reason: 'Sem BTC ou sem histórico' };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // Venda principal: alta > 0.075%
        if (priceDiffPct > this.SELL_THRESHOLD && btcBalance > 0.00001) {
            const wasProfit = (currentPrice - this.lastTradePrice) / this.lastTradePrice > 0;
            if (wasProfit) this.profitableTrades++;
            
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: this.SELL_AMOUNT_PCT,
                reason: `Alta de ${(priceDiffPct * 100).toFixed(3)}% - VENDA TOTAL`
            };
        }

        return { shouldSell: false, qty: 0, reason: 'Sem sinal de venda' };
    }

    /**
     * Micro-trades a cada 3 candles
     */
    shouldMicroTrade(cycle, currentPrice, btcBalance, brlBalance) {
        const signals = { buy: null, sell: null };

        if (cycle % this.MICRO_TRADE_INTERVAL !== 0) {
            return signals;
        }

        // Micro-venda: 0.04% de alta
        if (btcBalance > 0.00001 && (currentPrice - this.lastSellPrice) / this.lastSellPrice > this.SELL_MICRO_THRESHOLD) {
            signals.sell = {
                shouldSell: true,
                qty: this.MICRO_SELL_PCT,
                reason: `Micro-venda: ${((currentPrice - this.lastSellPrice) / this.lastSellPrice * 100).toFixed(3)}% de alta`
            };
            this.profitableTrades++;
            this.trades++;
        }

        // Micro-compra: 0.04% de queda
        if (btcBalance < 0.00001 && brlBalance > 40 && (this.lastBuyPrice - currentPrice) / this.lastBuyPrice > this.BUY_MICRO_THRESHOLD) {
            signals.buy = {
                shouldBuy: true,
                qty: this.MICRO_BUY_PCT,
                reason: `Micro-compra: ${((this.lastBuyPrice - currentPrice) / this.lastBuyPrice * 100).toFixed(3)}% de queda`
            };
            this.trades++;
        }

        return signals;
    }

    /**
     * Rebalanceamento forçado a cada 20 candles
     */
    shouldRebalance(cycle) {
        return cycle % this.REBALANCE_INTERVAL === 0 && cycle > 0;
    }

    /**
     * Gera relatório da estratégia
     */
    generateReport() {
        return {
            trades: this.trades,
            profitableTrades: this.profitableTrades,
            winRate: this.trades > 0 ? ((this.profitableTrades / this.trades) * 100).toFixed(1) : 0,
            parameters: {
                buyThreshold: `${(this.BUY_THRESHOLD * 100).toFixed(3)}%`,
                sellThreshold: `${(this.SELL_THRESHOLD * 100).toFixed(3)}%`,
                buyAmountPct: `${(this.BUY_AMOUNT_PCT * 100).toFixed(1)}%`,
                microTradeInterval: this.MICRO_TRADE_INTERVAL,
                rebalanceInterval: this.REBALANCE_INTERVAL
            }
        };
    }
}

module.exports = CashManagementStrategy;
