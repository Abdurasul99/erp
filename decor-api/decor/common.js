// Общие помощники модуля «Декор». Стиль — как в server.js Wave и в модуле учебного центра:
// auth([роли]) на каждом маршруте, company_id из токена, ошибки { error: 'текст' } (+ code для перевода на экране).

const CONSTRAINT_MESSAGES = {
  users_username_key: 'Логин уже занят',
  one_founder_per_company: 'У компании уже есть учредитель',
  decor_items_name_uq: 'Вещь с таким названием уже есть',
  decor_items_qty_bought_check: '«Куплено» не может стать меньше 0',
  decor_orders_company_id_no_key: 'Заказ с таким номером уже есть',
  decor_order_lines_order_id_item_id_key: 'Эта вещь уже есть в дизайне',
  decor_payroll_order_id_employee_id_key: 'Начисление за этот заказ уже есть',
  decor_employees_user_id_key: 'Этот вход уже привязан к другому сотруднику',
};

// Обёртка маршрута: ловит ошибки и переводит коды PostgreSQL в HTTP
const wrap = fn => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (res.headersSent) return;
    if (e.idemReplay) return require('./idem').sendReplay(req, res, e.idemReplay);   // повтор выполненного действия — первый ответ
    const msg = CONSTRAINT_MESSAGES[e.constraint];
    if (e.code === '23505') return res.status(409).json({ error: msg || 'Такая запись уже есть' });
    if (e.code === '23514') return res.status(400).json({ error: msg || 'Данные не прошли проверку', constraint: e.constraint });
    if (e.code === '23503') return res.status(400).json({ error: 'Связанная запись не найдена или используется' });
    if (e.code === '22P02' || e.code === '22007' || e.code === '22008' || e.code === '22003') return res.status(400).json({ error: 'Неверный формат данных' });
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message, ...(e.extra || {}) });
    console.error('decor error', req.method, req.path, e);
    res.status(500).json({ error: e.message });
  }
};

const httpError = (statusCode, message, extra) => Object.assign(new Error(message), { statusCode, extra });
const fail = (statusCode, message, extra) => { throw httpError(statusCode, message, extra); };

const toInt = v => (v === undefined || v === null || v === '' ? null : Number.isInteger(Number(v)) ? Number(v) : null);
const idParam = (req, name = 'id') => toInt(req.params[name]) || fail(400, 'bad id');

// Дата ГГГГ-ММ-ДД по часам сервера (TZ=Asia/Tashkent)
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayYmd = () => ymd(new Date());
const isoDate = (v, label = 'Дата') => {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))
    || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) fail(400, `${label}: формат ГГГГ-ММ-ДД`);
  return s;
};

// Числа из тела запроса. Деньги — не больше 2 знаков после точки (сумы — целые или с копейками, как пришло).
function money(v, label, { min = 0, gt = false } = {}) {
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n)) fail(400, `${label}: укажите число`);
  if (gt ? n <= min : n < min) fail(400, `${label}: должно быть ${gt ? 'больше' : 'не меньше'} ${min}`);
  if (Math.abs(n) >= 1e10) fail(400, `${label}: слишком большое число`);
  return Math.round(n * 100) / 100;
}
function intIn(v, label, min, max = 1e9) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max) {
    fail(400, `${label}: целое число${max < 1e9 ? ` от ${min} до ${max}` : ` не меньше ${min}`}`);
  }
  return n;
}
const text = (v, max = 500) => { const s = v === undefined || v === null ? '' : String(v).trim(); return s ? s.slice(0, max) : null; };
const oneOf = (v, list, label) => (list.includes(v) ? v : fail(400, `${label}: одно из ${list.join(', ')}`));

module.exports = function makeCommon(pool) {
  // Журнал действий — в audit_log базы сферы (та же таблица и поля, что в Wave)
  const audit = (req, action, entityType, entityId, oldValue, newValue) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    pool.query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.user?.id || null, req.user?.username || null, action, entityType, entityId,
        oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ip],
    ).catch(e => console.error('decor audit insert error', e.message));
  };

  // Транзакция. С req, у которого есть ключ повтора (Idempotency-Key, idem.js), ключ записывается в ЭТОЙ ЖЕ транзакции:
  // действие и ключ сохраняются вместе или не сохраняются вовсе.
  async function tx(fn, req) {
    const idem = req?.idem ? require('./idem') : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (idem) await idem.claim(client, req);
      const r = await fn(client);
      if (idem) { await idem.finish(client, req, r); await idem.testHook(req); }
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (req?.idem) req.idem.claimed = false;
      if (idem && e.code === '55P03') throw httpError(409, 'Это действие уже выполняется — подождите и обновите экран', { code: 'idem_running' });
      throw e;
    } finally { client.release(); }
  }

  // Заказ своей компании с блокировкой строки — все изменения заказа идут через неё (два кладовщика не примут
  // финальный возврат одной вещи дважды)
  async function lockOrder(c, req, id) {
    const { rows: [o] } = await c.query(
      `SELECT id, no, status, type, client, to_char(event_date,'YYYY-MM-DD') AS event_date, price_usd::float8 AS price_usd
       FROM decor_orders WHERE id=$1 AND company_id=$2 FOR UPDATE`, [id, req.decor.cid]);
    return o || fail(404, 'Заказ не найден');
  }

  // txFor(req)(fn) — то же, что tx(fn, req): для записывающих маршрутов с защитой от повторной отправки
  const txFor = req => fn => tx(fn, req);

  return { audit, tx, txFor, lockOrder };
};

Object.assign(module.exports, { wrap, httpError, fail, toInt, idParam, ymd, todayYmd, isoDate, money, intIn, text, oneOf });
