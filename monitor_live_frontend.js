const http = require('http');

async function fetchJSON(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: 'localhost',
            port: 3001,
            path: path,
            timeout: 5000
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', reject);
    });
}

async function liveMonitor() {
    console.clear();
    
    let cycle = 0;
    setInterval(async () => {
        cycle++;
        
        try {
            const [dataRes, momentumRes] = await Promise.all([
                fetchJSON('/api/data'),
                fetchJSON('/api/momentum')
            ]);

            console.clear();
            
            // Header
            console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║               🤖 MB BOT - LIVE TRADING MODE - FRONTEND MONITOR                  ║
║                         Ciclo: ${cycle.toString().padStart(3, ' ')} | Atualizado: ${new Date().toLocaleTimeString('pt-BR')}                        ║
╚════════════════════════════════════════════════════════════════════════════════╝
`);

            // Dados do Bot
            if (dataRes) {
                console.log('📊 DADOS DO BOT (API /api/data)\n');
                console.log(`Mode:              ${dataRes.mode === 'LIVE' ? '🔴 LIVE' : '🔵 SIMULATE'}`);
                console.log(`Timestamp:         ${dataRes.timestamp}`);
                console.log(`\n💰 FINANCEIRO:`);
                console.log(`   PnL Total:      ${dataRes.stats?.pnl_total?.toFixed(2) || 'N/A'} BRL`);
                console.log(`   PnL Realizado:  ${dataRes.stats?.pnl_realized?.toFixed(2) || 'N/A'} BRL`);
                console.log(`   PnL Não Real:   ${dataRes.stats?.pnl_unrealized?.toFixed(2) || 'N/A'} BRL`);
                console.log(`   ROI:            ${((dataRes.stats?.pnl_total || 0) / (dataRes.stats?.capital_base || 1) * 100).toFixed(2)}%`);
                
                console.log(`\n📈 MERCADO:`);
                console.log(`   Preço Atual:    R$ ${dataRes.market?.mid_price?.toFixed(2) || 'N/A'}`);
                console.log(`   Melhor Compra:  R$ ${dataRes.market?.bid?.toFixed(2) || 'N/A'}`);
                console.log(`   Melhor Venda:   R$ ${dataRes.market?.ask?.toFixed(2) || 'N/A'}`);
                console.log(`   Spread:         ${((dataRes.market?.ask || 0) - (dataRes.market?.bid || 0)).toFixed(2)} BRL`);
                
                console.log(`\n🎯 POSIÇÃO:`);
                console.log(`   BTC:            ${(dataRes.balances?.btc || 0).toFixed(8)}`);
                console.log(`   BRL:            R$ ${(dataRes.balances?.brl || 0).toFixed(2)}`);
                console.log(`   Ordens Ativas:  ${dataRes.activeOrders?.length || 0}`);
                
                console.log(`\n📊 INDICADORES:`);
                console.log(`   RSI:            ${dataRes.debug?.rsi?.toFixed(2) || 'N/A'}`);
                console.log(`   Volatilidade:   ${dataRes.debug?.volatility?.toFixed(2) || 'N/A'}%`);
                console.log(`   Tendência:      ${dataRes.debug?.trend || 'N/A'}`);
                console.log(`   Confiança:      ${dataRes.debug?.confidence || 'N/A'}`);
                
                if (dataRes.externalTrend) {
                    console.log(`\n🌐 TENDÊNCIA EXTERNA:`);
                    console.log(`   Trend:          ${dataRes.externalTrend.trend}`);
                    console.log(`   Score:          ${dataRes.externalTrend.score}/100`);
                    console.log(`   Confiança:      ${dataRes.externalTrend.confidence}%`);
                }
            }

            // Ordens Momentum
            if (momentumRes) {
                console.log(`\n\n🎯 ORDENS EM VALIDAÇÃO (MOMENTUM)\n`);
                console.log(`Status Summary:`);
                console.log(`   🟣 Simulated:  ${momentumRes.status?.simulated || 0}`);
                console.log(`   🟡 Pending:    ${momentumRes.status?.pending || 0}`);
                console.log(`   ✅ Confirmed:  ${momentumRes.status?.confirmed || 0}`);
                console.log(`   ❌ Rejected:   ${momentumRes.status?.rejected || 0}`);
                console.log(`   ⏰ Expired:    ${momentumRes.status?.expired || 0}`);
                console.log(`   📊 Total:      ${momentumRes.status?.total || 0}`);
                
                if (momentumRes.stats) {
                    console.log(`\nEstatísticas:`);
                    console.log(`   Avg Reversals:  ${momentumRes.stats.avgReversals?.toFixed(2) || 'N/A'}`);
                    console.log(`   Buy Count:      ${momentumRes.stats.buyCount || 0}`);
                    console.log(`   Sell Count:     ${momentumRes.stats.sellCount || 0}`);
                }

                // Últimas ordens
                if (momentumRes.simulatedOrders && momentumRes.simulatedOrders.length > 0) {
                    console.log(`\n📋 Últimas Ordens:`);
                    console.log(`┌─────────────────────────────────────────────────────────────────────────────┐`);
                    console.log(`│ ID(short) │ Type   │ Criação   │ Atual     │ Var%  │ Status     │ Rev │ P/V   │`);
                    console.log(`├─────────────────────────────────────────────────────────────────────────────┤`);
                    
                    momentumRes.simulatedOrders.slice(0, 5).forEach(order => {
                        const idShort = order.id.substring(0, 8);
                        const type = order.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
                        const price1 = order.created_price.toFixed(0);
                        const price2 = order.current_price.toFixed(0);
                        const var_pct = ((order.current_price - order.created_price) / order.created_price * 100).toFixed(2);
                        const status = order.status;
                        const rev = order.confirmation_reversals || 0;
                        
                        let peaks = 0, valleys = 0;
                        try {
                            if (typeof order.peaks === 'string') peaks = JSON.parse(order.peaks).length;
                            else peaks = (order.peaks || []).length;
                            if (typeof order.valleys === 'string') valleys = JSON.parse(order.valleys).length;
                            else valleys = (order.valleys || []).length;
                        } catch (e) {}
                        
                        console.log(`│ ${idShort}... │ ${type}    │ ${price1.padStart(9)} │ ${price2.padStart(9)} │ ${var_pct.padStart(5)} │ ${status.padEnd(10)} │ ${rev.toString().padStart(3)} │ ${peaks}/${valleys}   │`);
                    });
                    console.log(`└─────────────────────────────────────────────────────────────────────────────┘`);
                }
            }

            console.log(`\n════════════════════════════════════════════════════════════════════════════════════`);
            console.log(`Last Update: ${new Date().toLocaleTimeString('pt-BR')} | Proxima atualizacao em 5s...`);
            console.log(`════════════════════════════════════════════════════════════════════════════════════\n`);

        } catch (error) {
            console.error('❌ Erro:', error.message);
        }
    }, 5000);

    // Primeira execução
    await new Promise(resolve => setTimeout(resolve, 100));
}

liveMonitor();

// Manter o processo ativo
process.on('SIGINT', () => {
    console.log('\n\n👋 Monitor fechado.');
    process.exit(0);
});
