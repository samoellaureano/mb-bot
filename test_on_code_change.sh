#!/bin/bash
# test_on_code_change.sh - Roda testes de 24h sempre que há alteração no código
# 
# Uso:
#   ./test_on_code_change.sh         # Monitora mudanças e roda testes
#   node run_24h_test_cli.js          # Roda teste uma única vez

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🧪 TESTE AUTOMATIZADO DE 24 HORAS - MB BOT                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
LAST_RUN=0
MIN_INTERVAL=5  # Mínimo 5 segundos entre testes para evitar spam
WATCH_FILES=(
    "momentum_order_validator.js"
    "bot.js"
    "cash_management_strategy.js"
    "swing_trading_strategy.js"
    "adaptive_strategy.js"
)

get_file_hash() {
    local file=$1
    if [ -f "$file" ]; then
        md5sum "$file" 2>/dev/null | awk '{print $1}'
    else
        echo "0"
    fi
}

run_tests() {
    local current_time=$(date +%s)
    local time_diff=$((current_time - LAST_RUN))
    
    if [ $time_diff -lt $MIN_INTERVAL ]; then
        echo -e "${YELLOW}⏳ Aguardando $(($MIN_INTERVAL - $time_diff))s antes do próximo teste...${NC}"
        sleep $((MIN_INTERVAL - time_diff))
    fi
    
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}🔄 Executando testes às $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo ""
    
    node run_24h_test_cli.js
    TEST_RESULT=$?
    
    LAST_RUN=$(date +%s)
    
    if [ $TEST_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ Testes passaram! Continuando monitoramento...${NC}"
    else
        echo -e "${RED}❌ Testes falharam! Verifique o código.${NC}"
    fi
    
    echo ""
}

# Iniciar monitoramento
echo -e "${YELLOW}🔍 Monitorando alterações em arquivos críticos...${NC}"
echo ""
echo "Arquivos sendo monitorados:"
for file in "${WATCH_FILES[@]}"; do
    echo "  • $file"
done
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar.${NC}"
echo ""

# Armazenar hashes iniciais
declare -A file_hashes
for file in "${WATCH_FILES[@]}"; do
    file_hashes["$file"]=$(get_file_hash "$file")
done

# Executar testes inicialmente
run_tests

# Loop de monitoramento
while true; do
    sleep 2
    
    # Verificar cada arquivo
    for file in "${WATCH_FILES[@]}"; do
        current_hash=$(get_file_hash "$file")
        previous_hash="${file_hashes[$file]}"
        
        if [ "$current_hash" != "$previous_hash" ]; then
            echo -e "${YELLOW}📝 Alteração detectada em: $file${NC}"
            file_hashes["$file"]=$current_hash
            
            # Aguardar um pouco para garantir que todas as alterações foram salvas
            sleep 1
            
            # Executar testes
            run_tests
            
            # Só rodar uma vez por lote de alterações
            break
        fi
    done
done
