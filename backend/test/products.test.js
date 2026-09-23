// Правила двух продуктов на стороне Wave: граница API, роли, продукт в токене.
// Сквозной сценарий с настоящим сервером — в events-api/test/e2e-shared-login.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../products');

test('учётка мероприятий получает на API Wave только общий вход', () => {
  const ev = { product: 'events' };
  for (const path of ['/api/auth/login', '/api/auth/me', '/api/auth/change-password']) {
    assert.equal(p.productGate(path, ev), null, path);
  }
  for (const path of ['/api/company/dashboard', '/api/users', '/api/auth-bypass', '/api/authx/me']) {
    const denied = p.productGate(path, ev);
    assert.ok(denied, `${path} должен быть закрыт`);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'PRODUCT_MISMATCH');
  }
});

test('учётки Wave граница не трогает, в том числе токены старого формата', () => {
  assert.equal(p.productGate('/api/company/dashboard', { product: 'wave' }), null);
  assert.equal(p.productGate('/api/company/dashboard', {}), null, 'токен без продукта — это Wave');
  assert.equal(p.productGate('/api/company/dashboard', null), null);
});

test('не-API пути граница не трогает', () => {
  assert.equal(p.productGate('/uploads/photo.jpg', { product: 'events' }), null);
});

test('продукт компании: по умолчанию Wave, неизвестный — ошибка 400', () => {
  assert.equal(p.parseProduct(undefined), 'wave');
  assert.equal(p.parseProduct(''), 'wave');
  assert.equal(p.parseProduct('events'), 'events');
  assert.throws(() => p.parseProduct('crm'), (e) => e.statusCode === 400);
});

test('роль должна подходить продукту', () => {
  assert.equal(p.roleFitsProduct('cashier', 'wave'), true);
  assert.equal(p.roleFitsProduct('cashier', 'events'), false);
  assert.equal(p.roleFitsProduct('decorator', 'events'), true);
  assert.equal(p.roleFitsProduct('decorator', 'wave'), false);
  assert.equal(p.roleFitsProduct('founder', 'wave'), true);
  assert.equal(p.roleFitsProduct('founder', 'events'), true);
});

test('продукт в токене сверяется с базой', () => {
  assert.equal(p.tokenProductMismatch({ product: 'events' }, { product: 'events' }), false);
  assert.equal(p.tokenProductMismatch({ product: 'events' }, { product: 'wave' }), true, 'подделанный продукт');
  assert.equal(p.tokenProductMismatch({}, { product: 'wave' }), false, 'старый токен Wave');
  assert.equal(p.tokenProductMismatch({}, { product: 'events' }), true, 'старый токен не открывает компанию мероприятий');
});
