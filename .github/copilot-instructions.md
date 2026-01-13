# MB Bot - Market Making Framework

## Architecture Overview

**Core Components:**
- `bot.js`: Main trading engine with market making algorithms
- `dashboard.js`: Express web server for monitoring (port 3001) 
- `db.js`: SQLite database layer for orders and statistics
- `mb_client.js`: Mercado Bitcoin API client with simulation mode
- `backtester.js`: Backtesting engine for strategy validation

**Key Design Patterns:**
- Simulation vs Production modes controlled by `SIMULATE=true/false`
- Cycle-based execution (configurable via `CYCLE_SEC`, default 15s)
- Dynamic parameter adjustment based on market conditions
- Comprehensive logging with chalk color coding and Portuguese messages

## Development Workflows

**Quick Start Commands:**
```bash
npm run dev        # Bot + dashboard in simulation
npm run simulate   # Bot only in simulation
npm run live       # Production trading (DANGER)
npm run dashboard  # Dashboard only
npm run stats      # Database statistics
```

**Testing Flow:**
1. Always test in simulation for 24h before production: `npm run dev`
2. Monitor via dashboard at `http://localhost:3001`
3. Validate with: `npm run stats` and `npm run orders`
4. Use backtesting: `node backtester.js path/to/candles.csv`

## Critical Configuration Patterns

**Environment Variables (.env):**
- `SIMULATE=true` - NEVER deploy without extensive simulation testing
- Spread and order sizing use percentage decimals (0.0006 = 0.06%)
- All BTC amounts in decimal format (0.0001 BTC, not satoshis)
- Fee rates: Maker 0.30%, Taker 0.70% (hardcoded constants)

**Parameter Relationships:**
- `SPREAD_PCT` and `MIN_SPREAD_PCT` work together for dynamic spreads
- `ORDER_SIZE` is percentage of balance, not fixed BTC amount
- Volatility limits (`MIN_VOLATILITY_PCT`, `MAX_VOLATILITY_PCT`) filter trading cycles
- Recovery buffer scales dynamically with market volatility

## Market Making Strategy Logic

**Core Algorithm Flow (runCycle):**
1. Validate orderbook integrity and balances
2. Calculate technical indicators (RSI, EMA, MACD, volatility) 
3. Compute inventory bias and trend bias for price adjustments
4. Calculate dynamic spread based on market depth and volatility
5. Apply "expected profit score" filter before placing orders
6. Manage existing orders (repricing, aging, stop-loss)
7. Update PnL calculations and performance metrics

**Key Trading Concepts:**
- **Inventory Bias**: Adjusts prices to rebalance BTC/BRL holdings
- **Trend Bias**: Slight price adjustment based on market direction
- **Expected Profit Score**: Combines multiple factors to filter low-probability trades
- **Dynamic Recovery Buffer**: Scales position sizing with volatility

## Database Schema & Patterns

**Orders Table Structure:**
- SQLite database in `./database/orders.db`
- Tracks both simulated and real orders with identical schema
- Historical fills stored with weighted analysis for optimization
- Performance statistics cached and updated per cycle

**Common Queries:**
```javascript
await db.getStats({hours: 24});          // 24h performance
await db.getOrders({limit: 20});         // Recent orders
await db.loadHistoricalFills();          // Weighted fill history
```

## API Integration Specifics

**Mercado Bitcoin API Patterns:**
- OAuth2 flow in `mb_client.js` with automatic token refresh
- Rate limiting: 3 requests/second (configurable via `RATE_LIMIT_PER_SEC`)
- Simulation mode provides mock responses without API calls
- Orderbook fetched via public API, trading via authenticated endpoints

**Error Handling:**
- Automatic retry logic for API failures
- Graceful degradation when orderbook data is invalid
- Circuit breaker pattern for excessive volatility periods

## Dashboard Integration

**Real-time Data Flow:**
- WebSocket-like polling every 3 seconds from frontend
- Cache layer with 30s TTL to reduce API load  
- Mobile-responsive design for remote monitoring
- Performance metrics: PnL, ROI, fill rates, uptime

**Key Endpoints:**
- `GET /api/data` - Main dashboard data
- Static files served from `./public/` directory
- Error tracking and request counting built-in

## Monitoring & Debugging

**Log Analysis:**
- Color-coded logs with Portuguese messages
- Structured logging: `[LEVEL] [COMPONENT] message | data`
- Mini-dashboard printed every cycle with key metrics
- Separate log files for bot and dashboard components

**Performance Tracking:**
- Fill rate calculation and trending
- Dynamic parameter optimization every 5 cycles
- Alert system for PnL thresholds and risk limits
- Historical performance analysis for strategy tuning

## Safety Mechanisms

**Risk Controls:**
- Daily loss limits with automatic shutdown
- Position size limits based on volatility
- Order aging and forced cancellation
- Stop-loss and take-profit on individual positions
- Mandatory simulation testing before production

**Validation Layers:**
- Configuration validation on startup
- Orderbook integrity checks before trading
- Balance verification before order placement
- Minimum volume enforcement to prevent dust orders

## Code Conventions

**Naming Patterns:**
- Constants in SCREAMING_SNAKE_CASE with units in comments
- Functions in camelCase with Portuguese log messages
- Database fields use snake_case to match API responses
- Color-coded console output using chalk library

**Error Handling:**
- Try-catch blocks around all async operations
- Graceful degradation rather than crashes
- Detailed error logging with context data
- Process signal handlers for clean shutdown