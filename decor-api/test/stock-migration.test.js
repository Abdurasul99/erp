'use strict';

// D25 на базе, где уже есть компании и вещи: остаток вещей — первой строкой журнала, право «вести склад» — у всех.
// Отдельный файл (свой процесс): второй стенд в одном процессе перехватил бы общий модуль ключей повтора.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startStack, migrationOrder } = require('./support/stack');

const SQL_DIR = path.join(__dirname, '..', 'sql');

test('D25 на базе с данными: остаток вещей — первой строкой журнала, право — у всех компаний', async () => {
  const old = await startStack({ migrate: false });
  try {
    const files = migrationOrder();
    const d25 = files.indexOf('D25_stock_journal.sql');
    assert.ok(d25 > 0, 'D25 — в apply_decor_migrations.sh');
    const apply = async file => { const c = await old.pool.connect(); try { await c.query('BEGIN'); await c.query(fs.readFileSync(path.join(SQL_DIR, file), 'utf8')); await c.query('COMMIT'); } finally { c.release(); } };
    for (const file of files.slice(0, d25)) await apply(file);   // база, какой она была до D25
    // Компания, как её завёл старый код: 10 действий × 3 должности, две вещи с остатком
    const [{ id: cid }] = (await old.pool.query("INSERT INTO companies (name) VALUES ('Old') RETURNING id")).rows;
    await old.pool.query('INSERT INTO decor_settings (company_id) VALUES ($1)', [cid]);
    await old.pool.query(`INSERT INTO decor_permissions (company_id, position, action, allowed)
      SELECT $1, p, 'handle_decor', p = 'warehouse' FROM unnest(ARRAY['cashier','warehouse','pm']) p`, [cid]);
    await old.pool.query("INSERT INTO decor_items (company_id, name, qty_bought) VALUES ($1, 'Арка', 5), ($1, 'Люстра', 0)", [cid]);
    await apply('D25_stock_journal.sql');

    const journal = (await old.pool.query('SELECT i.name, s.kind, s.qty, s.qty_after FROM decor_stock_moves s JOIN decor_items i ON i.id=s.item_id ORDER BY i.name')).rows;
    assert.deepEqual(journal, [{ name: 'Арка', kind: 'opening', qty: 5, qty_after: 5 }, { name: 'Люстра', kind: 'opening', qty: 0, qty_after: 0 }]);
    const perms = (await old.pool.query("SELECT position, allowed FROM decor_permissions WHERE company_id=$1 AND action='manage_items' ORDER BY position", [cid])).rows;
    assert.deepEqual(perms, [{ position: 'cashier', allowed: false }, { position: 'pm', allowed: false }, { position: 'warehouse', allowed: true }]);
    await assert.rejects(old.pool.query("INSERT INTO decor_permissions (company_id, position, action) VALUES ($1, 'pm', 'fly')", [cid]), /check/i);
  } finally { await old.stop(); }
});
