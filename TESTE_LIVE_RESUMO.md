# 🎯 TESTE LIVE COMPLETO - Resumo de Execução

## ✅ O que foi Criado

### 1. **test_live_complete.js** - Script Principal de Teste
Executa validações automáticas a cada ciclo (30 segundos):

**Validações Implementadas:**
- ✅ **Preços**: Integridade, formato, variações extremas (máx 5%)
- ✅ **Spreads**: Dentro de limites MIN/MAX (1.2% até 2.0%)
- ✅ **Saldos**: BTC e BRL, validação de números finitos
- ✅ **Ordens**: Campos obrigatórios, status, preços válidos
- ✅ **Convicção**: Cálculo por ciclo, classificação de nível
- ✅ **Lucro**: Acompanhamento 24h, consistência
- ✅ **Dados**: Coleta de 50+ ciclos de dados

**Output:**
- Logs coloridos a cada ciclo
- Métricas em tempo real
- Erros e alertas capturados
- JSON final com estatísticas completas

---

### 2. **run_test_live.bat** (Windows)
Script batch que inicia tudo automaticamente:

```cmd
run_test_live.bat
```

**Faz:**
1. ✓ Verifica SIMULATE=false no .env
2. ✓ Inicia Bot em janela nova
3. ✓ Inicia Dashboard em janela nova
4. ✓ Inicia Teste em janela nova
5. ✓ Aguarda até 20:30
6. ✓ Gera relatório JSON

---

### 3. **run_test_live.sh** (Linux/Mac)
Script bash com mesma funcionalidade

```bash
chmod +x run_test_live.sh
./run_test_live.sh
```

---

### 4. **monitor_live.js** - Dashboard em Terminal
Monitor interativo que atualiza a cada 2 segundos:

```bash
npm run test:live -- --monitor
# ou
node monitor_live.js
```

**Exibe:**
- Relógio com contagem regressiva até 20:30
- Tempo decorrido desde início
- Últimas métricas do bot
- Link direto pro dashboard web (porta 3001)
- Arquivos de log gerados
- Instruções de monitoramento
- Alertas críticos

---

### 5. **GUIA_TESTE_LIVE.md** - Documentação Completa
Guia passo a passo com:
- Instruções para Windows, Linux, Mac
- Pré-requisitos
- Como personalizar
- Troubleshooting
- Métricas esperadas
- Próximos passos

---

## 🚀 Como Usar

### **Opção 1: Automática (Recomendado para Windows)**
```cmd
run_test_live.bat
```
⏱️ Tudo roda sozinho em 3 janelas até 20:30

---

### **Opção 2: Manual (Controle Total)**

**Terminal 1 - Bot:**
```bash
npm run live
```

**Terminal 2 - Dashboard:**
```bash
npm run dashboard
```

**Terminal 3 - Teste:**
```bash
npm run test:live
```

**Terminal 4 (opcional) - Monitor:**
```bash
node monitor_live.js
```

---

### **Opção 3: Simulação (Teste rápido)**
```bash
npm run test:live -- --simulate
```
Executa teste com dados simulados (não precisa de bot rodando)

---

## 📊 Monitorar em Tempo Real

### 🌐 Dashboard Web
- **URL:** http://localhost:3001
- **Atualiza:** A cada 3 segundos
- **Mostra:** Preços, Ordens, Saldos, PnL, **NOVO: Convicção**

### 📊 Terminal (se rodar monitor_live.js)
```
⏱️  STATUS TEMPORAL:
  Hora atual: 19:45:30
  Hora de término: 20:30:00
  Tempo decorrido: 45m 30s
  Tempo restante: 45m 00s

📊 MÉTRICAS BOT:
  Ciclo 87: Convicção 72.5%, Lucro R$ +45.32

📈 ACESSO AO DASHBOARD:
  http://localhost:3001
```

### 📝 Logs em Arquivo
```
logs/
  bot_20250112_145030.log
  dashboard_20250112_145030.log
  teste_20250112_145030.log
```

---

## 📈 O Que Esperar

### ✅ Ciclo Bem-Sucedido
```
[20:15:30] [OK] Saldos validados: 0.00043691 BTC | R$ 0.07
[20:15:30] [INFO] Convicção: 72.5% (STRONG) → Tamanho: 75%
[20:15:30] [OK] Ordens validadas: 3 abertas, 15 executadas
[20:15:30] [OK] Lucro 24h: +R$ 45.32
```

### 🚨 Alertas Esperados (se houver volatilidade)
```
[20:16:00] [ALERTA] VARIAÇÃO_EXTREMA: 4.2% em 30s
[20:16:30] [ALERTA] SALDO_BTC_SUSPEITO: 10.5 BTC
```

### ❌ Erros Críticos (se houver)
```
[20:17:00] [ERRO] PREÇO_INVÁLIDO: -100.50
[20:17:30] [ERRO] FALHA_CONEXÃO_API
```

---

## 📋 Relatório Final (20:30)

Após término, arquivo **`teste_live_YYYY-MM-DDTHH-mm-ss.json`** contém:

```json
{
  "cyclesExecutados": 145,
  "ordensAbiertas": 2,
  "ordensExecutadas": 18,
  "lucroTotal": 45.32,
  "saldoBTC": 0.00043691,
  "saldoBRL": 0.07,
  "conviccaoMedia": 62.5,
  
  "conviccoesPorNivel": {
    "VERY_STRONG": 22,   // >= 80%
    "STRONG": 35,        // 70-80%
    "MODERATE": 52,      // 60-70%
    "WEAK": 28,          // 50-60%
    "VERY_WEAK": 8       // < 50%
  },
  
  "validacoes": {
    "saldosConsistentes": true,
    "conviccãoCalculada": true,
    "ordensCorretas": true,
    "lucroAcompanhado": true,
    "preçosValidos": true
  },
  
  "errosCálculo": [],    // Deve estar vazio se tudo OK
  "alertas": []          // Pode ter alguns alertas normais
}
```

**Status Final:**
```
✅ TESTE APROVADO
Validações aprovadas: 5/5
```

---

## 🎯 Métricas de Sucesso

| Métrica | Mínimo Aceitável | Excelente |
|---------|-----------------|-----------|
| Ciclos Executados | > 50 | > 120 |
| Validações Passando | 4/5 | 5/5 |
| Convicção Média | > 50% | 60-75% |
| Erros de Cálculo | 0 | 0 |
| Preços Válidos | 100% | 100% |
| Saldos Consistentes | Sim | Sim |

---

## ⚙️ Customizações Rápidas

### Mudar Hora de Término
Edite `test_live_complete.js`:
```javascript
const ALVO_TERMINO = '18:00:00';  // 18h em vez de 20h30
```

### Aumentar Frequência de Validação
```javascript
await aguardar(15000);  // 15s em vez de 30s
```

### Alterar Ciclo do Bot
Edite `.env`:
```env
CYCLE_SEC=15  # Mais rápido (padrão 30)
```

---

## 🆘 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "SIMULATE não está em false" | Edite `.env`: `SIMULATE=false` |
| "npm: command not found" | Instale: `npm install` |
| "Port 3001 already in use" | Feche outro dashboard ou altere porta |
| "Cannot find module db.js" | Verifique se está na pasta raiz |
| "API connection failed" | Verifique credenciais em `.env` |

---

## 📞 Próximos Passos

1. **Rodar Teste**
   ```cmd
   run_test_live.bat
   ```

2. **Monitorar Dashboard**
   ```
   http://localhost:3001
   ```

3. **Analisar Relatório**
   ```bash
   cat teste_live_*.json
   ```

4. **Validar Convicção**
   ```bash
   npm run test:conviction
   ```

5. **Ajustar Parâmetros** se necessário em `.env`

6. **Rodar Novamente** com ajustes

---

## 📚 Scripts Úteis

```bash
# Rodar teste (ativa loop até 20:30)
npm run test:live

# Monitorar em terminal
node monitor_live.js

# Testar sistema de convicção isolado
npm run test:conviction

# Analisar histórico de correlação
npm run test:analyzer

# Ver exemplos práticos
npm run test:examples

# Limpar e resincronizar dados
node clean_and_sync.js
```

---

## ✨ Recursos Novos Integrados

1. **Sistema de Convicção Aprimorado**
   - Analisa 6 indicadores em harmonia
   - Ajusta tamanho de ordem dinamicamente
   - Detecta divergências
   
2. **Motor de Decisão**
   - Combina análise interna + externa
   - Aplica 6 regras de segurança
   - Bloqueia trades muito arriscadas

3. **Validação de Dados**
   - Sincroniza banco com API
   - Valida integridade de valores
   - Rastreia PnL em tempo real

4. **Monitoramento Robusto**
   - Dashboard em tempo real
   - Logs estruturados
   - Alertas automáticos

---

## 🎬 Começando

```bash
# Windows
run_test_live.bat

# Linux/Mac
./run_test_live.sh

# Manual (qualquer SO)
npm run live &
npm run dashboard &
npm run test:live
```

**Teste agora até 20:30 e valide todos os valores! 🚀**
