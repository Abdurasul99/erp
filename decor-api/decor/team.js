// Команда: сдельная оплата. Начисления создаются при одобрении отчёта «Приёмка» (reports.js),
// здесь — сводка по сотрудникам, список начислений, «Выплатить» и история выплат. Ставка замораживается в начислении
// (amount_usd, level, order_type) — смена ставок прошлые начисления не меняет. Выплата уменьшает кассу (formulas.cashParts).
const { makeView } = require('./views');
const { wrap, fail, toInt } = require('./common');

module.exports = ({ app, A, can, feature, audit, tx, txFor, idem, loadModel }) => {
  const TEAM = feature('decor-team');

  const summary = (data, v, filter) => data.employees.filter(filter).map(e => {
    const mine = data.payroll.filter(w => w.employee_id === e.id);
    return { employee: v.person(e.id), is_active: e.is_active, orders: mine.length,
      due_usd: mine.filter(w => w.status === 'due').reduce((a, w) => a + w.amount_usd, 0),
      paid_usd: mine.filter(w => w.status === 'paid').reduce((a, w) => a + w.amount_usd, 0) };
  });
  const accruals = (data, v, filter) => data.payroll.filter(filter).map(w => {
    const o = data.orders.find(x => x.id === w.order_id);
    return { id: w.id, order_id: w.order_id, no: o?.no, employee: v.person(w.employee_id), level: w.level, order_type: w.order_type,
      amount_usd: w.amount_usd, status: w.status, created_at: w.created_at, paid_at: w.paid_at };
  }).reverse();

  // История выплат: одно нажатие «Выплатить» = одна выплата (все начисления сотрудника с тем же временем выплаты)
  const payouts = (data, v, filter) => {
    const byUser = new Map(data.employees.filter(e => e.user_id).map(e => [e.user_id, e.name]));
    const groups = new Map();
    for (const w of data.payroll.filter(x => x.status === 'paid' && x.paid_at && filter(x))) {
      const k = `${w.employee_id}|${new Date(w.paid_at).toISOString()}`;
      if (!groups.has(k)) groups.set(k, { employee: v.person(w.employee_id), paid_at: w.paid_at, amount_usd: 0, orders: [], paid_by: byUser.get(w.paid_by) || null });
      const g = groups.get(k);
      g.amount_usd += w.amount_usd;
      g.orders.push(data.orders.find(o => o.id === w.order_id)?.no || null);
    }
    return [...groups.values()].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
  };

  // Суммы команды — только тем, у кого «выплачивать» или «видеть себестоимость» (свои — в payroll/my)
  app.get('/api/decor/payroll', A(TEAM, can('pay_team', 'see_finance')), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const people = summary(data, v, e => ['pm', 'trainee'].includes(e.level) || data.payroll.some(w => w.employee_id === e.id));
    res.json({ people, due_total_usd: people.reduce((a, p) => a + p.due_usd, 0), accruals: accruals(data, v, () => true),
      payouts: payouts(data, v, () => true), paid_total_usd: data.payroll.reduce((a, w) => a + (w.status === 'paid' ? w.amount_usd : 0), 0),
      cash_box_usd: m.cashBox() });
  }));

  // Свои начисления — любому сотруднику со входом
  app.get('/api/decor/payroll/my', A(TEAM), wrap(async (req, res) => {
    const emp = req.decor.employee || fail(404, 'Ваш вход не привязан к сотруднику');
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    res.json({ ...summary(data, v, e => e.id === emp.id)[0], accruals: accruals(data, v, w => w.employee_id === emp.id),
      payouts: payouts(data, v, w => w.employee_id === emp.id) });
  }));

  // «Выплатить»: все начисления сотрудника «к выплате» → «выплачено»
  app.post('/api/decor/payroll/pay', A(TEAM, can('pay_team'), idem), wrap(async (req, res) => {
    const employeeId = toInt(req.body?.employee_id) || fail(400, 'Укажите сотрудника');
    const paid = await txFor(req)(async c => {
      const { rows } = await c.query(`UPDATE decor_payroll SET status='paid', paid_at=NOW(), paid_by=$3
        WHERE company_id=$1 AND employee_id=$2 AND status='due' RETURNING id, amount_usd::float8 AS amount_usd`, [req.decor.cid, employeeId, req.user.id]);
      if (!rows.length) fail(409, 'Нечего выплачивать');
      return rows;
    });
    const amount = paid.reduce((a, w) => a + w.amount_usd, 0);
    audit(req, 'pay', 'decor_payroll', employeeId, null, { ids: paid.map(w => w.id), amount_usd: amount });
    res.json({ employee_id: employeeId, paid: paid.length, amount_usd: amount });
  }));
};
