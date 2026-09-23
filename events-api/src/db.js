'use strict';

// Один интерфейс поверх боевого pg.Pool и тестового PGlite:
//   query(text, params) → { rows, rowCount }
//   tx(fn)              → fn({ query }) внутри BEGIN/COMMIT, откат при ошибке
// Обработчики пишутся против этого интерфейса и не знают, где исполняются.

// Разбор типов обязан совпадать в проде и тестах, иначе тесты проверяют не то,
// что работает на сервере. По умолчанию pg отдаёт NUMERIC и BIGINT строками, а
// DATE — объектом Date в часовом поясе процесса: «2026-09-23» превращается в
// 22-е 19:00 UTC и съезжает на день при сериализации. Поэтому:
//   NUMERIC → число (суммы в сумах, точности double хватает с запасом),
//   BIGINT  → число (COUNT(*), SUM по int),
//   DATE    → строка 'YYYY-MM-DD' как есть — без часовых поясов.
const OID = { INT8: 20, NUMERIC: 1700, DATE: 1082 };
const PARSERS = {
  [OID.INT8]: (v) => (v === null ? null : parseInt(v, 10)),
  [OID.NUMERIC]: (v) => (v === null ? null : parseFloat(v)),
  [OID.DATE]: (v) => v,
};

function fromPgPool(pool) {
  return {
    query: (text, params) => pool.query(text, params),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

function createPgPool(config) {
  const { Pool, types } = require('pg');
  for (const [oid, parse] of Object.entries(PARSERS)) types.setTypeParser(Number(oid), parse);
  const pool = new Pool(config);
  pool.on('error', (e) => console.error('events-api: ошибка простаивающего соединения', e.code || e.name));
  return fromPgPool(pool);
}

// PGlite: affectedRows есть только у INSERT/UPDATE/DELETE, у SELECT он 0 —
// приводим к привычному rowCount, как у pg.
function fromPglite(pg) {
  const norm = (r) => ({ rows: r.rows, rowCount: r.affectedRows || r.rows.length });
  return {
    query: async (text, params) => norm(await pg.query(text, params)),
    tx: (fn) => pg.transaction((t) => fn({ query: async (text, params) => norm(await t.query(text, params)) })),
    end: () => pg.close(),
  };
}

module.exports = { createPgPool, fromPgPool, fromPglite, PARSERS, OID };
