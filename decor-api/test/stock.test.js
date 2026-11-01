'use strict';

// Этап 1 склада (D25): журнал склада — приход, списание, инвентаризация с причиной; право «вести склад» у кладовщика;
// архив вещи; «Купил декор» и новая вещь пишут журнал. Главное правило: сумма журнала по вещи = «Куплено».
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');
const { createStaff } = require('../scripts/create-staff');

let stack;
const U = {};        // founder, keeper (кладовщик), pm, cashier, other (учредитель другой компании)

async function call(method, url, token, body, key = crypto.randomUUID()) {
  const headers = { Authorization: `Bearer ${token}` };
  if (method !== 'GET') Object.assign(headers, { 'Content-Type': 'application/json', 'Idempotency-Key': key });
  const res = await fetch(stack.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
const ok = r => { assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
async function login(username, password) {
  const res = await fetch(`${stack.base}/api/decor/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}
const q = async (sql, params = []) => (await stack.pool.query(sql, params)).rows;
// Сумма журнала по каждой вещи компании совпадает с «Куплено»
async function journalMatches(cid) {
  const rows = await q(`SELECT i.id, i.name, i.qty_bought, COALESCE(SUM(s.qty), 0)::int AS journal
    FROM decor_items i LEFT JOIN decor_stock_moves s ON s.item_id=i.id WHERE i.company_id=$1 GROUP BY i.id`, [cid]);
  for (const r of rows) assert.equal(r.journal, r.qty_bought, `журнал «${r.name}» = ${r.journal}, «Куплено» = ${r.qty_bought}`);
  return rows.length;
}
const item = async (token, id) => (ok(await call('GET', '/api/decor/items?all=1', token))).find(x => x.id === id);

test.before(async () => {
  stack = await startStack();
  const f = await createCompany(stack.pool, { company: 'Dora Decor', username: 'dora_founder' });
  U.founder = { ...f, token: await login('dora_founder', f.password) };
  for (const [k, level] of [['keeper', 'storekeeper'], ['pm', 'pm'], ['cashier', 'cashier']]) {
    const s = await createStaff(stack.pool, { founder: 'dora_founder', level, username: `dora_${k}`, name: k });
    U[k] = { ...s, token: await login(`dora_${k}`, s.password) };
  }
  const o = await createCompany(stack.pool, { company: 'Other', username: 'other_founder' });
  U.other = { ...o, token: await login('other_founder', o.password) };
});
test.after(async () => { await stack?.stop(); });

test('новая компания: «вести склад» в матрице полномочий, по умолчанию — у кладовщика', async () => {
  const p = ok(await call('GET', '/api/decor/permissions', U.founder.token));
  assert.ok(p.actions.includes('manage_items'));
  assert.deepEqual([p.matrix.warehouse.manage_items, p.matrix.pm.manage_items, p.matrix.cashier.manage_items], [true, false, false]);
  const [{ n }] = await q('SELECT count(*)::int n FROM decor_permissions WHERE company_id=$1', [U.founder.companyId]);
  assert.equal(n, 33, '3 должности × 11 действий');
  const me = ok(await call('GET', '/api/decor/auth/me', U.founder.token));
  assert.ok(me.permissions.includes('manage_items'), 'учредитель может всё');
});

let arch;   // «Арка» — заводит кладовщик
test('кладовщик заводит вещь без цены и переименовывает; цену и ресурс — нельзя; «Куплено» числом — нельзя', async () => {
  arch = ok(await call('POST', '/api/decor/items', U.keeper.token, { name: 'Арка', qty_bought: 10 }));
  assert.equal(arch.qty_bought, 10);
  assert.equal(arch.in_warehouse, 10);
  assert.equal(arch.price_usd, undefined, 'кладовщик цен не видит');
  const opening = await q('SELECT kind, qty, qty_after, comment FROM decor_stock_moves WHERE item_id=$1', [arch.id]);
  assert.deepEqual(opening, [{ kind: 'opening', qty: 10, qty_after: 10, comment: 'Новая вещь' }]);

  const priced = await call('POST', '/api/decor/items', U.keeper.token, { name: 'Ваза', qty_bought: 1, price_usd: 5 });
  assert.equal(priced.status, 403);
  assert.equal((await call('PUT', `/api/decor/items/${arch.id}`, U.keeper.token, { price_usd: 50 })).status, 403);
  assert.equal(ok(await call('PUT', `/api/decor/items/${arch.id}`, U.keeper.token, { name: 'Бухоро арка' })).name, 'Бухоро арка');

  const direct = await call('PUT', `/api/decor/items/${arch.id}`, U.founder.token, { qty_bought: 99 });
  assert.equal(direct.status, 400);
  assert.equal(direct.data.code, 'use_stock_ops');
  assert.equal(ok(await call('PUT', `/api/decor/items/${arch.id}`, U.founder.token, { price_usd: 120, resource_orders: 30 })).price_usd, 120);
  assert.equal((await call('POST', '/api/decor/items', U.founder.token, { name: 'бухоро АРКА' })).status, 409, 'то же название другим регистром');
});

test('ПМ и кассир склад не ведут (по умолчанию)', async () => {
  for (const who of ['pm', 'cashier']) {
    assert.equal((await call('POST', '/api/decor/items', U[who].token, { name: `x-${who}` })).status, 403, who);
    assert.equal((await call('POST', `/api/decor/items/${arch.id}/stock`, U[who].token, { kind: 'receipt', qty: 1 })).status, 403, who);
  }
});

test('приход, списание, инвентаризация: причина обязательна, списать больше, чем на складе, нельзя', async () => {
  const op = (body, token = U.keeper.token) => call('POST', `/api/decor/items/${arch.id}/stock`, token, body);
  assert.equal(ok(await op({ kind: 'receipt', qty: 5 })).item.qty_bought, 15);

  const noReason = await op({ kind: 'writeoff', qty: 3 });
  assert.equal(noReason.status, 400);
  assert.equal(noReason.data.code, 'comment_required');
  const w = ok(await op({ kind: 'writeoff', qty: 3, comment: 'Сломали при монтаже' }));
  assert.deepEqual([w.move.qty, w.item.qty_bought, w.item.in_warehouse], [-3, 12, 12]);
  const tooMuch = await op({ kind: 'writeoff', qty: 13, comment: 'x' });
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.data.in_warehouse, 12);

  const same = ok(await op({ kind: 'count', counted: 12 }));
  assert.deepEqual([same.move.qty, same.move.expected, same.item.qty_bought], [0, 12, 12], 'совпало — без причины, запись есть');
  assert.equal((await op({ kind: 'count', counted: 10 })).status, 400, 'расхождение — с причиной');
  const less = ok(await op({ kind: 'count', counted: 10, comment: 'Двух нет' }));
  assert.deepEqual([less.move.qty, less.move.counted, less.move.expected, less.item.qty_bought], [-2, 10, 12, 10]);
  assert.equal((await op({ kind: 'move', qty: 1 })).status, 400);
  assert.equal((await op({ kind: 'receipt', qty: 1.5 })).status, 400);
  await journalMatches(U.founder.companyId);
});

test('инвентаризация считает от «на складе»: вещи на объекте в расчёт не идут', async () => {
  const cid = U.founder.companyId;
  const [o] = await q(`INSERT INTO decor_orders (company_id, no, client, event_date, type, status) VALUES ($1, 'D-900', 'Клиент', CURRENT_DATE, 'big', 'install') RETURNING id`, [cid]);
  await q("INSERT INTO decor_moves (company_id, order_id, item_id, type, qty) VALUES ($1, $2, $3, 'issue', 2)", [cid, o.id, arch.id]);
  const before = await item(U.keeper.token, arch.id);
  assert.deepEqual([before.qty_bought, before.on_site, before.in_warehouse], [10, 2, 8]);
  const r = ok(await call('POST', `/api/decor/items/${arch.id}/stock`, U.keeper.token, { kind: 'count', counted: 7, comment: 'Одной не нашли' }));
  assert.deepEqual([r.move.expected, r.move.qty, r.item.qty_bought, r.item.on_site, r.item.in_warehouse], [8, -1, 9, 2, 7]);
  assert.equal((await call('POST', `/api/decor/items/${arch.id}/stock`, U.keeper.token, { kind: 'writeoff', qty: 8, comment: 'x' })).status, 409, 'две на объекте — их не списать');

  const h = ok(await call('GET', `/api/decor/items/${arch.id}/history`, U.keeper.token));
  assert.equal(h.item.id, arch.id);
  assert.deepEqual(h.moves.filter(m => m.source === 'stock').map(m => m.kind), ['count', 'count', 'count', 'writeoff', 'receipt', 'opening']);
  const issue = h.moves.find(m => m.source === 'order');
  assert.deepEqual([issue.kind, issue.qty, issue.no], ['issue', 2, 'D-900']);
  assert.equal(h.moves.find(m => m.kind === 'writeoff').who, 'keeper', 'кто сделал');
});

test('архив: вещь пропадает из списка и броне, операции закрыты, возвращается обратно', async () => {
  ok(await call('PUT', `/api/decor/items/${arch.id}`, U.keeper.token, { is_active: false }));
  assert.equal(ok(await call('GET', '/api/decor/items', U.keeper.token)).some(x => x.id === arch.id), false);
  assert.equal((await item(U.keeper.token, arch.id)).is_active, false, 'в ?all=1 — есть');
  assert.equal(ok(await call('GET', '/api/decor/availability?date=2026-12-01', U.founder.token)).items.some(x => x.id === arch.id), false);
  const closed = await call('POST', `/api/decor/items/${arch.id}/stock`, U.keeper.token, { kind: 'receipt', qty: 1 });
  assert.equal(closed.status, 409);
  assert.equal(closed.data.code, 'archived');
  assert.equal(ok(await call('PUT', `/api/decor/items/${arch.id}`, U.keeper.token, { is_active: true })).is_active, true);
});

test('«Купил декор» пополняет склад строкой журнала со ссылкой на покупку', async () => {
  const buy = ok(await call('POST', '/api/decor/finance/fund/spend', U.founder.token, { amount_usd: 50, comment: 'Ещё арки', item_id: arch.id, qty: 5 }));
  assert.equal(buy.item.qty_bought, 14);
  const [row] = await q("SELECT kind, qty, qty_after, fund_spend_id, comment FROM decor_stock_moves WHERE item_id=$1 AND kind='purchase'", [arch.id]);
  assert.deepEqual(row, { kind: 'purchase', qty: 5, qty_after: 14, fund_spend_id: buy.spend_id, comment: 'Ещё арки' });

  const fresh = ok(await call('POST', '/api/decor/finance/fund/spend', U.founder.token, { amount_usd: 20, comment: 'Новые вазы', new_item: { name: 'Ваза' }, qty: 4, resource_orders: 10 }));
  assert.equal(fresh.item.qty_bought, 4);
  assert.deepEqual(await q('SELECT kind, qty FROM decor_stock_moves WHERE item_id=$1', [fresh.item.id]), [{ kind: 'purchase', qty: 4 }]);
  assert.ok(await journalMatches(U.founder.companyId) >= 2);
});

test('повтор с тем же ключом не проводит операцию дважды', async () => {
  const key = crypto.randomUUID();
  const a = ok(await call('POST', `/api/decor/items/${arch.id}/stock`, U.keeper.token, { kind: 'receipt', qty: 2 }, key));
  const b = ok(await call('POST', `/api/decor/items/${arch.id}/stock`, U.keeper.token, { kind: 'receipt', qty: 2 }, key));
  assert.equal(b.move.id, a.move.id);
  assert.equal((await item(U.keeper.token, arch.id)).qty_bought, 16);
});

test('журнал склада компании: новые сверху, страницами, фильтр по операции; чужая компания его не видит', async () => {
  const p1 = ok(await call('GET', '/api/decor/stock-moves?limit=3', U.keeper.token));
  assert.equal(p1.moves.length, 3);
  assert.equal(p1.more, true);
  assert.ok(p1.moves[0].id > p1.moves[2].id);
  assert.equal(p1.moves[0].item, 'Бухоро арка');
  const p2 = ok(await call('GET', `/api/decor/stock-moves?limit=3&before=${p1.moves[2].id}`, U.keeper.token));
  assert.ok(p2.moves.every(m => m.id < p1.moves[2].id));
  assert.ok(ok(await call('GET', '/api/decor/stock-moves?kind=writeoff', U.keeper.token)).moves.every(m => m.kind === 'writeoff'));

  assert.deepEqual(ok(await call('GET', '/api/decor/stock-moves', U.other.token)).moves, []);
  assert.equal((await call('GET', `/api/decor/items/${arch.id}/history`, U.other.token)).status, 404);
  assert.equal((await call('POST', `/api/decor/items/${arch.id}/stock`, U.other.token, { kind: 'receipt', qty: 1 })).status, 404);
  assert.equal((await call('PUT', `/api/decor/items/${arch.id}`, U.other.token, { name: 'Чужая' })).status, 404);
});
