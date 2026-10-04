const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createAiClient } = require('../aiClient');
const request = (client, url = 'http://provider.test') => client.request(url, {
  method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
});

test('429 and 401 never retry even when the error text describes temporary unavailability', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const client = createAiClient({ model: 'main', fallbacks: ['spare'], fetchImpl: async () => {
      calls++;
      return new Response('temporarily unavailable', { status });
    } });
    assert.equal((await request(client)).status, status);
    assert.equal(calls, 1);
  }
});

test('AI concurrency cap rejects overload and releases its slot after completion and failure', async () => {
  let finish;
  const client = createAiClient({ model: 'main', maxConcurrent: 1,
    fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  const first = request(client);
  await assert.rejects(request(client), error => error.statusCode === 503);
  finish(new Response('ok'));
  assert.equal(await (await first).text(), 'ok');
  const second = request(client);
  finish(new Response('next'));
  assert.equal(await (await second).text(), 'next');

  let fail = true;
  const recover = createAiClient({ model: 'main', maxConcurrent: 1, fetchImpl: async () => {
    if (fail) throw new Error('network');
    return new Response('recovered');
  } });
  await assert.rejects(request(recover), /network/);
  fail = false;
  assert.equal(await (await request(recover)).text(), 'recovered');
});

test('oversized AI response is cancelled and the concurrency slot is released', async () => {
  let cancelled = false, calls = 0;
  const client = createAiClient({ model: 'main', maxResponseBytes: 3, maxConcurrent: 1,
    fetchImpl: async () => {
      if (++calls > 1) return new Response('ok');
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('four')); },
        cancel() { cancelled = true; },
      }));
    } });
  await assert.rejects(request(client), error => error.statusCode === 502);
  assert.equal(cancelled, true);
  assert.equal(await (await request(client)).text(), 'ok');
});

test('real HTTP response that stalls after headers is aborted and a later request succeeds', async t => {
  const server = http.createServer((req, res) => {
    req.resume();
    if (req.url === '/ok') { res.end('ok'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const client = createAiClient({ model: 'main', timeoutMs: 250, attemptTimeoutMs: 100, maxConcurrent: 1 });
  await assert.rejects(request(client, `${url}/stall`), error => error.statusCode === 504);
  assert.equal(await (await request(client, `${url}/ok`)).text(), 'ok');
});
