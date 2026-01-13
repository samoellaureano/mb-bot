#!/usr/bin/env node
/**
 * test_trading_validation.js - Teste de Validação de Decisões de Trading
 * Valida se o bot está tomando decisões corretas baseadas em tendências
 */

require('dotenv').config();
const ExternalTrendValidator = require('./external_trend_validator');
const chalk = require('chalk');

async function testTradingValidation() {
    console.log(chalk.cyan('🧪 Teste de Validação de Decisões de Trading'));
    console.log('='.repeat(60));

    const validator = new ExternalTrendValidator();
    
    try {
        // 1. Obter análise externa atual
        console.log(chalk.yellow('\n📊 1. Análise de Tendências Externas:'));
        const externalData = await validator.analyzeCombinedTrend();
        
        if (!externalData) {
            console.log(chalk.red('❌ Não foi possível obter dados externos'));
            return;
        }

        console.table({
            'Tendência': externalData.trend,
            'Score': `${externalData.score}/100`,
            'Confiança': `${externalData.confidence}%`,
            'Timestamp': new Date(externalData.timestamp).toLocaleString('pt-BR')
        });

        // 2. Simular diferentes cenários de bot
        console.log(chalk.yellow('\n🤖 2. Simulação de Cenários do Bot:'));
        
        const scenarios = [
            { botTrend: 'up', botConfidence: 0.8, description: 'Bot BULLISH (alta confiança)' },
            { botTrend: 'down', botConfidence: 0.7, description: 'Bot BEARISH (alta confiança)' },
            { botTrend: 'neutral', botConfidence: 0.5, description: 'Bot NEUTRAL (média confiança)' },
            { botTrend: 'up', botConfidence: 0.3, description: 'Bot BULLISH (baixa confiança)' },
            { botTrend: 'down', botConfidence: 0.2, description: 'Bot BEARISH (baixa confiança)' }
        ];

        for (const scenario of scenarios) {
            console.log(`\n${chalk.blue('Cenário:')} ${scenario.description}`);
            
            // Simular validação para compra
            const buyValidation = await simulateValidation(
                externalData, 
                scenario.botTrend, 
                scenario.botConfidence, 
                'buy'
            );
            
            // Simular validação para venda
            const sellValidation = await simulateValidation(
                externalData, 
                scenario.botTrend, 
                scenario.botConfidence, 
                'sell'
            );

            console.log(`  🟢 COMPRA: ${buyValidation.shouldTrade ? '✅ Permitido' : '❌ Bloqueado'} - ${buyValidation.reason}`);
            console.log(`  🔴 VENDA: ${sellValidation.shouldTrade ? '✅ Permitido' : '❌ Bloqueado'} - ${sellValidation.reason}`);
        }

        // 3. Análise de fontes individuais
        console.log(chalk.yellow('\n📈 3. Análise de Fontes Individuais:'));
        
        const sources = externalData.sources;
        
        if (sources.coinGecko !== 'unavailable') {
            console.log(`CoinGecko: 24h=${sources.coinGecko.price_change_24h?.toFixed(2)}% | 7d=${sources.coinGecko.price_change_7d?.toFixed(2)}%`);
        }
        
        if (sources.binance !== 'unavailable') {
            console.log(`Binance: RSI=${sources.binance.rsi?.toFixed(2)} | Momentum 24h=${sources.binance.momentum_24h?.toFixed(2)}%`);
        }
        
        if (sources.fearGreed !== 'unavailable') {
            console.log(`Fear & Greed: ${sources.fearGreed.value} (${sources.fearGreed.classification})`);
        }

        // 4. Recomendações estratégicas
        console.log(chalk.yellow('\n💡 4. Recomendações Estratégicas:'));
        
        const recommendations = generateRecommendations(externalData);
        recommendations.forEach(rec => console.log(`  • ${rec}`));

        // 5. Alertas e avisos
        console.log(chalk.yellow('\n⚠️  5. Alertas e Avisos:'));
        
        const alerts = generateAlerts(externalData);
        if (alerts.length > 0) {
            alerts.forEach(alert => console.log(chalk.red(`  🚨 ${alert}`)));
        } else {
            console.log(chalk.green('  ✅ Nenhum alerta crítico'));
        }

    } catch (error) {
        console.error(chalk.red('❌ Erro no teste:'), error.message);
    }
}

// Simular a função validateTradingDecision do bot
async function simulateValidation(externalData, botTrend, botConfidence, side) {
    const external = externalData;
    const externalTrend = external.trend;
    const externalScore = external.score;
    
    // Mesma lógica do bot
    if (externalScore > 70 && side === 'buy' && externalTrend !== 'BULLISH') {
        return { 
            shouldTrade: false, 
            reason: `Tendência externa BEARISH forte (${externalScore}/100) - evitando compra` 
        };
    }
    
    if (externalScore < 30 && side === 'sell' && externalTrend !== 'BEARISH') {
        return { 
            shouldTrade: false, 
            reason: `Tendência externa BULLISH forte (${100-externalScore}/100) - evitando venda` 
        };
    }
    
    const botTrendNorm = botTrend === 'up' ? 'BULLISH' : botTrend === 'down' ? 'BEARISH' : 'NEUTRAL';
    const aligned = botTrendNorm === externalTrend || externalTrend === 'NEUTRAL';
    
    if (aligned) {
        return { 
            shouldTrade: true, 
            reason: `Tendências alinhadas: Bot=${botTrendNorm}, Externo=${externalTrend}` 
        };
    }
    
    if (Math.abs(externalScore - 50) > 20) {
        return { 
            shouldTrade: false, 
            reason: `Divergência com sinal externo forte: Bot=${botTrendNorm}, Externo=${externalTrend} (${externalScore}/100)` 
        };
    }
    
    return { 
        shouldTrade: true, 
        reason: `Divergência fraca - permitindo trade cauteloso` 
    };
}

function generateRecommendations(externalData) {
    const recommendations = [];
    const score = externalData.score;
    const trend = externalData.trend;
    
    if (score > 70) {
        recommendations.push(`Tendência BULLISH forte - favorecer ordens de compra`);
        recommendations.push(`Considerar aumentar tamanho de posição em quedas`);
    } else if (score < 30) {
        recommendations.push(`Tendência BEARISH forte - favorecer ordens de venda`);
        recommendations.push(`Ser cauteloso com compras em altas`);
    } else {
        recommendations.push(`Mercado NEUTRO - estratégia de market making adequada`);
        recommendations.push(`Manter spreads conservadores`);
    }
    
    if (externalData.confidence < 70) {
        recommendations.push(`Confiança moderada (${externalData.confidence}%) - reduzir tamanho de posição`);
    }
    
    return recommendations;
}

function generateAlerts(externalData) {
    const alerts = [];
    const score = externalData.score;
    const sources = externalData.sources;
    
    // Alert para divergência forte entre fontes
    if (sources.coinGecko !== 'unavailable' && sources.fearGreed !== 'unavailable') {
        const cgBullish = sources.coinGecko.price_change_24h > 2;
        const fgBearish = sources.fearGreed.value < 30;
        
        if (cgBullish && fgBearish) {
            alerts.push('Divergência: Preço subindo mas Fear & Greed muito baixo');
        }
    }
    
    // Alert para volatilidade extrema
    if (sources.binance !== 'unavailable') {
        if (Math.abs(sources.binance.momentum_24h) > 8) {
            alerts.push(`Momentum extremo: ${sources.binance.momentum_24h.toFixed(2)}% em 24h`);
        }
    }
    
    // Alert para condições de sobrecompra/sobrevenda
    if (sources.binance !== 'unavailable') {
        if (sources.binance.rsi > 80) {
            alerts.push(`RSI muito alto (${sources.binance.rsi.toFixed(2)}) - possível correção`);
        } else if (sources.binance.rsi < 20) {
            alerts.push(`RSI muito baixo (${sources.binance.rsi.toFixed(2)}) - possível recuperação`);
        }
    }
    
    return alerts;
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testTradingValidation().catch(console.error);
}

module.exports = testTradingValidation;