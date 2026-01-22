/**
 * src/utils/config.js - Gerenciamento centralizado de configuração
 * Validação rigorosa de parâmetros com schema
 */

require('dotenv').config();
const chalk = require('chalk');

class Config {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.schema = this.defineSchema();
        this.config = this.load();
        this.validate();
    }

    defineSchema() {
        return {
            // Modo e ambiente
            SIMULATE: {
                type: 'boolean',
                default: true,
                description: 'Modo simulação (true) ou live (false)'
            },
            IS_PRODUCTION: {
                type: 'boolean',
                default: false,
                description: 'Ambiente de produção'
            },
            
            // API e conexão
            REST_BASE: {
                type: 'string',
                default: 'https://api.mercadobitcoin.net/api/v4',
                description: 'Base URL da API'
            },
            PAIR: {
                type: 'string',
                default: 'BTC-BRL',
                description: 'Par de moedas para trading'
            },
            
            // Ciclo de execução
            CYCLE_SEC: {
                type: 'number',
                default: 30,
                min: 1,
                max: 300,
                description: 'Segundos entre ciclos'
            },
            
            // Spread e tamanho de ordem
            SPREAD_PCT: {
                type: 'number',
                default: 0.0006,
                min: 0.0001,
                max: 0.01,
                description: 'Spread em percentual (0.06%)'
            },
            MIN_SPREAD_PCT: {
                type: 'number',
                default: 0.0005,
                description: 'Spread mínimo'
            },
            MAX_SPREAD_PCT: {
                type: 'number',
                default: 0.04,
                description: 'Spread máximo'
            },
            ORDER_SIZE: {
                type: 'number',
                default: 0.05,
                min: 0.001,
                max: 1.0,
                description: 'Tamanho da ordem em % do capital'
            },
            
            // Risco
            STOP_LOSS_PCT: {
                type: 'number',
                default: 0.015,
                description: 'Stop loss em percentual'
            },
            TAKE_PROFIT_PCT: {
                type: 'number',
                default: 0.025,
                description: 'Take profit em percentual'
            },
            DAILY_LOSS_LIMIT: {
                type: 'number',
                default: -50,
                description: 'Limite de perda diária em BRL'
            },
            
            // Limites de volume
            MIN_ORDER_SIZE: {
                type: 'number',
                default: 0.00005,
                description: 'Tamanho mínimo de ordem em BTC'
            },
            MAX_ORDER_SIZE: {
                type: 'number',
                default: 0.0004,
                description: 'Tamanho máximo de ordem em BTC'
            },
            MAX_POSITION: {
                type: 'number',
                default: 0.0005,
                description: 'Posição máxima em BTC'
            },
            MIN_VOLUME: {
                type: 'number',
                default: 0.00005,
                description: 'Volume mínimo'
            },
            VOL_LIMIT_PCT: {
                type: 'number',
                default: 1.5,
                description: 'Limite de volatilidade %'
            },
            
            // Volatilidade
            MIN_VOLATILITY_PCT: {
                type: 'number',
                default: 0.1,
                description: 'Volatilidade mínima'
            },
            MAX_VOLATILITY_PCT: {
                type: 'number',
                default: 2.5,
                description: 'Volatilidade máxima'
            },
            
            // Inventory e viés
            INVENTORY_THRESHOLD: {
                type: 'number',
                default: 0.0002,
                description: 'Threshold de rebalanceamento'
            },
            BIAS_FACTOR: {
                type: 'number',
                default: 0.00015,
                description: 'Fator de viés'
            },
            
            // Ordens
            MAX_ORDER_AGE: {
                type: 'number',
                default: 1800,
                min: 60,
                description: 'Idade máxima de ordem em segundos'
            },
            MIN_ORDER_CYCLES: {
                type: 'number',
                default: 2,
                description: 'Ciclos mínimos antes de ação'
            },
            
            // Dashboard
            PORT: {
                type: 'number',
                default: 3001,
                min: 1000,
                max: 65535,
                description: 'Porta do dashboard'
            },
            DASHBOARD_CACHE_TTL: {
                type: 'number',
                default: 30000,
                description: 'Cache TTL em ms'
            },
            
            // Logging
            DEBUG: {
                type: 'boolean',
                default: false,
                description: 'Modo debug'
            },
            LOG_LEVEL: {
                type: 'string',
                default: 'INFO',
                enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
                description: 'Nível de logging'
            },
            
            // Estratégia
            USE_CASH_MANAGEMENT: {
                type: 'boolean',
                default: true,
                description: 'Usar estratégia de cash management'
            },
            ADAPTIVE_STRATEGY_ENABLED: {
                type: 'boolean',
                default: true,
                description: 'Estratégia adaptativa ativada'
            },
            
            // Fees
            FEE_RATE_MAKER: {
                type: 'number',
                default: 0.003,
                description: 'Taxa maker (0.3%)'
            },
            FEE_RATE_TAKER: {
                type: 'number',
                default: 0.007,
                description: 'Taxa taker (0.7%)'
            },
            
            // Capital
            INITIAL_CAPITAL: {
                type: 'number',
                default: 220.00,
                description: 'Capital inicial em BRL'
            }
        };
    }

    load() {
        const config = {};
        
        for (const [key, schema] of Object.entries(this.schema)) {
            let value = process.env[key];
            
            if (value === undefined) {
                value = schema.default;
            } else {
                // Converter tipo
                if (schema.type === 'boolean') {
                    value = value === 'true' || value === '1';
                } else if (schema.type === 'number') {
                    value = parseFloat(value);
                }
            }
            
            // Validar
            if (schema.type === 'number') {
                if (schema.min !== undefined && value < schema.min) {
                    this.warnings.push(
                        `${key}: valor ${value} abaixo do mínimo ${schema.min}`
                    );
                    value = schema.min;
                }
                if (schema.max !== undefined && value > schema.max) {
                    this.warnings.push(
                        `${key}: valor ${value} acima do máximo ${schema.max}`
                    );
                    value = schema.max;
                }
            }
            
            if (schema.enum && !schema.enum.includes(value)) {
                this.errors.push(
                    `${key}: valor '${value}' inválido. Opções: ${schema.enum.join(', ')}`
                );
            }
            
            config[key] = value;
        }
        
        return config;
    }

    validate() {
        if (this.errors.length > 0) {
            console.error(chalk.red('❌ Erros de configuração:'));
            this.errors.forEach(err => console.error(chalk.red(`   - ${err}`)));
            process.exit(1);
        }
        
        if (this.warnings.length > 0) {
            console.warn(chalk.yellow('⚠️  Avisos de configuração:'));
            this.warnings.forEach(warn => console.warn(chalk.yellow(`   - ${warn}`)));
        }
    }

    get(key) {
        if (!(key in this.config)) {
            throw new Error(`Configuração desconhecida: ${key}`);
        }
        return this.config[key];
    }

    getAll() {
        return { ...this.config };
    }

    report() {
        console.log(chalk.cyan('\n📋 CONFIGURAÇÃO CARREGADA:\n'));
        
        const grouped = {};
        for (const [key, schema] of Object.entries(this.schema)) {
            const category = key.split('_')[0];
            if (!grouped[category]) grouped[category] = [];
            
            const value = this.config[key];
            const display = typeof value === 'boolean' ? (value ? '✅' : '❌') : value;
            grouped[category].push(`${key}: ${display}`);
        }
        
        for (const [category, items] of Object.entries(grouped)) {
            console.log(chalk.cyan(`${category}:`));
            items.forEach(item => console.log(`  ${item}`));
        }
        console.log();
    }
}

module.exports = new Config();
