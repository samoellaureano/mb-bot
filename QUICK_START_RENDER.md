## 🎯 Como Desabilitar Test Runner no Render (5 minutos)

### Passo 1: Acessar Render Dashboard
```
URL: https://dashboard.render.com
```

### Passo 2: Selecionar Serviço
```
Service: mb-bot
(ou clique em https://mb-bot-samoel.onrender.com)
```

### Passo 3: Ir para Settings
```
Sidebar esquerda → Settings
(ou role até encontrar "Environment")
```

### Passo 4: Adicionar Variável
```
Tab: "Environment"
Click: "+ Add Environment Variable"

Nome:  ENABLE_AUTOMATED_TESTS
Valor: false
```

### Passo 5: Salvar e Redeployar
```
Click: "Save Changes"
Aguarde redeployment automático (~1-2 min)
```

---

## ✅ Validação

### Após Redeployar
1. Acesse: https://mb-bot-samoel.onrender.com
2. Abra Console (F12 → Network)
3. Procure por: `/api/tests` ou `/api/data`
4. Verifique logs do Render:
   ```
   ✅ Sem erros 451
   ✅ Log: "Testes automatizados desabilitados"
   ✅ Dashboard carregando normalmente
   ```

### Conferir Logs
```
Render Dashboard → mb-bot → Logs
Procure por:
- ✅ "Dashboard ready at http://localhost:3001"
- ✅ "Testes automatizados desabilitados"
- ✅ "Iniciando ciclo 1, 2, 3..."
```

---

## 🔄 Se Quiser Reativar Depois

```
ENABLE_AUTOMATED_TESTS=true
```

---

## 📝 Notas

- Default (sem env var): `true` = testes ativos
- Render production: `false` = testes desabilitados
- Desenvolvimento local: deixar em branco ou omitir (usa default `true`)
- Sem redownload de código, apenas env var

---

**Tempo estimado**: 5 minutos
**Risco**: Zero (apenas desativa feature não essencial)
**Impacto**: Trading continua normal ✅
