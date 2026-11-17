'use strict';
// Граница филиалов — один чокпоинт для всех /api/*: филиал из запроса (branch_id,
// from_branch_id, to_branch_id в query или теле) обязан принадлежать компании пользователя.
//
// Зачем: getBranchFilter отдаёт учредителю/директору ЛЮБОЙ переданный ?branch_id без
// проверки компании. Эндпоинт безопасен, только если его SQL дополнительно фильтрует
// company_id — и QA-обход 2026-11-17 нашёл тот, что не фильтровал (GET
// /api/stock/income-list: учредитель компании B читал приходы компании A). Чокпоинт
// закрывает весь класс таких дыр сразу, независимо от SQL конкретного маршрута.
//
// Платформенный admin без компании не проверяется — его держит своя граница
// (ADMIN_ALLOWED_PREFIXES). Токен «войти как» (act_as) несёт company_id той компании,
// в которую вошли, и проверяется по ней.

const FIELDS = ['branch_id', 'from_branch_id', 'to_branch_id'];

function toIds(v) {
  const list = Array.isArray(v) ? v : [v];
  const out = [];
  for (const x of list) {
    if (x === null || x === undefined || x === '') continue;
    const n = Number(x);
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return out;
}

function requestedBranchIds(req) {
  const ids = new Set();
  for (const src of [req.query, req.body]) {
    if (!src || typeof src !== 'object') continue;
    for (const f of FIELDS) for (const id of toIds(src[f])) ids.add(id);
  }
  return ids;
}

const OUT_OF_COMPANY = Object.freeze({ error: 'Филиал не относится к вашей компании', code: 'BRANCH_OUT_OF_COMPANY' });

// verify(token) → decoded JWT (бросает на плохом токене); branchCompany(id) → company_id | null
function createBranchBoundary({ verify, branchCompany }) {
  return async function branchBoundary(req, res, next) {
    const token = req.headers?.authorization?.split(' ')[1];
    if (!token) return next();
    const ids = requestedBranchIds(req);
    if (!ids.size) return next();
    let decoded;
    try { decoded = verify(token); } catch { return next(); }   // плохой токен — решит auth() маршрута
    if (!decoded?.company_id) return next();                    // платформенный admin — своя граница
    try {
      for (const id of ids) {
        const companyId = await branchCompany(id);
        if (companyId === null || companyId === undefined || Number(companyId) !== Number(decoded.company_id)) {
          return res.status(403).json({ ...OUT_OF_COMPANY });
        }
      }
    } catch (e) {
      return res.status(503).json({ error: 'Не удалось проверить филиал. Попробуйте позже.' });
    }
    next();
  };
}

// Кэш «филиал → компания»: филиалы между компаниями не переезжают, а запрос с branch_id
// идёт почти на каждом экране. Несуществующий филиал не кэшируем (его могут создать).
function cachedBranchCompany(query, ttlMs = 5 * 60 * 1000) {
  const cache = new Map();
  return async (id) => {
    const hit = cache.get(id);
    if (hit && hit.until > Date.now()) return hit.company;
    const { rows } = await query('SELECT company_id FROM branches WHERE id = $1', [id]);
    const company = rows[0]?.company_id ?? null;
    if (company !== null) cache.set(id, { company, until: Date.now() + ttlMs });
    return company;
  };
}

module.exports = { requestedBranchIds, createBranchBoundary, cachedBranchCompany, OUT_OF_COMPANY };
