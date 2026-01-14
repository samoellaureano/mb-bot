# 🚀 QUICK START - ESTRATÉGIA ADAPTATIVA

## Resumo Executivo

Estratégia adaptativa foi **implementada e está pronta para uso**. O bot agora:
- ✅ Acumula BTC quando mercado sobe
- ✅ Protege BRL quando mercado cai
- ✅ Adapta spread (1.0% → 1.8%), viés (±0.0001), e posição máxima (0.0002 → 0.0005 BTC)

**Status Atual:**
- Capital: R$ 224.64 (86.6% BTC + 13.4% BRL)
- Order Size: 0.000005 BTC (5 µBTC)
- Capacidade: ~10 pares simultâneos

---

## 1️⃣ INICIAR BOT COM ESTRATÉGIA

```bash
# Modo simulação (teste seguro)
npm run dev

# Modo produção (REAL com grana real)
npm run live
# Ou manualmente:
SIMULATE=false node bot.js
```

**O quê muda automaticamente:**
Ao iniciar, bot carrega:
- ✅ Módulo `adaptive_strategy.js`
- ✅ Configuração `.env` com ADAPTIVE_STRATEGY=true
- ✅ Dinâmica de parâmetros por ciclo

---

## 2️⃣ MONITORAR ESTRATÉGIA

### Ver em Tempo Real
```bash
# Terminal 1: Logs do bot
tail -f logs/bot.log | grep "ESTRATÉGIA ADAPTATIVA"

# Terminal 2: Dashboard
npm run dashboard
# Abrir: http://localhost:3001
```

### Procurar Por Padrões
```bash
# Ver todas as ativações da estratégia
grep "ESTRATÉGIA ADAPTATIVA" logs/bot.log

# Ver mudanças de modo
grep -E "ALTA|BAIXA|NEUTRA" logs/bot.log | tail -20

# Ver se spread está mudando
grep "dynamicSpread" logs/bot.log | tail -10
```

---

## 3️⃣ VALIDAR QUE ESTÁ FUNCIONANDO

Depois de 5 minutos, você deve ver:

### Log esperado em ALTA:
```
[INFO] 14:35:12 [Bot] ESTRATÉGIA ADAPTATIVA ATIVADA: 📈 ACUMULAÇÃO
   Spread: 1.0% | Order Size: 5µBTC | Viés: +0.0001 | Max Pos: 0.0005 BTC
   Proporção: BUY: 70% | SELL: 30%
```

### Log esperado em BAIXA:
```
[INFO] 14:40:22 [Bot] ESTRATÉGIA ADAPTATIVA ATIVADA: 📉 PROTEÇÃO
   Spread: 1.8% | Order Size: 5µBTC | Viés: -0.0001 | Max Pos: 0.0002 BTC
   Proporção: BUY: 30% | SELL: 70%
```

### Log esperado em NEUTRA:
```
[INFO] 14:45:33 [Bot] ESTRATÉGIA ADAPTATIVA ATIVADA: ⚪ EQUILIBRADO
   Spread: 1.2% | Order Size: 5µBTC | Viés: 0.0 | Max Pos: 0.0003 BTC
   Proporção: BUY: 50% | SELL: 50%
```

---

## 4️⃣ CHECKLIST PÓS-INICIALIZAÇÃO

- [ ] Bot iniciou sem erros
- [ ] Vejo logs "ESTRATÉGIA ADAPTATIVA" nos primeiros 2 minutos
- [ ] Dashboard mostra ordens sendo criadas
- [ ] Vi pelo menos UMA mudança de modo (ALTA/BAIXA/NEUTRA)
- [ ] Spread aparece mudando no logs (1.0% ↔ 1.8%)
- [ ] Max Position está sendo ajustado dinamicamente

**Se algum checkbox falhou:**
- Veja a seção "Diagnóstico" abaixo
- Verifique logs completos: `tail -100 logs/bot.log`

---

## 5️⃣ ACOMPANHAMENTO RECOMENDADO

### Dia 1 (Primeiras 24 horas)
- [ ] Coletar logs de todas as 3 tendências
- [ ] Verificar se parâmetros mudam quando tendência muda
- [ ] Confirmar que em ALTA há mais BUY que SELL
- [ ] Confirmar que em BAIXA há mais SELL que BUY

### Dia 2-3
- [ ] Analisar PnL em cada modo
- [ ] Verificar se portfolio % BTC aumentou em ALTA
- [ ] Verificar se portfolio % BRL aumentou em BAIXA

### Semana 1
- [ ] Coletar estatísticas completas
- [ ] Validar se fills melhoraram (estava 0%, esperado >5%)
- [ ] Ajustar parâmetros se necessário

---

## 6️⃣ DIAGNÓSTICO

### "Não vejo logs ESTRATÉGIA ADAPTATIVA"

**Causa 1:** Bot não foi reiniciado
```bash
# Parar bot antigo
pkill -f "node bot.js"

# Aguardar 2 segundos
sleep 2

# Iniciar novo
npm run live
```

**Causa 2:** ADAPTIVE_STRATEGY desativada em .env
```bash
# Checar .env
grep ADAPTIVE_STRATEGY .env
# Deve mostrar: ADAPTIVE_STRATEGY=true

# Se não tiver, adicione:
echo "ADAPTIVE_STRATEGY=true" >> .env
```

**Causa 3:** Módulo adaptive_strategy.js não encontrado
```bash
# Verificar arquivo
ls -la adaptive_strategy.js
# Deve existir

# Se não existir, restaurar:
git checkout adaptive_strategy.js
# Ou refazer (veja próximas seções)
```

### "Spread não muda entre 1.0% e 1.8%"

**Verificar:**
1. Tendência está mudando? `grep "Tendência" logs/bot.log | tail -10`
2. Spread está em fórmula dinâmica? `grep "dynamicSpread" logs/bot.log | tail -5`

**Se não mudar:**
```bash
# Força uma mudança de teste editando bot.js linha ~820
currentSpreadPct = 0.018; // Força 1.8% para teste
```

### "Vejo erro: Cannot find module 'adaptive_strategy'"

```bash
# Opção 1: Node não encontrou módulo
node -e "require('./adaptive_strategy')"
# Se falhar, refazer arquivo

# Opção 2: Caminhos errados
# Confirmar que adaptive_strategy.js está na raiz do projeto
pwd  # Deve ser /home/xxx/mb-bot
ls adaptive_strategy.js  # Deve existir
```

---

## 7️⃣ AJUSTES RÁPIDOS

Se os resultados não forem bons, ajustar em `adaptive_strategy.js`:

### Spread muito apertado em ALTA? (não consegue vender)
```javascript
// Linha ~40, função getAdaptiveParameters
up: {
    spread: 0.015,  // Aumentar de 0.010 para 0.015 (1.5%)
    // ...
}
```

### Max Position muito agressivo? (acumula demais)
```javascript
// Linha ~40
up: {
    // ...
    maxPosition: 0.0003,  // Reduzir de 0.0005 para 0.0003
}
```

### Viés não está funcionando? (BUY/SELL não desbalanceado)
```javascript
// Linha ~40
up: {
    // ...
    bias: 0.0002,  // Aumentar de 0.0001 para 0.0002
}
```

**Depois de ajustar:**
```bash
# Restart bot
pkill -f "node bot.js"
npm run live
```

---

## 8️⃣ MÉTRICAS PARA ACOMPANHAR

| Métrica | Esperado em ALTA | Esperado em BAIXA | Como Ver |
|---------|-----------------|------------------|----------|
| **Spread** | 1.0% | 1.8% | `grep "dynamicSpread" bot.log` |
| **Max Position** | 0.0005 | 0.0002 | `grep "MAX_POSITION" bot.log` |
| **Viés** | +0.0001 | -0.0001 | `grep "currentBias" bot.log` |
| **Proporção BUY** | >60% | <40% | Dashboard ou `grep "BUY:" logs` |
| **PnL** | ↑ Positivo | ↑ Menor queda | `npm run stats` |

---

## 9️⃣ SUPORTE

Se algo não funcionar:

1. **Verificar logs:**
   ```bash
   tail -200 logs/bot.log > /tmp/bot_logs.txt
   cat /tmp/bot_logs.txt
   ```

2. **Procurar por erros:**
   ```bash
   grep -i "error\|erro\|fail" logs/bot.log | tail -20
   ```

3. **Validar configuração:**
   ```bash
   npm run stats  # Ver status do bot
   ```

---

## 📋 RESUMO

**Você fez:**
- ✅ Estratégia adaptativa foi implementada
- ✅ Código integrado em bot.js
- ✅ Configuração otimizada para R$ 30.21

**Próximo passo:**
- ⏳ Reiniciar bot e monitorar por 24h
- ⏳ Validar que parâmetros mudam com tendência
- ⏳ Coletar dados para ajustes

**Tempo para resultado:**
- 5 minutos: Ver logs de ativação
- 1 hora: Ver mudanças de modo
- 24 horas: Dados suficientes para análise
- 7 dias: Validação completa

---

## 🔗 Documentação Detalhada

Para entender cada parâmetro:
- [ESTRATEGIA_ADAPTATIVA_IMPLEMENTADA.md](./ESTRATEGIA_ADAPTATIVA_IMPLEMENTADA.md)
- [.env.adaptive](./.env.adaptive) (referência de configurações)
- [adaptive_strategy.js](./adaptive_strategy.js) (código-fonte)

---

**Última atualização:** Implementação completa e pronta para uso
**Status:** ✅ Pronto para produção
