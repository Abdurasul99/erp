// Доказательства (фото/видео) — обязательны (решение пользователя 2026-10-24, D24):
//   требования по этапам задаёт учредитель (выдача, монтаж, приёмка, демонтаж, финальный возврат, «сдал кассиру»);
//   сервер не принимает отчёт или действие, если фото/видео меньше требования («нужно ещё 2 фото и видео»);
//   доказательства выдачи, финала и «сдал» — decor_evidence (файлы — decor_report_files.evidence_id),
//   отчётов — decor_reports. Здесь: правила, проверка комплекта, запись, «добавить доказательства» для старых заказов,
//   лимиты файлов и сколько места они занимают.
const F = require('./formulas');
const { EVIDENCE_STAGES, DEFAULT_EVIDENCE } = require('./defaults');
const { makeView } = require('./views');
const { wrap, fail, idParam, toInt, text, oneOf, intIn } = require('./common');
const U = require('./uploads');

const STAGE_LABELS = { issue: 'выдача со склада', install: 'монтаж', acceptance: 'приёмка', dismantle: 'демонтаж',
  final: 'финальный возврат', handover: '«сдал кассиру»' };

module.exports = ctx => {
  const { app, pool, A, has, need, ownerOnly, audit, txFor, lockOrder, loadModel } = ctx;

  async function rulesOf(db, cid) {
    const out = Object.fromEntries(Object.entries(DEFAULT_EVIDENCE).map(([k, v]) => [k, { ...v }]));
    const { rows } = await db.query('SELECT stage, min_photos, need_video, shortage_note FROM decor_evidence_rules WHERE company_id=$1', [cid]);
    for (const r of rows) out[r.stage] = { min_photos: r.min_photos, need_video: r.need_video, shortage_note: r.shortage_note };
    return out;
  }
  // Комплект по файлам запроса. Не хватает — 400 с понятным текстом и тем, чего не хватает (экран переводит на RU/UZ)
  async function requireEvidence(db, req, stage, { shortage = false, comment = null, files = req.files } = {}) {
    const gap = F.evidenceGap((await rulesOf(db, req.decor.cid))[stage], files, { shortage, comment });
    if (!gap.ok) {
      fail(400, `Не хватает доказательств (${STAGE_LABELS[stage]}): ${F.evidenceText(gap)}`,
        { code: 'evidence', stage, missing: gap.missing, need: gap.need, have: gap.have });
    }
    return gap;
  }
  // Доказательство действия + его файлы (в транзакции действия)
  async function saveEvidence(c, req, { orderId, stage, paymentId = null, comment = null }) {
    const { rows: [e] } = await c.query(`INSERT INTO decor_evidence (company_id, order_id, stage, payment_id, comment, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [req.decor.cid, orderId, stage, paymentId, comment, req.user.id]);
    await U.saveFiles(c, req, { evidence_id: e.id });
    return e.id;
  }

  const view = async req => {
    const [rules, { rows: [s] }] = await Promise.all([rulesOf(pool, req.decor.cid),
      pool.query('SELECT photo_max_mb, video_max_mb FROM decor_settings WHERE company_id=$1', [req.decor.cid])]);
    return { rules: EVIDENCE_STAGES.map(stage => ({ stage, ...rules[stage] })), photo_max_mb: s.photo_max_mb, video_max_mb: s.video_max_mb,
      can_edit: req.decor.isOwner };
  };

  // ---------- Требования к доказательствам и лимиты файлов: видят все (экраны подсказывают), меняет учредитель ----------
  app.get('/api/decor/evidence/rules', A(), wrap(async (req, res) => res.json(await view(req))));

  app.put('/api/decor/evidence/rules', A(ownerOnly), wrap(async (req, res) => {
    const b = req.body || {};
    const list = Array.isArray(b.rules) ? b.rules : [];
    const rules = list.map(r => {
      const stage = oneOf(r?.stage, EVIDENCE_STAGES, 'Этап');
      const minPhotos = intIn(r.min_photos, `${STAGE_LABELS[stage]}: фото`, 0, 9);
      const needVideo = r.need_video === true;
      const note = stage === 'final' ? r.shortage_note !== false : false;
      if (minPhotos === 0 && !needVideo) fail(400, `${STAGE_LABELS[stage]}: нужно хотя бы 1 фото или видео`);
      return { stage, min_photos: minPhotos, need_video: needVideo, shortage_note: note };
    });
    const photoMax = b.photo_max_mb === undefined ? null : intIn(b.photo_max_mb, 'Лимит фото, МБ', 1, 50);
    const videoMax = b.video_max_mb === undefined ? null : intIn(b.video_max_mb, 'Лимит видео, МБ', 1, Math.min(500, U.HARD_MAX_MB));
    if (!rules.length && photoMax === null && videoMax === null) fail(400, 'Нет изменений');
    const before = await view(req);
    await txFor(req)(async c => {
      for (const r of rules) {
        await c.query(`INSERT INTO decor_evidence_rules (company_id, stage, min_photos, need_video, shortage_note, updated_by, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (company_id, stage) DO UPDATE SET min_photos=EXCLUDED.min_photos,
          need_video=EXCLUDED.need_video, shortage_note=EXCLUDED.shortage_note, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
        [req.decor.cid, r.stage, r.min_photos, r.need_video, r.shortage_note, req.user.id]);
      }
      if (photoMax !== null || videoMax !== null) {
        await c.query(`UPDATE decor_settings SET photo_max_mb=COALESCE($2, photo_max_mb), video_max_mb=COALESCE($3, video_max_mb),
          updated_by=$4, updated_at=NOW() WHERE company_id=$1`, [req.decor.cid, photoMax, videoMax, req.user.id]);
      }
      return { rules: rules.length, photo_max_mb: photoMax, video_max_mb: videoMax };
    });
    const after = await view(req);
    audit(req, 'update', 'decor_evidence_rules', req.decor.cid, before, after);
    res.json(after);
  }));

  // ---------- Сколько места занимают файлы (Настройки) ----------
  app.get('/api/decor/files/usage', A(), wrap(async (req, res) => {
    if (!req.decor.isOwner && !has(req, 'edit_settings')) fail(403, 'Нет полномочия: менять настройки', { code: 'no_permission', actions: ['edit_settings'] });
    res.json(await U.usage(pool, req.decor.cid));
  }));

  // ---------- «Добавить доказательства» — для старых заказов и действий без фото ----------
  // stage issue / final — фото выдачи или финального возврата (handle_decor); привязывается к движениям этого вида без
  // доказательства. stage handover + payment_id — фото чека к деньгам, принятым сотрудником (сам принявший или касса).
  app.post('/api/decor/orders/:id/evidence', A(), U.upload, wrap(U.withFiles(async (req, res) => {
    const id = idParam(req);
    const stage = oneOf(req.body?.stage, ['issue', 'final', 'handover'], 'Этап');
    const comment = text(req.body?.comment, 1000);
    const paymentId = stage === 'handover' ? (toInt(req.body?.payment_id) || fail(400, 'Укажите оплату')) : null;
    if (stage === 'handover') {
      if (!req.decor.features.has('decor-finance')) fail(403, 'Функция «Себестоимость и деньги» не включена для компании', { code: 'feature_off', feature: 'decor-finance' });
    } else {
      if (!req.decor.features.has('decor-warehouse')) fail(403, 'Функция «Склад и износ» не включена для компании', { code: 'feature_off', feature: 'decor-warehouse' });
      need(req, 'handle_decor');
    }
    await U.checkSizes(pool, req);
    const eid = await txFor(req)(async c => {
      const o = await lockOrder(c, req, id);
      if (stage === 'handover') {
        const { rows: [p] } = await c.query(`SELECT p.id, p.status, p.received_by_employee_id, e.user_id AS receiver_user
          FROM decor_payments p LEFT JOIN decor_employees e ON e.id=p.received_by_employee_id WHERE p.id=$1 AND p.order_id=$2 AND p.company_id=$3`,
        [paymentId, id, req.decor.cid]);
        if (!p) fail(404, 'Оплата не найдена в этом заказе');
        if (!p.received_by_employee_id) fail(409, 'Эти деньги приняла касса — фото чека не нужно');
        if (p.status === 'at_pm') fail(409, 'Деньги ещё не сданы — фото чека прикладывается к «Сдал»');
        const { rows: [has1] } = await c.query("SELECT 1 FROM decor_evidence WHERE payment_id=$1 AND stage='handover' LIMIT 1", [paymentId]);
        if (has1) fail(409, 'Фото чека к этой оплате уже есть');
        if (p.receiver_user !== req.user.id && !has(req, 'confirm_money')) fail(403, 'Добавить фото чека может тот, кто принял деньги, или касса', { code: 'not_self' });
        await requireEvidence(c, req, 'handover', { comment });
      } else {
        const type = stage;   // движение того же вида: issue или final
        const { rows: [cnt] } = await c.query('SELECT count(*)::int AS n FROM decor_moves WHERE order_id=$1 AND type=$2', [id, type]);
        if (!cnt.n) fail(409, stage === 'issue' ? `По заказу ${o.no} ещё ничего не выдавали` : `По заказу ${o.no} финального возврата ещё не было`);
        const { data, m } = await loadModel(req, c);
        const od = data.orders.find(x => x.id === id);
        const st = m.evidenceStatus(od).find(e => e.stage === stage);
        if (st.ok) fail(409, 'Доказательств по этому этапу хватает');
        await requireEvidence(c, req, stage, { shortage: stage === 'final' && m.shortageItems(od).length > 0, comment });
      }
      const e = await saveEvidence(c, req, { orderId: id, stage, paymentId, comment });
      if (stage !== 'handover') await c.query('UPDATE decor_moves SET evidence_id=$1 WHERE order_id=$2 AND type=$3 AND evidence_id IS NULL', [e, id, stage]);
      return e;
    });
    audit(req, 'add_evidence', 'decor_order', id, null, { evidence_id: eid, stage, payment_id: paymentId, files: (req.files || []).length });
    const { data, m } = await loadModel(req);
    res.json(makeView(req, data, m).card(data.orders.find(x => x.id === id)));
  })));

  return { rulesOf, requireEvidence, saveEvidence, STAGE_LABELS };
};
