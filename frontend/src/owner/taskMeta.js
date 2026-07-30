// Единый словарь задач, уведомлений и дисциплины.
//
// Зачем: одни и те же справочники были скопированы в пяти файлах (TasksTool,
// HrTrelloTool, TaskAnalyticsTool, MyTasks, TaskTemplatesTool) и уже разъехались —
// низкий приоритет был серым в одном и зелёным в другом. Теперь источник один.
//
// ВАЖНО: модуль импортируется И из инструментов владельца (внутри .owner-shell),
// И из окон сотрудника (Navbar, Desktop, SellerView, Mobile — снаружи неё).
// Поэтому здесь ТОЛЬКО голые hex и имена классов: переменная --primary внутри
// .owner-shell синяя, а в глобальном :root фиолетовая, и var(...) дал бы разные
// цвета в разных оболочках. Эмодзи здесь нет — светлый канон Confluent их не
// использует; поле `cls` — глобальные классы бейджей, `tone` — для owner/ui.jsx.

// ─── Приоритеты ─────────────────────────────────────────────────────────────
export const PRIORITY_META = {
  critical: { color: '#DC2626', tone: 'red',    cls: 'badge-red',    ru: 'Критично', uz: 'Kritik' },
  high:     { color: '#D97706', tone: 'orange', cls: 'badge-orange', ru: 'Высокий',  uz: 'Yuqori' },
  medium:   { color: '#1D4ED8', tone: 'blue',   cls: 'badge-blue',   ru: 'Средний',  uz: "O'rtacha" },
  low:      { color: '#6B7280', tone: 'gray',   cls: 'badge-gray',   ru: 'Низкий',   uz: 'Past' },
};
export const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

// ─── Статусы ────────────────────────────────────────────────────────────────
export const STATUS_META = {
  todo:        { color: '#1D4ED8', tone: 'blue',   cls: 'badge-blue',   ru: 'Сделать',  uz: 'Bajarish' },
  in_progress: { color: '#D97706', tone: 'orange', cls: 'badge-orange', ru: 'В работе', uz: 'Jarayonda' },
  done:        { color: '#16A34A', tone: 'green',  cls: 'badge-green',  ru: 'Готово',   uz: 'Bajarildi' },
  cancelled:   { color: '#6B7280', tone: 'gray',   cls: 'badge-gray',   ru: 'Отменено', uz: 'Bekor qilindi' },
};
// Колонки доски: cancelled на доску не выводим (сервер её тоже не отдаёт в kanban).
export const KANBAN_COLS = ['todo', 'in_progress', 'done'];

export const SOURCE_META = {
  manual:   { ru: 'Вручную',   uz: "Qo'lda" },
  system:   { ru: 'Из алерта', uz: 'Ogohlantirishdan' },
  template: { ru: 'Шаблон',    uz: 'Shablon' },
};

// ─── События задачи (история + лента уведомлений) ───────────────────────────
// kind в таблице task_events. Строка ленты собирается как «<действие> <название>».
export const EVENT_KIND_META = {
  assigned:   { ru: 'Новая задача',        uz: 'Yangi vazifa',            color: '#1D4ED8', tone: 'blue' },
  unassigned: { ru: 'Задача снята',        uz: 'Vazifa olib tashlandi',   color: '#6B7280', tone: 'gray' },
  status:     { ru: 'Статус изменён',      uz: "Holat o'zgardi",          color: '#D97706', tone: 'orange' },
  updated:    { ru: 'Задача изменена',     uz: "Vazifa o'zgartirildi",    color: '#6B7280', tone: 'gray' },
  deleted:    { ru: 'Задача удалена',      uz: "Vazifa o'chirildi",       color: '#DC2626', tone: 'red' },
};

// ─── Роли ───────────────────────────────────────────────────────────────────
// Подписи совпадают с теми, что уже показывает оболочка (OwnerShell/Navbar).
export const ROLE_LABELS = {
  founder:   { ru: 'Учредитель', uz: 'Asoschi' },
  director:  { ru: 'Директор',   uz: 'Direktor' },
  manager:   { ru: 'Менеджер',   uz: 'Menejer' },
  cashier:   { ru: 'Кассир',     uz: 'Kassir' },
  seller:    { ru: 'Продавец',   uz: 'Sotuvchi' },
  warehouse: { ru: 'Складовщик', uz: 'Omborchi' },
  admin:     { ru: 'Администратор', uz: 'Administrator' },
};

// Заголовок ролевого дашборда — клиент называет экраны именно так.
export const BOARD_TITLE_BY_ROLE = {
  founder:  { ru: 'Дашборд учредителя', uz: 'Asoschi dashboardi' },
  director: { ru: 'Дашборд директора',  uz: 'Direktor dashboardi' },
  manager:  { ru: 'Дашборд менеджера',  uz: 'Menejer dashboardi' },
};
export const BOARD_TITLE_FALLBACK = { ru: 'Мой дашборд', uz: 'Mening dashboardim' };

export function boardTitle(role, uz = false) {
  const m = BOARD_TITLE_BY_ROLE[role] || BOARD_TITLE_FALLBACK;
  return uz ? m.uz : m.ru;
}

// ─── Дисциплина (нарушения) ─────────────────────────────────────────────────
export const BONUS_CATS = [
  { value: 'sales_target', ru: 'Выполнение плана продаж', uz: 'Sotuv rejasi bajarildi' },
  { value: 'kpi',          ru: 'Достижение KPI',          uz: 'KPI bajarildi' },
  { value: 'holiday',      ru: 'Праздничная премия',      uz: 'Bayram mukofoti' },
  { value: 'manual',       ru: 'Прочее',                  uz: 'Boshqa' },
];
export const PENALTY_CATS = [
  { value: 'late',     ru: 'Опоздание',            uz: 'Kechikish' },
  { value: 'absent',   ru: 'Прогул',               uz: 'Sababsiz kelmaslik' },
  { value: 'rudeness', ru: 'Грубость с клиентом',  uz: 'Mijozga qo\'pollik' },
  { value: 'damage',   ru: 'Порча имущества',      uz: 'Mol-mulkka zarar' },
  { value: 'manual',   ru: 'Прочее',               uz: 'Boshqa' },
];
export const CAT_LABELS = [...BONUS_CATS, ...PENALTY_CATS].reduce((acc, c) => {
  acc[c.value] = c; return acc;
}, {});

// Оценка дисциплины сотрудника. Возвращает ДАННЫЕ, а не JSX: модуль не тянет
// React и остаётся пригодным для любой оболочки.
export function disciplineLevel(violations, net) {
  if (violations === 0 && net >= 0) return { tone: 'green', ru: 'Образцовая', uz: 'Namunali' };
  if (violations <= 1) return { tone: 'green', ru: 'Хорошая',  uz: 'Yaxshi' };
  if (violations <= 3) return { tone: 'orange', ru: 'Норма',   uz: "O'rtacha" };
  return { tone: 'red', ru: 'Плохая', uz: 'Yomon' };
}

// ─── Хелперы ────────────────────────────────────────────────────────────────
export function pickLabel(meta, uz = false) {
  if (!meta) return '';
  return uz ? (meta.uz || meta.ru || '') : (meta.ru || '');
}

// Имя исполнителя: у части сотрудников не заполнены имя/фамилия, и склейка даёт
// пустую строку — тогда карточка врала «Не назначен» при реальном исполнителе.
export function assigneeLabel(task, uz = false) {
  const full = [task?.assignee_first_name, task?.assignee_last_name].filter(Boolean).join(' ').trim();
  return full || task?.assignee_name?.trim() || task?.assignee_username || (uz ? 'Tayinlanmagan' : 'Не назначен');
}

// Срок: «сегодня» / «завтра» / дата. overdue приходит с сервера.
export function fmtDue(task, uz = false) {
  if (!task?.due_date) return '';
  const d = new Date(task.due_date);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const day = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((day(d) - day(today)) / 86400000);
  if (diff === 0) return uz ? 'Bugun' : 'Сегодня';
  if (diff === 1) return uz ? 'Ertaga' : 'Завтра';
  if (diff === -1) return uz ? 'Kecha' : 'Вчера';
  return d.toLocaleDateString(uz ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: '2-digit' });
}

// Человеческое «сколько назад» для ленты уведомлений.
export function fmtAgo(iso, uz = false) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return uz ? 'hozir' : 'только что';
  const min = Math.round(sec / 60);
  if (min < 60) return uz ? `${min} daq oldin` : `${min} мин назад`;
  const hr = Math.round(min / 60);
  if (hr < 24) return uz ? `${hr} soat oldin` : `${hr} ч назад`;
  const d = Math.round(hr / 24);
  if (d < 7) return uz ? `${d} kun oldin` : `${d} дн назад`;
  return new Date(iso).toLocaleDateString(uz ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: '2-digit' });
}
