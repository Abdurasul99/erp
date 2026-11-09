// Готовые дизайны (D26, решение владельца 09.11.2026): название и состав — какие вещи и сколько штук каждой.
// В калькуляторе дизайн добавляет в заказ все свои вещи разом; недостающие материалы добавляются вещами сверху.
// Остатки по-прежнему считаются по вещам: дизайн сам ничего не бронирует и не списывает.
// Смотрят все (калькулятор); заводит и меняет — «вести склад» или «менять настройки», как вещи.
// Дизайны не удаляются — их выключают (is_active=false, «архив»). Записи — с ключом повтора (txFor).
const { wrap, fail, idParam, intIn, text } = require('./common');

const MAX_LINES = 200;
const MAX_QTY = 100000;

module.exports = ({ app, pool, A, can, audit, txFor, loadModel }) => {
  const MANAGE = can('manage_items', 'edit_settings');

  // Список с составом; «хватает на» — сколько таких дизайнов можно собрать из свободного сегодня
  async function list(req, all) {
    const { data, m } = await loadModel(req);
    const items = new Map(data.items.map(i => [i.id, i]));
    const [{ rows: designs }, { rows: lines }] = await Promise.all([
      pool.query(`SELECT id, name, note, is_active, updated_at FROM decor_designs WHERE company_id=$1 ${all ? '' : 'AND is_active'}
        ORDER BY is_active DESC, lower(name)`, [req.decor.cid]),
      pool.query(`SELECT l.design_id, l.item_id, l.qty FROM decor_design_lines l JOIN decor_designs d ON d.id = l.design_id
        WHERE d.company_id=$1`, [req.decor.cid]),
    ]);
    return designs.map(d => {
      const own = lines.filter(l => l.design_id === d.id).map(l => {
        const it = items.get(l.item_id);
        const t = it ? m.itemTotals(it.id) : { free_today: 0, in_warehouse: 0 };
        return { item_id: l.item_id, item: it?.name || `#${l.item_id}`, qty: l.qty, item_active: !!it?.is_active,
          free_today: t.free_today, in_warehouse: t.in_warehouse };
      }).sort((a, b) => a.item.localeCompare(b.item, 'ru'));
      const canBuild = own.length ? Math.max(0, Math.min(...own.map(l => (l.item_active ? Math.floor(l.free_today / l.qty) : 0)))) : 0;
      return { id: d.id, name: d.name, note: d.note, is_active: d.is_active, updated_at: d.updated_at,
        lines: own, pieces: own.reduce((a, l) => a + l.qty, 0), can_build: canBuild };
    });
  }
  const one = async (req, id) => (await list(req, true)).find(d => d.id === id);

  // Состав из запроса: вещи своей компании и действующие; одна вещь дважды — количества складываются
  async function readLines(c, req) {
    const raw = req.body?.lines;
    if (!Array.isArray(raw) || !raw.length) fail(400, 'Добавьте в дизайн хотя бы одну вещь', { code: 'design_empty' });
    if (raw.length > MAX_LINES) fail(400, `Не больше ${MAX_LINES} вещей в дизайне`);
    const sum = new Map();
    for (const l of raw) {
      const id = Number(l?.item_id);
      if (!Number.isInteger(id) || id <= 0) fail(400, 'Неверная вещь в дизайне');
      sum.set(id, (sum.get(id) || 0) + intIn(l?.qty, 'Количество в дизайне, шт', 1, MAX_QTY));
    }
    const ids = [...sum.keys()];
    const { rows } = await c.query('SELECT id FROM decor_items WHERE company_id=$1 AND id = ANY($2::int[]) AND is_active', [req.decor.cid, ids]);
    if (rows.length !== ids.length) fail(400, 'Вещь не найдена или в архиве', { code: 'design_item' });
    return ids.map(item_id => ({ item_id, qty: Math.min(sum.get(item_id), MAX_QTY) }));
  }
  const writeLines = (c, designId, lines) => c.query(
    'INSERT INTO decor_design_lines (design_id, item_id, qty) SELECT $1, x.item_id, x.qty FROM jsonb_to_recordset($2::jsonb) AS x(item_id int, qty int)',
    [designId, JSON.stringify(lines)]);

  app.get('/api/decor/designs', A(), wrap(async (req, res) => {
    res.json(await list(req, req.query.all === '1'));
  }));

  app.post('/api/decor/designs', A(MANAGE), wrap(async (req, res) => {
    const name = text(req.body?.name, 160) || fail(400, 'Название дизайна обязательно', { code: 'design_name' });
    const note = text(req.body?.note, 2000);
    const d = await txFor(req)(async c => {
      const lines = await readLines(c, req);
      const { rows: [row] } = await c.query('INSERT INTO decor_designs (company_id, name, note, created_by) VALUES ($1,$2,$3,$4) RETURNING id',
        [req.decor.cid, name, note, req.user.id]);
      await writeLines(c, row.id, lines);
      return { id: row.id, lines };
    });
    audit(req, 'create', 'decor_design', d.id, null, { name, note, lines: d.lines });
    res.json(await one(req, d.id));
  }));

  // Название, заметка, состав (целиком), архив
  app.put('/api/decor/designs/:id', A(MANAGE), wrap(async (req, res) => {
    const id = idParam(req);
    const b = req.body || {};
    const { rows: [old] } = await pool.query('SELECT name, note, is_active FROM decor_designs WHERE id=$1 AND company_id=$2', [id, req.decor.cid]);
    if (!old) fail(404, 'Дизайн не найден');
    const f = {};
    if (b.name !== undefined) f.name = text(b.name, 160) || fail(400, 'Название дизайна обязательно', { code: 'design_name' });
    if (b.note !== undefined) f.note = text(b.note, 2000);
    if (b.is_active !== undefined) f.is_active = b.is_active === true;
    const withLines = b.lines !== undefined;
    const keys = Object.keys(f);
    if (!keys.length && !withLines) fail(400, 'Нет полей для изменения');
    let lines = null;
    await txFor(req)(async c => {
      if (withLines) {
        lines = await readLines(c, req);
        await c.query('DELETE FROM decor_design_lines WHERE design_id=$1', [id]);
        await writeLines(c, id, lines);
      }
      await c.query(`UPDATE decor_designs SET ${[...keys.map((k, i) => `${k}=$${i + 1}`), 'updated_at=NOW()'].join(', ')}
        WHERE id=$${keys.length + 1} AND company_id=$${keys.length + 2}`, [...keys.map(k => f[k]), id, req.decor.cid]);
      return { updated: true };
    });
    audit(req, 'update', 'decor_design', id, old, { ...f, ...(lines ? { lines } : {}) });
    res.json(await one(req, id));
  }));
};
