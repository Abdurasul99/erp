// Роли и разделы продукта «Мероприятия» — для меню и подписей.
//
// Решает доступ сервер (events-api/src/access.js); здесь копия только для
// интерфейса. Совпадение всех копий списка ролей проверяет
// events-api/test/roles-sync.test.js.

export const EVENTS_ROLES = ['founder', 'project_manager', 'coordinator', 'decorator', 'florist', 'installer'];

export const ROLE_LABELS = {
  founder: 'Учредитель',
  project_manager: 'Руководитель проектов',
  coordinator: 'Координатор',
  decorator: 'Декоратор',
  florist: 'Флорист',
  installer: 'Монтажник',
};

// Разделы в порядке меню. ready: false — раздел есть в матрице доступа, но
// экран ещё не построен: в меню его не показываем, чтобы не вести в пустоту.
export const SECTIONS = [
  { id: 'dash', path: '', label: 'Главная', ready: true },
  { id: 'order', path: 'orders', label: 'Заказы', ready: true },
  { id: 'cal', path: 'calendar', label: 'Календарь', ready: true },
  { id: 'wh', path: 'warehouse', label: 'Склад', ready: false },
  { id: 'fin', path: 'finance', label: 'Финансы', ready: false },
  { id: 'teams', path: 'stages', label: 'Этапы', ready: false },
  { id: 'an', path: 'analytics', label: 'Аналитика', ready: false },
  { id: 'set', path: 'settings', label: 'Настройки', ready: false },
];

export const STATUS_LABELS = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

// Кнопки смены статуса — глаголом, а не названием статуса.
export const STATUS_ACTIONS = {
  confirmed: 'Подтвердить',
  in_progress: 'В работу',
  completed: 'Завершить',
  cancelled: 'Отменить',
  draft: 'Вернуть в черновик',
};

export const EDITOR_ROLES = ['founder', 'project_manager', 'coordinator'];
