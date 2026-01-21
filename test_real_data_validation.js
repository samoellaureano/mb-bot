#!/usr/bin/env node
/**
 * test_real_data_validation.js
 * 
 * Bateria de testes com dados históricos REAIS do mercado
 * Valida os sistemas de:
 *   - BTCAccumulator (acumulação de BTC)
 *   - MomentumOrderValidator (validação de ordens por momentum)
 * 
 * Usa APIs públicas para obter dados reais de preço
 */

const axios = require('axios');
const BTCAccumulator = require('./btc_accumulator');
const MomentumOrderValidator = require('./momentum_order_validator');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
    // Parâmetros de simulação
    initialBRL: 100,
    initialBTC: 0.0001,
    orderSize: 0.00005,
    
    // APIs de dados
    apis: {
        mercadoBitcoin: 'https://www.mercadobitcoin.net/api/BTC/trades/',
        binance: 'https://api.binance.com/api/v3/klines',
        coingecko: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart'
    }
};

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES DE COLETA DE DADOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Busca dados históricos do Mercado Bitcoin (últimas trades)
 */
async function fetchMercadoBitcoinData() {
    try {
        console.log('📡 Buscando dados do Mercado Bitcoin...');
        const response = await axios.get(CONFIG.apis.mercadoBitcoin, { timeout: 10000 });
        
        if (!response.data || response.data.length === 0) {
            throw new Error('Sem dados retornados');
        }
        
        // Agrupa por minuto para ter candles
        const trades = response.data;
        const prices = trades.map(t => ({
            price: parseFloat(t.price),
            timestamp: t.date * 1000,
            amount: parseFloat(t.amount),
            type: t.type
        }));
        
        console.log(`   ✅ ${prices.length} trades obtidas`);
        return prices;
    } catch (e) {
        console.log(`   ❌ Erro: ${e.message}`);
        return null;
    }
}

/**
 * Busca candles da Binance (BTC/USDT)
 */
async function fetchBinanceData(interval = '1m', limit = 100) {
    try {
        console.log(`📡 Buscando candles da Binance (${interval}, ${limit} períodos)...`);
        const response = await axios.get(CONFIG.apis.binance, {
            params: {
                symbol: 'BTCUSDT',
                interval: interval,
                limit: limit
            },
            timeout: 10000
        });
        
        if (!response.data || response.data.length === 0) {
            throw new Error('Sem dados retornados');
        }
        
        // Converte candles para preços (usa close price)
        // Multiplica por taxa aproximada USD/BRL
        const usdToBrl = 5.0; // Taxa aproximada
        const candles = response.data.map(c => ({
            timestamp: c[0],
            open: parseFloat(c[1]) * usdToBrl,
            high: parseFloat(c[2]) * usdToBrl,
            low: parseFloat(c[3]) * usdToBrl,
            close: parseFloat(c[4]) * usdToBrl,
            volume: parseFloat(c[5])
        }));
        
        console.log(`   ✅ ${candles.length} candles obtidos`);
        return candles;
    } catch (e) {
        console.log(`   ❌ Erro: ${e.message}`);
        return null;
    }
}

/**
 * Busca dados do CoinGecko (últimas 24h)
 */
async function fetchCoinGeckoData() {
    try {
        console.log('📡 Buscando dados do CoinGecko (24h)...');
        const response = await axios.get(CONFIG.apis.coingecko, {
            params: {
                vs_currency: 'brl',
                days: 1
            },
            timeout: 10000
        });
        
        if (!response.data || !response.data.prices) {
            throw new Error('Sem dados retornados');
        }
        
        const prices = response.data.prices.map(p => ({
            timestamp: p[0],
            price: p[1]
        }));
        
        console.log(`   ✅ ${prices.length} pontos de preço obtidos`);
        return prices;
    } catch (e) {
        console.log(`   ❌ Erro: ${e.message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// TESTES DO BTC ACCUMULATOR
// ═══════════════════════════════════════════════════════════════════

async function testBTCAccumulatorWithRealData(priceData) {
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 TESTE: BTC ACCUMULATOR COM DADOS REAIS');
    console.log('═'.repeat(70));
    
    const accumulator = new BTCAccumulator({
        minBTCTarget: 0.0005,
        maxBRLHolding: 50,
        dcaDropThreshold: 0.003, // 0.3% para dados de alta frequência
        sellResistance: 0.7,
        minProfitToSell: 0.005,
        enabled: true
    });
    
    // Estado da simulação
    let brlBalance = CONFIG.initialBRL;
    let btcPosition = CONFIG.initialBTC;
    let totalBuys = 0;
    let totalSells = 0;
    let dcaTriggers = 0;
    let sellsBlocked = 0;
    let ordersPlaced = 0;
    
    // Extrair preços
    const prices = priceData.map(d => d.close || d.price);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    
    console.log(`\n📊 Dados: ${prices.length} preços | Início: R$${startPrice.toFixed(2)} | Fim: R$${endPrice.toFixed(2)}`);
    console.log(`📈 Variação: ${((endPrice - startPrice) / startPrice * 100).toFixed(2)}%`);
    console.log(`💰 Saldo inicial: ${brlBalance.toFixed(2)} BRL | ${btcPosition.toFixed(8)} BTC`);
    
    // Simular ciclos
    console.log('\n🔄 Simulando ciclos de trading...\n');
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        accumulator.recordPrice(price);
        
        // Verificar DCA
        const dcaCheck = accumulator.shouldDCA(price, brlBalance);
        if (dcaCheck.should) {
            dcaTriggers++;
            const buyQty = Math.min(CONFIG.orderSize * 1.5, brlBalance / price);
            if (buyQty > 0.000001 && brlBalance >= buyQty * price) {
                accumulator.recordBuy(price, buyQty);
                brlBalance -= buyQty * price;
                btcPosition += buyQty;
                totalBuys++;
                ordersPlaced++;
                if (i % 20 === 0 || dcaTriggers <= 3) {
                    console.log(`   🎯 DCA #${dcaTriggers}: Comprou ${buyQty.toFixed(8)} BTC @ R$${price.toFixed(2)} | ${dcaCheck.reason}`);
                }
            }
        }
        
        // Verificar recomendação
        const recommendation = accumulator.getRecommendation(price, btcPosition, brlBalance);
        
        // Simular colocação de ordens baseado na recomendação
        if (recommendation.action.includes('BUY') && brlBalance > 10) {
            const buyAdj = accumulator.getQuantityAdjustment('buy', CONFIG.orderSize, price, btcPosition, brlBalance);
            const buyQty = Math.min(buyAdj.qty, brlBalance / price);
            
            if (buyQty > 0.000001 && brlBalance >= buyQty * price) {
                // Simular ordem de compra
                if (Math.random() < 0.3) { // 30% das ordens são executadas
                    accumulator.recordBuy(price, buyQty);
                    brlBalance -= buyQty * price;
                    btcPosition += buyQty;
                    totalBuys++;
                    ordersPlaced++;
                }
            }
        }
        
        // Simular tentativa de SELL
        if (btcPosition > 0.00001 && Math.random() < 0.2) {
            const sellQty = Math.min(CONFIG.orderSize, btcPosition);
            const sellBlock = accumulator.shouldBlockSell(price, btcPosition, price * 1.005, sellQty);
            
            if (sellBlock.block) {
                sellsBlocked++;
            } else if (Math.random() < 0.3) {
                // Venda executada
                brlBalance += sellQty * price;
                btcPosition -= sellQty;
                totalSells++;
                ordersPlaced++;
            }
        }
    }
    
    // Calcular resultado final
    const finalValueBRL = brlBalance + (btcPosition * endPrice);
    const initialValueBRL = CONFIG.initialBRL + (CONFIG.initialBTC * startPrice);
    const pnl = finalValueBRL - initialValueBRL;
    const roi = (pnl / initialValueBRL) * 100;
    
    // Resultado do Buy & Hold
    const buyHoldBTC = CONFIG.initialBRL / startPrice + CONFIG.initialBTC;
    const buyHoldValue = buyHoldBTC * endPrice;
    const buyHoldPnL = buyHoldValue - initialValueBRL;
    const buyHoldROI = (buyHoldPnL / initialValueBRL) * 100;
    
    console.log('\n' + '─'.repeat(50));
    console.log('📊 RESULTADOS DO TESTE');
    console.log('─'.repeat(50));
    console.log(`\n💰 Saldo final: ${brlBalance.toFixed(2)} BRL | ${btcPosition.toFixed(8)} BTC`);
    console.log(`📈 Valor total em BRL: R$${finalValueBRL.toFixed(2)}`);
    console.log(`\n📊 Performance:`);
    console.log(`   PnL: R$${pnl.toFixed(2)} (${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%)`);
    console.log(`   Buy & Hold PnL: R$${buyHoldPnL.toFixed(2)} (${buyHoldROI >= 0 ? '+' : ''}${buyHoldROI.toFixed(2)}%)`);
    console.log(`   Alpha vs B&H: ${(roi - buyHoldROI).toFixed(2)}%`);
    console.log(`\n📋 Estatísticas:`);
    console.log(`   Ordens colocadas: ${ordersPlaced}`);
    console.log(`   Compras: ${totalBuys} | Vendas: ${totalSells}`);
    console.log(`   DCA triggers: ${dcaTriggers}`);
    console.log(`   Vendas bloqueadas: ${sellsBlocked}`);
    console.log(`   Preço médio compra: R$${accumulator.state.avgBuyPrice.toFixed(2)}`);
    console.log(`   Score final: ${accumulator.state.accumulationScore.toFixed(0)}`);
    
    return {
        passed: btcPosition >= CONFIG.initialBTC, // Deve ter acumulado BTC
        pnl,
        roi,
        btcAccumulated: btcPosition - CONFIG.initialBTC,
        sellsBlocked,
        dcaTriggers
    };
}

// ═══════════════════════════════════════════════════════════════════
// TESTES DO MOMENTUM VALIDATOR
// ═══════════════════════════════════════════════════════════════════

async function testMomentumValidatorWithRealData(priceData) {
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 TESTE: MOMENTUM VALIDATOR COM DADOS REAIS');
    console.log('═'.repeat(70));
    
    const validator = new MomentumOrderValidator({
        reversalThreshold: 0.001, // 0.1%
        minReversalsToConfirm: 2,
        maxOrderAge: 300 // 5 minutos
    });
    
    // Extrair preços
    const prices = priceData.map(d => d.close || d.price);
    
    console.log(`\n📊 Dados: ${prices.length} preços`);
    
    // Estatísticas
    let buyOrdersCreated = 0;
    let sellOrdersCreated = 0;
    let buyConfirmed = 0;
    let sellConfirmed = 0;
    let buyRejected = 0;
    let sellRejected = 0;
    let profitableBuys = 0;
    let profitableSells = 0;
    
    // Simular ordens a cada 10 ciclos
    const orderInterval = 10;
    const activeOrders = new Map();
    
    console.log('\n🔄 Simulando validação de ordens...\n');
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        validator.recordPrice(price);
        
        // Criar novas ordens periodicamente
        if (i % orderInterval === 0 && i < prices.length - 20) {
            const buyId = `buy_${i}`;
            const sellId = `sell_${i}`;
            
            validator.createSimulatedOrder(buyId, 'buy', price, CONFIG.orderSize);
            validator.createSimulatedOrder(sellId, 'sell', price, CONFIG.orderSize);
            
            activeOrders.set(buyId, { side: 'buy', entryPrice: price, createdAt: i });
            activeOrders.set(sellId, { side: 'sell', entryPrice: price, createdAt: i });
            
            buyOrdersCreated++;
            sellOrdersCreated++;
        }
        
        // Atualizar todas as ordens ativas
        for (const [orderId, orderInfo] of activeOrders) {
            const order = validator.simulatedOrders.get(orderId);
            if (!order || order.status === 'confirmed' || order.status === 'rejected') continue;
            
            const update = validator.updateOrderWithPrice(orderId, price);
            
            if (update.status === 'confirmed') {
                if (orderInfo.side === 'buy') {
                    buyConfirmed++;
                    // Verificar se foi lucrativo (preço subiu depois)
                    const futurePrice = prices[Math.min(i + 10, prices.length - 1)];
                    if (futurePrice > orderInfo.entryPrice) profitableBuys++;
                } else {
                    sellConfirmed++;
                    // Verificar se foi lucrativo (preço caiu depois)
                    const futurePrice = prices[Math.min(i + 10, prices.length - 1)];
                    if (futurePrice < orderInfo.entryPrice) profitableSells++;
                }
                validator.confirmOrder(orderId);
            } else if (update.status === 'rejected') {
                if (orderInfo.side === 'buy') buyRejected++;
                else sellRejected++;
                validator.rejectOrder(orderId, update.reason);
            }
        }
        
        // Limpar ordens processadas
        validator.cleanupExpiredOrders(60);
    }
    
    console.log('─'.repeat(50));
    console.log('📊 RESULTADOS DO TESTE');
    console.log('─'.repeat(50));
    console.log(`\n📋 Ordens Criadas:`);
    console.log(`   BUY: ${buyOrdersCreated} | SELL: ${sellOrdersCreated}`);
    console.log(`\n✅ Confirmadas:`);
    console.log(`   BUY: ${buyConfirmed} (${(buyConfirmed/buyOrdersCreated*100).toFixed(1)}%)`);
    console.log(`   SELL: ${sellConfirmed} (${(sellConfirmed/sellOrdersCreated*100).toFixed(1)}%)`);
    console.log(`\n❌ Rejeitadas:`);
    console.log(`   BUY: ${buyRejected} (${(buyRejected/buyOrdersCreated*100).toFixed(1)}%)`);
    console.log(`   SELL: ${sellRejected} (${(sellRejected/sellOrdersCreated*100).toFixed(1)}%)`);
    console.log(`\n💰 Precisão (ordens confirmadas que foram lucrativas):`);
    console.log(`   BUY: ${profitableBuys}/${buyConfirmed} (${buyConfirmed > 0 ? (profitableBuys/buyConfirmed*100).toFixed(1) : 0}%)`);
    console.log(`   SELL: ${profitableSells}/${sellConfirmed} (${sellConfirmed > 0 ? (profitableSells/sellConfirmed*100).toFixed(1) : 0}%)`);
    
    const totalAccuracy = buyConfirmed + sellConfirmed > 0 
        ? ((profitableBuys + profitableSells) / (buyConfirmed + sellConfirmed) * 100).toFixed(1)
        : 0;
    console.log(`   TOTAL: ${totalAccuracy}%`);
    
    return {
        passed: parseFloat(totalAccuracy) >= 50, // Deve ter pelo menos 50% de precisão
        buyConfirmRate: buyConfirmed / buyOrdersCreated,
        sellConfirmRate: sellConfirmed / sellOrdersCreated,
        accuracy: parseFloat(totalAccuracy)
    };
}

// ═══════════════════════════════════════════════════════════════════
// TESTE INTEGRADO: ACCUMULATOR + MOMENTUM
// ═══════════════════════════════════════════════════════════════════

async function testIntegratedSystemWithRealData(priceData) {
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 TESTE INTEGRADO: ACCUMULATOR + MOMENTUM');
    console.log('═'.repeat(70));
    
    const accumulator = new BTCAccumulator({
        minBTCTarget: 0.0005,
        maxBRLHolding: 50,
        dcaDropThreshold: 0.003,
        sellResistance: 0.7,
        enabled: true
    });
    
    const momentum = new MomentumOrderValidator({
        reversalThreshold: 0.001,
        minReversalsToConfirm: 2
    });
    
    let brlBalance = CONFIG.initialBRL;
    let btcPosition = CONFIG.initialBTC;
    let successfulTrades = 0;
    let failedTrades = 0;
    let momentumConfirmed = 0;
    let momentumRejected = 0;
    
    const prices = priceData.map(d => d.close || d.price);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    
    console.log(`\n📊 Simulando sistema integrado com ${prices.length} preços...`);
    
    const pendingOrders = new Map();
    
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        
        // Atualizar sistemas
        accumulator.recordPrice(price);
        momentum.recordPrice(price);
        
        // Obter recomendação do accumulator
        const recommendation = accumulator.getRecommendation(price, btcPosition, brlBalance);
        
        // A cada 15 ciclos, considerar nova ordem
        if (i % 15 === 0 && i < prices.length - 30) {
            if (recommendation.action.includes('BUY') && brlBalance > 20) {
                const orderId = `int_buy_${i}`;
                const buyQty = Math.min(CONFIG.orderSize, brlBalance / price * 0.3);
                
                momentum.createSimulatedOrder(orderId, 'buy', price, buyQty);
                pendingOrders.set(orderId, { 
                    side: 'buy', 
                    price, 
                    qty: buyQty, 
                    createdAt: i 
                });
            }
            
            // Verificar se pode vender
            if (btcPosition > 0.0001 && !recommendation.action.includes('BUY')) {
                const sellQty = Math.min(CONFIG.orderSize * 0.5, btcPosition * 0.2);
                const sellBlock = accumulator.shouldBlockSell(price, btcPosition, price, sellQty);
                
                if (!sellBlock.block) {
                    const orderId = `int_sell_${i}`;
                    momentum.createSimulatedOrder(orderId, 'sell', price, sellQty);
                    pendingOrders.set(orderId, { 
                        side: 'sell', 
                        price, 
                        qty: sellQty, 
                        createdAt: i 
                    });
                }
            }
        }
        
        // Processar ordens pendentes
        for (const [orderId, orderInfo] of pendingOrders) {
            const order = momentum.simulatedOrders.get(orderId);
            if (!order || (order.status !== 'simulated' && order.status !== 'pending')) continue;
            
            const update = momentum.updateOrderWithPrice(orderId, price);
            
            if (update.status === 'confirmed') {
                momentumConfirmed++;
                
                // Executar ordem
                if (orderInfo.side === 'buy') {
                    const cost = orderInfo.price * orderInfo.qty;
                    if (brlBalance >= cost) {
                        brlBalance -= cost;
                        btcPosition += orderInfo.qty;
                        accumulator.recordBuy(orderInfo.price, orderInfo.qty);
                        
                        // Verificar se foi lucrativa
                        const futurePrice = prices[Math.min(i + 15, prices.length - 1)];
                        if (futurePrice > orderInfo.price) successfulTrades++;
                        else failedTrades++;
                    }
                } else {
                    if (btcPosition >= orderInfo.qty) {
                        brlBalance += price * orderInfo.qty;
                        btcPosition -= orderInfo.qty;
                        
                        // Verificar se foi lucrativa
                        const futurePrice = prices[Math.min(i + 15, prices.length - 1)];
                        if (futurePrice < orderInfo.price) successfulTrades++;
                        else failedTrades++;
                    }
                }
                
                momentum.confirmOrder(orderId);
                pendingOrders.delete(orderId);
            } else if (update.status === 'rejected') {
                momentumRejected++;
                momentum.rejectOrder(orderId, update.reason);
                pendingOrders.delete(orderId);
            }
        }
        
        // Limpar ordens antigas
        momentum.cleanupExpiredOrders(120);
    }
    
    const finalValue = brlBalance + (btcPosition * endPrice);
    const initialValue = CONFIG.initialBRL + (CONFIG.initialBTC * startPrice);
    const pnl = finalValue - initialValue;
    const roi = (pnl / initialValue) * 100;
    
    console.log('\n' + '─'.repeat(50));
    console.log('📊 RESULTADOS DO TESTE INTEGRADO');
    console.log('─'.repeat(50));
    console.log(`\n💰 Balanço:`);
    console.log(`   BRL: ${brlBalance.toFixed(2)} | BTC: ${btcPosition.toFixed(8)}`);
    console.log(`   Valor total: R$${finalValue.toFixed(2)}`);
    console.log(`   PnL: R$${pnl.toFixed(2)} (${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%)`);
    console.log(`\n📋 Momentum Validation:`);
    console.log(`   Confirmadas: ${momentumConfirmed} | Rejeitadas: ${momentumRejected}`);
    console.log(`   Taxa de confirmação: ${((momentumConfirmed / (momentumConfirmed + momentumRejected)) * 100).toFixed(1)}%`);
    console.log(`\n🎯 Trades:`);
    console.log(`   Lucrativos: ${successfulTrades} | Prejuízo: ${failedTrades}`);
    const winRate = successfulTrades + failedTrades > 0 
        ? (successfulTrades / (successfulTrades + failedTrades) * 100).toFixed(1) 
        : 0;
    console.log(`   Win Rate: ${winRate}%`);
    console.log(`\n📈 Acumulação:`);
    console.log(`   BTC acumulado: ${(btcPosition - CONFIG.initialBTC).toFixed(8)}`);
    console.log(`   Preço médio: R$${accumulator.state.avgBuyPrice.toFixed(2)}`);
    
    return {
        passed: btcPosition >= CONFIG.initialBTC && pnl > -initialValue * 0.1, // Não perdeu mais que 10%
        pnl,
        roi,
        winRate: parseFloat(winRate),
        btcAccumulated: btcPosition - CONFIG.initialBTC
    };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
    console.log('\n' + '▓'.repeat(70));
    console.log('▓  BATERIA DE TESTES COM DADOS REAIS - MB BOT');
    console.log('▓  ' + new Date().toLocaleString('pt-BR'));
    console.log('▓'.repeat(70));
    
    // Coletar dados de múltiplas fontes
    console.log('\n📡 COLETANDO DADOS DE MERCADO...\n');
    
    const mbData = await fetchMercadoBitcoinData();
    const binanceData = await fetchBinanceData('1m', 200);
    const geckoData = await fetchCoinGeckoData();
    
    // Usar dados disponíveis
    let testData = null;
    let dataSource = '';
    
    if (binanceData && binanceData.length > 50) {
        testData = binanceData;
        dataSource = 'Binance (1min candles)';
    } else if (geckoData && geckoData.length > 50) {
        testData = geckoData;
        dataSource = 'CoinGecko (24h)';
    } else if (mbData && mbData.length > 50) {
        testData = mbData;
        dataSource = 'Mercado Bitcoin (trades)';
    }
    
    if (!testData) {
        console.log('\n❌ Não foi possível obter dados de nenhuma fonte. Usando dados simulados...');
        
        // Gerar dados simulados baseados em padrões reais
        testData = generateSimulatedData(200, 480000);
        dataSource = 'Dados Simulados (padrão realista)';
    }
    
    console.log(`\n✅ Usando dados de: ${dataSource}`);
    console.log(`   Total de pontos: ${testData.length}`);
    
    // Executar testes
    const results = {
        accumulator: null,
        momentum: null,
        integrated: null
    };
    
    try {
        results.accumulator = await testBTCAccumulatorWithRealData(testData);
    } catch (e) {
        console.log(`\n❌ Erro no teste do Accumulator: ${e.message}`);
        results.accumulator = { passed: false, error: e.message };
    }
    
    try {
        results.momentum = await testMomentumValidatorWithRealData(testData);
    } catch (e) {
        console.log(`\n❌ Erro no teste do Momentum: ${e.message}`);
        results.momentum = { passed: false, error: e.message };
    }
    
    try {
        results.integrated = await testIntegratedSystemWithRealData(testData);
    } catch (e) {
        console.log(`\n❌ Erro no teste Integrado: ${e.message}`);
        results.integrated = { passed: false, error: e.message };
    }
    
    // Resumo final
    console.log('\n' + '▓'.repeat(70));
    console.log('▓  RESUMO FINAL DOS TESTES');
    console.log('▓'.repeat(70));
    
    const tests = [
        { name: 'BTC Accumulator', result: results.accumulator },
        { name: 'Momentum Validator', result: results.momentum },
        { name: 'Sistema Integrado', result: results.integrated }
    ];
    
    let passedCount = 0;
    
    console.log('\n');
    tests.forEach(t => {
        const status = t.result && t.result.passed ? '✅ PASSOU' : '❌ FALHOU';
        if (t.result && t.result.passed) passedCount++;
        
        console.log(`${status} | ${t.name}`);
        if (t.result) {
            if (t.result.roi !== undefined) console.log(`         ROI: ${t.result.roi >= 0 ? '+' : ''}${t.result.roi.toFixed(2)}%`);
            if (t.result.accuracy !== undefined) console.log(`         Precisão: ${t.result.accuracy}%`);
            if (t.result.winRate !== undefined) console.log(`         Win Rate: ${t.result.winRate}%`);
            if (t.result.btcAccumulated !== undefined) console.log(`         BTC acumulado: ${t.result.btcAccumulated.toFixed(8)}`);
        }
    });
    
    console.log('\n' + '─'.repeat(50));
    console.log(`🎯 RESULTADO GERAL: ${passedCount}/${tests.length} testes passaram`);
    console.log('─'.repeat(50));
    
    if (passedCount === tests.length) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema validado com dados reais.\n');
    } else {
        console.log('\n⚠️ Alguns testes falharam. Revisar configurações.\n');
    }
}

/**
 * Gera dados simulados com padrões realistas de mercado
 */
function generateSimulatedData(count, basePrice) {
    const data = [];
    let price = basePrice;
    let trend = 0;
    
    for (let i = 0; i < count; i++) {
        // Adicionar tendência com reversões
        if (Math.random() < 0.05) {
            trend = (Math.random() - 0.5) * 0.002; // Muda tendência ocasionalmente
        }
        
        // Movimento de preço com volatilidade realista
        const volatility = 0.001 + Math.random() * 0.002; // 0.1% a 0.3%
        const change = (Math.random() - 0.5) * volatility * price + trend * price;
        price += change;
        
        // Garantir preço positivo
        price = Math.max(price * 0.9, price);
        
        data.push({
            timestamp: Date.now() - (count - i) * 60000,
            open: price - Math.random() * 100,
            high: price + Math.random() * 200,
            low: price - Math.random() * 200,
            close: price,
            volume: Math.random() * 10
        });
    }
    
    return data;
}

// Executar
main().catch(console.error);
