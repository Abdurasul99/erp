'use strict';

// Роли продукта «Мероприятия» и доступ к группам экранов — по макету
// «Панель руководителя проектов» (экран «Настройки и онбординг»).
//
// Этот же список живёт в backend/server.js (админка заводит учётки с этими
// ролями) и во frontend/src/events/access.js (меню). Три копии сверяет тест
// test/roles-sync.test.js — расхождение ролей между админкой и сервисом дало бы
// учётку, которая создаётся, но не может войти.

const EVENTS_ROLES = ['founder', 'project_manager', 'coordinator', 'decorator', 'florist', 'installer'];

const ROLE_LABELS = {
  founder: 'Учредитель',
  project_manager: 'Руководитель проектов',
  coordinator: 'Координатор',
  decorator: 'Декоратор',
  florist: 'Флорист',
  installer: 'Монтажник',
};

// dash — дашборд, order — заказы и КП, cal — календарь, wh — склад и закуп,
// fin — финансы, teams — бригады и этапы, an — аналитика, set — настройки.
const SCREEN_GROUPS = ['dash', 'order', 'cal', 'wh', 'fin', 'teams', 'an', 'set'];

const DEFAULT_ACCESS = {
  founder: ['dash', 'order', 'cal', 'wh', 'fin', 'teams', 'an', 'set'],
  project_manager: ['dash', 'order', 'cal', 'wh', 'fin', 'teams', 'an'],
  coordinator: ['order', 'cal', 'fin', 'teams'],
  decorator: ['order', 'teams'],
  florist: ['order', 'teams'],
  installer: ['wh', 'teams'],
};

// Кто видит ВСЕ мероприятия компании. Координатор ограничен своим филиалом,
// исполнители — мероприятиями, где они в бригаде (так работает выездная команда:
// видит свои выезды, а не чужие сметы).
const COMPANY_WIDE_ROLES = new Set(['founder', 'project_manager']);
const CREW_ROLES = new Set(['decorator', 'florist', 'installer']);

function canAccess(role, group) {
  return (DEFAULT_ACCESS[role] || []).includes(group);
}

module.exports = {
  EVENTS_ROLES, ROLE_LABELS, SCREEN_GROUPS, DEFAULT_ACCESS,
  COMPANY_WIDE_ROLES, CREW_ROLES, canAccess,
};
