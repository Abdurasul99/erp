'use strict';

// Остатки декора списком из файла — то же, что учредитель делает в «Склад → Декор и износ → Добавить вещь»
// (POST /api/decor/items): название и «Куплено, шт». Цена 0 и ресурс 1 — их учредитель вписывает на экране.
// Вещь с таким же названием уже есть (без учёта регистра, как в decor_items_name_uq) — не трогается,
// расхождение количества печатается. Одна транзакция: весь файл или ничего; повторный запуск ничего не дублирует.
// --dry-run — показать, что будет добавлено, ничего не записывая.
//
//   node scripts/import-items.js --founder doradecor --file import/dora-decor-2026-10-21.json [--dry-run]
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require('../sphere_db');

// Файл: { items: [{ name, qty, check? }] }; check — пометка «сверить с тетрадью», в базу не идёт
function readList(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(doc) ? doc : doc?.items;
  if (!Array.isArray(list) || !list.length) throw new Error('В файле нет списка items');
  const seen = new Set();
  return list.map((x, i) => {
    const name = String(x?.name || '').trim().replace(/\s+/g, ' ');
    const where = `позиция ${i + 1}${name ? ` «${name}»` : ''}`;
    if (!name || name.length > 160) throw new Error(`${where}: название от 1 до 160 символов`);
    if (!Number.isInteger(x.qty) || x.qty < 0) throw new Error(`${where}: количество — целое число от 0`);
    if (seen.has(name.toLowerCase())) throw new Error(`${where}: название повторяется в файле`);
    seen.add(name.toLowerCase());
    return { name, qty: x.qty, check: x.check ? String(x.check) : null };
  });
}

async function importItems(pool, { founder, file, dryRun = false }) {
  const list = readList(file);
  const source = path.basename(file);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [f] } = await c.query(
      "SELECT id, company_id FROM users WHERE username=$1 AND role='founder'", [String(founder || '').trim()]);
    if (!f) throw new Error(`Учредитель «${founder}» не найден`);
    // Новые вещи — в конец списка склада, в порядке файла
    let sort = (await c.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM decor_items WHERE company_id=$1', [f.company_id])).rows[0].n;
    const added = [];
    const kept = [];
    for (const it of list) {
      const { rows: [row] } = await c.query(
        `INSERT INTO decor_items (company_id, name, qty_bought, sort_order) VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_id, lower(name)) DO NOTHING RETURNING id`, [f.company_id, it.name, it.qty, sort + 1]);
      if (row) {
        sort += 1;
        added.push({ id: row.id, ...it });
        await c.query(
          `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, new_value)
           VALUES (NULL, 'import-items.js', 'create', 'decor_item', $1, $2)`,
          [row.id, JSON.stringify({ name: it.name, qty_bought: it.qty, source })]);
      } else {
        const { rows: [old] } = await c.query(
          'SELECT id, name, qty_bought, is_active FROM decor_items WHERE company_id=$1 AND lower(name)=lower($2)', [f.company_id, it.name]);
        kept.push({ ...it, id: old.id, have: old.qty_bought, is_active: old.is_active });
      }
    }
    await c.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return { companyId: f.company_id, added, kept, dryRun };
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

module.exports = { importItems, readList };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const file = arg('file') && path.resolve(arg('file'));
  if (!file) { console.error('Ошибка: --file — путь к JSON со списком'); process.exit(1); }
  const pool = getPool('decor');
  importItems(pool, { founder: arg('founder'), file, dryRun: process.argv.includes('--dry-run') })
    .then(r => {
      const total = r.added.reduce((s, x) => s + x.qty, 0);
      console.log(`${r.dryRun ? 'ПРОВЕРКА, ничего не записано' : 'Готово'}: компания ${r.companyId}, `
        + `${r.dryRun ? 'будет добавлено' : 'добавлено'} ${r.added.length} вещей (${total} шт), уже были — ${r.kept.length}`);
      for (const k of r.kept) {
        const diff = k.have === k.qty ? '' : ` — в базе ${k.have}, в файле ${k.qty}, не менял`;
        console.log(`  уже есть: ${k.name}${k.is_active ? '' : ' (выключена)'}${diff}`);
      }
      const check = r.added.filter(x => x.check);
      if (check.length) {
        console.log('Сверить с тетрадью и поправить на экране «Склад → Декор и износ»:');
        for (const x of check) console.log(`  ${x.name} — ${x.qty} шт: ${x.check}`);
      }
      if (r.added.length) console.log('Цена и ресурс у новых вещей — 0 и 1: впишите их там же, иначе износ в себестоимости заказа = 0.');
    })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
