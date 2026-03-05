const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'database', 'orders.db');

class Database {
    constructor() {
        this.dbPath = DB_PATH;
        this.db = null;
        this.supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
        this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        this.supabasePostTimeoutBaseMs = Math.max(7000, parseInt(process.env.SUPABASE_POST_TIMEOUT_BASE_MS || '16000', 10));
        this.supabasePostTimeoutStepMs = Math.max(1000, parseInt(process.env.SUPABASE_POST_TIMEOUT_STEP_MS || '7000', 10));
        this.supabaseGetTimeoutBaseMs = Math.max(10000, parseInt(process.env.SUPABASE_GET_TIMEOUT_BASE_MS || '15000', 10));
        this.supabaseGetTimeoutStepMs = Math.max(1000, parseInt(process.env.SUPABASE_GET_TIMEOUT_STEP_MS || '7000', 10));
        this.supabaseRetryMaxAttempts = Math.max(3, parseInt(process.env.SUPABASE_RETRY_MAX_ATTEMPTS || '4', 10));
        this.priceSaveFailureCooldownMs = Math.max(5000, parseInt(process.env.SUPABASE_PRICE_SAVE_COOLDOWN_MS || '45000', 10));
        this.nextPriceSaveAllowedAt = 0;
        this.runtimeConfigCache = new Map();
        this.runtimeConfigCacheTtlMs = Math.max(2000, parseInt(process.env.RUNTIME_CONFIG_CACHE_TTL_MS || '30000', 10));
        this.ordersCacheTtlMs = Math.max(1000, parseInt(process.env.DB_ORDERS_CACHE_TTL_MS || '8000', 10));
        this.fillsCacheTtlMs = Math.max(1000, parseInt(process.env.DB_FILLS_CACHE_TTL_MS || '12000', 10));
        this.ordersCache = new Map();
        this.fillsCache = new Map();
        this.useSupabasePriceHistory = Boolean(this.supabaseUrl && this.supabaseKey);
        this.useSupabasePnlHistory = Boolean(this.supabaseUrl && this.supabaseKey);
        this.useSupabaseOrders = Boolean(this.supabaseUrl && this.supabaseKey);
        this.useSupabaseOnly = Boolean(this.supabaseUrl && this.supabaseKey);
    }

    assertSupabaseForHistory(kind) {
        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error(`Supabase não configurado para ${kind}. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.`);
        }
    }

    assertSupabaseConfigured(kind = 'operação') {
        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error(`Supabase não configurado para ${kind}. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.`);
        }
    }

    isRetryableSupabaseError(err) {
        const status = err?.response?.status;
        const code = err?.code;
        const message = String(err?.message || '').toLowerCase();
        if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;
        if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND') return true;
        if (message.includes('timeout') || message.includes('network error') || message.includes('socket hang up')) return true;
        return false;
    }

    async postSupabaseWithRetry(pathname, payload, contextLabel = 'operação', maxAttempts = null) {
        let lastErr = null;
        const attempts = maxAttempts || this.supabaseRetryMaxAttempts;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const timeoutMs = this.supabasePostTimeoutBaseMs + (attempt * this.supabasePostTimeoutStepMs);
            try {
                await axios.post(`${this.supabaseUrl}/rest/v1/${pathname}`, payload, {
                    headers: {
                        apikey: this.supabaseKey,
                        Authorization: `Bearer ${this.supabaseKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal'
                    },
                    timeout: timeoutMs
                });
                return;
            } catch (err) {
                lastErr = err;
                if (!this.isRetryableSupabaseError(err) || attempt === attempts) {
                    throw err;
                }
                const waitMs = attempt * 700;
                this.log('WARN', `${contextLabel} falhou (tentativa ${attempt}/${attempts}) [timeout=${timeoutMs}ms]: ${err.message}. Repetindo em ${waitMs}ms...`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
        throw lastErr;
    }

    async getSupabaseWithRetry(pathname, params = {}, contextLabel = 'operação', maxAttempts = null) {
        let lastErr = null;
        const attempts = maxAttempts || this.supabaseRetryMaxAttempts;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const timeoutMs = this.supabaseGetTimeoutBaseMs + (attempt * this.supabaseGetTimeoutStepMs);
            try {
                const response = await axios.get(`${this.supabaseUrl}/rest/v1/${pathname}`, {
                    params,
                    headers: {
                        apikey: this.supabaseKey,
                        Authorization: `Bearer ${this.supabaseKey}`
                    },
                    timeout: timeoutMs
                });
                return response;
            } catch (err) {
                lastErr = err;
                if (!this.isRetryableSupabaseError(err) || attempt === attempts) {
                    throw err;
                }
                const waitMs = attempt * 1000;
                this.log('WARN', `${contextLabel} falhou (tentativa ${attempt}/${attempts}) [timeout=${timeoutMs}ms]: ${err.message}. Repetindo em ${waitMs}ms...`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
        throw lastErr;
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
        if (this.useSupabaseOnly) {
            this.log('INFO', 'Modo Supabase-only ativo. SQLite desabilitado.');
            return this;
        }
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
                        // Tabela momentum_orders - Registros de validação de momentum
                        `CREATE TABLE IF NOT EXISTS momentum_orders (
                            id TEXT PRIMARY KEY,
                            side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
                            created_price REAL NOT NULL CHECK (created_price > 0),
                            current_price REAL NOT NULL CHECK (current_price > 0),
                            status TEXT NOT NULL CHECK (status IN ('simulated', 'pending', 'confirmed', 'rejected', 'expired')) DEFAULT 'simulated',
                            qty REAL NOT NULL CHECK (qty > 0),
                            peaks TEXT,
                            valleys TEXT,
                            confirmation_reversals INTEGER DEFAULT 0,
                            reason TEXT,
                            reversal_threshold REAL DEFAULT 0.01,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            confirmed_at INTEGER,
                            rejected_at INTEGER,
                            price_history TEXT
                        )`,
                        // Índice para momentum_orders
                        `CREATE INDEX IF NOT EXISTS idx_momentum_status ON momentum_orders(status)`,
                        `CREATE INDEX IF NOT EXISTS idx_momentum_created_at ON momentum_orders(created_at DESC)`,
                        `CREATE INDEX IF NOT EXISTS idx_momentum_side ON momentum_orders(side)`,
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
        const rawTs = timestamp == null ? Date.now() : Number(timestamp);
        const ts = rawTs > 1e12 ? Math.floor(rawTs / 1000) : Math.floor(rawTs);
        this.assertSupabaseForHistory('pnl_history');

        try {
            const payload = {
                pnl_value: parseFloat(pnlValue),
                timestamp: parseInt(ts, 10),
                session_id: sessionId == null ? null : String(sessionId)
            };
            await this.postSupabaseWithRetry('pnl_history', payload, 'Salvar pnl_history');

            return { source: 'supabase', timestamp: ts };
        } catch (err) {
            this.log('ERROR', `Falha ao salvar pnl_history no Supabase: ${err.message}`);
            throw err;
        }
    }

    // Novo método para buscar histórico de PnL (compatível com dashboard)
    async getPnLHistory(hoursBack = 24, limit = 500) {
        const useCutoff = Number.isFinite(hoursBack) && hoursBack > 0;
        const cutoffTs = useCutoff ? Math.floor((Date.now() - hoursBack * 3600 * 1000) / 1000) : null;
        this.assertSupabaseForHistory('pnl_history');

        try {
            const response = await this.getSupabaseWithRetry(
                'pnl_history',
                {
                    select: 'pnl_value,timestamp,session_id',
                    ...(useCutoff ? { timestamp: `gte.${cutoffTs}` } : {}),
                    order: 'timestamp.asc',
                    limit
                },
                'Carregar pnl_history'
            );

            const rows = Array.isArray(response.data) ? response.data : [];
            return rows.map((row) => {
                const ts = parseInt(row.timestamp, 10);
                return {
                    value: parseFloat(row.pnl_value),
                    timestamp: ts,
                    iso: new Date(ts * 1000).toISOString(),
                    sessionId: row.session_id ?? null
                };
            }).filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value));
        } catch (err) {
            this.log('ERROR', `Falha ao carregar pnl_history do Supabase: ${err.message}`);
            throw err;
        }
    }

    async saveOrderSafe(order, context, sessionId = null) {
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
        if (this.useSupabaseOrders) {
            this.assertSupabaseConfigured('orders');
            const rawTs = order.timestamp ? Number(order.timestamp) : Date.now();
            const ts = rawTs > 1e12 ? Math.floor(rawTs / 1000) : Math.floor(rawTs);
            const payload = {
                id: String(order.id),
                side: String(order.side || 'unknown'),
                price: parseFloat(order.price),
                qty: parseFloat(order.qty),
                status: String(order.status || 'open'),
                filled_qty: parseFloat(order.filledQty ?? order.filled_qty ?? 0),
                timestamp: parseInt(ts, 10),
                note: order.note || null,
                external_id: order.external_id || null,
                pnl: parseFloat(order.pnl || 0),
                session_id: (order.sessionId ?? order.session_id) == null ? null : String(order.sessionId ?? order.session_id),
                pair_id: order.pairId ?? order.pair_id ?? null
            };
            try {
                const response = await axios.post(`${this.supabaseUrl}/rest/v1/orders`, payload, {
                    params: { on_conflict: 'id' },
                    headers: {
                        apikey: this.supabaseKey,
                        Authorization: `Bearer ${this.supabaseKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'resolution=merge-duplicates,return=minimal'
                    },
                    timeout: 20000
                });
                this.ordersCache.clear();
                this.fillsCache.clear();
                return order;
            } catch (err) {
                this.log('ERROR', `Erro ao salvar ordem no Supabase: ${err.message}`);
                throw err;
            }
        }
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
        if (this.useSupabaseOrders) {
            this.assertSupabaseConfigured('orders');
            const cacheKey = JSON.stringify({ limit, status, minAge });
            const now = Date.now();
            const cached = this.ordersCache.get(cacheKey);
            if (cached && (now - cached.fetchedAt) <= this.ordersCacheTtlMs) {
                return cached.rows;
            }
            const params = {
                select: 'id,side,price,qty,status,filled_qty,timestamp,note,external_id,pnl,session_id,pair_id',
                order: 'timestamp.desc',
                limit
            };
            if (status) params.status = `eq.${status}`;
            if (minAge) {
                const minTimestamp = Math.floor((Date.now() - minAge) / 1000);
                params.timestamp = `lte.${minTimestamp}`;
            }
            const response = await this.getSupabaseWithRetry('orders', params, 'Carregar orders');
            const rows = Array.isArray(response.data) ? response.data : [];
            const mappedRows = rows.map((r) => ({
                id: r.id,
                side: r.side,
                price: parseFloat(r.price),
                qty: parseFloat(r.qty),
                status: r.status,
                filledQty: parseFloat(r.filled_qty || 0),
                timestamp: Number(r.timestamp),
                note: r.note,
                external_id: r.external_id,
                pnl: parseFloat(r.pnl || 0),
                session_id: r.session_id,
                pair_id: r.pair_id
            }));
            this.ordersCache.set(cacheKey, { rows: mappedRows, fetchedAt: now });
            return mappedRows;
        }
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
        if (this.useSupabaseOrders) {
            this.assertSupabaseConfigured('orders');
            const cacheKey = `fills:${sessionId == null ? 'all' : String(sessionId)}`;
            const now = Date.now();
            const cached = this.fillsCache.get(cacheKey);
            if (cached && (now - cached.fetchedAt) <= this.fillsCacheTtlMs) {
                return cached.rows;
            }
            const params = {
                select: 'side,qty,price,timestamp,session_id',
                status: 'eq.filled',
                order: 'timestamp.asc',
                limit: 5000
            };
            if (sessionId !== null && sessionId !== undefined) {
                params.session_id = `eq.${sessionId}`;
            }
            const response = await this.getSupabaseWithRetry('orders', params, 'Carregar fills históricos');
            const rows = Array.isArray(response.data) ? response.data : [];
            const mappedRows = rows.map((r) => ({
                side: r.side,
                qty: parseFloat(r.qty),
                price: parseFloat(r.price),
                limitPrice: parseFloat(r.price),
                feeRate: null,
                timestamp: Number(r.timestamp)
            })).filter((f) => Number.isFinite(f.qty) && Number.isFinite(f.price));
            this.fillsCache.set(cacheKey, { rows: mappedRows, fetchedAt: now });
            return mappedRows;
        }
        if (!this.db) throw new Error('Database not initialized');
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
        if (this.useSupabaseOrders) {
            const startTime = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
            const [allResp, filledResp, openResp] = await Promise.all([
                this.getSupabaseWithRetry('orders', { select: 'id', timestamp: `gte.${startTime}`, limit: 10000 }, 'Stats totalOrders'),
                this.getSupabaseWithRetry('orders', { select: 'qty,price,pnl', status: 'eq.filled', timestamp: `gte.${startTime}`, limit: 10000 }, 'Stats filled'),
                this.getSupabaseWithRetry('orders', { select: 'id', status: 'eq.open', limit: 10000 }, 'Stats openOrders')
            ]);
            const allRows = Array.isArray(allResp.data) ? allResp.data : [];
            const filledRows = Array.isArray(filledResp.data) ? filledResp.data : [];
            const openRows = Array.isArray(openResp.data) ? openResp.data : [];

            const totalVolume = filledRows.reduce((s, r) => s + (parseFloat(r.qty || 0) * parseFloat(r.price || 0)), 0);
            const totalPnL = filledRows.reduce((s, r) => s + parseFloat(r.pnl || 0), 0);
            const totalOrders = allRows.length;
            const filledOrders = filledRows.length;
            const openOrders = openRows.length;
            return {
                totalOrders,
                filledOrders,
                openOrders,
                totalVolume,
                totalPnL,
                fillRate: totalOrders > 0 ? (filledOrders / totalOrders * 100) : 0,
                avgOrderSize: filledOrders > 0 ? (totalVolume / filledOrders) : 0
            };
        }
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
        const now = Date.now();
        if (now < this.nextPriceSaveAllowedAt) {
            return { source: 'supabase', skipped: true, reason: 'cooldown_after_failure' };
        }
        const ts = timestamp || Math.floor(Date.now() / 1000);
        this.assertSupabaseForHistory('price_history');

        try {
            const payload = {
                btc_price: parseFloat(price),
                timestamp: parseInt(ts, 10),
                pair: 'BTC-BRL'
            };
            await this.postSupabaseWithRetry('price_history', payload, 'Salvar price_history');
            this.nextPriceSaveAllowedAt = 0;

            return { source: 'supabase', timestamp: ts };
        } catch (err) {
            this.nextPriceSaveAllowedAt = Date.now() + this.priceSaveFailureCooldownMs;
            this.log('ERROR', `Falha ao salvar price_history no Supabase: ${err.message}`);
            throw err;
        }
    }

    // Alias para compatibilidade com código existente
    async saveBtcPrice(...args) {
        return this.savePrice(...args);
    }

    async getPriceHistory(hoursBack = 24, limit = 500) {
        const useCutoff = Number.isFinite(hoursBack) && hoursBack > 0;
        const cutoffTs = useCutoff ? Math.floor((Date.now() - hoursBack * 3600 * 1000) / 1000) : null;
        this.assertSupabaseForHistory('price_history');

        try {
            const response = await this.getSupabaseWithRetry(
                'price_history',
                {
                    select: 'btc_price,timestamp',
                    pair: 'eq.BTC-BRL',
                    ...(useCutoff ? { timestamp: `gte.${cutoffTs}` } : {}),
                    order: 'timestamp.asc',
                    limit
                },
                'Carregar price_history'
            );

            const rows = Array.isArray(response.data) ? response.data : [];
            return rows.map((row) => ({
                timestamp: parseInt(row.timestamp, 10),
                price: parseFloat(row.btc_price)
            })).filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.price));
        } catch (err) {
            this.log('ERROR', `Falha ao carregar price_history do Supabase: ${err.message}`);
            throw err;
        }
    }

    async saveExternalTrend(externalTrend = {}, timestampMs = Date.now()) {
        this.assertSupabaseConfigured('external_trend_history');
        if (!externalTrend || typeof externalTrend !== 'object') {
            throw new Error('externalTrend inválido: esperado objeto');
        }

        const trend = String(externalTrend.trend || 'neutral');
        const score = Number(externalTrend.score ?? 0);
        const confidence = Number(externalTrend.confidence ?? 0);
        const sources = (externalTrend.sources && typeof externalTrend.sources === 'object')
            ? externalTrend.sources
            : {};
        const ts = Math.floor((Number(timestampMs) || Date.now()) / 1000);

        const payload = {
            trend,
            score: Number.isFinite(score) ? score : 0,
            confidence: Number.isFinite(confidence) ? confidence : 0,
            sources,
            payload: externalTrend,
            timestamp: ts
        };

        try {
            await this.postSupabaseWithRetry('external_trend_history', payload, 'Salvar external_trend_history');
            return { source: 'supabase', timestamp: ts };
        } catch (err) {
            this.log('ERROR', `Falha ao salvar external_trend_history no Supabase: ${err.message}`);
            throw err;
        }
    }

    async getLatestExternalTrend(maxAgeMs = 30 * 60 * 1000) {
        this.assertSupabaseConfigured('external_trend_history');
        try {
            const response = await this.getSupabaseWithRetry(
                'external_trend_history',
                {
                    select: 'trend,score,confidence,sources,payload,timestamp',
                    order: 'timestamp.desc',
                    limit: 1
                },
                'Carregar external_trend_history'
            );

            const row = Array.isArray(response.data) ? response.data[0] : null;
            if (!row) return null;

            const ts = parseInt(row.timestamp, 10);
            const ageMs = Date.now() - (ts * 1000);
            if (!Number.isFinite(ts) || Number.isNaN(ageMs) || ageMs > maxAgeMs) {
                return null;
            }

            if (row.payload && typeof row.payload === 'object') {
                return row.payload;
            }

            return {
                trend: row.trend || 'neutral',
                score: Number(row.score || 0),
                confidence: Number(row.confidence || 0),
                sources: (row.sources && typeof row.sources === 'object') ? row.sources : {},
                timestamp: new Date(ts * 1000).toISOString()
            };
        } catch (err) {
            this.log('ERROR', `Falha ao carregar external_trend_history: ${err.message}`);
            throw err;
        }
    }

    async listContributions(limit = 1000) {
        this.assertSupabaseConfigured('bot_contributions');
        const response = await this.getSupabaseWithRetry(
            'bot_contributions',
            {
                select: 'amount,type,note,created_at',
                order: 'created_at.asc',
                limit
            },
            'Carregar bot_contributions'
        );
        const rows = Array.isArray(response.data) ? response.data : [];
        return rows.map((r) => ({
            amount: Number(parseFloat(r.amount || 0).toFixed(2)),
            type: String(r.type || ''),
            note: String(r.note || ''),
            createdAt: r.created_at || new Date().toISOString()
        }));
    }

    async saveContribution({ amount, type, note = '', createdAt = new Date().toISOString() }) {
        this.assertSupabaseConfigured('bot_contributions');
        const payload = {
            amount: Number(parseFloat(amount || 0).toFixed(2)),
            type: String(type || ''),
            note: String(note || ''),
            created_at: createdAt
        };
        await this.postSupabaseWithRetry('bot_contributions', payload, 'Salvar bot_contributions');
        return {
            amount: payload.amount,
            type: payload.type,
            note: payload.note,
            createdAt: payload.created_at
        };
    }

    async getInitialBalance(profile = 'production') {
        this.assertSupabaseConfigured('bot_initial_balances');
        const response = await this.getSupabaseWithRetry(
            'bot_initial_balances',
            {
                select: 'profile,brl,btc,total,captured_at,captured_at_cycle,updated_at',
                profile: `eq.${profile}`,
                limit: 1
            },
            'Carregar bot_initial_balances'
        );
        const row = Array.isArray(response.data) ? response.data[0] : null;
        if (!row) return null;
        return {
            profile: row.profile,
            brl: parseFloat(row.brl || 0),
            btc: parseFloat(row.btc || 0),
            total: parseFloat(row.total || 0),
            capturedAt: row.captured_at || null,
            capturedAtCycle: row.captured_at_cycle == null ? null : Number(row.captured_at_cycle),
            updatedAt: row.updated_at || null
        };
    }

    async upsertInitialBalance(
        { brl, btc, total, capturedAt = new Date().toISOString(), capturedAtCycle = null },
        profile = 'production'
    ) {
        this.assertSupabaseConfigured('bot_initial_balances');
        const payload = {
            profile: String(profile),
            brl: parseFloat(brl || 0),
            btc: parseFloat(btc || 0),
            total: parseFloat(total || 0),
            captured_at: capturedAt,
            captured_at_cycle: capturedAtCycle == null ? null : Number(capturedAtCycle)
        };
        const response = await axios.post(`${this.supabaseUrl}/rest/v1/bot_initial_balances`, payload, {
            params: { on_conflict: 'profile' },
            headers: {
                apikey: this.supabaseKey,
                Authorization: `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=representation'
            },
            timeout: 20000
        });
        const row = Array.isArray(response.data) ? response.data[0] : null;
        return row || null;
    }

    async clearInitialBalance(profile = 'production') {
        this.assertSupabaseConfigured('bot_initial_balances');
        await axios.delete(`${this.supabaseUrl}/rest/v1/bot_initial_balances`, {
            params: { profile: `eq.${profile}` },
            headers: {
                apikey: this.supabaseKey,
                Authorization: `Bearer ${this.supabaseKey}`,
                Prefer: 'return=minimal'
            },
            timeout: 20000
        });
    }

    async getMomentumCache(profile = 'production') {
        this.assertSupabaseConfigured('bot_momentum_cache');
        const response = await this.getSupabaseWithRetry(
            'bot_momentum_cache',
            {
                select: 'profile,payload,updated_at',
                profile: `eq.${profile}`,
                limit: 1
            },
            'Carregar bot_momentum_cache'
        );
        const row = Array.isArray(response.data) ? response.data[0] : null;
        if (!row) return null;
        return {
            profile: row.profile,
            payload: (row.payload && typeof row.payload === 'object') ? row.payload : {},
            updatedAt: row.updated_at || null
        };
    }

    async upsertMomentumCache(payload = {}, profile = 'production') {
        this.assertSupabaseConfigured('bot_momentum_cache');
        const rowPayload = {
            profile: String(profile),
            payload: (payload && typeof payload === 'object') ? payload : {}
        };
        const response = await axios.post(`${this.supabaseUrl}/rest/v1/bot_momentum_cache`, rowPayload, {
            params: { on_conflict: 'profile' },
            headers: {
                apikey: this.supabaseKey,
                Authorization: `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=representation'
            },
            timeout: 20000
        });
        const row = Array.isArray(response.data) ? response.data[0] : null;
        return row || null;
    }

    async getRuntimeConfig(profile = 'production') {
        this.assertSupabaseConfigured('runtime_config');
        const now = Date.now();
        const cached = this.runtimeConfigCache.get(profile);
        if (cached && (now - cached.fetchedAt) <= this.runtimeConfigCacheTtlMs) {
            return cached.row;
        }
        try {
            const response = await this.getSupabaseWithRetry(
                'bot_runtime_configs',
                {
                    select: 'id,profile,env_config,is_active,updated_at,created_at',
                    profile: `eq.${profile}`,
                    is_active: 'eq.true',
                    order: 'updated_at.desc',
                    limit: 1
                },
                'Carregar bot_runtime_configs'
            );

            const row = Array.isArray(response.data) ? response.data[0] : null;
            if (row) {
                this.runtimeConfigCache.set(profile, { row, fetchedAt: now });
            }
            if (!row) return null;
            return row;
        } catch (err) {
            if (cached && cached.row) {
                this.log('WARN', `Falha ao carregar bot_runtime_configs (profile=${profile}), usando cache local: ${err.message}`);
                return cached.row;
            }
            this.log('ERROR', `Falha ao carregar bot_runtime_configs: ${err.message}`);
            throw err;
        }
    }

    async upsertRuntimeConfig(profile = 'production', envConfig = {}, isActive = true) {
        this.assertSupabaseConfigured('runtime_config');
        if (!envConfig || typeof envConfig !== 'object' || Array.isArray(envConfig)) {
            throw new Error('envConfig inválido: esperado objeto JSON');
        }

        try {
            const payload = {
                profile,
                env_config: envConfig,
                is_active: !!isActive
            };

            const response = await axios.post(`${this.supabaseUrl}/rest/v1/bot_runtime_configs`, payload, {
                params: {
                    on_conflict: 'profile'
                },
                headers: {
                    apikey: this.supabaseKey,
                    Authorization: `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates,return=representation'
                },
                timeout: 7000
            });

            const row = Array.isArray(response.data) ? response.data[0] : null;
            return row || null;
        } catch (err) {
            this.log('ERROR', `Falha ao salvar bot_runtime_configs: ${err.message}`);
            throw err;
        }
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

    async updateOrderStatus(orderId, status) {
        if (!orderId) throw new Error('orderId é obrigatório');
        if (this.useSupabaseOrders) {
            this.assertSupabaseConfigured('orders');
            const response = await this.getSupabaseWithRetry(
                'orders',
                {
                    select: 'id,side,price,qty,status,filled_qty,timestamp,note,external_id,pnl,session_id,pair_id',
                    id: `eq.${orderId}`,
                    limit: 1
                },
                'Carregar order por id'
            );
            const row = Array.isArray(response.data) ? response.data[0] : null;
            if (!row) return null;
            const saved = await this.saveOrder({
                id: row.id,
                side: row.side,
                price: parseFloat(row.price),
                qty: parseFloat(row.qty),
                status,
                filledQty: parseFloat(row.filled_qty || 0),
                timestamp: Number(row.timestamp),
                note: row.note,
                external_id: row.external_id,
                pnl: parseFloat(row.pnl || 0),
                sessionId: row.session_id || null,
                pairId: row.pair_id || null
            });
            this.ordersCache.clear();
            this.fillsCache.clear();
            return saved;
        }
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, orderId],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes || 0);
                }
            );
        });
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

    async getWorstPnLInSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT MIN(pnl) AS worst_pnl
                FROM recovery_points
                WHERE session_id = ?
            `, [sessionId], (err, row) => {
                if (err) return reject(err);
                if (!row || row.worst_pnl === null || row.worst_pnl === undefined) {
                    return resolve(null);
                }
                resolve(parseFloat(row.worst_pnl));
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

    // Funções de momentum removidas (2025-01-21)

    /**
     * Limpar momentum orders expiradas (> 5 minutos)
     */
    async cleanupExpiredMomentumOrders(maxAgeSeconds = 300) {
        return new Promise((resolve, reject) => {
            const cutoffTime = Math.floor(Date.now() / 1000) - maxAgeSeconds;

            this.db.run(
                `DELETE FROM momentum_orders 
                 WHERE status IN ('simulated', 'pending', 'rejected', 'expired') 
                 AND created_at < ?`,
                [cutoffTime],
                function(err) {
                    if (err) {
                        this.log('ERROR', `Erro ao limpar momentum orders: ${err.message}`);
                        return reject(err);
                    }
                    resolve(this.changes);
                }
            );
        });
    }

    /**
     * Obter estatísticas de momentum
     */
    async getMomentumStats(hours = 24) {
        return new Promise((resolve, reject) => {
            const cutoffTime = Math.floor(Date.now() / 1000) - (hours * 3600);

            this.db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'simulated' THEN 1 ELSE 0 END) as simulated,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
                    AVG(confirmation_reversals) as avg_reversals,
                    SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_count,
                    SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_count
                 FROM momentum_orders
                 WHERE created_at > ?`,
                [cutoffTime],
                (err, row) => {
                    if (err) {
                        this.log('ERROR', `Erro ao obter momentum stats: ${err.message}`);
                        return reject(err);
                    }
                    resolve(row || {total: 0});
                }
            );
        });
    }
}

module.exports = new Database();
