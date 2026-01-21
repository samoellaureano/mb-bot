// ════════════════════════════════════════════════════════════════
// BTC ACCUMULATOR - Sistema de Acumulação de BTC
// ════════════════════════════════════════════════════════════════
//
// Objetivo Principal:
//   • MAXIMIZAR holdings de BTC
//   • MINIMIZAR holdings de BRL
//   • Comprar nas quedas, resistir a vender nas altas
//
// Mecanismos:
//   1. Smart DCA - Compra automática em quedas
//   2. Sell Resistance - Bloqueio de vendas em condições desfavoráveis
//   3. BRL Depletion - Prioridade para gastar BRL
//   4. Accumulation Targets - Metas de acumulação
//   5. Price Memory - Histórico para identificar oportunidades
// ════════════════════════════════════════════════════════════════

class BTCAccumulator {
    constructor(options = {}) {
        // Configurações de acumulação
        this.config = {
            // Alvo mínimo de BTC a manter
            minBTCTarget: options.minBTCTarget || 0.0005,
            
            // Máximo de BRL a manter (acima disso, converte para BTC)
            maxBRLHolding: options.maxBRLHolding || 50,
            
            // Percentual mínimo de queda para ativar DCA (AUMENTADO para ser mais conservador)
            dcaDropThreshold: options.dcaDropThreshold || 0.005, // OTIMIZADO: 0.5% (era 1.2% muito conservador)
            
            // Múltiplo de quantidade em DCA
            dcaMultiplier: options.dcaMultiplier || 1.5,
            
            // Resistência a venda (0 = sem resistência, 1 = máxima)
            sellResistance: options.sellResistance || 0.7,
            
            // Percentual mínimo de lucro para permitir SELL
            minProfitToSell: options.minProfitToSell || 0.008, // 0.8%
            
            // Horas de hold mínimo antes de vender
            minHoldHours: options.minHoldHours || 2,
            
            // Fator de urgência para usar BRL (0-1)
            brlDepletionUrgency: options.brlDepletionUrgency || 0.8,
            
            // Número de preços para histórico
            priceHistorySize: options.priceHistorySize || 100,
            
            // Habilitado
            enabled: options.enabled !== false,
            
            // ═══ PROTEÇÃO CONTRA QUEDAS FORTES ═══
            // Queda % para pausar compras (evitar "pegar faca caindo")
            // BALANCEADO: 0.02 → 0.03 (permite mais trades)
            strongDropThreshold: options.strongDropThreshold || 0.03, // 3% (BALANCEADO - era 2%)
            
            // Ciclos de confirmação de reversão antes de voltar a comprar
            // BALANCEADO: 5 → 4 (reage mais rápido)
            reversalConfirmationCycles: options.reversalConfirmationCycles || 4,
            
            // % de recuperação mínima para confirmar reversão
            minReversalRecovery: options.minReversalRecovery || 0.005, // 0.5%
            
            // Limite máximo de perda % antes de parar completamente
            maxDrawdownPct: options.maxDrawdownPct || 0.05, // 5%
            
            // ═══ FILTROS DE SEGURANÇA V2 ═══
            // Filtro de tendência externa obrigatório
            trendFilterEnabled: options.trendFilterEnabled !== false,
            // Se externa é BEARISH, não compra
            blockOnBearishTrend: options.blockOnBearishTrend !== false,
            
            // RSI Filter para evitar overbought/oversold
            rsiFilterEnabled: options.rsiFilterEnabled !== false,
            rsiOverboughtThreshold: options.rsiOverboughtThreshold || 80, // OTIMIZADO: 80 (manter proteção)
            rsiOversoldThreshold: options.rsiOversoldThreshold || 20, // OTIMIZADO: 20 (manter proteção)
            
            // Stop Loss Global
            stopLossEnabled: options.stopLossEnabled !== false,
            stopLossThreshold: options.stopLossThreshold || 0.075 // BALANCEADO: 7.5% de perda
        };
        
        // Estado interno
        this.state = {
            priceHistory: [],
            buyHistory: [], // {price, qty, timestamp}
            avgBuyPrice: 0,
            totalBTCBought: 0,
            totalBRLSpent: 0,
            lastDCATime: 0,
            dcaCooldown: 60000, // 1 minuto entre DCAs
            consecutiveDrops: 0,
            peakPrice: 0,
            valleyPrice: Infinity,
            accumulationScore: 0,
            
            // ═══ ESTADO DE PROTEÇÃO ═══
            buyPaused: false,           // Compras pausadas por queda forte
            pauseReason: '',            // Motivo da pausa
            pauseStartTime: 0,          // Quando pausou
            lastValleyPrice: 0,         // Preço do último vale identificado
            recoveryStartPrice: 0,      // Preço quando começou a recuperar
            recoveryConfirmations: 0,   // Confirmações consecutivas de alta
            currentDrawdown: 0,         // Drawdown atual desde o pico
            maxDrawdownReached: 0,      // Maior drawdown atingido
            sessionHighPrice: 0,        // Maior preço da sessão
            
            // ═══ FILTROS DE SEGURANÇA V2 ═══
            lastExternalTrend: 'NEUTRAL', // Última tendência externa conhecida
            lastRSI: 50,                // Último RSI calculado
            globalStopLossTriggered: false,  // Se parou por stop loss global
            sessionStartValue: 0,       // Valor inicial da sessão para stop loss
            sessionStartPrice: 0        // Preço inicial para cálculo de stop loss
        };
        
        // Log function
        this.log = options.log || console.log;
    }
    
    /**
     * Registra novo preço e atualiza histórico
     * MELHORADO: Inclui detecção de queda forte e proteção
     */
    recordPrice(price) {
        this.state.priceHistory.push({
            price,
            timestamp: Date.now()
        });
        
        // Limitar tamanho
        if (this.state.priceHistory.length > this.config.priceHistorySize) {
            this.state.priceHistory.shift();
        }
        
        // Atualizar pico e vale
        if (price > this.state.peakPrice) {
            this.state.peakPrice = price;
        }
        if (price < this.state.valleyPrice || this.state.valleyPrice === Infinity) {
            this.state.valleyPrice = price;
        }
        
        // Atualizar maior preço da sessão
        if (price > this.state.sessionHighPrice) {
            this.state.sessionHighPrice = price;
        }
        
        // Calcular tendência de curto prazo
        this._updateDropCounter(price);
        
        // ═══ PROTEÇÃO CONTRA QUEDAS FORTES ═══
        this._updateProtectionState(price);
    }
    
    /**
     * Atualiza estado de proteção contra quedas fortes
     */
    _updateProtectionState(currentPrice) {
        // Calcular drawdown atual
        if (this.state.sessionHighPrice > 0) {
            this.state.currentDrawdown = (this.state.sessionHighPrice - currentPrice) / this.state.sessionHighPrice;
            if (this.state.currentDrawdown > this.state.maxDrawdownReached) {
                this.state.maxDrawdownReached = this.state.currentDrawdown;
            }
        }
        
        // Verificar se deve pausar compras por queda forte
        if (!this.state.buyPaused && this.state.currentDrawdown >= this.config.strongDropThreshold) {
            this.state.buyPaused = true;
            this.state.pauseReason = `Queda forte de ${(this.state.currentDrawdown * 100).toFixed(2)}% - aguardando reversão`;
            this.state.pauseStartTime = Date.now();
            this.state.lastValleyPrice = currentPrice;
            this.state.recoveryConfirmations = 0;
            
            if (this.log) {
                this.log('WARN', `🛑 COMPRAS PAUSADAS: ${this.state.pauseReason}`);
            }
        }
        
        // Se pausado, verificar recuperação
        if (this.state.buyPaused) {
            // Atualizar vale se preço caiu mais
            if (currentPrice < this.state.lastValleyPrice) {
                this.state.lastValleyPrice = currentPrice;
                this.state.recoveryConfirmations = 0;
                this.state.recoveryStartPrice = 0;
            }
            
            // Detectar início de recuperação
            if (this.state.recoveryStartPrice === 0 && currentPrice > this.state.lastValleyPrice) {
                this.state.recoveryStartPrice = currentPrice;
            }
            
            // Contar confirmações de recuperação
            if (this.state.recoveryStartPrice > 0) {
                const recoveryPct = (currentPrice - this.state.lastValleyPrice) / this.state.lastValleyPrice;
                
                if (recoveryPct >= this.config.minReversalRecovery) {
                    this.state.recoveryConfirmations++;
                    
                    // Confirmou reversão - liberar compras
                    if (this.state.recoveryConfirmations >= this.config.reversalConfirmationCycles) {
                        this.state.buyPaused = false;
                        this.state.pauseReason = '';
                        // Resetar pico para o valor atual para evitar nova pausa imediata
                        this.state.sessionHighPrice = currentPrice;
                        
                        if (this.log) {
                            this.log('INFO', `✅ COMPRAS LIBERADAS: Reversão confirmada após ${recoveryPct * 100}% de recuperação`);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Atualiza contador de quedas consecutivas
     */
    _updateDropCounter(currentPrice) {
        if (this.state.priceHistory.length < 2) return;
        
        const prevPrice = this.state.priceHistory[this.state.priceHistory.length - 2].price;
        
        if (currentPrice < prevPrice) {
            this.state.consecutiveDrops++;
        } else {
            this.state.consecutiveDrops = 0;
        }
    }
    
    /**
     * Registra uma compra para rastrear preço médio
     */
    recordBuy(price, qty) {
        this.state.buyHistory.push({
            price,
            qty,
            timestamp: Date.now()
        });
        
        // Atualizar totais
        this.state.totalBTCBought += qty;
        this.state.totalBRLSpent += price * qty;
        
        // Recalcular preço médio
        if (this.state.totalBTCBought > 0) {
            this.state.avgBuyPrice = this.state.totalBRLSpent / this.state.totalBTCBought;
        }
        
        // Limitar histórico a 50 compras
        if (this.state.buyHistory.length > 50) {
            const removed = this.state.buyHistory.shift();
            this.state.totalBTCBought -= removed.qty;
            this.state.totalBRLSpent -= removed.price * removed.qty;
        }
    }
    
    /**
     * Calcula o score de oportunidade de acumulação (0-100)
     * Quanto maior, melhor o momento para comprar
     */
    getAccumulationScore(currentPrice, brlBalance, btcPosition) {
        let score = 50; // Base
        
        // 1. Desconto do pico (+30 pontos se caiu 5%+)
        if (this.state.peakPrice > 0) {
            const dropFromPeak = (this.state.peakPrice - currentPrice) / this.state.peakPrice;
            score += Math.min(30, dropFromPeak * 600); // +30 máx se caiu 5%
        }
        
        // 2. Quedas consecutivas (+20 pontos se 3+ quedas)
        score += Math.min(20, this.state.consecutiveDrops * 5);
        
        // 3. BRL disponível para gastar (+20 pontos se tem muito BRL)
        const brlExcess = Math.max(0, brlBalance - this.config.maxBRLHolding);
        if (brlExcess > 0) {
            score += Math.min(20, (brlExcess / this.config.maxBRLHolding) * 20);
        }
        
        // 4. Abaixo do preço médio de compra (+15 pontos)
        if (this.state.avgBuyPrice > 0 && currentPrice < this.state.avgBuyPrice) {
            const discount = (this.state.avgBuyPrice - currentPrice) / this.state.avgBuyPrice;
            score += Math.min(15, discount * 300);
        }
        
        // 5. BTC abaixo do target (+15 pontos)
        if (btcPosition < this.config.minBTCTarget) {
            const deficit = (this.config.minBTCTarget - btcPosition) / this.config.minBTCTarget;
            score += deficit * 15;
        }
        
        // Limitar a 0-100
        this.state.accumulationScore = Math.max(0, Math.min(100, score));
        return this.state.accumulationScore;
    }
    
    /**
     * Determina se deve aplicar DCA (compra extra nas quedas)
     * OTIMIZADO: Inclui filtros de segurança (Trend, RSI, Stop Loss)
     */
    shouldDCA(currentPrice, brlBalance, externalTrend = 'NEUTRAL', rsi = 50, btcBalance = 0, initialValue = 0) {
        if (!this.config.enabled) return { should: false, reason: 'Accumulator desabilitado' };
        
        // ═══ FILTRO 1: TREND FILTER (BLOQUEADOR SE BEARISH) ═══
        if (this.config.trendFilterEnabled && this.config.blockOnBearishTrend) {
            this.state.lastExternalTrend = externalTrend;
            if (externalTrend === 'BEARISH') {
                return {
                    should: false,
                    reason: `🚫 BLOQUEADO: Tendência BEARISH - não compra em quedas`,
                    blocked: true,
                    blockReason: 'external_bearish_trend'
                };
            }
        }
        
        // ═══ FILTRO 2: STOP LOSS GLOBAL ═══
        if (this.config.stopLossEnabled && initialValue > 0) {
            const currentSessionValue = brlBalance + (btcBalance * currentPrice);
            const sessionLoss = (initialValue - currentSessionValue) / initialValue;
            if (sessionLoss >= this.config.stopLossThreshold) {
                this.state.globalStopLossTriggered = true;
                return {
                    should: false,
                    reason: `🛑 STOP LOSS GLOBAL: Perda acumulada ${(sessionLoss * 100).toFixed(2)}% >= ${(this.config.stopLossThreshold * 100).toFixed(2)}%`,
                    blocked: true,
                    blockReason: 'global_stop_loss'
                };
            }
        }
        
        // ═══ FILTRO 3: RSI FILTER (EVITAR OVERBOUGHT/OVERSOLD) ═══
        if (this.config.rsiFilterEnabled) {
            this.state.lastRSI = rsi;
            if (rsi > this.config.rsiOverboughtThreshold) {
                return {
                    should: false,
                    reason: `⚠️  RSI ${rsi.toFixed(0)} > ${this.config.rsiOverboughtThreshold} (OVERBOUGHT) - não compra`,
                    blocked: true,
                    blockReason: 'rsi_overbought'
                };
            }
            if (rsi < this.config.rsiOversoldThreshold) {
                return {
                    should: false,
                    reason: `⚠️  RSI ${rsi.toFixed(0)} < ${this.config.rsiOversoldThreshold} (OVERSOLD) - proteção`,
                    blocked: true,
                    blockReason: 'rsi_oversold'
                };
            }
        }
        
        const now = Date.now();
        
        // Verificar cooldown
        if (now - this.state.lastDCATime < this.state.dcaCooldown) {
            return { should: false, reason: 'Em cooldown de DCA' };
        }
        
        // Verificar se tem BRL suficiente
        if (brlBalance < 10) {
            return { should: false, reason: 'BRL insuficiente para DCA' };
        }
        
        // Verificar queda desde pico (AGORA MAIS CONSERVADOR)
        if (this.state.peakPrice > 0) {
            const dropFromPeak = (this.state.peakPrice - currentPrice) / this.state.peakPrice;
            
            if (dropFromPeak >= this.config.dcaDropThreshold) {
                this.state.lastDCATime = now;
                return {
                    should: true,
                    reason: `Queda de ${(dropFromPeak * 100).toFixed(2)}% do pico (threshold: ${(this.config.dcaDropThreshold * 100).toFixed(2)}%) - DCA ativado!`,
                    multiplier: 1 + (dropFromPeak * 10), // Quanto maior queda, mais compra
                    dropPercent: dropFromPeak * 100,
                    filters: { trendOK: true, rsiOK: true, stopLossOK: true }
                };
            }
        }
        
        // Verificar quedas consecutivas (mais conservador agora)
        if (this.state.consecutiveDrops >= 5) {
            this.state.lastDCATime = now;
            return {
                should: true,
                reason: `${this.state.consecutiveDrops} quedas consecutivas - DCA ativado!`,
                multiplier: 1 + (this.state.consecutiveDrops * 0.2),
                dropPercent: 0,
                filters: { trendOK: true, rsiOK: true, stopLossOK: true }
            };
        }
        
        return { should: false, reason: 'Condições de DCA não atingidas' };
    }
    
    /**
     * Determina se deve bloquear uma venda
     * Retorna true se a venda deve ser BLOQUEADA
     */
    shouldBlockSell(currentPrice, btcPosition, orderPrice, orderQty) {
        if (!this.config.enabled) return { block: false, reason: 'Accumulator desabilitado' };
        
        // 1. Verificar se vai ficar abaixo do target de BTC
        const btcAfterSell = btcPosition - orderQty;
        if (btcAfterSell < this.config.minBTCTarget) {
            return {
                block: true,
                reason: `SELL bloqueado: BTC após venda (${btcAfterSell.toFixed(8)}) ficaria abaixo do target (${this.config.minBTCTarget})`,
                severity: 'high'
            };
        }
        
        // 2. Verificar lucro mínimo
        if (this.state.avgBuyPrice > 0) {
            const profit = (orderPrice - this.state.avgBuyPrice) / this.state.avgBuyPrice;
            if (profit < this.config.minProfitToSell) {
                // Aplicar resistência probabilística
                const random = Math.random();
                if (random < this.config.sellResistance) {
                    return {
                        block: true,
                        reason: `SELL bloqueado por resistência: Lucro ${(profit * 100).toFixed(2)}% < mínimo ${(this.config.minProfitToSell * 100).toFixed(2)}%`,
                        severity: 'medium'
                    };
                }
            }
        }
        
        // 3. Verificar hold mínimo
        const recentBuys = this.state.buyHistory.filter(b => 
            Date.now() - b.timestamp < this.config.minHoldHours * 3600000
        );
        if (recentBuys.length > 0 && btcPosition - orderQty < this.config.minBTCTarget * 1.5) {
            return {
                block: true,
                reason: `SELL bloqueado: BTC comprado recentemente (hold mínimo ${this.config.minHoldHours}h)`,
                severity: 'low'
            };
        }
        
        return { block: false, reason: 'SELL permitido' };
    }
    
    /**
     * Calcula ajuste de quantidade para BUY (aumenta) ou SELL (diminui)
     */
    getQuantityAdjustment(side, baseQty, currentPrice, btcPosition, brlBalance) {
        if (!this.config.enabled) return { qty: baseQty, reason: 'Sem ajuste' };
        
        if (side === 'buy') {
            // BUY: Aumentar quantidade se condições favoráveis
            let multiplier = 1.0;
            let reasons = [];
            
            // Mais BRL que o ideal? Aumentar BUY
            if (brlBalance > this.config.maxBRLHolding) {
                const excess = brlBalance / this.config.maxBRLHolding;
                multiplier *= Math.min(2.0, 1 + (excess - 1) * this.config.brlDepletionUrgency);
                reasons.push(`BRL excess (${brlBalance.toFixed(2)} > ${this.config.maxBRLHolding})`);
            }
            
            // Abaixo do preço médio? Aumentar BUY
            if (this.state.avgBuyPrice > 0 && currentPrice < this.state.avgBuyPrice * 0.99) {
                multiplier *= 1.3;
                reasons.push(`Preço abaixo da média (${currentPrice.toFixed(2)} < ${this.state.avgBuyPrice.toFixed(2)})`);
            }
            
            // Acumulação score alto? Aumentar BUY
            if (this.state.accumulationScore > 70) {
                multiplier *= 1.2;
                reasons.push(`Score de acumulação alto (${this.state.accumulationScore.toFixed(0)})`);
            }
            
            return {
                qty: baseQty * multiplier,
                multiplier,
                reason: reasons.length > 0 ? reasons.join(', ') : 'Sem ajuste',
                side: 'buy'
            };
            
        } else {
            // SELL: Diminuir quantidade para resistir venda
            let multiplier = 1.0;
            let reasons = [];
            
            // BTC abaixo do target? Reduzir SELL
            if (btcPosition < this.config.minBTCTarget * 1.2) {
                multiplier *= 0.5;
                reasons.push(`BTC perto do mínimo (${btcPosition.toFixed(8)} ~ ${this.config.minBTCTarget})`);
            }
            
            // Preço abaixo da média? Reduzir SELL (não vender no prejuízo)
            if (this.state.avgBuyPrice > 0 && currentPrice < this.state.avgBuyPrice) {
                multiplier *= 0.3;
                reasons.push(`Preço abaixo da média de compra`);
            }
            
            // Aplicar resistência geral
            multiplier *= (1 - this.config.sellResistance * 0.5);
            
            return {
                qty: baseQty * multiplier,
                multiplier,
                reason: reasons.length > 0 ? reasons.join(', ') : 'Resistência padrão',
                side: 'sell'
            };
        }
    }
    
    /**
     * Obtém recomendação geral de ação
     * MELHORADO: Inclui proteção contra quedas fortes
     */
    getRecommendation(currentPrice, btcPosition, brlBalance) {
        const score = this.getAccumulationScore(currentPrice, brlBalance, btcPosition);
        
        let action = 'HOLD';
        let urgency = 'low';
        let reason = '';
        
        // ═══ VERIFICAR PROTEÇÃO PRIMEIRO ═══
        if (this.state.buyPaused) {
            const pauseMinutes = Math.floor((Date.now() - this.state.pauseStartTime) / 60000);
            return {
                action: 'WAIT_REVERSAL',
                urgency: 'high',
                reason: `⚠️ COMPRAS PAUSADAS (${pauseMinutes}min): ${this.state.pauseReason}`,
                score,
                buyPaused: true,
                currentDrawdown: (this.state.currentDrawdown * 100).toFixed(2) + '%',
                recoveryConfirmations: this.state.recoveryConfirmations,
                requiredConfirmations: this.config.reversalConfirmationCycles,
                btcDeficit: Math.max(0, this.config.minBTCTarget - btcPosition),
                brlExcess: Math.max(0, brlBalance - this.config.maxBRLHolding)
            };
        }
        
        // Verificar drawdown máximo (parar completamente se muito alto)
        if (this.state.maxDrawdownReached >= this.config.maxDrawdownPct) {
            return {
                action: 'STOP_LOSS',
                urgency: 'critical',
                reason: `🚨 DRAWDOWN MÁXIMO ATINGIDO: ${(this.state.maxDrawdownReached * 100).toFixed(2)}%`,
                score,
                buyPaused: true,
                btcDeficit: Math.max(0, this.config.minBTCTarget - btcPosition),
                brlExcess: Math.max(0, brlBalance - this.config.maxBRLHolding)
            };
        }
        
        // Alta urgência para comprar
        if (score >= 80) {
            action = 'STRONG_BUY';
            urgency = 'high';
            reason = 'Excelente oportunidade de acumulação!';
        } else if (score >= 65) {
            action = 'BUY';
            urgency = 'medium';
            reason = 'Boa oportunidade de compra';
        } else if (score >= 50) {
            action = 'LIGHT_BUY';
            urgency = 'low';
            reason = 'Momento neutro, pequena compra OK';
        } else if (score < 30 && btcPosition > this.config.minBTCTarget * 2) {
            action = 'CONSIDER_SELL';
            urgency = 'low';
            reason = 'Pode considerar vender excesso';
        }
        
        // Override se BRL muito alto (mas não se drawdown alto)
        if (brlBalance > this.config.maxBRLHolding * 2 && this.state.currentDrawdown < 0.015) {
            action = 'STRONG_BUY';
            urgency = 'high';
            reason = 'BRL muito alto - converter para BTC urgente!';
        }
        
        // Override se BTC muito baixo (mas não se drawdown alto)
        if (btcPosition < this.config.minBTCTarget * 0.5 && this.state.currentDrawdown < 0.015) {
            action = 'STRONG_BUY';
            urgency = 'high';
            reason = 'BTC muito baixo - acumular urgente!';
        }
        
        return {
            action,
            urgency,
            reason,
            score,
            buyPaused: false,
            currentDrawdown: (this.state.currentDrawdown * 100).toFixed(2) + '%',
            btcDeficit: Math.max(0, this.config.minBTCTarget - btcPosition),
            brlExcess: Math.max(0, brlBalance - this.config.maxBRLHolding)
        };
    }
    
    /**
     * Retorna estatísticas do accumulator
     */
    getStats() {
        return {
            enabled: this.config.enabled,
            avgBuyPrice: this.state.avgBuyPrice,
            totalBTCBought: this.state.totalBTCBought,
            totalBRLSpent: this.state.totalBRLSpent,
            accumulationScore: this.state.accumulationScore,
            peakPrice: this.state.peakPrice,
            valleyPrice: this.state.valleyPrice,
            consecutiveDrops: this.state.consecutiveDrops,
            priceHistorySize: this.state.priceHistory.length,
            // ═══ NOVOS STATS DE PROTEÇÃO ═══
            buyPaused: this.state.buyPaused,
            pauseReason: this.state.pauseReason,
            currentDrawdown: (this.state.currentDrawdown * 100).toFixed(2) + '%',
            maxDrawdownReached: (this.state.maxDrawdownReached * 100).toFixed(2) + '%',
            recoveryConfirmations: this.state.recoveryConfirmations,
            sessionHighPrice: this.state.sessionHighPrice,
            config: this.config
        };
    }
    
    /**
     * Força reset do estado de proteção (usar com cuidado!)
     */
    resetProtection() {
        this.state.buyPaused = false;
        this.state.pauseReason = '';
        this.state.maxDrawdownReached = 0;
        this.state.currentDrawdown = 0;
        this.state.recoveryConfirmations = 0;
        if (this.state.priceHistory.length > 0) {
            const lastPrice = this.state.priceHistory[this.state.priceHistory.length - 1].price;
            this.state.sessionHighPrice = lastPrice;
        }
        if (this.log) {
            this.log('INFO', '🔄 Estado de proteção resetado manualmente');
        }
    }
    
    /**
     * Verifica se compras estão pausadas
     */
    isBuyPaused() {
        return this.state.buyPaused;
    }
    
    /**
     * Reseta o preço de pico (usar após grandes movimentos)
     */
    resetPeak() {
        if (this.state.priceHistory.length > 0) {
            const recent = this.state.priceHistory.slice(-10);
            this.state.peakPrice = Math.max(...recent.map(p => p.price));
        }
    }
    
    /**
     * Reseta o vale (usar após grandes movimentos)
     */
    resetValley() {
        if (this.state.priceHistory.length > 0) {
            const recent = this.state.priceHistory.slice(-10);
            this.state.valleyPrice = Math.min(...recent.map(p => p.price));
        }
    }
}

module.exports = BTCAccumulator;
