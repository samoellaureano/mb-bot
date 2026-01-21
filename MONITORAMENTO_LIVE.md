# 🚀 BOT EM MODO LIVE - MONITORAMENTO E AJUSTES

## ✅ Status Atual

**Data**: 20 de janeiro de 2026  
**Modo**: LIVE (Produção com dinheiro real!)  
**Status**: Bot rodando em tempo real  

---

## 📊 Configuração Ativa

```
SPREAD_PCT=0.025          # 2.5% spread base
MIN_SPREAD_PCT=0.020      # 2.0% mínimo
MAX_SPREAD_PCT=0.040      # 4.0% máximo (FIX APLICADO)
ORDER_SIZE=0.00005        # 50μBTC (~R$ 24)
STOP_LOSS_PCT=0.015       # 1.5%
TAKE_PROFIT_PCT=0.025     # 2.5%
CYCLE_SEC=30              # 30 segundos por ciclo
```

---

## 🔧 Correção Aplicada

**Erro Corrigido**: `MAX_SPREAD_PCT is not defined`

**Solução**: Adicionada definição de constante no bot.js:
```javascript
const MAX_SPREAD_PCT = parseFloat(process.env.MAX_SPREAD_PCT || '0.040');
```

Bot agora roda sem erros!

---

## 📈 Como Monitorar

### 1. **Em Tempo Real via Terminal**
```bash
# Ver ciclos e PnL
tail -f logs/bot_live_*.log | grep -E "CICLO|PnL"

# Só PnL
grep "PnL Total:" logs/bot_live_*.log | tail -20

# Spreads usados
grep "SPREAD_ADAPT" logs/bot_live_*.log | tail -20
```

### 2. **Dashboard Web**
Acesse em: **http://localhost:3001**
- Visualiza dados em tempo real
- Ver gráficos de PnL
- Status das ordens

### 3. **Estatísticas Finais**
```bash
npm run stats
```

---

## ⚠️ O Que Observar

### Sinais Positivos ✅
```
✅ Ciclos executados: 1, 2, 3, 4...
✅ Spreads: 2.23%, 2.25%, 2.5%, etc
✅ PnL: +0.05, +0.10, +0.15...
✅ Ordens sendo colocadas regularmente
```

### Sinais de Alerta ⚠️
```
❌ PnL: -0.05, -0.10, -0.15... (negativo)
❌ Erro: "not defined", "undefined"
❌ Ciclos parando ou atrasando
❌ Spread: 0% ou muito baixo (<1%)
```

---

## 🔧 Se PnL Estiver Negativo

### Opção 1: Aumentar Spread (RECOMENDADO)
```bash
# Parar bot
pkill -f "node bot.js"

# Aumentar para 3.0%
sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.030/' .env
sed -i 's/MIN_SPREAD_PCT=.*/MIN_SPREAD_PCT=0.025/' .env

# Reiniciar
npm run live
```

### Opção 2: Aumentar Order Size
```bash
# De 50μBTC para 100μBTC
sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.0001/' .env
sed -i 's/MIN_ORDER_SIZE=.*/MIN_ORDER_SIZE=0.00005/' .env

# Reiniciar
npm run live
```

### Opção 3: Usar Script Automático
```bash
bash apply_adjustments.sh
# Escolha a opção desejada
```

### Opção 4: Reverter para Valores Antigos
Se piorou:
```bash
sed -i 's/SPREAD_PCT=.*/SPREAD_PCT=0.015/' .env
sed -i 's/ORDER_SIZE=.*/ORDER_SIZE=0.000005/' .env
npm run live
```

---

## 📊 Exemplo de Monitoramento

```
[15:50:40] ✅ Bot iniciado
[15:50:56] Ciclo 1: PnL: -0.05 | Spread: 2.23%
[15:51:26] Ciclo 2: PnL: -0.03 | Spread: 2.50%
[15:51:56] Ciclo 3: PnL: +0.10 | Spread: 2.45%
[15:52:26] Ciclo 4: PnL: +0.18 | Spread: 2.25%
[15:52:56] Ciclo 5: PnL: +0.25 | Spread: 2.30%
...
```

Se PnL ficar positivo consistentemente → **Sucesso! 🎉**

---

## 🛑 Como Parar o Bot

```bash
# Parar imediatamente
pkill -f "node bot.js"

# Parar e esperar graceful shutdown
kill $(pgrep -f "node bot.js")

# Verificar se parou
ps aux | grep "node bot"
```

---

## 📋 Checklist Durante Execução

- [ ] Bot inicializando sem erros
- [ ] Ciclos executando (Ciclo 1, 2, 3...)
- [ ] Spreads adaptativo sendo usado (2.0%-4.0%)
- [ ] Ordens sendo colocadas
- [ ] PnL visível (positivo ou negativo)
- [ ] Dashboard acessível em http://localhost:3001
- [ ] Sem loops infinitos ou travamentos
- [ ] Logs sendo salvos

---

## 📞 Troubleshooting

### Problema: "MAX_SPREAD_PCT is not defined"
**Solução**: ✅ JÁ CORRIGIDO! Execute npm run live

### Problema: PnL sempre negativo
**Opção 1**: Aumentar spread (sed commands acima)
**Opção 2**: Aumentar order size
**Opção 3**: Esperar mais ciclos (pode ser sorte)
**Opção 4**: Reverter valores antigos

### Problema: Bot trava/para
**Verificar**: 
```bash
tail -f logs/bot_live_*.log
# Procurar por ERROR ou Erro
```

### Problema: Muitos ciclos negativos
**Ação**: Use `bash apply_adjustments.sh` para aumentar spread

---

## 📈 Cronograma Recomendado

```
1-5 min:    Iniciar, verificar sem erros
5-10 min:   Coletar primeiros 10-20 ciclos
10-30 min:  Avaliar se PnL positivo/negativo
30-60 min:  Se positivo → continuar, se negativo → ajustar
60+ min:    Consolidar dados, fazer análise final
```

---

## 🎯 Métricas de Sucesso

| Métrica | Alvo | Status |
|---------|------|--------|
| **PnL** | Positivo | ⏳ Monitorando |
| **Spread** | 2.0%-4.0% | ✅ Configurado |
| **Ciclos** | >50 sem erro | ⏳ Monitorando |
| **Fills** | >0% | ⏳ Monitorando |
| **Dashboard** | Acessível | ✅ http://localhost:3001 |

---

## 💡 Dicas de Otimização

1. **Paciência**: Deixe rodar pelo menos 30-60 minutos
2. **Mercado**: Spreads maiores em vol alta, menores em vol baixa
3. **Ajustes Graduais**: Não aumentar spread de 1x para 10x
4. **Monitorar Logs**: Sempre ver se há erros silenciosos

---

## 📞 Próximas Ações

### Agora (Monitorando)
1. Deixar bot rodando
2. Observar PnL a cada 10 ciclos
3. Se negativo persistir → aplicar ajustes

### Em 1 Hora
1. Avaliar PnL total
2. Decidir: continuar, ajustar ou reverter
3. Documentar resultados

### Se Sucesso
1. Deixar rodar 24h
2. Consolidar dados
3. Ir para otimizações mais avançadas

---

## ✨ Status Atual

```
🚀 Bot: RODANDO
💻 Modo: LIVE (produção)
✅ Spread: ADAPTATIVO (2.0%-4.0%)
📊 Order: 50μBTC
⏳ PnL: MONITORANDO
🔧 Erros: ZERO (MAX_SPREAD_PCT corrigido)
🌐 Dashboard: http://localhost:3001
```

---

**Implementação**: GitHub Copilot  
**Data**: 20/01/2026  
**Status**: ✅ Bot LIVE e Monitorando  
**Próximo**: Aguardar resultados e fazer ajustes se necessário

---

