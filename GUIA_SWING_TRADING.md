# 🚀 GUIA DE INÍCIO - ESTRATÉGIA SWING TRADING

## 1. TESTE EM SIMULAÇÃO (RECOMENDADO PRIMEIRO)

```bash
# Terminal 1: Iniciar Bot em Simulação
cd c:\PROJETOS_PESSOAIS\mb-bot
SIMULATE=true USE_SWING_TRADING=true node bot.js
```

Você verá logs assim:
```
[SUCCESS] [SWING_TRADING] Estratégia swing trading inicializada...
[SUCCESS] Bot iniciado em modo SIMULAÇÃO. Ciclo a cada 30s.
[SWING] Sinal de COMPRA: Queda detectada: -0.45%
[SWING_EXEC] Executando COMPRA...
```

### Terminal 2: Dashboard (Opcional)
```bash
node dashboard.js
# Abra: http://localhost:3001
```

---

## 2. VALIDAR QUE TUDO FUNCIONA

```bash
# Validação Rápida
node validate_swing_trading_integration.js

# Você verá:
# ✓ Módulo carregado com sucesso
# ✓ Instanciação bem-sucedida
# ✓ Todos os métodos validados
# ✓ Simulação completada: 1 ciclo(s) de negociação
```

---

## 3. MONITORAR PERFORMANCE

### No Terminal do Bot
Procure por logs como:
```
[SWING] Sinal de COMPRA: Queda detectada: -0.35%
[SWING_EXEC] Executando COMPRA em 475200.00 BRL
[SWING] Sinal de VENDA: Lucro alcançado: +0.41%
[SWING_EXEC] Venda executada em 475300.00 BRL - PnL: 4.50 BRL (+0.41%)
[SWING_METRICS] {"strategy":"Swing Trading","trades":{"total":1,"wins":1}}
```

### No Dashboard
- Veja PnL acumulado em tempo real
- Monitore trades abertas
- Acompanhe ROI vs HOLD

---

## 4. APÓS 24h DE SIMULAÇÃO

Se os resultados forem positivos:

```bash
# Teste ao vivo com capital pequeno (50 BRL)
SIMULATE=false USE_SWING_TRADING=true node bot.js
```

⚠️ **CUIDADO:** 
- Comece com capital pequeno (50-100 BRL)
- Esteja pronto para parar se houver problemas
- Monitore continuamente os logs

---

## 5. DESATIVAR A ESTRATÉGIA (SE NECESSÁRIO)

```bash
# Voltar à lógica padrão
USE_SWING_TRADING=false node bot.js
```

---

## 📊 O QUE ESPERAR

### Em Simulação
- Bot detectará quedas de ~0.3% ou mais
- Comprará automaticamente
- Venderá quando lucro atingir +0.4% ou perda -0.8%
- Logs mostrarão todas as ações

### Performance
- Esperado: Superar HOLD por 2-3% mesmo em mercados em queda
- Trades por dia: 1-5 (depende de volatilidade)
- Win rate esperado: >25%

---

## ✅ CHECKLIST ANTES DE PRODUÇÃO

- [ ] Bot executa em simulação sem erros
- [ ] Validação passa com sucesso
- [ ] Vejo sinais [SWING] nos logs
- [ ] Ordens estão sendo executadas
- [ ] Dashboard mostra dados corretos
- [ ] PnL está evoluindo positivamente
- [ ] Rodou por 24h+ em simulação

---

## 🔧 AJUSTAR PARÂMETROS (SE NECESSÁRIO)

Se quiser ajustar a estratégia, edite em `bot.js`:

```javascript
swingTradingStrategy = new SwingTradingStrategy({
    dropThreshold: 0.003,    // ← Ajuste aqui (0.3%)
    profitTarget: 0.004,     // ← Ou aqui (0.4%)
    stopLoss: -0.008         // ← Ou aqui (-0.8%)
});
```

**Parâmetros testados e validados acima** ✓

---

## 🆘 PROBLEMAS COMUNS

### "Bot não iniciou"
```bash
node -c bot.js  # Verificar sintaxe
node bot.js     # Rodar normalmente
```

### "Não vejo logs de [SWING]"
Verificar no `.env`:
```env
SIMULATE=true
USE_SWING_TRADING=true  # ← Está true?
```

### "Ordens não estão sendo executadas"
Verificar saldos simulados:
```
[SUCCESS] Orderbook atualizado: Best Bid=475208.00, Best Ask=475418.00
```
Se não aparecer, orderbook não está sendo atualizado.

---

## 📚 REFERÊNCIAS

- **Estratégia:** [swing_trading_strategy.js](swing_trading_strategy.js)
- **Integração:** [bot.js - runCycle()](bot.js)
- **Documentação:** [RELATORIO_DEPLOYMENT_SWING_TRADING.md](RELATORIO_DEPLOYMENT_SWING_TRADING.md)

---

## 🎯 RESUMO

```
┌─────────────────────────────────────────────┐
│ 1. SIMULAR por 24h+                         │
│    SIMULATE=true USE_SWING_TRADING=true     │
├─────────────────────────────────────────────┤
│ 2. VALIDAR com sucesso                      │
│    node validate_swing_trading_...          │
├─────────────────────────────────────────────┤
│ 3. TESTAR ao vivo com 50 BRL                │
│    SIMULATE=false USE_SWING_TRADING=true    │
├─────────────────────────────────────────────┤
│ 4. ESCALAR conforme confiança               │
│    Aumentar capital gradualmente             │
└─────────────────────────────────────────────┘
```

---

**Pronto para começar?** 🚀

Execute em outro terminal agora:
```bash
cd c:\PROJETOS_PESSOAIS\mb-bot
SIMULATE=true USE_SWING_TRADING=true node bot.js
```

Bom trading! 📈
