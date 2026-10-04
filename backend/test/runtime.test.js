const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { protectAsync, jsonError, envInteger } = require('../runtime');
const { createRecomputeGate } = require('../recompute');

test('Express catches rejected checkout, middleware and malformed JSON; subsequent requests survive', async t => {
  const app = protectAsync(express());
  app.set('sample', 42);
  assert.equal(app.get('sample'), 42);
  app.use(express.json());
  app.get('/checkout', async () => { await Promise.reject(new Error('private DB details')); });
  app.get('/middleware', [async () => { throw Object.assign(new Error('private'), { statusCode: 503 }); }]);
  app.post('/json', (req, res) => res.json(req.body));
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use(jsonError);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [route, status] of [['checkout', 500], ['middleware', 503]]) {
    const response = await fetch(`${base}/${route}`);
    assert.equal(response.status, status);
    assert.ok((await response.json()).error);
  }
  const invalid = await fetch(`${base}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).error);
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
});

test('runtime configuration rejects invalid integer limits', () => {
  for (const value of [undefined, '', '-1', '0', 'Infinity', 'NaN', '1.2', '70000']) {
    assert.equal(envInteger(value, 5432, 1, 65535), 5432);
  }
  assert.equal(envInteger('1', 5432, 1, 65535), 1);
  assert.equal(envInteger('65535', 5432, 1, 65535), 65535);
});

test('concurrent recomputations share work and retry immediately after failure', async () => {
  const gate = createRecomputeGate();
  let calls = 0;
  const work = async () => { calls++; throw new Error('DB unavailable'); };
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => gate.run('scope', work, 5000)));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(await gate.run('scope', async () => { calls++; return 7; }, 5000), 7);
  assert.equal(calls, 2);
});

test('TTL expires at boundary; scopes and periods remain separate; retained results are bounded', async () => {
  let clock = 0, calls = 0;
  const gate = createRecomputeGate({ now: () => clock, maxEntries: 2 });
  const work = async () => ++calls;
  assert.equal(await gate.run('company:branch:7', work, 100), 1);
  clock = 99;
  assert.equal(await gate.run('company:branch:7', work, 100), 1);
  clock = 100;
  assert.equal(await gate.run('company:branch:7', work, 100), 2);
  assert.equal(await gate.run('company:branch:30', work, 100), 3);
  assert.equal(await gate.run('company:other:30', work, 100), 4);
  assert.equal(await gate.run('company:branch:7', work, 100), 5);
});
