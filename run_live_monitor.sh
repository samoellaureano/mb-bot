#!/bin/bash
# MONITORAMENTO LIVE - Bot em Produção
# Coleta dados de ciclos, spreads, PnL e recomenda ajustes

set -e

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       🚀 BOT EM MODO LIVE - MONITORAMENTO REAL-TIME        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar .env
if ! grep -q "SIMULATE=false" .env; then
    echo "⚠️  Ativando modo LIVE (SIMULATE=false)..."
    sed -i 's/SIMULATE=.*/SIMULATE=false/' .env
fi

echo "📋 Configuração Ativa:"
grep -E "^(SPREAD_PCT|ORDER_SIZE|STOP_LOSS|TAKE_PROFIT|MIN_SPREAD)" .env | head -5
echo ""

# Criar arquivo de log com timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/bot_live_${TIMESTAMP}.log"
mkdir -p logs

echo "📊 Iniciando Bot em LIVE..."
echo "    Log: $LOG_FILE"
echo "    Modo: PRODUÇÃO (dinheiro real!)"
echo ""

# Iniciar bot em background
nohup node bot.js > "$LOG_FILE" 2>&1 &
BOT_PID=$!
echo "✅ Bot iniciado (PID: $BOT_PID)"
sleep 3

# Iniciar dashboard
nohup node dashboard.js > logs/dashboard_live_${TIMESTAMP}.log 2>&1 &
DASH_PID=$!
echo "✅ Dashboard iniciado"
echo "   🌐 http://localhost:3001"
echo ""

# Array para armazenar histórico
declare -a PNL_HISTORY
declare -a SPREAD_HISTORY
declare -a CYCLE_HISTORY

echo "⏱️  Monitorando por 300 ciclos (até ~2.5 horas)..."
echo "════════════════════════════════════════════════════════════"
echo ""

CYCLE_COUNT=0
LAST_CYCLE=0
NEGATIVE_COUNT=0
POSITIVE_COUNT=0
MAX_CYCLES=300
CHECK_INTERVAL=2

# Função para extrair dados
extract_data() {
    local PNL=$(grep "PnL Total:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE '\-?[0-9]+\.[0-9]+' | tail -1)
    local CYCLE=$(grep "\[CICLO" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "CICLO [0-9]+" | grep -oE "[0-9]+")
    local SPREAD=$(grep "SPREAD_ADAPT" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "spread=[0-9.]+%" | grep -oE "[0-9.]+")
    local REGIME=$(grep "Regime:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oE "BULL_TREND|BEAR_TREND|RANGING")
    local TRADES=$(grep -c "Ordem colocada" "$LOG_FILE" 2>/dev/null || echo "0")
    
    echo "$PNL|$CYCLE|$SPREAD|$REGIME|$TRADES"
}

# Monitorar ciclos
ELAPSED=0
while [ $CYCLE_COUNT -lt $MAX_CYCLES ]; do
    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    
    IFS='|' read -r PNL CYCLE SPREAD REGIME TRADES <<< "$(extract_data)"
    
    if [ ! -z "$CYCLE" ] && [ "$CYCLE" != "$LAST_CYCLE" ]; then
        LAST_CYCLE=$CYCLE
        CYCLE_COUNT=$CYCLE
        
        # Guardar histórico
        PNL_HISTORY+=("$PNL")
        SPREAD_HISTORY+=("$SPREAD")
        
        # Contar positivo/negativo
        if (( $(echo "$PNL < 0" | bc -l) )); then
            NEGATIVE_COUNT=$((NEGATIVE_COUNT + 1))
        else
            POSITIVE_COUNT=$((POSITIVE_COUNT + 1))
        fi
        
        # Mostrar a cada 10 ciclos
        if [ $((CYCLE_COUNT % 10)) -eq 0 ]; then
            PROGRESS=$((CYCLE_COUNT * 100 / MAX_CYCLES))
            echo "[$(date '+%H:%M:%S')] Ciclo $CYCLE_COUNT/$MAX_CYCLES ($PROGRESS%) | PnL: $PNL | Spread: ${SPREAD}% | Regime: $REGIME | Trades: $TRADES"
        fi
        
        # Verificação de emergência: se muitos ciclos negativos
        if [ $NEGATIVE_COUNT -gt 20 ] && [ $POSITIVE_COUNT -eq 0 ]; then
            echo ""
            echo "⚠️  ALERTA: PnL negativo em todos os $NEGATIVE_COUNT ciclos!"
            echo "   Recomendação: Aumentar SPREAD_PCT para 0.030"
            echo ""
            break
        fi
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📊 ANÁLISE FINAL"
echo "════════════════════════════════════════════════════════════"

# Calcular estatísticas
if [ ${#PNL_HISTORY[@]} -gt 0 ]; then
    FINAL_PNL=$(echo "${PNL_HISTORY[-1]}")
    TOTAL_PNL=$(printf '%s\n' "${PNL_HISTORY[@]}" | awk '{sum+=$1} END {print sum}')
    
    echo ""
    echo "🔄 Ciclos executados: $CYCLE_COUNT"
    echo "💰 PnL Final: R$ $FINAL_PNL"
    echo "💰 PnL Total Acumulado: R$ $TOTAL_PNL"
    echo "✅ Ciclos positivos: $POSITIVE_COUNT"
    echo "❌ Ciclos negativos: $NEGATIVE_COUNT"
    
    if [ ! -z "${SPREAD_HISTORY[-1]}" ]; then
        echo "📊 Último spread: ${SPREAD_HISTORY[-1]}%"
    fi
    
    echo ""
    
    # Recomendações
    if (( $(echo "$FINAL_PNL < 0" | bc -l) )); then
        echo "⚠️  RESULTADO: PnL NEGATIVO"
        echo ""
        echo "🔧 RECOMENDAÇÕES DE AJUSTE:"
        echo ""
        echo "Opção 1: Aumentar Spread"
        echo "  sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.030/' .env"
        echo "  sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.025/' .env"
        echo ""
        echo "Opção 2: Aumentar Order Size"
        echo "  sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.0001/' .env"
        echo ""
        echo "Opção 3: Aumentar Take Profit"
        echo "  sed -i 's/TAKE_PROFIT_PCT=.*/TAKE_PROFIT_PCT=0.035/' .env"
        echo ""
        echo "Depois: Reiniciar bot e testar novamente"
    else
        echo "✅ RESULTADO: PnL POSITIVO! 🎉"
        echo ""
        echo "🚀 Sistema está funcionando!"
        echo "   Continuar monitorando ou fazer ajustes para aumentar lucro"
    fi
else
    echo "❌ Nenhum dado coletado. Verificar logs em $LOG_FILE"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📋 Próximos passos:"
echo "   1. Revisar log completo: tail -f $LOG_FILE"
echo "   2. Ver dashboard: http://localhost:3001"
echo "   3. Se necessário, parar bot: pkill -f 'node bot.js'"
echo "   4. Fazer ajustes no .env"
echo "   5. Reiniciar com: npm run live"
echo ""
