#!/bin/bash

# Script de Validação Contínua de Pares

while true; do
    clear
    echo ""
    echo "🔐 VALIDAÇÃO DE INTEGRIDADE DE PARES"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Análise 1: Pares ativos
    sqlite3 "/mnt/c/PROJETOS_PESSOAIS/mb-bot/database/orders.db" << 'SQL'
.mode column
.headers on

SELECT 
    pair_id,
    GROUP_CONCAT(DISTINCT side) as sides,
    COUNT(CASE WHEN side='buy' THEN 1 END) as buy_count,
    COUNT(CASE WHEN side='sell' THEN 1 END) as sell_count
FROM orders
WHERE pair_id IS NOT NULL AND status IN ('open', 'working')
GROUP BY pair_id
ORDER BY pair_id DESC;
SQL

    echo ""
    echo "---"
    echo ""
    
    # Análise 2: Recolocações
    echo "🔄 RECOLOCAÇÕES:"
    echo ""
    
    sqlite3 "/mnt/c/PROJETOS_PESSOAIS/mb-bot/database/orders.db" << 'SQL'
.mode column
.headers off

SELECT 
    'ℹ️  ' || pair_id || ' (' || side || '): ' || COUNT(*) || ' ordens'
FROM orders
WHERE pair_id IS NOT NULL
GROUP BY pair_id, side
HAVING COUNT(*) > 1
ORDER BY pair_id DESC;
SQL

    echo ""
    echo "Aguardando próxima verificação em 10 segundos..."
    echo ""
    
    sleep 10
done
