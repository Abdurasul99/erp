'use strict';

const { HttpError } = require('./errors');
const { COMPANY_WIDE_ROLES, CREW_ROLES } = require('./access');

// Какие мероприятия видит пользователь. Одно правило на весь сервис: каждая
// ручка, которая читает или меняет мероприятие, обязана пройти через него.
// В Wave мы неделю назад закрывали дыру, где складские ручки принимали
// product_id на веру, — здесь проверка владельца встроена с первого дня.
//
//   founder, project_manager  — все мероприятия компании;
//   coordinator               — мероприятия своего филиала (без филиала — все);
//   decorator/florist/installer — только те, где он в бригаде.
//
// Возвращает SQL-условие для алиаса мероприятия и параметры, продолжая нумерацию
// с firstParam: visibility(user, 'e', 1) → { sql: 'e.company_id = $1 ...', params }.
function visibility(user, alias, firstParam = 1) {
  const params = [user.company_id];
  let sql = `${alias}.company_id = $${firstParam} AND ${alias}.deleted_at IS NULL`;
  if (COMPANY_WIDE_ROLES.has(user.role)) return { sql, params };
  if (CREW_ROLES.has(user.role)) {
    params.push(user.id);
    sql += ` AND EXISTS (SELECT 1 FROM ev_crew vc WHERE vc.event_id = ${alias}.id AND vc.user_id = $${firstParam + 1})`;
    return { sql, params };
  }
  if (user.role === 'coordinator' && user.branch_id) {
    params.push(user.branch_id);
    sql += ` AND ${alias}.branch_id = $${firstParam + 1}`;
    return { sql, params };
  }
  if (user.role === 'coordinator') return { sql, params };
  // Неизвестная роль до сюда дойти не должна (auth её отсекает), но если дойдёт —
  // не показываем ничего, а не всё.
  return { sql: 'false', params: [] };
}

// Загрузить мероприятие с проверкой видимости. Чужое и невидимое отвечают
// одинаково — 404, чтобы по коду ответа нельзя было перебором узнать, какие
// номера мероприятий существуют у других компаний.
async function loadVisibleEvent(q, user, eventId, { forUpdate = false } = {}) {
  const id = Number.parseInt(eventId, 10);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Мероприятие не найдено');
  const v = visibility(user, 'e', 2);
  const { rows: [event] } = await q.query(
    `SELECT e.* FROM ev_events e WHERE e.id = $1 AND ${v.sql}${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, ...v.params]);
  if (!event) throw new HttpError(404, 'Мероприятие не найдено');
  return event;
}

// Кто может менять мероприятие (не только читать). Исполнители работают со
// своими этапами через отчёты, а смету, цену и состав им править нельзя.
const EDITOR_ROLES = new Set(['founder', 'project_manager', 'coordinator']);

function assertCanEdit(user) {
  if (!EDITOR_ROLES.has(user.role)) throw new HttpError(403, 'Менять мероприятие может только руководитель или координатор');
}

module.exports = { visibility, loadVisibleEvent, assertCanEdit, EDITOR_ROLES };
