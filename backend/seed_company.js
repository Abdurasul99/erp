/* Тестовые данные для ОДНОЙ компании (по имени или id): магазин зоотоваров за последние N дней.
   Пишет так же, как экраны Wave: приход от поставщика (+ расход кассы за оплаченную часть, + остаток),
   продажа (approved, + приход кассы за оплаченную часть, − остаток), расходы по категориям отчёта,
   клиенты (постоянные, ушедшие, новые; ДР), долги клиентов и поставщикам, жалобы, задачи.
   Этого хватает и экранам, и ИИ: ИИ берёт выручку, прибыль, тренд по месяцам, топ товаров и продавцов,
   склад, долги и клиентов именно из этих таблиц (getCompanyContextForAI в server.js).

   Метка сида — '[SEED-ZOO]' в note/description/title, у товаров — штрихкод 'SEED-<компания>-<n>'.
   Своя метка, а не общий '[SEED]': им помечают и seed_demo.js, и чужие тестовые наборы (в Zveri такой уже был),
   а очистка любого из них не должна задевать другие.
   Всё одной транзакцией; повторный запуск сначала убирает прежний сид ЭТОЙ компании (чужие не трогает).
   Своих товаров и остатков компании скрипт не меняет — каталог сида отдельный.

   Запуск (на сервере: cd /var/www/wareapp/backend):
     node seed_company.js --company zveri --dry-run   что будет — без записи (транзакция откатывается)
     node seed_company.js --company zveri             засеять
     node seed_company.js --company zveri --clean     убрать сид этой компании
   --company — id или часть названия (без учёта регистра); --days N — глубина истории (по умолчанию 120). */
require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const M = '[SEED-ZOO]'; // LIKE '%[SEED]%' её не находит — и наоборот
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (name) => process.argv.includes(name);

let seed = 20261104; // детерминированный случайный ряд: один и тот же набор при каждом запуске
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const rnd = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const weighted = (items, w) => {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = rand() * total;
  for (const x of items) { r -= w(x); if (r <= 0) return x; }
  return items[items.length - 1];
};
const dayStart = (daysAgo) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d; };
const at = (daysAgo, hour, minute = rnd(0, 59)) => { const d = dayStart(daysAgo); d.setHours(hour, minute, rnd(0, 59)); return d; };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (v) => Math.round(v).toLocaleString('ru-RU');

// Каталог: [название, название uz, бренд, ед., цена продажи, закупка, популярность, поставщик (индекс), подорожал в середине]
const CATALOG = [
  ['Корм для кошек Whiskas курица, пауч 85 г', 'Mushuklar uchun Whiskas tovuq, 85 g', 'Whiskas', 'шт', 9000, 6300, 10, 0, true],
  ['Корм для кошек Felix в желе, пауч 75 г', 'Mushuklar uchun Felix jele, 75 g', 'Felix', 'шт', 8000, 5500, 9, 1, false],
  ['Корм для кошек Whiskas сухой, 1,9 кг', 'Mushuklar uchun Whiskas quruq, 1,9 kg', 'Whiskas', 'шт', 89000, 64000, 6, 0, true],
  ['Корм для кошек Purina ONE, 1,5 кг', 'Mushuklar uchun Purina ONE, 1,5 kg', 'Purina', 'шт', 175000, 128000, 4, 1, false],
  ['Корм для кошек Royal Canin Indoor, 2 кг', 'Mushuklar uchun Royal Canin Indoor, 2 kg', 'Royal Canin', 'шт', 385000, 290000, 3, 2, true],
  ['Корм для собак Pedigree говядина, 2,2 кг', 'Itlar uchun Pedigree mol go\'shti, 2,2 kg', 'Pedigree', 'шт', 98000, 71000, 6, 0, false],
  ['Корм для собак Chappi, 2,5 кг', 'Itlar uchun Chappi, 2,5 kg', 'Chappi', 'шт', 79000, 57000, 4, 0, false],
  ['Корм для собак Royal Canin Medium Adult, 3 кг', 'Itlar uchun Royal Canin Medium Adult, 3 kg', 'Royal Canin', 'шт', 420000, 315000, 2, 2, true],
  ['Корм для собак на развес', 'Itlar uchun tortib sotiladigan ozuqa', null, 'кг', 32000, 21000, 5, 3, false],
  ['Лакомство для собак Dentastix', 'Itlar uchun Dentastix shirinligi', 'Pedigree', 'шт', 29000, 19000, 5, 0, false],
  ['Наполнитель древесный, 10 л', 'Yog\'och to\'ldiruvchi, 10 l', null, 'шт', 45000, 30000, 7, 3, false],
  ['Наполнитель комкующийся, 5 кг', 'Bo\'laklanuvchi to\'ldiruvchi, 5 kg', null, 'шт', 59000, 39000, 5, 3, true],
  ['Наполнитель силикагелевый, 3,8 л', 'Silikagel to\'ldiruvchi, 3,8 l', null, 'шт', 69000, 46000, 4, 3, false],
  ['Лоток для кошек с бортом', 'Mushuk tuvagi, bortli', null, 'шт', 65000, 38000, 2, 3, false],
  ['Когтеточка-столбик 50 см', 'Tirnoq qayragich ustun, 50 sm', null, 'шт', 120000, 72000, 1.5, 3, false],
  ['Игрушка-мышь для кошек', 'Mushuklar uchun sichqon o\'yinchoq', null, 'шт', 12000, 5000, 4, 3, false],
  ['Мяч для собак резиновый', 'Itlar uchun rezina to\'p', null, 'шт', 25000, 12000, 3, 3, false],
  ['Ошейник от блох и клещей', 'Burga va kanaga qarshi bo\'yinbog\'', null, 'шт', 55000, 33000, 3, 3, false],
  ['Капли от блох Барс', 'Burgaga qarshi Bars tomchilari', 'Барс', 'шт', 38000, 24000, 3, 3, false],
  ['Шампунь для собак, 250 мл', 'Itlar uchun shampun, 250 ml', null, 'шт', 42000, 26000, 2, 3, false],
  ['Поводок-рулетка 5 м', 'Ruletka tasma, 5 m', null, 'шт', 110000, 68000, 1.5, 3, false],
  ['Шлейка для кошек', 'Mushuklar uchun shleyka', null, 'шт', 48000, 27000, 1.5, 3, false],
  ['Переноска пластиковая, средняя', 'Plastik tashigich, o\'rta', null, 'шт', 260000, 175000, 0.7, 3, false],
  ['Лежак для собак, 60 см', 'Itlar uchun to\'shak, 60 sm', null, 'шт', 210000, 135000, 0.8, 3, false],
  ['Миска керамическая', 'Sopol idish', null, 'шт', 35000, 18000, 2, 3, false],
  ['Витамины для кошек', 'Mushuklar uchun vitaminlar', null, 'шт', 52000, 31000, 1.5, 1, false],
  ['Корм для попугаев, 500 г', 'To\'tiqushlar uchun ozuqa, 500 g', null, 'шт', 28000, 18000, 3, 4, false],
  ['Корм для рыб TetraMin, 100 мл', 'Baliqlar uchun TetraMin, 100 ml', 'Tetra', 'шт', 46000, 30000, 2, 4, false],
  ['Опилки для грызунов, 15 л', 'Kemiruvchilar uchun qipiq, 15 l', null, 'шт', 30000, 18000, 2, 4, false],
  ['Клетка для хомяка', 'Hamster uchun qafas', null, 'шт', 230000, 150000, 0.5, 4, false],
  ['Фильтр для аквариума внутренний', 'Akvarium uchun ichki filtr', null, 'шт', 135000, 88000, 0.6, 4, false],
  ['Аквариум 30 л', 'Akvarium, 30 l', null, 'шт', 480000, 340000, 0.4, 4, false],
];
const SUPPLIERS = [
  ['PetFood Distribution', 'Азиз Каримов', '+998901234501'],
  ['Purina Trade Tashkent', 'Шахноза Юсупова', '+998901234502'],
  ['Premium Pet Supply', 'Дмитрий Ли', '+998901234503'],
  ['Ташкент ЗооОпт', 'Бахтиёр Рахимов', '+998901234504'],
  ['Aqua Mir', 'Нодира Алиева', '+998901234505'],
];
const FIRST = ['Алишер', 'Дилноза', 'Бекзод', 'Гулнора', 'Шерзод', 'Малика', 'Тимур', 'Нилуфар', 'Жасур', 'Камила', 'Рустам', 'Зухра', 'Отабек', 'Лола', 'Фаррух',
  'Мадина', 'Санжар', 'Севара', 'Икром', 'Дильшод', 'Азиза', 'Улугбек', 'Феруза', 'Сардор', 'Наргиза', 'Бобур', 'Шахло', 'Эльдор', 'Гульнара', 'Анвар',
  'Елена', 'Ольга', 'Сергей', 'Анна', 'Игорь', 'Мария', 'Жамшид', 'Озода', 'Нодир', 'Ситора', 'Хуршид', 'Барно', 'Акмаль', 'Мохира', 'Равшан'];
const LAST = ['Каримов', 'Юсупова', 'Рахимов', 'Алиева', 'Турсунов', 'Насырова', 'Ким', 'Иванова', 'Султанов', 'Мирзаева', 'Хасанов', 'Абдуллаева', 'Петров', 'Тен', 'Исмоилов'];
const lastFor = (first, i) => { const l = LAST[i % LAST.length]; const fem = /[аяо]$/.test(first) || first === 'Нилуфар'; return fem ? l.replace(/ов$/, 'ова').replace(/ев$/, 'ева') : l.replace(/ова$/, 'ов').replace(/ева$/, 'ев'); };
const SOURCES = [['instagram', 5], ['walk-in', 4], ['referral', 3], ['telegram', 3], ['google', 1], ['unknown', 1]];
const HOURS = [[9, 2], [10, 4], [11, 6], [12, 8], [13, 8], [14, 6], [15, 5], [16, 5], [17, 7], [18, 9], [19, 9], [20, 6], [21, 2]];
const WEEKDAY = [1.25, 0.85, 1.0, 1.0, 1.05, 1.1, 1.3]; // вс..сб

function pool() {
  return new Pool({
    database: process.env.DB_NAME || 'warehouse', user: process.env.DB_USER || 'wareapp_user',
    password: process.env.DB_PASS, host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT, 10) || 5432, max: 1,
  });
}

// Многострочная вставка; возвращает строки RETURNING (порядок не важен — всё нужное в самих строках).
async function insertMany(c, table, cols, rows, returning = 'id') {
  if (!rows.length) return [];
  const out = [];
  const per = Math.max(1, Math.floor(30000 / cols.length));
  for (let i = 0; i < rows.length; i += per) {
    const part = rows.slice(i, i + per);
    const params = [];
    const values = part.map(r => `(${r.map(v => { params.push(v); return '$' + params.length; }).join(',')})`);
    const { rows: got } = await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')} RETURNING ${returning}`, params);
    out.push(...got);
  }
  return out;
}

// Мягкая попытка: шаг, который может упасть из-за прав/ссылок (кэши, внешние ссылки), не роняет всю транзакцию.
async function soft(c, label, fn) {
  await c.query('SAVEPOINT s');
  try { const r = await fn(); await c.query('RELEASE SAVEPOINT s'); return r; }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT s'); console.log(`  (пропущено: ${label} — ${e.message})`); return null; }
}

async function clean(c, cid, branches) {
  const sp = (await c.query("SELECT id FROM products WHERE company_id=$1 AND barcode LIKE 'SEED-%'", [cid])).rows.map(r => r.id);
  const n = {};
  const del = async (k, sql, params) => { n[k] = (await c.query(sql, params)).rowCount; };
  await del('касса+', `DELETE FROM cash_income WHERE branch_id = ANY($1::int[]) AND (description LIKE '%${M}%'
    OR outcome_id IN (SELECT id FROM stock_outcome WHERE product_id = ANY($2::int[])))`, [branches, sp]);
  await del('касса−', `DELETE FROM cash_expense WHERE branch_id = ANY($1::int[]) AND description LIKE '%${M}%'`, [branches]);
  await del('продажи', `DELETE FROM stock_outcome WHERE (branch_id = ANY($1::int[]) AND note LIKE '%${M}%') OR product_id = ANY($2::int[])`, [branches, sp]);
  await del('приходы', `DELETE FROM stock_income WHERE (branch_id = ANY($1::int[]) AND note LIKE '%${M}%') OR product_id = ANY($2::int[])`, [branches, sp]);
  await del('остатки', 'DELETE FROM product_stock WHERE product_id = ANY($1::int[])', [sp]);
  n['товары'] = await soft(c, 'товары удалить', async () => (await c.query('DELETE FROM products WHERE id = ANY($1::int[])', [sp])).rowCount)
    ?? (await c.query('UPDATE products SET deleted_at=NOW() WHERE id = ANY($1::int[]) AND deleted_at IS NULL', [sp])).rowCount;
  await del('жалобы', `DELETE FROM complaints WHERE company_id=$1 AND description LIKE '%${M}%'`, [cid]);
  await del('задачи', `DELETE FROM tasks WHERE company_id=$1 AND (title LIKE '%${M}%' OR description LIKE '%${M}%')`, [cid]);
  n['клиенты'] = await soft(c, 'клиенты удалить', async () => (await c.query(`DELETE FROM customers WHERE company_id=$1 AND note LIKE '%${M}%'`, [cid])).rowCount)
    ?? (await c.query(`UPDATE customers SET deleted_at=NOW() WHERE company_id=$1 AND note LIKE '%${M}%' AND deleted_at IS NULL`, [cid])).rowCount;
  n['поставщики'] = await soft(c, 'поставщики удалить', async () => (await c.query(`DELETE FROM suppliers WHERE company_id=$1 AND note LIKE '%${M}%'`, [cid])).rowCount)
    ?? (await c.query(`UPDATE suppliers SET deleted_at=NOW() WHERE company_id=$1 AND note LIKE '%${M}%' AND deleted_at IS NULL`, [cid])).rowCount;
  return n;
}

// Кэши аналитики компании: пересчитаются на свежих данных при следующем открытии экрана.
async function dropCaches(c, cid) {
  await soft(c, 'кэш RFM', () => c.query('DELETE FROM customer_rfm WHERE company_id=$1', [cid]));
  await soft(c, 'кэш когорт', () => c.query('DELETE FROM cohort_cache WHERE company_id=$1', [cid]));
  await soft(c, 'кэш BHI за сегодня', () => c.query('DELETE FROM bhi_daily WHERE company_id=$1 AND date=CURRENT_DATE', [cid]));
}

async function findCompany(c, q) {
  if (!q) throw new Error('укажите --company <id или часть названия>');
  const byId = /^\d+$/.test(q);
  const { rows } = byId
    ? await c.query('SELECT id, name FROM companies WHERE id=$1', [Number(q)])
    : await c.query("SELECT id, name FROM companies WHERE name ILIKE '%' || $1 || '%' ORDER BY id", [q]);
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) {
    console.log(`Под «${q}» подходит несколько компаний — укажите id:`);
    rows.forEach(r => console.log(`  --company ${r.id}   ${r.name}`));
  } else {
    console.log(`Компания «${q}» не найдена. Есть:`);
    (await c.query('SELECT id, name FROM companies ORDER BY id')).rows.forEach(r => console.log(`  ${r.id}  ${r.name}`));
  }
  return null;
}

async function main() {
  const days = Math.max(30, Math.min(365, parseInt(arg('--days'), 10) || 120));
  const dry = flag('--dry-run'), cleanOnly = flag('--clean');
  const p = pool();
  const c = await p.connect();
  try {
    const company = await findCompany(c, arg('--company'));
    if (!company) { process.exitCode = 1; return; }
    const cid = company.id;
    const branchRows = (await c.query('SELECT id, name FROM branches WHERE company_id=$1 ORDER BY id', [cid])).rows;
    const branches = branchRows.map(b => b.id);
    const users = (await c.query(`SELECT id, username, role, branch_id, COALESCE(ai_enabled, true) AS ai_enabled, COALESCE(blocked_tools,'{}') AS blocked_tools
      FROM users WHERE company_id=$1 AND role <> 'admin' AND COALESCE(is_blocked,false) = false ORDER BY id`, [cid])).rows;
    console.log(`Компания ${cid} «${company.name}»: филиалов ${branches.length} (${branchRows.map(b => b.name).join(', ') || '—'}), сотрудников ${users.length} (${users.map(u => `${u.username}:${u.role}`).join(', ') || '—'})`);
    const own = (await c.query(`SELECT
        (SELECT COUNT(*) FROM products WHERE company_id=$1 AND deleted_at IS NULL AND COALESCE(barcode,'') NOT LIKE 'SEED-%')::int AS products,
        (SELECT COUNT(*) FROM stock_outcome WHERE branch_id = ANY($2::int[]) AND COALESCE(note,'') NOT LIKE '%${M}%')::int AS sales,
        (SELECT COUNT(*) FROM stock_outcome WHERE branch_id = ANY($2::int[]) AND note LIKE '%[SEED]%')::int AS other_seed`, [cid, branches])).rows[0];
    if (own.products || own.sales) {
      console.log(`  своих данных: товаров ${own.products}, продаж ${own.sales}${own.other_seed ? ` (из них ${own.other_seed} — другой тестовый набор [SEED])` : ''} — не трогаются, сид ляжет рядом`);
    }
    if (!branches.length) { console.log('Нет ни одного филиала — сначала создайте филиал в админке.'); process.exitCode = 1; return; }
    if (!users.length) { console.log('Нет ни одного сотрудника (кроме админа) — продажи не на кого записать.'); process.exitCode = 1; return; }

    await c.query('BEGIN');
    const removed = await clean(c, cid, branches);
    const removedTotal = Object.values(removed).reduce((s, v) => s + (v || 0), 0);
    console.log(removedTotal ? `Убран прежний сид: ${Object.entries(removed).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ')}` : 'Прежнего сида нет.');
    if (cleanOnly) {
      await dropCaches(c, cid);
      await c.query(dry ? 'ROLLBACK' : 'COMMIT');
      console.log(dry ? 'Пробный запуск — ничего не записано.' : 'Готово (clean).');
      return;
    }

    const byRole = (...roles) => users.filter(u => roles.includes(u.role));
    const owner = byRole('founder', 'gen_dir', 'director')[0] || users[0];
    const stockKeeper = byRole('warehouse', 'cashier', 'manager')[0] || owner;
    // Кто продаёт в филиале: продавцы и кассиры этого филиала, иначе — любые сотрудники компании.
    const sellersFor = (bid) => {
      const local = users.filter(u => ['seller', 'cashier'].includes(u.role) && u.branch_id === bid);
      if (local.length) return local;
      const any = byRole('seller', 'cashier', 'manager');
      return any.length ? any : [owner];
    };

    // 1. Поставщики
    const sup = await insertMany(c, 'suppliers', ['company_id', 'name', 'contact_person', 'phone', 'note', 'created_by', 'created_at'],
      SUPPLIERS.map(([name, person, phone]) => [cid, name, person, phone, M, owner.id, at(days + 5, 10)]), 'id, name');
    const supByName = Object.fromEntries(sup.map(s => [s.name, s.id]));

    // 2. Товары (свой каталог сида; цены «до подорожания» — 94% нынешних)
    const prodRows = await insertMany(c, 'products',
      ['name_ru', 'name_uz', 'brand', 'unit', 'price_buy', 'price_sell', 'barcode', 'branch_id', 'company_id', 'min_stock', 'lead_time_days', 'created_at'],
      CATALOG.map((x, i) => [x[0], x[1], x[2], x[3], x[5], x[4], `SEED-${cid}-${String(i + 1).padStart(3, '0')}`, branches[0], cid, x[3] === 'кг' ? 10 : 5, rnd(3, 10), at(days + 4, 11)]),
      'id, barcode');
    const prodId = Object.fromEntries(prodRows.map(r => [r.barcode, r.id]));
    const products = CATALOG.map((x, i) => ({
      id: prodId[`SEED-${cid}-${String(i + 1).padStart(3, '0')}`], name: x[0], unit: x[3], sell: x[4], buy: x[5], w: x[6],
      supplier: SUPPLIERS[x[7]][0], risen: x[8],
    }));
    const half = Math.floor(days / 2);
    const priceOn = (pr, d, key) => (pr.risen && d > half ? Math.round(pr[key] * 0.94 / 100) * 100 : pr[key]);

    // 3. Клиенты: постоянные (весь период), VIP, ушедшие (последняя покупка > 60 дней назад), новые
    const custPlan = [];
    for (let i = 0; i < 45; i++) {
      const kind = i < 8 ? 'vip' : i < 28 ? 'regular' : i < 38 ? 'lapsed' : 'new';
      const from = kind === 'new' ? rnd(5, 25) : kind === 'lapsed' ? days : rnd(Math.floor(days * 0.6), days);
      const to = kind === 'lapsed' ? rnd(62, Math.max(63, Math.floor(days * 0.75))) : 0;
      const first = FIRST[i % FIRST.length];
      // трое — с днём рождения в ближайшую неделю (для поздравлений)
      const bd = i < 3 ? (() => { const d = new Date(); d.setDate(d.getDate() + i * 2 + 1); return `19${rnd(78, 99)}-${ymd(d).slice(5)}`; })()
        : `19${rnd(70, 99)}-${String(rnd(1, 12)).padStart(2, '0')}-${String(rnd(1, 28)).padStart(2, '0')}`;
      custPlan.push({ kind, from, to, w: kind === 'vip' ? 7 : 2, name: `${first} ${lastFor(first, i)}`, bd });
    }
    const custRows = await insertMany(c, 'customers', ['company_id', 'name', 'phone', 'note', 'created_by', 'created_at', 'source', 'birth_date'],
      custPlan.map((cp, i) => [cid, cp.name, `+99890${String(1000000 + i * 37231).slice(0, 7)}`, M, owner.id, at(cp.from + 1, 12),
        weighted(SOURCES, s => s[1])[0], chance(0.85) ? cp.bd : null]), 'id, name');
    custRows.forEach((r, i) => { custPlan[i].id = r.id; });
    const custName = Object.fromEntries(custRows.map(r => [r.id, r.name]));

    // 4. Дни: приходы (дозаказ по точке заказа) и продажи, остаток ведём сами — в минус не уходим
    const avgQty = (pr) => (pr.unit === 'кг' ? 2.6 : pr.sell > 150000 ? 1.05 : 1.6);
    const basePerDay = 20;
    const wSum = products.reduce((s, pr) => s + pr.w, 0);
    const demand = (pr) => basePerDay * (pr.w / wSum) * avgQty(pr) * 1.1; // в день на филиал, с запасом
    const stock = {}; // `${bid}:${pid}` → qty
    const frozen = {}; // в конце периода пара товаров не дозаказывается → дефицит к сегодняшнему дню
    for (const bid of branches) {
      const ids = products.filter(pr => pr.w >= 3).map(pr => pr.id);
      frozen[`${bid}:${ids[rnd(0, ids.length - 1)]}`] = true;
      frozen[`${bid}:${ids[rnd(0, ids.length - 1)]}`] = true;
    }
    const now = new Date();
    let nSales = 0, revenue = 0, cost = 0, nIncome = 0, incomeSum = 0, clientDebt = 0, supplierDebt = 0;
    const payMethods = [['cash', 5], ['card', 4], ['transfer', 1.5]];

    for (let d = days; d >= 0; d--) {
      const day = dayStart(d);
      const growth = 0.85 + 0.3 * (1 - d / days); // плавный рост ~ +35% за период
      for (const bid of branches) {
        // 4a. Приходы утром: при остатке ниже точки заказа — партия на ~3 недели
        const incomes = [];
        for (const pr of products) {
          const key = `${bid}:${pr.id}`;
          const have = stock[key] || 0;
          const rop = Math.ceil(demand(pr) * 7) + 2;
          if (have >= rop || (frozen[key] && d <= 14 && d !== days)) continue;
          const qty = Math.max(pr.unit === 'кг' ? 20 : 4, Math.ceil(demand(pr) * rnd(18, 26)));
          const price = priceOn(pr, d, 'buy');
          const total = qty * price;
          // долги поставщикам — только по свежим партиям; старые оплачены
          const ps = d <= 25 ? weighted([['paid', 6], ['partial', 2], ['debt', 2]], x => x[1])[0] : 'paid';
          const paid = ps === 'paid' ? total : ps === 'partial' ? Math.round(total * 0.5) : 0;
          const ts = new Date(Math.min(at(d, 9, rnd(0, 40)).getTime(), now.getTime() - 60000));
          incomes.push({ pr, qty, price, paid, ps, ts, method: chance(0.6) ? 'transfer' : 'cash' });
          stock[key] = have + qty;
          nIncome++; incomeSum += total; supplierDebt += total - paid;
        }
        const incRows = await insertMany(c, 'stock_income',
          ['product_id', 'quantity', 'price', 'note', 'created_by', 'created_at', 'supplier', 'supplier_id', 'exchange_rate', 'branch_id',
            'payment_status', 'paid_amount', 'due_date', 'payment_method', 'currency'],
          incomes.map(x => [x.pr.id, x.qty, x.price, `${M} Приход от поставщика`, stockKeeper.id, x.ts, x.pr.supplier, supByName[x.pr.supplier], 0, bid,
            x.ps, x.paid, x.ps === 'paid' ? null : ymd(new Date(x.ts.getTime() + 14 * 86400000)), x.method, 'UZS']),
          'id, product_id, quantity, paid_amount, payment_status, payment_method, created_at, supplier');
        // оплаченная часть закупки — расход кассы, как в POST /api/stock/income
        const nameById = Object.fromEntries(products.map(pr => [pr.id, pr.name]));
        await insertMany(c, 'cash_expense', ['amount', 'description', 'created_by', 'created_at', 'branch_id', 'payment_method', 'currency', 'original_amount', 'exchange_rate', 'category'],
          incRows.filter(r => Number(r.paid_amount) > 0).map(r => [r.paid_amount,
            `Закупка: ${r.supplier} — ${nameById[r.product_id]} × ${Number(r.quantity)}${r.payment_status === 'partial' ? ' (частично)' : ''} ${M}`,
            stockKeeper.id, r.created_at, bid, r.payment_method, 'UZS', r.paid_amount, 1, 'Закупка товара']));

        // 4b. Продажи за день
        const n = Math.max(3, Math.round(basePerDay * growth * WEEKDAY[day.getDay()] * (0.8 + rand() * 0.4)));
        const sales = [];
        const sellers = sellersFor(bid);
        for (let s = 0; s < n; s++) {
          const pr = weighted(products, x => x.w);
          const key = `${bid}:${pr.id}`;
          let qty = pr.unit === 'кг' ? rnd(1, 5) : pr.sell > 150000 ? 1 : weighted([[1, 6], [2, 3], [3, 1], [4, 0.5]], x => x[1])[0];
          if ((stock[key] || 0) < qty) continue; // нет на складе — покупатель ушёл без покупки
          const ts = at(d, weighted(HOURS, h => h[1])[0]);
          if (ts > now) continue;
          const active = custPlan.filter(cp => cp.id && d <= cp.from && d >= cp.to);
          const cust = active.length && chance(0.7) ? weighted(active, cp => cp.w) : null;
          const price = chance(0.12) ? Math.round(priceOn(pr, d, 'sell') * 0.9 / 100) * 100 : priceOn(pr, d, 'sell');
          const total = qty * price;
          let ps = 'paid', paid = total;
          if (cust && d <= 40 && chance(0.1)) { ps = chance(0.5) ? 'debt' : 'partial'; paid = ps === 'debt' ? 0 : Math.round(total * 0.5 / 1000) * 1000; }
          stock[key] -= qty;
          sales.push([pr.id, qty, price, M, pick(sellers).id, owner.id, 'approved', ts, bid, cust ? cust.id : null,
            weighted(payMethods, x => x[1])[0], ps, paid, ps === 'paid' ? null : ymd(new Date(ts.getTime() + 14 * 86400000)), 'sale', 'UZS', 1]);
          nSales++; revenue += total; cost += qty * pr.buy; clientDebt += total - paid;
        }
        const soRows = await insertMany(c, 'stock_outcome',
          ['product_id', 'quantity', 'price', 'note', 'created_by', 'approved_by', 'status', 'created_at', 'branch_id', 'customer_id',
            'payment_method', 'payment_status', 'paid_amount', 'due_date', 'outcome_type', 'currency', 'exchange_rate'],
          sales, 'id, product_id, quantity, paid_amount, payment_status, payment_method, customer_id, created_by, created_at');
        // оплаченная часть продажи — приход кассы, как в POST /api/stock/outcome
        await insertMany(c, 'cash_income', ['amount', 'description', 'created_by', 'created_at', 'branch_id', 'outcome_id', 'is_settled', 'payment_method', 'currency', 'original_amount', 'exchange_rate'],
          soRows.filter(r => Number(r.paid_amount) > 0).map(r => [r.paid_amount,
            `Продажа${r.customer_id ? ` (${custName[r.customer_id]})` : ''}: ${nameById[r.product_id]} × ${Number(r.quantity)}${r.payment_status === 'partial' ? ' (частично)' : ''} ${M}`,
            r.created_by, r.created_at, bid, r.id, true, r.payment_method, 'UZS', r.paid_amount, 1]));
      }
    }

    // 5. Остатки — ровно то, что осталось после приходов и продаж
    const stockRows = Object.entries(stock).map(([k, q]) => { const [bid, pid] = k.split(':').map(Number); return [pid, bid, Math.max(0, q), now]; });
    await insertMany(c, 'product_stock', ['product_id', 'branch_id', 'quantity', 'updated_at'], stockRows);

    // 6. Операционные расходы по категориям отчёта «Расходы»
    const expenses = [];
    let expenseSum = 0;
    branchRows.forEach((b, bi) => {
      const rent = (5 + bi) * 1000000, salary = rnd(30, 36) * 100000; // чистая прибыль ~5% выручки
      for (let d = days; d >= 0; d--) {
        const day = dayStart(d), dom = day.getDate();
        const add = (amount, cat, text, hour = 11) => { const ts = at(d, hour); if (ts <= now) { expenses.push([amount, `${text} ${M}`, owner.id, ts, b.id, chance(0.7) ? 'transfer' : 'cash', 'UZS', amount, 1, cat]); expenseSum += amount; } };
        if (dom === 1) add(rent, 'Аренда', `Аренда помещения — ${b.name}`, 10);
        if (dom === 5 || dom === 20) add(salary, 'Зарплаты', dom === 5 ? 'Зарплата продавцам (аванс)' : 'Зарплата продавцам', 18);
        if (dom === 10) add(rnd(8, 13) * 100000, 'Коммунальные', 'Электричество и вода', 12);
        if (day.getDay() === 1) add(rnd(3, 8) * 100000, 'Реклама', pick(['Реклама в Instagram', 'Реклама в Telegram-канале', 'Таргет Instagram']), 15);
        if (chance(0.22)) add(rnd(5, 35) * 10000, 'Прочие', pick(['Пакеты и упаковка', 'Вода и чай для магазина', 'Такси до поставщика', 'Канцтовары', 'Ремонт витрины']), rnd(10, 19));
      }
    });
    await insertMany(c, 'cash_expense', ['amount', 'description', 'created_by', 'created_at', 'branch_id', 'payment_method', 'currency', 'original_amount', 'exchange_rate', 'category'], expenses);

    // 7. Жалобы (открытые и решённые) и задачи
    // коды категорий — как CMPL_CATEGORIES в server.js; срочность 'normal' (просрочку > 24 ч экран сам показывает как «срочно»)
    const texts = [['Кот отказывается есть новый корм — просят обмен', 'product_quality'], ['Долго ждали на кассе', 'slow_service'],
      ['В соседнем магазине наполнитель дешевле', 'wrong_price'], ['Порвалась упаковка корма', 'product_quality'], ['Нет нужного корма Royal Canin третий раз', 'other'],
      ['Продавец грубо ответил на вопрос про шлейку', 'staff_rudeness'], ['Деньги за возвращённую переноску ещё не вернули', 'refund_delay'], ['Не пробили скидку постоянного клиента', 'wrong_price']];
    const complaints = texts.map(([t, cat], i) => {
      const resolved = i % 2 === 0; const ts = at(rnd(2, 30), rnd(10, 19)); const cp = pick(custPlan);
      return [cid, pick(branches), cp.id, cp.name, cat, `${t} ${M}`, pick(['phone', 'instagram', 'in_store', 'telegram']),
        resolved ? 'resolved' : pick(['new', 'in_progress']), 'normal', ts, ts,
        resolved ? `Решено: обмен/скидка 10% ${M}` : null, resolved ? new Date(ts.getTime() + rnd(1, 3) * 86400000) : null, resolved ? owner.id : null, resolved ? rnd(3, 5) : null];
    });
    await insertMany(c, 'complaints', ['company_id', 'branch_id', 'customer_id', 'customer_name', 'category', 'description', 'channel', 'status', 'urgency',
      'created_at', 'updated_at', 'resolution', 'resolved_at', 'resolved_by', 'customer_satisfaction'], complaints);
    const taskTitles = ['Дозаказать Royal Canin у поставщика', 'Провести инвентаризацию кормов', 'Обзвонить постоянных клиентов про акцию', 'Обновить ценники после подорожания',
      'Разобрать жалобу клиента', 'Сверить кассу за неделю', 'Выложить новинки в Instagram', 'Списать просроченный корм', 'Договориться об отсрочке с Ташкент ЗооОпт', 'Запустить акцию «2+1» на паучи'];
    const tasks = taskTitles.map((t, i) => {
      const st = ['todo', 'in_progress', 'done'][i % 3]; const ts = at(rnd(1, 20), rnd(9, 18));
      return [cid, pick(branches), `${t} ${M}`, `${M} тестовое поручение`, pick(users).id, owner.id, pick(['low', 'medium', 'high']),
        ymd(new Date(Date.now() + rnd(-4, 8) * 86400000)), st, ts, ts, st === 'done' ? new Date(Math.min(Date.now(), ts.getTime() + rnd(1, 4) * 86400000)) : null, 'manual'];
    });
    await insertMany(c, 'tasks', ['company_id', 'branch_id', 'title', 'description', 'assignee_id', 'created_by', 'priority', 'due_date', 'status',
      'created_at', 'updated_at', 'completed_at', 'source'], tasks);

    await dropCaches(c, cid);
    await c.query(dry ? 'ROLLBACK' : 'COMMIT');

    const low = stockRows.filter(r => r[2] < 5).length;
    console.log(`${dry ? 'ПРОБНЫЙ ЗАПУСК — ничего не записано. Было бы' : 'Засеяно'} за ${days} дн.:`);
    console.log(`  товаров ${products.length}, поставщиков ${sup.length}, клиентов ${custPlan.length}`);
    console.log(`  продаж ${nSales} на ${fmt(revenue)} сум, себестоимость ${fmt(cost)}, валовая прибыль ${fmt(revenue - cost)} (${revenue ? Math.round((revenue - cost) / revenue * 100) : 0}%)`);
    console.log(`  приходов ${nIncome} на ${fmt(incomeSum)}, операционных расходов ${expenses.length} на ${fmt(expenseSum)}`);
    console.log(`  долг клиентов ${fmt(clientDebt)}, долг поставщикам ${fmt(supplierDebt)}, позиций с остатком < 5: ${low}`);
    console.log(`  жалоб ${complaints.length}, задач ${tasks.length}`);

    // ИИ: кто им может пользоваться (роли AI_ROLES в server.js) и не выключен ли он
    const aiUsers = users.filter(u => ['founder', 'director'].includes(u.role));
    const off = aiUsers.filter(u => !u.ai_enabled);
    console.log(aiUsers.length
      ? `ИИ доступен: ${aiUsers.map(u => u.username).join(', ')}${off.length ? ` — ⚠ выключен у ${off.map(u => u.username).join(', ')} (включить: учредитель → Доступы, или админка)` : ''}`
      : '⚠ ИИ открыт только учредителю и директору — в компании таких входов нет.');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
    await p.end();
  }
}

if (require.main === module) main().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
module.exports = { main };
