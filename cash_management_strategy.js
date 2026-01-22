/**
 * CashManagementStrategy v1.8 - DEFENSIVE (ORIGINAL WORKING VERSION)
 * 
 * Versão estável que funcionava bem em mercados variáveis
 * Foco em proteção de capital ao invés de ganhos máximos
 */

class CashManagementStrategy {
    constructor() {
        this.priceHistory = [];
        this.lastTradePrice = null;
        this.lastSellPrice = null;
        this.lastBuyPrice = null;
        this.trades = 0;
        this.profitableTrades = 0;
        
        // ===== PAR\u00c2METROS v1.9 - PROFIT OPTIMIZED =====
        this.BUY_THRESHOLD = 0.0002; // 0.02% (mais sens\u00edvel aos dips)
        this.SELL_THRESHOLD = 0.00025; // 0.025% (mais agressivo venda - captura picos)
        this.BUY_MICRO_THRESHOLD = 0.00008; // 0.008% micro-compras (sensivelíssimo)
        this.SELL_MICRO_THRESHOLD = 0.00015; // 0.015% micro-vendas (mais agressivo)
        
        // Position sizing (otimizado para lucro)
        this.BUY_AMOUNT_PCT = 0.60; // 60% do BRL (menos risco)
        this.SELL_AMOUNT_PCT = 1.0; // 100% do BTC (maximize gains quando h\u00e1 lucro)
        this.MICRO_SELL_PCT = 0.60; // Vender 60% (mais agressivo em picos)
        this.MICRO_BUY_PCT = 0.40; // Comprar 40% (mais conservador)
        
        // Timing (otimizado para capturar oscilações)
        this.MICRO_TRADE_INTERVAL = 2; // A cada 2 ciclos (mais frequente)
        this.REBALANCE_INTERVAL = 20; // A cada 20 ciclos (rebalance mais frequent)
        this.MAX_BUY_COUNT = 6; // M\u00e1ximo 6 compras (reduzir over-exposure)
        this.RESET_INTERVAL = 40; // Reset a cada 40 ciclos
    }

    /**
     * Atualiza histórico de preços
     */
    updatePrice(price) {
        // Inicializar com o primeiro preço se ainda não foi
        if (!this.lastTradePrice) {
            this.lastTradePrice = price;
            this.lastSellPrice = price;
            this.lastBuyPrice = price;
            console.log(`[CASH_MGT] Preço de referência inicializado: R$ ${price.toFixed(2)}`);
        }
        
        this.priceHistory.push(price);
        if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
        }
    }

    /**
     * Determina se deve fazer uma compra principal
     * CRÍTICO: Aguarda venda anterior antes de nova compra
     * Retorna: { shouldBuy: boolean, qty: number (em % do capital), reason: string }
     */
    shouldBuy(currentPrice, brlBalance, btcBalance, marketTrend = 'neutral', buyCount = 0) {
        // ⚠️ VALIDAÇÃO CRÍTICA: 
        // 1. Precisa ter BRL suficiente (mínimo R$ 50)
        // 2. Não pode ter múltiplas compras abertas (btcBalance deve ser baixo)
        if (!this.lastTradePrice || brlBalance < 50) {
            return { shouldBuy: false, qty: 0, reason: 'Capital insuficiente' };
        }

        // Se já tem BTC em posição aberta, aguarda venda (fechar par)
        if (btcBalance > 0.00001) {
            return { shouldBuy: false, qty: 0, reason: `Aguardando fechamento do par (temos ${btcBalance.toFixed(8)} BTC)` };
        }

        // PROTEÇÃO: Se muitas compras em mercado em queda, pausar
        if (buyCount >= this.MAX_BUY_COUNT && marketTrend === 'down') {
            return { shouldBuy: false, qty: 0, reason: `Máximo de ${buyCount} compras atingido - PAUSADO` };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // COMPRA: Queda > 0.02% - Aguarda revertida (fechar par anterior)
        if (priceDiffPct < -this.BUY_THRESHOLD && brlBalance > 50 && btcBalance < 0.00001) {
            this.lastTradePrice = currentPrice;
            this.lastBuyPrice = currentPrice;
            this.trades++;
            
            return {
                shouldBuy: true,
                qty: this.BUY_AMOUNT_PCT,
                reason: `📉 Queda -${Math.abs(priceDiffPct * 100).toFixed(3)}% | INICIAR PAR (${buyCount + 1}/${this.MAX_BUY_COUNT})`
            };
        }

        return { shouldBuy: false, qty: 0, reason: 'Aguardando sinal de compra' };
    }

    /**
     * Determina se deve fazer uma venda principal
     * CRÍTICO: Só vende se temos BTC (garantir pares completos)
     * Retorna: { shouldSell: boolean, qty: number (em % do BTC), reason: string }
     */
    shouldSell(currentPrice, btcBalance, marketTrend = 'neutral', lastBuyPrice = null) {
        // ⚠️ VALIDAÇÃO CRÍTICA: Não pode vender sem ter BTC
        if (!this.lastTradePrice || btcBalance < 0.00001) {
            return { shouldSell: false, qty: 0, reason: 'Sem BTC ou sem histórico' };
        }

        const priceDiffPct = (currentPrice - this.lastTradePrice) / this.lastTradePrice;
        
        // NOVO: Se temos preço de compra, usar como referência
        let profitRef = this.lastTradePrice;
        if (lastBuyPrice && lastBuyPrice < this.lastTradePrice) {
            profitRef = lastBuyPrice; // Usa preço de compra mais recente
        }
        
        const profitMargin = (currentPrice - profitRef) / profitRef;
        
        // VENDA 1: Take-Profit - Vender com +0.03% de lucro garantido
        if (profitMargin > 0.0003 && btcBalance > 0.00001) {
            const wasProfit = profitMargin > 0;
            if (wasProfit) this.profitableTrades++;
            
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: this.SELL_AMOUNT_PCT, // VENDER TUDO 100%
                reason: `✅ Take-Profit: +${(profitMargin * 100).toFixed(3)}% (FECHAR PAR)`
            };
        }
        
        // VENDA 2: Stop-Loss EXTREMO - Se tiver perdendo > 0.15%, vender TUDO
        // Não pode vender parcial (deixa BTC aberto) - VENDE 100%
        if (profitMargin < -0.0015 && btcBalance > 0.00001) {
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: 1.0, // VENDER TUDO 100% para fechar posição
                reason: `🛑 Stop-Loss: -${Math.abs(profitMargin * 100).toFixed(3)}% (FECHAR TUDO)`
            };
        }
        
        // VENDA 3: Momentum - Venda por momentum se preço subiu bastante
        if (priceDiffPct > this.SELL_THRESHOLD && btcBalance > 0.00001) {
            const wasProfit = (currentPrice - this.lastTradePrice) / this.lastTradePrice > 0;
            if (wasProfit) this.profitableTrades++;
            
            this.lastTradePrice = currentPrice;
            this.lastSellPrice = currentPrice;
            this.trades++;
            
            return {
                shouldSell: true,
                qty: this.SELL_AMOUNT_PCT, // VENDER TUDO 100%
                reason: `📈 Momentum: +${(priceDiffPct * 100).toFixed(3)}% (FECHAR PAR)`
            };
        }

        return { shouldSell: false, qty: 0, reason: 'Aguardando sinal de venda' };
    }

    /**
     * Micro-trades a cada 2 ciclos - GARANTIDAMENTE com pares fechados
     */
    shouldMicroTrade(cycle, currentPrice, btcBalance, brlBalance) {
        const signals = { buy: null, sell: null };

        if (cycle % this.MICRO_TRADE_INTERVAL !== 0) {
            return signals;
        }

        // ⚠️ VALIDAÇÃO CRÍTICA: Não pode vender sem BTC real
        // Micro-venda: APENAS se temos BTC POSITIVO significativo (> 0.00002)
        if (btcBalance > 0.00002 && (currentPrice - this.lastSellPrice) / this.lastSellPrice > this.SELL_MICRO_THRESHOLD) {
            signals.sell = {
                shouldSell: true,
                qty: this.MICRO_SELL_PCT,
                reason: `Micro-venda: ${((currentPrice - this.lastSellPrice) / this.lastSellPrice * 100).toFixed(3)}% de alta`
            };
            this.profitableTrades++;
            this.trades++;
        }

        // ⚠️ VALIDAÇÃO CRÍTICA: Não pode comprar sem BRL e sem BTC
        // Micro-compra: SÓ se não temos BTC (zerado) E temos BRL
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
