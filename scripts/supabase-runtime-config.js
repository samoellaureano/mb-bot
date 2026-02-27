#!/usr/bin/env node
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const REQUIRED_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const PROTECTED_ENV_KEYS = new Set(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PORT']);

function assertBaseEnv() {
    for (const key of REQUIRED_KEYS) {
        if (!process.env[key] || !String(process.env[key]).trim()) {
            throw new Error(`Variavel obrigatoria ausente no .env: ${key}`);
        }
    }
}

async function fetchRuntimeConfig(profile = 'production') {
    assertBaseEnv();

    const supabaseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await axios.get(`${supabaseUrl}/rest/v1/bot_runtime_configs`, {
        params: {
            select: 'env_config',
            profile: `eq.${profile}`,
            is_active: 'eq.true',
            limit: 1
        },
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
        },
        timeout: 10000
    });

    const row = Array.isArray(response.data) ? response.data[0] : null;
    if (!row || typeof row.env_config !== 'object' || row.env_config == null) {
        throw new Error(`Nenhuma configuracao ativa encontrada no Supabase para profile='${profile}'`);
    }

    return row.env_config;
}

function applyRuntimeConfig(envConfig) {
    for (const [key, rawValue] of Object.entries(envConfig)) {
        if (PROTECTED_ENV_KEYS.has(key)) continue;
        if (rawValue === null || rawValue === undefined) continue;
        process.env[key] = typeof rawValue === 'string' ? rawValue : String(rawValue);
    }
}

async function bootstrapFromSupabase(profile = process.env.BOT_CONFIG_PROFILE || 'production') {
    const envConfig = await fetchRuntimeConfig(profile);
    applyRuntimeConfig(envConfig);
    return envConfig;
}

module.exports = {
    bootstrapFromSupabase
};

