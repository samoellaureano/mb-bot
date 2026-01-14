# 🚨 DIAGNÓSTICO DE URGÊNCIA - Bugs Críticos do Bot

**Data:** 13/01/2026 01:50  
**Status:** ⚠️ BOT PARADO (para evitar perdas)  
**Tempo em Operação:** ~4 minutos  
**Ciclos Executados:** 6  

---

## 📊 Resumo Executivo

| Métrica | Valor | Status |
|---------|-------|--------|
| Ordens Colocadas | 6 | ⚠️ |
| Ordens Executadas | 0 | ❌ CRÍTICO |
| Taxa de Fill | 0.0% | ❌ CRÍTICO |
| PnL Total | 0.00 BRL | ⚠️ |
| Tendência Interna | DOWN (42-48% confiança) | ⚠️ FRACA |
| Tendência Externa | BULLISH (100% confiança) | ✅ FORTE |
| **Alinhamento** | **CONFLITO TOTAL** | ❌ CRÍTICO |

---

## 🔴 BUG #1: Desalinhamento de Tendências Ignorado

### Problema
O bot coloca **BUY orders** mesmo prevendo tendência **DOWN**, e ignora a análise externa que indica **BULLISH**.

### Evidência nos Logs
```
[Bot] Tendência Externa: BULLISH (Score: 67/100, Confiança: 100%)
[Bot] ⚠️ Alinhamento: Bot=DOWN vs Externo=BULLISH
[Bot] [DECISION] ✅ PERMITIDO | Ação: BUY_SIGNAL | Confiança: 100.0%
```

### Impacto
- Sistema ignora sinais externos fortes
- Decisões contraditórias (DOWN → BUY não faz sentido)
- Sem validação de consenso entre fontes

### Localização do Código
[bot.js](bot.js#L1165) - Função `validateTradingDecision()`

---

## 🔴 BUG #2: Confiança 100% com Convicção 42%

### Problema
O sistema de decisão retorna "100% PERMITIDO" mesmo com convicção muito baixa (42.5-48.8%).

### Evidência nos Logs
```
Ciclo 1:
[Bot] Convicção calculada: 48.7% | Tendência Convicção: DOWN | Força: VERY_WEAK 
[Bot] [DECISION] ✅ PERMITIDO | Ação: BUY_SIGNAL | Confiança: 100.0%

Ciclo 3:
[Bot] Convicção calculada: 48.8% | Tendência Convicção: DOWN | Força: VERY_WEAK
[Bot] [DECISION] ✅ PERMITIDO | Ação: BUY_SIGNAL | Confiança: 100.0%
```

### Análise
```
Convicção < 0.5 = "Operando em modo conservador"
Mas depois: "PERMITIDO com 100% de confiança"
❌ Contradição lógica
```

### Localização do Código
[bot.js](bot.js#L1050) - Linhas 1050-1056

---

## 🔴 BUG #3: Ordens Colocadas Abaixo do Mercado

### Problema
Todas as 6 ordens foram colocadas **~3500 BRL abaixo** do preço de mercado:

```
Ciclo 1: Mid=511518.50, Buy Order=507682.11 (diff: -3836.39)
Ciclo 3: Mid=511546.00, Buy Order=507709.40 (diff: -3836.60)
Ciclo 4: Mid=511399.50, Buy Order=507564.00 (diff: -3835.50)
Ciclo 5: Mid=511265.00, Buy Order=507430.51 (diff: -3834.49)
```

### Root Cause
Viés de tendência DOWN sendo aplicado **duplamente**:

1. **Cálculo de totalBias:**
```javascript
const trendBias = pred.trend === 'down' ? -trendFactor : 0;
// trendBias = -0.0015
```

2. **Aplicação no preço:**
```javascript
const refPrice = mid * (1 + totalBias);  // Reduz o preço!
const buyPrice = refPrice * (1 - spreadPct/2);  // Reduz NOVAMENTE!
```

### Efeito Cascata
```
Mid: 511.518
refPrice: 511.518 * (1 - 0.0015) = 511.751  ← 1ª redução
buyPrice: 511.751 * (1 - 0.015/2) = 510.975  ← 2ª redução
Observado: 507.682 ← Ainda não explica a diferença!
```

**Há mais um fator desconhecido reduzindo o preço!**

### Localização do Código
[bot.js](bot.js#L1030-L1070)
- Linha 1035: `const refPrice = mid * (1 + totalBias);`
- Linha 1057: `let buyPrice = Math.min(..., bestBid);`

---

## 🔴 BUG #4: 0% Taxa de Execução

### Problema
Após 6 ciclos com 6 ordens colocadas:
- **0 ordens executadas**
- **0 BTC comprados**
- **0 BRL lucrados**

### Causa
As ordens estão **fora do orderbook** porque o preço está muito abaixo do mercado.

**Ordem de Compra a 507.682 BRL quando o melhor bid é 511.229 BRL:**
```
orderbook.bids = 511229.00  ← Melhor preço de compra disponível
bot.buyPrice = 507682.11    ← Muito abaixo!
❌ Ninguém vai vender para o bot a 507.682 BRL quando pode obter 511.229 BRL
```

---

## 🔴 BUG #5: Padrão de Cancelamento de Ordens

### Problema
Todas as ordens são canceladas após ~30 segundos com "Take-profit acionado".

### Evidência
```
Ciclo 1: Ordem colocada @ 507682.11
Ciclo 3 (30s depois): "Cancelando ordem BUY ... Take-profit acionado"
Ciclo 3 (mesmo ciclo): Nova ordem colocada @ 507709.90
```

### Questão
Por que uma ordem **que nunca foi executada** tem "take-profit acionado"?

### Suspeita
A lógica de take-profit pode estar incorreta, ou há um mal-entendimento do que significa "take-profit".

---

## 📋 Tarefas de Correção

### Prioridade 1: CRÍTICO (Fazer AGORA)

- [ ] **Revisar `validateTradingDecision()`**
  - Por que retorna 100% com convicção 42%?
  - Como sincronizar com análises externas?
  - [bot.js linha 1165](bot.js#L1165)

- [ ] **Revisar cálculo de preços**
  - Por que aplicar trendBias negativamente duas vezes?
  - Qual fator está faltando que reduz mais 3500 BRL?
  - [bot.js linha 1030-1070](bot.js#L1030-L1070)

- [ ] **Investigar take-profit**
  - Por que é acionado em ordens não executadas?
  - [bot.js função `checkOrders()`](bot.js) (buscar localização exata)

### Prioridade 2: ALTO (Fazer antes de retomar)

- [ ] Adicionar validação de preço (ordens não devem estar >1% abaixo do mercado)
- [ ] Sincronizar tendências internas com análises externas
- [ ] Adicionar log de debug para cada cálculo de preço
- [ ] Testar em simulação por 24h antes de retomar live

### Prioridade 3: MÉDIO (Melhorias)

- [ ] Aumentar confiança necessária para operar (>0.5, não <0.5)
- [ ] Adicionar filtro de alinhamento de tendências
- [ ] Revisar spread dinâmico em tendências fracas

---

## ✅ Próximos Passos Recomendados

1. **NÃO RETOMAR EM LIVE** até corrigir os bugs
2. Executar análise de código nas 3 funções principais
3. Adicionar testes de preço (validar que buy < mid < sell)
4. Retomar em SIMULAÇÃO para validar correções
5. Executar backtesting com os últimos 30 dias de dados
6. Monitorar por 24h em simulação antes de retomar live

---

## 📞 Status Final

**Bot Status:** ⚠️ PARADO (01:50)  
**Motivo:** Múltiplos bugs críticos detectados  
**Risco:** ALTO (ordens não executáveis)  
**Recomendação:** ❌ **NÃO RETOMAR ATÉ CORREÇÃO**

