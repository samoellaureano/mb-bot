/**
 * Sistema de logging centralizado com Winston
 * Suporta múltiplos outputs: console, arquivo, Stackdriver
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');

// Criar diretório de logs se não existir
if (!fs.existsSync(config.LOG_DIR)) {
  fs.mkdirSync(config.LOG_DIR, { recursive: true });
}

// Níveis de log com cores
const LOG_LEVELS = {
  DEBUG: { level: 0, color: chalk.gray, prefix: '[DEBUG]' },
  INFO: { level: 1, color: chalk.blue, prefix: '[INFO]' },
  SUCCESS: { level: 1, color: chalk.green, prefix: '[SUCCESS]' },
  WARN: { level: 2, color: chalk.yellow, prefix: '[WARN]' },
  ERROR: { level: 3, color: chalk.red, prefix: '[ERROR]' },
};

const LEVEL_ORDER = { DEBUG: 0, INFO: 1, SUCCESS: 1, WARN: 2, ERROR: 3 };

class Logger {
  constructor(component = 'App', options = {}) {
    this.component = component;
    this.minLevel = LEVEL_ORDER[config.LOG_LEVEL?.toUpperCase() || 'INFO'] || 1;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.enableMetrics = options.enableMetrics !== false;
    this.metrics = {
      total: 0,
      byLevel: { DEBUG: 0, INFO: 0, SUCCESS: 0, WARN: 0, ERROR: 0 },
      errors: [],
      startTime: Date.now(),
    };
  }

  /**
   * Log formatado
   */
  log(level, message, data = null) {
    const levelInfo = LOG_LEVELS[level];
    if (!levelInfo) throw new Error(`Nível de log inválido: ${level}`);

    const order = LEVEL_ORDER[level] || 1;
    if (order < this.minLevel) return; // Filtro por nível mínimo

    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const formattedMsg = `${timestamp} ${levelInfo.prefix} [${this.component}] ${message}`;
    const fullMsg = data ? `${formattedMsg} | ${JSON.stringify(data)}` : formattedMsg;

    // Console com cores
    if (this.enableConsole) {
      const consoleMsg = levelInfo.color(formattedMsg);
      if (data) {
        console.log(consoleMsg, chalk.dim(JSON.stringify(data)));
      } else {
        console.log(consoleMsg);
      }
    }

    // Arquivo
    if (this.enableFile) {
      const logFile = path.join(config.LOG_DIR, `${this.component.toLowerCase()}.log`);
      fs.appendFileSync(logFile, fullMsg + '\n');
    }

    // Métricas
    if (this.enableMetrics) {
      this.metrics.total++;
      this.metrics.byLevel[level]++;
      if (level === 'ERROR') {
        this.metrics.errors.push({ timestamp, message, data });
      }
    }

    return fullMsg;
  }

  // Métodos convenientes
  debug(msg, data) { return this.log('DEBUG', msg, data); }
  info(msg, data) { return this.log('INFO', msg, data); }
  success(msg, data) { return this.log('SUCCESS', msg, data); }
  warn(msg, data) { return this.log('WARN', msg, data); }
  error(msg, data) { return this.log('ERROR', msg, data); }

  /**
   * Obter métricas de logging
   */
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      ...this.metrics,
      uptime: `${Math.round(uptime / 1000)}s`,
      errorRate: this.metrics.total > 0 
        ? ((this.metrics.byLevel.ERROR / this.metrics.total) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Resetar métricas
   */
  resetMetrics() {
    this.metrics = {
      total: 0,
      byLevel: { DEBUG: 0, INFO: 0, SUCCESS: 0, WARN: 0, ERROR: 0 },
      errors: [],
      startTime: Date.now(),
    };
  }
}

module.exports = Logger;
