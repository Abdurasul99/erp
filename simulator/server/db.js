// Прямое подключение к БД — ТОЛЬКО для: (1) lookup id founder/admin для минтинга токенов,
// (2) cleanup [SIM]-данных. Нагрузочные записи идут ИСКЛЮЧИТЕЛЬНО через API.
const { Pool } = require('pg');
const cfg = require('./config');
const pool = new Pool(cfg.db);
pool.on('error', () => {});
module.exports = { pool };
