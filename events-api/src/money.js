'use strict';

// Деньги мероприятия. Чистые функции без базы — чтобы их можно было проверить
// тестами на граничных случаях, а все экраны считали одинаково.
//
// Правила, которые держат цифры согласованными между экранами:
//   • ВЫРУЧКА события = total_price (цена, согласованная с клиентом). Сумма
//     позиций декора — расчёт для сметы, не выручка: скидки и работы делают
//     их разными, и два источника выручки дали бы два разных ответа.
//   • СЕБЕСТОИМОСТЬ = по пяти статьям «факт, если внесён, иначе смета».
//   • Смета статьи, не заданная вручную, считается из позиций и бригады.

const COST_CATEGORIES = ['materials', 'team', 'logistics', 'amort', 'other'];

const COST_LABELS = {
  materials: 'Материалы',
  team: 'Бригада',
  logistics: 'Логистика',
  amort: 'Амортизация проката',
  other: 'Прочее',
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;
const isSet = (v) => v !== null && v !== undefined && v !== '';

function itemTotals(items = []) {
  let rental = 0;
  let consumable = 0;
  let rentalCost = 0;
  let consumableCost = 0;
  for (const it of items) {
    const qty = num(it.qty);
    const sum = qty * num(it.price);
    const cost = qty * num(it.cost);
    if (it.category === 'rental') {
      rental += sum;
      rentalCost += cost;
    } else {
      consumable += sum;
      consumableCost += cost;
    }
  }
  return {
    decorTotal: round2(rental + consumable),
    rentalTotal: round2(rental),
    consumableTotal: round2(consumable),
    rentalCost: round2(rentalCost),
    consumableCost: round2(consumableCost),
  };
}

// Смета статьи по умолчанию — пока руководитель не задал её сам.
function autoPlanned(category, totals, crewPay) {
  if (category === 'materials') return totals.consumableCost;
  if (category === 'amort') return totals.rentalCost;
  if (category === 'team') return crewPay;
  return 0;
}

function costBreakdown({ items = [], crew = [], costLines = [] }) {
  const totals = itemTotals(items);
  const crewPay = round2(crew.reduce((s, c) => s + num(c.pay_amount), 0));
  const byCategory = new Map(costLines.map((l) => [l.category, l]));

  const rows = COST_CATEGORIES.map((category) => {
    const line = byCategory.get(category);
    const plannedIsAuto = !(line && isSet(line.planned));
    const planned = plannedIsAuto ? autoPlanned(category, totals, crewPay) : round2(line.planned);
    const actual = line && isSet(line.actual) ? round2(line.actual) : null;
    const used = actual === null ? planned : actual;
    return {
      category,
      label: COST_LABELS[category],
      planned,
      planned_is_auto: plannedIsAuto,
      actual,
      used,
      // Отклонение имеет смысл только когда есть факт: «факт − смета».
      delta: actual === null ? null : round2(actual - planned),
      note: line ? line.note || null : null,
    };
  });

  return {
    rows,
    planned_total: round2(rows.reduce((s, r) => s + r.planned, 0)),
    cost_total: round2(rows.reduce((s, r) => s + r.used, 0)),
    // Сколько статей уже закрыто фактом из пяти — чтобы экран честно показывал,
    // что прибыль посчитана частично по смете.
    fact_filled: rows.filter((r) => r.actual !== null).length,
    crew_pay: crewPay,
    ...totals,
  };
}

function paymentStatus(revenue, paid) {
  const r = round2(revenue);
  const p = round2(paid);
  if (r === 0) return p > 0 ? 'overpaid' : 'no_price';
  if (p === 0) return 'unpaid';
  if (p < r) return 'partial';
  if (p === r) return 'paid';
  return 'overpaid';
}

const PAYMENT_LABELS = {
  no_price: 'Цена не задана',
  unpaid: 'Не оплачено',
  partial: 'Предоплата',
  paid: 'Оплачено',
  overpaid: 'Переплата',
};

function marginStatus(marginPct, targetPct) {
  if (marginPct === null) return 'unknown';
  if (marginPct < 0) return 'loss';
  if (marginPct < num(targetPct)) return 'below_target';
  return 'ok';
}

// Сводка денег мероприятия: выручка, оплаты, себестоимость, прибыль, маржа.
function eventMoney({ event, items = [], crew = [], costLines = [], payments = [], targetMarginPct = 35 }) {
  const revenue = round2(event.total_price);
  const paid = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  const cost = costBreakdown({ items, crew, costLines });
  const profit = round2(revenue - cost.cost_total);
  const marginPct = revenue > 0 ? round2((profit / revenue) * 100) : null;
  const status = paymentStatus(revenue, paid);
  return {
    revenue,
    paid,
    remaining: round2(revenue - paid),
    payment_status: status,
    payment_label: PAYMENT_LABELS[status],
    cost,
    profit,
    margin_pct: marginPct,
    margin_status: marginStatus(marginPct, targetMarginPct),
    target_margin_pct: num(targetMarginPct),
  };
}

module.exports = {
  COST_CATEGORIES, COST_LABELS, PAYMENT_LABELS,
  round2, itemTotals, costBreakdown, paymentStatus, marginStatus, eventMoney,
};
