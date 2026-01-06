#!/bin/bash

# Script para executar teste de 24h do MB Bot
# Autor: MB Bot Team
# Data: $(date)

echo "==================================="
echo "MB Bot - Teste de 24 Horas"
echo "==================================="
echo ""
echo "Iniciando em: $(date)"
echo ""

# Limpar banco de dados anterior
echo "Limpando banco de dados anterior..."
rm -f database/orders.db
npm run migrate

# Criar arquivo de log
LOG_FILE="test-24h-$(date +%Y%m%d-%H%M%S).log"
echo "Log será salvo em: $LOG_FILE"
echo ""

# Iniciar o bot em background
echo "Iniciando bot em modo simulação..."
nohup npm run dev > "$LOG_FILE" 2>&1 &
BOT_PID=$!

echo "Bot iniciado com PID: $BOT_PID"
echo "Dashboard disponível em: http://localhost:3001"
echo ""
echo "Para acompanhar os logs em tempo real:"
echo "  tail -f $LOG_FILE"
echo ""
echo "Para ver estatísticas:"
echo "  npm run stats"
echo ""
echo "Para parar o bot:"
echo "  kill $BOT_PID"
echo ""
echo "Teste rodará por 24 horas..."
echo "Verifique os resultados após esse período."
echo ""
echo "==================================="
