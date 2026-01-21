# 📊 MB Bot - Dashboards Operacionais

## ✅ Sistema Completamente Funcional

### 🎯 Dois Dashboards Disponíveis

#### 1. Dashboard Simples (RECOMENDADO PARA MONITORAMENTO)
**URL**: `http://localhost:3001/simple.html`

**Características**:
- ✅ Interface limpa e responsiva
- ✅ Carregamento rápido
- ✅ Atualização a cada 5 segundos
- ✅ Todos os dados exibindo corretamente
- ✅ Cores dinâmicas (verde/vermelho para PnL)
- ✅ Ideal para monitoramento contínuo

**Seções**:
1. **Status do Bot**: Modo, Preço, Spread, Volatilidade
2. **Performance**: PnL, ROI, Saldos (BTC/BRL/Total)
3. **Ordens**: Ativas, Fills, Canceladas, Taxa de Fill
4. **Momentum**: Total, Simulated, Pending, Confirmed, Rejected
5. **Tabela de Momentum**: Detalhes com ID, tipo, preço, variação, status
6. **Indicadores Técnicos**: RSI, Tendência, Confiança, EMA Curta

---

#### 2. Dashboard Original (COMPLETO COM GRÁFICOS)
**URL**: `http://localhost:3001/`

**Características**:
- ✅ Interface completa com gráficos
- ✅ Histórico visual de PnL
- ✅ Gráfico de preço BTC
- ✅ Rastreamento de pares BUY/SELL
- ✅ Estatísticas detalhadas
- ✅ Ideal para análise profunda

**Seções Adicionais**:
- Gráfico de PnL (evolução no tempo)
- Gráfico de Preço BTC (em tempo real)
- Rastreamento de pares completos
- Configurações do bot
- Indicadores técnicos avançados
- Validação externa (tendências)
- Monitor de recuperação

---

## 🔄 Fluxo de Dados

```
🤖 BOT.JS (LIVE)
    ↓
📡 API (Port 3001)
    ├── /api/data (Mercado, posição, stats)
    ├── /api/momentum (Ordens de momentum)
    └── /api/pairs (Pares BUY/SELL)
    ↓
🖥️ DASHBOARD (Auto-refresh 5s)
    ├── Simple.html (Recomendado)
    └── Index.html (Completo)
```

---

## 📈 Dados em Tempo Real

### Último Status Observado (Ciclo 83+)

| Métrica | Valor | Status |
|---------|-------|--------|
| **Modo** | LIVE 🟢 | Produção |
| **Preço BTC** | R$ 481.970,00 | ✅ |
| **Spread** | 0.065% | Apertado ✅ |
| **Volatilidade** | 0.31% | Baixa ✅ |
| **Posição BTC** | 0.00042937 | Mantida |
| **Saldo BRL** | R$ 0.01 | Baixo ⚠️ |
| **PnL Total** | -R$ 2,20 | Negativo 📉 |
| **ROI** | -1.00% | ⚠️ |
| **Ordens Ativas** | 7 | ✅ |
| **Fills** | 71 | Taxa 69.6% ✅ |
| **Canceladas** | 24 | Envelhecimento normal |
| **Momentum Total** | 4 | 1 sim, 1 pend, 2 conf ✅ |

---

## 🎬 Como Usar

### Para Monitorar em Tempo Real
```bash
# Opção 1: No navegador (melhor)
Acesse: http://localhost:3001/simple.html

# Opção 2: Terminal (monitoramento paralelo)
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
node ciclos_monitor.js
```

### Para Análise Completa
```bash
# Dashboard com gráficos e histórico
Acesse: http://localhost:3001/
```

### Para Ver Logs do Bot
```bash
tail -f logs/bot_live*.log
```

---

## ✨ Recursos Ativos

### API Endpoints
- ✅ `GET /api/data` - Dados completos do bot
- ✅ `GET /api/momentum` - Ordens de momentum
- ✅ `GET /api/pairs` - Pares BUY/SELL completos

### Frontend Features
- ✅ Auto-refresh a cada 5 segundos
- ✅ Formatação de valores monetários
- ✅ Cores dinâmicas por performance
- ✅ Tabelas responsivas
- ✅ Gráficos em tempo real (original)
- ✅ Mobile-friendly

### Database
- ✅ SQLite sincronizado
- ✅ 4 ordens de momentum persistidas
- ✅ Histórico de fills
- ✅ PnL trackado

---

## 🎯 Próximos Passos

### Para Acompanhar o Bot
1. Abra `http://localhost:3001/simple.html` no navegador
2. Deixe rodando por 30-60 minutos
3. Observe mudanças em:
   - 💹 Preço (deve variar com mercado real)
   - 📊 PnL (lucro/perda em tempo real)
   - 📋 Ordens (novas sendo colocadas)
   - 🎯 Momentum (confirmações/rejeições)
   - 📈 Indicadores (RSI, tendência)

### Para Otimizar
1. Aumentar saldo BRL para mais operações
2. Ajustar SPREAD_PCT para diferentes condições
3. Monitorar fill rate (meta: > 65%)
4. Rastrear momentum confirmations

---

## 📋 Checklist - Tudo Funcionando

```
✅ Bot em LIVE mode
✅ API respondendo corretamente
✅ Dashboard Simples exibindo dados
✅ Dashboard Original exibindo dados
✅ Gráficos atualizando
✅ Momentum orders sincronizadas
✅ Auto-refresh funcionando
✅ Cores dinâmicas (PnL)
✅ Banco de dados persistente
✅ Formatação de valores (BRL/BTC)
✅ Monitor de ciclos em terminal
✅ Autenticação Mercado Bitcoin ativa
```

---

## 🔧 Troubleshooting

### Se dados não aparecerem
1. Abra Developer Tools (F12) no navegador
2. Verifique Console para erros
3. Verifique se API está respondendo: `curl http://localhost:3001/api/data`
4. Recarregue a página (Ctrl+R)

### Se gráficos não aparecerem
- Aguarde 30 segundos para histórico acumular
- Refresque a página (Ctrl+R)
- Acesse dashboard simples primeiro

### Se PnL mostrar "Carregando"
- Aguarde 5 segundos (próxima atualização automática)
- Verifique se bot está ativo: `ps aux | grep bot.js`

---

## 📞 Suporte Rápido

```bash
# Verificar status do bot
ps aux | grep -E "bot|dashboard|monitor"

# Reiniciar bot
pkill -f "bot.js"
npm run live

# Ver logs em tempo real
tail -f logs/bot_live*.log

# Testar API
curl -s http://localhost:3001/api/data | python3 -m json.tool | head -50

# Contar ciclos
grep "Ciclo\|cycle" logs/bot_live*.log | wc -l
```

---

**Status**: 🟢 SISTEMA TOTALMENTE OPERACIONAL

**Última Atualização**: 2026-01-20 20:45:58 UTC
