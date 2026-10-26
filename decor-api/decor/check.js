// Проверка данных компании сферы «Декор» по формулам: себестоимость заказов, бронь, «не вернулось с объекта», деньги.
// Только читает базу.
//   cd backend && node --preserve-symlinks --preserve-symlinks-main --env-file=.env decor/check.js ["Dora Decor"]
const { getPool } = require('../sphere_db');
const { loadCompany } = require('./data');
const F = require('./formulas');

const NAME = process.argv[2] || 'Dora Decor';
const ST = { lead: 'Лид', design: 'Дизайн', prepay: 'Предоплата', booked: 'Забронирован', install: 'Монтаж', acceptance: 'Приёмка', dismantle: 'Демонтаж', closed: 'Закрыт' };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const $ = n => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
const dm = s => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

(async () => {
  const pool = getPool('decor');
  try {
    const co = (await pool.query('SELECT id, name FROM companies WHERE name=$1 ORDER BY id LIMIT 1', [NAME])).rows[0];
    if (!co) { console.log(`Компании «${NAME}» нет`); return; }
    const data = await loadCompany(pool, co.id);
    const today = ymd(new Date());
    const m = F.model(data, today);
    const s = data.settings;
    console.log(`${co.name} (id ${co.id}) · сегодня ${today} · курс ${s.rate_uzs} сум/$ · дней на объекте N = ${s.days_on_site}`);
    console.log(`Постоянные в месяц ${$(F.fixedMonthly(s))} · на заказ ${$(F.fixedShare(s))} (÷ ${s.expected_orders})\n`);

    console.log(`${pad('Заказ', 7)}${pad('Статус', 14)}${pad('Дата', 7)}${pad('', 7)}${lpad('Износ', 10)}${lpad('Недост.', 9)}${lpad('Команда', 9)}${lpad('Прямая', 10)}${lpad('Полная', 10)}${lpad('Цена', 10)}${lpad('Прибыль', 11)}`);
    for (const o of data.orders) {
      const c = m.orderCost(o);
      const mode = { closed: 'снимок', plan: 'план', partial: 'частич', fact: 'факт' }[m.costMode(c)];
      console.log(`${pad(o.no, 7)}${pad(ST[o.status], 14)}${pad(dm(o.event_date), 7)}${pad(mode, 7)}${lpad($(c.wear), 10)}${lpad($(c.shortage), 9)}${lpad($(c.team), 9)}`
        + `${lpad($(c.direct), 10)}${lpad($(c.full), 10)}${lpad($(c.price), 10)}${lpad($(c.profit), 11)}${c.below_cost ? '  ⚠ цена ниже себестоимости' : ''}`
        + `${m.recoveredAfterCloseUsd(o) ? `  (после закрытия нашлось ${$(m.recoveredAfterCloseUsd(o))})` : ''}`);
    }

    const nr = m.notReturned();
    console.log(`\nНе вернулось с объекта: ${nr.length ? '' : 'нет'}`);
    for (const x of nr) console.log(`  ${x.no} ${x.client} — период кончился ${dm(x.period_to)}, опоздание ${x.days_late} дн.: ${x.items.map(i => `${i.item} ${i.qty}`).join(', ')}`);

    const sp = data.orders.filter(o => m.shortageStatus(o) === 'pending');
    console.log(`\nНедостача под вопросом (финал принят, заказ не закрыт): ${sp.length ? '' : 'нет'}`);
    for (const o of sp) console.log(`  ${o.no} ${o.client}: ${m.shortageItems(o).map(i => `${i.item} ${i.qty} (${$(i.amount_usd)})`).join(', ')} — предварительно`);

    const cf = m.conflicts();
    console.log(`\nКонфликты брони: ${cf.length ? '' : 'нет'}`);
    for (const x of cf) console.log(`  ${dm(x.day)} ${pad(x.item, 22)} нужно ${lpad(x.need, 4)}, есть ${lpad(x.have, 4)} (не вернулось ${x.not_returned}) — ${x.orders.join(', ')}`);

    console.log('\nДеньги у сотрудников (не подтверждено кассой):');
    for (const e of data.employees) { const d = m.pmDebt(e.id); if (d) console.log(`  ${e.name}: ${$(d)}`); }
    const cp = m.cashParts(); const fd = m.fund();
    console.log(`Касса: ${$(cp.cash)} = подтверждено ${$(cp.income)} − выплачено команде ${$(cp.payroll)} − покупки из фонда ${$(cp.fund)}`);
    console.log(`Фонд материалов: накоплено ${$(fd.accumulated)} (износ ${$(fd.wear)} + недостача ${$(fd.shortage)} − возвращено ${$(fd.recovered)}), потрачено ${$(fd.spent)}, остаток ${$(fd.remaining)}`);
  } finally { await pool.end(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
