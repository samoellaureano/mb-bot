#!/bin/bash

echo "📊 VALIDAÇÃO DE PARES - Cash Management v1.9"
echo "=============================================="
echo ""

DB_PATH="/mnt/c/PROJETOS_PESSOAIS/mb-bot/database/orders.db"

# 1. Contar ordens por tipo
echo "📈 ORDENS POR TIPO:"
sqlite3 "$DB_PATH" "SELECT side, COUNT(*) as qty FROM orders WHERE status='filled' GROUP BY side;"
echo ""

# 2. Análise de pares
echo "🔗 ANÁLISE DE PARES:"
TOTAL_BUYS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM orders WHERE status='filled' AND side='buy';")
TOTAL_SELLS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM orders WHERE status='filled' AND side='sell';")
PARES_COMPLETOS=$((TOTAL_SELLS))
COMPRAS_ABERTAS=$((TOTAL_BUYS - TOTAL_SELLS))

echo "  Compras (BUY):       $TOTAL_BUYS"
echo "  Vendas (SELL):       $TOTAL_SELLS"
echo "  Pares completos:     $PARES_COMPLETOS"
echo "  Posições abertas:    $COMPRAS_ABERTAS"
echo ""

if [ $COMPRAS_ABERTAS -eq 0 ]; then
    echo "  ✅ PERFEITO: Todos os pares foram fechados"
else
    echo "  ⚠️  ATENÇÃO: $COMPRAS_ABERTAS compras aguardando fechamento"
fi
echo ""

# 3. Check PnL
echo "💰 PnL ANÁLISE:"
PNL=$(sqlite3 "$DB_PATH" "SELECT ROUND(SUM(CASE WHEN side='sell' THEN qty*price ELSE -qty*price END), 2) FROM orders WHERE status='filled';")
echo "  PnL Total:           R$ $PNL"
