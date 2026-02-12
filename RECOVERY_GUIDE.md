# 🎯 GUIA DE RECUPERAÇÃO E RECONFIGURAÇÃO

**Após Análise Completa de Profitabilidade**  
Data: 11/02/2026

---

## 📌 O Que Foi Feito

### Bugs Corrigidos ✅

1. **SELL-FIRST Desabilitado**
   - Arquivo: `bot.js` linhas 1.418-1.437
   - Mudança: `if (false &&` adicionado para desabilitar lógica
   - Razão: Causava SELL independente sem BUY pareada

2. **Bloqueio de SELL Órfá Implementado**
   - Arquivo: `bot.js` linhas ~870-878
   - Código: Novo validador que impede `placeOrder('sell')` sem BUY
   - Teste: ✅ PASSAR - `test_sell_orphan_protection.js`

3. **Documentação Completa**
   - Arquivo: `ANALYSIS_ROOT_CAUSE_FIX.md`
   - Conteúdo: Raiz do problema, por que aconteceu, soluções

---

## 🔧 Configurações Recomendadas

### 1️⃣ AUMENTAR ORDER_SIZE (IMEDIATO)

**Arquivo:** `.env` ou `bot.js` linha 44

```bash
# ANTES (❌ Pequeno demais):
ORDER_SIZE=0.000065  # ~R$ 23 por ordem
                     # Lucro teórico: R$ 0,11 (1 pair)
                     # Custo de taxa: R$ 0,14
                     # RESULTADO: -R$ 0,03 por pair ❌

# DEPOIS (✅ Viável):
ORDER_SIZE=0.0005    # ~R$ 175 por ordem
                     # Lucro teórico: R$ 0,88 (1 pair)
                     # Custo de taxa: R$ 1,05
                     # RESULTADO: -R$ 0,17 mais still losses!
```

Realmente precisa ser:
```bash
ORDER_SIZE=0.001     # ~R$ 350 por ordem  
                     # Lucro: R$ 1,75
                     # Taxa: R$ 2,10
                     # Ainda pequeno, mas melhor!
```

Ou aumentar spread:
```bash
ORDER_SIZE=0.0005    # R$ 175
SPREAD_PCT=0.01      # 1.0% em vez de 0.5%
                     # Lucro: R$ 1,75
                     # Taxa: R$ 1,05
                     # RESULTADO: +R$ 0,70 por pair ✅
```

---

### 2️⃣ DESABILITAR CASH MANAGEMENT (TEMPORÁRIO)

**Arquivo:** `.env`

```bash
# ANTES:
USE_CASH_MANAGEMENT=true  # Causava SELL-FIRST com threshold 0.025%

# DEPOIS (Temporário):
USE_CASH_MANAGEMENT=false  # Usar apenas market making
```

Se quiser manter Cash Management:
```bash
USE_CASH_MANAGEMENT=true

# EDITAR cash_management_strategy_v2.js linhas 24-26:
this.SELL_THRESHOLD = 0.005;      # ↑ de 0.00025 (0.025% → 0.5%)
this.BUY_THRESHOLD = 0.005;       # ↑ de 0.0002 (0.02% → 0.5%)

# Isso reduz likelihood de SELL-FIRST independente
```

---

### 3️⃣ REDUZIR REPRICING INTERVAL

**Arquivo:** `bot.js` linha ~120 (procure `REPRICING_AGE`)

```bash
# ANTES:
REPRICING_AGE_SEC=600  # 10 minutos
# Resultado: Cada 10 min, ordem antiga é cancelada, nova criada
#            1.092 ordens em 21 dias = churn demais

# DEPOIS:
REPRICING_AGE_SEC=300  # 5 minutos
# Reduz ordens criadas e canceladas
```

---

### 4️⃣ VALIDAÇÕES ADICIONAIS

Adicionar em `.env` se não existir:
```bash
# Simulação obrigatória antes de live
SIMULATE=false        # Defina true para testar 24h

# Logging
LOG_LEVEL=INFO        # Mais detalhes

# Rate limit
RATE_LIMIT_PER_SEC=2  # Reduzir de 3 para ser mais conservador
```

---

## 🧪 PLANO DE TESTE E VALIDAÇÃO

### Fase 1: Simulação (24 horas)

```bash
# Terminal 1: Bot
SIMULATE=true npm run dev

# Terminal 2: Dashboard
npm run dashboard
# Acesse http://localhost:3001
```

**Validar durante simulação:**
- ✅ Fill rate > 50% (não 8.8%)
- ✅ Spread SEMPRE positivo (BUY < SELL)
- ✅ Sem pares órfás (BUYs sem SELL)
- ✅ PnL crescente (não zerado)

**Expected Results após 24h simulação:**
```
Ordens criadas: ~300-400 (vs 1.092)
Fill rate: 50-70% (vs 8.8%)
Spreads positivos: 100% (vs ~5%)
PnL: +R$ 10-50 (vs R$ 0)
```

---

### Fase 2: LIVE (Com Pequeno Capital)

```bash
# AVISO: Apenas com capital que possa perder!

# Terminal 1: Bot
SIMULATE=false npm run live

# Monitorar por 4 horas
npm run stats  # Check performance
```

**Condições (PARAR SE):**
```
PnL < -R$ 50 em 4h: PARAR e debugar
Fill rate < 30%: PARAR e aumentar spread
Erros de conexão: PARAR e validar API
```

---

## 📊 Métricas de Sucesso

| Métrica | Antes | Target | Depois |
|---------|-------|--------|--------|
| **Fill Rate** | 8.8% | >50% | ? |
| **Spread** | Invertido ❌ | Sempre + | ? |
| **PnL/24h** | -R$ 2 | +R$ 20 | ? |
| **Pares Órfás** | 6 BUYs | 0 | ? |
| **Ordens/24h** | 1.092 | <500 | ? |

---

## 🚀 Checklist de Implementação

### Antes de Rodar Bot

- [ ] `.env` atualizado com ORDER_SIZE maior `0.001+`
- [ ] `.env` atualizado com SPREAD_PCT aumentado se necessário `0.01`
- [ ] `.env` USE_CASH_MANAGEMENT = false (ou thresholds aumentados)
- [ ] `bot.js` sintaxe verificada: `node -c bot.js` ✅
- [ ] Teste de proteção PASSOU: `node test_sell_orphan_protection.js` ✅
- [ ] Dashboard operacional: `npm run dashboard`

### Durante Simulação 24h

- [ ] Monitorar a cada 2h via dashboard
- [ ] Log em `logs/` não mostra erros críticos
- [ ] Primeiro pair tinha spread > 0 ✅
- [ ] Fill rate cresceu acima de 30% ✅
- [ ] Sem sequer UMA ordem SELL órfá bloqueada

### Antes de LIVE

- [ ] PnL simulado positivo +R$ 10+
- [ ] Sem warnings sobre pares órfás
- [ ] Validar que USE_CASH_MANAGEMENT=false (seguro)
- [ ] API key testada com pequeno capital
- [ ] Alerta de loss configurado em -R$ 100

---

## 📝 Exemplo de `.env` Recomendada

```bash
# Mercado Bitcoin API
REST_BASE=https://api.mercadobitcoin.net/api/v4
PAIR=BTC-BRL

# Bot Behavior
CYCLE_SEC=15
SPREAD_PCT=0.01        # ← AUMENTADO (de 0.005)
ORDER_SIZE=0.001       # ← AUMENTADO (de 0.000065)
MIN_SPREAD_PCT=0.006

# Repricing
REPRICING_AGE_SEC=300  # ← REDUZIDO (de 600)

# Segurança
SIMULATE=false         # ← Mude para true para testes
DAILY_LOSS_LIMIT=-50
RATE_LIMIT_PER_SEC=2

# Estratégias
USE_CASH_MANAGEMENT=false  # ← DESABILITADO
SELL_FIRST=false           # ← GARANTIDO desabilitado

# Logging
LOG_LEVEL=INFO
```

---

## 🎓 O Que Aprendemos

**Lição #1: Market Making Requer Pares Sincronizadas**
- BUY e SELL DEVEM estar sempre pareadas
- NUNCA colocar SELL sem BUY correspondente

**Lição #2: Thresholds Muito Agressivos = Chaos**
- 0.025% threshold disparou SELL em QUALQUER movimento
- Aumentar para 0.5-1% é mais realista

**Lição #3: ORDER_SIZE Pequeno Come Taxa**
- R$ 23 ordem com 0.6% taxa = perde sozinho
- Precisa de MINIMUM R$ 150-200 por ordem

**Lição #4: Repricing Aggressivo = Churn Alto**
- 600s repricing = 1.092 ordens em 21 dias = waste
- 300s é melhor, mas 600s+ é excessivo

---

## 🔗 Documentos Relacionados

- `ANALYSIS_ROOT_CAUSE_FIX.md` - Análise técnica completa
- `test_sell_orphan_protection.js` - Validação de proteção
- `bot.js` - Código corrigido
- `cash_management_strategy_v2.js` - Estratégia de cash management

---

## ❓ FAQ

**P: Preciso lançar novo bot ou reusar dados antigos?**  
A: Novo bot com `.env` novo. Dados antigos não podem ser recuperados por causa das pares invertidas.

**P: Quanto debo colocar de capital?**  
A: Comece com R$ 100 em simulação. Se passar teste, R$ 500 LIVE com limite -R$ 100.

**P: Por quanto tempo testar antes de escalar?**  
A: Mínimo 7 dias LIVE com +ROI. Qualquer dia negativoanalisa logs imediatamente.

**P: E se voltar a não lucrar?**  
A: 1) Aumentar SPREAD_PCT para 1.5-2%
   2) Desabilitar Cash Management se reativado
   3) Revisar logs para SELLs órfás bloqueadas

---

**Próximo Passo:**
```bash
# 1. Editar .env
nano .env

# 2. Testar 24h
SIMULATE=true npm run dev

# 3. Validar métricas
npm run stats
```

**Boa sorte! 🚀**
