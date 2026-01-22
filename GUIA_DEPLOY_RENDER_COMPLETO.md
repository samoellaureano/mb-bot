# 🚀 GUIA COMPLETO - DEPLOY NO RENDER

## 📋 Pré-requisitos

✅ **Já Feito:**
- Repositório GitHub: `samoellaureano/mb-bot`
- Código commitado localmente
- `.env` protegido (não versionado)
- `.env.example` criado com placeholders

❌ **Faltam:**
- [ ] GitHub Personal Access Token
- [ ] Conta no Render
- [ ] Variáveis de ambiente configuradas

---

## 🔐 PASSO 1: Criar GitHub Personal Access Token

### No GitHub:
1. Ir para: **https://github.com/settings/tokens**
2. Clicar em **"Generate new token"** → **"Generate new token (classic)"**
3. Nome: `render-deploy`
4. Expiração: `90 days`
5. Selecionar **escopos:**
   - ✅ `repo` (acesso completo a repositórios)
   - ✅ `workflow` (atualizar arquivos de workflow)

6. Clicar em **"Generate token"**
7. **COPIAR o token** (só aparece uma vez!)

### Guardar:
```
Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📱 PASSO 2: Criar Conta no Render

### No Render:
1. Ir para: **https://render.com**
2. Clicar em **"Sign up"**
3. Opções:
   - [ ] GitHub (recomendado - autentica direto)
   - [ ] Email

4. Se escolher GitHub:
   - Autorizar o Render a acessar seus repositórios
   - Conecta automaticamente

---

## 📚 PASSO 3: Criar Novo Serviço Web

### Dashboard Render → New → Web Service

1. **Conectar repositório GitHub:**
   - Clicar em "GitHub"
   - Buscar por: `mb-bot`
   - Conectar repositório

2. **Configurar Serviço:**

| Campo | Valor |
|-------|-------|
| **Name** | `mb-bot` |
| **Region** | `Ohio` (US) ou `Frankfurt` (EU) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm run live` |
| **Plan** | `Free` (gratuito) ou `Starter` (pago) |

3. Clicar em **"Create Web Service"**

---

## 🔑 PASSO 4: Configurar Variáveis de Ambiente

### No painel do Render (após criar o serviço):

1. Ir para a aba **"Environment"**
2. Clicar em **"Add Environment Variable"**

### Adicionar cada variável do `.env.example`:

```
API_KEY = bdb29a91224172614611c41f27962b9896f5474745136f5464d4d8a2a788838e
API_SECRET = e14075f110222ae15a5f73bdd427246ea5096dfd48a89f1c6d089b2c66aaf98b
SIMULATE = false
USE_CASH_MANAGEMENT = true
USE_SWING_TRADING = false
PAIR = BTC-BRL
CYCLE_SEC = 30
PORT = 3001
DEBUG = true
... (todas as outras variáveis)
```

### ⚠️ IMPORTANTE:
- A porta será automaticamente atribuída pelo Render
- PORT=3001 é lido, mas o Render sobrescreve com PORT da variável `PORT` interna
- O Render usa `$PORT` automaticamente

3. Clicar em **"Save"**

---

## ✅ PASSO 5: Fazer Push para GitHub

### No seu PC (WSL/Terminal):

```bash
# Primeiro, você precisa de um token
# 1. Vá em: https://github.com/settings/tokens
# 2. Generate new token (classic)
# 3. Copie o token

# No terminal:
cd /mnt/c/PROJETOS_PESSOAIS/mb-bot

# Configure Git para usar token (substituir TOKEN pelo seu):
git config --global credential.helper store

# Próximo push pedirá username e password
# Username: seu_username_github
# Password: cole_aqui_o_token_gerado

git push origin main
```

### Ou via SSH (mais seguro):

```bash
# 1. Gerar chave SSH (se não tiver):
ssh-keygen -t ed25519 -C "seu_email@example.com"

# 2. Copiar chave pública:
cat ~/.ssh/id_ed25519.pub

# 3. No GitHub → Settings → SSH and GPG keys → New SSH key
# Colar a chave

# 4. Adicionar SSH ao Git:
git remote set-url origin git@github.com:samoellaureano/mb-bot.git

# 5. Push:
git push origin main
```

---

## 🔄 PASSO 6: Render Faz Deploy Automaticamente

Quando você fizer push:

1. ✅ GitHub recebe o código
2. ✅ Render detecta mudança (webhook automático)
3. ✅ Render faz build:
   - Clona repositório
   - Roda `npm install`
4. ✅ Render inicia serviço:
   - Roda `npm run live`
   - Bot começa a operar em LIVE

### Monitorar Deploy:

No painel Render:
- Ir para seu serviço `mb-bot`
- Aba **"Logs"**
- Ver output em tempo real

```
=== Build Output ===
npm install...
added 50 packages...

=== Service Started ===
Bot iniciando...
✅ LIVE Trading Ativado
```

---

## 📊 PASSO 7: Verificar Status do Bot

### URL do Bot:

```
https://mb-bot-XXXX.onrender.com
```

(Render gera URL automática, ou você pode custom domain)

### Dashboard em LIVE:

```
https://mb-bot-XXXX.onrender.com:3001
```

### Verificar Logs:

```bash
# Ver logs em tempo real no Render
# Dashboard → Logs (em tempo real)

# Ou acessar via API:
curl https://mb-bot-XXXX.onrender.com/api/data
```

---

## ⚠️ LIMITAÇÕES DO RENDER (Free Plan)

| Limite | Free | Starter (Pago) |
|--------|------|-----------------|
| Uptime | 99.9% | 99.99% |
| CPU | Compartilhado | Dedicado |
| RAM | 512 MB | 1 GB+ |
| Autosleep | **SIM** (após 15 min inativo) | Não |
| Preço | **$0** | $12/mês |
| Banda | 100 GB/mês | 1 TB/mês |

### ⚠️ Problema: Autosleep no Render Free

O bot vai "dormir" após 15 minutos sem requisições:

**Solução 1:** Comprar plano Starter ($12/mês)

**Solução 2:** Uptime checker (enviar ping a cada 10 min)
```bash
# Usar serviço como: https://uptimerobot.com
# Configurar para fazer GET a: https://mb-bot-XXXX.onrender.com/api/data
# A cada 10 minutos
```

**Solução 3:** Usar outro servidor (AWS, Heroku, DigitalOcean)

---

## 🔄 ATUALIZAÇÕES FUTURAS

### Para atualizar o bot em LIVE:

```bash
# 1. Fazer alterações localmente
vim cash_management_strategy.js

# 2. Fazer commit
git add .
git commit -m "Atualizar estratégia"

# 3. Fazer push
git push origin main

# 4. Render detecta mudança automaticamente
# - Faz novo build
# - Para serviço anterior
# - Inicia novo serviço
# Deploy leva ~2-3 minutos
```

### Nenhuma ação manual no Render necessária! ✅

---

## 🚨 TROUBLESHOOTING

### Bot não inicia no Render

**Problema:** Erros nos logs

```
Error: Cannot find module 'better-sqlite3'
```

**Solução:** Adicionar ao `package.json`:
```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0"
  }
}
```

Depois fazer push novamente.

### Bot inicia mas não está operando

**Problema:** Logs sem erro mas sem ciclos

**Causas:**
- Variáveis de ambiente faltando
- API_KEY/SECRET inválidas
- Port errada

**Solução:**
1. Verificar `.env` do Render → Environment
2. Testar credenciais: `curl https://api.mercadobitcoin.com.br/api/v4/ticker/BTC/BRL`
3. Ver logs: `Dashboard → Logs`

### App reinicia continuamente

**Problema:** Crash loop

**Logs:**
```
Error: API connection failed
Restarting...
Error: API connection failed
```

**Solução:**
- Verificar conectividade com Mercado Bitcoin
- Verificar firewall/proxy
- Usar VPN se necessário
- Aumentar timeout em `mb_client.js`

---

## 📋 Checklist Final

- [ ] GitHub Personal Access Token criado
- [ ] Token guardado em local seguro
- [ ] Conta Render criada
- [ ] Web Service criado no Render
- [ ] Variáveis de ambiente configuradas
- [ ] Git push feito com token/SSH
- [ ] Build bem-sucedido no Render
- [ ] Logs mostrando "✅ Bot iniciado"
- [ ] Dashboard acessível: `https://mb-bot-XXXX.onrender.com`
- [ ] Primeira operação em LIVE no Render confirmada

---

## 🎯 Próximos Passos

1. **Imediato:**
   - [ ] Criar Token GitHub
   - [ ] Criar conta Render
   - [ ] Fazer push

2. **Curto Prazo:**
   - [ ] Monitorar bot por 24h
   - [ ] Verificar operações
   - [ ] Confirmar PnL

3. **Longo Prazo:**
   - [ ] Avaliar plano Free vs Starter
   - [ ] Configurar uptime monitor se usar Free
   - [ ] Implementar alertas de erro

---

## 📞 Suporte

Se algo não funcionar:

1. Ver logs no Render
2. Comparar com logs locais
3. Testar em simulação primeiro
4. Verificar API_KEY/SECRET
5. Verificar conectividade rede

---

**Você está pronto para fazer deploy! 🚀**

Quer que eu ajude com algum passo específico?
