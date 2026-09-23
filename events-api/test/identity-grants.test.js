'use strict';

// Права роли events_identity из sql/setup-prod.sql — на точной схеме прода.
//
// Две вещи, которые нельзя оставлять на честное слово:
//   1. Сервису хватает выданных столбцов: каждый его запрос к учёткам проходит.
//      Забудь в GRANT хоть один столбец — на проде сервис упадёт с
//      «permission denied» на первом же входе.
//   2. Сервис не может прочитать ничего сверх этого: ни хэшей паролей, ни
//      продаж и кассы Wave, ни изменить учётки. Это то самое «не имеет
//      отношения к Wave» — обеспеченное базой, а не кодом.
//
// Права берутся из самого файла setup-prod.sql (между метками), а не копией в
// тесте — иначе тест проверял бы не то, что выполнится на сервере.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const { loadProdSchema } = require('./support/wave-backend');
const { fromPglite, PARSERS } = require('../src/db');
const { migrate } = require('../src/schema');
const { createApp } = require('../src/app');

const JWT_SECRET = 'grants-test-secret-long-enough-xyz';
const SETUP = fs.readFileSync(path.join(__dirname, '..', 'sql', 'setup-prod.sql'), 'utf8');

function grantStatements() {
  const block = SETUP.split('-- IDENTITY-GRANTS-BEGIN')[1].split('-- IDENTITY-GRANTS-END')[0];
  return block.split(';').map((s) => s.trim()).filter(Boolean)
    // В PGlite одна база — postgres; на сервере она называется warehouse.
    .map((s) => s.replace('ON DATABASE warehouse', 'ON DATABASE postgres'));
}

let warehouse;   // PGlite со схемой прода; после настройки работает под events_identity
let server;
let base;
let eventsDb;

test.before(async () => {
  warehouse = new PGlite({ parsers: PARSERS });
  await warehouse.exec(loadProdSchema());
  // То, что делает миграция Wave перед запуском setup-prod.sql: столбец
  // продукта и список ролей обоих продуктов (роли — из backend/products.js).
  const products = require(path.join(__dirname, '..', '..', 'backend', 'products.js'));
  const roles = [...new Set(['admin', ...products.WAVE_ROLES, ...products.EVENTS_ROLES])].map((r) => `'${r}'`).join(', ');
  await warehouse.exec(`ALTER TABLE companies ADD COLUMN product TEXT NOT NULL DEFAULT 'wave'`);
  await warehouse.exec(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check,
                          ADD CONSTRAINT users_role_check CHECK (role IN (${roles}))`);
  await warehouse.exec(`
    INSERT INTO companies (id, name, product) VALUES (50, 'Декор Азия', 'events');
    INSERT INTO branches (id, name, company_id) VALUES (500, 'Ташкент', 50);
    INSERT INTO users (id, username, password_hash, role, company_id, branch_id, session_id, first_name)
      VALUES (900, 'founder', 'СЕКРЕТНЫЙ-ХЭШ', 'founder', 50, NULL, 's900', 'Азиз'),
             (901, 'decor', 'СЕКРЕТНЫЙ-ХЭШ', 'decorator', 50, 500, 's901', 'Малика');
  `);

  await warehouse.exec('CREATE ROLE events_identity LOGIN');
  for (const stmt of grantStatements()) await warehouse.exec(stmt);
  await warehouse.exec('SET ROLE events_identity');

  eventsDb = fromPglite(new PGlite({ parsers: PARSERS }));
  await migrate(eventsDb, () => {});
  const app = createApp({ db: eventsDb, identity: fromPglite(warehouse), jwtSecret: JWT_SECRET });
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (eventsDb) await eventsDb.end();
  if (warehouse) await warehouse.close();
});

const token = jwt.sign({ id: 900, username: 'founder', role: 'founder', company_id: 50, branch_id: null, sid: 's900', product: 'events' }, JWT_SECRET);
async function call(method, url, body) {
  const r = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

test('в setup-prod.sql найдены права роли учёток', () => {
  const stmts = grantStatements();
  assert.ok(stmts.length >= 4, stmts.join('\n'));
  assert.ok(stmts.every((s) => /^GRANT /.test(s)), 'в блоке прав только GRANT');
  assert.ok(!stmts.some((s) => /password_hash|ALL PRIVILEGES|INSERT|UPDATE|DELETE/i.test(s)), 'никаких лишних прав');
});

// ── 1. Сервису хватает выданного ────────────────────────────────────────────

test('вход под урезанной ролью работает', async () => {
  const r = await call('GET', '/api/events/me');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.company_name, 'Декор Азия');
});

test('списки сотрудников и филиалов работают', async () => {
  assert.equal((await call('GET', '/api/events/staff')).status, 200);
  const br = await call('GET', '/api/events/branches');
  assert.equal(br.status, 200);
  assert.deepEqual(br.body.items, [{ id: 500, name: 'Ташкент' }]);
});

test('заказ с филиалом и бригадой — все проверки учёток проходят', async () => {
  const created = await call('POST', '/api/events/events', {
    title: 'Свадьба', starts_at: '2026-12-20T18:00', total_price: 1000, branch_id: 500,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const crew = await call('POST', `/api/events/events/${created.body.event.id}/crew`, { user_id: 901 });
  assert.equal(crew.status, 200, JSON.stringify(crew.body));
});

// ── 2. Сверх выданного — ничего ─────────────────────────────────────────────

async function denied(sql) {
  try {
    await warehouse.query(sql);
    return false;
  } catch (e) {
    return /permission denied/.test(e.message);
  }
}

test('хэш пароля недоступен', async () => {
  assert.ok(await denied('SELECT password_hash FROM users'));
  assert.ok(await denied('SELECT * FROM users'), 'SELECT * тоже закрыт — он зацепил бы хэш');
});

test('данные Wave недоступны: продажи, приходы, касса, товары', async () => {
  for (const table of ['stock_outcome', 'stock_income', 'cash_income', 'cash_expense', 'products']) {
    assert.ok(await denied(`SELECT * FROM ${table} LIMIT 1`), `${table} должен быть закрыт`);
  }
});

test('лишние столбцы компании недоступны', async () => {
  assert.ok(await denied('SELECT disabled_tools FROM companies'));
  assert.ok(await denied('SELECT hr_criteria FROM companies'));
});

test('учётки нельзя менять — ни роль, ни блокировку', async () => {
  assert.ok(await denied(`UPDATE users SET role = 'admin' WHERE id = 900`));
  assert.ok(await denied(`UPDATE users SET is_blocked = false`));
  assert.ok(await denied(`DELETE FROM users`));
  assert.ok(await denied(`INSERT INTO companies (name) VALUES ('x')`));
});
