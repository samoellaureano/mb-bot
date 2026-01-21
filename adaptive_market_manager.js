/**
 * ADAPTIVE MARKET MANAGER
 * Sistema inteligente que detecta tendências e adapta automaticamente:
 * - Configurações do bot (spreads, tamanhos, limites)
 * - Gestão de posições (BTC vs BRL)
 * - Cancelamento e regeneração de ordens
 * - Priorização de PnL positivo
 */

const fs = require('fs');
const path = require('path');

class AdaptiveMarketManager {
    constructor(botInstance) {
        this.bot = botInstance;
        this.lastTrend = null;
        this.trendConfirmationCount = 0;
        this.trendChangeThreshold = 3; // Confirmar tendência por 3 ciclos
        this.positionHistory = [];
        this.pnlHistory = [];
        this.adaptationHistory = [];
        
        // Configurações por tendência
        this.trendConfigs = {
            up: {
                // EM ALTA: Maximizar BTC, minimizar BRL
                strategy: 'accumulate_btc',
                spread_pct: 0.008,
                min_spread_pct: 0.006,
                max_spread_pct: 0.015,
                order_size: 0.000008,
                max_position: 0.0003,
                stop_loss_pct: 0.010,
                take_profit_pct: 0.018,
                buy_bias: 1.2,  // Favorece compras
                sell_bias: 0.8,
                max_order_age: 900,
                volatility_multiplier: 1.0
            },
            down: {
                // EM QUEDA: Maximizar BRL, minimizar BTC
                strategy: 'preserve_brl',
                spread_pct: 0.015,
                min_spread_pct: 0.012,
                max_spread_pct: 0.025,
                order_size: 0.000004,
                max_position: 0.0001,
                stop_loss_pct: 0.006,
                take_profit_pct: 0.012,
                buy_bias: 0.6,  // Favorece vendas
                sell_bias: 1.4,
                max_order_age: 450,
                volatility_multiplier: 0.8
            },
            neutral: {
                // NEUTRO: Balanceado
                strategy: 'balanced',
                spread_pct: 0.012,
                min_spread_pct: 0.009,
                max_spread_pct: 0.020,
                order_size: 0.000006,
                max_position: 0.0002,
                stop_loss_pct: 0.008,
                take_profit_pct: 0.015,
                buy_bias: 1.0,
                sell_bias: 1.0,
                max_order_age: 600,
                volatility_multiplier: 1.0
            }
        };
    }

    /**
     * Detecta tendência robusta usando múltiplos indicadores
     */
    detectTrend(marketData, technicalIndicators) {
        const indicators = [];
        
        // 1. Tendência da API
        const apiTrend = marketData.tendency?.trend;
        if (apiTrend === 'up') indicators.push(1);
        else if (apiTrend === 'down') indicators.push(-1);
        else indicators.push(0);
        
        // 2. Análise de preço (EMA)
        const emaShort = technicalIndicators.emaShort;
        const emaLong = technicalIndicators.emaLong;
        if (emaShort && emaLong) {
            const emaDiff = (emaShort - emaLong) / emaLong;
            if (emaDiff > 0.002) indicators.push(1);      // +0.2% = alta
            else if (emaDiff < -0.002) indicators.push(-1); // -0.2% = baixa
            else indicators.push(0);
        }
        
        // 3. RSI
        const rsi = technicalIndicators.rsi;
        if (rsi) {
            if (rsi > 60) indicators.push(1);      // Força compradora
            else if (rsi < 40) indicators.push(-1); // Força vendedora  
            else indicators.push(0);
        }
        
        // 4. MACD
        const macd = technicalIndicators.macd;
        const signal = technicalIndicators.macdSignal;
        if (macd && signal) {
            if (macd > signal && macd > 0) indicators.push(1);
            else if (macd < signal && macd < 0) indicators.push(-1);
            else indicators.push(0);
        }
        
        // 5. Volatilidade (alta volatilidade = incerteza)
        const volatility = parseFloat(marketData.volatility || 0);
        if (volatility > 2.0) {
            // Alta volatilidade = reduzir confiança
            indicators.push(0);
        }
        
        // Consolidar tendência
        const sum = indicators.reduce((a, b) => a + b, 0);
        const strength = Math.abs(sum) / indicators.length;
        
        let trend = 'neutral';
        if (sum > 1 && strength > 0.5) trend = 'up';
        else if (sum < -1 && strength > 0.5) trend = 'down';
        
        return {
            trend,
            strength: strength.toFixed(2),
            indicators: indicators.length,
            confidence: strength > 0.7 ? 'high' : strength > 0.4 ? 'medium' : 'low'
        };
    }

    /**
     * Confirma mudança de tendência para evitar whipsaws
     */
    confirmTrendChange(newTrend) {
        if (this.lastTrend !== newTrend) {
            this.trendConfirmationCount = 1;
            this.lastTrend = newTrend;
            return false; // Não confirmado ainda
        } else {
            this.trendConfirmationCount++;
            return this.trendConfirmationCount >= this.trendChangeThreshold;
        }
    }

    /**
     * Adapta configurações baseado na tendência confirmada
     */
    adaptConfiguration(confirmedTrend, currentPnL) {
        const config = this.trendConfigs[confirmedTrend];
        if (!config) return null;
        
        console.log(`🎯 [ADAPTIVE] Adaptando para tendência: ${confirmedTrend.toUpperCase()}`);
        console.log(`💡 [ADAPTIVE] Estratégia: ${config.strategy}`);
        
        // Registrar adaptação
        this.adaptationHistory.push({
            timestamp: Date.now(),
            trend: confirmedTrend,
            strategy: config.strategy,
            pnl: currentPnL,
            reason: `Trend confirmed: ${confirmedTrend}`
        });
        
        return config;
    }

    /**
     * Gerencia posições automaticamente baseado na tendência
     */
    async managePositions(trend, positions, marketPrice) {
        const btcPosition = parseFloat(positions.btc || 0);
        const brlBalance = parseFloat(positions.brl || 0);
        const btcValueBRL = btcPosition * marketPrice;
        
        console.log(`🎯 [POSITION] Trend: ${trend} | BTC: ${btcPosition.toFixed(8)} | BRL: R$ ${brlBalance.toFixed(2)}`);
        
        const actions = [];
        
        if (trend === 'up' && btcPosition < 0.00002) {
            // EM ALTA: Acumular BTC se posição baixa
            if (brlBalance > 50) {
                actions.push({
                    type: 'convert_to_btc',
                    reason: 'Uptrend detected, converting BRL to BTC',
                    amount: Math.min(brlBalance * 0.3, 30) // 30% ou R$ 30 max
                });
            }
        } else if (trend === 'down' && btcPosition > 0.00001) {
            // EM QUEDA: Liquidar BTC se exposição significativa
            if (btcValueBRL > 10) {
                actions.push({
                    type: 'convert_to_brl',
                    reason: 'Downtrend detected, protecting capital',
                    amount: btcPosition * 0.5 // Liquidar 50%
                });
            }
        }
        
        return actions;
    }

    /**
     * Cancela ordens desatualizadas e força regeneração
     */
    async cancelOutdatedOrders(orders, marketPrice, trend) {
        const actionsNeeded = [];
        
        for (const order of orders) {
            const priceDistance = Math.abs(order.price - marketPrice) / marketPrice;
            const isOutdated = priceDistance > 0.05; // 5% de distância
            
            // Lógica específica por tendência
            let shouldCancel = false;
            
            if (trend === 'up' && order.side === 'sell' && priceDistance < 0.01) {
                // EM ALTA: Cancelar SELL muito próximo (perder oportunidade)
                shouldCancel = true;
            } else if (trend === 'down' && order.side === 'buy' && priceDistance < 0.01) {
                // EM QUEDA: Cancelar BUY muito próximo (evitar perdas)
                shouldCancel = true;
            } else if (isOutdated) {
                // Cancelar ordens muito distantes do mercado
                shouldCancel = true;
            }
            
            if (shouldCancel) {
                actionsNeeded.push({
                    type: 'cancel_order',
                    orderId: order.external_id,
                    reason: `Outdated in ${trend} trend (${(priceDistance*100).toFixed(2)}% distance)`,
                    side: order.side,
                    price: order.price
                });
            }
        }
        
        return actionsNeeded;
    }

    /**
     * Otimiza PnL priorizando estratégias rentáveis
     */
    optimizePnL(currentPnL, historicalPnL) {
        this.pnlHistory.push({
            timestamp: Date.now(),
            value: currentPnL
        });
        
        // Manter apenas últimos 100 registros
        if (this.pnlHistory.length > 100) {
            this.pnlHistory = this.pnlHistory.slice(-100);
        }
        
        const optimizations = [];
        
        // Se PnL está negativo por muito tempo
        if (currentPnL < -2) {
            optimizations.push({
                type: 'emergency_stop',
                reason: 'PnL critically low, reducing activity',
                action: 'reduce_position_size'
            });
        }
        
        // Se PnL está crescendo, intensificar
        const recentPnL = this.pnlHistory.slice(-5);
        if (recentPnL.length >= 5) {
            const trend = recentPnL[recentPnL.length-1].value - recentPnL[0].value;
            if (trend > 1) {
                optimizations.push({
                    type: 'amplify_success',
                    reason: 'PnL trending up, increasing activity',
                    action: 'increase_position_size'
                });
            }
        }
        
        return optimizations;
    }

    /**
     * Executa todas as adaptações necessárias
     */
    async executeAdaptation(marketData, technicalIndicators, positions, orders, currentPnL) {
        try {
            // 1. Detectar tendência
            const trendAnalysis = this.detectTrend(marketData, technicalIndicators);
            console.log(`📊 [ADAPTIVE] Análise: ${JSON.stringify(trendAnalysis)}`);
            
            // 2. Confirmar mudança de tendência
            const confirmedTrend = this.confirmTrendChange(trendAnalysis.trend);
            
            if (!confirmedTrend) {
                console.log(`⏳ [ADAPTIVE] Aguardando confirmação de tendência (${this.trendConfirmationCount}/${this.trendChangeThreshold})`);
                return { adapted: false, reason: 'trend_confirmation_pending' };
            }
            
            // 3. Adaptar configuração
            const newConfig = this.adaptConfiguration(trendAnalysis.trend, currentPnL);
            
            // 4. Gerenciar posições
            const positionActions = await this.managePositions(trendAnalysis.trend, positions, marketData.last);
            
            // 5. Cancelar ordens desatualizadas
            const cancelActions = await this.cancelOutdatedOrders(orders, marketData.last, trendAnalysis.trend);
            
            // 6. Otimizar PnL
            const pnlOptimizations = this.optimizePnL(currentPnL, this.pnlHistory);
            
            return {
                adapted: true,
                trend: trendAnalysis.trend,
                confidence: trendAnalysis.confidence,
                newConfig,
                positionActions,
                cancelActions,
                pnlOptimizations,
                summary: `Adapted to ${trendAnalysis.trend} trend with ${trendAnalysis.confidence} confidence`
            };
            
        } catch (error) {
            console.error(`❌ [ADAPTIVE] Erro na adaptação: ${error.message}`);
            return { adapted: false, error: error.message };
        }
    }

    /**
     * Salva log de adaptações para análise
     */
    saveAdaptationLog() {
        const logData = {
            adaptations: this.adaptationHistory,
            pnlHistory: this.pnlHistory.slice(-50), // Últimos 50
            lastUpdate: new Date().toISOString()
        };
        
        try {
            fs.writeFileSync(
                path.join(__dirname, 'adaptive_manager_log.json'),
                JSON.stringify(logData, null, 2)
            );
        } catch (error) {
            console.error(`❌ [ADAPTIVE] Erro ao salvar log: ${error.message}`);
        }
    }
}

module.exports = AdaptiveMarketManager;