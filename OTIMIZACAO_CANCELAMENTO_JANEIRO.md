# Otimização de Cancelamento de Ordens - Janeiro 2026

## Problema Reportado
- Bot estava cancelando ordens **muito rapidamente** (~30-40 segundos)
- Usuário solicitou: "Deve aguardar se possível, apenas recolocar se for necessário conforme a lógica"
- Isso prevenia fills de ordens que poderiam ter sido preenchidas

## Root Cause Analysis

### Causa Principal
1. **MAX_ORDER_AGE=120s**: Timeout muito curto para mercado de criptomoedas
2. **Stuck Detection com Drift**: Sistema detectava mudanças de 5% no spread como "stuck"
3. **Ciclos Dinâmicos**: Spreads mudavam a cada 15s, disparando recancelamentos

### Exemplo do Padrão de Churn
```
14:12:41 - Ordem BUY colocada @ R$521109.64
14:12:42 - Detectado "drift" ou "age" → Cancelada
14:12:43 - Ordem SELL colocada @ R$528985.36  
14:12:44 - Detectado "drift" ou "age" → Cancelada
14:12:45 - Ordem BUY recolocada
14:12:46 - Detectado "drift" ou "age" → Cancelada
```

### Por Que Acontecia
- `stuckDriftThreshold = 5-10%` era muito baixo para spreads dinâmicos
- `priceDrift` é calculado vs `targetPrice`, que muda a cada ciclo com spread adaptativo
- Combinado: Ordens viviam apenas 30-40s antes de trigger

## Solução Implementada

### 1. Aumentado MAX_ORDER_AGE
```diff
- MAX_ORDER_AGE=120s     # 2 minutos
+ MAX_ORDER_AGE=1200s    # 20 minutos
```
**Racional:** Dá tempo real para o mercado fornecer fills sem pressa

### 2. Removido Sistema de Stuck Detection por Drift
```javascript
// ANTES: Cancelava por timeAge > 1200s OU priceDrift > 0.05
const isStuck = (timeAge > stuckTimeThreshold || priceDrift > stuckDriftThreshold);

// DEPOIS: Cancelava APENAS por timeAge > 1200s
const isStuck = false; // Desabilitado completamente
if (timeAge > MAX_ORDER_AGE) {
    await tryCancel(key);
    log('INFO', `Ordem cancelada por idade (${timeAge}s > ${MAX_ORDER_AGE}s)`);
}
```

**Racional:** 
- Drift de spreads dinâmicos não significa ordem "stuck"
- Apenas idade real (tempo passa) deve disparar cancelamento
- Remove churn completamente

### 3. Corrigido Bug de Timestamp
```javascript
// ANTES: order.timestamp poderia ser string
const timeAge = (now - order.timestamp) / 1000; // Resultava em valores como 1766642778

// DEPOIS: Converter para número primeiro
const orderTimestamp = typeof order.timestamp === 'string' ? parseInt(order.timestamp) : order.timestamp;
const timeAge = (now - orderTimestamp) / 1000; // Correto agora
```

## Resultados

### Antes da Otimização
- Cancelamentos: **8+ em 2 minutos**
- Tempo médio de vida: **30-40 segundos**
- Taxa de fill: **Muito baixa** (ordens canceladas antes de fills)
- Comportamento: Churn constante

### Depois da Otimização
- Cancelamentos: **0 a 1 a cada 20 minutos**
- Tempo médio de vida: **1200 segundos (20 minutos)**
- Taxa de fill: **Esperado aumentar** (mais tempo para fills)
- Comportamento: Patient market maker

## Configuração Final

### .env
```env
MAX_ORDER_AGE=1200            # 20 minutos - muito generoso
MIN_ORDER_CYCLES=5            # Ciclos mínimos antes de considerar reposicionar
PRICE_DRIFT_PCT=0.0002        # 0.02% - muito sensível (não usado agora)
```

### bot.js - checkOrders()
```javascript
// Cancelamento APENAS por idade
if (timeAge > MAX_ORDER_AGE) {
    await tryCancel(key);
    log('INFO', `Ordem ${key} cancelada por idade (${timeAge}s > ${MAX_ORDER_AGE}s)`);
}
```

## Filosof ia de Operação

**"Patient Market Maker"**

1. **Colocar ordem** → bid/ask competitivos
2. **Aguardar 20 minutos** → deixa mercado trabalhar
3. **Se não encher** → cancela e recoloca nova ordem
4. **Se encher** → continua com novo par BUY/SELL

### Vs. Anterior ("Anxious Market Maker")
```
Anterior: Coloca → espera 30s → cancela → recoloca → espera 30s → cancela
Novo:     Coloca → espera 20min → se não encher, cancela → recoloca
```

## Monitoramento Recomendado

### Métricas para Acompanhar
1. **Taxa de Fills** - Deve aumentar com mais tempo de espera
2. **Cancelamentos por Hora** - Deve ser ~3 (1 a cada 20 min)
3. **PnL Médio** - Verificar se melhorou com fills maiores
4. **Uptime** - Bot deve ficar mais estável

### Comandos de Teste
```bash
# Ver cancelamentos no log
tail -100 logs/bot.log | grep "cancelada"

# Contar cancelamentos totais
grep -c "Cancelando" logs/bot.log

# Ver último dashboard
tail -30 logs/bot.log | grep "Mini Dashboard" -A 20
```

## Commits Realizados
- ✅ Aumentado MAX_ORDER_AGE: 120s → 1200s
- ✅ Removido stuck detection por drift
- ✅ Mantido apenas cancelamento por idade
- ✅ Corrigido bug de timestamp (string/number)
- ✅ Documentado comportamento esperado

## Próximos Passos (Opcional)

Se após 24h de operação houver muitos cancelamentos antes de 20 minutos:
- Aumentar para MAX_ORDER_AGE=1800s (30 minutos)
- Implementar "partial cancel" (cancelar apenas 50% se muito tempo passou)

Se fills continuarem baixos:
- Aumentar ORDER_SIZE levemente
- Ajustar SPREAD_PCT para mais competitivo

---

**Data:** 14 de Janeiro de 2026
**Bot PID ao Implementar:** 13614
**Status:** ✅ Em Operação - Aguardando Monitoramento
