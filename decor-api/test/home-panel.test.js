'use strict';

// Правки владельца 09.11.2026:
//  • Главная — период карточки заказов выбирается (?from&to), по умолчанию 7 дней с сегодня; лиды не считаются;
//    «по» раньше «с», период больше года, неверная дата — 400;
//  • «Управление панелью» меняет только учредитель — ген. директору и сотрудникам 403.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');
const { createStaff } = require('../scripts/create-staff');
const { todayYmd } = require('../decor/common');
const { addDays } = require('../decor/formulas');

let stack;
const U = {};
async function call(method, url, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (method !== 'GET') Object.assign(headers, { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() });
  const res = await fetch(stack.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function login(username, password) {
  const res = await fetch(`${stack.base}/api/decor/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}
const T = todayYmd();

test.before(async () => {
  stack = await startStack();
  const f = await createCompany(stack.pool, { company: 'Dora Decor', username: 'hp_founder' });
  U.founder = { ...f, token: await login('hp_founder', f.password) };
  const pm = await createStaff(stack.pool, { founder: 'hp_founder', level: 'pm', username: 'hp_pm', name: 'ПМ' });
  U.pm = { token: await login('hp_pm', pm.password) };
  // ген. директор той же компании
  await stack.pool.query(`INSERT INTO users (username, password_hash, role, company_id, first_name) VALUES ('hp_gd', $1, 'gen_dir', $2, 'ГД')`,
    [await bcrypt.hash('gdpass123', 4), f.companyId]);
  U.gd = { token: await login('hp_gd', 'gdpass123') };
  const order = async (days, status = 'design') => {
    const r = await call('POST', '/api/decor/orders', U.founder.token, { client: `Клиент ${days}`, event_date: addDays(T, days), status });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.id;
  };
  await order(0); await order(3); await order(10); await order(20); await order(2, 'lead');
  const old = await order(-5);
  await stack.pool.query(`UPDATE decor_orders SET status='closed', closed_at=NOW(),
    closed_cost='{"price":0,"full":0,"profit":0,"shortage":0,"wear":0,"below_cost":false}' WHERE id=$1`, [old]);
});
test.after(async () => { await stack?.stop(); });

test('Главная: по умолчанию 7 дней с сегодня, лиды не считаются', async () => {
  const r = await call('GET', '/api/decor/home', U.founder.token);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.period, { from: T, to: addDays(T, 6) });
  assert.equal(r.data.kpi.period_orders, 2);       // сегодня и через 3 дня; лид через 2 дня — нет
  assert.equal(r.data.kpi.period_active, 2);
  assert.equal(r.data.kpi.period_closed, 0);
  assert.equal(r.data.kpi.week_orders, undefined);
});

test('Главная: свой период — 30 дней, прошлое с закрытым заказом, один день', async () => {
  const k = async q => (await call('GET', `/api/decor/home?${q}`, U.founder.token)).data;
  const month = await k(`from=${T}&to=${addDays(T, 29)}`);
  assert.equal(month.kpi.period_orders, 4);
  const past = await k(`from=${addDays(T, -7)}&to=${addDays(T, -1)}`);
  assert.deepEqual([past.kpi.period_orders, past.kpi.period_active, past.kpi.period_closed], [1, 0, 1]);
  const day = await k(`from=${addDays(T, 10)}&to=${addDays(T, 10)}`);
  assert.equal(day.kpi.period_orders, 1);
  const onlyFrom = await k(`from=${addDays(T, 10)}`);
  assert.deepEqual(onlyFrom.period, { from: addDays(T, 10), to: addDays(T, 16) });
});

test('Главная: неверный период — 400', async () => {
  for (const q of [`from=${addDays(T, 5)}&to=${T}`, `from=${T}&to=${addDays(T, 400)}`, 'from=2026-13-45', 'from=вчера']) {
    const r = await call('GET', `/api/decor/home?${q}`, U.founder.token);
    assert.equal(r.status, 400, q);
  }
});

test('Панель: меняет только учредитель — ген. директору и ПМ 403', async () => {
  const body = { panel_off: ['calc'] };
  const gd = await call('PUT', '/api/decor/settings/panel', U.gd.token, body);
  assert.equal(gd.status, 403); assert.equal(gd.data.code, 'founder_only');
  const pm = await call('PUT', '/api/decor/settings/panel', U.pm.token, body);
  assert.equal(pm.status, 403);
  const f = await call('PUT', '/api/decor/settings/panel', U.founder.token, body);
  assert.equal(f.status, 200, JSON.stringify(f.data));
  assert.deepEqual(f.data.panel_off, ['calc']);
  assert.equal((await call('PUT', '/api/decor/settings/panel', U.founder.token, { panel_off: [] })).status, 200);
});
