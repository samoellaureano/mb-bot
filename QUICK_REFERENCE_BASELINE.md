# 🚀 Referência Rápida: Baseline e Recuperação

## Resposta Direta

**P:** Ao resetar o baseline no monitor, ele altera em banco, assim como quando uma nova recuperação inicia?

**R:** ✅ **Sim, e é esperado!**

---

## 3 Cenários onde Baseline Altera no Banco

### 1. Nova Recuperação Inicia
```
Quando: PnL < 0 E sem sessão ativa
Ação: INSERT recovery_sessions com baseline = PnL atual
Exemplo: baseline = -R$186.07
Log: [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -186.07
```

### 2. Reset Manual (Dashboard)
```
Quando: Clica "↻ Reset" no monitor
Ação: Encerra sessão anterior + Cria nova no próximo ciclo
DB: UPDATE status='ended' + INSERT nova sessão
Novo Baseline: PnL do momento do reset
Log: [API] Sessão de recuperação #3 encerrada manualmente via reset
```

### 3. Piora Progressiva
```
Quando: PnL fica mais negativo durante sessão ativa
Ação: UPDATE baseline para acompanhar piora
Exemplo: baseline -R$186.07 → -R$191.05
Log: [RECOVERY] Baseline atualizado: R$ -186.07 → R$ -191.05
```

---

## Quando Baseline NÃO Altera

| Situação | Ação | Motivo |
|----------|------|--------|
| PnL melhora | Apenas registra ponto | Progressão normal |
| PnL = 0 (break-even) | Encerra sessão | Recuperação completa |
| PnL > 0 | Ignora recovery | Além do break-even |

---

## Verificação Rápida

```bash
# Terminal: Ver sessão ativa
curl -s http://localhost:3001/api/recovery | jq '.activeSession'

# Resultado esperado:
# {
#   "id": 5,
#   "status": "active", 
#   "baseline": -191.05
# }
```

---

## Mapeamento BD

| Evento | Operação | Tabela | Campo |
|--------|----------|--------|-------|
| Novo recovery | INSERT | recovery_sessions | baseline, status |
| Reset clicado | UPDATE | recovery_sessions | status → 'ended' |
| Piora | UPDATE | recovery_sessions | baseline |
| Ponto registrado | INSERT | recovery_points | pnl, percentage, baseline |

---

## Logs para Monitorar

Procure por `[RECOVERY]` no `bot.log`:

```
✅ Sessão iniciada
   [RECOVERY] Sessão de recuperação iniciada | Baseline: R$ -186.07

⚠️ Baseline atualizado  
   [RECOVERY] Baseline atualizado: R$ -186.07 → R$ -191.05

📝 Ponto registrado
   [RECOVERY] Ponto registrado: PnL=R$ -190.00, Progresso=1.0%, Baseline=R$ -191.05

✅ Recuperação completa
   [RECOVERY] Sessão de recuperação encerrada | PnL Final: R$ 5.20
```

---

## Arquivos de Documentação

- **[BASELINE_BEHAVIOR.md](./BASELINE_BEHAVIOR.md)** - Documento completo com queries SQL
- **[RECOVERY_SESSION_FLOW.md](./RECOVERY_SESSION_FLOW.md)** - Fluxo detalhado + timeline
- **[bot.js](./bot.js)** - Linhas 1180-1210 (lógica de recovery)
- **[db.js](./db.js)** - Linhas 700-800 (operações de BD)
- **[dashboard.js](./dashboard.js)** - Linhas 760-790 (reset endpoint)

---

**Status**: ✅ Sistema operacional e conforme esperado
