# 🚀 GUIA PASSO A PASSO - DEPLOY NO RENDER

## ⚠️ AVISO DE SEGURANÇA

**CRÍTICO:** Seu `.env` está com credenciais expostas! Antes de fazer qualquer deploy:

1. **Remova as credenciais do repositório:**
   ```bash
   git rm -r --cached .env
   git commit -m "Remove .env with credentials"
   git push origin main
   ```

2. **Verifique histórico do Git:**
   ```bash
   # Procurar por API_KEY no histórico
   git log --all --full-history -- .env
   ```

3. **Se credenciais já foram comitadas:**
   - Use `git-filter-branch` ou `BFG Repo-Cleaner`
   - Regenere suas credenciais na Mercado Bitcoin
   - **NÃO as use mais no repositório público**

---

## 📋 FASE 1: PREPARAÇÃO LOCAL (30 min)

### 1.1 Limpar Credenciais
```bash
cd ~/seu-projeto/mb-bot

# Remover .env do Git
git rm -r --cached .env
git commit -m "Remove .env from Git tracking"

# Verificar que .env está no .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to .gitignore"
```

### 1.2 Criar .env.example
```bash
# Já foi criado, mas verificar:
ls -la .env.example

# Deve ter template sem valores reais
cat .env.example | head -10
```

### 1.3 Criar Procfile (Render precisa disso)
```bash
# Já foi criado:
cat Procfile
# Output esperado:
# web: npm start
# worker: SIMULATE=false npm run live:bot
```

### 1.4 Criar render.yaml
```bash
# Já foi criado:
cat render.yaml
```

### 1.5 Testar Localmente
```bash
# Remover credenciais temporárias
cp .env .env.backup  # Backup seguro
# Editar .env para usar valores de teste

# Testar em simulação
SIMULATE=true npm run dev

# Se funcionar, parar (CTRL+C)
```

### 1.6 Fazer Commit
```bash
git add -A
git commit -m "Prepare for Render deployment - Remove credentials, add config files"
git push origin main
```

---

## 🌐 FASE 2: CRIAR CONTA RENDER (5 min)

### 2.1 Ir para Render.com
```
https://render.com
```

### 2.2 Fazer Login / Registrar
- Usar GitHub para login (mais fácil)
- Autorizar Render a acessar repositório

### 2.3 Verificar Integração GitHub
- Dashboard → Linked Accounts
- Verificar que GitHub está conectado
- Autorizar se necessário

---

## 🚀 FASE 3: CRIAR WEB SERVICE (10 min)

### 3.1 Ir para Dashboard
```
https://render.com/dashboard
```

### 3.2 Criar Novo Serviço
- Clicar em **"New +"**
- Selecionar **"Web Service"**

### 3.3 Conectar Repositório
- Selecionar **"GitHub"**
- Procurar por **"mb-bot"**
- Clicar em **"Connect"**

### 3.4 Configurar Serviço
```
Name:                mb-bot
Environment:         Node
Region:              Ohio (or São Paulo if available)
Branch:              main
Build Command:       npm install && npm run migrate || true
Start Command:       npm start
Instance Type:       Starter (recomendado $7/mês)
```

### 3.5 Não Faz Deploy Ainda
- Clicar **"Create Web Service"** (mas não deploy)
- Configurar variáveis de ambiente primeiro

---

## 🔐 FASE 4: CONFIGURAR VARIÁVEIS (10 min)

### 4.1 Ir para Environment
- Dashboard → mb-bot service
- Clicar em **"Environment"**

### 4.2 Adicionar Variáveis Críticas
Clicar em **"Add Environment Variable"** para cada uma:

**API_KEY**
```
Key: API_KEY
Value: [Sua chave da Mercado Bitcoin]
```

**API_SECRET**
```
Key: API_SECRET
Value: [Seu secret da Mercado Bitcoin]
```

**Outras Variáveis**
```
SIMULATE=false              (LIVE trading)
USE_CASH_MANAGEMENT=true
PAIR=BTC-BRL
CYCLE_SEC=30
PORT=3001
NODE_ENV=production
```

### 4.3 Salvar
- Clicar em **"Save Changes"**

---

## ✅ FASE 5: DEPLOY (5 min)

### 5.1 Ir para Deployments
- Dashboard → mb-bot
- Clicar em **"Deployments"**

### 5.2 Iniciar Deploy
- Clicar em **"Deploy Latest Commit"**
- Ou: Push automático para GitHub vai triggerar deploy

### 5.3 Monitorar Build
- Render vai:
  1. Clonar repositório
  2. Rodar `npm install`
  3. Rodar `npm run migrate`
  4. Iniciar `npm start`

**Status esperado:**
```
✓ Build started
✓ Running build command
✓ Dependencies installed
✓ Build completed
✓ Service live
```

---

## 🔍 FASE 6: VALIDAÇÃO (10 min)

### 6.1 Ver Logs
- Dashboard → mb-bot
- Clicar em **"Logs"**
- Procurar por:
  ```
  ✅ Bot iniciado
  ✅ Dashboard rodando na porta 3001
  ✅ Conexão com Mercado Bitcoin OK
  ```

### 6.2 Acessar Dashboard
```
https://mb-bot.onrender.com:3001
```

- Se carregar normalmente → ✅ OK
- Se der erro → Ver logs

### 6.3 Testar em Simulação Primeiro
Se quiser testar sem risco:
1. Parar o serviço (⏸ no Render)
2. Alterar `SIMULATE=true` em Environment
3. Reiniciar (▶)
4. Deixar rodar 1 hora
5. Se OK, voltar para `SIMULATE=false`

---

## ⚠️ PROBLEMAS COMUNS

### Problema: Deploy Falha com Erro npm
**Causa:** Dependências faltando  
**Solução:**
```bash
# Local:
npm install
npm run migrate
# Fazer push:
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### Problema: Bot Não Inicia
**Causa:** Variáveis de ambiente faltando  
**Solução:**
- Verificar logs: `ENOENT: no such file or directory`
- Adicionar variável ausente no painel
- Clicar em "Redeploy"

### Problema: Conexão com Mercado Bitcoin Falha
**Causa:** API_KEY ou API_SECRET incorreta  
**Solução:**
1. Verificar valores em Mercado Bitcoin
2. Copiar exatamente (sem espaços extras)
3. Alterar em Render Environment
4. Clicar "Redeploy"

### Problema: Dados Desaparecem
**Causa:** SQLite perde dados em restart  
**Solução:**
- Fazer backup antes de deploy
- Considerar usar PostgreSQL
- Implementar sincronização

---

## 📊 MONITORAMENTO CONTÍNUO

### Verificar Saúde
```bash
# SSH no Render (se habilitado):
# curl https://mb-bot.onrender.com/api/data

# Logs:
# Dashboard → Logs (atualiza em tempo real)

# Status:
# Dashboard → Status (Online/Offline)
```

### Alertas Recomendados
1. **Quando bot parar:** Email/Slack
2. **Quando PnL > limite:** Email
3. **Quando tiver erro:** Dashboard

---

## 🎯 CHECKLIST FINAL

- [ ] Credenciais removidas do .env
- [ ] .env adicionado a .gitignore
- [ ] .env.example criado
- [ ] Procfile criado
- [ ] render.yaml criado
- [ ] Deploy prep script testado
- [ ] Código pusheado para main
- [ ] Conta Render criada
- [ ] Repositório conectado
- [ ] Variáveis de ambiente adicionadas
- [ ] Deploy realizado
- [ ] Logs verificados
- [ ] Dashboard testado
- [ ] Bot rodando em LIVE (ou SIMULATE)

---

## 🟢 STATUS ESPERADO APÓS 5 MINUTOS

```
Dashboard:
├─ Service Status: Live ✅
├─ HTTP Status: OK (200)
├─ Logs: Bot iniciado com sucesso
├─ Memory: 80-150MB
├─ CPU: < 5%
└─ Uptime: 5+ minutes

Web App:
├─ URL: https://mb-bot.onrender.com
├─ Port: 3001
├─ Dashboard: Carregando dados
└─ Bot: Executando ciclos

Bot Status:
├─ Conectado ao Mercado Bitcoin: ✅
├─ Ciclos executados: 10+
├─ Ordens colocadas: Sim
└─ PnL: Sendo rastreado
```

---

## 📞 SUPORTE

Se der erro:
1. **Verificar Logs:** Dashboard → Logs
2. **Conferir Variáveis:** Dashboard → Environment
3. **Testar Localmente:** `SIMULATE=true npm run dev`
4. **Reset:** Clicar "Redeploy" no Render

---

**Tempo Total Estimado:** 1-2 horas (primeira vez)  
**Tempo Futuro:** 5-10 min (updates)

🎉 **Boa sorte com seu deploy!**
