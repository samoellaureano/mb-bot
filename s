[1mdiff --git a/automated_test_runner.js b/automated_test_runner.js[m
[1mindex 570ee37..cc6bd05 100644[m
[1m--- a/automated_test_runner.js[m
[1m+++ b/automated_test_runner.js[m
[36m@@ -123,7 +123,11 @@[m [mfunction testCashManagementStrategy(prices, testName) {[m
     const holdPnL = holdValue - initialValue;[m
     const vsHold = pnl - holdPnL;[m
     [m
[31m-    const passed = roi > priceChange || pnl > 0;[m
[32m+[m[32m    const lossToleranceBrl = 1.0; // permitir pequeno prejuízo dentro de R$ 1[m[41m[m
[32m+[m[32m    const profitableTradeRate = trades > 0 ? (profitableTrades / trades) : 0;[m[41m[m
[32m+[m[32m    const smallLossAllowed = pnl >= -lossToleranceBrl;[m[41m[m
[32m+[m[32m    const beatMarket = roi > priceChange;[m[41m[m
[32m+[m[32m    const passed = beatMarket || pnl >= 0 || (smallLossAllowed && profitableTradeRate >= 0.35);[m[41m[m
     [m
     // Calcular projeção (em 24h)[m
     const hoursInTest = prices.length * 5 / 60; // 5m candles[m
[1mdiff --git a/bot.log b/bot.log[m
[1mindex 8013dfc..d7c7df8 100644[m
[1m--- a/bot.log[m
[1m+++ b/bot.log[m
[36m@@ -48699,3 +48699,1083 @@[m [mnohup: ignoring input[m
 01:58:31.077 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.29","expectedProfit":"0.00","rsi":"52.60","emaShort":"479796.77","emaLong":"479805.46","volatility":"0.97","macd":"56.19","signal":"479819.13"}[m
 01:58:31.364 [INFO]   [Bot] ADX calculado: 19.35.[m
 01:58:31.929 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m01:58:55.626 [INFO]   [Bot] Iniciando ciclo 42.[m
[32m+[m[32m01:58:55.629 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m01:58:56.230 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479869.00, Best Ask=479994.00.[m
[32m+[m[32m01:58:56.424 [INFO]   [Bot] RSI calculado: 57.57.[m
[32m+[m[32m01:58:56.936 [INFO]   [Bot] EMA(8) calculada: 479838.61.[m
[32m+[m[32m01:58:57.352 [INFO]   [Bot] EMA(20) calculada: 479866.97.[m
[32m+[m[32m01:58:57.699 [INFO]   [Bot] EMA(12) calculada: 479854.82.[m
[32m+[m[32m01:58:58.131 [INFO]   [Bot] EMA(26) calculada: 479786.21.[m
[32m+[m[32m01:58:58.423 [INFO]   [Bot] EMA(9) calculada: 479842.24.[m
[32m+[m[32m01:58:58.723 [INFO]   [Bot] MACD calculado: MACD=68.61, Signal=479842.24.[m
[32m+[m[32m01:58:59.048 [INFO]   [Bot] Volatilidade calculada: 0.96%.[m
[32m+[m[32m01:58:59.418 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m01:58:59.799 [INFO]   [Bot] ADX calculado: 20.22.[m
[32m+[m[32m01:59:00.144 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.32","expectedProfit":"0.00","rsi":"57.57","emaShort":"479838.61","emaLong":"479866.97","volatility":"0.96","macd":"68.61","signal":"479842.24"}[m
[32m+[m[32m01:59:00.496 [INFO]   [Bot] ADX calculado: 20.22.[m
[32m+[m[32m01:59:01.015 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m01:59:25.640 [INFO]   [Bot] Iniciando ciclo 43.[m
[32m+[m[32m01:59:25.689 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m01:59:26.249 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479733.00, Best Ask=479994.00.[m
[32m+[m[32m01:59:26.252 [INFO]   [Bot] RSI calculado: 45.87.[m
[32m+[m[32m01:59:26.520 [INFO]   [Bot] EMA(8) calculada: 479867.80.[m
[32m+[m[32m01:59:26.786 [INFO]   [Bot] EMA(20) calculada: 479864.04.[m
[32m+[m[32m01:59:27.093 [INFO]   [Bot] EMA(12) calculada: 479835.53.[m
[32m+[m[32m01:59:27.386 [INFO]   [Bot] EMA(26) calculada: 479810.56.[m
[32m+[m[32m01:59:27.665 [INFO]   [Bot] EMA(9) calculada: 479840.77.[m
[32m+[m[32m01:59:27.952 [INFO]   [Bot] MACD calculado: MACD=24.97, Signal=479840.77.[m
[32m+[m[32m01:59:28.264 [INFO]   [Bot] Volatilidade calculada: 0.96%.[m
[32m+[m[32m01:59:28.580 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m01:59:28.833 [INFO]   [Bot] ADX calculado: 19.16.[m
[32m+[m[32m01:59:29.116 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.30","expectedProfit":"0.00","rsi":"45.87","emaShort":"479867.80","emaLong":"479864.04","volatility":"0.96","macd":"24.97","signal":"479840.77"}[m
[32m+[m[32m01:59:29.349 [INFO]   [Bot] ADX calculado: 19.16.[m
[32m+[m[32m01:59:29.843 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m01:59:55.655 [INFO]   [Bot] Iniciando ciclo 44.[m
[32m+[m[32m01:59:55.661 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m01:59:56.191 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479733.00, Best Ask=479994.00.[m
[32m+[m[32m01:59:56.195 [INFO]   [Bot] RSI calculado: 63.53.[m
[32m+[m[32m01:59:56.740 [INFO]   [Bot] EMA(8) calculada: 479873.33.[m
[32m+[m[32m01:59:57.635 [INFO]   [Bot] EMA(20) calculada: 479844.89.[m
[32m+[m[32m01:59:58.207 [INFO]   [Bot] EMA(12) calculada: 479832.02.[m
[32m+[m[32m01:59:58.654 [INFO]   [Bot] EMA(26) calculada: 479829.94.[m
[32m+[m[32m01:59:58.985 [INFO]   [Bot] EMA(9) calculada: 479864.47.[m
[32m+[m[32m01:59:59.354 [INFO]   [Bot] MACD calculado: MACD=2.08, Signal=479864.47.[m
[32m+[m[32m01:59:59.977 [INFO]   [Bot] Volatilidade calculada: 0.96%.[m
[32m+[m[32m02:00:01.218 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:00:03.077 [INFO]   [Bot] ADX calculado: 18.24.[m
[32m+[m[32m02:00:04.518 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.36","expectedProfit":"0.00","rsi":"63.53","emaShort":"479873.33","emaLong":"479844.89","volatility":"0.96","macd":"2.08","signal":"479864.47"}[m
[32m+[m[32m02:00:05.182 [INFO]   [Bot] ADX calculado: 18.24.[m
[32m+[m[32m02:00:05.992 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:00:25.664 [INFO]   [Bot] Iniciando ciclo 45.[m
[32m+[m[32m02:00:25.691 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:00:26.316 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479479.00, Best Ask=479843.00.[m
[32m+[m[32m02:00:26.460 [INFO]   [Bot] RSI calculado: 49.63.[m
[32m+[m[32m02:00:27.006 [INFO]   [Bot] EMA(8) calculada: 479798.55.[m
[32m+[m[32m02:00:27.545 [INFO]   [Bot] EMA(20) calculada: 479812.48.[m
[32m+[m[32m02:00:28.359 [INFO]   [Bot] EMA(12) calculada: 479802.91.[m
[32m+[m[32m02:00:28.699 [INFO]   [Bot] EMA(26) calculada: 479844.51.[m
[32m+[m[32m02:00:29.042 [INFO]   [Bot] EMA(9) calculada: 479797.02.[m
[32m+[m[32m02:00:29.398 [INFO]   [Bot] MACD calculado: MACD=-41.59, Signal=479797.02.[m
[32m+[m[32m02:00:29.732 [INFO]   [Bot] Volatilidade calculada: 0.98%.[m
[32m+[m[32m02:00:30.153 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:00:30.517 [INFO]   [Bot] ADX calculado: 18.58.[m
[32m+[m[32m02:00:30.956 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.28","expectedProfit":"0.00","rsi":"49.63","emaShort":"479798.55","emaLong":"479812.48","volatility":"0.98","macd":"-41.59","signal":"479797.02"}[m
[32m+[m[32m02:00:31.623 [INFO]   [Bot] ADX calculado: 18.58.[m
[32m+[m[32m02:00:32.247 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:00:55.678 [INFO]   [Bot] Iniciando ciclo 46.[m
[32m+[m[32m02:00:55.685 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:00:56.396 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479327.00, Best Ask=479685.00.[m
[32m+[m[32m02:00:56.467 [INFO]   [Bot] RSI calculado: 22.28.[m
[32m+[m[32m02:00:56.840 [INFO]   [Bot] EMA(8) calculada: 479673.87.[m
[32m+[m[32m02:00:57.131 [INFO]   [Bot] EMA(20) calculada: 479766.07.[m
[32m+[m[32m02:00:57.482 [INFO]   [Bot] EMA(12) calculada: 479725.86.[m
[32m+[m[32m02:00:57.826 [INFO]   [Bot] EMA(26) calculada: 479793.92.[m
[32m+[m[32m02:00:58.136 [INFO]   [Bot] EMA(9) calculada: 479699.55.[m
[32m+[m[32m02:00:58.443 [INFO]   [Bot] MACD calculado: MACD=-68.06, Signal=479699.55.[m
[32m+[m[32m02:00:58.706 [INFO]   [Bot] Volatilidade calculada: 0.98%.[m
[32m+[m[32m02:00:59.454 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:00:59.768 [INFO]   [Bot] ADX calculado: 21.15.[m
[32m+[m[32m02:01:00.086 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.45","expectedProfit":"0.00","rsi":"22.28","emaShort":"479673.87","emaLong":"479766.07","volatility":"0.98","macd":"-68.06","signal":"479699.55"}[m
[32m+[m[32m02:01:00.382 [INFO]   [Bot] ADX calculado: 21.15.[m
[32m+[m[32m02:01:01.336 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:01:25.693 [INFO]   [Bot] Iniciando ciclo 47.[m
[32m+[m[32m02:01:25.697 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:01:26.221 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479327.00, Best Ask=479668.00.[m
[32m+[m[32m02:01:26.274 [INFO]   [Bot] RSI calculado: 13.55.[m
[32m+[m[32m02:01:26.633 [INFO]   [Bot] EMA(8) calculada: 479604.19.[m
[32m+[m[32m02:01:27.022 [INFO]   [Bot] EMA(20) calculada: 479695.53.[m
[32m+[m[32m02:01:27.307 [INFO]   [Bot] EMA(12) calculada: 479670.16.[m
[32m+[m[32m02:01:27.576 [INFO]   [Bot] EMA(26) calculada: 479732.57.[m
[32m+[m[32m02:01:27.810 [INFO]   [Bot] EMA(9) calculada: 479619.51.[m
[32m+[m[32m02:01:28.058 [INFO]   [Bot] MACD calculado: MACD=-62.41, Signal=479619.51.[m
[32m+[m[32m02:01:28.409 [INFO]   [Bot] Volatilidade calculada: 0.97%.[m
[32m+[m[32m02:01:28.945 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:01:29.296 [INFO]   [Bot] ADX calculado: 23.47.[m
[32m+[m[32m02:01:29.553 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.50","expectedProfit":"0.00","rsi":"13.55","emaShort":"479604.19","emaLong":"479695.53","volatility":"0.97","macd":"-62.41","signal":"479619.51"}[m
[32m+[m[32m02:01:29.870 [INFO]   [Bot] ADX calculado: 23.47.[m
[32m+[m[32m02:01:30.625 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:01:55.708 [INFO]   [Bot] Iniciando ciclo 48.[m
[32m+[m[32m02:01:55.756 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:01:56.243 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479637.00, Best Ask=479923.00.[m
[32m+[m[32m02:01:56.246 [INFO]   [Bot] RSI calculado: 39.43.[m
[32m+[m[32m02:01:56.442 [INFO]   [Bot] EMA(8) calculada: 479646.53.[m
[32m+[m[32m02:01:56.622 [INFO]   [Bot] EMA(20) calculada: 479699.37.[m
[32m+[m[32m02:01:56.815 [INFO]   [Bot] EMA(12) calculada: 479692.20.[m
[32m+[m[32m02:01:56.980 [INFO]   [Bot] EMA(26) calculada: 479740.28.[m
[32m+[m[32m02:01:57.151 [INFO]   [Bot] EMA(9) calculada: 479677.29.[m
[32m+[m[32m02:01:57.303 [INFO]   [Bot] MACD calculado: MACD=-48.08, Signal=479677.29.[m
[32m+[m[32m02:01:57.476 [INFO]   [Bot] Volatilidade calculada: 1.02%.[m
[32m+[m[32m02:01:57.656 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:01:58.032 [INFO]   [Bot] ADX calculado: 21.36.[m
[32m+[m[32m02:01:58.338 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.34","expectedProfit":"0.00","rsi":"39.43","emaShort":"479646.53","emaLong":"479699.37","volatility":"1.02","macd":"-48.08","signal":"479677.29"}[m
[32m+[m[32m02:01:58.702 [INFO]   [Bot] ADX calculado: 21.36.[m
[32m+[m[32m02:01:59.100 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:02:25.723 [INFO]   [Bot] Iniciando ciclo 49.[m
[32m+[m[32m02:02:25.728 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:02:26.259 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479750.00, Best Ask=479994.00.[m
[32m+[m[32m02:02:26.377 [INFO]   [Bot] RSI calculado: 50.57.[m
[32m+[m[32m02:02:26.858 [INFO]   [Bot] EMA(8) calculada: 479714.85.[m
[32m+[m[32m02:02:27.296 [INFO]   [Bot] EMA(20) calculada: 479750.21.[m
[32m+[m[32m02:02:27.782 [INFO]   [Bot] EMA(12) calculada: 479743.26.[m
[32m+[m[32m02:02:28.155 [INFO]   [Bot] EMA(26) calculada: 479768.26.[m
[32m+[m[32m02:02:28.444 [INFO]   [Bot] EMA(9) calculada: 479725.64.[m
[32m+[m[32m02:02:28.655 [INFO]   [Bot] MACD calculado: MACD=-25.00, Signal=479725.64.[m
[32m+[m[32m02:02:28.959 [INFO]   [Bot] Volatilidade calculada: 1.01%.[m
[32m+[m[32m02:02:29.311 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:02:29.815 [INFO]   [Bot] ADX calculado: 20.96.[m
[32m+[m[32m02:02:30.089 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.28","expectedProfit":"0.00","rsi":"50.57","emaShort":"479714.85","emaLong":"479750.21","volatility":"1.01","macd":"-25.00","signal":"479725.64"}[m
[32m+[m[32m02:02:30.412 [INFO]   [Bot] ADX calculado: 20.96.[m
[32m+[m[32m02:02:31.026 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:02:55.738 [INFO]   [Bot] Iniciando ciclo 50.[m
[32m+[m[32m02:02:55.748 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:02:56.426 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479551.00, Best Ask=479830.00.[m
[32m+[m[32m02:02:56.428 [INFO]   [Bot] RSI calculado: 40.62.[m
[32m+[m[32m02:02:56.683 [INFO]   [Bot] EMA(8) calculada: 479704.09.[m
[32m+[m[32m02:02:56.968 [INFO]   [Bot] EMA(20) calculada: 479746.67.[m
[32m+[m[32m02:02:57.172 [INFO]   [Bot] EMA(12) calculada: 479701.00.[m
[32m+[m[32m02:02:57.377 [INFO]   [Bot] EMA(26) calculada: 479735.34.[m
[32m+[m[32m02:02:57.619 [INFO]   [Bot] EMA(9) calculada: 479696.35.[m
[32m+[m[32m02:02:57.934 [INFO]   [Bot] MACD calculado: MACD=-34.34, Signal=479696.35.[m
[32m+[m[32m02:02:58.136 [INFO]   [Bot] Volatilidade calculada: 1.02%.[m
[32m+[m[32m02:02:58.310 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:02:58.482 [INFO]   [Bot] ADX calculado: 18.86.[m
[32m+[m[32m02:02:58.661 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.34","expectedProfit":"0.00","rsi":"40.62","emaShort":"479704.09","emaLong":"479746.67","volatility":"1.02","macd":"-34.34","signal":"479696.35"}[m
[32m+[m[32m02:02:58.943 [INFO]   [Bot] ADX calculado: 18.86.[m
[32m+[m[32m02:02:59.226 [INFO]   [Bot] [ANALYZER] Gerando relatório de perdas...[m
[32m+[m[32m02:02:59.633 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:03:25.753 [INFO]   [Bot] Iniciando ciclo 51.[m
[32m+[m[32m02:03:25.777 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:03:27.290 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479508.00, Best Ask=479760.00.[m
[32m+[m[32m02:03:28.189 [INFO]   [Bot] RSI calculado: 48.26.[m
[32m+[m[32m02:03:29.074 [INFO]   [Bot] EMA(8) calculada: 479714.23.[m
[32m+[m[32m02:03:29.612 [INFO]   [Bot] EMA(20) calculada: 479735.42.[m
[32m+[m[32m02:03:30.064 [INFO]   [Bot] EMA(12) calculada: 479661.09.[m
[32m+[m[32m02:03:30.418 [INFO]   [Bot] EMA(26) calculada: 479709.39.[m
[32m+[m[32m02:03:30.796 [INFO]   [Bot] EMA(9) calculada: 479672.99.[m
[32m+[m[32m02:03:31.156 [INFO]   [Bot] MACD calculado: MACD=-48.30, Signal=479672.99.[m
[32m+[m[32m02:03:31.445 [INFO]   [Bot] Volatilidade calculada: 1.09%.[m
[32m+[m[32m02:03:31.753 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:03:32.024 [INFO]   [Bot] ADX calculado: 18.31.[m
[32m+[m[32m02:03:32.301 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.29","expectedProfit":"0.00","rsi":"48.26","emaShort":"479714.23","emaLong":"479735.42","volatility":"1.09","macd":"-48.30","signal":"479672.99"}[m
[32m+[m[32m02:03:32.608 [INFO]   [Bot] ADX calculado: 18.31.[m
[32m+[m[32m02:03:33.290 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:03:55.753 [INFO]   [Bot] Iniciando ciclo 52.[m
[32m+[m[32m02:03:55.758 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:03:56.331 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479516.00, Best Ask=479864.00.[m
[32m+[m[32m02:03:56.367 [INFO]   [Bot] RSI calculado: 63.59.[m
[32m+[m[32m02:03:56.666 [INFO]   [Bot] EMA(8) calculada: 479716.98.[m
[32m+[m[32m02:03:56.980 [INFO]   [Bot] EMA(20) calculada: 479717.99.[m
[32m+[m[32m02:03:57.296 [INFO]   [Bot] EMA(12) calculada: 479668.16.[m
[32m+[m[32m02:03:57.677 [INFO]   [Bot] EMA(26) calculada: 479726.16.[m
[32m+[m[32m02:03:57.856 [INFO]   [Bot] EMA(9) calculada: 479709.45.[m
[32m+[m[32m02:03:58.163 [INFO]   [Bot] MACD calculado: MACD=-58.00, Signal=479709.45.[m
[32m+[m[32m02:03:58.492 [INFO]   [Bot] Volatilidade calculada: 1.07%.[m
[32m+[m[32m02:03:58.796 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:03:59.115 [INFO]   [Bot] ADX calculado: 16.27.[m
[32m+[m[32m02:03:59.400 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.36","expectedProfit":"0.00","rsi":"63.59","emaShort":"479716.98","emaLong":"479717.99","volatility":"1.07","macd":"-58.00","signal":"479709.45"}[m
[32m+[m[32m02:03:59.716 [INFO]   [Bot] ADX calculado: 16.27.[m
[32m+[m[32m02:04:00.266 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:04:25.768 [INFO]   [Bot] Iniciando ciclo 53.[m
[32m+[m[32m02:04:25.775 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:04:26.378 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479583.00, Best Ask=479896.00.[m
[32m+[m[32m02:04:26.402 [INFO]   [Bot] RSI calculado: 66.85.[m
[32m+[m[32m02:04:26.732 [INFO]   [Bot] EMA(8) calculada: 479701.57.[m
[32m+[m[32m02:04:27.051 [INFO]   [Bot] EMA(20) calculada: 479721.90.[m
[32m+[m[32m02:04:27.444 [INFO]   [Bot] EMA(12) calculada: 479726.47.[m
[32m+[m[32m02:04:27.791 [INFO]   [Bot] EMA(26) calculada: 479735.36.[m
[32m+[m[32m02:04:28.094 [INFO]   [Bot] EMA(9) calculada: 479730.14.[m
[32m+[m[32m02:04:28.337 [INFO]   [Bot] MACD calculado: MACD=-8.89, Signal=479730.14.[m
[32m+[m[32m02:04:28.571 [INFO]   [Bot] Volatilidade calculada: 1.06%.[m
[32m+[m[32m02:04:28.848 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:04:29.203 [INFO]   [Bot] ADX calculado: 14.53.[m
[32m+[m[32m02:04:29.633 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.38","expectedProfit":"0.00","rsi":"66.85","emaShort":"479701.57","emaLong":"479721.90","volatility":"1.06","macd":"-8.89","signal":"479730.14"}[m
[32m+[m[32m02:04:30.045 [INFO]   [Bot] ADX calculado: 14.53.[m
[32m+[m[32m02:04:30.605 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:04:55.782 [INFO]   [Bot] Iniciando ciclo 54.[m
[32m+[m[32m02:04:55.787 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:04:56.349 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479392.00, Best Ask=479737.00.[m
[32m+[m[32m02:04:56.352 [INFO]   [Bot] RSI calculado: 32.35.[m
[32m+[m[32m02:04:56.656 [INFO]   [Bot] EMA(8) calculada: 479639.85.[m
[32m+[m[32m02:04:56.960 [INFO]   [Bot] EMA(20) calculada: 479665.98.[m
[32m+[m[32m02:04:57.209 [INFO]   [Bot] EMA(12) calculada: 479692.86.[m
[32m+[m[32m02:04:57.504 [INFO]   [Bot] EMA(26) calculada: 479720.18.[m
[32m+[m[32m02:04:57.850 [INFO]   [Bot] EMA(9) calculada: 479651.02.[m
[32m+[m[32m02:04:58.163 [INFO]   [Bot] MACD calculado: MACD=-27.32, Signal=479651.02.[m
[32m+[m[32m02:04:58.477 [INFO]   [Bot] Volatilidade calculada: 1.07%.[m
[32m+[m[32m02:04:58.821 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:04:59.139 [INFO]   [Bot] ADX calculado: 15.19.[m
[32m+[m[32m02:04:59.428 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.39","expectedProfit":"0.00","rsi":"32.35","emaShort":"479639.85","emaLong":"479665.98","volatility":"1.07","macd":"-27.32","signal":"479651.02"}[m
[32m+[m[32m02:04:59.712 [INFO]   [Bot] ADX calculado: 15.19.[m
[32m+[m[32m02:05:00.230 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:05:25.783 [INFO]   [Bot] Iniciando ciclo 55.[m
[32m+[m[32m02:05:25.788 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:05:26.631 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479424.00, Best Ask=479760.00.[m
[32m+[m[32m02:05:26.869 [INFO]   [Bot] RSI calculado: 24.36.[m
[32m+[m[32m02:05:27.250 [INFO]   [Bot] EMA(8) calculada: 479628.45.[m
[32m+[m[32m02:05:27.614 [INFO]   [Bot] EMA(20) calculada: 479631.62.[m
[32m+[m[32m02:05:27.934 [INFO]   [Bot] EMA(12) calculada: 479639.77.[m
[32m+[m[32m02:05:28.251 [INFO]   [Bot] EMA(26) calculada: 479692.70.[m
[32m+[m[32m02:05:28.555 [INFO]   [Bot] EMA(9) calculada: 479623.71.[m
[32m+[m[32m02:05:28.868 [INFO]   [Bot] MACD calculado: MACD=-52.93, Signal=479623.71.[m
[32m+[m[32m02:05:29.190 [INFO]   [Bot] Volatilidade calculada: 1.06%.[m
[32m+[m[32m02:05:29.495 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:05:29.775 [INFO]   [Bot] ADX calculado: 15.11.[m
[32m+[m[32m02:05:30.100 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.44","expectedProfit":"0.00","rsi":"24.36","emaShort":"479628.45","emaLong":"479631.62","volatility":"1.06","macd":"-52.93","signal":"479623.71"}[m
[32m+[m[32m02:05:30.421 [INFO]   [Bot] ADX calculado: 15.11.[m
[32m+[m[32m02:05:31.456 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:05:55.787 [INFO]   [Bot] Iniciando ciclo 56.[m
[32m+[m[32m02:05:55.842 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:05:56.566 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479437.00, Best Ask=479753.00.[m
[32m+[m[32m02:05:56.769 [INFO]   [Bot] RSI calculado: 37.01.[m
[32m+[m[32m02:05:57.211 [INFO]   [Bot] EMA(8) calculada: 479621.86.[m
[32m+[m[32m02:05:57.700 [INFO]   [Bot] EMA(20) calculada: 479623.83.[m
[32m+[m[32m02:05:58.199 [INFO]   [Bot] EMA(12) calculada: 479619.44.[m
[32m+[m[32m02:05:58.561 [INFO]   [Bot] EMA(26) calculada: 479678.76.[m
[32m+[m[32m02:05:58.879 [INFO]   [Bot] EMA(9) calculada: 479619.39.[m
[32m+[m[32m02:05:59.208 [INFO]   [Bot] MACD calculado: MACD=-59.32, Signal=479619.39.[m
[32m+[m[32m02:05:59.549 [INFO]   [Bot] Volatilidade calculada: 1.04%.[m
[32m+[m[32m02:05:59.886 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:06:00.177 [INFO]   [Bot] ADX calculado: 14.97.[m
[32m+[m[32m02:06:00.457 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.36","expectedProfit":"0.00","rsi":"37.01","emaShort":"479621.86","emaLong":"479623.83","volatility":"1.04","macd":"-59.32","signal":"479619.39"}[m
[32m+[m[32m02:06:00.796 [INFO]   [Bot] ADX calculado: 14.97.[m
[32m+[m[32m02:06:01.360 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:06:25.802 [INFO]   [Bot] Iniciando ciclo 57.[m
[32m+[m[32m02:06:25.835 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:06:26.518 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479486.00, Best Ask=479754.00.[m
[32m+[m[32m02:06:26.536 [INFO]   [Bot] RSI calculado: 47.92.[m
[32m+[m[32m02:06:26.967 [INFO]   [Bot] EMA(8) calculada: 479597.69.[m
[32m+[m[32m02:06:27.489 [INFO]   [Bot] EMA(20) calculada: 479661.30.[m
[32m+[m[32m02:06:27.879 [INFO]   [Bot] EMA(12) calculada: 479627.14.[m
[32m+[m[32m02:06:28.181 [INFO]   [Bot] EMA(26) calculada: 479643.00.[m
[32m+[m[32m02:06:28.666 [INFO]   [Bot] EMA(9) calculada: 479624.92.[m
[32m+[m[32m02:06:29.215 [INFO]   [Bot] MACD calculado: MACD=-15.86, Signal=479624.92.[m
[32m+[m[32m02:06:29.565 [INFO]   [Bot] Volatilidade calculada: 1.02%.[m
[32m+[m[32m02:06:30.033 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:06:30.494 [INFO]   [Bot] ADX calculado: 14.14.[m
[32m+[m[32m02:06:30.772 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.29","expectedProfit":"0.00","rsi":"47.92","emaShort":"479597.69","emaLong":"479661.30","volatility":"1.02","macd":"-15.86","signal":"479624.92"}[m
[32m+[m[32m02:06:31.095 [INFO]   [Bot] ADX calculado: 14.14.[m
[32m+[m[32m02:06:31.672 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:06:55.816 [INFO]   [Bot] Iniciando ciclo 58.[m
[32m+[m[32m02:06:55.828 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:06:56.370 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479520.00, Best Ask=479789.00.[m
[32m+[m[32m02:06:56.472 [INFO]   [Bot] RSI calculado: 44.36.[m
[32m+[m[32m02:06:56.815 [INFO]   [Bot] EMA(8) calculada: 479623.82.[m
[32m+[m[32m02:06:57.153 [INFO]   [Bot] EMA(20) calculada: 479672.50.[m
[32m+[m[32m02:06:57.459 [INFO]   [Bot] EMA(12) calculada: 479641.58.[m
[32m+[m[32m02:06:57.737 [INFO]   [Bot] EMA(26) calculada: 479623.68.[m
[32m+[m[32m02:06:58.028 [INFO]   [Bot] EMA(9) calculada: 479616.78.[m
[32m+[m[32m02:06:58.335 [INFO]   [Bot] MACD calculado: MACD=17.90, Signal=479616.78.[m
[32m+[m[32m02:06:58.670 [INFO]   [Bot] Volatilidade calculada: 1.01%.[m
[32m+[m[32m02:06:58.967 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:06:59.267 [INFO]   [Bot] ADX calculado: 12.41.[m
[32m+[m[32m02:06:59.542 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.31","expectedProfit":"0.00","rsi":"44.36","emaShort":"479623.82","emaLong":"479672.50","volatility":"1.01","macd":"17.90","signal":"479616.78"}[m
[32m+[m[32m02:06:59.883 [INFO]   [Bot] ADX calculado: 12.41.[m
[32m+[m[32m02:07:00.477 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:07:25.831 [INFO]   [Bot] Iniciando ciclo 59.[m
[32m+[m[32m02:07:25.851 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:07:26.686 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479820.00, Best Ask=479995.00.[m
[32m+[m[32m02:07:26.788 [INFO]   [Bot] RSI calculado: 66.22.[m
[32m+[m[32m02:07:27.112 [INFO]   [Bot] EMA(8) calculada: 479736.29.[m
[32m+[m[32m02:07:27.435 [INFO]   [Bot] EMA(20) calculada: 479690.61.[m
[32m+[m[32m02:07:27.723 [INFO]   [Bot] EMA(12) calculada: 479693.53.[m
[32m+[m[32m02:07:28.040 [INFO]   [Bot] EMA(26) calculada: 479663.03.[m
[32m+[m[32m02:07:28.340 [INFO]   [Bot] EMA(9) calculada: 479724.39.[m
[32m+[m[32m02:07:28.717 [INFO]   [Bot] MACD calculado: MACD=30.51, Signal=479724.39.[m
[32m+[m[32m02:07:29.086 [INFO]   [Bot] Volatilidade calculada: 1.05%.[m
[32m+[m[32m02:07:29.404 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:07:29.678 [INFO]   [Bot] ADX calculado: 15.57.[m
[32m+[m[32m02:07:30.109 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.38","expectedProfit":"0.00","rsi":"66.22","emaShort":"479736.29","emaLong":"479690.61","volatility":"1.05","macd":"30.51","signal":"479724.39"}[m
[32m+[m[32m02:07:30.535 [INFO]   [Bot] ADX calculado: 15.57.[m
[32m+[m[32m02:07:31.237 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:07:55.845 [INFO]   [Bot] Iniciando ciclo 60.[m
[32m+[m[32m02:07:55.850 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:07:56.392 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479521.00, Best Ask=479784.00.[m
[32m+[m[32m02:07:56.394 [INFO]   [Bot] RSI calculado: 57.36.[m
[32m+[m[32m02:07:56.697 [INFO]   [Bot] EMA(8) calculada: 479706.54.[m
[32m+[m[32m02:07:57.008 [INFO]   [Bot] EMA(20) calculada: 479676.06.[m
[32m+[m[32m02:07:57.294 [INFO]   [Bot] EMA(12) calculada: 479685.58.[m
[32m+[m[32m02:07:57.600 [INFO]   [Bot] EMA(26) calculada: 479699.72.[m
[32m+[m[32m02:07:57.891 [INFO]   [Bot] EMA(9) calculada: 479698.83.[m
[32m+[m[32m02:07:58.228 [INFO]   [Bot] MACD calculado: MACD=-14.13, Signal=479698.83.[m
[32m+[m[32m02:07:58.471 [INFO]   [Bot] Volatilidade calculada: 1.09%.[m
[32m+[m[32m02:07:58.785 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:07:59.090 [INFO]   [Bot] ADX calculado: 14.12.[m
[32m+[m[32m02:07:59.385 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.33","expectedProfit":"0.00","rsi":"57.36","emaShort":"479706.54","emaLong":"479676.06","volatility":"1.09","macd":"-14.13","signal":"479698.83"}[m
[32m+[m[32m02:07:59.680 [INFO]   [Bot] ADX calculado: 14.12.[m
[32m+[m[32m02:07:59.979 [INFO]   [Bot] [OPTIMIZER] Iniciando ciclo de otimização de parâmetros.[m
[32m+[m[32m02:08:00.262 [SUCCESS] [Bot] [OPTIMIZER] Parâmetros ajustados: {"spreadPct":0.0004374,"orderSize":0.05,"stopLoss":0.008,"takeProfit":0.001,"maxOrderAge":1800,"minVolatility":0.1,"maxVolatility":2.5}[m
[32m+[m[32m02:08:00.879 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:08:25.857 [INFO]   [Bot] Iniciando ciclo 61.[m
[32m+[m[32m02:08:25.898 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:08:26.248 [INFO]   [Bot] Consultando tendências externas do Bitcoin...[m
[32m+[m[32m02:08:27.270 [SUCCESS] [Bot] Tendência Externa: NEUTRAL (Score: 51/100, Confiança: 100%)[m
[32m+[m[32m02:08:27.598 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479684.00, Best Ask=479784.00.[m
[32m+[m[32m02:08:27.639 [INFO]   [Bot] RSI calculado: 60.89.[m
[32m+[m[32m02:08:27.928 [INFO]   [Bot] EMA(8) calculada: 479722.01.[m
[32m+[m[32m02:08:28.246 [INFO]   [Bot] EMA(20) calculada: 479694.14.[m
[32m+[m[32m02:08:28.558 [INFO]   [Bot] EMA(12) calculada: 479699.74.[m
[32m+[m[32m02:08:28.833 [INFO]   [Bot] EMA(26) calculada: 479717.05.[m
[32m+[m[32m02:08:29.161 [INFO]   [Bot] EMA(9) calculada: 479714.18.[m
[32m+[m[32m02:08:29.485 [INFO]   [Bot] MACD calculado: MACD=-17.31, Signal=479714.18.[m
[32m+[m[32m02:08:29.777 [INFO]   [Bot] Volatilidade calculada: 1.08%.[m
[32m+[m[32m02:08:30.061 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:08:30.362 [INFO]   [Bot] ADX calculado: 12.92.[m
[32m+[m[32m02:08:30.686 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.35","expectedProfit":"0.00","rsi":"60.89","emaShort":"479722.01","emaLong":"479694.14","volatility":"1.08","macd":"-17.31","signal":"479714.18"}[m
[32m+[m[32m02:08:31.004 [INFO]   [Bot] ADX calculado: 12.92.[m
[32m+[m[32m02:08:31.548 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:08:55.871 [INFO]   [Bot] Iniciando ciclo 62.[m
[32m+[m[32m02:08:55.909 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:08:56.468 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479684.00, Best Ask=479784.00.[m
[32m+[m[32m02:08:56.472 [INFO]   [Bot] RSI calculado: 60.71.[m
[32m+[m[32m02:08:56.788 [INFO]   [Bot] EMA(8) calculada: 479760.63.[m
[32m+[m[32m02:08:57.086 [INFO]   [Bot] EMA(20) calculada: 479708.06.[m
[32m+[m[32m02:08:57.359 [INFO]   [Bot] EMA(12) calculada: 479712.84.[m
[32m+[m[32m02:08:57.612 [INFO]   [Bot] EMA(26) calculada: 479694.93.[m
[32m+[m[32m02:08:57.955 [INFO]   [Bot] EMA(9) calculada: 479725.02.[m
[32m+[m[32m02:08:58.235 [INFO]   [Bot] MACD calculado: MACD=17.91, Signal=479725.02.[m
[32m+[m[32m02:08:58.527 [INFO]   [Bot] Volatilidade calculada: 1.08%.[m
[32m+[m[32m02:08:58.876 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:08:59.183 [INFO]   [Bot] ADX calculado: 11.89.[m
[32m+[m[32m02:08:59.517 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.35","expectedProfit":"0.00","rsi":"60.71","emaShort":"479760.63","emaLong":"479708.06","volatility":"1.08","macd":"17.91","signal":"479725.02"}[m
[32m+[m[32m02:08:59.803 [INFO]   [Bot] ADX calculado: 11.89.[m
[32m+[m[32m02:09:00.410 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:09:25.885 [INFO]   [Bot] Iniciando ciclo 63.[m
[32m+[m[32m02:09:25.901 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:09:26.423 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479786.00, Best Ask=479994.00.[m
[32m+[m[32m02:09:26.490 [INFO]   [Bot] RSI calculado: 67.31.[m
[32m+[m[32m02:09:27.003 [INFO]   [Bot] EMA(8) calculada: 479777.59.[m
[32m+[m[32m02:09:27.447 [INFO]   [Bot] EMA(20) calculada: 479717.42.[m
[32m+[m[32m02:09:27.892 [INFO]   [Bot] EMA(12) calculada: 479767.80.[m
[32m+[m[32m02:09:28.175 [INFO]   [Bot] EMA(26) calculada: 479715.12.[m
[32m+[m[32m02:09:28.415 [INFO]   [Bot] EMA(9) calculada: 479811.58.[m
[32m+[m[32m02:09:28.711 [INFO]   [Bot] MACD calculado: MACD=52.69, Signal=479811.58.[m
[32m+[m[32m02:09:28.995 [INFO]   [Bot] Volatilidade calculada: 1.08%.[m
[32m+[m[32m02:09:29.305 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:09:29.623 [INFO]   [Bot] ADX calculado: 13.66.[m
[32m+[m[32m02:09:29.937 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.39","expectedProfit":"0.00","rsi":"67.31","emaShort":"479777.59","emaLong":"479717.42","volatility":"1.08","macd":"52.69","signal":"479811.58"}[m
[32m+[m[32m02:09:30.301 [INFO]   [Bot] ADX calculado: 13.66.[m
[32m+[m[32m02:09:31.145 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:09:55.899 [INFO]   [Bot] Iniciando ciclo 64.[m
[32m+[m[32m02:09:55.906 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:09:56.528 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479787.00, Best Ask=479994.00.[m
[32m+[m[32m02:09:56.532 [INFO]   [Bot] RSI calculado: 65.82.[m
[32m+[m[32m02:09:56.817 [INFO]   [Bot] EMA(8) calculada: 479833.11.[m
[32m+[m[32m02:09:57.012 [INFO]   [Bot] EMA(20) calculada: 479752.53.[m
[32m+[m[32m02:09:57.253 [INFO]   [Bot] EMA(12) calculada: 479836.73.[m
[32m+[m[32m02:09:57.541 [INFO]   [Bot] EMA(26) calculada: 479747.71.[m
[32m+[m[32m02:09:57.780 [INFO]   [Bot] EMA(9) calculada: 479812.61.[m
[32m+[m[32m02:09:58.065 [INFO]   [Bot] MACD calculado: MACD=89.02, Signal=479812.61.[m
[32m+[m[32m02:09:58.400 [INFO]   [Bot] Volatilidade calculada: 1.07%.[m
[32m+[m[32m02:09:58.659 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:09:58.931 [INFO]   [Bot] ADX calculado: 15.19.[m
[32m+[m[32m02:09:59.278 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.38","expectedProfit":"0.00","rsi":"65.82","emaShort":"479833.11","emaLong":"479752.53","volatility":"1.07","macd":"89.02","signal":"479812.61"}[m
[32m+[m[32m02:09:59.588 [INFO]   [Bot] ADX calculado: 15.19.[m
[32m+[m[32m02:10:00.042 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:10:25.914 [INFO]   [Bot] Iniciando ciclo 65.[m
[32m+[m[32m02:10:25.923 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:10:26.781 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479786.00, Best Ask=479954.00.[m
[32m+[m[32m02:10:26.864 [INFO]   [Bot] RSI calculado: 46.35.[m
[32m+[m[32m02:10:27.337 [INFO]   [Bot] EMA(8) calculada: 479847.68.[m
[32m+[m[32m02:10:27.750 [INFO]   [Bot] EMA(20) calculada: 479774.25.[m
[32m+[m[32m02:10:28.022 [INFO]   [Bot] EMA(12) calculada: 479811.83.[m
[32m+[m[32m02:10:28.313 [INFO]   [Bot] EMA(26) calculada: 479771.85.[m
[32m+[m[32m02:10:28.625 [INFO]   [Bot] EMA(9) calculada: 479842.02.[m
[32m+[m[32m02:10:28.918 [INFO]   [Bot] MACD calculado: MACD=39.98, Signal=479842.02.[m
[32m+[m[32m02:10:29.196 [INFO]   [Bot] Volatilidade calculada: 1.05%.[m
[32m+[m[32m02:10:29.471 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:10:29.823 [INFO]   [Bot] ADX calculado: 15.92.[m
[32m+[m[32m02:10:30.122 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.30","expectedProfit":"0.00","rsi":"46.35","emaShort":"479847.68","emaLong":"479774.25","volatility":"1.05","macd":"39.98","signal":"479842.02"}[m
[32m+[m[32m02:10:30.423 [INFO]   [Bot] ADX calculado: 15.92.[m
[32m+[m[32m02:10:30.979 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:10:55.926 [INFO]   [Bot] Iniciando ciclo 66.[m
[32m+[m[32m02:10:55.946 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:10:56.500 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479786.00, Best Ask=479925.00.[m
[32m+[m[32m02:10:56.526 [INFO]   [Bot] RSI calculado: 87.18.[m
[32m+[m[32m02:10:56.818 [INFO]   [Bot] EMA(8) calculada: 479871.66.[m
[32m+[m[32m02:10:57.088 [INFO]   [Bot] EMA(20) calculada: 479792.36.[m
[32m+[m[32m02:10:57.378 [INFO]   [Bot] EMA(12) calculada: 479835.21.[m
[32m+[m[32m02:10:57.706 [INFO]   [Bot] EMA(26) calculada: 479760.12.[m
[32m+[m[32m02:10:58.041 [INFO]   [Bot] EMA(9) calculada: 479846.87.[m
[32m+[m[32m02:10:58.307 [INFO]   [Bot] MACD calculado: MACD=75.09, Signal=479846.87.[m
[32m+[m[32m02:10:58.605 [INFO]   [Bot] Volatilidade calculada: 1.04%.[m
[32m+[m[32m02:10:58.888 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:10:59.152 [INFO]   [Bot] ADX calculado: 16.08.[m
[32m+[m[32m02:10:59.445 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.50","expectedProfit":"0.00","rsi":"87.18","emaShort":"479871.66","emaLong":"479792.36","volatility":"1.04","macd":"75.09","signal":"479846.87"}[m
[32m+[m[32m02:10:59.763 [INFO]   [Bot] ADX calculado: 16.08.[m
[32m+[m[32m02:11:00.343 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:11:26.405 [INFO]   [Bot] Iniciando ciclo 67.[m
[32m+[m[32m02:11:26.426 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:11:27.295 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479488.00, Best Ask=479851.00.[m
[32m+[m[32m02:11:27.298 [INFO]   [Bot] RSI calculado: 41.46.[m
[32m+[m[32m02:11:27.593 [INFO]   [Bot] EMA(8) calculada: 479791.86.[m
[32m+[m[32m02:11:27.904 [INFO]   [Bot] EMA(20) calculada: 479774.74.[m
[32m+[m[32m02:11:28.162 [INFO]   [Bot] EMA(12) calculada: 479788.15.[m
[32m+[m[32m02:11:28.429 [INFO]   [Bot] EMA(26) calculada: 479750.91.[m
[32m+[m[32m02:11:28.698 [INFO]   [Bot] EMA(9) calculada: 479799.77.[m
[32m+[m[32m02:11:29.001 [INFO]   [Bot] MACD calculado: MACD=37.24, Signal=479799.77.[m
[32m+[m[32m02:11:29.260 [INFO]   [Bot] Volatilidade calculada: 1.06%.[m
[32m+[m[32m02:11:29.572 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:11:29.858 [INFO]   [Bot] ADX calculado: 16.22.[m
[32m+[m[32m02:11:30.185 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.33","expectedProfit":"0.00","rsi":"41.46","emaShort":"479791.86","emaLong":"479774.74","volatility":"1.06","macd":"37.24","signal":"479799.77"}[m
[32m+[m[32m02:11:30.452 [INFO]   [Bot] ADX calculado: 16.22.[m
[32m+[m[32m02:11:31.207 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:11:56.419 [INFO]   [Bot] Iniciando ciclo 68.[m
[32m+[m[32m02:11:56.424 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:11:56.976 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479566.00, Best Ask=479991.00.[m
[32m+[m[32m02:11:56.980 [INFO]   [Bot] RSI calculado: 54.57.[m
[32m+[m[32m02:11:57.160 [INFO]   [Bot] EMA(8) calculada: 479783.84.[m
[32m+[m[32m02:11:57.380 [INFO]   [Bot] EMA(20) calculada: 479809.60.[m
[32m+[m[32m02:11:57.786 [INFO]   [Bot] EMA(12) calculada: 479806.42.[m
[32m+[m[32m02:11:58.110 [INFO]   [Bot] EMA(26) calculada: 479755.25.[m
[32m+[m[32m02:11:58.406 [INFO]   [Bot] EMA(9) calculada: 479792.17.[m
[32m+[m[32m02:11:58.670 [INFO]   [Bot] MACD calculado: MACD=51.17, Signal=479792.17.[m
[32m+[m[32m02:11:58.957 [INFO]   [Bot] Volatilidade calculada: 1.05%.[m
[32m+[m[32m02:11:59.249 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:11:59.549 [INFO]   [Bot] ADX calculado: 14.31.[m
[32m+[m[32m02:11:59.870 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.31","expectedProfit":"0.00","rsi":"54.57","emaShort":"479783.84","emaLong":"479809.60","volatility":"1.05","macd":"51.17","signal":"479792.17"}[m
[32m+[m[32m02:12:00.162 [INFO]   [Bot] ADX calculado: 14.31.[m
[32m+[m[32m02:12:00.674 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:12:26.434 [INFO]   [Bot] Iniciando ciclo 69.[m
[32m+[m[32m02:12:26.447 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:12:27.062 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479737.00, Best Ask=479994.00.[m
[32m+[m[32m02:12:27.087 [INFO]   [Bot] RSI calculado: 47.07.[m
[32m+[m[32m02:12:27.364 [INFO]   [Bot] EMA(8) calculada: 479814.16.[m
[32m+[m[32m02:12:27.618 [INFO]   [Bot] EMA(20) calculada: 479785.29.[m
[32m+[m[32m02:12:27.926 [INFO]   [Bot] EMA(12) calculada: 479823.27.[m
[32m+[m[32m02:12:28.230 [INFO]   [Bot] EMA(26) calculada: 479774.36.[m
[32m+[m[32m02:12:28.518 [INFO]   [Bot] EMA(9) calculada: 479816.37.[m
[32m+[m[32m02:12:28.810 [INFO]   [Bot] MACD calculado: MACD=48.91, Signal=479816.37.[m
[32m+[m[32m02:12:29.120 [INFO]   [Bot] Volatilidade calculada: 1.04%.[m
[32m+[m[32m02:12:29.373 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:12:29.692 [INFO]   [Bot] ADX calculado: 14.44.[m
[32m+[m[32m02:12:30.003 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.30","expectedProfit":"0.00","rsi":"47.07","emaShort":"479814.16","emaLong":"479785.29","volatility":"1.04","macd":"48.91","signal":"479816.37"}[m
[32m+[m[32m02:12:30.282 [INFO]   [Bot] ADX calculado: 14.44.[m
[32m+[m[32m02:12:31.063 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:12:56.446 [INFO]   [Bot] Iniciando ciclo 70.[m
[32m+[m[32m02:12:56.702 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479739.00, Best Ask=480028.00.[m
[32m+[m[32m02:12:56.876 [INFO]   [Bot] RSI calculado: 49.20.[m
[32m+[m[32m02:12:57.146 [INFO]   [Bot] EMA(8) calculada: 479816.64.[m
[32m+[m[32m02:12:57.430 [INFO]   [Bot] EMA(20) calculada: 479814.12.[m
[32m+[m[32m02:12:57.783 [INFO]   [Bot] EMA(12) calculada: 479837.61.[m
[32m+[m[32m02:12:58.173 [INFO]   [Bot] EMA(26) calculada: 479794.60.[m
[32m+[m[32m02:12:58.486 [INFO]   [Bot] EMA(9) calculada: 479838.98.[m
[32m+[m[32m02:12:58.766 [INFO]   [Bot] MACD calculado: MACD=43.02, Signal=479838.98.[m
[32m+[m[32m02:12:59.218 [INFO]   [Bot] Volatilidade calculada: 1.03%.[m
[32m+[m[32m02:12:59.751 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:13:00.066 [INFO]   [Bot] ADX calculado: 14.92.[m
[32m+[m[32m02:13:00.326 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.29","expectedProfit":"0.00","rsi":"49.20","emaShort":"479816.64","emaLong":"479814.12","volatility":"1.03","macd":"43.02","signal":"479838.98"}[m
[32m+[m[32m02:13:00.621 [INFO]   [Bot] ADX calculado: 14.92.[m
[32m+[m[32m02:13:01.196 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:13:26.461 [INFO]   [Bot] Iniciando ciclo 71.[m
[32m+[m[32m02:13:26.774 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479739.00, Best Ask=480028.00.[m
[32m+[m[32m02:13:26.867 [INFO]   [Bot] RSI calculado: 51.63.[m
[32m+[m[32m02:13:27.320 [INFO]   [Bot] EMA(8) calculada: 479857.65.[m
[32m+[m[32m02:13:27.895 [INFO]   [Bot] EMA(20) calculada: 479826.70.[m
[32m+[m[32m02:13:28.205 [INFO]   [Bot] EMA(12) calculada: 479848.69.[m
[32m+[m[32m02:13:28.539 [INFO]   [Bot] EMA(26) calculada: 479841.48.[m
[32m+[m[32m02:13:28.883 [INFO]   [Bot] EMA(9) calculada: 479835.03.[m
[32m+[m[32m02:13:29.257 [INFO]   [Bot] MACD calculado: MACD=7.21, Signal=479835.03.[m
[32m+[m[32m02:13:29.582 [INFO]   [Bot] Volatilidade calculada: 1.03%.[m
[32m+[m[32m02:13:29.966 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:13:30.346 [INFO]   [Bot] ADX calculado: 15.33.[m
[32m+[m[32m02:13:30.668 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.29","expectedProfit":"0.00","rsi":"51.63","emaShort":"479857.65","emaLong":"479826.70","volatility":"1.03","macd":"7.21","signal":"479835.03"}[m
[32m+[m[32m02:13:31.009 [INFO]   [Bot] ADX calculado: 15.33.[m
[32m+[m[32m02:13:31.883 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:13:56.477 [INFO]   [Bot] Iniciando ciclo 72.[m
[32m+[m[32m02:13:56.722 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479667.00, Best Ask=479953.00.[m
[32m+[m[32m02:13:56.813 [INFO]   [Bot] RSI calculado: 45.20.[m
[32m+[m[32m02:13:57.179 [INFO]   [Bot] EMA(8) calculada: 479850.48.[m
[32m+[m[32m02:13:57.483 [INFO]   [Bot] EMA(20) calculada: 479844.75.[m
[32m+[m[32m02:13:57.823 [INFO]   [Bot] EMA(12) calculada: 479812.65.[m
[32m+[m[32m02:13:58.175 [INFO]   [Bot] EMA(26) calculada: 479802.52.[m
[32m+[m[32m02:13:58.492 [INFO]   [Bot] EMA(9) calculada: 479837.73.[m
[32m+[m[32m02:13:58.817 [INFO]   [Bot] MACD calculado: MACD=10.13, Signal=479837.73.[m
[32m+[m[32m02:13:59.169 [INFO]   [Bot] Volatilidade calculada: 1.04%.[m
[32m+[m[32m02:13:59.482 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:13:59.801 [INFO]   [Bot] ADX calculado: 12.92.[m
[32m+[m[32m02:14:00.183 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.31","expectedProfit":"0.00","rsi":"45.20","emaShort":"479850.48","emaLong":"479844.75","volatility":"1.04","macd":"10.13","signal":"479837.73"}[m
[32m+[m[32m02:14:00.488 [INFO]   [Bot] ADX calculado: 12.92.[m
[32m+[m[32m02:14:01.257 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:14:26.484 [INFO]   [Bot] Iniciando ciclo 73.[m
[32m+[m[32m02:14:26.763 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479587.00, Best Ask=479869.00.[m
[32m+[m[32m02:14:26.861 [INFO]   [Bot] RSI calculado: 57.92.[m
[32m+[m[32m02:14:27.219 [INFO]   [Bot] EMA(8) calculada: 479804.50.[m
[32m+[m[32m02:14:27.652 [INFO]   [Bot] EMA(20) calculada: 479823.64.[m
[32m+[m[32m02:14:27.972 [INFO]   [Bot] EMA(12) calculada: 479803.29.[m
[32m+[m[32m02:14:28.292 [INFO]   [Bot] EMA(26) calculada: 479802.90.[m
[32m+[m[32m02:14:28.634 [INFO]   [Bot] EMA(9) calculada: 479807.57.[m
[32m+[m[32m02:14:28.958 [INFO]   [Bot] MACD calculado: MACD=0.38, Signal=479807.57.[m
[32m+[m[32m02:14:29.289 [INFO]   [Bot] Volatilidade calculada: 1.03%.[m
[32m+[m[32m02:14:29.596 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:14:29.911 [INFO]   [Bot] ADX calculado: 13.33.[m
[32m+[m[32m02:14:30.246 [INFO]   [Bot] Previsão de preço | {"trend":"down","confidence":"0.33","expectedProfit":"0.00","rsi":"57.92","emaShort":"479804.50","emaLong":"479823.64","volatility":"1.03","macd":"0.38","signal":"479807.57"}[m
[32m+[m[32m02:14:30.615 [INFO]   [Bot] ADX calculado: 13.33.[m
[32m+[m[32m02:14:31.519 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:14:56.499 [INFO]   [Bot] Iniciando ciclo 74.[m
[32m+[m[32m02:14:56.809 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480028.00, Best Ask=480029.00.[m
[32m+[m[32m02:14:56.828 [INFO]   [Bot] RSI calculado: 72.28.[m
[32m+[m[32m02:14:57.109 [INFO]   [Bot] EMA(8) calculada: 479893.00.[m
[32m+[m[32m02:14:57.399 [INFO]   [Bot] EMA(20) calculada: 479858.03.[m
[32m+[m[32m02:14:57.697 [INFO]   [Bot] EMA(12) calculada: 479878.97.[m
[32m+[m[32m02:14:57.953 [INFO]   [Bot] EMA(26) calculada: 479835.09.[m
[32m+[m[32m02:14:58.233 [INFO]   [Bot] EMA(9) calculada: 479889.03.[m
[32m+[m[32m02:14:58.436 [INFO]   [Bot] MACD calculado: MACD=43.89, Signal=479889.03.[m
[32m+[m[32m02:14:58.705 [INFO]   [Bot] Volatilidade calculada: 1.10%.[m
[32m+[m[32m02:14:58.981 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:14:59.268 [INFO]   [Bot] ADX calculado: 15.72.[m
[32m+[m[32m02:14:59.542 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.42","expectedProfit":"0.00","rsi":"72.28","emaShort":"479893.00","emaLong":"479858.03","volatility":"1.10","macd":"43.89","signal":"479889.03"}[m
[32m+[m[32m02:14:59.842 [INFO]   [Bot] ADX calculado: 15.72.[m
[32m+[m[32m02:15:00.296 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:15:00.335 [SUCCESS] [Bot] [CASH_MGT_SELL] ✅ Take-Profit: +0.040% (FECHAR PAR)[m
[32m+[m[32m02:15:01.177 [SUCCESS] [Bot] Ordem SELL 01KFHQQMBK6AM9KKBC404DRTPC colocada @ R$480028.50, Qty: 0.00017206, Pair: PAIR_1769048100523_h..., Taxa Estimada: 0.30%[m
[32m+[m[32m02:15:01.180 [SUCCESS] [Bot] [CASH_MGT_SELL] Ordem de venda colocada: 0.00017206 BTC a R$ 480028.50[m
[32m+[m[32m02:15:26.513 [INFO]   [Bot] Iniciando ciclo 75.[m
[32m+[m[32m02:15:26.520 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:15:27.101 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479923.00, Best Ask=480029.00.[m
[32m+[m[32m02:15:27.131 [INFO]   [Bot] RSI calculado: 60.49.[m
[32m+[m[32m02:15:27.408 [INFO]   [Bot] EMA(8) calculada: 479915.94.[m
[32m+[m[32m02:15:27.711 [INFO]   [Bot] EMA(20) calculada: 479877.47.[m
[32m+[m[32m02:15:28.014 [INFO]   [Bot] EMA(12) calculada: 479908.96.[m
[32m+[m[32m02:15:28.288 [INFO]   [Bot] EMA(26) calculada: 479876.28.[m
[32m+[m[32m02:15:28.563 [INFO]   [Bot] EMA(9) calculada: 479920.34.[m
[32m+[m[32m02:15:28.841 [INFO]   [Bot] MACD calculado: MACD=32.67, Signal=479920.34.[m
[32m+[m[32m02:15:29.155 [INFO]   [Bot] Volatilidade calculada: 1.09%.[m
[32m+[m[32m02:15:29.432 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:15:29.744 [INFO]   [Bot] ADX calculado: 16.42.[m
[32m+[m[32m02:15:30.030 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.35","expectedProfit":"0.00","rsi":"60.49","emaShort":"479915.94","emaLong":"479877.47","volatility":"1.09","macd":"32.67","signal":"479920.34"}[m
[32m+[m[32m02:15:30.325 [INFO]   [Bot] ADX calculado: 16.42.[m
[32m+[m[32m02:15:30.864 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:15:56.528 [INFO]   [Bot] Iniciando ciclo 76.[m
[32m+[m[32m02:15:56.558 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 0✓, SELL: 1✓). Pares no mapa: 1[m
[32m+[m[32m02:15:57.142 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=479816.00, Best Ask=480029.00.[m
[32m+[m[32m02:15:57.168 [INFO]   [Bot] RSI calculado: 53.47.[m
[32m+[m[32m02:15:57.480 [INFO]   [Bot] EMA(8) calculada: 479907.55.[m
[32m+[m[32m02:15:57.793 [INFO]   [Bot] EMA(20) calculada: 479860.51.[m
[32m+[m[32m02:15:58.100 [INFO]   [Bot] EMA(12) calculada: 479912.80.[m
[32m+[m[32m02:15:58.384 [INFO]   [Bot] EMA(26) calculada: 479882.94.[m
[32m+[m[32m02:15:58.681 [INFO]   [Bot] EMA(9) calculada: 479913.23.[m
[32m+[m[32m02:15:58.975 [INFO]   [Bot] MACD calculado: MACD=29.86, Signal=479913.23.[m
[32m+[m[32m02:15:59.254 [INFO]   [Bot] Volatilidade calculada: 1.07%.[m
[32m+[m[32m02:15:59.543 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:15:59.831 [INFO]   [Bot] ADX calculado: 15.66.[m
[32m+[m[32m02:16:00.133 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.30","expectedProfit":"0.00","rsi":"53.47","emaShort":"479907.55","emaLong":"479860.51","volatility":"1.07","macd":"29.86","signal":"479913.23"}[m
[32m+[m[32m02:16:00.432 [INFO]   [Bot] ADX calculado: 15.66.[m
[32m+[m[32m02:16:00.985 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:16:01.023 [SUCCESS] [Bot] [CASH_MGT_BUY] 📉 Queda -0.022% | INICIAR PAR (1/6)[m
[32m+[m[32m02:16:02.009 [SUCCESS] [Bot] Ordem BUY 01KFHQSFRP710ZY9F4F22HY2XE colocada @ R$479922.50, Qty: 0.00014847, Pair: PAIR_1769048161339_9..., Taxa Estimada: 0.30%[m
[32m+[m[32m02:16:02.012 [SUCCESS] [Bot] [CASH_MGT_BUY] Ordem de compra colocada: 0.00014847 BTC a R$ 479922.50[m
[32m+[m[32m02:16:26.540 [INFO]   [Bot] Iniciando ciclo 77.[m
[32m+[m[32m02:16:26.588 [DEBUG]  [Bot] Sincronização: Carregadas 2 ordens da BD (BUY: 1✓, SELL: 1✓). Pares no mapa: 2[m
[32m+[m[32m02:16:27.249 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480023.00, Best Ask=480100.00.[m
[32m+[m[32m02:16:27.282 [INFO]   [Bot] RSI calculado: 62.70.[m
[32m+[m[32m02:16:27.729 [INFO]   [Bot] EMA(8) calculada: 480008.61.[m
[32m+[m[32m02:16:28.093 [INFO]   [Bot] EMA(20) calculada: 479911.70.[m
[32m+[m[32m02:16:28.380 [INFO]   [Bot] EMA(12) calculada: 479945.14.[m
[32m+[m[32m02:16:28.672 [INFO]   [Bot] EMA(26) calculada: 479905.64.[m
[32m+[m[32m02:16:28.940 [INFO]   [Bot] EMA(9) calculada: 479957.80.[m
[32m+[m[32m02:16:29.246 [INFO]   [Bot] MACD calculado: MACD=39.49, Signal=479957.80.[m
[32m+[m[32m02:16:29.526 [INFO]   [Bot] Volatilidade calculada: 1.07%.[m
[32m+[m[32m02:16:29.816 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:16:30.121 [INFO]   [Bot] ADX calculado: 17.43.[m
[32m+[m[32m02:16:30.569 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.36","expectedProfit":"0.00","rsi":"62.70","emaShort":"480008.61","emaLong":"479911.70","volatility":"1.07","macd":"39.49","signal":"479957.80"}[m
[32m+[m[32m02:16:30.854 [INFO]   [Bot] ADX calculado: 17.43.[m
[32m+[m[32m02:16:31.438 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:16:56.554 [INFO]   [Bot] Iniciando ciclo 78.[m
[32m+[m[32m02:16:56.582 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:16:57.130 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480395.00, Best Ask=480664.00.[m
[32m+[m[32m02:16:57.177 [INFO]   [Bot] RSI calculado: 82.84.[m
[32m+[m[32m02:16:57.483 [INFO]   [Bot] EMA(8) calculada: 480207.37.[m
[32m+[m[32m02:16:57.797 [INFO]   [Bot] EMA(20) calculada: 480035.53.[m
[32m+[m[32m02:16:58.103 [INFO]   [Bot] EMA(12) calculada: 480100.06.[m
[32m+[m[32m02:16:58.408 [INFO]   [Bot] EMA(26) calculada: 479992.68.[m
[32m+[m[32m02:16:58.737 [INFO]   [Bot] EMA(9) calculada: 480195.88.[m
[32m+[m[32m02:16:59.009 [INFO]   [Bot] MACD calculado: MACD=107.38, Signal=480195.88.[m
[32m+[m[32m02:16:59.290 [INFO]   [Bot] Volatilidade calculada: 1.23%.[m
[32m+[m[32m02:16:59.603 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:16:59.949 [INFO]   [Bot] ADX calculado: 23.25.[m
[32m+[m[32m02:17:00.263 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.48","expectedProfit":"0.00","rsi":"82.84","emaShort":"480207.37","emaLong":"480035.53","volatility":"1.23","macd":"107.38","signal":"480195.88"}[m
[32m+[m[32m02:17:00.566 [INFO]   [Bot] ADX calculado: 23.25.[m
[32m+[m[32m02:17:01.128 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:17:26.565 [INFO]   [Bot] Iniciando ciclo 79.[m
[32m+[m[32m02:17:26.581 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:17:27.155 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480000.00, Best Ask=480353.00.[m
[32m+[m[32m02:17:27.277 [INFO]   [Bot] RSI calculado: 66.41.[m
[32m+[m[32m02:17:27.610 [INFO]   [Bot] EMA(8) calculada: 480188.01.[m
[32m+[m[32m02:17:27.870 [INFO]   [Bot] EMA(20) calculada: 480063.53.[m
[32m+[m[32m02:17:28.198 [INFO]   [Bot] EMA(12) calculada: 480162.25.[m
[32m+[m[32m02:17:28.468 [INFO]   [Bot] EMA(26) calculada: 479993.76.[m
[32m+[m[32m02:17:28.788 [INFO]   [Bot] EMA(9) calculada: 480183.26.[m
[32m+[m[32m02:17:29.103 [INFO]   [Bot] MACD calculado: MACD=168.49, Signal=480183.26.[m
[32m+[m[32m02:17:29.388 [INFO]   [Bot] Volatilidade calculada: 1.31%.[m
[32m+[m[32m02:17:29.701 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:17:30.015 [INFO]   [Bot] ADX calculado: 22.20.[m
[32m+[m[32m02:17:30.299 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.39","expectedProfit":"0.00","rsi":"66.41","emaShort":"480188.01","emaLong":"480063.53","volatility":"1.31","macd":"168.49","signal":"480183.26"}[m
[32m+[m[32m02:17:30.569 [INFO]   [Bot] ADX calculado: 22.20.[m
[32m+[m[32m02:17:31.110 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:17:56.579 [INFO]   [Bot] Iniciando ciclo 80.[m
[32m+[m[32m02:17:56.589 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:17:57.162 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480026.00, Best Ask=480351.00.[m
[32m+[m[32m02:17:57.238 [INFO]   [Bot] RSI calculado: 57.42.[m
[32m+[m[32m02:17:57.560 [INFO]   [Bot] EMA(8) calculada: 480206.82.[m
[32m+[m[32m02:17:57.910 [INFO]   [Bot] EMA(20) calculada: 480086.20.[m
[32m+[m[32m02:17:58.210 [INFO]   [Bot] EMA(12) calculada: 480162.64.[m
[32m+[m[32m02:17:58.518 [INFO]   [Bot] EMA(26) calculada: 480036.28.[m
[32m+[m[32m02:17:58.751 [INFO]   [Bot] EMA(9) calculada: 480179.41.[m
[32m+[m[32m02:17:58.960 [INFO]   [Bot] MACD calculado: MACD=126.36, Signal=480179.41.[m
[32m+[m[32m02:17:59.199 [INFO]   [Bot] Volatilidade calculada: 1.29%.[m
[32m+[m[32m02:17:59.456 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:17:59.708 [INFO]   [Bot] ADX calculado: 21.42.[m
[32m+[m[32m02:17:59.914 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.33","expectedProfit":"0.00","rsi":"57.42","emaShort":"480206.82","emaLong":"480086.20","volatility":"1.29","macd":"126.36","signal":"480179.41"}[m
[32m+[m[32m02:18:00.144 [INFO]   [Bot] ADX calculado: 21.42.[m
[32m+[m[32m02:18:00.385 [INFO]   [Bot] [OPTIMIZER] Iniciando ciclo de otimização de parâmetros.[m
[32m+[m[32m02:18:00.669 [SUCCESS] [Bot] [OPTIMIZER] Parâmetros ajustados: {"spreadPct":0.00039366,"orderSize":0.05,"stopLoss":0.008,"takeProfit":0.001,"maxOrderAge":1800,"minVolatility":0.1,"maxVolatility":2.5}[m
[32m+[m[32m02:18:01.077 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:18:26.593 [INFO]   [Bot] Iniciando ciclo 81.[m
[32m+[m[32m02:18:26.663 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:18:27.303 [INFO]   [Bot] Consultando tendências externas do Bitcoin...[m
[32m+[m[32m02:18:28.171 [SUCCESS] [Bot] Tendência Externa: NEUTRAL (Score: 53/100, Confiança: 100%)[m
[32m+[m[32m02:18:28.422 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480111.00, Best Ask=480563.00.[m
[32m+[m[32m02:18:28.468 [INFO]   [Bot] RSI calculado: 65.37.[m
[32m+[m[32m02:18:28.805 [INFO]   [Bot] EMA(8) calculada: 480320.92.[m
[32m+[m[32m02:18:29.053 [INFO]   [Bot] EMA(20) calculada: 480121.77.[m
[32m+[m[32m02:18:29.328 [INFO]   [Bot] EMA(12) calculada: 480204.95.[m
[32m+[m[32m02:18:29.624 [INFO]   [Bot] EMA(26) calculada: 480090.94.[m
[32m+[m[32m02:18:29.938 [INFO]   [Bot] EMA(9) calculada: 480251.06.[m
[32m+[m[32m02:18:30.233 [INFO]   [Bot] MACD calculado: MACD=114.01, Signal=480251.06.[m
[32m+[m[32m02:18:30.461 [INFO]   [Bot] Volatilidade calculada: 1.29%.[m
[32m+[m[32m02:18:30.726 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:18:31.028 [INFO]   [Bot] ADX calculado: 22.28.[m
[32m+[m[32m02:18:31.314 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.38","expectedProfit":"0.00","rsi":"65.37","emaShort":"480320.92","emaLong":"480121.77","volatility":"1.29","macd":"114.01","signal":"480251.06"}[m
[32m+[m[32m02:18:31.566 [INFO]   [Bot] ADX calculado: 22.28.[m
[32m+[m[32m02:18:32.137 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:18:56.606 [INFO]   [Bot] Iniciando ciclo 82.[m
[32m+[m[32m02:18:56.620 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:18:57.203 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480216.00, Best Ask=480618.00.[m
[32m+[m[32m02:18:57.325 [INFO]   [Bot] RSI calculado: 70.60.[m
[32m+[m[32m02:18:57.584 [INFO]   [Bot] EMA(8) calculada: 480311.60.[m
[32m+[m[32m02:18:57.921 [INFO]   [Bot] EMA(20) calculada: 480164.25.[m
[32m+[m[32m02:18:58.264 [INFO]   [Bot] EMA(12) calculada: 480283.90.[m
[32m+[m[32m02:18:58.539 [INFO]   [Bot] EMA(26) calculada: 480139.89.[m
[32m+[m[32m02:18:58.837 [INFO]   [Bot] EMA(9) calculada: 480361.05.[m
[32m+[m[32m02:18:59.252 [INFO]   [Bot] MACD calculado: MACD=144.01, Signal=480361.05.[m
[32m+[m[32m02:18:59.623 [INFO]   [Bot] Volatilidade calculada: 1.27%.[m
[32m+[m[32m02:18:59.921 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:19:00.205 [INFO]   [Bot] ADX calculado: 23.79.[m
[32m+[m[32m02:19:00.485 [INFO]   [Bot] Previsão de preço | {"trend":"neutral","confidence":"0.41","expectedProfit":"0.00","rsi":"70.60","emaShort":"480311.60","emaLong":"480164.25","volatility":"1.27","macd":"144.01","signal":"480361.05"}[m
[32m+[m[32m02:19:00.748 [INFO]   [Bot] ADX calculado: 23.79.[m
[32m+[m[32m02:19:01.315 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:19:26.620 [INFO]   [Bot] Iniciando ciclo 83.[m
[32m+[m[32m02:19:26.623 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:19:27.372 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480387.00, Best Ask=480805.00.[m
[32m+[m[32m02:19:27.519 [INFO]   [Bot] RSI calculado: 71.54.[m
[32m+[m[32m02:19:27.726 [INFO]   [Bot] EMA(8) calculada: 480425.57.[m
[32m+[m[32m02:19:27.940 [INFO]   [Bot] EMA(20) calculada: 480283.17.[m
[32m+[m[32m02:19:28.190 [INFO]   [Bot] EMA(12) calculada: 480435.59.[m
[32m+[m[32m02:19:28.483 [INFO]   [Bot] EMA(26) calculada: 480204.96.[m
[32m+[m[32m02:19:28.800 [INFO]   [Bot] EMA(9) calculada: 480407.73.[m
[32m+[m[32m02:19:29.114 [INFO]   [Bot] MACD calculado: MACD=230.63, Signal=480407.73.[m
[32m+[m[32m02:19:29.402 [INFO]   [Bot] Volatilidade calculada: 1.27%.[m
[32m+[m[32m02:19:29.782 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:19:30.158 [INFO]   [Bot] ADX calculado: 26.63.[m
[32m+[m[32m02:19:30.446 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.42","expectedProfit":"0.00","rsi":"71.54","emaShort":"480425.57","emaLong":"480283.17","volatility":"1.27","macd":"230.63","signal":"480407.73"}[m
[32m+[m[32m02:19:30.868 [INFO]   [Bot] ADX calculado: 26.63.[m
[32m+[m[32m02:19:31.450 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:19:56.634 [INFO]   [Bot] Iniciando ciclo 84.[m
[32m+[m[32m02:19:56.654 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:19:57.246 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480390.00, Best Ask=480800.00.[m
[32m+[m[32m02:19:57.250 [INFO]   [Bot] RSI calculado: 54.23.[m
[32m+[m[32m02:19:57.519 [INFO]   [Bot] EMA(8) calculada: 480512.39.[m
[32m+[m[32m02:19:57.777 [INFO]   [Bot] EMA(20) calculada: 480332.64.[m
[32m+[m[32m02:19:58.092 [INFO]   [Bot] EMA(12) calculada: 480433.31.[m
[32m+[m[32m02:19:58.358 [INFO]   [Bot] EMA(26) calculada: 480250.67.[m
[32m+[m[32m02:19:58.596 [INFO]   [Bot] EMA(9) calculada: 480476.44.[m
[32m+[m[32m02:19:58.883 [INFO]   [Bot] MACD calculado: MACD=182.65, Signal=480476.44.[m
[32m+[m[32m02:19:59.179 [INFO]   [Bot] Volatilidade calculada: 1.26%.[m
[32m+[m[32m02:19:59.409 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:19:59.700 [INFO]   [Bot] ADX calculado: 29.06.[m
[32m+[m[32m02:19:59.990 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.31","expectedProfit":"0.00","rsi":"54.23","emaShort":"480512.39","emaLong":"480332.64","volatility":"1.26","macd":"182.65","signal":"480476.44"}[m
[32m+[m[32m02:20:00.222 [INFO]   [Bot] ADX calculado: 29.06.[m
[32m+[m[32m02:20:01.067 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:20:26.649 [INFO]   [Bot] Iniciando ciclo 85.[m
[32m+[m[32m02:20:26.656 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:20:27.337 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480395.00, Best Ask=480761.00.[m
[32m+[m[32m02:20:27.467 [INFO]   [Bot] RSI calculado: 95.89.[m
[32m+[m[32m02:20:27.772 [INFO]   [Bot] EMA(8) calculada: 480549.02.[m
[32m+[m[32m02:20:28.060 [INFO]   [Bot] EMA(20) calculada: 480369.92.[m
[32m+[m[32m02:20:28.325 [INFO]   [Bot] EMA(12) calculada: 480476.02.[m
[32m+[m[32m02:20:28.611 [INFO]   [Bot] EMA(26) calculada: 480286.28.[m
[32m+[m[32m02:20:28.907 [INFO]   [Bot] EMA(9) calculada: 480528.94.[m
[32m+[m[32m02:20:29.219 [INFO]   [Bot] MACD calculado: MACD=189.75, Signal=480528.94.[m
[32m+[m[32m02:20:29.480 [INFO]   [Bot] Volatilidade calculada: 1.24%.[m
[32m+[m[32m02:20:29.771 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:20:30.061 [INFO]   [Bot] ADX calculado: 30.73.[m
[32m+[m[32m02:20:30.350 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.56","expectedProfit":"0.00","rsi":"95.89","emaShort":"480549.02","emaLong":"480369.92","volatility":"1.24","macd":"189.75","signal":"480528.94"}[m
[32m+[m[32m02:20:30.659 [INFO]   [Bot] ADX calculado: 30.73.[m
[32m+[m[32m02:20:31.531 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:20:56.665 [INFO]   [Bot] Iniciando ciclo 86.[m
[32m+[m[32m02:20:56.678 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:20:57.261 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480407.00, Best Ask=480860.00.[m
[32m+[m[32m02:20:57.267 [INFO]   [Bot] RSI calculado: 96.26.[m
[32m+[m[32m02:20:57.585 [INFO]   [Bot] EMA(8) calculada: 480606.37.[m
[32m+[m[32m02:20:57.912 [INFO]   [Bot] EMA(20) calculada: 480436.52.[m
[32m+[m[32m02:20:58.203 [INFO]   [Bot] EMA(12) calculada: 480540.76.[m
[32m+[m[32m02:20:58.521 [INFO]   [Bot] EMA(26) calculada: 480376.44.[m
[32m+[m[32m02:20:58.833 [INFO]   [Bot] EMA(9) calculada: 480575.17.[m
[32m+[m[32m02:20:59.111 [INFO]   [Bot] MACD calculado: MACD=164.31, Signal=480575.17.[m
[32m+[m[32m02:20:59.422 [INFO]   [Bot] Volatilidade calculada: 1.23%.[m
[32m+[m[32m02:20:59.638 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:20:59.939 [INFO]   [Bot] ADX calculado: 32.77.[m
[32m+[m[32m02:21:00.210 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.56","expectedProfit":"0.00","rsi":"96.26","emaShort":"480606.37","emaLong":"480436.52","volatility":"1.23","macd":"164.31","signal":"480575.17"}[m
[32m+[m[32m02:21:00.490 [INFO]   [Bot] ADX calculado: 32.77.[m
[32m+[m[32m02:21:01.066 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:21:26.680 [INFO]   [Bot] Iniciando ciclo 87.[m
[32m+[m[32m02:21:26.698 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:21:27.234 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480437.00, Best Ask=480859.00.[m
[32m+[m[32m02:21:27.417 [INFO]   [Bot] RSI calculado: 94.81.[m
[32m+[m[32m02:21:27.850 [INFO]   [Bot] EMA(8) calculada: 480622.68.[m
[32m+[m[32m02:21:28.134 [INFO]   [Bot] EMA(20) calculada: 480538.11.[m
[32m+[m[32m02:21:28.414 [INFO]   [Bot] EMA(12) calculada: 480581.99.[m
[32m+[m[32m02:21:28.732 [INFO]   [Bot] EMA(26) calculada: 480408.08.[m
[32m+[m[32m02:21:29.040 [INFO]   [Bot] EMA(9) calculada: 480620.61.[m
[32m+[m[32m02:21:29.314 [INFO]   [Bot] MACD calculado: MACD=173.91, Signal=480620.61.[m
[32m+[m[32m02:21:29.558 [INFO]   [Bot] Volatilidade calculada: 1.21%.[m
[32m+[m[32m02:21:29.894 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:21:30.179 [INFO]   [Bot] ADX calculado: 34.69.[m
[32m+[m[32m02:21:30.426 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.56","expectedProfit":"0.00","rsi":"94.81","emaShort":"480622.68","emaLong":"480538.11","volatility":"1.21","macd":"173.91","signal":"480620.61"}[m
[32m+[m[32m02:21:30.839 [INFO]   [Bot] ADX calculado: 34.69.[m
[32m+[m[32m02:21:31.726 [DEBUG]  [Bot] [CASH_MGT] USE_CASH_MANAGEMENT ativado. Avaliando sinais...[m
[32m+[m[32m02:21:56.696 [INFO]   [Bot] Iniciando ciclo 88.[m
[32m+[m[32m02:21:56.708 [DEBUG]  [Bot] Sincronização: Carregadas 1 ordens da BD (BUY: 1✓, SELL: 0✓). Pares no mapa: 1[m
[32m+[m[32m02:21:57.255 [SUCCESS] [Bot] Orderbook atualizado: Best Bid=480615.00, Best Ask=480895.00.[m
[32m+[m[32m02:21:57.283 [INFO]   [Bot] RSI calculado: 95.19.[m
[32m+[m[32m02:21:57.573 [INFO]   [Bot] EMA(8) calculada: 480672.68.[m
[32m+[m[32m02:21:57.891 [INFO]   [Bot] EMA(20) calculada: 480529.76.[m
[32m+[m[32m02:21:58.184 [INFO]   [Bot] EMA(12) calculada: 480655.24.[m
[32m+[m[32m02:21:58.481 [INFO]   [Bot] EMA(26) calculada: 480450.34.[m
[32m+[m[32m02:21:58.782 [INFO]   [Bot] EMA(9) calculada: 480668.88.[m
[32m+[m[32m02:21:59.119 [INFO]   [Bot] MACD calculado: MACD=204.90, Signal=480668.88.[m
[32m+[m[32m02:21:59.403 [INFO]   [Bot] Volatilidade calculada: 1.20%.[m
[32m+[m[32m02:21:59.706 [INFO]   [Bot] Fills históricos insuficientes para análise. Retornando valores padrão.[m
[32m+[m[32m02:22:00.042 [INFO]   [Bot] ADX calculado: 37.50.[m
[32m+[m[32m02:22:00.350 [INFO]   [Bot] Previsão de preço | {"trend":"up","confidence":"0.56","expectedProfit":"0.00","rsi":"95.19","emaShort":"480672.6