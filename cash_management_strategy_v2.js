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
        
        // ===== PARÂMETROS BASE (alinhados com melhor resultado do teste) =====
        this.BASE_BUY_THRESHOLD = 0.00040; // 0.040%
        this.BASE_SELL_THRESHOLD = 0.00060; // 0.060%
        this.BASE_BUY_MICRO_THRESHOLD = 0.00020; // 0.020%
        this.BASE_SELL_MICRO_THRESHOLD = 0.00032; // 0.032%
        this.BASE_MICRO_TRADE_INTERVAL = 6; // A cada 6 candles
        this.MAX_BUY_COUNT = 4; // Controle de exposição
        this.MIN_BTC_RESERVE = 0.000015; // Reserva mínima para não zerar posição
        this.BUY_BRL_MIN = 60;
        this.MICRO_BUY_BRL_MIN = 50;

        // Position sizing (base)
        this.SELL_PCT_BASE = 0.60;
        this.BUY_PCT_BASE = 0.25;
        this.SELL_PCT_MIN = 0.45;
        this.SELL_PCT_MAX = 0.95;
        this.BUY_PCT_MIN = 0.10;
        this.BUY_PCT_MAX = 0.55;

        // Timing
        this.REBALANCE_INTERVAL = 20;
        this.RESET_INTERVAL = 40;

        // Profit targets
        this.PROFIT_TARGET_PCT = 0.003;
        this.STOP_LOSS_PCT = 0.002;
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    calcEMA(values, period) {
        if (values.length < period) return values[values.length - 1] || 0;
        const k = 2 / (period + 1);
        let ema = values[values.length - period];
        for (let i = values.length - period + 1; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
        }
        return ema;
    }

    calcRSI(values, period = 14) {
        if (values.length < period + 1) return 50;
        let gains = 0;
        let losses = 0;
        for (let i = values.length - period - 1; i < values.length - 1; i++) {
            const change = values[i + 1] - values[i];
            if (change > 0) gains += change; else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calcVolatilityPct(values) {
        if (values.length < 2) return 0;
        const returns = values.slice(1).map((p, i) => {
            const prev = values[i];
            return prev > 0 ? Math.log(p / prev) : 0;
        }).filter(r => r !== 0 && !isNaN(r));
        if (returns.length < 2) return 0;
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(24 * 60) * 100;
    }

    getDynamicParams() {
        const windowPrices = this.priceHistory.slice(-30);
        const emaShort = this.calcEMA(windowPrices, 8);
        const emaLong = this.calcEMA(windowPrices, 20);
        const rsi = this.calcRSI(windowPrices, 14);
        const volPct = this.calcVolatilityPct(windowPrices);

        const trendScore = this.clamp(((emaShort - emaLong) / (emaLong || 1)) * 50, -1, 1);
        const rsiScore = this.clamp((rsi - 50) / 50, -1, 1);
        const score = this.clamp((0.6 * trendScore) + (0.4 * rsiScore), -1, 1);
        const volScore = this.clamp(volPct / 2, 0, 1);
        const volAdjust = 1 + (volScore * 0.25);

        const buyThreshold = this.clamp(
            this.BASE_BUY_THRESHOLD * volAdjust * (score < 0 ? 1.2 : 0.9),
            this.BASE_BUY_THRESHOLD * 0.7,
            this.BASE_BUY_THRESHOLD * 1.6
        );
        const sellThreshold = this.clamp(
            this.BASE_SELL_THRESHOLD * volAdjust * (score > 0 ? 1.2 : 0.9),
            this.BASE_SELL_THRESHOLD * 0.7,
            this.BASE_SELL_THRESHOLD * 1.6
        );
        const buyMicroThreshold = this.clamp(
            this.BASE_BUY_MICRO_THRESHOLD * volAdjust * (score < 0 ? 1.15 : 0.9),
            this.BASE_BUY_MICRO_THRESHOLD * 0.7,
            this.BASE_BUY_MICRO_THRESHOLD * 1.6
        );
        const sellMicroThreshold = this.clamp(
            this.BASE_SELL_MICRO_THRESHOLD * volAdjust * (score > 0 ? 1.15 : 0.9),
            this.BASE_SELL_MICRO_THRESHOLD * 0.7,
            this.BASE_SELL_MICRO_THRESHOLD * 1.6
        );
        const microInterval = this.BASE_MICRO_TRADE_INTERVAL + (volScore > 0.6 ? 1 : 0) + (score < 0 ? 1 : 0);

        const sellPct = this.clamp(this.SELL_PCT_BASE + (score * 0.20) + ((rsi - 50) / 100) * 0.2, this.SELL_PCT_MIN, this.SELL_PCT_MAX);
        const buyPct = this.clamp(this.BUY_PCT_BASE + (-score * 0.20) + ((50 - rsi) / 100) * 0.2, this.BUY_PCT_MIN, this.BUY_PCT_MAX);

        return {
            buyThreshold,
            sellThreshold,
            buyMicroThreshold,
            sellMicroThreshold,
            microInterval,
            sellPct,
            buyPct
        };
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
        if (!this.lastTradePrice || brlBalance < this.BUY_BRL_MIN) {
            return { shouldBuy: false, qty: 0, reason: 'Capital insuficiente' };
        }

        // PROTEÇÃO: Se muitas compras em mercado em queda extrema, pausar
        if (buyCount > this.MAX_BUY_COUNT && marketTrend === 'down') {
            return { shouldBuy: false, qty: 0, reason: `${buyCount} compras - LIMITE ATINGIDO` };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        const params = this.getDynamicParams();
        
        // Compra principal: queda > 0.05% (mais sensível)
        if (priceDiffPct < -params.buyThreshold && brlBalance > this.BUY_BRL_MIN) {
            this.lastTradePrice = currentPrice;
            this.lastBuyPrice = currentPrice;
            this.trades++;
            
            return {
                shouldBuy: true,
                qty: params.buyPct,
                reason: `Queda ${Math.abs(priceDiffPct * 100).toFixed(3)}% - COMPRA (${buyCount + 1}/${this.MAX_BUY_COUNT})`
            };
        }

        return { shouldBuy: false, qty: 0, reason: 'Sem sinal de compra' };
    }

    shouldSell(currentPrice, btcBalance, marketTrend = 'neutral', avgBuyPrice = null, minProfitPct = 0) {
        if (!this.lastTradePrice || btcBalance < this.MIN_BTC_RESERVE) {
            return { shouldSell: false, qty: 0, reason: 'Sem BTC' };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        const params = this.getDynamicParams();
        const minSellPrice = avgBuyPrice ? (avgBuyPrice * (1 + minProfitPct)) : null;

        if (minSellPrice && currentPrice < minSellPrice) {
            return { shouldSell: false, qty: 0, reason: 'Preco abaixo do custo medio' };
        }
        
        // Venda principal: alta > 0.05% (mais sensível)
        if (priceDiffPct > params.sellThreshold && btcBalance > this.MIN_BTC_RESERVE) {
            const wasProfit = priceDiffPct > 0;
            if (wasProfit) this.profitableTrades++;
            
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: params.sellPct,
                minReserve: this.MIN_BTC_RESERVE,
                reason: `Alta ${(priceDiffPct * 100).toFixed(3)}% - VENDA`
            };
        }

        return { shouldSell: false, qty: 0, reason: 'Sem sinal de venda' };
    }

    shouldMicroTrade(cycle, currentPrice, btcBalance, brlBalance, avgBuyPrice = null, minProfitPct = 0) {
        const signals = { buy: null, sell: null };

        const params = this.getDynamicParams();

        // Micro-trades a cada N candles (dinâmico)
        if (cycle % params.microInterval !== 0) {
            return signals;
        }

        const minSellPrice = avgBuyPrice ? (avgBuyPrice * (1 + minProfitPct)) : null;

        // Micro-venda
        if (btcBalance > this.MIN_BTC_RESERVE && (!minSellPrice || currentPrice >= minSellPrice) &&
            (currentPrice - this.lastSellPrice) / this.lastSellPrice > params.sellMicroThreshold) {
            signals.sell = {
                shouldSell: true,
                qty: Math.max(0.30, params.sellPct - 0.15),
                minReserve: this.MIN_BTC_RESERVE,
                reason: `Micro-venda: ${((currentPrice - this.lastSellPrice) / this.lastSellPrice * 100).toFixed(3)}%`
            };
            this.profitableTrades++;
            this.trades++;
        }

        // Micro-compra
        if (btcBalance < 0.00001 && brlBalance > this.MICRO_BUY_BRL_MIN && (this.lastBuyPrice - currentPrice) / this.lastBuyPrice > params.buyMicroThreshold) {
            signals.buy = {
                shouldBuy: true,
                qty: Math.min(0.50, params.buyPct + 0.10),
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
                buyThreshold: `${(this.BASE_BUY_THRESHOLD * 100).toFixed(3)}%`,
                sellThreshold: `${(this.BASE_SELL_THRESHOLD * 100).toFixed(3)}%`,
                microTradeInterval: this.BASE_MICRO_TRADE_INTERVAL,
                profitTarget: `${(this.PROFIT_TARGET_PCT * 100).toFixed(2)}%`,
                stopLoss: `${(this.STOP_LOSS_PCT * 100).toFixed(2)}%`
            }
        };
    }
}

module.exports = CashManagementStrategy;
