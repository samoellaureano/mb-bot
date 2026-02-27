#!/usr/bin/env node
const { bootstrapFromSupabase } = require('./supabase-runtime-config');

(async () => {
    await bootstrapFromSupabase();
    require('../bot');
})().catch((err) => {
    console.error(`[BOOT] Falha ao iniciar bot com configuracao do Supabase: ${err.message}`);
    process.exit(1);
});

