'use strict';

// Заказы на мероприятия через HTTP: создание, карточка, видимость по ролям,
// изоляция компаний, статусы, заморозка, оплаты, смета, бригада, этапы.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnv, sampleEvent } = require('./helpers');

let env;
test.before(async () => { env = await createTestEnv(); });
test.after(async () => { await env.close(); });

const E = '/api/events/events';

async function create(userId, overrides) {
  const r = await env.as(userId).post(E, sampleEvent(overrides));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

// ── Создание и карточка ─────────────────────────────────────────────────────

test('создание заказа: карточка с клиентом, деньгами и этапами воронки', async () => {
  const card = await create(10);
  assert.equal(card.event.status, 'draft');
  assert.equal(card.event.status_label, 'Черновик');
  assert.equal(card.client.name, 'Азиз');
  assert.equal(card.money.revenue, 24500000);
  assert.equal(card.money.payment_status, 'unpaid');
  // Свадьба → встроенный шаблон из макета: 8 этапов в правильном порядке.
  assert.deepEqual(card.stages.map((s) => s.name),
    ['Заявка', 'Смета', 'Закуп', 'Подготовка', 'Монтаж', 'Проведение', 'Демонтаж', 'Закрытие']);
  const smeta = card.stages.find((s) => s.name === 'Смета');
  assert.equal(smeta.deadline_label, 'За 14 дней до события');
  assert.equal(smeta.proof_label, 'Файл');
});

test('срок этапа считается от даты мероприятия по Ташкенту', async () => {
  const card = await create(10, { starts_at: '2026-12-20T18:00' });
  const montazh = card.stages.find((s) => s.name === 'Монтаж');
  // 18:00 Ташкента = 13:00 UTC; монтаж — «в день события, до начала».
  assert.equal(new Date(montazh.due_at).toISOString(), '2026-12-20T13:00:00.000Z');
  const smeta = card.stages.find((s) => s.name === 'Смета');
  assert.equal(new Date(smeta.due_at).toISOString(), '2026-12-06T13:00:00.000Z');
});

test('корпоратив получает свой шаблон воронки — 6 этапов', async () => {
  const card = await create(10, { event_type: 'Корпоратив', title: 'Корпоратив IT Park' });
  assert.equal(card.stages.length, 6);
  assert.equal(card.stages.find((s) => s.name === 'Смета').deadline_label, 'За 10 дней до события');
});

test('перенос мероприятия пересчитывает сроки незакрытых этапов', async () => {
  const card = await create(10, { starts_at: '2026-12-20T18:00' });
  const r = await env.as(10).put(`${E}/${card.event.id}`, { starts_at: '2026-12-27T18:00' });
  assert.equal(r.status, 200);
  const montazh = r.body.stages.find((s) => s.name === 'Монтаж');
  assert.equal(new Date(montazh.due_at).toISOString(), '2026-12-27T13:00:00.000Z');
});

test('обязательные поля и понятные ошибки', async () => {
  const noTitle = await env.as(10).post(E, sampleEvent({ title: '   ' }));
  assert.equal(noTitle.status, 400);
  assert.match(noTitle.body.error, /Название/);
  const badDate = await env.as(10).post(E, sampleEvent({ starts_at: 'завтра' }));
  assert.equal(badDate.status, 400);
  const negative = await env.as(10).post(E, sampleEvent({ total_price: -5 }));
  assert.equal(negative.status, 400);
  const backwards = await env.as(10).post(E, sampleEvent({ starts_at: '2026-12-20T18:00', ends_at: '2026-12-19T18:00' }));
  assert.equal(backwards.status, 400);
});

test('сумма «1 200 000,50» из формы понимается как число', async () => {
  const card = await create(10, { total_price: '1 200 000,50' });
  assert.equal(card.money.revenue, 1200000.5);
});

// ── Изоляция компаний ───────────────────────────────────────────────────────

test('чужая компания не видит наше мероприятие — 404, а не 403', async () => {
  const card = await create(10);
  const r = await env.as(20).get(`${E}/${card.event.id}`);
  assert.equal(r.status, 404, 'по коду ответа нельзя узнать, что номер существует');
  const list = await env.as(20).get(E);
  assert.ok(!list.body.items.some((e) => e.id === card.event.id));
});

test('чужая компания не может менять наше мероприятие ни одной ручкой', async () => {
  const card = await create(10);
  const id = card.event.id;
  const rival = env.as(20);
  const attempts = [
    rival.put(`${E}/${id}`, { title: 'взлом' }),
    rival.post(`${E}/${id}/status`, { status: 'cancelled' }),
    rival.post(`${E}/${id}/items`, { name: 'x', category: 'rental', qty: 1 }),
    rival.post(`${E}/${id}/payments`, { amount: 1 }),
    rival.put(`${E}/${id}/cost-lines`, { lines: [{ category: 'other', actual: 1 }] }),
    rival.post(`${E}/${id}/crew`, { user_id: 20 }),
    rival.del(`${E}/${id}`),
  ];
  for (const r of await Promise.all(attempts)) assert.equal(r.status, 404, JSON.stringify(r.body));
  const after = await env.as(10).get(`${E}/${id}`);
  assert.equal(after.body.event.title, 'Свадьба Азиз и Нилуфар');
  assert.equal(after.body.event.status, 'draft');
  assert.equal(after.body.payments.length, 0);
});

test('клиента чужой компании подставить нельзя', async () => {
  const theirs = await create(20, { client: { name: 'Клиент конкурента' } });
  const r = await env.as(10).post(E, sampleEvent({ client: undefined, client_id: theirs.client.id }));
  assert.equal(r.status, 400);
});

test('чужой филиал подставить нельзя', async () => {
  const r = await env.as(10).post(E, sampleEvent({ branch_id: 31 }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Филиал/);
});

test('в бригаду нельзя вписать человека чужой компании', async () => {
  const card = await create(10);
  const r = await env.as(10).post(`${E}/${card.event.id}/crew`, { user_id: 20 });
  assert.equal(r.status, 400);
});

test('в бригаду нельзя вписать учётку Wave', async () => {
  const card = await create(10);
  const r = await env.as(10).post(`${E}/${card.event.id}/crew`, { user_id: 31 });
  assert.equal(r.status, 400);
});

// ── Видимость по ролям ──────────────────────────────────────────────────────

test('декоратор видит только мероприятия, где он в бригаде', async () => {
  const mine = await create(10, { title: 'Где я в бригаде' });
  const other = await create(10, { title: 'Где меня нет' });
  const add = await env.as(10).post(`${E}/${mine.event.id}/crew`, { user_id: 13, pay_amount: 300000 });
  assert.equal(add.status, 200);

  const list = await env.as(13).get(E);
  const ids = list.body.items.map((e) => e.id);
  assert.ok(ids.includes(mine.event.id));
  assert.ok(!ids.includes(other.event.id));
  assert.equal((await env.as(13).get(`${E}/${other.event.id}`)).status, 404);
});

test('исполнитель не может менять заказ', async () => {
  const card = await create(10);
  await env.as(10).post(`${E}/${card.event.id}/crew`, { user_id: 13 });
  const r = await env.as(13).put(`${E}/${card.event.id}`, { total_price: 1 });
  assert.equal(r.status, 403);
  const create2 = await env.as(13).post(E, sampleEvent());
  assert.equal(create2.status, 403);
});

test('координатор видит свой филиал и создаёт только в нём', async () => {
  const tash = await env.as(12).post(E, sampleEvent({ title: 'Ташкентское', branch_id: 22 }));
  assert.equal(tash.status, 201);
  assert.equal(tash.body.event.branch_id, 21, 'координатор филиала 21 не может завести в 22-м');

  const sam = await env.as(17).post(E, sampleEvent({ title: 'Самаркандское' }));
  assert.equal(sam.status, 201);
  assert.equal(sam.body.event.branch_id, 22);

  const list = await env.as(12).get(E);
  const titles = list.body.items.map((e) => e.title);
  assert.ok(titles.includes('Ташкентское'));
  assert.ok(!titles.includes('Самаркандское'));
});

test('монтажнику раздел заказов закрыт матрицей доступа', async () => {
  const r = await env.as(15).get(E);
  assert.equal(r.status, 403);
});

// ── Статусы и заморозка ─────────────────────────────────────────────────────

test('подтвердить без цены нельзя', async () => {
  const card = await create(10, { total_price: 0 });
  const r = await env.as(10).post(`${E}/${card.event.id}/status`, { status: 'confirmed' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /стоимость/);
});

test('переходы статусов идут только по разрешённым путям', async () => {
  const card = await create(10);
  const id = card.event.id;
  const skip = await env.as(10).post(`${E}/${id}/status`, { status: 'completed' });
  assert.equal(skip.status, 409, 'из черновика сразу в «завершён» нельзя');
  for (const s of ['confirmed', 'in_progress', 'completed']) {
    const r = await env.as(10).post(`${E}/${id}/status`, { status: s });
    assert.equal(r.status, 200, `${s}: ${JSON.stringify(r.body)}`);
  }
  const done = await env.as(10).get(`${E}/${id}`);
  assert.equal(done.body.event.status, 'completed');
  assert.ok(done.body.event.closed_at);
});

test('завершённое мероприятие заморожено для правки сметы и состава', async () => {
  const card = await create(10);
  const id = card.event.id;
  for (const s of ['confirmed', 'in_progress', 'completed']) await env.as(10).post(`${E}/${id}/status`, { status: s });
  const edit = await env.as(10).put(`${E}/${id}`, { total_price: 1 });
  assert.equal(edit.status, 409);
  const item = await env.as(10).post(`${E}/${id}/items`, { name: 'Стулья', category: 'rental', qty: 10, price: 1000 });
  assert.equal(item.status, 409);
  // А доплату и фактические расходы после закрытия внести можно — так и бывает.
  const pay = await env.as(10).post(`${E}/${id}/payments`, { amount: 1000 });
  assert.equal(pay.status, 201);
  const fact = await env.as(10).put(`${E}/${id}/cost-lines`, { lines: [{ category: 'logistics', actual: 600000 }] });
  assert.equal(fact.status, 200);
});

test('вернуть завершённое в работу может только руководитель', async () => {
  const card = await create(10);
  const id = card.event.id;
  for (const s of ['confirmed', 'in_progress', 'completed']) await env.as(10).post(`${E}/${id}/status`, { status: s });
  const coord = await env.as(12).post(`${E}/${id}/status`, { status: 'in_progress' });
  assert.ok([403, 404].includes(coord.status), 'координатор филиала 21 не может, даже если видит');
  const pm = await env.as(11).post(`${E}/${id}/status`, { status: 'in_progress' });
  assert.equal(pm.status, 200);
  assert.equal(pm.body.event.closed_at, null);
});

test('удалить можно только черновик без оплат', async () => {
  const card = await create(10);
  const id = card.event.id;
  await env.as(10).post(`${E}/${id}/payments`, { amount: 500000 });
  const withPay = await env.as(10).del(`${E}/${id}`);
  assert.equal(withPay.status, 409);

  const clean = await create(10);
  const ok = await env.as(10).del(`${E}/${clean.event.id}`);
  assert.equal(ok.status, 200);
  assert.equal((await env.as(10).get(`${E}/${clean.event.id}`)).status, 404);
});

// ── Деньги в карточке ───────────────────────────────────────────────────────

test('оплаты, позиции, бригада и смета сходятся в карточке', async () => {
  const card = await create(10, { total_price: 10000000 });
  const id = card.event.id;
  const as = env.as(10);
  await as.post(`${E}/${id}/items`, { name: 'Цветы', category: 'consumable', qty: 20, price: 100000, cost: 40000 });
  await as.post(`${E}/${id}/items`, { name: 'Арка', category: 'rental', qty: 1, price: 2000000, cost: 150000 });
  await as.post(`${E}/${id}/crew`, { user_id: 13, pay_amount: 500000 });
  await as.post(`${E}/${id}/payments`, { amount: 3000000, method: 'transfer' });
  const r = await as.put(`${E}/${id}/cost-lines`, { lines: [{ category: 'logistics', planned: 300000 }] });
  assert.equal(r.status, 200);

  const m = r.body.money;
  assert.equal(m.revenue, 10000000);
  assert.equal(m.paid, 3000000);
  assert.equal(m.remaining, 7000000);
  const cat = Object.fromEntries(m.cost.rows.map((x) => [x.category, x.planned]));
  assert.deepEqual(cat, { materials: 800000, team: 500000, logistics: 300000, amort: 150000, other: 0 });
  assert.equal(m.cost.cost_total, 1750000);
  assert.equal(m.profit, 8250000);
  assert.equal(r.body.items.find((i) => i.name === 'Цветы').sum, 2000000);
});

test('позиция из каталога берётся снимком, чужой каталог недоступен', async () => {
  const { rows: [mine] } = await env.db.query(
    `INSERT INTO ev_items (company_id, name, category, qty_total, price, cost)
     VALUES (2, 'Стул Кьявари', 'rental', 100, 25000, 2000) RETURNING id`);
  const { rows: [theirs] } = await env.db.query(
    `INSERT INTO ev_items (company_id, name, category, qty_total, price, cost)
     VALUES (3, 'Чужой стул', 'rental', 100, 1, 1) RETURNING id`);
  const card = await create(10);
  const ok = await env.as(10).post(`${E}/${card.event.id}/items`, { item_id: mine.id, qty: 50 });
  assert.equal(ok.status, 200);
  const item = ok.body.items[0];
  assert.equal(item.name, 'Стул Кьявари');
  assert.equal(item.sum, 1250000);

  const bad = await env.as(10).post(`${E}/${card.event.id}/items`, { item_id: theirs.id, qty: 1 });
  assert.equal(bad.status, 400);

  // Правка каталога не переписывает уже составленную смету.
  await env.db.query('UPDATE ev_items SET price = 99999 WHERE id = $1', [mine.id]);
  const again = await env.as(10).get(`${E}/${card.event.id}`);
  assert.equal(again.body.items[0].price, 25000);
});

test('отмена мероприятия освобождает забронированный прокат', async () => {
  const { rows: [item] } = await env.db.query(
    `INSERT INTO ev_items (company_id, name, category, qty_total) VALUES (2, 'Скатерть', 'rental', 10) RETURNING id`);
  const card = await create(10);
  await env.db.query(
    `INSERT INTO ev_reservations (company_id, item_id, event_id, qty, date_from, date_to)
     VALUES (2, $1, $2, 10, '2026-12-01', '2026-12-02')`, [item.id, card.event.id]);
  const r = await env.as(10).post(`${E}/${card.event.id}/status`, { status: 'cancelled' });
  assert.equal(r.status, 200);
  assert.equal(r.body.reservations[0].status, 'cancelled');
});

test('удалить оплату может только руководитель', async () => {
  const card = await create(10);
  const paid = await env.as(10).post(`${E}/${card.event.id}/payments`, { amount: 100000 });
  const pid = paid.body.payments[0].id;
  const coord = await env.as(17).del(`${E}/${card.event.id}/payments/${pid}`);
  assert.ok([403, 404].includes(coord.status));
  const founder = await env.as(10).del(`${E}/${card.event.id}/payments/${pid}`);
  assert.equal(founder.status, 200);
  assert.equal(founder.body.payments.length, 0);
});

test('позицию другого мероприятия нельзя поправить через своё', async () => {
  const a = await create(10);
  const b = await create(10);
  const withItem = await env.as(10).post(`${E}/${b.event.id}/items`, { name: 'Свечи', category: 'consumable', qty: 5 });
  const itemId = withItem.body.items[0].id;
  const r = await env.as(10).put(`${E}/${a.event.id}/items/${itemId}`, { qty: 999 });
  assert.equal(r.status, 404);
});

test('список: фильтр по статусу, датам и поиску', async () => {
  await create(10, { title: 'Юбилей Фарход-ака', event_type: 'Юбилей', starts_at: '2027-03-15T12:00' });
  const byQ = await env.as(10).get(`${E}?q=${encodeURIComponent('фарход')}`);
  assert.ok(byQ.body.items.some((e) => e.title === 'Юбилей Фарход-ака'));
  const byDate = await env.as(10).get(`${E}?from=2027-03-15&to=2027-03-15`);
  assert.ok(byDate.body.items.every((e) => e.starts_at.startsWith('2027-03-15')));
  const badStatus = await env.as(10).get(`${E}?status=взломан`);
  assert.equal(badStatus.status, 400);
  // Знак процента в поиске — буквальный символ, а не «всё подряд».
  const pct = await env.as(10).get(`${E}?q=${encodeURIComponent('%')}`);
  assert.equal(pct.body.items.length, 0);
});
