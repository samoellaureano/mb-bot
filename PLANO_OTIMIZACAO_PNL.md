# 💰 Plano de Otimização de PnL - MB Bot

## Status Atual
- **PnL**: -2.15 BRL (negativo)
- **ROI**: -3.52%
- **Tendência**: Mercado neutro
- **Volatilidade**: Baixa
- **Problema**: Sistema não está gerando lucro

## 🎯 Problemas Identificados

### 1. **Spread Muito Agressivo**
```
Configuração: SPREAD_PCT=0.015 (1.5%)
Problema: Muito estreito para cobrir taxas + slippage
Taxa Maker: 0.30%
Taxa Taker: 0.70%
Slippage esperado: 0.10-0.20%
Total de custos: ~1.0-1.2%
Spread atual: 1.5% (margem de apenas 0.3-0.5%)
```

**Solução**: Aumentar para 2-2.5% mínimo

### 2. **Order Size Muito Pequeno**
```
Configuração: ORDER_SIZE=0.000005 BTC (micro-ordens)
Preço: ~R$ 483.000
Valor por ordem: ~R$ 2.40
Problema: Muito pequeno para ser rentável em taxa fixa
```

**Solução**: Aumentar para 0.00005 BTC (20x maior)

### 3. **Falta de Dinâmica Inteligente**
Código atual:
- Spread: Fixo (não adapta bem)
- Order size: Micro-ordens não rentáveis
- Risk: Stop loss pequeno demais (0.8%)

**Solução**: Implementar estratégia adaptativa por condição de mercado

### 4. **Posicionamento Pobre**
Código calcula spread dinâmico mas:
- Não ajusta agressivamente em low vol
- Não reduz em high vol
- Não adapta por regime de mercado

## 📊 Estratégia de Melhoria

### FASE 1: Ajustes Rápidos (Imediato - 30 min)

#### 1.1 Aumentar Spread Mínimo
```env
# ANTES
SPREAD_PCT=0.015          # 1.5%
MIN_SPREAD_PCT=0.012      # 1.2%

# DEPOIS
SPREAD_PCT=0.025          # 2.5%
MIN_SPREAD_PCT=0.020      # 2.0%
MAX_SPREAD_PCT=0.040      # 4.0%
```

**Impacto**: +0.5-1% margem por operação

#### 1.2 Aumentar Order Size
```env
# ANTES
ORDER_SIZE=0.000005       # ~R$ 2.40
MIN_ORDER_SIZE=0.000003
MAX_ORDER_SIZE=0.000010

# DEPOIS
ORDER_SIZE=0.00005        # ~R$ 24 (10x maior)
MIN_ORDER_SIZE=0.00002
MAX_ORDER_SIZE=0.0001
```

**Impacto**: +10x volume per ordem

#### 1.3 Ajustar Stop Loss e Take Profit
```env
# ANTES
STOP_LOSS_PCT=0.008       # 0.8% (muito apertado)
TAKE_PROFIT_PCT=0.015     # 1.5%

# DEPOIS
STOP_LOSS_PCT=0.015       # 1.5% (mais realista)
TAKE_PROFIT_PCT=0.025     # 2.5% (maior potencial)
```

**Impacto**: Menos stop loss falsos

### FASE 2: Spread Dinâmico Inteligente (1-2 horas)

Implementar spread adaptativo por condições:

```javascript
// Pseudocódigo
function getOptimalSpread(volatility, regime, rsi, trend) {
  let spread = 0.020; // Base 2%
  
  // Volatilidade
  if (volatility < 0.5) spread *= 0.8;   // Low vol: reduz spread
  if (volatility > 2.0) spread *= 1.3;   // High vol: aumenta spread
  
  // Regime
  if (regime === 'BULL_TREND') spread *= 0.9;  // Alta: aproveita movimento
  if (regime === 'BEAR_TREND') spread *= 1.2;  // Baixa: mais proteção
  if (regime === 'RANGING') spread *= 1.1;     // Range: captura oscilação
  
  // RSI (zonas de exaustão)
  if (rsi > 75 || rsi < 25) spread *= 1.15;    // Extremos: mais proteção
  
  // Enfoque no lucro: sempre mínimo 2%
  return Math.max(0.020, Math.min(0.040, spread));
}
```

### FASE 3: Posicionamento Inteligente (2-4 horas)

#### 3.1 Aumentar Size em Oportunidades
```javascript
// Quando mercado está favorável
if (conviction > 0.7 && regime === 'BULL_TREND') {
  ORDER_SIZE *= 1.5; // 50% maior
}
```

#### 3.2 Reduzir Size em Risco Alto
```javascript
// Quando incerteza é alta
if (conviction < 0.3 || volatility > 3) {
  ORDER_SIZE *= 0.5; // 50% menor
}
```

#### 3.3 Viés Inteligente
```javascript
// Buy em mercado forte
if (regime === 'BULL_TREND' && rsi < 60) {
  // Aumenta viés de compra (buy_ratio = 70% buy, 30% sell)
}

// Sell em mercado fraco
if (regime === 'BEAR_TREND' && rsi > 40) {
  // Aumenta viés de venda (sell_ratio = 70% sell, 30% buy)
}
```

### FASE 4: Validação de Lucro (4-8 horas)

```javascript
function validateProfitMargin(spread, volatility) {
  const costs = 0.010;  // 1% em taxas
  const slippage = 0.002; // 0.2% slippage
  const totalCosts = costs + slippage;
  
  if (spread < totalCosts * 1.2) {
    console.warn(`Spread ${spread} muito baixo para ${totalCosts} custos`);
    return false;
  }
  return true;
}
```

## 🔧 Implementação Específica

### Arquivo: .env (Configuração)
```env
# === SPREAD STRATEGY ===
SPREAD_PCT=0.025          # 2.5% base
MIN_SPREAD_PCT=0.020      # 2.0% mínimo
MAX_SPREAD_PCT=0.040      # 4.0% máximo

# === ORDER SIZING ===
ORDER_SIZE=0.00005        # 0.005% do portfólio por ordem
MIN_ORDER_SIZE=0.00002
MAX_ORDER_SIZE=0.0001

# === RISK MANAGEMENT ===
STOP_LOSS_PCT=0.015       # 1.5%
TAKE_PROFIT_PCT=0.025     # 2.5%
MAX_POSITION=0.0005       # Máximo 0.0005 BTC

# === MARKET DYNAMICS ===
MIN_VOLATILITY_PCT=0.05   # Não opera se < 0.05%
MAX_VOLATILITY_PCT=5.0    # Não opera se > 5%
```

### Arquivo: bot.js (Lógica)

Adicionar função antes de placeOrder:

```javascript
function getAdaptiveSpread(params) {
  const { volatility, regime, rsi, conviction, confidence } = params;
  
  let spread = 0.020; // Base 2%
  
  // Factor 1: Volatilidade
  const volFactor = Math.max(0.8, Math.min(1.3, volatility / 1.0));
  spread *= volFactor;
  
  // Factor 2: Regime
  const regimeFactors = {
    'BULL_TREND': 0.9,
    'BEAR_TREND': 1.2,
    'RANGING': 1.1,
  };
  spread *= (regimeFactors[regime] || 1.0);
  
  // Factor 3: RSI (extremos)
  if (rsi > 75 || rsi < 25) spread *= 1.15;
  
  // Factor 4: Confiança
  if (conviction > 0.8) spread *= 0.85; // Mais confiante = spread menor
  if (conviction < 0.3) spread *= 1.3;  // Menos confiante = spread maior
  
  // Garantir limites
  return Math.max(0.020, Math.min(0.040, spread));
}
```

## 📈 Métricas de Sucesso

| Métrica | Alvo | Timeline |
|---------|------|----------|
| **PnL diário** | +0.50 BRL | 1 semana |
| **ROI** | +0.80% | 1 semana |
| **Win rate** | >55% | 2 semanas |
| **Sharpe ratio** | >0.5 | 3 semanas |

## ⚡ Quick Wins (Implementar AGORA)

1. **Spread Mínimo**: 2% → impacto imediato
2. **Order Size**: 10x maior → mais rentável
3. **Stop Loss**: 1.5% → menos whipsaws
4. **Take Profit**: 2.5% → deixa lucro crescer

**Tempo**: 5 minutos para ajustar .env

## 🚀 Próximas Fases

### Curto Prazo (1-2 semanas)
- ✅ Aumentar spread e order size
- ✅ Validar lucro por operação
- ✅ Implementar spread dinâmico
- ✅ Testar posicionamento inteligente

### Médio Prazo (2-4 semanas)
- Análise de pares completos
- Viés dinâmico por mercado
- Otimização de timing de entrada
- Circuit breaker por drawdown

### Longo Prazo (4+ semanas)
- Machine Learning para previsão
- Estratégia multi-par
- Hedge dinâmico
- Observabilidade avançada

## 📊 Comparação: Antes vs Depois

### Antes
```
Spread: 1.5%
Order: R$ 2.40
Custos: ~1.0%
Margem: 0.5%
PnL: -2.15 BRL (negativo)
```

### Depois (Fase 1 + 2)
```
Spread: 2.5% (adaptativo)
Order: R$ 24
Custos: ~1.0%
Margem: 1.5%
PnL esperado: +0.5-1.0 BRL/dia (positivo!)
```

## 🎯 Recomendação Imediata

**IMPLEMENTAR AGORA:**

```bash
# Atualizar .env com novos valores
SPREAD_PCT=0.025
MIN_SPREAD_PCT=0.020
ORDER_SIZE=0.00005
STOP_LOSS_PCT=0.015
TAKE_PROFIT_PCT=0.025

# Reiniciar bot
pkill -f "node bot.js"
sleep 2
nohup node bot.js > bot.log 2>&1 &

# Monitorar por 30 minutos
tail -f bot.log | grep "PnL Total:"
```

Esperado: Melhoria visível em 30 minutos com novo spread/size.
