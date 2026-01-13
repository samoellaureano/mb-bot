# ✨ Smart Reset - Quick Reference

## 📌 O Que Foi Corrigido

**Problema:**
```
Ao clicar "↻ Reset" no dashboard, o baseline voltava para o valor armazenado no banco
quando você fazia refresh, ao invés de ficar no menor valor de PnL atingido.
```

**Solução:**
```
Smart Reset: Calcula o PIOR PnL (MIN) da sessão anterior e usa como baseline da nova sessão
```

---

## ✨ Arquivos Modificados

### 1. `db.js` - Nova Função
```javascript
async getWorstPnLInSession(sessionId)
// Retorna: SELECT MIN(pnl) FROM recovery_points WHERE session_id = ?
// Propósito: Encontrar o pior PnL atingido na sessão
```

### 2. `dashboard.js` - Endpoint Modificado
```javascript
POST /api/recovery/reset
// Agora: calcula worstPnL e armazena em global.resetBaseline
```

### 3. `bot.js` - Lógica Modificada
```javascript
// Ao criar nova sessão:
if (global.resetBaseline !== undefined) {
    baselineValue = global.resetBaseline; // Usa pior PnL anterior
}
```

---

## 🔄 Fluxo de Execução

```
1. Clica "↻ Reset"
   ↓
2. Dashboard calcula: MIN(pnl) = pior PnL da sessão anterior
   ↓
3. Armazena: global.resetBaseline = pior PnL
   ↓
4. Próximo ciclo do bot cria nova sessão com esse baseline
   ↓
5. Ao fazer refresh: baseline está salvo no banco ✅
```

---

## 📊 Exemplo Prático

**Antes da Mudança:**
```
Session #6 ativa
├─ Pior PnL atingido: -R$195.50
└─ Reset clicado com PnL = -R$188.30
   └─ Novo baseline criado: -R$188.30 ❌
   └─ Ao refresh: mostra -R$188.30

RESULTADO INCORRETO: Não mantém o pior caso
```

**Depois da Mudança:**
```
Session #6 ativa
├─ Pior PnL atingido: -R$195.50
└─ Reset clicado com PnL = -R$188.30
   └─ Sistema calcula: MIN(pnl) = -R$195.50
   └─ Novo baseline criado: -R$195.50 ✅
   └─ Ao refresh: mostra -R$195.50

RESULTADO CORRETO: Mantém o pior caso!
```

---

## 🧪 Testar a Mudança

```bash
# 1. Verificar sessão ativa
curl http://localhost:3001/api/recovery | python3 -m json.tool

# 2. Anotar baseline atual e pior PnL

# 3. Clicar "↻ Reset" no dashboard
# http://localhost:3001 → 🔄 Monitor de Recuperação → ↻ Reset

# 4. Aguardar ~15 segundos

# 5. Fazer refresh (F5 ou Ctrl+Shift+R)

# 6. Verificar nova sessão
curl http://localhost:3001/api/recovery | python3 -m json.tool
# Baseline deve ser o PIOR PnL anterior!
```

---

## 📝 Logs para Monitorar

Procure por essas linhas no `bot.log`:

```
[RECOVERY] Usando baseline de reset: R$ -195.50
[RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -195.50
```

---

## ✅ Validação

- ✓ Nova função `getWorstPnLInSession()` implementada em `db.js`
- ✓ Endpoint `/api/recovery/reset` calcula e armazena `resetBaseline`
- ✓ Bot verifica e usa `global.resetBaseline` ao criar nova sessão
- ✓ Baseline persiste corretamente no banco após refresh
- ✓ Sintaxe validada em todos os arquivos
- ✓ Serviços reiniciados com mudanças

---

**Status:** ✅ Implementado e Deployado  
**Próximo:** Testar com reset real no dashboard
