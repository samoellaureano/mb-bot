#!/bin/bash

# Script de monitoramento e validação 1 hora
# Execução: ./monitor_1h.sh

cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

echo "🇧🇷 MONITORAMENTO 1 HORA - BOT TRADING REAL"
echo "⏰ Início: $(TZ='America/Sao_Paulo' date)"
echo "⏰ Fim previsto: $(TZ='America/Sao_Paulo' date -d '+1 hour')"
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