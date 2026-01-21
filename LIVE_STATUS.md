# 🚀 MB BOT - EXECUÇÃO LIVE - STATUS ATUAL

## ✅ Sistema Operacional

```
🤖 BOT.JS (PID: 80910)
├─ Mode: LIVE (SIMULATE=false) ✅
├─ API Connection: Mercado Bitcoin ✅
├─ Token: Valid (59 min remaining) ✅
├─ Cycles: 14+ executed
└─ Cycle Interval: 30 seconds

📡 API SERVER (Port 3001)
├─ /api/data ✅
├─ /api/momentum ✅
└─ /api/pairs ✅

🖥️ MONITORAMENTO
├─ Script: ciclos_monitor.js ✅
├─ Status: RODANDO ✅
└─ Refresh: 5 segundos
```

## 📊 Dados do Último Ciclo

### 💹 Mercado
- **Preço BTC-BRL**: R$ 481.866,50
- **Bid**: R$ 481.754,00
- **Ask**: R$ 481.979,00
- **Spread**: 225 BRL (0.047%)

### 📈 Indicadores
- **RSI**: 0.00
- **Volatilidade**: 0.00%
- **Confiança**: 0.0%
- **Tendência Bot**: NEUTRAL ↔
- **Tendência Externa**: BEARISH (Score: 29/100)

### 💰 Posição
- **BTC**: 0.00042937
- **BRL**: 0.01 ⚠️ (Baixo)
- **PnL Total**: 0.00 BRL
- **ROI**: -1.00%
- **PnL Realizado**: 0.00 BRL

### 📋 Ordens
- **Ativas**: 7
- **Fills**: 71
- **Canceladas**: 24
- **Taxa Fill**: 69.6%

### 🎯 Momentum
- **Total**: 4 ordens
- **Simulated**: 1
- **Pending**: 1
- **Confirmed**: 2
- **Rejected**: 0

## 🎯 Como Acompanhar

### Opção 1: Monitoramento em Tempo Real (RECOMENDADO)

```bash
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
node ciclos_monitor.js
```

Atualiza a cada 5 segundos, mostrando:
- Dados de mercado ao vivo
- Indicadores técnicos em tempo real
- Posição e PnL
- Ordens ativas
- Status de momentum

### Opção 2: Dashboard Web

Abra seu navegador em: **http://localhost:3001**

Visualização gráfica com:
- Gráfico de preços
- Tabela de ordens
- Indicadores técnicos
- Histórico de PnL
- Atualização automática

### Opção 3: Logs do Bot

```bash
tail -f logs/bot_live*.log | grep -E "Ciclo|Mini Dashboard|PnL"
```

## 📋 O Que Observar em Cada Ciclo

### ✓ PREÇO
- Mudanças no bid/ask = movimento de mercado
- Spread variando = dinâmica de liquidez

### ✓ INDICADORES
- RSI > 70 ou < 30 = zonas extremas
- Volatilidade mudando = adaptar estratégia
- Confiança aumentando/descendo

### ✓ TENDÊNCIA
- Bot detectando UP/DOWN/NEUTRAL
- Alinhamento com tendência externa

### ✓ POSIÇÃO
- BTC aumentando = bot acumulando
- BTC diminuindo = bot vendendo
- PnL mudando = fills acontecendo

### ✓ ORDENS
- Novas ordens sendo colocadas
- Taxa de fill aumentando
- Cancelamentos por aging (10+ minutos)

### ✓ MOMENTUM
- Status mudando: simulated → pending → confirmed
- Rejeições aparecerem
- Reversals aumentando

## ⚡ Status Geral

```
✅ Bot em LIVE mode
✅ Autenticação ativa
✅ API respondendo
✅ Frontend disponível
✅ Momentum system ativo
✅ Database sincronizado
✅ Ciclos executando

⚠️  Saldo BRL baixo (0.01 BRL)
    → Sistema funcional mas limitado em novos trades
```

## 🔍 Comandos Úteis

```bash
# Monitoramento em tempo real
node ciclos_monitor.js

# Apenas preço e PnL
curl -s http://localhost:3001/api/data | grep -E "mid_price|pnl_total|roi"

# Ordens de momentum
curl -s http://localhost:3001/api/momentum | head -50

# Logs do bot
tail -f logs/bot_live*.log

# Contar ciclos
grep "Ciclo" logs/bot_live*.log | wc -l

# PnL histórico
grep "PnL Total" logs/bot_live*.log | tail -20
```

## 🎬 Próximas Ações

1. **Inicie o monitor**: `node ciclos_monitor.js`
2. **Deixe rodando**: 5-10 minutos
3. **Observe mudanças em**:
   - Preço (deve variar com mercado real)
   - Tendência (bot ajustando estratégia)
   - PnL (lucro/perda em tempo real)
   - Ordens (fills acontecendo)
   - Momentum (confirmações/rejeições)
4. **Abra o dashboard**: http://localhost:3001
5. **Volte ao monitor**: Ver detalhes numéricos

## 📈 Estrutura de Dados

### /api/data
```json
{
  "mode": "LIVE",
  "market": {
    "bid": 481754,
    "ask": 481979,
    "mid_price": 481866.50,
    "spread": 225
  },
  "indicators": {
    "rsi": 0,
    "volatility": 0,
    "confidence": 0,
    "trend": "neutral"
  },
  "stats": {
    "pnl_total": 0,
    "roi": -1,
    "pnl_realized": 0
  }
}
```

### /api/momentum
```json
{
  "simulatedOrders": [
    {
      "id": "...",
      "side": "buy|sell",
      "created_price": 483000,
      "status": "simulated|pending|confirmed|rejected",
      "confirmation_reversals": 3,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "status": {
    "simulated": 1,
    "pending": 1,
    "confirmed": 2,
    "rejected": 0
  }
}
```

## ⚙️ Configuração Ativa

```
Spread: 3.50%
Order Size: 0.00005 BTC
Ciclo: 30 segundos
Max Position: 0.0005 BTC
Min Volume: 0.00003 BTC
Stop Loss: 1.5%
Take Profit: 2.5%
```

---

**Última Atualização**: 2026-01-20 17:38:55 UTC

**Status**: 🟢 ATIVO E MONITORANDO
