// Sidebar split into business departments — each is a top-level section
// with its own mini-dashboard and tools. Plus Dashboard at top and Settings at bottom.
//
// УПРОЩЕНИЕ 2026-06: родственные экраны объединены в хабы с вкладками
// (CombinedTools.jsx): 8 «что если» → simulator, 5 алерт-экранов → control-center,
// 4 задачи → tasks, 4 воронки → funnel, прогнозы кассы/закупок, расчёты запасов,
// HR-аналитика, команда, сегменты клиентов. Было ~116 карточек — стало ~85,
// при этом НИ ОДИН экран не удалён: всё доступно внутри вкладок хабов.
//
// `wired: true` → backed by real live data and existing components.
// Per-role tool visibility is centralized in HIDDEN_TOOLS + getSectionsForRole below.
// A section-level `roles` (e.g. settings) hides the whole section from other roles.

import { boardTitle } from './taskMeta.js';

// Виджеты Главной (Asosiy). Общий источник для Dashboard (что рисовать) и
// PanelManagerTool (учредитель вкл/выкл для всей компании → companies.disabled_widgets).
export const DASH_WIDGETS = [
  { id: 'revenue-hero',   label: 'Выручка (крупный блок)' },
  { id: 'bhi',            label: 'Индекс здоровья (BHI)' },
  { id: 'kpi-tiles',      label: 'Касса · Продажи · Средний чек' },
  { id: 'cashflow',       label: 'Денежный поток' },
  { id: 'sales-chart',    label: 'Динамика продаж' },
  { id: 'branch-compare', label: 'Сравнение филиалов' },
  { id: 'alerts',         label: 'Алерты' },
  { id: 'top-products',   label: 'Топ товаров' },
  { id: 'top-sellers',    label: 'Топ сотрудников' },
];
// Набор по умолчанию (для новых пользователей без сохранённого выбора).
// Все 9 виджетов включены по умолчанию — пользователь скрывает ненужные тумблером (deny-list).
export const DASH_DEFAULT = ['revenue-hero', 'bhi', 'kpi-tiles', 'cashflow', 'sales-chart', 'branch-compare', 'alerts', 'top-products', 'top-sellers'];

// `group` — трёхслойная навигация в сайдбаре: work (ежедневная работа),
// analysis (смотреть/анализировать), system (настроить). Главная — вне групп.
export const NAV_GROUPS = [
  { id: 'work',     label: 'Работа' },
  { id: 'analysis', label: 'Анализ' },
  { id: 'system',   label: 'Система' },
];

export const SECTIONS = [
  {
    id: 'dashboard',
    title: 'Главная',
    color: '#1D4ED8',
    desc: 'Сводка по всему бизнесу одним взглядом',
    tools: [],
  },

  {
    id: 'analytics',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['founder-board', 'control-center', 'reports'],
    title: 'Аналитика',
    group: 'analysis',
    color: '#1D4ED8',
    desc: 'Сводка по компании · контроль · отчёты · когорты · юнит-экономика · симулятор',
    // Деньги (выручка/прибыль/касса) убраны из баннера «Аналитика» по просьбе клиента —
    // они дублируют Главную; баннер показывает только счётчики (инструменты · вкладки).
    metrics: [],
    tools: [
      // Переименован из «Дашборд учредителя»: так теперь называется ролевой дашборд
      // (раздел myboard), и два экрана с одним именем путали учредителя. id не менялся.
      { id: 'founder-board',   title: 'Сводка по компании', desc: 'Сводка компании · филиалы · алерты', wired: true },
      { id: 'control-center',  title: 'Центр контроля',      desc: 'Алерты · аномалии · полиция магазина · риски · дефицит', wired: true, hub: 5 },
      { id: 'simulator',       title: 'Симулятор «Что если»', desc: 'Все сценарии: бизнес · продажи · склад · закупки · персонал · клиенты', wired: true, hub: 8 },
      { id: 'branch-compare',  title: 'Сравнение филиалов',  desc: 'Выручка · маржа · BHI по филиалам', wired: true },
      { id: 'reports',         title: 'Отчёты и тренды',     desc: '12-мес тренды · сводный отчёт за период', wired: true, hub: 2 },
      { id: 'basket-analysis', title: 'Анализ корзины',      desc: 'Совместные покупки · апселл', wired: true },
      { id: 'cohorts',         title: 'Когортный анализ',    desc: 'Ретеншн по месяцу первой покупки · LTV', wired: true },
      { id: 'unit-economics',  title: 'Юнит-экономика',      desc: 'LTV/CAC · на сделку · ROAS', wired: true },
      { id: 'ab-point',        title: 'A/B точка',           desc: 'Метрики: точка A (вручную) vs точка B (сейчас) · Δ · направление', wired: true },
      { id: 'ssp',             title: 'ССП — стратегия',      desc: 'Система сбалансированных показателей', wired: true },
    ],
  },

  // Ролевой дашборд — отдельный раздел, а не инструмент внутри «Главной»: секция
  // dashboard намеренно выброшена из лаунчпада, поиска Ctrl+K и дока, и экран,
  // положенный туда, было бы не найти. Ровно один инструмент; title раздела и
  // инструмента переписывает getSectionsForRole по роли.
  {
    id: 'myboard',
    title: 'Мой дашборд',
    group: 'work',
    color: '#1D4ED8',
    desc: 'Мои дела · поручения · зарплата · нарушения',
    metrics: [],
    tools: [
      { id: 'my-board', title: 'Мой дашборд', desc: 'Мои дела · поручения сотрудникам · зарплата · нарушения', wired: true },
    ],
  },

  {
    id: 'finance',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['cash', 'pnl', 'expenses-report'],
    title: 'Финансы',
    group: 'work',
    color: '#16A34A',
    desc: 'Кассы · P&L · Cash flow · прогнозы · показатели',
    metrics: ['revenue', 'profit', 'cash'],
    tools: [
      { id: 'cash',            title: 'Кассы',                desc: 'Приход/расход в 10 валютах', wired: true },
      { id: 'pnl',             title: 'P&L отчёт',            desc: 'Выручка · маржа · прибыль',  wired: true },
      { id: 'cashflow',        title: 'Cash Flow',             desc: 'Движение денег по дням',    wired: true },
      { id: 'cash-forecast',   title: 'Прогноз кассы',        desc: 'Кассовый разрыв · платёжный календарь', wired: true, hub: 2 },
      { id: 'expenses-report', title: 'Отчёт расходов',       desc: 'Расходы по категориям · реестр операций', wired: true },
      { id: 'fin-health',      title: 'Показатели',           desc: 'Рентабельность · ликвидность · коэффициенты', wired: true, hub: 2 },
      { id: 'pricing',         title: 'Ценообразование',      desc: 'Себестоимость · маржа',     wired: true },
      { id: 'break-even',      title: 'Точка безубыточности', desc: 'Когда выходишь в плюс',     wired: true },
      { id: 'fin-model',       title: 'Финансовая модель',    desc: 'P&L · прогноз 3 мес',        wired: true },
      { id: 'currency-ops',    title: 'Валютные операции',    desc: 'Валютные сделки · курс · потери', wired: true },
      { id: 'taxes',           title: 'Налоги',               desc: 'Платежи · нагрузка · режим', wired: true },
    ],
  },

  {
    id: 'marketing',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['funnel', 'channels', 'customer-campaigns'],
    title: 'Маркетинг',
    group: 'analysis',
    color: '#EC4899',
    desc: 'Воронка · каналы · LTV · рассылки · лояльность',
    metrics: ['customers', 'new_customers', 'loyalty'],
    tools: [
      { id: 'funnel',             title: 'Воронка',              desc: 'Путь клиента · потери · планировщик · лиды', wired: true, hub: 4 },
      { id: 'channels',           title: 'Каналы и ROI',          desc: 'Откуда клиенты · ROI · LTV по источнику', wired: true },
      { id: 'ltv',                title: 'LTV клиентов',          desc: 'Ценность · повторные · сегменты', wired: true },
      { id: 'customer-campaigns', title: 'Рассылки клиентам',     desc: 'Telegram · SMS · сегменты · возврат', wired: true },
      { id: 'loyalty',            title: 'Лояльность',            desc: 'Баллы · тиры · рейтинг участников', wired: true },
      { id: 'competitor-mirror',  title: 'Зеркало конкурентов',   desc: 'Сравнение с конкурентами по 6 KPI', wired: true },
      { id: 'ca-analysis',        title: 'Анализ ЦА (JTBD)',      desc: 'Аватары · боли · возражения', wired: true },
      { id: 'content-plan',       title: 'Конструктор контента',  desc: 'Воронка · план/факт · аналитика', wired: true },
    ],
  },

  {
    id: 'procurement',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['income', 'procurement-orders', 'suppliers'],
    title: 'Закупки',
    group: 'work',
    color: '#D97706',
    desc: 'Поставщики · приход · прогноз закупок',
    metrics: ['suppliers', 'supplier_debts', 'stock_value'],
    tools: [
      { id: 'suppliers',         title: 'Поставщики',           desc: 'База поставщиков',           wired: true },
      { id: 'income',            title: 'Приход товара',        desc: 'От поставщиков',             wired: true },
      { id: 'receivings',        title: 'Приёмка товара',       desc: 'Приёмки по накладным · расхождения · брак', wired: true },
      { id: 'procurement-orders', title: 'Заказы поставщикам',  desc: 'Что заказано / в пути',      wired: true },
      { id: 'purchase-forecast', title: 'Прогноз закупок',      desc: 'Что заказать · потребность склада', wired: true, hub: 2 },
      { id: 'purchase-history',  title: 'История закупок',      desc: 'Реестр приходов · поставщики · динамика', wired: true },
      { id: 'supplier-returns',  title: 'Возвраты поставщику',  desc: 'Брак · недопоставка · компенсации', wired: true },
      { id: 'debts-suppliers',   title: 'Долги поставщикам',    desc: 'Что мы должны',              wired: true },
      { id: 'supplier-eval',     title: 'Оценка поставщиков',   desc: 'Рейтинг 0-5 · сравнение цен/качества/сроков', wired: true, hub: 2 },
    ],
  },

  {
    id: 'warehouse',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['stock', 'audit', 'defects'],
    title: 'Склад',
    group: 'work',
    color: '#0EA5E9',
    desc: 'Остатки · движение · оборачиваемость · инвентаризация',
    metrics: ['stock_value', 'low_stock', 'sku_count'],
    tools: [
      { id: 'stock',              title: 'Товары и остатки',    desc: 'Каталог · цены · фото · штрих-коды', wired: true },
      { id: 'inventory-mgmt',     title: 'ABC/XYZ анализ',      desc: 'Точка заказа · мёртвый',     wired: true },
      { id: 'goods-flow',         title: 'Движение товара',     desc: 'Расход · перемещения между складами · история', wired: true, hub: 3 },
      { id: 'turnover-deadstock', title: 'Оборачиваемость',     desc: 'Скорость оборота · мёртвый сток · замороженный капитал', wired: true },
      { id: 'stock-math',         title: 'Расчёты запасов',     desc: 'EOQ · точка заказа · страховой запас', wired: true, hub: 3 },
      { id: 'purchase-roi',       title: 'ROI закупки',         desc: 'Возврат на вложения по товарам', wired: true },
      { id: 'defects',            title: 'Брак и списание',     desc: 'Потери · доля от оборота · журнал', wired: true },
      { id: 'audit',              title: 'Инвентаризация',      desc: 'Сверка факт vs учёт',        wired: true },
      { id: 'references',         title: 'Справочники',          desc: 'Типы · бренды · единицы · штрихкоды', wired: true, hub: 2 },
    ],
  },

  {
    id: 'operations',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['pos', 'sales-history', 'tasks'],
    title: 'Продажи',
    group: 'work',
    color: '#16A34A',
    desc: 'Касса · история · скидки · возвраты · задачи',
    metrics: ['deals', 'avg_check', 'revenue'],
    tools: [
      { id: 'sales-history',      title: 'История продаж',      desc: 'Все продажи · фильтры',      wired: true },
      { id: 'pos',                title: 'Касса · монитор',     desc: 'Смена в реальном времени',   wired: true },
      { id: 'sales-top-products', title: 'Топ товаров',          desc: 'Лидеры по выручке · доля · по дням/часам', wired: true },
      { id: 'seller-avg-check',   title: 'Средний чек по продавцу', desc: 'Чеки · выручка · лидер · потенциал', wired: true },
      { id: 'discounts',          title: 'Скидки и акции',       desc: 'Активные акции · % чеков со скидкой · потери', wired: true },
      { id: 'returns-report',     title: 'Возвраты и причины',   desc: 'Реестр · причины · % к продажам', wired: true },
      { id: 'sales-forecast',     title: 'Прогноз продаж',       desc: 'Выручка и чеки на месяц · сезонность', wired: true },
      { id: 'scripts',            title: 'Скрипты продаж',       desc: 'Библиотека · конверсия · возражения', wired: true },
      { id: 'tasks',              title: 'Задачи',               desc: 'Доска · шаблоны · аналитика · чеклисты', wired: true, hub: 4 },
    ],
  },

  {
    id: 'hr',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['users', 'salaries', 'hr-adjustments'],
    title: 'Персонал',
    group: 'work',
    color: '#9333EA',
    desc: 'Команда · график · зарплата · аналитика',
    metrics: ['users', 'team_kpi', 'salary_fund'],
    tools: [
      { id: 'team',            title: 'Команда',               desc: 'KPI · лидерборд · картотека', wired: true, hub: 3 },
      { id: 'users',           title: 'Сотрудники',            desc: 'Роли · филиалы · доступ',     wired: true },
      { id: 'schedules',       title: 'Расписание и смены',    desc: 'Недельный график · смены · переработки', wired: true },
      { id: 'attendance',      title: 'Табель и явка',         desc: 'Часы · опоздания · прогулы', wired: true },
      { id: 'absences',        title: 'Отпуска и больничные',  desc: 'Текущие · график · баланс дней', wired: true },
      { id: 'salaries',        title: 'Зарплата (ФОТ)',        desc: 'Оклады · % с продаж · премии · выплаты', wired: true },
      { id: 'hr-adjustments',  title: 'Штрафы и бонусы',       desc: 'Премии · штрафы · дисциплина', wired: true },
      { id: 'hr-productivity', title: 'Производительность',    desc: 'Выручка по дням и часам · расстановка', wired: true },
      { id: 'hr-analytics',    title: 'HR-аналитика',          desc: 'Рейтинг · карта дня · выгорание · найм', wired: true, hub: 4 },
      { id: 'hr-forecast',     title: 'Прогноз персонала',     desc: 'ФОТ · потребность в найме · отпуска', wired: true },
      { id: 'training',        title: 'Обучение',              desc: 'Видеоуроки · курсы по должностям · прогресс', wired: true },
    ],
  },

  {
    id: 'support',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['crm', 'feedback', 'debts-clients'],
    title: 'Клиенты',
    group: 'work',
    color: '#1D4ED8',
    desc: 'База · сегменты · долги · жалобы · NPS',
    metrics: ['customers', 'client_debts', 'nps'],
    tools: [
      { id: 'crm',             title: 'Клиентская база',   desc: 'Карточки клиентов · история', wired: true },
      { id: 'segments',        title: 'Сегменты',           desc: 'ABC · VIP/спящие/ушедшие · отток', wired: true, hub: 3 },
      { id: 'debts-clients',   title: 'Долги клиентов',     desc: 'Кто и сколько должен',        wired: true },
      { id: 'birthdays',       title: 'Дни рождения',       desc: 'События · поздравления · промокоды', wired: true },
      { id: 'referrals',       title: 'Рефералы',           desc: 'Приведи друга · бонусы · ROI', wired: true },
      { id: 'client-forecast', title: 'Прогноз клиентов',   desc: 'Матрица переходов · отток · рост', wired: true },
      { id: 'feedback',        title: 'Отзывы и жалобы',    desc: 'NPS · промоутеры · критики · тикеты жалоб', wired: true, hub: 2 },
    ],
  },

  {
    id: 'settings',
    // Быстрые действия баннера: самые частые дела раздела, ведут прямо в инструмент.
    quick: ['panel-manager', 'company-profile', 'security'],
    title: 'Настройки',
    group: 'system',
    color: '#6B7280',
    desc: 'Интеграции · безопасность · масштабирование',
    metrics: [],
    roles: ['founder', 'director'],
    tools: [
      { id: 'company-profile', title: 'Компания', desc: 'Название · логотип в панели', wired: true },
      { id: 'panel-manager', title: 'Управление панелью', desc: 'Включить/выключить любой инструмент для компании', wired: true },
      { id: 'integrations',  title: 'Интеграции',          desc: 'Реальный статус подключений', wired: true },
      { id: 'security',      title: 'Безопасность',        desc: 'Роли · права · доступы',  wired: true },
      { id: 'scaling',       title: 'Масштабирование',     desc: 'Филиалы · валюты',     wired: true },
      { id: 'event-journal', title: 'Журнал событий',      desc: 'Лог действий · подозрительные', wired: true },
    ],
  },
];

// ── Доступ ролей: кто какие инструменты ВИДИТ (матрица «кто что видит») ──────────
// Учредитель видит всё. Ниже — что СКРЫТО у роли. Скоупинг данных (свои филиалы)
// обеспечивается на сервере; здесь — только видимость инструментов в панели.
// NB: у «simulator» финансовые вкладки дополнительно скрыты по роли ВНУТРИ хаба
// (CombinedTools.jsx) — директор/менеджер видят только операционные сценарии.
const HIDDEN_TOOLS = {
  // Директор — без стратегических финансов (прибыль/маржа/налоги/модели).
  director: new Set([
    'ab-point', 'pnl', 'cashflow', 'fin-model', 'break-even',
    'fin-health', 'cash-forecast', 'currency-ops', 'taxes',
    'panel-manager',  // управление панелью — только учредитель
    'company-profile', // профиль компании (лого) — только учредитель
  ]),
  // Менеджер филиала — то же + чужие филиалы, цены, расходы.
  manager: new Set([
    'ab-point', 'pnl', 'cashflow', 'fin-model', 'break-even',
    'fin-health', 'cash-forecast', 'currency-ops', 'taxes',
    'branch-compare', 'pricing', 'expenses-report',
    // Ниже — инструменты, которые сервер менеджеру НЕ отдаёт (403): раньше они
    // висели в меню и открывались с «Нет доступа». Сверено прогоном всех 163
    // GET-эндпоинтов под ролью manager (2026-07-29).
    'founder-board',    // /analytics/founder-dashboard — сводка по ВСЕЙ компании
    'unit-economics',   // /finance/profitability — стратегические финансы
    'simulator',        // /finance|procurement|hr/whatif-base — моделирование
    'event-journal',    // /audit-log — журнал действий всей компании
    'integrations',     // /integrations — настройки компании
    // ВОЗВРАЩЕНЫ менеджеру (2026-07-29, просьба клиента): зарплаты, штрафы/премии
    // и HR-прогноз — но сервер отдаёт ТОЛЬКО его филиал (getBranchFilter пинит
    // manager к своему branch_id, подмена через ?branch_id невозможна):
    //   'salaries', 'hr-adjustments', 'hr-forecast'
  ]),
};

export function getSectionsForRole(role) {
  const hidden = HIDDEN_TOOLS[role];
  // «Дашборд учредителя/директора/менеджера» — имя зависит от роли. Подставляем его
  // здесь, а не внутри самого инструмента: PageHeader в окне инструмента ничего не
  // рисует (InsideSheetContext), видимый заголовок окна берётся из tool.title.
  const board = boardTitle(role);
  return SECTIONS
    .filter(s => !s.roles || s.roles.includes(role))
    .map(s => ({
      ...s,
      title: s.id === 'myboard' ? board : s.title,
      tools: (s.tools || [])
        .filter(t => !hidden || !hidden.has(t.id))
        .map(t => (t.id === 'my-board' ? { ...t, title: board } : t)),
    }))
    .filter(s => s.id === 'dashboard' || s.tools.length > 0);
}

// Разделы для конкретного пользователя: роль + персональные blocked_tools + инструменты,
// отключённые учредителем для всей компании (company_disabled_tools). panel-manager
// никогда не прячем — иначе учредитель потеряет доступ к самой панели управления.
export function getUserSections(user) {
  const off = new Set([...(user?.blocked_tools || []), ...(user?.company_disabled_tools || [])]);
  off.delete('panel-manager');
  // Ролевой дашборд отключать нельзя: вместе с ним сотрудник потерял бы и свои
  // задачи, и уведомления о них — единственное место, где он их видит.
  off.delete('my-board');
  return getSectionsForRole(user?.role)
    .map(s => ({ ...s, tools: (s.tools || []).filter(t => !off.has(t.id)) }))
    .filter(s => s.id === 'dashboard' || s.tools.length > 0);
}
