/**
 * src/utils/formatters.js - Funções de formatação
 */

class Formatters {
    /**
     * Formatar BTC com decimal fixo
     */
    static btc(value, decimals = 8) {
        return (value || 0).toFixed(decimals);
    }

    /**
     * Formatar BRL com símbolo
     */
    static brl(value, decimals = 2) {
        return `R$ ${(value || 0).toFixed(decimals).replace('.', ',')}`;
    }

    /**
     * Formatar percentual com símbolo
     */
    static percentage(value, decimals = 2, symbol = true) {
        const formatted = (value || 0).toFixed(decimals);
        return symbol ? `${formatted}%` : formatted;
    }

    /**
     * Formatar números grandes com separador de milhar
     */
    static number(value, decimals = 2) {
        return (value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Formatar data/hora
     */
    static datetime(date, format = 'pt-BR') {
        const d = new Date(date);
        if (format === 'pt-BR') {
            return d.toLocaleString('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        return d.toISOString();
    }

    /**
     * Formatar data apenas
     */
    static date(date) {
        const d = new Date(date);
        return d.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Formatar hora apenas
     */
    static time(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Formatar duração (ms para hh:mm:ss)
     */
    static duration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        const h = hours % 24;
        const m = minutes % 60;
        const s = seconds % 60;

        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    /**
     * Formatar duração em forma legível
     */
    static durationReadable(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Formatar tamanho de arquivo
     */
    static fileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = Math.abs(bytes);
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Formatar ordem para display
     */
    static order(order) {
        return {
            id: order.id,
            side: order.side,
            price: this.brl(order.price),
            quantity: this.btc(order.quantity),
            total: this.brl(order.price * order.quantity),
            timestamp: this.datetime(order.timestamp),
            status: order.status || 'unknown'
        };
    }

    /**
     * Formatar balanço para display
     */
    static balance(balance) {
        return {
            btc: this.btc(balance.btc),
            brl: this.brl(balance.brl),
            total_brl: this.brl(balance.brl + (balance.btc * balance.btcPrice || 0))
        };
    }

    /**
     * Formatar PnL para display
     */
    static pnl(pnl, absolute = true) {
        const value = absolute ? pnl : pnl * 100;
        const formatted = value >= 0 ? '+' : '';
        const suffix = absolute ? '' : '%';
        return `${formatted}${this.brl(value)}${suffix}`;
    }

    /**
     * Formatar array como tabela
     */
    static table(data, columns = null) {
        if (!Array.isArray(data) || data.length === 0) {
            return 'Sem dados';
        }

        const cols = columns || Object.keys(data[0]);
        const table = [];

        // Header
        table.push('| ' + cols.join(' | ') + ' |');
        table.push('|' + cols.map(() => '---').join('|') + '|');

        // Rows
        data.forEach(row => {
            const values = cols.map(col => {
                const value = row[col];
                if (typeof value === 'number') {
                    return value.toFixed(2);
                }
                return String(value || '');
            });
            table.push('| ' + values.join(' | ') + ' |');
        });

        return table.join('\n');
    }

    /**
     * Formatar JSON com indentação
     */
    static json(obj, indent = 2) {
        return JSON.stringify(obj, null, indent);
    }

    /**
     * Remover acentos
     */
    static removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Capitalizar primeira letra
     */
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Slug para URL
     */
    static slug(str) {
        return this.removeAccents(str)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}

module.exports = Formatters;
