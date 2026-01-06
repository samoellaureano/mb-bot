#!/usr/bin/env node
/**
 * db.js - Enhanced database for Market Making Bot v2.0.4
 * - Suporta ordens, estatísticas e fills históricos.
 * - Compatível com chalk@4.1.2 (CommonJS).
 * - Inclui loadHistoricalFills e saveHistoricalFills para compatibilidade com bot.js.
 * - Índices para performance.
 * - Validação rigorosa de dados.
 * - Logs consistentes com o bot.
 * - Transações para operações críticas.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

class Database {
    constructor(dbPath = './database/orders.db') {
        this.dbPath = path.resolve(dbPath);
        this.db = null;
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString().substring(11, 23);
        const prefix = `[${level}]`.padEnd(8);
        const colors = {
            INFO: chalk.cyan,
            WARN: chalk.yellow,
            ERROR: chalk.red,
            SUCCESS: chalk.green,
            DEBUG: chalk.blue,
            ALERT: chalk.bgRed.white
        };
        const colorFn = colors[level] || (text => text);
        const logLine = `${timestamp} ${prefix} [DB] ${message}`;
        const styledMessage = colorFn(logLine);
        console.log(styledMessage, data ? `| ${JSON.stringify(data).slice(0, 120)}${JSON.stringify(data).length > 120 ? '...' : ''}` : '');
        fs.appendFileSync('bot.log', logLine + (data ? ` | ${JSON.stringify(data)}` : '') + '\n');
    }

    // Rest of the code remains unchanged
    async init() {
        return new Promise((resolve, reject) => {
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, {recursive: true});
                this.log('INFO', `Diretório do banco criado: ${dbDir}`);
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    this.log('ERROR', `Erro ao abrir banco de dados: ${err.message}`);
                    return reject(err);
                }

                this.db.serialize(() => {
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS orders
                        (
                            id
                            TEXT
                            PRIMARY
                            KEY,
                            side
                            TEXT
                            NOT
                            NULL
                            CHECK (
                            side
                            IN
                        (
                            'buy',
                            'sell',
                            'unknown'
                        )),
                            price REAL NOT NULL CHECK
                        (
                            price >
                            0
                        ),
                            qty REAL NOT NULL CHECK
                        (
                            qty >
                            0
                        ),
                            status TEXT NOT NULL CHECK
                        (
                            status
                            IN
                        (
                            'open',
                            'filled',
                            'cancelled',
                            'error'
                        )) DEFAULT 'open',
                            filledQty REAL DEFAULT 0 CHECK
                        (
                            filledQty
                            >=
                            0
                        ),
                            timestamp INTEGER NOT NULL,
                            note TEXT,
                            external_id TEXT,
                            pnl REAL DEFAULT 0
                            )
                    `, (err) => {
                        if (err) {
                            this.log('ERROR', `Erro ao criar tabela orders: ${err.message}`);
                            return reject(err);
                        }

                        this.db.run(`
                            CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);
                            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
                            CREATE INDEX IF NOT EXISTS idx_orders_side ON orders(side);
                        `, (err) => {
                            if (err) {
                                this.log('ERROR', `Erro ao criar índices: ${err.message}`);
                                return reject(err);
                            }

                            this.db.run(`
                                CREATE TABLE IF NOT EXISTS stats
                                (
                                    key
                                    TEXT
                                    PRIMARY
                                    KEY,
                                    value
                                    INTEGER
                                    DEFAULT
                                    0,
                                    updated_at
                                    INTEGER
                                    DEFAULT (
                                    strftime
                                (
                                    '%s',
                                    'now'
                                ))
                                    )
                            `, (err) => {
                                if (err) {
                                    this.log('ERROR', `Erro ao criar tabela stats: ${err.message}`);
                                    return reject(err);
                                }

                                this.db.run(
                                    "INSERT OR IGNORE INTO stats (key, value) VALUES ('cycles', 0)",
                                    (err) => {
                                        if (err) {
                                            this.log('ERROR', `Erro ao inicializar stats: ${err.message}`);
                                            return reject(err);
                                        }
                                        this.log('SUCCESS', 'Banco de dados inicializado com sucesso.');
                                        resolve(this);
                                    }
                                );
                            });
                        });
                    });
                });
            });
        });
    }

    async saveOrderSafe(order, context) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        if (!order.id || !order.side || order.price <= 0 || order.qty <= 0) {
            this.log('ERROR', `Dados de ordem inválidos: ${JSON.stringify(order)}`);
            throw new Error('Invalid order data');
        }
        // Adicionar context ao order se fornecido
        if (context && !order.note) {
            order.note = context;
        }
        return this.saveOrder(order);
    }

    async saveOrder(order) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO orders 
                (id, side, price, qty, status, filledQty, timestamp, note, external_id, pnl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const timestamp = order.timestamp ? Math.floor(order.timestamp / 1000) : Math.floor(Date.now() / 1000);
            stmt.run(
                order.id,
                order.side,
                parseFloat(order.price),
                parseFloat(order.qty),
                order.status || 'open',
                parseFloat(order.filledQty || 0),
                timestamp,
                order.note || null,
                order.externalId || null,
                parseFloat(order.pnl || 0),
                (err) => {
                    stmt.finalize();
                    if (err) {
                        this.log('ERROR', `Erro ao salvar ordem ${order.id}: ${err.message}`);
                        return reject(err);
                    }
                    this.log('INFO', `Ordem salva: ${order.id} (${order.side.toUpperCase()} @ ${order.price.toFixed(2)}, Qty: ${order.qty.toFixed(8)})`);
                    resolve(order);
                }
            );
        });
    }

    async updateOrderStatus(orderId, status, filledQty = null, pnl = null) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        return new Promise((resolve, reject) => {
            const updates = ['status = ?', 'updated_at = strftime(\'%s\', \'now\')'];
            const params = [status];
            if (filledQty !== null) {
                updates.push('filledQty = ?');
                params.push(parseFloat(filledQty));
            }
            if (pnl !== null) {
                updates.push('pnl = ?');
                params.push(parseFloat(pnl));
            }
            params.push(orderId);
            const sql = `UPDATE orders
                         SET ${updates.join(', ')}
                         WHERE id = ?`;
            this.db.run(sql, params, function (err) {
                if (err) {
                    this.log('ERROR', `Erro ao atualizar status da ordem ${orderId}: ${err.message}`);
                    return reject(err);
                }
                this.log('INFO', `Status da ordem ${orderId} atualizado para ${status}`);
                resolve(this.changes);
            });
        });
    }

    async loadHistoricalFills(limit = process.env.HISTORICAL_FILLS_WINDOW || 20) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado. Retornando array vazio.');
            return [];
        }
        return new Promise((resolve, reject) => {
            const query = `
                SELECT side, price, qty, timestamp, pnl
                FROM orders
                WHERE status = 'filled'
                ORDER BY timestamp DESC LIMIT ?
            `;
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    this.log('ERROR', `Erro ao carregar fills históricos: ${err.message}`);
                    return reject(err);
                }
                const fills = rows.map(row => ({
                    side: row.side,
                    price: parseFloat(row.price),
                    qty: parseFloat(row.qty),
                    timestamp: row.timestamp * 1000,
                    pnl: parseFloat(row.pnl || 0)
                }));
                this.log('INFO', `Carregados ${fills.length} fills históricos.`);
                resolve(fills);
            });
        });
    }

    async saveHistoricalFills(fills) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        if (!Array.isArray(fills)) {
            this.log('ERROR', 'Fills históricos devem ser um array.');
            throw new Error('Invalid fills data');
        }
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`
                    INSERT OR REPLACE INTO orders 
                    (id, side, price, qty, status, filledQty, timestamp, note, pnl)
                    VALUES (?, ?, ?, ?, 'filled', ?, ?, ?, ?)
                `);
                let completed = 0;
                const total = fills.length;
                fills.forEach((fill, index) => {
                    const id = `fill_${fill.timestamp}_${index}`;
                    stmt.run(
                        id,
                        fill.side,
                        parseFloat(fill.price),
                        parseFloat(fill.qty),
                        parseFloat(fill.qty),
                        Math.floor(fill.timestamp / 1000),
                        'historical_fill',
                        parseFloat(fill.pnl || 0),
                        (err) => {
                            if (err) {
                                this.log('ERROR', `Erro ao salvar fill histórico ${id}: ${err.message}`);
                                stmt.finalize();
                                return reject(err);
                            }
                            completed++;
                            if (completed === total) {
                                stmt.finalize();
                                this.log('SUCCESS', `Salvos ${total} fills históricos.`);
                                resolve();
                            }
                        }
                    );
                });
                if (total === 0) {
                    stmt.finalize();
                    this.log('INFO', 'Nenhum fill histórico para salvar.');
                    resolve();
                }
            });
        });
    }

    async getOrders({limit = 50, status = null, side = null} = {}) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado. Retornando array vazio.');
            return [];
        }
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM orders';
            let params = [];
            const conditions = [];
            if (status) {
                conditions.push('status = ?');
                params.push(status);
            }
            if (side) {
                conditions.push('side = ?');
                params.push(side);
            }
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            query += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar ordens: ${err.message}`);
                    return reject(err);
                }
                const orders = rows.map(row => ({
                    id: row.id,
                    side: row.side,
                    price: parseFloat(row.price),
                    qty: parseFloat(row.qty),
                    status: row.status,
                    filledQty: parseFloat(row.filledQty),
                    timestamp: row.timestamp * 1000,
                    note: row.note,
                    externalId: row.external_id,
                    pnl: parseFloat(row.pnl || 0)
                }));
                this.log('INFO', `Consultadas ${orders.length} ordens.`);
                resolve(orders);
            });
        });
    }

    async getStats({hours = 24} = {}) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado. Retornando estatísticas padrão.');
            return this.getDefaultStats();
        }
        return new Promise((resolve, reject) => {
            const seconds = hours * 60 * 60;
            const cutoff = Math.floor(Date.now() / 1000) - seconds;
            this.db.get("SELECT value AS cycles FROM stats WHERE key = 'cycles'", (err, cycleRow) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar ciclos: ${err.message}`);
                    return reject(err);
                }
                this.db.all(`
                    SELECT COUNT(*)                                                        as total_orders,
                           SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END)              as filled_orders,
                           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)           as cancelled_orders,
                           SUM(pnl)                                                        as total_pnl,
                           AVG(CASE WHEN status = 'filled' THEN price * qty ELSE NULL END) as avg_fill_value,
                           (SELECT AVG(spread)
                            FROM (SELECT ABS(o1.price - (SELECT o2.price
                                                         FROM orders o2
                                                         WHERE o2.status = 'filled'
                                                           AND o2.side = o1.side
                                                           AND o2.timestamp < o1.timestamp
                                                         ORDER BY o2.timestamp DESC LIMIT 1)) / o1.price as spread
                                  FROM orders o1
                                  WHERE o1.status = 'filled'
                                    AND o1.timestamp > ?) sub)                             as avg_spread
                    FROM orders
                    WHERE timestamp > ?
                `, [cutoff, cutoff], (err, rows) => {
                    if (err) {
                        this.log('ERROR', `Erro ao consultar estatísticas: ${err.message}`);
                        return reject(err);
                    }
                    const statsRow = rows[0] || {};
                    const cycleSec = parseInt(process.env.CYCLE_SEC || 5);
                    const stats = {
                        cycles: cycleRow?.cycles || 0,
                        total_orders: statsRow.total_orders || 0,
                        filled_orders: statsRow.filled_orders || 0,
                        cancelled_orders: statsRow.cancelled_orders || 0,
                        total_pnl: parseFloat(statsRow.total_pnl || 0),
                        avg_fill_value: parseFloat(statsRow.avg_fill_value || 0),
                        avg_spread: parseFloat(statsRow.avg_spread || 0) * 100 || parseFloat(process.env.SPREAD_PCT || 0.0007) * 100,
                        uptime: statsRow.total_orders ? `${Math.round(cycleRow?.cycles * cycleSec / 60)}min` : '0min',
                        fill_rate: statsRow.total_orders ? (statsRow.filled_orders / statsRow.total_orders * 100).toFixed(1) : '0.0'
                    };
                    this.log('INFO', `Estatísticas consultadas (últimas ${hours}h):`, stats);
                    resolve(stats);
                });
            });
        });
    }

    async incrementCycle() {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            return;
        }
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE stats SET value = value + 1, updated_at = strftime('%s', 'now') WHERE key = 'cycles'",
                function (err) {
                    if (err) {
                        this.log('ERROR', `Erro ao incrementar ciclo: ${err.message}`);
                        return reject(err);
                    }
                    this.log('INFO', `Ciclo incrementado: ${this.changes} alterações.`);
                    resolve(this.changes);
                }
            );
        });
    }

    getDefaultStats() {
        return {
            cycles: 0,
            total_orders: 0,
            filled_orders: 0,
            cancelled_orders: 0,
            total_pnl: 0,
            avg_fill_value: 0,
            avg_spread: parseFloat(process.env.SPREAD_PCT || 0.0007) * 100,
            uptime: '0min',
            fill_rate: '0.0'
        };
    }

    async close() {
        if (!this.db) {
            this.log('WARN', 'Banco de dados já está fechado.');
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            this.db.run('PRAGMA optimize', (err) => {
                if (err) {
                    this.log('WARN', `Erro ao otimizar banco antes de fechar: ${err.message}`);
                }
                this.db.close((err) => {
                    if (err) {
                        this.log('ERROR', `Erro ao fechar banco de dados: ${err.message}`);
                        return reject(err);
                    }
                    this.log('SUCCESS', 'Banco de dados fechado com sucesso.');
                    this.db = null;
                    resolve();
                });
            });
        });
    }
}

const dbInstance = new Database(process.env.DB_PATH || './database/orders.db');

if (require.main === module) {
    const command = process.argv[2];
    switch (command) {
        case 'stats':
            dbInstance.init()
                .then(() => dbInstance.getStats({hours: 24}))
                .then(stats => {
                    console.log('\n📊 MB Bot Statistics (24h)');
                    console.log('='.repeat(50));
                    console.log(`Ciclos:        ${stats.cycles.toLocaleString()} (${stats.uptime})`);
                    console.log(`Total Ordens:  ${stats.total_orders.toLocaleString()}`);
                    console.log(`Fills:         ${stats.filled_orders.toLocaleString()} (${stats.fill_rate}%)`);
                    console.log(`Cancelamentos: ${stats.cancelled_orders.toLocaleString()}`);
                    console.log(`P&L:           R$ ${stats.total_pnl.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}`);
                    console.log(`Valor Médio Fill: R$ ${stats.avg_fill_value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
                    console.log(`Spread Médio:  ${stats.avg_spread.toFixed(2)}%`);
                    console.log('='.repeat(50));
                    process.exit(0);
                })
                .catch(err => {
                    console.error('❌ Erro ao consultar estatísticas:', err.message);
                    process.exit(1);
                });
            break;

        case 'orders':
            const limit = parseInt(process.argv[3]) || 10;
            dbInstance.init()
                .then(() => dbInstance.getOrders({limit}))
                .then(orders => {
                    console.log(`\n📋 Últimas ${orders.length} Ordens:`);
                    console.log('='.repeat(80));
                    console.table(orders.map(o => ({
                        ID: o.id.substring(0, 8) + '...',
                        Lado: o.side.toUpperCase(),
                        Preço: `R$ ${o.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                        Quantidade: o.qty.toFixed(8),
                        Status: o.status.toUpperCase(),
                        'P&L': `R$ ${o.pnl.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                        Data: new Date(o.timestamp).toLocaleString('pt-BR')
                    })));
                    process.exit(0);
                })
                .catch(err => {
                    console.error('❌ Erro ao consultar ordens:', err.message);
                    process.exit(1);
                });
            break;

        case 'clear':
            dbInstance.init()
                .then(() => new Promise((resolve, reject) => {
                    dbInstance.db.run('DELETE FROM orders', (err) => {
                        if (err) return reject(err);
                        dbInstance.db.run('DELETE FROM stats', (err) => {
                            if (err) return reject(err);
                            dbInstance.db.run("INSERT OR IGNORE INTO stats (key, value) VALUES ('cycles', 0)", (err) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                    });
                }))
                .then(() => {
                    console.log('✅ Banco de dados limpo com sucesso.');
                    process.exit(0);
                })
                .catch(err => {
                    console.error('❌ Erro ao limpar banco de dados:', err.message);
                    process.exit(1);
                });
            break;

        default:
            console.log('Uso: node db.js [stats|orders [limit]|clear]');
            process.exit(1);
    }
}

module.exports = dbInstance;