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
const DIGITS = /^\d{1,10}$/;

// Значение поля филиала → { id } | { bad: true }. Принимаем ТОЛЬКО однозначные значения:
// пусто/null (= «без фильтра»), целое число или строку из одних цифр. Всё остальное
// («1x», «0x1», «1.5», « 1», массив, true) — отказ: маршруты читают branch_id через
// parseInt (местами без основания), и для них это филиал 1, а не «нет значения» —
// мягкий пропуск такого значения границей был обходом изоляции (security review 2026-11-17).
function parseBranchValue(x) {
  if (x === null || x === undefined || x === '') return { id: null };
  if (typeof x === 'number') {
    if (!Number.isInteger(x) || x < 0) return { bad: true };
    return { id: x > 0 ? x : null };
  }
  if (typeof x === 'string' && DIGITS.test(x)) { const n = Number(x); return { id: n > 0 ? n : null }; }
  return { bad: true };
}

// Все филиалы из query и тела. invalid — имя поля с недопустимым значением (или null).
function inspectBranchParams(req) {
  const ids = new Set();
  for (const src of [req.query, req.body]) {
    if (!src || typeof src !== 'object') continue;
    for (const f of FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(src, f)) continue;
      const v = parseBranchValue(src[f]);
      if (v.bad) return { ids, invalid: f };
      if (v.id) ids.add(v.id);
    }
  }
  return { ids, invalid: null };
}

const OUT_OF_COMPANY = Object.freeze({ error: 'Филиал не относится к вашей компании', code: 'BRANCH_OUT_OF_COMPANY' });
const BAD_BRANCH = Object.freeze({ error: 'Некорректный номер филиала', code: 'BAD_BRANCH_ID' });

// verify(token) → decoded JWT (бросает на плохом токене); branchCompany(id) → company_id | null
function createBranchBoundary({ verify, branchCompany }) {
  return async function branchBoundary(req, res, next) {
    const token = req.headers?.authorization?.split(' ')[1];
    if (!token) return next();
    const { ids, invalid } = inspectBranchParams(req);
    if (!invalid && !ids.size) return next();
    let decoded;
    try { decoded = verify(token); } catch { return next(); }   // плохой токен — решит auth() маршрута
    if (!decoded?.company_id) return next();                    // платформенный admin — своя граница
    if (invalid) return res.status(400).json({ ...BAD_BRANCH, field: invalid });
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

module.exports = { inspectBranchParams, parseBranchValue, createBranchBoundary, cachedBranchCompany, OUT_OF_COMPANY, BAD_BRANCH };
