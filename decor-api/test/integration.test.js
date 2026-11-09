'use strict';

// Стыковка «Декора» с отдельным сервисом: миграции D00–D24 на настоящем PostgreSQL,
// создание компании скриптом, вход, чужие токены, обязательный ключ повтора, полномочия
// должностей, загрузка фото через multer и отдача файла только своей компании.
// Формулы и путь заказа проверяют тесты самой сферы (decor_formulas / decor_api / decor_path).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { startStack } = require('./support/stack');
const { createCompany } = require('../scripts/create-company');

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const SVG_WITH_SCRIPT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

let stack;
const key = () => crypto.randomUUID();

async function call(method, url, { token, body, idem, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idem) headers['Idempotency-Key'] = idem;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(stack.base + url, { method, headers, body: payload });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

async function login(username, password) {
  const r = await call('POST', '/api/decor/auth/login', { body: { username, password } });
  assert.equal(r.status, 200, `вход ${username}: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

const count = async (sql, params = []) => Number((await stack.pool.query(sql, params)).rows[0].n);

test.before(async () => { stack = await startStack(); });
test.after(async () => { await stack?.stop(); });

test('миграции D00–D24 применяются на PostgreSQL 16 по списку из apply_decor_migrations.sh', async () => {
  assert.deepEqual(stack.migrations, ['D00_core_contract.sql', 'D10_decor_domain.sql', 'D20_late_return.sql',
    'D21_returned_after_close.sql', 'D22_company_delete.sql', 'D23_idempotency.sql', 'D24_evidence_fund.sql', 'D25_stock_journal.sql', 'D26_designs.sql']);
  const r = await call('GET', '/api/decor/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'ok');
  for (const v of ['D00_core_contract', 'D10_decor_domain', 'D23_idempotency', 'D24_evidence_fund']) {
    assert.ok(r.data.migrations.includes(v), `нет ${v} в schema_migrations`);
  }
});

let founder;        // { companyId, username, password }
let founderToken;

test('create-company: компания, филиал, учредитель и начальные данные — одной транзакцией', async () => {
  founder = await createCompany(stack.pool, { company: 'Dora Decor', username: 'dora_founder', name: 'Дора Каримова' });
  assert.match(founder.password, /^[a-zA-HJ-NP-Z2-9]{12}$/);
  const cid = founder.companyId;
  assert.equal(await count('SELECT count(*) n FROM branches WHERE company_id=$1', [cid]), 1);
  assert.equal(await count("SELECT count(*) n FROM users WHERE company_id=$1 AND role='founder'", [cid]), 1);
  assert.equal(await count('SELECT count(*) n FROM decor_permissions WHERE company_id=$1', [cid]), 33, '3 должности × 11 действий');
  assert.equal(await count('SELECT count(*) n FROM company_features WHERE company_id=$1 AND enabled', [cid]), 6);
  assert.equal(await count('SELECT count(*) n FROM decor_settings WHERE company_id=$1', [cid]), 1);
  assert.equal(await count('SELECT count(*) n FROM decor_evidence_rules WHERE company_id=$1', [cid]), 6);
  const { rows: [u] } = await stack.pool.query('SELECT password_hash FROM users WHERE username=$1', ['dora_founder']);
  assert.ok(u.password_hash.startsWith('$2'), 'в базе хэш bcrypt, а не пароль');
});

test('create-company: занятый логин — понятная ошибка и ни одной лишней компании', async () => {
  const before = await count('SELECT count(*) n FROM companies');
  await assert.rejects(createCompany(stack.pool, { company: 'Другая', username: 'dora_founder' }), /уже занят/);
  assert.equal(await count('SELECT count(*) n FROM companies'), before, 'транзакция откатилась целиком');
  await assert.rejects(createCompany(stack.pool, { company: 'X', username: 'плохой логин' }), /латиница/);
});

test('вход учредителя и «кто я»', async () => {
  const bad = await call('POST', '/api/decor/auth/login', { body: { username: 'dora_founder', password: 'wrong' } });
  assert.equal(bad.status, 401);
  founderToken = await login('dora_founder', founder.password);
  const claims = jwt.decode(founderToken);
  assert.equal(claims.sphere, 'decor');
  assert.equal(claims.company_id, founder.companyId);
  const me = await call('GET', '/api/decor/auth/me', { token: founderToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.company_name, 'Dora Decor');
  assert.equal(me.data.is_owner, true);
  assert.equal(me.data.permissions.length, 11);
});

test('чужие токены не проходят: без токена, токен Wave (другой секрет), без сферы, другой сферы', async () => {
  const claims = { id: 1, username: 'dora_founder', role: 'founder', company_id: founder.companyId };
  const cases = {
    'без токена': undefined,
    'токен Wave': jwt.sign({ ...claims, sphere: 'decor' }, 'wave-secret-is-different-from-decor-secret-xx'),
    'без поля sphere': jwt.sign(claims, stack.jwtSecret),
    'сфера education': jwt.sign({ ...claims, sphere: 'education' }, stack.jwtSecret),
    'мусор': 'not-a-jwt',
  };
  for (const [name, token] of Object.entries(cases)) {
    const r = await call('GET', '/api/decor/auth/me', { token });
    assert.equal(r.status, 401, `${name}: ${r.status} ${JSON.stringify(r.data)}`);
  }
});

test('ключ повтора обязателен; повтор не создаёт дубль; тот же ключ с другим телом — 409', async () => {
  const item = { name: 'Арка белая', qty_bought: 4, price_usd: 120, resource_orders: 20 };
  const noKey = await call('POST', '/api/decor/items', { token: founderToken, body: item });
  assert.equal(noKey.status, 400);
  assert.equal(noKey.data.code, 'idem_missing');
  assert.equal(await count('SELECT count(*) n FROM decor_items'), 0, 'без ключа ничего не записано');

  const k = key();
  const first = await call('POST', '/api/decor/items', { token: founderToken, body: item, idem: k });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const again = await call('POST', '/api/decor/items', { token: founderToken, body: item, idem: k });
  assert.equal(again.status, 200);
  assert.equal(again.headers.get('idempotent-replay'), 'true');
  assert.equal(await count('SELECT count(*) n FROM decor_items'), 1, 'повтор не создал вторую вещь');

  const other = await call('POST', '/api/decor/items', { token: founderToken, body: { ...item, price_usd: 121 }, idem: k });
  assert.equal(other.status, 409);
  assert.equal(other.data.code, 'idem_mismatch');
});

async function hire(level, username, password) {
  const e = await call('POST', '/api/decor/employees', { token: founderToken, body: { name: username, level }, idem: key() });
  assert.equal(e.status, 200, JSON.stringify(e.data));
  const l = await call('POST', `/api/decor/employees/${e.data.id}/login`, { token: founderToken, body: { username, password }, idem: key() });
  assert.equal(l.status, 200, JSON.stringify(l.data));
  return { employeeId: e.data.id, userId: l.data.user_id, role: l.data.role, token: await login(username, password) };
}

let cashier;
let pm;

test('полномочия должностей проверяет сервер: кассир не видит себестоимость, но видит кассу', async () => {
  cashier = await hire('cashier', 'kassa1', 'kassa-pass-1');
  assert.equal(cashier.role, 'cashier');
  const costs = await call('GET', '/api/decor/finance/costs', { token: cashier.token });
  assert.equal(costs.status, 403);
  assert.equal(costs.data.code, 'no_permission');
  const money = await call('GET', '/api/decor/money', { token: cashier.token });
  assert.equal(money.status, 200, JSON.stringify(money.data));
  const items = await call('POST', '/api/decor/items', { token: cashier.token, body: { name: 'Ваза' }, idem: key() });
  assert.equal(items.status, 403, 'кассир не меняет склад');
});

test('фото отчёта: принимается PNG, SVG отклоняется, файл лежит вне публичных папок и отдаётся по токену', async () => {
  pm = await hire('pm', 'pm1', 'pm-pass-1');
  const order = await call('POST', '/api/decor/orders', {
    token: founderToken, idem: key(),
    body: { client: 'Дилфуза', event_date: '2026-11-20', status: 'design', team: [pm.employeeId] },
  });
  assert.equal(order.status, 200, JSON.stringify(order.data));
  const orderId = order.data.id ?? order.data.order?.id;
  assert.ok(orderId, `нет id заказа в ответе: ${JSON.stringify(order.data).slice(0, 200)}`);

  const svgForm = new FormData();
  svgForm.append('stage', 'install');
  svgForm.append('files', new Blob([SVG_WITH_SCRIPT], { type: 'image/svg+xml' }), 'photo.svg');
  const svg = await call('POST', `/api/decor/orders/${orderId}/reports`, { token: pm.token, form: svgForm, idem: key() });
  assert.equal(svg.status, 400, `SVG должен отклоняться: ${JSON.stringify(svg.data)}`);
  assert.equal(svg.data.code, 'bad_type');

  const form = new FormData();
  form.append('stage', 'install');
  form.append('files', new Blob([PNG_1x1], { type: 'image/png' }), 'монтаж.png');
  const rep = await call('POST', `/api/decor/orders/${orderId}/reports`, { token: pm.token, form, idem: key() });
  assert.equal(rep.status, 200, JSON.stringify(rep.data));

  const { rows: [f] } = await stack.pool.query('SELECT id, file_name, original_name FROM decor_report_files ORDER BY id DESC LIMIT 1');
  assert.equal(f.original_name, 'монтаж.png', 'кириллица в имени файла сохранилась');
  const onDisk = path.join(stack.uploadsDir, String(founder.companyId), f.file_name);
  assert.ok(fs.existsSync(onDisk), 'файл в папке DECOR_UPLOADS_DIR/<компания>');

  const got = await call('GET', `/api/decor/files/${f.id}`, { token: founderToken });
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/png');
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.compare(got.data, PNG_1x1) === 0, 'отдан тот же файл');
  const anon = await call('GET', `/api/decor/files/${f.id}`);
  assert.equal(anon.status, 401, 'без входа файл не отдаётся');
});

test('файл чужой компании не отдаётся', async () => {
  const other = await createCompany(stack.pool, { company: 'Другая студия', username: 'other_founder' });
  const token = await login('other_founder', other.password);
  const { rows: [f] } = await stack.pool.query('SELECT id FROM decor_report_files ORDER BY id DESC LIMIT 1');
  const r = await call('GET', `/api/decor/files/${f.id}`, { token });
  assert.equal(r.status, 404);
  const orders = await call('GET', '/api/decor/orders', { token });
  assert.equal(orders.status, 200);
  assert.equal(JSON.stringify(orders.data).includes('Дилфуза'), false, 'заказы другой компании не видны');
});

test('reset-password: старый пароль перестаёт подходить, новый — подходит', async () => {
  const { resetPassword } = require('../scripts/reset-password');
  const r = await resetPassword(stack.pool, { username: 'dora_founder' });
  assert.notEqual(r.password, founder.password);
  const old = await call('POST', '/api/decor/auth/login', { body: { username: 'dora_founder', password: founder.password } });
  assert.equal(old.status, 401);
  await login('dora_founder', r.password);
  await assert.rejects(resetPassword(stack.pool, { username: 'nobody' }), /не найден/);
  founder.password = r.password;
});

test('create-staff: ученик и ПМ со входом — как через «Команду»', async () => {
  const { createStaff, ROLE_BY_LEVEL } = require('../scripts/create-staff');
  const staffSrc = fs.readFileSync(path.join(__dirname, '..', 'decor', 'staff.js'), 'utf8');
  for (const [level, role] of Object.entries(ROLE_BY_LEVEL)) {
    assert.match(staffSrc, new RegExp(`${level}: '${role}'`), `уровень ${level} → ${role} как в decor/staff.js`);
  }
  const trainee = await createStaff(stack.pool, { founder: 'dora_founder', level: 'trainee', username: 'dora_uchenik', name: 'Ученик Тест' });
  const manager = await createStaff(stack.pool, { founder: 'dora_founder', level: 'pm', username: 'dora_menejer' });
  assert.equal(trainee.role, 'pm');
  assert.equal(manager.role, 'pm');
  assert.equal(trainee.companyId, founder.companyId);

  const tToken = await login('dora_uchenik', trainee.password);
  const me = await call('GET', '/api/decor/auth/me', { token: tToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.employee.level, 'trainee', 'вход привязан к сотруднику-ученику');
  assert.deepEqual([...me.data.permissions].sort(), ['change_status', 'take_money', 'upload_report']);
  const team = await call('GET', '/api/decor/employees', { token: founderToken });
  const names = team.data.filter(e => e.has_login).map(e => e.username);
  assert.ok(names.includes('dora_uchenik') && names.includes('dora_menejer'), 'оба видны учредителю в «Команде»');

  await assert.rejects(createStaff(stack.pool, { founder: 'dora_founder', level: 'pm', username: 'dora_menejer' }), /уже занят/);
  await assert.rejects(createStaff(stack.pool, { founder: 'nobody', level: 'pm', username: 'x_pm1' }), /не найден/);
  await assert.rejects(createStaff(stack.pool, { founder: 'dora_founder', level: 'manager', username: 'x_pm2' }), /--level/);
});

test('заблокированный сотрудник теряет доступ сразу, даже с действующим токеном', async () => {
  await stack.pool.query('UPDATE users SET is_blocked=true WHERE id=$1', [cashier.userId]);
  const r = await call('GET', '/api/decor/auth/me', { token: cashier.token });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'blocked');
});
