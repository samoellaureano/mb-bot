#!/bin/bash
# Script de Monitoramento Rápido - MB Bot

LOG_FILE="logs/bot_live_20260120_165145.log"
INTERVAL=30

echo "🔍 MONITORAMENTO EM TEMPO REAL - MB Bot"
echo "═══════════════════════════════════════════"
echo "Arquivo: $LOG_FILE"
echo "Intervalo: ${INTERVAL}s"
echo ""
echo "Pressione Ctrl+C para parar"
echo "═══════════════════════════════════════════"
echo ""

while true; do
  clear
  echo "📊 STATUS EM TEMPO REAL"
  echo "═══════════════════════════════════════════"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Última linha de Ciclo
  LAST_CICLO=$(grep "Iniciando ciclo" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oP "ciclo \K[0-9]+")
  echo "📍 Ciclo Atual: $LAST_CICLO"
  
  # PnL
  PNLLINE=$(grep "PnL Total:" "$LOG_FILE" 2>/dev/null | tail -1)
  echo "💰 $PNLLINE"
  
  # Ordens Ativas
  ORDLINE=$(grep "Ordens Ativas:" "$LOG_FILE" 2>/dev/null | tail -1)
  echo "📋 $ORDLINE"
  
  # Taxa de Fill
  FILLLINE=$(grep "Taxa de Fill:" "$LOG_FILE" 2>/dev/null | tail -1)
  echo "✅ $FILLLINE"
  
  # Spread
  SPREADLINE=$(grep "Spread" "$LOG_FILE" 2>/dev/null | grep -i adaptativo | tail -1)
  echo "📈 $SPREADLINE"
  
  # Volatilidade
  VOLLINE=$(grep "Volatilidade calculada:" "$LOG_FILE" 2>/dev/null | tail -1 | sed 's/.*Volatilidade calculada: //')
  echo "🌪️  Volatilidade: $VOLLINE"
  
  # Tendência
  TRENDLINE=$(grep "Tendência:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -oP "Tendência: \K[A-Za-z]+")
  echo "📊 Tendência: $TRENDLINE"
  
  # Erros
  ERROR_COUNT=$(grep -c "ERROR\|WARN" "$LOG_FILE" 2>/dev/null || echo "0")
  echo ""
  echo "⚠️  Alertas/Erros nos últimos: $ERROR_COUNT"
  
  echo "═══════════════════════════════════════════"
  echo "Atualizando em ${INTERVAL}s... (Ctrl+C para sair)"
  sleep $INTERVAL
done
