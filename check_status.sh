#!/bin/bash
# STATUS RÁPIDO DO BOT LIVE

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              📊 STATUS DO BOT LIVE                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Processos
BOT_COUNT=$(ps aux | grep -c "node bot.js" || echo "0")
DASH_COUNT=$(ps aux | grep -c "node dashboard" || echo "0")

echo "🔄 Processos:"
echo "  Bot: $([ $BOT_COUNT -gt 1 ] && echo "✅ Rodando" || echo "❌ Parado")"
echo "  Dashboard: $([ $DASH_COUNT -gt 1 ] && echo "✅ Rodando" || echo "❌ Parado")"
echo ""

# Arquivo de log
LOG=$(ls -t logs/bot_live*.log 2>/dev/null | head -1)

if [ -z "$LOG" ]; then
    echo "❌ Nenhum log de bot found"
    exit 1
fi

echo "📋 Log: $(basename $LOG)"
echo ""

# Estatísticas
CICLO=$(grep "\[CICLO" "$LOG" 2>/dev/null | tail -1 | grep -oE "CICLO [0-9]+" | grep -oE "[0-9]+" || echo "0")
PNL=$(grep "PnL Total:" "$LOG" 2>/dev/null | tail -1 | grep -oE "\-?[0-9]+\.[0-9]+" | tail -1 || echo "?")
SPREAD=$(grep "SPREAD_ADAPT" "$LOG" 2>/dev/null | tail -1 | grep -oE "spread=[0-9.]+%" | head -1 || echo "?")
REGIME=$(grep "Regime:" "$LOG" 2>/dev/null | tail -1 | grep -oE "BULL_TREND|BEAR_TREND|RANGING" | head -1 || echo "?")
TRADES=$(grep -c "Ordem colocada" "$LOG" 2>/dev/null || echo "0")
ERRORS=$(grep -c "ERROR" "$LOG" 2>/dev/null || echo "0")

echo "📊 Estatísticas:"
echo "  Ciclos: $CICLO"
echo "  PnL Total: R$ $PNL"
echo "  Spread Usado: $SPREAD"
echo "  Regime: $REGIME"
echo "  Trades: $TRADES"
echo "  Erros: $ERRORS"
echo ""

# Análise
if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  Erros Detectados:"
    grep "ERROR" "$LOG" 2>/dev/null | tail -3
    echo ""
fi

# Últimos ciclos
echo "📈 Últimos 5 ciclos:"
grep -E "PnL Total:" "$LOG" 2>/dev/null | tail -5 | while read line; do
    echo "  $line"
done

echo ""

# Análise rápida
if (( $(echo "$PNL > 0" | bc -l 2>/dev/null || echo "0") )); then
    echo "✅ PnL POSITIVO! Continuar rodando"
elif (( $(echo "$PNL < -1" | bc -l 2>/dev/null || echo "0") )); then
    echo "⚠️  PnL MUITO NEGATIVO - Considerar ajustes"
    echo "   Opção: bash apply_adjustments.sh"
else
    echo "⏳ PnL ainda próximo de zero, aguardar mais ciclos"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🌐 Dashboard: http://localhost:3001"
echo "📋 Log completo: tail -f $LOG"
echo "🛑 Parar: pkill -f 'node bot.js'"
echo "════════════════════════════════════════════════════════════"
