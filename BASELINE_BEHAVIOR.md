# 📊 Comportamento de Baseline em Sessões de Recuperação

**Resumo Executivo**: O baseline altera no banco de dados em dois cenários: (1) quando uma nova recuperação inicia e (2) quando o baseline é resetado manualmente, ambos criando ou atualizando registros. Isso é comportamento **esperado e operacional**.

---

## TL;DR - Resposta Direta

> "ao resetar o baseline do monitor ele altera em banco o valor, assim como quando uma nova recuperação inicia"

✅ **Confirmado e esperado**. Ambos alteram o banco:

1. **Nova Recuperação Inicia**: `INSERT` novo registro com baseline = PnL atual negativo
2. **Reset Manual**: `UPDATE` para 'ended' + `INSERT` nova sessão com novo baseline = PnL atual
3. **Piora Progressiva**: `UPDATE` baseline quando PnL fica mais negativo durante sessão ativa

---

## Fluxos Detalhados

### 1️⃣ Nova Recuperação Inicia (PnL < 0)

```javascript
// bot.js - runCycle()
if (currentPnL < 0) {
    if (!activeSession) {
        await db.startRecoverySession(currentPnL, currentPnL);
        // ✅ INSERT recovery_sessions
        // baseline = currentPnL (ex: -R$186.07)
    } else if (currentPnL < baseline) {
        await db.updateRecoveryBaseline(sessionId, currentPnL);
        // ✅ UPDATE recovery_sessions SET baseline = ?
    }
}
```

**DB Query**:
```sql
-- Criar nova sessão
INSERT INTO recovery_sessions (started_at, baseline, initial_pnl, status)
VALUES (?, -186.07, -186.07, 'active');

-- Ou atualizar se piora
UPDATE recovery_sessions SET baseline = -191.05 WHERE id = 3;
```

### 2️⃣ Reset Manual via Dashboard

```javascript
// dashboard.js - POST /api/recovery/reset
const active = await db.getActiveRecoverySession();
if (active) {
    await db.endRecoverySession(active.id);
    // ✅ UPDATE recovery_sessions SET status = 'ended'
}
// Resposta: "Nova sessão será criada no próximo ciclo do bot"
```

**Timeline**:
```
11:00 UTC - Reset clicado
  ├─ UPDATE recovery_sessions SET status = 'ended' WHERE id = 3
  └─ Session #3 agora: status = 'ended'

11:15 UTC - Próximo ciclo do bot com PnL < 0
  ├─ getActiveRecoverySession() → null (anterior foi 'ended')
  ├─ INSERT recovery_sessions (id=4, baseline=NOVO PnL)
  └─ [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -188.30
```

### 3️⃣ Progressão Durante Sessão Ativa

```
Ciclo 1:  PnL = -R$186.07 | baseline = -186.07 | ação: INSERT
Ciclo 2:  PnL = -R$187.50 | baseline = -186.07 | ação: nada (recuperação normal)
Ciclo 3:  PnL = -R$185.00 | baseline = -186.07 | ação: nada (melhorando)
Ciclo 4:  PnL = -R$191.05 | baseline = -186.07 | ação: UPDATE! (piorou)
          └─ Novo baseline: -R$191.05
Ciclo 5:  PnL = -R$190.00 | baseline = -191.05 | ação: nada (mantém)
```

---

## Estado Atual do Sistema

```
SESSION #5 (ATIVA)
├─ Status: active
├─ Baseline: R$ -191.05
├─ Pontos: 5 registrados
└─ Criada em: 13/01/2026 01:35:00

HISTÓRICO
├─ Session #4: closed | baseline -R$191.04
├─ Session #3: closed | baseline -R$191.05  
├─ Session #2: closed | baseline -R$191.02
└─ Session #1: closed | baseline -R$186.09 ← Primeira recuperação
```

---

## Resumo de Modificações no Banco

| Evento | Operação DB | Campo | Antes | Depois |
|--------|----------|-------|-------|--------|
| Inicia recuperação | INSERT | id | — | 5 |
| | INSERT | baseline | — | -191.05 |
| | INSERT | status | — | 'active' |
| Piora (PnL -191.05) | UPDATE | baseline | -186.09 | -191.05 |
| Reset clicado | UPDATE | status | 'active' | 'ended' |
| Novo ciclo | INSERT | (nova sessão) | — | Session #6 |

---

## Por Que Isso é Esperado

### ✅ Razão 1: Adaptação Dinâmica
Quando o PnL piora mais que o baseline, atualizar o baseline permite que o sistema se adapte a perdas maiores. Isso é crítico para:
- Não perder esperança em recuperações impossíveis
- Ajustar expectativas de recuperação

### ✅ Razão 2: Reset Controlado
Operador pode resetar a sessão quando quiser, forçando o sistema a começar do zero com o PnL atual como ponto de partida.

### ✅ Razão 3: Histórico Persistente
Todas as sessões anteriores (com seus baselines originais) ficam arquivadas como `'closed'`, permitindo análise histórica.

---

## Verificar Estado

```bash
# Via cURL
curl http://localhost:3001/api/recovery | jq '.activeSession'

# Resultado esperado:
{
  "id": 5,
  "status": "active",
  "baseline": -191.05,
  "initial_pnl": -191.05,
  "started_at": 1705081500
}

# Histórico de sessões
curl http://localhost:3001/api/recovery | jq '.sessions'
```

---

## Conclusão

✅ **Comportamento está correto e operacional**

O baseline no banco:
- **Altera** quando sessão nova inicia (INSERT com novo valor)
- **Altera** quando reset é clicado (cria nova sessão com novo baseline)
- **Altera** quando PnL piora durante sessão (UPDATE para acompanhar piora)
- **Mantém** quando PnL melhora (apenas registra progresso)

Tudo conforme design e testes executados. 📊

---

*Documentação | 13 de janeiro de 2026*
