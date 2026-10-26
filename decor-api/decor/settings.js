// Настройки компании: нормы расчёта и курс, полномочия должностей, ставки сдельной оплаты, управление панелью.
const F = require('./formulas');
const { POSITIONS, ACTIONS, LEVELS, ORDER_TYPES, PANEL_SECTIONS } = require('./defaults');
const { wrap, fail, money, intIn, oneOf } = require('./common');

const NUM_COLS = `rate_uzs::float8 AS rate_uzs, transport_usd::float8 AS transport_usd, consumables_uzs::float8 AS consumables_uzs,
  target_usd::float8 AS target_usd, repair_uzs::float8 AS repair_uzs, other_fixed_usd::float8 AS other_fixed_usd,
  expected_orders, days_on_site, panel_off`;

module.exports = ({ app, pool, A, can, has, ownerOnly, audit, txFor }) => {
  const read = async cid => (await pool.query(`SELECT ${NUM_COLS} FROM decor_settings WHERE company_id=$1`, [cid])).rows[0]
    || fail(409, 'Настройки компании не созданы');

  // Курс, N дней на объекте и панель нужны всем; нормы и постоянные расходы — тем, кто видит деньги или меняет настройки
  app.get('/api/decor/settings', A(), wrap(async (req, res) => {
    const s = await read(req.decor.cid);
    const base = { rate_uzs: s.rate_uzs, days_on_site: s.days_on_site, panel_off: s.panel_off };
    if (!has(req, 'see_finance') && !has(req, 'edit_settings')) return res.json(base);
    res.json({ ...s, fixed_monthly_usd: F.fixedMonthly(s), fixed_share_usd: F.fixedShare(s) });
  }));

  app.put('/api/decor/settings', A(can('edit_settings')), wrap(async (req, res) => {
    const b = req.body || {};
    const RULES = {
      rate_uzs: v => money(v, 'Курс, сум за $1', { gt: true }),
      transport_usd: v => money(v, 'Транспорт на заказ, $'),
      consumables_uzs: v => money(v, 'Расходники на заказ, сум'),
      target_usd: v => money(v, 'Таргет в месяц, $'),
      repair_uzs: v => money(v, 'Ремонт и стирка в месяц, сум'),
      other_fixed_usd: v => money(v, 'Прочие постоянные в месяц, $'),
      expected_orders: v => intIn(v, 'Заказов в месяц', 1, 10000),
      days_on_site: v => intIn(v, 'Дней на объекте', 0, 30),
    };
    const sets = []; const vals = [];
    for (const [k, rule] of Object.entries(RULES)) {
      if (Object.prototype.hasOwnProperty.call(b, k)) { vals.push(rule(b[k])); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) fail(400, 'Нет полей для изменения');
    const old = await read(req.decor.cid);
    vals.push(req.user.id, req.decor.cid);
    await txFor(req)(c => c.query(`UPDATE decor_settings SET ${sets.join(', ')}, updated_by=$${vals.length - 1}, updated_at=NOW() WHERE company_id=$${vals.length}`, vals)
      .then(() => ({ updated: Object.keys(RULES).filter(k => Object.prototype.hasOwnProperty.call(b, k)) })));
    const s = await read(req.decor.cid);
    audit(req, 'update', 'decor_settings', req.decor.cid, old, s);
    res.json({ ...s, fixed_monthly_usd: F.fixedMonthly(s), fixed_share_usd: F.fixedShare(s) });
  }));

  // «Управление панелью»: выключенные разделы пропадают из нижнего меню у всех. Меняет только учредитель.
  app.put('/api/decor/settings/panel', A(ownerOnly), wrap(async (req, res) => {
    const list = Array.isArray(req.body?.panel_off) ? [...new Set(req.body.panel_off)] : fail(400, 'panel_off — список разделов');
    for (const k of list) oneOf(k, PANEL_SECTIONS, 'Раздел');
    await txFor(req)(c => c.query('UPDATE decor_settings SET panel_off=$1, updated_by=$2, updated_at=NOW() WHERE company_id=$3', [list, req.user.id, req.decor.cid])
      .then(() => ({ panel_off: list })));
    audit(req, 'update', 'decor_panel', req.decor.cid, null, { panel_off: list });
    res.json({ panel_off: list });
  }));

  // ---------- Полномочия: должность × действие ----------
  app.get('/api/decor/permissions', A(can('edit_settings')), wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT position, action, allowed FROM decor_permissions WHERE company_id=$1', [req.decor.cid]);
    const matrix = Object.fromEntries(POSITIONS.map(p => [p, Object.fromEntries(ACTIONS.map(a => [a, false]))]));
    for (const r of rows) matrix[r.position][r.action] = r.allowed;
    res.json({ positions: POSITIONS, actions: ACTIONS, matrix, owner_has_all: true });
  }));
  app.put('/api/decor/permissions', A(ownerOnly), wrap(async (req, res) => {
    const position = oneOf(req.body?.position, POSITIONS, 'Должность');
    const action = oneOf(req.body?.action, ACTIONS, 'Действие');
    if (typeof req.body?.allowed !== 'boolean') fail(400, 'allowed: true или false');
    await txFor(req)(c => c.query(`INSERT INTO decor_permissions (company_id, position, action, allowed, updated_by, updated_at) VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (company_id, position, action) DO UPDATE SET allowed=EXCLUDED.allowed, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
    [req.decor.cid, position, action, req.body.allowed, req.user.id]).then(() => ({ position, action, allowed: req.body.allowed })));
    audit(req, 'update', 'decor_permission', null, null, { position, action, allowed: req.body.allowed });
    res.json({ position, action, allowed: req.body.allowed });
  }));

  // ---------- Ставки сдельной оплаты за заказ ----------
  app.get('/api/decor/rates', A(can('pay_team', 'see_finance', 'edit_settings')), wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT level, order_type, amount_usd::float8 AS amount_usd FROM decor_pay_rates WHERE company_id=$1 ORDER BY level, order_type', [req.decor.cid]);
    res.json(rows);
  }));
  app.put('/api/decor/rates', A(can('edit_settings')), wrap(async (req, res) => {
    const level = oneOf(req.body?.level, LEVELS, 'Уровень');
    const type = oneOf(req.body?.order_type, ORDER_TYPES, 'Тип заказа');
    const amount = money(req.body?.amount_usd, 'Ставка, $');
    await txFor(req)(c => c.query(`INSERT INTO decor_pay_rates (company_id, level, order_type, amount_usd) VALUES ($1,$2,$3,$4)
      ON CONFLICT (company_id, level, order_type) DO UPDATE SET amount_usd=EXCLUDED.amount_usd`, [req.decor.cid, level, type, amount])
      .then(() => ({ level, order_type: type, amount_usd: amount })));
    audit(req, 'update', 'decor_pay_rate', null, null, { level, order_type: type, amount_usd: amount });
    res.json({ level, order_type: type, amount_usd: amount });
  }));
};
