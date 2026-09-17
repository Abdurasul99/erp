// Переключение на запасную модель — единственное, что спасает ИИ, когда
// провайдер убирает модель или она временно не отвечает. Оба случая уже
// случились на проде: Groq снял llama-3.3-70b (404), а clodex отдавал по
// gpt-5.5 код 503 два раза из трёх при живых соседних моделях.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiClient } = require('../aiClient');

// Заглушка провайдера: отвечает по карте «модель → код ответа».
function providerWith(codes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const model = JSON.parse(init.body).model;
    calls.push(model);
    const status = codes[model] ?? 500;
    // Тело ответа повторяет то, что реально присылает провайдер на каждый код:
    // иначе заглушка «подсказывает» коду ответ и тест перестаёт что-либо значить.
    const bodies = {
      200: { choices: [{ message: { content: 'ok' } }] },
      401: { error: { message: 'Invalid API Key', type: 'invalid_request_error', code: 'expired_api_key' } },
      404: { error: { message: 'model_not_found', code: 'model_not_found' } },
      503: { error: { message: 'The model is temporarily unavailable. Please try again later.', type: 'server_error', code: 'upstream_unavailable' } },
    };
    return new Response(JSON.stringify(bodies[status] ?? { error: { message: 'server error' } }), { status });
  };
  return { fetchImpl, calls };
}

const call = (client) => client.request('https://provider.test/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'ignored', messages: [] }),
});

test('снятая модель (404) — сразу к следующей, ту же не дёргаем', async () => {
  const { fetchImpl, calls } = providerWith({ dead: 404, alive: 200 });
  const client = createAiClient({ model: 'dead', fallbacks: ['alive'], fetchImpl });

  const res = await call(client);

  assert.equal(res.status, 200);
  assert.deepEqual(calls, ['dead', 'alive'], 'повторять снятую модель бессмысленно');
  assert.equal(client.model(), 'alive', 'рабочую модель запоминаем');
});

// Главный случай с прода: 503 случаен, и вторая попытка ТОЙ ЖЕ модели проходит.
// Менять модель из-за одной осечки — значит без нужды ухудшать качество ответа.
test('случайный 503 — повторяем основную модель, а не убегаем на запасную', async () => {
  let n = 0;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body).model);
    n++;
    return n === 1
      ? new Response(JSON.stringify({ error: { code: 'upstream_unavailable' } }), { status: 503 })
      : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
  const client = createAiClient({ model: 'main', fallbacks: ['spare'], fetchImpl });

  const res = await call(client);

  assert.equal(res.status, 200);
  assert.deepEqual(calls, ['main', 'main'], 'до запасной дело дойти не должно');
  assert.equal(client.model(), 'main', 'основная модель сохраняется');
});

test('модель лежит стабильно — уходим на запасную', async () => {
  const { fetchImpl, calls } = providerWith({ flaky: 503, alive: 200 });
  const client = createAiClient({ model: 'flaky', fallbacks: ['alive'], fetchImpl });

  const res = await call(client);

  assert.equal(res.status, 200, 'на 503 раньше сдавались и отдавали ошибку пользователю');
  assert.deepEqual(calls, ['flaky', 'flaky', 'alive']);
});

test('неверный ключ (401) — перебирать модели бессмысленно, не перебираем', async () => {
  const { fetchImpl, calls } = providerWith({ first: 401, second: 200 });
  const client = createAiClient({ model: 'first', fallbacks: ['second'], fetchImpl });

  const res = await call(client);

  assert.equal(res.status, 401);
  assert.deepEqual(calls, ['first'], 'при плохом ключе упадут все модели');
});

test('когда не отвечает ни одна — отдаём первую ошибку, а не молчание', async () => {
  const { fetchImpl, calls } = providerWith({ a: 503, b: 503 });
  const client = createAiClient({ model: 'a', fallbacks: ['b'], fetchImpl });

  const res = await call(client);

  assert.equal(res.status, 503);
  assert.deepEqual(calls, ['a', 'a', 'b']);
});

// Ниже — случай, который вылез уже НА ПРОДЕ после выкладки: один общий таймер
// покрывал все попытки сразу и, сработав посреди перебора, ронял запрос с
// «AI timeout» даже когда следующая модель ответила бы за пару секунд.

test('зависшая попытка уступает место следующей модели, а не роняет запрос', async () => {
  const calls = [];
  const fetchImpl = (url, init) => {
    const model = JSON.parse(init.body).model;
    calls.push(model);
    if (model === 'hangs') {
      // Никогда не отвечает — полагаемся на прерывание по таймауту попытки.
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
  };
  const client = createAiClient({ model: 'hangs', fallbacks: ['alive'], fetchImpl, attemptTimeoutMs: 40, timeoutMs: 5000 });

  const res = await call(client);

  assert.equal(res.status, 200, 'запрос обязан дожить до живой модели');
  assert.deepEqual(calls, ['hangs', 'hangs', 'alive']);
  assert.equal(client.model(), 'alive');
});

test('общий бюджет обрывает бесконечный перебор', async () => {
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push(JSON.parse(init.body).model);
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  };
  const client = createAiClient({ model: 'a', fallbacks: ['b', 'c', 'd'], fetchImpl, attemptTimeoutMs: 30, timeoutMs: 80 });

  await assert.rejects(() => call(client), (e) => e.statusCode === 504);
  assert.ok(calls.length < 5, `перебор должен упереться в общий бюджет, а не пройти все модели (попыток: ${calls.length})`);
});

test('ошибка не по таймауту отдаётся наверх, а не прячется за перебором', async () => {
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push(JSON.parse(init.body).model);
    return Promise.reject(new Error('DNS сломался'));
  };
  const client = createAiClient({ model: 'a', fallbacks: ['b'], fetchImpl });

  await assert.rejects(() => call(client), /DNS сломался/);
  assert.deepEqual(calls, ['a'], 'настоящую поломку не маскируем повторами');
});
