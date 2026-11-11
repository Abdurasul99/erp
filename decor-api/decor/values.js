// «Кадрият» — ценности компании (D27; ТЗ «Декор, обновление 2», раздел 4).
// Шесть кнопок на Главной у всех должностей и на странице входа; нажатие — название и текст на языке экрана.
// Тексты пишет учредитель сам: Настройки → Кадрият, полномочие «менять Кадрият» (edit_values; учредитель и ген. директор — всегда).
// Сохраняются все шесть разом (порядок кнопок = порядок в списке), с ключом повтора.
//
// Страница входа: до входа компания неизвестна (вход один на все компании «Декора»). Открытый адрес
// GET /api/decor/public/values отдаёт только названия и тексты ценностей: компании, из которой уже входили на этом
// устройстве (?company=, запоминает экран), иначе — DECOR_PUBLIC_COMPANY_ID из .env, иначе — первой компании.
const { DEFAULT_VALUES } = require('./defaults');
const { wrap, fail, toInt, text } = require('./common');

const TITLE_MAX = 120;
const TEXT_MAX = 5000;

module.exports = ({ app, pool, A, can, audit, txFor }) => {
  // Шесть ценностей компании по порядку; строк нет (компания старше D27 мимо миграции) — названия по умолчанию
  async function read(cid) {
    const { rows } = await pool.query(`SELECT position, title_uz, title_ru, text_uz, text_ru, updated_at
      FROM decor_values WHERE company_id=$1 ORDER BY position`, [cid]);
    return DEFAULT_VALUES.map(d => rows.find(r => r.position === d.position) || { ...d, text_uz: '', text_ru: '', updated_at: null });
  }
  const pub = v => ({ position: v.position, title_uz: v.title_uz, title_ru: v.title_ru, text_uz: v.text_uz, text_ru: v.text_ru });

  app.get('/api/decor/values', A(), wrap(async (req, res) => res.json((await read(req.decor.cid)).map(pub))));

  app.put('/api/decor/values', A(can('edit_values')), wrap(async (req, res) => {
    const list = req.body?.values;
    if (!Array.isArray(list) || list.length !== DEFAULT_VALUES.length) fail(400, `Нужно ровно ${DEFAULT_VALUES.length} ценностей`, { code: 'values_count' });
    const long = (v, max, label) => { if (String(v ?? '').length > max) fail(400, `${label}: не больше ${max} символов`); return text(v, max) || ''; };
    const clean = list.map((v, i) => {
      const n = i + 1;
      return {
        position: n,
        title_uz: long(v?.title_uz, TITLE_MAX, `Ценность ${n}, название (UZ)`) || fail(400, `Ценность ${n}: название (UZ) обязательно`, { code: 'value_title' }),
        title_ru: long(v?.title_ru, TITLE_MAX, `Ценность ${n}, название (RU)`) || fail(400, `Ценность ${n}: название (RU) обязательно`, { code: 'value_title' }),
        text_uz: long(v?.text_uz, TEXT_MAX, `Ценность ${n}, текст (UZ)`),
        text_ru: long(v?.text_ru, TEXT_MAX, `Ценность ${n}, текст (RU)`),
      };
    });
    const cid = req.decor.cid;
    const old = await read(cid);
    await txFor(req)(async c => {
      await c.query('DELETE FROM decor_values WHERE company_id=$1', [cid]);
      await c.query(`INSERT INTO decor_values (company_id, position, title_uz, title_ru, text_uz, text_ru, updated_by)
        SELECT $1, x.position, x.title_uz, x.title_ru, x.text_uz, x.text_ru, $2
        FROM jsonb_to_recordset($3::jsonb) AS x(position int, title_uz text, title_ru text, text_uz text, text_ru text)`,
      [cid, req.user.id, JSON.stringify(clean)]);
      return { saved: clean.length };
    });
    audit(req, 'update', 'decor_values', cid, old.map(pub), clean);
    res.json((await read(cid)).map(pub));
  }));

  // ---------- Страница входа (без токена) ----------
  let limiter = (req, res, next) => next();
  try {
    limiter = require('express-rate-limit')({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
      message: { error: 'Слишком много запросов — подождите минуту' } });
  } catch { /* без ограничителя — только в стенде без express-rate-limit */ }
  const known = async cid => cid && (await pool.query('SELECT 1 FROM decor_settings WHERE company_id=$1', [cid])).rowCount > 0;
  app.get('/api/decor/public/values', limiter, wrap(async (req, res) => {
    let cid = toInt(req.query.company);
    if (!(await known(cid))) cid = toInt(process.env.DECOR_PUBLIC_COMPANY_ID);
    if (!(await known(cid))) cid = (await pool.query('SELECT company_id FROM decor_settings ORDER BY company_id LIMIT 1')).rows[0]?.company_id || null;
    res.set('Cache-Control', 'no-store');
    if (!cid) return res.json({ company_id: null, values: [] });
    res.json({ company_id: cid, values: (await read(cid)).map(pub) });
  }));
};
