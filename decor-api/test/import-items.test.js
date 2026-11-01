'use strict';

// scripts/import-items.js: остатки Dora Decor из тетради (import/dora-decor-2026-10-21.json) попадают
// на экран «Склад → Декор и износ» и в калькулятор (свободно на дату) так же, как вещи, добавленные кнопкой.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');
const { importItems, readList } = require('../scripts/import-items');

const FILE = path.join(__dirname, '..', 'import', 'dora-decor-2026-10-21.json');
const NOTEBOOK = readList(FILE);

let stack;
let dora;
let other;
let tmp;

async function call(method, url, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) Object.assign(headers, { 'Content-Type': 'application/json', 'Idempotency-Key': `k${Date.now()}${Math.random().toString(36).slice(2)}` });
  const res = await fetch(stack.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function login(username, password) {
  const res = await fetch(`${stack.base}/api/decor/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}
const count = async (sql, params) => Number((await stack.pool.query(sql, params)).rows[0].n);
const writeTmp = (name, items) => { const p = path.join(tmp, name); fs.writeFileSync(p, JSON.stringify({ items })); return p; };

test.before(async () => {
  stack = await startStack();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decor-import-'));
  dora = await createCompany(stack.pool, { company: 'Dora Decor', username: 'doradecor' });
  dora.token = await login('doradecor', dora.password);
  other = await createCompany(stack.pool, { company: 'Other', username: 'other_founder' });
  other.token = await login('other_founder', other.password);
});
test.after(async () => { await stack?.stop(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

test('файл тетради: 75 позиций, без повторов, количества целые', () => {
  assert.equal(NOTEBOOK.length, 75);
  assert.deepEqual(NOTEBOOK[0], { name: 'Майда кўк ромашка', qty: 550, check: null });
  assert.deepEqual(NOTEBOOK.at(-1), { name: 'Удлинитель', qty: 10, check: null });
});

test('--dry-run показывает, что будет добавлено, и ничего не пишет', async () => {
  const r = await importItems(stack.pool, { founder: 'doradecor', file: FILE, dryRun: true });
  assert.equal(r.added.length, 75);
  assert.equal(await count('SELECT count(*) n FROM decor_items WHERE company_id=$1', [dora.companyId]), 0);
  assert.equal(await count("SELECT count(*) n FROM audit_log WHERE username='import-items.js'"), 0);
});

test('остатки видны на складе и в калькуляторе — как добавленные кнопкой', async () => {
  // Вещь, заведённая учредителем раньше, — не трогается, расхождение возвращается
  const pre = await call('POST', '/api/decor/items', dora.token, { name: 'Медуза', qty_bought: 3 });
  assert.equal(pre.status, 200, JSON.stringify(pre.data));

  const r = await importItems(stack.pool, { founder: 'doradecor', file: FILE });
  assert.equal(r.companyId, dora.companyId);
  assert.equal(r.added.length, 74);
  assert.deepEqual(r.kept.map(k => [k.name, k.have, k.qty]), [['Медуза', 3, 8]]);

  const items = await call('GET', '/api/decor/items', dora.token);
  assert.equal(items.status, 200);
  assert.deepEqual(items.data.map(i => i.name), ['Медуза', ...NOTEBOOK.map(x => x.name).filter(n => n !== 'Медуза')], 'порядок тетради, после уже заведённых');
  const byName = new Map(items.data.map(i => [i.name, i]));
  for (const x of NOTEBOOK.filter(n => n.name !== 'Медуза')) {
    const it = byName.get(x.name);
    assert.equal(it.qty_bought, x.qty, x.name);
    assert.equal(it.in_warehouse, x.qty, `${x.name}: на складе`);
    assert.equal(it.free_today, x.qty, `${x.name}: свободно сегодня`);
    assert.equal(Number(it.price_usd), 0);
    assert.equal(it.resource_orders, 1);
  }
  assert.equal(byName.get('Медуза').qty_bought, 3, 'заведённая раньше вещь не изменилась');

  const avail = await call('GET', '/api/decor/availability?date=2026-12-01', dora.token);
  assert.equal(avail.status, 200);
  assert.equal(avail.data.items.find(i => i.name === 'Тифони кичкина бой').free, 457);
  assert.equal(await count("SELECT count(*) n FROM audit_log WHERE username='import-items.js' AND entity_type='decor_item'"), 74);
  // Журнал склада (D25): остаток каждой новой вещи — строкой opening, сумма журнала = «Куплено»
  const { rows: [j] } = await stack.pool.query(`SELECT count(*)::int n, COALESCE(sum(qty), 0)::int s FROM decor_stock_moves
    WHERE company_id=$1 AND kind='opening' AND comment='Импорт: dora-decor-2026-10-21.json'`, [dora.companyId]);
  assert.deepEqual([j.n, j.s], [74, NOTEBOOK.filter(x => x.name !== 'Медуза').reduce((a, x) => a + x.qty, 0)]);

  const foreign = await call('GET', '/api/decor/items', other.token);
  assert.deepEqual(foreign.data, [], 'другая компания остатков Dora Decor не видит');
});

test('повторный запуск ничего не дублирует', async () => {
  const r = await importItems(stack.pool, { founder: 'doradecor', file: FILE });
  assert.equal(r.added.length, 0);
  assert.equal(r.kept.length, 75);
  assert.equal(await count('SELECT count(*) n FROM decor_items WHERE company_id=$1', [dora.companyId]), 75);
});

test('ошибка в файле или учредителе — ни одной вещи', async () => {
  const before = await count('SELECT count(*) n FROM decor_items', []);
  await assert.rejects(importItems(stack.pool, { founder: 'other_founder', file: writeTmp('dup.json', [{ name: 'Арка', qty: 1 }, { name: ' арка ', qty: 2 }]) }), /повторяется/);
  await assert.rejects(importItems(stack.pool, { founder: 'other_founder', file: writeTmp('neg.json', [{ name: 'Арка', qty: -1 }]) }), /целое число/);
  await assert.rejects(importItems(stack.pool, { founder: 'other_founder', file: writeTmp('frac.json', [{ name: 'Арка', qty: 1.5 }]) }), /целое число/);
  await assert.rejects(importItems(stack.pool, { founder: 'nobody', file: FILE }), /не найден/);
  await assert.rejects(importItems(stack.pool, { founder: 'other_founder', file: writeTmp('empty.json', []) }), /нет списка/);
  assert.equal(await count('SELECT count(*) n FROM decor_items', []), before);
});

test('название совпадает без учёта регистра — вещь не дублируется', async () => {
  assert.equal((await call('POST', '/api/decor/items', other.token, { name: 'Arch', qty_bought: 2 })).status, 200);
  const r = await importItems(stack.pool, { founder: 'other_founder', file: writeTmp('case.json', [{ name: 'ARCH', qty: 5 }, { name: 'Stand', qty: 4 }]) });
  assert.deepEqual(r.added.map(x => x.name), ['Stand']);
  assert.deepEqual(r.kept.map(k => [k.name, k.have]), [['ARCH', 2]]);
});
