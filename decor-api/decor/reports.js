// Фото и видео отчёты с объекта: загрузка (с телефона), очередь на одобрение, «одобрить / вернуть» с комментарием.
// Доказательства обязательны (D24): отчёт без нужного числа фото/видео сервер не принимает («нужно ещё 2 фото и видео»),
// одобрить можно только отчёт с полным комплектом по текущим требованиям. Одобрение «Приёмки» с полным комплектом
// создаёт сдельные начисления команде (одно на сотрудника за заказ; ставка запоминается в начислении — смена ставок
// прошлые начисления не меняет).
// Файлы — uploads.js (папка компании на диске, лимиты фото/видео из настроек); отдаются только по токену той же компании.
const fs = require('fs');
const path = require('path');
const F = require('./formulas');
const { loadCompany } = require('./data');
const { makeView } = require('./views');
const { REPORT_STAGES } = require('./defaults');
const { wrap, fail, idParam, toInt, todayYmd, text, oneOf } = require('./common');
const U = require('./uploads');

module.exports = ({ app, pool, A, can, feature, audit, txFor, idem, lockOrder, loadModel, requireEvidence, rulesOf }) => {
  const REP = feature('decor-reports');

  // ---------- Загрузить отчёт: multipart stage, employee_id, comment, files[] ----------
  app.post('/api/decor/orders/:id/reports', A(REP, can('upload_report'), idem), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const stage = oneOf(req.body?.stage, REPORT_STAGES, 'Этап');
    const comment = text(req.body?.comment, 2000);
    await U.checkSizes(pool, req);
    await requireEvidence(pool, req, stage);
    const rid = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (['lead', 'closed'].includes(o.status)) fail(409, 'Отчёт загружается по заказу в работе');
      const { rows: team } = await c.query('SELECT employee_id FROM decor_order_team WHERE order_id=$1', [id]);
      const teamIds = team.map(t => t.employee_id);
      // Исполнитель: указанный из команды заказа или сам загружающий (если он в команде)
      const employee = toInt(req.body?.employee_id) || req.decor.employee?.id || null;
      if (!employee || !teamIds.includes(employee)) fail(400, 'Исполнитель должен быть из команды заказа');
      const { rows: [r] } = await c.query(`INSERT INTO decor_reports (company_id, order_id, stage, employee_id, comment, report_date, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [req.decor.cid, id, stage, employee, comment, todayYmd(), req.user.id]);
      await U.saveFiles(c, req, { report_id: r.id });
      return r.id;
    });
    audit(req, 'create', 'decor_report', rid, null, { order_id: id, stage, files: (req.files || []).length });
    const { data, m } = await loadModel(req);
    res.json(makeView(req, data, m).card(data.orders.find(x => x.id === id)));
  })));

  // ---------- Отчёты: очередь на одобрение и последние решения ----------
  app.get('/api/decor/reports', A(REP), wrap(async (req, res) => {
    const { data, m } = await loadModel(req);
    const v = makeView(req, data, m);
    const list = data.orders.flatMap(o => o.reports.map(r => ({ id: r.id, order_id: o.id, no: o.no, client: o.client, order_status: o.status,
      stage: r.stage, status: r.status, comment: r.comment, reply: r.reply, date: r.report_date, decided_at: r.decided_at,
      employee: v.person(r.employee_id), files: r.files, evidence: F.evidenceGap(m.rule(r.stage), r.files) })));
    const status = req.query.status;
    res.json({
      pending: list.filter(r => r.status === 'pending').sort((a, b) => (a.date < b.date ? -1 : 1)),
      decided: status === 'pending' ? [] : list.filter(r => r.status !== 'pending').sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || ''))).slice(0, 30),
    });
  }));

  // ---------- Файл отчёта или доказательства (только своей компании; фото выдачи и чеков — и без функции отчётов) ----------
  app.get('/api/decor/files/:id', A(), wrap(async (req, res) => {
    const { rows: [f] } = await pool.query('SELECT file_name, original_name, mime FROM decor_report_files WHERE id=$1 AND company_id=$2', [idParam(req), req.decor.cid]);
    if (!f) fail(404, 'Файл не найден');
    const dir = path.join(U.UPLOAD_DIR, String(req.decor.cid));
    const file = path.join(dir, path.basename(f.file_name));
    if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) fail(404, 'Файл не найден на диске');
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.original_name || 'file')}`);
    fs.createReadStream(file).pipe(res);
  }));

  // ---------- Одобрить / вернуть. Одобрить — только с полным комплектом; одобренная «Приёмка» → начисления ----------
  app.post('/api/decor/reports/:id/decision', A(REP, can('approve_report'), idem), wrap(async (req, res) => {
    const id = idParam(req);
    const decision = oneOf(req.body?.decision, ['approve', 'return'], 'Решение');
    const reply = text(req.body?.reply, 2000);
    const r = await txFor(req)(async c => {
      const { rows: [rep] } = await c.query('SELECT id, order_id, stage, status FROM decor_reports WHERE id=$1 AND company_id=$2 FOR UPDATE', [id, req.decor.cid]);
      if (!rep) fail(404, 'Отчёт не найден');
      if (rep.status !== 'pending') fail(409, 'По отчёту уже есть решение');
      await lockOrder(c, req, rep.order_id);
      if (decision === 'approve') {
        const { rows: files } = await c.query('SELECT kind FROM decor_report_files WHERE report_id=$1', [id]);
        const gap = F.evidenceGap((await rulesOf(c, req.decor.cid))[rep.stage], files);
        if (!gap.ok) {
          fail(409, `Одобрить нельзя — не хватает доказательств: ${F.evidenceText(gap)}`,
            { code: 'evidence', stage: rep.stage, missing: gap.missing, need: gap.need, have: gap.have });
        }
      }
      await c.query('UPDATE decor_reports SET status=$2, reply=$3, decided_by=$4, decided_at=NOW() WHERE id=$1',
        [id, decision === 'approve' ? 'approved' : 'returned', reply, req.user.id]);
      const accrued = [];
      if (decision === 'approve' && rep.stage === 'acceptance') {
        const data = await loadCompany(c, req.decor.cid);
        const m = F.model(data, todayYmd());
        for (const a of m.accrual(data.orders.find(x => x.id === rep.order_id))) {
          const { rowCount } = await c.query(`INSERT INTO decor_payroll (company_id, order_id, employee_id, level, order_type, amount_usd, report_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (order_id, employee_id) DO NOTHING`,
          [req.decor.cid, rep.order_id, a.employee_id, a.level, a.order_type, a.amount_usd, id]);
          if (rowCount) accrued.push(a);
        }
      }
      return { ...rep, accrued };
    });
    audit(req, decision, 'decor_report', id, { status: 'pending' }, { status: decision === 'approve' ? 'approved' : 'returned', reply, accrued: r.accrued });
    res.json({ id, order_id: r.order_id, stage: r.stage, status: decision === 'approve' ? 'approved' : 'returned', accrued: r.accrued });
  }));
};
module.exports.UPLOAD_DIR = U.UPLOAD_DIR;
