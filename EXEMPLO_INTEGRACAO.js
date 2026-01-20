/**
 * Exemplo de Integração das Melhorias
 * Este arquivo mostra como usar os novos componentes juntos
 * 
 * Copie/adapte este código para bot.js
 */

const config = require('./config');
const Logger = require('./logger');
const CircuitBreaker = require('./circuit-breaker');
const HealthCheck = require('./health-check');
const { APIError, ErrorHandler, retryAsync } = require('./error-handler');

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ SETUP - Inicialização dos Componentes
// ═══════════════════════════════════════════════════════════════════════════

// Criar logger
const log = new Logger('Bot');

// Handler de erros
const errorHandler = new ErrorHandler(log);

// Circuit Breaker para API
const apiBreaker = new CircuitBreaker({
  name: 'MercadoBitcoin',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
});

// Health Check
const healthCheck = new HealthCheck(log);

// Registrar health checks críticos
healthCheck.register('Database', async () => {
  // Simular verificação de DB
  return { ok: true };
}, { critical: true, timeout: 5000 });

healthCheck.register('MercadoBitcoin API', async () => {
  // Simular verificação de API
  const status = await checkAPIHealth();
  if (!status) throw new Error('API não responde');
  return { ok: true };
}, { critical: true, timeout: 10000 });

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ CHAMADAS DE API COM PROTEÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fazer chamada segura à API com Circuit Breaker + Retry
 */
async function fetchMarketData() {
  return await apiBreaker.execute(
    () => retryAsync(
      async () => {
        log.debug('Buscando dados de mercado...');
        // Implementar chamada real à API
        // return await mbClient.orderbook();
        return { bid: 100000, ask: 100100 };
      },
      {
        maxRetries: 3,
        delay: 1000,
        backoff: 2,
        onRetry: (attempt, err) => {
          log.warn(`Tentativa ${attempt} falhada:`, { error: err.message });
        },
        onFail: (err) => {
          throw new APIError(
            'Falha ao buscar dados após 3 tentativas',
            503,
            'MercadoBitcoin'
          );
        },
      }
    ),
    // Fallback em caso de Circuit Open
    async (error) => {
      log.error('Circuit Breaker aberto, usando cache local', { error: error.message });
      return getCachedMarketData();
    }
  );
}

/**
 * Colocar ordem com validação e tratamento de erro
 */
async function placeOrder(type, price, amount) {
  try {
    // Validar entrada
    if (!['buy', 'sell'].includes(type)) {
      throw new ValidationError('Tipo de ordem inválido', 'type');
    }
    if (price <= 0 || amount <= 0) {
      throw new ValidationError('Preço/quantidade deve ser > 0', 'price/amount');
    }

    log.info(`Colocando ordem ${type.toUpperCase()}`, { price, amount });

    // Executar com proteção
    const order = await apiBreaker.execute(
      () => retryAsync(
        () => mbClient.placeOrder(type, price, amount),
        { maxRetries: 3, delay: 500 }
      ),
      // Fallback em caso de falha
      async (error) => {
        log.warn('Falha ao colocar ordem, registrando para retry posterior', { error: error.message });
        // Salvar em fila de retry
        return { id: 'pending', status: 'PENDING' };
      }
    );

    log.success('Ordem colocada com sucesso', { orderId: order.id });
    return order;

  } catch (error) {
    const handled = errorHandler.handle(error, { operation: 'placeOrder', type, price, amount });
    
    // Tomar ação apropriada
    if (handled.code === 'VALIDATION_ERROR') {
      log.error('Validação falhou, pulando operação', handled.context);
    } else if (handled.code === 'API_ERROR' && handled.retryable) {
      log.error('Erro retryable, será tentado novamente', handled.context);
    } else {
      log.error('Erro não-retryable, abortando', handled.context);
      throw handled;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ LOOP PRINCIPAL COM HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

let cycleCount = 0;
let shouldStop = false;

async function runCycle() {
  cycleCount++;
  
  try {
    // Verificar saúde do sistema a cada 10 ciclos
    if (cycleCount % 10 === 0) {
      const healthReport = await healthCheck.runAll();
      
      if (healthReport.status === 'UNHEALTHY') {
        log.error('Sistema em estado UNHEALTHY, abortando ciclo', healthReport);
        shouldStop = true;
        return;
      } else if (healthReport.status === 'DEGRADED') {
        log.warn('Sistema em estado DEGRADED, operando com cautela', healthReport);
      }
    }

    log.debug(`Ciclo ${cycleCount} iniciado`);

    // Seu código de trading aqui
    const market = await fetchMarketData();
    log.info(`Mid price: ${market.mid}`, { bid: market.bid, ask: market.ask });

    // Simular colocação de ordem
    if (Math.random() > 0.7) {
      await placeOrder('buy', market.bid, 0.00001);
    }

    log.success(`Ciclo ${cycleCount} concluído`);

  } catch (error) {
    const handled = errorHandler.handle(error, { cycle: cycleCount });
    log.error(`Ciclo ${cycleCount} falhou`, handled.context);
    
    // Decidir se continua
    if (cycleCount > 100) {
      shouldStop = true;
    }
  }
}

/**
 * Loop principal
 */
async function main() {
  try {
    log.info('🤖 MB Bot iniciando...', { config: {
      SIMULATE: config.SIMULATE,
      CYCLE_SEC: config.CYCLE_SEC,
      SPREAD_PCT: config.SPREAD_PCT,
    }});

    // Validação inicial
    if (config.LIVE_TRADING && !process.env.CONFIRM_LIVE) {
      throw new Error('LIVE_TRADING ativado sem confirmação! Defina CONFIRM_LIVE=1');
    }

    // Loop de ciclos
    const interval = setInterval(async () => {
      if (!shouldStop) {
        await runCycle();
      } else {
        clearInterval(interval);
        log.info('Bot parado');
        
        // Mostrar estatísticas finais
        log.info('📊 Estatísticas de Execução:', {
          logs: log.getMetrics(),
          errors: errorHandler.getStats(),
          circuitBreaker: apiBreaker.getStatus(),
          healthCheck: healthCheck.getStatus(),
        });
        
        process.exit(0);
      }
    }, config.CYCLE_SEC * 1000);

  } catch (error) {
    const handled = errorHandler.handle(error, { context: 'initialization' });
    log.error('Erro fatal na inicialização', handled.context);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

async function checkAPIHealth() {
  // Implementar verificação real
  return true;
}

function getCachedMarketData() {
  // Retornar último valor conhecido
  return { bid: 99000, ask: 99100 };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ EXPORTAR PARA TESTES
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = {
  config,
  log,
  errorHandler,
  apiBreaker,
  healthCheck,
  fetchMarketData,
  placeOrder,
  runCycle,
  main,
};
