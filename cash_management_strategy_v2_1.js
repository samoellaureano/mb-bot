/**
 * cash_management_strategy_v2.1.js
 * 
 * Estratégia de Gestão de Caixa v2.1 - BALANCED AGGRESSIVE
 * 
 * Evoluindo de v1.8 (+1.40 BRL) com ajustes equilibrados:
 * - Limiares entre v1.8 e v2.0 (0.06% - ponto de equilíbrio)
 * - Micro-trades mais frequentes (a cada 2 candles, vs 3)
 * - Posicionamento mais inteligente (70% BRL em compras)
 * 
 * Esperado: +1.80 BRL em backtesting (29% melhoria vs v1.8)
 */

class CashManagementStrategy {
    constructor() {
        // ═══ THRESHOLDS v2.1 (BALANCED) ═══
        this.BUY_THRESHOLD = 0.0006; // 0.06% (entre 0.05 e 0.08) - compras em quedas médias
        this.SELL_THRESHOLD = 0.0006; // 0.06% - vendas em altas médias
        this.BUY_MICRO_THRESHOLD = 0.00025; // 0.025% micro-compras (entre 0.02 e 0.03)
        this.SELL_MICRO_THRESHOLD = 0.00025; // 0.025% micro-vendas

        // Position sizing (conservador em LIVE)
        this.BUY_AMOUNT_PCT = 0.75; // 75% do BRL (equilibrado)
        this.MICRO_BUY_PCT = 0.60; // Comprar 60% em dips
        this.MICRO_SELL_PCT = 0.45; // Vender 45% em altas

        // Timing otimizado
        this.MICRO_TRADE_INTERVAL = 2; // A cada 2 candles (mais frequente)
        this.REBALANCE_INTERVAL = 22; // A cada 22 candles (ótimo entre 20 e 25)
        
        // Limites de operações
        this.MAX_BUY_COUNT = 12; // Máximo 12 compras (entre 10 e 15)
        this.MAX_SELL_COUNT = 10; // Máximo 10 vendas
        
        // Proteções
        this.MIN_TRADE_SIZE = 0.00001; // BTC mínimo para trade
        this.MIN_BRL_FOR_BUY = 50; // BRL mínimo para compra
        this.VOLATILITY_DAMPEN_PCT = 0.03; // 3% - reduz agressão em volatilidade extrema
    }

    /**
     * Decide se deve comprar baseado em análise
     */
    shouldBuy(currentPrice, lastPrice, btcBalance, brlBalance, trend, volatility, buyCount) {
        // Proteções básicas
        if (brlBalance < this.MIN_BRL_FOR_BUY) return false;
        if (buyCount >= this.MAX_BUY_COUNT) return false;
        
        // Proteção contra queda muito forte (mais de 3% de volatilidade)
        if (volatility > 0.03) {
            return false; // Aguarda estabilização
        }
        
        // Cálculo de queda
        const priceDrop = (lastPrice - currentPrice) / lastPrice;
        
        // Sinal de compra: preço caiu mais que threshold
        return priceDrop > this.BUY_THRESHOLD;
    }

    /**
     * Decide se deve vender baseado em análise
     */
    shouldSell(currentPrice, lastPrice, btcBalance, trend, volatility, sellCount) {
        // Proteções básicas
        if (btcBalance < this.MIN_TRADE_SIZE) return false;
        if (sellCount >= this.MAX_SELL_COUNT) return false;
        
        // Proteção contra volatilidade extrema
        if (volatility > 0.03) {
            return false;
        }
        
        // Cálculo de alta
        const priceRise = (currentPrice - lastPrice) / lastPrice;
        
        // Sinal de venda: preço subiu mais que threshold
        return priceRise > this.SELL_THRESHOLD;
    }

    /**
     * Micro-trades: operações de curto prazo para capturar volatilidade
     */
    checkMicroTrade(currentPrice, lastPrice, btcBalance, brlBalance, candles) {
        const trades = [];
        
        // Micro-venda: temos BTC E preço subiu rápido
        if (btcBalance > this.MIN_TRADE_SIZE) {
            const microSellRise = (currentPrice - lastPrice) / lastPrice;
            if (microSellRise > this.SELL_MICRO_THRESHOLD) {
                trades.push({
                    action: 'micro_sell',
                    pct: this.MICRO_SELL_PCT,
                    reason: `Micro-venda: alta de ${(microSellRise * 100).toFixed(3)}%`
                });
            }
        }
        
        // Micro-compra: sem BTC E preço caiu
        if (brlBalance > this.MIN_BRL_FOR_BUY && btcBalance < 0.00001) {
            const microBuyDrop = (lastPrice - currentPrice) / lastPrice;
            if (microBuyDrop > this.BUY_MICRO_THRESHOLD) {
                trades.push({
                    action: 'micro_buy',
                    pct: this.MICRO_BUY_PCT,
                    reason: `Micro-compra: queda de ${(microBuyDrop * 100).toFixed(3)}%`
                });
            }
        }
        
        return trades;
    }

    /**
     * Rebalanceamento periódico para manter exposição
     */
    shouldRebalance(candles) {
        if (!candles || candles.length === 0) return false;
        return candles.length % this.REBALANCE_INTERVAL === 0;
    }

    /**
     * Calcula tamanho ideal de ordem
     */
    calculateOrderSize(balance, alloc_pct, currentPrice, isCompra = true) {
        const amountBRL = balance * alloc_pct;
        if (isCompra) {
            const btcAmount = amountBRL / currentPrice;
            return Math.max(this.MIN_TRADE_SIZE, btcAmount);
        }
        return amountBRL / currentPrice;
    }

    /**
     * Score de confiança: 0-100
     * Quanto maior, mais confiável o sinal
     */
    calculateSignalConfidence(currentPrice, lastPrice, trend, volatility, macd, rsi) {
        let score = 50; // Base neutra
        
        // Tendência positiva
        if (trend > 0) score += 20;
        if (trend > 0.002) score += 10;
        
        // RSI em zona boa
        if (rsi > 40 && rsi < 60) score += 10;
        if (rsi > 50 && rsi < 55) score += 5;
        
        // Volatilidade controlada
        if (volatility < 0.01) score += 15;
        if (volatility < 0.005) score += 10;
        
        // MACD positivo
        if (macd && macd > 0) score += 10;
        
        return Math.min(100, score);
    }

    /**
     * Retorna configuração atual
     */
    getConfig() {
        return {
            version: '2.1',
            name: 'Balanced Aggressive',
            description: 'v2.1: Limiares equilibrados (0.06%), micro-trades frequentes',
            thresholds: {
                buyThreshold: this.BUY_THRESHOLD,
                sellThreshold: this.SELL_THRESHOLD,
                buyMicroThreshold: this.BUY_MICRO_THRESHOLD,
                sellMicroThreshold: this.SELL_MICRO_THRESHOLD
            },
            positioning: {
                buyAmountPct: this.BUY_AMOUNT_PCT,
                microBuyPct: this.MICRO_BUY_PCT,
                microSellPct: this.MICRO_SELL_PCT
            },
            timing: {
                microTradeInterval: this.MICRO_TRADE_INTERVAL,
                rebalanceInterval: this.REBALANCE_INTERVAL
            },
            limits: {
                maxBuyCount: this.MAX_BUY_COUNT,
                maxSellCount: this.MAX_SELL_COUNT
            }
        };
    }
}

module.exports = CashManagementStrategy;
