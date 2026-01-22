/**
 * src/api/mercado-bitcoin-client.js - Cliente centralizado da API Mercado Bitcoin
 */

const axios = require('axios');
const { config, Logger, retryAsync, APIError, TimeoutError } = require('../utils');

class MercadoBitcoinClient {
    constructor(options = {}) {
        this.baseURL = options.baseURL || config.get('REST_BASE');
        this.simulate = options.simulate !== undefined ? options.simulate : config.get('SIMULATE');
        this.pair = options.pair || config.get('PAIR');
        this.logger = new Logger('MBClient');
        this.token = null;
        this.tokenExpiry = null;
        this.rateLimit = {
            calls: 0,
            resetTime: Date.now(),
            maxCalls: options.rateLimitPerSec || 3
        };

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: options.timeout || 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Interceptor para logging
        this.client.interceptors.response.use(
            response => response,
            error => {
                this.logger.error('API Error', {
                    status: error.response?.status,
                    message: error.message,
                    endpoint: error.config?.url
                });
                throw error;
            }
        );

        this.logger.info('Cliente inicializado', {
            simulate: this.simulate,
            pair: this.pair,
            baseURL: this.baseURL
        });
    }

    /**
     * Verificar rate limit
     */
    async _checkRateLimit() {
        const now = Date.now();

        if (now - this.rateLimit.resetTime >= 1000) {
            this.rateLimit.calls = 0;
            this.rateLimit.resetTime = now;
        }

        if (this.rateLimit.calls >= this.rateLimit.maxCalls) {
            const waitTime = 1000 - (now - this.rateLimit.resetTime);
            this.logger.warn('Rate limit atingido, aguardando', { waitTime });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this._checkRateLimit();
        }

        this.rateLimit.calls++;
    }

    /**
     * Fazer requisição com retry
     */
    async _request(method, endpoint, data = null, options = {}) {
        await this._checkRateLimit();

        const url = `${endpoint}`;
        const config = {
            method,
            url,
            ...options
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await retryAsync(
                async () => this.client(config),
                {
                    maxRetries: 3,
                    delay: 1000,
                    backoff: 2,
                    shouldRetry: (error) => {
                        // Retry apenas em erros de servidor ou rate limit
                        if (error.response?.status >= 500) return true;
                        if (error.response?.status === 429) return true;
                        if (error.code === 'ECONNREFUSED') return true;
                        if (error.code === 'ETIMEDOUT') return true;
                        return false;
                    }
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;

                if (status === 401 || status === 403) {
                    throw new APIError(
                        'Autenticação falhou',
                        status,
                        endpoint
                    );
                }

                if (status === 429) {
                    throw new APIError(
                        'Rate limit atingido',
                        429,
                        endpoint
                    );
                }

                if (status >= 500) {
                    throw new APIError(
                        `Erro no servidor: ${statusText}`,
                        status,
                        endpoint
                    );
                }

                throw new APIError(
                    error.response.data?.message || statusText,
                    status,
                    endpoint
                );
            }

            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                throw new TimeoutError(
                    'Requisição expirou',
                    endpoint
                );
            }

            throw error;
        }
    }

    /**
     * Obter orderbook
     */
    async getOrderbook() {
        if (this.simulate) {
            return this._simulateOrderbook();
        }

        try {
            const data = await this._request('GET', `/order_book/?pair=${this.pair}`);
            return {
                bids: data.bids || [],
                asks: data.asks || []
            };
        } catch (error) {
            this.logger.error('Erro ao obter orderbook', { error: error.message });
            throw error;
        }
    }

    /**
     * Obter ticker
     */
    async getTicker() {
        if (this.simulate) {
            return this._simulateTicker();
        }

        try {
            const data = await this._request('GET', `/ticker/?pair=${this.pair}`);
            return {
                high: parseFloat(data.high),
                low: parseFloat(data.low),
                last: parseFloat(data.last),
                bid: parseFloat(data.buy),
                ask: parseFloat(data.sell),
                volume: parseFloat(data.vol)
            };
        } catch (error) {
            this.logger.error('Erro ao obter ticker', { error: error.message });
            throw error;
        }
    }

    /**
     * Obter trades recentes
     */
    async getTrades(limit = 100) {
        if (this.simulate) {
            return this._simulateTrades(limit);
        }

        try {
            const data = await this._request('GET', `/trades/?pair=${this.pair}&limit=${limit}`);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            this.logger.error('Erro ao obter trades', { error: error.message });
            throw error;
        }
    }

    /**
     * Colocar ordem (requer autenticação)
     */
    async placeOrder(side, quantity, price, orderType = 'limit') {
        if (this.simulate) {
            return this._simulateOrderPlacement(side, quantity, price);
        }

        try {
            const data = await this._request('POST', '/create_order/', {
                pair: this.pair,
                type: orderType,
                side: side.toLowerCase(),
                rate: price,
                quantity: quantity
            });

            return {
                id: data.id || data.order_id,
                side,
                price,
                quantity,
                timestamp: Date.now(),
                status: 'pending'
            };
        } catch (error) {
            this.logger.error('Erro ao colocar ordem', { 
                side, 
                quantity, 
                price,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Cancelar ordem
     */
    async cancelOrder(orderId) {
        if (this.simulate) {
            return this._simulateOrderCancellation(orderId);
        }

        try {
            await this._request('POST', '/cancel_order/', {
                pair: this.pair,
                order_id: orderId
            });

            return { id: orderId, status: 'cancelled' };
        } catch (error) {
            this.logger.error('Erro ao cancelar ordem', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Obter saldo da conta
     */
    async getBalance() {
        if (this.simulate) {
            return this._simulateBalance();
        }

        try {
            const data = await this._request('GET', '/account/balance/');
            
            return {
                btc: parseFloat(data.btc?.available || 0),
                brl: parseFloat(data.brl?.available || 0),
                reserved_btc: parseFloat(data.btc?.reserved || 0),
                reserved_brl: parseFloat(data.brl?.reserved || 0)
            };
        } catch (error) {
            this.logger.error('Erro ao obter balanço', { error: error.message });
            throw error;
        }
    }

    /**
     * Obter histórico de ordens
     */
    async getOrderHistory(limit = 100) {
        if (this.simulate) {
            return [];
        }

        try {
            const data = await this._request('GET', `/list_orders/?pair=${this.pair}&limit=${limit}`);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            this.logger.error('Erro ao obter histórico de ordens', { error: error.message });
            throw error;
        }
    }

    /**
     * Métodos de simulação
     */

    _simulateOrderbook() {
        const mid = 100000 + Math.random() * 1000;
        const spread = 50;
        return {
            bids: [
                [mid - spread, 0.1],
                [mid - spread * 2, 0.2],
                [mid - spread * 3, 0.3]
            ],
            asks: [
                [mid + spread, 0.1],
                [mid + spread * 2, 0.2],
                [mid + spread * 3, 0.3]
            ]
        };
    }

    _simulateTicker() {
        const last = 100000 + Math.random() * 1000;
        return {
            high: last * 1.05,
            low: last * 0.95,
            last,
            bid: last - 50,
            ask: last + 50,
            volume: 100
        };
    }

    _simulateTrades(limit = 100) {
        const trades = [];
        for (let i = 0; i < limit; i++) {
            trades.push({
                tid: i,
                price: 100000 + Math.random() * 1000,
                amount: Math.random() * 0.01,
                date: Date.now() / 1000
            });
        }
        return trades;
    }

    _simulateOrderPlacement(side, quantity, price) {
        return {
            id: `SIM-${Date.now()}`,
            side,
            price,
            quantity,
            timestamp: Date.now(),
            status: 'pending'
        };
    }

    _simulateOrderCancellation(orderId) {
        return {
            id: orderId,
            status: 'cancelled'
        };
    }

    _simulateBalance() {
        return {
            btc: 0.005,
            brl: 100,
            reserved_btc: 0.001,
            reserved_brl: 50
        };
    }
}

module.exports = MercadoBitcoinClient;
