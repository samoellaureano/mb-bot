# 🚀 Guia: Teste Live Completo até 20h30

## 📋 O que será testado

O teste automatizado **valida em tempo real**:

✅ **Valores e Cálculos:**
- Preços (integridade, variações extremas)
- Spreads (dentro de limites MIN/MAX)
- Saldos BTC e BRL (formato e validade)
- Ordens (campos, status, preços)

✅ **Convicção (Conviction System):**
- Cálculo de convicção a cada ciclo (0-100%)
- Classificação de nível (VERY_STRONG até VERY_WEAK)
- Impacto no tamanho de ordem dinâmico

✅ **Lucro e Saldo:**
- Acompanhamento de lucro em tempo real
- Validação de saldos com API
- Consistência entre ciclos

✅ **Bot e Dashboard:**
- Execução contínua do bot (LIVE mode)
- Dashboard acessível em http://localhost:3001
- Logs de todas as operações

---

## 🎯 Como Rodar (Escolha sua plataforma)

### 🔵 Windows (CMD)
```bash
# Abrir terminal na pasta do projeto e executar:
run_test_live.bat
```

**O que acontece:**
1. Verifica se SIMULATE=false no .env
2. Inicia Bot (janela nova)
3. Inicia Dashboard (janela nova)
4. Inicia Teste de Validação (janela nova)
5. Teste executa automaticamente até 20:30
6. Gera relatório final em JSON

---

### 🟢 Linux/Mac (Bash)
```bash
# Dar permissão e executar:
chmod +x run_test_live.sh
./run_test_live.sh
```

---

### ⚫ Execução Manual (Qualquer SO)

Se preferir executar cada parte separadamente:

**Terminal 1 - Bot (LIVE):**
```bash
npm run live
# ou
npm run live:log  # Salva logs em exec-live.log
```

**Terminal 2 - Dashboard:**
```bash
npm run dashboard
# ou
npm run dashboard:log  # Salva logs em exec-dashboard.log
```

**Terminal 3 - Teste de Validação:**
```bash
npm run test:live
```

---

## 📊 Monitoramento em Tempo Real

Enquanto o teste roda:

### 🌐 Dashboard Web (http://localhost:3001)
- Gráfico de preços em tempo real
- Saldos BTC/BRL atualizados
- PnL 24h em destaque
- Últimas operações
- **NOVO:** Métricas de Convicção

### 📝 Logs no Terminal
Cada ciclo exibe:
```
[20:15:30] [OK] Saldos validados: 0.00043691 BTC | R$ 0.07
[20:15:30] [INFO] Convicção: 72.5% (STRONG) → Tamanho: 75%
[20:15:30] [OK] Lucro 24h: +R$ 45.32
[20:15:31] [INFO] Próximo ciclo em 30 segundos...
```

### 📁 Logs em Arquivo
Salvo em `logs/`:
- `bot_*.log` - Execução do bot
- `dashboard_*.log` - Execução do dashboard
- `teste_*.log` - Validações em tempo real

---

## 📈 Relatório Final

Após terminar em 20:30, será gerado:

**`teste_live_YYYY-MM-DDTHH-mm-ss.json`**

Contém:
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
    "VERY_STRONG": 22,
    "STRONG": 35,
    "MODERATE": 52,
    "WEAK": 28,
    "VERY_WEAK": 8
  },
  "validacoes": {
    "saldosConsistentes": true,
    "conviccãoCalculada": true,
    "ordensCorretas": true,
    "lucroAcompanhado": true,
    "preçosValidos": true
  },
  "errosCálculo": [],
  "alertas": []
}
```

---

## ⚠️ Pré-requisitos

1. **Bot configurado em LIVE**
   ```env
   SIMULATE=false
   ```

2. **Credenciais API ativas**
   ```env
   API_KEY=seu_api_key
   API_SECRET=seu_api_secret
   ```

3. **Database limpo** (executado no início)
   ```bash
   node clean_and_sync.js
   ```

4. **Node.js 16+**
   ```bash
   node --version  # v16.0.0+
   npm --version   # v7.0.0+
   ```

---

## 🔧 Personalizar o Teste

Se quiser alterar horário de término, edite `test_live_complete.js`:

```javascript
const ALVO_TERMINO = '20:30:00';  // Altere aqui
```

Formatos suportados: `HH:mm:ss` (24h)
- `'20:30:00'` - 20h30
- `'18:00:00'` - 18h00
- `'23:59:59'` - 23h59

---

## ✅ Validações Esperadas

Ao fim do teste, você verá algo como:

```
✅ VALIDAÇÕES:
  Saldos consistentes: ✓
  Convicção calculada: ✓
  Ordens corretas: ✓
  Lucro acompanhado: ✓
  Preços válidos: ✓

🏁 STATUS FINAL:
  ✓ TESTE APROVADO
  Validações aprovadas: 5/5
```

---

## 🆘 Troubleshooting

### ❌ "SIMULATE não está em false"
**Solução:** Edite `.env`
```env
SIMULATE=false  # Mudar de true para false
```

### ❌ "npm: command not found"
**Solução:** Instale dependências
```bash
npm install
```

### ❌ "Falha ao conectar com API"
**Solução:** Verifique credenciais em `.env`
```bash
node test-client.js  # Teste conexão
```

### ❌ "Port 3001 already in use"
**Solução:** Feche outro dashboard ou use porta diferente
```javascript
// Em dashboard.js, altere:
const PORT = 3002;  // Usar porta diferente
```

### ❌ "Database locked"
**Solução:** Feche outro processo que acessa DB
```bash
npm run clean:db  # Limpar banco se necessário
```

---

## 📊 O que Monitorar

### 🎯 Métricas de Sucesso
| Métrica | Esperado | ⚠️ Alerta |
|---------|----------|----------|
| Convicção Média | 60-75% | < 50% |
| Ciclos Executados | > 100 | < 20 |
| Erros de Cálculo | 0 | > 5 |
| Taxa de Fill | > 20% | < 5% |
| PnL Ciclo | R$ ±5 | < -10 |

### 🚨 Alertas Críticos
- Preço varia > 5% em 30s
- Spread fora de limites MIN/MAX
- Saldo BTC/BRL inconsistente
- Ordem com preço ≤ 0
- Convicção < 40% por 3+ ciclos

---

## 📞 Próximos Passos

Após o teste:

1. **Analisar Relatório**
   ```bash
   # Ler arquivo JSON gerado
   cat teste_live_*.json
   ```

2. **Verificar Correlação de Convicção**
   ```bash
   npm run test:analyzer
   ```

3. **Ajustar Parâmetros** se necessário
   ```env
   SPREAD_PCT=0.015  # Alterar spreads
   ORDER_SIZE=0.001  # Alterar tamanho de ordem
   ```

4. **Rodar Novamente** com ajustes
   ```bash
   run_test_live.bat
   ```

---

## 📚 Comandos Úteis

```bash
# Rodar teste live completo
npm run test:live

# Testar convicção
npm run test:conviction

# Analisar histórico
npm run test:analyzer

# Ver exemplos práticos
npm run test:examples

# Ver estatísticas
npm run stats

# Ver última 20 ordens
npm run orders

# Limpar dados e resincronizar
node clean_and_sync.js
```

---

**🟢 Pronto para começar! Execute `run_test_live.bat` e monitore o dashboard em http://localhost:3001**
