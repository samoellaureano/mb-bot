# 🏗️ Arquitetura do MB Bot - Melhorias Implementadas

## 📋 Visão Geral

O MB Bot agora possui uma arquitetura robusta com componentes de nível empresarial:

```
┌─────────────────────────────────────────────────────────────┐
│                    MB BOT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   config.js  │  │  logger.js   │  │ error-       │       │
│  │              │  │              │  │ handler.js   │       │
│  │ • Validação  │  │ • Estruturado│  │ • Erros      │       │
│  │ • Schema     │  │ • Múltiplos  │  │ • Recuperação│       │
│  │ • Defaults   │  │   outputs    │  │ • Retry      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                    │              │
│         └─────────────────┼────────────────────┘              │
│                           │                                   │
│  ┌──────────────────────────────────────────────────┐        │
│  │              Core Application                     │        │
│  │              (bot.js / dashboard.js)             │        │
│  └──────────────────────────────────────────────────┘        │
│         │                    │                      │         │
│  ┌──────▼─────┐  ┌──────────▼───────┐  ┌──────────▼───┐    │
│  │  Circuit   │  │  Health Check    │  │   Database   │    │
│  │  Breaker   │  │                  │  │   (SQLite)   │    │
│  └────────────┘  └──────────────────┘  └──────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────┐        │
│  │         Mercado Bitcoin API                       │        │
│  │    (com Circuit Breaker + Retry)                │        │
│  └──────────────────────────────────────────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Componentes Principais

### 1. **config.js** - Gerenciamento de Configuração
**Propósito**: Centralizar todas as configurações com validação rigorosa

**Features**:
- ✅ Schema de validação automática
- ✅ Suporte a tipos (string, number, boolean)
- ✅ Validação de limites (min/max)
- ✅ Padrões sensatos para cada config
- ✅ Defaults quando valor não fornecido
- ✅ Relatório de erros e avisos

**Uso**:
```javascript
const config = require('./config');
console.log(config.CYCLE_SEC);      // 15
console.log(config.SIMULATE);       // true
console.log(config.IS_PRODUCTION);  // false
```

**Schema Suportado**:
```javascript
{
  required: true/false,           // Obrigatória?
  type: 'string'|'number'|'boolean',
  default: valor,                 // Valor padrão
  pattern: /regex/,              // Para strings
  enum: ['a', 'b'],              // Valores permitidos
  min: 0, max: 100               // Para números
}
```

---

### 2. **logger.js** - Logging Estruturado
**Propósito**: Sistema de logging consistente em toda aplicação

**Features**:
- ✅ 5 níveis: DEBUG, INFO, SUCCESS, WARN, ERROR
- ✅ Múltiplos outputs: console (com cores), arquivo
- ✅ Filtro por nível mínimo configurável
- ✅ Métricas automáticas (total, por nível, errors)
- ✅ Timestamps em português
- ✅ Suporte a dados estruturados (JSON)

**Uso**:
```javascript
const Logger = require('./logger');
const log = new Logger('MyComponent');

log.debug('Mensagem de debug', { extra: 'data' });
log.info('Informação');
log.success('Operação bem-sucedida');
log.warn('Aviso');
log.error('Erro', { code: 'ERROR_CODE' });

// Obter métricas
const metrics = log.getMetrics();
console.log(metrics); // { total: N, byLevel: {...}, errorRate: '5%' }
```

**Saída**:
```
15:13:15 [INFO] [MyComponent] Mensagem | {"extra":"data"}
15:13:16 [SUCCESS] [MyComponent] Operação bem-sucedida
15:13:17 [ERROR] [MyComponent] Erro | {"code":"ERROR_CODE"}
```

---

### 3. **error-handler.js** - Tratamento de Erros Robusto
**Propósito**: Hierarquia de erros customizados + recuperação

**Tipos de Erro**:
- `AppError` - Base para todos os erros
- `APIError` - Erros de API (com flag `retryable`)
- `ValidationError` - Validação de entrada
- `ConfigError` - Problemas de configuração
- `BusinessError` - Erros de negócio (saldo, etc)
- `TimeoutError` - Timeouts em operações

**Features**:
- ✅ Erros tipados com código único
- ✅ Contexto estruturado
- ✅ Suporte a retry automático
- ✅ Estatísticas de erro (frequência, histórico)
- ✅ Stack trace preservado

**Uso**:
```javascript
const { 
  APIError, 
  ValidationError, 
  ErrorHandler,
  retryAsync 
} = require('./error-handler');

// Lançar erro customizado
throw new APIError('Falha na API', 503, 'MercadoBitcoin');

// Tratador centralizado
const errorHandler = new ErrorHandler(logger);
try {
  // ... código
} catch (error) {
  const handled = errorHandler.handle(error, { operation: 'placeOrder' });
  console.log(handled.toJSON());
}

// Retry automático
const result = await retryAsync(
  async () => fetchData(),
  {
    maxRetries: 3,
    delay: 1000,
    backoff: 2,
    onRetry: (attempt, err, delay) => {
      console.log(`Tentativa ${attempt}, aguardando ${delay}ms...`);
    }
  }
);

// Estatísticas
const stats = errorHandler.getStats();
```

---

### 4. **circuit-breaker.js** - Proteção de API
**Propósito**: Evitar cascata de falhas em APIs instáveis

**Estados**:
- **CLOSED** (normal): Requisições passam normalmente
- **OPEN** (proteção): Requisições rejeitadas imediatamente (fail-fast)
- **HALF_OPEN** (teste): Testa se serviço se recuperou

**Lógica**:
```
N falhas consecutivas
        ↓
   Estado: OPEN
        ↓
Esperar X segundos
        ↓
   Estado: HALF_OPEN
        ↓
M sucessos → CLOSED (recuperado)
    OU
1 falha → OPEN (ainda quebrado)
```

**Uso**:
```javascript
const CircuitBreaker = require('./circuit-breaker');

const breaker = new CircuitBreaker({
  name: 'MercadoBitcoin',
  failureThreshold: 5,      // Erros para abrir
  successThreshold: 2,      // Sucessos para fechar
  timeout: 60000,           // ms antes de tentar HALF_OPEN
});

// Usar com fallback
try {
  const data = await breaker.execute(
    () => fetchFromAPI(),
    (error) => getLocalCache()  // Fallback se circuit aberto
  );
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    console.log('API indisponível, usando cache');
  }
}

// Status
console.log(breaker.getStatus());
```

---

### 5. **health-check.js** - Monitoramento de Saúde
**Propósito**: Verificar regularmente saúde de componentes críticos

**Features**:
- ✅ Registrar múltiplos health checks
- ✅ Checks críticos vs não-críticos
- ✅ Timeout por check
- ✅ Métricas (tempo médio, taxa de falha)
- ✅ Status geral (HEALTHY, DEGRADED, UNHEALTHY)

**Uso**:
```javascript
const HealthCheck = require('./health-check');

const hc = new HealthCheck(logger);

// Registrar checks
hc.register('Database', async () => {
  const result = await db.ping();
  if (!result) throw new Error('DB não responde');
}, { critical: true, timeout: 5000 });

hc.register('API', async () => {
  const result = await api.health();
  if (!result) throw new Error('API não responde');
}, { critical: true });

hc.register('Cache', async () => {
  const result = await redis.ping();
  if (!result) throw new Error('Cache não responde');
}, { critical: false });  // Não-crítico, pode estar indisponível

// Executar todos os checks
const report = await hc.runAll();
console.log(report);  // { status, results, duration }

// Obter status sem executar
const status = hc.getStatus();
```

**Status Retornado**:
```json
{
  "status": "HEALTHY",
  "lastCheck": {
    "timestamp": "2026-01-20T15:13:15Z",
    "status": "HEALTHY",
    "duration": 150,
    "results": {
      "Database": { "status": "OK", "responseTime": 50 },
      "API": { "status": "OK", "responseTime": 100 }
    }
  },
  "metrics": {
    "totalChecks": 10,
    "failedChecks": 0,
    "failureRate": "0%",
    "avgResponseTime": 75
  }
}
```

---

## 🧪 Testes

### Executar Testes
```bash
node test-core.js
```

### Testes Inclusos
- ✅ Logger em todos os níveis
- ✅ Filtro de nível mínimo
- ✅ Circuit Breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
- ✅ Health Check com checks críticos
- ✅ Hierarquia de erros
- ✅ ErrorHandler com estatísticas
- ✅ Retry automático com backoff

---

## 🚀 Próximas Melhorias

### Curto Prazo
- [ ] Integrar Logger no bot.js (substituir console.log)
- [ ] Usar Config no bot.js em vez de .env direto
- [ ] Circuit Breaker na API do MercadoBitcoin
- [ ] Health Check no bot.js (registrar na inicialização)

### Médio Prazo
- [ ] Dashboard de métricas (logs, errors, health checks)
- [ ] Persistência de logs em banco de dados
- [ ] Alertas automáticos (Slack, Email)
- [ ] Testes de integração

### Longo Prazo
- [ ] Tracing distribuído (OpenTelemetry)
- [ ] Observabilidade com Prometheus/Grafana
- [ ] Análise automática de performance
- [ ] Predição de problemas com ML

---

## 📊 Comparação: Antes vs Depois

### Antes
```javascript
// Configuração caótica em vários arquivos
const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT) || 0.006;
if (!SPREAD_PCT || SPREAD_PCT < 0 || SPREAD_PCT > 1) {
  console.error('SPREAD_PCT inválido');
  process.exit(1);
}

// Logging inconsistente
console.log(`[BOT] Operação realizada`);
console.error(`[BOT] Erro crítico`);
logger.warn(`Aviso`);

// Sem tratamento de erro padrão
try {
  await api.call();
} catch (e) {
  console.error(e);
  process.exit(1);
}

// Sem proteção contra cascata de falhas
while (true) {
  try {
    await api.call();
  } catch (e) {
    // Tenta novamente IMEDIATAMENTE → amplifica falhas
  }
}
```

### Depois
```javascript
// Configuração centralizada e validada
const config = require('./config');
// Automáticamente validado contra schema
console.log(config.SPREAD_PCT);  // Garantido válido

// Logging estruturado e consistente
const log = new Logger('Bot');
log.info('Operação realizada');
log.error('Erro crítico', { code: 'ERR_001' });

// Tratamento de erro tipado
try {
  await api.call();
} catch (error) {
  const handled = errorHandler.handle(error, { operation: 'apiCall' });
  if (handled.retryable) {
    // Pode retentar
  }
}

// Proteção contra cascata de falhas
const breaker = new CircuitBreaker({ name: 'API' });
try {
  const result = await breaker.execute(
    () => api.call(),
    () => getLocalCache()  // Fallback
  );
} catch (e) {
  log.error('Falha irreparável', { error: e.message });
}
```

---

## 🎯 Benefícios

| Aspecto | Antes | Depois |
|--------|-------|--------|
| **Configuração** | Caótica, sem validação | Centralizada, validada |
| **Logging** | Inconsistente, sem estrutura | Estruturado, múltiplos níveis |
| **Erros** | Sem padrão | Tipados, retryable, com contexto |
| **Resiliência** | Nenhuma | Circuit Breaker + Retry automático |
| **Monitoramento** | Manual, ad-hoc | Health Checks automáticos |
| **Testes** | Nenhum | 15+ testes unitários |
| **Documentação** | Espalhada | Centralizada e estruturada |
| **Observabilidade** | Baixa | Alta (métricas, logs, health) |

---

## 📝 Próximos Passos

1. **Integrar Config**: Usar `config.js` em vez de `process.env` direto
2. **Integrar Logger**: Substituir `console.log` por `log.info()` etc
3. **Adicionar Circuit Breaker**: Envolver chamadas de API
4. **Registrar Health Checks**: Na inicialização do bot
5. **Criar Dashboard**: Para visualizar métricas e logs
6. **Adicionar Alertas**: Notificações em caso de problemas

Comece pelo passo 1! 🚀
