'use strict';

// Вход в сервис мероприятий: кого пускать, кого нет. Каждый случай — реальная
// попытка пройти не туда: токен Wave, подделанный продукт, чужая компания,
// заблокированная учётка, вход с другого устройства, «войти как» не админом.

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createTestEnv, JWT_SECRET } = require('./helpers');

let env;
test.before(async () => { env = await createTestEnv(); });
test.after(async () => { await env.close(); });

const ME = '/api/events/me';

test('без токена — 401', async () => {
  const r = await env.request('GET', ME);
  assert.equal(r.status, 401);
});

test('токен с чужой подписью — 401', async () => {
  const forged = jwt.sign({ id: 10, role: 'founder', company_id: 2, sid: 's10', product: 'events' }, 'другой-секрет-достаточной-длины');
  const r = await env.request('GET', ME, { token: forged });
  assert.equal(r.status, 401);
});

test('здоровье сервиса отвечает без входа', async () => {
  const r = await env.request('GET', '/api/events/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

test('учредитель компании мероприятий входит и видит все разделы', async () => {
  const r = await env.as(10).get(ME);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'founder');
  assert.equal(r.body.user.company_name, 'Декор Азия');
  assert.deepEqual(r.body.screens, ['dash', 'order', 'cal', 'wh', 'fin', 'teams', 'an', 'set']);
});

test('монтажнику доступны только склад и бригады — как в матрице макета', async () => {
  const r = await env.as(15).get(ME);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.screens, ['wh', 'teams']);
});

// ── Граница с Wave ──────────────────────────────────────────────────────────

test('токен Wave в сервис мероприятий не пускается', async () => {
  const r = await env.as(30).get(ME);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PRODUCT_MISMATCH');
});

test('подделанный продукт в токене не помогает: компания Wave по учёткам', async () => {
  // Подпись верная (секрет общий), но компания 1 — Wave. Спасает сверка с базой.
  const tok = await env.token(30, { product: 'events' });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PRODUCT_MISMATCH');
});

test('учётка с ролью Wave внутри компании мероприятий не входит', async () => {
  // Кассир (роль Wave), по ошибке привязанный к компании мероприятий.
  const r = await env.as(31).get(ME);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PRODUCT_MISMATCH');
});

test('токен без продукта (старого формата) не пускается', async () => {
  const tok = await env.token(10, { product: undefined });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 403);
});

// ── Учётка ──────────────────────────────────────────────────────────────────

test('заблокированная учётка — 403', async () => {
  const r = await env.as(16).get(ME);
  assert.equal(r.status, 403);
});

test('вход с другого устройства обрывает старую сессию — 401 SESSION_REVOKED', async () => {
  const tok = await env.token(11, { sid: 'старый-sid' });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_REVOKED');
});

test('токен без sid — 401 SESSION_STALE', async () => {
  const tok = await env.token(11, { sid: undefined });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_STALE');
});

test('учётку перевели в другую компанию — старый токен не открывает прежнюю', async () => {
  // Токен говорит «компания 2», а по учёткам пользователь 20 — в компании 3.
  const tok = await env.token(20, { company_id: 2 });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_STALE');
});

test('приостановленная компания — 403 COMPANY_DISABLED', async () => {
  const r = await env.as(25).get(ME);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'COMPANY_DISABLED');
});

test('роль берётся из учёток, а не из токена', async () => {
  // Токен утверждает «учредитель», но по учёткам это декоратор.
  const tok = await env.token(13, { role: 'founder' });
  const r = await env.request('GET', ME, { token: tok });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'decorator');
  assert.deepEqual(r.body.screens, ['order', 'teams']);
});

// ── «Войти как» ─────────────────────────────────────────────────────────────

function actAs(overrides) {
  return jwt.sign({
    id: 1, username: 'wowadmin', role: 'founder', company_id: 2, branch_id: null,
    act_as: true, imp_by: 1, imp_name: 'wowadmin', product: 'events', ...overrides,
  }, JWT_SECRET);
}

test('админ WoW входит «как учредитель» в компанию мероприятий', async () => {
  const r = await env.request('GET', ME, { token: actAs() });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.act_as, true);
  assert.equal(r.body.user.role, 'founder');
  assert.equal(r.body.user.impersonator_name, 'wowadmin');
});

test('«войти как» может выписать только админ', async () => {
  // Учредитель пытается выдать себя за «вход админа».
  const r = await env.request('GET', ME, { token: actAs({ id: 10, imp_by: 10 }) });
  assert.equal(r.status, 401);
});

test('«войти как» исполнителем недоступен — у админа нет своей бригады', async () => {
  const r = await env.request('GET', ME, { token: actAs({ role: 'decorator' }) });
  assert.equal(r.status, 403);
});

test('админ может зайти и в приостановленную компанию — как в Wave', async () => {
  const r = await env.request('GET', ME, { token: actAs({ company_id: 4 }) });
  assert.equal(r.status, 200);
});

test('«войти как» в компанию Wave через сервис мероприятий не работает', async () => {
  const r = await env.request('GET', ME, { token: actAs({ company_id: 1 }) });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'PRODUCT_MISMATCH');
});

test('неизвестный адрес внутри сервиса — 404 с текстом, а не HTML', async () => {
  const r = await env.as(10).get('/api/events/no-such-thing');
  assert.equal(r.status, 404);
  assert.match(r.body.error, /Нет такого адреса/);
});
