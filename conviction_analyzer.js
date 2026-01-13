#!/usr/bin/env node
/**
 * conviction_analyzer.js - Analisa padrões de convicção ao longo do tempo
 * Fornece insights sobre quando a convicção foi mais/menos precisa
 */

const chalk = require('chalk');
const fs = require('fs');
const ConfidenceSystem = require('./confidence_system');

class ConvictionAnalyzer {
    constructor() {
        this.history = [];
        this.statistics = {
            totalCycles: 0,
            avgConviction: 0,
            maxConviction: 0,
            minConviction: 0,
            strongSignals: 0,
            weakSignals: 0,
            divergences: 0,
            trendsCorrect: 0,
            trendsFalse: 0
        };
    }

    /**
     * Adiciona registro de convicção ao histórico
     */
    recordConviction(conviction, actualPrice, nextPrice = null) {
        const isAccurate = nextPrice !== null ? 
            ((nextPrice > actualPrice && conviction.trend === 'UP') ||
             (nextPrice < actualPrice && conviction.trend === 'DOWN') ||
             (Math.abs(nextPrice - actualPrice) < 100 && conviction.trend === 'NEUTRAL')) : 
            null;

        const record = {
            timestamp: Date.now(),
            conviction: conviction.overallConfidence,
            trend: conviction.trend,
            strength: conviction.strength,
            indicatorsAgree: conviction.details.numIndicatorsAgreed,
            totalIndicators: conviction.details.totalIndicators,
            volatilityLevel: conviction.details.volatilityLevel,
            isAccurate,
            price: actualPrice,
            nextPrice
        };

        this.history.push(record);
        this.updateStatistics(record);
        return record;
    }

    /**
     * Atualiza estatísticas
     */
    updateStatistics(record) {
        this.statistics.totalCycles++;
        this.statistics.avgConviction = 
            (this.statistics.avgConviction * (this.statistics.totalCycles - 1) + record.conviction) / 
            this.statistics.totalCycles;

        this.statistics.maxConviction = Math.max(this.statistics.maxConviction, record.conviction);
        this.statistics.minConviction = this.statistics.totalCycles === 1 ? 
            record.conviction : 
            Math.min(this.statistics.minConviction, record.conviction);

        if (record.conviction > 0.7) this.statistics.strongSignals++;
        if (record.conviction < 0.5) this.statistics.weakSignals++;
        
        if (record.indicatorsAgree <= record.totalIndicators / 2) {
            this.statistics.divergences++;
        }

        if (record.isAccurate === true) this.statistics.trendsCorrect++;
        if (record.isAccurate === false) this.statistics.trendsFalse++;
    }

    /**
     * Analisa períodos de alta volatilidade vs convicção
     */
    analyzeVolatilityCorrelation() {
        const extremeVolPeriods = this.history.filter(h => h.volatilityLevel === 'EXTREME');
        const normalVolPeriods = this.history.filter(h => h.volatilityLevel !== 'EXTREME');

        const extremeAvgConviction = extremeVolPeriods.length > 0 ?
            extremeVolPeriods.reduce((a, b) => a + b.conviction, 0) / extremeVolPeriods.length :
            0;

        const normalAvgConviction = normalVolPeriods.length > 0 ?
            normalVolPeriods.reduce((a, b) => a + b.conviction, 0) / normalVolPeriods.length :
            0;

        return {
            extremeVolCount: extremeVolPeriods.length,
            extremeAvgConviction,
            normalVolCount: normalVolPeriods.length,
            normalAvgConviction,
            difference: normalAvgConviction - extremeAvgConviction
        };
    }

    /**
     * Encontra períodos de divergência
     */
    findDivergencePeriods(minLength = 3) {
        const divergences = [];
        let currentDivergenceStart = null;
        let divergenceLength = 0;

        this.history.forEach((record, idx) => {
            const indicatorRatio = record.indicatorsAgree / record.totalIndicators;
            
            if (indicatorRatio <= 0.5) {
                if (currentDivergenceStart === null) {
                    currentDivergenceStart = idx;
                    divergenceLength = 1;
                } else {
                    divergenceLength++;
                }
            } else {
                if (divergenceLength >= minLength) {
                    divergences.push({
                        startIdx: currentDivergenceStart,
                        endIdx: idx - 1,
                        length: divergenceLength,
                        avgConviction: this.history
                            .slice(currentDivergenceStart, idx)
                            .reduce((a, h) => a + h.conviction, 0) / divergenceLength
                    });
                }
                currentDivergenceStart = null;
                divergenceLength = 0;
            }
        });

        return divergences;
    }

    /**
     * Calcula taxa de precisão por nível de convicção
     */
    calculateAccuracyByConfidenceLevel() {
        if (this.statistics.trendsCorrect === 0 && this.statistics.trendsFalse === 0) {
            return null;
        }

        const ranges = [
            { min: 0.8, max: 1.0, label: 'Very Strong (80-100%)' },
            { min: 0.7, max: 0.8, label: 'Strong (70-80%)' },
            { min: 0.6, max: 0.7, label: 'Moderate (60-70%)' },
            { min: 0.5, max: 0.6, label: 'Weak (50-60%)' },
            { min: 0.0, max: 0.5, label: 'Very Weak (<50%)' }
        ];

        return ranges.map(range => {
            const inRange = this.history.filter(h => 
                h.isAccurate !== null && 
                h.conviction >= range.min && 
                h.conviction < range.max
            );

            if (inRange.length === 0) {
                return {
                    ...range,
                    count: 0,
                    accuracy: null,
                    correct: 0,
                    incorrect: 0
                };
            }

            const correct = inRange.filter(h => h.isAccurate === true).length;
            const incorrect = inRange.filter(h => h.isAccurate === false).length;

            return {
                ...range,
                count: inRange.length,
                accuracy: correct / inRange.length,
                correct,
                incorrect
            };
        });
    }

    /**
     * Identifica períodos de maior lucro vs convicção
     */
    correlateConvictionWithProfit(profits) {
        if (profits.length !== this.history.length) {
            console.warn('⚠️ Comprimento do histórico de lucros não corresponde');
            return null;
        }

        const correlation = this.calculatePearsonCorrelation(
            this.history.map(h => h.conviction),
            profits
        );

        return {
            correlation: correlation.toFixed(3),
            interpretation: correlation > 0.7 ? 'Forte correlação positiva' :
                           correlation > 0.4 ? 'Correlação moderada' :
                           correlation > 0 ? 'Correlação fraca' :
                           correlation > -0.4 ? 'Correlação fraca negativa' :
                           'Correlação negativa (alarme!)'
        };
    }

    /**
     * Calcula correlação de Pearson
     */
    calculatePearsonCorrelation(x, y) {
        const n = x.length;
        const meanX = x.reduce((a, b) => a + b) / n;
        const meanY = y.reduce((a, b) => a + b) / n;

        const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
        const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
        const denomY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));

        return denomX * denomY === 0 ? 0 : numerator / (denomX * denomY);
    }

    /**
     * Gera relatório completo
     */
    generateReport() {
        const lines = [];

        lines.push(chalk.blue('═══════════════════════════════════════════════'));
        lines.push(chalk.bold.white('        📊 ANÁLISE DE CONVICÇÃO'));
        lines.push(chalk.blue('═══════════════════════════════════════════════'));

        // Estatísticas Básicas
        lines.push('');
        lines.push(chalk.yellow('📈 Estatísticas Básicas:'));
        lines.push(`   Total de ciclos: ${this.statistics.totalCycles}`);
        lines.push(`   Convicção média: ${(this.statistics.avgConviction * 100).toFixed(1)}%`);
        lines.push(`   Máxima convicção: ${(this.statistics.maxConviction * 100).toFixed(1)}%`);
        lines.push(`   Mínima convicção: ${(this.statistics.minConviction * 100).toFixed(1)}%`);

        // Distribuição de Sinais
        lines.push('');
        lines.push(chalk.yellow('⚡ Distribuição de Sinais:'));
        lines.push(`   Sinais fortes (>70%): ${this.statistics.strongSignals} (${(this.statistics.strongSignals/this.statistics.totalCycles*100).toFixed(1)}%)`);
        lines.push(`   Sinais fracos (<50%): ${this.statistics.weakSignals} (${(this.statistics.weakSignals/this.statistics.totalCycles*100).toFixed(1)}%)`);
        lines.push(`   Períodos divergência: ${this.statistics.divergences} (${(this.statistics.divergences/this.statistics.totalCycles*100).toFixed(1)}%)`);

        // Precisão de Tendência
        if (this.statistics.trendsCorrect + this.statistics.trendsFalse > 0) {
            const totalPredictions = this.statistics.trendsCorrect + this.statistics.trendsFalse;
            const accuracy = (this.statistics.trendsCorrect / totalPredictions * 100).toFixed(1);
            lines.push('');
            lines.push(chalk.yellow('✅ Precisão de Tendência:'));
            lines.push(`   Tendências corretas: ${this.statistics.trendsCorrect}/${totalPredictions} (${accuracy}%)`);
            lines.push(`   Tendências incorretas: ${this.statistics.trendsFalse}/${totalPredictions}`);
        }

        // Volatilidade
        const volCorr = this.analyzeVolatilityCorrelation();
        lines.push('');
        lines.push(chalk.yellow('🌊 Análise de Volatilidade:'));
        lines.push(`   Períodos extrema volatilidade: ${volCorr.extremeVolCount}`);
        lines.push(`      Convicção média: ${(volCorr.extremeAvgConviction * 100).toFixed(1)}%`);
        lines.push(`   Períodos normal volatilidade: ${volCorr.normalVolCount}`);
        lines.push(`      Convicção média: ${(volCorr.normalAvgConviction * 100).toFixed(1)}%`);
        lines.push(`   Diferença: ${(volCorr.difference * 100).toFixed(1)}% (${volCorr.normalAvgConviction > volCorr.extremeAvgConviction ? '↑' : '↓'})`);

        // Divergências
        const divPeriods = this.findDivergencePeriods();
        if (divPeriods.length > 0) {
            lines.push('');
            lines.push(chalk.yellow('⚠️ Períodos de Divergência (3+ ciclos):'));
            divPeriods.slice(0, 5).forEach((period, idx) => {
                lines.push(`   ${idx + 1}. Ciclos ${period.startIdx}-${period.endIdx} (${period.length} ciclos)`);
                lines.push(`      Convicção média: ${(period.avgConviction * 100).toFixed(1)}%`);
            });
            if (divPeriods.length > 5) {
                lines.push(`   ... e mais ${divPeriods.length - 5} períodos`);
            }
        }

        // Precisão por Nível
        const accuracyByLevel = this.calculateAccuracyByConfidenceLevel();
        if (accuracyByLevel) {
            lines.push('');
            lines.push(chalk.yellow('🎯 Precisão por Nível de Convicção:'));
            accuracyByLevel.forEach(level => {
                if (level.count > 0) {
                    const accStr = (level.accuracy * 100).toFixed(1);
                    const color = level.accuracy > 0.7 ? chalk.green : 
                                 level.accuracy > 0.5 ? chalk.yellow : 
                                 chalk.red;
                    lines.push(color(`   ${level.label}: ${level.correct}/${level.count} (${accStr}%)`));
                }
            });
        }

        lines.push('');
        lines.push(chalk.blue('═══════════════════════════════════════════════'));

        return lines.join('\n');
    }

    /**
     * Salva histórico em arquivo
     */
    saveToFile(filename = 'conviction_history.json') {
        const data = {
            exportedAt: new Date().toISOString(),
            statistics: this.statistics,
            history: this.history
        };
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(chalk.green(`✅ Histórico salvo em: ${filename}`));
    }

    /**
     * Carrega histórico de arquivo
     */
    loadFromFile(filename = 'conviction_history.json') {
        if (!fs.existsSync(filename)) {
            console.log(chalk.yellow(`⚠️ Arquivo não encontrado: ${filename}`));
            return false;
        }
        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        this.history = data.history || [];
        this.statistics = data.statistics || {};
        console.log(chalk.green(`✅ Histórico carregado: ${this.history.length} ciclos`));
        return true;
    }
}

// Teste se executado diretamente
if (require.main === module) {
    const analyzer = new ConvictionAnalyzer();

    // Simular histórico
    const system = new ConfidenceSystem();
    
    console.log(chalk.bold.cyan('\n🧪 Simulando histórico de convicção...\n'));

    // Gerar 50 ciclos simulados
    for (let i = 0; i < 50; i++) {
        const price = 655000 + Math.sin(i / 5) * 500 + Math.random() * 200 - 100;
        const nextPrice = price + (Math.random() * 200 - 100);

        // Indicadores variáveis
        const rsi = 40 + Math.sin(i / 7) * 30;
        const emaShort = price + (Math.random() * 100 - 50);
        const emaLong = price - 200 + (Math.random() * 100 - 50);

        const indicators = {
            rsi,
            emaShort,
            emaLong,
            macd: Math.sin(i / 4) * 500,
            signal: Math.sin(i / 4 + 0.5) * 500,
            price,
            volatility: (0.5 + Math.abs(Math.sin(i / 6))) / 100,
            trend: emaShort > emaLong ? 'up' : 'down'
        };

        const conviction = system.calculateConviction(indicators);
        analyzer.recordConviction(conviction, price, nextPrice);
    }

    console.log(analyzer.generateReport());
    
    // Salvar para análise futura
    analyzer.saveToFile();
}

module.exports = ConvictionAnalyzer;
