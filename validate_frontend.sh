#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "    🔍 VALIDAÇÃO DO FRONTEND - MB-BOT DASHBOARD"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Testar API endpoint
echo "1️⃣  Testando endpoint /api/data..."
API_RESPONSE=$(curl -s http://localhost:3001/api/data 2>/dev/null)

if [ -z "$API_RESPONSE" ]; then
    echo "   ❌ API não respondeu"
    exit 1
fi

# Verificar se é JSON válido
if ! echo "$API_RESPONSE" | jq . > /dev/null 2>&1; then
    echo "   ❌ Resposta não é JSON válido"
    echo "   Resposta: ${API_RESPONSE:0:100}"
    exit 1
fi

echo "   ✅ API respondendo com JSON válido"
echo ""

# 2. Verificar campos críticos
echo "2️⃣  Verificando campos críticos..."

MARKET=$(echo "$API_RESPONSE" | jq '.market' 2>/dev/null)
BALANCES=$(echo "$API_RESPONSE" | jq '.balances' 2>/dev/null)
STATS=$(echo "$API_RESPONSE" | jq '.stats' 2>/dev/null)

if [ "$MARKET" == "null" ] || [ -z "$MARKET" ]; then
    echo "   ⚠️  Campo 'market' não encontrado"
else
    echo "   ✅ market: OK"
fi

if [ "$BALANCES" == "null" ] || [ -z "$BALANCES" ]; then
    echo "   ⚠️  Campo 'balances' não encontrado"
else
    echo "   ✅ balances: OK"
fi

if [ "$STATS" == "null" ] || [ -z "$STATS" ]; then
    echo "   ⚠️  Campo 'stats' não encontrado"
else
    echo "   ✅ stats: OK"
fi

echo ""
echo "3️⃣  Dados da API (últimas 3 linhas):"
echo "$API_RESPONSE" | jq . 2>/dev/null | tail -3

echo ""
echo "4️⃣  HTML do Dashboard:"
HTML=$(curl -s http://localhost:3001/)
if echo "$HTML" | grep -q "loadData"; then
    echo "   ✅ Função loadData encontrada"
else
    echo "   ❌ Função loadData NÃO encontrada"
fi

if echo "$HTML" | grep -q "startDataLoading"; then
    echo "   ✅ Função startDataLoading encontrada"
else
    echo "   ❌ Função startDataLoading NÃO encontrada"
fi

if echo "$HTML" | grep -q "/api/data"; then
    echo "   ✅ Endpoint /api/data encontrado no HTML"
else
    echo "   ❌ Endpoint /api/data NÃO encontrado no HTML"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ VALIDAÇÃO CONCLUÍDA"
echo ""
echo "Para ver dados no navegador:"
echo "   👉 http://localhost:3001"
echo ""
echo "Para debug do console (F12):"
echo "   Abra o navegador e pressione F12 → Console"
echo "═══════════════════════════════════════════════════════════════"
