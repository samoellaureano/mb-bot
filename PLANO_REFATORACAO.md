# 🏗️ PLANO DE REFATORAÇÃO - MB BOT

## 📋 VISÃO GERAL

Refatoração estruturada mantendo:
- ✅ Dashboard funcional
- ✅ Lucros preservados
- ✅ Todas as estratégias ativas
- ✅ Modo LIVE operacional

## 🎯 OBJETIVOS

1. **Organização estrutural** - Modularizar código
2. **Qualidade** - Melhorar manutenibilidade
3. **Manutenção** - Facilitar updates futuros
4. **Performance** - Otimizar execução
5. **Observabilidade** - Melhor logging e monitoramento

## 📁 NOVA ESTRUTURA

```
mb-bot/
├── src/
│   ├── core/                          ← Núcleo de trading
│   │   ├── trading-engine.js          # Motor principal
│   │   ├── order-manager.js           # Gerenciamento de ordens
│   │   ├── market-analyzer.js         # Análise de mercado
│   │   └── risk-manager.js            # Gestão de risco
│   │
│   ├── strategies/                    ← Estratégias
│   │   ├── cash-management.js         # Cash management
│   │   ├── adaptive-strategy.js        # Estratégia adaptativa
│   │   └── momentum-validator.js      # Momentum validation
│   │
│   ├── api/                           ← Integrações
│   │   ├── mercado-bitcoin.js         # Cliente MB
│   │   ├── external-trends.js         # Tendências externas
│   │   └── websocket-handler.js       # WebSocket (futuro)
│   │
│   ├── database/                      ← Persistência
│   │   ├── connection.js              # Conexão SQLite
│   │   ├── models.js                  # Modelos de dados
│   │   ├── queries.js                 # Queries preparadas
│   │   └── migrations.js              # Migrações
│   │
│   ├── utils/                         ← Utilitários
│   │   ├── logger.js                  # Logging estruturado
│   │   ├── config.js                  # Configuração centralizada
│   │   ├── error-handler.js           # Tratamento de erros
│   │   ├── circuit-breaker.js         # Circuit breaker pattern
│   │   ├── validators.js              # Validações
│   │   └── formatters.js              # Formatações
│   │
│   └── dashboard/
│       ├── server.js                  # Express app
│       ├── routes.js                  # Rotas API
│       ├── middleware.js              # Middlewares
│       └── public/ (mantém atual)     # HTML/CSS/JS do frontend
│
├── tests/
│   ├── unit/                          # Testes unitários
│   ├── integration/                   # Testes de integração
│   └── e2e/                           # Testes end-to-end
│
├── docs/                              # Documentação
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── TROUBLESHOOTING.md
│
├── bot.js                             # Entry point (chamará src/core/trading-engine)
├── dashboard.js                       # Entry point (chamará src/dashboard/server)
└── package.json                       # Dependências

```

## 🔄 FASE DE MIGRAÇÃO (4 ETAPAS)

### ✅ FASE 1 - Preparação (Dia 1)
- [ ] Criar estrutura de diretórios
- [ ] Copiar arquivos principais com pequenas adaptações
- [ ] Garantir que bot.js e dashboard.js continuam funcionando
- [ ] Testes de regressão

### ✅ FASE 2 - Core Engine (Dia 2-3)
- [ ] Extrair lógica de trading para `src/core/trading-engine.js`
- [ ] Mover gerenciamento de ordens para `src/core/order-manager.js`
- [ ] Mover análise de mercado para `src/core/market-analyzer.js`
- [ ] Mover gerenciamento de risco para `src/core/risk-manager.js`
- [ ] Preservar 100% da funcionalidade

### ✅ FASE 3 - Estratégias (Dia 4-5)
- [ ] Consolidar estratégias em `src/strategies/`
- [ ] Mover cash-management
- [ ] Mover adaptive-strategy
- [ ] Mover momentum-validator
- [ ] Mover BTC accumulator

### ✅ FASE 4 - Dashboard & Utils (Dia 6-7)
- [ ] Refatorar dashboard para `src/dashboard/`
- [ ] Centralizar utilitários em `src/utils/`
- [ ] Criar testes unitários
- [ ] Documentação completa

## 🔧 BENEFÍCIOS IMEDIATOS

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Manutenibilidade** | Difícil | Fácil |
| **Localização de bugs** | 30 min | 5 min |
| **Adicionar features** | 2h | 15 min |
| **Testes** | Manual | Automatizado |
| **Documentação** | Espalhada | Centralizada |
| **Escalabilidade** | Limitada | Ilimitada |
| **Onboarding** | Confuso | Claro |

## 📊 MÉTRICAS DE SUCESSO

✅ **Funcionalidade**
- [ ] Dashboard responde < 500ms
- [ ] Bot executa ciclos em < 10s
- [ ] Zero ordens perdidas
- [ ] PnL preservado/melhorado

✅ **Qualidade**
- [ ] Cobertura de testes > 70%
- [ ] Sem warnings no linter
- [ ] Documentação > 90% completa
- [ ] Todos os edge cases cobertos

✅ **Performance**
- [ ] Tempo de startup < 5s
- [ ] Memory leak = 0
- [ ] CPU < 10% em idle
- [ ] Database queries < 50ms

## ⚠️ CUIDADOS

1. **Preservar exatamente**:
   - ✅ Lógica de cálculo de PnL
   - ✅ Thresholds de trading
   - ✅ Gerenciamento de risco
   - ✅ Histórico de ordens

2. **Testar em cada etapa**:
   - ✅ Rodar bot em SIMULATE=true
   - ✅ Comparar resultados com versão anterior
   - ✅ Verificar dashboard
   - ✅ Validar banco de dados

3. **Rollback rápido**:
   - ✅ Manter backup de todos os arquivos
   - ✅ Git commit frequente
   - ✅ Branch de feature separada

## 📝 PRÓXIMOS PASSOS

1. ✅ Criar estrutura de diretórios
2. ✅ Mover arquivos de estratégia
3. ✅ Refatorar core engine
4. ✅ Refatorar dashboard
5. ✅ Testes de regressão completos
6. ✅ Deploy em staging
7. ✅ Validação em LIVE por 24h
8. ✅ Documentação final

---

**Status**: 🟡 Planejamento
**Próximo**: Iniciar FASE 1
**Data de início**: Hoje
**Data estimada de conclusão**: 1 semana
