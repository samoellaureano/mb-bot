/**
 * improved_entry_exit.js - Lógica Melhorada de Entrada e Saída
 * 
 * Implementa estratégias avançadas para:
 * - Timing de entrada baseado em momentum e confluência de indicadores
 * - Saída inteligente com trailing stop e take profit dinâmico
 * - Proteção contra reversões de tendência
 * - Gestão de risco adaptativa
 */

class ImprovedEntryExit {
    constructor(options = {}) {
        this.log = options.log || console.log;
        this.feeRate = options.feeRate || 0.003; // Maker fee 0.3%
        this.minProfit = this.feeRate * 3; // Mínimo 3x a taxa para lucro real
    }
    
    /**
     * Decide se deve entrar em uma posição (BUY)
     * Requer confluência de múltiplos sinais
     */
    shouldEnter(marketData) {
        const {
            rsi,
            emaShort,
            emaLong,
            macd,
            signal,
            volatility,
            trend,
            confidence,
            adx,
            orderbook
        } = marketData;
        
        const signals = {
            rsi: false,
            ema: false,
            macd: false,
            trend: false,
            adx: false,
            orderbook: false
        };
        
        let score = 0;
        const reasons = [];
        
        // 1. RSI em zona de sobrevenda (mas não extrema)
        if (rsi > 25 && rsi < 45) {
            signals.rsi = true;
            score += 20;
            reasons.push(`RSI favorável (${rsi.toFixed(1)})`);
        } else if (rsi < 25) {
            reasons.push(`RSI muito baixo (${rsi.toFixed(1)}) - aguardar recuperação`);
        }
        
        // 2. EMA cruzamento ou tendência positiva
        if (emaShort > emaLong || (emaShort > emaLong * 0.999)) {
            signals.ema = true;
            score += 25;
            reasons.push('EMA em tendência de alta');
        }
        
        // 3. MACD positivo ou prestes a cruzar
        if (macd > signal || (macd > signal * 0.95 && macd < signal)) {
            signals.macd = true;
            score += 20;
            reasons.push('MACD favorável');
        }
        
        // 4. Tendência geral positiva ou neutral (não bearish)
        if (trend !== 'down') {
            signals.trend = true;
            score += 15;
            reasons.push(`Tendência ${trend}`);
        }
        
        // 5. ADX indicando força de tendência
        if (adx > 20) {
            signals.adx = true;
            score += 10;
            reasons.push(`ADX forte (${adx.toFixed(1)})`);
        }
        
        // 6. Orderbook com pressão de compra
        if (orderbook && orderbook.imbalance > 0) {
            signals.orderbook = true;
            score += 10;
            reasons.push('Pressão de compra no orderbook');
        }
        
        // DECISÃO: Requer pelo menos 3 sinais positivos e score >= 60
        const signalCount = Object.values(signals).filter(s => s).length;
        const shouldEnter = signalCount >= 3 && score >= 60;
        
        return {
            shouldEnter,
            score,
            signalCount,
            signals,
            reasons,
            confidence: score / 100
        };
    }
    
    /**
     * Decide se deve sair de uma posição (SELL)
     * Considera lucro, stop-loss e reversão de tendência
     */
    shouldExit(position, marketData) {
        const {
            rsi,
            emaShort,
            emaLong,
            macd,
            signal,
            volatility,
            trend,
            midPrice
        } = marketData;
        
        const entryPrice = position.avgPrice || position.price;
        const currentProfit = (midPrice - entryPrice) / entryPrice;
        const minProfitTarget = this.minProfit; // 3x taxa
        
        const signals = {
            profit: false,
            stopLoss: false,
            reversal: false,
            rsiExtreme: false,
            emaReversal: false,
            macdReversal: false
        };
        
        let score = 0;
        const reasons = [];
        
        // 1. Lucro alvo atingido
        if (currentProfit >= minProfitTarget) {
            signals.profit = true;
            score += 50;
            reasons.push(`Lucro alvo atingido (${(currentProfit * 100).toFixed(2)}%)`);
        }
        
        // 2. Stop-loss (perda maior que 1%)
        if (currentProfit <= -0.01) {
            signals.stopLoss = true;
            score += 100; // Força saída imediata
            reasons.push(`Stop-loss hit (${(currentProfit * 100).toFixed(2)}%)`);
        }
        
        // 3. RSI em zona de sobrecompra
        if (rsi > 70) {
            signals.rsiExtreme = true;
            score += 30;
            reasons.push(`RSI sobrecompra (${rsi.toFixed(1)})`);
        }
        
        // 4. EMA reversão (curta caiu abaixo da longa)
        if (emaShort < emaLong && position.emaShortAtEntry && position.emaShortAtEntry > position.emaLongAtEntry) {
            signals.emaReversal = true;
            score += 40;
            reasons.push('EMA cruzou para baixo');
        }
        
        // 5. MACD reversão
        if (macd < signal && position.macdAtEntry && position.macdAtEntry > position.signalAtEntry) {
            signals.macdReversal = true;
            score += 35;
            reasons.push('MACD cruzou para baixo');
        }
        
        // 6. Tendência mudou para down
        if (trend === 'down' && position.trendAtEntry !== 'down') {
            signals.reversal = true;
            score += 45;
            reasons.push('Tendência reverteu para baixa');
        }
        
        // DECISÃO: Sai se stop-loss OU (lucro + 2 sinais de reversão) OU score >= 80
        const shouldExit = signals.stopLoss || 
                          (signals.profit && Object.values(signals).filter(s => s).length >= 3) ||
                          score >= 80;
        
        return {
            shouldExit,
            score,
            signals,
            reasons,
            currentProfit,
            profitBRL: currentProfit * entryPrice * position.qty
        };
    }
    
    /**
     * Calcula tamanho de ordem dinâmico baseado em risco
     * Maior volatilidade = menor posição
     */
    calculatePositionSize(balance, volatility, confidence) {
        const baseSize = 0.05; // 5% do saldo
        
        // Ajustar por volatilidade
        let volAdjustment = 1.0;
        if (volatility > 2.0) {
            volAdjustment = 0.5; // Reduz 50% em alta volatilidade
        } else if (volatility > 1.0) {
            volAdjustment = 0.75; // Reduz 25%
        } else if (volatility < 0.5) {
            volAdjustment = 1.2; // Aumenta 20% em baixa volatilidade
        }
        
        // Ajustar por confiança
        const confAdjustment = 0.5 + (confidence * 0.5); // 0.5x a 1.0x
        
        const finalSize = baseSize * volAdjustment * confAdjustment;
        
        return Math.max(0.02, Math.min(0.1, finalSize)); // Entre 2% e 10%
    }
    
    /**
     * Calcula stop-loss dinâmico
     * Mais largo em alta volatilidade
     */
    calculateDynamicStopLoss(volatility) {
        const baseStopLoss = 0.008; // 0.8%
        
        if (volatility > 2.0) {
            return baseStopLoss * 1.5; // 1.2% em alta volatilidade
        } else if (volatility > 1.0) {
            return baseStopLoss * 1.2; // 0.96%
        } else if (volatility < 0.5) {
            return baseStopLoss * 0.8; // 0.64% em baixa volatilidade
        }
        
        return baseStopLoss;
    }
    
    /**
     * Calcula take-profit dinâmico
     * Mais alto em tendências fortes
     */
    calculateDynamicTakeProfit(trend, adx, volatility) {
        const baseTakeProfit = this.minProfit; // 3x taxa (0.9%)
        
        // Tendência forte: take profit mais alto
        if (trend === 'up' && adx > 30) {
            return baseTakeProfit * 2; // 1.8%
        } else if (trend === 'up') {
            return baseTakeProfit * 1.5; // 1.35%
        } else if (trend === 'neutral') {
            return baseTakeProfit * 1.2; // 1.08%
        }
        
        // Tendência de baixa: take profit rápido
        return baseTakeProfit; // 0.9%
    }
    
    /**
     * Implementa trailing stop
     * Ajusta stop-loss conforme preço sobe
     */
    updateTrailingStop(position, currentPrice) {
        const entryPrice = position.avgPrice || position.price;
        const currentProfit = (currentPrice - entryPrice) / entryPrice;
        
        // Se já está com lucro > 1%, ativar trailing stop
        if (currentProfit > 0.01) {
            // Trailing stop: proteger 50% do lucro
            const trailingStop = entryPrice + (currentPrice - entryPrice) * 0.5;
            
            // Só atualiza se trailing stop é mais alto que o stop atual
            if (!position.trailingStop || trailingStop > position.trailingStop) {
                position.trailingStop = trailingStop;
                
                return {
                    updated: true,
                    trailingStop,
                    protectedProfit: (trailingStop - entryPrice) / entryPrice
                };
            }
        }
        
        return { updated: false };
    }
    
    /**
     * Valida se ordem deve ser colocada (pré-validação)
     */
    validateOrderPlacement(side, price, marketData) {
        const { midPrice, spread, volatility } = marketData;
        
        const errors = [];
        const warnings = [];
        
        // 1. Verificar se preço está muito distante do mercado
        const priceDiff = Math.abs(price - midPrice) / midPrice;
        if (priceDiff > 0.05) {
            errors.push(`Preço muito distante do mercado (${(priceDiff * 100).toFixed(2)}%)`);
        } else if (priceDiff > 0.02) {
            warnings.push(`Preço moderadamente distante (${(priceDiff * 100).toFixed(2)}%)`);
        }
        
        // 2. Verificar se spread cobre taxas
        if (spread < this.minProfit) {
            errors.push(`Spread muito apertado (${(spread * 100).toFixed(3)}%) - mínimo ${(this.minProfit * 100).toFixed(3)}%`);
        }
        
        // 3. Verificar volatilidade extrema
        if (volatility > 5.0) {
            warnings.push(`Volatilidade muito alta (${volatility.toFixed(2)}%) - risco elevado`);
        }
        
        const isValid = errors.length === 0;
        
        return {
            isValid,
            errors,
            warnings,
            shouldProceed: isValid && warnings.length < 2
        };
    }
}

module.exports = ImprovedEntryExit;
