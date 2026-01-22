# ⚠️ ANÁLISE DE DEPLOY - MB-BOT para RENDER

## 🚨 PROBLEMA CRÍTICO ENCONTRADO

### Credenciais Expostas
```
❌ API_KEY e API_SECRET estão no .env em plain text
❌ .env está sendo versionado no Git
❌ Credenciais podem ser comprometidas se repositório for público
```

**RISCO:** Qualquer pessoa com acesso ao repo pode ver suas credenciais e roubar sua conta!

---

## ✅ O QUE ESTÁ BOM PARA DEPLOY

| Item | Status | Observação |
|------|--------|-----------|
| package.json | ✅ OK | Todas as dependências definidas |
| node --version | ✅ OK | Node.js v20.19.5 |
| Banco de dados | ✅ OK | SQLite (local, funciona no Render) |
| Express.js | ✅ OK | Servidor web na porta 3001 |
| npm scripts | ✅ OK | Bot + Dashboard configurados |
| .git | ✅ OK | Repositório versionado |
| Procfile | ❌ FALTA | Instruções para Render |
| render.yaml | ❌ FALTA | Configuração do Render |
| .env.example | ❌ FALTA | Template de variáveis |
| .gitignore | ❌ INCOMPLETO | Não ignora .env |

---

## 🔴 PROBLEMAS PARA DEPLOY NO RENDER

### 1. Credenciais Expostas (CRÍTICO)
```
❌ API_KEY visível no .env
❌ API_SECRET visível no .env
❌ Se repositório for público = Comprometido

Solução:
- Remover credenciais do .env
- Usar variáveis de ambiente no Render
- Adicionar .env ao .gitignore
```

### 2. Banco de Dados SQLite
```
⚠️ SQLite funciona no Render, MAS:
  - Arquivo database/orders.db é local
  - Render tem filesystem efêmero (reseta a cada deploy)
  - Dados podem ser perdidos após restart

Soluções Opcionais:
- Usar PostgreSQL no Render
- Usar MongoDB Atlas
- Fazer backup do DB antes de deploy
```

### 3. API de Mercado Bitcoin
```
⚠️ Precisa de autenticação OAuth2
  - Tokens expiram após 1 hora
  - Refresh tokens funcionam
  - Precisa manter sessão ativa

Possível Problema:
- Se bot reiniciar no Render, perde token
- Pode gerar erro na primeira operação
- Solução: Implementar refresh automático (já existe)
```

### 4. Performance & Recursos
```
⚠️ Render Free Tier:
  - CPU compartilhada
  - Memória limitada (512MB)
  - Pode ser lento para múltiplos ciclos

Bot precisa de:
  - ~50-100MB RAM (com dashboard)
  - CPU mínima (ciclos de 15-30s)
  - Conexão estável com Internet

Recomendação: Starter Plan ($7/mês) ou Superior
```

### 5. Logging & Monitoramento
```
⚠️ Logs no Render:
  - Ficheiros locais não persistem
  - Render tem stdout/stderr (bom)
  - Dashboard vai funcionar

Precisa:
  - Logs enviados para stdout (já faz)
  - Integração com LogRocket ou similar (opcional)
```

---

## 📋 CHECKLIST PARA DEPLOY

### Antes de Fazer Deploy

#### Segurança (CRÍTICO)
- [ ] Remover credenciais do .env
- [ ] Criar .env.example sem valores reais
- [ ] Adicionar .env ao .gitignore
- [ ] Atualizar git (remover histórico de .env se necessário)
  ```bash
  git rm -r --cached .env
  git commit -m "Remove .env from tracking"
  ```
- [ ] Verificar que não há credenciais no código
  ```bash
  grep -r "API_KEY" . --include="*.js"
  ```

#### Configuração do Render
- [ ] Criar arquivo `Procfile`:
  ```
  web: npm start
  ```
- [ ] Criar arquivo `render.yaml`:
  ```yaml
  services:
    - type: web
      name: mb-bot
      env: node
      plan: starter
      buildCommand: npm install
      startCommand: npm start
      envVars:
        - key: API_KEY
          sync: false
        - key: API_SECRET
          sync: false
  ```
- [ ] Criar arquivo `build.sh`:
  ```bash
  npm install
  npm run migrate || true
  ```

#### Banco de Dados
- [ ] Decidir: SQLite local ou PostgreSQL?
- [ ] Se usar PostgreSQL:
  ```bash
  npm install pg
  ```
  Configurar DATABASE_URL no Render

- [ ] Se usar SQLite:
  ```bash
  # Criar pasta se não existir
  mkdir -p database
  ```

#### Variáveis de Ambiente
- [ ] Definir no painel do Render:
  ```
  API_KEY=*** (valor seguro)
  API_SECRET=*** (valor seguro)
  SIMULATE=false (ou true para teste)
  PAIR=BTC-BRL
  PORT=3001
  NODE_ENV=production
  ```

#### Testes Antes de Deploy
- [ ] Rodar testes locais:
  ```bash
  npm run test:24h
  ```
- [ ] Validar bot em simulação:
  ```bash
  SIMULATE=true npm run dev
  ```
- [ ] Verificar dashboard:
  ```
  curl http://localhost:3001
  ```

### Deploy no Render

1. **Push para GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Conectar Render ao GitHub**
   - Ir a render.com
   - Criar novo "Web Service"
   - Selecionar repositório
   - Sincronizar com branch `main`

3. **Configurar Variáveis de Ambiente**
   - No painel do Render, ir a "Environment"
   - Adicionar cada variável do .env
   - **NUNCA** colocar valores hardcoded

4. **Deploy Automático**
   - Render vai fazer build automaticamente
   - Vai rodar `npm install` e `npm start`
   - Bot vai iniciar

5. **Monitorar**
   - Acessar logs no painel
   - Verificar se bot está rodando
   - Testar dashboard em: `https://seu-app.onrender.com:3001`

---

## ⚠️ PROBLEMAS POTENCIAIS NO RENDER

### 1. Bot Parar de Rodar
```
Causa: Timeout, crash, ou memory leak
Sintoma: Logs mostram erro ou silêncio
Solução: 
- Aumentar plano (mais memória)
- Revisar logs
- Usar pm2 para auto-restart
```

### 2. Dados Perdidos
```
Causa: SQLite perder dados após restart
Sintoma: Ordens desaparecem do database
Solução:
- Fazer backup regular do DB
- Usar PostgreSQL
- Implementar sincronização com GitHub
```

### 3. Conexão com Mercado Bitcoin
```
Causa: Token expirado ou IP bloqueado
Sintoma: Erro 401 ou 403
Solução:
- Verificar token refresh
- Aumentar rate limit
- Implementar retry logic
```

### 4. Performance Lenta
```
Causa: CPU compartilhada no Render
Sintoma: Ciclos demorando >60s
Solução:
- Aumentar plano
- Otimizar código
- Reduzir frequência de testes
```

---

## 🎯 PASSOS RECOMENDADOS

### Fase 1: Preparar (Hoje)
1. ✅ Remover credenciais do repo
2. ✅ Criar .env.example
3. ✅ Testar localmente com variáveis de ambiente
4. ✅ Criar Procfile e render.yaml

### Fase 2: Deploy Teste (Amanhã)
1. ✅ Fazer deploy em Render com SIMULATE=true
2. ✅ Testar dashboard funciona
3. ✅ Testar logs aparecem
4. ✅ Deixar rodar 1 hora

### Fase 3: Deploy Produção (Depois)
1. ✅ Alterar SIMULATE=false no Render
2. ✅ Adicionar credenciais seguras
3. ✅ Monitorar primeiras 24 horas
4. ✅ Implementar alertas

---

## 📊 ESTIMATIVA DE CUSTO

| Serviço | Gratuito | Starter | Recomendado |
|---------|----------|---------|------------|
| Render Web | PARADO | $7/mês | $12/mês |
| PostgreSQL | Não | $10/mês | $15/mês |
| Logs/Monitoring | Básico | $5/mês | $10/mês |
| **Total** | **$0** | **$17/mês** | **$37/mês** |

**Nota:** Render Free pausa apps após inatividade. Não recomendado para bot em produção.

---

## ✅ RESUMO FINAL

### Vai Funcionar?
- ✅ Com as devidas preparações, SIM
- ❌ Assim como está (com credenciais expostas), NÃO é seguro

### Recomendações
1. **URGENTE:** Remover credenciais do repo
2. **IMPORTANTE:** Usar variáveis de ambiente no Render
3. **IMPORTANTE:** Escolher plano pago (Starter mínimo)
4. **RECOMENDADO:** Usar PostgreSQL para persistência
5. **RECOMENDADO:** Implementar backup automático

### Tempo Estimado
- Preparação: 30-60 min
- Deploy: 10 min
- Testes: 1-2 horas
- **Total:** 2-3 horas

---

**Status:** ⚠️ POSSÍVEL COM PREPARAÇÃO  
**Nível de Dificuldade:** Médio  
**Risco de Falha:** Alto sem preparação, Baixo com preparação
