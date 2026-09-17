// Правая панель ИИ на проде молча не рисовалась. Причина оказалась в двух
// местах сразу, и оба дают один и тот же симптом — пустая заглушка:
//   1) провайдер отклоняет запрос с response_format: json_object, если в самих
//      сообщениях нет слова «json» СТРОЧНЫМИ буквами (у нас было «СТРОГО JSON»);
//   2) даже в json-режиме модель иногда заворачивает ответ в ```json ... ```,
//      и голый JSON.parse на этом падает.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('в json-режиме приписка уходит в ПОЛЬЗОВАТЕЛЬСКОЕ сообщение', () => {
  const uses = [...server.matchAll(/response_format:\s*\{\s*type:\s*'json_object'\s*\}/g)];
  assert.ok(uses.length > 0, 'json-режим больше не используется — тест пора пересмотреть');

  for (const use of uses) {
    // Список messages идёт сразу за response_format в теле запроса.
    const tail = server.slice(use.index, use.index + 600);
    const userPart = tail.match(/role:\s*'user',\s*content:\s*([^}]+)\}/);
    assert.ok(userPart, 'не нашли сообщение роли user рядом с json-режимом');
    const expr = userPart[1];

    // Содержимое бывает собрано на месте, а бывает переменной (userMsg) —
    // тогда разворачиваем её объявление внутри того же обработчика.
    const handlerStart = server.slice(0, use.index).lastIndexOf("app.post('/api/ai/");
    const handler = server.slice(handlerStart, use.index);
    const route = (handler.match(/app\.post\('([^']+)'/) || [])[1];
    let text = expr;
    const ident = expr.trim().match(/^([A-Za-z_$][\w$]*)$/);
    if (ident) {
      const decl = handler.match(new RegExp(`const ${ident[1]}\\s*=([\\s\\S]*?);\\n`));
      assert.ok(decl, `${route}: не нашли объявление ${ident[1]}`);
      text = decl[1];
    }

    // Провайдер проверяет именно сообщение роли user: то же слово в системном
    // промпте даёт 400 (проверено на проде). Заголовок 'application/json' — не в счёт.
    assert.match(text, /AI_JSON_MODE_RULE/,
      `${route}: к пользовательскому сообщению не добавлена приписка — провайдер ответит 400`);
  }
});

test('приписка объявлена и содержит слово json', () => {
  const rule = server.match(/const AI_JSON_MODE_RULE = '([^']*)'/);
  assert.ok(rule, 'константа AI_JSON_MODE_RULE исчезла');
  assert.match(rule[1], /json/i, 'без слова «json» провайдер отклонит запрос');
});

// parseAiJson объявлена внутри монолита server.js, который на require поднимает
// пул к БД. Достаём саму функцию текстом и проверяем её поведение отдельно.
function loadParser() {
  const start = server.indexOf('function parseAiJson(');
  assert.ok(start > 0, 'parseAiJson не найдена');
  const end = server.indexOf('\n}', start) + 2;
  // eslint-disable-next-line no-new-func
  return new Function(`${server.slice(start, end)}; return parseAiJson;`)();
}

test('разбор переживает markdown-обёртку и лишние фразы', () => {
  const parseAiJson = loadParser();

  assert.deepEqual(parseAiJson('{"a":1}'), { a: 1 }, 'обычный json');
  assert.deepEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 }, 'обёртка ```json');
  assert.deepEqual(parseAiJson('```\n{"a":1}\n```'), { a: 1 }, 'обёртка без языка');
  assert.deepEqual(parseAiJson('Вот ответ: {"a":1} — готово'), { a: 1 }, 'фразы вокруг');
  assert.deepEqual(parseAiJson('[{"i":0}]'), [{ i: 0 }], 'массив на верхнем уровне');
});

test('когда разбирать нечего — возвращаем null, а не падаем', () => {
  const parseAiJson = loadParser();

  assert.equal(parseAiJson(''), null);
  assert.equal(parseAiJson(null), null);
  assert.equal(parseAiJson('совсем не json'), null);
});
