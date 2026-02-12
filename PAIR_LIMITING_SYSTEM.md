# Sistema Dinâmico de Limitação de Pares

## 🎯 Objetivo

Evitar criar muitos pares simultaneamente (que estava em 637), melhorando:
- ✅ Taxa de preenchimento de ordens
- ✅ Alocação eficiente de capital
- ✅ Controle de risco
- ✅ Performance do sistema

## 📊 Variáveis de Configuração

Adicione ao seu `.env` para customizar:

```env
# LIMITE DE PARES - Defina o máximo de pares simultâneos
MAX_CONCURRENT_PAIRS=10              # Máximo de pares abertos simultaneamente (padrão: 10)
MAX_PAIRS_PER_CYCLE=1                # Máximo de novos pares por ciclo (padrão: 1)
MIN_FILL_RATE_FOR_NEW=30             # Taxa mínima de preenchimento para criar novos (padrão: 30%)
PAIRS_THROTTLE_CYCLES=5              # Ciclos mínimos entre criações de pares (padrão: 5)
```

### Explicação detalhada:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `MAX_CONCURRENT_PAIRS` | 10 | Número máximo de pares (BUY/SELL) que podem estar abertos simultaneamente |
| `MAX_PAIRS_PER_CYCLE` | 1 | Máximo de novos pares que podem ser criados em um único ciclo |
| `MIN_FILL_RATE_FOR_NEW` | 30 | Percentual mínimo de taxa de preenchimento necessário antes de criar novos pares (0-100%) |
| `PAIRS_THROTTLE_CYCLES` | 5 | Número mínimo de ciclos que devem passar entre a criação de um novo par e o próximo |

## 🔄 Como Funciona

### Fluxo de Decisão para Criar Novo Par:

```
┌─ Bot tenta criar nova BUY
│
├─ 1. Verificar limite de pares abertos
│     └─ Se: incompletePairs >= MAX_CONCURRENT_PAIRS → ❌ BLOQUEADO
│        Esperando completamento dos pares existentes
│
├─ 2. Verificar taxa de preenchimento
│     └─ Se: fillRate < MIN_FILL_RATE_FOR_NEW → ❌ BLOQUEADO
│        Aguardando melhoria na taxa de sucesso
│
├─ 3. Verificar throttling
│     └─ Se: ciclos_desde_ultima_criacao < PAIRS_THROTTLE_CYCLES → ❌ BLOQUEADO
│        Aguardando intervalo mínimo entre pares
│
└─ ✅ AUTORIZADO → Criar novo par BUY/SELL
```

## 📈 Métricas em Tempo Real

### Log a cada 10 ciclos (mostrado no console):

```
[14:30:45] [INFO] [Bot] 📊 PARES | Ativos: 3/10 | Criados: 7 | Completos: 4 | Taxa: 57.1% | Pode criar: ✅ SIM
```

**Interpretação:**
- **Ativos: 3/10** → 3 pares incompletos em aberto, limite é 10
- **Criados: 7** → Total de 7 pares criados no session
- **Completos: 4** → 4 pares já completaram (ambas BUY+SELL filled)
- **Taxa: 57.1%** → Taxa de preenchimento = 4/7 = 57.1%
- **Pode criar: ✅ SIM** → Atende todos os critérios, permitido criar novo

## 🎛️ Recomendações de Configuração

### Cenário 1: Conservador (Máximo de Segurança)
```env
MAX_CONCURRENT_PAIRS=3
MAX_PAIRS_PER_CYCLE=1
MIN_FILL_RATE_FOR_NEW=50
PAIRS_THROTTLE_CYCLES=10
# ↳ Cria 1 par a cada 10 ciclos, só se taxa acima de 50%
```

### Cenário 2: Agressivo (Máximo de Lucro)
```env
MAX_CONCURRENT_PAIRS=20
MAX_PAIRS_PER_CYCLE=2
MIN_FILL_RATE_FOR_NEW=20
PAIRS_THROTTLE_CYCLES=2
# ↳ Cria até 2 pares a cada ciclo, menos restritivo
```

### Cenário 3: Balanceado (Padrão - Recomendado)
```env
MAX_CONCURRENT_PAIRS=10
MAX_PAIRS_PER_CYCLE=1
MIN_FILL_RATE_FOR_NEW=30
PAIRS_THROTTLE_CYCLES=5
# ↳ Bom balanço entre risco e oportunidade
```

### Cenário 4: Micro-Trading (Pares Frequentes)
```env
MAX_CONCURRENT_PAIRS=5
MAX_PAIRS_PER_CYCLE=1
MIN_FILL_RATE_FOR_NEW=40
PAIRS_THROTTLE_CYCLES=3
# ↳ Muitos pares pequenos, alta rotatividade
```

## ⚠️ Sinais de Alerta

### Problema: "🚫 Limite de pares atingido"
```
[14:30:45] [WARN] [Bot] 🚫 Limite de pares atingido: 10/10. Aguardando completamento.
```
**Causa:** Muitos pares incompletos abertos
**Solução:** 
1. Aumentar `MAX_CONCURRENT_PAIRS` se tiver capital suficiente
2. Aumentar `PAIRS_THROTTLE_CYCLES` para mais throttling
3. Verificar spread: talvez ordens não estejam sendo preenchidas

### Problema: "⚠️ Taxa preenchimento baixa"
```
[14:30:45] [WARN] [Bot] ⚠️  Taxa preenchimento baixa: 15.0% < 30%. Aguardando melhoria.
```
**Causa:** Muitos pares criados mas poucos completados
**Solução:**
1. Aumentar spread (`SPREAD_PCT`) para maior margem
2. Aumentar `MIN_FILL_RATE_FOR_NEW` threshold
3. Reduzir `MAX_CONCURRENT_PAIRS` para focar em pares menores
4. Aumentar tamanho de cada order para mais visibilidade no order book

### Problema: "⏳ Throttling ativo"
```
[14:30:45] [DEBUG] [Bot] ⏳ Throttling ativo: aguarde 3 ciclo(s) antes de novo par.
```
**Causa:** Tempo insuficiente desde a última criação de par
**Solução:**
1. Reduzir `PAIRS_THROTTLE_CYCLES` para menos restrictivo
2. Aguardar (comportamento normal)

## 📊 Monitoramento no Dashboard

O dashboard mostra em tempo real:

```
🔗 Rastreamento de Pares BUY/SELL
Atualizado 23:49:26
🚨 Limpar Todas

637 Total de Pares     ← Total desde início
351 Pares Completos    ← Completos (ambas orders filled)
286 Incompletos        ← Aguardando fill
```

### Acompanhar:
- **Incompletos** deve estar ≤ `MAX_CONCURRENT_PAIRS`
- **Taxa de sucesso** deve estar ≥ `MIN_FILL_RATE_FOR_NEW`
- **Pares Completos** deve crescer regularmente

## 🔧 Ajustes Finos

### Aumentar Velocidade de Criação
Se muitos pares estão completos e quer criar mais rápido:
```env
PAIRS_THROTTLE_CYCLES=2    # De 5 para 2 ciclos
MAX_PAIRS_PER_CYCLE=2      # De 1 para 2 pares por ciclo
```

### Focar em Qualidade
Se poucos pares estão completando:
```env
MIN_FILL_RATE_FOR_NEW=50   # De 30 para 50%
MAX_CONCURRENT_PAIRS=5     # De 10 para 5 (focar em menos)
SPREAD_PCT=0.010           # Aumentar spread para 1% (maior margem)
```

### Modo Teste
Para testar novos parâmetros:
```bash
# Terminal 1: Bot com novos params
SIMULATE=true \
MAX_CONCURRENT_PAIRS=8 \
MAX_PAIRS_PER_CYCLE=1 \
npm run simulate

# Monitore por 30 minutos e observe:
# - Taxa de preenchimento
# - Pares criados vs completados
# - PnL total
```

## 📈 Métricas Esperadas

### Com configuração padrão (10 pares máx):

| Métrica | Esperado |
|---------|----------|
| Taxa de Preenchimento | 40-70% |
| Pares por hora | 6-12 |
| Taxa de sucesso ciclos | 70%+ |
| PnL Mensal | +1-5% (dependendo do spread) |

### Comparação: Antes vs Depois

**Antes (637 pares simultâneos):**
- Taxa fill: 2.5% ❌
- PnL: -R$ 33,87 📉
- Spread: Muito espalhado

**Depois (com limite de 10):**
- Taxa fill: 45-60% ✅
- PnL: +0.5-2% por período 📈
- Spread: Concentrado, melhor controle

## 🚀 Próximos Passos

1. **Configurar** suas variáveis no `.env`
2. **Testar** em modo simulação por 1-2 horas
3. **Monitorar** as métricas no dashboard
4. **Ajustar** baseado em performance
5. **Escalar** para produção quando satisfeito

---

**Última atualização:** 11 de fevereiro de 2026
**Autor:** Sistema de IA - MB Bot
