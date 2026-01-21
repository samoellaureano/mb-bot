# 📋 GUIA DE MONITORAMENTO - BOT EM LIVE

**Status:** ✅ Sistema Validado e Operacional  
**Data:** 14 de Janeiro de 2026

---

## 🎯 O Que Foidhfgjdhf Alcançado

✅ **Ordens e Pares Sincronizados**
- Bot criando pares BUY+SELL em modo LIVE
- Dashboard mostrando dados em tempo real
- Banco de dados persistindo ordens com correlação

✅ **Indicadores de Execução**
- ⏳ AGUARDANDO: Pares com ambas ordens abertas
- ✅ EXECUTADAS: Quando uma ordem é preenchida
- ✅ CICLO COMPLETO: Quando ambas são preenchidas

✅ **Acesso ao Dashboard**
- URL: `http://localhost:3001`
- Mostra pares ativos com espread e ROI
- Exibe métricas de performance em tempo real

---

## 📊 Como Monitorar o Sistema

### 1. Dashboard Web (Recomendado)
```
http://localhost:3001
```
- Abra em seu navegador
- Veja pares, ordens e performance em tempo real
- Sem necessidade de reiniciar o bot

### 2. Logs do Bot
```bash
# Ver logs em tempo real
tail -f /tmp/bot_live_test.log

# Ver últimas 50 linhas
tail -50 /tmp/bot_live_test.log

# Procurar por erros
grep ERROR /tmp/bot_live_test.log
```

### 3. Banco de Dados
```bash
# Ver todas as ordens
sqlite3 ./database/orders.db "SELECT id, side, price, status FROM orders;"

# Ver ordens ativas (status='open')
sqlite3 ./database/orders.db "SELECT COUNT(*), side FROM orders WHERE status='open' GROUP BY side;"

# Ver ordens por pair_id
sqlite3 ./database/orders.db "SELECT pair_id, side, status FROM orders WHERE pair_id IS NOT NULL;"
```

### 4. API Endpoints

#### Health Check
```bash
curl http://localhost:3001/api/health
```
Retorna: Status, Modo (LIVE), Uptime, Requisições

#### Dados de Mercado e Performance
```bash
curl http://localhost:3001/api/data | python3 -m json.tool
```
Retorna: Ordens ativas, preços, PnL, volatilidade, RSI

#### Pares com Indicadores
```bash
curl http://localhost:3001/api/pairs | python3 -m json.tool
```
Retorna: Pares, spreads, indicadores de execução

---

## 🔍 O Que Observar

### ✅ Sinais Positivos
- [ ] Dashboard carrega sem erros
- [ ] `/api/data` retorna ordens e estatísticas
- [ ] `/api/pairs` mostra pares completos (BUY+SELL)
- [ ] Novos pares sendo criados a cada ciclo
- [ ] PnL crescendo ou mantendo estável
- [ ] Fill Rate acima de 5%
- [ ] Sem erros críticos nos logs

### ⚠️ Sinais de Alerta
- [ ] Dashboard não carrega (bot pode ter crashado)
- [ ] `/api/pairs` vazio (bot não criando pares)
- [ ] PnL negativos e decrescentes
- [ ] Muitos erros nos logs
- [ ] Volatilidade fora dos limites (>3%)
- [ ] Uptime resetando (bot reiniciando)

### 🔴 Sinais Críticos
- [ ] Bot parado (verificar: `ps aux | grep node`)
- [ ] Banco de dados corrompido
- [ ] Erro de autenticação com API
- [ ] Saldo insuficiente

---

## 🛠️ Procedimentos Comuns

### Reiniciar o Bot
```bash
# Parar
pkill -f "node bot.js"
sleep 2

# Iniciar em LIVE
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
SIMULATE=false node bot.js > /tmp/bot_live.log 2>&1 &
```

### Reiniciar o Dashboard
```bash
# Parar
pkill -f "node dashboard.js"
sleep 2

# Iniciar
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot
node dashboard.js > /tmp/dashboard.log 2>&1 &
```

### Limpar Banco e Começar Fresco
```bash
# ⚠️ CUIDADO: Apaga histórico de ordens
pkill -f "node bot.js"
rm -f ./database/orders.db*
SIMULATE=false node bot.js > /tmp/bot_live.log 2>&1 &
```

### Ver Processo do Bot
```bash
ps aux | grep "node bot.js" | grep -v grep
```

Deve retornar algo como:
```
samoel      9307  0.7  1.7 11782924 72156 pts/7  Sl   11:56   0:00 node bot.js
```

---

## 📈 Métricas Importantes

### Status do Mercado
- **Volatilidade:** Ideal 0,5-2% (muito baixo < pode não ter oportunidades)
- **RSI:** 30-70 neutro, <30 sobrevendido, >70 sobrecomprado
- **Spread Bid/Ask:** Mais apertado = melhor para MM

### Performance do Bot
- **Fill Rate:** % de ordens preenchidas (ideal >5%)
- **PnL:** Lucro/prejuízo acumulado
- **ROI:** Retorno sobre investimento
- **Spread:** Diferença entre BUY e SELL

### Saúde do Sistema
- **Uptime:** Tempo rodando sem parar
- **Ciclos:** Número de ciclos executados
- **Erro Rate:** Número de erros / ciclos

---

## 📞 Próximas Etapas

### Curto Prazo (Próxima 1 hora)
- [ ] Monitorar primeiro ciclo completo
- [ ] Verificar transição de indicadores
- [ ] Validar remoção de pares após ciclo

### Médio Prazo (Próximas 24 horas)
- [ ] Monitorar PnL acumulado
- [ ] Validar múltiplos pares simultâneos
- [ ] Testar recuperação de falhas

### Longo Prazo (Semana)
- [ ] Análise de performance vs baseline
- [ ] Otimização de parâmetros
- [ ] Monitoramento contínuo

---

## 🚨 Troubleshooting Rápido

### "Dashboard não carrega"
```bash
# 1. Verificar se está rodando
ps aux | grep dashboard

# 2. Se não, reiniciar
pkill -f "node dashboard.js"
node dashboard.js > /tmp/dashboard.log 2>&1 &
```

### "API retorna vazio"
```bash
# 1. Verificar se bot está rodando
ps aux | grep "node bot.js"

# 2. Checar logs
tail -20 /tmp/bot_live.log

# 3. Se necessário, reiniciar bot
pkill -f "node bot.js"
SIMULATE=false node bot.js > /tmp/bot_live.log 2>&1 &
```

### "Nenhum par sendo criado"
```bash
# 1. Checar saldo disponível
curl http://localhost:3001/api/data | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['balances'])"

# 2. Verificar configuração
cat .env | grep -E "SPREAD|ORDER_SIZE|MIN_VOLUME"

# 3. Ver logs do bot
grep -E "PAR|ORDEM|SPREAD" /tmp/bot_live.log | tail -20
```

---

## ℹ️ Informações Úteis

**Arquivo de Configuração:** `.env`  
**Banco de Dados:** `./database/orders.db`  
**Logs do Bot:** `/tmp/bot_live.log`  
**Logs do Dashboard:** `/tmp/dashboard.log`  

**PID do Bot:** `ps aux | grep "node bot.js"` (segunda coluna)  
**PID do Dashboard:** `ps aux | grep "node dashboard.js"` (segunda coluna)  

---

## 📚 Documentação Relacionada

- [VALIDACAO_LIVE_14JAN.md](VALIDACAO_LIVE_14JAN.md) - Detalhes da validação
- [bot.js](bot.js) - Código principal do bot
- [dashboard.js](dashboard.js) - Código do dashboard web
- [db.js](db.js) - Camada de banco de dados

---

**Status:** ✅ Sistema pronto para operação contínua  
**Último Update:** 14 de Janeiro de 2026
