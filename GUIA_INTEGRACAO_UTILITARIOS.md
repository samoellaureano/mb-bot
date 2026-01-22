# 🚀 Guia de Integração - Utilitários Refatorados

## Importação Única

```javascript
// Em qualquer arquivo, importe todos os utilitários de uma vez:
const { 
    config, 
    Logger, 
    Validators, 
    MathUtils, 
    Formatters,
    AppError,
    APIError,
    ValidationError,
    retryAsync,
    OrderType,
    OrderSide,
    FEES
} = require('./src/utils');

// Ou para API:
const { MercadoBitcoinClient } = require('./src/api');
```

---

## Exemplos Práticos

### 1. Usar Configuração

```javascript
const { config } = require('./src/utils');

// Acessar valores
const isSimulate = config.get('SIMULATE');
const spread = config.get('SPREAD_PCT');
const maxPosition = config.get('MAX_POSITION');

// Mostrar relatório
config.report();
```

### 2. Logging Estruturado

```javascript
const { Logger } = require('./src/utils');

const logger = new Logger('TradingEngine');

// Diferentes níveis
logger.debug('Debugando', { value: 123 });
logger.info('Iniciando ciclo', { cycle: 1 });
logger.success('Ordem colocada', { orderId: 'ABC123' });
logger.warn('Aviso de volatilidade', { volatility: 5.2 });
logger.error('Erro crítico', { error: 'msg' });

// Obter métricas
const metrics = logger.getMetrics();
console.log(metrics.errorRate); // "2.5%"
console.log(metrics.total);     // 1234
```

### 3. Validação Automática

```javascript
const { Validators, ValidationError } = require('./src/utils');

try {
    // Validações diferentes
    Validators.btcAmount(0.001);           // OK
    Validators.percentage(50);              // OK
    Validators.price(50000);                // OK
    Validators.orderSide('BUY');            // OK
    
    // Isso vai falhar
    Validators.btcAmount(-0.001);          // throws ValidationError
} catch (error) {
    console.error(`Erro: ${error.message}`);
    console.error(`Campo: ${error.field}`);
}

// Validar estruturas complexas
const order = {
    id: 'ORD123',
    side: 'BUY',
    price: 50000,
    quantity: 0.001,
    timestamp: Date.now()
};

Validators.order(order);  // Valida tudo de uma vez
```

### 4. Cálculos Matemáticos

```javascript
const { MathUtils } = require('./src/utils');

// Indicadores técnicos
const prices = [50000, 50100, 50050, 50200, 50150];
const rsi = MathUtils.rsi(prices, 14);        // 0-100
const ema = MathUtils.ema(prices, 12);        // Preço EMA
const volatility = MathUtils.volatility(prices); // Desvio padrão

// Spread
const spread = MathUtils.spread(50000, 50100); // 0.20%

// PnL
const pnl = MathUtils.pnl(50000, 50100, 0.001, 0.003); // BTC com fee

// Arredondamento
const amount = MathUtils.round(0.0001234567, 8); // 0.00012346
```

### 5. Formatação

```javascript
const { Formatters } = require('./src/utils');

// Moedas
console.log(Formatters.btc(0.00123456));     // "0.00123456"
console.log(Formatters.brl(1500.50));        // "R$ 1.500,50"
console.log(Formatters.percentage(5.5));     // "5.50%"

// Data/Hora
console.log(Formatters.datetime(Date.now())); // "22/01/2025 14:30:45"
console.log(Formatters.duration(3665000));    // "01:01:05"

// Objetos
const order = {
    id: 'ORD123',
    side: 'BUY',
    price: 50000,
    quantity: 0.001,
    timestamp: Date.now()
};

const formatted = Formatters.order(order);
// {
//   id: 'ORD123',
//   side: 'BUY',
//   price: 'R$ 50.000,00',
//   quantity: '0.00100000',
//   total: 'R$ 50,00',
//   timestamp: '22/01/2025 14:30:45',
//   status: 'unknown'
// }
```

### 6. Tratamento de Erro

```javascript
const { ErrorHandler, APIError, ValidationError } = require('./src/utils');

const errorHandler = new ErrorHandler(logger);

// Lançar erro customizado
throw new APIError('API não respondeu', 503, '/orderbook');

// Ou
throw new ValidationError('Preço inválido', 'price');

// Tratar em catch
try {
    // operação
} catch (error) {
    const handled = errorHandler.handle(error, { orderId: 'ABC' });
    
    // Verificar se é retryable
    if (errorHandler.isRetryable(error)) {
        // Fazer retry
    }
    
    // Ver estatísticas
    const stats = errorHandler.getStats();
    console.log(stats.byCode.API_ERROR); // Contagem de API errors
}
```

### 7. Retry Automático

```javascript
const { retryAsync } = require('./src/utils');

// Fazer retry automático
const result = await retryAsync(
    async () => {
        // Sua operação que pode falhar
        return await apiClient.getOrderbook();
    },
    {
        maxRetries: 3,
        delay: 1000,           // 1 segundo
        backoff: 2,             // Dobra a cada retry
        onRetry: (attempt, error, waitTime) => {
            console.log(`Tentativa ${attempt}, aguardando ${waitTime}ms`);
        },
        shouldRetry: (error) => {
            // Só retry em erros específicos
            return error.response?.status >= 500;
        }
    }
);
```

### 8. Cliente API

```javascript
const { MercadoBitcoinClient } = require('./src/api');
const { config } = require('./src/utils');

// Criar cliente
const client = new MercadoBitcoinClient({
    simulate: config.get('SIMULATE'),
    pair: config.get('PAIR')
});

// Operações
const orderbook = await client.getOrderbook();
const ticker = await client.getTicker();
const balance = await client.getBalance();

// Colocar ordem
const order = await client.placeOrder('BUY', 0.001, 50000);

// Cancelar ordem
await client.cancelOrder(order.id);

// Histórico
const history = await client.getOrderHistory(100);
```

---

## Integração em bot.js (Exemplo)

```javascript
// Topo do bot.js
const {
    config,
    Logger,
    Validators,
    MathUtils,
    Formatters,
    APIError,
    ValidationError,
    OrderSide
} = require('./src/utils');

const { MercadoBitcoinClient } = require('./src/api');

// Inicializar
const logger = new Logger('TradingBot');
const client = new MercadoBitcoinClient();

// No início do ciclo
async function runCycle() {
    try {
        logger.info('Iniciando ciclo', { cycle: cycleCount });
        
        // Obter dados
        const orderbook = await client.getOrderbook();
        
        // Validar
        Validators.orderbook(orderbook);
        
        // Calcular indicadores
        const spread = MathUtils.spread(orderbook.bids[0][0], orderbook.asks[0][0]);
        const volatility = MathUtils.volatility(priceHistory);
        
        // Verificar limites
        if (volatility > config.get('MAX_VOLATILITY_PCT')) {
            logger.warn('Volatilidade muito alta', { volatility });
            return;
        }
        
        // Colocar ordem
        const qty = Math.min(
            config.get('MAX_ORDER_SIZE'),
            (balance.brl * config.get('ORDER_SIZE')) / orderbook.asks[0][0]
        );
        
        Validators.btcAmount(qty);
        
        const order = await client.placeOrder(OrderSide.BUY, qty, orderbook.bids[0][0]);
        logger.success('Ordem colocada', {
            orderId: order.id,
            side: order.side,
            qty: Formatters.btc(order.quantity),
            price: Formatters.brl(order.price)
        });
        
    } catch (error) {
        if (error instanceof APIError) {
            logger.error('Erro na API', { endpoint: error.endpoint });
        } else if (error instanceof ValidationError) {
            logger.error('Validação falhou', { field: error.field });
        } else {
            logger.error('Erro desconhecido', { error: error.message });
        }
    }
}
```

---

## Checklist de Integração

Ao integrar os utilitários:

- [ ] Atualizar imports em bot.js
- [ ] Atualizar imports em dashboard.js
- [ ] Atualizar imports em db.js
- [ ] Testar carregamento de configuração
- [ ] Testar logging em cada componente
- [ ] Testar validações antes de operações críticas
- [ ] Testar cliente API em SIMULATE mode
- [ ] Testar cálculos matemáticos
- [ ] Testar formatação de output
- [ ] Rodar em SIMULATE mode por 1 hora
- [ ] Verificar se lucros são mantidos
- [ ] Verificar se dashboard responde normalmente

---

## Migração Gradual (Recomendado)

1. **Dia 1:** Integrar apenas `config` e `logger`
   - Verificar se bot inicia normalmente
   - Verificar logs em arquivo

2. **Dia 2:** Integrar `Validators` e `MathUtils`
   - Usar validators em operações críticas
   - Verificar se cálculos estão corretos

3. **Dia 3:** Integrar `Formatters` e `types`
   - Dashboard usa formatters para display
   - Use enums em decisões

4. **Dia 4:** Integrar cliente API
   - Teste em SIMULATE mode
   - Depois em modo AUTH

5. **Dia 5:** Refactorização final
   - Limpar código antigo
   - Teste final em LIVE mode

---

## FAQ

**P: Posso usar os antigos mb_client.js e db.js ao mesmo tempo?**  
R: Sim! A refatoração é não-breaking. Você pode usar gradualmente.

**P: Como manter os lucros preservados?**  
R: Os cálculos matemáticos são idênticos - apenas reorganizados. Os lucros não mudam.

**P: E se algo quebrar?**  
R: Todos os utilitários têm testes automáticos e validação rigorosa. Risco é muito baixo.

**P: Posso reverter?**  
R: Sim, o código antigo continua funcionando. Você pode voltar a qualquer momento.
