/**
 * momentum_sync.js - Sincronização de dados de momentum entre bot.js e dashboard.js
 * Permite que o dashboard visualize as ordens em validação do bot em tempo real
 */

const path = require('path');
const fs = require('fs');

class MomentumSync {
    constructor() {
        this.cacheFile = path.join(__dirname, '.momentum_cache.json');
        this.lastUpdate = 0;
        this.cacheData = {
            simulatedOrders: [],
            status: {
                simulated: 0,
                pending: 0,
                confirmed: 0,
                rejected: 0,
                expired: 0
            },
            lastUpdate: new Date().toISOString()
        };
        this.loadCache();
    }

    /**
     * Sincronizar estado do validador de momentum para compartilhamento com dashboard
     * @param {MomentumOrderValidator} momentumValidator - Instância do validator
     */
    syncFromValidator(momentumValidator) {
        try {
            // Converter mapa em array
            const simulatedOrders = Array.from(momentumValidator.simulatedOrders.entries()).map(([id, order]) => ({
                id,
                side: order.side,
                createdPrice: order.createdPrice,
                currentPrice: order.currentPrice,
                status: order.status,
                qty: order.qty,
                peaks: order.peaks || [],
                valleys: order.valleys || [],
                createdAt: order.createdAt,
                lastUpdate: order.lastUpdate,
                reason: order.reason || null,
                reversalThreshold: order.reversalThreshold || 0.01,
                confirmationReversals: order.confirmationReversals || 0,
                priceHistory: (order.priceHistory || []).slice(-20)
            }));

            // Obter status
            const status = momentumValidator.getSimulatedOrdersStatus();

            // Atualizar cache
            this.cacheData = {
                simulatedOrders,
                status,
                lastUpdate: new Date().toISOString()
            };

            // Salvar em arquivo para compartilhamento
            this.saveCache();
        } catch (err) {
            console.error('[MomentumSync] Erro ao sincronizar do validator:', err.message);
        }
    }

    /**
     * Salvar cache em arquivo JSON
     */
    saveCache() {
        try {
            fs.writeFileSync(
                this.cacheFile,
                JSON.stringify(this.cacheData, null, 2),
                'utf-8'
            );
            this.lastUpdate = Date.now();
        } catch (err) {
            console.error('[MomentumSync] Erro ao salvar cache:', err.message);
        }
    }

    /**
     * Carregar cache do arquivo JSON
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const content = fs.readFileSync(this.cacheFile, 'utf-8');
                this.cacheData = JSON.parse(content);
                this.lastUpdate = Date.now();
            }
        } catch (err) {
            console.error('[MomentumSync] Erro ao carregar cache:', err.message);
            this.cacheData = {
                simulatedOrders: [],
                status: {
                    simulated: 0,
                    pending: 0,
                    confirmed: 0,
                    rejected: 0,
                    expired: 0
                },
                lastUpdate: new Date().toISOString()
            };
        }
    }

    /**
     * Obter dados cached de momentum
     */
    getCacheData() {
        // Recarregar do arquivo a cada chamada para garantir dados frescos
        this.loadCache();
        return this.cacheData;
    }

    /**
     * Limpar cache
     */
    clearCache() {
        this.cacheData = {
            simulatedOrders: [],
            status: {
                simulated: 0,
                pending: 0,
                confirmed: 0,
                rejected: 0,
                expired: 0
            },
            lastUpdate: new Date().toISOString()
        };
        this.saveCache();
    }
}

module.exports = MomentumSync;
