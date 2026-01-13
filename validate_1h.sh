#!/bin/bash

# Monitor de 1 hora com validações automáticas
# Uso: ./validate_1h.sh

cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

START_TIME=$(date +%s)
END_TIME=$((START_TIME + 3600))
BR_TIME=$(TZ='America/Sao_Paulo' date)

echo "🇧🇷 MONITORAMENTO E VALIDAÇÃO - 1 HORA"
echo "⏰ Início: $BR_TIME"
echo "⏰ Fim previsto: $(TZ='America/Sao_Paulo' date -d '+1 hour')"
echo "📊 Dashboard: http://localhost:3001"
echo "💰 TRADING REAL ATIVO!"
echo "=============================================="

# Função para validar cálculos
validate_session() {
    local checkpoint=$1
    echo ""
    echo "🔍 VALIDAÇÃO #$checkpoint - $(TZ='America/Sao_Paulo' date)"
    echo "----------------------------------------"
    
    # 1. Validar PnL
    echo "📊 Validando PnL..."
    npm run validate-pnl 2>/dev/null && echo "✅ PnL validado" || echo "❌ Erro PnL"
    
    # 2. Estatísticas recentes  
    echo "📈 Estatísticas (última hora)..."
    npm run stats:live 2>/dev/null && echo "✅ Stats OK" || echo "❌ Erro Stats"
    
    # 3. Ordens recentes
    echo "🔄 Últimas 5 ordens..."
    npm run orders 2>/dev/null | head -6 && echo "✅ Ordens OK" || echo "❌ Erro Ordens"
    
    echo "----------------------------------------"
}

# Iniciando o bot
echo "🚀 Iniciando bot e dashboard..."
npm run start > monitor_session.log 2>&1 &
BOT_PID=$!
echo "Bot PID: $BOT_PID"

# Aguardar inicialização
sleep 10
echo "✅ Sistema iniciado"

# Loop de monitoramento
validation_num=1
last_validation=0

while [ $(date +%s) -lt $END_TIME ]; do
    current_time=$(date +%s)
    elapsed=$((current_time - START_TIME))
    remaining=$((END_TIME - current_time))
    
    # Status a cada 2 minutos
    if [ $((elapsed % 120)) -eq 0 ]; then
        echo "⏰ Decorrido: $((elapsed/60))min | Restante: $((remaining/60))min"
        
        # Verificar se bot ainda roda
        if ! kill -0 $BOT_PID 2>/dev/null; then
            echo "⚠️  Bot parou! Reiniciando..."
            npm run start > monitor_session.log 2>&1 &
            BOT_PID=$!
            sleep 5
        fi
    fi
    
    # Validar a cada 15 minutos
    if [ $((elapsed % 900)) -eq 0 ] && [ $elapsed -gt $last_validation ] && [ $elapsed -gt 0 ]; then
        validate_session $validation_num
        validation_num=$((validation_num + 1))
        last_validation=$elapsed
    fi
    
    sleep 30
done

echo ""
echo "🏁 MONITORAMENTO CONCLUÍDO!"
echo "⏰ Fim: $(TZ='America/Sao_Paulo' date)"

# Validação final
validate_session "FINAL"

# Parar bot
echo "🛑 Encerrando bot..."
kill $BOT_PID 2>/dev/null
wait $BOT_PID 2>/dev/null

echo "✅ Sessão encerrada com segurança"
echo "📄 Logs salvos em: monitor_session.log"

# Resumo final
echo ""
echo "📊 RESUMO DA SESSÃO"
echo "=================="
echo "📈 Estatísticas finais:"
npm run stats 2>/dev/null | head -10

echo ""
echo "🔄 Últimas ordens:"
npm run orders 2>/dev/null | head -5

echo ""
echo "✅ MONITORAMENTO DE 1 HORA CONCLUÍDO"