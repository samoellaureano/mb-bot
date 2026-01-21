#!/bin/bash
# run_bot_production.sh
# 
# Script para rodar o bot em PRODUÇÃO com a estratégia swing trading
# ⚠️ AVISO: Isso usa capital REAL! Use com cuidado!

set -e

cd "$(dirname "$0")"

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════════╗"
echo "║                    ⚠️  BOT EM MODO PRODUÇÃO - AVISOS CRÍTICOS                ║"
echo "╚════════════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "🔴 AVISOS IMPORTANTES:"
echo "  1. Você está prestes a usar CAPITAL REAL"
echo "  2. Qualquer erro pode resultar em perdas financeiras"
echo "  3. Certifique-se de ter testado em simulação por 24h+"
echo "  4. Esteja pronto para parar o bot a qualquer momento"
echo "  5. Monitore os logs continuamente"
echo ""

echo "⚙️  CONFIGURAÇÃO:"
echo "  • Modo: PRODUÇÃO (SIMULATE=false)"
echo "  • Estratégia: SWING TRADING (USE_SWING_TRADING=true)"
echo "  • Ciclo: 30 segundos"
echo "  • Parâmetros:"
echo "    - Drop Threshold: 0.3%"
echo "    - Profit Target: 0.4%"
echo "    - Stop Loss: -0.8%"
echo ""

read -p "💰 Você TEM CERTEZA que deseja continuar? (sim/não): " -r
if [[ ! $REPLY =~ ^[Ss][Ii][Mm]$ ]]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo ""
echo "⏱️  Iniciando bot em produção em 5 segundos..."
echo "   (Pressione CTRL+C para parar)"
echo ""

sleep 5

# Exportar variáveis de ambiente
export SIMULATE=false
export USE_SWING_TRADING=true
export CYCLE_SEC=30
export DEBUG=true

# Iniciar bot
echo "🚀 Iniciando bot..."
node bot.js

# Se chegou aqui, bot foi parado
echo ""
echo "✅ Bot parado"
echo "📋 Verifique os logs em bot.log para análise"
