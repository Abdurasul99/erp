'use strict';
// Время в базе — timestamp WITHOUT time zone по часам Ташкента (TZ процесса и БД).
// Границы периодов приходят строками UTC-ISO («2026-11-17T19:00:00.000Z» — и от фронта, и из
// toISOString() на сервере), а Postgres при приведении такой строки к timestamp без пояса молча
// ОТБРАСЫВАЕТ «Z»: «19:00Z» становилось «19:00 по Ташкенту». Окна отчётов уезжали на 5 часов
// назад — последние 5 часов работы не попадали в «сегодня / месяц», зато попадал вечер накануне
// (QA 2026-11-18, подтверждено на проде: '…05:22Z'::timestamp = 05:22, а не 10:22).
// Переводим такие параметры в местное время со смещением («2026-11-18T00:00:00.000+05:00»):
// для timestamp без пояса Postgres возьмёт верные местные часы, для timestamptz — тот же момент,
// для date — ту же местную дату. Остальные параметры не трогаем.

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?Z$/;
const pad = (n, w = 2) => String(n).padStart(w, '0');

// Date → «YYYY-MM-DDTHH:mm:ss.SSS±HH:MM» в часовом поясе процесса
function toLocalIso(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

function normalizeParam(v) {
  if (typeof v !== 'string' || !ISO_UTC.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : toLocalIso(d);
}

const isPlainObject = (o) => o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;

// Ставит нормализацию на pg.Client.prototype.query (через него работает и Pool). Повторный вызов — no-op.
function installLocalTimeParams(pg) {
  const proto = pg.Client.prototype;
  if (proto.__localTimeParams) return;
  const original = proto.query;
  proto.query = function query(config, values, callback) {
    if (Array.isArray(values)) values = values.map(normalizeParam);
    else if (isPlainObject(config) && Array.isArray(config.values)) config = { ...config, values: config.values.map(normalizeParam) };
    return original.call(this, config, values, callback);
  };
  Object.defineProperty(proto, '__localTimeParams', { value: true });
}

module.exports = { ISO_UTC, toLocalIso, normalizeParam, installLocalTimeParams };
