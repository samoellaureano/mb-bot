# 🎯 TESTE LIVE COMPLETO PRONTO PARA EXECUÇÃO

```
╔════════════════════════════════════════════════════════════════╗
║     ✅ SISTEMA DE TESTE LIVE IMPLEMENTADO COM SUCESSO        ║
╚════════════════════════════════════════════════════════════════╝
```

## 📦 Arquivos Criados (5 arquivos - 42KB)

### 🔵 **test_live_complete.js** (17KB)
- Script principal que valida tudo
- Roda ciclos a cada 30 segundos
- Coleta 50+ pontos de dados até 20:30
- Gera relatório JSON final

**Validações:**
✓ Preços (integridade, variação)
✓ Spreads (limites MIN/MAX)
✓ Saldos BTC/BRL
✓ Ordens (campos, status)
✓ Convicção (cálculo, classificação)
✓ Lucro (acompanhamento)

---

### 🟢 **run_test_live.bat** (2.9KB)
- Script automático para Windows
- Inicia Bot + Dashboard + Teste em paralelo
- Valida SIMULATE=false
- Executa até 20:30
- Gera relatório automaticamente

**Uso:**
```cmd
run_test_live.bat
```

---

### 🔴 **run_test_live.sh** (~3KB)
- Script automático para Linux/Mac
- Mesma funcionalidade que .bat
- Com suporte a pipes e logs

**Uso:**
```bash
chmod +x run_test_live.sh
./run_test_live.sh
```

---

### 📊 **monitor_live.js** (8.5KB)
- Monitor interativo em terminal
- Atualiza a cada 2 segundos
- Mostra contagem regressiva até 20:30
- Exibe últimas métricas
- Links para dashboard

**Uso:**
```bash
node monitor_live.js
```

---

### 📚 **GUIA_TESTE_LIVE.md** (6.3KB)
- Documentação completa
- Instruções para 3 plataformas
- Pré-requisitos
- Troubleshooting
- Próximos passos

---

### 📋 **TESTE_LIVE_RESUMO.md** (7.5KB)
- Resumo executivo
- Como usar (3 opções)
- Métricas esperadas
- Customizações rápidas
- Scripts úteis

---

## 🚀 COMO RODAR

### **Opção 1: Windows (Mais Fácil)**
```cmd
run_test_live.bat
```
⏱️ Automático até 20:30 em 3 janelas

---

### **Opção 2: Manual (Qualquer SO)**

Terminal 1:
```bash
npm run live
```

Terminal 2:
```bash
npm run dashboard
```

Terminal 3:
```bash
npm run test:live
```

Terminal 4 (opcional):
```bash
node monitor_live.js
```

---

## 📊 MONITORAR EM TEMPO REAL

### 🌐 Dashboard Web
**http://localhost:3001**
- Gráficos de preço
- Saldos atualizados
- PnL em destaque
- **NOVO: Métricas de Convicção**

### 📈 Terminal (monitor_live.js)
```
⏱️  Hora: 19:45:30
⏱️  Restante: 45 minutos
📊 Convicção Média: 62.5%
✓ Ciclos: 87
```

### 📝 Arquivos de Log
```
logs/
  bot_TIMESTAMP.log
  dashboard_TIMESTAMP.log
  teste_TIMESTAMP.log
```

---

## ✅ VALIDAÇÕES IMPLEMENTADAS

| Validação | Status | Descrição |
|-----------|--------|-----------|
| **Preços** | ✓ Implementado | Integridade, variação máx 5% |
| **Spreads** | ✓ Implementado | MIN 1.2%, MAX 2.0% |
| **Saldos** | ✓ Implementado | BTC e BRL, números finitos |
| **Ordens** | ✓ Implementado | Campos, status, preços |
| **Convicção** | ✓ Implementado | 6 indicadores, classificação |
| **Lucro** | ✓ Implementado | Acompanhamento 24h |
| **Dados** | ✓ Implementado | Coleta 50+ ciclos |

---

## 📈 RELATÓRIO FINAL

Após 20:30, gera arquivo:
```
teste_live_2025-01-12T20-30-15.json
```

Com dados:
```json
{
  "cyclesExecutados": 145,
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

## ⏱️ TIMELINE ESPERADA

| Hora | Ação |
|------|------|
| **agora** | Execute `run_test_live.bat` |
| **+10s** | Bot conecta à API |
| **+15s** | Dashboard abre em http://localhost:3001 |
| **+20s** | Teste começa primeira validação |
| **cada 30s** | Novo ciclo de validação |
| **cada 2s** | Monitor atualiza (se rodando) |
| **20:30** | Teste encerra e gera relatório |

---

## 🎯 MÉTRICAS DE SUCESSO

✅ **Teste Aprovado se:**
- Ciclos Executados: > 50
- Validações Passando: 5/5
- Convicção Média: 50-80%
- Erros de Cálculo: 0
- Preços Válidos: 100%
- Saldos Consistentes: ✓

---

## 🔧 CUSTOMIZAÇÕES RÁPIDAS

### Mudar Hora de Término
Edit `test_live_complete.js`:
```javascript
const ALVO_TERMINO = '18:00:00';  // 18h em vez de 20h30
```

### Mudar Ciclo do Bot
Edit `.env`:
```env
CYCLE_SEC=15  # 15 segundos em vez de 30
```

### Aumentar Tamanho de Ordem
Edit `.env`:
```env
ORDER_SIZE=0.002  # 2x maior
```

---

## 🆘 PRÉ-REQUISITOS

✓ **SIMULATE=false** no .env
✓ **API_KEY e API_SECRET** válidos
✓ **Node.js 16+**
✓ **npm 7+**
✓ **npm install** executado
✓ **Saldo mínimo** na Mercado Bitcoin

---

## 📞 PRÓXIMOS PASSOS

1. **Executar teste**
   ```cmd
   run_test_live.bat
   ```

2. **Monitorar dashboard**
   - Abra http://localhost:3001
   - Observe preços, saldos, convicção

3. **Verificar monitor (opcional)**
   - Terminal adicional: `node monitor_live.js`
   - Mostra contagem regressiva

4. **Analisar relatório (20:30+)**
   - Arquivo JSON gerado
   - Verifique validações
   - Identifique melhorias

5. **Ajustar parâmetros** se necessário
   - Edite `.env`
   - Rode teste novamente

---

## 📚 SCRIPTS ÚTEIS

```bash
# Rodar teste até 20:30
npm run test:live

# Monitorar em tempo real
node monitor_live.js

# Testar convicção isolado
npm run test:conviction

# Analisar histórico
npm run test:analyzer

# Ver exemplos práticos
npm run test:examples

# Limpar e sincronizar dados
node clean_and_sync.js

# Ver estatísticas atuais
npm run stats

# Ver últimas 20 ordens
npm run orders
```

---

## 🎬 START

```cmd
C:\PROJETOS_PESSOAIS\mb-bot> run_test_live.bat
```

**O teste rodará até 20:30 validando:**
✓ Valores
✓ Cálculos
✓ Convicção
✓ Lucro
✓ Saldo
✓ Bot e Dashboard

**Bom teste! 🚀**

```
╔════════════════════════════════════════════════════════════════╗
║           Pronto para execução até 20:30!                    ║
╚════════════════════════════════════════════════════════════════╝
```
