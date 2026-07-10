// Удаление ВСЕХ [SIM]-данных. Находит [SIM]-компании по имени и каскадно чистит
// дочерние строки (продажи/приходы/касса/остатки/товары/клиенты/юзеры/филиалы),
// затем сами компании. Каждый DELETE в try/catch — устойчиво к различиям схемы.
const cfg = require('./config');
const { pool } = require('./db');

async function runCleanup() {
  const log = [];
  const co = await pool.query("SELECT id FROM companies WHERE name LIKE $1", [cfg.simTag + '%']);
  const sim = co.rows.map((r) => r.id);
  if (!sim.length) return { companies: 0, log: ['нет [SIM]-компаний'] };

  const prod = await pool.query('SELECT id FROM products WHERE company_id = ANY($1::int[])', [sim]);
  const branch = await pool.query('SELECT id FROM branches WHERE company_id = ANY($1::int[])', [sim]);
  const pids = prod.rows.map((r) => r.id);
  const bids = branch.rows.map((r) => r.id);

  const del = async (label, sql, params) => {
    try { const r = await pool.query(sql, params); log.push(`${label}: ${r.rowCount}`); }
    catch (e) { log.push(`${label}: skip (${e.message.slice(0, 60)})`); }
  };

  // дочерние по branch_id (все sim-движения в sim-филиалах; branch_id индексирован → быстро)
  if (bids.length) {
    await del('stock_outcome', 'DELETE FROM stock_outcome WHERE branch_id = ANY($1::int[])', [bids]);
    await del('stock_income', 'DELETE FROM stock_income WHERE branch_id = ANY($1::int[])', [bids]);
    await del('product_stock', 'DELETE FROM product_stock WHERE branch_id = ANY($1::int[])', [bids]);
    await del('cash_income', 'DELETE FROM cash_income WHERE branch_id = ANY($1::int[])', [bids]);
    await del('cash_expense', 'DELETE FROM cash_expense WHERE branch_id = ANY($1::int[])', [bids]);
    await del('cash_flows', 'DELETE FROM cash_flows WHERE branch_id = ANY($1::int[])', [bids]);
  }

  // по company_id (защитный список — лишние таблицы просто пропустятся)
  for (const t of ['customer_rfm', 'customer_rfm_history', 'notification_campaigns', 'leads', 'loyalty_accounts', 'discounts', 'bhi_daily', 'inventory_audits', 'tax_settings', 'tax_payments', 'balance_entries', 'customers', 'products', 'users', 'branches']) {
    await del(t, `DELETE FROM ${t} WHERE company_id = ANY($1::int[])`, [sim]);
  }
  await del('companies', 'DELETE FROM companies WHERE id = ANY($1::int[])', [sim]);

  return { companies: sim.length, log };
}

module.exports = { runCleanup };

// Прямой запуск: node cleanup.js
if (require.main === module) {
  runCleanup().then((r) => { console.log('CLEANUP:', JSON.stringify(r, null, 2)); return pool.end(); })
    .catch((e) => { console.error('cleanup err', e.message); process.exit(1); });
}
