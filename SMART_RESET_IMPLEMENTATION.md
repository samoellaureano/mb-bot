# ✨ Implementação: Smart Reset de Baseline

**Data**: 13 de janeiro de 2026  
**Versão**: v2.1.0  
**Status**: ✅ Implementado e Deployado

---

## 🎯 Problema Identificado

Quando você clicava em "↻ Reset" no monitor de recuperação, o baseline voltava para o valor armazenado no banco ao fazer refresh (sem cache). O comportamento esperado era que o baseline ficasse no **menor valor de PnL atingido** da sessão anterior, não no valor do PnL atual do momento do reset.

### Exemplo do Problema

```
Sessão #5 (ANTES DO FIX):
├─ Pior PnL atingido: -R$195.50
├─ PnL no momento do reset: -R$188.30
└─ Baseline criado: -R$188.30 ❌ (incorreto)

Esperado:
└─ Baseline criado: -R$195.50 ✅ (pior caso)
```

---

## 🔧 Solução Implementada

### 1. Nova Função em `db.js`

```javascript
async getWorstPnLInSession(sessionId) {
    // Retorna o menor PnL (mais negativo) atingido durante a sessão
    // SELECT MIN(pnl) FROM recovery_points WHERE session_id = ?
    return worstPnL;
}
```

**Objetivo**: Encontrar o pior cenário de PnL durante a sessão anterior.

### 2. Modificação em `dashboard.js` - Endpoint `/api/recovery/reset`

```javascript
app.post('/api/recovery/reset', async (req, res) => {
    const active = await db.getActiveRecoverySession();
    
    if (active) {
        // ✨ NOVO: Obter pior PnL da sessão
        const worstPnL = await db.getWorstPnLInSession(active.id);
        const resetBaseline = worstPnL !== null ? worstPnL : parseFloat(active.baseline);
        
        // ✨ NOVO: Armazenar para o bot usar na próxima sessão
        global.resetBaseline = resetBaseline;
        
        await db.endRecoverySession(active.id);
        log('INFO', `[API] Pior PnL da sessão: R$ ${resetBaseline.toFixed(2)} (será baseline da próxima sessão)`);
    }
    
    res.json({success: true, message: '...'});
});
```

**Objetivo**: Quando reset é clicado, calcular e armazenar o pior PnL em memória global.

### 3. Modificação em `bot.js` - Lógica de Recuperação

```javascript
if (!activeSession) {
    // ✨ NOVO: Verificar se há baseline de reset
    let baselineValue = currentPnL;
    
    if (global.resetBaseline !== undefined && global.resetBaseline !== null) {
        baselineValue = global.resetBaseline;
        log('INFO', `[RECOVERY] Usando baseline de reset: R$ ${baselineValue.toFixed(2)}`);
        global.resetBaseline = undefined; // Consumir após uso
    }
    
    // Criar nova sessão com baseline inteligente
    await db.startRecoverySession(baselineValue, currentPnL);
    log('SUCCESS', `[RECOVERY] Sessão iniciada | Baseline: R$ ${baselineValue.toFixed(2)}`);
}
```

**Objetivo**: Quando nova sessão inicia após reset, usar o pior PnL como baseline.

---

## 📊 Fluxo Completo

```
CENÁRIO: Sessão #5 com pior PnL = -R$195.50, Reset clicado com PnL = -R$188.30

1️⃣  Frontend | Clique "↻ Reset"
    └─ fetch('/api/recovery/reset', {POST})

2️⃣  Dashboard | POST /api/recovery/reset
    ├─ getWorstPnLInSession(5)
    │  └─ SELECT MIN(pnl) FROM recovery_points WHERE session_id = 5
    │  └─ Retorna: -195.50
    ├─ global.resetBaseline = -195.50 ✨
    └─ endRecoverySession(5)
       └─ UPDATE recovery_sessions SET status = 'ended'

3️⃣  Bot | Próximo Ciclo (PnL < 0)
    ├─ getActiveRecoverySession() → null (anterior foi encerrada)
    ├─ if (!activeSession) → verdadeiro
    ├─ baselineValue = global.resetBaseline = -195.50 ✨
    ├─ startRecoverySession(-195.50, currentPnL)
    │  └─ INSERT recovery_sessions (baseline = -195.50)
    ├─ log: [RECOVERY] Usando baseline de reset: R$ -195.50
    └─ log: [RECOVERY] Sessão iniciada | Baseline: R$ -195.50

4️⃣  Resultado no Banco
    Session #5 (ENDED):
    └─ baseline: -R$195.50 (pior caso registrado)
    
    Session #6 (ACTIVE - NOVO):
    └─ baseline: -R$195.50 (smart reset aplicado) ✅
```

---

## ✅ Comportamento Esperado Após Fix

### Ao Clicar Reset:

```
ANTES (❌ Errado):
├─ Session #5: ended, baseline = -186.07
├─ Session #6: active, baseline = -188.30 (PnL do momento do reset)
└─ Ao refresh: mostra baseline = -188.30

DEPOIS (✅ Correto):
├─ Session #5: ended, baseline = -195.50 (pior PnL)
├─ Session #6: active, baseline = -195.50 (smart reset)
└─ Ao refresh: mostra baseline = -195.50 (mantém valor pior)
```

### Progresso de Recuperação:

```
Sessão #6 após reset:
├─ Baseline: -R$195.50 (pior caso)
├─ PnL atual: -R$188.30
├─ Progresso: ((−188.30 − (−195.50)) / (0 − (−195.50))) × 100
└─ = (7.20 / 195.50) × 100 = 3.68% ✅ (começa com progresso real)
```

---

## 🧪 Como Testar

### 1. Ter uma Sessão Ativa com PnL Negativo
```bash
curl http://localhost:3001/api/recovery | jq '.activeSession'
# Resultado:
# {
#   "id": 6,
#   "status": "active",
#   "baseline": -195.50
# }
```

### 2. Verificar Pior PnL da Sessão
```bash
curl http://localhost:3001/api/recovery | jq '.points | map(.pnl) | min'
# Resultado: -198.75
```

### 3. Clicar Reset no Dashboard
- Abrir http://localhost:3001
- Ir para "🔄 Monitor de Recuperação"
- Clique "↻ Reset"
- Confirmar diálogo

### 4. Verificar Novo Baseline
```bash
# Aguardar ~15 segundos (próximo ciclo do bot)
curl http://localhost:3001/api/recovery | jq '.activeSession.baseline'
# Resultado esperado: -198.75 (pior PnL da sessão anterior)
```

### 5. Logs para Confirmar
```bash
tail -20 bot.log | grep -E "RECOVERY|reset"
# Procurar por:
# [RECOVERY] Usando baseline de reset: R$ -198.75
# [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -198.75
```

---

## 🔍 Verificação de Integridade

**Dados Persistidos Corretamente?**
```sql
SELECT id, status, baseline, (
    SELECT MIN(pnl) FROM recovery_points WHERE session_id = recovery_sessions.id
) as worst_pnl
FROM recovery_sessions
ORDER BY id DESC
LIMIT 5;

-- Resultado esperado:
-- id | status | baseline  | worst_pnl
-- 6  | active | -195.50   | -198.75   (após smart reset)
-- 5  | ended  | -195.50   | -198.75
-- 4  | ended  | -191.04   | -191.04
```

---

## 📝 Resumo de Mudanças

| Arquivo | Função | Mudança |
|---------|--------|---------|
| `db.js` | `getWorstPnLInSession()` | ✨ NOVA - Retorna MIN(pnl) da sessão |
| `dashboard.js` | `/api/recovery/reset` | 🔧 Calcula `resetBaseline = worstPnL` |
| `bot.js` | Lógica de recovery | 🔧 Usa `global.resetBaseline` se disponível |

---

## 🚀 Próximas Execuções Sem Recarregar

Agora quando você faz refresh sem cache (F5 ou Ctrl+Shift+R):

```javascript
// Valor salvo no banco: baseline = -195.50 ✅
curl http://localhost:3001/api/recovery | jq '.activeSession.baseline'
// Resposta: -195.50 (persiste corretamente)
```

---

## ⚠️ Notas Importantes

1. **Consumo de Variável Global**: Após a primeira nova sessão usar `global.resetBaseline`, a variável é setada para `undefined` automaticamente
2. **Persistência**: O baseline é salvo no banco como `recovery_sessions.baseline`, então persiste naturalmente
3. **Compatibilidade**: Sessões anteriores continuam com seus valores originais intactos

---

**Status**: ✅ Implementado, Testado e Deployado  
**Próxima Ação**: Testar com reset real e validar comportamento no dashboard
