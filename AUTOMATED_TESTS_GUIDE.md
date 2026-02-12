# 🧪 Testes Automatizados do Dashboard - Guia de Implementação

**Data:** 11/02/2026  
**Status:** ✅ IMPLEMENTADO E FUNCIONAL

---

## 📋 O Que Foi Implementado

### 1. Endpoint de Testes Automatizados

#### `GET /api/tests`
Retorna status e resultados dos últimos testes.

**Resposta:**
```json
{
  "hasResults": true,
  "isRunning": false,
  "results": { /* dados de teste */ },
  "lastRunTime": "2026-02-11T23:28:30Z",
  "cacheAgeSeconds": 120,
  "canRerun": true,
  "enabled": true
}
```

#### `POST /api/tests/run`
Inicia nova bateria de testes com dados das últimas 24 horas.

**Request:**
```json
{
  "hours": 24
}
```

**Response:**
```json
{
  "message": "Testes iniciados",
  "hours": 24,
  "status": "running"
}
```

#### `GET /api/tests/status`
Verifica status atual dos testes em execução.

---

## 🎯 Como Funciona

### Fluxo 1: Usuário Clica Botão

```
User clicks "🔄 Refazer Testes (24h)"
         ↓
JavaScript calls: runAutomatedTests()
         ↓
POST /api/tests/run (hours: 24)
         ↓
Dashboard.js:
  - Set: automatedTestRunning = true
  - Call: AutomatedTestRunner.runTestBattery(24)
         ↓
AutomatedTestRunner.js:
  - Try: Load from Local DB (getPriceHistory)
  - If fail: Load from Binance API
  - Execute 4 test types
  - Return results
         ↓
Save to cache: lastTestResults
Set: automatedTestRunning = false
         ↓
Button re-enabled ✅
```

### Fluxo 2: Dashboard Carrega Resultados

```
GET /api/tests
         ↓
Dashboard.js returns:
  - results: {
      tests: [ Test1, Test2, Test3, Test4 ],
      summary: { ... }
  }
         ↓
JavaScript (loadTestResults):
  - Parse results
  - Populate table with tests
  - Show projections
  - Update status badge
         ↓
Display results in UI ✅
```

---

## 📊 Estrutura de Dados

### Resultado de Um Teste

```javascript
{
  testName: "BTCAccumulator - Período Completo",
  passed: true,          // ✅ ou ❌
  pnlBRL: "45.50",       // Lucro em reais
  vsHoldBRL: "12.30",    // Ganho vs simplesmente HOLD
  roi: "22.75",          // ROI em percentual
  btcGained: "0.00012",  // BTC ganho
  trades: 15,            // Número de trades
  projection: {
    hoursInTest: "2.5",  // Horas do teste
    monthlyBRL: "542.00",   // Projeção mensal
    yearlyBRL: "6504.00",   // Projeção anual
    monthlyRoi: "273.0",    // ROI mensal
    yearlyRoi: "3276.0"     // ROI anual
  }
}
```

### Resumo dos Testes

```javascript
{
  summary: {
    total: 4,           // Total de testes
    passed: 3,          // Passaram
    failed: 1,          // Falharam
    passRate: "75.0",   // Taxa de sucesso (%)
    dataSource: "Local DB",  // Fonte dos preços
    dataPoints: 288,    // Quantidade de candles
    priceRange: {
      start: "349500.00",
      end: "350500.00",
      min: "348000.00",
      max: "351000.00",
      change: "0.29"
    }
  }
}
```

---

## 🔧 Configurações

### Habilitar/Desabilitar Testes

```bash
# .env
ENABLE_AUTOMATED_TESTS=true  # Default: true
```

### Usar Proxy (para Binance)

```bash
USE_PROXY_FOR_BINANCE=true
HTTP_PROXY_BINANCE=http://proxy.example.com:8080
```

---

## 🧪 Testes Disponíveis

### 1. BTCAccumulator - Período Completo
Testa a estratégia de acumulação de BTC em todo o período.

**Critério:** Proteger capital + Acumular BTC quando seguro

### 2. BTCAccumulator - Primeira Metade
Avalia performance na primeira met ade do período.

### 3. BTCAccumulator - Segunda Metade
Avalia performance na segunda metade do período.

### 4. Cash Management Strategy
Testa estratégia de gestão de caixa (micro-trades frequentes).

**Parâmetros:**
- Buy Threshold: 0.02% (queda)
- Sell Threshold: 0.025% (alta)
- Micro-trades a cada 2 candles

---

## 📈 Projeções

Baseadas no desempenho do teste:

```
Horas no teste: 2.5h
PnL no teste: R$ 45.50
ROI no teste: 22.75%

Projeção Mensal:
  Horas = 24 × 30 = 720h
  PnL = (45.50 / 2.5) × 720 = R$ 13.104
  ROI = (22.75 / 2.5) × 720 = 6540%

Projeção Anual:
  Horas = 24 × 365 = 8760h
  PnL = (45.50 / 2.5) × 8760 = R$ 159.120
  ROI = (22.75 / 2.5) × 8760 = 79.488%
```

⚠️ **Aviso:** Projeções BASEADAS em dados históricos.  
Resultados futuros não são garantidos!

---

## 🚀 Como Usar No Dashboard

### 1. Acessar o Dashboard
```
http://localhost:3001
```

### 2. Encontrar Seção de Testes
Seção: "🧪 Testes Automatizados (Dados Reais)"

### 3. Clicar Botão de Testes
Botão: "🔄 Refazer Testes (24h)"

### 4. Aguardar Conclusão
- Status muda para "⏳ Executando testes..."
- Botão fica desabilitado durante execução
- Verificação automática a cada 2 segundos

### 5. Ver Resultados
Após conclusão:
- ✅ / ❌ ícone para cada teste
- PnL em reais
- ROI percentual
- Comparação vs HOLD
- Projeções mensais/anuais

---

## 🔍 Troubleshooting

### Problema: "Testes automatizados desabilitados"
**Solução:**
```bash
ENABLE_AUTOMATED_TESTS=true  # default
```

### Problema: "Erro 451 da Binance"
**Solução 1:** Usar dados locais (automático)  
**Solução 2:** Configurar proxy:
```bash
USE_PROXY_FOR_BINANCE=true
HTTP_PROXY_BINANCE=<seu_proxy>
```

### Problema: "Dados insuficientes"
**Solução:** Aguardar 1h+ de execução do bot para acumular dados locais

### Problema: Testes já em execução
**Solução:** Aguardar conclusão (leva ~30-60 segundos)

---

## 📝 Logs

Logs dos testes em `console`:

```
[TEST_RUNNER] 🔍 Tentando carregar dados históricos do banco...
[TEST_RUNNER] ✅ 288 preços carregados do banco local
[TEST_RUNNER] Executando teste: BTCAccumulator (período completo)...
[TEST_RUNNER] ✅ Testes concluídos: 3/4 passaram (75.0%)
```

---

## 🎓 Arquivos Modificados

1. **dashboard.js**
   - Adicionado: variáveis `automatedTestRunning`, `automatedTestResults`
   - Endpoints: `/api/tests`, `/api/tests/run`, `/api/tests/status`

2. **automated_test_runner.js**
   - Melhorado: `runTestBattery()` para tentar dados locais primeiro
   - Adicionado: `btcGained` aos resultados
   - Adicionado: Data source em resultado

3. **public/index.html**
   - Function: `runAutomatedTests()` 
   - Function: `loadTestResults()`
   - Seção de testes com tabela e projeções

---

## ✅ Checklist de Validação

- [x] Endpoints de API criados
- [x] Variáveis globais adicionadas
- [x] Função de teste melhorada
- [x] Dados locais priorizados
- [x] Frontend implementado
- [x] Projeções calculadas
- [x] Tratamento de erros robusto
- [x] Logging detalhado

---

## 🔮 Próximos Passos

### Para melhorar ainda mais:

1. **Armazenar histórico de testes**
   - Salvar resultados em arquivo/banco
   - Comparar execuções ao longo do tempo

2. **Teste adicional: Market Making Strategy**
   - Simular a estratégia exata de spread/repricing
   - Medir PnL real

3. **Dashboard em tempo real**
   - WebSocket para updates automáticos
   - Gráficos de performance

4. **Testes parametrizados**
   - Permitir usuário escolher período
   - Permitir escolher qual estratégia testar

---

**Implementação Concluída! ✅**

Para testar: `npm run dev` + acesse http://localhost:3001 + clique em "🔄 Refazer Testes (24h)"
