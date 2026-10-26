'use strict';

// Замена sphere_db.js «платформы сфер» для отдельного сервиса «Декора».
// Модуль decor/ берёт базу так: require('../sphere_db').getPool('decor').
// Сфера здесь одна, поэтому реестр spheres.json не нужен — настройки берутся из .env.
// Типы pg — по умолчанию (NUMERIC строкой, DATE объектом): так модуль работал в процессе
// Wave, где глобальных парсеров нет, и в запросах он сам приводит ::float8 / to_char.
const { Pool } = require('pg');

const pools = new Map();

// Для тестов: подставить готовый pool (PGlite через pglite-socket)
function setPool(key, pool) {
  pools.set(key, pool);
}

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} не задан в .env`);
  return v;
}

function getPool(key) {
  if (pools.has(key)) return pools.get(key);
  if (key !== 'decor') throw new Error(`Неизвестная сфера «${key}»: этот сервис обслуживает только decor`);
  const pool = new Pool({
    host: process.env.DECOR_DB_HOST || '127.0.0.1',
    port: Number(process.env.DECOR_DB_PORT) || 5432,
    database: process.env.DECOR_DB_NAME || 'wave_decor',
    user: process.env.DECOR_DB_USER || 'wave_decor_user',
    password: required('DECOR_DB_PASS'),
    max: Number(process.env.DECOR_DB_POOL_MAX) || 10,
  });
  pool.on('error', e => console.error('decor: ошибка простаивающего соединения PostgreSQL', e.message));
  pools.set(key, pool);
  return pool;
}

module.exports = { getPool, setPool };
