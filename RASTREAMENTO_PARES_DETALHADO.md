# RASTREAMENTO DE PARES BUY/SELL COM IDENTIFICADORES

## 📋 Visão Geral

Um sistema foi implementado para:
1. **Rastrear identificadores únicos** para cada par BUY/SELL
2. **Validar que as ordens são criadas em pares** (uma BUY + uma SELL)
3. **Acompanhar execução** de cada par (completo, aguardando SELL, aguardando BUY)
4. **Exibir no frontend** o status detalhado dos pares

---

## 🔧 Componentes Técnicos

### 1. Base de Dados
**Alteração**: Adicionada coluna `pair_id` na tabela `orders`
```sql
ALTER TABLE orders ADD COLUMN pair_id TEXT;
```

Campo armazena identificador único do par (ex: `PAIR_1768360375627_4k9r2xz`)

### 2. Geração de Pair ID (bot.js)

**Quando uma BUY é colocada**:
```javascript
pairId = `PAIR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

**Quando uma SELL é colocada**:
- Se há BUY aberta sem SELL par: reutiliza `pairId` da BUY
- Se não há BUY: gera novo `pairId` para SELL aguardando BUY

### 3. Rastreamento de Pares (bot.js)

```javascript
let pairMapping = new Map(); // pairId -> {buyOrder, sellOrder}
```

Mapa global que registra:
```javascript
{
    buyOrder: { id, price, qty, timestamp },
    sellOrder: { id, price, qty, timestamp }
}
```

### 4. API REST (dashboard.js)

**Endpoint**: `GET /api/pairs`

**Resposta**:
```json
{
    "timestamp": "2026-01-14T03:20:00.000Z",
    "totalPairs": 5,
    "completePairs": 3,
    "incompletePairs": 2,
    "pairs": [
        {
            "pairId": "PAIR_1768360375627",
            "status": "COMPLETO",
            "buyOrder": {
                "id": "01KEX87E...",
                "price": "508875.09",
                "qty": "0.00001013"
            },
            "sellOrder": {
                "id": "01KEX87F...",
                "price": "517076.21",
                "qty": "0.00001014"
            },
            "spread": "1.61%",
            "roi": "1.01%"
        },
        {
            "pairId": "PAIR_1768360385921",
            "status": "AGUARDANDO_SELL",
            "buyOrder": { ... },
            "sellOrder": null,
            "spread": "-",
            "roi": "-"
        }
    ]
}
```

---

## 🎯 Fluxo de Funcionamento

### Ciclo Normal (Par Completo)

```
Ciclo N:
  └─ Calcular preços de compra/venda
     └─ BUY aberta? NÃO
        └─ Gerar pair_id: PAIR_1768360375627
        └─ Colocar BUY @ 508875.09
        └─ Salvar no BD com pair_id
        └─ Registrar em pairMapping
           
Ciclo N+1:
  └─ BUY preenchida? SIM
     └─ Atualizar no BD (status = 'filled')
     └─ Sincronizar com BD
        └─ SELL aberta para o par? NÃO
        └─ Reutilizar pair_id da BUY
        └─ Colocar SELL @ 517076.21
        └─ Salvar no BD com mesmo pair_id
        └─ Registrar em pairMapping (completo agora)

Ciclo N+2:
  └─ SELL preenchida? SIM
     └─ Atualizar no BD (status = 'filled')
     └─ Calcular resultado:
        └─ Spread capturado: 1.61%
        └─ ROI líquido: 1.01% (descontando 0.3% de fees)
        └─ Registrar resultado
```

### Par Incompleto

```
Estado atual: 3 BUY, 2 SELL (1 BUY sem par)

Ações do bot:
  ├─ Bloqueio de validação ativa (impedindo nova BUY)
  ├─ Aguardando preenchimento de uma SELL
  └─ Quando SELL é preenchida:
     └─ Reutiliza pair_id de BUY aguardando
     └─ Par fica completo
```

---

## 📊 Validação via Linha de Comando

**Script**: `validar_pares_identificadores.sh`

```bash
./validar_pares_identificadores.sh
```

**Saída**:
```
🔍 VALIDAÇÃO DE PARES COM IDENTIFICADORES
==========================================

📊 RESUMO GERAL
Pair ID                Total Ordens  BUY  SELL  Status
-------------------------------------------------------------------------
PAIR_1768360375627     2             1    1     ✅ COMPLETO
PAIR_1768360385921     1             1    0     ⏳ AGUARD SELL
PAIR_1768360395234     2             1    1     ✅ COMPLETO

📋 DETALHES POR PAR:

Pair ID                BUY          SELL         Spread  ROI Liquido
------------------------------------------------------------------
PAIR_1768360375627     🔵 508875.09 🔴 517076.21 1.61%   1.01%
PAIR_1768360385921     🔵 511147.92 ❌           -       -
PAIR_1768360395234     🔵 508225.00 🔴 514240.41 1.18%   0.58%
```

---

## 🌐 Visualização no Frontend

**Widget HTML**: Disponível em `PAIRS_WIDGET.html`

**Características**:
- ✅ Atualização automática a cada 10 segundos
- 📊 Resumo com contadores (Total, Completos, Incompletos, ROI Médio)
- 📋 Tabela detalhada com:
  - Pair ID (truncado para exibição)
  - Status visual (✅ COMPLETO / ⏳ AGUARDANDO)
  - ID de BUY e preço
  - ID de SELL e preço
  - Spread calculado
  - ROI líquido (descontando fees)

**Cores**:
- 🟢 Verde: Pares completos, ROI positivo
- 🟡 Amarelo: Pares incompletos
- 🔴 Vermelho: ROI negativo

---

## 🔍 Validações Implementadas

### 1. Sincronização com BD
A cada ciclo, o bot carrega as ordens abertas e reconstrói o mapa de pares:
```javascript
pairMapping.clear();
// Reconstruir a partir das ordens da BD
for (const order of openOrders) {
    if (order.pair_id) {
        if (!pairMapping.has(order.pair_id)) {
            pairMapping.set(order.pair_id, { buyOrder: null, sellOrder: null });
        }
        // Registrar BUY ou SELL no par
    }
}
```

### 2. Reutilização Inteligente de Pair ID
```javascript
if (side === 'sell') {
    const buyOrder = activeOrders.get('buy');
    if (buyOrder && buyOrder.pairId && !pairMapping.get(buyOrder.pairId).sellOrder) {
        // Há BUY sem SELL, reutilizar pair_id
        pairId = buyOrder.pairId;
    } else {
        // Gerar novo pair_id
        pairId = `PAIR_${Date.now()}_...`;
    }
}
```

### 3. Bloqueio de Pares Desbalanceados
Se há mais BUY que SELL:
```javascript
const pairValidation = validateOrderPairs();
if (!pairValidation.isBalanced && pairValidation.needsSell) {
    log('WARN', `Aguardando SELL para completar par BUY - não colocando BUY.`);
    // Bloqueio previne acúmulo de múltiplos BUY sem SELL
}
```

---

## 📈 Métricas Capturadas

Para cada par completo:
- **Spread Bruto**: `(sellPrice - buyPrice) / buyPrice × 100%`
- **Fees**: 0.30% maker para cada lado (0.60% total)
- **ROI Líquido**: `Spread - 0.60%`

Exemplo:
- BUY @ 508.875
- SELL @ 517.076
- Spread: 1.61%
- ROI Líquido: **1.01%**

---

## ✅ Validação de Funcionamento

### Checklist Implementado
- ✅ Coluna `pair_id` adicionada ao BD
- ✅ Geração de pair_id ao colocar BUY
- ✅ Reutilização de pair_id para SELL correspondente
- ✅ Sincronização de pares da BD a cada ciclo
- ✅ Mapa `pairMapping` mantido atualizado
- ✅ Bloqueio de pares desbalanceados ativo
- ✅ API REST `/api/pairs` fornecendo dados
- ✅ Script de validação CLI funcionando
- ✅ Widget HTML para frontend pronto

### Resultado Esperado
Você agora poderá:
1. **Verificar CLI**: `./validar_pares_identificadores.sh`
   - Ver todos os pares com seus IDs
   - Confirmar se são válidos (1 BUY + 1 SELL)
   - Verificar spread e ROI de cada par

2. **Acompanhar Frontend**: 
   - Visualizar pares em tempo real no dashboard
   - Ver status de execução (completo, incompleto)
   - Identificar quais pares estão bloqueados

3. **Monitorar Logs**:
   ```
   [SUCCESS] Ordem BUY ... colocada ..., Pair: PAIR_1768360375627...
   [SUCCESS] Ordem SELL ... colocada ..., Pair: PAIR_1768360375627...
   ```

---

## 📝 Próximos Passos Opcionais

1. **Persistência de Estatísticas**:
   - Armazenar par_id + resultados em tabela separada
   - Gerar relatório de performance por par

2. **Alertas**:
   - Notificar quando par fica aberto >30 ciclos
   - Avisar se spread está abaixo do mínimo aceitável

3. **Análise**:
   - ROI médio por hour/day
   - Taxa de sucesso dos pares
   - Identificar padrões de spreads ruins

4. **Interface Web Melhorada**:
   - Gráfico de spread histórico
   - Filtros por status/período
   - Export de dados

---

**Status**: ✅ **IMPLEMENTADO E OPERACIONAL**
**Data**: 14 de Janeiro de 2026
**Tempo**: ~20 minutos de desenvolvimento
