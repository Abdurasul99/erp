/* Демо-сидер: реалистичные данные за последние 40 дней для компании тест-учредителя.
   Все строки помечены '[SEED]' (note/description) → идемпотентно и обратимо.
   Запуск:  node seed_demo.js          (засеять)
            node seed_demo.js --clean  (только удалить сид)
   Очистка вручную: DELETE по note/description LIKE '%[SEED]%'. */
require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse', user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS, host: process.env.DB_HOST || 'localhost', port: 5432,
});
const M = '[SEED]';
const DAYS = 40;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const tsAgo = (daysAgo, hour) => new Date(Date.now() - daysAgo * 86400000 - (24 - (hour ?? rnd(9, 21))) * 3600000);

async function clean() {
  await pool.query(`DELETE FROM cash_income  WHERE description LIKE '%${M}%'`);
  await pool.query(`DELETE FROM cash_expense WHERE description LIKE '%${M}%'`);
  await pool.query(`DELETE FROM complaints   WHERE description LIKE '%${M}%'`);
  await pool.query(`DELETE FROM tasks        WHERE description LIKE '%${M}%' OR title LIKE '%${M}%'`);
  await pool.query(`DELETE FROM stock_outcome WHERE note LIKE '%${M}%'`);
  await pool.query(`DELETE FROM customers    WHERE note LIKE '%${M}%'`);
}

(async () => {
  const cleanOnly = process.argv.includes('--clean');
  // Компания тест-учредителя
  const f = await pool.query("SELECT id, company_id FROM users WHERE role IN ('founder','gen_dir') ORDER BY id LIMIT 1");
  if (!f.rows[0]) { console.log('нет founder/gen_dir'); process.exit(0); }
  const COMPANY = f.rows[0].company_id, createdBy = f.rows[0].id;
  const branches = (await pool.query('SELECT id FROM branches WHERE company_id=$1 ORDER BY id', [COMPANY])).rows.map(r => r.id);
  const prods = (await pool.query(
    "SELECT id, COALESCE(price_buy,0)::float pb, COALESCE(price_sell,0)::float ps FROM products WHERE company_id=$1 AND deleted_at IS NULL AND COALESCE(price_sell,0) >= 100", [COMPANY])).rows;
  console.log(`company=${COMPANY} branches=${branches} products=${prods.length} createdBy=${createdBy}`);
  if (!branches.length || !prods.length) { console.log('нет филиалов/товаров с ценой'); process.exit(0); }

  console.log('Чистим прежний сид...'); await clean();
  if (cleanOnly) { console.log('Готово (clean).'); await pool.end(); return; }

  // 1. Клиенты (~20) с разными источниками и ДР
  const sources = ['instagram', 'referral', 'walk-in', 'telegram', 'google', 'unknown'];
  const names = ['Алишер', 'Дилноза', 'Бекзод', 'Гулнора', 'Шерзод', 'Малика', 'Тимур', 'Нилуфар', 'Жасур', 'Камила', 'Рустам', 'Зухра', 'Отабек', 'Лола', 'Фаррух', 'Мадина', 'Санжар', 'Севара', 'Икром', 'Дильшод'];
  const custIds = (await pool.query('SELECT id FROM customers WHERE company_id=$1 AND deleted_at IS NULL', [COMPANY])).rows.map(r => r.id);
  for (let i = 0; i < 20; i++) {
    const bd = `19${rnd(72, 99)}-${String(rnd(1, 12)).padStart(2, '0')}-${String(rnd(1, 28)).padStart(2, '0')}`;
    const r = await pool.query(
      `INSERT INTO customers (company_id,name,phone,note,created_by,created_at,source,birth_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [COMPANY, `${pick(names)} ${M}`, `+99890${rnd(1000000, 9999999)}`, M, createdBy, tsAgo(rnd(1, DAYS)), pick(sources), bd]);
    custIds.push(r.rows[0].id);
  }

  // 2. Пополним остатки, чтобы был «стоимость склада» и не было сплошного дефицита
  for (const b of branches) for (const p of prods) {
    const up = await pool.query('UPDATE product_stock SET quantity=GREATEST(quantity, $1), updated_at=NOW() WHERE product_id=$2 AND branch_id=$3', [rnd(8, 60), p.id, b]);
    if (up.rowCount === 0) await pool.query('INSERT INTO product_stock (product_id,branch_id,quantity,updated_at) VALUES ($1,$2,$3,NOW())', [p.id, b, rnd(8, 60)]);
  }
  // пара товаров в дефиците — для алертов
  for (const b of branches) await pool.query('UPDATE product_stock SET quantity=$1 WHERE product_id=$2 AND branch_id=$3', [rnd(1, 3), pick(prods).id, b]);

  // 3. Продажи + касса за DAYS дней
  let sales = 0, revenue = 0;
  const methods = ['cash', 'card', 'transfer'];
  for (let d = DAYS; d >= 0; d--) {
    for (const b of branches) {
      const n = rnd(4, 14);
      for (let s = 0; s < n; s++) {
        const p = pick(prods); const qty = rnd(1, 6);
        const price = chance(0.15) ? Math.round(p.ps * 0.9) : p.ps; // иногда скидка
        const total = qty * price;
        const cust = chance(0.85) ? pick(custIds) : null;
        const pm = pick(methods);
        let pstatus = 'paid', paid = total;
        if (chance(0.12)) { pstatus = 'debt'; paid = 0; }
        else if (chance(0.1)) { pstatus = 'partial'; paid = Math.round(total * 0.5); }
        const ts = tsAgo(d);
        const so = await pool.query(
          `INSERT INTO stock_outcome (product_id,quantity,price,note,created_by,approved_by,status,created_at,branch_id,customer_id,payment_method,payment_status,paid_amount,currency,exchange_rate)
           VALUES ($1,$2,$3,$4,$5,$5,'approved',$6,$7,$8,$9,$10,$11,'UZS',1) RETURNING id`,
          [p.id, qty, price, M, createdBy, ts, b, cust, pm, pstatus, paid]);
        if (paid > 0) await pool.query(
          `INSERT INTO cash_income (amount,description,created_by,created_at,branch_id,outcome_id,is_settled,payment_method,currency,original_amount,exchange_rate)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7,'UZS',$1,1)`,
          [paid, `${M} Продажа`, createdBy, ts, b, so.rows[0].id, pm === 'debt' ? 'cash' : pm]);
        sales++; revenue += total;
      }
    }
  }

  // 4. Расходы (аренда, закупка, зарплаты, прочее)
  const expTypes = ['Аренда', 'Закупка товара', 'Зарплата', 'Коммуналка', 'Реклама', 'Прочее'];
  for (let d = DAYS; d >= 0; d -= rnd(2, 4)) for (const b of branches) if (chance(0.7))
    await pool.query(`INSERT INTO cash_expense (amount,description,created_by,created_at,branch_id,payment_method,currency,original_amount,exchange_rate)
      VALUES ($1,$2,$3,$4,$5,'cash','UZS',$1,1)`, [rnd(50, 800) * 1000, `${M} ${pick(expTypes)}`, createdBy, tsAgo(d), b]);

  // 5. Жалобы (открытые + решённые)
  const cats = ['Качество товара', 'Обслуживание', 'Доставка', 'Цена', 'Возврат'];
  for (let i = 0; i < 7; i++) {
    const resolved = chance(0.5); const ts = tsAgo(rnd(1, 20)); const cust = pick(custIds);
    await pool.query(
      `INSERT INTO complaints (company_id,branch_id,customer_id,customer_name,category,description,channel,status,urgency,created_at,updated_at,resolution,resolved_at,resolved_by,customer_satisfaction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14)`,
      [COMPANY, pick(branches), cust, `Клиент ${M}`, pick(cats), `${M} Жалоба клиента — разобрать`, pick(['phone', 'instagram', 'walk-in']),
        resolved ? 'resolved' : pick(['new', 'in_progress']), pick(['low', 'medium', 'high']), ts,
        resolved ? `${M} Решено, компенсация` : null, resolved ? tsAgo(rnd(1, 10)) : null, resolved ? createdBy : null, resolved ? rnd(3, 5) : null]);
  }

  // 6. Задачи (kanban: todo/in_progress/done)
  const taskTitles = ['Заказать товар у поставщика', 'Провести инвентаризацию', 'Обзвонить VIP-клиентов', 'Обновить ценники', 'Разобрать жалобу', 'Сверить кассу', 'Обучить нового продавца', 'Запустить акцию'];
  for (let i = 0; i < 9; i++) {
    const st = pick(['todo', 'in_progress', 'done']); const ts = tsAgo(rnd(1, 25));
    await pool.query(
      `INSERT INTO tasks (company_id,branch_id,title,description,assignee_id,created_by,priority,due_date,status,created_at,updated_at,completed_at,source)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$9,$10,'manual')`,
      [COMPANY, pick(branches), `${pick(taskTitles)} ${M}`, `${M} демо-поручение`, createdBy, pick(['low', 'medium', 'high']),
        new Date(Date.now() + rnd(-5, 7) * 86400000), st, ts, st === 'done' ? tsAgo(rnd(0, 5)) : null]);
  }

  // 7. Сбросим кэш RFM, чтобы сегменты/прогноз пересчитались на свежих данных
  try { await pool.query('DELETE FROM customer_rfm WHERE company_id=$1', [COMPANY]); } catch (e) {}

  console.log(`✓ Засеяно: продажи=${sales}, выручка≈${Math.round(revenue).toLocaleString('ru-RU')}, клиенты=+20, расходы/жалобы/задачи добавлены.`);
  await pool.end();
})().catch(e => { console.error('SEED ERR', e.message); process.exit(1); });
