#!/bin/bash

# Script de monitoramento em tempo real de ciclos do bot

clear

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║        🔴 MONITORAMENTO EM TEMPO REAL - CICLOS DO BOT             ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

LOG_FILE=$(ls -1 /mnt/c/PROJETOS_PESSOAIS/mb-bot/logs/bot_live*.log 2>/dev/null | sort -V | tail -1)

if [ -z "$LOG_FILE" ]; then
    echo "❌ Nenhum arquivo de log encontrado!"
    exit 1
fi

echo "📝 Log: $LOG_FILE"
echo ""

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║        🔴 MONITORAMENTO EM TEMPO REAL - CICLOS DO BOT             ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    TOTAL_CICLOS=$(grep "Ciclo:" "$LOG_FILE" 2>/dev/null | wc -l)
    echo "📈 Ciclos Completados: $TOTAL_CICLOS"
    echo ""
    
    echo "════════════════════════════════════════════════════════════════════"
    echo "📊 ÚLTIMOS 5 CICLOS:"
    echo "════════════════════════════════════════════════════════════════════"
    grep "Ciclo:" "$LOG_FILE" | tail -5 | while read line; do
        CICLO=$(echo "$line" | grep -o "Ciclo: [0-9]*" | cut -d' ' -f2)
        PRECO=$(echo "$line" | grep -o "Mid Price: [0-9.]*" | cut -d' ' -f3)
        TENDENCIA=$(echo "$line" | grep -o "Tendência: [a-z]*" | cut -d' ' -f2)
        REGIME=$(echo "$line" | grep -o "Regime: [A-Z_]*" | cut -d' ' -f2)
        echo "  #$CICLO | Preço: R$ $PRECO | Tendência: $TENDENCIA | Regime: $REGIME"
    done
    echo ""
    
    echo "════════════════════════════════════════════════════════════════════"
    echo "💰 PnL MAIS RECENTE:"
    echo "════════════════════════════════════════════════════════════════════"
    grep "PnL Total:" "$LOG_FILE" | tail -1 | sed 's/.*\[INFO\]//'
    echo ""
    
    echo "════════════════════════════════════════════════════════════════════"
    echo "📈 HISTÓRICO DE PnL (últimos 5 ciclos):"
    echo "════════════════════════════════════════════════════════════════════"
    grep "PnL Total:" "$LOG_FILE" | tail -5
    echo ""
    
    ERROS=$(grep "ERROR" "$LOG_FILE" 2>/dev/null | wc -l)
    if [ "$ERROS" -gt 0 ]; then
        echo "⚠️  Erros detectados: $ERROS"
    else
        echo "✅ Nenhum erro detectado"
    fi
    
    echo ""
    echo "🔄 Atualizando a cada 30 segundos... (Ctrl+C para parar)"
    sleep 30
done
