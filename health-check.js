/**
 * Health Check System
 * Monitora saúde do bot e endpoints críticos
 */

class HealthCheck {
  constructor(logger) {
    this.logger = logger;
    this.checks = new Map();
    this.status = 'HEALTHY';
    this.lastCheck = null;
    this.metrics = {
      totalChecks: 0,
      failedChecks: 0,
      avgResponseTime: 0,
      responseTimes: [],
    };
  }

  /**
   * Registrar um health check
   */
  register(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      critical: options.critical !== false,
      timeout: options.timeout || 5000,
      lastResult: null,
      lastError: null,
      lastCheckTime: null,
    });
  }

  /**
   * Executar todos os health checks
   */
  async runAll() {
    const startTime = Date.now();
    this.metrics.totalChecks++;

    const results = {};
    let hasErrors = false;
    let criticalError = false;

    for (const [name, check] of this.checks) {
      try {
        const checkStart = Date.now();
        
        // Executar com timeout
        const result = await Promise.race([
          check.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), check.timeout)
          ),
        ]);

        const responseTime = Date.now() - checkStart;
        results[name] = {
          status: 'OK',
          responseTime,
          timestamp: new Date().toISOString(),
        };

        check.lastResult = 'OK';
        check.lastError = null;
        check.lastCheckTime = Date.now();

        // Atualizar métrica de tempo médio
        this.metrics.responseTimes.push(responseTime);
        if (this.metrics.responseTimes.length > 100) {
          this.metrics.responseTimes.shift();
        }
        this.metrics.avgResponseTime = 
          this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;

      } catch (error) {
        hasErrors = true;
        const errorMsg = error.message || 'Erro desconhecido';
        
        results[name] = {
          status: 'FAILED',
          error: errorMsg,
          timestamp: new Date().toISOString(),
        };

        check.lastResult = 'FAILED';
        check.lastError = errorMsg;
        check.lastCheckTime = Date.now();

        this.metrics.failedChecks++;

        if (check.critical) {
          criticalError = true;
          this.logger?.error(`❌ Health check crítico falhou: ${name}`, { error: errorMsg });
        } else {
          this.logger?.warn(`⚠️ Health check falhou: ${name}`, { error: errorMsg });
        }
      }
    }

    this.status = criticalError ? 'UNHEALTHY' : hasErrors ? 'DEGRADED' : 'HEALTHY';
    this.lastCheck = {
      timestamp: new Date().toISOString(),
      status: this.status,
      results,
      duration: Date.now() - startTime,
    };

    return this.lastCheck;
  }

  /**
   * Obter status atual sem executar checks
   */
  getStatus() {
    return {
      status: this.status,
      lastCheck: this.lastCheck,
      metrics: {
        ...this.metrics,
        failureRate: this.metrics.totalChecks > 0 
          ? ((this.metrics.failedChecks / this.metrics.totalChecks) * 100).toFixed(2) + '%'
          : '0%',
      },
      checks: Array.from(this.checks.entries()).map(([name, check]) => ({
        name,
        critical: check.critical,
        lastResult: check.lastResult,
        lastError: check.lastError,
        lastCheckTime: check.lastCheckTime ? new Date(check.lastCheckTime).toISOString() : null,
      })),
    };
  }

  /**
   * Resetar métricas
   */
  reset() {
    this.metrics = {
      totalChecks: 0,
      failedChecks: 0,
      avgResponseTime: 0,
      responseTimes: [],
    };
  }
}

module.exports = HealthCheck;
