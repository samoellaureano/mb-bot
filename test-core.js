/**
 * Testes unitários básicos para componentes críticos
 * Execute com: node test-core.js
 */

const assert = require('assert');
const Logger = require('./logger');
const CircuitBreaker = require('./circuit-breaker');
const HealthCheck = require('./health-check');
const { 
  ValidationError, 
  APIError, 
  ErrorHandler, 
  retryAsync 
} = require('./error-handler');

const logger = new Logger('Test');
let testsPassed = 0;
let testsFailed = 0;

/**
 * Auxiliar para testes
 */
function test(name, fn) {
  try {
    fn();
    logger.success(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    logger.error(`✗ ${name}`, { error: error.message });
    testsFailed++;
  }
}

// ===== TESTES DO LOGGER =====
logger.info('Iniciando testes...');

test('Logger deve registrar em todos os níveis', () => {
  const testLogger = new Logger('Test');
  testLogger.debug('debug');
  testLogger.info('info');
  testLogger.success('success');
  testLogger.warn('warn');
  testLogger.error('error');
  
  const metrics = testLogger.getMetrics();
  assert(metrics.total === 5, 'Deveria ter 5 logs');
});

test('Logger deve filtrar por nível mínimo', () => {
  const testLogger = new Logger('Test', { enableConsole: false, enableFile: false });
  testLogger.minLevel = 2; // WARN+
  testLogger.debug('não deve aparecer');
  testLogger.info('não deve aparecer');
  testLogger.warn('deve aparecer');
  
  const metrics = testLogger.getMetrics();
  assert(metrics.byLevel.WARN === 1, 'Deveria ter 1 WARN');
});

// ===== TESTES DO CIRCUIT BREAKER =====

test('Circuit Breaker deve começar em CLOSED', () => {
  const cb = new CircuitBreaker({ name: 'Test' });
  assert(cb.state === 'CLOSED', 'Estado inicial deve ser CLOSED');
});

test('Circuit Breaker deve abrir após falhas consecutivas', async () => {
  const cb = new CircuitBreaker({ 
    name: 'Test',
    failureThreshold: 3,
  });
  
  const failFn = async () => { throw new Error('Fail'); };
  
  for (let i = 0; i < 3; i++) {
    try {
      await cb.execute(failFn);
    } catch (e) {
      // Esperado
    }
  }
  
  assert(cb.state === 'OPEN', 'Estado deve ser OPEN após 3 falhas');
});

test('Circuit Breaker deve rejeitar em estado OPEN', async () => {
  const cb = new CircuitBreaker({ name: 'Test', timeout: 10000 });
  cb.state = 'OPEN';
  cb.lastErrorTime = Date.now();
  
  try {
    await cb.execute(async () => {});
    throw new Error('Deveria ter lançado erro');
  } catch (error) {
    assert(error.code === 'CIRCUIT_OPEN', 'Erro deve ser CIRCUIT_OPEN');
  }
});

test('Circuit Breaker deve resetar após sucessos', async () => {
  const cb = new CircuitBreaker({
    name: 'Test',
    successThreshold: 2,
  });
  
  cb.state = 'HALF_OPEN';
  
  await cb.execute(async () => ({ ok: true }));
  assert(cb.state === 'HALF_OPEN', 'Ainda deve estar em HALF_OPEN');
  
  await cb.execute(async () => ({ ok: true }));
  assert(cb.state === 'CLOSED', 'Deve voltar a CLOSED');
});

// ===== TESTES DO HEALTH CHECK =====

test('Health Check deve registrar checks', () => {
  const hc = new HealthCheck(logger);
  hc.register('DB', async () => ({ ok: true }));
  hc.register('API', async () => ({ ok: true }));
  
  assert(hc.checks.size === 2, 'Deveria ter 2 checks registrados');
});

test('Health Check deve rodar todos os checks', async () => {
  const hc = new HealthCheck(logger);
  let called = 0;
  
  hc.register('Check1', async () => { called++; return { ok: true }; });
  hc.register('Check2', async () => { called++; return { ok: true }; });
  
  await hc.runAll();
  assert(called === 2, 'Ambos os checks devem ter sido executados');
  assert(hc.status === 'HEALTHY', 'Status deve ser HEALTHY');
});

test('Health Check deve marcar como UNHEALTHY em erro crítico', async () => {
  const hc = new HealthCheck(logger);
  
  hc.register('CriticalCheck', async () => { 
    throw new Error('Fail');
  }, { critical: true });
  
  hc.register('NonCriticalCheck', async () => { 
    throw new Error('Fail');
  }, { critical: false });
  
  await hc.runAll();
  assert(hc.status === 'UNHEALTHY', 'Status deve ser UNHEALTHY com erro crítico');
});

// ===== TESTES DE ERRO =====

test('ValidationError deve ter código correto', () => {
  const err = new ValidationError('Test', 'field');
  assert(err.code === 'VALIDATION_ERROR', 'Código deve ser VALIDATION_ERROR');
  assert(err.statusCode === 400, 'Status deve ser 400');
});

test('APIError deve ser retryable para status 500', () => {
  const err = new APIError('Test', 500, 'API');
  assert(err.retryable === true, 'Deve ser retryable para 500');
});

test('ErrorHandler deve contar erros', () => {
  const handler = new ErrorHandler(logger);
  
  handler.handle(new ValidationError('Error 1', 'field1'));
  handler.handle(new ValidationError('Error 2', 'field2'));
  handler.handle(new APIError('Error 3', 500, 'API'));
  
  const stats = handler.getStats();
  assert(stats.totalErrors === 3, 'Deveria ter 3 erros totais');
  assert(stats.byCode.VALIDATION_ERROR === 2, 'Deveria ter 2 ValidationError');
});

// ===== TESTES DE RETRY =====

test('retryAsync deve retentar em caso de falha', async () => {
  let attempts = 0;
  
  const result = await retryAsync(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error('Falha');
      return 'sucesso';
    },
    { maxRetries: 5, delay: 10 }
  );
  
  assert(result === 'sucesso', 'Deveria ter obtido sucesso');
  assert(attempts === 3, 'Deveria ter feito 3 tentativas');
});

test('retryAsync deve lançar após max retries', async () => {
  let attempts = 0;
  
  try {
    await retryAsync(
      async () => {
        attempts++;
        throw new Error('Sempre falha');
      },
      { maxRetries: 2, delay: 10 }
    );
    throw new Error('Deveria ter falhado');
  } catch (error) {
    assert(attempts === 2, 'Deveria ter feito 2 tentativas');
    assert(error.message === 'Sempre falha', 'Erro original deve ser lançado');
  }
});

test('retryAsync não deve retentar se not retryable', async () => {
  let attempts = 0;
  
  try {
    await retryAsync(
      async () => {
        attempts++;
        const err = new ValidationError('Não é retryable');
        err.retryable = false;
        throw err;
      },
      { maxRetries: 5, delay: 10 }
    );
  } catch (error) {
    assert(attempts === 1, 'Deveria ter feito apenas 1 tentativa');
  }
});

// ===== RELATÓRIO FINAL =====

logger.info('\n═══════════════════════════════════');
logger.success(`✓ Testes passaram: ${testsPassed}`);
if (testsFailed > 0) {
  logger.error(`✗ Testes falharam: ${testsFailed}`);
} else {
  logger.success('🎉 Todos os testes passaram!');
}
logger.info('═══════════════════════════════════\n');

process.exit(testsFailed > 0 ? 1 : 0);
