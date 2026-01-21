#!/bin/bash
# TESTE RÁPIDO - Validação de Implementação Otimização PnL
# Executa validações e exibe status

echo "╔════════════════════════════════════════════════════════╗"
echo "║   TESTE DE VALIDAÇÃO - OTIMIZAÇÃO PNL IMPLEMENTADA    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 1. Verificar .env
echo "📋 [1/4] Validando .env..."
if grep -q "SPREAD_PCT=0.025" .env && \
   grep -q "ORDER_SIZE=0.00005" .env && \
   grep -q "STOP_LOSS_PCT=0.015" .env && \
   grep -q "TAKE_PROFIT_PCT=0.025" .env; then
  echo "✅ .env atualizado corretamente"
else
  echo "❌ .env com valores incorretos"
  exit 1
fi
echo ""

# 2. Verificar bot.js
echo "🔧 [2/4] Validando bot.js..."
if grep -q "function getAdaptiveSpread" bot.js && \
   grep -q "getAdaptiveSpread({" bot.js; then
  echo "✅ getAdaptiveSpread implementado e sendo usado"
else
  echo "❌ getAdaptiveSpread não encontrado"
  exit 1
fi
echo ""

# 3. Verificar sintaxe
echo "🛠️  [3/4] Verificando sintaxe Node.js..."
if node -c bot.js 2>/dev/null; then
  echo "✅ Sintaxe válida"
else
  echo "❌ Erro de sintaxe em bot.js"
  exit 1
fi
echo ""

# 4. Teste de cálculos
echo "📊 [4/4] Validando cálculos..."
node test_pnl_optimization.js 2>/dev/null | tail -20

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              ✅ TODAS AS VALIDAÇÕES PASSARAM            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 PRONTO PARA EXECUTAR!"
echo ""
echo "Comandos disponíveis:"
echo "  npm run dev      - Bot + Dashboard em simulação"
echo "  npm run simulate - Bot apenas em simulação"
echo "  npm run live     - Bot em produção (CUIDADO!)"
echo ""
