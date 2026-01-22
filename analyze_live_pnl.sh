#!/bin/bash

echo "📊 ANÁLISE DE PnL LIVE"
echo "═════════════════════════════════════════"

# Dados da API
CYCLES=$(curl -s http://localhost:3001/api/data | jq '.cycles' 2>/dev/null || echo "?")
FILLS=$(curl -s http://localhost:3001/api/data | jq '.fills' 2>/dev/null || echo "?")
PnL=$(curl -s http://localhost:3001/api/data | jq '.totalPnL' 2>/dev/null || echo "?")
ROI=$(curl -s http://localhost:3001/api/data | jq '.roi' 2>/dev/null || echo "?")
FILL_RATE=$(curl -s http://localhost:3001/api/data | jq '.fillRate' 2>/dev/null || echo "?")

echo ""
echo "Ciclos executados: $CYCLES"
echo "Total de ordens: $FILLS"
echo "Fill Rate: $FILL_RATE"
echo "PnL Total: R$ $PnL"
echo "ROI: $ROI%"
echo ""

# Análise de taxa
echo "📈 ANÁLISE DE FEES:"
AVG_PER_ORDER=$(echo "scale=4; $PnL / $FILLS" | bc 2>/dev/null || echo "?")
echo "   PnL por ordem: R$ $AVG_PER_ORDER"
echo "   Fee típica (1%): ~R$ -0.005 por ordem de R$0.50"
echo ""

if (( $(echo "$PnL < 0" | bc -l) )); then
    echo "⚠️  PROBLEMA DETECTADO:"
    echo "   • PnL está negativo"
    echo "   • Possível: Ordens seguindo preço na direção errada"
    echo "   • Ação: Revisar lógica de micro-trades"
else
    echo "✅ PnL está positivo - estratégia funcionando"
fi

echo ""
echo "═════════════════════════════════════════"
