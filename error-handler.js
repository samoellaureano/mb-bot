/**
 * Sistema de tratamento de erros
 * Define erros customizados e estratégias de recuperação
 */

/**
 * Erro base para aplicação
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();
    this.isAppError = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Erro de API (chamadas a terceiros)
 */
class APIError extends AppError {
  constructor(message, statusCode = 500, apiName = 'Unknown', context = {}) {
    super(message, 'API_ERROR', statusCode, { apiName, ...context });
    this.name = 'APIError';
    this.apiName = apiName;
    this.retryable = statusCode >= 500 || statusCode === 408 || statusCode === 429;
  }
}

/**
 * Erro de validação
 */
class ValidationError extends AppError {
  constructor(message, field = null, context = {}) {
    super(message, 'VALIDATION_ERROR', 400, { field, ...context });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Erro de configuração
 */
class ConfigError extends AppError {
  constructor(message, missingKeys = [], context = {}) {
    super(message, 'CONFIG_ERROR', 500, { missingKeys, ...context });
    this.name = 'ConfigError';
  }
}

/**
 * Erro de negócio (insuficiente saldo, etc)
 */
class BusinessError extends AppError {
  constructor(message, code = 'BUSINESS_ERROR', context = {}) {
    super(message, code, 400, context);
    this.name = 'BusinessError';
  }
}

/**
 * Erro de timeout
 */
class TimeoutError extends AppError {
  constructor(message, operation = 'Unknown', timeout = 0, context = {}) {
    super(message, 'TIMEOUT_ERROR', 408, { operation, timeout, ...context });
    this.name = 'TimeoutError';
    this.retryable = true;
  }
}

/**
 * Tratador de erros com logging e contexto
 */
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.errorCounts = new Map();
    this.lastErrors = [];
  }

  /**
   * Registrar erro
   */
  handle(error, context = {}) {
    // Normalizar erro
    let appError;
    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError(error.message, 'UNKNOWN_ERROR', 500, { 
        originalError: error.name,
        stack: error.stack 
      });
    } else {
      appError = new AppError(String(error), 'UNKNOWN_ERROR', 500);
    }

    // Adicionar contexto
    appError.context = { ...appError.context, ...context };

    // Contabilizar
    const key = appError.code;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    // Manter histórico
    this.lastErrors.push({
      error: appError,
      timestamp: new Date(),
    });
    if (this.lastErrors.length > 100) {
      this.lastErrors.shift();
    }

    // Log
    if (appError.statusCode >= 500 || appError.code === 'UNKNOWN_ERROR') {
      this.logger?.error(`❌ ${appError.name}: ${appError.message}`, appError.context);
    } else {
      this.logger?.warn(`⚠️ ${appError.name}: ${appError.message}`, appError.context);
    }

    return appError;
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      byCode: Object.fromEntries(this.errorCounts),
      recentErrors: this.lastErrors.slice(-10).map(({ error, timestamp }) => ({
        code: error.code,
        message: error.message,
        timestamp,
      })),
    };
  }

  /**
   * Resetar estatísticas
   */
  reset() {
    this.errorCounts.clear();
    this.lastErrors = [];
  }
}

/**
 * Executar com retry automático
 */
async function retryAsync(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null,
    onFail = null,
  } = options;

  let lastError;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Não retry se não for retryable
      if (error.retryable === false) {
        throw error;
      }

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt, error, currentDelay);
        }
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoff;
      }
    }
  }

  if (onFail) {
    onFail(lastError, maxRetries);
  }

  throw lastError;
}

module.exports = {
  AppError,
  APIError,
  ValidationError,
  ConfigError,
  BusinessError,
  TimeoutError,
  ErrorHandler,
  retryAsync,
};
