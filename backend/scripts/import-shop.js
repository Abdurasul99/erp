/* Витрина компании mywarehouse.uz/shop/<slug>: адрес, профиль и импорт товаров с остатками (2026-11-13).

   node scripts/import-shop.js --company <id или часть названия> --slug <адрес> --file scripts/data/<файл>.json \
        [--title "Название"] [--tagline "Подпись"] [--phone "+998 …"] [--address "Самовывоз: …"] [--hours "…"] \
        [--telegram @…] [--instagram …] [--apply]

   Без --apply — только отчёт: всё делается в транзакции и откатывается.
   С --apply — одной транзакцией:
     • адрес витрины (companies.store_slug) и профиль (companies.store_profile — дополняется, не затирается);
     • категории (в Wave они общие для всех компаний): ищутся по названию, нет — создаются;
     • товары: в компании уже есть товар с таким названием — пропуск (ни цена, ни остаток не меняются),
       иначе создаётся с ценой продажи и категорией;
     • начальный остаток — приход на первый филиал компании с закупочной ценой 0 и пометкой «Начальный остаток
       (импорт …)»: касса не трогается (обычный приход с ценой записал бы расход из кассы).
   Повторный запуск дублей не создаёт. Товар с нулевым остатком или без цены заводится, но на витрину не выходит
   (витрина показывает только то, что есть на складе и с ценой). Фото добавляются потом в карточке товара.
*/
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const PROFILE_KEYS = ['title', 'tagline', 'tagline_uz', 'phone', 'address', 'address_uz', 'hours', 'telegram', 'instagram'];

function readData(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.items) || !data.categories) throw new Error('Файл: нужны поля categories и items');
  for (const it of data.items) {
    if (!it.name_ru || !String(it.name_ru).trim()) throw new Error(`Товар без названия: ${JSON.stringify(it)}`);
    if (String(it.name_ru).length > 200 || String(it.name_uz || '').length > 200) throw new Error(`Слишком длинное название: ${it.name_ru}`);
    if (it.category && !data.categories[it.category]) throw new Error(`Нет категории «${it.category}» у «${it.name_ru}»`);
    if (!(Number(it.price) >= 0) || !(Number(it.qty) >= 0)) throw new Error(`Цена и количество — числа ≥ 0: ${it.name_ru}`);
  }
  return data;
}

async function importShop(pool, opts, log = console.log) {
  const { company, slug, data, profile = {}, apply = false, note } = opts;
  const key = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) throw new Error('--slug: 2–40 символов, латиница, цифры и дефис (например, uy-market)');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // Колонки витрины (то же делает ensureSchema сервера; здесь — чтобы импорт не зависел от перезапуска)
    await c.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS store_slug VARCHAR(40)');
    await c.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS store_profile jsonb');
    await c.query('CREATE UNIQUE INDEX IF NOT EXISTS companies_store_slug ON companies (lower(store_slug)) WHERE store_slug IS NOT NULL');

    const byId = /^\d+$/.test(String(company));
    const { rows: found } = await c.query(byId ? 'SELECT id, name, store_slug, store_profile FROM companies WHERE id=$1'
      : 'SELECT id, name, store_slug, store_profile FROM companies WHERE name ILIKE $1 ORDER BY id', [byId ? Number(company) : `%${company}%`]);
    if (!found.length) throw new Error(`Компания «${company}» не найдена`);
    if (found.length > 1) throw new Error(`Под «${company}» подходит несколько компаний: ${found.map(x => `${x.id} ${x.name}`).join('; ')} — укажите id`);
    const co = found[0];
    const { rows: [br] } = await c.query('SELECT id, name FROM branches WHERE company_id=$1 ORDER BY id LIMIT 1', [co.id]);
    if (!br) throw new Error(`У компании ${co.name} нет филиала — заведите его в админке`);
    const { rows: [who] } = await c.query(`SELECT id, username FROM users WHERE company_id=$1 AND role IN ('founder','director')
      ORDER BY (role='founder') DESC, id LIMIT 1`, [co.id]);
    const { rows: [taken] } = await c.query('SELECT id, name FROM companies WHERE lower(store_slug)=$1 AND id<>$2', [key, co.id]);
    if (taken) throw new Error(`Адрес /shop/${key} уже занят компанией ${taken.id} ${taken.name}`);
    log(`Компания: ${co.id} «${co.name}», филиал ${br.id} «${br.name}», приход от: ${who ? who.username : '—'}`);
    log(`Витрина: /shop/${key}${co.store_slug && co.store_slug !== key ? ` (была /shop/${co.store_slug})` : ''}`);

    const prof = { ...(co.store_profile || {}) };
    for (const k of PROFILE_KEYS) if (profile[k] !== undefined && profile[k] !== null) prof[k] = String(profile[k]).trim().slice(0, 300);
    if (prof.hide_out_of_stock === undefined) prof.hide_out_of_stock = true;
    await c.query('UPDATE companies SET store_slug=$1, store_profile=$2 WHERE id=$3', [key, prof, co.id]);
    log(`Профиль: ${JSON.stringify(prof)}`);

    // Категории: общие (company_id NULL) + свои у компании (с 2026-11-17). Новые — СВОИ, чтобы
    // категории магазина не появлялись в списках других клиентов.
    await c.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id) ON DELETE CASCADE');
    const catId = {};
    let catNew = 0;
    for (const [k, cat] of Object.entries(data.categories)) {
      const { rows: [ex] } = await c.query(
        'SELECT id FROM categories WHERE lower(name_ru)=lower($1) AND (company_id IS NULL OR company_id=$2) ORDER BY company_id NULLS FIRST, id LIMIT 1',
        [cat.ru, co.id]);
      if (ex) { catId[k] = ex.id; continue; }
      catId[k] = (await c.query('INSERT INTO categories (name_ru, name_uz, company_id) VALUES ($1,$2,$3) RETURNING id',
        [cat.ru.slice(0, 100), (cat.uz || cat.ru).slice(0, 100), co.id])).rows[0].id;
      catNew++;
    }
    log(`Категорий: ${Object.keys(catId).length} (новых ${catNew})`);

    const { rows: have } = await c.query('SELECT lower(name_ru) AS n FROM products WHERE company_id=$1 AND deleted_at IS NULL', [co.id]);
    const exists = new Set(have.map(r => r.n));
    const stamp = note || `Начальный остаток (импорт ${data.source || 'файла'})`;
    const res = { created: 0, skipped: [], stocked: 0, pieces: 0, on_site: 0, no_price: [], zero: 0 };
    for (const it of data.items) {
      const name = String(it.name_ru).trim();
      if (exists.has(name.toLowerCase())) { res.skipped.push(name); continue; }
      exists.add(name.toLowerCase());
      const price = Math.round(Number(it.price) || 0);
      const qty = Math.floor(Number(it.qty) || 0);
      const { rows: [p] } = await c.query(`INSERT INTO products (name_ru, name_uz, category_id, unit, price_buy, price_sell, company_id, branch_id)
        VALUES ($1,$2,$3,$4,0,$5,$6,$7) RETURNING id`,
      [name, String(it.name_uz || name).trim(), it.category ? catId[it.category] : null, String(it.unit || 'шт').slice(0, 32), price, co.id, br.id]);
      res.created++;
      if (!price) res.no_price.push(name);
      if (qty > 0) {
        await c.query(`INSERT INTO stock_income (product_id, quantity, price, note, created_by, branch_id, payment_status, paid_amount, payment_method, currency)
          VALUES ($1,$2,0,$3,$4,$5,'paid',0,'cash','UZS')`, [p.id, qty, stamp, who?.id || null, br.id]);
        await c.query(`INSERT INTO product_stock (product_id, branch_id, quantity) VALUES ($1,$2,$3)
          ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = product_stock.quantity + EXCLUDED.quantity, updated_at = NOW()`, [p.id, br.id, qty]);
        res.stocked++; res.pieces += qty;
        if (price) res.on_site++;
      } else res.zero++;
    }
    log(`Товаров создано: ${res.created}; уже были (пропуск): ${res.skipped.length}; с остатком: ${res.stocked} (${res.pieces} шт); с нулём: ${res.zero}`);
    log(`На витрину выйдут: ${res.on_site}${res.no_price.length ? `; без цены (не выйдут): ${res.no_price.join(', ')}` : ''}`);
    if (res.skipped.length) log(`Пропущены (уже есть): ${res.skipped.slice(0, 20).join(', ')}${res.skipped.length > 20 ? ' …' : ''}`);
    await c.query(apply ? 'COMMIT' : 'ROLLBACK');
    log(apply ? 'ГОТОВО: записано.' : 'Это отчёт: ничего не записано. Для записи добавьте --apply');
    return { company_id: co.id, branch_id: br.id, slug: key, ...res };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}

module.exports = { importShop, readData };

if (require.main === module) {
  const file = arg('--file');
  const company = arg('--company');
  if (!file || !company || !arg('--slug')) {
    console.error('Нужно: --company <id или название> --slug <адрес> --file <json> [--title … --phone … --address …] [--apply]');
    process.exit(2);
  }
  const pool = new Pool({ database: process.env.DB_NAME || 'warehouse', user: process.env.DB_USER || 'wareapp_user', password: process.env.DB_PASS,
    host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT, 10) || 5432, max: 1 });
  const profile = Object.fromEntries(PROFILE_KEYS.map(k => [k, arg(`--${k.replace('_', '-')}`)]).filter(([, v]) => v !== undefined));
  importShop(pool, { company, slug: arg('--slug'), data: readData(path.resolve(file)), profile, apply: APPLY })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
