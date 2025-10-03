# 🦙 **MB Bot** - Market Making Framework

[![Node.js](https://img.shields.io/badge/Node.js-v18+-brightgreen.svg)](https://nodejs.org/)
[![License:
MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Simulation](https://img.shields.io/badge/Mode-SIMULATE-blue.svg)](https://github.com/yourusername/mb-bot)
[![Production
Ready](https://img.shields.io/badge/Status-PRODUCTION%20READY-green.svg)](https://github.com/yourusername/mb-bot)

**MB Bot** é um bot profissional de *market making* para o **Mercado
Bitcoin**, com **modo simulação**, **dashboard** e **execução em
produção**.

⚠️ **Aviso**: Trading envolve risco. Sempre rode testes em modo
**SIMULATE** antes de operar ao vivo.

------------------------------------------------------------------------

## 🚀 **Quick Start**

### **Instalação**

``` bash
git clone https://github.com/yourusername/mb-bot.git
cd mb-bot
npm install
cp .env.example .env  # Edite o .env - mantenha SIMULATE=true
npm run setup
```

### **Rodar Simulação**

``` bash
npm run simulate      # Somente o bot
npm run dev           # Bot + Dashboard
npm run dashboard     # Apenas Dashboard
```

### **Acessar o Dashboard**

🌐 Local: <http://localhost:3001>\
📱 Mobile: http://SEU-PC:3001

------------------------------------------------------------------------

## ⚙️ **Configuração (.env)**

``` env
# Mercado Bitcoin API
REST_BASE=https://api.mercadobitcoin.net/api/v4
PAIR=BTC-BRL
API_KEY=your_api_token
API_SECRET=your_api_secret

# Trading Mode
SIMULATE=true  # false para LIVE trading

# Trading Parameters
SPREAD_PCT=0.002      # Spread alvo: 0.2%
ORDER_SIZE=0.0001     # Tamanho de ordem: 0.0001 BTC
CYCLE_SEC=5           # Intervalo: 5s
PRICE_TOLERANCE=0.001 # 0.1% tolerância de preço

# Dashboard
PORT=3001
RATE_LIMIT_PER_SEC=3  # Limite de requisições API
```

------------------------------------------------------------------------

## 📊 **Performance Esperada**

  -----------------------------------------------------------------------------------
  Métrica        Simulação    Live         Observação
  -------------- ------------ ------------ ------------------------------------------
  Fill Rate      10-15%       8-12%        Por ciclo de 5s

  Spread         0.20%        0.15-0.25%   \~R$1.20 por round-trip | | P&L/dia | R$
                                           416

  ROI/dia        4.16%        3.12%        Sobre capital de R\$10k
  -----------------------------------------------------------------------------------

### Projeção 24h

  Métrica   Valor        Cálculo
  --------- ------------ -------------------
  Ciclos    17.280       5s × 86.400s
  Ordens    34.560       2 por ciclo
  Fills     3.456        10% taxa
  Volume    0.3456 BTC   3.456 × 0.0001
  P&L       R\$ 416      0.3456 × R\$1.206

------------------------------------------------------------------------

## 🛠️ **Comandos**

  Comando             Descrição
  ------------------- ------------------------------
  npm run simulate    Rodar em modo simulação
  npm run dev         Bot + Dashboard (dev)
  npm run live        Trading em produção
  npm run dashboard   Apenas UI web
  npm run stats       Estatísticas das últimas 24h
  npm run test        Executa testes
  npm run clean       Limpa banco/cache

------------------------------------------------------------------------

## 📱 **Acesso Mobile**

``` bash
# Descobrir IP
ip route get 1 | awk '{print $7}'
# Exemplo: 192.168.1.100

# URL no celular
http://192.168.1.100:3001
```

------------------------------------------------------------------------

## 🛡️ **Checklist de Segurança**

### API Keys

-   Apenas permissão de **TRADE**\
-   **Sem permissão de saque**\
-   Restrição por IP\
-   Rotacionar a cada 90 dias

### Limites de Risco

-   ORDER_SIZE=0.00005 (comece pequeno)\
-   DAILY_LOSS_LIMIT=100 no .env\
-   Testar **24h em simulação** antes de rodar live

------------------------------------------------------------------------

## 🗄️ **Banco de Dados**

SQLite: `./database/orders.db`

### Queries úteis

``` sql
-- Últimas 20 ordens
SELECT * FROM orders ORDER BY timestamp DESC LIMIT 20;

-- P&L das últimas 24h
SELECT SUM(CASE WHEN side='buy' THEN -price*qty WHEN side='sell' THEN price*qty ELSE 0 END) 
FROM orders WHERE status='filled' AND timestamp > (strftime('%s','now','-1 day'));

-- Fill rate última hora
SELECT COUNT(*) as total, SUM(status='filled') as fills, 
       ROUND(SUM(status='filled')*100.0/COUNT(*), 2) as percent
FROM orders WHERE timestamp > (strftime('%s','now','-1 hour'));
```

------------------------------------------------------------------------

## 📱 **Dashboard**

  Seção         Mostra                       Atualização
  ------------- ---------------------------- -------------
  Market        BTC/BRL, bid/ask, spread     3s
  Balances      Saldos BRL/BTC               3s
  Performance   Ciclos, fills, P&L, uptime   3s
  Orders        Ordens abertas e status      3s
  Config        Spread, size, ciclo          Estático

------------------------------------------------------------------------

## 📋 **Testes de 24h (Preparação)**

``` bash
rm -f database/orders.db
echo "=== 24h Test Started: $(date)" > test-24h-report.txt
npm run test >> test-24h-report.txt  # Validação final

# Iniciar o bot em background
nohup npm run dev > test-24h-report.log 2>&1 &

echo "Test started - $(date)" >> test-24h-report.txt
echo "Log file: test-24h-report.log" >> test-24h-report.txt
echo "Bot PID: $!" >> test-24h-report.txt
echo "Check bot-24h.log for real-time logs" >> test-24h-report.txt
echo "Use 'kill $!' to stop the bot after 24h" >> test-24h-report.txt
echo "Waiting for 24 hours..." >> test-24h-report.txt
echo "=== End of Setup ===" >> test-24h-report.txt
```

### Logs filtrados

``` bash
tail -f bot-24h.log | grep -E "(cycle=|placed|filled|STATS|SUCCESS)"
```

### Stats a cada 10min

``` bash
watch -n 600 'npm run stats >> test-24h-report.txt'
```

### Crescimento do banco

``` bash
watch -n 1800 'ls -lh database/orders.db'
```

------------------------------------------------------------------------

## 🤝 **Contribuindo**

``` bash
# Clonar
git clone https://github.com/yourusername/mb-bot.git
cd mb-bot
npm install
npm run setup

# Desenvolvimento
npm run dev           # Bot + dashboard
npm run watch         # Auto-reload
npm run lint:fix      # Ajustar estilo

# Testes
npm test              # Unit tests
npm run test-client   # API tests
npm run backtest      # Estratégia
```

------------------------------------------------------------------------

## 📄 **Licença**

MIT License - Livre para uso comercial.

------------------------------------------------------------------------

## 📞 **Suporte**

-   Issues: GitHub Issues\
-   Discord: Comunidade\
-   Email: team@mb-bot.com

------------------------------------------------------------------------

📅 **Versão 1.0.0 - Production Ready - Setembro/2025**

ps aux | grep node
SIMULATE=false npm run dashboard
nohup npm run start > exec-25092025report.log 2>&1 &


Básico: node backtester.js path/to/candles.csv
Com testes: node backtester.js path/to/candles.csv --test (testa combinações de spread e size).

curl -v "https://api.mercadobitcoin.net/api/v4/candles?symbol=BTC-BRL&resolution=1m&from=1704067200&to=1706745600" > /mnt/c/PROJETOS_PESSOAIS/mb-bot/candles.json