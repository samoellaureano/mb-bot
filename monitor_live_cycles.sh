#!/bin/bash

# Monitor de Ciclos LIVE - v1.8
# Acompanha execução do bot em tempo real

echo "🚀 MB-BOT LIVE MONITOR - v1.8"
echo "======================================"
echo ""

# Verificar se bot está rodando
if pgrep -f "SIMULATE=false node bot.js" > /dev/null; then
    echo "✅ Bot LIVE detectado"
    BOT_PID=$(pgrep -f "SIMULATE=false node bot.js")
    echo "   PID: $BOT_PID"
else
    echo "❌ Bot não está rodando"
    echo "Iniciando bot LIVE..."
    cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
    npm run live &
    sleep 5
fi

echo ""
echo "📊 ACOMPANHAMENTO DE CICLOS (últimos 30 segundos)"
echo "======================================"
echo ""

# Monitorar ciclos por 30 segundos
timeout 30 tail -f /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log 2>/dev/null | \
    grep -E "Iniciando ciclo|Ciclo [0-9]+ summary|CASH_MGT|Venda|Compra|PnL|ROI" | \
    tail -50

echo ""
echo "📈 DASHBOARD"
echo "======================================"
echo "🌐 http://localhost:3001"
echo ""
echo "ℹ️  Para parar: pkill -f 'npm run live'"
