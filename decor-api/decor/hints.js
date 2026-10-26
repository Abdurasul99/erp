// Wave Intelligence: подсказки из данных и главная. Подсказка — код + параметры (текст на RU/UZ собирает экран).
// Денежные подсказки — только тем, кто видит деньги; конфликты брони и «не вернулось» — всем.
const F = require('./formulas');
const { makeView } = require('./views');
const { wrap, todayYmd } = require('./common');

// severity: bad — срочно, warn — важно, info — к сведению
function buildHints(req, data, m) {
  const has = a => req.decor.perms.has(a);
  const v = makeView(req, data, m);
  const out = [];
  for (const c of m.conflicts()) {
    out.push({ kind: 'conflict', severity: 'bad', day: c.day, item_id: c.item_id, item: c.item, need: c.need, have: c.have, short: c.short, not_returned: c.not_returned, orders: c.orders });
  }
  for (const x of m.notReturned()) {
    out.push({ kind: 'not_returned', severity: 'bad', order_id: x.order_id, no: x.no, client: x.client, days_late: x.days_late, items: x.items });
  }
  if (has('see_finance') || has('confirm_money')) {
    for (const e of data.employees) {
      const d = m.pmDebt(e.id);
      if (d > 0) out.push({ kind: 'pm_debt', severity: 'warn', employee: v.person(e.id), amount_usd: d });
    }
  }
  // Недостача под вопросом (финал принят, не хватает, заказ не закрыт) — искать вещи: складу и тем, кто видит деньги
  if (has('handle_decor') || has('see_finance')) {
    for (const o of data.orders.filter(x => m.shortageStatus(x) === 'pending')) {
      const sv = v.shortageView(o);
      out.push({ kind: 'shortage_pending', severity: 'warn', order_id: o.id, no: o.no, items: sv.items,
        team: o.team.map(v.person).filter(Boolean).map(p => p.name), ...(sv.amount_usd !== undefined ? { amount_usd: sv.amount_usd } : {}) });
    }
  }
  if (has('see_finance')) {
    for (const o of data.orders.filter(x => x.price_usd > 0 && x.status !== 'closed')) {
      const c = m.orderCost(o);
      if (c.below_cost) out.push({ kind: 'below_cost', severity: 'bad', order_id: o.id, no: o.no, price_usd: c.price, full_usd: c.full });
    }
    // Недостача, списанная при закрытии заказа (снимок себестоимости), за вычетом того, что нашлось после закрытия
    for (const o of data.orders.filter(x => x.status === 'closed')) {
      const c = m.orderCost(o);
      const recovered = m.recoveredAfterCloseUsd(o);
      if (c.shortage - recovered > 0.005) {
        out.push({ kind: 'shortage', severity: 'warn', order_id: o.id, no: o.no, closed: true, amount_usd: c.shortage,
          recovered_usd: recovered, remaining_usd: c.shortage - recovered,
          team: o.team.map(v.person).filter(Boolean).map(p => p.name), items: m.shortageItems(o) });
      }
    }
  }
  // Доказательства (D24): заказы в работе, которые не закрыть из-за нехватки фото/видео по этапам
  if (has('handle_decor') || has('upload_report') || has('approve_report') || has('see_finance')) {
    // Напоминать только об этапах, которые по статусу уже должны быть пройдены (не о будущих)
    const ST = ['install', 'acceptance', 'dismantle'];
    const due = (o, stage) => ({ issue: true, final: true, install: ST.indexOf(o.status) >= 1, acceptance: ST.indexOf(o.status) >= 2,
      dismantle: o.status === 'dismantle' && m.closeChecklist(o).final_returned }[stage]);
    for (const o of data.orders.filter(x => ST.includes(x.status))) {
      const miss = m.evidenceStatus(o).filter(e => e.blocking && e.applicable && !e.ok && due(o, e.stage));
      if (miss.length) {
        out.push({ kind: 'evidence_missing', severity: 'warn', order_id: o.id, no: o.no, client: o.client, status: o.status,
          stages: miss.map(e => ({ stage: e.stage, state: e.state, missing: e.missing || null })) });
      }
    }
  }
  const pendingList = data.orders.flatMap(o => o.reports.filter(r => r.status === 'pending'));
  if (pendingList.length && has('approve_report')) {
    out.push({ kind: 'pending_reports', severity: 'info', count: pendingList.length,
      incomplete: pendingList.filter(r => !F.evidenceGap(m.rule(r.stage), r.files).ok).length });
  }
  // К выплате команде — тем, кто выплачивает
  if (has('pay_team')) {
    const due = data.payroll.filter(w => w.status === 'due');
    if (due.length) out.push({ kind: 'payroll_due', severity: 'info', amount_usd: due.reduce((a, w) => a + w.amount_usd, 0), people: new Set(due.map(w => w.employee_id)).size });
  }
  // Фонд материалов в минусе — потратили больше накопленного
  if (has('see_finance') || has('confirm_money')) {
    const f = m.fund();
    if (f.remaining < -0.005) out.push({ kind: 'fund_negative', severity: 'warn', amount_usd: -f.remaining, spent_usd: f.spent, accumulated_usd: f.accumulated });
  }
  return out;
}

module.exports = ({ app, A, feature, loadModel }) => {
  app.get('/api/decor/hints', A(feature('decor-ai')), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    res.json(buildHints(req, data, m));
  }));

  // Главная: цифры, главная проблема, «сегодня и завтра»
  app.get('/api/decor/home', A(), wrap(async (req, res) => {
    const today = todayYmd();
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const has = a => req.decor.perms.has(a);
    const money = has('see_finance') || has('confirm_money');
    const week = data.orders.filter(o => F.isActive(o) && o.event_date >= today && o.event_date <= F.addDays(today, 7));
    const closedOrders = data.orders.filter(o => o.status === 'closed');
    const closed = closedOrders.map(o => m.orderCost(o));
    const hints = req.decor.features.has('decor-ai') ? buildHints(req, data, m) : [];
    // Главная проблема: конфликт брони → не вернулось с объекта → несданные деньги → не хватает фото → фонд в минусе → всё под контролем
    const intel = hints.find(h => h.kind === 'conflict') || hints.find(h => h.kind === 'not_returned')
      || hints.find(h => h.kind === 'pm_debt') || hints.find(h => h.kind === 'evidence_missing') || hints.find(h => h.kind === 'fund_negative')
      || { kind: 'all_good', severity: 'ok' };
    if (intel.kind === 'evidence_missing') intel.orders = hints.filter(h => h.kind === 'evidence_missing').length;
    if (intel.kind === 'pm_debt') intel.total_usd = hints.filter(h => h.kind === 'pm_debt').reduce((a, h) => a + h.amount_usd, 0);
    res.json({
      today,
      kpi: {
        week_orders: week.length,
        pending_reports: data.orders.reduce((a, o) => a + o.reports.filter(r => r.status === 'pending').length, 0),
        ...(money ? { pm_debt_usd: data.employees.reduce((a, e) => a + m.pmDebt(e.id), 0), cash_usd: m.cashBox(), fund_remaining_usd: m.fund().remaining } : {}),
        evidence_missing_orders: data.orders.filter(o => !['lead', 'closed'].includes(o.status) && m.evidenceStatus(o).some(e => e.blocking && e.applicable && !e.ok)).length,
        ...(has('see_finance') ? { closed_profit_usd: closed.reduce((a, c) => a + c.profit, 0), closed_shortage_usd: closed.reduce((a, c) => a + c.shortage, 0),
          closed_recovered_usd: closedOrders.reduce((a, o) => a + m.recoveredAfterCloseUsd(o), 0) } : {}),
      },
      intel,
      hints_count: hints.length,
      today_tomorrow: data.orders.filter(o => F.isActive(o) && (o.event_date === today || o.event_date === F.addDays(today, 1))).map(v.summary),
    });
  }));
};
module.exports.buildHints = buildHints;
