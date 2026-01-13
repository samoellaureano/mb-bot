#!/usr/bin/env node
/**
 * Motor de Decisão - Combina análise interna do bot com validação externa
 * Resolve divergências e determina se é seguro executar trades
 */

const chalk = require('chalk');

class DecisionEngine {
    constructor() {
        // Pesos para cada fonte de análise
        this.weights = {
            bot: 0.6,      // 60% - análise técnica interna
            external: 0.4   // 40% - validação externa multi-fonte
        };
        
        // Thresholds de confiança
        this.thresholds = {
            minConfidence: 0.5,        // Confiança mínima para operar
            criticalDivergence: 0.7,   // Nível crítico de divergência
            strongAlignment: 0.8       // Alinhamento forte
        };
    }

    /**
     * Analisa tendências e retorna decisão
     */
    analyzeDecision(botAnalysis, externalAnalysis) {
        const decision = {
            canTrade: false,
            action: 'HOLD',
            confidence: 0,
            reason: '',
            details: {},
            warnings: []
        };

        // 1. Verificar se temos dados válidos
        if (!botAnalysis || !externalAnalysis) {
            decision.reason = 'Dados insuficientes para análise';
            decision.warnings.push('❌ Análise incompleta - faltam dados');
            return decision;
        }

        // 2. Normalizar tendências
        const botTrend = this.normalizeTrend(botAnalysis.trend);
        const externalTrend = this.normalizeTrend(externalAnalysis.trend);
        
        // 3. Calcular scores normalizados (-1 a 1)
        const botScore = this.calculateScore(botTrend, botAnalysis.confidence);
        const externalScore = this.calculateScore(externalTrend, externalAnalysis.confidence / 100);

        decision.details = {
            bot: {
                trend: botTrend,
                confidence: botAnalysis.confidence,
                score: botScore.toFixed(3)
            },
            external: {
                trend: externalTrend,
                confidence: externalAnalysis.confidence / 100,
                score: externalScore.toFixed(3),
                sources: externalAnalysis.sources
            }
        };

        // 4. Verificar alinhamento
        const alignment = this.checkAlignment(botTrend, externalTrend);
        decision.details.alignment = alignment;

        // 5. Calcular score combinado
        const combinedScore = (botScore * this.weights.bot) + 
                             (externalScore * this.weights.external);
        
        decision.details.combinedScore = combinedScore.toFixed(3);

        // 6. Determinar ação baseada no score combinado
        if (Math.abs(combinedScore) < 0.2) {
            decision.action = 'HOLD';
            decision.details.finalTrend = 'NEUTRAL';
        } else if (combinedScore > 0) {
            decision.action = 'BUY_SIGNAL';
            decision.details.finalTrend = 'UP';
        } else {
            decision.action = 'SELL_SIGNAL';
            decision.details.finalTrend = 'DOWN';
        }

        // 7. Aplicar regras de segurança
        decision.canTrade = this.applySafetyRules(
            alignment,
            botAnalysis,
            externalAnalysis,
            combinedScore,
            decision
        );

        return decision;
    }

    /**
     * Normaliza tendência para formato padrão
     */
    normalizeTrend(trend) {
        const t = String(trend).toUpperCase();
        if (t.includes('UP') || t === 'BULLISH') return 'UP';
        if (t.includes('DOWN') || t === 'BEARISH') return 'DOWN';
        return 'NEUTRAL';
    }

    /**
     * Calcula score de -1 (bearish) a +1 (bullish)
     */
    calculateScore(trend, confidence) {
        const direction = {
            'UP': 1,
            'DOWN': -1,
            'NEUTRAL': 0
        };
        
        return (direction[trend] || 0) * confidence;
    }

    /**
     * Verifica alinhamento entre bot e análise externa
     */
    checkAlignment(botTrend, externalTrend) {
        if (botTrend === externalTrend) {
            return {
                status: 'ALIGNED',
                level: 'STRONG',
                description: '✅ Bot e análise externa concordam',
                multiplier: 1.2 // Aumenta confiança
            };
        }
        
        // Divergência parcial (um é neutral)
        if (botTrend === 'NEUTRAL' || externalTrend === 'NEUTRAL') {
            return {
                status: 'PARTIAL',
                level: 'MODERATE',
                description: '⚠️ Divergência parcial detectada',
                multiplier: 0.8
            };
        }
        
        // Divergência crítica (tendências opostas)
        return {
            status: 'DIVERGENT',
            level: 'CRITICAL',
            description: '🚨 DIVERGÊNCIA CRÍTICA - Bot e externo discordam',
            multiplier: 0.3 // Reduz drasticamente a confiança
        };
    }

    /**
     * Aplica regras de segurança para determinar se pode operar
     */
    applySafetyRules(alignment, botAnalysis, externalAnalysis, combinedScore, decision) {
        const warnings = [];
        let canTrade = true;

        // Regra 1: Divergência Crítica
        if (alignment.status === 'DIVERGENT') {
            warnings.push('🚨 BLOQUEIO: Divergência crítica entre análises');
            warnings.push(`   Bot: ${decision.details.bot.trend} | Externo: ${decision.details.external.trend}`);
            canTrade = false;
            decision.reason = 'Divergência crítica entre bot e análise externa';
        }

        // Regra 2: Confiança Mínima do Bot
        if (botAnalysis.confidence < this.thresholds.minConfidence) {
            warnings.push(`⚠️ Confiança do bot baixa: ${(botAnalysis.confidence * 100).toFixed(1)}%`);
            if (alignment.status !== 'ALIGNED') {
                canTrade = false;
                decision.reason = 'Confiança insuficiente sem alinhamento externo';
            }
        }

        // Regra 3: Confiança Externa
        const extConfidence = externalAnalysis.confidence / 100;
        if (extConfidence < this.thresholds.minConfidence) {
            warnings.push(`⚠️ Confiança externa baixa: ${externalAnalysis.confidence}%`);
        }

        // Regra 4: Score Combinado Fraco
        if (Math.abs(combinedScore) < 0.3 && alignment.status !== 'ALIGNED') {
            warnings.push(`⚠️ Score combinado fraco: ${combinedScore.toFixed(3)}`);
            canTrade = false;
            decision.reason = 'Score combinado insuficiente para operar';
        }

        // Regra 5: Alinhamento Forte = Boost de Confiança
        if (alignment.status === 'ALIGNED') {
            decision.confidence = Math.min(
                (botAnalysis.confidence + extConfidence) / 2 * alignment.multiplier,
                1.0
            );
            decision.reason = 'Alinhamento forte entre análises';
            canTrade = true;
        } else {
            decision.confidence = Math.abs(combinedScore) * alignment.multiplier;
        }

        // Regra 6: Verificar fontes externas disponíveis
        const availableSources = Object.values(externalAnalysis.sources || {})
            .filter(s => s !== null && s !== 'unavailable').length;
        
        if (availableSources < 2) {
            warnings.push(`⚠️ Poucas fontes externas: ${availableSources}/3`);
        }

        decision.warnings = warnings;
        
        // Decisão final com justificativa
        if (canTrade) {
            decision.reason = decision.reason || 
                `Score ${combinedScore > 0 ? 'positivo' : 'negativo'}: ${Math.abs(combinedScore).toFixed(3)}`;
        }

        return canTrade;
    }

    /**
     * Gera relatório detalhado da decisão
     */
    generateReport(decision) {
        const lines = [];
        
        lines.push(chalk.blue('═══════════════════════════════════════════════'));
        lines.push(chalk.bold.white('      🤖 RELATÓRIO DE DECISÃO DE TRADING'));
        lines.push(chalk.blue('═══════════════════════════════════════════════'));
        
        // Status
        const statusColor = decision.canTrade ? 'green' : 'red';
        const statusIcon = decision.canTrade ? '✅' : '🚫';
        lines.push('');
        lines.push(chalk[statusColor].bold(`${statusIcon} DECISÃO: ${decision.canTrade ? 'PODE OPERAR' : 'BLOQUEADO'}`));
        lines.push(chalk.cyan(`Ação Recomendada: ${decision.action}`));
        lines.push(chalk.cyan(`Confiança: ${(decision.confidence * 100).toFixed(1)}%`));
        lines.push(chalk.gray(`Razão: ${decision.reason}`));
        
        // Análise Bot
        lines.push('');
        lines.push(chalk.yellow('📊 Análise Interna (Bot):'));
        lines.push(`   Tendência: ${this.getTrendIcon(decision.details.bot.trend)} ${decision.details.bot.trend}`);
        lines.push(`   Confiança: ${(decision.details.bot.confidence * 100).toFixed(1)}%`);
        lines.push(`   Score: ${decision.details.bot.score}`);
        
        // Análise Externa
        lines.push('');
        lines.push(chalk.yellow('🌐 Análise Externa:'));
        lines.push(`   Tendência: ${this.getTrendIcon(decision.details.external.trend)} ${decision.details.external.trend}`);
        lines.push(`   Confiança: ${(decision.details.external.confidence * 100).toFixed(1)}%`);
        lines.push(`   Score: ${decision.details.external.score}`);
        
        if (decision.details.external.sources) {
            const sources = decision.details.external.sources;
            lines.push('   Fontes:');
            if (sources.coinGecko) lines.push('     ✅ CoinGecko');
            if (sources.binance) lines.push('     ✅ Binance');
            if (sources.fearGreed) lines.push('     ✅ Fear & Greed Index');
        }
        
        // Alinhamento
        lines.push('');
        const align = decision.details.alignment;
        const alignColor = align.status === 'ALIGNED' ? 'green' : 
                          align.status === 'DIVERGENT' ? 'red' : 'yellow';
        lines.push(chalk[alignColor](`🎯 Alinhamento: ${align.status} (${align.level})`));
        lines.push(chalk.gray(`   ${align.description}`));
        lines.push(chalk.gray(`   Multiplicador: ${align.multiplier}x`));
        
        // Score Combinado
        lines.push('');
        lines.push(chalk.magenta(`📈 Score Combinado: ${decision.details.combinedScore}`));
        lines.push(chalk.magenta(`   Tendência Final: ${decision.details.finalTrend}`));
        
        // Warnings
        if (decision.warnings.length > 0) {
            lines.push('');
            lines.push(chalk.red('⚠️  AVISOS:'));
            decision.warnings.forEach(w => lines.push(chalk.yellow(`   ${w}`)));
        }
        
        lines.push('');
        lines.push(chalk.blue('═══════════════════════════════════════════════'));
        
        return lines.join('\n');
    }

    getTrendIcon(trend) {
        const icons = {
            'UP': '🔥',
            'DOWN': '❄️',
            'NEUTRAL': '➡️'
        };
        return icons[trend] || '❓';
    }

    /**
     * Exporta configuração atual
     */
    getConfig() {
        return {
            weights: this.weights,
            thresholds: this.thresholds
        };
    }

    /**
     * Atualiza configuração
     */
    updateConfig(newConfig) {
        if (newConfig.weights) {
            this.weights = { ...this.weights, ...newConfig.weights };
        }
        if (newConfig.thresholds) {
            this.thresholds = { ...this.thresholds, ...newConfig.thresholds };
        }
    }
}

module.exports = DecisionEngine;

// Se executado diretamente, fazer teste
if (require.main === module) {
    const engine = new DecisionEngine();
    
    // Teste 1: Alinhamento forte
    console.log(chalk.bold('\n🧪 TESTE 1: Alinhamento Forte (UP + UP)'));
    const test1 = engine.analyzeDecision(
        { trend: 'up', confidence: 0.75 },
        { trend: 'UP', confidence: 80, sources: { coinGecko: true, binance: true, fearGreed: true }}
    );
    console.log(engine.generateReport(test1));

    // Teste 2: Divergência crítica
    console.log(chalk.bold('\n🧪 TESTE 2: Divergência Crítica (UP vs DOWN)'));
    const test2 = engine.analyzeDecision(
        { trend: 'up', confidence: 0.75 },
        { trend: 'DOWN', confidence: 80, sources: { coinGecko: true, binance: true }}
    );
    console.log(engine.generateReport(test2));

    // Teste 3: Divergência parcial
    console.log(chalk.bold('\n🧪 TESTE 3: Divergência Parcial (DOWN vs NEUTRAL)'));
    const test3 = engine.analyzeDecision(
        { trend: 'down', confidence: 1.00 },
        { trend: 'NEUTRAL', confidence: 54, sources: { coinGecko: true, binance: true, fearGreed: true }}
    );
    console.log(engine.generateReport(test3));
}
