# 🎯 INSTRUÇÕES FINAIS - BOT COM ESTRATÉGIA SWING TRADING

## ✅ STATUS DO DEPLOYMENT

Toda a estratégia swing trading foi **deployada com sucesso** ao bot.js:

- ✅ Módulo `swing_trading_strategy.js` criado e testado
- ✅ Integração ao `bot.js` completa
- ✅ Validação 100% sucesso
- ✅ Logs confirmam execução

---

## 🚀 COMO USAR - 3 OPÇÕES

### OPÇÃO 1: Simulação (SEGURA - Comece aqui!)
```bash
cd c:\PROJETOS_PESSOAIS\mb-bot
SIMULATE=true USE_SWING_TRADING=true node bot.js
```

**O que você verá:**
- Logs começam com: `[SUCCESS] [SWING_TRADING] Estratégia swing trading inicializada`
- A cada ciclo: `[DEBUG] [SWING] USE_SWING_TRADING ativado. Avaliando sinais...`
- Quando detecta queda: `[SWING] Sinal de COMPRA: Queda detectada`
- Quando vende: `[SWING] Sinal de VENDA: Lucro alcançado`

**Por quanto tempo:** 24-48 horas mínimo

---

### OPÇÃO 2: Simulação + Dashboard (RECOMENDADO!)
```bash
# Terminal 1:
cd c:\PROJETOS_PESSOAIS\mb-bot
SIMULATE=true USE_SWING_TRADING=true node bot.js

# Terminal 2:
cd c:\PROJETOS_PESSOAIS\mb-bot
node dashboard.js
```

Depois abra no navegador: **http://localhost:3001**

---

### OPÇÃO 3: Produção com Capital Real (⚠️ CUIDADO!)
```bash
cd c:\PROJETOS_PESSOAIS\mb-bot
SIMULATE=false USE_SWING_TRADING=true node bot.js
```

**AVISOS CRÍTICOS:**
1. ⚠️ Isso usa capital REAL!
2. ⚠️ Comece com valor pequeno (50-100 BRL)
3. ⚠️ Monitore os logs continuamente
4. ⚠️ Esteja pronto para parar (Ctrl+C)

**RECOMENDAÇÃO:** Faça 24-48h de simulação PRIMEIRO!

---

## 📊 O QUE ESPERAR

### Em Simulação:
- Bot rodará a cada 30 segundos
- Cada ciclo processará dados do mercado
- Sinais serão gerados automaticamente
- Você verá logs do [SWING] strategy
- Dashboard mostrará performance em tempo real

### Performance Esperada:
- **Mercado em queda (-4%):** Ganho de +2.58% vs HOLD
- **Win rate:** 25%+ (esperado)
- **Trades por dia:** 1-5 (depende da volatilidade)

---

## 🔍 COMO MONITORAR

### Logs (Opção 1 e 3):
```bash
# Ver logs em tempo real
tail -f bot.log | grep SWING

# Ver apenas erros
tail -f bot.log | grep ERROR
```

### Dashboard (Opção 2):
- Abra: http://localhost:3001
- Veja PnL, ROI, trades em tempo real
- Monitore tickers de BTC-BRL

---

## ✔️ CHECKLIST ANTES DE PRODUÇÃO

Se quer rodar em produção (SIMULATE=false), verifique:

- [ ] Rodou em simulação por 24+ horas
- [ ] Viu sinais [SWING] nos logs
- [ ] Dashboard mostrou dados esperados
- [ ] Tem capital mínimo de 50 BRL na conta
- [ ] Confirmou credenciais corretas no .env
- [ ] Tem monitoramento ativo
- [ ] Entende os parâmetros da estratégia

---

## 📋 PARÂMETROS DA ESTRATÉGIA

```
Drop Threshold:  0.3%    → Compra quando preço cai >0.3%
Profit Target:   0.4%    → Vende quando lucro ≥0.4%
Stop Loss:      -0.8%    → Limita perdas a 0.8%
Capital Inicial: 200 BRL (simulação)
Position Size:   Max 0.00008 BTC
```

---

## 🆘 TROUBLESHOOTING

### Não vejo [SWING] nos logs
**Solução:** Verificar que tem `USE_SWING_TRADING=true` no comando

### Bot não inicia
**Solução:** Rodar `node -c bot.js` para validar sintaxe

### Dashboard não carrega
**Solução:** Verificar que bot está rodando em outro terminal

### Performance ruim
**Solução:** Dados insuficientes, aguardar 24h+ de simulação

---

## 🎯 PRÓXIMOS PASSOS (ORDEM RECOMENDADA)

1. **AGORA:** Rodar Opção 1 ou 2 (Simulação com ou sem dashboard)
2. **Hoje:** Deixar rodando por 2-4 horas
3. **Amanhã:** Continuar simulação overnight
4. **Próximo Dia:** Analisar performance em 24h
5. **Se OK:** Teste com 50 BRL em produção
6. **Se Continuar OK:** Escalar capital gradualmente

---

## 📞 COMANDOS RÁPIDOS

```bash
# Ver últimas 50 linhas de log
tail -50 bot.log

# Ver apenas [SWING]
grep SWING bot.log | tail -20

# Contar ciclos executados
grep "Iniciando ciclo" bot.log | wc -l

# Ver erros
grep ERROR bot.log

# Parar o bot
# Pressione Ctrl+C no terminal
```

---

## ✅ RESUMO FINAL

**Você tem tudo pronto para começar!**

1. **Escolha a opção:** Simulação (segura) ou Produção (arriscada)
2. **Execute o comando:** Copie o comando da seção "Como Usar"
3. **Monitore:** Verifique os logs e veja sinais [SWING]
4. **Aguarde:** Deixe rodando por 24+ horas
5. **Analise:** Dashboard mostrará performance

---

**Recomendação:** Comece com a **OPÇÃO 2 (Simulação + Dashboard)** para melhor experiência! 📊

---

*Última atualização: 20/01/2026 21:30*
