# 🚀 GUIA RÁPIDO - ESTRATÉGIA ADAPTATIVA

## Status Atual
```
Bot: ✅ Rodando (PID 12010)
Estratégia: ✅ ATIVA
Capital: R$ 30.21 (otimizado para micro-ordens)
Modo: LIVE
```

## O Que Muda Automaticamente?

| Mercado | Spread | MAX_POS | Objetivo |
|---------|--------|---------|----------|
| ⬆️ SOBE | 1.0% | 0.0005 | **Compra BTC** |
| ➡️ LATERAL | 1.2% | 0.0003 | **Market Making** |
| ⬇️ CAI | 1.8% | 0.0002 | **Vende BTC** |

**Você não precisa fazer NADA. Bot ajusta sozinho.**

---

## Monitorar Mudanças

### Ver em Tempo Real
```bash
bash monitor_adaptive_strategy.sh
```

### Ver nos Logs
```bash
tail -f logs/bot.log | grep "MODO"
```

### Verificar Spread Atual
```bash
curl -s http://localhost:3001/api/data | grep -o '"dynamicSpread":"[^"]*"'
```

---

## Esperar Por...

✅ Próxima 1h: Spread muda quando mercado se mexe
✅ Próximas 6h: Fills começam a aparecer
✅ Próximas 24h: Padrão fica claro

---

## Se Precisar Parar
```bash
pkill -f "node bot.js"
```

## Se Precisar Reiniciar
```bash
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
SIMULATE=false ADAPTIVE_STRATEGY=true node bot.js > logs/bot.log 2>&1 &
```

---

## Referências
- Implementação: `ESTRATEGIA_ADAPTATIVA_FINAL.md`
- Otimização: `OTIMIZACAO_ESTRATEGIA_ADAPTATIVA.md`
- Código: `adaptive_strategy.js`
