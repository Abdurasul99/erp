// Начальные данные новой компании сферы «Декор». Вызывается общей админкой (sphere_admin.js, SEEDS.decor)
// внутри транзакции создания компании, а также демо-сидом. Повторный вызов ничего не дублирует.
const FEATURES = require('./features');
const { ACTIONS, DEFAULT_PERMISSIONS, DEFAULT_RATES, POSITIONS, DEFAULT_EVIDENCE, DEFAULT_VALUES } = require('./defaults');

module.exports = async function seedCompany(c, companyId) {
  // Настройки — значения по умолчанию из таблицы (курс, нормы, N дней на объекте и т.д.)
  await c.query('INSERT INTO decor_settings (company_id) VALUES ($1) ON CONFLICT DO NOTHING', [companyId]);
  // Полная матрица полномочий: каждое действие у каждой должности явно включено или выключено
  for (const position of POSITIONS) {
    for (const action of ACTIONS) {
      await c.query(
        'INSERT INTO decor_permissions (company_id, position, action, allowed) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [companyId, position, action, (DEFAULT_PERMISSIONS[position] || []).includes(action)]);
    }
  }
  for (const [level, byType] of Object.entries(DEFAULT_RATES)) {
    for (const [orderType, amount] of Object.entries(byType)) {
      await c.query(
        'INSERT INTO decor_pay_rates (company_id, level, order_type, amount_usd) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [companyId, level, orderType, amount]);
    }
  }
  // Требования к доказательствам по этапам (D24) — по умолчанию; меняет учредитель в Настройках
  for (const [stage, r] of Object.entries(DEFAULT_EVIDENCE)) {
    await c.query(
      `INSERT INTO decor_evidence_rules (company_id, stage, min_photos, need_video, shortage_note) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`, [companyId, stage, r.min_photos, r.need_video, r.shortage_note]);
  }
  // «Кадрият» (D27): шесть ценностей с названиями, тексты пустые — пишет учредитель
  for (const v of DEFAULT_VALUES) {
    await c.query('INSERT INTO decor_values (company_id, position, title_uz, title_ru) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [companyId, v.position, v.title_uz, v.title_ru]);
  }
  for (const f of FEATURES.filter(x => x.tier === 'basic')) {
    await c.query(
      'INSERT INTO company_features (company_id, feature_key, enabled, plan_tier) VALUES ($1,$2,true,$3) ON CONFLICT DO NOTHING',
      [companyId, f.key, f.tier]);
  }
};
