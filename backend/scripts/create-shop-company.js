/* Компания интернет-магазина в Wave одной транзакцией (2026-11-13): компания, филиал, учредитель и кассир
   (кассир получает «Заказы с сайта» и перезванивает покупателям). То же, что POST /api/companies админки
   + POST /api/branches, но из консоли сервера — когда в админке заводить некому.

   node scripts/create-shop-company.js --name "Wave Market" --founder wavemarket --cashier wavemarket_kassa \
        [--address "…"] [--phone "+998 …"] [--apply]

   Без --apply — только проверка (транзакция откатывается). С --apply — запись; пароли печатаются ОДИН раз.
   Компания с таким названием или занятый логин — ошибка, ничего не создаётся. */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

// Как DEFAULT_DISABLED_TOOLS в server.js: продвинутые инструменты скрыты, учредитель включит нужное в «Управление панелью»
const DEFAULT_DISABLED_TOOLS = [
  'ab-point', 'anomaly', 'business-funnel', 'basket-analysis', 'cohorts', 'unit-economics', 'ssp',
  'cash-gap', 'pricing', 'cashflow', 'modeling', 'fin-model', 'break-even', 'profitability', 'payment-calendar', 'currency-ops', 'taxes', 'financial-ratios', 'fin-whatif',
  'competitor-mirror', 'loss-funnel', 'ca-analysis', 'content-plan', 'channels', 'ltv', 'strategy-3y', 'customer-campaigns', 'competitors',
  'procurement-orders', 'purchase-history', 'supplier-returns', 'supplier-ratings', 'purchase-forecast', 'what-if-purchases', 'supplier-compare',
  'stock-transfers', 'turnover-deadstock', 'eoq', 'reorder-point', 'safety-stock', 'purchase-roi', 'demand-forecast', 'inventory-whatif', 'bundles', 'logistics',
  'store-police', 'global-whatif', 'b2b', 'commercial-offer', 'scripts', 'discounts', 'sales-top-products', 'seller-avg-check', 'sales-forecast', 'sales-whatif', 'risk-control', 'planning', 'automation', 'task-templates', 'task-analytics',
  'fire-analysis', 'workday-map', 'employee-health', 'hire-fire-calc', 'team-kpi', 'training', 'absences', 'hr-productivity', 'hr-adjustments', 'hr-forecast', 'hr-whatif',
  'abc-clients', 'churn', 'segmentation', 'birthdays', 'referrals', 'client-forecast', 'what-if-clients', 'nps', 'cjm-client', 'contact-points',
];

// Пароль: 12 символов, буквы и цифры (правило validatePassword — минимум 8, буква и цифра), без похожих 0/O/1/l
function password() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const p = Array.from(crypto.randomBytes(12), b => abc[b % abc.length]).join('');
    if (/[a-zA-Z]/.test(p) && /\d/.test(p)) return p;
  }
}

async function createShopCompany(pool, { name, founder, cashier, address = '', phone = '', apply = false }, log = console.log) {
  const title = String(name || '').trim();
  if (!title || title.length > 200) throw new Error('--name: название от 1 до 200 символов');
  for (const [k, v] of [['--founder', founder], ['--cashier', cashier]]) {
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(String(v || ''))) throw new Error(`${k}: логин 3–50 символов, латиница, цифры, _ . -`);
  }
  if (founder === cashier) throw new Error('Логины учредителя и кассира должны различаться');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [same] } = await c.query('SELECT id FROM companies WHERE lower(name)=lower($1)', [title]);
    if (same) throw new Error(`Компания «${title}» уже есть (id ${same.id})`);
    const { rows: taken } = await c.query('SELECT username FROM users WHERE lower(username) = ANY($1::text[])', [[founder.toLowerCase(), cashier.toLowerCase()]]);
    if (taken.length) throw new Error(`Логин уже занят: ${taken.map(r => r.username).join(', ')}`);
    const { rows: [admin] } = await c.query(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);
    const { rows: [co] } = await c.query('INSERT INTO companies (name, address, phone, created_by, disabled_tools) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [title, address, phone, admin?.id || null, DEFAULT_DISABLED_TOOLS]);
    const { rows: [br] } = await c.query('INSERT INTO branches (company_id, name, address, phone, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [co.id, 'Основной', address, phone, admin?.id || null]);
    const pf = password(); const pc = password();
    await c.query(`INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, created_by) VALUES ($1,$2,'founder',$3,NULL,$4,$5)`,
      [founder, await bcrypt.hash(pf, 10), co.id, title, admin?.id || null]);
    await c.query(`INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, created_by) VALUES ($1,$2,'cashier',$3,$4,$5,$6)`,
      [cashier, await bcrypt.hash(pc, 10), co.id, br.id, 'Кассир', admin?.id || null]);
    log(`Компания: ${co.id} «${title}», филиал ${br.id} «Основной»; учредитель ${founder}, кассир ${cashier}`);
    await c.query(apply ? 'COMMIT' : 'ROLLBACK');
    if (!apply) { log('Это проверка: ничего не записано. Для записи добавьте --apply'); return { company_id: null }; }
    log('ГОТОВО. Пароли — показываются один раз, сохраните:');
    log(`  учредитель  ${founder}  ${pf}`);
    log(`  кассир      ${cashier}  ${pc}`);
    return { company_id: co.id, branch_id: br.id, founder_password: pf, cashier_password: pc };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}

module.exports = { createShopCompany };

if (require.main === module) {
  const pool = new Pool({ database: process.env.DB_NAME || 'warehouse', user: process.env.DB_USER || 'wareapp_user', password: process.env.DB_PASS,
    host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT, 10) || 5432, max: 1 });
  createShopCompany(pool, { name: arg('--name'), founder: arg('--founder'), cashier: arg('--cashier'), address: arg('--address') || '', phone: arg('--phone') || '',
    apply: process.argv.includes('--apply') })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
