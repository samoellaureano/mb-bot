/**
 * src/utils/types.js - Definições de tipos e constantes
 */

const OrderType = {
    MARKET: 'market',
    LIMIT: 'limit'
};

const OrderSide = {
    BUY: 'BUY',
    SELL: 'SELL'
};

const OrderStatus = {
    PENDING: 'pending',
    PARTIAL: 'partial',
    FILLED: 'filled',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
    EXPIRED: 'expired'
};

const StrategyType = {
    CASH_MANAGEMENT: 'cash_management',
    ADAPTIVE: 'adaptive',
    MOMENTUM: 'momentum',
    ACCUMULATOR: 'accumulator'
};

const SignalType = {
    BUY: 'BUY',
    SELL: 'SELL',
    HOLD: 'HOLD',
    NEUTRAL: 'NEUTRAL'
};

const TrendType = {
    UPTREND: 'uptrend',
    DOWNTREND: 'downtrend',
    SIDEWAYS: 'sideways',
    UNKNOWN: 'unknown'
};

const ErrorCode = {
    // API Errors
    API_TIMEOUT: 'API_TIMEOUT',
    API_RATE_LIMIT: 'API_RATE_LIMIT',
    API_UNAUTHORIZED: 'API_UNAUTHORIZED',
    API_NOT_FOUND: 'API_NOT_FOUND',
    API_SERVER_ERROR: 'API_SERVER_ERROR',
    API_NETWORK_ERROR: 'API_NETWORK_ERROR',

    // Validation Errors
    INVALID_BALANCE: 'INVALID_BALANCE',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INVALID_ORDER: 'INVALID_ORDER',
    INVALID_PRICE: 'INVALID_PRICE',
    INVALID_QUANTITY: 'INVALID_QUANTITY',

    // Trading Errors
    ORDER_REJECTED: 'ORDER_REJECTED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    POSITION_TOO_LARGE: 'POSITION_TOO_LARGE',
    DAILY_LOSS_LIMIT_REACHED: 'DAILY_LOSS_LIMIT_REACHED',
    VOLATILITY_TOO_HIGH: 'VOLATILITY_TOO_HIGH',

    // Config Errors
    CONFIG_INVALID: 'CONFIG_INVALID',
    CONFIG_MISSING: 'CONFIG_MISSING',

    // Database Errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    DATABASE_LOCKED: 'DATABASE_LOCKED',

    // Unknown
    UNKNOWN: 'UNKNOWN'
};

const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

// Constantes de fees (em percentual decimal: 0.003 = 0.3%)
const FEES = {
    MAKER: 0.003,  // 0.3%
    TAKER: 0.007   // 0.7%
};

// Constantes de pares
const PAIRS = {
    BTC_BRL: 'BTC-BRL',
    LTC_BRL: 'LTC-BRL',
    ETH_BRL: 'ETH-BRL'
};

// Limites de validação
const VALIDATION_LIMITS = {
    MIN_BTC: 0.00001,
    MAX_BTC: 10000,
    MIN_BRL: 0.01,
    MAX_BRL: 999999999,
    MIN_PRICE: 0.01,
    MIN_SPREAD: 0.00001,
    MAX_SPREAD: 0.5
};

module.exports = {
    OrderType,
    OrderSide,
    OrderStatus,
    StrategyType,
    SignalType,
    TrendType,
    ErrorCode,
    LogLevel,
    FEES,
    PAIRS,
    VALIDATION_LIMITS
};
