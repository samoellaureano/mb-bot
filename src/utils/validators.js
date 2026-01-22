/**
 * src/utils/validators.js - Funções de validação centralizadas
 */

const { ValidationError } = require('./error-handler');

class Validators {
    // Validar número positivo
    static positiveNumber(value, fieldName = 'value') {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(`${fieldName} deve ser um número`, fieldName);
        }
        if (value <= 0) {
            throw new ValidationError(`${fieldName} deve ser positivo`, fieldName);
        }
        return value;
    }

    // Validar número não-negativo
    static nonNegativeNumber(value, fieldName = 'value') {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(`${fieldName} deve ser um número`, fieldName);
        }
        if (value < 0) {
            throw new ValidationError(`${fieldName} não pode ser negativo`, fieldName);
        }
        return value;
    }

    // Validar percentual
    static percentage(value, fieldName = 'percentage') {
        this.nonNegativeNumber(value, fieldName);
        if (value > 100) {
            throw new ValidationError(`${fieldName} não pode ser maior que 100`, fieldName);
        }
        return value;
    }

    // Validar quantidade BTC
    static btcAmount(value, min = 0.00001, max = 10000) {
        this.positiveNumber(value, 'BTC amount');
        if (value < min) {
            throw new ValidationError(
                `Quantidade BTC mínima é ${min}`,
                'btcAmount'
            );
        }
        if (value > max) {
            throw new ValidationError(
                `Quantidade BTC máxima é ${max}`,
                'btcAmount'
            );
        }
        return value;
    }

    // Validar preço
    static price(value, min = 0.01) {
        this.positiveNumber(value, 'price');
        if (value < min) {
            throw new ValidationError(`Preço mínimo é ${min}`, 'price');
        }
        return value;
    }

    // Validar lado da ordem (BUY/SELL)
    static orderSide(value) {
        if (!['BUY', 'SELL'].includes(value)) {
            throw new ValidationError('Lado da ordem deve ser BUY ou SELL', 'side');
        }
        return value;
    }

    // Validar tipo de ordem
    static orderType(value) {
        if (!['market', 'limit'].includes(value.toLowerCase())) {
            throw new ValidationError(
                'Tipo de ordem deve ser market ou limit',
                'type'
            );
        }
        return value.toUpperCase();
    }

    // Validar timestamp
    static timestamp(value) {
        const timestamp = parseInt(value);
        if (isNaN(timestamp) || timestamp <= 0) {
            throw new ValidationError('Timestamp inválido', 'timestamp');
        }
        return timestamp;
    }

    // Validar range de números
    static numberInRange(value, min, max, fieldName = 'value') {
        this.positiveNumber(value, fieldName);
        if (value < min || value > max) {
            throw new ValidationError(
                `${fieldName} deve estar entre ${min} e ${max}`,
                fieldName
            );
        }
        return value;
    }

    // Validar string não vazia
    static nonEmptyString(value, fieldName = 'value') {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new ValidationError(
                `${fieldName} não pode estar vazio`,
                fieldName
            );
        }
        return value.trim();
    }

    // Validar objeto
    static object(value, fieldName = 'object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new ValidationError(`${fieldName} deve ser um objeto`, fieldName);
        }
        return value;
    }

    // Validar array
    static array(value, fieldName = 'array') {
        if (!Array.isArray(value)) {
            throw new ValidationError(`${fieldName} deve ser um array`, fieldName);
        }
        return value;
    }

    // Validar ordem
    static order(order) {
        const required = ['id', 'side', 'price', 'quantity', 'timestamp'];
        for (const field of required) {
            if (!(field in order)) {
                throw new ValidationError(`Ordem faltando campo: ${field}`, 'order');
            }
        }

        this.nonEmptyString(order.id, 'order.id');
        this.orderSide(order.side);
        this.price(order.price);
        this.btcAmount(order.quantity);
        this.timestamp(order.timestamp);

        return order;
    }

    // Validar balanço
    static balance(balance) {
        if (typeof balance !== 'object' || balance === null) {
            throw new ValidationError('Balanço deve ser um objeto', 'balance');
        }

        if (!('btc' in balance) || !('brl' in balance)) {
            throw new ValidationError(
                'Balanço deve ter campos btc e brl',
                'balance'
            );
        }

        this.nonNegativeNumber(balance.btc, 'balance.btc');
        this.nonNegativeNumber(balance.brl, 'balance.brl');

        return balance;
    }

    // Validar orderbook
    static orderbook(orderbook) {
        if (typeof orderbook !== 'object' || orderbook === null) {
            throw new ValidationError('Orderbook deve ser um objeto', 'orderbook');
        }

        if (!('bids' in orderbook) || !('asks' in orderbook)) {
            throw new ValidationError(
                'Orderbook deve ter campos bids e asks',
                'orderbook'
            );
        }

        this.array(orderbook.bids, 'orderbook.bids');
        this.array(orderbook.asks, 'orderbook.asks');

        if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
            throw new ValidationError('Orderbook vazio ou incompleto', 'orderbook');
        }

        // Validar estrutura dos dados
        for (const [price, quantity] of orderbook.bids) {
            this.price(price);
            this.positiveNumber(quantity, 'bid quantity');
        }

        for (const [price, quantity] of orderbook.asks) {
            this.price(price);
            this.positiveNumber(quantity, 'ask quantity');
        }

        return orderbook;
    }
}

module.exports = Validators;
