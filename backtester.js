/**
 * backtester.js - simple CSV candle backtester
 */
const fs = require('fs');
const { parse } = require('csv-parse/sync');

if (process.argv.length < 3) {
  console.error('usage: node backtester.js path/to/candles.csv');
  process.exit(1);
}

const csvPath = process.argv[2];
const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parse(raw, { columns: true, skip_empty_lines: true });

const SPREAD_PCT = parseFloat(process.env.SPREAD_PCT || '0.002');
const ORDER_SIZE = parseFloat(process.env.ORDER_SIZE || '0.001');

let balance = { base: 0.1, quote: 10000.0 };
let orders = [];
let trades = [];

function placeSim(side, price, qty) {
  const id = 'bt-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
  const o = { id, side, price, qty, status: 'open' };
  orders.push(o);
  return o;
}

function processCandle(c) {
  const high = parseFloat(c.high), low = parseFloat(c.low);
  orders = orders.filter(o => {
    if (o.side === 'buy' && low <= o.price) {
      const fillPrice = o.price;
      balance.base += o.qty;
      balance.quote -= o.qty * fillPrice;
      trades.push({ id: o.id, side: 'buy', price: fillPrice, qty: o.qty });
      return false;
    }
    if (o.side === 'sell' && high >= o.price) {
      const fillPrice = o.price;
      balance.base -= o.qty;
      balance.quote += o.qty * fillPrice;
      trades.push({ id: o.id, side: 'sell', price: fillPrice, qty: o.qty });
      return false;
    }
    return true;
  });
}

for (const r of rows) {
  const open = parseFloat(r.open), high = parseFloat(r.high), low = parseFloat(r.low), close = parseFloat(r.close);
  const mid = (high + low)/2;
  const buyP = +(mid * (1 - SPREAD_PCT/2)).toFixed(2);
  const sellP = +(mid * (1 + SPREAD_PCT/2)).toFixed(2);
  placeSim('buy', buyP, ORDER_SIZE);
  placeSim('sell', sellP, ORDER_SIZE);
  processCandle({open,high,low,close});
}

console.log('ending balance', balance);
console.log('trades executed', trades.length);
console.log('last trades', trades.slice(-10));
