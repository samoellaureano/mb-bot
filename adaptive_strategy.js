// ════════════════════════════════════════════════════════════════
// ESTRATÉGIA ADAPTATIVA - CRESCIMENTO (ALTA) vs PROTEÇÃO (BAIXA)
// ════════════════════════════════════════════════════════════════
//
// Objetivo:
//   • Em tendência ALTA: Acumular BTC (aumentar exposição)
//   • Em tendência BAIXA: Proteger BRL (reduzir risco)
//   • Ajusta spread, viés e posição máxima conforme tendência
//
// Parâmetros adaptativos:
//   • SPREAD_PCT: Ajusta entre 1.0% (alta) a 1.8% (baixa)
//   • BIAS: Ajusta entre +0.0001 (comprar) a -0.0001 (vender)
//   • MAX_POSITION: Ajusta entre 0.0005 (alta) a 0.0002 (baixa)
//   • ORDER_SIZE: Reduzido para 0.000005 (micro-ordens para capital baixo)
// ════════════════════════════════════════════════════════════════

/**
 * Calcula os parâmetros adaptativos baseado na tendência
 * @param {string} trend - 'up', 'down', ou 'neutral'
 * @param {number} confidence - 0 a 1
 * @returns {object} - Parâmetros adaptativos { spread, orderSize, bias, maxPosition, stopLoss }
 */
function getAdaptiveParameters(trend, confidence = 0.5) {
    const params = {
        up: {
            // TENDÊNCIA ALTA - Acumular BTC
            spread: 0.010,         // 1.0% - Estreito para atrair BUYS
            orderSize: 0.000005,   // Micro-ordens (R$ 2.62/ordem @ 523k)
            bias: 0.00010,         // Viés POSITIVO - Inclinado para COMPRAR
            maxPosition: 0.0005,   // Pode acumular até 0.0005 BTC
            stopLoss: 0.0012,      // 0.12% - Proteção apertada
            description: "📈 ACUMULAÇÃO: Comprando BTC em alta"
        },
        neutral: {
            // TENDÊNCIA NEUTRA - Market Making puro
            spread: 0.012,         // 1.2% - Normal
            orderSize: 0.000005,   // Micro-ordens
            bias: 0.0,             // Viés ZERO - Neutral
            maxPosition: 0.0003,   // Posição moderada
            stopLoss: 0.0012,      // 0.12% - Proteção normal
            description: "⚪ NEUTRAL: Market making equilibrado"
        },
        down: {
            // TENDÊNCIA BAIXA - Proteger BRL
            spread: 0.018,         // 1.8% - Largo para evitar/lucrar
            orderSize: 0.000005,   // Micro-ordens (reduz risco)
            bias: -0.00010,        // Viés NEGATIVO - Inclinado para VENDER
            maxPosition: 0.0002,   // Limite baixo - Protege capital
            stopLoss: 0.0020,      // 0.20% - Stop maior (protege BRL)
            description: "📉 PROTEÇÃO: Vendendo BTC em queda"
        }
    };

    return params[trend] || params.neutral;
}

/**
 * Ajusta a ordem de compra/venda conforme viés da estratégia
 * @param {number} basePrice - Preço médio
 * @param {object} adaptiveParams - Parâmetros adaptativos
 * @returns {object} - { buyPrice, sellPrice }
 */
function getAdaptivePrices(basePrice, adaptiveParams) {
    const { spread, bias } = adaptiveParams;
    
    // Em tendência HIGH: Coloca BUY mais perto (tenta comprar)
    // Em tendência LOW: Coloca SELL mais perto (tenta vender)
    // Em NEUTRAL: Equilibrado
    
    const buyPrice = basePrice * (1 - spread / 2) + bias;
    const sellPrice = basePrice * (1 + spread / 2) + bias;
    
    return { buyPrice, sellPrice };
}

/**
 * Determina o viés de quantidade (quantas ordens BUY vs SELL)
 * @param {string} trend - 'up', 'down', 'neutral'
 * @returns {object} - { buyQuantity, sellQuantity }
 */
function getAdaptiveOrderRatio(trend) {
    // Em alta: 70% BUY, 30% SELL
    // Em baixa: 30% BUY, 70% SELL
    // Em neutral: 50% BUY, 50% SELL
    
    const ratios = {
        up: { buy: 0.7, sell: 0.3, description: "Colocando mais BUY (+70%) do que SELL" },
        neutral: { buy: 0.5, sell: 0.5, description: "Colocando BUY e SELL equilibrados" },
        down: { buy: 0.3, sell: 0.7, description: "Colocando mais SELL (+70%) do que BUY" }
    };
    
    return ratios[trend] || ratios.neutral;
}

/**
 * Calcula a quantidade de BTC a serem acumulados/vendidos
 * @param {number} currentBTC - BTC atual no portfolio
 * @param {number} targetBTC - BTC alvo conforme tendência
 * @returns {number} - Quantidade BTC a comprar (positivo) ou vender (negativo)
 */
function calculateBTCTargetPosition(currentBTC, trend, totalCapital) {
    // Cálculo de alvo conforme tendência
    const targets = {
        up: totalCapital * 0.90,      // Em alta: 90% em BTC
        neutral: totalCapital * 0.60, // Em neutral: 60% em BTC
        down: totalCapital * 0.30     // Em baixa: 30% em BTC (mais caixa)
    };
    
    const targetValue = targets[trend] || targets.neutral;
    const targetBTC = targetValue / getCurrentPrice(); // Hipotético
    const diff = targetBTC - currentBTC;
    
    return {
        targetBTC,
        targetBRL: targetValue,
        diff,
        action: diff > 0 ? 'BUY' : 'SELL'
    };
}

/**
 * Monta um relatório da estratégia atual
 * @param {string} trend - tendência atual
 * @param {object} adaptiveParams - parâmetros adaptativos
 * @returns {string} - Relatório formatado
 */
function logAdaptiveStrategy(trend, adaptiveParams, orderRatio) {
    const log = [
        "",
        "═════════════════════════════════════════════════════════════════",
        `📊 ESTRATÉGIA ADAPTATIVA ATIVADA: ${adaptiveParams.description}`,
        "═════════════════════════════════════════════════════════════════",
        "",
        `🎯 TENDÊNCIA: ${trend.toUpperCase()}`,
        `   • Spread: ${(adaptiveParams.spread * 100).toFixed(1)}%`,
        `   • Order Size: ${(adaptiveParams.orderSize * 1e6).toFixed(0)} µBTC (micro-ordens)`,
        `   • Viés: ${adaptiveParams.bias > 0 ? '+' : ''}${adaptiveParams.bias.toFixed(5)} (${adaptiveParams.bias > 0 ? 'COMPRA' : adaptiveParams.bias < 0 ? 'VENDA' : 'NEUTRAL'})`,
        `   • Max Position: ${adaptiveParams.maxPosition.toFixed(6)} BTC`,
        `   • Stop Loss: ${(adaptiveParams.stopLoss * 100).toFixed(2)}%`,
        "",
        `📋 PROPORÇÃO DE ORDENS:`,
        `   • BUY: ${(orderRatio.buy * 100).toFixed(0)}% | SELL: ${(orderRatio.sell * 100).toFixed(0)}%`,
        `   • ${orderRatio.description}`,
        "",
        "═════════════════════════════════════════════════════════════════",
        ""
    ];
    
    return log.join("\n");
}

// EXPORTAR para bot.js
module.exports = {
    getAdaptiveParameters,
    getAdaptivePrices,
    getAdaptiveOrderRatio,
    calculateBTCTargetPosition,
    logAdaptiveStrategy
};
