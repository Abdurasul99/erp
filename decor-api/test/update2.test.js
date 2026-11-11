'use strict';

// ТЗ «Декор, обновление 2»: Кадрият (D27), клиенты (D28), задачи и автозадачи (D29), стандарты работ (D30).
// Приёмка ТЗ: (1) родственник с днём рождения через 7 дней → задача кассиру, повтор дубля не создаёт;
// (2) перетаскивание меняет квадрат, просроченная видна на Главной; (3) шаги по порядку, «нужно фото» без фото не
// отметить, изменение стандарта не меняет начатый чек-лист; (4) Кадрият у ПМ и на входе, меняет учредитель, ПМ — нет;
// (5) повтор новых действий не создаёт дублей. Плюс: удаление компании целиком по-прежнему проходит.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');
const { createStaff } = require('../scripts/create-staff');
const { todayYmd } = require('../decor/common');
const F = require('../decor/formulas');
const { nextOccurrence } = require('../decor/clients');

let stack;
const U = {};      // токены
const E = {};      // id сотрудников и пользователей
const C = {};      // компании
const T = todayYmd();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// Дата «через days дней» yearsAgo лет назад (кратно 4 — 29 февраля не сломает)
const ago = (days, yearsAgo) => { const d = F.addDays(T, days); return `${Number(d.slice(0, 4)) - yearsAgo}${d.slice(4)}`; };

async function call(method, url, token, body, key = crypto.randomUUID()) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') { if (key) headers['Idempotency-Key'] = key; }
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(stack.base + url, { method, headers, body: payload });
  return { status: res.status, data: await res.json(), replay: res.headers.get('idempotent-replay') };
}
const ok = r => { assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
const photo = (name = 'step.png') => { const fd = new FormData(); fd.append('files', new Blob([PNG], { type: 'image/png' }), name); return fd; };
async function login(username, password) {
  const res = await fetch(`${stack.base}/api/decor/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const d = await res.json();
  return { token: d.token, id: d.user.id };
}

test.before(async () => {
  stack = await startStack();
  const f = await createCompany(stack.pool, { company: 'Dora Decor', username: 'u2_founder' });
  C.main = f.companyId;
  const fl = await login('u2_founder', f.password); U.founder = fl.token; E.founderUser = fl.id;
  for (const [k, level] of [['cashier', 'cashier'], ['pm', 'pm'], ['trainee', 'trainee'], ['keeper', 'storekeeper']]) {
    const s = await createStaff(stack.pool, { founder: 'u2_founder', level, username: `u2_${k}`, name: k });
    const l = await login(`u2_${k}`, s.password);
    U[k] = l.token; E[`${k}User`] = l.id; E[`${k}Emp`] = s.employeeId;
  }
  const o = await createCompany(stack.pool, { company: 'Чужая', username: 'u2_other' });
  C.other = o.companyId; U.other = (await login('u2_other', o.password)).token;
});
test.after(async () => { await stack?.stop(); });

// ---------------------------------------------------------------- Кадрият
test('Кадрият: 6 ценностей с названиями и пустыми текстами; открыто для страницы входа; ПМ видит, но не меняет; учредитель меняет — ПМ видит сразу', async () => {
  const v = ok(await call('GET', '/api/decor/values', U.pm));
  assert.deepEqual(v.map(x => x.title_ru), ['Смелость', 'Стабильность', 'Готовность к новому', 'Честность', 'Справедливость', 'Результативность']);
  assert.deepEqual(v.map(x => x.title_uz), ['Mardlik', 'Stabillik', 'Yangilikka tayyor bo‘lish', 'Halollik', 'Adolatlilik', 'Natijaviylik']);
  assert.ok(v.every(x => x.text_ru === '' && x.text_uz === ''), 'тексты пустые — пишет учредитель');

  // страница входа: без токена, своя компания по ?company=, неизвестная — первая компания
  const pub = await (await fetch(`${stack.base}/api/decor/public/values?company=${C.main}`)).json();
  assert.equal(pub.company_id, C.main); assert.equal(pub.values.length, 6);
  assert.equal((await (await fetch(`${stack.base}/api/decor/public/values?company=${C.other}`)).json()).company_id, C.other);
  assert.equal((await (await fetch(`${stack.base}/api/decor/public/values?company=999999`)).json()).company_id, C.main);

  const edit = v.map(x => ({ ...x }));
  edit[0].text_ru = 'Не бояться большого заказа'; edit[0].text_uz = 'Katta buyurtmadan qo‘rqmaslik';
  [edit[0], edit[1]] = [edit[1], edit[0]];                                   // порядок кнопок: «Смелость» второй
  const denied = await call('PUT', '/api/decor/values', U.pm, { values: edit });
  assert.equal(denied.status, 403); assert.equal(denied.data.code, 'no_permission');
  const key = crypto.randomUUID();
  const saved = ok(await call('PUT', '/api/decor/values', U.founder, { values: edit }, key));
  assert.deepEqual([saved[0].title_ru, saved[1].title_ru], ['Стабильность', 'Смелость']);
  const again = await call('PUT', '/api/decor/values', U.founder, { values: edit }, key);
  assert.equal(again.status, 200); assert.equal(again.replay, 'true', 'повтор с тем же ключом — первый ответ');
  const pm = ok(await call('GET', '/api/decor/values', U.pm));
  assert.equal(pm[1].text_ru, 'Не бояться большого заказа'); assert.equal(pm[1].text_uz, 'Katta buyurtmadan qo‘rqmaslik');
  assert.equal((await (await fetch(`${stack.base}/api/decor/public/values?company=${C.main}`)).json()).values[1].text_ru, 'Не бояться большого заказа');

  assert.equal((await call('PUT', '/api/decor/values', U.founder, { values: edit.slice(0, 5) })).data.code, 'values_count');
  assert.equal((await call('PUT', '/api/decor/values', U.founder, { values: edit.map((x, i) => (i ? x : { ...x, title_uz: ' ' })) })).status, 400);
  // учредитель даёт право ПМ — ПМ сохраняет; без ключа повтора — нет
  ok(await call('PUT', '/api/decor/permissions', U.founder, { position: 'pm', action: 'edit_values', allowed: true }));
  ok(await call('PUT', '/api/decor/values', U.pm, { values: edit }));
  assert.equal((await call('PUT', '/api/decor/values', U.pm, { values: edit }, null)).data.code, 'idem_missing');
  ok(await call('PUT', '/api/decor/permissions', U.founder, { position: 'pm', action: 'edit_values', allowed: false }));
  // чужая компания свои ценности не путает
  assert.equal(ok(await call('GET', '/api/decor/values', U.other))[0].title_ru, 'Смелость');
});

// ---------------------------------------------------------------- Клиенты
test('клиенты: один телефон — один клиент; лид и калькулятор находят клиента по телефону или заводят нового; повторный — от 2 заказов; ПМ клиентов не видит', async () => {
  const c = ok(await call('POST', '/api/decor/clients', U.cashier, { name: 'Дилноза', phone: '+998 90 123-45-67', source: 'instagram', birth_date: ago(5, 40) }));
  E.client = c.id;
  assert.equal(c.kind, 'new'); assert.equal(c.orders, 0);
  const dup = await call('POST', '/api/decor/clients', U.cashier, { name: 'Другая', phone: '901234567' });
  assert.equal(dup.status, 409); assert.equal(dup.data.code, 'client_exists'); assert.equal(dup.data.client_id, c.id);
  assert.equal((await call('POST', '/api/decor/clients', U.cashier, { name: 'Без телефона', phone: '12-34' })).data.code, 'bad_phone');
  assert.equal((await call('GET', '/api/decor/clients', U.pm)).status, 403, 'телефоны и дни рождения — не ПМ');
  assert.equal(ok(await call('GET', '/api/decor/clients/lookup?phone=90%20123%2045%2067', U.cashier)).client.id, c.id);
  assert.equal(ok(await call('GET', '/api/decor/clients/lookup?phone=93', U.cashier)).client, null);

  // лид с тем же телефоном в другом виде — привязан к клиенту; с новым телефоном — новый клиент
  const lead = ok(await call('POST', '/api/decor/orders', U.cashier, { client: 'Дилноза опа', phone: '90-123-45-67', event_date: F.addDays(T, 40), status: 'lead' }));
  assert.equal(lead.client_ref.id, c.id);
  const lead2 = ok(await call('POST', '/api/decor/orders', U.cashier, { client: 'Новый клиент', phone: '+998 93 555 11 22', address: 'Чиланзар', event_date: F.addDays(T, 50) }));
  const fresh = ok(await call('GET', '/api/decor/clients/lookup?phone=935551122', U.cashier)).client;
  assert.equal(lead2.client_ref.id, fresh.id); assert.equal(fresh.name, 'Новый клиент'); assert.equal(fresh.address, 'Чиланзар');
  assert.equal(fresh.orders, 0, 'лид — не заказ'); assert.equal(fresh.leads, 1);

  // калькулятор: заказ по телефону — тот же клиент
  const item = ok(await call('POST', '/api/decor/items', U.founder, { name: 'Арка', qty_bought: 5, price_usd: 10, resource_orders: 10 }));
  const conf = ok(await call('POST', '/api/decor/calc/confirm', U.cashier, { client: 'Дилноза', phone: '901234567', event_date: F.addDays(T, 20), type: 'big',
    team: [], lines: [{ item_id: item.id, qty: 1 }], price_usd: 600 }));
  let card = ok(await call('GET', `/api/decor/orders/${conf.order.id}`, U.cashier));
  assert.equal(card.client_ref.id, c.id); assert.equal(card.client_ref.orders, 1); assert.equal(card.client_ref.kind, 'new');
  ok(await call('POST', '/api/decor/orders', U.cashier, { client: 'Дилноза', phone: '+998901234567', event_date: F.addDays(T, 90), status: 'design' }));
  const list = ok(await call('GET', '/api/decor/clients?kind=repeat', U.cashier));
  assert.deepEqual(list.map(x => x.id), [c.id]); assert.equal(list[0].orders, 2); assert.equal(list[0].total_usd, 600);
  assert.equal(ok(await call('GET', '/api/decor/clients?q=123 45', U.cashier))[0].id, c.id, 'поиск по цифрам телефона');
  const full = ok(await call('GET', `/api/decor/clients/${c.id}`, U.cashier));
  assert.equal(full.history.length, 3);
  assert.equal((await call('GET', `/api/decor/clients/${c.id}`, U.other)).status, 404, 'чужой клиент не виден');

  // правка заказа: другой телефон — другой клиент
  card = ok(await call('PUT', `/api/decor/orders/${lead.id}`, U.cashier, { phone: '935551122' }));
  assert.equal(card.client_ref.id, fresh.id);
  ok(await call('PUT', `/api/decor/orders/${lead.id}`, U.cashier, { phone: '901234567' }));
  // правка клиента: занятый телефон — 409
  assert.equal((await call('PUT', `/api/decor/clients/${fresh.id}`, U.cashier, { phone: '90 123 45 67' })).data.code, 'client_exists');
  ok(await call('PUT', `/api/decor/clients/${c.id}`, U.cashier, { notes: 'Любит белые цветы', phone2: '+998 97 000 00 01' }));

  // родственники
  const son = ok(await call('POST', `/api/decor/clients/${c.id}/relatives`, U.cashier, { relation: 'son', name: 'Жасур', birth_date: ago(7, 24),
    not_married: true, expected_wedding_year: 2027 }));
  E.son = son.id;
  const tmp = ok(await call('POST', `/api/decor/clients/${c.id}/relatives`, U.cashier, { relation: 'nephew', name: 'Временный' }));
  assert.equal((await call('POST', `/api/decor/clients/${c.id}/relatives`, U.cashier, { relation: 'uncle', name: 'X' })).status, 400);
  ok(await call('PUT', `/api/decor/clients/${c.id}/relatives/${tmp.id}`, U.cashier, { name: 'Ещё временный' }));
  ok(await call('DELETE', `/api/decor/clients/${c.id}/relatives/${tmp.id}`, U.cashier));
  assert.deepEqual(ok(await call('GET', `/api/decor/clients/${c.id}`, U.cashier)).relatives.map(r => r.name), ['Жасур']);
  // годовщина свадьбы — дата прошлого заказа (через 10 дней будет 4 года)
  ok(await call('POST', '/api/decor/orders', U.cashier, { client: 'Дилноза', phone: '901234567', event_date: ago(10, 4), status: 'design' }));
});

test('«Ближайшие даты» на 30 дней: день рождения клиента и родственника, годовщина свадьбы; «не в браке» — будущие свадьбы; 29 февраля → 28-е', async () => {
  const u = ok(await call('GET', '/api/decor/clients/upcoming', U.cashier));
  const pick = kind => u.events.find(e => e.kind === kind && e.client.id === E.client);
  assert.deepEqual([pick('client_birthday').date, pick('client_birthday').years, pick('client_birthday').days_left], [F.addDays(T, 5), 40, 5]);
  assert.deepEqual([pick('relative_birthday').date, pick('relative_birthday').relative.name, pick('relative_birthday').relative.not_married], [F.addDays(T, 7), 'Жасур', true]);
  assert.deepEqual([pick('anniversary').date, pick('anniversary').years], [F.addDays(T, 10), 4]);
  assert.deepEqual(u.weddings.map(w => [w.name, w.expected_wedding_year, w.client.id]), [['Жасур', 2027, E.client]]);
  assert.equal(nextOccurrence('2000-02-29', '2027-02-01'), '2027-02-28');
  assert.equal(nextOccurrence('2000-02-29', '2028-02-01'), '2028-02-29');
  assert.equal(nextOccurrence('1990-01-05', '2026-11-11'), '2027-01-05');
});

// ---------------------------------------------------------------- Задачи
test('автозадачи: за 7 дней до даты — кассиру «позвонить и предложить»; повторный запуск дубля не создаёт; кассир закрывает сам с итогом', async () => {
  assert.equal((await call('POST', '/api/decor/tasks/auto/run', U.cashier)).status, 403);
  const r1 = ok(await call('POST', '/api/decor/tasks/auto/run', U.founder));
  assert.equal(r1.created, 2, 'день рождения клиента (через 5) и сына (через 7); годовщина через 10 — позже');
  const r2 = ok(await call('POST', '/api/decor/tasks/auto/run', U.founder));
  assert.equal(r2.created, 0, 'одна задача на одну дату в год');
  const { rows: [{ n }] } = await stack.pool.query("SELECT count(*)::int n FROM decor_tasks WHERE company_id=$1 AND source='auto_client_date'", [C.main]);
  assert.equal(n, 2);

  const mine = ok(await call('GET', '/api/decor/tasks', U.cashier)).filter(t => t.source === 'auto_client_date');
  assert.equal(mine.length, 2);
  assert.ok(mine.every(t => t.assignee.id === E.cashierUser && t.client.id === E.client && t.important && !t.urgent));
  const son = mine.find(t => t.auto_kind === 'relative_birthday');
  assert.equal(son.due_date, F.addDays(T, 7)); assert.equal(son.relative.name, 'Жасур');
  assert.match(son.description, /Не в браке/); assert.match(son.title, /Позвонить: Дилноза/);
  assert.equal(ok(await call('GET', '/api/decor/tasks', U.pm)).length, 0, 'ПМ чужие задачи не видит');
  const closed = ok(await call('POST', `/api/decor/tasks/${son.id}/status`, U.cashier, { status: 'done', result: 'Договорились о встрече' }));
  assert.equal(closed.status, 'done'); assert.equal(closed.result, 'Договорились о встрече'); assert.equal(closed.done_by.id, E.cashierUser);
  assert.equal(ok(await call('POST', '/api/decor/tasks/auto/run', U.founder)).created, 0, 'закрытая задача не возвращается');
});

test('задачи: матрица (перетаскивание меняет квадрат), канбан, просроченная — на Главной и в подсказках; права ставить и принимать', async () => {
  const people = ok(await call('GET', '/api/decor/tasks/people', U.founder));
  assert.ok(people.can_assign && people.people.some(p => p.id === E.pmUser));
  assert.deepEqual(ok(await call('GET', '/api/decor/tasks/people', U.pm)).people.map(p => p.id), [E.pmUser], 'без «ставить задачи» — только себе');

  const key = crypto.randomUUID();
  const t = ok(await call('POST', '/api/decor/tasks', U.founder, { title: 'Купить белую ткань', assignee_id: E.pmUser, due_date: F.addDays(T, -1), urgent: true, important: true }, key));
  const rep = await call('POST', '/api/decor/tasks', U.founder, { title: 'Купить белую ткань', assignee_id: E.pmUser, due_date: F.addDays(T, -1), urgent: true, important: true }, key);
  assert.equal(rep.replay, 'true'); assert.equal(rep.data.id, t.id);
  const { rows: [{ n }] } = await stack.pool.query("SELECT count(*)::int n FROM decor_tasks WHERE title='Купить белую ткань'");
  assert.equal(n, 1, 'повтор не создал вторую задачу');

  let pmView = ok(await call('GET', `/api/decor/tasks/${t.id}`, U.pm));
  assert.equal(pmView.overdue, true); assert.equal(pmView.can.edit, false);
  assert.deepEqual(pmView.can.moves, ['in_progress', 'review'], 'ПМ двигает по канбану, «готово» — нет');
  assert.equal((await call('PUT', `/api/decor/tasks/${t.id}`, U.pm, { urgent: false })).data.code, 'task_forbidden');
  // перетаскивание в «важно, не срочно»
  const moved = ok(await call('PUT', `/api/decor/tasks/${t.id}`, U.founder, { urgent: false, important: true }));
  assert.deepEqual([moved.urgent, moved.important], [false, true]);

  // Главная и подсказки ПМ: просроченная задача
  const home = ok(await call('GET', '/api/decor/home', U.pm));
  assert.equal(home.tasks.overdue, 1); assert.equal(home.tasks.overdue_list[0].title, 'Купить белую ткань'); assert.equal(home.tasks.mine_open, 1);
  assert.ok(ok(await call('GET', '/api/decor/hints', U.pm)).some(h => h.kind === 'tasks_overdue' && h.count === 1));
  assert.equal(home.intel.kind, 'tasks_overdue');

  ok(await call('POST', `/api/decor/tasks/${t.id}/status`, U.pm, { status: 'in_progress' }));
  ok(await call('POST', `/api/decor/tasks/${t.id}/status`, U.pm, { status: 'review' }));
  assert.equal((await call('POST', `/api/decor/tasks/${t.id}/status`, U.pm, { status: 'done' })).data.code, 'task_forbidden');
  assert.equal((await call('GET', `/api/decor/tasks/${t.id}`, U.cashier)).status, 404, 'кассир чужую задачу не видит');
  ok(await call('POST', `/api/decor/tasks/${t.id}/status`, U.founder, { status: 'done' }));
  assert.equal(ok(await call('GET', '/api/decor/home', U.pm)).tasks.overdue, 0);
  assert.equal((await call('PUT', `/api/decor/tasks/${t.id}`, U.founder, { title: 'X' })).data.code, 'task_done');

  // себе — каждый; другому — только с «ставить задачи»; свою личную закрывает сам
  const own = ok(await call('POST', '/api/decor/tasks', U.pm, { title: 'Проверить гирлянды' }));
  assert.equal(own.assignee.id, E.pmUser);
  assert.equal((await call('POST', '/api/decor/tasks', U.pm, { title: 'Кассиру', assignee_id: E.cashierUser })).data.code, 'no_permission');
  ok(await call('POST', `/api/decor/tasks/${own.id}/status`, U.pm, { status: 'done' }));
  // право «принимать» у кассира — видит и принимает все
  ok(await call('PUT', '/api/decor/permissions', U.founder, { position: 'cashier', action: 'accept_tasks', allowed: true }));
  assert.ok(ok(await call('GET', '/api/decor/tasks', U.cashier)).some(x => x.id === t.id));
  ok(await call('PUT', '/api/decor/permissions', U.founder, { position: 'cashier', action: 'accept_tasks', allowed: false }));
  assert.equal((await call('POST', '/api/decor/tasks', U.founder, { title: '', assignee_id: E.pmUser })).data.code, 'task_title');
  assert.equal((await call('POST', '/api/decor/tasks', U.founder, { title: 'Чужому', assignee_id: E.founderUser + 1000 })).status, 400);
});

// ---------------------------------------------------------------- Стандарты работ
test('стандарты: создаёт учредитель (пустым), шаги копируются в заказ; бригада отмечает по порядку, «нужно фото» без фото — нельзя; изменение стандарта не меняет чек-лист', async () => {
  assert.equal((await call('POST', '/api/decor/standards', U.pm, { name: 'Вход' })).status, 403);
  const st = ok(await call('POST', '/api/decor/standards', U.founder, { name: 'Вход' }));
  assert.deepEqual(st.steps, []);
  const order = ok(await call('POST', '/api/decor/orders', U.founder, { client: 'Бригада', event_date: F.addDays(T, 3), status: 'design', team: [E.pmEmp] }));
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/works`, U.pm, { standard_id: st.id })).data.code, 'standard_empty');

  const sample = ok(await call('POST', `/api/decor/standards/${st.id}/sample`, U.founder, photo('sample.png')));
  const filled = ok(await call('PUT', `/api/decor/standards/${st.id}`, U.founder, { steps: [
    { text: 'Поставить каркас арки' }, { text: 'Натянуть ткань', photo_required: true, sample_photo: sample.file_id }, { text: 'Закрепить цветы' }] }));
  assert.deepEqual(filled.steps.map(s => [s.position, s.photo_required]), [[1, false], [2, true], [3, false]]);
  assert.equal(filled.steps[1].sample_photo, sample.file_id);
  assert.equal((await call('PUT', `/api/decor/standards/${st.id}`, U.founder, { steps: [{ text: 'X', sample_photo: 999999 }] })).data.code, 'step_sample');

  assert.equal((await call('POST', `/api/decor/orders/${order.id}/works`, U.keeper, { standard_id: st.id })).data.code, 'works_forbidden');
  let w = ok(await call('POST', `/api/decor/orders/${order.id}/works`, U.pm, { standard_id: st.id }));
  assert.equal(w.total, 3); assert.equal(w.can_mark, true);
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/works`, U.pm, { standard_id: st.id })).status, 409, 'одна работа — один раз');
  const [s1, s2, s3] = w.works[0].steps;
  assert.equal(s2.sample_photo, sample.file_id);

  assert.equal((await call('POST', `/api/decor/orders/${order.id}/steps/${s1.id}/done`, U.trainee, {})).data.code, 'step_forbidden', 'ученик не в команде заказа');
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/done`, U.pm, {})).data.code, 'step_order');
  w = ok(await call('POST', `/api/decor/orders/${order.id}/steps/${s1.id}/done`, U.pm, {}));
  assert.equal(w.done, 1); assert.equal(w.works[0].steps[0].done_by.id, E.pmUser);
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/done`, U.pm, {})).data.code, 'step_photo');
  w = ok(await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/done`, U.pm, photo()));
  assert.equal(w.done, 2); assert.equal(w.works[0].steps[1].files.length, 1); assert.ok(w.works[0].steps[1].photo);

  // учредитель меняет стандарт — начатый чек-лист прежний
  ok(await call('PUT', `/api/decor/standards/${st.id}`, U.founder, { steps: [{ text: 'Совсем другой шаг' }] }));
  w = ok(await call('GET', `/api/decor/orders/${order.id}/works`, U.pm));
  assert.deepEqual(w.works[0].steps.map(s => s.text), ['Поставить каркас арки', 'Натянуть ткань', 'Закрепить цветы']);

  // снять отметку: только последний и только тот, кто отметил (или учредитель)
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/undo`, U.cashier, {})).data.code, 'step_forbidden');
  assert.equal((await call('POST', `/api/decor/orders/${order.id}/steps/${s1.id}/undo`, U.pm, {})).data.code, 'step_not_last');
  w = ok(await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/undo`, U.pm, {}));
  assert.equal(w.done, 1); assert.equal(w.works[0].steps[1].files.length, 0);
  assert.equal((await call('DELETE', `/api/decor/orders/${order.id}/works/${w.works[0].id}`, U.pm)).data.code, 'work_started');

  // повтор отметки с тем же ключом — первый ответ, без «шаг уже отмечен»
  ok(await call('POST', `/api/decor/orders/${order.id}/steps/${s2.id}/done`, U.pm, photo()));
  const key = crypto.randomUUID();
  ok(await call('POST', `/api/decor/orders/${order.id}/steps/${s3.id}/done`, U.pm, {}, key));
  const again = await call('POST', `/api/decor/orders/${order.id}/steps/${s3.id}/done`, U.pm, {}, key);
  assert.equal(again.status, 200); assert.equal(again.replay, 'true'); assert.equal(again.data.done, 3);
  assert.equal((await call('GET', `/api/decor/orders/${order.id}/works`, U.other)).status, 404, 'чужая компания чек-лист не видит');
});

test('удаление компании целиком проходит и с клиентами, задачами, стандартами и чек-листами', async () => {
  await stack.pool.query('DELETE FROM companies WHERE id=$1', [C.main]);
  for (const t of ['decor_clients', 'decor_tasks', 'decor_standards', 'decor_order_step_done', 'decor_values']) {
    const { rows: [{ n }] } = await stack.pool.query(`SELECT count(*)::int n FROM ${t} WHERE company_id=$1`, [C.main]);
    assert.equal(n, 0, t);
  }
});
