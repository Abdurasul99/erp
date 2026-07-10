// Seed real test data into Проверка / Филиал 1 (branch_id=1).
// - 100 products with realistic names per type
// - Stock for each (initial income)
// - 100 approved sales (with auto cash_income)
// - 30 pending sales (awaiting warehouse approval)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS,
  host: process.env.DB_HOST || 'localhost', port: 5432,
});

const BRANCH_ID = 1;
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

// Realistic product names per type (RU + UZ)
const PRODUCT_NAMES = {
  'Yog\'ochlar':       [['Доска сосновая 25мм','Qarag\'ay taxta 25mm'], ['Брус 50×100','Brus 50×100'], ['Фанера 4мм','Fanera 4mm'], ['Рейка 20×40','Reyka 20×40'], ['ОСБ плита','OSB plita']],
  'Latunlar':          [['Латунный пруток 8мм','Latun sterjen 8mm'], ['Латунная труба 15мм','Latun quvur 15mm'], ['Латунный лист 1мм','Latun varaq 1mm'], ['Латунный уголок','Latun burchak'], ['Латунный фитинг','Latun fiting']],
  'Bosh kiyimlar':     [['Кепка чёрная','Qora kepka'], ['Бейсболка синяя','Ko\'k beysbolka'], ['Шапка зимняя','Qishki shapka'], ['Панама белая','Oq panama'], ['Платок шёлковый','Shoyi ro\'mol']],
  'Ayollar libosi':    [['Платье летнее','Yozgi ko\'ylak'], ['Юбка длинная','Uzun yubka'], ['Блузка белая','Oq bluzka'], ['Кофта вязаная','Trikotaj kofta'], ['Кардиган','Kardigan']],
  'Erkaklar libosi':   [['Рубашка классическая','Klassik ko\'ylak'], ['Футболка хлопок','Paxta futbolka'], ['Брюки чёрные','Qora shim'], ['Пиджак серый','Kulrang pidjak'], ['Костюм деловой','Ish kostyumi']],
  'Bolalar libosi':    [['Костюмчик детский','Bolalar kostyumi'], ['Футболка детская','Bolalar futbolkasi'], ['Шорты детские','Bolalar shortlari'], ['Платье для девочки','Qiz bola ko\'ylagi'], ['Куртка детская','Bolalar kurtkasi']],
  'Keramika buyumlar': [['Ваза керамическая','Sopol vaza'], ['Кружка фарфоровая','Chinni kosa'], ['Тарелка большая','Katta tovoq'], ['Чайник заварной','Damlama choynak'], ['Сахарница','Shakardon']],
  'Idish-tovoq':       [['Сковорода 24см','Tovaog\'och 24sm'], ['Кастрюля 3л','Qozon 3l'], ['Ложка столовая','Osh qoshig\'i'], ['Вилка','Sanchqi'], ['Нож кухонный','Oshxona pichoq']],
  'Mebel':             [['Стул деревянный','Yog\'och stul'], ['Стол обеденный','Ovqat stoli'], ['Шкаф двухдверный','Ikki eshikli shkaf'], ['Кровать односпальная','Yagona karavot'], ['Тумбочка','Tumba']],
  'Kosmetika':         [['Шампунь Head&Shoulders','Head&Shoulders shampun'], ['Крем для лица','Yuz uchun krem'], ['Помада красная','Qizil pomada'], ['Тушь чёрная','Qora tush'], ['Дезодорант Nivea','Nivea dezodorant']],
  'Maishiy buyumlar':  [['Стиральный порошок 3кг','Kir yuvish kukuni 3kg'], ['Зубная паста Colgate','Colgate tish pastasi'], ['Туалетная бумага','Tualet qog\'ozi'], ['Мыло хозяйственное','Xo\'jalik sovuni'], ['Губка для посуды','Idish-tovoq uchun shimgich']],
  'Boshqa':            [['Зажигалка','Olovqayraq'], ['Батарейки AA','AA batareyalar'], ['Ножницы канцелярские','Kantselyariya qaychisi'], ['Скотч прозрачный','Tiniq skotch'], ['Ручка шариковая','Sharikli ruchka']],
};

async function run() {
  // Pick users
  const { rows: users } = await pool.query("SELECT id, username, role FROM users WHERE branch_id=$1 OR role='admin' ORDER BY id", [BRANCH_ID]);
  const cashier   = users.find(u => u.role === 'cashier');
  const seller    = users.find(u => u.role === 'seller');
  const warehouse = users.find(u => u.role === 'warehouse') || cashier;
  const admin     = users.find(u => u.role === 'admin');
  if (!cashier || !seller) { console.error('Need cashier and seller'); process.exit(1); }

  // Map type names to IDs
  const { rows: types } = await pool.query("SELECT id, name_ru, name_uz FROM product_types");
  const typeByUz = Object.fromEntries(types.map(t => [t.name_uz, t]));

  // === 1. Create 100 products ===
  log('Creating 100 products...');
  const created = [];
  let idx = 0;
  for (const [uzType, names] of Object.entries(PRODUCT_NAMES)) {
    const type = typeByUz[uzType];
    if (!type) { log(`  type "${uzType}" not found, skip`); continue; }
    for (const [ru, uz] of names) {
      // ~8 products per type × 12 types ≈ 96, top up to 100 with variation
      const variants = 8;
      for (let v = 1; v <= variants && created.length < 100; v++) {
        idx++;
        const barcode = `200${String(Date.now() % 1000000).padStart(6,'0')}${String(idx).padStart(4,'0')}`;
        const priceBuy = 1000 + (idx * 137) % 50000;
        const priceSell = Math.round(priceBuy * (1.15 + (idx % 30) / 100));
        const suffix = v === 1 ? '' : ` (вар. ${v})`;
        const r = await pool.query(
          `INSERT INTO products (name_ru, name_uz, type_id, barcode, unit, price_buy, price_sell, branch_id, color_size, brand)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name_ru, price_sell`,
          [ru + suffix, uz + suffix, type.id, barcode, 'шт', priceBuy, priceSell, BRANCH_ID,
           v === 2 ? 'L' : v === 3 ? 'XL' : null, v > 4 ? 'Brand-' + (v - 4) : null]
        );
        created.push(r.rows[0]);
      }
      if (created.length >= 100) break;
    }
    if (created.length >= 100) break;
  }
  log(`  Created ${created.length} products`);

  // === 2. Stock_income for each product (sets initial quantity) ===
  log('Adding stock for each product...');
  for (const p of created) {
    const qty = 5 + (p.id % 95); // 5..99
    await pool.query(
      `INSERT INTO stock_income (product_id, quantity, price, created_by, supplier, branch_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, qty, Math.round(p.price_sell * 0.7), warehouse.id, 'Поставщик ' + (p.id % 5 + 1), BRANCH_ID, '']
    );
    await pool.query(
      `INSERT INTO product_stock (product_id, quantity) VALUES ($1,$2)
       ON CONFLICT (product_id) DO UPDATE SET quantity=$2`,
      [p.id, qty]
    );
  }
  log(`  Stock set for ${created.length} products`);

  // === 3. 100 approved sales (with auto cash_income) — spread over last 7 days ===
  log('Creating 100 approved sales (with cash income)...');
  for (let i = 0; i < 100; i++) {
    const product = created[i % created.length];
    const qty = 1 + (i % 5);
    const price = parseFloat(product.price_sell);
    // Random offset over last 7 days
    const offsetMs = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
    const seller_user = i % 3 === 0 ? cashier.id : seller.id; // mix
    const { rows: [out] } = await pool.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, status, created_by, approved_by, branch_id, created_at)
       VALUES ($1,$2,$3,'approved',$4,$5,$6, NOW() - ($7 * INTERVAL '1 millisecond'))
       RETURNING id, created_at`,
      [product.id, qty, price, seller_user, seller_user, BRANCH_ID, offsetMs]
    );
    // Decrement stock
    await pool.query('UPDATE product_stock SET quantity = quantity - $1 WHERE product_id=$2', [qty, product.id]);
    // Auto cash_income
    await pool.query(
      `INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, created_at)
       VALUES ($1,$2,$3,$4,$5, $6)`,
      [qty * price, `Продажа: ${product.name_ru} × ${qty}`, seller_user, BRANCH_ID, out.id, out.created_at]
    );
  }
  log(`  100 sales created (cash auto-zachisleno)`);

  // === 4. 30 pending sales (awaiting warehouse approval) ===
  log('Creating 30 pending sales (waiting for warehouse approval)...');
  for (let i = 0; i < 30; i++) {
    const product = created[(i + 50) % created.length];
    const qty = 1 + (i % 3);
    const price = parseFloat(product.price_sell);
    await pool.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, status, created_by, branch_id, note)
       VALUES ($1,$2,$3,'pending',$4,$5,$6)`,
      [product.id, qty, price, cashier.id, BRANCH_ID, i % 4 === 0 ? 'Срочная продажа клиенту' : '']
    );
  }
  log(`  30 pending sales created`);

  // Summary
  const { rows: [prodCount] }  = await pool.query("SELECT COUNT(*) FROM products WHERE branch_id=$1", [BRANCH_ID]);
  const { rows: [stockCount] } = await pool.query("SELECT COUNT(*) FROM product_stock ps JOIN products p ON ps.product_id=p.id WHERE p.branch_id=$1", [BRANCH_ID]);
  const { rows: [salesCount] } = await pool.query("SELECT COUNT(*) FROM stock_outcome WHERE status='approved' AND branch_id=$1", [BRANCH_ID]);
  const { rows: [pendCount] }  = await pool.query("SELECT COUNT(*) FROM stock_outcome WHERE status='pending'  AND branch_id=$1", [BRANCH_ID]);
  const { rows: [cashSum] }    = await pool.query("SELECT COALESCE(SUM(amount),0) AS s FROM cash_income WHERE branch_id=$1 AND outcome_id IS NOT NULL", [BRANCH_ID]);

  log('\n=== STATE ===');
  log(`Products in branch:       ${prodCount.count}`);
  log(`Products with stock:      ${stockCount.count}`);
  log(`Approved sales:           ${salesCount.count}`);
  log(`Pending sales:            ${pendCount.count}`);
  log(`Auto cash from sales:     ${parseFloat(cashSum.s).toLocaleString()} сум`);

  await pool.end();
}

run().catch(e => { console.error('FATAL:', e); pool.end(); process.exit(1); });
