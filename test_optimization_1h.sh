#!/bin/bash

# Script para iniciar bot em simulação e validar PnL
# Roda por 1 hora e compara resultados

echo "🚀 INICIANDO BOT EM SIMULAÇÃO PARA VALIDAÇÃO"
echo "=============================================="
echo ""
echo "Configuração:"
echo "  ✅ SPREAD: 2.5% (mínimo)"
echo "  ✅ ORDER_SIZE: 50μBTC (~R\$ 24)"
echo "  ✅ STOP_LOSS: 1.5%"
echo "  ✅ TAKE_PROFIT: 2.5%"
echo ""

# Parar qualquer bot anterior
pkill -f "node bot.js" 2>/dev/null
sleep 2

# Usar variáveis de ambiente
export SIMULATE=true
export CYCLE_SEC=30
export DEBUG=true

# Log timestamps
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/bot_optimization_test_${TIMESTAMP}.log"
mkdir -p logs

echo "Iniciando bot..."
echo "Log: $LOG_FILE"
echo ""

# Iniciar bot em background
nohup node bot.js > "$LOG_FILE" 2>&1 &
BOT_PID=$!
echo "Bot iniciado (PID: $BOT_PID)"

# Iniciar dashboard em background
echo "Iniciando dashboard..."
nohup node dashboard.js > logs/dashboard_${TIMESTAMP}.log 2>&1 &
DASH_PID=$!
echo "Dashboard iniciado (PID: $DASH_PID)"
echo "Acessar em: http://localhost:3001"
echo ""

# Monitorar por 1 hora
echo "Monitorando por 60 minutos..."
echo "=============================================="
echo ""

for ((i=1; i<=12; i++)); do
  sleep 300  # 5 minutos
  
  # Buscar última entrada de PnL
  PNL=$(grep "PnL Total:" "$LOG_FILE" | tail -1)
  CYCLE=$(grep "\[CICLO" "$LOG_FILE" | tail -1 | grep -oE "CICLO [0-9]+" | grep -oE "[0-9]+")
  SPREAD=$(grep "SPREAD_ADAPT" "$LOG_FILE" | tail -1 | grep -oE "spread=[0-9.]+%")
  
  if [ -z "$PNL" ]; then
    PNL="Ainda não calculado..."
  fi
  
  echo "[$(date '+%H:%M:%S')] Verificação $i/12:"
  echo "  Ciclos executados: $CYCLE"
  echo "  Último spread: $SPREAD"
  echo "  $PNL"
  echo ""
done

echo "=============================================="
echo "❌ PARANDO BOTS"
kill $BOT_PID $DASH_PID 2>/dev/null
sleep 2

echo ""
echo "📊 ANÁLISE FINAL"
echo "=============================================="

# Contar operações
TRADES=$(grep -c "Ordem colocada" "$LOG_FILE")
echo "Total de trades: $TRADES"

# Último PnL
FINAL_PNL=$(grep "PnL Total:" "$LOG_FILE" | tail -1)
echo "PnL final: $FINAL_PNL"

# Spread médio
AVG_SPREAD=$(grep "SPREAD_ADAPT" "$LOG_FILE" | grep -oE "spread=[0-9.]+%" | grep -oE "[0-9.]+" | awk '{s+=$1; n++} END {if(n>0) print s/n}')
echo "Spread médio usado: ${AVG_SPREAD}%"

# Taxa de preenchimento
FILLS=$(grep -c "Ordem preenchida" "$LOG_FILE")
FILL_RATE=$(echo "scale=2; $FILLS * 100 / $TRADES" | bc)
echo "Taxa de preenchimento: ${FILL_RATE}%"

echo ""
echo "✅ TESTE CONCLUÍDO"
echo "Arquivo log: $LOG_FILE"
echo ""
echo "Próximos passos:"
if grep -q "PnL Total: -" "$LOG_FILE" | tail -1; then
  echo "  ⚠️  PnL ainda negativo - aumentar spread mais"
else
  echo "  ✅ PnL positivo! Pronto para produção"
fi
