/**
 * src/utils/error-handler.js - Tratamento centralizado de erros
 */

class AppError extends Error {
    constructor(message, code = 'UNKNOWN', statusCode = 500, retryable = false) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.timestamp = new Date();
        this.context = {};
    }

    withContext(context) {
        this.context = context;
        return this;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            retryable: this.retryable,
            timestamp: this.timestamp,
            context: this.context
        };
    }
}

class APIError extends AppError {
    constructor(message, statusCode = 503, endpoint = 'unknown') {
        super(
            message,
            'API_ERROR',
            statusCode,
            statusCode >= 500 || statusCode === 429
        );
        this.endpoint = endpoint;
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 'VALIDATION_ERROR', 400, false);
        this.field = field;
    }
}

class ConfigError extends AppError {
    constructor(message) {
        super(message, 'CONFIG_ERROR', 400, false);
    }
}

class BusinessError extends AppError {
    constructor(message, code = 'BUSINESS_ERROR') {
        super(message, code, 400, false);
    }
}

class TimeoutError extends AppError {
    constructor(message, operation = 'unknown') {
        super(message, 'TIMEOUT_ERROR', 504, true);
        this.operation = operation;
    }
}

class ErrorHandler {
    constructor(logger = null) {
        this.logger = logger;
        this.stats = {
            total: 0,
            byCode: {},
            byStatusCode: {}
        };
    }

    handle(error, context = {}) {
        let appError;

        if (error instanceof AppError) {
            appError = error;
        } else if (error.message) {
            appError = new AppError(error.message);
        } else {
            appError = new AppError('Unknown error');
        }

        appError.context = context;

        // Atualizar estatísticas
        this.stats.total++;
        this.stats.byCode[appError.code] = (this.stats.byCode[appError.code] || 0) + 1;
        this.stats.byStatusCode[appError.statusCode] = 
            (this.stats.byStatusCode[appError.statusCode] || 0) + 1;

        // Log se logger disponível
        if (this.logger) {
            this.logger.error(`[${appError.code}] ${appError.message}`, {
                statusCode: appError.statusCode,
                context,
                retryable: appError.retryable
            });
        }

        return appError;
    }

    getStats() {
        return { ...this.stats };
    }

    isRetryable(error) {
        if (error instanceof AppError) {
            return error.retryable;
        }
        return false;
    }
}

async function retryAsync(
    asyncFn,
    {
        maxRetries = 3,
        delay = 1000,
        backoff = 2,
        onRetry = null,
        shouldRetry = null
    } = {}
) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            lastError = error;

            if (attempt <= maxRetries) {
                // Verificar se deve fazer retry
                if (shouldRetry && !shouldRetry(error)) {
                    throw error;
                }

                const waitTime = delay * Math.pow(backoff, attempt - 1);

                if (onRetry) {
                    onRetry(attempt, error, waitTime);
                }

                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
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
    retryAsync
};
