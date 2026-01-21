# ⚠️ AVISO CRÍTICO - ANTES DE RODAR EM PRODUÇÃO

## 🚨 RISCOS DE CAPITAL REAL

Você está prestes a executar o bot em **MODO PRODUÇÃO** com **CAPITAL REAL**. Isso é perigoso!

### Checklist de Segurança

**OBRIGATÓRIO fazer ANTES de produção:**

- [ ] ✅ Testou em **SIMULAÇÃO por 24h+**
- [ ] ✅ Validou que a estratégia swing trading está funcionando
- [ ] ✅ Verificou logs do bot em simulação
- [ ] ✅ Confirmou que o dashboard mostra dados esperados
- [ ] ✅ Tem saldo suficiente na Mercado Bitcoin
- [ ] ✅ Começará com **CAPITAL PEQUENO** (50-100 BRL)
- [ ] ✅ Está preparado para parar o bot IMEDIATAMENTE se necessário
- [ ] ✅ Tem sistema de monitoramento ativo
- [ ] ✅ Entende os parâmetros da estratégia
- [ ] ✅ Leu toda a documentação

---

## 🎯 PLANO RECOMENDADO

### Fase 1: Simulação Estendida (24-72h) ✅ FAZER AGORA
```bash
SIMULATE=true USE_SWING_TRADING=true node bot.js
```
- Rodar em simulação por 24-72 horas
- Monitorar no dashboard
- Validar comportamento esperado
- **NÃO pula esta fase!**

### Fase 2: Teste em Produção com Capital Mínimo (48-72h)
```bash
SIMULATE=false USE_SWING_TRADING=true node bot.js
```
- Capital inicial: **50 BRL APENAS**
- Monitorar a cada 30 minutos
- Estar pronto para parar imediatamente
- Validar que API funciona e ordens são executadas

### Fase 3: Escalar Gradualmente (Semana+)
- Aumentar capital: 100 → 200 → 500 BRL
- Monitorar continuamente
- Ajustar se necessário

---

## 🏃 SE VOCÊ REALMENTE QUER RODAR AGORA

Se insiste em rodar em produção JÁ, siga isto:

```bash
# 1. Confirme que simulação funciona
SIMULATE=true USE_SWING_TRADING=true node bot.js &
sleep 60
# Verifique logs - deve ver [SWING] messages
tail -50 bot.log | grep SWING

# 2. Se viu [SWING], pode parar com Ctrl+C
# kill %1

# 3. DEPOIS execute em produção
bash run_bot_production.sh
```

---

## 📋 O QUE ESPERAR EM PRODUÇÃO

### Logs que você DEVE ver:
```
[SUCCESS] [SWING_TRADING] Estratégia swing trading inicializada
[SUCCESS] Bot iniciado em modo PRODUÇÃO
[DEBUG]   [SWING] USE_SWING_TRADING ativado
```

### Sinais de Negociação:
```
[SWING] Sinal de COMPRA: Queda detectada: -0.35%
[SWING_EXEC] Executando COMPRA: 0.00005 BTC em 475200.00 BRL
[SWING_EXEC] Ordem de compra colocada. ID: xxxxx
```

### Avisos de Problema:
```
[ERROR] Falha ao buscar saldos  ← ⚠️ PARAR
[ERROR] Falha ao colocar ordem   ← ⚠️ PARAR
[WARN]  Orderbook inválido       ← ⚠️ MONITORAR
```

---

## 🛑 QUANDO PARAR IMEDIATAMENTE

1. ❌ Erros consecutivos no log
2. ❌ Saldo inesperadamente baixo
3. ❌ Ordens não sendo executadas
4. ❌ PnL caindo muito rapidamente
5. ❌ Comportamento inesperado

---

## 🎯 AÇÃO RECOMENDADA

**Para hoje:**
1. Rodar **SIMULAÇÃO** por 2-4 horas
2. Verificar que `[SWING]` está nos logs
3. Abrir dashboard em http://localhost:3001
4. Validar que tudo está funcionando

**Para amanhã:**
1. Continuar simulação overnight
2. Coletar 24h+ de dados
3. Analisar performance

**Próxima semana:**
1. Se simulação foi bem, testar em produção com 50 BRL
2. Monitorar rigorosamente
3. Escalar se tudo funcionar

---

## 📞 RESUMO

| Ação | Status | Comando |
|------|--------|---------|
| **Simulação (SEGURO)** | ✅ Pronto | `SIMULATE=true USE_SWING_TRADING=true node bot.js` |
| **Produção (ARRISCADO)** | ⚠️ Usar com cuidado | `bash run_bot_production.sh` |

---

## ✅ RECOMENDAÇÃO FINAL

**FAÇA SIMULAÇÃO PRIMEIRO!**

```bash
# Opção 1: Rápido (2-4 horas)
SIMULATE=true USE_SWING_TRADING=true timeout 14400 node bot.js

# Opção 2: Overnight (24+ horas)
SIMULATE=true USE_SWING_TRADING=true node bot.js &
# Deixar rodando e verificar amanhã

# Opção 3: Com Dashboard
# Terminal 1:
SIMULATE=true USE_SWING_TRADING=true node bot.js

# Terminal 2:
node dashboard.js
# Abrir http://localhost:3001
```

---

**Lembre-se:** Capital real = risco real. Teste bem antes! 🛡️
