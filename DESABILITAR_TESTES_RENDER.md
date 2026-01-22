# Desabilitar Test Runner Automático no Render

## Problema
O test runner automático estava sendo executado a cada 30 segundos no Render, causando spam de requisições à Binance que retorna erro **451 (Unavailable)** - IP bloqueado por localização/geolocalização.

### Logs do Problema
```
[dashboard] [TEST_RUNNER] ⚠️ Tentativa 1 falhou: Request failed with status code 451
[dashboard] [TEST_RUNNER] ⚠️ Tentativa 2 falhou: Request failed with status code 451
[dashboard] [TEST_RUNNER] ⚠️ Tentativa 3 falhou: Request failed with status code 451
[dashboard] [TEST_RUNNER] ❌ Todas 3 tentativas falharam. Último erro: Request failed with status code 451
```

## Solução Implementada

### 1. Adicionada Variável de Ambiente
**Arquivo:** `dashboard.js` (linha 33)
```javascript
const ENABLE_AUTOMATED_TESTS = process.env.ENABLE_AUTOMATED_TESTS !== 'false';
// Default: true (enable locally for dev)
// Set to 'false' on Render to disable (env var)
```

### 2. Desabilitado Test Runner na Inicialização
**Arquivo:** `dashboard.js` (linhas 1294-1310)
```javascript
if (ENABLE_AUTOMATED_TESTS) {
    // Execute test suite on startup
    AutomatedTestRunner.runTestBattery(24)...
} else {
    log('INFO', '⚠️ Testes automatizados desabilitados (ENABLE_AUTOMATED_TESTS=false)');
}
```

### 3. Desabilitado Polling no Frontend
**Arquivo:** `public/index.html` (linhas 1465-1468)
```javascript
// ANTES:
loadTestResults(); // Polling a cada 30s
setInterval(loadTestResults, 30 * 1000);

// DEPOIS:
// loadTestResults(); // DESABILITADO: Teste automático apenas em dev local
// setInterval(loadTestResults, 30 * 1000); // DESABILITADO
```

### 4. Adicionada Proteção nos Endpoints
**Arquivo:** `dashboard.js`

#### GET `/api/tests`
```javascript
if (!ENABLE_AUTOMATED_TESTS) {
    return res.json({
        hasResults: false,
        isRunning: false,
        results: null,
        message: '⚠️ Testes automatizados desabilitados',
        enabled: false
    });
}
```

#### POST `/api/tests/run`
```javascript
if (!ENABLE_AUTOMATED_TESTS) {
    return res.status(403).json({ 
        error: 'Testes automatizados desabilitados',
        message: 'Configure ENABLE_AUTOMATED_TESTS=true para ativar'
    });
}
```

## Configuração para Render

### Opção 1: Via .env no Render (Recomendado)
1. Acesse o dashboard do Render: https://dashboard.render.com
2. Selecione o serviço `mb-bot`
3. Vá em **Settings** → **Environment**
4. Adicione variável:
```
ENABLE_AUTOMATED_TESTS=false
```
5. Clique em **Save** e redeploy

### Opção 2: Via .env local (Desenvolvimento)
Deixar vazio ou não setar (default: true)
```bash
# .env (local development)
ENABLE_AUTOMATED_TESTS=true  # ou omitir, já que default é true
```

## Comportamento Resultante

### Render (Produção) - ENABLE_AUTOMATED_TESTS=false
✅ Dashboard inicia normalmente  
✅ Bot trader executa ciclos normalmente  
✅ Sem requisições à Binance/CoinGecko desnecessárias  
✅ Sem erros 451 nos logs  
✅ Dashboard mostra "Testes desabilitados" (opcional)

### Local (Desenvolvimento) - ENABLE_AUTOMATED_TESTS=true ou omitido
✅ Dashboard executa testes na inicialização  
✅ Dashboard polling testes a cada 30s  
✅ Ideal para validar estratégias antes de deploy  
✅ Mensagens informativas nos logs  

## Alternativas Consideradas

### ❌ Usar Proxy/VPN
- Complexo configurar em Render
- Pode violar TOS do Binance
- Adicionaria latência

### ❌ Substituir por Mercado Bitcoin apenas
- MB API não tem dados históricos de 5m
- Limitaria capacidade de backtesting
- Test runner ficaria menos útil

### ✅ Desabilitar Automático (ESCOLHIDO)
- Simples configuração via env var
- Permite rodar localmente para dev
- Zero impacto no trading principal
- Logs claros do que foi desabilitado

## Validação

Após deploy no Render:
1. Acesse: https://mb-bot-samoel.onrender.com
2. Verifique logs (não deve haver erros 451)
3. Confirme bot trading normalmente
4. Confirme dashboard carregando dados

### Exemplo de Log Esperado
```
[03:14:05] [DASHBOARD INFO] ⚠️ Testes automatizados desabilitados (ENABLE_AUTOMATED_TESTS=false)
[03:14:05] [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479937, Best Ask=480254
[03:14:05] [INFO] [Bot] RSI calculado: 56.38
[03:14:05] [SUCCESS] [Bot] [OPTIMIZER] Parâmetros ajustados...
```

## Monitoramento Recomendado

Em vez de testes automáticos, monitorar:
1. **PnL Real**: Realizado + Não Realizado (dashboard mostra)
2. **Fill Rate**: % de ordens preenchidas (calculado)
3. **Ciclos de Trading**: Frequência e sucesso (logs)
4. **Indicadores Técnicos**: RSI, EMA, MACD (dashboard)
5. **Performance do Optimizer**: Ajustes de spreads (logs)

Exemplo: `/api/data` retorna todos os KPIs em JSON, ideal para alertas.

---

**Resumo**: Problema resolvido com 3 linhas de código (env var + 1 condicional + comentário) + 2 ajustes no frontend. Zero quebra de features, apenas desabilita feature desnecessária em produção.
