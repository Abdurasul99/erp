'use strict';

// deploy/nginx-decor.sh на временной папке nginx с подставными nginx и systemctl.
// Подставной `nginx -t`, как настоящий, падает на «duplicate default server», если в
// sites-enabled два файла с default_server — именно так упала первая установка 2026-10-26,
// когда копия конфига легла рядом с оригиналом.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'deploy', 'nginx-decor.sh');
const BASH = [process.env.BASH_FOR_TESTS, 'C:\\Program Files\\Git\\bin\\bash.exe', '/bin/bash', '/usr/bin/bash']
  .find(p => p && fs.existsSync(p));
const posix = p => p.replace(/\\/g, '/');

const SITE = `server {
    listen 80 default_server;
    server_name mywarehouse.uz;
    root /var/www/wareapp/frontend/dist;
    # location /api/ { старый закомментированный }
    location / {
        try_files $uri $uri/ /index.html;
    }
\tlocation /api/ {
        proxy_pass http://localhost:3001;
    }
}
`;

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nginx-decor-'));
  const dir = path.join(root, 'nginx');
  const bin = path.join(root, 'bin');
  for (const d of ['sites-enabled', 'conf.d']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, 'sites-enabled', 'wareapp'), SITE);
  // nginx -t: два файла с default_server в подключаемых папках → ошибка, как у настоящего
  fs.writeFileSync(path.join(bin, 'nginx'), `#!/usr/bin/env bash
n=$(grep -l default_server "$NGINX_DIR"/sites-enabled/* "$NGINX_DIR"/conf.d/*.conf 2>/dev/null | wc -l)
if [ "$n" -gt 1 ]; then echo "nginx: [emerg] a duplicate default server for 0.0.0.0:80" >&2; exit 1; fi
echo "nginx: configuration file test is successful" >&2
`);
  fs.writeFileSync(path.join(bin, 'systemctl'), `#!/usr/bin/env bash
echo "$*" >> "$NGINX_DIR/../systemctl.log"
`);
  return { root, dir, bin, backups: path.join(root, 'rollback') };
}

function run(sb, extraEnv = {}) {
  const r = spawnSync(BASH, ['-c', `set -euo pipefail; . "${posix(SCRIPT)}"; nginx_decor 3003`], {
    env: { ...process.env, PATH: `${sb.bin}${path.delimiter}${process.env.PATH}`, NGINX_DIR: posix(sb.dir),
      NGINX_BACKUPS: posix(sb.backups), ...extraEnv },
    encoding: 'utf8',
    timeout: 30000,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const site = sb => fs.readFileSync(path.join(sb.dir, 'sites-enabled', 'wareapp'), 'utf8');
const enabled = sb => fs.readdirSync(path.join(sb.dir, 'sites-enabled')).sort();
const reloads = sb => { try { return fs.readFileSync(path.join(sb.root, 'systemctl.log'), 'utf8').trim().split('\n').filter(Boolean); } catch { return []; } };

test('nginx-decor.sh', { skip: BASH ? false : 'bash не найден' }, async t => {
  await t.test('состояние сервера после первой установки: копия в sites-enabled убирается, блок встаёт', () => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.dir, 'sites-enabled', 'wareapp.before-decor-2026-10-26-100153'), SITE);
    const r = run(sb);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(enabled(sb), ['wareapp'], 'в sites-enabled остался только сам сайт');
    assert.ok(fs.readdirSync(sb.backups).includes('wareapp.before-decor-2026-10-26-100153'), 'старая копия перенесена, не удалена');
    const conf = site(sb);
    assert.equal(conf.match(/location \/api\/decor\/ \{/g).length, 1);
    assert.match(conf, /\tlocation \/api\/decor\/ \{\n\t    proxy_pass http:\/\/127\.0\.0\.1:3003\/api\/decor\/;/, 'отступ как у location /api/');
    assert.ok(conf.indexOf('location /api/decor/') < conf.indexOf('\tlocation /api/ {'), 'блок перед общим /api/');
    assert.match(conf, /proxy_set_header Host \$host;/, 'переменные nginx не съедены');
    assert.match(conf, /client_max_body_size 300m;/);
    assert.deepEqual(reloads(sb), ['reload nginx']);
  });

  await t.test('повторный запуск ничего не меняет и nginx не перезагружает', () => {
    const sb = sandbox();
    assert.equal(run(sb).code, 0);
    const once = site(sb);
    const backupsOnce = fs.readdirSync(sb.backups).length;
    const r = run(sb);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /блок уже есть/);
    assert.equal(site(sb), once);
    assert.equal(fs.readdirSync(sb.backups).length, backupsOnce, 'новых копий нет');
    assert.equal(reloads(sb).length, 1);
  });

  await t.test('прежняя ошибка воспроизводится: копия в sites-enabled → nginx -t падает, конфиг возвращён', () => {
    const sb = sandbox();
    const r = run(sb, { NGINX_BACKUPS: posix(path.join(sb.dir, 'sites-enabled')) });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /duplicate default server/);
    assert.match(r.out, /конфиг возвращён как был/);
    assert.equal(site(sb), SITE, 'сайт не изменён');
    assert.deepEqual(reloads(sb), [], 'nginx не перезагружался');
  });

  await t.test('конфиг уже сломан до правок — ничего не трогаем', () => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.dir, 'conf.d', 'other.conf'), 'server { listen 80 default_server; }');
    const r = run(sb);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /уже сломан/);
    assert.equal(site(sb), SITE);
    assert.deepEqual(fs.readdirSync(sb.backups), [], 'копий не делали');
  });

  await t.test('нет location /api/ — понятная ошибка, без правок', () => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.dir, 'sites-enabled', 'wareapp'), 'server {\n    listen 80 default_server;\n}\n');
    const r = run(sb);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /не найден конфиг nginx/);
  });
});
