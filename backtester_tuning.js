#!/usr/bin/env node
/**
 * backtester_v12_tuning.js
 * Grid search automático para otimizar lucro.
 */

const fs = require('fs');
const path = require('path');
const {parse} = require('csv-parse/sync');
const {simulatePair} = require('./backtester'); // importar simulatePair do backtester otimizado

const ARGV = process.argv.slice(2);
if (ARGV.length < 1) { console.error('Uso: node backtester_tuning.js path/to/csv'); process.exit(1); }
const INPUT = ARGV[0];

// parâmetros a testar
const grid = {
    MIN_PROFIT_BASE: [0.0005, 0.0007, 0.001], // mais agressivo, menor lucro mínimo
    SPREAD_BASE: [0.0004, 0.0005, 0.0006],    // spread menor para execução mais fácil
    ORDER_QUOTE_FRACTION: [0.05, 0.1, 0.2]   // aumenta chance de criar ordens
};

function readCSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = parse(raw, {columns: true, skip_empty_lines: true, trim: true});
    return rows.map(r => ({
        timestamp: r.t || r.timestamp || r.time || '',
        o: parseFloat(r.o || r.open || '0'),
        h: parseFloat(r.h || r.high || '0'),
        l: parseFloat(r.l || r.low || '0'),
        c: parseFloat(r.c || r.close || '0'),
        v: parseFloat(r.v || r.volume || '0')
    }));
}

// gera todas combinações possíveis
function generateGrid(grid) {
    const keys = Object.keys(grid);
    const combos = [];
    function helper(idx, current) {
        if (idx === keys.length) { combos.push({...current}); return; }
        for (const val of grid[keys[idx]]) {
            current[keys[idx]] = val;
            helper(idx + 1, current);
        }
    }
    helper(0, {});
    return combos;
}

async function runTuning(filePath){
    const rows = readCSV(filePath);
    const combos = generateGrid(grid);
    const results = [];

    console.log(`Testando ${combos.length} combinações...`);
    for (let i = 0; i < combos.length; i++){
        const params = combos[i];
        // atualiza CONFIG temporariamente
        const CONFIG_ORIG = {...require('./backtester').CONFIG};
        Object.assign(require('./backtester').CONFIG, params);

        const res = simulatePair(path.basename(filePath,'.csv'), rows);
        results.push({params, roi: res.roi, totalPnL: res.totalPnL, maxDrawdown: res.maxDrawdown});

        console.log(`[${i+1}/${combos.length}] ROI=${res.roi}% | PnL=${res.totalPnL} | Drawdown=${res.maxDrawdown}% | Params:`, params);

        // restaura CONFIG
        Object.assign(require('./backtester').CONFIG, CONFIG_ORIG);
    }

    const best = results.reduce((a,b)=>b.roi>a.roi?b:a, results[0]);
    console.log('\n===== MELHOR CONFIGURAÇÃO =====');
    console.log(best);

    fs.writeFileSync(`grid_tuning_${Date.now()}.json`, JSON.stringify(results,null,2));
    console.log('Resultados salvos em JSON.');
}

// execute
runTuning(INPUT).catch(console.error);
