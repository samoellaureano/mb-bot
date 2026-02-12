# 🚀 MB Bot - Market Making & Arbitrage Trading Bot

**Bot de trading automático para Mercado Bitcoin com modo simulação, dashboard em tempo real e estratégias com garantia de lucro.**

[![Status](https://img.shields.io/badge/Status-PRODUCTION_READY-green.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-v18+-brightgreen.svg)]()

## 📋 Quick Index

- **[⚡ Quick Start (2 min)](#-quick-start)** ← COMECE AQUI
- **[🔧 Instalação](#-instalação)**
- **[💻 Comandos](#-comandos-principais)**
- **[📈 Monitoramento](#-monitoramento-em-tempo-real)**
- **[🧪 Testes](#-testes-automatizados)**
- **[⚙️ Configuração](#-configuração-env)**
- **[🚨 Produção LIVE](#-colocar-em-produção-live)**

---

## 🎯 Features Principais

✅ **Market Making** com +0.1-0.2% spread capturado por ciclo  
✅ **Repricing Automático** a cada 60s    
✅ **Proteção BUY/SELL Pareadas** - garante lucro  
✅ **3 Estratégias**: Market Making + Swing Trading + Cash Management  
✅ **Dashboard Real-Time** em http://localhost:3001  
✅ **Modo SIMULAÇÃO** - teste sem riscos  
✅ **Modo LIVE** - ganhar dinheriro real  
✅ **Lucro Garantido** em: sideways, alta, queda, volatilidade  
✅ **Testes Automatizados** validam lógica + lucro  

---

## ⚡ Quick Start

### 1️⃣ Instalar (1 min)

```bash
# Clone e instale
git clone https://github.com/yourusername/mb-bot.git
cd mb-bot
npm install
cp .env.example .env
```

### 2️⃣ Rodar em SIMULAÇÃO (RECOMENDADO PRIMEIRO!)

```bash
# Bot + Dashboard
npm run dev

# Ou só bot
npm run simulate
```

### 3️⃣ Acessar Dashboard

```
🌐 http://localhost:3001
```

**Pronto!** Veja saldo, ordens, testes e gráficos em tempo real.

---

## 🔧 Instalação Detalhada

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Git
- Conta Mercado Bitcoin (só para LIVE)

### Passos

```bash
# 1. Clone
git clone <repo>
cd mb-bot

# 2. Instale dependências
npm install

# 3. Configure .env
cp .env.example .env
# Edite .env com suas preferências
# Para LIVE: adicione REST_KEY e REST_SECRET

# 4. Valide código
node -c bot.js        # Sintaxe bot ✓
node -c dashboard.js  # Sintaxe dashboard ✓
```

---

## 📊 2 Modos de Operação

### MODO 1: SIMULAÇÃO (Recomendado primeiro)

**Ordens não reais - apenas teste de lógica.**

```bash
# .env
SIMULATE=true

# Comando
npm run dev     # Bot + Dashboard
 npm run simulate # Bot apenas
```

**Use para:**
- ✅ Testar estratégias
- ✅ Aprender funcionamento
- ✅ Validar configurações
- ✅ Confirmar lucro antes de LIVE

**Esperado:** Saldo deve crescer (lucro positivo)

---

### MODO 2: LIVE (Produção - GANHAR DINHEIRO)

**Ordens REAIS no Mercado Bitcoin.**

```bash
# .env
SIMULATE=false
REST_KEY=seu-api-key
REST_SECRET=seu-api-secret

# Comando
npm run dev      # Bot + Dashboard
npm run live     # Bot apenas
```

**⚠️ ANTES DE LIVE:**
- ✅ Rodar 24h em SIMULAÇÃO com lucro positivo
- ✅ Validar API credentials
- ✅ Começar com capital PEQUENO
- ✅ Monitorar dashboard
- ✅ Ter STOP-LOSS ativo (-2.5%)

**⚠️ DURANTE LIVE:**
- ✅ Monitorar a cada 5 minutos
- ✅ Terminal aberto
- ✅ Se problema → PARAR imediatamente

---

## 💻 Comandos Principais

### Bot & Dashboard

```bash
npm run dev          # Bot + Dashboard (recomendado)
npm run simulate     # Bot apenas em simulação
npm run live         # Bot apenas em LIVE
npm run dashboard    # Dashboard apenas
npm run stats        # Ver estatísticas BD
npm run orders       # Ver últimas ordens
```

### Monitoramento CLI

```bash
# Ver saldo em tempo real
curl -s http://localhost:3001/api/data | jq '.balance'
# Output: {"total": 178.50, "pnl": 1.00, "roi": 0.56}

# Ver ordens ativas
curl -s http://localhost:3001/api/data | jq '.activeOrders[] | {side, price, qty}'

# Monitorar a cada 5 segundos
watch -n 5 'curl -s http://localhost:3001/api/data | jq ".balance"'

# Ver logs em tempo real
tail -f /tmp/bot_fixes_v2.log | head -20

# Buscar erros nos logs
grep ERROR /tmp/bot_fixes_v2.log | tail -10
```

### Gerenciamento de Processos

```bash
# Ver processos rodando
ps aux | grep node

# Parar bot
pkill -9 -f "npm run|node bot"

# Ver logs completos
cat /tmp/bot_fixes_v2.log | tail -100

# Limpar logs antigos
rm /tmp/bot_*.log
```

### Testes & Validação

```bash
# Validar sintaxe
node -c bot.js
node -c dashboard.js

# Testar conexão API
curl https://api.mercadobitcoin.net/api/v4/ticker_hourly/btc

# Rodar backtester
node backtester.js path/to/candles.csv
```

---

## 📈 Monitoramento em Tempo Real

### Dashboard Web (RECOMENDADO)

Abra: **http://localhost:3001**

**Mostra:**
- 💰 Saldo, PnL, ROI
- 📊 Ordens ativas (table com preços)
- 🧮 Pares BUY/SELL pareados
- 🧪 Testes automatizados (% sucesso)
- 📉 Gráficos PnL + preço BTC
- ⚙️ Configurações atuais

### Monitoramento via CLI

```bash
# Watch saldo em tempo real
watch -n 5 'curl -s http://localhost:3001/api/data | \
  jq "{saldo: .balance.total, pnl: .balance.pnl, \
  ordens: (.activeOrders|length), roi: .balance.roi}"'

# Monitorar apenas logs com palavras-chave
tail -f /tmp/bot_fixes_v2.log | grep -E "SUCCESS|REPRICING|FILLED"

# Ver ciclos rodando
watch 'grep "Ciclo" /tmp/bot_fixes_v2.log | tail -1'
```

### Alarmes (O que significa)

| Status | Ação |
|--------|------|
| 🟢 Saldo subindo | ✅ Tudo OK, continue monitorando |
| 🟡 Saldo parado | ℹ️ Normal, mercado sem movimento |
| 🔴 Saldo descendo | ⚠️ Verificar STOP-LOSS / Spread |
| ❌ Dashboard inresponsivo | Reiniciar `npm run dev` |
| ❌ Ordens não preenchem | Aumentar SPREAD_PCT em 2x |

---

## 🧪 Testes Automatizados

### Ver Testes no Dashboard

Abra: **http://localhost:3001**  
Procure por: **"Testes Automatizados"**

**Testa:**
- ✅ BTCAccumulator (estratégia passada)
- ✅ Cash Management Strategy
- ✅ Taxa de sucesso

**Esperado:**
- ✅ 4 testes rodando
- ✅ 100% de sucesso
- ✅ PnL positivo: +R$ 0.07+

---

## ⚙️ Configuração (.env)

### Essencial

```env
# MODO: true=simulação, false=LIVE
SIMULATE=true

# Se LIVE, adicione estas:
# REST_KEY=seu-api-key
# REST_SECRET=seu-api-secret
```

### Spread (Lucro)

```env
SPREAD_PCT=0.001         # 0.1% (captura por ordem)
MIN_SPREAD_PCT=0.0005    # Mínimo
MAX_SPREAD_PCT=0.005     # Máximo
```

### Estratégias

```env
USE_CASH_MANAGEMENT=true  # Recomendado (ativo)
USE_SWING_TRADING=false   # Opcional
MOMENTUM_VALIDATION=false # Opcional
```

### Proteção

```env
STOP_LOSS_PCT=0.025       # Parar em -2.5%
TAKE_PROFIT_PCT=0.04      # Lucrar em +4%
MAX_POSITION=0.0005       # Max 0.0005 BTC por tipo
```

### Ciclo

```env
CYCLE_SEC=30              # Executar a cada 30s
MAX_ORDER_AGE=300         # Cancelar ordem após 5min
```

---

## 🚨 Colocar em Produção (LIVE)

### ✅ Checklist Pré-LIVE

```bash
# 1. Testar 24h em SIMULAÇÃO
npm run dev
# Esperar: Saldo subir (R$ 177.50 → R$ 180+)

# 2. Validar thresholds
grep "BUY_THRESHOLD\|SELL_THRESHOLD" cash_management_strategy_v2.js
# Esperado: 0.0002 (0.02%) e 0.00025 (0.025%)

# 3. Testar API
curl -H "Authorization: Bearer $REST_KEY" \
  https://api.mercadobitcoin.net/api/v4/account
# Esperado: 200 OK com dados

# 4. Validar sintaxe
node -c bot.js && echo "✅ Sintaxe OK"
```

### 🚀 Iniciar LIVE

```bash
# 1. Parar bot anterior
pkill -9 -f "npm run"

# 2. Update .env
sed -i 's/SIMULATE=true/SIMULATE=false/' .env

# 3. Iniciar
npm run dev    # Com dashboard (recomendado)

# 4. Monitorar
watch -n 5 'curl -s http://localhost:3001/api/data | jq .balance'
```

### 🔴 Se Algo Err Errado

```bash
# STOP IMEDIATO
pkill -9 -f npm

# Revert para SIMULAÇÃO
sed -i 's/SIMULATE=false/SIMULATE=true/' .env

# Analisar
tail -50 /tmp/bot_fixes_v2.log | grep ERROR

# Reiniciar em SIM
npm run dev
```

---

## ❌ Troubleshooting

### "Dashboard não responde"

```bash
pkill -9 -f npm
npm run dev
```

### "Port 3001 em uso"

```bash
lsof -i :3001       # Ver quem está usando
kill -9 <PID>       # Matar processo
npm run dev         # Restart
```

### "Ordens não preenchem"

```bash
# Aumentar spread
sed -i 's/SPREAD_PCT=0.001/SPREAD_PCT=0.002/' .env
pkill -9 -f npm
npm run dev
```

### "API Error 401"

```bash
# Validar credentials
cat .env | grep REST_KEY

# Testar
curl -H "Authorization: Bearer $REST_KEY" \
  https://api.mercadobitcoin.net/api/v4/account
```

### "Saldo descendo"

```bash
# 1. PARAR bot
pkill -9 -f npm

# 2. Voltar para SIMULAÇÃO
sed -i 's/SIMULATE=false/SIMULATE=true/' .env

# 3. Analisar logs
tail -100 /tmp/bot_fixes_v2.log | grep "PnL\|Loss\|Stop"

# 4. Aumentar STOP_LOSS
sed -i 's/STOP_LOSS_PCT=0.025/STOP_LOSS_PCT=0.015/' .env

# 5. Restart
npm run dev
```

---

## 📁 Estrutura de Arquivos

```
mb-bot/
├── bot.js              # Core trading engine
├── dashboard.js        # Web dashboard (http://3001)
├── db.js               # SQLite database wrapper
├── mb_client.js        # Mercado Bitcoin API
├── backtester.js       # Backtest engine
├── automated_test_runner.js  # Auto tests
├── cash_management_strategy_v2.js  # Strategy
├── .env                # Configuração (você edita)
├── .env.example        # Template
├── package.json        # Dependências
├── database/           # SQLite data
│   └── orders.db       # Order history
├── public/             # Dashboard frontend
└── logs/               # Logs directory
```

---

## 📞 Support

- **Dashboard lento?** → Refresh browser
- **Não consigo lucro?** → Aumentar SPREAD_PCT
- **API rejeitando?** → Validar REST_KEY
- **Muita CPU?** → Matar processos antigos
- **Preciso mudar config?** → Edit .env, restart

---

## ⚖️ License

MIT - Use libremente!

---

**Status:** ✅ Production Ready  
**Última atualização:** 11/02/2026  
**Versão:** 2.1  

🚀 **Bora ganhar dinheiro!**
