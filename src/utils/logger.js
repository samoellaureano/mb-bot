/**
 * src/utils/logger.js - Sistema de logging estruturado
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class Logger {
    constructor(component = 'App', logFilePath = null) {
        this.component = component;
        this.logFilePath = logFilePath || path.join(__dirname, '../../logs/app.log');
        this.metrics = {
            total: 0,
            byLevel: {
                DEBUG: 0,
                INFO: 0,
                SUCCESS: 0,
                WARN: 0,
                ERROR: 0
            },
            errors: [],
            startTime: Date.now()
        };
        
        // Criar diretório de logs se não existir
        const logDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    _formatMessage(level, message, data) {
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const levelColor = {
            'DEBUG': chalk.gray,
            'INFO': chalk.cyan,
            'SUCCESS': chalk.green,
            'WARN': chalk.yellow,
            'ERROR': chalk.red
        }[level] || chalk.white;
        
        const formattedLevel = levelColor(`[${level}]`);
        const component = chalk.magenta(`[${this.component}]`);
        
        let output = `${timestamp} ${formattedLevel} ${component} ${message}`;
        if (data) {
            output += ` | ${JSON.stringify(data)}`;
        }
        
        return output;
    }

    _writeToFile(level, message, data) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                component: this.component,
                message,
                data
            };
            
            fs.appendFileSync(
                this.logFilePath,
                JSON.stringify(logEntry) + '\n'
            );
        } catch (err) {
            console.error('Erro ao escrever em log:', err);
        }
    }

    debug(message, data) {
        const output = this._formatMessage('DEBUG', message, data);
        console.log(output);
        this._writeToFile('DEBUG', message, data);
        this.metrics.total++;
        this.metrics.byLevel.DEBUG++;
    }

    info(message, data) {
        const output = this._formatMessage('INFO', message, data);
        console.log(output);
        this._writeToFile('INFO', message, data);
        this.metrics.total++;
        this.metrics.byLevel.INFO++;
    }

    success(message, data) {
        const output = this._formatMessage('SUCCESS', message, data);
        console.log(output);
        this._writeToFile('SUCCESS', message, data);
        this.metrics.total++;
        this.metrics.byLevel.SUCCESS++;
    }

    warn(message, data) {
        const output = this._formatMessage('WARN', message, data);
        console.warn(output);
        this._writeToFile('WARN', message, data);
        this.metrics.total++;
        this.metrics.byLevel.WARN++;
    }

    error(message, data) {
        const output = this._formatMessage('ERROR', message, data);
        console.error(output);
        this._writeToFile('ERROR', message, data);
        this.metrics.total++;
        this.metrics.byLevel.ERROR++;
        this.metrics.errors.push({
            timestamp: Date.now(),
            message,
            data
        });
    }

    getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        const errorRate = this.metrics.total > 0 
            ? ((this.metrics.byLevel.ERROR / this.metrics.total) * 100).toFixed(1)
            : '0';
        
        return {
            ...this.metrics,
            uptime,
            errorRate: `${errorRate}%`,
            avgResponseTime: this.metrics.total > 0 ? (uptime / this.metrics.total).toFixed(2) : 0
        };
    }

    clearMetrics() {
        this.metrics.errors = [];
        this.metrics.startTime = Date.now();
    }
}

module.exports = Logger;
