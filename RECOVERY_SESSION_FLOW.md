# 📊 Fluxo de Sessões de Recuperação - MB Bot

## Overview

O sistema de recuperação rastreia períodos de PnL negativo e monitora o progresso de recuperação até o break-even. O baseline é dinâmico e ajusta-se conforme a situação do mercado e decisões do operador.

---

## 1. Ciclo Normal do Bot com PnL Negativo

### Condição: `PnL < 0` (perda ativa)

```
BOT | Ciclo N
  ├─ Calcula: totalBalance = BRL_balance + (BTC_balance × mid_price)
  ├─ Calcula: portfolioPnL = totalBalance - INITIAL_CAPITAL (R$220.00)
  │
  ├─ SE SEM SESSÃO ATIVA:
  │  └─ db.startRecoverySession(currentPnL, currentPnL)
  │     └─ ✅ Nova sessão iniciada
  │     └─ Baseline = currentPnL (ex: -R$186.07)
  │     └─ [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -186.07
  │
  └─ SE COM SESSÃO ATIVA:
     │
     ├─ SE currentPnL < baseline (piora):
     │  └─ db.updateRecoveryBaseline(sessionId, currentPnL)
     │     └─ ⚠️ BASELINE ALTERADO no banco de dados
     │     └─ Baseline: R$ -186.07 → R$ -191.05
     │     └─ [RECOVERY] Baseline atualizado: R$ -186.07 → R$ -191.05
     │
     └─ SEMPRE: db.appendRecoveryPoint(...)
        └─ Registra ponto de progresso
        └─ Calcula: percentage = ((currentPnL - baseline) / (0 - baseline)) × 100
        └─ [RECOVERY] Ponto registrado: PnL=R$ -188.50, Progresso=1.6%, Baseline=R$ -191.05
```

### Exemplo Temporal:

```
Hora    | PnL      | Baseline | Ação                           | DB
--------|----------|----------|--------------------------------------
10:00   | -186.07  | -186.07  | ✅ Sessão criada              | INSERT recovery_sessions
10:15   | -187.50  | -186.07  | 📝 Ponto registrado            | INSERT recovery_points
10:30   | -185.00  | -186.07  | 📈 Recuperação 0.6%            | INSERT recovery_points
10:45   | -191.05  | -186.07  | ⚠️ Piora → baseline atualizado | UPDATE recovery_sessions
11:00   | -190.00  | -191.05  | 📝 Ponto com novo baseline     | INSERT recovery_points (1.0%)
```

---

## 2. Reset Manual via Dashboard

### Ação: Clique em "↻ Reset"

```
Frontend | Dashboard Browser
  ├─ Confirmação: "⚠️ Confirma reset da sessão?"
  ├─ fetch('/api/recovery/reset', {POST})
  │
Backend  | dashboard.js
  ├─ Recupera: activeSession = await db.getActiveRecoverySession()
  ├─ IF activeSession:
  │  └─ db.endRecoverySession(activeSession.id)
  │     └─ UPDATE recovery_sessions SET status = 'ended', ended_at = NOW
  │     └─ ✅ Sessão encerrada
  │     └─ [API] Sessão de recuperação #3 encerrada manualmente via reset
  │
  └─ Resposta: { success: true, message: "..." }
     └─ Frontend: "↻ Reset" → "Resetando..." → location.reload()

Bot | Próximo Ciclo (N+1)
  ├─ getActiveRecoverySession() → null (anterior foi 'ended')
  ├─ currentPnL < 0 → Cria nova sessão
  └─ db.startRecoverySession(currentPnL, currentPnL)
     └─ ✅ NOVA SESSÃO criada com novo baseline = PnL atual
     └─ Exemplo: Sessão #4, Baseline = -R$188.30
```

### Timeline do Reset:

```
Antes do Reset:
  Sessão #3 (ACTIVE): Baseline -R$186.07, Pontos: 45

↓ RESET CLICADO

Imediatamente:
  Sessão #3: status = 'ended' (UPDATE no banco)

↓ Próximo ciclo do bot (em ~15 segundos)

Depois do Reset:
  Sessão #3 (ENDED): Baseline -R$186.07, Pontos: 45
  Sessão #4 (ACTIVE): Baseline -R$188.30, Pontos: 0
```

---

## 3. Encerramento de Sessão (Break-Even)

### Condição: `PnL ≥ 0` (recovery completa)

```
BOT | Ciclo N
  ├─ Calcula: portfolioPnL = 0 ou positivo
  ├─ getActiveRecoverySession() → Existe
  │
  └─ IF currentPnL >= 0:
     ├─ db.endRecoverySession(sessionId)
     │  └─ UPDATE recovery_sessions SET status = 'ended', ended_at = NOW
     └─ [RECOVERY] Sessão de recuperação encerrada | PnL Final: R$ 12.50
```

---

## 4. Estados de Sessão no Banco

### recovery_sessions.status

| Status | Significado | Ação do Bot | Pode Resetar? |
|--------|-----------|-----------|---------------|
| `active` | Sessão em andamento | Continua rastreando | ✅ Sim |
| `ended` | Recuperação completa ou encerrada | Ignora, cria nova se PnL < 0 | ✅ Sim (cria nova) |

### recovery_points

```sql
SELECT 
  id, 
  session_id, 
  timestamp, 
  pnl, 
  percentage, 
  baseline 
FROM recovery_points 
WHERE session_id = 3
ORDER BY timestamp ASC;

-- Resultado típico:
1  | 3 | 1705081200 | -186.07 | 0.00  | -186.07
2  | 3 | 1705081215 | -187.50 | -0.82 | -186.07
3  | 3 | 1705081230 | -185.00 | 0.57  | -186.07
4  | 3 | 1705081245 | -191.05 | ??    | -186.07  ⚠️ Baseline foi atualizado!
5  | 3 | 1705081260 | -190.00 | 1.00  | -191.05  ← Novo baseline
```

---

## 5. Dashboard: Visualização de Recuperação

### `/api/recovery` Endpoint

```json
{
  "activeSession": {
    "id": 3,
    "baseline": -191.05,
    "initial_pnl": -186.07,
    "status": "active",
    "started_at": 1705081200,
    "ended_at": null
  },
  "points": [
    { "pnl": -186.07, "percentage": 0.0, "baseline": -186.07, "timestamp": 1705081200 },
    { "pnl": -187.50, "percentage": -0.82, "baseline": -186.07, "timestamp": 1705081215 },
    { "pnl": -185.00, "percentage": 0.57, "baseline": -186.07, "timestamp": 1705081230 },
    { "pnl": -191.05, "percentage": 999.99, "baseline": -186.07, "timestamp": 1705081245 },
    { "pnl": -190.00, "percentage": 1.00, "baseline": -191.05, "timestamp": 1705081260 }
  ],
  "sessions": [
    { "id": 1, "status": "ended", "baseline": -100.00 },
    { "id": 2, "status": "ended", "baseline": -95.00 },
    { "id": 3, "status": "active", "baseline": -191.05 }
  ]
}
```

### Frontend: Monitor de Recuperação

```html
<div id="recoveryMonitor">
  <h3>🔄 Monitor de Recuperação</h3>
  <p>Sessão #3 | Baseline: R$ -191.05</p>
  <div class="progress-bar">
    <div class="progress-fill" style="width: 1%;">1.0%</div>
  </div>
  <button id="resetBaselineBtn">↻ Reset</button>
</div>
```

---

## 6. Comportamento Resume

### ✅ Baseline Altera no Banco

1. **Durante sessão ativa - Piora (PnL mais negativo):**
   - `bot.js`: `if (currentPnL < baseline)`
   - `db.updateRecoveryBaseline(sessionId, currentPnL)`
   - Motivo: Adaptar-se a perdas maiores que o previsto

2. **Reset manual:**
   - Dashboard: Endpoint POST `/api/recovery/reset`
   - `db.endRecoverySession(activeSession.id)` → status = 'ended'
   - Próximo ciclo: `db.startRecoverySession(currentPnL)` → nova sessão com novo baseline

### ✅ Baseline NÃO Altera

1. **Durante sessão ativa - Melhora (recuperação):**
   - Apenas registra pontos, baseline mantém-se
   - Percentage = (PnL - baseline) / (0 - baseline) × 100

2. **Sessão encerrada (PnL ≥ 0):**
   - status = 'ended'
   - Próximos ciclos com PnL positivo ignoram recovery
   - Se PnL < 0 novamente: cria nova sessão

---

## 7. Logs de Exemplo

```
23:45:15 [SUCCESS] [BOT] [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -186.07
23:45:30 [DEBUG]   [BOT] [RECOVERY] Ponto registrado: PnL=R$ -187.50, Progresso=-0.8%, Baseline=R$ -186.07
23:45:45 [DEBUG]   [BOT] [RECOVERY] Ponto registrado: PnL=R$ -185.00, Progresso=0.6%, Baseline=R$ -186.07
23:46:00 [WARN]    [BOT] [RECOVERY] Baseline atualizado: R$ -186.07 → R$ -191.05
23:46:15 [DEBUG]   [BOT] [RECOVERY] Ponto registrado: PnL=R$ -190.00, Progresso=1.0%, Baseline=R$ -191.05
23:46:30 [SUCCESS] [BOT] [RECOVERY] Sessão de recuperação encerrada | PnL Final: R$ 5.20
```

---

## 8. Verificar Estado Atual

```bash
# Terminal 1: Verificar sessão ativa
curl -s http://localhost:3001/api/recovery | jq '.activeSession'

# Terminal 2: Monitor de pontos
curl -s http://localhost:3001/api/recovery | jq '.points | length'

# Terminal 3: Histórico de sessões
curl -s http://localhost:3001/api/recovery | jq '.sessions | map({id, status, baseline})'

# Dashboard: Abrir em http://localhost:3001
# Seção: 🔄 Monitor de Recuperação
# Ver: Baseline atual, Percentual de recuperação, Botão Reset
```

---

## Resumo da Pergunta Original

> "ao resetar o baseline do monitor ele altera em banco o valor, assim como quando uma nova recuperação inicia"

✅ **Confirmado**: Ambos os cenários alteram o baseline no banco:

1. **Reset Manual**: Encerra sessão atual e cria nova com baseline = PnL atual
2. **Recuperação Nova**: Inicia sessão com baseline = PnL inicial negativo
3. **Piora Progressiva**: Atualiza baseline se PnL piorar durante sessão ativa

Isso é **comportamento esperado** para adaptar-se às condições dinâmicas de mercado.

---

*Última atualização: 13 de janeiro de 2026*
