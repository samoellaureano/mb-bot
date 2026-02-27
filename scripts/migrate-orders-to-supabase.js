#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3');
const axios = require('axios');

const DB_PATH = path.join(__dirname, '..', 'database', 'orders.db');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = Math.max(1, parseInt(process.env.ORDERS_MIGRATION_BATCH_SIZE || '200', 10));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[MIGRATE_ORDERS] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env');
  process.exit(1);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function closeDb(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

function mapRow(row) {
  return {
    id: String(row.id),
    side: String(row.side || 'unknown'),
    price: Number(row.price || 0),
    qty: Number(row.qty || 0),
    status: String(row.status || 'open'),
    filled_qty: Number(row.filledQty || 0),
    timestamp: Number(row.timestamp || 0),
    note: row.note || null,
    external_id: row.external_id || null,
    pnl: Number(row.pnl || 0),
    session_id: row.session_id == null ? null : String(row.session_id),
    pair_id: row.pair_id || null
  };
}

async function upsertBatch(batch) {
  await axios.post(`${SUPABASE_URL}/rest/v1/orders`, batch, {
    params: { on_conflict: 'id' },
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    timeout: 30000
  });
}

async function main() {
  const db = await openDb();
  try {
    const rows = await all(
      db,
      `SELECT id, side, price, qty, status, filledQty, timestamp, note, external_id, pnl, session_id, pair_id
       FROM orders
       ORDER BY timestamp ASC`
    );

    const mapped = rows.map(mapRow).filter((r) =>
      r.id && Number.isFinite(r.price) && Number.isFinite(r.qty) && Number.isFinite(r.timestamp)
    );

    console.log(`[MIGRATE_ORDERS] Encontradas ${mapped.length} ordens para migração.`);
    if (mapped.length === 0) return;
    if (DRY_RUN) {
      console.log('[MIGRATE_ORDERS] DRY RUN ativo. Nenhum dado enviado.');
      return;
    }

    let sent = 0;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      await upsertBatch(batch);
      sent += batch.length;
      console.log(`[MIGRATE_ORDERS] Batch enviado: ${sent}/${mapped.length}`);
    }

    const verify = await axios.get(`${SUPABASE_URL}/rest/v1/orders`, {
      params: { select: 'id', limit: 1 },
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      timeout: 15000
    });

    console.log(`[MIGRATE_ORDERS] Migração concluída com sucesso. Check tabela orders: ${Array.isArray(verify.data) ? 'OK' : 'NOK'}`);
  } finally {
    await closeDb(db);
  }
}

main().catch((err) => {
  console.error('[MIGRATE_ORDERS] Falha:', err.response?.status, err.response?.data || err.message);
  process.exit(1);
});
