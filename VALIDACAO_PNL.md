# 📊 Guia de Validação de PnL - MB Bot

## Visão Geral

Este guia detalha como validar os cálculos de PnL (Profit and Loss) do MB Bot para garantir precisão tanto em modo simulação quanto em modo live.

## 🔍 Métodos de Validação

### 1. Validação Automática (Durante Execução)

O bot executa validação automática a cada 20 ciclos:

```bash
# Logs do bot mostram a validação
[INFO] Validação PnL OK: Bot=42.56 | DB=42.48 | Diff=0.08 BRL
```

### 2. Validação Manual (Via Comandos)

```bash
# Validação completa com preço atual
npm run validate-pnl

# Teste detalhado de PnL
npm run test-pnl

# Estatísticas básicas 24h
npm run stats

# Últimas ordens
npm run orders
```

### 3. Validação via Dashboard

Acesse `http://localhost:3001` e compare:
- PnL Total mostrado no dashboard
- PnL Realizado vs Não Realizado
- Posição BTC atual
- Histórico de PnL (gráfico)

## 📋 Checklist de Validação

### Para Modo Simulação:
- [ ] PnL é calculado corretamente sem valores hardcoded
- [ ] Posição BTC corresponde aos fills históricos
- [ ] Fees são aplicados corretamente (0.30% maker, 0.70% taker)
- [ ] PnL não realizado usa preço atual do mercado

### Para Modo Live:
- [ ] PnL realizado confere com ordens filled no banco
- [ ] Saldos da API MB conferem com cálculos locais
- [ ] Fees reais são menores que simuladas (ordens maker)
- [ ] Não há discrepâncias superiores a R$ 1,00

## 🔧 Estrutura dos Cálculos

### PnL Realizado
```javascript
// FIFO (First In, First Out)
compras.forEach(ordem => {
    posição += ordem.qty;
    custo_total += (ordem.price * ordem.qty) + fees;
});

vendas.forEach(ordem => {
    preço_médio = custo_total / posição;
    pnl_realizado += (ordem.price - preço_médio) * ordem.qty - fees;
    posição -= ordem.qty;
    custo_total -= preço_médio * ordem.qty;
});
```

### PnL Não Realizado
```javascript
// Apenas se houver posição aberta
if (posição_btc > 0 && custo_base > 0) {
    pnl_nao_realizado = (preço_atual * posição_btc) - custo_base;
}
```

### PnL Total
```javascript
pnl_total = pnl_realizado + pnl_nao_realizado;
roi = (pnl_total / capital_investido) * 100;
```

## ⚠️ Problemas Comuns

### 1. Valores Hardcoded
**Problema:** PnL com valores fixos (42.56, 0.06)
**Solução:** Sempre calcular baseado no histórico real

### 2. Discrepâncias entre Bot e Dashboard
**Problema:** Cálculos diferentes em bot.js e dashboard.js
**Solução:** Usar mesma lógica FIFO em ambos

### 3. Fees Inconsistentes
**Problema:** Usar taxa fixa quando deveria usar da ordem
**Solução:** Sempre usar `ordem.feeRate` quando disponível

### 4. Posição Negativa
**Problema:** `btcPosition < 0` 
**Solução:** Aplicar `Math.max(0, position)` após cálculos

## 📊 Interpretação dos Resultados

### Validação Bem-Sucedida
```bash
✅ Validação PnL OK: Bot=125.45 | DB=125.44 | Diff=0.01 BRL
```
- Diferença < R$ 1,00: Normal (arredondamentos)
- PnL realizado positivo: Estratégia funcionando
- Posição BTC equilibrada: Market making ativo

### Alertas de Atenção
```bash
⚠️  DISCREPÂNCIA DE PnL DETECTADA: Bot=150.00 | DB=145.00 | Diff=5.00 BRL
```
- Diferença > R$ 1,00: Investigar
- Verificar logs recentes para erros
- Comparar com dashboard manualmente

## 🚀 Comandos Úteis

```bash
# Validação rápida
npm run validate-pnl

# Análise completa
npm run test-pnl

# Limpar e recalcular (CUIDADO!)
npm run clean:db
npm run migrate

# Logs em tempo real
tail -f bot.log | grep -E "(PnL|Validação|SUCCESS|ERROR)"

# Estatísticas específicas
node -e "require('./db').validatePnL(650000).then(console.log)"
```

## 🎯 Melhores Práticas

### Durante Desenvolvimento:
1. **Sempre simule por 24h** antes do modo live
2. **Execute `npm run test-pnl`** antes de cada deploy
3. **Compare com dashboard** regularmente
4. **Monitore discrepâncias** maiores que R$ 1,00

### Em Produção:
1. **Validação automática** está ativa (a cada 20 ciclos)
2. **Dashboard em 2ª tela** para monitoramento visual
3. **Logs centralizados** com alertas de discrepância
4. **Backup do banco** antes de mudanças

## 📈 Métricas de Sucesso

- **Discrepâncias < R$ 1,00**: Cálculos precisos
- **PnL realizado positivo**: Estratégia lucrativa  
- **Fill rate > 10%**: Liquidez adequada
- **Fees < 0.5%** do volume: Eficiência operacional

## 🔄 Validação Contínua

O sistema realiza validação contínua através de:
- Verificação automática a cada 20 ciclos
- Comparação com banco de dados
- Logs detalhados de discrepâncias
- Dashboard em tempo real
- Testes manuais via comandos