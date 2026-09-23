'use strict';

// Сервис продукта «Мероприятия».
//
// Отдельный процесс (pm2: events-api), отдельная база `events`. С Wave ERP его
// связывают только учётки: вход общий (/api/auth/login в Wave), а здесь токен
// лишь проверяется. К базе warehouse сервис ходит под ролью, которой выданы
// права только на столбцы входа — см. sql/setup-prod.sql.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { createPgPool } = require('./src/db');
const { migrate } = require('./src/schema');
const { createApp } = require('./src/app');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`events-api: FATAL — не задана переменная ${name}`);
    process.exit(1);
  }
  return value;
}

function int(name, fallback) {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isInteger(n) ? n : fallback;
}

const JWT_SECRET = required('JWT_SECRET');
if (JWT_SECRET.length < 24) {
  console.error('events-api: FATAL — JWT_SECRET короче 24 символов (должен совпадать с Wave)');
  process.exit(1);
}

process.env.TZ = 'Asia/Tashkent';

const db = createPgPool({
  database: process.env.EVENTS_DB_NAME || 'events',
  user: process.env.EVENTS_DB_USER || 'events_app',
  password: required('EVENTS_DB_PASS'),
  host: process.env.EVENTS_DB_HOST || 'localhost',
  port: int('EVENTS_DB_PORT', 5432),
  max: int('EVENTS_DB_POOL_MAX', 10),
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  connectionTimeoutMillis: 5000,
});

// Учётки: база warehouse, но под отдельной ролью с правами только на столбцы
// входа. Пул маленький — это две короткие выборки по первичному ключу на запрос.
const identity = createPgPool({
  database: process.env.IDENTITY_DB_NAME || 'warehouse',
  user: process.env.IDENTITY_DB_USER || 'events_identity',
  password: required('IDENTITY_DB_PASS'),
  host: process.env.IDENTITY_DB_HOST || 'localhost',
  port: int('IDENTITY_DB_PORT', 5432),
  max: int('IDENTITY_DB_POOL_MAX', 5),
  statement_timeout: 5000,
  connectionTimeoutMillis: 5000,
});

const PORT = int('EVENTS_PORT', 3002);
// Только localhost: наружу — через nginx. Урок Wave: API на *:3001 отвечал на
// публичном IP по открытому HTTP мимо TLS.
const HOST = process.env.EVENTS_HOST || '127.0.0.1';

let server;

async function main() {
  await migrate(db);
  const app = createApp({ db, identity, jwtSecret: JWT_SECRET });
  server = app.listen(PORT, HOST, () => console.log(`events-api: слушаю ${HOST}:${PORT}`));
  server.on('error', (e) => {
    console.error('events-api: не удалось открыть порт', e.code || e.message);
    process.exit(1);
  });
}

async function shutdown(signal) {
  console.log(`events-api: ${signal}, останавливаюсь`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([db.end(), identity.end()]);
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

main().catch((e) => {
  console.error('events-api: FATAL при запуске —', e.message);
  process.exit(1);
});
