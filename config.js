/**
 * Configuração centralizada com validação
 * Substitui arquivos .env descentralizados
 */

const dotenv = require('dotenv');
const path = require('path');

// Carregar .env
dotenv.config();

// Schema de validação para configurações críticas
const CONFIG_SCHEMA = {
  // API
  API_KEY: { required: true, type: 'string', pattern: /^[a-zA-Z0-9_-]+$/ },
  API_SECRET: { required: true, type: 'string' },
  
  // Modo operacional
  SIMULATE: { required: false, type: 'boolean', default: true },
  LIVE_TRADING: { required: false, type: 'boolean', default: false },
  
  // Timing
  CYCLE_SEC: { required: false, type: 'number', default: 15, min: 5, max: 300 },
  
  // Trading
  SPREAD_PCT: { required: false, type: 'number', default: 0.006, min: 0.0001, max: 0.1 },
  MIN_SPREAD_PCT: { required: false, type: 'number', default: 0.0006, min: 0.0001, max: 0.1 },
  ORDER_SIZE: { required: false, type: 'number', default: 0.00005, min: 0.000001 },
  
  // Riscos
  STOP_LOSS: { required: false, type: 'number', default: 0.008, min: 0.001, max: 0.5 },
  TAKE_PROFIT: { required: false, type: 'number', default: 0.02, min: 0.001, max: 1.0 },
  MAX_DAILY_LOSS: { required: false, type: 'number', default: -10, max: 0 },
  
  // Servidor
  PORT: { required: false, type: 'number', default: 3001, min: 1000, max: 65535 },
  HOST: { required: false, type: 'string', default: '0.0.0.0' },
  
  // Logging
  LOG_LEVEL: { required: false, type: 'string', default: 'info', enum: ['debug', 'info', 'warn', 'error'] },
  LOG_DIR: { required: false, type: 'string', default: './logs' },
};

/**
 * Valida um valor contra um schema
 */
function validateValue(key, value, schema) {
  const rule = schema[key];
  if (!rule) return { valid: true };

  // Verificar tipo
  const actualType = value === null ? 'null' : typeof value;
  if (rule.type && actualType !== rule.type) {
    return {
      valid: false,
      error: `${key}: esperado ${rule.type}, recebido ${actualType}`
    };
  }

  // Verificar enums
  if (rule.enum && !rule.enum.includes(value)) {
    return {
      valid: false,
      error: `${key}: valor '${value}' não está em ${JSON.stringify(rule.enum)}`
    };
  }

  // Verificar padrão regex
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return {
      valid: false,
      error: `${key}: valor '${value}' não corresponde ao padrão esperado`
    };
  }

  // Verificar min/max
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, error: `${key}: mínimo ${rule.min}, recebido ${value}` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, error: `${key}: máximo ${rule.max}, recebido ${value}` };
    }
  }

  return { valid: true };
}

/**
 * Carrega e valida todas as configurações
 */
function loadConfig() {
  const config = {};
  const errors = [];
  const warnings = [];

  // Processar schema
  for (const [key, rule] of Object.entries(CONFIG_SCHEMA)) {
    let value = process.env[key];

    // Usar padrão se não definido
    if (value === undefined) {
      if (rule.required) {
        errors.push(`${key}: obrigatória mas não definida`);
      } else if (rule.default !== undefined) {
        value = rule.default;
        warnings.push(`${key}: usando padrão ${JSON.stringify(rule.default)}`);
      } else {
        continue;
      }
    }

    // Converter tipo se necessário
    if (rule.type === 'boolean' && typeof value === 'string') {
      value = value.toLowerCase() === 'true' || value === '1';
    } else if (rule.type === 'number' && typeof value === 'string') {
      value = parseFloat(value);
      if (isNaN(value)) {
        errors.push(`${key}: não conseguiu converter '${process.env[key]}' para número`);
        continue;
      }
    }

    // Validar
    const validation = validateValue(key, value, CONFIG_SCHEMA);
    if (!validation.valid) {
      errors.push(validation.error);
      continue;
    }

    config[key] = value;
  }

  // Validações cruzadas
  if (config.LIVE_TRADING && config.SIMULATE) {
    warnings.push('⚠️ LIVE_TRADING=true mas SIMULATE=true: usando SIMULATE');
    config.SIMULATE = true;
  }

  return { config, errors, warnings };
}

// Carregar e validar
const { config, errors, warnings } = loadConfig();

// Relatório de erros
if (errors.length > 0) {
  console.error('\n❌ ERROS DE CONFIGURAÇÃO:');
  errors.forEach(e => console.error(`  • ${e}`));
  console.error('\nNão é possível iniciar com configuração inválida.\n');
  process.exit(1);
}

// Relatório de avisos
if (warnings.length > 0) {
  console.warn('\n⚠️ AVISOS DE CONFIGURAÇÃO:');
  warnings.forEach(w => console.warn(`  • ${w}`));
  console.warn();
}

// Adicionar algumas configurações derivadas úteis
config.SIMULATING = config.SIMULATE || !config.LIVE_TRADING;
config.IS_PRODUCTION = process.env.NODE_ENV === 'production';

module.exports = config;
