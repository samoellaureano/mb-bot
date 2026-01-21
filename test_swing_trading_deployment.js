#!/usr/bin/env node
/**
 * test_swing_trading_deployment.js
 * 
 * Valida a estratégia swing trading deployada ao bot.js
 * Compara performance com o teste original
 */

const SwingTradingStrategy = require('./swing_trading_strategy');
const axios = require('axios');
const fs = require('fs');

// ========== IMPORTAR DADOS DE TESTE ==========
let candlesData = [];
try {
    if (fs.existsSync('./candles.json')) {
        candlesData = JSON.parse(fs.readFileSync('./candles.json', 'utf8'));
        console.log(`✓ Dados de candles carregados: ${candlesData.length} candles`);
    }
} catch (e) {
    console.warn(`⚠ Erro ao carregar candles.json: ${e.message}`);
}

// ========== TESTE DE ESTRATÉGIA ==========
function testSwingTradingStrategy(candlesData) {
    console.log('\n' + '='.repeat(80));
    console.log('TESTE: Validação da Estratégia Swing Trading Deployada');
    console.log('='.repeat(80) + '\n');

    if (!candlesData || candlesData.length === 0) {
        console.error('❌ Dados de candles não disponíveis para teste.');
        return null;
    }

    // Extrair preços dos candles
    const prices = candlesData.map(c => parseFloat(c.close)).slice(0, 288); // 288 candles = 24h (5min)

    if (prices.length === 0) {
        console.error('❌ Nenhum preço extraído dos candles.');
        return null;
    }

    console.log(`📊 Dados de Teste:`);
    console.log(`   - Total de candles: ${prices.length}`);
    console.log(`   - Preço inicial: ${prices[0].toFixed(2)} BRL`);
    console.log(`   - Preço final: ${prices[prices.length - 1].toFixed(2)} BRL`);
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    console.log(`   - Variação de preço: ${priceChange.toFixed(2)}%\n`);

    // Inicializar estratégia
    const strategy = new SwingTradingStrategy({
        dropThreshold: 0.003,    // 0.3%
        profitTarget: 0.004,     // 0.4%
        stopLoss: -0.008         // -0.8%
    });

    let brl = 200;
    let btc = 0.0002;
    const initialValue = brl + btc * prices[0];
    let trades = [];
    let currentTrade = null;

    // Simular
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];

        // Atualizar histórico de preços (apenas após warmup)
        if (i >= 20) {
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
                    currentTrade = {
                        entryPrice: price,
                        entryIndex: i,
                        qty: qty,
                        type: 'long'
                    };
                }
            }

            // Venda
            if (sellSignal.signal && strategy.inPosition && currentTrade) {
                strategy.sell(price, sellSignal.type);
                brl += currentTrade.qty * price;
                btc -= currentTrade.qty;
                
                trades.push({
                    ...currentTrade,
                    exitPrice: price,
                    exitIndex: i,
                    exitType: sellSignal.type,
                    pnl: currentTrade.qty * (price - currentTrade.entryPrice),
                    pnlPct: ((price - currentTrade.entryPrice) / currentTrade.entryPrice * 100).toFixed(2)
                });
                currentTrade = null;
            }
        }
    }

    // Fechar posição aberta
    if (strategy.inPosition && currentTrade) {
        strategy.sell(prices[prices.length - 1], 'final_close');
        brl += currentTrade.qty * prices[prices.length - 1];
        btc -= currentTrade.qty;
        trades.push({
            ...currentTrade,
            exitPrice: prices[prices.length - 1],
            exitIndex: prices.length - 1,
            exitType: 'final_close',
            pnl: currentTrade.qty * (prices[prices.length - 1] - currentTrade.entryPrice),
            pnlPct: ((prices[prices.length - 1] - currentTrade.entryPrice) / currentTrade.entryPrice * 100).toFixed(2)
        });
    }

    const finalValue = brl + btc * prices[prices.length - 1];
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    const winRate = trades.length > 0 ? (trades.filter(t => t.pnl > 0).length / trades.length * 100) : 0;

    // ===== RELATÓRIO =====
    console.log('📈 Resultados da Estratégia:');
    console.log(`   - Capital inicial: ${initialValue.toFixed(2)} BRL`);
    console.log(`   - Capital final: ${finalValue.toFixed(2)} BRL`);
    console.log(`   - PnL: ${pnl.toFixed(2)} BRL`);
    console.log(`   - ROI: ${roi.toFixed(2)}%`);
    console.log(`   - Ganho vs HOLD: ${(roi - priceChange).toFixed(2)}%`);
    console.log(`   - Trades executados: ${trades.length}`);
    console.log(`   - Trades lucrativos: ${trades.filter(t => t.pnl > 0).length}`);
    console.log(`   - Win Rate: ${winRate.toFixed(1)}%\n`);

    // ===== DETALHES DAS TRADES =====
    if (trades.length > 0) {
        console.log('🔍 Detalhes das Trades:');
        console.log('   ID | Entrada | Saída | Qtd BTC | PnL BRL | PnL %');
        console.log('   ' + '-'.repeat(65));
        trades.forEach((t, idx) => {
            const entryStr = t.entryPrice.toFixed(0);
            const exitStr = t.exitPrice.toFixed(0);
            const qtStr = t.qty.toFixed(6);
            const pnlStr = t.pnl.toFixed(2);
            const pnlPctStr = t.pnlPct;
            const marker = t.pnl > 0 ? '✓' : '✗';
            console.log(`   ${idx + 1}  | ${entryStr} | ${exitStr} | ${qtStr} | ${pnlStr} | ${pnlPctStr}% ${marker}`);
        });
        console.log('');
    }

    // ===== STATUS =====
    const passed = roi > priceChange;
    const status = passed ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`\n${status}: Estratégia ${passed ? 'superou' : 'não superou'} o HOLD (${(roi - priceChange).toFixed(2)}% diferença)`);

    return {
        testName: 'Swing Trading Strategy Deployment',
        passed,
        roi: roi.toFixed(2),
        priceChange: priceChange.toFixed(2),
        trades: trades.length,
        winningTrades: trades.filter(t => t.pnl > 0).length,
        winRate: winRate.toFixed(1),
        pnlBRL: pnl.toFixed(2),
        gainVsHold: (roi - priceChange).toFixed(2)
    };
}

// ========== EXECUTAR TESTES ==========
async function runTests() {
    console.log(chalk.blue.bold('\n🤖 VALIDAÇÃO DE DEPLOYMENT - ESTRATÉGIA SWING TRADING\n'));
    
    const result = testSwingTradingStrategy(candlesData);

    if (result) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 SUMÁRIO FINAL');
        console.log('='.repeat(80));
        console.log(JSON.stringify(result, null, 2));
    }

    console.log('\n✨ Teste concluído!\n');
}

// Simples chalk inline
const chalk = {
    blue: { bold: (text) => text },
    green: { bold: (text) => text },
    red: { bold: (text) => text }
};

runTests().catch(err => {
    console.error('[ERROR] Erro ao executar testes:', err.message);
    process.exit(1);
});
