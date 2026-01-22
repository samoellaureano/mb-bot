# 📈 Guia de Monitoramento de Sinais e Ordens - v1.9

## Verificação Rápida em 30 segundos

```bash
# 1. Bot rodando?
ps aux | grep "node bot" | grep -v grep && echo "✅ Bot rodando" || echo "❌ Bot parado"

# 2. Últimas ordens?
sqlite3 database/orders.db "SELECT side, COUNT(*) FROM orders WHERE timestamp > datetime('now', '-1 hour') GROUP BY side;" 

# 3. PnL atual?
curl -s http://localhost:3001/api/data 2>/dev/null | grep -o '"totalPnL":[^,]*'

# 4. Ciclos executados?
curl -s http://localhost:3001/api/data 2>/dev/null | grep -o '"cycles":[^,]*'
```

---

## Monitoramento Contínuo

### Setup 1: Monitorar Sinais v1.9

```bash
# Terminal 1: Sinais da estratégia
tail -100 bot.log | grep -E "\[CASH_MGT\]|Compra|Venda|queda|alta"

# Ver resultado:
# [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...
# [CASH_MGT_BUY] Queda de X% - COMPRA
# [CASH_MGT_SELL] Alta de X% - VENDA
```

### Setup 2: Dashboard em Tempo Real

```bash
# Abrir no navegador:
open http://localhost:3001
# Ou no Windows:
start http://localhost:3001
```

**O que procurar:**
- Gráfico de preços se move?
- Lista de ordens se atualiza?
- PnL muda cor (red/green)?

### Setup 3: Monitorar Ciclos

```bash
# Terminal 2: Mostrar ciclos a cada 5s
watch -n 5 'tail -5 bot.log | grep -o "Ciclo [0-9]*"'

# Esperado:
# Ciclo 200
# Ciclo 201
# Ciclo 202
```

### Setup 4: Validar Preços

```bash
# Terminal 3: Ver preço e sinais
watch -n 10 'curl -s http://localhost:3001/api/data | grep -o "\"last\":[^,]*\|\"bid\":[^,]*\|\"ask\":[^,]*"'
```

---

## Checklist de Validação Diária

### ✅ Manhã (Iniciar bot)

```bash
# 1. Verificar sintaxe
node -c bot.js && echo "✅ Sintaxe OK" || echo "❌ Erro de sintaxe"

# 2. Verificar configuração
grep "USE_CASH_MANAGEMENT" .env

# 3. Iniciar bot
npm run live

# 4. Aguardar 30s e verificar logs
sleep 30 && tail -20 bot.log | grep "CASH_MANAGEMENT"
```

### ✅ Meio-dia (Monitorar sinais)

```bash
# 1. Ciclos executados?
curl -s http://localhost:3001/api/data 2>/dev/null | grep cycles

# 2. Ordens colocadas?
sqlite3 database/orders.db "SELECT COUNT(*) FROM orders WHERE timestamp > datetime('now', '-2 hours');"

# 3. PnL mudou?
sqlite3 database/orders.db "SELECT ROUND(SUM(CASE WHEN side='sell' THEN qty*price ELSE -qty*price END), 2) FROM orders WHERE status='filled';"
```

### ✅ Noite (Análise de desempenho)

```bash
# 1. Relatório de PnL
node validate_strategy.js

# 2. Verificar sinais foram gerados
grep "CASH_MGT" bot.log | wc -l

# 3. Ordens colocadas vs fills
sqlite3 database/orders.db "SELECT COUNT(*) as total, COUNT(CASE WHEN status='filled' THEN 1 END) as filled FROM orders WHERE timestamp > datetime('now', '-24 hours');"
```

---

## Sinais de Alerta

### 🚨 Se Não Há Ordens por 30 minutos

**Causa provável:** Mercado neutro, sem movimento > 0.02%

**Ação:**
```bash
# 1. Verificar se bot está rodando
ps aux | grep node

# 2. Verificar logs
tail -50 bot.log | grep -i "cash_mgt\|erro\|alert"

# 3. Se há erro, reiniciar
npm run live
```

### 🚨 Se PnL está muito negativo (< -2.0)

**Possível causa:** Vendendo mais barato do que comprou

**Ação:**
```bash
# 1. Analisar últimas trades
sqlite3 database/orders.db "
SELECT side, price, qty FROM orders WHERE status='filled' 
ORDER BY timestamp DESC LIMIT 20;"

# 2. Calcular média
sqlite3 database/orders.db "
SELECT side, ROUND(AVG(price), 2) as preco_medio
FROM orders WHERE status='filled'
GROUP BY side;"

# 3. Se SELL < BUY: ajustar thresholds (aumentar SELL_THRESHOLD)
```

### 🚨 Se Sem Atualização de Ciclos

**Possível causa:** Bot travado ou desconectado

**Ação:**
```bash
# 1. Parar bot
npm stop

# 2. Reiniciar
npm run live

# 3. Verificar autenticação
grep "Authorization OK" bot.log
```

---

## Otimizações Recomendadas

### Se Muitos Cancelamentos (> 50% de ordens)

**Reduzir:**
```bash
# .env
MAX_ORDER_AGE=1800         # Aumentar para 2400 (40min)
SPREAD_PCT=0.035          # Aumentar para 0.045
```

### Se Muito Poucas Ordens (< 5 por dia)

**Aumentar sensibilidade:**
```bash
# .env - Reduzir thresholds ainda mais
BUY_THRESHOLD=0.015       # de 0.02
SELL_THRESHOLD=0.02       # de 0.025
```

### Se PnL Melhorando Mas Lento

**Aumentar agressividade:**
```bash
# .env
BUY_AMOUNT_PCT=0.70       # de 0.60 (mais compra)
SELL_MICRO_PCT=0.70       # de 0.60 (mais venda)
MICRO_TRADE_INTERVAL=1    # de 2 (mais frequente)
```

---

## Formato de Log Esperado

```
✅ ESPERADO (Bot funcionando):
[INFO] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...
[DEBUG] [CASH_MGT] Sem sinal de compra (queda insuficiente)
[DEBUG] [CASH_MGT] Sem sinal de venda (sem BTC)

❌ NÃO ESPERADO (Problema):
[ERROR] Falha ao autenticar
[ERROR] Connectiontimeout
[ERROR] Orderbook inválido
[ALERT] Saldo muito baixo
```

---

## Comandos Úteis

```bash
# Ver últimas 100 linhas de log com filtro
tail -100 bot.log | grep "CASH_MGT"

# Contar quantas vezes estratégia foi avaliada
grep -c "CASH_MGT" bot.log

# Ver ordens dos últimos 24h
sqlite3 database/orders.db "
SELECT side, COUNT(*), ROUND(AVG(price), 2)
FROM orders
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY side;"

# Validar estratégia
node validate_strategy.js

# Ver status do bot
curl -s http://localhost:3001/api/data | grep -o '"mode":[^,]*'

# Monitorar em tempo real
watch -n 5 'node validate_strategy.js | tail -20'
```

---

## Validação Semanal

```bash
# Segunda (Reset semanal):
1. Revisar PnL da semana anterior
2. Verificar se thresholds ainda fazem sentido
3. Backup do banco de dados
   cp database/orders.db database/orders.backup.$(date +%Y%m%d).db

# Quarta (Ajustes se necessário):
1. Analisar histórico de fills
2. Se PnL < -1% → aumentar SELL_THRESHOLD
3. Se PnL > 0% → manter configuração

# Sexta (Preparar para semana):
1. Verificar capital disponível
2. Se < R$ 100 → considerar depositar mais
3. Listar ajustes recomendados
```

---

## Escalada de Problemas

### Nível 1: Sem Ordens por 1h
```bash
# Ação: Verificar sinais manualmente
grep "CASH_MGT" bot.log | tail -20
```

### Nível 2: PnL < -2.0 por 4h
```bash
# Ação: Aumentar thresholds
BUY_THRESHOLD=0.025
SELL_THRESHOLD=0.03
npm run live  # Reiniciar
```

### Nível 3: Sem atualização de ciclos por 10min
```bash
# Ação: Reiniciar bot
npm stop
npm run live
```

### Nível 4: Erro de autenticação
```bash
# Ação: Verificar credenciais
grep "API_KEY\|API_SECRET" .env
# Se errado, atualizar e reiniciar
npm run live
```

---

## Checklist Inicial

Antes de deixar bot rodando sozinho:

- [ ] Bot rodando com `npm run live`
- [ ] USE_CASH_MANAGEMENT=true em .env
- [ ] Dashboard acessível em http://localhost:3001
- [ ] Sinais sendo gerados (log mostra `[CASH_MGT]`)
- [ ] Capital inicial confirmado (R$ 220.00 ou mais)
- [ ] Thresholds v1.9 aplicados (verificar log)
- [ ] Últimas ordens mostram BUY/SELL alternados
- [ ] Nenhum erro em bot.log
- [ ] Banco de dados inicializado (database/orders.db existe)

---

**Última Atualização:** 22/01/2026  
**Versão:** 1.9 PROFIT OPTIMIZED  
**Status:** ✅ OPERACIONAL

