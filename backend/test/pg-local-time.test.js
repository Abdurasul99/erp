// Границы периодов в UTC-ISO («…Z») Postgres приводил к timestamp без пояса, отбрасывая «Z»:
// окна отчётов уезжали на 5 часов (QA 2026-11-18). Параметры переводим в местное время.
process.env.TZ = 'Asia/Tashkent';
const test = require('node:test');
const assert = require('node:assert/strict');

let mod = {};
try { mod = require('../pgLocalTime'); } catch { /* RED: модуля ещё нет */ }

test('UTC-ISO parameter becomes the same instant in local time with offset', () => {
  assert.equal(mod.normalizeParam('2026-11-17T19:00:00.000Z'), '2026-11-18T00:00:00.000+05:00'); // местная полночь
  assert.equal(mod.normalizeParam('2026-11-18T05:22:11.465Z'), '2026-11-18T10:22:11.465+05:00');
  assert.equal(mod.normalizeParam('2026-11-18T05:22Z'), '2026-11-18T10:22:00.000+05:00');
  assert.equal(new Date(mod.normalizeParam('2026-03-01T18:59:59.999Z')).toISOString(), '2026-03-01T18:59:59.999Z');
});

test('other parameters are left untouched', () => {
  for (const v of ['2026-11-18', '2026-11-18T10:00:00+05:00', '2026-11-18 10:00:00', 'month', 'Z', '', 5, null, undefined, true, ['2026-11-17T19:00:00.000Z'], { a: 1 }]) {
    assert.deepEqual(mod.normalizeParam(v), v);
  }
  const d = new Date();
  assert.equal(mod.normalizeParam(d), d);
});

test('installLocalTimeParams patches Client.prototype.query for both call forms, once', () => {
  class Client { query(config, values, cb) { return { config, values, cb }; } }
  const pg = { Client };
  mod.installLocalTimeParams(pg);
  mod.installLocalTimeParams(pg); // повторно — без двойной обёртки
  const c = new Client();
  const r1 = c.query('SELECT $1, $2', ['2026-11-17T19:00:00.000Z', 7]);
  assert.deepEqual(r1.values, ['2026-11-18T00:00:00.000+05:00', 7]);
  const r2 = c.query({ text: 'SELECT $1', values: ['2026-11-17T19:00:00.000Z'] });
  assert.deepEqual(r2.config.values, ['2026-11-18T00:00:00.000+05:00']);
  const cb = () => {};
  const r3 = c.query('SELECT 1', cb);
  assert.equal(r3.values, cb);
  // объект-«submittable» (курсор, стрим) не копируем
  const sub = Object.create({ submit() {} }); sub.values = ['2026-11-17T19:00:00.000Z'];
  assert.equal(c.query(sub).config, sub);
});
