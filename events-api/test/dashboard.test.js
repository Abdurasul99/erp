'use strict';

// Главная и справочник клиентов. Главное — цифры главной сходятся с карточками
// заказов: «к получению» равно сумме остатков, а чужая компания в них не видна.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnv, sampleEvent } = require('./helpers');

let env;
test.before(async () => { env = await createTestEnv(); });
test.after(async () => { await env.close(); });

const E = '/api/events/events';

function inDays(n, hour = '18:00') {
  const d = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return `${d}T${hour}`;
}

test('«к получению» на главной равно сумме остатков по заказам', async () => {
  const as = env.as(11);
  const a = await as.post(E, sampleEvent({ title: 'A', total_price: 10000000, starts_at: inDays(5) }));
  const b = await as.post(E, sampleEvent({ title: 'B', total_price: 4000000, starts_at: inDays(8) }));
  const draft = await as.post(E, sampleEvent({ title: 'Черновик', total_price: 99000000, starts_at: inDays(9) }));
  for (const id of [a.body.event.id, b.body.event.id]) await as.post(`${E}/${id}/status`, { status: 'confirmed' });
  await as.post(`${E}/${a.body.event.id}/payments`, { amount: 3000000 });

  const r = await as.get('/api/events/dashboard');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // 10 000 000 − 3 000 000 + 4 000 000; черновик — не долг клиента.
  assert.equal(r.body.money.to_collect, 11000000);
  assert.ok(r.body.upcoming.some((e) => e.id === draft.body.event.id), 'черновик виден в ближайших');
  const upA = r.body.upcoming.find((e) => e.id === a.body.event.id);
  assert.equal(upA.remaining, 7000000);
  assert.equal(upA.next_stage.name, 'Заявка', 'первый незакрытый этап');
});

test('ближайшие отсортированы по дате', async () => {
  const r = await env.as(11).get('/api/events/dashboard');
  const dates = r.body.upcoming.map((e) => new Date(e.starts_at).getTime());
  assert.deepEqual(dates, [...dates].sort((x, y) => x - y));
});

test('чужая компания не попадает в цифры главной', async () => {
  await env.as(20).post(E, sampleEvent({ title: 'Чужое', total_price: 500000000, starts_at: inDays(3) }));
  const mine = await env.as(10).get('/api/events/dashboard');
  assert.ok(!mine.body.upcoming.some((e) => e.title === 'Чужое'));
  assert.ok(mine.body.money.to_collect < 500000000);
});

test('должник: мероприятие прошло, оплачено не всё', async () => {
  const as = env.as(10);
  const past = await as.post(E, sampleEvent({ title: 'Прошедшее', total_price: 2000000, starts_at: inDays(-10) }));
  const id = past.body.event.id;
  for (const s of ['confirmed', 'in_progress', 'completed']) await as.post(`${E}/${id}/status`, { status: s });
  await as.post(`${E}/${id}/payments`, { amount: 500000 });
  const r = await as.get('/api/events/dashboard');
  const debtor = r.body.debtors.find((d) => d.id === id);
  assert.ok(debtor, 'должник должен попасть в список');
  assert.equal(debtor.remaining, 1500000);
});

test('главная закрыта для исполнителей матрицей доступа', async () => {
  assert.equal((await env.as(13).get('/api/events/dashboard')).status, 403);
  assert.equal((await env.as(12).get('/api/events/dashboard')).status, 403, 'у координатора в макете нет дашборда');
});

// ── Клиенты ─────────────────────────────────────────────────────────────────

test('справочник клиентов: поиск и сумма заказов', async () => {
  const as = env.as(10);
  await as.post(E, sampleEvent({ title: 'Для клиента', total_price: 7000000, client: { name: 'Фарход Юсупов', phone: '+998 91 111 11 11' } }));
  const r = await as.get(`/api/events/clients?q=${encodeURIComponent('фарход')}`);
  assert.equal(r.status, 200);
  const c = r.body.items.find((x) => x.name === 'Фарход Юсупов');
  assert.ok(c);
  assert.equal(c.events_count, 1);
  assert.equal(c.total_spent, 7000000);
});

test('клиенты чужой компании не видны и не правятся', async () => {
  const theirs = await env.as(20).post('/api/events/clients', { name: 'Клиент конкурента' });
  assert.equal(theirs.status, 201);
  const list = await env.as(10).get('/api/events/clients');
  assert.ok(!list.body.items.some((c) => c.name === 'Клиент конкурента'));
  const edit = await env.as(10).put(`/api/events/clients/${theirs.body.id}`, { name: 'Взлом' });
  assert.equal(edit.status, 404);
});

test('исполнителю справочник клиентов закрыт', async () => {
  assert.equal((await env.as(13).get('/api/events/clients')).status, 403);
});
