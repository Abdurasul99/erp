'use strict';

// Готовые дизайны (D26): состав — вещи и количества; «хватает на» — из свободного сегодня;
// смотрят все, заводят «вести склад» / «менять настройки»; проверки состава; архив и одно
// действующее название в компании; ключ повтора обязателен.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');
const { createStaff } = require('../scripts/create-staff');

let stack;
const U = {};
const I = {};
async function call(method, url, token, body, key = crypto.randomUUID()) {
  const headers = { Authorization: `Bearer ${token}` };
  if (method !== 'GET') { headers['Content-Type'] = 'application/json'; if (key) headers['Idempotency-Key'] = key; }
  const res = await fetch(stack.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
const ok = r => { assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
async function login(username, password) {
  const res = await fetch(`${stack.base}/api/decor/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  return (await res.json()).token;
}

test.before(async () => {
  stack = await startStack();
  const f = await createCompany(stack.pool, { company: 'Dora Decor', username: 'ds_founder' });
  U.founder = await login('ds_founder', f.password);
  for (const [k, level] of [['keeper', 'storekeeper'], ['pm', 'pm']]) {
    const s = await createStaff(stack.pool, { founder: 'ds_founder', level, username: `ds_${k}`, name: k });
    U[k] = await login(`ds_${k}`, s.password);
  }
  for (const [k, name, qty] of [['rose', 'Роза белая', 50], ['arch', 'Арка золотая', 10], ['old', 'Старая люстра', 5]]) {
    I[k] = ok(await call('POST', '/api/decor/items', U.founder, { name, qty_bought: qty, price_usd: 2, resource_orders: 10 })).id;
  }
  ok(await call('PUT', `/api/decor/items/${I.old}`, U.founder, { is_active: false }));
  const other = await createCompany(stack.pool, { company: 'Чужая', username: 'ds_other' });
  U.other = await login('ds_other', other.password);
  I.foreign = ok(await call('POST', '/api/decor/items', U.other, { name: 'Чужая вещь', qty_bought: 1, price_usd: 1, resource_orders: 10 })).id;
});
test.after(async () => { await stack?.stop(); });

test('дизайн: состав складывает одну вещь, «хватает на» — по свободному сегодня', async () => {
  const d = ok(await call('POST', '/api/decor/designs', U.founder, { name: 'Белая арка', note: 'двор жениха',
    lines: [{ item_id: I.rose, qty: 20 }, { item_id: I.arch, qty: 3 }, { item_id: I.rose, qty: 5 }] }));
  assert.equal(d.name, 'Белая арка');
  assert.deepEqual(d.lines.map(l => [l.item, l.qty]), [['Арка золотая', 3], ['Роза белая', 25]]);
  assert.equal(d.pieces, 28);
  assert.equal(d.can_build, 2);            // розы 50/25 = 2, арки 10/3 = 3
  U.designId = d.id;
});

test('смотрят все (ПМ — для калькулятора), заводит склад; ПМ без «вести склад» — 403', async () => {
  const list = ok(await call('GET', '/api/decor/designs', U.pm));
  assert.ok(list.some(x => x.id === U.designId));
  assert.equal((await call('POST', '/api/decor/designs', U.pm, { name: 'ПМ', lines: [{ item_id: I.rose, qty: 1 }] })).status, 403);
  ok(await call('POST', '/api/decor/designs', U.keeper, { name: 'Розовый вход', lines: [{ item_id: I.rose, qty: 10 }] }));
  assert.ok(!ok(await call('GET', '/api/decor/designs', U.other)).length, 'чужая компания дизайнов не видит');
});

test('проверки: название, пустой состав, 0 шт, вещь в архиве или чужая, дубль названия, без ключа повтора', async () => {
  const bad = async (body, code) => { const r = await call('POST', '/api/decor/designs', U.founder, body); assert.equal(r.status, code, JSON.stringify(r.data)); return r.data; };
  await bad({ name: ' ', lines: [{ item_id: I.rose, qty: 1 }] }, 400);
  assert.equal((await bad({ name: 'Пусто', lines: [] }, 400)).code, 'design_empty');
  await bad({ name: 'Ноль', lines: [{ item_id: I.rose, qty: 0 }] }, 400);
  assert.equal((await bad({ name: 'Архив', lines: [{ item_id: I.old, qty: 1 }] }, 400)).code, 'design_item');
  assert.equal((await bad({ name: 'Чужой', lines: [{ item_id: I.foreign, qty: 1 }] }, 400)).code, 'design_item');
  assert.match((await bad({ name: 'белая АРКА', lines: [{ item_id: I.rose, qty: 1 }] }, 409)).error, /таким названием/);
  const nokey = await call('POST', '/api/decor/designs', U.founder, { name: 'Без ключа', lines: [{ item_id: I.rose, qty: 1 }] }, null);
  assert.equal(nokey.status, 400); assert.equal(nokey.data.code, 'idem_missing');
});

test('правка состава и архив: в архиве не мешает новому с тем же названием, вернуть дубль нельзя', async () => {
  const d = ok(await call('PUT', `/api/decor/designs/${U.designId}`, U.founder, { lines: [{ item_id: I.arch, qty: 5 }] }));
  assert.deepEqual(d.lines.map(l => [l.item, l.qty]), [['Арка золотая', 5]]);
  assert.equal(d.can_build, 2);
  ok(await call('PUT', `/api/decor/designs/${U.designId}`, U.founder, { is_active: false }));
  assert.ok(!ok(await call('GET', '/api/decor/designs', U.founder)).some(x => x.id === U.designId), 'в архиве — не в списке');
  assert.ok(ok(await call('GET', '/api/decor/designs?all=1', U.founder)).some(x => x.id === U.designId && !x.is_active));
  ok(await call('POST', '/api/decor/designs', U.founder, { name: 'Белая арка', lines: [{ item_id: I.rose, qty: 2 }] }));
  assert.equal((await call('PUT', `/api/decor/designs/${U.designId}`, U.founder, { is_active: true })).status, 409);
  assert.equal((await call('PUT', '/api/decor/designs/999999', U.founder, { name: 'X' })).status, 404);
});
