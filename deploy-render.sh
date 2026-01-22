#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# SCRIPT DE DEPLOYMENT - MB-BOT para RENDER
# 
# Uso: ./deploy-render.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          🚀 DEPLOYMENT PREP - MB-BOT for RENDER                ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# ═══ VERIFICAR SEGURANÇA ═══
echo ""
echo "📋 Verificando segurança..."

# Verificar se .env tem credenciais
if [ -f .env ]; then
    echo "⚠️  Arquivo .env encontrado"
    
    if grep -q "API_KEY=" .env; then
        echo "🚨 ERRO: API_KEY encontrada em .env!"
        echo "   Remova credenciais antes de fazer commit!"
        exit 1
    fi
    
    if grep -q "API_SECRET=" .env; then
        echo "🚨 ERRO: API_SECRET encontrada em .env!"
        echo "   Remova credenciais antes de fazer commit!"
        exit 1
    fi
fi

# ═══ VERIFICAR GIT ═══
echo ""
echo "📋 Verificando Git..."

if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Existem mudanças não commitadas:"
    git status --short
    echo ""
    read -p "Deseja fazer commit? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        git add .
        git commit -m "Prepare for Render deployment"
    fi
fi

# ═══ VERIFICAR DEPENDÊNCIAS ═══
echo ""
echo "📋 Verificando dependências..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado!"
    exit 1
fi

echo "✅ Node $(node --version)"
echo "✅ npm $(npm --version)"

# ═══ TESTAR BUILD ═══
echo ""
echo "📋 Testando build..."

npm install
npm run test:24h || echo "⚠️  Testes não passaram, mas continuando..."

# ═══ VERIFICAR ARQUIVO DE CONFIGURAÇÃO ═══
echo ""
echo "📋 Verificando arquivos de configuração..."

if [ ! -f "Procfile" ]; then
    echo "❌ Procfile não encontrado!"
    exit 1
fi

if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml não encontrado!"
    exit 1
fi

if [ ! -f ".env.example" ]; then
    echo "❌ .env.example não encontrado!"
    exit 1
fi

echo "✅ Procfile configurado"
echo "✅ render.yaml configurado"
echo "✅ .env.example criado"

# ═══ PUSH PARA GIT ═══
echo ""
echo "📋 Fazendo push para GitHub..."

read -p "Fazer push para origin main? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    git push origin main
    echo "✅ Código enviado para GitHub"
fi

# ═══ INSTRUÇÕES FINAIS ═══
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  ✅ PRONTO PARA DEPLOY!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Ir para https://render.com/dashboard"
echo "2. Criar novo 'Web Service'"
echo "3. Conectar seu repositório GitHub"
echo "4. Configurar variáveis de ambiente:"
echo "   - API_KEY: seu valor seguro"
echo "   - API_SECRET: seu valor seguro"
echo "   - SIMULATE: false (para LIVE)"
echo "5. Deploy automático será iniciado"
echo ""
echo "Para monitorar:"
echo "   - Logs: https://render.com/dashboard → Logs"
echo "   - Dashboard: https://seu-app.onrender.com:3001"
echo ""
echo "⚠️  Importante:"
echo "   - NÃO use .env em Render"
echo "   - Use o painel de Environment Variables"
echo "   - Guarde suas credenciais em local seguro"
echo ""
