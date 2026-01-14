const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const DB_PATH = path.join(__dirname, 'database', 'orders.db');

class Database {
    constructor() {
        this.dbPath = DB_PATH;
        this.db = null;
    }

    log(level, message) {
        const now = new Date().toLocaleString('pt-BR');
        const levelColor = {
            'INFO': chalk.cyan,
            'SUCCESS': chalk.green,
            'WARN': chalk.yellow,
            'ERROR': chalk.red
        }[level] || chalk.white;
        console.log(`${now} [${levelColor(level)}] [DB] ${message}`);
    }

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

                // Habilitar WAL mode
                this.db.run('PRAGMA journal_mode = WAL', (walErr) => {
                    if (walErr) {
                        this.log('WARN', `Falha ao ativar WAL mode: ${walErr.message}`);
                    } else {
                        this.log('INFO', 'WAL mode ativado');
                    }
                });

                // Executar todas as inicializações em série usando serialize
                this.db.serialize(() => {
                    const queries = [
                        // Tabela orders
                        `CREATE TABLE IF NOT EXISTS orders (
                            id TEXT PRIMARY KEY,
                            side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'unknown')),
                            price REAL NOT NULL CHECK (price > 0),
                            qty REAL NOT NULL CHECK (qty > 0),
                            status TEXT NOT NULL CHECK (status IN ('open', 'filled', 'cancelled', 'error')) DEFAULT 'open',
                            filledQty REAL DEFAULT 0 CHECK (filledQty >= 0),
                            timestamp INTEGER NOT NULL,
                            note TEXT,
                            external_id TEXT,
                            pnl REAL DEFAULT 0,
                            session_id INTEGER,
                            pair_id TEXT
                        )`,
                        // Adicionar índice para pair_id
                        `CREATE INDEX IF NOT EXISTS idx_orders_pair_id ON orders(pair_id)`,
                        // Índices para orders
                        `CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp)`,
                        `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
                        `CREATE INDEX IF NOT EXISTS idx_orders_side ON orders(side)`,
                        `CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id)`,
                        // Tabela stats
                        `CREATE TABLE IF NOT EXISTS stats (
                            key TEXT PRIMARY KEY,
                            value INTEGER DEFAULT 0,
                            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                        )`,
                        // Tabela price_history
                        `CREATE TABLE IF NOT EXISTS price_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            btc_price REAL NOT NULL CHECK (btc_price > 0),
                            timestamp INTEGER NOT NULL UNIQUE,
                            pair TEXT DEFAULT 'BTC-BRL'
                        )`,
                        // Índice para price_history
                        `CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp DESC)`,
                        // Tabela pnl_history
                        `CREATE TABLE IF NOT EXISTS pnl_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            pnl_value REAL NOT NULL,
                            timestamp INTEGER NOT NULL UNIQUE,
                            session_id INTEGER
                        )`,
                        // Índice para pnl_history
                        `CREATE INDEX IF NOT EXISTS idx_pnl_timestamp ON pnl_history(timestamp DESC)`,
                        // Tabela recovery_sessions
                        `CREATE TABLE IF NOT EXISTS recovery_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            started_at INTEGER NOT NULL,
                            ended_at INTEGER,
                            baseline REAL NOT NULL,
                            initial_pnl REAL NOT NULL,
                            status TEXT NOT NULL CHECK(status IN ('active','closed')) DEFAULT 'active',
                            last_manual_baseline_at INTEGER
                        )`,
                        // Tabela recovery_points
                        `CREATE TABLE IF NOT EXISTS recovery_points (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id INTEGER NOT NULL,
                            timestamp INTEGER NOT NULL,
                            pnl REAL NOT NULL,
                            percentage REAL NOT NULL,
                            baseline REAL NOT NULL,
                            FOREIGN KEY (session_id) REFERENCES recovery_sessions(id)
                        )`,
                        // Índice para recovery_points
                        `CREATE INDEX IF NOT EXISTS idx_recovery_points_session ON recovery_points(session_id)`,
                        // Inicializar stats
                        `INSERT OR IGNORE INTO stats (key, value) VALUES ('cycles', 0)`
                    ];

                    let completed = 0;

                    const executeQuery = (index) => {
                        if (index >= queries.length) {
                            this.log('SUCCESS', 'Banco de dados inicializado com sucesso.');
                            return resolve(this);
                        }

                        const query = queries[index];
                        this.db.run(query, (err) => {
                            if (err && !/duplicate column|already exists/i.test(err.message)) {
                                this.log('ERROR', `Erro ao executar query ${index}: ${err.message}`);
                                return reject(err);
                            }
                            executeQuery(index + 1);
                        });
                    };

                    executeQuery(0);
                });
            });
        });
    }

    // Novo método para salvar PnL (compatível com bot.js e dashboard)
    async savePnL(pnlValue, timestamp = null, sessionId = null) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const ts = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO pnl_history (pnl_value, timestamp, session_id)
                VALUES (?, ?, ?)
            `);
            
            stmt.run(parseFloat(pnlValue), ts, sessionId, function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ id: this.lastID, timestamp: ts });
            });
            
            stmt.finalize();
        });
    }

    // Novo método para buscar histórico de PnL (compatível com dashboard)
    async getPnLHistory(hoursBack = 24, limit = 500) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const cutoffTs = Math.floor((Date.now() - hoursBack * 3600 * 1000) / 1000);

        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT pnl_value as value, timestamp 
                FROM pnl_history
                WHERE timestamp >= ?
                ORDER BY timestamp ASC
                LIMIT ?
            `, [cutoffTs, limit], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                
                const history = (rows || []).map(row => ({
                    value: parseFloat(row.value),
                    timestamp: row.timestamp,
                    iso: new Date(row.timestamp * 1000).toISOString()
                }));
                
                resolve(history);
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
                (id, side, price, qty, status, filledQty, timestamp, note, external_id, pnl, session_id, pair_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const timestamp = order.timestamp ? Math.floor(order.timestamp / 1000) : Math.floor(Date.now() / 1000);
            stmt.run(
                order.id,
                order.side,
                order.price,
                order.qty,
                order.status,
                order.filledQty || 0,
                timestamp,
                order.note || null,
                order.external_id || null,
                order.pnl || 0,
                order.sessionId || null,
                order.pairId || null,
                (err) => {
                    stmt.finalize();
                    if (err) {
                        this.log('ERROR', `Erro ao salvar ordem: ${err.message}`);
                        reject(err);
                    } else {
                        this.log('INFO', `Ordem salva: ${order.side} ${order.id}${order.pairId ? ` [Pair: ${order.pairId.substring(0, 15)}...]` : ''}`);
                        resolve(order);
                    }
                }
            );
        });
    }

    async getOrders({limit = 50, status = null, minAge = null} = {}) {
        let query = `
            SELECT 
                id, side, price, qty, status, filledQty, 
                timestamp, note, external_id, pnl, session_id, pair_id
            FROM orders
        `;
        let params = [];

        const conditions = [];
        
        if (status) {
            conditions.push(`status = ?`);
            params.push(status);
        }
        
        if (minAge) {
            const minTimestamp = Math.floor((Date.now() - minAge) / 1000);
            conditions.push(`timestamp <= ?`);
            params.push(minTimestamp);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Carrega fills históricos (status='filled'), opcionalmente filtrando por sessão
    async loadHistoricalFills({ sessionId = null } = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        let query = `
            SELECT side, qty, price, timestamp, session_id
            FROM orders
            WHERE status = 'filled'
        `;
        const params = [];
        if (sessionId !== null && sessionId !== undefined) {
            query += ` AND session_id = ?`;
            params.push(sessionId);
        }
        query += ` ORDER BY timestamp ASC`;

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                const fills = (rows || []).map(r => ({
                    side: r.side,
                    qty: parseFloat(r.qty),
                    price: parseFloat(r.price),
                    limitPrice: parseFloat(r.price),
                    feeRate: null,
                    timestamp: r.timestamp
                }));
                resolve(fills);
            });
        });
    }

    // Salva fills históricos no schema de orders
    async saveHistoricalFills(fills = []) {
        if (!this.db || !Array.isArray(fills) || fills.length === 0) {
            return;
        }
        for (const f of fills) {
            const order = {
                id: f.id || `${f.side}-${f.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
                side: f.side || 'unknown',
                price: parseFloat(f.price || f.limitPrice || 0),
                qty: parseFloat(f.qty || 0),
                status: 'filled',
                filledQty: parseFloat(f.qty || 0),
                timestamp: f.timestamp ? Math.floor(f.timestamp) * 1000 < 1e12 ? f.timestamp * 1000 : f.timestamp : Date.now(),
                note: f.note || 'historical_fill',
                external_id: f.external_id || null,
                pnl: f.pnl || 0,
                sessionId: f.sessionId || null
            };
            try {
                await this.saveOrder(order);
            } catch (e) {
                // Ignorar erros individuais para não interromper encerramento
                this.log('WARN', `Falha ao salvar historical fill: ${e.message}`);
            }
        }
    }

    async getStats({hours = 24} = {}) {
        const startTime = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
        
        return new Promise((resolve, reject) => {
            const queries = {
                totalOrders: `SELECT COUNT(*) as count FROM orders WHERE timestamp >= ?`,
                filledOrders: `SELECT COUNT(*) as count FROM orders WHERE status = 'filled' AND timestamp >= ?`,
                totalVolume: `SELECT SUM(qty * price) as volume FROM orders WHERE status = 'filled' AND timestamp >= ?`,
                totalPnL: `SELECT SUM(pnl) as total FROM orders WHERE status = 'filled' AND timestamp >= ?`,
                openOrders: `SELECT COUNT(*) as count FROM orders WHERE status = 'open'`
            };

            const stats = {};
            let completed = 0;
            const total = Object.keys(queries).length;

            for (const [key, query] of Object.entries(queries)) {
                const params = key === 'openOrders' ? [] : [startTime];
                this.db.get(query, params, (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    
                    if (key === 'totalOrders' || key === 'filledOrders' || key === 'openOrders') {
                        stats[key] = row.count || 0;
                    } else if (key === 'totalVolume') {
                        stats[key] = row.volume || 0;
                    } else if (key === 'totalPnL') {
                        stats[key] = row.total || 0;
                    }

                    completed++;
                    if (completed === total) {
                        // Calcular métricas adicionais
                        stats.fillRate = stats.totalOrders > 0 ? (stats.filledOrders / stats.totalOrders * 100) : 0;
                        stats.avgOrderSize = stats.filledOrders > 0 ? (stats.totalVolume / stats.filledOrders) : 0;
                        
                        resolve(stats);
                    }
                });
            }
        });
    }

    async savePrice(price, timestamp = null) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const ts = timestamp || Math.floor(Date.now() / 1000);
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO price_history (btc_price, timestamp, pair)
                VALUES (?, ?, 'BTC-BRL')
            `);
            
            stmt.run(price, ts, function(err) {
                stmt.finalize();
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    // Alias para compatibilidade com código existente
    async saveBtcPrice(...args) {
        return this.savePrice(...args);
    }

    async getPriceHistory(hoursBack = 24, limit = 500) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const cutoffTs = Math.floor((Date.now() - hoursBack * 3600 * 1000) / 1000);

        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT btc_price, timestamp
                FROM price_history
                WHERE timestamp >= ?
                ORDER BY timestamp ASC
                LIMIT ?
            `, [cutoffTs, limit], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                
                // Converter para formato esperado (timestamp em segundos)
                const history = rows.map(row => ({
                    timestamp: row.timestamp,
                    price: row.btc_price
                }));
                
                resolve(history);
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        this.log('ERROR', `Erro ao fechar banco: ${err.message}`);
                    } else {
                        this.log('INFO', 'Banco de dados fechado.');
                    }
                    resolve();
                });
            });
        }
    }

    // Métodos relacionados a recovery sessions (mantidos do original)
    async startRecoverySession(baseline, initialPnl) {
        const startedAt = Math.floor(Date.now() / 1000);
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO recovery_sessions (started_at, baseline, initial_pnl, status)
                VALUES (?, ?, ?, 'active')
            `);
            
            stmt.run(startedAt, baseline, initialPnl, function(err) {
                stmt.finalize();
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async closeRecoverySession(sessionId) {
        const endedAt = Math.floor(Date.now() / 1000);
        
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE recovery_sessions 
                SET ended_at = ?, status = 'closed'
                WHERE id = ?
            `, [endedAt, sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Alias compatível com bot.js
    async endRecoverySession(sessionId) {
        return this.closeRecoverySession(sessionId);
    }

    async appendRecoveryPoint(sessionId, pnl, percentage, baseline) {
        const ts = Math.floor(Date.now() / 1000);
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO recovery_points (session_id, timestamp, pnl, percentage, baseline)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(sessionId, ts, parseFloat(pnl), parseFloat(percentage), parseFloat(baseline), function(err) {
                stmt.finalize();
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    async updateRecoveryBaseline(sessionId, newBaseline) {
        const nowTs = Math.floor(Date.now() / 1000);
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE recovery_sessions
                SET baseline = ?, last_manual_baseline_at = ?
                WHERE id = ?
            `, [parseFloat(newBaseline), nowTs, sessionId], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    }

    async getActiveRecoverySession() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM recovery_sessions
                WHERE status = 'active'
                ORDER BY started_at DESC
                LIMIT 1
            `, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Backfill: Parejar ordens BUY/SELL antigas que não têm pair_id
    async backfillLegacyPairs() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // 1. Encontrar todas as ordens sem pair_id, ordenadas por timestamp
                this.db.all(`
                    SELECT id, side, price, qty, timestamp 
                    FROM orders 
                    WHERE pair_id IS NULL OR pair_id = ''
                    ORDER BY timestamp ASC
                `, async (err, rows) => {
                    if (err) return reject(err);
                    
                    if (!rows || rows.length === 0) {
                        this.log('INFO', 'Nenhuma ordem legada para fazer backfill');
                        return resolve({updated: 0});
                    }

                    this.log('INFO', `Iniciando backfill de ${rows.length} ordens legadas...`);

                    const buys = rows.filter(r => r.side.toLowerCase() === 'buy');
                    const sells = rows.filter(r => r.side.toLowerCase() === 'sell');
                    let updated = 0;

                    // 2. Para cada BUY, encontrar o SELL mais próximo no tempo
                    for (let i = 0; i < buys.length; i++) {
                        const buyOrder = buys[i];
                        const buyTime = new Date(buyOrder.timestamp).getTime();
                        
                        // Procurar SELL não pareado após este BUY
                        let closestSell = null;
                        let minTimeDiff = Infinity;
                        let closestSellIndex = -1;

                        for (let j = 0; j < sells.length; j++) {
                            const sellOrder = sells[j];
                            const sellTime = new Date(sellOrder.timestamp).getTime();
                            
                            // SELL deve ser após BUY e dentro de 1 hora
                            if (sellTime >= buyTime && sellTime - buyTime < 3600000) {
                                const timeDiff = sellTime - buyTime;
                                if (timeDiff < minTimeDiff) {
                                    minTimeDiff = timeDiff;
                                    closestSell = sellOrder;
                                    closestSellIndex = j;
                                }
                            }
                        }

                        // 3. Se encontrou um SELL pareado, atribuir mesmo pair_id a ambos
                        if (closestSell && closestSellIndex >= 0) {
                            const pairId = `PAIR_LEGACY_${buyOrder.id}_${Date.now()}`;
                            
                            // Atualizar BUY
                            await new Promise((res, rej) => {
                                this.db.run(
                                    `UPDATE orders SET pair_id = ? WHERE id = ?`,
                                    [pairId, buyOrder.id],
                                    (err) => err ? rej(err) : res()
                                );
                            });

                            // Atualizar SELL
                            await new Promise((res, rej) => {
                                this.db.run(
                                    `UPDATE orders SET pair_id = ? WHERE id = ?`,
                                    [pairId, closestSell.id],
                                    (err) => err ? rej(err) : res()
                                );
                            });

                            updated += 2;
                            this.log('SUCCESS', `Pareado: ${buyOrder.id} (BUY) ↔ ${closestSell.id} (SELL) → ${pairId}`);
                            
                            // Remover SELL da lista para não reutilizá-lo
                            sells.splice(closestSellIndex, 1);
                        }
                    }

                    this.log('SUCCESS', `Backfill concluído: ${updated} ordens atualizadas`);
                    resolve({updated, totalLegacy: rows.length});
                });
            });
        });
    }
}

module.exports = new Database();