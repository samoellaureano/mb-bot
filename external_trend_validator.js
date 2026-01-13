#!/usr/bin/env node
/**
 * external_trend_validator.js - Validador de Tendências Externas
 * Consulta múltiplas fontes para validar tendências do Bitcoin
 */

const axios = require('axios');
const chalk = require('chalk');

class ExternalTrendValidator {
    constructor() {
        this.sources = {
            coinGecko: 'https://api.coingecko.com/api/v3',
            binance: 'https://api.binance.com/api/v3',
            fearGreed: 'https://api.alternative.me/fng/'
        };
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const colors = {
            INFO: chalk.cyan,
            WARN: chalk.yellow,
            ERROR: chalk.red,
            SUCCESS: chalk.green
        };
        const colorFn = colors[level] || (text => text);
        console.log(`${timestamp} [TREND ${level}] ${message}`, data ? JSON.stringify(data) : '');
    }

    // Obter dados do CoinGecko (tendência de 24h, 7d, 30d)
    async getCoinGeckoTrend() {
        try {
            const response = await axios.get(`${this.sources.coinGecko}/coins/bitcoin`, {
                params: {
                    localization: false,
                    tickers: false,
                    market_data: true,
                    community_data: false,
                    developer_data: false,
                    sparkline: false
                },
                timeout: 10000
            });

            const marketData = response.data.market_data;
            return {
                price_change_24h: marketData.price_change_percentage_24h,
                price_change_7d: marketData.price_change_percentage_7d,
                price_change_30d: marketData.price_change_percentage_30d,
                market_cap_rank: response.data.market_cap_rank,
                current_price_usd: marketData.current_price.usd
            };
        } catch (error) {
            this.log('ERROR', 'Erro ao consultar CoinGecko:', error.message);
            return null;
        }
    }

    // Obter dados da Binance (RSI, volume, momentum)
    async getBinanceTrend() {
        try {
            // Klines de 24h para calcular RSI e momentum
            const klinesResponse = await axios.get(`${this.sources.binance}/klines`, {
                params: {
                    symbol: 'BTCUSDT',
                    interval: '1h',
                    limit: 24
                },
                timeout: 10000
            });

            const klines = klinesResponse.data;
            const prices = klines.map(k => parseFloat(k[4])); // Close prices
            const volumes = klines.map(k => parseFloat(k[5]));
            
            // Calcular RSI simples
            const rsi = this.calculateSimpleRSI(prices, 14);
            
            // Calcular momentum (diferença percentual 24h)
            const momentum = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
            
            // Volume médio
            const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

            return {
                rsi: rsi,
                momentum_24h: momentum,
                avg_volume: avgVolume,
                current_price: prices[prices.length - 1]
            };
        } catch (error) {
            this.log('ERROR', 'Erro ao consultar Binance:', error.message);
            return null;
        }
    }

    // Obter índice Fear & Greed
    async getFearGreedIndex() {
        try {
            const response = await axios.get(`${this.sources.fearGreed}?limit=1`, {
                timeout: 10000
            });

            const data = response.data.data[0];
            return {
                value: parseInt(data.value),
                classification: data.value_classification,
                timestamp: data.timestamp
            };
        } catch (error) {
            this.log('ERROR', 'Erro ao consultar Fear & Greed:', error.message);
            return null;
        }
    }

    // Calcular RSI simples
    calculateSimpleRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        let gains = 0, losses = 0;
        for (let i = Math.max(0, changes.length - period); i < changes.length; i++) {
            if (changes[i] > 0) gains += changes[i];
            else losses += Math.abs(changes[i]);
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // Analisar tendência combinada
    async analyzeCombinedTrend() {
        this.log('INFO', 'Iniciando análise de tendência externa...');
        
        const [coinGecko, binance, fearGreed] = await Promise.all([
            this.getCoinGeckoTrend(),
            this.getBinanceTrend(),
            this.getFearGreedIndex()
        ]);

        if (!coinGecko && !binance && !fearGreed) {
            this.log('ERROR', 'Falha ao obter dados de todas as fontes');
            return null;
        }

        // Calcular score de tendência (0-100, 50=neutro)
        let trendScore = 50;
        let confidence = 0;

        // CoinGecko (peso: 40%)
        if (coinGecko) {
            const cgScore = this.calculateCoinGeckoScore(coinGecko);
            trendScore += (cgScore - 50) * 0.4;
            confidence += 0.4;
            this.log('INFO', 'CoinGecko Score:', cgScore);
        }

        // Binance (peso: 40%)
        if (binance) {
            const binanceScore = this.calculateBinanceScore(binance);
            trendScore += (binanceScore - 50) * 0.4;
            confidence += 0.4;
            this.log('INFO', 'Binance Score:', binanceScore);
        }

        // Fear & Greed (peso: 20%)
        if (fearGreed) {
            const fgScore = fearGreed.value; // Já está 0-100
            trendScore += (fgScore - 50) * 0.2;
            confidence += 0.2;
            this.log('INFO', 'Fear & Greed Score:', fgScore);
        }

        const trend = trendScore > 60 ? 'BULLISH' : 
                     trendScore < 40 ? 'BEARISH' : 'NEUTRAL';

        const result = {
            trend,
            score: Math.round(trendScore),
            confidence: Math.round(confidence * 100),
            sources: {
                coinGecko: coinGecko || 'unavailable',
                binance: binance || 'unavailable', 
                fearGreed: fearGreed || 'unavailable'
            },
            timestamp: new Date().toISOString()
        };

        this.log('SUCCESS', 'Análise externa concluída:', {
            trend: result.trend,
            score: result.score,
            confidence: result.confidence
        });

        return result;
    }

    calculateCoinGeckoScore(data) {
        // Combinar múltiplos timeframes
        let score = 50;
        
        // 24h (peso maior)
        if (data.price_change_24h > 5) score += 20;
        else if (data.price_change_24h > 1) score += 10;
        else if (data.price_change_24h > 0) score += 5;
        else if (data.price_change_24h < -5) score -= 20;
        else if (data.price_change_24h < -1) score -= 10;
        else if (data.price_change_24h < 0) score -= 5;

        // 7d (peso médio)
        if (data.price_change_7d > 10) score += 15;
        else if (data.price_change_7d > 5) score += 8;
        else if (data.price_change_7d > 0) score += 3;
        else if (data.price_change_7d < -10) score -= 15;
        else if (data.price_change_7d < -5) score -= 8;
        else if (data.price_change_7d < 0) score -= 3;

        return Math.max(0, Math.min(100, score));
    }

    calculateBinanceScore(data) {
        let score = 50;

        // RSI
        if (data.rsi > 70) score += 10; // Sobrecomprado, mas momentum
        else if (data.rsi > 50) score += 15;
        else if (data.rsi < 30) score -= 10; // Sobrevendido, mas fraco
        else if (data.rsi < 50) score -= 15;

        // Momentum 24h
        if (data.momentum_24h > 3) score += 20;
        else if (data.momentum_24h > 1) score += 10;
        else if (data.momentum_24h > 0) score += 5;
        else if (data.momentum_24h < -3) score -= 20;
        else if (data.momentum_24h < -1) score -= 10;
        else if (data.momentum_24h < 0) score -= 5;

        return Math.max(0, Math.min(100, score));
    }

    // Método para validar se as decisões do bot estão alinhadas
    async validateBotDecisions(botTrend, botConfidence) {
        const externalAnalysis = await this.analyzeCombinedTrend();
        
        if (!externalAnalysis) {
            return {
                aligned: null,
                message: 'Não foi possível obter dados externos',
                external: null
            };
        }

        // Mapear tendências para comparação
        const botTrendNormalized = this.normalizeTrend(botTrend);
        const externalTrendNormalized = this.normalizeTrend(externalAnalysis.trend);

        const aligned = botTrendNormalized === externalTrendNormalized;
        const scoreAlignment = Math.abs(externalAnalysis.score - 50) > 10; // Tendência forte externa

        return {
            aligned,
            strong_external_signal: scoreAlignment,
            bot_trend: botTrendNormalized,
            external_trend: externalTrendNormalized,
            external_score: externalAnalysis.score,
            confidence_match: Math.abs(botConfidence - (externalAnalysis.confidence / 100)) < 0.3,
            message: aligned ? 
                'Bot alinhado com tendência externa' : 
                `Divergência: Bot=${botTrendNormalized}, Externo=${externalTrendNormalized}`,
            external_data: externalAnalysis
        };
    }

    normalizeTrend(trend) {
        const trendStr = trend.toString().toUpperCase();
        if (trendStr.includes('UP') || trendStr.includes('BULL')) return 'BULLISH';
        if (trendStr.includes('DOWN') || trendStr.includes('BEAR')) return 'BEARISH';
        return 'NEUTRAL';
    }
}

module.exports = ExternalTrendValidator;

// Se executado diretamente, fazer teste
if (require.main === module) {
    const validator = new ExternalTrendValidator();
    validator.analyzeCombinedTrend().then(result => {
        console.log('\n' + '='.repeat(50));
        console.log('RESULTADO DA ANÁLISE EXTERNA:');
        console.log('='.repeat(50));
        console.table(result);
    }).catch(console.error);
}