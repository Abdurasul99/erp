'use strict';

// Деньги мероприятия. Эталонные числа — из макета «Прибыль по событию»:
// «Свадьба Азиз и Нилуфар», цена 24 500 000, смета/факт по пяти статьям.

const test = require('node:test');
const assert = require('node:assert/strict');
const { eventMoney, costBreakdown, paymentStatus, itemTotals, round2 } = require('../src/money');

const WEDDING_LINES = [
  { category: 'materials', planned: 4500000, actual: 4730000 },
  { category: 'team', planned: 3200000, actual: 3200000 },
  { category: 'logistics', planned: 550000, actual: 600000 },
  { category: 'amort', planned: 850000, actual: 850000 },
  { category: 'other', planned: 300000, actual: 420000 },
];

test('прибыль по факту совпадает с макетом: 24 500 000 − 9 800 000', () => {
  const m = eventMoney({ event: { total_price: 24500000 }, costLines: WEDDING_LINES });
  assert.equal(m.cost.cost_total, 9800000);
  assert.equal(m.cost.planned_total, 9400000);
  assert.equal(m.profit, 14700000);
  assert.equal(m.margin_pct, 60);
  assert.equal(m.cost.fact_filled, 5);
});

test('отклонение «факт − смета» по статьям', () => {
  const { rows } = costBreakdown({ costLines: WEDDING_LINES });
  const byCat = Object.fromEntries(rows.map((r) => [r.category, r.delta]));
  assert.deepEqual(byCat, { materials: 230000, team: 0, logistics: 50000, amort: 0, other: 120000 });
});

test('статья без факта считается по смете, и это видно', () => {
  const lines = [{ category: 'materials', planned: 1000, actual: null }, { category: 'team', planned: 500, actual: 700 }];
  const b = costBreakdown({ costLines: lines });
  const mat = b.rows.find((r) => r.category === 'materials');
  assert.equal(mat.actual, null);
  assert.equal(mat.used, 1000);
  assert.equal(mat.delta, null, 'без факта отклонения нет — не выдумываем ноль');
  assert.equal(b.cost_total, 1700);
  assert.equal(b.fact_filled, 1);
});

test('смета не задана — считается из позиций и бригады', () => {
  const items = [
    { category: 'consumable', qty: 10, price: 50000, cost: 20000 }, // материалы: 200 000
    { category: 'rental', qty: 4, price: 100000, cost: 15000 },     // амортизация: 60 000
  ];
  const crew = [{ pay_amount: 300000 }, { pay_amount: 250000 }];     // бригада: 550 000
  const b = costBreakdown({ items, crew, costLines: [] });
  const get = (c) => b.rows.find((r) => r.category === c);
  assert.equal(get('materials').planned, 200000);
  assert.equal(get('amort').planned, 60000);
  assert.equal(get('team').planned, 550000);
  assert.equal(get('materials').planned_is_auto, true);
  assert.equal(get('logistics').planned, 0);
  assert.equal(b.cost_total, 810000);
});

test('ручная смета перекрывает автосмету, даже если она ноль', () => {
  const items = [{ category: 'consumable', qty: 10, price: 0, cost: 20000 }];
  const b = costBreakdown({ items, costLines: [{ category: 'materials', planned: 0, actual: null }] });
  const mat = b.rows.find((r) => r.category === 'materials');
  assert.equal(mat.planned, 0, 'явный ноль — это решение руководителя, а не «не задано»');
  assert.equal(mat.planned_is_auto, false);
});

test('выручка — цена договора, а не сумма позиций', () => {
  const items = [{ category: 'rental', qty: 1, price: 30000000, cost: 0 }];
  const m = eventMoney({ event: { total_price: 25000000 }, items });
  assert.equal(m.revenue, 25000000);
  assert.equal(m.cost.decorTotal, 30000000, 'сумма позиций остаётся расчётом для сметы');
});

test('убыточное мероприятие — маржа отрицательная и статус «убыток»', () => {
  // Макет: «Корпоратив IT Park», цена 32 000 000, себестоимость 33 500 000.
  const m = eventMoney({ event: { total_price: 32000000 }, costLines: [{ category: 'other', planned: 33500000 }] });
  assert.equal(m.profit, -1500000);
  assert.equal(m.margin_pct, -4.69);
  assert.equal(m.margin_status, 'loss');
});

test('маржа ниже целевой — отдельный статус', () => {
  const m = eventMoney({ event: { total_price: 1000 }, costLines: [{ category: 'other', planned: 800 }], targetMarginPct: 35 });
  assert.equal(m.margin_pct, 20);
  assert.equal(m.margin_status, 'below_target');
});

test('цена не задана — маржа неизвестна, а не деление на ноль', () => {
  const m = eventMoney({ event: { total_price: 0 }, costLines: [{ category: 'other', planned: 100 }] });
  assert.equal(m.margin_pct, null);
  assert.equal(m.margin_status, 'unknown');
  assert.equal(m.payment_status, 'no_price');
});

test('статусы оплаты на всех границах', () => {
  assert.equal(paymentStatus(1000, 0), 'unpaid');
  assert.equal(paymentStatus(1000, 1), 'partial');
  assert.equal(paymentStatus(1000, 999.99), 'partial');
  assert.equal(paymentStatus(1000, 1000), 'paid');
  assert.equal(paymentStatus(1000, 1000.01), 'overpaid');
  assert.equal(paymentStatus(0, 0), 'no_price');
  assert.equal(paymentStatus(0, 500), 'overpaid', 'деньги без цены — это переплата, а не «цена не задана»');
});

test('остаток к оплате и предоплата', () => {
  const m = eventMoney({ event: { total_price: 24500000 }, payments: [{ amount: 5000000 }, { amount: 2500000 }] });
  assert.equal(m.paid, 7500000);
  assert.equal(m.remaining, 17000000);
  assert.equal(m.payment_status, 'partial');
  assert.equal(m.payment_label, 'Предоплата');
});

test('копейки не накапливают ошибку округления', () => {
  // 0.1 + 0.2 в double — не 0.3; суммы обязаны округляться до копейки.
  const t = itemTotals([
    { category: 'consumable', qty: 3, price: 0.1, cost: 0 },
    { category: 'consumable', qty: 1, price: 0.2, cost: 0 },
  ]);
  assert.equal(t.decorTotal, 0.5);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('числа строками (как их отдаёт pg без парсера) считаются верно', () => {
  const m = eventMoney({
    event: { total_price: '1000.00' },
    payments: [{ amount: '250.50' }],
    costLines: [{ category: 'other', planned: '100.25', actual: null }],
  });
  assert.equal(m.paid, 250.5);
  assert.equal(m.profit, 899.75);
});
