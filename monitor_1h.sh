#!/bin/bash

# Monitor de 1 hora - Acompanhar evolução dos ciclos do bot
# Execução: ./monitor_1h.sh

cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

echo "🚀 INICIANDO MONITORAMENTO DE 1 HORA"
echo "⏰ Início: $(date)"
echo "📊 Intervalo: 30 segundos entre verificações"
echo "🎯 Duração: 1 hora (120 verificações)"
echo "════════════════════════════════════════════"

# Variáveis
COUNTER=0
MAX_CHECKS=120  # 1 hora = 3600 segundos / 30 segundos = 120 checks
START_TIME=$(date +%s)

while [ $COUNTER -lt $MAX_CHECKS ]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    MINUTES=$((ELAPSED / 60))
    REMAINING=$((60 - MINUTES))
    
    echo ""
    echo "⏱️ [$((COUNTER + 1))/120] - ${MINUTES}m decorridos | ${REMAINING}m restantes"
    echo "🔍 $(date '+%H:%M:%S')"
    
    # Extrair informações dos logs do bot
    if [ -f bot.log ]; then
        # Último ciclo
        LAST_CYCLE=$(tail -100 bot.log | grep -o "Ciclo: [0-9]*" | tail -1)
        
        # PnL atual
        CURRENT_PNL=$(tail -50 bot.log | grep "PnL Total:" | tail -1 | grep -o "PnL Total: [^|]*" | tail -1)
        
        # Preço mid atual
        MID_PRICE=$(tail -50 bot.log | grep "Mid Price:" | tail -1 | grep -o "Mid Price: [0-9]*\.[0-9]*" | tail -1)
        
        # Tendência atual
        TREND=$(tail -50 bot.log | grep "Tendência:" | tail -1 | grep -o "Tendência: [^|]*" | tail -1)
        
        # Ordens ativas
        ACTIVE_ORDERS=$(tail -50 bot.log | grep "Ordens Ativas:" | tail -1 | grep -o "Ordens Ativas: [0-9]*" | tail -1)
        
        # Taxa de fill
        FILL_RATE=$(tail -50 bot.log | grep "Taxa de Fill:" | tail -1 | grep -o "Taxa de Fill: [^|]*" | tail -1)
        
        # Convicção
        CONVICTION=$(tail -50 bot.log | grep "Convicção:" | tail -1 | grep -o "Convicção: [0-9]*\.[0-9]*%" | tail -1)
        
        echo "📈 ${LAST_CYCLE:-Aguardando...}"
        echo "💰 ${CURRENT_PNL:-Aguardando PnL...}"
        echo "🏷️ ${MID_PRICE:-Aguardando preço...}"
        echo "📊 ${TREND:-Aguardando tendência...}"
        echo "📋 ${ACTIVE_ORDERS:-Aguardando ordens...}"
        echo "🎯 ${FILL_RATE:-Aguardando taxa...}"
        echo "🔥 ${CONVICTION:-Aguardando convicção...}"
        
        # Verificar se houve fills
        NEW_FILLS=$(tail -20 bot.log | grep -c "EXECUTADO\|executada\|FILL")
        if [ "$NEW_FILLS" -gt 0 ]; then
            echo "🚨 $NEW_FILLS FILLS detectados nos últimos logs!"
            tail -10 bot.log | grep -E "EXECUTADO|executada|FILL" | tail -3
        fi
        
        # Verificar erros recentes
        RECENT_ERRORS=$(tail -50 bot.log | grep -c "ERROR\|ERRO")
        if [ "$RECENT_ERRORS" -gt 0 ]; then
            echo "⚠️ $RECENT_ERRORS erros detectados nos últimos logs!"
        fi
        
    else
        echo "❌ Arquivo bot.log não encontrado"
    fi
    
    echo "────────────────────────────────────────────"
    
    # Incrementar contador
    COUNTER=$((COUNTER + 1))
    
    # Aguardar 30 segundos antes da próxima verificação
    if [ $COUNTER -lt $MAX_CHECKS ]; then
        sleep 30
    fi
done

echo ""
echo "🏁 MONITORAMENTO CONCLUÍDO!"
echo "⏰ Fim: $(date)"
echo "📊 Total de verificações: 120"
echo "⏱️ Duração: 1 hora"
echo "════════════════════════════════════════════"

# Resumo final
echo ""
echo "📋 RESUMO FINAL:"
if [ -f bot.log ]; then
    echo "🔄 Total de ciclos executados:"
    grep -o "Ciclo: [0-9]*" bot.log | tail -1
    
    echo "💰 PnL final:"
    grep "PnL Total:" bot.log | tail -1 | grep -o "PnL Total: [^|]*"
    
    echo "📈 Fills totais:"
    grep -c "EXECUTADO\|executada\|FILL" bot.log || echo "0 fills"
    
    echo "⚠️ Erros totais:"
    grep -c "ERROR\|ERRO" bot.log || echo "0 erros"
fi
echo "📊 Dashboard: http://localhost:3001"
echo "💰 TRADING REAL ATIVO!"
echo "============================================"

# Iniciar bot+dashboard
npm run start > session_1h.log 2>&1 &
BOT_PID=$!
echo "Bot PID: $BOT_PID" | tee bot_current.pid
sleep 5

# Função de validação
validate_calculations() {
    echo ""
    echo "=== VALIDAÇÃO $(TZ='America/Sao_Paulo' date) ==="
    
    # PnL Validation
    echo "📊 Validando PnL..."
    npm run validate-pnl 2>/dev/null || echo "⚠️  Erro na validação PnL"
    
    # Stats recentes
    echo "📈 Estatísticas últimas 1h..."
    npm run stats:live 2>/dev/null || echo "⚠️  Erro nas stats"
    
    # Ordens recentes
    echo "🔄 Últimas ordens..."
    npm run orders 2>/dev/null | head -5 || echo "⚠️  Erro nas ordens"
    
    # Log tail
    echo "📝 Últimos logs:"
    tail -10 session_1h.log | grep -E "(SUCCESS|ERROR|ALERT|WARN)" | tail -3
    
    echo "============================================"
}

# Monitoramento em intervalos
start_time=$(date +%s)
end_time=$((start_time + 3600)) # 1 hora

validation_count=1
while [ $(date +%s) -lt $end_time ]; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    remaining=$((end_time - current_time))
    
    echo ""
    echo "⏰ Tempo decorrido: $((elapsed/60))min | Restante: $((remaining/60))min"
    
    # Validar a cada 10 minutos
    if [ $((elapsed % 600)) -eq 0 ] && [ $elapsed -gt 0 ]; then
        echo ""
        echo "🔍 VALIDAÇÃO #$validation_count"
        validate_calculations
        validation_count=$((validation_count + 1))
    fi
    
    # Verificar se processo ainda está rodando
    if ! kill -0 $BOT_PID 2>/dev/null; then
        echo "❌ Bot parou! Reiniciando..."
        npm run start > session_1h.log 2>&1 &
        BOT_PID=$!
        echo "Bot PID: $BOT_PID" | tee bot_current.pid
    fi
    
    sleep 30
done

echo ""
echo "🏁 MONITORAMENTO 1 HORA CONCLUÍDO!"
echo "⏰ Fim: $(TZ='America/Sao_Paulo' date)"
validate_calculations

# Matar processo
kill $BOT_PID 2>/dev/null
wait $BOT_PID 2>/dev/null

echo "✅ Processo encerrado com segurança"
echo "📄 Logs salvos em: session_1h.log"