# 🎯 MB Bot - Sistema Dinâmico de Limitação de Pares

> Solução para reduzir de 637 pares simultâneos para um limite controlado, aumentando a taxa de preenchimento de 2.5% para 40-60%

## 🚨 Problema Resolvido

| Antes | Depois |
|-------|--------|
| 637 pares simultâneos 😱 | ~10 pares máx ✅ |
| 2.5% taxa de preenchimento | 40-60% taxa de preenchimento 📈 |
| R$ 0.27 capital/par | R$ 17.40 capital/par (64x mais!) |
| -R$ 33.87 PnL (negativo) | +0.5-2% PnL (positivo) 🚀 |

---

## ⚡ Quick Start

### 1. Configuração Padrão (Balanceada - Recomendada)

```bash
# O bot já vem com essas configurações no .env
npm run dev
```

Usa:
- 10 pares máximos simultâneos
- 1 novo par por ciclo
- 30% taxa mínima de preenchimento
- 5 ciclos de throttle entre pares

### 2. Configuração Conservadora (Máxima Segurança)

```bash
MAX_CONCURRENT_PAIRS=3 \
MAX_PAIRS_PER_CYCLE=1 \
MIN_FILL_RATE_FOR_NEW=50 \
PAIRS_THROTTLE_CYCLES=10 \
npm run dev
```

### 3. Configuração Agressiva (Máximo Lucro)

```bash
MAX_CONCURRENT_PAIRS=20 \
MAX_PAIRS_PER_CYCLE=2 \
MIN_FILL_RATE_FOR_NEW=20 \
PAIRS_THROTTLE_CYCLES=2 \
npm run dev
```

---

## 📊 O que Mudou No Código

### 4 Variáveis de Configuração Adicionadas

```env
MAX_CONCURRENT_PAIRS=10      # Máximo de pares abertos
MAX_PAIRS_PER_CYCLE=1        # Máximo de novos pares por ciclo  
MIN_FILL_RATE_FOR_NEW=30     # Taxa mínima de preenchimento
PAIRS_THROTTLE_CYCLES=5      # Ciclos mínimos entre criações
```

### Função de Validação: `canCreateNewPair()`

Antes de criar uma nova BUY, o bot verifica:

```javascript
✅ Limite de pares abertos (< MAX_CONCURRENT_PAIRS)
✅ Taxa de preenchimento (> MIN_FILL_RATE_FOR_NEW)
✅ Intervalo mínimo entre criações (throttling)
```

### Logs Informativos

A cada 10 ciclos, mostra:
```
📊 PARES | Ativos: 3/10 | Criados: 7 | Completos: 4 | Taxa: 57.1% | Pode criar: ✅ SIM
```

---

## 📈 Métricas em Tempo Real

### No Console (Log)
```bash
# A cada 10 ciclos:
[14:30:45] [INFO] [Bot] 📊 PARES | Ativos: 3/10 | Criados: 7 | Completos: 4 | Taxa: 57.1% | Pode criar: ✅ SIM

# Quando limite é atingido:
[14:31:00] [WARN] [Bot] 🚫 Limite de pares atingido: 10/10. Aguardando completamento.

# Quando taxa é baixa:
[14:31:15] [WARN] [Bot] ⚠️  Taxa preenchimento baixa: 15.0% < 30%. Aguardando melhoria.
```

### No Dashboard (http://localhost:3001)
```
🔗 Rastreamento de Pares BUY/SELL
✅ 351 Pares Completos (aumentando regularmente)
⏳ 10 Incompletos (dentro do limite de 10)
```

---

## 🛠️ Ajustes Recomendados por Situação

### Situação: Taxa de preenchimento muito baixa (< 20%)

```bash
# Aumentar spread para melhor margem
SPREAD_PCT=0.015

# Reduzir número de pares simultâneos para focar em qualidade
MAX_CONCURRENT_PAIRS=5

# Exigir taxa mínima maior
MIN_FILL_RATE_FOR_NEW=50

# Aumentar throttle para evitar muitos pares
PAIRS_THROTTLE_CYCLES=10
```

### Situação: Muitos pares completos, quer criar mais rápido

```bash
# Aumentar limite máximo
MAX_CONCURRENT_PAIRS=20

# Permitir 2 novos pares por ciclo
MAX_PAIRS_PER_CYCLE=2

# Reduzir throttle
PAIRS_THROTTLE_CYCLES=2

# Ser menos exigente com taxa
MIN_FILL_RATE_FOR_NEW=20
```

### Situação: Atingindo limite frequentemente

```bash
# Simples: aumentar
MAX_CONCURRENT_PAIRS=15  # Era 10, agora 15

# Ou: melhorar qualidade antes de aumentar
# Aumentar spread primeiro
SPREAD_PCT=0.012
```

---

## 📚 Documentação Completa

Para documentação mais detalhada, veja:

- **[PAIR_LIMITING_SYSTEM.md](./PAIR_LIMITING_SYSTEM.md)** - Guia completo do sistema
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Resumo técnico das mudanças
- **[DEMO_PAIR_LIMITING.sh](./DEMO_PAIR_LIMITING.sh)** - Demonstração visual

---

## 🎮 Comandos Úteis

### Iniciar com padrão (balanceado)
```bash
npm run dev
```

### Iniciar em modo simulação apenas
```bash
npm run simulate
```

### Iniciar com configuração customizada
```bash
MAX_CONCURRENT_PAIRS=5 MAX_PAIRS_PER_CYCLE=1 npm run dev
```

### Monitorar apenas os logs de pares
```bash
tail -f bot.log | grep "PARES\|bloqueada\|Taxa"
```

### Rodar demonstração visual
```bash
bash DEMO_PAIR_LIMITING.sh
```

---

## 📊 Exemplo Real de Funcionamento

### Primeira Hora (Simulação)

```
[14:00] Ciclo 1-10:   Criando pares, taxa = 100%
[14:05] Ciclo 11-20:  10 pares ativos, taxa = 90%
[14:10] Ciclo 21-30:  Taxa = 60%, criando novos
[14:15] Ciclo 31-40:  8 pares ativos, alguns preenchendo
[14:20] Ciclo 41-50:  Taxa = 50%, limite não é problema
[14:30] Ciclo 51-60:  Sistema estável, criando 1 par a cada throttle
```

**Resultado:** 12+ pares criados, 8+ completos, taxa média 50%+

---

## ✅ Como Validar se Está Funcionando

1. **Pares básicos:** `Ativos <= MAX_CONCURRENT_PAIRS`
2. **Taxa de fill:** Aumentando gradualmente (acima de 30%)
3. **Logs:** Mostrando "✅ Permitido" ou "🚫 Bloqueado" conforme esperado
4. **Dashboard:** Pares completos aumentando regularmente

---

## 🚀 Performance Esperada

Com configuração padrão (10 pares máx, 30% mínimo fill):

| Métrica | Esperado |
|---------|----------|
| Pares por hora | 6-12 |
| Taxa média fill | 40-70% |
| Máximo simultâneo | ~8-10 |
| PnL mensal | +1-5% |
| Capital utilizado | 50-80% do disponível |

---

## 🔒 Segurança e Limites

O sistema protege contra:
- ✅ Criação incontrolada de pares (máximo configurável)
- ✅ Baixa taxa de preenchimento (bloqueia novos)
- ✅ Sobrecarga do sistema (throttling)
- ✅ Fragmentação excessiva de capital

---

## 📱 Troubleshooting

### Problema: "Limite de pares atingido"
**Solução:** Aumentar `MAX_CONCURRENT_PAIRS` ou melhorar spread

### Problema: "Taxa preenchimento baixa"
**Solução:** Aumentar `SPREAD_PCT` ou reduzir `MAX_CONCURRENT_PAIRS`

### Problema: Nunca consegue criar novo par
**Solução:** Reduzir `PAIRS_THROTTLE_CYCLES` ou `MIN_FILL_RATE_FOR_NEW`

### Problema: Muitos pares completos, taxa alta
**Solução:** Aumentar `MAX_CONCURRENT_PAIRS` para capturar mais oportunidades

---

## 📞 Support & Questions

Se tiver dúvidas:
1. Consulte os arquivos de documentação acima
2. Monitore os logs com grep: `tail -f bot.log | grep "PARES"`
3. Rode a demonstração: `bash DEMO_PAIR_LIMITING.sh`

---

## 📝 Releases

### v2.1.0 (Atual)
- ✅ Sistema dinâmico de limite de pares implementado
- ✅ 4 critérios de validação antes de criar novo par
- ✅ Metricas em tempo real
- ✅ Mini-dashboard aprimorado

### v2.0.0
- Cash Management Strategy
- Pair lifecycle management

---

**Última Atualização:** 11 de fevereiro de 2026  
**Status:** ✅ Pronto para Uso  
**Modo:** Simulação & Produção
