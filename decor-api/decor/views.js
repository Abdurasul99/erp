// Как заказ выглядит в ответах API: краткая карточка (канбан, списки) и полная (выезжающая карточка заказа).
// Себестоимость и прибыль попадают в ответ только тем, у кого полномочие «видеть себестоимость и прибыль».

// Общий контекст ответа: модель, сотрудники, конфликты и «не вернулось» считаются один раз на запрос
function makeView(req, data, m) {
  const fin = req.decor.perms.has('see_finance');
  const emp = new Map(data.employees.map(e => [e.id, e]));
  const items = new Map(data.items.map(i => [i.id, i]));
  let conflictNos = null; let notReturned = null;
  const conflicts = () => { if (!conflictNos) conflictNos = new Set(m.conflicts().flatMap(c => c.orders)); return conflictNos; };
  const notBack = () => { if (!notReturned) notReturned = new Set(m.notReturned().map(x => x.order_id)); return notReturned; };
  const person = id => (id && emp.get(id) ? { id, name: emp.get(id).name, level: emp.get(id).level } : null);

  // mode: plan — финала ещё нет ни по одной вещи, partial — по части вещей, fact — по всем, closed — снимок при закрытии.
  // shortage_preliminary — недостача «под вопросом»: до закрытия заказа она предварительная.
  function costView(o) {
    const c = m.orderCost(o);
    return { ...c, mode: m.costMode(c) };
  }
  // Недостача заказа: pending — «под вопросом» (до закрытия), fixed — списана при закрытии. Суммы — только с «видеть себестоимость».
  function shortageView(o) {
    const list = m.shortageItems(o);
    if (!list.length) return null;
    return { status: m.shortageStatus(o),
      items: list.map(x => (fin ? x : { item_id: x.item_id, item: x.item, qty: x.qty, since: x.since })),
      ...(fin ? { amount_usd: list.reduce((a, x) => a + x.amount_usd, 0) } : {}) };
  }

  function summary(o) {
    const out = {
      id: o.id, no: o.no, client: o.client, phone: o.phone, address: o.address, event_date: o.event_date,
      type: o.type, status: o.status, price_usd: o.price_usd, period: m.period(o),
      team: o.team.map(person).filter(Boolean),
      lines_count: o.lines.length,
      paid_usd: m.paidTotal(o), confirmed_usd: m.confirmedTotal(o),
      pending_reports: o.reports.filter(r => r.status === 'pending').length,
      issued: o.moves.some(x => x.type === 'issue'),
      not_returned: notBack().has(o.id),
      shortage_pending: m.shortageStatus(o) === 'pending',
      has_conflict: conflicts().has(o.no),
      // сколько этапов без нужных фото/видео (держат закрытие) — для плашки в канбане
      evidence_missing: o.status === 'lead' ? 0 : m.evidenceStatus(o).filter(e => e.blocking && e.applicable && !e.ok).length,
    };
    if (fin) {
      const c = m.orderCost(o);
      Object.assign(out, { full_cost_usd: c.full, profit_usd: c.profit, below_cost: c.below_cost, cost_mode: m.costMode(c) });
    }
    return out;
  }

  // «Возвращено после закрытия»: что нашлось из списанной недостачи (снимок себестоимости при этом не меняется)
  function recoveredView(o) {
    const list = m.recoveredAfterClose(o);
    if (!list.length) return null;
    return { items: list.map(x => (fin ? x : { item_id: x.item_id, item: x.item, qty: x.qty, date: x.date })),
      ...(fin ? { amount_usd: m.recoveredAfterCloseUsd(o) } : {}) };
  }

  function card(o) {
    const pr = req.decor.perms;
    return {
      ...summary(o),
      note: o.note, created_at: o.created_at, closed_at: o.closed_at,
      overdue: m.isOverdue(o),
      lines: o.lines.map(l => {
        const free = m.freeForOrder(o, l.item_id);
        return { item_id: l.item_id, item: items.get(l.item_id)?.name || null, qty: l.qty, free, short: Math.max(0, l.qty - free) };
      }),
      flows: m.orderItemIds(o).map(id => ({ item_id: id, item: items.get(id)?.name || null, ...m.itemFlow(o, id) })),
      shortage: shortageView(o),
      recovered_after_close: recoveredView(o),
      moves: [...o.moves].reverse().map(x => ({ id: x.id, type: x.type, item_id: x.item_id, item: items.get(x.item_id)?.name || null, qty: x.qty,
        date: x.move_date, user_id: x.user_id, after_close: x.after_close, ...(fin && x.after_close ? { amount_usd: x.amount_usd } : {}) })),
      payments: o.payments.map(p => ({ id: p.id, amount_usd: p.amount_usd, kind: p.kind, status: p.status, date: p.pay_date,
        received_by: p.received_by_employee_id ? person(p.received_by_employee_id) : null,
        receipt: (o.evidence || []).filter(e => e.stage === 'handover' && e.payment_id === p.id).flatMap(e => e.files) })),
      // Доказательства по этапам (по текущим требованиям) и файлы выдачи, финала и чеков
      evidence: m.evidenceStatus(o),
      evidence_files: (o.evidence || []).map(e => ({ id: e.id, stage: e.stage, payment_id: e.payment_id, comment: e.comment, created_at: e.created_at, files: e.files })),
      to_pay_usd: Math.max(0, o.price_usd - m.paidTotal(o)),
      reports: [...o.reports].reverse().map(r => ({ id: r.id, stage: r.stage, status: r.status, comment: r.comment, reply: r.reply,
        date: r.report_date, employee: person(r.employee_id), files: r.files })),
      checklist: (({ shortage_usd, ...rest }) => (fin ? { ...rest, shortage_usd } : rest))(m.closeChecklist(o)),
      ...(pr.has('see_finance') ? {
        cost: costView(o),
        extras: { transport_usd: o.transport_usd, consumables_uzs: o.consumables_uzs, rented_decor_usd: o.rented_decor_usd, other_usd: o.other_usd },
      } : {}),
      ...(pr.has('see_finance') || pr.has('pay_team') ? {
        payroll: data.payroll.filter(w => w.order_id === o.id).map(w => ({ id: w.id, employee: person(w.employee_id), amount_usd: w.amount_usd, status: w.status })),
      } : {}),
    };
  }

  return { fin, summary, card, costView, shortageView, recoveredView, person, items, emp };
}

module.exports = { makeView };
