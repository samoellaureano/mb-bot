# 🎯 Guia de Monitoramento e Otimização para Maior Lucro - MB Bot

## 📊 Monitoramento em Tempo Real

### 1. Indicadores Críticos para Monitorar

**💰 Lucro e Risco:**
```bash
[Bot] PnL Total: 0.09 BRL | ROI: 0.10% | PnL Não Realizado: 0.00 BRL
[Bot] Posição BTC: 0.00000000 | Saldo BRL: 205.33 | Saldo BTC: 0.00003099
```

**📈 Indicadores de Mercado:**
```bash
[Bot] RSI: 22.88 | EMA Curta: 507828.97 | EMA Longa: 508075.67
[Bot] MACD: -247.00 | Volatilidade: 2.31%
```

**🎯 Decisões de Trading:**
```bash
[Bot] Score Lucro Esperado: 0.00 | Confiança: 411.62
[Bot] Spread: 0.418% | Buy Price: 501521.26 | Sell Price: 503620.79
```

### 2. Alertas que Requerem Ação

**⚠️ ALERTA DE PnL BAIXO:**
```bash
[ALERT] PnL baixo: 0.09 BRL (limite: 50). Verifique a estratégia!
```
**Ação:** Ajustar `EXPECTED_PROFIT_THRESHOLD` no .env ou aumentar capital

**⚠️ SALDO INSUFICIENTE:**
```bash
[WARN] Saldo BRL insuficiente (5.33 < 49.85). Ignorando compra.
```
**Ação:** Depositar mais fundos ou reduzir `ORDER_SIZE`

**⚠️ SCORE DE LUCRO BAIXO:**
```bash
[INFO] Score de lucro baixo (0.00 < 0.05). Não colocando ordens.
```
**Ação:** Ajustar parâmetros de spread ou reduzir limite mínimo

## 🔧 Otimizações para Maior Lucro

### 1. Ajustes no Arquivo .env

**Parâmetros Chave para Otimizar:**

```env
# Aumentar agressividade (valores atuais -> sugeridos)
SPREAD_PCT=0.0006 -> 0.0008 (aumentar spread para mais lucro por ordem)
ORDER_SIZE=0.000005 -> 0.00001 (dobrar tamanho da ordem)
EXPECTED_PROFIT_THRESHOLD=0.0005 -> 0.0003 (reduzir para aceitar mais ordens)

# Ajustar limites de segurança
MIN_SPREAD_PCT=0.0004 -> 0.0003 (permitir spreads mais apertados)
MAX_SPREAD_PCT=0.004 -> 0.006 (permitir spreads mais largos em alta volatilidade)
VOL_LIMIT_PCT=1.5 -> 2.0 (aumentar limite de volatilidade aceitável)
```

### 2. Estratégias para Diferentes Condições de Mercado

**📉 MERCADO EM BAIXA (Tendência: down):**
```bash
[Bot] Tendência: down | RSI: < 30 | EMA Curta < EMA Longa
```
**Ações:**
- Reduzir `ORDER_SIZE` para minimizar risco
- Aumentar `SPREAD_PCT` para compensar risco
- Ativar `STOP_LOSS_PCT` mais agressivo (0.006 -> 0.008)
- Considerar operar apenas vendas (sell orders)

**📈 MERCADO EM ALTA (Tendência: up):**
```bash
[Bot] Tendência: up | RSI: > 70 | EMA Curta > EMA Longa
```
**Ações:**
- Aumentar `ORDER_SIZE` para capitalizar tendência
- Reduzir `SPREAD_PCT` para mais competitividade
- Aumentar `TAKE_PROFIT_PCT` (0.0015 -> 0.002)
- Considerar operar apenas compras (buy orders)

**➖ MERCADO LATERAL (Tendência: neutral):**
```bash
[Bot] Tendência: neutral | RSI: 30-70 | EMA Curta ≈ EMA Longa
```
**Ações:**
- Manter `SPREAD_PCT` médio (0.0006)
- Usar `ORDER_SIZE` padrão
- Focar em alta taxa de fill com spreads competitivos
- Monitorar `VOLATILITY_PCT` para breakouts

### 3. Ajustes Dinâmicos Durante Execução

**🔄 Quando o bot mostrar:**
```bash
[SUCCESS] Otimização: Aumentando tamanho para 0.000051, reduzindo spread para 0.086%
```

**Interpretação:**
- O bot está ajustando automaticamente parâmetros
- PnL positivo está sendo gerado
- Confirme se os ajustes estão alinhados com sua estratégia

**📊 Para forçar otimização manual:**
1. Espere 5 ciclos (50 segundos com CYCLE_SEC=10)
2. Verifique se `performanceHistory.length >= PERFORMANCE_WINDOW` (5 ciclos)
3. O bot ajustará automaticamente baseado no PnL médio

## 🎯 Inferências para Maior Lucro

### 1. Análise dos Logs Anteriores

**Problema Identificado:**
```bash
[ERROR] Falha ao colocar ordem SELL: Insufficient balance to carry out the operation.
[WARN] Saldo BRL insuficiente (5.33 < 49.85). Ignorando compra.
```

**Solução:**
- Aumentar saldo inicial para R$500-1000
- Reduzir `ORDER_SIZE` para 0.000003 BTC inicialmente
- Aumentar gradualmente conforme PnL positivo

### 2. Melhoria no Score de Lucro

**Problema:**
```bash
[INFO] Score de lucro baixo (0.00 < 0.05). Não colocando ordens.
```

**Soluções:**
1. **Ajustar fórmula de cálculo** (em bot.js):
   ```javascript
   // Linha ~875: Ajustar peso dos componentes
   const expectedProfit = spreadBase * volMultiplier * trendBonus * 1.5; // Adicionar multiplicador
   ```

2. **Reduzir limite mínimo** (no .env):
   ```env
   EXPECTED_PROFIT_THRESHOLD=0.0005 -> 0.0002
   ```

3. **Aumentar volatilidade aceitável**:
   ```env
   MIN_VOLATILITY_PCT=0.1 -> 0.05
   MAX_VOLATILITY_PCT=2.5 -> 3.0
   ```

### 3. Otimização de Spread Dinâmico

**Estratégia Agressiva para Maior Lucro:**
```javascript
// Em bot.js ~linha 1250: Ajustar cálculo de spread dinâmico
const dynamicSpreadPct = Math.max(
  MIN_SPREAD_PCT,
  SPREAD_PCT * (1 + volatilityPct / 5) // Mais agressivo: /5 ao invés de /10
);

// Adicionar bonus por tendência forte
if (pred.confidence > 0.8 && pred.trend !== 'neutral') {
  dynamicSpreadPct *= 1.1; // 10% maior spread em tendências fortes
}
```

### 4. Gestão de Inventário Avançada

**Para maximizar lucro com inventário:**
```javascript
// Ajustar função getInventoryBias em bot.js
function getInventoryBias(mid) {
  const currentBaseValue = mid * btcPosition;
  const currentQuoteValue = totalPnL;
  const totalValue = currentBaseValue + currentQuoteValue;

  // Estratégia mais agressiva de hedge
  const imbalance = totalValue > 0 ? (currentBaseValue - currentQuoteValue) / totalValue : 0;
  const bias = Math.abs(imbalance) > (INVENTORY_THRESHOLD * 0.8)  // 80% do limite
    ? -imbalance * (BIAS_FACTOR * 1.5) // 50% mais agressivo
    : 0;

  return bias;
}
```

## 📈 Estratégia Recomendada para Maior Lucro

### Fase 1: Configuração Inicial (Primeiros 30 minutos)
```env
# Configuração conservadora para teste
SIMULATE=false
SPREAD_PCT=0.0008
ORDER_SIZE=0.000003
EXPECTED_PROFIT_THRESHOLD=0.0002
CYCLE_SEC=10
```

### Fase 2: Ajuste Baseado em Desempenho (Após 30min)
**Se PnL > 0 e Fill Rate > 5%:**
```env
# Aumentar agressividade
ORDER_SIZE=0.000005
SPREAD_PCT=0.0009
EXPECTED_PROFIT_THRESHOLD=0.0003
```

**Se PnL < 0 ou Fill Rate < 2%:**
```env
# Reduzir risco
ORDER_SIZE=0.000002
SPREAD_PCT=0.0007
EXPECTED_PROFIT_THRESHOLD=0.0001
```

### Fase 3: Operação Otimizada (Após 1 hora)
**Com PnL consistente:**
```env
# Maximizar lucro
ORDER_SIZE=0.000008
SPREAD_PCT=0.0010
MAX_ORDER_SIZE=0.0008
PRICE_DRIFT_PCT=0.0005
```

## 📊 Monitoramento Avançado

**Comandos para monitorar em tempo real:**

1. **Monitorar logs do bot:**
```bash
tail -f bot.log | grep -E "(PnL|ROI|Score Lucro|Spread|Tendência)"
```

2. **Ver estatísticas a cada 1 minuto:**
```bash
watch -n 60 "npm run stats"
```

3. **Monitorar ordens ativas:**
```bash
tail -f bot.log | grep -E "(Ordem.*colocada|Fill.*@|Cancelando ordem)"
```

4. **Verificar alertas críticos:**
```bash
tail -f bot.log | grep -E "(ALERT|ERROR|WARN.*Saldo|WARN.*volatilidade)"
```

## 🎯 Checklist para Maior Lucro

- [ ] ✅ Aumentar capital inicial para R$500+
- [ ] ✅ Reduzir `EXPECTED_PROFIT_THRESHOLD` para 0.0002-0.0003
- [ ] ✅ Aumentar `SPREAD_PCT` gradualmente de 0.0006 para 0.0008-0.0010
- [ ] ✅ Dobrar `ORDER_SIZE` conforme PnL positivo
- [ ] ✅ Monitorar `Fill Rate` e ajustar spread competitivamente
- [ ] ✅ Aproveitar tendências fortes com posições maiores
- [ ] ✅ Reduzir operações em mercado lateral
- [ ] ✅ Ajustar `CYCLE_SEC` para 5-7 segundos em alta volatilidade
- [ ] ✅ Monitorar `ROI` e reinvestir lucros automaticamente
- [ ] ✅ Usar dashboard para análise visual de padrões

## ⚠️ Advertências Importantes

1. **Nunca exceda seu limite de risco**:
   - Mantenha `DAILY_LOSS_LIMIT` configurado
   - Monitore `EMERGENCY_STOP_PNL`

2. **Teste antes de aumentar agressividade**:
   - Sempre teste ajustes em simulação primeiro
   - Aumente parâmetros gradualmente

3. **Monitore liquidez**:
   - Verifique `Depth Factor` nos logs
   - Se < 5, reduza tamanho das ordens

4. **Acompanhe notícias de mercado**:
   - Eventos macroeconômicos afetam volatilidade
   - Ajuste parâmetros antes de grandes anúncios

Com estas otimizações, você pode aumentar significativamente o lucro do MB Bot enquanto mantém um perfil de risco controlado. O segredo é o monitoramento constante e ajustes baseados em dados reais de execução!