#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../db');

const ROOT = path.join(__dirname, '..');
const PROFILE = process.env.BOT_CONFIG_PROFILE || 'production';

function readJsonIfExists(fileName, fallback) {
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
    await db.init();

    const contributions = readJsonIfExists('.contributions.json', []);
    if (Array.isArray(contributions)) {
        for (const entry of contributions) {
            const amount = parseFloat(entry.amount || 0);
            const type = String(entry.type || '').toLowerCase();
            if (!Number.isFinite(amount) || !['deposit', 'withdraw'].includes(type)) continue;
            await db.saveContribution({
                amount,
                type,
                note: String(entry.note || ''),
                createdAt: entry.createdAt || new Date().toISOString()
            });
        }
        console.log(`[OK] Contributions migrados: ${contributions.length}`);
    }

    const initialBalance = readJsonIfExists('.initial_balance.json', null);
    if (initialBalance && typeof initialBalance === 'object') {
        await db.upsertInitialBalance({
            brl: parseFloat(initialBalance.brl || 0),
            btc: parseFloat(initialBalance.btc || 0),
            total: parseFloat(initialBalance.total || 0),
            capturedAt: initialBalance.capturedAt || new Date().toISOString(),
            capturedAtCycle: initialBalance.capturedAtCycle == null ? null : Number(initialBalance.capturedAtCycle)
        }, PROFILE);
        console.log('[OK] Initial balance migrado.');
    }

    const momentumCache = readJsonIfExists('.momentum_cache.json', null);
    if (momentumCache && typeof momentumCache === 'object') {
        await db.upsertMomentumCache(momentumCache, PROFILE);
        console.log('[OK] Momentum cache migrado.');
    }

    await db.close();
}

main().catch((err) => {
    console.error('[ERRO] Migração de estado falhou:', err.message);
    process.exit(1);
});
