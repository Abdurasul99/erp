/* Сценарный харнесс («симулятор тестов всех окон»).
   Прогоняет: чтение ВСЕХ эндпоинтов инструментов → проверки наличия данных →
   роли → сквозные флоу (задача, алерт→задача, жалоба). Печатает PASS/FAIL.
   Тест-данные помечаются '[TEST]' и удаляются в конце. Запуск: node harness.js */
require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg'); const jwt = require('jsonwebtoken'); const http = require('http');
const pool = new Pool({ database: process.env.DB_NAME || 'warehouse', user: process.env.DB_USER || 'wareapp_user', password: process.env.DB_PASS, host: 'localhost', port: 5432 });
const JWT = process.env.JWT_SECRET;
let PASS = 0, FAIL = 0; const fails = [];
const ok = (name, cond, info) => { if (cond) PASS++; else { FAIL++; fails.push(name + (info ? ' — ' + info : '')); } };
const req = (method, path, token, body) => new Promise(resolve => {
  const data = body ? JSON.stringify(body) : null;
  const r = http.request({ host: 'localhost', port: 3001, path: '/api' + path, method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
    rs => { let d = ''; rs.on('data', c => d += c).on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) {} resolve({ status: rs.statusCode, body: j, raw: d }); }); });
  r.on('error', () => resolve({ status: 0 })); if (data) r.write(data); r.end();
});

const READ_EPS = [
  '/company/dashboard', '/company/sales-chart?gran=day', '/company/branch-daily?metric=income', '/bhi/monthly', '/bhi/day', '/bhi/alerts',
  '/analytics/founder-dashboard', '/analytics/alerts', '/analytics/anomalies?period=week', '/analytics/branches/compare', '/analytics/trends',
  '/analytics/funnel?period=month', '/analytics/report?period=month', '/analytics/basket/pairs', '/analytics/cohorts', '/analytics/unit-economics?period=month',
  '/bsc/dashboard', '/bsc/table', '/bsc/forecast', '/customers/segments', '/crm/complaints', '/crm/birthdays', '/crm/events', '/crm/referrals/top?period=90',
  '/crm/forecast', '/tasks', '/tasks/analytics?period=month', '/task-templates', '/checklists/today', '/checklists/history',
  '/audit-log/journal?period=month', '/audit-log/suspicious', '/products', '/types', '/users', '/suppliers/debts', '/debts', '/risks',
  '/finance/model', '/finance/cashflow', '/finance/break-even', '/marketing/channels', '/marketing/content', '/marketing/ltv', '/marketing/personas',
  '/pricing/analyze', '/inventory/abc-xyz', '/hr/overview', '/settings/overview', '/integrations', '/sales/history',
];

(async () => {
  const fu = (await pool.query("SELECT * FROM users WHERE role IN ('founder','gen_dir') ORDER BY id LIMIT 1")).rows[0];
  if (!fu) { console.log('нет founder/gen_dir — нечего тестить'); process.exit(0); }
  const CID = fu.company_id; // авто-определение тест-компании (бывшая company 1 удалена)
  const mu = (await pool.query("SELECT * FROM users WHERE role='manager' AND company_id=$1 ORDER BY id LIMIT 1", [CID])).rows[0];
  const tok = u => jwt.sign({ id: u.id, username: u.username, role: u.role, company_id: u.company_id, branch_id: u.branch_id }, JWT);
  const FT = tok(fu), MT = mu ? tok(mu) : null;
  const from = new Date(Date.now() - 30 * 864e5); from.setHours(0, 0, 0, 0); const FROM = encodeURIComponent(from.toISOString());

  // 1. ЧТЕНИЕ всех окон
  for (const ep of READ_EPS) { const r = await req('GET', ep, FT); ok('READ ' + ep, r.status === 200, 'HTTP ' + r.status); }

  // 1b. ЧТЕНИЕ новых инструментов (волны 1-5: Склад/Финансы/Закупки/Продажи/Персонал)
  const _pid = (await pool.query('SELECT id FROM products WHERE company_id=$1 AND deleted_at IS NULL ORDER BY id LIMIT 1', [CID])).rows[0]?.id || 1;
  const _eid = fu.id;
  const NEW_EPS = [
    // Склад (14)
    '/warehouse/outcome-summary', '/warehouse/transfers', '/warehouse/movements?product_id=' + _pid, '/warehouse/turnover',
    '/warehouse/eoq', '/warehouse/reorder-point', '/warehouse/safety-stock', '/warehouse/purchase-roi',
    '/warehouse/min-stock-alerts', '/warehouse/barcodes-coverage', '/warehouse/demand-forecast', '/warehouse/whatif-base',
    '/warehouse/audits', '/warehouse/writeoff-summary',
    // Финансы (8)
    '/finance/expenses/summary', '/finance/expenses', '/finance/profitability', '/finance/payment-calendar',
    '/finance/currency', '/finance/taxes', '/finance/ratios', '/finance/whatif-base',
    // Закупки (8)
    '/procurement/history', '/procurement/returns', '/procurement/ratings', '/procurement/forecast',
    '/procurement/whatif-base', '/procurement/orders', '/procurement/receivings', '/procurement/compare?product_id=' + _pid,
    // Продажи/Операции/Маркетинг/Support (13)
    '/discounts', '/sales/top-products', '/operations/seller-avg-check', '/operations/returns-report',
    '/marketing/campaigns', '/sales/forecast', '/sales/whatif-base', '/nps/reviews', '/sales/scripts',
    '/marketing/leads', '/marketing/loyalty/overview', '/marketing/loyalty/tiers', '/marketing/loyalty/top',
    // Персонал (10)
    '/hr/schedules', '/hr/attendance', '/hr/absences/current', '/hr/absences/balance?employee_id=' + _eid,
    '/hr/salaries', '/hr/productivity', '/hr/adjustments', '/hr/forecast', '/hr/whatif-base', '/hr/training',
  ];
  for (const ep of NEW_EPS) { const r = await req('GET', ep, FT); ok('NEW ' + ep, r.status === 200, 'HTTP ' + r.status + (r.status === 500 ? ' :: ' + (r.body && r.body.error || r.raw || '').slice(0, 120) : '')); }

  // 1c. Те же эндпоинты под МЕНЕДЖЕРОМ (branch-scoped) — ловим баги branch-фильтра (500/0).
  //     403 (founder-only финансы/HR) и 400 — это норма, НЕ ошибка. Падение = только 500/0.
  if (MT) {
    for (const ep of NEW_EPS) {
      const r = await req('GET', ep, MT);
      ok('MGR ' + ep, r.status !== 500 && r.status !== 0, 'HTTP ' + r.status + (r.status === 500 ? ' :: ' + (r.body && r.body.error || '').slice(0, 120) : ''));
    }
  }

  // 2. НАЛИЧИЕ ДАННЫХ (поток продажи→дашборд работает)
  const dash = (await req('GET', '/company/dashboard?from=' + FROM, FT)).body || {};
  ok('dashboard: выручка > 0', (dash.totals || {}).sales_revenue > 0);
  ok('dashboard: топ товаров не пуст', (dash.top_products || []).length > 0);
  ok('dashboard: топ сотрудников не пуст', (dash.top_sellers || []).length > 0);
  const seg = (await req('GET', '/customers/segments', FT)).body || {};
  const segTotal = seg.total || (seg.segments || []).reduce((s, x) => s + (x.count || 0), 0);
  ok('сегментация: клиенты есть', segTotal > 0, 'total=' + segTotal);
  const coh = (await req('GET', '/analytics/cohorts', FT)).body || {};
  ok('когорты: есть когорты', JSON.stringify(coh).length > 50);

  // 3. РОЛИ
  if (MT) {
    ok('менеджер ⛔ founder-dashboard', (await req('GET', '/analytics/founder-dashboard', MT)).status === 403);
    ok('менеджер ⛔ сравнение филиалов', (await req('GET', '/analytics/branches/compare', MT)).status === 403);
    ok('менеджер ✓ дашборд (скоуп)', (await req('GET', '/company/dashboard', MT)).status === 200);
  }

  // 4. ФЛОУ: задача create → в списке → done
  const tc = await req('POST', '/tasks', FT, { title: '[TEST] harness', description: '[TEST]', priority: 'low' });
  ok('флоу: создать задачу', tc.status === 200 || tc.status === 201, 'HTTP ' + tc.status);
  const taskId = tc.body && (tc.body.task ? tc.body.task.id : tc.body.id);
  ok('флоу: задача в списке', JSON.stringify((await req('GET', '/tasks', FT)).body || '').includes('harness'));
  if (taskId) ok('флоу: задача → done', [200, 201].includes((await req('PATCH', '/tasks/' + taskId + '/status', FT, { status: 'done' })).status));

  // 5. ФЛОУ: алерт → задача (связь центра алертов и операций)
  const alerts = ((await req('GET', '/analytics/alerts', FT)).body || {}).items || [];
  if (alerts.length) { const fa = await req('POST', '/tasks/from-alert', FT, { alert_id: alerts[0].id }); ok('флоу: алерт→задача', [200, 201, 409].includes(fa.status), 'HTTP ' + fa.status); }
  else ok('флоу: алерт→задача (нет алертов — пропуск)', true);

  // 6. ФЛОУ: реферал — генерация промокода
  const anyCust = (await pool.query('SELECT id FROM customers WHERE company_id=$1 AND deleted_at IS NULL ORDER BY id LIMIT 1', [CID])).rows[0];
  if (anyCust) { const rc = await req('POST', '/crm/referrals/code', FT, { customer_id: anyCust.id }); ok('флоу: промокод реферала', rc.status === 200 && rc.body && rc.body.ok, 'HTTP ' + rc.status); }

  // cleanup тестовых задач
  try { await pool.query("DELETE FROM tasks WHERE title LIKE '%[TEST]%' OR description LIKE '%[TEST]%'"); } catch (e) {}

  console.log(`\n=== HARNESS: ${PASS} passed, ${FAIL} failed (из ${PASS + FAIL}) ===`);
  if (fails.length) console.log('FAILED:\n - ' + fails.join('\n - '));
  await pool.end();
})().catch(e => { console.error('HARNESS ERR', e.message); process.exit(1); });
