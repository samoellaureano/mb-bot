# Análise de Problemas Identificados - MB Bot

## Data: 05/01/2026

## 1. Problemas Críticos Identificados

### 1.1. Score de Lucro Esperado Sempre Zero
**Problema**: O bot está calculando `expectedProfit = 0.00` em todos os ciclos, impedindo a colocação de ordens.

**Causa Raiz**:
- Linha 284 do bot.js: `expectedProfit = confidence * (trendScore / 3) * (1 + histAnalysis.avgWeightedPnL / midPrice)`
- O valor `histAnalysis.avgWeightedPnL / midPrice` é extremamente pequeno (ex: 6.56 / 507664.50 ≈ 0.000013)
- Multiplicado por confidence baixa (0.25) e trendScore/3 (0.33), resulta em valor próximo a zero
- Após normalização com `Math.min(Math.max(expectedProfit, 0), 1)`, o valor fica em 0.00

**Impacto**: Bot não coloca nenhuma ordem, permanecendo inativo.

### 1.2. Threshold de Lucro Esperado Muito Alto
**Problema**: `EXPECTED_PROFIT_THRESHOLD = 0.05` (5%) é muito alto para a escala do cálculo atual.

**Causa**: O expectedProfit calculado está na escala de 0.00-0.01, enquanto o threshold está em 0.05.

**Impacto**: Mesmo com cálculo corrigido, o bot dificilmente ultrapassará o threshold.

### 1.3. Volatilidade Alta Constante
**Problema**: Volatilidade calculada em 2.50% (máximo configurado), gerando spreads muito largos.

**Observação**:
- Spread calculado: 1.500%
- Buy Price: R$ 493.779,88
- Sell Price: R$ 501.242,54
- Mid Price: R$ 507.664,50
- Diferença de ~R$ 14.000 entre buy e mid price (2.7%)

**Impacto**: Ordens muito distantes do preço de mercado, baixíssima probabilidade de fill.

### 1.4. Saldo Insuficiente
**Problema**: Saldo disponível muito baixo para operar.

**Valores Atuais**:
- BRL: R$ 136,85
- BTC: 0.00001864 BTC (~R$ 9,46)
- Total: ~R$ 146,31

**Impacto**: Tamanho de ordem calculado (0.00000270 BTC ≈ R$ 1,37) é muito pequeno, gerando ordens abaixo do mínimo da exchange.

### 1.5. Interface Web com Valores Estáticos
**Problema**: O arquivo index.html contém valores hardcoded de exemplo que não refletem dados reais.

**Exemplos**:
- Linha 91-97: Ordem de exemplo com ID fixo
- Linha 105-107: Saldos fixos (R$ 393,35, 0.00032331 BTC)
- Linha 125: Order size fixo (0.00005 BTC)

**Impacto**: Dashboard não mostra informações reais do bot em execução.

## 2. Problemas Secundários

### 2.1. Cálculo de Confiança Desbalanceado
- `confidence = 0.3 * rsiConf + 0.25 * emaConf + 0.2 * macdConf + 0.15 * volConf + 0.1 * histConf`
- volConf está incorretamente escalado: `Math.min(volatility / 100, 1)` para volatilidade de 2.50% resulta em 0.025
- Deveria ser: `Math.min(volatility / MAX_VOLATILITY_PCT, 1)`

### 2.2. Tendência Sempre "DOWN"
- RSI em 13.92-31.30 (sobrevenda extrema)
- EMA Curta < EMA Longa
- MACD negativo
- Resultado: trendScore < 1.5, sempre classificado como "down"

### 2.3. Otimização de Parâmetros Ineficaz
- Bot tenta otimizar spread e tamanho baseado em PnL positivo
- Com PnL de apenas R$ 0,09 e sem ordens sendo executadas, a otimização não tem efeito prático

## 3. Recomendações de Melhorias

### 3.1. Correção Imediata (Crítico)
1. **Recalcular expectedProfit com escala apropriada**
   - Usar volatilidade e spread como base principal
   - Remover dependência de avgWeightedPnL/midPrice
   - Fórmula sugerida: `expectedProfit = confidence * (spread / 100) * (1 + volatility / 10)`

2. **Reduzir threshold de lucro esperado**
   - De 0.05 para 0.01 (1%)
   - Ou tornar dinâmico baseado em volatilidade

3. **Ajustar cálculo de spread dinâmico**
   - Reduzir multiplicador de volatilidade
   - Limitar spread máximo a 0.5% em vez de 1.5%
   - Adicionar fator de profundidade do orderbook

### 3.2. Melhorias de Médio Prazo
1. **Implementar gestão de saldo**
   - Alertar quando saldo for insuficiente
   - Ajustar tamanho de ordem baseado em saldo disponível
   - Definir saldo mínimo operacional

2. **Corrigir interface web**
   - Implementar atualização em tempo real via WebSocket ou polling
   - Remover valores hardcoded
   - Adicionar indicadores visuais de status do bot

3. **Melhorar cálculo de tendência**
   - Adicionar mais peso para RSI em zonas extremas
   - Implementar detecção de reversão de tendência
   - Usar timeframes múltiplos

### 3.3. Otimizações de Longo Prazo
1. **Machine Learning para expectedProfit**
   - Treinar modelo baseado em fills históricos
   - Prever probabilidade de fill
   - Otimizar parâmetros automaticamente

2. **Backtesting contínuo**
   - Validar estratégia com dados históricos
   - Ajustar parâmetros baseado em performance
   - Detectar degradação de performance

3. **Gestão de risco avançada**
   - Implementar position sizing dinâmico
   - Stop-loss adaptativo baseado em volatilidade
   - Diversificação de estratégias

## 4. Priorização de Implementação

### Fase 1 (Urgente - Fazer Agora)
- [ ] Corrigir cálculo de expectedProfit
- [ ] Reduzir threshold de lucro esperado
- [ ] Ajustar spread dinâmico para valores realistas
- [ ] Corrigir interface web para mostrar valores reais

### Fase 2 (Importante - Próximos Dias)
- [ ] Implementar gestão de saldo
- [ ] Melhorar cálculo de confiança
- [ ] Adicionar alertas de saldo insuficiente
- [ ] Implementar WebSocket para dashboard em tempo real

### Fase 3 (Desejável - Próximas Semanas)
- [ ] Machine Learning para predição
- [ ] Backtesting contínuo
- [ ] Gestão de risco avançada
- [ ] Múltiplas estratégias paralelas

## 5. Métricas de Sucesso

### Antes das Melhorias
- Ordens colocadas: 0
- Taxa de fill: 0%
- PnL/hora: R$ 0,00
- Score de lucro: 0.00

### Meta Após Melhorias
- Ordens colocadas: > 10/hora
- Taxa de fill: > 5%
- PnL/hora: > R$ 5,00
- Score de lucro: > 0.01 (consistente)
