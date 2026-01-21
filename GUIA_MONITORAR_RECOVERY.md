# 🔄 GUIA PRÁTICO: MONITORAR DINÂMICA DE RECUPERAÇÃO (PnL < 0)

**Objetivo:** Validar que o sistema de recuperação automática funciona corretamente quando PnL fica negativo  
**Status:** Sistema preparado, aguardando cenário de teste  
**Data:** 13/01/2026

---

## 📊 Contexto Atual

```
PnL Atual:       +0.05 BRL ✅ POSITIVO
Recovery Buffer: 0 (não aplicado)
Spread Base:     1.5%
Volatilidade:    3.0%
```

**Quando PnL ficar < 0, o sistema automaticamente:**
1. Calculará um buffer dinâmico baseado em volatilidade
2. Adicionará buffer ao spread para aumentar margem
3. Tentará recuperar as perdas com spreads maiores

---

## 🔍 Como Monitorar em Tempo Real

### Método 1: Acompanhar Logs do Terminal

**Abra o terminal onde o bot está rodando e procure por:**

```
[INFO] [Bot] PnL Total: -X.XX BRL | ROI: -Y.YY% | PnL Não Realizado: Z.ZZ BRL
```

**Quando PnL ficar negativo, você verá:**

```
✅ ACIONADO:
[DEBUG] [Bot] Recovery Buffer: 0.075% | Volatilidade: 1.5%
[INFO] [Bot] Spread: 1.5% → 1.575% (com recuperação)
[WARN] [Bot] PnL negativo! Aumentando spread para recuperação.
```

### Método 2: Usar Stats do Database

```bash
# Em outro terminal, rode:
npm run stats

# Procure por esta seção:
PnL (últimas 24h):   -0.15 BRL ❌
Recovery Ativo:      SIM ✅
Buffer Aplicado:     0.075%
Spread Dinâmico:     1.575%
```

### Método 3: Acompanhar o Dashboard

Se o dashboard estiver rodando (porta 3001):

```
http://localhost:3001
```

**Widgets a monitorar:**

1. **Mini Dashboard (loga cada ciclo):**
   ```
   PnL Total: 0.05 BRL | ROI: 0.46%
   ```

2. **Seção de Recuperação (quando ativa):**
   ```
   Recovery Status: ATIVO
   Buffer Dinâmico: 0.075%
   Spread Ajustado: 1.575%
   ```

---

## 📋 Sequência de Eventos Esperada

### CENÁRIO: Simulação de Prejuízo

**Passo 1: Acompanhamento Normal**
```
Ciclo 100: PnL Total: +0.05 BRL | Spread: 1.5%
Ciclo 101: PnL Total: +0.03 BRL | Spread: 1.5%
Ciclo 102: PnL Total: +0.00 BRL | Spread: 1.5%
Ciclo 103: PnL Total: -0.02 BRL | Spread: 1.5%
         ⚠️ RECOVERY BUFFER ACIONADO! 🚨
```

**Passo 2: Sistema Calcula Recovery Buffer**
```
Volatilidade Detectada: 1.5%
Fator de Recuperação: 1.375x (interpolado)
Buffer Calculado: 0.0005 * 1.375 = 0.0006875 (~0.069%)
```

**Passo 3: Spread Ajustado Dinamicamente**
```
Spread Original:  1.5%
Buffer Aplicado:  +0.069%
Spread Novo:      1.569% ✅
```

**Passo 4: Preços Reajustados**
```
Spread antigo: 1.5% em mid 511,474.50
  Buy:  507,636.45 BRL
  Sell: 515,308.55 BRL
  Margem: 7,672.10 BRL

Spread novo: 1.569% em mid 511,474.50
  Buy:  507,504.49 BRL (mais baixo = melhor fill)
  Sell: 515,440.51 BRL (mais alto = melhor fill)
  Margem: 7,936.02 BRL (+263.92 BRL de margem extra!)
```

**Passo 5: Recuperação em Ação**
```
Ciclo 103: PnL Total: -0.02 BRL | Spread: 1.569% | Recovery: 0.069%
Ciclo 104: PnL Total: -0.01 BRL | Spread: 1.569% | Recovery: 0.069%
Ciclo 105: PnL Total: +0.00 BRL | Spread: 1.569% | Recovery: 0.069%
Ciclo 106: PnL Total: +0.02 BRL | Spread: 1.569% | Recovery: 0.069%
Ciclo 107: PnL Total: +0.05 BRL | Spread: 1.5% | Recovery: DESATIVADO ✅
```

---

## 🎯 Sinais de Validação

### ✅ SE VENDO ESTES LOGS = FUNCIONANDO CORRETAMENTE

```
[DEBUG] [Bot] PnL Calculation: Realized=0.00 | Unrealized=-0.05 | Total=-0.05
[WARN] [Bot] Sistema detectou PnL negativo: -0.05 BRL
[INFO] [Bot] Recovery Buffer: 0.075% | Volatilidade: 1.5%
[SUCCESS] [Bot] Spread ajustado para recuperação: 1.575%
[INFO] [Bot] Novo spread aplicado aos preços das ordens
```

### ⚠️ SE NÃO VENDO ESTES LOGS = POSSÍVEL PROBLEMA

```
❌ Não aparece "Recovery Buffer" quando PnL < 0
❌ Spread continua 1.5% mesmo com PnL negativo
❌ Preços não reajustam quando recovery ativa
❌ Volatilidade sempre 0% ou sempre 3.0%
```

---

## 🔧 Cenários de Teste

### Teste 1: Validar com Volatilidade Baixa (0.2%)

**Configuração Manual:**
```javascript
// Em bot.js linha ~1090, forçar volatilidade baixa:
const volatilityPct = 0.2;  // Forçar 0.2% para teste
```

**Esperado:**
```
Recovery Buffer = 0.0005 * 1.0 = 0.0005 (0.05%)
Spread = 1.5% + 0.05% = 1.55%
```

**Validar:**
- [ ] Logs mostram "Volatilidade: 0.2%"
- [ ] Recovery Buffer calculado como 0.0005 (mínimo)
- [ ] Spread ajustado para 1.55%

### Teste 2: Validar com Volatilidade Alta (2.5%)

**Configuração Manual:**
```javascript
// Em bot.js linha ~1090:
const volatilityPct = 2.5;  // Forçar 2.5% para teste
```

**Esperado:**
```
Recovery Buffer = 0.0005 * 1.875 = 0.0009375 (~0.09%)
Spread = 1.5% + 0.09% = 1.59%
```

**Validar:**
- [ ] Logs mostram "Volatilidade: 2.5%"
- [ ] Recovery Buffer calculado como ~0.0009375
- [ ] Spread ajustado para ~1.59%

### Teste 3: Forçar Cenário de PnL Negativo

**Opção A: Reduzir saldo inicial**
```bash
# Em simulação, edite db.js ou force via codigo:
const balanceBRL = 5.0;  // Reduzir de 1000 para 5 BRL
```

**Opção B: Aguardar ocorrência natural**
- Continuar teste de 24h
- Se houver série de perdas, PnL ficará naturalmente negativo

**Opção C: Injetar dados negativos manualmente**
```bash
# Terminal:
sqlite3 database/orders.db
UPDATE orders SET pnl = -0.5 WHERE type='BUY' LIMIT 3;
SELECT SUM(pnl) FROM orders;  # Deve mostrar negativo
```

---

## 📝 Checklist de Validação

Use este checklist quando PnL ficar negativo:

### Imediatamente Após Acionamento

- [ ] Log mostra "PnL Total: -X.XX BRL"
- [ ] Sistema detecta PnL < 0
- [ ] Recovery Buffer é calculado
- [ ] Buffer baseado em volatilidade atual
- [ ] Spread aumentado em terminal/logs
- [ ] Preços reajustados (buy mais baixo, sell mais alto)

### Após 5-10 Ciclos com Recovery Ativo

- [ ] Margin aumentou (spread maior = mais lucro por fill)
- [ ] Taxa de fill pode estar melhor (preços mais competitivos)
- [ ] PnL começou a recuperar (trending positivo)
- [ ] Buffer ainda aplicado enquanto PnL < 0

### Quando PnL Volta Positivo

- [ ] Recovery Buffer desativado automaticamente
- [ ] Spread volta para 1.5% original
- [ ] Preços voltam para valores normais
- [ ] Sistema continua operando normalmente

---

## 🚨 Troubleshooting

### Problema: PnL continua negativo mesmo com Recovery

**Causa Provável:** Velocidade da recuperação insuficiente

**Solução:**
```javascript
// Aumentar buffer base em bot.js linha ~70:
const RECOVERY_BUFFER_BASE = 0.001;  // Aumentado de 0.0005 (2x)
```

**Efeito:**
- Spread aumentaria 0.10-0.20% em vez de 0.05-0.10%
- Mais margem por trade = recuperação mais rápida

### Problema: Recovery Buffer não aparece nos logs

**Causa Provável:** Condição `totalPnL < 0` não está sendo atingida

**Solução:**
1. Verificar se `stats.totalPnL` está sendo calculado corretamente
2. Forçar manualmente em código para teste
3. Checar logs: "PnL Calculation: Realized=X | Unrealized=Y | Total=Z"

### Problema: Spread não aumenta mesmo com buffer calculado

**Causa Provável:** Buffer calculado mas não aplicado

**Verificar em bot.js linha ~1055:**
```javascript
const pnlResidueBuffer = stats.totalPnL < 0 ? 
    calculateDynamicRecoveryBuffer(volatilityPct) : 0;

const finalSpread = SPREAD_PCT + pnlResidueBuffer;  // Precisa ser aplicado aqui
```

---

## 📈 Métricas Para Acompanhar

Quando recovery estiver ativo, monitore:

| Métrica | Normal | Com Recovery | O que Indica |
|---------|--------|--------------|-------------|
| PnL Total | +X BRL | -X → 0 → +Y | Recuperação em progresso |
| Spread | 1.5% | 1.55-1.6% | Buffer aplicado ✅ |
| Buy Price | X BRL | Mais baixo | Melhor competitividade |
| Sell Price | Y BRL | Mais alto | Melhor margem |
| Taxa Fill | 20-30% | 30-40%+ | Melhor execução |
| Volatilidade | 3.0% | Variável | Base de cálculo |

---

## 🎓 Entendendo o Cálculo

### Fórmula Simplificada

```
Volatilidade em decimal = 1.5% → 0.015

se vol <= 0.002:     fator = 1.0x
se vol >= 0.02:      fator = 2.0x
senão:               interpolação linear

Para vol=0.015:
fator = 1.0 + (2.0-1.0) × ((0.015-0.002)/(0.02-0.002))
fator = 1.0 + 1.0 × (0.013/0.018)
fator = 1.0 + 0.722
fator = 1.722x

Recovery Buffer = 0.0005 × 1.722 = 0.000861 (~0.086%)
Spread Final = 1.5% + 0.086% = 1.586%
```

---

## 📞 Suporte & Próximos Passos

### Se Recovery Funcionar Perfeitamente ✅

1. Documentar comportamento
2. Continuar teste de 24h em simulação
3. Preparar para teste com pequena quantia em live

### Se Recovery Não Ativar

1. Forçar PnL negativo manualmente para teste
2. Confirmar lógica está sendo executada
3. Ajustar parâmetros se necessário

### Se Recovery Ativar Mas Não Recuperar

1. Aumentar `RECOVERY_BUFFER_BASE` (linha 70)
2. Ajustar `RECOVERY_FATOR_MAX` para >= 3.0x
3. Considerar limitar PnL máximo permitido

---

**Status:** ✅ Sistema Pronto Para Validação de Recovery  
**Próxima Ação:** Continuar simulação por 24h, aguardando cenário natural de PnL negativo

