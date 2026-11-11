// Стандарты работ — пошаговые чек-листы для ПМ и учеников (D30; ТЗ «Декор, обновление 2», раздел 3).
// Библиотека: стандарт (вход, стол, стена из ткани, тент…) — шаги по порядку, у шага фото-образец и «нужно фото».
// Создаёт и меняет — «менять стандарты работ» (edit_standards; учредитель — всегда). Стандарты создаются пустыми.
// В заказе выбирают виды работ — шаги КОПИРУЮТСЯ в заказ; изменение стандарта уже выбранный чек-лист не меняет.
// Отмечает шаги бригада заказа (сотрудник из команды заказа со своим входом — ПМ, ученик) и учредитель:
// строго по порядку внутри работы; шаг «нужно фото» без фото не отметить. Снять отметку можно только с последнего
// отмеченного шага — тому, кто отметил, или учредителю. Выбирают работы — команда заказа, «оформлять заказы», учредитель.
const fs = require('fs');
const path = require('path');
const U = require('./uploads');
const { wrap, fail, idParam, toInt, text } = require('./common');

const MAX_STEPS = 100;
const NAME = a => `COALESCE(NULLIF(trim(concat_ws(' ', ${a}.first_name, ${a}.last_name)), ''), ${a}.username)`;

module.exports = ({ app, pool, A, can, has, feature, audit, txFor }) => {
  const FEAT = feature('decor-orders');
  const EDIT = can('edit_standards');

  // ---------- Библиотека стандартов ----------
  async function list(db, cid, all) {
    const [{ rows: st }, { rows: steps }] = await Promise.all([
      db.query(`SELECT id, name, active, updated_at FROM decor_standards WHERE company_id=$1 ${all ? '' : 'AND active'}
        ORDER BY active DESC, lower(name)`, [cid]),
      db.query(`SELECT id, standard_id, position, text, sample_photo, photo_required FROM decor_standard_steps WHERE company_id=$1
        ORDER BY standard_id, position`, [cid]),
    ]);
    return st.map(s => {
      const own = steps.filter(x => x.standard_id === s.id).map(x => ({ id: x.id, position: x.position, text: x.text, sample_photo: x.sample_photo, photo_required: x.photo_required }));
      return { ...s, steps: own, photo_steps: own.filter(x => x.photo_required).length };
    });
  }
  const oneStd = async (db, cid, id) => (await list(db, cid, true)).find(s => s.id === id) || fail(404, 'Стандарт не найден');

  app.get('/api/decor/standards', A(), wrap(async (req, res) => res.json(await list(pool, req.decor.cid, req.query.all === '1'))));

  app.post('/api/decor/standards', A(EDIT), wrap(async (req, res) => {
    const name = text(req.body?.name, 160) || fail(400, 'Название стандарта обязательно');
    const id = await txFor(req)(async c => (await c.query('INSERT INTO decor_standards (company_id, name, created_by) VALUES ($1,$2,$3) RETURNING id',
      [req.decor.cid, name, req.user.id])).rows[0].id);
    audit(req, 'create', 'decor_standard', id, null, { name });
    res.json(await oneStd(pool, req.decor.cid, id));
  }));

  // Правка: название, архив, шаги (весь список по порядку; образец — файл, загруженный к этому стандарту)
  app.put('/api/decor/standards/:id', A(EDIT), wrap(async (req, res) => {
    const id = idParam(req); const b = req.body || {}; const cid = req.decor.cid;
    const old = await oneStd(pool, cid, id);
    const name = b.name !== undefined ? text(b.name, 160) || fail(400, 'Название стандарта обязательно') : undefined;
    const active = b.active !== undefined ? b.active === true : undefined;
    let steps;
    if (b.steps !== undefined) {
      if (!Array.isArray(b.steps)) fail(400, 'steps — список шагов');
      if (b.steps.length > MAX_STEPS) fail(400, `Не больше ${MAX_STEPS} шагов`);
      steps = b.steps.map((s, i) => ({ position: i + 1, text: text(s?.text, 2000) || fail(400, `Шаг ${i + 1}: текст обязателен`, { code: 'step_text' }),
        photo_required: s?.photo_required === true, sample_photo: s?.sample_photo ? toInt(s.sample_photo) || fail(400, `Шаг ${i + 1}: неверный образец`) : null }));
      const samples = steps.map(s => s.sample_photo).filter(Boolean);
      if (samples.length) {
        const { rows } = await pool.query(`SELECT id FROM decor_report_files WHERE company_id=$1 AND standard_id=$2 AND kind='image' AND id = ANY($3::int[])`,
          [cid, id, samples]);
        if (rows.length !== new Set(samples).size) fail(400, 'Фото-образец не найден у этого стандарта', { code: 'step_sample' });
      }
    }
    if (name === undefined && active === undefined && steps === undefined) fail(400, 'Нет полей для изменения');
    await txFor(req)(async c => {
      if (name !== undefined || active !== undefined) {
        await c.query('UPDATE decor_standards SET name=COALESCE($3, name), active=COALESCE($4, active), updated_at=NOW() WHERE id=$1 AND company_id=$2',
          [id, cid, name ?? null, active ?? null]);
      }
      if (steps) {
        await c.query('DELETE FROM decor_standard_steps WHERE standard_id=$1', [id]);
        await c.query(`INSERT INTO decor_standard_steps (company_id, standard_id, position, text, sample_photo, photo_required)
          SELECT $1, $2, x.position, x.text, x.sample_photo, x.photo_required
          FROM jsonb_to_recordset($3::jsonb) AS x(position int, text text, sample_photo int, photo_required boolean)`, [cid, id, JSON.stringify(steps)]);
        await c.query('UPDATE decor_standards SET updated_at=NOW() WHERE id=$1', [id]);
      }
      return { id };
    });
    audit(req, 'update', 'decor_standard', id, { name: old.name, active: old.active, steps: old.steps.length }, { name, active, steps: steps?.length });
    res.json(await oneStd(pool, cid, id));
  }));

  // Фото-образец шага: одно фото к стандарту → id файла (в шаге — sample_photo)
  app.post('/api/decor/standards/:id/sample', A(EDIT), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    await oneStd(pool, req.decor.cid, id);
    const files = req.files || [];
    if (files.length !== 1 || !/^image\//.test(files[0].mimetype)) fail(400, 'Нужно одно фото-образец', { code: 'sample_one' });
    await U.checkSizes(pool, req);
    const [fileId] = await txFor(req)(c => U.saveFiles(c, req, { standard_id: id }));
    audit(req, 'upload', 'decor_standard_sample', id, null, { file_id: fileId });
    res.json({ file_id: fileId });
  })));

  // ---------- Чек-лист заказа ----------
  const orderOf = async (db, req, id, lock = false) => (await db.query(`SELECT id, no, status FROM decor_orders WHERE id=$1 AND company_id=$2 ${lock ? 'FOR UPDATE' : ''}`,
    [id, req.decor.cid])).rows[0] || fail(404, 'Заказ не найден');
  const inTeam = async (db, req, orderId) => !!req.decor.employee
    && (await db.query('SELECT 1 FROM decor_order_team WHERE order_id=$1 AND employee_id=$2', [orderId, req.decor.employee.id])).rowCount > 0;
  const canMark = async (db, req, orderId) => req.decor.isOwner || inTeam(db, req, orderId);
  const canChoose = async (db, req, orderId) => req.decor.isOwner || has(req, 'create_order') || inTeam(db, req, orderId);

  async function works(db, req, orderId) {
    const [{ rows: w }, { rows: steps }, { rows: files }] = await Promise.all([
      db.query('SELECT id, standard_id, name, created_at FROM decor_order_works WHERE company_id=$1 AND order_id=$2 ORDER BY id', [req.decor.cid, orderId]),
      db.query(`SELECT s.id, s.work_id, s.position, s.step, s.sample_photo, s.photo_required, s.done_by, s.done_at, s.photo, ${NAME('u')} AS done_by_name
        FROM decor_order_step_done s LEFT JOIN users u ON u.id = s.done_by WHERE s.company_id=$1 AND s.order_id=$2 ORDER BY s.work_id, s.position`, [req.decor.cid, orderId]),
      db.query(`SELECT f.id, f.step_done_id, f.kind, f.original_name FROM decor_report_files f JOIN decor_order_step_done s ON s.id = f.step_done_id
        WHERE f.company_id=$1 AND s.order_id=$2 ORDER BY f.id`, [req.decor.cid, orderId]),
    ]);
    const out = w.map(x => {
      const own = steps.filter(s => s.work_id === x.id).map(s => ({ id: s.id, position: s.position, text: s.step, sample_photo: s.sample_photo,
        photo_required: s.photo_required, done: !!s.done_at, done_at: s.done_at, done_by: s.done_by ? { id: s.done_by, name: s.done_by_name } : null,
        photo: s.photo, files: files.filter(f => f.step_done_id === s.id).map(f => ({ id: f.id, kind: f.kind, original_name: f.original_name })) }));
      const next = own.find(s => !s.done);
      return { id: x.id, standard_id: x.standard_id, name: x.name, steps: own, done: own.filter(s => s.done).length, total: own.length, next_step: next?.id || null };
    });
    return { works: out, done: out.reduce((a, x) => a + x.done, 0), total: out.reduce((a, x) => a + x.total, 0) };
  }
  const worksView = async (req, orderId) => ({ ...(await works(pool, req, orderId)),
    can_mark: await canMark(pool, req, orderId), can_choose: await canChoose(pool, req, orderId), me: req.user.id, is_owner: req.decor.isOwner });

  app.get('/api/decor/orders/:id/works', A(FEAT), wrap(async (req, res) => {
    const o = await orderOf(pool, req, idParam(req));
    res.json(await worksView(req, o.id));
  }));

  // Выбрать вид работы: шаги стандарта копируются в заказ
  app.post('/api/decor/orders/:id/works', A(FEAT), wrap(async (req, res) => {
    const orderId = idParam(req);
    const stdId = toInt(req.body?.standard_id) || fail(400, 'Выберите стандарт работы');
    await txFor(req)(async c => {
      const o = await orderOf(c, req, orderId, true);
      if (!(await canChoose(c, req, o.id))) fail(403, 'Выбирают работы команда заказа или тот, кто оформляет заказы', { code: 'works_forbidden' });
      if (o.status === 'closed') fail(409, 'Заказ закрыт — работы не меняются');
      const { rows: [s] } = await c.query('SELECT id, name, active FROM decor_standards WHERE id=$1 AND company_id=$2', [stdId, req.decor.cid]);
      if (!s || !s.active) fail(400, 'Стандарт не найден или в архиве');
      const { rows: steps } = await c.query('SELECT position, text, sample_photo, photo_required FROM decor_standard_steps WHERE standard_id=$1 ORDER BY position', [s.id]);
      if (!steps.length) fail(400, `В стандарте «${s.name}» ещё нет шагов — его заполняет учредитель`, { code: 'standard_empty' });
      const { rows: [w] } = await c.query(`INSERT INTO decor_order_works (company_id, order_id, standard_id, name, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [req.decor.cid, o.id, s.id, s.name, req.user.id]);
      await c.query(`INSERT INTO decor_order_step_done (company_id, order_id, work_id, position, step, sample_photo, photo_required)
        SELECT $1, $2, $3, ROW_NUMBER() OVER (ORDER BY position), text, sample_photo, photo_required FROM decor_standard_steps WHERE standard_id=$4`,
      [req.decor.cid, o.id, w.id, s.id]);
      return { work_id: w.id };
    });
    audit(req, 'create', 'decor_order_work', orderId, null, { standard_id: stdId });
    res.json(await worksView(req, orderId));
  }));

  // Убрать вид работы — только пока ни один шаг не отмечен
  app.delete('/api/decor/orders/:id/works/:workId', A(FEAT), wrap(async (req, res) => {
    const orderId = idParam(req); const workId = idParam(req, 'workId');
    await txFor(req)(async c => {
      const o = await orderOf(c, req, orderId, true);
      if (!(await canChoose(c, req, o.id))) fail(403, 'Выбирают работы команда заказа или тот, кто оформляет заказы', { code: 'works_forbidden' });
      const { rows: [w] } = await c.query('SELECT id FROM decor_order_works WHERE id=$1 AND order_id=$2 AND company_id=$3', [workId, o.id, req.decor.cid]);
      if (!w) fail(404, 'Работа не найдена в заказе');
      if ((await c.query('SELECT 1 FROM decor_order_step_done WHERE work_id=$1 AND done_at IS NOT NULL', [w.id])).rowCount) {
        fail(409, 'В работе уже есть отмеченные шаги — убрать её нельзя', { code: 'work_started' });
      }
      await c.query('DELETE FROM decor_order_works WHERE id=$1', [w.id]);
      return { deleted: w.id };
    });
    audit(req, 'delete', 'decor_order_work', orderId, null, { work_id: workId });
    res.json(await worksView(req, orderId));
  }));

  // Отметить шаг (с фото — multipart files[]): по порядку, «нужно фото» — только с фото
  app.post('/api/decor/orders/:id/steps/:stepId/done', A(FEAT), U.upload, wrap(U.withFiles(async (req, res) => {
    const orderId = idParam(req); const stepId = idParam(req, 'stepId');
    const files = req.files || [];
    if (files.some(f => !/^image\//.test(f.mimetype))) fail(400, 'К шагу прикладывают фото', { code: 'step_photo_kind' });
    await U.checkSizes(pool, req);
    await txFor(req)(async c => {
      const o = await orderOf(c, req, orderId, true);
      if (!(await canMark(c, req, o.id))) fail(403, 'Шаги отмечает бригада заказа (сотрудник из команды заказа со своим входом)', { code: 'step_forbidden' });
      const { rows: [s] } = await c.query('SELECT id, work_id, position, photo_required, done_at FROM decor_order_step_done WHERE id=$1 AND order_id=$2 AND company_id=$3',
        [stepId, o.id, req.decor.cid]);
      if (!s) fail(404, 'Шаг не найден в заказе');
      if (s.done_at) fail(409, 'Шаг уже отмечен', { code: 'step_done' });
      const { rows: [prev] } = await c.query('SELECT position FROM decor_order_step_done WHERE work_id=$1 AND position < $2 AND done_at IS NULL ORDER BY position LIMIT 1',
        [s.work_id, s.position]);
      if (prev) fail(409, `Сначала отметьте шаг ${prev.position} — шаги идут строго по порядку`, { code: 'step_order', position: prev.position });
      if (s.photo_required && !files.length) fail(400, 'Для этого шага нужно фото', { code: 'step_photo' });
      const ids = await U.saveFiles(c, req, { step_done_id: s.id });
      await c.query('UPDATE decor_order_step_done SET done_by=$2, done_at=NOW(), photo=$3 WHERE id=$1', [s.id, req.user.id, ids[0] || null]);
      return { step_id: s.id, files: ids.length };
    });
    audit(req, 'step_done', 'decor_order', orderId, null, { step_id: stepId, files: files.length });
    res.json(await worksView(req, orderId));
  })));

  // Снять отметку: только с последнего отмеченного шага работы — тот, кто отметил, или учредитель
  app.post('/api/decor/orders/:id/steps/:stepId/undo', A(FEAT), wrap(async (req, res) => {
    const orderId = idParam(req); const stepId = idParam(req, 'stepId');
    const removed = await txFor(req)(async c => {
      const o = await orderOf(c, req, orderId, true);
      const { rows: [s] } = await c.query('SELECT id, work_id, position, done_by, done_at FROM decor_order_step_done WHERE id=$1 AND order_id=$2 AND company_id=$3',
        [stepId, o.id, req.decor.cid]);
      if (!s) fail(404, 'Шаг не найден в заказе');
      if (!s.done_at) fail(409, 'Шаг не отмечен', { code: 'step_not_done' });
      if (!req.decor.isOwner && s.done_by !== req.user.id) fail(403, 'Снять отметку может тот, кто отметил, или учредитель', { code: 'step_forbidden' });
      if ((await c.query('SELECT 1 FROM decor_order_step_done WHERE work_id=$1 AND position > $2 AND done_at IS NOT NULL', [s.work_id, s.position])).rowCount) {
        fail(409, 'Снять можно только последний отмеченный шаг', { code: 'step_not_last' });
      }
      const { rows: gone } = await c.query('DELETE FROM decor_report_files WHERE step_done_id=$1 RETURNING file_name', [s.id]);
      await c.query('UPDATE decor_order_step_done SET done_by=NULL, done_at=NULL, photo=NULL WHERE id=$1', [s.id]);
      return { step_id: s.id, files: gone.map(f => f.file_name) };
    });
    const dir = path.join(U.UPLOAD_DIR, String(req.decor.cid));
    for (const f of removed.files || []) fs.unlink(path.join(dir, path.basename(f)), () => {});
    audit(req, 'step_undo', 'decor_order', orderId, null, { step_id: stepId });
    res.json(await worksView(req, orderId));
  }));
};
