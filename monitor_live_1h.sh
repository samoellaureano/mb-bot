#!/bin/bash

# Monitoramento de 1 hora com validações automáticas
# Este script executará o bot live por 1 hora e fará validações a cada 15 minutos

cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

# Configurações
DURATION_MINUTES=60
VALIDATION_INTERVAL=15
SESSION_START=$(date +%s)
BRAZIL_START=$(TZ='America/Sao_Paulo' date)

echo "🇧🇷 SESSÃO DE MONITORAMENTO - 1 HORA COMPLETA"
echo "=============================================="
echo "⏰ Início: $BRAZIL_START"
echo "⏰ Fim previsto: $(TZ='America/Sao_Paulo' date -d '+1 hour')"
echo "📊 Dashboard: http://localhost:3001"
echo "💰 MODO: LIVE (Trading Real)"
echo "🔍 Validações a cada $VALIDATION_INTERVAL minutos"
echo "=============================================="
echo ""

# Função de validação completa
perform_validation() {
    local checkpoint_num=$1
    local elapsed_min=$2
    
    echo ""
    echo "🔍 VALIDAÇÃO #$checkpoint_num"
    echo "⏰ Tempo: $elapsed_min min | Horário: $(TZ='America/Sao_Paulo' date)"
    echo "----------------------------------------"
    
    # 1. Validação PnL
    echo "💰 Validando cálculos de PnL..."
    if npm run validate-pnl 2>/dev/null; then
        echo "   ✅ PnL calculations validated"
    else
        echo "   ❌ PnL validation failed"
    fi
    
    # 2. Estatísticas atuais
    echo "📊 Estatísticas da última hora..."
    if npm run stats:live 2>/dev/null; then
        echo "   ✅ Statistics retrieved"
    else
        echo "   ❌ Statistics failed"
    fi
    
    # 3. Status das ordens
    echo "📋 Últimas ordens (top 5)..."
    npm run orders 2>/dev/null | head -6
    
    # 4. Verificar tendências
    echo "🌐 Verificando alinhamento de tendências..."
    tail -20 session_live.log 2>/dev/null | grep -E "(Tendência Externa|Alinhamento)" | tail -2
    
    echo "----------------------------------------"
    echo ""
}

# Iniciar sessão de trading live
echo "🚀 Iniciando sessão de trading live..."
npm run start > session_live.log 2>&1 &
BOT_PID=$!

echo "   Bot PID: $BOT_PID"
echo "   Logs: session_live.log"
echo ""

# Aguardar inicialização
echo "⏳ Aguardando inicialização (10s)..."
sleep 10

# Verificar se iniciou corretamente
if kill -0 $BOT_PID 2>/dev/null; then
    echo "   ✅ Bot iniciado com sucesso"
else
    echo "   ❌ Falha na inicialização do bot"
    exit 1
fi

# Loop principal de monitoramento
validation_count=1
last_validation_minute=0

for ((minute=1; minute<=DURATION_MINUTES; minute++)); do
    # Status de progresso
    if [ $((minute % 5)) -eq 0 ]; then
        remaining=$((DURATION_MINUTES - minute))
        echo "⏰ Progresso: ${minute}/${DURATION_MINUTES} min | Restante: ${remaining} min"
    fi
    
    # Verificar se o bot ainda está rodando
    if ! kill -0 $BOT_PID 2>/dev/null; then
        echo "⚠️  Bot parou no minuto $minute! Reiniciando..."
        npm run start > session_live.log 2>&1 &
        BOT_PID=$!
        echo "   Novo PID: $BOT_PID"
        sleep 5
    fi
    
    # Executar validação a cada intervalo
    if [ $((minute % VALIDATION_INTERVAL)) -eq 0 ] && [ $minute -gt $last_validation_minute ]; then
        perform_validation $validation_count $minute
        validation_count=$((validation_count + 1))
        last_validation_minute=$minute
    fi
    
    # Aguardar 1 minuto
    sleep 60
done

# Finalização da sessão
echo ""
echo "🏁 SESSÃO COMPLETA - FINALIZANDO"
echo "⏰ Fim: $(TZ='America/Sao_Paulo' date)"
echo ""

# Validação final
perform_validation "FINAL" $DURATION_MINUTES

# Estatísticas finais completas
echo "📊 RELATÓRIO FINAL DA SESSÃO"
echo "============================"
echo ""
echo "📈 Estatísticas completas (24h):"
npm run stats 2>/dev/null
echo ""
echo "🔄 Histórico de ordens completo:"
npm run orders 2>/dev/null | head -10
echo ""

# Encerrar bot
echo "🛑 Encerrando bot..."
kill $BOT_PID 2>/dev/null
wait $BOT_PID 2>/dev/null

echo ""
echo "✅ MONITORAMENTO DE 1 HORA CONCLUÍDO COM SUCESSO"
echo "📄 Logs detalhados salvos em: session_live.log"
echo "=============================================="