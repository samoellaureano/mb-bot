// db.js - Enhanced database with stats (FIXED)
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');

class Database {
  constructor(dbPath = './database/orders.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Ensure database directory exists
      const fs = require('fs');
      const dbDir = this.dbPath.split('/').slice(0, -1).join('/');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);

        this.db.serialize(() => {
          // Orders table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              side TEXT NOT NULL,
              price REAL NOT NULL,
              qty REAL NOT NULL,
              status TEXT DEFAULT 'open',
              filledQty REAL DEFAULT 0,
              timestamp INTEGER DEFAULT (strftime('%s', 'now')),
              note TEXT,
              external_id TEXT
            )
          `, (err) => {
            if (err) return reject(err);

            // Cycles counter (for stats)
            this.db.run(`
              CREATE TABLE IF NOT EXISTS stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
              )
            `, (err) => {
              if (err) return reject(err);

              // Initialize cycle counter
              this.db.run(
                "INSERT OR IGNORE INTO stats (key, value) VALUES ('cycles', 0)",
                (err) => {
                  if (err) return reject(err);
                  resolve(this);
                }
              );
            });
          });
        });
      });
    });
  }

  async updateOrderStatus(orderId, status, filledQty = null) {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const updates = [];
      const params = [];
      updates.push('status = ?');
      params.push(status);
      if (filledQty !== null) {
        updates.push('filledQty = ?');
        params.push(filledQty);
      }
      params.push(orderId);
      const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  }

  async saveOrder(order) {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO orders 
        (id, side, price, qty, status, filledQty, timestamp, note, external_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        order.id || `order_${Date.now()}`,
        order.side || 'unknown',
        order.price || 0,
        order.qty || 0,
        order.status || 'open',
        order.filledQty || 0,
        Math.floor(order.timestamp / 1000) || Math.floor(Date.now() / 1000),
        order.note || null,
        order.externalId || null,
        (err) => {
          stmt.finalize();
          if (err) return reject(err);
          resolve(order);
        }
      );
    });
  }

  async getOrders({ limit = 50, status = null, side = null } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);

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
        if (err) return reject(err);
        resolve(rows.map(row => ({
          id: row.id,
          side: row.side,
          price: parseFloat(row.price),
          qty: parseFloat(row.qty),
          status: row.status,
          filledQty: parseFloat(row.filledQty),
          timestamp: row.timestamp * 1000,
          note: row.note
        })));
      });
    });
  }

  async getStats({ hours = 24 } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(this.getDefaultStats());

      const seconds = hours * 60 * 60;
      const cutoff = Math.floor(Date.now() / 1000) - seconds;

      // Get cycle count
      this.db.get("SELECT value as cycles FROM stats WHERE key = 'cycles'", (err, cycleRow) => {
        if (err) return reject(err);

        // Get order stats
        this.db.all(`
          SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
            SUM(CASE 
              WHEN side = 'buy' AND status = 'filled' THEN -price * qty 
              WHEN side = 'sell' AND status = 'filled' THEN price * qty 
              ELSE 0 
            END) as total_pnl,
            AVG(CASE WHEN status = 'filled' THEN price * qty ELSE NULL END) as avg_fill_value
          FROM orders 
          WHERE timestamp > ?
        `, [cutoff], (err, rows) => {
          if (err) return reject(err);

          const statsRow = rows[0] || {};
          const orderSize = parseFloat(process.env.ORDER_SIZE || 0.0001);
          const cycleSec = parseInt(process.env.CYCLE_SEC || 5);

          const stats = {
            cycles: cycleRow?.cycles || 0,
            total_orders: statsRow.total_orders || 0,
            filled_orders: statsRow.filled_orders || 0,
            cancelled_orders: statsRow.cancelled_orders || 0,
            total_pnl: parseFloat(statsRow.total_pnl || 0),
            avg_fill_value: parseFloat(statsRow.avg_fill_value || 0),
            uptime: stats.cycles ? `${Math.round(stats.cycles * cycleSec / 60)}min` : '0min',
            fill_rate: stats.total_orders ? (stats.filled_orders / stats.total_orders * 100).toFixed(1) : '0.0',
            avg_spread: stats.filled_orders && stats.avg_fill_value && orderSize ?
              (Math.abs(stats.total_pnl) / (stats.filled_orders * stats.avg_fill_value) * 100).toFixed(2) : '0.00'
          };

          resolve(stats);
        });
      });
    });
  }

  async incrementCycle() {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE stats SET value = value + 1, updated_at = (strftime('%s', 'now')) WHERE key = 'cycles'",
        function (err) {
          if (err) return reject(err);
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
      uptime: '0min',
      fill_rate: '0.0',
      avg_spread: '0.00'
    };
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) console.error('Database close error:', err.message);
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Single instance
const dbInstance = new Database(process.env.DB_PATH || './database/orders.db');

// CLI mode
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'stats':
      dbInstance.init()
        .then(() => dbInstance.getStats({ hours: 24 }))
        .then(stats => {
          console.log('\n📊 MB Bot Statistics (24h)');
          console.log('='.repeat(50));
          console.log(`Cycles:        ${stats.cycles.toLocaleString()} (${stats.uptime})`);
          console.log(`Total Orders:  ${stats.total_orders.toLocaleString()}`);
          console.log(`Fills:         ${stats.filled_orders.toLocaleString()} (${stats.fill_rate}%)`);
          console.log(`Cancels:       ${stats.cancelled_orders.toLocaleString()}`);
          console.log(`P&L:           R$ ${stats.total_pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          console.log(`Avg Fill Value:R$ ${stats.avg_fill_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
          console.log(`Avg Spread:    ${stats.avg_spread}%`);
          console.log('='.repeat(50));
          process.exit(0);
        })
        .catch(err => {
          console.error('❌ Stats error:', err.message);
          process.exit(1);
        });
      break;

    case 'orders':
      const limit = parseInt(process.argv[3]) || 10;
      dbInstance.init()
        .then(() => dbInstance.getOrders({ limit }))
        .then(orders => {
          console.log(`\n📋 Last ${orders.length} Orders:`);
          console.log('='.repeat(80));
          console.table(orders.map(o => ({
            ID: o.id.substring(0, 8) + '...',
            Side: o.side.toUpperCase(),
            Price: `R$ ${o.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            Qty: o.qty.toFixed(8),
            Status: o.status.toUpperCase(),
            Time: new Date(o.timestamp).toLocaleString('pt-BR')
          })));
          process.exit(0);
        })
        .catch(err => {
          console.error('❌ Orders error:', err.message);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage: node db.js [stats|orders [limit]]');
      process.exit(1);
  }
}

module.exports = dbInstance;