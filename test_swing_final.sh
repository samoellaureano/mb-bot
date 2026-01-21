#!/bin/bash
# Test swing trading deployment - Final Validation

echo "🧪 TESTE FINAL - ESTRATÉGIA SWING TRADING"
echo "=========================================="
echo ""
echo "✓ Iniciando bot em modo simulação com estratégia swing trading..."
echo ""

export SIMULATE=true
export USE_SWING_TRADING=true

cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

# Rodar bot por 120 segundos
timeout 120 node bot.js 2>&1 | tee swing_test_final.log &
BOT_PID=$!

# Aguardar bot iniciar e processar alguns ciclos
sleep 15

# Contar ocorrências de [SWING]
echo ""
echo "📊 ESTATÍSTICAS APÓS 15 SEGUNDOS:"
echo "=================================="
SWING_COUNT=$(grep -c "\[SWING\]" swing_test_final.log 2>/dev/null || echo "0")
ERRORS=$(grep -c "\[ERROR\]" swing_test_final.log 2>/dev/null || echo "0")
CYCLES=$(grep -c "Iniciando ciclo" swing_test_final.log 2>/dev/null || echo "0")

echo "✓ Ciclos executados: $CYCLES"
echo "✓ Mensagens [SWING]: $SWING_COUNT"
echo "✗ Erros: $ERRORS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
    echo "❌ ERROS DETECTADOS - Últimas mensagens:"
    grep "\[ERROR\]" swing_test_final.log | tail -3
fi

# Aguardar mais um pouco
sleep 30

# Verificar sinais de trade
COMPRA=$(grep -c "COMPRA" swing_test_final.log 2>/dev/null || echo "0")
VENDA=$(grep -c "VENDA" swing_test_final.log 2>/dev/null || echo "0")

echo ""
echo "🔄 SINAIS DE NEGOCIAÇÃO (após 45 segundos):"
echo "=========================================="
echo "✓ Sinais de COMPRA: $COMPRA"
echo "✓ Sinais de VENDA: $VENDA"

# Parar o bot
kill $BOT_PID 2>/dev/null
wait $BOT_PID 2>/dev/null

echo ""
echo "✅ TESTE CONCLUÍDO"
echo ""
echo "📋 Para ver todos os logs:"
echo "   tail -200 swing_test_final.log"
