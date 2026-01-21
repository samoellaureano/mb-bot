# 📊 OTIMIZAÇÃO DE ESTRATÉGIA - SALDO CRÍTICO (R$ 30.21)

## 🎯 OBJETIVO DUPLO

```
📈 CRESCENDO  → VALORIZAR capital em BTC (acumular)
📉 DIMINUINDO → PROTEGER saldo em BRL (freqar queima)
```

---

## 📋 ANÁLISE ATUAL

### Capital Disponível
- **Saldo BRL:** R$ 30.21
- **Saldo BTC:** 0.00037139 BTC (~R$ 194)
- **Total:** ~R$ 224

### Capacidade de Ordens
| Parâmetro | Valor Antigo | Valor Novo | Impacto |
|-----------|------------|-----------|---------|
| ORDER_SIZE | 0.00001 BTC | 0.000005 BTC | 2x mais ordens simultâneas |
| Custo/ordem | R$ 5,24 | R$ 2,62 | -50% capital/ordem |
| Pares simultâneos | 2-3 máx | 5-6 possível | +100% diversificação |

### Estratégia Adaptativa Ativa
- ✅ **ALTA:** Spread 1.0% + MAX_POS 0.0005 + Viés COMPRADOR
- ✅ **NEUTRA:** Spread 1.2% + MAX_POS 0.0003 + Viés ZERO
- ✅ **BAIXA:** Spread 1.8% + MAX_POS 0.0002 + Viés VENDEDOR

---

## 🔄 COMPORTAMENTO ESPERADO

### Quando Mercado SOBE (UP)
```
1. Bot detecta trend UP
2. Aplica parâmetros AGRESSIVOS:
   • Reduz spread para 1.0% (mais competitivo)
   • Aumenta MAX_POSITION para 0.0005 BTC
   • Coloca viés POSITIVO (+0.0001)
   • Resultado: COMPRA mais BTC = ACUMULA em alta
3. Lucro esperado: Pega pequenos swings para cima
```

### Quando Mercado CAI (DOWN)
```
1. Bot detecta trend DOWN
2. Aplica parâmetros DEFENSIVOS:
   • Aumenta spread para 1.8% (segurança)
   • Reduz MAX_POSITION para 0.0002 BTC
   • Coloca viés NEGATIVO (-0.0001)
   • Resultado: VENDE BTC = PROTEGE saldo BRL
3. Lucro esperado: Cobra prêmio maior (spread) em baixa
```

### Modo NEUTRO (oscilação)
```
• Spread normal 1.2%
• MAX_POSITION 0.0003 BTC
• Viés zero = market making puro
```

---

## 📈 METRICAS A MONITORAR

### Indicadores de Sucesso

| Métrica | ALTA | NEUTRO | BAIXA |
|---------|------|--------|-------|
| **Objetivo** | Acumular BTC | MM puro | Proteger BRL |
| **Spread** | 1.0% | 1.2% | 1.8% |
| **Posição** | 0.0005 | 0.0003 | 0.0002 |
| **BTC/Ordem** | Aumentar | Manter | Diminuir |
| **Taxa Fills** | >5% OK | >3% OK | >2% OK |

### Red Flags

- ❌ Spread não muda → Estratégia não está rodando
- ❌ MAX_POSITION fixo → Parâmetros não estão sendo aplicados
- ❌ Fills zerados em 30min → Spread muito largo
- ❌ Capital zerado → Ordens muito grandes para saldo

---

## 🚀 ATIVANDO ESTRATÉGIA ADAPTATIVA

### 1. Verificar Status
```bash
# Confirmar que estratégia está ativa
grep -i "adaptive" /mnt/c/PROJETOS_PESSOAIS/mb-bot/.env
```

### 2. Iniciar Bot
```bash
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
SIMULATE=false ADAPTIVE_STRATEGY=true node bot.js
```

### 3. Monitorar em Tempo Real
```bash
# Abrir dashboard
open http://localhost:3001

# Ou monitorar via terminal
bash monitor_realtime.sh
```

### 4. Observar Mudanças de Modo
```bash
# Ver logs de adaptação
tail -f logs/bot.log | grep -E "MODO|ADAPTATIVO|ESTRATÉGIA"
```

---

## 📊 CENÁRIOS DE TESTE

### Cenário 1: Mercado SUBINDO (16:37 - 17:07)
```
Esperado:
  ✅ Spread diminui para 1.0%
  ✅ MAX_POSITION aumenta para 0.0005
  ✅ Mais ordens BUY que SELL
  ✅ Acumula BTC em cada fill
  
Verificar:
  • grep "MODO ADAPTATIVO" logs/bot.log | grep "BULLISH\|UP"
  • Contar BTC acumulado em cada ciclo
```

### Cenário 2: Mercado CAINDO (17:07 - 17:37)
```
Esperado:
  ✅ Spread aumenta para 1.8%
  ✅ MAX_POSITION cai para 0.0002
  ✅ Mais ordens SELL que BUY
  ✅ Protege capital em BRL
  
Verificar:
  • grep "MODO ADAPTATIVO" logs/bot.log | grep "BEARISH\|DOWN"
  • Confirmar que BTC não cai abaixo de mínimo
```

### Cenário 3: Mercado LATERAL (17:37 - 18:07)
```
Esperado:
  ✅ Spread mantém 1.2%
  ✅ MAX_POSITION ≈ 0.0003
  ✅ BUY e SELL equilibrados
  ✅ Market making puro
  
Verificar:
  • grep "MODO ADAPTATIVO" logs/bot.log | grep "NEUTRAL"
  • PnL deve crescer com fills regulares
```

---

## 🎮 CONTROLES DISPONÍVEIS

Se precisar ajustar em tempo real:

```bash
# Aumentar agressividade em alta
export ADAPTIVE_BULLISH_MULTIPLIER=1.5
# (coloca spread 0.7%, MAX_POS 0.00075)

# Aumentar proteção em baixa
export ADAPTIVE_BEARISH_MULTIPLIER=1.5
# (coloca spread 2.7%, MAX_POS 0.00015)
```

---

## 📈 BENCHMARK ESPERADO (48 horas)

Com estratégia adaptativa e capital baixo:

```
Cenário OTIMISTA (mercado volátil para cima):
  • 200+ ciclos
  • 30-50 fills (BUY > SELL)
  • +8-12% ROI
  • BTC acumulado: +0.0001
  • Saldo BRL: Pode cair temporariamente

Cenário REALISTA (mercado lateral):
  • 200+ ciclos
  • 10-20 fills (equilibrado)
  • +2-4% ROI
  • BTC acumulado: +0.00005
  • Saldo BRL: Mantém-se estável

Cenário DEFENSIVO (mercado caindo):
  • 200+ ciclos
  • 5-15 fills (SELL > BUY)
  • +1-2% ROI
  • BTC: Venda parcial (protege capital)
  • Saldo BRL: Aumenta (vê BTC com lucro)
```

---

## ✅ CHECKLIST ANTES DE RODAR

- [ ] `.env` atualizado com ORDER_SIZE=0.000005
- [ ] ADAPTIVE_STRATEGY não está desativado
- [ ] Bot anterior foi parado (kill PID)
- [ ] Dashboard acessível em http://localhost:3001
- [ ] Logs rodando (`tail -f logs/bot.log`)
- [ ] Monitor de padrões pronto (`bash monitor_realtime.sh`)

---

## 🔍 PRÓXIMOS PASSOS

1. **IMEDIATO:** Reiniciar bot com nova configuração
2. **PRIMEIROS 30 MIN:** Observar mudanças de modo (high/low/neutral)
3. **PRIMEIRA HORA:** Verificar se fills começam a aparecer
4. **24 HORAS:** Avaliar se estratégia está funcionando
5. **48 HORAS:** Considerar depositar mais BRL se performance boa

---

**Data:** 2026-01-14 16:45  
**Status:** ✅ Estratégia pronta para ser ativada  
**Próxima ação:** Reiniciar bot.js com ADAPTIVE_STRATEGY=true
