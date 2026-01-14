#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VALIDAÇÃO DE PARES BUY/SELL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔵 ORDENS BUY ABERTAS:"
sqlite3 database/orders.db "SELECT COUNT(*) FROM orders WHERE status='open' AND side='buy';" | xargs echo "   Total:"

echo ""
echo "🔴 ORDENS SELL ABERTAS:"
sqlite3 database/orders.db "SELECT COUNT(*) FROM orders WHERE status='open' AND side='sell';" | xargs echo "   Total:"

echo ""
echo "✅ VALIDAÇÃO:"

BUY_COUNT=$(sqlite3 database/orders.db "SELECT COUNT(*) FROM orders WHERE status='open' AND side='buy';")
SELL_COUNT=$(sqlite3 database/orders.db "SELECT COUNT(*) FROM orders WHERE status='open' AND side='sell';")

if [ "$BUY_COUNT" -eq "$SELL_COUNT" ]; then
    echo "   ✓ CORRETO: Pares balanceados ($BUY_COUNT BUY = $SELL_COUNT SELL)"
else
    DIFERENCA=$((BUY_COUNT - SELL_COUNT))
    if [ "$DIFERENCA" -gt 0 ]; then
        echo "   ✗ ERRO: Há $DIFERENCA BUY sem SELL correspondente"
    else
        echo "   ✗ ERRO: Há $((0 - DIFERENCA)) SELL sem BUY correspondente"
    fi
fi

echo ""
echo "📝 ÚLTIMAS ORDENS ABERTAS (10 mais recentes):"
echo ""
sqlite3 database/orders.db << 'SQL'
.mode column
.headers on
SELECT 
  substr(id, 1, 8) || '...' as id_short,
  upper(side) as tipo,
  printf("%.2f", price) as preco,
  printf("%.8f", qty) as qtd
FROM orders 
WHERE status = 'open'
ORDER BY timestamp DESC
LIMIT 10;
SQL

echo ""
echo "🔗 PARES SEQUENCIAIS (últimos 4 pares):"
echo ""
sqlite3 database/orders.db << 'SQL'
WITH recent_orders AS (
  SELECT 
    id,
    side,
    price,
    qty,
    timestamp,
    ROW_NUMBER() OVER (ORDER BY timestamp DESC) as rn
  FROM orders 
  WHERE status = 'open'
)
SELECT 
  CASE 
    WHEN rn % 2 = 1 THEN '→ PAR ' || ((rn+1)/2)
    ELSE '  '
  END as par,
  upper(side) as tipo,
  printf("%.0f", price) as preco,
  printf("%.8f", qty) as qtd
FROM recent_orders
WHERE rn <= 8
ORDER BY rn;
SQL

echo ""
