#!/bin/bash

# Monitor em Tempo Real - MB Bot
# Uso: bash monitor_realtime.sh

CYCLES_INICIAL=0
PNL_INICIAL=0
ITERATION=0

echo "🤖 MB BOT - Monitor em Tempo Real"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

while true; do
  ITERATION=$((ITERATION + 1))
  
  # Buscar dados da API
  curl -s http://localhost:3001/api/data > /tmp/bot_monitor.json 2>/dev/null
  
  if [ ! -f /tmp/bot_monitor.json ]; then
    echo "❌ Erro: Não consegui conectar à API em http://localhost:3001"
    sleep 5
    continue
  fi
  
  # Extrair valores (evitando heredoc)
  CYCLES=$(grep -o '"cycles":[0-9]*' /tmp/bot_monitor.json | cut -d: -f2)
  PNL=$(grep -o '"totalPnL":[0-9.]*' /tmp/bot_monitor.json | cut -d: -f2)
  ROI=$(grep -o '"roi":[0-9.]*' /tmp/bot_monitor.json | cut -d: -f2)
  PRICE=$(grep -o '"mid":[0-9.]*' /tmp/bot_monitor.json | cut -d: -f2)
  VOLATILITY=$(grep -o '"volatility":[0-9.]*' /tmp/bot_monitor.json | cut -d: -f2 | head -1)
  TREND=$(grep -o '"trend":"[^"]*"' /tmp/bot_monitor.json | cut -d'"' -f4 | head -1)
  EXT_TREND=$(grep -o '"externalTrend":{"trend":"[^"]*"' /tmp/bot_monitor.json | cut -d'"' -f8)
  RSI=$(grep -o '"rsi":[0-9.]*' /tmp/bot_monitor.json | cut -d: -f2 | head -1)
  
  # Ordens ativas
  BUY_COUNT=$(grep -c '"side":"buy"' /tmp/bot_monitor.json)
  SELL_COUNT=$(grep -c '"side":"sell"' /tmp/bot_monitor.json)
  TOTAL_ORDERS=$((BUY_COUNT + SELL_COUNT))
  
  # Calcular velocidade
  if [ $CYCLES_INICIAL -eq 0 ]; then
    CYCLES_INICIAL=$CYCLES
    PNL_INICIAL=$PNL
  fi
  CYCLES_PASSOU=$((CYCLES - CYCLES_INICIAL))
  PNL_MUDOU=$(echo "$PNL - $PNL_INICIAL" | bc)
  
  # Limpar tela e mostrar dados
  clear
  echo "🤖 MB BOT - Monitor em Tempo Real | Iteration: $ITERATION"
  echo "═════════════════════════════════════════════════════════════════════════════"
  echo ""
  
  # Seção de Mercado
  echo "📊 MERCADO"
  echo "───────────────────────────────────────────────────────────────────────────"
  printf "  Preço BTC:          R\$ %.2f\n" $PRICE
  printf "  Volatilidade:       %.2f%%\n" $VOLATILITY
  printf "  RSI:                %.0f\n" $RSI
  echo "  Tendência Interna:  $TREND"
  echo "  Tendência Externa:  $EXT_TREND"
  echo ""
  
  # Seção de Ordens
  echo "📋 ORDENS ATIVAS"
  echo "───────────────────────────────────────────────────────────────────────────"
  echo "  Total: $TOTAL_ORDERS (BUY: $BUY_COUNT | SELL: $SELL_COUNT)"
  
  # Mostrar últimas ordens (limitar a 3)
  ORDER_COUNT=0
  while IFS= read -r line; do
    if [[ $line == *"side"* ]] && [ $ORDER_COUNT -lt 3 ]; then
      SIDE=$(echo "$line" | grep -o '"side":"[^"]*"' | cut -d'"' -f4)
      PRICE_ORD=$(echo "$line" | grep -o '"price":[0-9.]*' | cut -d: -f2)
      QTY=$(echo "$line" | grep -o '"qty":[0-9.e-]*' | cut -d: -f2)
      AGE=$(echo "$line" | grep -o '"ageSec":[0-9]*' | cut -d: -f2)
      printf "    • %s @ R\$ %.0f | %.8f BTC | %ds\n" "$SIDE" "$PRICE_ORD" "$QTY" "$AGE"
      ORDER_COUNT=$((ORDER_COUNT + 1))
    fi
  done < /tmp/bot_monitor.json
  
  echo ""
  
  # Seção de Performance
  echo "💰 PERFORMANCE"
  echo "───────────────────────────────────────────────────────────────────────────"
  printf "  PnL Total:          R\$ %.2f\n" $PNL
  printf "  PnL nesta sessão:   R\$ %.2f\n" $PNL_MUDOU
  printf "  ROI:                %.2f%%\n" $ROI
  echo "  Ciclos desde início: $CYCLES_PASSOU"
  echo ""
  
  # Seção de Análise
  echo "🛡️ ANÁLISE DE RISCO"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  # Verificar proteção de queda
  if [[ "$TREND" == "down" ]] || [[ "$EXT_TREND" == "BEARISH" ]]; then
    if [ "$TOTAL_ORDERS" -eq 0 ]; then
      echo "  ✅ PROTEÇÃO ATIVA: Mercado em queda - Bot pausou novos pares"
    else
      echo "  ⚠️  ATENÇÃO: Mercado em queda com $TOTAL_ORDERS posições abertas"
    fi
  else
    echo "  ✅ SEM RISCO: Mercado em alta/neutro - Operando normalmente"
  fi
  
  # Verificar volatilidade
  if (( $(echo "$VOLATILITY > 3.0" | bc -l) )); then
    echo "  ⚠️  Volatilidade alta (${VOLATILITY}%) - Cuidado com exposição"
  else
    echo "  ✅ Volatilidade normal (${VOLATILITY}%)"
  fi
  
  # RSI extremo
  if (( $(echo "$RSI > 70" | bc -l) )); then
    echo "  ⚠️  RSI muito alto ($RSI) - Possível reversão"
  elif (( $(echo "$RSI < 30" | bc -l) )); then
    echo "  ⚠️  RSI muito baixo ($RSI) - Possível rebote"
  else
    echo "  ✅ RSI neutro ($RSI)"
  fi
  
  echo ""
  echo "═════════════════════════════════════════════════════════════════════════════"
  echo "⏱️  Próxima atualização em 30s... (Ctrl+C para parar)"
  
  sleep 30
done
