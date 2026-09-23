'use strict';

// Тестовый стенд: две настоящие базы PostgreSQL (PGlite) — «мероприятия» и
// «учётки» — и приложение, поднятое на свободном порту. Запросы идут по HTTP,
// как от браузера: проверяется весь путь, включая вход и границы доступа.

const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const { fromPglite, PARSERS } = require('../src/db');
const { migrate } = require('../src/schema');
const { createApp } = require('../src/app');

const JWT_SECRET = 'test-secret-that-is-long-enough-for-checks';

// Столбцы повторяют настоящие таблицы warehouse ровно в той части, которую
// сервису разрешено читать (см. sql/setup-prod.sql).
const IDENTITY_SCHEMA = `
  CREATE TABLE companies (id INT PRIMARY KEY, name TEXT NOT NULL, is_enabled BOOLEAN DEFAULT true,
                          product TEXT NOT NULL DEFAULT 'wave', logo_url TEXT);
  CREATE TABLE branches  (id INT PRIMARY KEY, name TEXT NOT NULL, company_id INT NOT NULL);
  CREATE TABLE users     (id INT PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL,
                          company_id INT, branch_id INT, session_id TEXT, is_blocked BOOLEAN DEFAULT false,
                          first_name TEXT, last_name TEXT)
`;

// Компании: 2 — наша компания мероприятий, 3 — ЧУЖАЯ компания мероприятий,
// 1 — компания Wave, 4 — приостановленная компания мероприятий.
const SEED = `
  INSERT INTO companies (id, name, is_enabled, product) VALUES
    (1, 'Магазин Wave', true, 'wave'),
    (2, 'Декор Азия', true, 'events'),
    (3, 'Чужой декор', true, 'events'),
    (4, 'Спящий декор', false, 'events');
  INSERT INTO branches (id, name, company_id) VALUES
    (21, 'Ташкент', 2), (22, 'Самарканд', 2), (31, 'Бухара', 3);
  INSERT INTO users (id, username, role, company_id, branch_id, session_id, is_blocked, first_name, last_name) VALUES
    (1,  'wowadmin',  'admin',           NULL, NULL, 's1',  false, 'Админ', 'WoW'),
    (10, 'founder',   'founder',         2,    NULL, 's10', false, 'Азиз',  'Каримов'),
    (11, 'pm',        'project_manager', 2,    NULL, 's11', false, 'Нилуфар', 'Юсупова'),
    (12, 'coord',     'coordinator',     2,    21,   's12', false, 'Дилшод', 'Рахимов'),
    (13, 'decor',     'decorator',       2,    21,   's13', false, 'Малика', NULL),
    (14, 'flor',      'florist',         2,    21,   's14', false, 'Севара', NULL),
    (15, 'inst',      'installer',       2,    21,   's15', false, 'Тимур', NULL),
    (16, 'blocked',   'decorator',       2,    21,   's16', true,  'Блок', NULL),
    (17, 'coord2',    'coordinator',     2,    22,   's17', false, 'Отабек', NULL),
    (20, 'rival',     'founder',         3,    NULL, 's20', false, 'Чужой', 'Учредитель'),
    (25, 'sleepy',    'founder',         4,    NULL, 's25', false, 'Спящий', NULL),
    (30, 'wavefound', 'founder',         1,    NULL, 's30', false, 'Wave', 'Owner'),
    (31, 'wavecash',  'cashier',         2,    21,   's31', false, 'Кассир', 'Не отсюда')
`;

async function exec(q, sql) {
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
}

async function createTestEnv() {
  const eventsPg = new PGlite({ parsers: PARSERS });
  const identityPg = new PGlite({ parsers: PARSERS });
  const db = fromPglite(eventsPg);
  const identity = fromPglite(identityPg);
  await migrate(db, () => {});
  await exec(identity, IDENTITY_SCHEMA);
  await exec(identity, SEED);

  const app = createApp({ db, identity, jwtSecret: JWT_SECRET });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  // Токен как у общего входа Wave: id, роль, компания, филиал, sid, продукт.
  async function token(userId, overrides = {}) {
    const { rows: [u] } = await identity.query(
      'SELECT id, username, role, company_id, branch_id, session_id FROM users WHERE id = $1', [userId]);
    const { rows: [c] } = u.company_id
      ? await identity.query('SELECT product FROM companies WHERE id = $1', [u.company_id])
      : { rows: [{ product: null }] };
    return jwt.sign({
      id: u.id, username: u.username, role: u.role,
      company_id: u.company_id, branch_id: u.branch_id,
      sid: u.session_id, product: c ? c.product : null,
      ...overrides,
    }, JWT_SECRET);
  }

  async function request(method, path, { token: tok, body, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json };
  }

  // Короткие обёртки: as(10).get('/api/events/me')
  function as(userId, overrides) {
    let cached;
    const tok = async () => (cached ||= await token(userId, overrides));
    const call = (m) => async (path, body) => request(m, path, { token: await tok(), body });
    return { get: call('GET'), post: call('POST'), put: call('PUT'), del: call('DELETE') };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([db.end(), identity.end()]);
  }

  return { db, identity, base, token, request, as, close, JWT_SECRET };
}

// Базовое мероприятие для тестов: завтра в 18:00 по Ташкенту.
function sampleEvent(overrides = {}) {
  const d = new Date(Date.now() + 10 * 86400000);
  const day = d.toISOString().slice(0, 10);
  return {
    title: 'Свадьба Азиз и Нилуфар',
    event_type: 'Свадьба',
    starts_at: `${day}T18:00`,
    venue: 'Ресторан «Бахор»',
    total_price: 24500000,
    client: { name: 'Азиз', phone: '+998 90 000 00 00' },
    ...overrides,
  };
}

module.exports = { createTestEnv, sampleEvent, JWT_SECRET };
