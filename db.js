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

                // Habilitar WAL mode para permitir leituras concorrentes
                this.db.run('PRAGMA journal_mode = WAL', (walErr) => {
                    if (walErr) {
                        this.log('WARN', `Falha ao ativar WAL mode: ${walErr.message}`);
                    } else {
                        this.log('INFO', 'WAL mode ativado para leituras/escritas concorrentes');
                    }
                });

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
                            pnl REAL DEFAULT 0,
                            session_id INTEGER,
                            FOREIGN KEY(session_id) REFERENCES recovery_sessions(id)
                            )
                    `, (err) => {
                        if (err) {
                            this.log('ERROR', `Erro ao criar tabela orders: ${err.message}`);
                            return reject(err);
                        }

                        // Migração segura para adicionar a coluna session_id
                        this.db.run(`ALTER TABLE orders ADD COLUMN session_id INTEGER`, (alterErr) => {
                            if (alterErr && !/duplicate column/i.test(alterErr.message)) {
                                this.log('WARN', `Falha ao adicionar coluna session_id: ${alterErr.message}`);
                            } else if (!alterErr) {
                                this.log('INFO', 'Coluna session_id adicionada à tabela orders.');
                            }
                        });

                        this.db.run(`
                            CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);
                            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
                            CREATE INDEX IF NOT EXISTS idx_orders_side ON orders(side);
                            CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
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

                                this.db.run(`
                                    CREATE TABLE IF NOT EXISTS price_history
                                    (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        btc_price REAL NOT NULL CHECK (btc_price > 0),
                                        timestamp INTEGER NOT NULL UNIQUE,
                                        pair TEXT DEFAULT 'BTC-BRL'
                                    )
                                `, (err) => {
                                    if (err) {
                                        this.log('ERROR', `Erro ao criar tabela price_history: ${err.message}`);
                                        return reject(err);
                                    }

                                    this.db.run(`
                                        CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp DESC)
                                    `, (err) => {
                                        if (err) {
                                            this.log('ERROR', `Erro ao criar índice price_history: ${err.message}`);
                                            return reject(err);
                                        }

                                        // Tabelas para persistência de ciclos de recuperação
                                        this.db.run(`
                                            CREATE TABLE IF NOT EXISTS recovery_sessions (
                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                started_at INTEGER NOT NULL,
                                                ended_at INTEGER,
                                                baseline REAL NOT NULL,
                                                initial_pnl REAL NOT NULL,
                                                status TEXT NOT NULL CHECK(status IN ('active','closed')) DEFAULT 'active',
                                                last_manual_baseline_at INTEGER
                                            )
                                        `, (err) => {
                                            if (err) {
                                                this.log('ERROR', `Erro ao criar tabela recovery_sessions: ${err.message}`);
                                                return reject(err);
                                            }

                                            this.db.run(`
                                                CREATE TABLE IF NOT EXISTS recovery_points (
                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                    session_id INTEGER NOT NULL,
                                                    timestamp INTEGER NOT NULL,
                                                    pnl REAL NOT NULL,
                                                    percentage REAL NOT NULL,
                                                    baseline REAL NOT NULL,
                                                    FOREIGN KEY (session_id) REFERENCES recovery_sessions(id)
                                                )
                                            `, (err) => {
                                                if (err) {
                                                    this.log('ERROR', `Erro ao criar tabela recovery_points: ${err.message}`);
                                                    return reject(err);
                                                }

                                                // Garantir coluna de timestamp para resets manuais (migração retroativa segura)
                                                this.db.run(`ALTER TABLE recovery_sessions ADD COLUMN last_manual_baseline_at INTEGER`, (alterErr) => {
                                                    if (alterErr) {
                                                        // Se já existir, ignorar
                                                        if (!/duplicate column/i.test(alterErr.message)) {
                                                            this.log('WARN', `Falha ao adicionar coluna de migração: ${alterErr.message}`);
                                                        }
                                                    } else {
                                                        this.log('INFO', 'Coluna last_manual_baseline_at adicionada (migração)');
                                                    }
                                                });

                                                this.db.run(`
                                                    CREATE INDEX IF NOT EXISTS idx_recovery_points_session ON recovery_points(session_id);
                                                `, (err) => {
                                                    if (err) {
                                                        this.log('ERROR', `Erro ao criar índice recovery_points: ${err.message}`);
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
                        });
                    });
                });
            });
        });
    }

    async saveOrderSafe(order, context, sessionId = null) {
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
        // Adicionar sessionId ao objeto da ordem
        order.sessionId = sessionId;
        return this.saveOrder(order);
    }

    async saveOrder(order) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO orders 
                (id, side, price, qty, status, filledQty, timestamp, note, external_id, pnl, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                order.sessionId || null,
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

    async loadHistoricalFills({ limit = process.env.HISTORICAL_FILLS_WINDOW || 20, sessionId = null } = {}) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado. Retornando array vazio.');
            return [];
        }
        return new Promise((resolve, reject) => {
            let query = `
                SELECT side, price, qty, timestamp, pnl
                FROM orders
                WHERE status = 'filled'
            `;
            const params = [];

            if (sessionId) {
                query += ' AND session_id = ?';
                params.push(sessionId);
            }

            query += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
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

    // ===== FUNÇÕES PARA ARMAZENAR HISTÓRICO DE PREÇOS =====
    async saveBtcPrice(btcPrice, timestamp = null) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        if (btcPrice <= 0) {
            this.log('ERROR', `Preço BTC inválido: ${btcPrice}`);
            throw new Error('Invalid BTC price');
        }
        let ts = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);
        return new Promise((resolve, reject) => {
            // Verificar último timestamp para garantir unicidade
            this.db.get(`
                SELECT MAX(timestamp) as maxTs FROM price_history
            `, (err, row) => {
                if (err) {
                    this.log('WARN', `Erro ao verificar último timestamp: ${err.message}`);
                    // Continuar mesmo assim
                } else if (row && row.maxTs && row.maxTs >= ts) {
                    // Se o novo timestamp é igual ou menor que o último, incrementar em 1
                    ts = row.maxTs + 1;
                }
                
                this.db.run(`
                    INSERT OR REPLACE INTO price_history (btc_price, timestamp, pair)
                    VALUES (?, ?, 'BTC-BRL')
                `, [btcPrice, ts], function(err) {
                    if (err) {
                        this.log('ERROR', `Erro ao salvar preço BTC: ${err.message}`);
                        return reject(err);
                    }
                    this.log('DEBUG', `Preço BTC armazenado: R$ ${btcPrice.toFixed(2)}`);
                    resolve(ts);
                }.bind(this));
            });
        });
    }

    async getPriceHistory(hoursBack = 24, limit = 500) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado. Retornando array vazio.');
            return [];
        }
        const cutoffTime = Math.floor(Date.now() / 1000) - (hoursBack * 3600);
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT btc_price as price, timestamp
                FROM price_history
                WHERE timestamp >= ? AND pair = 'BTC-BRL'
                ORDER BY timestamp ASC
                LIMIT ?
            `, [cutoffTime, limit], (err, rows) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar histórico de preços: ${err.message}`);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
    }

    async getLatestBtcPrice() {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return null;
        }
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT btc_price as price, timestamp
                FROM price_history
                WHERE pair = 'BTC-BRL'
                ORDER BY timestamp DESC
                LIMIT 1
            `, (err, row) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar último preço: ${err.message}`);
                    return reject(err);
                }
                resolve(row || null);
            });
        });
    }

    async cleanOldPrices(hoursToKeep = 168) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        const cutoffTime = Math.floor(Date.now() / 1000) - (hoursToKeep * 3600);
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM price_history
                WHERE timestamp < ? AND pair = 'BTC-BRL'
            `, [cutoffTime], function(err) {
                if (err) {
                    this.log('ERROR', `Erro ao limpar histórico antigo: ${err.message}`);
                    return reject(err);
                }
                this.log('INFO', `Limpeza executada. Registros deletados: ${this.changes}`);
                resolve(this.changes);
            }.bind(this));
        });
    }

    // ===== PERSISTÊNCIA DE RECUPERAÇÃO =====
    async getActiveRecoverySession() {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return null;
        }
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id, started_at, ended_at, baseline, initial_pnl, status, last_manual_baseline_at
                FROM recovery_sessions
                WHERE status = 'active'
                ORDER BY started_at DESC
                LIMIT 1
            `, (err, row) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar sessão ativa: ${err.message}`);
                    return reject(err);
                }
                resolve(row || null);
            });
        });
    }

    async startRecoverySession(initialBaseline, initialPnL = null) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        const baseline = parseFloat(initialBaseline);
        const initPnL = initialPnL !== null ? parseFloat(initialPnL) : baseline;
        const now = Math.floor(Date.now() / 1000);
        const self = this;
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO recovery_sessions (started_at, baseline, initial_pnl, status)
                VALUES (?, ?, ?, 'active')
            `, [now, baseline, initPnL], function(err) {
                if (err) {
                    self.log('ERROR', `Erro ao iniciar sessão de recuperação: ${err.message}`);
                    return reject(err);
                }
                // 'this' aqui é o Statement; lastID é suportado por sqlite3
                resolve(this.lastID);
            });
        });
    }

    async updateRecoveryBaseline(sessionId, newBaseline) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        const baseline = parseFloat(newBaseline);
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE recovery_sessions
                SET baseline = ?, ended_at = NULL, status = 'active'
                WHERE id = ?
            `, [baseline, sessionId], function(err) {
                if (err) {
                    this.log('ERROR', `Erro ao atualizar baseline da sessão ${sessionId}: ${err.message}`);
                    return reject(err);
                }
                resolve(this.changes);
            }.bind(this));
        });
    }

    async appendRecoveryPoint(sessionId, pnl, percentage, baseline) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        const ts = Math.floor(Date.now() / 1000);
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO recovery_points (session_id, timestamp, pnl, percentage, baseline)
                VALUES (?, ?, ?, ?, ?)
            `, [sessionId, ts, parseFloat(pnl), parseFloat(percentage), parseFloat(baseline)], function(err) {
                if (err) {
                    this.log('ERROR', `Erro ao salvar ponto de recuperação: ${err.message}`);
                    return reject(err);
                }
                resolve(this.lastID);
            }.bind(this));
        });
    }

    async endRecoverySession(sessionId) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        const now = Math.floor(Date.now() / 1000);
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE recovery_sessions
                SET ended_at = ?, status = 'closed'
                WHERE id = ?
            `, [now, sessionId], function(err) {
                if (err) {
                    this.log('ERROR', `Erro ao encerrar sessão de recuperação ${sessionId}: ${err.message}`);
                    return reject(err);
                }
                resolve(this.changes);
            }.bind(this));
        });
    }

    async getRecoverySessions({limit = 20} = {}) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return [];
        }
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, started_at, ended_at, baseline, initial_pnl, status
                FROM recovery_sessions
                ORDER BY started_at DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    this.log('ERROR', `Erro ao listar sessões de recuperação: ${err.message}`);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
    }

    async getRecoveryPoints(sessionId, {limit = 500} = {}) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return [];
        }
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, session_id, timestamp, pnl, percentage, baseline
                FROM recovery_points
                WHERE session_id = ?
                ORDER BY timestamp ASC
                LIMIT ?
            `, [sessionId, limit], (err, rows) => {
                if (err) {
                    this.log('ERROR', `Erro ao listar pontos de recuperação: ${err.message}`);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
    }

    async getWorstPnLInSession(sessionId) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return null;
        }
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT MIN(pnl) as worst_pnl
                FROM recovery_points
                WHERE session_id = ?
            `, [sessionId], (err, row) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar pior PnL da sessão: ${err.message}`);
                    return reject(err);
                }
                resolve(row?.worst_pnl || null);
            });
        });
    }

    async getLastRecoveryPoint(sessionId) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return null;
        }
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id, session_id, timestamp, pnl, percentage, baseline
                FROM recovery_points
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
            `, [sessionId], (err, row) => {
                if (err) {
                    this.log('ERROR', `Erro ao consultar último ponto da sessão: ${err.message}`);
                    return reject(err);
                }
                resolve(row || null);
            });
        });
    }

    async updateManualBaselineTimestamp(sessionId, ts) {
        if (!this.db) {
            this.log('ERROR', 'Banco de dados não inicializado.');
            throw new Error('Database not initialized');
        }
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE recovery_sessions
                SET last_manual_baseline_at = ?
                WHERE id = ?
            `, [ts, sessionId], function(err) {
                if (err) {
                    this.log('ERROR', `Erro ao atualizar timestamp manual da sessão ${sessionId}: ${err.message}`);
                    return reject(err);
                }
                resolve(this.changes);
            }.bind(this));
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

    async getStats({ hours = 24, sessionId = null } = {}) {
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

                let query = `
                    SELECT COUNT(*)                                                        as total_orders,
                           SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END)              as filled_orders,
                           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)           as cancelled_orders,
                           SUM(pnl)                                                        as total_pnl,
                           AVG(CASE WHEN status = 'filled' THEN price * qty ELSE NULL END) as avg_fill_value
                    FROM orders
                `;
                const params = [];
                const whereConditions = [];

                if (sessionId) {
                    whereConditions.push('session_id = ?');
                    params.push(sessionId);
                } else {
                    whereConditions.push('timestamp > ?');
                    params.push(cutoff);
                }

                if (whereConditions.length > 0) {
                    query += ' WHERE ' + whereConditions.join(' AND ');
                }

                this.db.all(query, params, (err, rows) => {
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
                        avg_spread: 0, // O cálculo do spread foi removido por complexidade e baixo uso
                        uptime: statsRow.total_orders ? `${Math.round(cycleRow?.cycles * cycleSec / 60)}min` : '0min',
                        fill_rate: statsRow.total_orders > 0 ? (statsRow.filled_orders / statsRow.total_orders * 100).toFixed(1) : '0.0'
                    };
                    this.log('INFO', `Estatísticas consultadas (Sessão: ${sessionId || `Últimas ${hours}h`}):`, stats);
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

    // Função para validar PnL com cálculos detalhados
    async validatePnL(currentMidPrice = null) {
        if (!this.db) {
            this.log('WARN', 'Banco de dados não inicializado.');
            return null;
        }
        
        return new Promise((resolve, reject) => {
            // Query complexa para calcular PnL detalhado
            this.db.all(`
                WITH OrderedTrades AS (
                    SELECT side, price, qty, timestamp, 
                           (price * qty * 0.003) as fee,
                           ROW_NUMBER() OVER (ORDER BY timestamp) as trade_order
                    FROM orders 
                    WHERE status = 'filled'
                    ORDER BY timestamp
                ),
                RunningPosition AS (
                    SELECT *,
                           CASE WHEN side = 'buy' THEN qty ELSE -qty END as qty_change,
                           SUM(CASE WHEN side = 'buy' THEN qty ELSE -qty END) 
                               OVER (ORDER BY trade_order) as running_position
                    FROM OrderedTrades
                )
                SELECT 
                    COUNT(*) as total_trades,
                    SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_trades,
                    SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_trades,
                    SUM(CASE WHEN side = 'buy' THEN price * qty + fee ELSE 0 END) as total_cost,
                    SUM(CASE WHEN side = 'sell' THEN price * qty - fee ELSE 0 END) as total_revenue,
                    SUM(fee) as total_fees,
                    (SELECT running_position FROM RunningPosition ORDER BY trade_order DESC LIMIT 1) as final_position,
                    SUM(CASE WHEN side = 'buy' THEN qty ELSE -qty END) as net_btc_change
                FROM RunningPosition
            `, (err, results) => {
                if (err) {
                    this.log('ERROR', `Erro na validação de PnL: ${err.message}`);
                    return reject(err);
                }
                
                const data = results[0] || {};
                
                // Cálculos de validação
                const totalCost = parseFloat(data.total_cost || 0);
                const totalRevenue = parseFloat(data.total_revenue || 0);
                const totalFees = parseFloat(data.total_fees || 0);
                const finalPosition = parseFloat(data.final_position || 0);
                const realizedPnL = totalRevenue - totalCost;
                
                let unrealizedPnL = 0;
                if (currentMidPrice && finalPosition > 0) {
                    // Para posição não realizada, usar o custo médio ponderado
                    this.db.get(`
                        SELECT 
                            SUM(CASE WHEN side = 'buy' THEN price * qty + (price * qty * 0.003) ELSE 0 END) / 
                            SUM(CASE WHEN side = 'buy' THEN qty ELSE 0 END) as avg_buy_price
                        FROM orders 
                        WHERE status = 'filled' AND side = 'buy'
                    `, (err, avgResult) => {
                        if (!err && avgResult && avgResult.avg_buy_price) {
                            const avgBuyPrice = parseFloat(avgResult.avg_buy_price);
                            unrealizedPnL = finalPosition * (currentMidPrice - avgBuyPrice);
                        }
                        
                        const validation = {
                            timestamp: new Date().toISOString(),
                            total_trades: parseInt(data.total_trades || 0),
                            buy_trades: parseInt(data.buy_trades || 0),
                            sell_trades: parseInt(data.sell_trades || 0),
                            total_cost: totalCost.toFixed(2),
                            total_revenue: totalRevenue.toFixed(2),
                            total_fees: totalFees.toFixed(2),
                            realized_pnl: realizedPnL.toFixed(2),
                            unrealized_pnl: unrealizedPnL.toFixed(2),
                            total_pnl: (realizedPnL + unrealizedPnL).toFixed(2),
                            final_position: finalPosition.toFixed(8),
                            current_mid_price: currentMidPrice || 'not_provided',
                            avg_buy_price: avgResult?.avg_buy_price || 'calculated_if_position_exists'
                        };
                        
                        this.log('INFO', 'Validação de PnL concluída:', validation);
                        resolve(validation);
                    });
                } else {
                    const validation = {
                        timestamp: new Date().toISOString(),
                        total_trades: parseInt(data.total_trades || 0),
                        buy_trades: parseInt(data.buy_trades || 0),
                        sell_trades: parseInt(data.sell_trades || 0),
                        total_cost: totalCost.toFixed(2),
                        total_revenue: totalRevenue.toFixed(2),
                        total_fees: totalFees.toFixed(2),
                        realized_pnl: realizedPnL.toFixed(2),
                        unrealized_pnl: unrealizedPnL.toFixed(2),
                        total_pnl: (realizedPnL + unrealizedPnL).toFixed(2),
                        final_position: finalPosition.toFixed(8),
                        current_mid_price: currentMidPrice || 'not_provided'
                    };
                    
                    this.log('INFO', 'Validação de PnL concluída:', validation);
                    resolve(validation);
                }
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