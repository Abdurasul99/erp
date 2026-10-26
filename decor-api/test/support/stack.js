'use strict';

// Тестовый стенд: настоящий PostgreSQL 16 (PGlite) за pg-протоколом (pglite-socket),
// миграции D00–D24 из sql/ ровно в том порядке, что и apply_decor_migrations.sh,
// сервис — тот же createApp, что на сервере, через обычный драйвер pg.
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { Pool } = require('pg');

const SQL_DIR = path.join(__dirname, '..', '..', 'sql');

// Порядок — из apply_decor_migrations.sh, чтобы тест проверял именно то, что поставит скрипт
function migrationOrder() {
  const script = fs.readFileSync(path.join(SQL_DIR, 'apply_decor_migrations.sh'), 'utf8');
  const m = /FILES=\(([^)]*)\)/.exec(script);
  if (!m) throw new Error('В apply_decor_migrations.sh не найден список FILES=(...)');
  return m[1].trim().split(/\s+/);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function applyMigrations(pool) {
  const applied = [];
  for (const file of migrationOrder()) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');            // как psql -1: файл целиком или ничего
      await c.query(sql);
      await c.query('COMMIT');
      applied.push(file);
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw new Error(`Миграция ${file} не применилась: ${e.message}`);
    } finally {
      c.release();
    }
  }
  return applied;
}

async function startStack({ jwtSecret = 'decor-test-secret-0123456789abcdef-long', migrate = true } = {}) {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decor-uploads-'));
  process.env.DECOR_UPLOADS_DIR = uploadsDir;      // uploads.js читает его при подключении

  const db = new PGlite();
  const dbPort = await freePort();
  const socket = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 8 });
  await socket.start();
  const pool = new Pool({ host: '127.0.0.1', port: dbPort, user: 'postgres', password: 'x', database: 'postgres', max: 6 });

  let server = null;
  async function stop() {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end().catch(() => {});
    await socket.stop().catch(() => {});
    await db.close().catch(() => {});
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }

  // Любая ошибка запуска (миграция, битый модуль) — убрать базу, иначе тест повиснет на открытом сокете
  let migrations;
  try {
    migrations = migrate ? await applyMigrations(pool) : [];
    const { setPool } = require('../../sphere_db');
    setPool('decor', pool);
    const { createApp } = require('../../src/app');
    const app = createApp({ jwtSecret, loginLimit: { windowMs: 60 * 1000, max: 1000 } });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  } catch (e) {
    await stop();
    throw e;
  }
  const base = `http://127.0.0.1:${server.address().port}`;

  return { base, pool, jwtSecret, uploadsDir, migrations, stop };
}

module.exports = { startStack, applyMigrations, migrationOrder, freePort };
