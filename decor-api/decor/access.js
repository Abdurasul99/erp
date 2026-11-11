// Доступ к API «Декора»: вход именно этой сферы, контекст компании и полномочия должности — на сервере.
// Полномочия — матрица decor_permissions (должность × действие), учредитель и ген. директор могут всё.
// Функции компании (company_features) включает админ Wave: выключенная функция закрывает и свои адреса API.
const { OWNERS, POSITIONS, ACTIONS } = require('./defaults');
const { wrap, fail } = require('./common');
const idem = require('./idem');

const ACTION_LABELS = {
  create_order: 'оформлять заказы', change_status: 'менять статус заказа', handle_decor: 'выдавать и принимать декор',
  take_money: 'принимать деньги от клиента', confirm_money: 'подтверждать деньги (касса)', upload_report: 'загружать отчёты',
  approve_report: 'одобрять отчёты', pay_team: 'выплачивать сдельную оплату', see_finance: 'видеть себестоимость и прибыль',
  edit_settings: 'менять настройки', manage_items: 'вести склад (вещи, приход, списание, инвентаризация)',
  edit_values: 'менять Кадрият', assign_tasks: 'ставить задачи', accept_tasks: 'принимать выполненные задачи',
  edit_standards: 'менять стандарты работ',
};
const FEATURE_LABELS = {
  'decor-orders': 'Заказы, калькулятор и бронь', 'decor-warehouse': 'Склад и износ', 'decor-finance': 'Себестоимость и деньги',
  'decor-team': 'Сдельная оплата', 'decor-reports': 'Фото и видео отчёты', 'decor-ai': 'Подсказки Wave Intelligence',
};

module.exports = function makeAccess({ pool, auth, SPHERE }) {
  // Контекст запроса (один раз): компания, полномочия, сотрудник пользователя, включённые функции
  const ctx = wrap(async (req, res, next) => {
    if (req.user?.sphere !== SPHERE) fail(403, 'Войдите в сферу «Декор»', { code: 'wrong_sphere' });
    const cid = req.user.company_id || fail(403, 'Пользователь не привязан к компании');
    const role = req.user.role;
    const isOwner = OWNERS.includes(role);
    const [u, perm, emp, feat] = await Promise.all([
      pool.query('SELECT is_blocked, role FROM users WHERE id=$1 AND company_id=$2', [req.user.id, cid]),
      isOwner || !POSITIONS.includes(role) ? { rows: [] }
        : pool.query('SELECT action FROM decor_permissions WHERE company_id=$1 AND position=$2 AND allowed', [cid, role]),
      pool.query('SELECT id, name, level FROM decor_employees WHERE company_id=$1 AND user_id=$2', [cid, req.user.id]),
      pool.query('SELECT feature_key FROM company_features WHERE company_id=$1 AND enabled', [cid]),
    ]);
    if (!u.rows[0]) fail(401, 'Пользователь не найден');
    if (u.rows[0].is_blocked) fail(403, 'Аккаунт заблокирован', { code: 'blocked' });
    if (u.rows[0].role !== role) fail(401, 'Должность изменилась — войдите заново');
    req.decor = {
      cid, role, isOwner,
      perms: new Set(isOwner ? ACTIONS : perm.rows.map(r => r.action)),
      employee: emp.rows[0] || null,
      features: new Set(feat.rows.map(r => r.feature_key)),
    };
    // Каждый записывающий запрос — только с ключом повторной отправки (idem.js; исключения — idem.EXEMPT)
    if (idem.needsKey(req)) return idem.middleware(req, res, next);
    next();
  });

  // A(...guards) — вход сферы + контекст + проверки маршрута
  const A = (...guards) => [auth([]), ctx, ...guards];
  const has = (req, action) => req.decor.perms.has(action);
  // Хотя бы одно из полномочий
  const can = (...actions) => (req, res, next) => (actions.some(a => has(req, a)) ? next()
    : res.status(403).json({ error: `Нет полномочия: ${actions.map(a => ACTION_LABELS[a]).join(' или ')}`, code: 'no_permission', actions }));
  const need = (req, ...actions) => { if (!actions.some(a => has(req, a))) fail(403, `Нет полномочия: ${actions.map(a => ACTION_LABELS[a]).join(' или ')}`, { code: 'no_permission', actions }); };
  const ownerOnly = (req, res, next) => (req.decor.isOwner ? next() : res.status(403).json({ error: 'Только учредитель', code: 'owner_only' }));
  // Строже ownerOnly: только сам учредитель, без ген. директора (управление панелью — решение владельца 09.11.2026)
  const founderOnly = (req, res, next) => (req.user.role === 'founder' ? next() : res.status(403).json({ error: 'Только учредитель', code: 'founder_only' }));
  const feature = key => (req, res, next) => (req.decor.features.has(key) ? next()
    : res.status(403).json({ error: `Функция «${FEATURE_LABELS[key] || key}» не включена для компании`, code: 'feature_off', feature: key }));

  return { A, can, need, has, ownerOnly, founderOnly, feature };
};
module.exports.ACTION_LABELS = ACTION_LABELS;
