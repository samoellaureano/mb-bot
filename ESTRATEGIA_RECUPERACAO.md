# Estratégia de Recuperação do Bot

## 📊 Monitor de Recuperação (PnL Residual)

O **Monitor de Recuperação** é ativado automaticamente quando o bot está em **prejuízo** (PnL < R$ 0,00).

### 🎯 Objetivo
Recuperar o capital perdido através de ajustes automáticos na estratégia de trading, tornando o bot mais conservador e seletivo.

---

## 🔧 Como Funciona a Recuperação

### 1. **Recovery Buffer Dinâmico** 📈

Quando o PnL está negativo, o bot adiciona automaticamente um **buffer de segurança** ao spread:

```javascript
// Se PnL < 0:
pnlResidueBuffer = calculateDynamicRecoveryBuffer(volatilidade)
finalSpread = spreadNormal + pnlResidueBuffer
```

**Valores do Recovery Buffer:**
- **Base**: 0.05% (0.0005)
- **Mínimo**: 0.05% × 1.0 = **0.05%** (em baixa volatilidade)
- **Máximo**: 0.05% × 2.0 = **0.10%** (em alta volatilidade)

**Escala de Volatilidade:**
- Volatilidade ≤ 0.20%: Buffer = 0.05%
- Volatilidade entre 0.20% e 2.00%: Buffer aumenta linearmente
- Volatilidade ≥ 2.00%: Buffer = 0.10%

**Exemplo Prático:**
```
Spread Normal: 0.15%
Volatilidade: 1.0%
Recovery Buffer: 0.075%
───────────────────────
Spread Final: 0.225% ← Mais conservador!
```

---

### 2. **Otimização Automática de Parâmetros** ⚙️

A cada 5 ciclos, o bot analisa o desempenho recente e ajusta:

**Quando PnL está NEGATIVO:**
```
✅ REDUZ tamanho das ordens em 5%
   → Menos risco por operação
   
✅ AUMENTA spread em 2.5%
   → Maior margem de lucro por trade
   
✅ Opera em modo conservador
   → Apenas em condições favoráveis
```

**Quando PnL está POSITIVO:**
```
✅ AUMENTA tamanho das ordens em 5%
   → Aproveita o momentum
   
✅ REDUZ spread em 2.5%
   → Mais oportunidades de fill
   
✅ Opera de forma agressiva
   → Maximiza ganhos
```

---

### 3. **Filtros de Segurança Ampliados** 🛡️

Durante recuperação, o bot é **mais seletivo**:

#### Filtro de Convicção
```
Se Convicção < 40% E Volatilidade EXTREMA:
   → PULA O CICLO (não opera)
```

#### Modo Conservador
```
Se Convicção < 50%:
   ✅ Spread × 1.2 (20% maior)
   ✅ Tamanho × 0.6 (40% menor)
   ✅ Maior margem de segurança
```

---

## 📉 Estratégia em Ação (Exemplo Real)

**Situação Atual:**
```
Capital Inicial: R$ 220,00
Saldo Atual:     R$ 214,70
PnL:             R$ -5,30 ❌
ROI:             -2,41%
```

**Ajustes Automáticos Aplicados:**

1. **Recovery Buffer Ativo:**
   ```
   Spread base: 1.50%
   + Buffer:    0.08% (baseado em volatilidade 0.53%)
   = Spread:    1.58%
   ```

2. **Tamanho de Ordem Reduzido:**
   ```
   Ordem original: 0.00001 BTC
   Após ajuste:    ~0.0000095 BTC (-5%)
   ```

3. **Filtros Mais Rigorosos:**
   ```
   ✅ Só opera se convicção > 40%
   ✅ Evita volatilidade extrema
   ✅ Aumenta spread em baixa convicção
   ```

---

## 📊 Visualização no Monitor

O gráfico de **PnL Residual** mostra:

- **Linha Amarela**: Evolução do prejuízo
- **Linha Verde Tracejada**: Meta (R$ 0,00)
- **Eixo Y à Direita**: Facilita leitura durante updates

**Interpretação:**
```
Linha amarela SUBINDO ↗️  = Recuperando (prejuízo diminuindo)
Linha amarela DESCENDO ↘️ = Piorando (prejuízo aumentando)
Alcançou R$ 0,00 ✅      = Recuperação completa!
```

---

## 🎯 Objetivo da Estratégia

**Prioridade: Preservação de Capital**

1. ✅ **Reduzir risco** → Ordens menores
2. ✅ **Aumentar margem** → Spreads maiores  
3. ✅ **Ser seletivo** → Apenas boas oportunidades
4. ✅ **Recuperar gradualmente** → Lucros consistentes e pequenos

**Não faz:**
- ❌ Aumentar risco para "recuperar rápido"
- ❌ Operar em condições desfavoráveis
- ❌ Ignorar sinais de mercado

---

## 📈 Quando Sai do Modo Recuperação?

O monitor **desaparece automaticamente** quando:

```
PnL ≥ R$ 0,00
```

Nesse momento:
- ✅ Recovery buffer volta a 0%
- ✅ Parâmetros normalizados
- ✅ Estratégia volta ao normal

---

## 💡 Dicas de Monitoramento

**Sinais Positivos:**
- 📈 PnL residual subindo no gráfico
- ✅ Taxa de fill aumentando
- ✅ Operações lucrativas consistentes

**Sinais de Atenção:**
- 📉 PnL residual descendo
- ⚠️ Muitos ciclos pulados (baixa convicção)
- ⚠️ Volatilidade muito alta (> 2%)

---

## 🔍 Exemplo de Recuperação Bem-Sucedida

```
Dia 1:  PnL = -R$ 5,30
Dia 2:  PnL = -R$ 3,80 (recuperou R$ 1,50)
Dia 3:  PnL = -R$ 1,90 (recuperou R$ 1,90)
Dia 4:  PnL = +R$ 0,50 ✅ (recuperação completa!)
```

**Características:**
- Recuperação gradual e consistente
- Sem trades agressivos
- Aproveitou momentos de baixa volatilidade
- Spread ampliado garantiu margem de segurança

---

## ⚙️ Configurações de Recuperação

**Constantes no código:**
```javascript
RECOVERY_BUFFER_BASE = 0.0005  // 0.05% base
VOL_MIN_RECOVERY    = 0.002   // 0.20%
VOL_MAX_RECOVERY    = 0.02    // 2.00%
RECOVERY_FATOR_MIN  = 1.0x
RECOVERY_FATOR_MAX  = 2.0x
```

**Ajustes a cada 5 ciclos:**
```javascript
PARAM_ADJUST_FACTOR = 0.05    // 5% de ajuste
PERFORMANCE_WINDOW  = 5       // Últimos 5 ciclos
```

---

## 📝 Resumo Executivo

**O que acontece em modo recuperação:**

1. 🎯 Bot fica mais **conservador**
2. 📊 Spreads **aumentam** automaticamente
3. 📉 Tamanho das ordens **reduz**
4. 🛡️ Filtros de qualidade ficam mais **rigorosos**
5. 📈 Busca lucros **pequenos e consistentes**
6. ✅ Objetivo: **zerar o prejuízo** gradualmente

**Filosofia:**
> "Melhor recuperar devagar e seguro, do que arriscar e perder mais."
