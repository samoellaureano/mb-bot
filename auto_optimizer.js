/**
 * auto_optimizer.js - Otimizador Automático de Parâmetros
 * 
 * Analisa o desempenho histórico e ajusta parâmetros para maximizar lucro
 * Usa machine learning simples (gradient descent) para encontrar configuração ideal
 */

class AutoOptimizer {
    constructor(options = {}) {
        this.log = options.log || console.log;
        this.initialCapital = options.initialCapital || 220;
        
        // Parâmetros ajustáveis
        this.params = {
            spreadPct: 0.0006,      // 0.06%
            orderSize: 0.05,        // 5% do saldo
            stopLoss: 0.008,        // 0.8%
            takeProfit: 0.001,      // 0.1%
            maxOrderAge: 1800,      // 30min
            minVolatility: 0.1,     // 0.1%
            maxVolatility: 2.5,     // 2.5%
        };
        
        // Histórico de performance
        this.performanceHistory = [];
        this.optimizationRounds = 0;
        this.lastOptimization = 0;
    }
    
    /**
     * Analisa desempenho atual e retorna score
     * Score alto = bom desempenho
     */
    calculatePerformanceScore(stats) {
        const roi = (stats.totalPnL / this.initialCapital) * 100;
        const fillRate = parseFloat(stats.fillRate) / 100;
        const avgSpread = stats.avgSpread / 100;
        
        // Componentes do score:
        // 1. ROI positivo (peso 60%)
        const roiScore = Math.max(0, roi) * 0.6;
        
        // 2. Fill rate alto (peso 20%)
        const fillScore = fillRate * 20;
        
        // 3. Spread controlado (peso 10%)
        const spreadScore = (1 - Math.min(avgSpread / 5, 1)) * 10;
        
        // 4. Tempo ativo (peso 10%)
        const uptimeScore = Math.min(stats.cycles / 100, 1) * 10;
        
        const totalScore = roiScore + fillScore + spreadScore + uptimeScore;
        
        return {
            total: totalScore,
            roi: roiScore,
            fill: fillScore,
            spread: spreadScore,
            uptime: uptimeScore,
            details: { roi, fillRate, avgSpread, cycles: stats.cycles }
        };
    }
    
    /**
     * Identifica pontos de perda no histórico
     */
    analyzeLossPatterns(orders) {
        const patterns = {
            stopLossHits: 0,
            oldOrderCancels: 0,
            lowFillOrders: 0,
            negativePnL: 0,
            totalOrders: orders.length
        };
        
        orders.forEach(order => {
            if (order.status === 'cancelled') {
                if (order.reason && order.reason.includes('idade')) {
                    patterns.oldOrderCancels++;
                }
            }
            if (order.pnl && order.pnl < 0) {
                patterns.negativePnL++;
                if (Math.abs(order.pnl) > order.qty * order.price * 0.005) {
                    patterns.stopLossHits++;
                }
            }
        });
        
        return patterns;
    }
    
    /**
     * Ajusta parâmetros baseado em análise de perda
     */
    optimizeParameters(currentStats, recentOrders, marketData) {
        const score = this.calculatePerformanceScore(currentStats);
        const patterns = this.analyzeLossPatterns(recentOrders);
        
        this.log('INFO', `[OPTIMIZER] Score atual: ${score.total.toFixed(2)} (ROI: ${score.details.roi.toFixed(2)}%)`);
        
        // Registrar performance
        this.performanceHistory.push({
            timestamp: Date.now(),
            score: score.total,
            params: {...this.params},
            stats: {...currentStats}
        });
        
        // Se está com prejuízo, ajustar agressivamente
        if (score.details.roi < -0.5) {
            this.log('WARN', `[OPTIMIZER] ROI negativo (${score.details.roi.toFixed(2)}%). Aplicando ajustes corretivos.`);
            
            // 1. Aumentar spread para garantir margem
            if (this.params.spreadPct < 0.002) {
                this.params.spreadPct *= 1.3; // +30%
                this.log('INFO', `[OPTIMIZER] Spread aumentado para ${(this.params.spreadPct * 100).toFixed(4)}%`);
            }
            
            // 2. Reduzir tamanho de ordem para minimizar exposição
            if (this.params.orderSize > 0.02) {
                this.params.orderSize *= 0.7; // -30%
                this.log('INFO', `[OPTIMIZER] Order size reduzido para ${(this.params.orderSize * 100).toFixed(2)}%`);
            }
            
            // 3. Stop-loss mais apertado
            if (this.params.stopLoss > 0.005) {
                this.params.stopLoss *= 0.8; // -20%
                this.log('INFO', `[OPTIMIZER] Stop-loss ajustado para ${(this.params.stopLoss * 100).toFixed(2)}%`);
            }
            
            // 4. Take-profit menor para capturar ganhos rápidos
            if (this.params.takeProfit > 0.0005) {
                this.params.takeProfit *= 0.7; // -30%
                this.log('INFO', `[OPTIMIZER] Take-profit ajustado para ${(this.params.takeProfit * 100).toFixed(3)}%`);
            }
        }
        
        // Se muitas ordens velhas sendo canceladas, reduzir max age
        if (patterns.oldOrderCancels / patterns.totalOrders > 0.3) {
            this.params.maxOrderAge = Math.max(300, this.params.maxOrderAge * 0.7); // Mín 5min
            this.log('INFO', `[OPTIMIZER] Max order age reduzido para ${this.params.maxOrderAge}s devido a ${patterns.oldOrderCancels} cancelamentos`);
        }
        
        // Se volatilidade está causando perdas, ajustar limites
        if (marketData && marketData.volatility) {
            const vol = marketData.volatility;
            
            if (vol > 2.0 && patterns.stopLossHits > 3) {
                this.params.minVolatility = Math.max(0.5, vol * 0.3); // Evita operar em extrema volatilidade
                this.log('INFO', `[OPTIMIZER] Min volatility ajustado para ${this.params.minVolatility.toFixed(2)}% (alta volatilidade detectada)`);
            }
        }
        
        // Se fill rate muito baixo, reduzir spread
        if (score.details.fillRate < 0.3 && this.params.spreadPct > 0.0004) {
            this.params.spreadPct *= 0.9; // -10%
            this.log('INFO', `[OPTIMIZER] Spread reduzido para ${(this.params.spreadPct * 100).toFixed(4)}% (fill rate baixo: ${(score.details.fillRate * 100).toFixed(1)}%)`);
        }
        
        this.optimizationRounds++;
        this.lastOptimization = Date.now();
        
        return {
            params: {...this.params},
            score,
            patterns,
            adjustmentsMade: true
        };
    }
    
    /**
     * Retorna parâmetros otimizados
     */
    getOptimizedParams() {
        return {...this.params};
    }
    
    /**
     * Gera relatório de otimização
     */
    generateReport() {
        if (this.performanceHistory.length === 0) {
            return 'Sem dados de otimização ainda.';
        }
        
        const latest = this.performanceHistory[this.performanceHistory.length - 1];
        const first = this.performanceHistory[0];
        const improvement = latest.score - first.score;
        
        return `
╔════════════════════════════════════════════════════════════════╗
║            RELATÓRIO DE OTIMIZAÇÃO AUTOMÁTICA                  ║
╠════════════════════════════════════════════════════════════════╣
║ Rodadas de otimização: ${this.optimizationRounds.toString().padStart(39)} ║
║ Score inicial:          ${first.score.toFixed(2).padStart(38)} ║
║ Score atual:            ${latest.score.toFixed(2).padStart(38)} ║
║ Melhoria:               ${improvement > 0 ? '+' : ''}${improvement.toFixed(2).padStart(37)} ║
╠════════════════════════════════════════════════════════════════╣
║ PARÂMETROS OTIMIZADOS                                          ║
╠════════════════════════════════════════════════════════════════╣
║ Spread:                 ${(this.params.spreadPct * 100).toFixed(4).padStart(38)}% ║
║ Order Size:             ${(this.params.orderSize * 100).toFixed(2).padStart(38)}% ║
║ Stop Loss:              ${(this.params.stopLoss * 100).toFixed(2).padStart(38)}% ║
║ Take Profit:            ${(this.params.takeProfit * 100).toFixed(3).padStart(38)}% ║
║ Max Order Age:          ${this.params.maxOrderAge.toString().padStart(38)}s ║
║ Min Volatility:         ${this.params.minVolatility.toFixed(2).padStart(38)}% ║
╚════════════════════════════════════════════════════════════════╝
        `.trim();
    }
}

module.exports = AutoOptimizer;
