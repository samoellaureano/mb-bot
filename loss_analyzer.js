/**
 * loss_analyzer.js - Analisador Detalhado de Perdas
 * 
 * Identifica padrões específicos que levam a prejuízo:
 * - Stop-loss excessivos
 * - Ordens canceladas por idade
 * - Fills ruins (slippage negativo)
 * - Reversões de tendência não capturadas
 * - Spreads muito apertados
 */

class LossAnalyzer {
    constructor(options = {}) {
        this.log = options.log || console.log;
        this.lossEvents = [];
        this.patterns = {
            stopLoss: [],
            oldAge: [],
            badFill: [],
            trendReversal: [],
            tightSpread: []
        };
    }
    
    /**
     * Analisa uma ordem finalizada para detectar perdas
     */
    analyzeOrder(order, marketContext = {}) {
        if (!order || !order.pnl) return null;
        
        const loss = {
            timestamp: Date.now(),
            orderId: order.id,
            side: order.side,
            pnl: order.pnl,
            qty: order.qty,
            price: order.price,
            avgPrice: order.avgPrice || order.price,
            status: order.status,
            reason: order.reason || 'unknown',
            context: marketContext
        };
        
        // 1. Stop-loss hit
        if (order.pnl < 0 && Math.abs(order.pnl) > (order.qty * order.price * 0.005)) {
            loss.category = 'stopLoss';
            loss.severity = 'high';
            loss.recommendation = 'Considerar stop-loss mais largo ou spread maior';
            this.patterns.stopLoss.push(loss);
        }
        
        // 2. Ordem cancelada por idade
        else if (order.status === 'cancelled' && order.reason && order.reason.includes('idade')) {
            loss.category = 'oldAge';
            loss.severity = 'medium';
            loss.recommendation = 'Ajustar preço mais próximo ao mercado ou reduzir max age';
            this.patterns.oldAge.push(loss);
        }
        
        // 3. Fill com slippage muito negativo
        else if (order.pnl < 0 && order.status === 'filled') {
            const slippage = Math.abs((order.avgPrice - order.price) / order.price);
            if (slippage > 0.003) {
                loss.category = 'badFill';
                loss.severity = 'medium';
                loss.recommendation = 'Reduzir tamanho de ordem ou usar limites mais conservadores';
                this.patterns.badFill.push(loss);
            }
        }
        
        // 4. Reversão de tendência não capturada
        if (marketContext.trendChanged && order.pnl < 0) {
            loss.category = 'trendReversal';
            loss.severity = 'high';
            loss.recommendation = 'Melhorar detecção de reversão ou usar indicadores adicionais';
            this.patterns.trendReversal.push(loss);
        }
        
        // 5. Spread muito apertado (não cobre taxas)
        if (order.pnl < 0 && marketContext.spread && marketContext.spread < 0.0006) {
            loss.category = 'tightSpread';
            loss.severity = 'high';
            loss.recommendation = 'Aumentar spread mínimo para cobrir taxas (0.3% maker + 0.7% taker)';
            this.patterns.tightSpread.push(loss);
        }
        
        if (loss.category) {
            this.lossEvents.push(loss);
            this.log('WARN', `[LOSS] ${loss.category.toUpperCase()}: PnL=${loss.pnl.toFixed(2)} | ${loss.recommendation}`);
        }
        
        return loss.category ? loss : null;
    }
    
    /**
     * Analisa um ciclo completo de trading
     */
    analyzeCycle(cycleData) {
        const analysis = {
            timestamp: Date.now(),
            cycle: cycleData.cycleCount,
            totalPnL: cycleData.totalPnL,
            lossCount: 0,
            mainIssues: []
        };
        
        // Contar perdas por categoria
        const categoryCounts = {};
        this.lossEvents.forEach(loss => {
            if (!categoryCounts[loss.category]) categoryCounts[loss.category] = 0;
            categoryCounts[loss.category]++;
        });
        
        // Identificar principais problemas
        Object.entries(categoryCounts).forEach(([category, count]) => {
            if (count > 2) {
                analysis.mainIssues.push({
                    category,
                    count,
                    pattern: this.patterns[category] || []
                });
            }
        });
        
        analysis.lossCount = this.lossEvents.length;
        
        return analysis;
    }
    
    /**
     * Gera relatório detalhado de perdas
     */
    generateReport() {
        const categoryCounts = {
            stopLoss: this.patterns.stopLoss.length,
            oldAge: this.patterns.oldAge.length,
            badFill: this.patterns.badFill.length,
            trendReversal: this.patterns.trendReversal.length,
            tightSpread: this.patterns.tightSpread.length
        };
        
        const totalLosses = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
        const totalPnL = this.lossEvents.reduce((sum, e) => sum + (e.pnl || 0), 0);
        
        const sections = [];
        
        sections.push('╔════════════════════════════════════════════════════════════════╗');
        sections.push('║            ANÁLISE DETALHADA DE PERDAS                         ║');
        sections.push('╠════════════════════════════════════════════════════════════════╣');
        sections.push(`║ Total de eventos de perda: ${totalLosses.toString().padStart(36)} ║`);
        sections.push(`║ PnL total de perdas:       R$ ${totalPnL.toFixed(2).padStart(33)} ║`);
        sections.push('╠════════════════════════════════════════════════════════════════╣');
        sections.push('║ DISTRIBUIÇÃO POR CATEGORIA                                     ║');
        sections.push('╠════════════════════════════════════════════════════════════════╣');
        
        // Stop-loss
        const stopLossPct = totalLosses > 0 ? (categoryCounts.stopLoss / totalLosses * 100).toFixed(1) : '0.0';
        sections.push(`║ Stop-loss hits:            ${categoryCounts.stopLoss.toString().padStart(28)} (${stopLossPct.padStart(5)}%) ║`);
        
        // Idade
        const oldAgePct = totalLosses > 0 ? (categoryCounts.oldAge / totalLosses * 100).toFixed(1) : '0.0';
        sections.push(`║ Canceladas por idade:      ${categoryCounts.oldAge.toString().padStart(28)} (${oldAgePct.padStart(5)}%) ║`);
        
        // Bad fills
        const badFillPct = totalLosses > 0 ? (categoryCounts.badFill / totalLosses * 100).toFixed(1) : '0.0';
        sections.push(`║ Fills ruins (slippage):    ${categoryCounts.badFill.toString().padStart(28)} (${badFillPct.padStart(5)}%) ║`);
        
        // Reversões
        const reversalPct = totalLosses > 0 ? (categoryCounts.trendReversal / totalLosses * 100).toFixed(1) : '0.0';
        sections.push(`║ Reversões de tendência:    ${categoryCounts.trendReversal.toString().padStart(28)} (${reversalPct.padStart(5)}%) ║`);
        
        // Spread
        const spreadPct = totalLosses > 0 ? (categoryCounts.tightSpread / totalLosses * 100).toFixed(1) : '0.0';
        sections.push(`║ Spread muito apertado:     ${categoryCounts.tightSpread.toString().padStart(28)} (${spreadPct.padStart(5)}%) ║`);
        
        sections.push('╠════════════════════════════════════════════════════════════════╣');
        sections.push('║ RECOMENDAÇÕES PRIORITÁRIAS                                     ║');
        sections.push('╠════════════════════════════════════════════════════════════════╣');
        
        // Gerar recomendações baseadas nos padrões mais comuns
        const recommendations = [];
        
        if (categoryCounts.stopLoss > 3) {
            recommendations.push('⚠️  Aumentar stop-loss ou spread mínimo');
        }
        if (categoryCounts.oldAge > 5) {
            recommendations.push('⚠️  Reduzir max order age ou ajustar preços');
        }
        if (categoryCounts.badFill > 2) {
            recommendations.push('⚠️  Reduzir tamanho de ordem ou limitar slippage');
        }
        if (categoryCounts.trendReversal > 2) {
            recommendations.push('⚠️  Melhorar detecção de reversão de tendência');
        }
        if (categoryCounts.tightSpread > 3) {
            recommendations.push('⚠️  Aumentar spread para cobrir taxas (min 0.1%)');
        }
        
        if (recommendations.length === 0) {
            sections.push('║ ✅ Nenhuma ação prioritária identificada                      ║');
        } else {
            recommendations.forEach(rec => {
                const paddedRec = rec.padEnd(62);
                sections.push(`║ ${paddedRec} ║`);
            });
        }
        
        sections.push('╚════════════════════════════════════════════════════════════════╝');
        
        return sections.join('\n');
    }
    
    /**
     * Limpa histórico antigo (mais de 1 hora)
     */
    cleanup() {
        const oneHourAgo = Date.now() - 3600000;
        this.lossEvents = this.lossEvents.filter(e => e.timestamp > oneHourAgo);
        
        Object.keys(this.patterns).forEach(category => {
            this.patterns[category] = this.patterns[category].filter(e => e.timestamp > oneHourAgo);
        });
    }
    
    /**
     * Retorna estatísticas resumidas
     */
    getStats() {
        return {
            totalLosses: this.lossEvents.length,
            byCategory: {
                stopLoss: this.patterns.stopLoss.length,
                oldAge: this.patterns.oldAge.length,
                badFill: this.patterns.badFill.length,
                trendReversal: this.patterns.trendReversal.length,
                tightSpread: this.patterns.tightSpread.length
            },
            totalPnL: this.lossEvents.reduce((sum, e) => sum + (e.pnl || 0), 0)
        };
    }
}

module.exports = LossAnalyzer;
