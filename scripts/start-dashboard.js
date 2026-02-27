#!/usr/bin/env node
const { bootstrapFromSupabase } = require('./supabase-runtime-config');

(async () => {
    await bootstrapFromSupabase();
    require('../dashboard');
})().catch((err) => {
    console.error(`[BOOT] Falha ao iniciar dashboard com configuracao do Supabase: ${err.message}`);
    process.exit(1);
});

