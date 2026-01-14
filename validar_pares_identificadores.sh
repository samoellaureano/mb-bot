#!/bin/bash

# Validador de Pares BUY/SELL com Identificadores
# Exibe todos os pares, seu status, spread e ROI esperado

echo "🔍 VALIDAÇÃO DE PARES COM IDENTIFICADORES"
echo "=========================================="
echo ""

DB_PATH="/mnt/c/PROJETOS_PESSOAIS/mb-bot/database/orders.db"

# Query para agrupar por pair_id e mostrar detalhes
sqlite3 "$DB_PATH" << 'EOF'
.mode column
.headers on

-- Criar VIEW temporária de pares
CREATE TEMP VIEW pairs_view AS
SELECT 
    pair_id,
    side,
    id,
    price,
    qty,
    status,
    timestamp
FROM orders
WHERE status IN ('open', 'filled', 'partial')
ORDER BY pair_id, side DESC;

-- Mostrar resumo por par
SELECT '📊 RESUMO GERAL' as '';

SELECT
    COALESCE(pair_id, 'SEM_ID') as "Pair ID",
    COUNT(*) as "Total Ordens",
    SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as "BUY",
    SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as "SELL",
    CASE 
        WHEN SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) = SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) 
        THEN '✅ COMPLETO'
        WHEN SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) > SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END)
        THEN '⏳ AGUARD SELL'
        ELSE '⏳ AGUARD BUY'
    END as "Status"
FROM pairs_view
GROUP BY pair_id
ORDER BY 2 DESC;

-- Mostrar pares com detalhes
SELECT '' as '';
SELECT '📋 DETALHES POR PAR:' as '';
SELECT '' as '';

WITH pair_details AS (
    SELECT 
        pair_id,
        MAX(CASE WHEN side = 'buy' THEN price END) as buy_price,
        MAX(CASE WHEN side = 'sell' THEN price END) as sell_price,
        MAX(CASE WHEN side = 'buy' THEN id END) as buy_id,
        MAX(CASE WHEN side = 'sell' THEN id END) as sell_id,
        MAX(CASE WHEN side = 'buy' THEN qty END) as buy_qty,
        MAX(CASE WHEN side = 'sell' THEN qty END) as sell_qty,
        COUNT(CASE WHEN side = 'buy' THEN 1 END) as buy_count,
        COUNT(CASE WHEN side = 'sell' THEN 1 END) as sell_count
    FROM pairs_view
    GROUP BY pair_id
)
SELECT
    SUBSTR(pair_id, 1, 30) as "Pair ID",
    CASE WHEN buy_count > 0 THEN '🔵 ' || ROUND(buy_price, 2) ELSE '❌' END as "BUY",
    CASE WHEN sell_count > 0 THEN '🔴 ' || ROUND(sell_price, 2) ELSE '❌' END as "SELL",
    CASE 
        WHEN buy_price > 0 AND sell_price > 0 
        THEN ROUND(((sell_price - buy_price) / buy_price) * 100, 2) || '%'
        ELSE '-'
    END as "Spread",
    CASE 
        WHEN buy_price > 0 AND sell_price > 0 
        THEN ROUND(((sell_price - buy_price) / buy_price - 0.006) * 100, 2) || '%'
        ELSE '-'
    END as "ROI Liquido"
FROM pair_details
ORDER BY pair_id DESC;

EOF

echo ""
echo "=========================================="
echo "Gerado em $(date '+%H:%M:%S')"
