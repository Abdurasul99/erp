'use strict';

// Поднимает НАСТОЯЩИЙ backend/server.js Wave поверх PGlite, открытого по
// сетевому протоколу Postgres. Нужен сквозному тесту общего входа: проверить,
// что именно боевой код Wave выдаёт токен, который принимает events-api.

const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { PARSERS } = require('../../src/db');

const ROOT = path.resolve(__dirname, '..', '..', '..');
// Папку Wave можно подменить: так проверяется ровно та версия server.js, что
// уходит в коммит, а не рабочая копия с чужими незакоммиченными правками.
const BACKEND = process.env.WAVE_BACKEND_DIR || path.join(ROOT, 'backend');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Точная схема базы warehouse с прода (pg_dump --schema-only: только структура,
// ни одной строки данных). Многие таблицы прода создавались вне кода, и Wave
// без них не стартует; к тому же на этой схеме миграции Wave проверяются ровно
// в тех условиях, что на сервере. Так нашлось ограничение users_role_check со
// списком ТОЛЬКО ролей Wave — на самодельной схеме его бы не было.
// Обновить: pg_dump --schema-only --no-owner --no-privileges --no-comments warehouse
const SCHEMA_FIXTURE = path.join(__dirname, '..', 'fixtures', 'warehouse-schema.sql');

function loadProdSchema() {
  return fs.readFileSync(SCHEMA_FIXTURE, 'utf8')
    .split('\n')
    // \restrict / \unrestrict — команды клиента psql, а не SQL.
    .filter((line) => !line.startsWith('\\'))
    // pg_dump обнуляет search_path на всю сессию, а PGlite — одна сессия на
    // всех: после этого Wave не нашёл бы ни одной таблицы без префикса public.
    .filter((line) => !line.includes("set_config('search_path', ''"))
    .join('\n');
}

async function startWaveBackend({ jwtSecret, log = () => {}, socketDebug = false }) {
  const db = new PGlite({ parsers: PARSERS });
  // exec — многооператорный скрипт целиком, с корректным разбором строк и $$.
  await db.exec(loadProdSchema());

  const dbPort = await freePort();
  // По умолчанию адаптер держит одно соединение; разрешаем несколько — запросы
  // всё равно выстраиваются в очередь к одной сессии PGlite.
  const socket = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 8, debug: socketDebug });
  await socket.start();

  const apiPort = await freePort();
  // Отдельная рабочая папка: Wave читает .env из текущей папки и пишет туда
  // загрузки — ни то, ни другое не должно касаться рабочей копии проекта.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wave-e2e-'));
  const child = spawn(process.execPath, [path.join(BACKEND, 'server.js')], {
    cwd,
    env: {
      ...process.env,
      PORT: String(apiPort),
      HOST: '127.0.0.1',
      JWT_SECRET: jwtSecret,
      DB_NAME: 'postgres',
      DB_USER: 'postgres',
      DB_PASS: 'pglite',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(dbPort),
      // Один сеанс: PGlite — это одна сессия Postgres, несколько соединений
      // перемешали бы транзакции.
      DB_POOL_MAX: '1',
      AI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const onData = (chunk) => {
    const text = chunk.toString();
    output += text;
    log(text);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Wave не поднялся за 90 с:\n${output.slice(-3000)}`)), 90000);
    const check = () => {
      if (/WareApp API running on/.test(output)) { clearTimeout(timer); resolve(); return; }
      if (child.exitCode !== null) { clearTimeout(timer); reject(new Error(`Wave упал при запуске:\n${output.slice(-3000)}`)); return; }
      setTimeout(check, 200);
    };
    check();
  });

  async function stop() {
    child.kill();
    await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
    await socket.stop();
    await db.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  return { db, base: `http://127.0.0.1:${apiPort}`, stop, output: () => output };
}

module.exports = { startWaveBackend, freePort, loadProdSchema };
