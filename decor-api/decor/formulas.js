// Формулы сферы «Декор» — единственное место, где они записаны. API, подсказки, отчёты и тесты берут их отсюда.
// Функции не ходят в базу: получают данные компании (data.js → loadCompany) и дату «сегодня».
// Деньги — доллары (Number, без округления: округляет экран). Даты — строки 'ГГГГ-ММ-ДД'.
//
// Финальный возврат делается ПО КАЖДОЙ ВЕЩИ (решение 2026-10-22): бронь, «не вернулось», план/факт себестоимости
// и «недостача под вопросом» считаются по вещи, а не по заказу целиком.
'use strict';

// ---------- Даты ----------
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const dayRange = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

// ---------- Нормы ----------
// Износ за 1 заказ = цена ÷ ресурс (сколько заказов выдерживает вещь)
const wearPerOrder = item => (item.resource_orders > 0 ? item.price_usd / item.resource_orders : 0);
// Постоянные в месяц = таргет + ремонт_сум ÷ курс + прочие
const fixedMonthly = s => s.target_usd + s.repair_uzs / s.rate_uzs + s.other_fixed_usd;
// Доля постоянных на заказ = постоянные ÷ ожидаемое число заказов в месяц
const fixedShare = s => (s.expected_orders > 0 ? fixedMonthly(s) / s.expected_orders : 0);
// Активный заказ держит бронь: не лид и не закрыт
const isActive = o => o.status !== 'lead' && o.status !== 'closed';

// ---------- Покупка декора («Купил декор», решение 2026-10-24) ----------
// Средняя цена вещи после покупки = (старое кол-во × старая цена + новое кол-во × цена покупки) ÷ общее кол-во.
// Старое кол-во — сколько вещи реально есть: куплено − окончательно пропавшее (model.presentQty, уточнение 2026-10-25).
// Закрытые заказы не меняются: у них снимок.
const averagePrice = (oldQty, oldPrice, qty, unitPrice) => {
  const total = oldQty + qty;
  return total > 0 ? Math.round(((oldQty * oldPrice + qty * unitPrice) / total) * 100) / 100 : unitPrice;
};

// ---------- Доказательства (фото/видео, решение 2026-10-24) ----------
// Сколько фото и видео среди файлов (kind 'image' | 'video', как в decor_report_files; mime — для файлов до записи)
const countFiles = files => (files || []).reduce((a, f) => {
  const mime = f.mime || f.mimetype || '';
  const k = f.kind || (/^image\//.test(mime) ? 'image' : /^video\//.test(mime) ? 'video' : null);
  if (k === 'image') a.photos++; else if (k === 'video') a.videos++;
  return a;
}, { photos: 0, videos: 0 });
// Чего не хватает до требования этапа. rule: { min_photos, need_video, shortage_note }.
// Финальный возврат с недостачей (shortage_note): нужен комментарий о недостаче ИЛИ ещё одно фото сверх минимума.
function evidenceGap(rule, files, { shortage = false, comment = null } = {}) {
  const have = countFiles(files);
  const noteNeeded = Boolean(rule.shortage_note && shortage && !(comment && String(comment).trim()));
  const needPhotos = rule.min_photos + (noteNeeded ? 1 : 0);
  const photos = Math.max(0, needPhotos - have.photos);
  const video = Boolean(rule.need_video) && have.videos === 0;
  return { ok: photos === 0 && !video, missing: { photos, video, note: noteNeeded && photos > 0 },
    need: { photos: needPhotos, video: Boolean(rule.need_video) }, have };
}
// Текст для ответа сервера: «нужно ещё 2 фото и видео» / «нужно ещё 1 фото или комментарий о недостаче»
function evidenceText(gap) {
  const parts = [];
  if (gap.missing.photos > 0) parts.push(gap.missing.photos + ' фото');
  if (gap.missing.video) parts.push('видео');
  return 'нужно ещё ' + parts.join(' и ') + (gap.missing.note ? ' или комментарий о недостаче' : '');
}

// Модель компании на дату today.
// data: { settings, items[], employees[], rates{level:{big,small}}, orders[{…, team[], lines[], moves[], payments[], reports[]}], payroll[] }
function model(data, today) {
  const s = data.settings;
  const items = new Map(data.items.map(i => [i.id, i]));
  const employees = new Map(data.employees.map(e => [e.id, e]));
  const rates = data.rates || {};
  const orders = data.orders;
  const payroll = data.payroll || [];
  const fundSpend = data.fundSpend || [];
  const rules = data.evidenceRules || {};
  const N = s.days_on_site;

  // ---------- Движение декора по заказу ----------
  // issue — выдача, extra — довыдача, left — возврат остатка (не использовали, износа нет),
  // final — финальный возврат по вещи (может быть 0: «ничего не вернулось»),
  // late_return — поздний возврат: вещь из «недостачи под вопросом» нашлась и вернулась (износ — как у финала).
  const lineQty = (o, itemId) => { const l = o.lines.find(x => x.item_id === itemId); return l ? l.qty : 0; };
  const itemMoves = (o, itemId) => o.moves.filter(m => m.item_id === itemId);
  const moveSum = (o, itemId, type) => o.moves.reduce((a, m) => a + (m.item_id === itemId && m.type === type ? m.qty : 0), 0);
  // Дата первого финального возврата по вещи (null — финала по ней не было)
  const itemFinalDate = (o, itemId) => itemMoves(o, itemId).filter(m => m.type === 'final').map(m => m.move_date).sort()[0] || null;
  const hasItemFinal = (o, itemId) => itemMoves(o, itemId).some(m => m.type === 'final');
  // выдано = issue + extra; на объекте = выдано − left − final − late_return
  function itemFlow(o, itemId) {
    const issued = moveSum(o, itemId, 'issue') + moveSum(o, itemId, 'extra');
    const left = moveSum(o, itemId, 'left');
    const fin = moveSum(o, itemId, 'final');
    const late = moveSum(o, itemId, 'late_return');
    return { design: lineQty(o, itemId), issued, left, fin, late, onSite: issued - left - fin - late, final_done: hasItemFinal(o, itemId) };
  }
  const orderItemIds = o => [...new Set([...o.lines.map(l => l.item_id), ...o.moves.map(m => m.item_id)])];
  // По вещи всё решено: принят финал или на объекте 0 (всё вернули остатком). Невыданная вещь не решена — она ещё в брони.
  function itemDone(o, itemId) {
    if (hasItemFinal(o, itemId)) return true;
    const f = itemFlow(o, itemId);
    return f.issued > 0 && f.onSite <= 0;
  }
  // С какой даты вещь заказа свободна: дата её первого финала или день, когда на объекте стало 0
  function itemReleaseDate(o, itemId) {
    if (hasItemFinal(o, itemId)) return itemFinalDate(o, itemId);
    if (!itemDone(o, itemId)) return null;
    return itemMoves(o, itemId).map(m => m.move_date).sort().pop();
  }
  const hasFinal = o => o.moves.some(m => m.type === 'final');

  // ---------- Себестоимость ----------
  // Команда = Σ ставок сотрудников заказа по их уровню и типу заказа
  const teamCost = (team, type) => team.reduce((a, id) => {
    const e = employees.get(id); const r = e && rates[e.level];
    return a + (r && r[type] ? r[type] : 0);
  }, 0);

  // По каждой вещи: до её финала — ПЛАН (износ = qty_по_дизайну × износ_за_1);
  // после финала — ФАКТ: износ = (final + поздний возврат) × износ_за_1 (на вещи из left износа нет),
  //   недостача = max(0, на_объекте) × цена (по полной цене).
  // До закрытия заказа недостача ПРЕДВАРИТЕЛЬНАЯ («под вопросом»), окончательно фиксируется в снимке при закрытии.
  function liveCost(o) {
    let wear = 0; let shortage = 0; let done = 0; let counted = 0;
    for (const id of orderItemIds(o)) {
      const it = items.get(id);
      if (!it) continue;
      const f = itemFlow(o, id);
      if (!f.issued && !f.design) continue;
      counted++;
      if (itemDone(o, id)) {
        done++;
        wear += (f.fin + f.late) * wearPerOrder(it);
        shortage += Math.max(0, f.onSite) * it.price_usd;
      } else wear += f.design * wearPerOrder(it);
    }
    const team = teamCost(o.team, o.type);
    const transport = o.transport_usd;
    const consumables = o.consumables_uzs / s.rate_uzs;          // расходники $ = сум ÷ курс
    const rented = o.rented_decor_usd;
    const other = o.other_usd;
    const direct = wear + shortage + team + transport + consumables + rented + other;
    const fixed = fixedShare(s);
    const full = direct + fixed;
    const price = o.price_usd || 0;
    return { plan: done === 0, partial: done > 0 && done < counted, wear, shortage, shortage_preliminary: shortage > 0,
      team, transport, consumables, rented, other, direct, fixed, full, price,
      profit: price - full, below_cost: price > 0 && price < full, rate_uzs: s.rate_uzs };
  }
  // Снимок при закрытии: та же раскладка, недостача — окончательная, с вещами и ценами (по ним считается
  // «возвращено после закрытия»)
  const closingCost = o => ({ ...liveCost(o), shortage_preliminary: false,
    shortage_items: shortageItems(o).map(({ item_id, item, qty, price_usd, amount_usd }) => ({ item_id, item, qty, price_usd, amount_usd })) });
  // Закрытый заказ — снимок на момент закрытия (смена настроек его не меняет)
  const orderCost = o => (o.status === 'closed' && o.closed_cost ? { ...o.closed_cost, frozen: true } : { ...liveCost(o), frozen: false });
  const costMode = c => (c.frozen ? 'closed' : c.plan ? 'plan' : c.partial ? 'partial' : 'fact');

  // ---------- Бронь (правила 2026-10-22) ----------
  // Период заказа: с event_date по event_date + N (N — «дней на объекте» в настройках)
  const period = o => ({ from: o.event_date, to: addDays(o.event_date, N) });
  // Заказ держит вещь на дату D: активен, D внутри периода, вещь есть в дизайне и ещё не освобождена
  // (освобождается с даты своего финала или когда по ней на объекте стало 0)
  function reservesItemOn(o, itemId, day) {
    if (!isActive(o)) return false;
    const p = period(o);
    if (day < p.from || day > p.to || !lineQty(o, itemId)) return false;
    const rd = itemReleaseDate(o, itemId);
    return !(rd && day >= rd);
  }
  // Заказ держит хоть одну вещь на дату D
  const reservesOn = (o, day) => o.lines.some(l => reservesItemOn(o, l.item_id, day));
  // Вещь «не вернулась с объекта»: период заказа закончился, финала по ней нет, на объекте что-то есть
  function itemOverdue(o, itemId) {
    if (!isActive(o) || period(o).to >= today || hasItemFinal(o, itemId)) return false;
    return itemFlow(o, itemId).onSite > 0;
  }
  const isOverdue = o => orderItemIds(o).some(id => itemOverdue(o, id));

  // Вещи, которых нет на складе (для брони — «не обещать то, чего нет»):
  //   закрытые заказы — пропавшее списано окончательно;
  //   незакрытые — «недостача под вопросом»: после финала по вещи недостающее отсутствует с даты этого финала.
  function absentParts(itemId, day) {
    let lostClosed = 0; let pending = 0;
    for (const o of orders) {
      const f = itemFlow(o, itemId);
      if (f.onSite <= 0) continue;
      if (o.status === 'closed') lostClosed += f.onSite;
      else { const fd = itemFinalDate(o, itemId); if (fd && day >= fd) pending += f.onSite; }
    }
    return { lostClosed, pending };
  }
  const lostCache = new Map();
  function lost(itemId, day = today) {
    const key = `${itemId}|${day}`;
    if (!lostCache.has(key)) { const a = absentParts(itemId, day); lostCache.set(key, a.lostClosed + a.pending); }
    return lostCache.get(key);
  }
  // Сколько вещи реально есть у компании = куплено − окончательно пропавшее (списано в закрытых заказах);
  // по нему считается средняя цена при покупке («Купил декор»)
  const presentQty = itemId => (items.get(itemId)?.qty_bought || 0) - absentParts(itemId, today).lostClosed;
  // На складе вообще (без учёта броней) на дату = куплено − пропавшее в закрытых − недостача под вопросом
  const stock = (itemId, day = today) => (items.get(itemId)?.qty_bought || 0) - lost(itemId, day);

  // Недостача по заказу: вещи, по которым принят финал, а на объекте что-то осталось.
  // status: pending — «под вопросом» (заказ не закрыт), fixed — списана при закрытии.
  function shortageItems(o) {
    return orderItemIds(o).map(id => {
      const f = itemFlow(o, id);
      const it = items.get(id);
      if (f.onSite <= 0 || !(hasItemFinal(o, id) || o.status === 'closed')) return null;
      return { item_id: id, item: it?.name || null, qty: f.onSite, price_usd: it?.price_usd || 0,
        amount_usd: f.onSite * (it?.price_usd || 0), since: itemFinalDate(o, id) };
    }).filter(Boolean);
  }
  const shortageStatus = o => (shortageItems(o).length ? (o.status === 'closed' ? 'fixed' : 'pending') : null);

  // Поздний возврат после закрытия: снимок не меняется, сумма = кол-во × цена вещи в снимке
  // (снимок без цен — старые данные — по текущей цене вещи)
  const closedPrice = (o, itemId) => o.closed_cost?.shortage_items?.find(x => x.item_id === itemId)?.price_usd
    ?? items.get(itemId)?.price_usd ?? 0;
  const recoveredAfterClose = o => o.moves.filter(x => x.type === 'late_return' && x.after_close)
    .map(x => ({ item_id: x.item_id, item: items.get(x.item_id)?.name || null, qty: x.qty, amount_usd: x.amount_usd || 0, date: x.move_date }));
  const recoveredAfterCloseUsd = o => recoveredAfterClose(o).reduce((a, x) => a + x.amount_usd, 0);

  // Итоги по вещи на сегодня: куплено, пропало (закрытые), недостача под вопросом, на объектах, на складе, свободно
  function itemTotals(itemId) {
    const a = absentParts(itemId, today);
    const onSite = orders.reduce((x, o) => (o.status !== 'closed' && !hasItemFinal(o, itemId) ? x + Math.max(0, itemFlow(o, itemId).onSite) : x), 0);
    const qty = items.get(itemId)?.qty_bought || 0;
    return { qty_bought: qty, lost: a.lostClosed, shortage_pending: a.pending, on_site: onSite,
      in_warehouse: qty - a.lostClosed - a.pending - onSite, free_today: free(itemId, today) };
  }

  // Занято на дату D всеми заказами, кроме exceptId:
  //   reserved    — брони активных заказов, чей период включает D (по вещам, ещё не освобождённым);
  //   notReturned — вещи «на объекте» по просроченным заказам (D после конца их периода).
  function busyOn(itemId, day, exceptId = null) {
    let reserved = 0; let notReturned = 0;
    for (const o of orders) {
      if (o.id === exceptId) continue;
      if (reservesItemOn(o, itemId, day)) reserved += lineQty(o, itemId);
      if (itemOverdue(o, itemId) && day > period(o).to) notReturned += itemFlow(o, itemId).onSite;
    }
    return { reserved, notReturned };
  }
  // Свободно на дату D = (куплено − пропавшее − недостача под вопросом) − брони других активных заказов на D − не вернувшееся
  function free(itemId, day, exceptId = null) {
    const b = busyOn(itemId, day, exceptId);
    return stock(itemId, day) - b.reserved - b.notReturned;
  }
  // Заказ держит вещи весь период, поэтому для него «свободно» — минимум по дням периода
  const freeForPeriod = (itemId, from, to, exceptId = null) => Math.min(...dayRange(from, to).map(d => free(itemId, d, exceptId)));
  const freeForOrder = (o, itemId) => freeForPeriod(itemId, period(o).from, period(o).to, o.id);
  // Для калькулятора: новый заказ на дату eventDate
  const freeForNew = (itemId, eventDate) => freeForPeriod(itemId, eventDate, addDays(eventDate, N), null);

  // Почему вещи нет: на самом тесном дне периода — кто её держит (брони D-xxx), с каких заказов она не вернулась,
  // что «под вопросом» после финала и что пропало в закрытых заказах. free = как freeForPeriod.
  function freeDetail(itemId, from, to, exceptId = null) {
    let day = from; let best = Infinity;
    for (const d of dayRange(from, to)) { const f = free(itemId, d, exceptId); if (f < best) { best = f; day = d; } }
    const others = orders.filter(o => o.id !== exceptId);
    const parts = absentParts(itemId, day);
    return {
      free: best, day, qty_bought: items.get(itemId)?.qty_bought || 0,
      reserved_by: others.filter(o => reservesItemOn(o, itemId, day)).map(o => ({ order_id: o.id, no: o.no, qty: lineQty(o, itemId), event_date: o.event_date })),
      not_returned_from: others.filter(o => itemOverdue(o, itemId) && day > period(o).to).map(o => ({ order_id: o.id, no: o.no, qty: itemFlow(o, itemId).onSite })),
      pending_shortage_from: orders.filter(o => o.status !== 'closed' && itemFlow(o, itemId).onSite > 0 && itemFinalDate(o, itemId) && day >= itemFinalDate(o, itemId))
        .map(o => ({ order_id: o.id, no: o.no, qty: itemFlow(o, itemId).onSite })),
      lost_closed: parts.lostClosed,
    };
  }

  // Ячейка таблицы брони: сколько занято на D и насколько это много
  function bookingCell(itemId, day) {
    const b = busyOn(itemId, day, null);
    const have = stock(itemId, day);
    const used = b.reserved + b.notReturned;
    const state = used === 0 ? 'none' : used > have ? 'over' : used === have ? 'full' : 'some';
    return { reserved: b.reserved, not_returned: b.notReturned, stock: have, free: have - used, state };
  }

  // Конфликты брони с сегодняшнего дня: брони на дату больше, чем есть (склад − не вернувшееся)
  function conflicts() {
    const days = new Set();
    for (const o of orders) {
      if (!isActive(o) || !o.lines.length) continue;
      for (const d of dayRange(period(o).from, period(o).to)) if (d >= today && reservesOn(o, d)) days.add(d);
    }
    const out = [];
    for (const day of [...days].sort()) {
      for (const it of data.items) {
        const b = busyOn(it.id, day, null);
        if (!b.reserved) continue;
        const have = stock(it.id, day) - b.notReturned;
        if (b.reserved > have) {
          out.push({ day, item_id: it.id, item: it.name, need: b.reserved, have, short: b.reserved - have, not_returned: b.notReturned,
            orders: orders.filter(o => reservesItemOn(o, it.id, day)).map(o => o.no),
            order_refs: orders.filter(o => reservesItemOn(o, it.id, day)).map(o => ({ id: o.id, no: o.no })) });
        }
      }
    }
    return out;
  }

  // «Не вернулось с объекта»: заказы, у которых период кончился, а по каким-то вещам нет финала и они на объекте
  function notReturned() {
    return orders.filter(isOverdue).map(o => {
      const list = orderItemIds(o).filter(id => itemOverdue(o, id))
        .map(id => ({ item_id: id, item: items.get(id)?.name || null, qty: itemFlow(o, id).onSite }));
      const p = period(o);
      return { order_id: o.id, no: o.no, client: o.client, event_date: o.event_date, period_to: p.to, days_late: daysBetween(p.to, today), items: list };
    });
  }

  // ---------- Деньги ----------
  const paidTotal = o => o.payments.reduce((a, p) => a + p.amount_usd, 0);
  const confirmedTotal = o => o.payments.reduce((a, p) => a + (p.status === 'confirmed' ? p.amount_usd : 0), 0);
  // Долг сотрудника (ПМ): принял от клиента, касса ещё не подтвердила
  const pmDebt = employeeId => orders.reduce((a, o) => a + o.payments.reduce(
    (b, p) => b + (p.received_by_employee_id === employeeId && p.status !== 'confirmed' ? p.amount_usd : 0), 0), 0);
  // Касса = подтверждённые поступления − выплаты команде − покупки из фонда материалов («Купил декор»)
  function cashParts() {
    const income = orders.reduce((a, o) => a + confirmedTotal(o), 0);
    const payrollPaid = payroll.reduce((a, w) => a + (w.status === 'paid' ? w.amount_usd : 0), 0);
    const fundSpent = fundSpend.reduce((a, x) => a + x.amount_usd, 0);
    return { income, payroll: payrollPaid, fund: fundSpent, cash: income - payrollPaid - fundSpent };
  }
  const cashBox = () => cashParts().cash;

  // Фонд материалов: накоплено = износ + окончательная недостача из снимков закрытых заказов − «возвращено после
  // закрытия» (вещь вернулась — заменять не нужно); потрачено = покупки; остаток = накоплено − потрачено.
  function fund() {
    const rows = orders.filter(o => o.status === 'closed' && o.closed_cost).map(o => {
      const wear = o.closed_cost.wear || 0; const shortage = o.closed_cost.shortage || 0; const recovered = recoveredAfterCloseUsd(o);
      return { order_id: o.id, no: o.no, client: o.client, event_date: o.event_date, closed_at: o.closed_at,
        wear, shortage, recovered, amount: wear + shortage - recovered };
    });
    const sum = k => rows.reduce((a, r) => a + r[k], 0);
    const accumulated = sum('amount');
    const spent = fundSpend.reduce((a, x) => a + x.amount_usd, 0);
    return { wear: sum('wear'), shortage: sum('shortage'), recovered: sum('recovered'), accumulated, spent,
      remaining: accumulated - spent, orders: rows };
  }

  // ---------- Доказательства по этапам заказа ----------
  // По текущим требованиям компании. blocking — без этого этапа заказ не закрыть:
  //   выдача и финал — доказательство у каждого такого движения и вместе файлов хватает (финал с недостачей —
  //   ещё комментарий или фото); монтаж и демонтаж — отчёт с полным комплектом (не возвращённый); приёмка — ОДОБРЕННЫЙ
  //   отчёт с полным комплектом. «Сдал кассиру» показывается, но закрытие не держит: закрыть можно, только когда все
  //   деньги подтвердила касса, а это сильнее фото чека.
  const rule = stage => rules[stage] || { min_photos: 1, need_video: false, shortage_note: false };
  function evidenceStatus(o) {
    const ev = o.evidence || [];
    const issuedAny = o.moves.some(x => x.type === 'issue');
    const out = [];
    const moveStage = (stage, type) => {
      const mv = o.moves.filter(x => x.type === type);
      const list = ev.filter(e => e.stage === stage);
      const files = list.flatMap(e => e.files || []);
      const shortage = stage === 'final' && shortageItems(o).length > 0;
      const comment = list.map(e => e.comment).filter(Boolean).join(' · ') || null;
      const gap = evidenceGap(rule(stage), files, { shortage, comment });
      const unlinked = mv.filter(x => !x.evidence_id).length;
      const applicable = mv.length > 0;
      return { stage, applicable, blocking: true, ok: !applicable || (unlinked === 0 && gap.ok), unlinked, comment, ...gap,
        state: !applicable ? 'na' : unlinked === 0 && gap.ok ? 'ok' : 'missing' };
    };
    const reportStage = stage => {
      const list = o.reports.filter(r => r.stage === stage && r.status !== 'returned');
      const withGap = list.map(r => ({ r, gap: evidenceGap(rule(stage), r.files) }));
      const full = withGap.filter(x => x.gap.ok);
      const good = stage === 'acceptance' ? full.filter(x => x.r.status === 'approved') : full;
      const best = good[0] || full[0] || withGap[withGap.length - 1] || { gap: evidenceGap(rule(stage), []) };
      const applicable = issuedAny || ['install', 'acceptance', 'dismantle', 'closed'].includes(o.status);
      const state = !applicable ? 'na' : good.length ? 'ok' : full.length ? 'pending' : 'missing';
      return { stage, applicable, blocking: true, ok: !applicable || good.length > 0, reports: list.length, ...best.gap, state };
    };
    out.push(moveStage('issue', 'issue'));
    for (const st of ['install', 'acceptance', 'dismantle']) out.push(reportStage(st));
    out.push(moveStage('final', 'final'));
    // «Сдал кассиру»: деньги, принятые сотрудником и сданные (или уже в кассе) — у скольких есть фото чека
    const pm = o.payments.filter(p => p.received_by_employee_id && p.status !== 'at_pm');
    const withReceipt = pm.filter(p => ev.some(e => e.stage === 'handover' && e.payment_id === p.id && evidenceGap(rule('handover'), e.files).ok));
    out.push({ stage: 'handover', applicable: pm.length > 0, blocking: false, ok: withReceipt.length === pm.length,
      done: withReceipt.length, total: pm.length, need: { photos: rule('handover').min_photos, video: rule('handover').need_video },
      state: !pm.length ? 'na' : withReceipt.length === pm.length ? 'ok' : 'missing' });
    return out;
  }

  // Чек-лист перед закрытием: финальный возврат принят по каждой выданной вещи, оплата полностью в кассе,
  // «Приёмка» одобрена, доказательства по этапам (evidenceStatus, blocking). waiting_final — вещи без финала;
  // shortage_usd — недостача, которая зафиксируется при закрытии.
  function closeChecklist(o) {
    const issued = orderItemIds(o).filter(id => itemFlow(o, id).issued > 0);
    const waiting = issued.filter(id => !itemDone(o, id));
    const final_returned = issued.length ? waiting.length === 0 : o.lines.length === 0;
    const paid_in_cashbox = o.price_usd > 0 && confirmedTotal(o) >= o.price_usd && o.payments.every(p => p.status === 'confirmed');
    const acceptance_approved = o.reports.some(r => r.stage === 'acceptance' && r.status === 'approved');
    const evidence = evidenceStatus(o);
    const evidence_ok = evidence.every(e => !e.blocking || e.ok);
    return { final_returned, paid_in_cashbox, acceptance_approved, evidence_ok,
      ok: final_returned && paid_in_cashbox && acceptance_approved && evidence_ok,
      evidence: evidence.map(e => ({ stage: e.stage, state: e.state, blocking: e.blocking })),
      waiting_final: waiting.map(id => ({ item_id: id, item: items.get(id)?.name || null, on_site: itemFlow(o, id).onSite })),
      shortage_usd: shortageItems(o).reduce((a, x) => a + x.amount_usd, 0) };
  }
  // Сдельное начисление при одобрении «Приёмки»: каждому из команды — ставка его уровня за тип заказа
  const accrual = o => o.team.map(id => employees.get(id))
    .filter(e => e && rates[e.level] && rates[e.level][o.type] !== undefined)
    .map(e => ({ employee_id: e.id, level: e.level, order_type: o.type, amount_usd: rates[e.level][o.type] }));

  return {
    settings: s, today, N, items, employees,
    itemFlow, orderItemIds, itemDone, hasItemFinal, itemFinalDate, itemReleaseDate, hasFinal,
    teamCost, liveCost, closingCost, orderCost, costMode,
    period, reservesItemOn, reservesOn, itemOverdue, isOverdue, lost, presentQty, stock, shortageItems, shortageStatus, itemTotals,
    closedPrice, recoveredAfterClose, recoveredAfterCloseUsd,
    busyOn, free, freeForPeriod, freeForOrder, freeForNew, freeDetail, bookingCell, conflicts, notReturned,
    paidTotal, confirmedTotal, pmDebt, cashBox, cashParts, fund, closeChecklist, accrual,
    rule, evidenceStatus,
  };
}

module.exports = { addDays, daysBetween, dayRange, wearPerOrder, fixedMonthly, fixedShare, isActive, averagePrice,
  countFiles, evidenceGap, evidenceText, model };
