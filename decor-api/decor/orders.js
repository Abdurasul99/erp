// Заказы: канбан, карточка, лид, правка, дизайн (бронь), расходы, статус и закрытие; калькулятор дизайна.
const F = require('./formulas');
const { loadCompany } = require('./data');
const { makeView } = require('./views');
const { STATUSES, ORDER_TYPES } = require('./defaults');
const { wrap, fail, idParam, toInt, todayYmd, isoDate, money, intIn, text, oneOf } = require('./common');

module.exports = ({ app, pool, A, can, need, has, feature, audit, tx, txFor, idem, lockOrder, loadModel }) => {
  const FEAT = feature('decor-orders');

  // Полная карточка заказа после изменения (свежие данные)
  async function cardOf(req, id) {
    const { data, m } = await loadModel(req);
    const o = data.orders.find(x => x.id === id) || fail(404, 'Заказ не найден');
    return makeView(req, data, m).card(o);
  }

  // ---------- Проверка входных данных ----------
  // Команда: активные сотрудники своей компании
  async function teamIds(db, cid, list) {
    if (list === undefined) return undefined;
    if (!Array.isArray(list)) fail(400, 'team — список сотрудников');
    const ids = [...new Set(list.map(v => toInt(v) || fail(400, 'Команда: неверный сотрудник')))];
    if (!ids.length) return ids;
    const { rows } = await db.query('SELECT id FROM decor_employees WHERE company_id=$1 AND id = ANY($2) AND is_active', [cid, ids]);
    if (rows.length !== ids.length) fail(400, 'Команда: сотрудник не найден в вашей компании');
    return ids;
  }
  // Дизайн: вещи своей компании, количество — целое > 0; одна вещь дважды — складываем
  async function designLines(db, cid, list, { required = false } = {}) {
    if (!Array.isArray(list)) fail(400, 'lines — список вещей');
    const sum = new Map();
    for (const l of list) {
      const id = toInt(l?.item_id) || fail(400, 'Дизайн: неверная вещь');
      sum.set(id, (sum.get(id) || 0) + intIn(l?.qty, 'Дизайн: количество', 1));
    }
    if (required && !sum.size) fail(400, 'Добавьте вещи в дизайн');
    if (sum.size) {
      const { rows } = await db.query('SELECT id FROM decor_items WHERE company_id=$1 AND id = ANY($2)', [cid, [...sum.keys()]]);
      if (rows.length !== sum.size) fail(400, 'Дизайн: вещь не найдена в вашей компании');
    }
    return [...sum].map(([item_id, qty]) => ({ item_id, qty }));
  }
  async function saveTeam(c, cid, orderId, ids) {
    await c.query('DELETE FROM decor_order_team WHERE order_id=$1', [orderId]);
    for (const e of ids) await c.query('INSERT INTO decor_order_team (company_id, order_id, employee_id) VALUES ($1,$2,$3)', [cid, orderId, e]);
  }
  async function saveLines(c, cid, orderId, lines) {
    await c.query('DELETE FROM decor_order_lines WHERE order_id=$1', [orderId]);
    for (const l of lines) await c.query('INSERT INTO decor_order_lines (company_id, order_id, item_id, qty) VALUES ($1,$2,$3,$4)', [cid, orderId, l.item_id, l.qty]);
  }
  // Следующий номер заказа (строка настроек блокируется — два заказа не получат один номер)
  async function nextNo(c, cid) {
    const { rows: [s] } = await c.query(`UPDATE decor_settings SET order_seq=order_seq+1 WHERE company_id=$1
      RETURNING order_seq, transport_usd::float8 AS transport_usd, consumables_uzs::float8 AS consumables_uzs`, [cid]);
    return s ? { no: `D-${s.order_seq}`, transport_usd: s.transport_usd, consumables_uzs: s.consumables_uzs } : fail(409, 'Настройки компании не созданы');
  }

  // ---------- Список (канбан) и карточка ----------
  app.get('/api/decor/orders', A(FEAT), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const statuses = req.query.status ? String(req.query.status).split(',') : null;
    const from = req.query.from ? isoDate(req.query.from, 'from') : null;
    const to = req.query.to ? isoDate(req.query.to, 'to') : null;
    const q = text(req.query.q, 80)?.toLowerCase();
    const list = data.orders.filter(o => (!statuses || statuses.includes(o.status)) && (!from || o.event_date >= from) && (!to || o.event_date <= to)
      && (!q || [o.no, o.client, o.phone, o.address].some(x => String(x || '').toLowerCase().includes(q))));
    res.json(list.map(v.summary));
  }));

  app.get('/api/decor/orders/:id', A(FEAT), wrap(async (req, res) => res.json(await cardOf(req, idParam(req)))));

  // ---------- Новый лид (без дизайна) ----------
  app.post('/api/decor/orders', A(FEAT, can('create_order'), idem), wrap(async (req, res) => {
    const b = req.body || {};
    const client = text(b.client, 160) || fail(400, 'Клиент обязателен');
    const eventDate = isoDate(b.event_date, 'Дата события');
    const type = oneOf(b.type || 'big', ORDER_TYPES, 'Тип заказа');
    const status = oneOf(b.status || 'lead', ['lead', 'design'], 'Статус нового заказа');
    const team = (await teamIds(pool, req.decor.cid, b.team)) || [];
    const id = await txFor(req)(async c => {
      const n = await nextNo(c, req.decor.cid);
      const { rows: [o] } = await c.query(`INSERT INTO decor_orders (company_id, branch_id, no, client, phone, address, event_date, type, status,
          transport_usd, consumables_uzs, note, created_by)
        VALUES ($1,(SELECT id FROM branches WHERE company_id=$1 ORDER BY id LIMIT 1),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [req.decor.cid, n.no, client, text(b.phone, 40), text(b.address, 300), eventDate, type, status, n.transport_usd, n.consumables_uzs, text(b.note, 2000), req.user.id]);
      await saveTeam(c, req.decor.cid, o.id, team);
      return o.id;
    });
    audit(req, 'create', 'decor_order', id, null, { client, event_date: eventDate, status });
    res.json(await cardOf(req, id));
  }));

  // ---------- Правка заказа: клиент, дата, тип, команда ----------
  app.put('/api/decor/orders/:id', A(FEAT, can('create_order')), wrap(async (req, res) => {
    const id = idParam(req); const b = req.body || {};
    const team = await teamIds(pool, req.decor.cid, b.team);
    await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (o.status === 'closed') fail(409, 'Заказ закрыт — изменения не принимаются');
      const sets = []; const vals = [];
      const set = (k, v) => { vals.push(v); sets.push(`${k}=$${vals.length}`); };
      if (b.client !== undefined) set('client', text(b.client, 160) || fail(400, 'Клиент обязателен'));
      if (b.phone !== undefined) set('phone', text(b.phone, 40));
      if (b.address !== undefined) set('address', text(b.address, 300));
      if (b.event_date !== undefined) set('event_date', isoDate(b.event_date, 'Дата события'));
      if (b.type !== undefined) set('type', oneOf(b.type, ORDER_TYPES, 'Тип заказа'));
      if (b.note !== undefined) set('note', text(b.note, 2000));
      if (sets.length) { vals.push(id); await c.query(`UPDATE decor_orders SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`, vals); }
      if (team) await saveTeam(c, req.decor.cid, id, team);
      if (!sets.length && !team) fail(400, 'Нет полей для изменения');
    });
    audit(req, 'update', 'decor_order', id, null, b);
    res.json(await cardOf(req, id));
  }));

  // ---------- Дизайн (= бронь на период заказа) ----------
  app.put('/api/decor/orders/:id/lines', A(FEAT, can('create_order')), wrap(async (req, res) => {
    const id = idParam(req);
    const lines = await designLines(pool, req.decor.cid, req.body?.lines);
    await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (o.status === 'closed') fail(409, 'Заказ закрыт — изменения не принимаются');
      await saveLines(c, req.decor.cid, id, lines);
      await c.query('UPDATE decor_orders SET updated_at=NOW() WHERE id=$1', [id]);
    });
    audit(req, 'update', 'decor_order_lines', id, null, lines);
    res.json(await cardOf(req, id));
  }));

  // ---------- Цена и факт расходов («впишите факт после заказа») ----------
  app.put('/api/decor/orders/:id/costs', A(FEAT, can('see_finance')), wrap(async (req, res) => {
    const id = idParam(req); const b = req.body || {};
    const RULES = {
      price_usd: v => money(v, 'Цена клиенту, $'), transport_usd: v => money(v, 'Транспорт, $'),
      consumables_uzs: v => money(v, 'Расходники, сум'), rented_decor_usd: v => money(v, 'Декор у других студий, $'), other_usd: v => money(v, 'Прочее, $'),
    };
    const keys = Object.keys(RULES).filter(k => b[k] !== undefined);
    if (!keys.length) fail(400, 'Нет полей для изменения');
    const vals = keys.map(k => RULES[k](b[k]));
    await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (o.status === 'closed') fail(409, 'Заказ закрыт — себестоимость зафиксирована');
      await c.query(`UPDATE decor_orders SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_at=NOW() WHERE id=$${keys.length + 1}`, [...vals, id]);
    });
    audit(req, 'update', 'decor_order_costs', id, null, Object.fromEntries(keys.map((k, i) => [k, vals[i]])));
    res.json(await cardOf(req, id));
  }));

  // ---------- Статус. Закрытие — только по выполненному чек-листу, со снимком себестоимости ----------
  app.post('/api/decor/orders/:id/status', A(FEAT, can('change_status'), idem), wrap(async (req, res) => {
    const id = idParam(req);
    const to = oneOf(req.body?.status, STATUSES, 'Статус');
    const r = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (o.status === to) fail(400, 'Заказ уже в этом статусе');
      if (o.status === 'closed' && !req.decor.isOwner) fail(403, 'Открыть закрытый заказ может только учредитель', { code: 'owner_only' });
      if (to === 'closed') {
        const data = await loadCompany(c, req.decor.cid);
        const m = F.model(data, todayYmd());
        const od = data.orders.find(x => x.id === id);
        const { shortage_usd, ...checklist } = m.closeChecklist(od);
        if (!checklist.ok) {
          fail(409, 'Нельзя закрыть заказ: чек-лист не выполнен', { code: 'checklist', checklist: has(req, 'see_finance') ? { ...checklist, shortage_usd } : checklist });
        }
        // Недостача «под вопросом» фиксируется окончательно — в снимке себестоимости
        const cost = m.closingCost(od);
        await c.query(`UPDATE decor_orders SET status='closed', closed_at=NOW(), closed_by=$2, closed_cost=$3, updated_at=NOW() WHERE id=$1`,
          [id, req.user.id, JSON.stringify(cost)]);
        return { from: o.status, to, closed_cost: cost };
      }
      // Повторное открытие снимает снимок (он есть в журнале) — себестоимость снова считается по текущим данным
      const { rows: [old] } = await c.query('SELECT closed_cost FROM decor_orders WHERE id=$1', [id]);
      await c.query(`UPDATE decor_orders SET status=$2, updated_at=NOW()
        ${o.status === 'closed' ? ', closed_at=NULL, closed_by=NULL, closed_cost=NULL' : ''} WHERE id=$1`, [id, to]);
      return { from: o.status, to, reopened_cost: o.status === 'closed' ? old.closed_cost : undefined };
    });
    audit(req, 'status', 'decor_order', id, { status: r.from, closed_cost: r.reopened_cost }, { status: r.to, closed_cost: r.closed_cost });
    res.json(await cardOf(req, id));
  }));

  // ---------- Калькулятор дизайна ----------
  // Общая проверка тела калькулятора; order_id — дособрать дизайн лида/дизайна, а не создать новый заказ
  async function calcInput(req, { confirm }) {
    const b = req.body || {};
    const cid = req.decor.cid;
    const input = {
      order_id: toInt(b.order_id),
      event_date: isoDate(b.event_date, 'Дата события'),
      type: oneOf(b.type || 'big', ORDER_TYPES, 'Тип заказа'),
      team: (await teamIds(pool, cid, b.team || [])),
      lines: await designLines(pool, cid, b.lines || [], { required: confirm }),
      rented_decor_usd: money(b.rented_decor_usd ?? 0, 'Декор у других студий, $'),
      price_usd: money(b.price_usd ?? 0, 'Цена клиенту, $'),
      prepay_usd: money(b.prepay_usd ?? 0, 'Предоплата, $'),
    };
    if (confirm) {
      input.client = text(b.client, 160) || fail(400, 'Клиент обязателен');
      input.phone = text(b.phone, 40);
      input.address = text(b.address, 300);
      if (input.price_usd <= 0) fail(400, 'Укажите цену клиенту');
      if (input.prepay_usd > input.price_usd) fail(400, 'Предоплата больше цены');
    }
    return input;
  }
  // Расчёт черновика: свободно на период нового заказа и себестоимость по тем же формулам
  function calcResult(req, data, m, input) {
    const items = new Map(data.items.map(i => [i.id, i]));
    const p = { from: input.event_date, to: F.addDays(input.event_date, data.settings.days_on_site) };
    // why — почему вещи нет: кто держит её на самом тесном дне периода, откуда не вернулась (по новому правилу брони)
    const lines = input.lines.map(l => {
      const why = m.freeDetail(l.item_id, p.from, p.to, input.order_id || null);
      const free = why.free;
      const it = items.get(l.item_id);
      return { item_id: l.item_id, item: it.name, qty: l.qty, free, short: Math.max(0, l.qty - free), why,
        ...(has(req, 'see_finance') ? { wear_per_order_usd: F.wearPerOrder(it), wear_usd: F.wearPerOrder(it) * l.qty } : {}) };
    });
    const draft = { id: input.order_id || -1, status: 'booked', event_date: input.event_date, type: input.type, team: input.team,
      lines: input.lines, moves: [], payments: [], reports: [], transport_usd: data.settings.transport_usd,
      consumables_uzs: data.settings.consumables_uzs, rented_decor_usd: input.rented_decor_usd, other_usd: 0, price_usd: input.price_usd };
    const cost = m.liveCost(draft);
    return { period: p, lines, any_short: lines.some(l => l.short > 0), below_cost: cost.below_cost, ...(has(req, 'see_finance') ? { cost } : {}) };
  }

  app.post('/api/decor/calc/preview', A(FEAT, can('create_order')), wrap(async (req, res) => {
    const input = await calcInput(req, { confirm: false });
    const { data, m } = await loadModel(req);
    res.json(calcResult(req, data, m, input));
  }));

  // «Подтвердить»: заказ (или дособранный лид), бронь на период, заявка на склад, предоплата в кассу — одной транзакцией
  app.post('/api/decor/calc/confirm', A(FEAT, can('create_order'), idem), wrap(async (req, res) => {
    const input = await calcInput(req, { confirm: true });
    if (input.prepay_usd > 0) need(req, 'confirm_money');      // предоплата ложится сразу в кассу — подтверждает только касса
    const cid = req.decor.cid;
    const status = input.prepay_usd > 0 ? 'booked' : 'prepay';
    const id = await txFor(req)(async c => {
      let orderId = input.order_id;
      const { rows: [s] } = await c.query('SELECT transport_usd::float8 AS t, consumables_uzs::float8 AS k FROM decor_settings WHERE company_id=$1', [cid]);
      if (orderId) {
        const o = await lockOrder(c, req, orderId);
        if (!['lead', 'design'].includes(o.status)) fail(409, `Заказ ${o.no} уже оформлен`);
        await c.query(`UPDATE decor_orders SET client=$2, phone=$3, address=$4, event_date=$5, type=$6, status=$7, price_usd=$8,
            transport_usd=$9, consumables_uzs=$10, rented_decor_usd=$11, updated_at=NOW() WHERE id=$1`,
        [orderId, input.client, input.phone, input.address, input.event_date, input.type, status, input.price_usd, s.t, s.k, input.rented_decor_usd]);
      } else {
        const n = await nextNo(c, cid);
        orderId = (await c.query(`INSERT INTO decor_orders (company_id, branch_id, no, client, phone, address, event_date, type, status, price_usd,
            transport_usd, consumables_uzs, rented_decor_usd, created_by)
          VALUES ($1,(SELECT id FROM branches WHERE company_id=$1 ORDER BY id LIMIT 1),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [cid, n.no, input.client, input.phone, input.address, input.event_date, input.type, status, input.price_usd,
          n.transport_usd, n.consumables_uzs, input.rented_decor_usd, req.user.id])).rows[0].id;
      }
      await saveTeam(c, cid, orderId, input.team);
      await saveLines(c, cid, orderId, input.lines);
      if (input.prepay_usd > 0) {
        await c.query(`INSERT INTO decor_payments (company_id, order_id, amount_usd, kind, status, created_by, confirmed_at, confirmed_by)
          VALUES ($1,$2,$3,'prepay','confirmed',$4,NOW(),$4)`, [cid, orderId, input.prepay_usd, req.user.id]);
      }
      return orderId;
    });
    audit(req, input.order_id ? 'confirm_design' : 'create', 'decor_order', id, null,
      { status, price_usd: input.price_usd, prepay_usd: input.prepay_usd, lines: input.lines, team: input.team });
    const { data, m } = await loadModel(req);
    const o = data.orders.find(x => x.id === id);
    const v = makeView(req, data, m);
    res.json({ order: v.card(o), shortages: v.card(o).lines.filter(l => l.short > 0) });
  }));
};
