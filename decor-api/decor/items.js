// Декор: вещи, цена, ресурс, износ за 1 заказ и остатки на сегодня; журнал склада (D25).
// Вещь заводит, переименовывает и убирает в архив тот, у кого «вести склад» или «менять настройки»; цену и ресурс
// меняет только «менять настройки». «Куплено» меняется только операциями журнала (stock.js): приход, списание
// (не больше, чем лежит на складе), инвентаризация (насчитали на складе − должно быть по системе = разница).
// Вещи не удаляются (на них ссылаются заказы) — их выключают (is_active=false, «архив»).
const F = require('./formulas');
const { loadCompany } = require('./data');
const { stockMove } = require('./stock');
const { wrap, fail, idParam, toInt, todayYmd, money, intIn, text, oneOf } = require('./common');

const STOCK_OPS = ['receipt', 'writeoff', 'count'];
const MAX_QTY = 1000000;

module.exports = ({ app, pool, A, can, has, feature, audit, txFor, loadModel }) => {
  const WH = feature('decor-warehouse');
  const MANAGE = can('manage_items', 'edit_settings');
  // Цена и износ — деньги: только тем, кто видит себестоимость или меняет настройки (кладовщику и ПМ — количества)
  const view = (it, m, req) => ({
    id: it.id, name: it.name, qty_bought: it.qty_bought, resource_orders: it.resource_orders,
    is_active: it.is_active, sort_order: it.sort_order, ...m.itemTotals(it.id),
    ...(has(req, 'see_finance') || has(req, 'edit_settings') ? { price_usd: it.price_usd, wear_per_order_usd: F.wearPerOrder(it) } : {}),
  });
  const fresh = async (req, id) => { const { data, m } = await loadModel(req); return view(data.items.find(x => x.id === id), m, req); };

  app.get('/api/decor/items', A(), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    res.json(data.items.filter(it => it.is_active || req.query.all === '1').map(it => view(it, m, req)));
  }));

  const fields = (req, partial) => {
    const b = req.body || {};
    if (b.qty_bought !== undefined && partial) {
      fail(400, '«Куплено» меняется операциями склада: приход, списание, инвентаризация', { code: 'use_stock_ops' });
    }
    if ((b.price_usd !== undefined || b.resource_orders !== undefined) && !has(req, 'edit_settings')) {
      fail(403, 'Цену и ресурс меняет тот, у кого полномочие «менять настройки»', { code: 'no_permission', actions: ['edit_settings'] });
    }
    const out = {};
    if (!partial || b.name !== undefined) out.name = text(b.name, 160) || fail(400, 'Название вещи обязательно');
    if (!partial || b.price_usd !== undefined) out.price_usd = money(b.price_usd ?? 0, 'Цена за шт, $');
    if (!partial || b.resource_orders !== undefined) out.resource_orders = intIn(b.resource_orders ?? 1, 'Ресурс, заказов', 1);
    if (b.is_active !== undefined) out.is_active = !!b.is_active;
    if (b.sort_order !== undefined) out.sort_order = intIn(b.sort_order, 'Порядок', 0);
    return out;
  };

  // Новая вещь: «Куплено» на старте — первая строка журнала (opening)
  app.post('/api/decor/items', A(MANAGE), wrap(async (req, res) => {
    const f = fields(req, false);
    const qty = intIn(req.body?.qty_bought ?? 0, 'Куплено, шт', 0, MAX_QTY);
    const comment = text(req.body?.comment, 500);
    const it = await txFor(req)(async c => {
      const { rows: [row] } = await c.query(`INSERT INTO decor_items (company_id, name, qty_bought, price_usd, resource_orders, sort_order)
        VALUES ($1,$2,0,$3,$4, COALESCE($5, (SELECT COALESCE(MAX(sort_order),0)+1 FROM decor_items WHERE company_id=$1))) RETURNING id`,
      [req.decor.cid, f.name, f.price_usd, f.resource_orders, f.sort_order ?? null]);
      await stockMove(c, { cid: req.decor.cid, itemId: row.id, kind: 'opening', qty, userId: req.user.id, comment: comment || 'Новая вещь' });
      return row;
    });
    audit(req, 'create', 'decor_item', it.id, null, { ...f, qty_bought: qty });
    res.json(await fresh(req, it.id));
  }));

  // Название, архив, порядок; цена и ресурс — только «менять настройки»
  app.put('/api/decor/items/:id', A(MANAGE), wrap(async (req, res) => {
    const id = idParam(req);
    const { rows: [old] } = await pool.query('SELECT name, price_usd::float8 AS price_usd, resource_orders, is_active, sort_order FROM decor_items WHERE id=$1 AND company_id=$2', [id, req.decor.cid]);
    if (!old) fail(404, 'Вещь не найдена');
    const f = fields(req, true);
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'Нет полей для изменения');
    await txFor(req)(c => c.query(`UPDATE decor_items SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1} AND company_id=$${keys.length + 2}`,
      [...keys.map(k => f[k]), id, req.decor.cid]).then(r => ({ updated: r.rowCount })));
    audit(req, 'update', 'decor_item', id, old, f);
    res.json(await fresh(req, id));
  }));

  // ---------- Операции склада: приход, списание, инвентаризация ----------
  // «На складе» (in_warehouse) = куплено − пропавшее в закрытых − недостача под вопросом − на объектах — как на экране.
  app.post('/api/decor/items/:id/stock', A(WH, MANAGE), wrap(async (req, res) => {
    const id = idParam(req);
    const b = req.body || {};
    const kind = oneOf(b.kind, STOCK_OPS, 'Операция');
    const comment = text(b.comment, 500);
    const r = await txFor(req)(async c => {
      const { rows: [it] } = await c.query('SELECT id, name, is_active FROM decor_items WHERE id=$1 AND company_id=$2 FOR UPDATE', [id, req.decor.cid]);
      if (!it) fail(404, 'Вещь не найдена');
      if (!it.is_active) fail(409, `«${it.name}» в архиве — сначала верните её из архива`, { code: 'archived' });
      const inWarehouse = F.model(await loadCompany(c, req.decor.cid), todayYmd()).itemTotals(id).in_warehouse;
      const base = { cid: req.decor.cid, itemId: id, kind, userId: req.user.id, comment };
      if (kind === 'receipt') {
        const qty = intIn(b.qty, 'Приход, шт', 1, MAX_QTY);
        return { ...(await stockMove(c, { ...base, qty })), qty, in_warehouse_before: inWarehouse };
      }
      if (kind === 'writeoff') {
        const qty = intIn(b.qty, 'Списать, шт', 1, MAX_QTY);
        if (!comment) fail(400, 'Напишите причину списания', { code: 'comment_required' });
        if (qty > inWarehouse) fail(409, `На складе только ${Math.max(0, inWarehouse)} шт — списать больше нельзя`, { code: 'not_enough', in_warehouse: inWarehouse });
        return { ...(await stockMove(c, { ...base, qty: -qty })), qty: -qty, in_warehouse_before: inWarehouse };
      }
      const counted = intIn(b.counted, 'Насчитали на складе, шт', 0, MAX_QTY);
      const diff = counted - inWarehouse;
      if (diff !== 0 && !comment) fail(400, 'Есть расхождение — напишите, что случилось', { code: 'comment_required', diff });
      return { ...(await stockMove(c, { ...base, qty: diff, counted, expected: inWarehouse })), qty: diff, counted, expected: inWarehouse };
    });
    audit(req, `stock_${kind}`, 'decor_item', id, null, { ...r, comment });
    res.json({ move: { id: r.id, kind, qty: r.qty, qty_after: r.qty_after, counted: r.counted, expected: r.expected }, item: await fresh(req, id) });
  }));

  // ---------- История вещи: операции склада и движения по заказам ----------
  app.get('/api/decor/items/:id/history', A(WH), wrap(async (req, res) => {
    const id = idParam(req);
    const { cid } = req.decor;
    const [stock, orders] = await Promise.all([
      pool.query(`SELECT s.id, s.kind, s.qty, s.qty_after, s.counted, s.expected, s.comment, s.fund_spend_id, s.created_at,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS who
        FROM decor_stock_moves s LEFT JOIN users u ON u.id=s.user_id
        WHERE s.company_id=$1 AND s.item_id=$2 ORDER BY s.id DESC LIMIT 500`, [cid, id]),
      pool.query(`SELECT m.id, m.type, m.qty, m.created_at, o.id AS order_id, o.no, o.client,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS who
        FROM decor_moves m JOIN decor_orders o ON o.id=m.order_id LEFT JOIN users u ON u.id=m.user_id
        WHERE m.company_id=$1 AND m.item_id=$2 ORDER BY m.id DESC LIMIT 500`, [cid, id]),
    ]);
    const { data, m } = await loadModel(req);
    const it = data.items.find(x => x.id === id) || fail(404, 'Вещь не найдена');
    const moves = [
      ...stock.rows.map(x => ({ source: 'stock', ...x })),
      ...orders.rows.map(x => ({ source: 'order', id: x.id, kind: x.type, qty: x.qty, created_at: x.created_at, order_id: x.order_id, no: x.no, client: x.client, who: x.who })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || (a.source === b.source ? b.id - a.id : 0));
    res.json({ item: view(it, m, req), moves });
  }));

  // ---------- Журнал склада компании (только операции склада), новые сверху; before — следующая страница ----------
  app.get('/api/decor/stock-moves', A(WH), wrap(async (req, res) => {
    const limit = req.query.limit ? intIn(req.query.limit, 'limit', 1, 500) : 100;
    const before = toInt(req.query.before);
    const kind = req.query.kind ? oneOf(req.query.kind, ['opening', 'purchase', ...STOCK_OPS], 'Операция') : null;
    const { rows } = await pool.query(`SELECT s.id, s.item_id, i.name AS item, s.kind, s.qty, s.qty_after, s.counted, s.expected, s.comment,
        s.fund_spend_id, s.created_at, COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS who
      FROM decor_stock_moves s JOIN decor_items i ON i.id=s.item_id LEFT JOIN users u ON u.id=s.user_id
      WHERE s.company_id=$1 AND ($2::int IS NULL OR s.id < $2) AND ($3::text IS NULL OR s.kind = $3)
      ORDER BY s.id DESC LIMIT $4`, [req.decor.cid, before, kind, limit + 1]);
    res.json({ moves: rows.slice(0, limit), more: rows.length > limit });
  }));
};
