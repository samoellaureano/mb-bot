#!/bin/bash
# Script de inicialização para Teste Live Completo
# Inicia: bot + dashboard + teste de validação em paralelo

echo "🚀 INICIANDO TESTE LIVE COMPLETO"
echo "=================================="

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Verificar .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado!${NC}"
    exit 1
fi

# Verificar SIMULATE
SIMULATE=$(grep "^SIMULATE=" .env | cut -d= -f2)
if [ "$SIMULATE" != "false" ]; then
    echo -e "${YELLOW}⚠️  ATENÇÃO: SIMULATE não está definido como 'false'${NC}"
    echo "Bot está em modo simulação. Altere em .env para SIMULATE=false"
    exit 1
fi

echo -e "${GREEN}✓ .env validado (SIMULATE=false - MODO LIVE)${NC}"

# Criar diretório de logs
mkdir -p logs

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_BOT="logs/bot_${TIMESTAMP}.log"
LOG_DASHBOARD="logs/dashboard_${TIMESTAMP}.log"
LOG_TESTE="logs/teste_${TIMESTAMP}.log"

echo -e "${CYAN}📝 Logs serão salvos em:${NC}"
echo "  Bot: $LOG_BOT"
echo "  Dashboard: $LOG_DASHBOARD"
echo "  Teste: $LOG_TESTE"

# Iniciar bot em background
echo -e "${CYAN}🤖 Iniciando Bot...${NC}"
npm run live > "$LOG_BOT" 2>&1 &
BOT_PID=$!
echo -e "${GREEN}✓ Bot iniciado (PID: $BOT_PID)${NC}"

# Aguardar bot inicializar (10 segundos)
sleep 10

# Iniciar dashboard em background
echo -e "${CYAN}📊 Iniciando Dashboard (porta 3001)...${NC}"
npm run dashboard > "$LOG_DASHBOARD" 2>&1 &
DASHBOARD_PID=$!
echo -e "${GREEN}✓ Dashboard iniciado (PID: $DASHBOARD_PID)${NC}"

# Aguardar dashboard inicializar
sleep 5

# Iniciar teste de validação
echo -e "${CYAN}✅ Iniciando Teste de Validação...${NC}"
node test_live_complete.js | tee "$LOG_TESTE" &
TESTE_PID=$!
echo -e "${GREEN}✓ Teste iniciado (PID: $TESTE_PID)${NC}"

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ TESTE LIVE COMPLETO INICIADO${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📊 Monitorar em: ${CYAN}http://localhost:3001${NC}"
echo -e "📝 Logs salvos em: ${CYAN}logs/${NC}"
echo ""
echo "Processos em execução:"
echo "  🤖 Bot:       PID=$BOT_PID"
echo "  📊 Dashboard: PID=$DASHBOARD_PID"
echo "  ✅ Teste:     PID=$TESTE_PID"
echo ""
echo -e "${YELLOW}⏱️  Teste executará até 20:30${NC}"
echo ""

# Aguardar término do teste
wait $TESTE_PID
TESTE_EXIT=$?

# Parar bot e dashboard
echo ""
echo -e "${YELLOW}Encerrando processos...${NC}"
kill $BOT_PID 2>/dev/null
kill $DASHBOARD_PID 2>/dev/null

echo -e "${GREEN}✓ Bot encerrado${NC}"
echo -e "${GREEN}✓ Dashboard encerrado${NC}"

if [ $TESTE_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Teste finalizado com sucesso${NC}"
else
    echo -e "${YELLOW}⚠️  Teste finalizado com código de saída: $TESTE_EXIT${NC}"
fi

echo ""
echo -e "${CYAN}Relatório final salvo em: teste_live_*.json${NC}"
echo -e "${CYAN}Logs disponíveis em: logs/${NC}"
