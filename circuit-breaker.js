/**
 * Circuit Breaker para proteção de API
 * Padrão: se muitos erros consecutivos, interrompe requisições por um tempo
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5; // Erros consecutivos
    this.successThreshold = options.successThreshold || 2; // Sucessos para resetar
    this.timeout = options.timeout || 60000; // ms para ficar aberto
    this.resetTimeout = null;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastError = null;
    this.lastErrorTime = null;
    this.metrics = {
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastStateChange: Date.now(),
    };
  }

  /**
   * Executar função com proteção de circuit breaker
   */
  async execute(fn, fallback = null) {
    this.metrics.totalCalls++;

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastErrorTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        const err = new Error(`Circuit ${this.name} está OPEN (aberto). Últimas tentativas falharam.`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      if (fallback) {
        return await fallback(error);
      }
      throw error;
    }
  }

  /**
   * Registrar sucesso
   */
  onSuccess() {
    this.metrics.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    }
  }

  /**
   * Registrar falha
   */
  onFailure(error) {
    this.metrics.totalFailures++;
    this.failureCount++;
    this.lastError = error.message;
    this.lastErrorTime = Date.now();
    this.successCount = 0;

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Abrir circuito (parar requisições)
   */
  open() {
    if (this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.metrics.lastStateChange = Date.now();
      console.warn(`🔴 Circuit ${this.name} ABERTO após ${this.failureCount} falhas`);
    }
  }

  /**
   * Resetar circuito
   */
  reset() {
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.successCount = 0;
      this.lastError = null;
      this.metrics.lastStateChange = Date.now();
      console.info(`🟢 Circuit ${this.name} FECHADO (recuperado)`);
    }
  }

  /**
   * Obter status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime ? new Date(this.lastErrorTime).toISOString() : null,
      metrics: this.metrics,
    };
  }
}

module.exports = CircuitBreaker;
