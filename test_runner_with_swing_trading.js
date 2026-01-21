#!/usr/bin/env node
/**
 * test_runner_with_swing_trading.js
 * 
 * Versão dos testes que RESPEITA o flag USE_SWING_TRADING
 * Se USE_SWING_TRADING=true, usa testIntegratedSystemOptimized (swing trading)
 * Se USE_SWING_TRADING=false, usa testes padrão
 */

const fs = require('fs');
const BTCAccumulator = require('./btc_accumulator');
const SwingTradingStrategy = require('./swing_trading_strategy');

// Ler dados de candles
let candlesData = [];
try {
    const path = './path/to/candles.csv';
    if (fs.existsSync(path)) {
        const lines = fs.readFileSync(path, 'utf8').split('\n').slice(1);
        candlesData = lines
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split(',');
                return {
                    close: parseFloat(parts[4]),
                    high: parseFloat(parts[2]),
                    low: parseFloat(parts[3]),
                    open: parseFloat(parts[1]),
                    volume: parseFloat(parts[5])
                };
            });
    }
} catch (e) {
    console.warn(`⚠ Aviso: Não consegui carregar dados de candles: ${e.message}`);
}

/**
 * Teste com Swing Trading (USE_SWING_TRADING=true)
 */
function testWithSwingTrading(prices, testName) {
    console.log(`\n[SWING_TRADING] ${testName} - Testando estratégia swing trading...`);
    
    if (!prices || prices.length === 0) {
        console.error(`[ERROR] Preços não disponíveis para teste`);
        return { passed: false, error: 'Sem dados' };
    }

    const strategy = new SwingTradingStrategy({
        dropThreshold: 0.003,    // 0.3%
        profitTarget: 0.004,     // 0.4%
        stopLoss: -0.008         // -0.8%
    });

    let brl = 200;
    let btc = 0.0002;
    const initialValue = brl + btc * prices[0];
    let trades = 0;
    let profits = 0;
    let losses = 0;

    // Simular
    for (let i = 20; i < prices.length; i++) {
        const price = prices[i];
        strategy.updatePriceHistory(price);

        const buySignal = strategy.shouldBuy(price);
        const sellSignal = strategy.shouldSell(price);

        // Compra
        if (buySignal.signal && !strategy.inPosition) {
            const qty = Math.min(0.00008, (brl * 0.5) / price);
            if (qty > 0.00001) {
                strategy.buy(price, qty);
                brl -= qty * price;
                btc += qty;
            }
        }

        // Venda
        if (sellSignal.signal && strategy.inPosition) {
            const result = strategy.sell(price, sellSignal.type);
            brl += strategy.positionQty * price;
            btc -= strategy.positionQty;
            trades++;
            if (result.pnl > 0) profits++;
            else losses++;
        }
    }

    // Fechar posição aberta
    if (strategy.inPosition) {
        brl += strategy.positionQty * prices[prices.length - 1];
        btc -= strategy.positionQty;
    }

    const finalValue = brl + btc * prices[prices.length - 1];
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

    return {
        testName,
        passed: roi > priceChange,
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades,
        profits,
        losses,
        pnlBRL: pnl.toFixed(2),
        gainVsHold: (roi - priceChange).toFixed(2)
    };
}

/**
 * Teste padrão com BTCAccumulator
 */
function testWithBTCAccumulator(prices, testName) {
    console.log(`[ACCUMULATOR] ${testName} - Testando acumulador...`);
    
    const acc = new BTCAccumulator({
        minBTCTarget: 0.0005,
        maxBRLHolding: 50,
        sellResistance: 0.9,
        dcaDropThreshold: 0.005,
        minHoldHours: 4
    });

    let brl = 100;
    let btc = 0.00025;
    const initialValue = brl + btc * prices[0];
    let totalBtcBought = 0;

    for (let i = 0; i < prices.length; i++) {
        const action = acc.evaluate(prices.slice(0, i + 1));
        const price = prices[i];

        if (action === 'BUY' && brl > 10) {
            const qty = Math.min(0.00008, brl / price * 0.5);
            if (qty > 0) {
                brl -= qty * price;
                btc += qty;
                totalBtcBought += qty;
            }
        }
        if (action === 'SELL' && btc > 0) {
            brl += btc * price;
            btc = 0;
        }
    }

    const finalValue = brl + btc * prices[prices.length - 1];
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

    return {
        testName,
        passed: roi > priceChange,
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        pnlBRL: pnl.toFixed(2),
        totalBtcBought: totalBtcBought.toFixed(8),
        gainVsHold: (roi - priceChange).toFixed(2)
    };
}

/**
 * Executar testes baseado em USE_SWING_TRADING
 */
function runTests() {
    const useSwingTrading = process.env.USE_SWING_TRADING === 'true';
    
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTE COM SWING TRADING STRATEGY');
    console.log('='.repeat(80));
    console.log(`Modo: ${useSwingTrading ? '✅ SWING TRADING' : '❌ ACCUMULATOR'}\n`);

    if (!candlesData || candlesData.length === 0) {
        console.error('❌ Erro: Nenhum dado de candles disponível');
        process.exit(1);
    }

    const prices = candlesData.map(c => c.close);
    const results = [];

    if (useSwingTrading) {
        // Testes com swing trading
        results.push(testWithSwingTrading(prices, 'Sistema Integrado SWING TRADING'));
        results.push(testWithSwingTrading(prices.slice(0, 144), 'SWING TRADING - Primeira Metade'));
        results.push(testWithSwingTrading(prices.slice(144), 'SWING TRADING - Segunda Metade'));
    } else {
        // Testes com accumulator padrão
        results.push(testWithBTCAccumulator(prices, 'BTCAccumulator - Período Completo'));
        results.push(testWithBTCAccumulator(prices.slice(0, 144), 'BTCAccumulator - Primeira Metade'));
        results.push(testWithBTCAccumulator(prices.slice(144), 'BTCAccumulator - Segunda Metade'));
    }

    // Exibir resultados
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTADOS');
    console.log('='.repeat(80) + '\n');

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach((result, idx) => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.testName}`);
        console.log(`   ROI: ${result.roi}% | vs HOLD: ${result.gainVsHold}% | PnL: ${result.pnlBRL} BRL`);
        if (result.trades !== undefined) {
            console.log(`   Trades: ${result.trades} (Lucro: ${result.profits}, Perda: ${result.losses})`);
        }
        console.log('');
    });

    console.log(`\n📈 Taxa de Sucesso: ${((passed / total) * 100).toFixed(1)}% (${passed}/${total} testes passaram)\n`);

    return results;
}

// Executar
runTests();
