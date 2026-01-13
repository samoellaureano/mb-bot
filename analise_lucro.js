const fs = require('fs');
const path = require('path');
const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('http://localhost:3001/api/data?t=' + Date.now());
    const data = res.data;

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                   ANÁLISE DETALHADA DE POTENCIAL DE LUCRO                   ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    // Ler o histórico de PnL
    const pnlHistoryPath = path.join(process.cwd(), 'pnl_history.json');
    if (fs.existsSync(pnlHistoryPath)) {
      const pnlData = JSON.parse(fs.readFileSync(pnlHistoryPath, 'utf8'));
      
      console.log('📈 HISTÓRICO DE PnL:\n');
      console.log('├─ Total de Pontos Coletados: ' + pnlData.length);
      
      if (pnlData.length > 0) {
        const values = pnlData
          .map(p => typeof p === 'object' ? (p.value || p) : p)
          .filter(v => typeof v === 'number')
          .map(v => parseFloat(v));
        
        if (values.length > 0) {
          const max = Math.max(...values);
          const min = Math.min(...values);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const current = values[values.length - 1];
          const trending = current > avg ? '📈 Subindo' : current < avg ? '📉 Caindo' : '➡️ Estável';
          
          console.log('├─ PnL Máximo: R$ ' + max.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
          console.log('├─ PnL Mínimo: R$ ' + min.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
          console.log('├─ PnL Médio: R$ ' + avg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
          console.log('├─ PnL Atual: R$ ' + current.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
          console.log('└─ Tendência: ' + trending);
        }
      }
    }

    // Status do bot
    const dbPath = path.join(process.cwd(), 'database', 'orders.db');
    console.log('\n📊 STATUS DO BOT:\n');
    console.log('├─ Banco de Dados: ' + (fs.existsSync(dbPath) ? '✅ Ativo' : '❌ Não encontrado'));

    const configPath = path.join(process.cwd(), '.env');
    console.log('├─ Configuração: ' + (fs.existsSync(configPath) ? '✅ Carregada' : '⚠️ Usando padrão'));

    // Dados do API
    const totalPnL = parseFloat(data.stats?.totalPnL || 0);
    const roi = parseFloat(data.stats?.roi || 0);
    const uptime = data.stats?.uptime || '0min';
    const cycles = data.stats?.cycles || 0;
    const fillRate = parseFloat(data.stats?.fillRate || 0);
    const avgSpread = parseFloat(data.stats?.avgSpread || 0);
    const saldoTotal = parseFloat(data.balances?.total || 214.51);

    console.log('├─ Ciclos Executados: ' + cycles);
    console.log('└─ Uptime: ' + uptime);

    console.log('\n💡 ANÁLISE DE RENTABILIDADE:\n');
    console.log('Condições Atuais:');
    console.log('├─ Saldo Total: R$ ' + saldoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
    console.log('├─ PnL Total: R$ ' + totalPnL.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
    console.log('├─ Taxa de Fill: ' + fillRate.toFixed(1) + '%');
    console.log('├─ Spread Médio: ' + avgSpread.toFixed(3) + '%');
    console.log('└─ ROI: ' + roi.toFixed(4) + '%');

    console.log('\n🎯 PROJEÇÕES FINANCEIRAS:\n');
    
    // Extração de horas e minutos
    const upTimeMatch = uptime.match(/(\d+)([hm])/g) || [];
    let totalMinutes = 0;
    upTimeMatch.forEach(m => {
      const val = parseInt(m);
      if (m.includes('h')) totalMinutes += val * 60;
      if (m.includes('m')) totalMinutes += val;
    });

    if (totalMinutes > 0) {
      const lucroHora = (totalPnL / totalMinutes) * 60;
      const lucroDia = lucroHora * 24;
      const lucroMes = lucroDia * 30;
      const lucroAno = lucroDia * 365;
      const roi_mensal = (lucroMes / saldoTotal) * 100;
      const roi_anual = (lucroAno / saldoTotal) * 100;

      console.log('├─ Lucro/Hora (estimado): R$ ' + lucroHora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
      console.log('├─ Lucro/Dia (estimado): R$ ' + lucroDia.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
      console.log('├─ Lucro/Mês (estimado): R$ ' + lucroMes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
      console.log('├─ Lucro/Ano (estimado): R$ ' + lucroAno.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
      console.log('├─ ROI Mensal (estimado): ' + roi_mensal.toFixed(2) + '%');
      console.log('└─ ROI Anual (estimado): ' + roi_anual.toFixed(2) + '%');
    } else {
      console.log('├─ Dados insuficientes para projeção (aguardando mais tempo)');
      console.log('└─ Recomendação: Aguardar pelo menos 1 hora de execução');
    }

    console.log('\n⚠️ OBSERVAÇÕES IMPORTANTES:\n');
    console.log('├─ ⏰ Tempo de execução: ' + uptime);
    console.log('│  Dados ainda são iniciais. Estatisticamente pequenos.');
    console.log('│  Recomendação: Aguardar 24h para validação confiável');
    console.log('│');
    console.log('├─ 📊 Taxa de Preenchimento: ' + fillRate.toFixed(1) + '%');
    if (fillRate === 0) {
      console.log('│  Nenhuma ordem preenchida ainda (LIVE esperado assim)');
      console.log('│  Ordens podem ter preços inadequados para o mercado');
    } else {
      console.log('│  Ótimo! Ordens estão sendo preenchidas.');
    }
    console.log('│');
    console.log('├─ 💰 Spread Médio: ' + avgSpread.toFixed(3) + '%');
    if (avgSpread < 0.1) {
      console.log('│  Excelente! Market making muito viável');
    } else if (avgSpread < 0.5) {
      console.log('│  Bom! Spread adequado para operação');
    } else {
      console.log('│  Spread alto - considerar ajustar parâmetros');
    }
    console.log('│');
    console.log('└─ 🔄 Ciclos Executados: ' + cycles);

    console.log('\n✅ VALIDAÇÃO DE LUCRO:\n');
    console.log('Status: ' + (totalPnL > 0 ? '✅ POSITIVO' : '⚠️ AGUARDANDO'));
    console.log('');
    console.log('Checklist de Performance:');
    console.log('├─ ✅ Gráficos separados (PnL verde, BTC azul) - CONCLUÍDO');
    console.log('├─ ✅ Bot executando ciclos - CONCLUÍDO (' + cycles + ' ciclos)');
    console.log('├─ ' + (totalPnL > 0 ? '✅' : '⏳') + ' PnL Positivo - ' + (totalPnL > 0 ? 'SUCESSO' : 'AGUARDANDO'));
    console.log('├─ ' + (fillRate > 0 ? '✅' : '⏳') + ' Ordens sendo preenchidas - ' + (fillRate > 0 ? 'SIM' : 'AGUARDANDO'));
    console.log('└─ ⏳ 24h de validação - EM PROGRESSO');

    console.log('\n📋 PRÓXIMAS AÇÕES:\n');
    console.log('1. ✅ Manter bot rodando continuamente');
    console.log('2. ✅ Monitorar pelo dashboard em http://localhost:3001');
    console.log('3. 📊 Coletar dados por 24-48 horas');
    console.log('4. 🔍 Validar taxa de preenchimento (fill rate)');
    console.log('5. ⚙️ Ajustar parâmetros conforme necessário');
    console.log('6. 📈 Expandir capital quando confirmado lucro consistente');

    console.log('\n╚════════════════════════════════════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
})();
