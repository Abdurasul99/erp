// Клиенты для повторных продаж (D28; ТЗ «Декор, обновление 2», раздел 1).
// Клиент — телефон (один телефон — один клиент в компании: сравниваются последние 9 цифр), родственники и заказы.
// Число заказов, сумма, последний заказ, новый/повторный — считаются из заказов (лиды не считаются).
// В калькуляторе и при создании лида заказ привязывается к клиенту по телефону; клиента нет — он создаётся (linkClient).
// «Ближайшие даты»: дни рождения клиента и родственников, годовщина свадьбы (дата прошлого заказа), «не в браке» —
// будущие свадьбы (отдельным списком: у отметки нет даты). Автозадачи кассиру — tasks.js (collectDates отсюда).
// Разовая привязка старых заказов: отчёт «что будет привязано» → подтверждение учредителя (отпечаток отчёта:
// данные изменились между отчётом и подтверждением — 409, отчёт смотрят заново).
// Видят клиентов те, кто оформляет заказы (create_order), и учредитель: телефоны и дни рождения — личные данные.
const crypto = require('crypto');
const F = require('./formulas');
const { CLIENT_SOURCES, RELATIONS } = require('./defaults');
const { wrap, fail, idParam, toInt, todayYmd, isoDate, text, oneOf } = require('./common');

// Последние 9 цифр телефона (+998 90 123-45-67 → 901234567); меньше 7 цифр — не телефон
const phoneKey = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-9) : null; };

// Ближайшее наступление дня и месяца даты (день рождения, годовщина) начиная с from; 29 февраля в невисокосный год — 28-е
function nextOccurrence(ymd, from) {
  const [, m, d] = ymd.split('-').map(Number);
  const fy = Number(from.slice(0, 4));
  for (const y of [fy, fy + 1]) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const s = `${y}-${String(m).padStart(2, '0')}-${String(m === 2 && d === 29 && !leap ? 28 : d).padStart(2, '0')}`;
    if (s >= from) return s;
  }
  return null;
}
const yearsAt = (ymd, occ) => Number(occ.slice(0, 4)) - Number(ymd.slice(0, 4));

const CLIENT_COLS = `c.id, c.name, c.phone, c.phone2, c.address, to_char(c.birth_date,'YYYY-MM-DD') AS birth_date, c.source, c.notes,
  c.created_at`;
const STATS = `count(o.id) FILTER (WHERE o.status <> 'lead')::int AS orders,
  COALESCE(sum(o.price_usd) FILTER (WHERE o.status <> 'lead'), 0)::float8 AS total_usd,
  to_char(max(o.event_date) FILTER (WHERE o.status <> 'lead'), 'YYYY-MM-DD') AS last_order,
  count(o.id) FILTER (WHERE o.status = 'lead')::int AS leads`;
const withKind = c => ({ ...c, kind: c.orders >= 2 ? 'repeat' : 'new' });

module.exports = ({ app, pool, A, can, ownerOnly, audit, txFor }) => {
  const SEE = can('create_order');

  async function clientsOf(db, cid, where = '', vals = []) {
    const { rows } = await db.query(`SELECT ${CLIENT_COLS}, ${STATS}
      FROM decor_clients c LEFT JOIN decor_orders o ON o.client_id = c.id AND o.company_id = c.company_id
      WHERE c.company_id=$1 ${where} GROUP BY c.id ORDER BY lower(c.name), c.id`, [cid, ...vals]);
    return rows.map(withKind);
  }
  const owned = async (db, req, id) => (await clientsOf(db, req.decor.cid, 'AND c.id=$2', [id]))[0] || fail(404, 'Клиент не найден');

  // Заказ ↔ клиент (для orders.js, внутри транзакции заказа): client_id своей компании, иначе поиск по телефону,
  // не нашли — новый клиент с именем, телефоном и адресом заказа. Нет телефона — без клиента.
  async function linkClient(c, req, { client_id: clientId, name, phone, address }) {
    const cid = req.decor.cid;
    if (clientId !== undefined && clientId !== null && clientId !== '') {
      const id = toInt(clientId) || fail(400, 'Неверный клиент');
      const { rows: [x] } = await c.query('SELECT id FROM decor_clients WHERE id=$1 AND company_id=$2', [id, cid]);
      return x ? x.id : fail(400, 'Клиент не найден в вашей компании');
    }
    const key = phoneKey(phone);
    if (!key) return null;
    const found = await c.query('SELECT id FROM decor_clients WHERE company_id=$1 AND phone_key=$2', [cid, key]);
    if (found.rows[0]) return found.rows[0].id;
    const ins = await c.query(`INSERT INTO decor_clients (company_id, name, phone, phone_key, address, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (company_id, phone_key) DO NOTHING RETURNING id`,
    [cid, text(name, 160) || 'Клиент', text(phone, 40), key, text(address, 2000), req.user.id]);
    if (ins.rows[0]) return ins.rows[0].id;
    return (await c.query('SELECT id FROM decor_clients WHERE company_id=$1 AND phone_key=$2', [cid, key])).rows[0].id;
  }

  // Даты клиентов в периоде [from, to]: дни рождения клиентов и родственников, годовщины свадеб (прошлые заказы)
  // db — пул или клиент транзакции: запросы по очереди (на одном соединении параллельно нельзя)
  async function collectDates(db, cid, from, to) {
    const { rows: clients } = await db.query(`SELECT id, name, phone, to_char(birth_date,'YYYY-MM-DD') AS birth_date FROM decor_clients WHERE company_id=$1`, [cid]);
    const { rows: rels } = await db.query(`SELECT r.id, r.client_id, r.relation, r.name, r.not_married, r.expected_wedding_year,
        to_char(r.birth_date,'YYYY-MM-DD') AS birth_date FROM decor_client_relatives r WHERE r.company_id=$1`, [cid]);
    const { rows: orders } = await db.query(`SELECT id, no, client_id, to_char(event_date,'YYYY-MM-DD') AS event_date FROM decor_orders
        WHERE company_id=$1 AND client_id IS NOT NULL AND status <> 'lead' AND event_date < $2::date`, [cid, from]);
    const byId = new Map(clients.map(c => [c.id, { id: c.id, name: c.name, phone: c.phone }]));
    const out = [];
    const add = (ymd, ev) => {
      if (!ymd) return;
      const date = nextOccurrence(ymd, from);
      if (date && date <= to) out.push({ ...ev, date, years: yearsAt(ymd, date) });
    };
    for (const c of clients) add(c.birth_date, { kind: 'client_birthday', ref: c.id, client: byId.get(c.id) });
    for (const r of rels) {
      add(r.birth_date, { kind: 'relative_birthday', ref: r.id, client: byId.get(r.client_id),
        relative: { id: r.id, name: r.name, relation: r.relation, not_married: r.not_married, expected_wedding_year: r.expected_wedding_year } });
    }
    for (const o of orders) {
      const ev = { kind: 'anniversary', ref: o.id, client: byId.get(o.client_id), order: { id: o.id, no: o.no } };
      const date = nextOccurrence(o.event_date, from);
      if (date && date <= to && yearsAt(o.event_date, date) >= 1) out.push({ ...ev, date, years: yearsAt(o.event_date, date) });
    }
    for (const e of out) e.days_left = Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
    const ORDER = { client_birthday: 0, relative_birthday: 1, anniversary: 2 };
    return out.filter(e => e.client).sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.kind] - ORDER[b.kind] || a.ref - b.ref);
  }

  // ---------- Список, поиск по телефону, карточка ----------
  app.get('/api/decor/clients', A(SEE), wrap(async (req, res) => {
    const q = text(req.query.q, 80);
    const kind = req.query.kind ? oneOf(req.query.kind, ['new', 'repeat'], 'Фильтр') : null;
    let list = await clientsOf(pool, req.decor.cid);
    if (q) {
      const s = q.toLowerCase(); const digits = q.replace(/\D/g, '');
      list = list.filter(c => c.name.toLowerCase().includes(s) || (c.address || '').toLowerCase().includes(s)
        || (digits.length >= 3 && [c.phone, c.phone2].some(p => String(p || '').replace(/\D/g, '').includes(digits))));
    }
    if (kind) list = list.filter(c => c.kind === kind);
    res.json(list);
  }));

  app.get('/api/decor/clients/lookup', A(SEE), wrap(async (req, res) => {
    const key = phoneKey(req.query.phone);
    if (!key) return res.json({ client: null });
    res.json({ client: (await clientsOf(pool, req.decor.cid, 'AND c.phone_key=$2', [key]))[0] || null });
  }));

  app.get('/api/decor/clients/upcoming', A(SEE), wrap(async (req, res) => {
    const days = Math.min(Math.max(toInt(req.query.days) || 30, 1), 366);
    const from = todayYmd(); const to = F.addDays(from, days - 1);
    const events = await collectDates(pool, req.decor.cid, from, to);
    const { rows: weddings } = await pool.query(`SELECT r.id, r.name, r.relation, r.expected_wedding_year, to_char(r.birth_date,'YYYY-MM-DD') AS birth_date,
        c.id AS client_id, c.name AS client_name, c.phone AS client_phone
      FROM decor_client_relatives r JOIN decor_clients c ON c.id = r.client_id
      WHERE r.company_id=$1 AND r.not_married ORDER BY r.expected_wedding_year NULLS LAST, lower(r.name)`, [req.decor.cid]);
    res.json({ from, to, events, weddings: weddings.map(w => ({ id: w.id, name: w.name, relation: w.relation, birth_date: w.birth_date,
      expected_wedding_year: w.expected_wedding_year, client: { id: w.client_id, name: w.client_name, phone: w.client_phone } })) });
  }));

  // ---------- Разовая привязка старых заказов по телефону ----------
  async function bindPlan(db, cid) {
    const { rows: orders } = await db.query(`SELECT id, no, client, phone, address, to_char(event_date,'YYYY-MM-DD') AS event_date FROM decor_orders
        WHERE company_id=$1 AND client_id IS NULL ORDER BY event_date DESC, id DESC`, [cid]);
    const { rows: clients } = await db.query('SELECT id, name, phone_key FROM decor_clients WHERE company_id=$1', [cid]);
    const known = new Map(clients.map(c => [c.phone_key, c]));
    const groups = new Map(); const noPhone = [];
    for (const o of orders) {
      const key = phoneKey(o.phone);
      if (!key) { noPhone.push({ id: o.id, no: o.no, client: o.client }); continue; }
      if (!groups.has(key)) {
        const ex = known.get(key);
        // новый клиент — имя, телефон и адрес из самого свежего заказа
        groups.set(key, { phone_key: key, phone: o.phone, name: ex ? ex.name : o.client, address: o.address, client_id: ex ? ex.id : null, names: [], orders: [] });
      }
      const g = groups.get(key);
      g.orders.push({ id: o.id, no: o.no, client: o.client, event_date: o.event_date });
      if (!g.names.includes(o.client)) g.names.push(o.client);
    }
    const list = [...groups.values()];
    const fingerprint = crypto.createHash('sha1').update(JSON.stringify(list.map(g => [g.phone_key, g.client_id, g.orders.map(o => o.id)]))).digest('hex').slice(0, 16);
    return { groups: list, fingerprint,
      to_link: list.reduce((a, g) => a + g.orders.length, 0), new_clients: list.filter(g => !g.client_id).length,
      existing_clients: list.filter(g => g.client_id).length, no_phone: noPhone };
  }
  app.get('/api/decor/clients/bind-preview', A(ownerOnly), wrap(async (req, res) => res.json(await bindPlan(pool, req.decor.cid))));
  app.post('/api/decor/clients/bind', A(ownerOnly), wrap(async (req, res) => {
    const fp = text(req.body?.fingerprint, 40) || fail(400, 'Сначала посмотрите отчёт «что будет привязано»', { code: 'bind_no_preview' });
    const cid = req.decor.cid;
    const r = await txFor(req)(async c => {
      await c.query('SELECT 1 FROM decor_settings WHERE company_id=$1 FOR UPDATE', [cid]);     // одна привязка за раз
      const plan = await bindPlan(c, cid);
      if (plan.fingerprint !== fp) fail(409, 'Заказы или клиенты изменились после отчёта — посмотрите отчёт ещё раз', { code: 'bind_changed' });
      let created = 0; let linked = 0;
      for (const g of plan.groups) {
        let id = g.client_id;
        if (!id) {
          id = (await c.query(`INSERT INTO decor_clients (company_id, name, phone, phone_key, address, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [cid, text(g.name, 160) || 'Клиент', text(g.phone, 40), g.phone_key, text(g.address, 2000), req.user.id])).rows[0].id;
          created++;
        }
        linked += (await c.query('UPDATE decor_orders SET client_id=$1 WHERE company_id=$2 AND id = ANY($3::int[]) AND client_id IS NULL',
          [id, cid, g.orders.map(o => o.id)])).rowCount;
      }
      return { created_clients: created, linked_orders: linked, skipped_no_phone: plan.no_phone.length };
    });
    audit(req, 'bind', 'decor_clients', cid, null, r);
    res.json(r);
  }));

  app.get('/api/decor/clients/:id', A(SEE), wrap(async (req, res) => {
    const c = await owned(pool, req, idParam(req));
    const [{ rows: relatives }, { rows: orders }] = await Promise.all([
      pool.query(`SELECT id, relation, name, to_char(birth_date,'YYYY-MM-DD') AS birth_date, not_married, expected_wedding_year
        FROM decor_client_relatives WHERE company_id=$1 AND client_id=$2 ORDER BY id`, [req.decor.cid, c.id]),
      pool.query(`SELECT id, no, status, type, price_usd::float8 AS price_usd, to_char(event_date,'YYYY-MM-DD') AS event_date
        FROM decor_orders WHERE company_id=$1 AND client_id=$2 ORDER BY event_date DESC, id DESC`, [req.decor.cid, c.id]),
    ]);
    res.json({ ...c, relatives, history: orders });
  }));

  // ---------- Создать и изменить клиента ----------
  function clientFields(b, { partial }) {
    const out = {};
    const has = k => Object.prototype.hasOwnProperty.call(b, k);
    if (!partial || has('name')) out.name = text(b.name, 160) || fail(400, 'Имя клиента обязательно');
    if (!partial || has('phone')) {
      out.phone = text(b.phone, 40) || fail(400, 'Телефон клиента обязателен');
      out.phone_key = phoneKey(out.phone) || fail(400, 'Телефон: не меньше 7 цифр', { code: 'bad_phone' });
    }
    if (has('phone2')) out.phone2 = text(b.phone2, 40);
    if (has('address')) out.address = text(b.address, 2000);
    if (has('birth_date')) out.birth_date = b.birth_date ? isoDate(b.birth_date, 'Дата рождения') : null;
    if (has('source')) out.source = oneOf(b.source || 'other', CLIENT_SOURCES, 'Откуда пришёл');
    if (has('notes')) out.notes = text(b.notes, 4000);
    return out;
  }
  const dupCheck = async (db, cid, key, selfId = 0) => {
    const { rows: [x] } = await db.query('SELECT id, name FROM decor_clients WHERE company_id=$1 AND phone_key=$2 AND id<>$3', [cid, key, selfId]);
    if (x) fail(409, `Клиент с таким телефоном уже есть: ${x.name}`, { code: 'client_exists', client_id: x.id });
  };

  app.post('/api/decor/clients', A(SEE), wrap(async (req, res) => {
    const f = clientFields(req.body || {}, { partial: false });
    const cid = req.decor.cid;
    const id = await txFor(req)(async c => {
      await dupCheck(c, cid, f.phone_key);
      const cols = Object.keys(f);
      const { rows: [r] } = await c.query(`INSERT INTO decor_clients (company_id, created_by, ${cols.join(', ')})
        VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`, [cid, req.user.id, ...cols.map(k => f[k])]);
      return r.id;
    });
    audit(req, 'create', 'decor_client', id, null, f);
    res.json(await owned(pool, req, id));
  }));

  app.put('/api/decor/clients/:id', A(SEE), wrap(async (req, res) => {
    const id = idParam(req);
    const f = clientFields(req.body || {}, { partial: true });
    if (!Object.keys(f).length) fail(400, 'Нет полей для изменения');
    const old = await owned(pool, req, id);
    await txFor(req)(async c => {
      if (f.phone_key) await dupCheck(c, req.decor.cid, f.phone_key, id);
      const cols = Object.keys(f);
      await c.query(`UPDATE decor_clients SET ${cols.map((k, i) => `${k}=$${i + 3}`).join(', ')}, updated_at=NOW() WHERE id=$1 AND company_id=$2`,
        [id, req.decor.cid, ...cols.map(k => f[k])]);
      return { id };
    });
    audit(req, 'update', 'decor_client', id, old, f);
    res.json(await owned(pool, req, id));
  }));

  // ---------- Родственники ----------
  function relativeFields(b, { partial }) {
    const out = {};
    const has = k => Object.prototype.hasOwnProperty.call(b, k);
    if (!partial || has('relation')) out.relation = oneOf(b.relation, RELATIONS, 'Кем приходится');
    if (!partial || has('name')) out.name = text(b.name, 160) || fail(400, 'Имя родственника обязательно');
    if (has('birth_date')) out.birth_date = b.birth_date ? isoDate(b.birth_date, 'Дата рождения') : null;
    if (has('not_married')) out.not_married = b.not_married === true;
    if (has('expected_wedding_year')) {
      const y = b.expected_wedding_year === null || b.expected_wedding_year === '' ? null : toInt(b.expected_wedding_year);
      if (y !== null && !(y >= 2000 && y <= 2100)) fail(400, 'Ожидаемый год свадьбы: от 2000 до 2100');
      out.expected_wedding_year = y;
    }
    return out;
  }
  const relOf = async (req, clientId, rid) => (await pool.query(`SELECT id FROM decor_client_relatives WHERE id=$1 AND client_id=$2 AND company_id=$3`,
    [rid, clientId, req.decor.cid])).rows[0] || fail(404, 'Родственник не найден');

  app.post('/api/decor/clients/:id/relatives', A(SEE), wrap(async (req, res) => {
    const c = await owned(pool, req, idParam(req));
    const f = relativeFields(req.body || {}, { partial: false });
    const cols = Object.keys(f);
    const rid = await txFor(req)(async db => (await db.query(`INSERT INTO decor_client_relatives (company_id, client_id, ${cols.join(', ')})
      VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`, [req.decor.cid, c.id, ...cols.map(k => f[k])])).rows[0].id);
    audit(req, 'create', 'decor_client_relative', rid, null, { client_id: c.id, ...f });
    res.json({ id: rid, ...f });
  }));
  app.put('/api/decor/clients/:id/relatives/:rid', A(SEE), wrap(async (req, res) => {
    const c = await owned(pool, req, idParam(req));
    const r = await relOf(req, c.id, idParam(req, 'rid'));
    const f = relativeFields(req.body || {}, { partial: true });
    const cols = Object.keys(f);
    if (!cols.length) fail(400, 'Нет полей для изменения');
    await txFor(req)(db => db.query(`UPDATE decor_client_relatives SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(', ')} WHERE id=$1`,
      [r.id, ...cols.map(k => f[k])]).then(() => ({ id: r.id })));
    audit(req, 'update', 'decor_client_relative', r.id, null, f);
    res.json({ id: r.id, ...f });
  }));
  app.delete('/api/decor/clients/:id/relatives/:rid', A(SEE), wrap(async (req, res) => {
    const c = await owned(pool, req, idParam(req));
    const r = await relOf(req, c.id, idParam(req, 'rid'));
    await txFor(req)(db => db.query('DELETE FROM decor_client_relatives WHERE id=$1', [r.id]).then(() => ({ deleted: r.id })));
    audit(req, 'delete', 'decor_client_relative', r.id, null, null);
    res.json({ deleted: r.id });
  }));

  // Клиент заказа для карточки заказа (имя, сколько заказов) — orders.js
  async function clientRef(db, cid, clientId) {
    if (!clientId) return null;
    const c = (await clientsOf(db, cid, 'AND c.id=$2', [clientId]))[0];
    return c ? { id: c.id, name: c.name, orders: c.orders, kind: c.kind } : null;
  }

  return { linkClient, collectDates, clientRef, phoneKey };
};
module.exports.phoneKey = phoneKey;
module.exports.nextOccurrence = nextOccurrence;
