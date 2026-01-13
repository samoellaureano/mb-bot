#!/usr/bin/env node
/**
 * Sistema de Convicção Aprimorado do Bot
 * Calcula confiança baseado em múltiplos indicadores técnicos
 * e validações de qualidade de sinal
 */

const chalk = require('chalk');

class ConfidenceSystem {
    constructor() {
        // Weights para cada indicador
        this.indicatorWeights = {
            rsi: 0.20,           // 20% - RSI
            ema: 0.25,           // 25% - EMA crossover
            macd: 0.20,          // 20% - MACD
            volatility: 0.10,    // 10% - Volatility filter
            momentum: 0.15,      // 15% - Price momentum
            consistency: 0.10    // 10% - Consistency entre indicadores
        };

        // Thresholds de confiança
        this.thresholds = {
            rsiStrong: { up: 70, down: 30 },
            rsiWeak: { up: 60, down: 40 },
            rsiNeutral: { min: 40, max: 60 },
            volumeConfirm: 1.2,  // 20% acima da média
            volatilityMax: 3.0   // Evitar operar em volatilidade extrema
        };

        // Histórico de preços para análise
        this.priceHistory = [];
        this.maxHistoryLength = 100;
    }

    /**
     * Calcula convicção baseado em todos os indicadores
     */
    calculateConviction(indicators, metadata = {}) {
        if (!indicators) {
            return {
                overallConfidence: 0,
                components: {},
                signals: [],
                trend: 'NEUTRAL',
                strength: 'WEAK'
            };
        }

        const conviction = {
            overallConfidence: 0,
            components: {},
            signals: [],
            trend: 'NEUTRAL',
            strength: 'WEAK',
            details: {}
        };

        // 1. Análise RSI
        const rsiScore = this.analyzeRSI(indicators.rsi);
        conviction.components.rsi = rsiScore;

        // 2. Análise EMA
        const emaScore = this.analyzeEMA(
            indicators.emaShort,
            indicators.emaLong,
            indicators.price
        );
        conviction.components.ema = emaScore;

        // 3. Análise MACD
        const macdScore = this.analyzeMACD(
            indicators.macd,
            indicators.signal,
            indicators.trend
        );
        conviction.components.macd = macdScore;

        // 4. Análise Volatilidade
        const volatilityScore = this.analyzeVolatility(indicators.volatility);
        conviction.components.volatility = volatilityScore;

        // 5. Análise Momentum
        if (this.priceHistory.length > 0) {
            const momentumScore = this.analyzeMomentum(
                indicators.price,
                indicators.volatility
            );
            conviction.components.momentum = momentumScore;
        } else {
            conviction.components.momentum = { score: 0.5, confidence: 0, signals: [] };
        }

        // 6. Análise Consistency (concordância entre indicadores)
        const consistencyScore = this.analyzeConsistency(conviction.components);
        conviction.components.consistency = consistencyScore;

        // Calcular score geral ponderado
        let totalWeightedScore = 0;
        let totalWeight = 0;

        Object.entries(this.indicatorWeights).forEach(([key, weight]) => {
            if (conviction.components[key]) {
                totalWeightedScore += conviction.components[key].score * weight;
                totalWeight += weight;
            }
        });

        conviction.overallConfidence = totalWeightedScore / totalWeight;

        // Determinar trend e strength
        conviction.trend = this.determineTrend(conviction.components);
        conviction.strength = this.determineStrength(conviction.overallConfidence);

        // Coletar sinais de todos os indicadores
        Object.entries(conviction.components).forEach(([name, comp]) => {
            if (comp.signals && Array.isArray(comp.signals)) {
                conviction.signals.push(...comp.signals.map(s => `[${name.toUpperCase()}] ${s}`));
            }
        });

        // Metadata adicional
        conviction.details = {
            numIndicatorsAgreed: this.countAgreedIndicators(conviction.components),
            totalIndicators: Object.keys(conviction.components).length,
            volatilityLevel: this.getVolatilityLevel(indicators.volatility),
            recommendedPositionSize: this.calculatePositionSize(conviction.overallConfidence)
        };

        // Adicionar ao histórico
        this.priceHistory.push(indicators.price);
        if (this.priceHistory.length > this.maxHistoryLength) {
            this.priceHistory.shift();
        }

        return conviction;
    }

    /**
     * Analisa RSI
     */
    analyzeRSI(rsi) {
        const signals = [];
        let score = 0.5; // neutral por padrão

        if (rsi >= this.thresholds.rsiStrong.up) {
            signals.push('RSI sobrecomprado (>70) - risco de reversão');
            score = 0.4; // Sinal de venda, mas arriscado
        } else if (rsi >= 60) {
            signals.push('RSI forte em alta (60-70) - tendência de compra');
            score = 0.75;
        } else if (rsi >= 50) {
            signals.push('RSI moderado em alta (50-60)');
            score = 0.6;
        } else if (rsi > this.thresholds.rsiWeak.down) {
            signals.push('RSI moderado em baixa (40-50)');
            score = 0.4;
        } else if (rsi >= this.thresholds.rsiStrong.down) {
            signals.push('RSI fraco em baixa (30-40)');
            score = 0.3;
        } else {
            signals.push('RSI sobrevendido (<30) - risco de rally');
            score = 0.6; // Sinal de compra, mas arriscado
        }

        return {
            score,
            confidence: Math.abs(rsi - 50) / 50, // Confiança baseada em extremo
            signals,
            value: rsi
        };
    }

    /**
     * Analisa EMA crossover
     */
    analyzeEMA(emaShort, emaLong, currentPrice) {
        const signals = [];
        let score = 0.5;

        if (!emaShort || !emaLong) {
            signals.push('EMA dados insuficientes');
            return { score: 0.5, confidence: 0, signals };
        }

        const shortAboveLong = emaShort > emaLong;
        const distance = Math.abs(emaShort - emaLong) / emaLong;

        if (shortAboveLong) {
            signals.push('EMA Curta > EMA Longa (sinal de ALTA)');
            score = 0.7 + Math.min(distance * 2, 0.2); // Aumenta com distância
        } else {
            signals.push('EMA Curta < EMA Longa (sinal de BAIXA)');
            score = 0.3 - Math.min(distance * 2, 0.2); // Diminui com distância
        }

        // Proximidade do preço com EMAs
        const distToCurrent = Math.abs(currentPrice - emaShort) / currentPrice;
        if (distToCurrent < 0.005) {
            signals.push('⚡ Preço muito próximo da EMA Curta (possível inversão)');
        }

        return {
            score: Math.max(0.1, Math.min(0.9, score)),
            confidence: Math.min(distance, 1),
            signals,
            value: { short: emaShort, long: emaLong, crossover: shortAboveLong }
        };
    }

    /**
     * Analisa MACD
     */
    analyzeMACD(macd, signal, trend) {
        const signals = [];
        let score = 0.5;

        if (macd === undefined || signal === undefined) {
            signals.push('MACD dados insuficientes');
            return { score: 0.5, confidence: 0, signals };
        }

        const difference = macd - signal;
        const macdAboveSignal = difference > 0;
        const histogramStrength = Math.abs(difference);

        if (macdAboveSignal) {
            signals.push('MACD acima do Signal (momentum positivo)');
            score = 0.7 + Math.min(histogramStrength / 1000, 0.2);
        } else {
            signals.push('MACD abaixo do Signal (momentum negativo)');
            score = 0.3 - Math.min(histogramStrength / 1000, 0.2);
        }

        // Concordância com trend
        const trendMatch = (trend === 'up' && macdAboveSignal) || 
                          (trend === 'down' && !macdAboveSignal);
        if (trendMatch) {
            signals.push('✓ MACD confirma tendência');
            score += 0.1;
        } else {
            signals.push('✗ MACD diverge da tendência');
            score -= 0.1;
        }

        return {
            score: Math.max(0.1, Math.min(0.9, score)),
            confidence: Math.min(histogramStrength / 500, 1),
            signals,
            value: { macd, signal, histogram: difference }
        };
    }

    /**
     * Analisa Volatilidade
     */
    analyzeVolatility(volatility) {
        const signals = [];
        let score = 0.5;

        if (volatility < 0.3) {
            signals.push('Mercado com baixa volatilidade - spreads apertados');
            score = 0.6;
        } else if (volatility < 1.0) {
            signals.push('Volatilidade normal - condições ideais');
            score = 0.85;
        } else if (volatility < 2.0) {
            signals.push('Volatilidade elevada - aumentar cautela');
            score = 0.6;
        } else if (volatility < this.thresholds.volatilityMax) {
            signals.push('⚠️ Volatilidade muito elevada - reduzir posição');
            score = 0.3;
        } else {
            signals.push('🚨 Volatilidade extrema - evitar operações');
            score = 0.1;
        }

        const safetyFactor = volatility < 2.0 ? 1.0 : (this.thresholds.volatilityMax - volatility) / 1.0;

        return {
            score: Math.max(0.1, Math.min(0.9, score)),
            confidence: safetyFactor,
            signals,
            value: volatility,
            isSafe: volatility < 2.0
        };
    }

    /**
     * Analisa Momentum (mudança de preço)
     */
    analyzeMomentum(currentPrice, volatility) {
        const signals = [];
        let score = 0.5;

        if (this.priceHistory.length < 3) {
            return { score: 0.5, confidence: 0, signals: ['Histórico insuficiente'] };
        }

        // Calcular variação nos últimos 3 preços
        const recent3 = this.priceHistory.slice(-3);
        const priceChange = ((currentPrice - recent3[0]) / recent3[0]) * 100;
        const momentum = Math.abs(priceChange);

        // Direção do momentum
        if (priceChange > 0) {
            signals.push(`📈 Momentum positivo: +${priceChange.toFixed(2)}%`);
            score = 0.6 + Math.min(momentum / 2, 0.3);
        } else if (priceChange < 0) {
            signals.push(`📉 Momentum negativo: ${priceChange.toFixed(2)}%`);
            score = 0.4 - Math.min(Math.abs(momentum) / 2, 0.3);
        } else {
            signals.push('Momentum neutro');
        }

        return {
            score: Math.max(0.1, Math.min(0.9, score)),
            confidence: Math.min(momentum / (volatility * 2), 1),
            signals,
            value: { changePercent: priceChange, momentum }
        };
    }

    /**
     * Analisa concordância entre indicadores
     */
    analyzeConsistency(components) {
        const signals = [];
        let bullishCount = 0;
        let bearishCount = 0;

        Object.entries(components).forEach(([name, comp]) => {
            if (comp.score > 0.6) bullishCount++;
            if (comp.score < 0.4) bearishCount++;
        });

        const totalIndicators = Object.keys(components).length;
        const consensus = Math.max(bullishCount, bearishCount) / totalIndicators;

        if (bullishCount > bearishCount) {
            signals.push(`${bullishCount}/${totalIndicators} indicadores bullish`);
        } else if (bearishCount > bullishCount) {
            signals.push(`${bearishCount}/${totalIndicators} indicadores bearish`);
        } else {
            signals.push(`Indicadores divididos ${bullishCount}/${totalIndicators}`);
        }

        const score = 0.5 + (consensus * 0.4);

        return {
            score,
            confidence: consensus,
            signals,
            value: { bullish: bullishCount, bearish: bearishCount, consensus }
        };
    }

    /**
     * Determina tendência final
     */
    determineTrend(components) {
        let bullishScore = 0;
        let bearishScore = 0;

        Object.entries(components).forEach(([name, comp]) => {
            if (comp.score > 0.6) bullishScore++;
            else if (comp.score < 0.4) bearishScore++;
        });

        if (bullishScore > bearishScore) return 'UP';
        if (bearishScore > bullishScore) return 'DOWN';
        return 'NEUTRAL';
    }

    /**
     * Determina força da tendência
     */
    determineStrength(confidence) {
        if (confidence >= 0.8) return 'VERY_STRONG';
        if (confidence >= 0.7) return 'STRONG';
        if (confidence >= 0.6) return 'MODERATE';
        if (confidence >= 0.5) return 'WEAK';
        return 'VERY_WEAK';
    }

    /**
     * Conta indicadores que concordam
     */
    countAgreedIndicators(components) {
        let count = 0;
        const scores = Object.values(components).map(c => c.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        scores.forEach(score => {
            if ((avgScore > 0.5 && score > 0.5) || (avgScore < 0.5 && score < 0.5)) {
                count++;
            }
        });

        return count;
    }

    /**
     * Calcula nível de volatilidade descritivo
     */
    getVolatilityLevel(volatility) {
        if (volatility < 0.3) return 'VERY_LOW';
        if (volatility < 1.0) return 'LOW';
        if (volatility < 2.0) return 'MODERATE';
        if (volatility < 3.0) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Calcula tamanho recomendado de posição
     */
    calculatePositionSize(confidence) {
        // Reduz posição se confiança baixa
        if (confidence < 0.3) return 0.1; // 10%
        if (confidence < 0.5) return 0.25; // 25%
        if (confidence < 0.6) return 0.5; // 50%
        if (confidence < 0.7) return 0.75; // 75%
        return 1.0; // 100%
    }

    /**
     * Gera relatório detalhado
     */
    generateReport(conviction) {
        const lines = [];

        lines.push(chalk.blue('═══════════════════════════════════════════════'));
        lines.push(chalk.bold.white('        📊 RELATÓRIO DE CONVICÇÃO DO BOT'));
        lines.push(chalk.blue('═══════════════════════════════════════════════'));

        // Convicção geral
        lines.push('');
        const confColor = conviction.overallConfidence > 0.7 ? 'green' : 
                         conviction.overallConfidence > 0.5 ? 'yellow' : 'red';
        lines.push(chalk[confColor].bold(
            `Convicção Geral: ${(conviction.overallConfidence * 100).toFixed(1)}% (${conviction.strength})`
        ));

        lines.push(chalk.cyan(`Tendência: ${this.getTrendIcon(conviction.trend)} ${conviction.trend}`));

        // Componentes
        lines.push('');
        lines.push(chalk.yellow('📈 Análise por Indicador:'));
        
        Object.entries(conviction.components).forEach(([name, comp]) => {
            const icon = comp.score > 0.6 ? '🟢' : comp.score < 0.4 ? '🔴' : '🟡';
            lines.push(`   ${icon} ${name.toUpperCase().padEnd(12)} ${(comp.score * 100).toFixed(0)}% (±${(comp.confidence * 100).toFixed(0)}%)`);
        });

        // Sinais
        if (conviction.signals.length > 0) {
            lines.push('');
            lines.push(chalk.magenta('⚡ Sinais Detectados:'));
            conviction.signals.forEach(signal => {
                lines.push(chalk.gray(`   • ${signal}`));
            });
        }

        // Detalhes
        lines.push('');
        lines.push(chalk.cyan('📊 Detalhes:'));
        lines.push(`   Indicadores concordam: ${conviction.details.numIndicatorsAgreed}/${conviction.details.totalIndicators}`);
        lines.push(`   Nível volatilidade: ${conviction.details.volatilityLevel}`);
        lines.push(`   Tamanho posição recomendado: ${(conviction.details.recommendedPositionSize * 100).toFixed(0)}%`);

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
     * Reset do histórico (para testes)
     */
    reset() {
        this.priceHistory = [];
    }
}

module.exports = ConfidenceSystem;

// Teste se executado diretamente
if (require.main === module) {
    const system = new ConfidenceSystem();

    // Teste com indicadores típicos
    console.log(chalk.bold('\n🧪 TESTE: Indicadores Bullish Fortes'));
    
    const indicators1 = {
        rsi: 65,
        emaShort: 655300,
        emaLong: 654500,
        macd: 800,
        signal: 600,
        price: 655200,
        volatility: 0.8,
        trend: 'up'
    };

    // Adicionar ao histórico
    system.priceHistory = [654900, 655000, 655100];

    const conviction1 = system.calculateConviction(indicators1);
    console.log(system.generateReport(conviction1));

    // Teste com indicadores bearish
    console.log(chalk.bold('\n🧪 TESTE: Indicadores Bearish Fortes'));
    
    system.reset();
    system.priceHistory = [655300, 655200, 655100];

    const indicators2 = {
        rsi: 35,
        emaShort: 654500,
        emaLong: 655300,
        macd: -800,
        signal: -600,
        price: 654500,
        volatility: 1.2,
        trend: 'down'
    };

    const conviction2 = system.calculateConviction(indicators2);
    console.log(system.generateReport(conviction2));
}
