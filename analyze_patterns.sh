#!/bin/bash

# Análise de Padrões - MB Bot
# Detecta e relata padrões comportamentais do bot

echo "🔍 ANÁLISE DE PADRÕES DO BOT"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Função para extrair log da última hora
analyze_logs() {
  LOGFILE="./logs/bot.log"
  
  if [ ! -f "$LOGFILE" ]; then
    echo "❌ Arquivo de log não encontrado: $LOGFILE"
    return
  fi
  
  echo "📋 PADRÕES DETECTADOS NOS LOGS"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  # Últimas 200 linhas do log
  tail -200 "$LOGFILE" | while IFS= read -r line; do
    
    # Padrão: Pares criados
    if [[ $line == *"Par de ordens criado"* ]]; then
      echo "  ✅ Par criado: $line" | grep -o "pair[^/]*" | head -1
    fi
    
    # Padrão: Ordens canceladas por idade
    if [[ $line == *"Cancelando ordem"* ]] && [[ $line == *"age"* ]]; then
      echo "  ⏱️  Ordem cancelada por timeout"
    fi
    
    # Padrão: Repricing (ordem movida)
    if [[ $line == *"repricing"* ]] || [[ $line == *"Repricing"* ]]; then
      echo "  🔄 Repricing detectado (ordem movida)"
    fi
    
    # Padrão: Proteção de queda
    if [[ $line == *"bearish"* ]] || [[ $line == *"BEARISH"* ]]; then
      echo "  🛑 Proteção de queda ativada"
    fi
    
    # Padrão: Stop-loss
    if [[ $line == *"stop.loss"* ]] || [[ $line == *"STOP"* ]]; then
      echo "  ❌ Stop-loss executado"
    fi
    
  done | sort | uniq -c | sort -rn | head -10
  
  echo ""
}

# Função para análise de preços
analyze_prices() {
  echo "📈 ANÁLISE DE PREÇOS"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  # Buscar dados atuais
  curl -s http://localhost:3001/api/data > /tmp/bot_current.json 2>/dev/null
  
  PRICE=$(grep -o '"mid":[0-9.]*' /tmp/bot_current.json | cut -d: -f2 | head -1)
  VOLATILITY=$(grep -o '"volatility":[0-9.]*' /tmp/bot_current.json | cut -d: -f2 | head -1)
  TREND=$(grep -o '"trend":"[^"]*"' /tmp/bot_current.json | cut -d'"' -f4 | head -1)
  
  printf "  Preço Atual:        R\$ %.2f\n" $PRICE
  printf "  Volatilidade:       %.2f%%\n" $VOLATILITY
  echo "  Tendência:          $TREND"
  
  # Estimar faixa de preços do dia
  if [ -f "$PWD/logs/bot.log" ]; then
    PRICES=$(tail -500 "$PWD/logs/bot.log" | grep -o "Preço:[^|]*" | sed 's/Preço://g' | sed 's/R\$ //g' | sort -n | uniq)
    if [ ! -z "$PRICES" ]; then
      MIN_PRICE=$(echo "$PRICES" | head -1)
      MAX_PRICE=$(echo "$PRICES" | tail -1)
      echo "  Amplitude (24h):    R\$ $MIN_PRICE a R\$ $MAX_PRICE"
    fi
  fi
  
  echo ""
}

# Função para análise de fills
analyze_fills() {
  echo "💎 ANÁLISE DE FILLS"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  curl -s http://localhost:3001/api/data > /tmp/bot_current.json 2>/dev/null
  
  FILLS=$(grep -c '"status":"filled"' /tmp/bot_current.json)
  TOTAL=$(grep -c '"status"' /tmp/bot_current.json)
  
  if [ $TOTAL -gt 0 ]; then
    FILL_RATE=$(echo "scale=2; $FILLS * 100 / $TOTAL" | bc)
  else
    FILL_RATE=0
  fi
  
  echo "  Fills detectados:   $FILLS"
  echo "  Total de ordens:    $TOTAL"
  printf "  Taxa de fill:       %.2f%%\n" $FILL_RATE
  
  if [ $FILLS -eq 0 ]; then
    echo "  ❌ PROBLEMA: Nenhum fill detectado"
    echo "     Possíveis causas:"
    echo "       • Spread muito largo (1.2% competitivo?)"
    echo "       • Liquidity baixa no orderbook"
    echo "       • Bot cancelando antes de preencher"
    echo "       • Preços não sincronizados com mercado"
  fi
  
  echo ""
}

# Função para análise de viabilidade
analyze_viability() {
  echo "⚙️ ANÁLISE DE VIABILIDADE"
  echo "───────────────────────────────────────────────────────────────────────────"
  
  curl -s http://localhost:3001/api/data > /tmp/bot_current.json 2>/dev/null
  
  BRL_BALANCE=$(grep -o '"brl":[0-9.]*' /tmp/bot_current.json | cut -d: -f2)
  BTC_BALANCE=$(grep -o '"btc":[0-9.e-]*' /tmp/bot_current.json | cut -d: -f2)
  
  printf "  Saldo BRL:          R\$ %.2f\n" $BRL_BALANCE
  printf "  Saldo BTC:          %.8f\n" $BTC_BALANCE
  
  # Recomendações
  echo ""
  echo "  💡 RECOMENDAÇÕES:"
  
  if (( $(echo "$BRL_BALANCE < 50" | bc -l) )); then
    echo "    ⚠️  SALDO BAIXO: Deposite mais BRL para aumentar volume"
    echo "       • Atual: R\$ $BRL_BALANCE"
    echo "       • Recomendado: R\$ 200-500 para múltiplos pares"
  fi
  
  if (( $(echo "$BTC_BALANCE < 0.00001" | bc -l) )); then
    echo "    ⚠️  BTC BAIXÍSSIMO: Impossível operar com este saldo"
    echo "       • Atual: $BTC_BALANCE BTC"
    echo "       • Recomendado: > 0.0001 BTC"
  fi
  
  echo ""
}

# Executar análises
analyze_logs
analyze_prices
analyze_fills
analyze_viability

echo "═════════════════════════════════════════════════════════════════════════════"
echo "✅ Análise concluída em $(date '+%H:%M:%S')"
