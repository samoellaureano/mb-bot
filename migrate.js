/**
 * migrate.js - create sqlite tables
 */
const db = require('./db');

async function run() {
  await db.init();
  console.log('migration done');
  process.exit(0);
}
run();
