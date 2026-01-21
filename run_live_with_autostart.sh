#!/bin/bash
# MONITORAMENTO LIVE COM AUTO-RESTART
# Inicia o bot, monitora o PnL, e reinicia se houver erro

set -e

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🚀 BOT LIVE COM AUTO-RESTART E MONITORAMENTO             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Garantir modo LIVE
sed -i 's/SIMULATE=.*/SIMULATE=false/' .env

echo "📋 Modo: LIVE (produção com dinheiro real)"
echo ""
echo "Configuração:"
grep -E "^(SPREAD_PCT|ORDER_SIZE|STOP_LOSS|TAKE_PROFIT)" .env | head -4
echo ""

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/bot_live_autostart_${TIMESTAMP}.log"
mkdir -p logs

echo "📊 Iniciando monitoramento..."
echo "    Log: $LOG_FILE"
echo ""

# Função para iniciar bot
start_bot() {
    echo "[$(date '+%H:%M:%S')] 🚀 Iniciando bot..."
    nohup node bot.js > "$LOG_FILE" 2>&1 &
    BOT_PID=$!
    echo "[$(date '+%H:%M:%S')] ✅ Bot iniciado (PID: $BOT_PID)"
    
    # Dashboard
    nohup node dashboard.js > logs/dashboard_live_${TIMESTAMP}.log 2>&1 &
    echo "[$(date '+%H:%M:%S')] ✅ Dashboard iniciado"
    echo "       🌐 http://localhost:3001"
    sleep 3
}

# Função para verificar se há erros
check_errors() {
    if grep -q "ERROR.*MAX_SPREAD_PCT" "$LOG_FILE" 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] ❌ ERRO DETECTADO: MAX_SPREAD_PCT"
        return 1
    fi
    if grep -q "ERROR.*not defined" "$LOG_FILE" 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] ❌ ERRO: Variável não definida"
        return 1
    fi
    return 0
}

# Função de monitoramento
monitor() {
    CYCLE_COUNT=0
    LAST_CYCLE=0
    POSITIVE_COUNT=0
    NEGATIVE_COUNT=0
    
    for i in {1..300}; do
        sleep 5
        
        # Verificar erros críticos
        if ! check_errors; then
            echo "[$(date '+%H:%M:%S')] 🔄 Reiniciando bot após erro..."
            pkill -f "node bot.js" 2>/dev/null || true
            sleep 2
            start_bot
            CYCLE_COUNT=0
            LAST_CYCLE=0
            continue
        fi
        
        # Extrair dados
        CYCLE=$(grep "\[CICLO" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "CICLO [0-9]+" | grep -oE "[0-9]+" || echo "")
        PNL=$(grep "PnL Total:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "\-?[0-9]+\.[0-9]+" | tail -1 || echo "")
        SPREAD=$(grep "SPREAD_ADAPT" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "spread=[0-9.]+%" || echo "")
        REGIME=$(grep "Regime:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "BULL_TREND|BEAR_TREND|RANGING" || echo "")
        
        if [ ! -z "$CYCLE" ] && [ "$CYCLE" != "$LAST_CYCLE" ]; then
            LAST_CYCLE=$CYCLE
            CYCLE_COUNT=$CYCLE
            
            # Contar positivo/negativo
            if [ ! -z "$PNL" ]; then
                if (( $(echo "$PNL < 0" | bc -l 2>/dev/null || echo 0) )); then
                    NEGATIVE_COUNT=$((NEGATIVE_COUNT + 1))
                else
                    POSITIVE_COUNT=$((POSITIVE_COUNT + 1))
                fi
            fi
            
            # Mostrar progresso
            if [ $((CYCLE_COUNT % 10)) -eq 0 ]; then
                PCT=$((CYCLE_COUNT * 100 / 300))
                echo "[$(date '+%H:%M:%S')] Ciclo $CYCLE_COUNT/300 ($PCT%) | PnL: $PNL | $SPREAD | $REGIME | ✅: $POSITIVE_COUNT ❌: $NEGATIVE_COUNT"
            fi
            
            # ALERTA: muitos negativos
            if [ $NEGATIVE_COUNT -gt 15 ] && [ $POSITIVE_COUNT -eq 0 ]; then
                echo ""
                echo "⚠️  ALERTA: PnL NEGATIVO EM TODOS OS CICLOS!"
                echo "   Recomendação: Aumentar spread ou fazer ajustes"
                return 1
            fi
        fi
    done
    
    return 0
}

# Iniciar
start_bot

# Monitorar
if ! monitor; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "⚠️  MONITORAMENTO DETECTOU PROBLEMA"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Opções:"
    echo "1. Usar: bash apply_adjustments.sh"
    echo "2. Parar bot: pkill -f 'node bot.js'"
    echo "3. Revisar log: tail -f $LOG_FILE"
else
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "✅ MONITORAMENTO CONCLUÍDO"
    echo "════════════════════════════════════════════════════════════"
fi

echo ""
echo "📋 Log salvo em: $LOG_FILE"
echo ""
