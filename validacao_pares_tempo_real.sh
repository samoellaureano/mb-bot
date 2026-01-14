#!/bin/bash

# Script de Validação de Pares BUY/SELL em Tempo Real
# Verifica se as ordens estão sincronizadas corretamente

echo "🔍 VALIDAÇÃO DE PARES BUY/SELL (Tempo Real)"
echo "=================================================="
echo ""

DB_PATH="/mnt/c/PROJETOS_PESSOAIS/mb-bot/database/orders.db"

# Contar ordens abertas
BUY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM orders WHERE status='open' AND side='buy';")
SELL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM orders WHERE status='open' AND side='sell';")

echo "📊 RESUMO:"
echo "  🔵 BUY Abertas: $BUY_COUNT"
echo "  🔴 SELL Abertas: $SELL_COUNT"
echo ""

# Validar balanceamento
if [ "$BUY_COUNT" -eq "$SELL_COUNT" ]; then
    echo "✅ PARES BALANCEADOS ($BUY_COUNT = $SELL_COUNT)"
else
    DIFF=$((BUY_COUNT - SELL_COUNT))
    if [ "$DIFF" -gt 0 ]; then
        echo "⚠️  DESBALANCEADO: $DIFF BUY excedentes"
        echo "   → O validador deve BLOQUEAR novas BUY até SELL completar"
    else
        echo "⚠️  DESBALANCEADO: $((0 - DIFF)) SELL excedentes"
        echo "   → O validador deve BLOQUEAR novas SELL até BUY completar"
    fi
fi
echo ""

# Listar ordens detalhadas
echo "📋 DETALHES DAS ORDENS:"
echo ""
sqlite3 "$DB_PATH" "SELECT 'BUY' as Tipo, COUNT(*) as Qtd, GROUP_CONCAT(ROUND(price), ', ') as Preços FROM orders WHERE status='open' AND side='buy' UNION ALL SELECT 'SELL', COUNT(*), GROUP_CONCAT(ROUND(price), ', ') FROM orders WHERE status='open' AND side='sell';"
echo ""

# Analisar sincronização no log
LOG_FILE="/tmp/bot_balanceado.log"
if [ -f "$LOG_FILE" ]; then
    echo "📝 ÚLTIMAS SINCRONIZAÇÕES (últimos 5 minutos):"
    grep "\[Sincronização\]" "$LOG_FILE" | tail -5 | sed 's/^/   /'
    echo ""
fi

# Verificar bloqueios de validação
if [ -f "$LOG_FILE" ]; then
    BLOQUEIOS=$(grep -c "não colocando" "$LOG_FILE")
    if [ "$BLOQUEIOS" -gt 0 ]; then
        echo "🚫 BLOQUEIOS DETECTADOS: $BLOQUEIOS"
        echo "   Últimos bloqueios:"
        grep "não colocando" "$LOG_FILE" | tail -3 | sed 's/^/   /'
    else
        echo "✓ Nenhum bloqueio de validação detectado"
    fi
fi
echo ""

echo "=================================================="
echo "Verificação concluída em $(date '+%H:%M:%S')"
