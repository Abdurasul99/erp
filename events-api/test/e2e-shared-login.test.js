'use strict';

// Сквозная проверка общего входа — на НАСТОЯЩЕМ backend/server.js Wave и
// точной схеме базы прода.
//
// Сценарий целиком, как в жизни: админ WoW заводит компанию мероприятий через
// админку Wave → её учредитель входит через общую страницу входа → попадает в
// сервис мероприятий, но не в Wave. И обратно: учётка Wave в мероприятия не
// проходит. Заодно проверяется, что миграции Wave встают на схему прода.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const { startWaveBackend } = require('./support/wave-backend');
const { fromPglite, PARSERS } = require('../src/db');
const { migrate } = require('../src/schema');
const { createApp } = require('../src/app');

// bcrypt — тот же пакет, что у Wave: хэш должен приниматься его логином.
const bcrypt = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'bcryptjs'));

const JWT_SECRET = 'e2e-shared-secret-long-enough-for-both';
const PASSWORD = 'Passw0rd123';

let wave;
let eventsBase;
let eventsServer;
let eventsDb;

async function call(base, method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

const onWave = (method, url, opts) => call(wave.base, method, url, opts);
const onEvents = (method, url, opts) => call(eventsBase, method, url, opts);

async function login(username, password = PASSWORD) {
  const r = await onWave('POST', '/api/auth/login', { body: { username, password } });
  assert.equal(r.status, 200, `вход ${username}: ${JSON.stringify(r.body)}`);
  return r.body;
}

let admin;          // сессия админа WoW
let eventsCompany;  // компания мероприятий, созданная через админку

test.before(async () => {
  wave = await startWaveBackend({ jwtSecret: JWT_SECRET });

  // Учётки, которые на проде уже есть: админ WoW и компания Wave с учредителем.
  const hash = await bcrypt.hash(PASSWORD, 10);
  await wave.db.query(`INSERT INTO users (username, password_hash, role) VALUES ('wowadmin', $1, 'admin')`, [hash]);
  const { rows: [shop] } = await wave.db.query(`INSERT INTO companies (name) VALUES ('Магазин Wave') RETURNING id`);
  await wave.db.query(
    `INSERT INTO users (username, password_hash, role, company_id, first_name) VALUES ('wavefounder', $1, 'founder', $2, 'Владелец')`,
    [hash, shop.id]);

  // Сервис мероприятий: своя база, учётки — та же база, что у Wave.
  const eventsPg = new PGlite({ parsers: PARSERS });
  eventsDb = fromPglite(eventsPg);
  await migrate(eventsDb, () => {});
  const app = createApp({ db: eventsDb, identity: fromPglite(wave.db), jwtSecret: JWT_SECRET });
  eventsServer = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  eventsBase = `http://127.0.0.1:${eventsServer.address().port}`;

  admin = await login('wowadmin');
});

test.after(async () => {
  if (eventsServer) await new Promise((resolve) => eventsServer.close(resolve));
  if (eventsDb) await eventsDb.end();
  if (wave) await wave.stop();
});

// ── Миграции Wave на схеме прода ────────────────────────────────────────────

test('на схеме прода миграции Wave создают продукт и расширяют роли', async () => {
  const { rows: col } = await wave.db.query(
    `SELECT column_default FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'product'`);
  assert.equal(col.length, 1, 'столбец companies.product должен появиться');
  const { rows: [chk] } = await wave.db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'users_role_check'`);
  for (const role of ['project_manager', 'coordinator', 'decorator', 'florist', 'installer', 'founder', 'cashier']) {
    assert.ok(chk.def.includes(`'${role}'`), `роль ${role} должна проходить ограничение`);
  }
  assert.equal(/ВНИМАНИЕ/.test(wave.output()), false, `предупреждения при старте:\n${wave.output()}`);
});

test('существующие компании после миграции остаются в Wave', async () => {
  const { rows } = await wave.db.query(`SELECT product FROM companies WHERE name = 'Магазин Wave'`);
  assert.equal(rows[0].product, 'wave');
});

// ── Админка заводит компанию мероприятий ────────────────────────────────────

test('админ создаёт компанию мероприятий через админку Wave', async () => {
  const r = await onWave('POST', '/api/companies', {
    token: admin.token,
    body: {
      name: 'Декор Азия', product: 'events',
      founder_first_name: 'Азиз', founder_last_name: 'Каримов',
      director_username: 'decorfounder', director_password: PASSWORD,
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.product, 'events');
  assert.deepEqual(r.body.disabled_tools, [], 'наборы экранов Wave компании мероприятий не нужны');
  eventsCompany = r.body;
});

test('неизвестный продукт компании отвергается', async () => {
  const r = await onWave('POST', '/api/companies', {
    token: admin.token,
    body: { name: 'X', product: 'crm', founder_first_name: 'X', director_username: 'x-founder', director_password: PASSWORD },
  });
  assert.equal(r.status, 400);
});

// ── Общий вход ──────────────────────────────────────────────────────────────

test('учредитель мероприятий входит через общую страницу и получает продукт events', async () => {
  const s = await login('decorfounder');
  assert.equal(s.user.product, 'events');
  assert.equal(s.user.role, 'founder');
  assert.equal(jwt.decode(s.token).product, 'events', 'продукт обязан быть в подписанном токене');
});

test('профиль при перезагрузке страницы работает и для мероприятий', async () => {
  const s = await login('decorfounder');
  const me = await onWave('GET', '/api/auth/me', { token: s.token });
  assert.equal(me.status, 200, 'иначе пользователя выкидывало бы при каждом обновлении страницы');
  assert.equal(me.body.user.product, 'events');
});

test('учётка мероприятий не открывает ни одного экрана Wave', async () => {
  const s = await login('decorfounder');
  for (const url of ['/api/company/dashboard', '/api/users', '/api/sales/history', '/api/companies', '/api/cash/report']) {
    const r = await onWave('GET', url, { token: s.token });
    assert.equal(r.status, 403, `${url}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.code, 'PRODUCT_MISMATCH', url);
  }
});

test('учётка мероприятий работает в сервисе мероприятий тем же токеном', async () => {
  const s = await login('decorfounder');
  const me = await onEvents('GET', '/api/events/me', { token: s.token });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.user.company_name, 'Декор Азия');
  assert.equal(me.body.user.role_label, 'Учредитель');

  const created = await onEvents('POST', '/api/events/events', {
    token: s.token,
    body: { title: 'Свадьба', starts_at: '2026-12-20T18:00', total_price: 24500000, client: { name: 'Азиз' } },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
});

test('учётка Wave в сервис мероприятий не проходит', async () => {
  const s = await login('wavefounder');
  assert.equal(s.user.product, 'wave');
  const r = await onEvents('GET', '/api/events/me', { token: s.token });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PRODUCT_MISMATCH');
  const me = await onWave('GET', '/api/auth/me', { token: s.token });
  assert.equal(me.status, 200);
});

test('токены Wave старого формата (без продукта) продолжают работать', async () => {
  // Выписаны до выкладки: выкладка не должна разлогинить всех клиентов Wave.
  const s = await login('wavefounder');
  const claims = jwt.decode(s.token);
  delete claims.product;
  delete claims.iat;
  delete claims.exp;
  const legacy = jwt.sign(claims, JWT_SECRET);
  const me = await onWave('GET', '/api/auth/me', { token: legacy });
  assert.equal(me.status, 200, JSON.stringify(me.body));
});

test('вход с другого устройства обрывает сессию и в сервисе мероприятий', async () => {
  const first = await login('decorfounder');
  await login('decorfounder');
  const r = await onEvents('GET', '/api/events/me', { token: first.token });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_REVOKED');
});

// ── Учётки мероприятий ведёт админ ──────────────────────────────────────────

test('роль Wave в компанию мероприятий не назначается', async () => {
  const r = await onWave('POST', '/api/users', {
    token: admin.token,
    body: { username: 'bad-cashier', password: PASSWORD, role: 'cashier', company_id: eventsCompany.id },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Мероприятия/);
});

test('роль мероприятий в компанию Wave не назначается', async () => {
  const { rows: [shop] } = await wave.db.query(`SELECT id FROM companies WHERE name = 'Магазин Wave'`);
  const r = await onWave('POST', '/api/users', {
    token: admin.token,
    body: { username: 'bad-decorator', password: PASSWORD, role: 'decorator', company_id: shop.id },
  });
  assert.equal(r.status, 400);
});

test('админ заводит декоратора — тот входит и видит только свои разделы', async () => {
  const created = await onWave('POST', '/api/users', {
    token: admin.token,
    body: { username: 'decorator1', password: PASSWORD, role: 'decorator', company_id: eventsCompany.id, first_name: 'Малика' },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const s = await login('decorator1');
  assert.equal(s.user.product, 'events');
  const me = await onEvents('GET', '/api/events/me', { token: s.token });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.screens, ['order', 'teams']);
});

test('перенести кассира Wave в компанию мероприятий нельзя', async () => {
  const { rows: [shop] } = await wave.db.query(`SELECT id FROM companies WHERE name = 'Магазин Wave'`);
  const created = await onWave('POST', '/api/users', {
    token: admin.token,
    body: { username: 'cashier1', password: PASSWORD, role: 'cashier', company_id: shop.id },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  // Роль не меняется, меняется компания — и пара «кассир + мероприятия» не сходится.
  const r = await onWave('PUT', `/api/users/${created.body.id}`, {
    token: admin.token,
    body: { role: 'cashier', company_id: eventsCompany.id },
  });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  const { rows: [after] } = await wave.db.query(`SELECT company_id FROM users WHERE id = $1`, [created.body.id]);
  assert.equal(after.company_id, shop.id, 'учётка осталась в своей компании');
});

test('заблокированная админом учётка теряет доступ к мероприятиям сразу', async () => {
  const s = await login('decorator1');
  const { rows: [u] } = await wave.db.query(`SELECT id FROM users WHERE username = 'decorator1'`);
  const block = await onWave('PUT', `/api/users/${u.id}/block`, { token: admin.token, body: { is_blocked: true } });
  assert.equal(block.status, 200, JSON.stringify(block.body));
  const r = await onEvents('GET', '/api/events/me', { token: s.token });
  assert.equal(r.status, 403);
});

// ── «Войти как» ─────────────────────────────────────────────────────────────

test('окно «войти как» предлагает роли продукта компании', async () => {
  const r = await onWave('GET', '/api/admin/impersonate/targets', { token: admin.token });
  assert.equal(r.status, 200);
  const decor = r.body.find((c) => c.id === eventsCompany.id);
  assert.equal(decor.product, 'events');
  assert.deepEqual(decor.roles, ['founder', 'project_manager', 'coordinator']);
  const shop = r.body.find((c) => c.name === 'Магазин Wave');
  assert.ok(shop.roles.includes('cashier'));
});

test('админ входит «как руководитель проектов» в компанию мероприятий', async () => {
  const r = await onWave('POST', '/api/admin/impersonate', {
    token: admin.token,
    body: { company_id: eventsCompany.id, role: 'project_manager' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.product, 'events');
  const me = await onEvents('GET', '/api/events/me', { token: r.body.token });
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.user.act_as, true);
  assert.equal(me.body.user.role, 'project_manager');
  // И этот же токен не открывает Wave.
  const dash = await onWave('GET', '/api/company/dashboard', { token: r.body.token });
  assert.equal(dash.status, 403);
});

test('«войти как» кассиром в компанию мероприятий нельзя', async () => {
  const r = await onWave('POST', '/api/admin/impersonate', {
    token: admin.token,
    body: { company_id: eventsCompany.id, role: 'cashier' },
  });
  assert.equal(r.status, 400);
});
