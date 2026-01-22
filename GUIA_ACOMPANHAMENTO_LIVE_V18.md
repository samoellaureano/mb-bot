# 📊 ACOMPANHAMENTO LIVE - Estratégia v1.8

## 🚀 Status Atual (21/01/2026 23:57)

### ✅ Configuração Ativa
- **Estratégia**: Cash Management v1.8
- **Modo**: LIVE (SIMULATE=false)
- **Ambiente**: Mercado Bitcoin (BTC-BRL)
- **Versão Bot**: 1.2.1

### 📈 Parâmetros v1.8
```
MAIN_SELL_THRESHOLD    = 0.0008  (0.08%)
MAIN_BUY_THRESHOLD     = 0.0008  (0.08%)
MICRO_TRADE_INTERVAL   = 3 candles
MICRO_SELL_THRESHOLD   = 0.0003  (0.03%)
MICRO_BUY_THRESHOLD    = 0.0003  (0.03%)
BUY_AMOUNT_PCT         = 0.80    (80%)
MICRO_SELL_PCT         = 0.40    (40% do BTC)
MICRO_BUY_PCT          = 0.50    (50% do BRL)
REBALANCE_INTERVAL     = 25 candles
MAX_BUY_COUNT          = 3 (proteção)
RESET_INTERVAL         = 50 candles
```

### 📊 Dashboard
- **URL**: http://localhost:3001
- **Status**: ✅ Operacional
- **Atualização**: A cada 3 segundos
- **Dados**: PnL, ROI, Trades, Estratégia

### 🔄 Como Monitorar Ciclos

#### Terminal 1: Acompanhar Logs
```bash
tail -f /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log | grep "ciclo\|Iniciando\|PnL\|CASH"
```

#### Terminal 2: Verificar API
```bash
curl -s http://localhost:3001/api/data | jq '.pnl, .roi, .trades'
```

#### Terminal 3: Status do Processo
```bash
watch -n 1 'ps aux | grep "SIMULATE=false"'
```

### 🎯 O Que Observar

#### Ciclos Saudáveis
✅ `Iniciando ciclo N` a cada ~30 segundos
✅ Orderbook atualizado (Best Bid/Ask)
✅ Indicadores calculados (RSI, EMA, MACD)
✅ Sinais de CASH_MGT avaliados
✅ Ordens colocadas/canceladas conforme necessário

#### Alertas Normais
⚠️ "Histórico insuficiente" nos primeiros ciclos
⚠️ "Ciclo skipped - no orderbook" (conexão)
⚠️ "Order not found" (ordem expirada/preenchida)

#### Problemas
❌ Múltiplos "Ciclo skipped" consecutivos = conexão ruim
❌ "Insufficient balance" = revisar saldo
❌ "Authentication failed" = token expirado

### 📈 Métricas Esperadas (24h)

| Métrica | Target | Aceitável | Preocupante |
|---------|--------|-----------|------------|
| **PnL** | +0.50 a +1.40 BRL | ≥ 0 BRL | < -0.50 BRL |
| **ROI** | +0.25% a +0.56% | ≥ 0% | < -0.25% |
| **Trades** | 40-60 | 30-80 | > 100 |
| **Win Rate** | 70%+ | 50%+ | < 50% |

### 🛑 Se Algo Der Errado

#### Parar Bot
```bash
pkill -f "npm run live"
```

#### Resetar Banco de Dados
```bash
rm -f database/orders.db && npm run live
```

#### Logs Detalhados
```bash
npm run live:log  # Salva em exec-live.log
```

### 🔄 Próximos Passos Recomendados

1. **Acompanhar 1 hora**: Confirmar ciclos rodando normalmente
2. **Verificar 6 horas**: Avaliar PnL, se positivo continuar
3. **Backtesting 30 dias**: Validar estratégia com dados históricos
4. **Otimização de parâmetros**: Se performance < esperada

### 📞 Contatos Úteis

- **API Mercado Bitcoin**: https://www.mercadobitcoin.com.br/api
- **Dashboard Local**: http://localhost:3001
- **Documentação Bot**: README.md
- **Logs**: /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log

---

**Status**: ✅ v1.8 Rodando em LIVE
**Última Verificação**: 21/01/2026 23:57
**Recomendação**: Monitorar próximas 24h
