# 🔌 Configuração de Proxy para Binance

## ⚠️ AVISO
- Proxy é uma **solução de último recurso** (80% de chance de falha)
- Pode violar ToS do Binance
- Adiciona latência (~200-500ms)
- Pode ser detectado e bloqueado

---

## 🔧 Como Configurar Proxy

### Opção 1: Proxy Gratuito (99% vai falhar)

```bash
# .env local
USE_PROXY_FOR_BINANCE=true
HTTP_PROXY_BINANCE=http://proxy-livre.com:8080
```

**Problemas**:
- ❌ Bloqueados em 100% dos casos
- ❌ Muitos são fake/malware
- ❌ Não vale testar

### Opção 2: Proxy Pago (50% pode funcionar)

```bash
# .env ou Render Secrets
USE_PROXY_FOR_BINANCE=true
HTTP_PROXY_BINANCE=http://user:pass@proxy-pago.com:8080
```

**Exemplos de provedores**:
- BrightData (datacenter proxy) - $$$
- Oxylabs (residential proxy) - $$$
- ScraperAPI - $$$
- All-Proxies.com - $$

**Problema**: Caro e pode bloquear igualmente.

### Opção 3: Proxy com Autenticação (em Render)

```
Render Dashboard → Settings → Environment
Add:
  USE_PROXY_FOR_BINANCE=true
  HTTP_PROXY_BINANCE=http://user:pass@proxy.com:8080
```

---

## 🧪 Como Testar Localmente

```bash
# Com proxy desabilitado (default)
npm run dashboard
# Logs mostrarão: "Proxy disponível mas desabilitado"

# Com proxy habilitado
USE_PROXY_FOR_BINANCE=true HTTP_PROXY_BINANCE=http://proxy.com:8080 npm run dashboard
# Logs mostrarão: "Proxy habilitado: http://***:***@proxy.com:8080"
# Se funcionar: "✅ X candles obtidos com sucesso (via proxy)"
```

---

## 📊 O Que Você Vai Ver

### Sem Proxy (Default)
```log
[TEST_RUNNER] [Tentativa 1/3] Buscando 288 candles...
[TEST_RUNNER] ⚠️ Tentativa 1 falhou: Request failed with status code 451
[TEST_RUNNER] [Tentativa 2/3] Buscando 288 candles...
[TEST_RUNNER] ⚠️ Tentativa 2 falhou: Request failed with status code 451
[TEST_RUNNER] ❌ Todas 3 tentativas falharam. Último erro: 451
```

### Com Proxy Funcionando ✅
```log
[TEST_RUNNER] ⚠️ Proxy habilitado: http://***:***@proxy.com:8080
[TEST_RUNNER] [Tentativa 1/3] Buscando 288 candles [PROXY]...
[TEST_RUNNER] ✅ 288 candles obtidos com sucesso (via proxy)
```

### Com Proxy Bloqueado ❌
```log
[TEST_RUNNER] ⚠️ Proxy habilitado: http://***:***@proxy.com:8080
[TEST_RUNNER] [Tentativa 1/3] Buscando 288 candles [PROXY]...
[TEST_RUNNER] ⚠️ Tentativa 1 falhou: ECONNREFUSED (proxy morreu)
[TEST_RUNNER] [Tentativa 2/3] Buscando 288 candles [PROXY]...
[TEST_RUNNER] ⚠️ Tentativa 2 falhou: 403 Forbidden (proxy bloqueou)
[TEST_RUNNER] ❌ Todas 3 tentativas falharam
```

---

## 🎯 Recomendações por Cenário

### Cenário A: "Quero testar rápido"
```bash
# Não use proxy
# Use: ENABLE_AUTOMATED_TESTS=false
# Resultado: Sem erros, sem testes
```

### Cenário B: "Tenho proxy grátis"
```bash
# Testa localmente
USE_PROXY_FOR_BINANCE=true HTTP_PROXY_BINANCE=<seu-proxy> npm run dashboard

# Resultado esperado:
# 1. Roda test runner
# 2. Proxy é bloqueado por Binance em segundos
# 3. Volta a 451
# Tempo: 2 minutos
```

### Cenário C: "Vou pagar por proxy"
```bash
# Usar residential proxy (Oxylabs, BrightData)
# Custo: $10-50/dia
# Chance de sucesso: ~50-70%

# Em .env
USE_PROXY_FOR_BINANCE=true
HTTP_PROXY_BINANCE=http://user:pass@proxy.oxylabs.io:8080

# Deploy no Render
# Via Secrets → Add: HTTP_PROXY_BINANCE
# Resultado: Pode funcionar ou não
```

---

## 🚨 Riscos Importantes

### Risk 1: Detecção por Binance
```
Binance pode:
- Detectar padrão de proxy
- Bloquear sua conta
- Bloquear o proxy
- Retornar 403 (ban permanente)
```

### Risk 2: Latência Extra
```
Sem proxy:    ~200ms
Com proxy:    ~500-1000ms
Impacto:      Trading fica mais lento
```

### Risk 3: Proxy Inseguro
```
Proxy grátis pode:
- Capturar dados
- Inject malware
- Vender dados
- Desaparecer
```

---

## 📋 Checklist de Decisão

```
[ ] Proxy é necessário? (SIM = continue)
    [ ] Tentei com ENABLE_AUTOMATED_TESTS=false? (testes rodam sem proxy)
    [ ] Entendo os riscos? (detecção, latência, segurança)

[ ] Proxy gratuito?
    [ ] Resultado esperado: falha em 2 min
    [ ] Vale testar? (SIM = continue)

[ ] Proxy pago?
    [ ] Custo aceitável? ($)
    [ ] Entendo pode bloquear? (SIM = continue)
    [ ] Tenho backup plan? (usar local cache se falhar)
```

---

## 🔄 Se Proxy Falhar

### Plano B: Cache Local
```
// Baixar dados históricos da Binance AGORA
// Salvar em data/binance_5m_24h.json
// Usar cache como fallback
// Testes rodam offline ✅
```

### Plano C: Dados MB
```
// Usar Mercado Bitcoin em vez de Binance
// Pode funcionar ou pode bloquear tb
// Menos preciso mas é opção
```

### Plano D: Aceitação
```
// Usar ENABLE_AUTOMATED_TESTS=false
// Monitorar trading real via /api/data
// Testes são menos importantes que trading
```

---

## ✅ Conclusão

| Cenário | Ação |
|---------|------|
| **Teste Rápido** | Não use proxy |
| **Proxy Grátis** | Testa em 2 min, vai falhar |
| **Proxy Pago** | Pode funcionar, mas caro e risky |
| **Sem Proxy** | Use ENABLE_AUTOMATED_TESTS=false |

**Recomendação**: Se vai cair mesmo, melhor disable testes e monitor trading real.

---

**Status**: Proxy implementado e configurável, mas 80% chance de falhar.
