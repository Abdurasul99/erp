// Деньги: оплаты клиента, путь «ПМ → кассир», касса, себестоимость по всем заказам, фонд материалов.
// В кассу (сразу подтверждено) записывает только тот, кто подтверждает деньги. Сотрудник с «принимать деньги»
// записывает деньги на себя; «сдал» отмечает он сам (или касса) — с фото чека/перевода (D24), подтверждает только касса.
// Касса = подтверждённые поступления − выплаты команде − покупки из фонда материалов.
// Фонд материалов = износ + окончательная недостача закрытых заказов (из снимков) − «возвращено после закрытия»;
// «Купил декор» уменьшает фонд и кассу, с вещью — пополняет склад (цена вещи — средняя, цена покупки или без изменений).
const F = require('./formulas');
const { loadCompany } = require('./data');
const { makeView } = require('./views');
const { PAYMENT_KINDS, PRICE_MODES } = require('./defaults');
const { wrap, fail, idParam, toInt, money, oneOf, intIn, text, todayYmd } = require('./common');
const U = require('./uploads');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

module.exports = ({ app, pool, A, can, need, has, feature, audit, tx, txFor, idem, lockOrder, loadModel, requireEvidence, saveEvidence }) => {
  const FIN = feature('decor-finance');

  const lockPayment = async (c, req, id) => {
    const { rows: [p] } = await c.query(`SELECT p.id, p.order_id, p.status, p.amount_usd::float8 AS amount_usd, p.received_by_employee_id, e.user_id AS receiver_user
      FROM decor_payments p LEFT JOIN decor_employees e ON e.id=p.received_by_employee_id
      WHERE p.id=$1 AND p.company_id=$2 FOR UPDATE OF p`, [id, req.decor.cid]);
    return p || fail(404, 'Оплата не найдена');
  };

  // ---------- Принять оплату по заказу ----------
  app.post('/api/decor/orders/:id/payments', A(FIN, can('take_money', 'confirm_money'), idem), wrap(async (req, res) => {
    const id = idParam(req); const b = req.body || {};
    const amount = money(b.amount_usd, 'Сумма, $', { gt: true });
    const kind = oneOf(b.kind || 'final', PAYMENT_KINDS, 'Вид оплаты');
    const receiver = b.received_by_employee_id === null || b.received_by_employee_id === undefined || b.received_by_employee_id === 'cashbox'
      ? null : toInt(b.received_by_employee_id) || fail(400, 'Кто принял: сотрудник или касса');
    if (receiver === null) need(req, 'confirm_money');               // в кассу — сразу подтверждено
    else {
      need(req, 'take_money', 'confirm_money');
      const { rows: [e] } = await pool.query('SELECT id, user_id, is_active FROM decor_employees WHERE id=$1 AND company_id=$2', [receiver, req.decor.cid]);
      if (!e || !e.is_active) fail(400, 'Сотрудник не найден в вашей компании');
      // Без «подтверждать деньги» можно записать только деньги, принятые самим собой
      if (!has(req, 'confirm_money') && e.user_id !== req.user.id) fail(403, 'Записать можно только деньги, которые приняли вы сами', { code: 'not_self' });
    }
    const pid = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (['lead', 'closed'].includes(o.status)) fail(409, 'Оплата принимается по оформленному и не закрытому заказу');
      const { rows: [p] } = await c.query(`INSERT INTO decor_payments (company_id, order_id, amount_usd, kind, received_by_employee_id, status, created_by, confirmed_at, confirmed_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.decor.cid, id, amount, kind, receiver, receiver ? 'at_pm' : 'confirmed', req.user.id, receiver ? null : new Date(), receiver ? null : req.user.id]);
      return p.id;
    });
    audit(req, 'create', 'decor_payment', pid, null, { order_id: id, amount_usd: amount, kind, received_by_employee_id: receiver });
    const { data, m } = await loadModel(req);
    res.json(makeView(req, data, m).card(data.orders.find(x => x.id === id)));
  }));

  // ---------- «Сдал кассиру» — сам принявший или касса, с фото чека/перевода (требование этапа handover) ----------
  app.post('/api/decor/payments/:id/hand', A(FIN, idem), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const comment = text(req.body?.comment, 1000);
    await U.checkSizes(pool, req);
    const p = await txFor(req)(async c => {
      const pay = await lockPayment(c, req, id);
      if (pay.status !== 'at_pm') fail(409, pay.status === 'handed' ? 'Уже отмечено: сдано, ждёт кассу' : 'Деньги уже в кассе');
      if (pay.receiver_user !== req.user.id && !has(req, 'confirm_money')) fail(403, 'Отметить «сдал» может тот, кто принял деньги', { code: 'not_self' });
      await requireEvidence(c, req, 'handover', { comment });
      await saveEvidence(c, req, { orderId: pay.order_id, stage: 'handover', paymentId: id, comment });
      await c.query("UPDATE decor_payments SET status='handed', handed_at=NOW(), handed_by=$2 WHERE id=$1", [id, req.user.id]);
      return pay;
    });
    audit(req, 'hand', 'decor_payment', id, { status: 'at_pm' }, { status: 'handed', files: (req.files || []).length });
    res.json({ id, order_id: p.order_id, status: 'handed' });
  })));

  // ---------- Подтверждение кассой (только «подтверждать деньги») ----------
  app.post('/api/decor/payments/:id/confirm', A(FIN, can('confirm_money'), idem), wrap(async (req, res) => {
    const id = idParam(req);
    const p = await txFor(req)(async c => {
      const pay = await lockPayment(c, req, id);
      if (pay.status === 'confirmed') fail(409, 'Деньги уже в кассе');
      await c.query(`UPDATE decor_payments SET status='confirmed', confirmed_at=NOW(), confirmed_by=$2,
        handed_at=COALESCE(handed_at, NOW()), handed_by=COALESCE(handed_by, $2) WHERE id=$1`, [id, req.user.id]);
      return pay;
    });
    audit(req, 'confirm', 'decor_payment', id, { status: p.status }, { status: 'confirmed' });
    res.json({ id, order_id: p.order_id, status: 'confirmed', amount_usd: p.amount_usd });
  }));

  // ---------- Деньги: долги сотрудников, очередь на подтверждение, все поступления, касса ----------
  // Касса и все деньги — тем, кто подтверждает деньги или видит финансы; с «принимать деньги» — только свои
  app.get('/api/decor/money', A(FIN, can('see_finance', 'confirm_money', 'take_money')), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const all = has(req, 'see_finance') || has(req, 'confirm_money');
    const mine = req.decor.employee?.id || null;
    const receipt = (o, p) => o.evidence.filter(e => e.stage === 'handover' && e.payment_id === p.id).flatMap(e => e.files);
    const rows = data.orders.flatMap(o => o.payments.map(p => ({ id: p.id, order_id: o.id, no: o.no, client: o.client, amount_usd: p.amount_usd,
      kind: p.kind, status: p.status, date: p.pay_date, received_by: v.person(p.received_by_employee_id),
      handed_at: p.handed_at, confirmed_at: p.confirmed_at, receipt: receipt(o, p) })))
      .filter(p => all || (mine && p.received_by?.id === mine))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    const debts = data.employees.filter(e => all || e.id === mine).map(e => ({ employee: v.person(e.id), amount_usd: m.pmDebt(e.id) })).filter(d => d.amount_usd > 0);
    res.json({
      debts, debt_total_usd: debts.reduce((a, d) => a + d.amount_usd, 0),
      queue: rows.filter(p => p.status !== 'confirmed'), payments: rows,
      ...(all ? { cash_box_usd: m.cashBox(), cash: m.cashParts() } : {}),
    });
  }));

  // ---------- Себестоимость по всем заказам (план/факт/снимок), итоги ----------
  // month=ГГГГ-ММ — заказы с датой события в этом месяце (без month — все); months — месяцы, в которых есть заказы
  app.get('/api/decor/finance/costs', A(FIN, can('see_finance')), wrap(async (req, res) => {
    const month = req.query.month ? (MONTH_RE.test(req.query.month) ? req.query.month : fail(400, 'Месяц: формат ГГГГ-ММ')) : null;
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const KEYS = ['wear', 'shortage', 'team', 'transport', 'consumables', 'rented', 'other', 'direct', 'fixed', 'full', 'price', 'profit'];
    const priced = data.orders.filter(o => o.price_usd > 0);
    const months = [...new Set(priced.map(o => o.event_date.slice(0, 7)))].sort().reverse();
    // recovered_after_close_usd — сколько нашлось из списанной недостачи после закрытия (снимок при этом не меняется)
    const rows = priced.filter(o => !month || o.event_date.startsWith(month)).map(o => ({ id: o.id, no: o.no, client: o.client, status: o.status, event_date: o.event_date,
      ...v.costView(o), recovered_after_close_usd: m.recoveredAfterCloseUsd(o) }));
    const total = Object.fromEntries(KEYS.map(k => [k, rows.reduce((a, r) => a + r[k], 0)]));
    const closed = rows.filter(r => r.status === 'closed');
    const modes = Object.fromEntries(['plan', 'partial', 'fact', 'closed'].map(k => [k, rows.filter(r => r.mode === k).length]));
    res.json({ month, months, rows, total, modes, closed_profit_usd: closed.reduce((a, r) => a + r.profit, 0),
      closed_shortage_usd: closed.reduce((a, r) => a + r.shortage, 0), closed_recovered_usd: closed.reduce((a, r) => a + r.recovered_after_close_usd, 0) });
  }));

  // ---------- Фонд материалов: накоплено / потрачено / остаток, покупки ----------
  const fundView = (data, m) => {
    const items = new Map(data.items.map(i => [i.id, i]));
    const byUser = new Map(data.employees.filter(e => e.user_id).map(e => [e.user_id, e.name]));
    return { ...m.fund(), cash: m.cashParts(),
      purchases: [...data.fundSpend].reverse().map(x => ({ id: x.id, date: x.spend_date, amount_usd: x.amount_usd, comment: x.comment,
        item: x.item_id ? { id: x.item_id, name: items.get(x.item_id)?.name || null } : null, qty: x.qty, unit_price_usd: x.unit_price_usd,
        new_item: x.new_item, by: byUser.get(x.created_by) || null })) };
  };
  app.get('/api/decor/finance/fund', A(FIN, can('see_finance', 'confirm_money')), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    res.json(fundView(data, m));
  }));

  // «Купил декор»: сумма и что купили. С вещью — склад пополняется (qty_bought += qty в той же транзакции), цена вещи:
  // average — средняя (по умолчанию), replace — цена покупки, keep — без изменений; ресурс — по выбору.
  // Новая вещь (new_item: { name }) заводится прямо здесь (нужен ресурс). Без вещи — просто трата из фонда (ремонт).
  // Закрытые заказы не меняются (снимок); у открытых износ пересчитается по новой цене.
  app.post('/api/decor/finance/fund/spend', A(FIN, can('confirm_money'), idem), wrap(async (req, res) => {
    const b = req.body || {};
    const given = v => v !== undefined && v !== null && v !== '';
    const amount = money(b.amount_usd, 'Сумма, $', { gt: true });
    const comment = text(b.comment, 500) || fail(400, 'Напишите, что купили или на что потратили');
    const itemId = toInt(b.item_id);
    const newItem = b.new_item && typeof b.new_item === 'object' ? b.new_item : null;
    if (itemId && newItem) fail(400, 'Либо вещь со склада, либо новая вещь');
    const withItem = Boolean(itemId || newItem);
    if (!withItem && (given(b.qty) || given(b.unit_price_usd))) fail(400, 'Количество и цена за штуку указываются вместе с вещью');
    const qty = withItem ? intIn(b.qty, 'Количество, шт', 1, 1000000) : null;
    const unit = withItem ? (given(b.unit_price_usd) ? money(b.unit_price_usd, 'Цена за штуку, $') : Math.round((amount / qty) * 100) / 100) : null;
    const mode = withItem ? oneOf(b.price_mode || 'average', PRICE_MODES, 'Цена вещи') : null;
    const resource = withItem && given(b.resource_orders) ? intIn(b.resource_orders, 'Ресурс, заказов', 1, 100000) : null;
    const newName = newItem ? (text(newItem.name, 160) || fail(400, 'Название новой вещи')) : null;
    if (newItem && resource === null) fail(400, 'Ресурс новой вещи: сколько заказов она выдерживает');
    const r = await txFor(req)(async c => {
      let item = null;
      if (newItem) {
        const { rows: [it] } = await c.query(`INSERT INTO decor_items (company_id, name, qty_bought, price_usd, resource_orders, sort_order)
          VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(max(sort_order),0)+1 FROM decor_items WHERE company_id=$1))
          RETURNING id, name, qty_bought, price_usd::float8 AS price_usd, resource_orders`, [req.decor.cid, newName, qty, unit, resource]);
        item = { ...it, qty_before: 0, price_before: null, resource_before: null };
      } else if (itemId) {
        const { rows: [old] } = await c.query(`SELECT id, qty_bought, price_usd::float8 AS price_usd, resource_orders
          FROM decor_items WHERE id=$1 AND company_id=$2 FOR UPDATE`, [itemId, req.decor.cid]);
        if (!old) fail(400, 'Вещь не найдена в вашей компании');
        // «Старое количество» для средней — сколько вещи реально есть: куплено − окончательно пропавшее
        const present = F.model(await loadCompany(c, req.decor.cid), todayYmd()).presentQty(itemId);
        const price = mode === 'average' ? F.averagePrice(present, old.price_usd, qty, unit) : mode === 'replace' ? unit : old.price_usd;
        const { rows: [it] } = await c.query(`UPDATE decor_items SET qty_bought=qty_bought+$3, price_usd=$4, resource_orders=COALESCE($5, resource_orders), is_active=true
          WHERE id=$1 AND company_id=$2 RETURNING id, name, qty_bought, price_usd::float8 AS price_usd, resource_orders`,
        [itemId, req.decor.cid, qty, price, resource]);
        item = { ...it, qty_before: old.qty_bought, present_before: present, price_before: old.price_usd, resource_before: old.resource_orders };
      }
      const { rows: [sp] } = await c.query(`INSERT INTO decor_fund_spend (company_id, amount_usd, comment, item_id, qty, unit_price_usd, new_item, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [req.decor.cid, amount, comment, item?.id || null, qty, unit, Boolean(newItem), req.user.id]);
      return { spend_id: sp.id, item };
    });
    audit(req, 'fund_spend', 'decor_fund_spend', r.spend_id, r.item ? { qty_bought: r.item.qty_before, price_usd: r.item.price_before } : null,
      { amount_usd: amount, comment, item_id: r.item?.id || null, qty, unit_price_usd: unit, price_mode: mode, new_item: Boolean(newItem),
        qty_bought: r.item?.qty_bought, price_usd: r.item?.price_usd });
    const { data, m } = await loadModel(req);
    res.json({ spend_id: r.spend_id, item: r.item, price_mode: mode, ...fundView(data, m) });
  }));
};
