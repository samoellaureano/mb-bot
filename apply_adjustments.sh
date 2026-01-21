#!/bin/bash
# AJUSTES RÁPIDOS - Se PnL estiver negativo, aplicar fixes

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🔧 AJUSTES RÁPIDOS PARA PNL NEGATIVO             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Parar bot
echo "🛑 Parando bot..."
pkill -f "node bot.js" 2>/dev/null || true
sleep 2
echo "✅ Bot parado"
echo ""

# Menu de opções
echo "Escolha a estratégia de ajuste:"
echo ""
echo "1️⃣  AGRESSIVO: Aumentar spread para 3%"
echo "    (recomendado se PnL muito negativo)"
echo ""
echo "2️⃣  MODERADO: Aumentar spread para 2.8%"
echo "    (ajuste intermediário)"
echo ""
echo "3️⃣  ORDER SIZE: Aumentar tamanho da ordem para 100μBTC"
echo "    (em vez de 50μBTC)"
echo ""
echo "4️⃣  COMBINADO: Spread 2.8% + Order 100μBTC"
echo "    (ajuste mais forte)"
echo ""
echo "5️⃣  Reverter para valores antigos"
echo "    (se situação piorou)"
echo ""
read -p "Digite a opção (1-5): " OPCAO

case $OPCAO in
    1)
        echo "📝 Aplicando: Spread 3.0%"
        sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.030/' .env
        sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.025/' .env
        echo "✅ Ajuste aplicado"
        ;;
    2)
        echo "📝 Aplicando: Spread 2.8%"
        sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.028/' .env
        sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.022/' .env
        echo "✅ Ajuste aplicado"
        ;;
    3)
        echo "📝 Aplicando: Order Size 100μBTC"
        sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.0001/' .env
        sed -i 's/MIN_ORDER_SIZE=.*/MIN_ORDER_SIZE=0.00005/' .env
        echo "✅ Ajuste aplicado"
        ;;
    4)
        echo "📝 Aplicando: Spread 2.8% + Order 100μBTC"
        sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.028/' .env
        sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.022/' .env
        sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.0001/' .env
        sed -i 's/MIN_ORDER_SIZE=.*/MIN_ORDER_SIZE=0.00005/' .env
        echo "✅ Ajuste aplicado"
        ;;
    5)
        echo "📝 Revertendo para valores originais"
        sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.015/' .env
        sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.012/' .env
        sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.000005/' .env
        sed -i 's/MIN_ORDER_SIZE=.*/MIN_ORDER_SIZE=0.000003/' .env
        echo "✅ Revertido"
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📋 Configuração atualizada:"
echo ""
grep -E "^(SPREAD_PCT|ORDER_SIZE|MIN_SPREAD|MIN_ORDER)" .env | head -6
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🚀 Reiniciando bot com novos parâmetros..."
echo ""
echo "Execute: npm run live"
echo ""
