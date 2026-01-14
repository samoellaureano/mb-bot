#!/bin/bash

# Monitor de Estratégia Adaptativa em Tempo Real
# Acompanha mudanças de modo: ALTA → NEUTRA → BAIXA

clear
echo "🤖 MONITOR - ESTRATÉGIA ADAPTATIVA"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

LOGFILE="/mnt/c/PROJETOS_PESSOAIS/mb-bot/logs/bot.log"
LAST_LINES=0

while true; do
  clear
  
  # Timestamp
  echo "🕐 $(date '+%H:%M:%S') - Monitorando estratégia adaptativa"
  echo "═══════════════════════════════════════════════════════════════════════════"
  echo ""
  
  # Extrair status atual
  ADAPTIVE_STATUS=$(tail -500 "$LOGFILE" | grep "ESTRATÉGIA ADAPTATIVA" | tail -1)
  
  if [ ! -z "$ADAPTIVE_STATUS" ]; then
    echo "📊 STATUS ADAPTATIVO:"
    echo "   $ADAPTIVE_STATUS"
    echo ""
  fi
  
  # Extrair últimas mudanças de modo
  echo "🔄 ÚLTIMAS MUDANÇAS DE MODO:"
  echo "───────────────────────────────────────────────────────────────────────────"
  tail -200 "$LOGFILE" | grep -E "MODO|Spread:|MAX_POSITION:|Viés:" | tail -10 | while IFS= read -r line; do
    echo "   $line"
  done
  
  echo ""
  echo "📈 CICLOS RECENTES:"
  echo "───────────────────────────────────────────────────────────────────────────"
  tail -50 "$LOGFILE" | grep "Ciclo:" | tail -5 | while IFS= read -r line; do
    # Extrair informações
    CICLO=$(echo "$line" | grep -o "Ciclo: [0-9]*" | cut -d' ' -f2)
    PRICE=$(echo "$line" | grep -o "Price: [0-9.]*" | cut -d' ' -f2)
    TREND=$(echo "$line" | grep -o "Tendência: [a-z]*" | cut -d' ' -f2)
    
    if [ ! -z "$CICLO" ]; then
      printf "   Ciclo %-4s | Preço R\$ %-10s | Tendência: %s\n" "$CICLO" "$PRICE" "$TREND"
    fi
  done
  
  echo ""
  echo "💰 DESEMPENHO:"
  echo "───────────────────────────────────────────────────────────────────────────"
  tail -50 "$LOGFILE" | grep -E "PnL|ROI|Fills" | tail -3 | while IFS= read -r line; do
    echo "   $line"
  done
  
  echo ""
  echo "📊 ANÁLISE:"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  # Detectar padrão atual
  MODO_ATUAL=$(tail -100 "$LOGFILE" | grep "ESTRATÉGIA ADAPTATIVA" | grep -o "⚪\|📈\|📉" | tail -1)
  
  case "$MODO_ATUAL" in
    "📈")
      echo "   ✅ MODO ALTA: Acumulando BTC"
      echo "   • Spread reduzido para 1.0%"
      echo "   • MAX_POSITION aumentado (0.0005 BTC)"
      echo "   • Viés positivo: Comprando mais"
      ;;
    "📉")
      echo "   🛡️  MODO BAIXA: Protegendo BRL"
      echo "   • Spread aumentado para 1.8%"
      echo "   • MAX_POSITION reduzido (0.0002 BTC)"
      echo "   • Viés negativo: Vendendo mais"
      ;;
    "⚪")
      echo "   ⚪ MODO NEUTRAL: Market Making"
      echo "   • Spread normal 1.2%"
      echo "   • MAX_POSITION 0.0003 BTC"
      echo "   • Viés zero: Equilibrado"
      ;;
  esac
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════"
  echo "⏱️  Próxima atualização em 10s... (Ctrl+C para parar)"
  sleep 10
done
