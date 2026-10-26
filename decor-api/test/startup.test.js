'use strict';

// server.js отказывается стартовать с опасной настройкой, а не работает «как-нибудь».
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SERVER = path.join(__dirname, '..', 'server.js');
const OK_SECRET = 'decor-secret-0123456789abcdef-0123456789';

function start(env) {
  const r = spawnSync(process.execPath, [SERVER], {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DECOR_DB_PASS: 'x', DECOR_JWT_SECRET: OK_SECRET,
      DECOR_UPLOADS_DIR: path.join(os.tmpdir(), 'decor-startup-test'), DECOR_PORT: '0', ...env },
    encoding: 'utf8',
    timeout: 15000,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('фото в публичной папке Wave — сервис не стартует', () => {
  for (const dir of ['/var/www/wareapp/backend/uploads/decor', 'C:\\wareapp\\frontend\\dist\\decor']) {
    const r = start({ DECOR_UPLOADS_DIR: dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /публичная папка/);
  }
});

test('тест-хуки на рабочем сервере — сервис не стартует', () => {
  const r = start({ DECOR_TEST_HOOKS: '1', NODE_ENV: 'production' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /DECOR_TEST_HOOKS/);
});

test('короткий секрет токенов или нет пароля базы — сервис не стартует', () => {
  const shortSecret = start({ DECOR_JWT_SECRET: 'short' });
  assert.equal(shortSecret.code, 1, shortSecret.out);
  assert.match(shortSecret.out, /DECOR_JWT_SECRET/);
  const noPass = start({ DECOR_DB_PASS: '' });
  assert.equal(noPass.code, 1, noPass.out);
  assert.match(noPass.out, /DECOR_DB_PASS/);
});
