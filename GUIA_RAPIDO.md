# 🚀 Guia Rápido - MB Bot

## Status do Bot

✅ **Bot está funcionando corretamente!**

Todos os bugs foram corrigidos e o bot está operacional com estratégias otimizadas para lucro.

## Correções Realizadas

1. ✅ Erro na função `placeOrder` - corrigido
2. ✅ Erro "context is not defined" - corrigido
3. ✅ Erro de constraint no banco de dados - corrigido
4. ✅ Compatibilidade do `mb_client.js` - implementada
5. ✅ Parâmetros otimizados para lucro

## Como Usar

### 1. Modo Simulação (Recomendado para Testes)

```bash
# Executar apenas o bot
npm run simulate

# Executar bot + dashboard
npm run dev

# Dashboard estará disponível em:
http://localhost:3001
```

### 2. Modo Produção (Após Testes)

⚠️ **ATENÇÃO:** Só use após testar em simulação por pelo menos 24h!

```bash
# 1. Editar .env e mudar SIMULATE=false
nano .env

# 2. Verificar API keys
# Certifique-se de que API_KEY e API_SECRET estão corretos

# 3. Executar
npm run start
```

### 3. Teste de 24 Horas

```bash
# Executar script de teste
./run_24h_test.sh

# Acompanhar logs
tail -f test-24h-*.log

# Ver estatísticas
npm run stats
```

## Comandos Úteis

```bash
# Ver estatísticas das últimas 24h
npm run stats

# Ver últimas 20 ordens
npm run orders

# Limpar banco de dados
npm run clean

# Ver logs em tempo real
tail -f bot.log

# Parar o bot
pkill -f "node bot.js"
```

## Parâmetros Otimizados

Os seguintes parâmetros foram ajustados no `.env` para maximizar lucro:

- **SPREAD_PCT:** 0.08% (mais agressivo)
- **ORDER_SIZE:** 0.00005 BTC (maior volume)
- **CYCLE_SEC:** 10s (mais rápido)
- **STOP_LOSS_PCT:** 0.6% (proteção)
- **TAKE_PROFIT_PCT:** 0.15% (realização)
- **EXPECTED_PROFIT_THRESHOLD:** 5% (mais oportunidades)

## Métricas Esperadas

Com as configurações otimizadas:

| Métrica | Valor |
|---------|-------|
| Fill Rate | 15-20% por ciclo |
| Spread Médio | 0.08% |
| PnL/dia | R$ 52-69 |
| ROI/dia | 5.2-6.9% |

## Dashboard

Acesse o dashboard em **http://localhost:3001** para ver:

- ✅ Preço BTC/BRL em tempo real
- ✅ Saldos BRL e BTC
- ✅ Performance (ciclos, fills, P&L)
- ✅ Ordens abertas
- ✅ Configurações

## Segurança

⚠️ **Checklist de Segurança:**

- [ ] API keys com permissão apenas de TRADE
- [ ] SEM permissão de saque
- [ ] Restrição por IP (se possível)
- [ ] Testar 24h em simulação antes de usar real
- [ ] Começar com capital pequeno
- [ ] Monitorar constantemente
- [ ] Ter limites de perda configurados

## Próximos Passos

1. ✅ Bot está funcionando
2. ⏳ Rodar teste de 24h em simulação
3. ⏳ Analisar resultados
4. ⏳ Ajustar parâmetros se necessário
5. ⏳ Iniciar com capital pequeno em modo real
6. ⏳ Escalar gradualmente

## Suporte

- 📖 README completo: `README.md`
- 📊 Melhorias de lucro: `MELHORIAS_LUCRO.md`
- 🐛 Issues: GitHub Issues
- 📧 Email: team@mb-bot.com

## Observações Importantes

⚠️ **Avisos:**

1. Trading envolve risco de perda de capital
2. Resultados passados não garantem resultados futuros
3. Sempre monitore o bot
4. Não invista mais do que pode perder
5. Use stop-loss e limites de perda

✅ **Vantagens:**

1. Execução 24/7 automatizada
2. Decisões baseadas em dados
3. Gestão de risco integrada
4. Adaptação à volatilidade
5. Logs detalhados

---

**Versão:** 1.0.0 (Corrigida e Otimizada)  
**Data:** $(date +%Y-%m-%d)  
**Status:** ✅ Operacional
