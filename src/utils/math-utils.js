/**
 * src/utils/math-utils.js - Funções matemáticas e de cálculo
 */

class MathUtils {
    /**
     * Arredondar para decimal fixo
     */
    static round(value, decimals = 8) {
        return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    }

    /**
     * Calcular percentual
     */
    static percentage(value, percent, decimals = 8) {
        return this.round(value * (percent / 100), decimals);
    }

    /**
     * Calcular percentual inverso
     */
    static percentageOf(part, whole, decimals = 2) {
        if (whole === 0) return 0;
        return this.round((part / whole) * 100, decimals);
    }

    /**
     * Calcular diferença percentual
     */
    static percentageDifference(current, previous, decimals = 4) {
        if (previous === 0) return 0;
        return this.round(((current - previous) / Math.abs(previous)) * 100, decimals);
    }

    /**
     * Calcular lucro/prejuízo
     */
    static pnl(entryPrice, exitPrice, quantity, fee = 0) {
        const grossPnl = (exitPrice - entryPrice) * quantity;
        const fees = (entryPrice * quantity * fee) + (exitPrice * quantity * fee);
        return this.round(grossPnl - fees, 8);
    }

    /**
     * Calcular taxa efetiva
     */
    static effectiveRate(price, quantity, fee = 0) {
        return this.round(price * quantity * fee, 8);
    }

    /**
     * Calcular média móvel simples
     */
    static sma(values, period) {
        if (values.length < period) return null;
        const sum = values.slice(-period).reduce((a, b) => a + b, 0);
        return this.round(sum / period, 8);
    }

    /**
     * Calcular média móvel exponencial
     */
    static ema(values, period) {
        if (values.length < period) return null;
        
        const k = 2 / (period + 1);
        let emaValue = this.sma(values, period);
        
        for (let i = values.length - period; i < values.length; i++) {
            emaValue = (values[i] * k) + (emaValue * (1 - k));
        }
        
        return this.round(emaValue, 8);
    }

    /**
     * Calcular volatilidade (desvio padrão)
     */
    static volatility(values, period = null) {
        const p = period || values.length;
        if (values.length < p) return 0;
        
        const slice = values.slice(-p);
        const mean = slice.reduce((a, b) => a + b, 0) / p;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / p;
        
        return this.round(Math.sqrt(variance), 8);
    }

    /**
     * Calcular RSI (Relative Strength Index)
     */
    static rsi(values, period = 14) {
        if (values.length < period + 1) return 50; // Neutro

        let gains = 0;
        let losses = 0;

        for (let i = values.length - period; i < values.length; i++) {
            const diff = values[i] - values[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return gains > 0 ? 100 : 0;

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return this.round(rsi, 2);
    }

    /**
     * Calcular MACD
     */
    static macd(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (values.length < slowPeriod + signalPeriod) return null;

        const ema12 = this.ema(values, fastPeriod);
        const ema26 = this.ema(values, slowPeriod);

        if (!ema12 || !ema26) return null;

        const macdLine = this.round(ema12 - ema26, 8);
        
        // Criar array de MACD line para calcular signal
        const macdValues = [];
        for (let i = slowPeriod - 1; i < values.length; i++) {
            const e12 = this.ema(values.slice(0, i + 1), fastPeriod);
            const e26 = this.ema(values.slice(0, i + 1), slowPeriod);
            if (e12 && e26) {
                macdValues.push(e12 - e26);
            }
        }

        const signalLine = this.ema(macdValues, signalPeriod);
        const histogram = this.round((macdLine - (signalLine || 0)), 8);

        return {
            macd: macdLine,
            signal: signalLine || 0,
            histogram
        };
    }

    /**
     * Calcular spread
     */
    static spread(bid, ask, decimals = 4) {
        if (bid === 0) return 0;
        const spreadAbs = ask - bid;
        const spreadPct = (spreadAbs / bid) * 100;
        return this.round(spreadPct, decimals);
    }

    /**
     * Calcular mid price
     */
    static midPrice(bid, ask) {
        return this.round((bid + ask) / 2, 8);
    }

    /**
     * Calcular quantidade de ordem com base em capital
     */
    static orderQuantity(capital, price, riskPercent = 1) {
        const riskAmount = capital * (riskPercent / 100);
        return this.round(riskAmount / price, 8);
    }

    /**
     * Calcular preço de entrada média
     */
    static averageEntryPrice(positions = []) {
        if (positions.length === 0) return 0;

        const totalValue = positions.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);

        if (totalQuantity === 0) return 0;

        return this.round(totalValue / totalQuantity, 8);
    }

    /**
     * Calcular score de profitabilidade (0 a 100)
     */
    static profitabilityScore(roi, accuracy, winRate) {
        // Normalizar valores (0-1)
        const roiScore = Math.min(roi / 10, 1) * 40; // 40% do score
        const accuracyScore = accuracy * 35; // 35% do score
        const winRateScore = winRate * 25; // 25% do score

        return this.round(roiScore + accuracyScore + winRateScore, 2);
    }

    /**
     * Calcular Sharpe Ratio
     */
    static sharpeRatio(returns, riskFreeRate = 0.03, decimals = 4) {
        if (returns.length < 2) return 0;

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;

        const sharpe = (avgReturn - riskFreeRate) / stdDev;
        return this.round(sharpe, decimals);
    }

    /**
     * Calcular Draw Down
     */
    static drawdown(values) {
        if (values.length === 0) return 0;

        let maxValue = values[0];
        let maxDrawdown = 0;

        for (let i = 1; i < values.length; i++) {
            if (values[i] > maxValue) {
                maxValue = values[i];
            }

            const drawdown = (maxValue - values[i]) / maxValue;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return this.round(maxDrawdown * 100, 2);
    }

    /**
     * Verificar se valor está dentro de range
     */
    static inRange(value, min, max) {
        return value >= min && value <= max;
    }

    /**
     * Limitar valor em range
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Calcular desvio padrão normalizado (z-score)
     */
    static zScore(value, mean, stdDev) {
        if (stdDev === 0) return 0;
        return this.round((value - mean) / stdDev, 4);
    }
}

module.exports = MathUtils;
