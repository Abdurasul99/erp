// Декор: вещи, цена, ресурс, износ за 1 заказ и остатки на сегодня. Цену и ресурс меняет тот, у кого «менять настройки».
// Вещи не удаляются (на них ссылаются заказы) — их выключают (is_active=false).
const F = require('./formulas');
const { wrap, fail, idParam, money, intIn, text } = require('./common');

module.exports = ({ app, pool, A, can, has, audit, txFor, loadModel }) => {
  // Цена и износ — деньги: только тем, кто видит себестоимость или меняет настройки (кладовщику и ПМ — количества)
  const view = (it, m, req) => ({
    id: it.id, name: it.name, qty_bought: it.qty_bought, resource_orders: it.resource_orders,
    is_active: it.is_active, sort_order: it.sort_order, ...m.itemTotals(it.id),
    ...(has(req, 'see_finance') || has(req, 'edit_settings') ? { price_usd: it.price_usd, wear_per_order_usd: F.wearPerOrder(it) } : {}),
  });

  app.get('/api/decor/items', A(), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    res.json(data.items.filter(it => it.is_active || req.query.all === '1').map(it => view(it, m, req)));
  }));

  const fields = (b, partial) => {
    const out = {};
    if (!partial || b.name !== undefined) out.name = text(b.name, 160) || fail(400, 'Название вещи обязательно');
    if (!partial || b.qty_bought !== undefined) out.qty_bought = intIn(b.qty_bought ?? 0, 'Куплено, шт', 0);
    if (!partial || b.price_usd !== undefined) out.price_usd = money(b.price_usd ?? 0, 'Цена за шт, $');
    if (!partial || b.resource_orders !== undefined) out.resource_orders = intIn(b.resource_orders ?? 1, 'Ресурс, заказов', 1);
    if (b.is_active !== undefined) out.is_active = !!b.is_active;
    if (b.sort_order !== undefined) out.sort_order = intIn(b.sort_order, 'Порядок', 0);
    return out;
  };

  app.post('/api/decor/items', A(can('edit_settings')), wrap(async (req, res) => {
    const f = fields(req.body || {}, false);
    const it = await txFor(req)(async c => (await c.query(`INSERT INTO decor_items (company_id, name, qty_bought, price_usd, resource_orders, sort_order)
      VALUES ($1,$2,$3,$4,$5, COALESCE($6, (SELECT COALESCE(MAX(sort_order),0)+1 FROM decor_items WHERE company_id=$1))) RETURNING id`,
    [req.decor.cid, f.name, f.qty_bought, f.price_usd, f.resource_orders, f.sort_order ?? null])).rows[0]);
    audit(req, 'create', 'decor_item', it.id, null, f);
    const { data, m } = await loadModel(req);
    res.json(view(data.items.find(x => x.id === it.id), m, req));
  }));

  app.put('/api/decor/items/:id', A(can('edit_settings')), wrap(async (req, res) => {
    const id = idParam(req);
    const { rows: [old] } = await pool.query('SELECT name, qty_bought, price_usd::float8 AS price_usd, resource_orders, is_active FROM decor_items WHERE id=$1 AND company_id=$2', [id, req.decor.cid]);
    if (!old) fail(404, 'Вещь не найдена');
    const f = fields(req.body || {}, true);
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'Нет полей для изменения');
    await txFor(req)(c => c.query(`UPDATE decor_items SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1} AND company_id=$${keys.length + 2}`,
      [...keys.map(k => f[k]), id, req.decor.cid]).then(r => ({ updated: r.rowCount })));
    audit(req, 'update', 'decor_item', id, old, f);
    const { data, m } = await loadModel(req);
    res.json(view(data.items.find(x => x.id === id), m, req));
  }));
};
