/**
 * momentum_order_validator.js
 * 
 * Sistema de Validação de Ordens por Reversão de Momentum
 * 
 * Estratégia:
 * - SELL: Cria em simulado, confirma se preço PARA de subir ou COMEÇA a cair
 * - BUY: Cria em simulado, confirma se preço PARA de cair ou COMEÇA a subir (levemente)
 * 
 * Isso aumenta a precisão ao não colocar ordem no meio de um movimento errado
 */

class MomentumOrderValidator {
    constructor(logger) {
        this.logger = logger;
        this.simulatedOrders = new Map(); // { orderId: { side, price, createdAt, createdPrice, peaks/valleys } }
        this.priceHistory = []; // Histórico de preços para cálculo de momentum
        this.confirmationWaitCycles = 2; // Esperar 2 ciclos antes de confirmar (reduzido de 3)
        this.peakThreshold = 0.0003; // 0.03% para ser considerado pico/vale (reduzido de 0.1%)
        this.momentumThreshold = -0.0001; // -0.01% mudança de momentum para confirmar reversão
    }

    /**
     * Registra um preço no histórico
     */
    recordPrice(midPrice) {
        this.priceHistory.push({
            price: midPrice,
            timestamp: Date.now()
        });
        
        // Manter apenas últimos 30 registros (últimos ~2 minutos)
        if (this.priceHistory.length > 30) {
            this.priceHistory.shift();
        }
    }

    /**
     * Calcula a direção do momentum
     * Retorna: 'up' | 'down' | 'neutral'
     */
    calculateMomentum() {
        if (this.priceHistory.length < 5) return 'neutral';
        
        const recent = this.priceHistory.slice(-5);
        const prices = recent.map(r => r.price);
        
        // Calcula a tendência dos últimos 5 preços
        let upCount = 0;
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) upCount++;
        }
        
        if (upCount >= 4) return 'up';
        if (upCount <= 1) return 'down';
        return 'neutral';
    }

    /**
     * Obtém a velocidade do momentum (taxa de mudança)
     */
    getMomentumVelocity() {
        if (this.priceHistory.length < 2) return 0;
        
        const first = this.priceHistory[0].price;
        const last = this.priceHistory[this.priceHistory.length - 1].price;
        
        return (last - first) / first;
    }

    /**
     * Cria uma ordem simulada para validação
     */
    createSimulatedOrder(orderId, side, price, qty) {
        const momentum = this.calculateMomentum();
        
        this.simulatedOrders.set(orderId, {
            id: orderId,
            side: side.toLowerCase(),
            price: price,
            qty: qty,
            createdAt: Date.now(),
            createdPrice: price,
            currentPrice: price,
            createdMomentum: momentum,
            status: 'simulated', // simulated, pending, confirmed, rejected
            rejectionReason: null,
            confirmationCycles: 0,
            priceHistory: [price],
            peakPrice: price,
            valleyPrice: price,
            momentumHistory: [momentum],
            peaks: [price],
            valleys: [price],
            confirmationReversals: 0,
            reversalThreshold: this.peakThreshold
        });

        return {
            orderId,
            status: 'simulated',
            expectedConfirmationCycles: this.confirmationWaitCycles,
            expectedConfirmationLogic: this.getConfirmationLogic(side),
            createdMomentum: momentum
        };
    }

    /**
     * Retorna a lógica de confirmação esperada
     */
    getConfirmationLogic(side) {
        if (side.toLowerCase() === 'sell') {
            return 'Confirmará quando preço parar de subir ou começar a descer';
        } else if (side.toLowerCase() === 'buy') {
            return 'Confirmará quando preço parar de descer ou começar a subir';
        }
        return 'Confirmação padrão';
    }

    /**
     * Atualiza o estado da ordem com novo preço
     * Retorna: { shouldConfirm: bool, reason: string, status: string }
     */
    updateOrderWithPrice(orderId, currentPrice) {
        const order = this.simulatedOrders.get(orderId);
        if (!order) {
            return { shouldConfirm: false, reason: 'Ordem não encontrada', status: 'error' };
        }

        if (order.status !== 'simulated' && order.status !== 'pending') {
            return { shouldConfirm: false, reason: `Ordem já está ${order.status}`, status: order.status };
        }

        // Atualizar preço atual
        order.currentPrice = currentPrice;

        // Atualizar histórico de preços
        order.priceHistory.push(currentPrice);
        if (order.priceHistory.length > 20) {
            order.priceHistory.shift();
        }

        // Atualizar picos e vales
        if (currentPrice > order.peakPrice) {
            order.peakPrice = currentPrice;
            order.peaks = Array.isArray(order.peaks) ? order.peaks : [];
            order.peaks.push(currentPrice);
            if (order.peaks.length > 5) order.peaks.shift();
        }
        if (currentPrice < order.valleyPrice) {
            order.valleyPrice = currentPrice;
            order.valleys = Array.isArray(order.valleys) ? order.valleys : [];
            order.valleys.push(currentPrice);
            if (order.valleys.length > 5) order.valleys.shift();
        }

        // Calcular momentum atual
        const currentMomentum = this.calculateMomentum();
        order.momentumHistory.push(currentMomentum);
        if (order.momentumHistory.length > 10) {
            order.momentumHistory.shift();
        }

        // Contabilizar reversões de momentum
        const prevMomentum = order.momentumHistory.length > 1
            ? order.momentumHistory[order.momentumHistory.length - 2]
            : null;
        if (prevMomentum && prevMomentum !== currentMomentum && prevMomentum !== 'neutral' && currentMomentum !== 'neutral') {
            order.confirmationReversals = (order.confirmationReversals || 0) + 1;
        }

        order.confirmationCycles++;

        // Incrementar ciclos de espera
        const waitedEnough = order.confirmationCycles >= this.confirmationWaitCycles;

        if (!waitedEnough) {
            return {
                shouldConfirm: false,
                reason: `Aguardando ${this.confirmationWaitCycles - order.confirmationCycles} ciclo(s) mais`,
                status: 'pending',
                cycleProgress: `${order.confirmationCycles}/${this.confirmationWaitCycles}`
            };
        }

        // ===== LÓGICA DE CONFIRMAÇÃO =====
        const priceChange = (currentPrice - order.createdPrice) / order.createdPrice;
        const priceMovedUp = currentPrice >= order.createdPrice * (1 + this.peakThreshold);
        const priceMovedDown = currentPrice <= order.createdPrice * (1 - this.peakThreshold);

        if (order.side === 'sell') {
            // SELL confirmará quando:
            // 1) Momentum atual não é 'up' (parou de subir ou está caindo/neutro)
            // 2) Ou preço completou movimento: subiu pelo menos 0.03% e agora está caindo

            const createdWhileUp = order.createdMomentum === 'up';
            const momentumNotUp = currentMomentum !== 'up'; // Parou ou virou
            
            // Checar se preço atingiu movimento esperado
            const priceRoseThenFell = currentPrice > order.createdPrice * (1 + this.peakThreshold) 
                                     && currentPrice < order.peakPrice * (1 - this.peakThreshold/2);
            
            // Confirmação se:
            // - Criada durante uptrend E momentum mudou
            // - OU preço completou ciclo de subida+descida
            if ((createdWhileUp && momentumNotUp) || priceRoseThenFell) {
                return {
                    shouldConfirm: true,
                    reason: `SELL confirmado: Preço em R$${currentPrice.toFixed(2)}, Pico R$${order.peakPrice.toFixed(2)}, Momentum: ${order.createdMomentum} → ${currentMomentum}`,
                    status: 'confirmed',
                    priceMovement: `${((currentPrice - order.createdPrice) / order.createdPrice * 100).toFixed(2)}%`,
                    peakPrice: order.peakPrice
                };
            } else if (currentPrice < order.createdPrice * (1 - this.peakThreshold * 5)) {
                // Preço caiu MUITO abaixo da entrada = má decisão
                return {
                    shouldConfirm: false,
                    reason: `SELL rejeitado: Preço caiu muito abaixo do ponto de entrada R$${order.createdPrice.toFixed(2)} → R$${currentPrice.toFixed(2)}`,
                    status: 'rejected',
                    rejectionType: 'wrong_direction'
                };
            }

            return {
                shouldConfirm: false,
                reason: `SELL aguardando confirmação: Preço em R$${currentPrice.toFixed(2)}, Pico: R$${order.peakPrice.toFixed(2)}, Momentum: ${currentMomentum}`,
                status: 'pending',
                priceRange: `${order.valleyPrice.toFixed(2)} - ${order.peakPrice.toFixed(2)}`
            };

        } else if (order.side === 'buy') {
            // BUY confirmará quando:
            // 1) Momentum atual não é 'down' (parou de cair ou está subindo/neutro)
            // 2) Ou preço completou movimento: caiu pelo menos 0.03% e agora está subindo

            const createdWhileDown = order.createdMomentum === 'down';
            const momentumNotDown = currentMomentum !== 'down'; // Parou ou virou
            
            // Checar se preço atingiu movimento esperado
            const priceFellThenRose = currentPrice < order.createdPrice * (1 - this.peakThreshold)
                                     && currentPrice > order.valleyPrice * (1 + this.peakThreshold/2);
            
            // Confirmação se:
            // - Criada durante downtrend E momentum mudou
            // - OU preço completou ciclo de descida+subida
            if ((createdWhileDown && momentumNotDown) || priceFellThenRose) {
                return {
                    shouldConfirm: true,
                    reason: `BUY confirmado: Preço em R$${currentPrice.toFixed(2)}, Vale R$${order.valleyPrice.toFixed(2)}, Momentum: ${order.createdMomentum} → ${currentMomentum}`,
                    status: 'confirmed',
                    priceMovement: `${((currentPrice - order.createdPrice) / order.createdPrice * 100).toFixed(2)}%`,
                    valleyPrice: order.valleyPrice
                };
            } else if (currentPrice > order.createdPrice * (1 + this.peakThreshold * 5)) {
                // Preço subiu MUITO acima da entrada = má decisão
                return {
                    shouldConfirm: false,
                    reason: `BUY rejeitado: Preço subiu muito acima do ponto de entrada R$${order.createdPrice.toFixed(2)} → R$${currentPrice.toFixed(2)} - bounce falso`,
                    status: 'rejected',
                    rejectionType: 'wrong_direction'
                };
            }

            return {
                shouldConfirm: false,
                reason: `BUY aguardando confirmação: Preço em R$${currentPrice.toFixed(2)}, Vale: R$${order.valleyPrice.toFixed(2)}, Momentum: ${currentMomentum}`,
                status: 'pending',
                priceRange: `${order.valleyPrice.toFixed(2)} - ${order.peakPrice.toFixed(2)}`
            };
        }

        return { shouldConfirm: false, reason: 'Tipo de ordem desconhecido', status: 'error' };
    }

    /**
     * Confirma uma ordem simulada (muda status para confirmed)
     */
    confirmOrder(orderId) {
        const order = this.simulatedOrders.get(orderId);
        if (order) {
            order.status = 'confirmed';
            order.confirmedAt = Date.now();
        }
        return order;
    }

    /**
     * Rejeita uma ordem simulada
     */
    rejectOrder(orderId, reason) {
        const order = this.simulatedOrders.get(orderId);
        if (order) {
            order.status = 'rejected';
            order.rejectionReason = reason;
            order.rejectedAt = Date.now();
        }
        return order;
    }

    /**
     * Remove uma ordem do rastreamento (após ser efetivada ou expirada)
     */
    removeOrder(orderId) {
        this.simulatedOrders.delete(orderId);
    }

    /**
     * Retorna status de todas as ordens simuladas
     */
    getSimulatedOrdersStatus() {
        const orders = Array.from(this.simulatedOrders.values());
        return {
            total: orders.length,
            byStatus: {
                simulated: orders.filter(o => o.status === 'simulated').length,
                pending: orders.filter(o => o.status === 'pending').length,
                confirmed: orders.filter(o => o.status === 'confirmed').length,
                rejected: orders.filter(o => o.status === 'rejected').length
            },
            orders: orders.map(o => ({
                id: o.id,
                side: o.side,
                createdPrice: o.createdPrice,
                currentRange: `${o.valleyPrice.toFixed(2)} - ${o.peakPrice.toFixed(2)}`,
                status: o.status,
                cycles: o.confirmationCycles
            }))
        };
    }

    /**
     * Limpa ordens antigas (expiradas)
     */
    cleanupExpiredOrders(maxAgeSeconds = 300) {
        const now = Date.now();
        const toDelete = [];

        for (const [orderId, order] of this.simulatedOrders) {
            const age = (now - order.createdAt) / 1000;
            if (age > maxAgeSeconds && order.status !== 'confirmed') {
                toDelete.push(orderId);
            }
        }

        toDelete.forEach(id => this.simulatedOrders.delete(id));
        return toDelete;
    }
}

module.exports = MomentumOrderValidator;
