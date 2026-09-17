// Складские операции принимают product_id из тела запроса. Если обработчик не
// проверяет, что товар принадлежит компании пользователя, открывается вход в
// чужие данные: «возврат от клиента» заводил строку остатка на чужой товар, а
// приход перезаписывал чужой компании закупочную и продажную цену.
//
// Тест статический: server.js — монолит, который на require поднимает пул к БД,
// поэтому проверяем не поведение обработчика, а наличие защиты в его теле.
// Это тот же приём, что и в frontend/test/source-bindings.test.mjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Обработчики, которые меняют склад по присланному product_id.
const GUARDED = [
  '/api/stock/income',
  '/api/stock/return-to-supplier',
  '/api/stock/writeoff',
  '/api/stock/customer-return',
  '/api/warehouse/transfers',
  '/api/procurement/returns',
];

function handlerBody(route) {
  const start = server.indexOf(`app.post('${route}'`);
  if (start === -1) return null;
  const next = server.indexOf('\napp.', start + 1);
  return server.slice(start, next === -1 ? server.length : next);
}

test('помощник проверки владельца товара объявлен', () => {
  assert.match(server, /async function assertProductInCompany\(/);
});

for (const route of GUARDED) {
  test(`${route} проверяет, что товар принадлежит компании`, () => {
    const body = handlerBody(route);
    assert.ok(body, `обработчик ${route} не найден — маршрут переименовали?`);

    // Годится любая из двух форм: общий помощник либо явная сверка company_id
    // прямо в SQL (так сделаны перемещения и возвраты в закупках).
    const usesHelper = /assertProductInCompany\(/.test(body);
    const usesInlineSql = /FROM products WHERE id\s*=\s*\$\d+ AND company_id\s*=\s*\$\d+/i.test(body)
      || /FROM products WHERE id\s*=\s*\$\d+ AND company_id\s*=\s*\$\d+\)/i.test(body);

    assert.ok(usesHelper || usesInlineSql,
      `${route} принимает product_id, но не проверяет владельца товара`);
  });
}
