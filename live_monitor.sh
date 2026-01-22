#!/bin/bash

# Monitor ao Vivo - Ciclos v1.8
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🚀 MB-BOT v1.8 LIVE - Monitor de Ciclos em Tempo Real  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Acompanhando ciclos (próximos 90 segundos)..."
echo ""

# Contar linhas iniciais
INITIAL_LINES=$(wc -l < /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log 2>/dev/null || echo 0)

# Aguardar novos logs
(
  tail -f /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log 2>/dev/null | while IFS= read -r line; do
    # Filtrar e exibir ciclos
    if [[ $line == *"Iniciando ciclo"* ]]; then
      echo "🔄 $(echo $line | grep -oE 'ciclo [0-9]+.*' | cut -d. -f1)"
    elif [[ $line == *"Orderbook atualizado"* ]]; then
      echo "📊 $(echo $line | grep -oE 'Best Bid.*')"
    elif [[ $line == *"Tendência Externa"* ]]; then
      echo "📈 Tendência: $(echo $line | grep -oE '(UP|DOWN|NEUTRAL|BEARISH)' | head -1)"
    elif [[ $line == *"CASH_MGT"* ]] && [[ $line == *"Compra"* || $line == *"Venda"* ]]; then
      echo "💰 $(echo $line | cut -d'|' -f3-)"
    fi
  done
) &

TAIL_PID=$!

# Deixar monitorar por 90 segundos
sleep 90

# Parar
kill $TAIL_PID 2>/dev/null
wait $TAIL_PID 2>/dev/null

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    📊 RESUMO FINAL                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Extrair resumo dos últimos ciclos
echo "✅ Últimos ciclos completados:"
grep -E "Iniciando ciclo" /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log | tail -3 | awk '{print "   " $0}'

echo ""
echo "🌐 Dashboard: http://localhost:3001"
echo "📝 Log: tail -f /mnt/c/PROJETOS_PESSOAIS/mb-bot/exec-live.log"
echo ""
