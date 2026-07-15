// Sidebar split into 7 business departments (отделы) — each is a top-level section
// with its own mini-dashboard and tools. Plus Dashboard at top and Settings at bottom.
//
// `wired: true` → backed by real live data and existing components.
// `wired: false` → placeholder mockup (user will detail tools per department later).
// Per-role tool visibility is centralized in HIDDEN_TOOLS + getSectionsForRole below
// (founder sees all; director/manager have hidden sets per the access matrix). A
// section-level `roles` (e.g. settings) hides the whole section from other roles.

// Виджеты Главной (Asosiy). Общий источник для Dashboard (что рисовать) и
// PanelManagerTool (учредитель вкл/выкл для всей компании → companies.disabled_widgets).
export const DASH_WIDGETS = [
  { id: 'revenue-hero',   icon: '💰', label: '💰 Выручка (крупный блок)' },
  { id: 'bhi',            icon: '🧭', label: '🧭 Индекс здоровья (BHI)' },
  { id: 'kpi-tiles',      icon: '🏦', label: '🏦 Касса · Продажи · Средний чек' },
  { id: 'cashflow',       icon: '💸', label: '💸 Денежный поток' },
  { id: 'sales-chart',    icon: '📊', label: '📊 Динамика продаж' },
  { id: 'branch-compare', icon: '🏭', label: '🏭 Сравнение филиалов' },
  { id: 'alerts',         icon: '⚠️', label: '⚠️ Алерты' },
  { id: 'top-products',   icon: '🏆', label: '🏆 Топ товаров' },
  { id: 'top-sellers',    icon: '👤', label: '👤 Топ сотрудников' },
];
// Набор по умолчанию (для новых пользователей без сохранённого выбора).
// Все 9 виджетов включены по умолчанию — пользователь скрывает ненужные тумблером (deny-list).
export const DASH_DEFAULT = ['revenue-hero', 'bhi', 'kpi-tiles', 'cashflow', 'sales-chart', 'branch-compare', 'alerts', 'top-products', 'top-sellers'];

export const SECTIONS = [
  {
    id: 'dashboard',
    icon: '🏠', title: 'Главная',
    color: '#1D4ED8',
    desc: 'Сводка по всему бизнесу одним взглядом',
    tools: [],
  },

  {
    id: 'analytics',
    icon: '📊', title: 'Аналитика',
    color: '#1D4ED8',
    desc: 'BHI · дашборд учредителя · алерты · аномалии · тренды · воронка · когорты · юнит-экономика · ССП',
    metrics: ['revenue', 'profit', 'cash'],
    tools: [
      { id: 'ab-point', icon: '⚖️', title: "A/B точка", desc: "Метрики: точка A (вручную) vs точка B (сейчас) · Δ · направление", wired: true },
      { id: 'founder-board',   icon: '👑', title: 'Дашборд учредителя', desc: 'Сводка компании · филиалы · алерты', wired: true },
      { id: 'alert-center',    icon: '🚨', title: 'Центр алертов',      desc: 'Все уведомления системы',    wired: true  },
      { id: 'anomaly',         icon: '🔬', title: 'Детектор аномалий',  desc: 'Отклонения дня от нормы · severity', wired: true  },
      { id: 'branch-compare',  icon: '🏭', title: 'Сравнение филиалов',  desc: 'Выручка · маржа · BHI по филиалам', wired: true },
      { id: 'trends',          icon: '📈', title: 'Тренды и динамика',   desc: '12-мес тренд метрик · авто-инсайты', wired: true  },
      { id: 'business-funnel', icon: '🪜', title: 'Воронка бизнеса',     desc: 'Показы→VIP · конверсии', wired: true  },
      { id: 'period-report',   icon: '📑', title: 'Сводный отчёт',       desc: 'Итоги периода · улучшилось/ухудшилось', wired: true  },
      { id: 'basket-analysis', icon: '🛒', title: 'Анализ корзины',      desc: 'Совместные покупки · апселл', wired: true  },
      { id: 'cohorts',         icon: '📊', title: 'Когортный анализ',    desc: 'Ретеншн по месяцу первой покупки · LTV', wired: true  },
      { id: 'unit-economics',  icon: '🧮', title: 'Юнит-экономика',      desc: 'LTV/CAC · на сделку · ROAS', wired: true  },
      { id: 'ssp',             icon: '🧭', title: 'ССП — стратегия',      desc: 'Cистема сбалансированных показателей', wired: true  },
    ],
  },

  {
    id: 'finance',
    icon: '💰', title: 'Финансы',
    color: '#16A34A',
    desc: 'Финансовая модель · P&L · себестоимость · Cash flow · точка безубыточности',
    metrics: ['revenue', 'profit', 'cash'],
    tools: [
      { id: 'cash-gap', icon: '📉', title: "Прогноз кассового разрыва", desc: "Когда касса уйдёт в минус на 30/60/90 дней", wired: true },
      { id: 'cash',           icon: '🏦', title: 'Кассы',                desc: 'Приход/расход в 10 валютах', wired: true  },
      { id: 'pnl',            icon: '📊', title: 'P&L отчёт',            desc: 'Выручка · маржа · прибыль',  wired: true  },
      { id: 'pricing',        icon: '🏷️', title: 'Ценообразование',      desc: 'Себестоимость · маржа',     wired: true  },
      { id: 'cashflow',       icon: '💸', title: 'Cash Flow',             desc: 'Движение денег по дням',    wired: true  },
      { id: 'modeling',       icon: '🎰', title: 'Что-если симулятор',   desc: 'Цена · маржа · прогноз',    wired: true  },
      { id: 'fin-model',      icon: '📈', title: 'Финансовая модель',    desc: 'P&L · прогноз 3 мес',        wired: true  },
      { id: 'break-even',     icon: '⚖️', title: 'Точка безубыточности', desc: 'Когда выходишь в плюс',     wired: true  },
      { id: 'expenses-report', icon: '🧾', title: 'Отчёт расходов', desc: 'Расходы по категориям · реестр операций', wired: true },
      { id: 'profitability',   icon: '📐', title: 'Рентабельность', desc: 'ROS · ROA · ROE · EBITDA', wired: true },
      { id: 'payment-calendar', icon: '📅', title: 'Платёжный календарь', desc: 'Прогноз кассы и платежи на 14 дней', wired: true },
      { id: 'currency-ops',    icon: '💱', title: 'Валютные операции', desc: 'Валютные сделки · курс · потери', wired: true },
      { id: 'taxes',           icon: '🏛️', title: 'Налоги', desc: 'Платежи · нагрузка · режим', wired: true },
      { id: 'financial-ratios', icon: '📊', title: 'Финансовые коэффициенты', desc: 'Ликвидность · долговая нагрузка · оборачиваемость', wired: true },
      { id: 'fin-whatif',      icon: '🔮', title: 'Что если — Финансы', desc: 'Филиал · кредит · цены', wired: true },
    ],
  },

  {
    id: 'marketing',
    icon: '📣', title: 'Маркетинг',
    color: '#EC4899',
    desc: 'ЦА · контент · LTV · воронка · стратегия',
    metrics: ['customers', 'new_customers', 'loyalty'],
    tools: [
      { id: 'competitor-mirror', icon: '🪞', title: "Зеркало конкурентов", desc: "Сравнение с конкурентами по 6 KPI · radar · win/lose", wired: true },
      { id: 'loss-funnel', icon: '🕳️', title: "Воронка потерь", desc: "Где отваливаются клиенты · упущенная выручка", wired: true },
      { id: 'sales-funnel',   icon: '🎯', title: 'Воронка продаж',        desc: 'Планировщик: ступени · конверсии · потери · бюджет', wired: true },
      { id: 'ca-analysis',    icon: '🎯', title: 'Анализ ЦА (JTBD)',     desc: 'Аватары · боли · возражения', wired: true  },
      { id: 'content-plan',   icon: '🎬', title: 'Конструктор контента',  desc: 'Воронка · план/факт · аналитика', wired: true  },
      { id: 'channels',       icon: '📡', title: 'Каналы и ROI',          desc: 'Откуда клиенты · ROI · LTV по источнику', wired: true  },
      { id: 'ltv',            icon: '💎', title: 'LTV клиентов',          desc: 'Ценность · повторные · сегменты', wired: true  },
      { id: 'leadgen',        icon: '🎯', title: 'Лид-трекер',           desc: 'Воронка лидов · источники · конверсия', wired: true },
      { id: 'customer-campaigns', icon: '📣', title: 'Рассылки клиентам', desc: 'Telegram · SMS · сегменты · возврат', wired: true },
      { id: 'loyalty',        icon: '🎁', title: 'Лояльность',            desc: 'Баллы · тиры · рейтинг участников', wired: true },
    ],
  },

  {
    id: 'procurement',
    icon: '🛒', title: 'Закупки',
    color: '#D97706',
    desc: 'Категорийный менеджмент · поставщики · ассортимент',
    metrics: ['suppliers', 'supplier_debts', 'stock_value'],
    tools: [
      { id: 'suppliers',       icon: '🏭', title: 'Поставщики',          desc: 'База поставщиков',           wired: true  },
      { id: 'debts-suppliers', icon: '📒', title: 'Долги поставщикам',   desc: 'Что мы должны',              wired: true  },
      { id: 'income',          icon: '📥', title: 'Приход товара',       desc: 'От поставщиков',             wired: true  },
      { id: 'procurement-orders', icon: '📋', title: 'Заказы поставщикам', desc: 'Что заказано / в пути',   wired: true },
      { id: 'purchase-history', icon: '📜', title: 'История закупок', desc: 'Реестр приходов · поставщики · динамика', wired: true },
      { id: 'receivings',      icon: '📦', title: 'Приёмка товара', desc: 'Приёмки по накладным · расхождения · брак', wired: true },
      { id: 'supplier-returns', icon: '↩️', title: 'Возвраты поставщику', desc: 'Брак · недопоставка · компенсации', wired: true },
      { id: 'supplier-ratings', icon: '⭐', title: 'Рейтинг поставщиков', desc: 'Доставка в срок · брак · опыт — балл 0-5', wired: true },
      { id: 'purchase-forecast', icon: '🛒', title: 'Прогноз закупок', desc: 'Что и когда заказать · прогноз спроса', wired: true },
      { id: 'what-if-purchases', icon: '🧮', title: 'Что если — Закупки', desc: 'Объём · смена поставщика · отсрочка', wired: true },
      { id: 'supplier-compare',icon: '⚖️', title: 'Сравнение поставщиков',desc: 'Цены · качество · сроки',   wired: true },
    ],
  },

  {
    id: 'warehouse',
    icon: '🏭', title: 'Склад',
    color: '#0EA5E9',
    desc: 'Остатки · приход · ABC/XYZ · инвентаризация',
    metrics: ['stock_value', 'low_stock', 'sku_count'],
    tools: [
      { id: 'stock',           icon: '📦', title: 'Товары и остатки',   desc: 'Каталог · цены · фото · штрих-коды', wired: true },
      { id: 'inventory-mgmt',  icon: '📊', title: 'ABC/XYZ анализ',     desc: 'Точка заказа · мёртвый',     wired: true  },
      { id: 'stock-outcome-report', icon: '📤', title: 'Расход товара', desc: 'Продажи · списания брака · перемещения', wired: true },
      { id: 'stock-transfers', icon: '🚚', title: 'Перемещения между складами', desc: 'Отправка списывает · приёмка зачисляет', wired: true },
      { id: 'product-movements', icon: '📜', title: 'История движения товара', desc: 'Приход и расход · накопительный остаток', wired: true },
      { id: 'turnover-deadstock', icon: '🧊', title: 'Оборачиваемость и мёртвый сток', desc: 'Скорость оборота · замороженный капитал', wired: true },
      { id: 'eoq',             icon: '📐', title: 'EOQ — оптимальный заказ', desc: 'Экономичный размер партии (Уилсон)', wired: true },
      { id: 'reorder-point',   icon: '🛎️', title: 'Точка заказа (ROP)', desc: 'Когда и сколько дозаказывать', wired: true },
      { id: 'safety-stock',    icon: '🛡️', title: 'Страховой запас',    desc: 'Буфер на скачок спроса и задержку', wired: true },
      { id: 'purchase-roi',    icon: '💹', title: 'ROI закупки',        desc: 'Возврат на вложения по товарам', wired: true },
      { id: 'min-stock-alert', icon: '🔔', title: 'Минимальный остаток', desc: 'Алерты дефицита · дни до нуля', wired: true },
      { id: 'barcodes',        icon: '🔖', title: 'Штрихкоды и QR',     desc: 'Покрытие SKU · EAN-13 · QR', wired: true },
      { id: 'demand-forecast', icon: '🔮', title: 'Прогноз потребности склада', desc: 'Сколько и когда закупить · срочность', wired: true },
      { id: 'inventory-whatif', icon: '🧮', title: 'Что если — Склад',  desc: 'Симулятор складских решений', wired: true },
      { id: 'defects',         icon: '🗑️', title: 'Брак и списание',    desc: 'Потери · доля от оборота · журнал', wired: true },
      { id: 'references',      icon: '🏷️', title: 'Справочники',         desc: 'Типы · бренды · единицы',    wired: true  },
      { id: 'audit',           icon: '🔍', title: 'Инвентаризация',     desc: 'Сверка факт vs учёт',        wired: true },
    ],
  },

  {
    id: 'operations',
    icon: '💼', title: 'Продажи / Операции',
    color: '#16A34A',
    desc: 'Управление работой магазинов · B2C касса · B2B сделки · риски',
    metrics: ['deals', 'avg_check', 'revenue'],
    tools: [
      { id: 'store-police', icon: '🚓', title: "Полиция магазина", desc: "Авто-детектор аномалий · отмены · скидки · расхождения · алерты", wired: true },
      { id: 'global-whatif', icon: '🌐', title: "Глобальный «Что если»", desc: "Симулятор бизнеса: цена · поток · ФОТ · аренда · маржа · водопад прибыли", wired: true },
      { id: 'sales-history',   icon: '📋', title: 'История продаж',     desc: 'Все продажи · фильтры',      wired: true  },
      { id: 'pos',             icon: '🛒', title: 'Касса · монитор',    desc: 'Смена в реальном времени',   wired: true  },
      { id: 'scripts',         icon: '💬', title: 'Скрипты продаж',     desc: 'Библиотека · конверсия · возражения', wired: true },
      { id: 'discounts', icon: '🏷️', title: 'Скидки и акции', desc: 'Активные акции · % чеков со скидкой · потери', wired: true },
      { id: 'sales-top-products', icon: '🏆', title: 'Топ товаров', desc: 'Лидеры по выручке · доля · по дням/часам', wired: true },
      { id: 'seller-avg-check', icon: '🧾', title: 'Средний чек по продавцу', desc: 'Чеки · выручка · лидер · потенциал', wired: true },
      { id: 'returns-report', icon: '↩️', title: 'Возвраты и причины', desc: 'Реестр · причины · % к продажам', wired: true },
      { id: 'sales-forecast', icon: '📈', title: 'Прогноз продаж', desc: 'Выручка и чеки на месяц · сезонность', wired: true },
      { id: 'sales-whatif', icon: '🔮', title: 'Что если — Продажи', desc: '5 сценариев: цена · скидка · продавцы · клиенты', wired: true },
      { id: 'risk-control',    icon: '⚠️', title: 'Контроль рисков',    desc: 'Алерты · аномалии',          wired: true  },
      { id: 'tasks',           icon: '📋', title: 'Задачи / Поручения',  desc: 'Kanban · поручения · из алертов', wired: true  },
      { id: 'task-templates',  icon: '⚡', title: 'Шаблоны процессов',  desc: 'Повторяющиеся задачи · авто-генерация', wired: true  },
      { id: 'task-analytics',  icon: '📊', title: 'Аналитика задач',    desc: 'On-time · по сотрудникам', wired: true  },
      { id: 'checklists',      icon: '✅', title: 'Чеклисты',           desc: 'Открытие/закрытие · фото', wired: true  },
    ],
  },

  {
    id: 'hr',
    icon: '👤', title: 'Персонал (HR)',
    color: '#9333EA',
    desc: 'Найм · обучение · мотивация · KPI',
    metrics: ['users', 'team_kpi', 'salary_fund'],
    tools: [
      { id: 'fire-analysis', icon: '🎯', title: "Анализ на увольнение", desc: "Рейтинг по конверсии/чеку/дисциплине · KEEP/WATCH/REPLACE", wired: true },
      { id: 'workday-map', icon: '🗺️', title: "Карта рабочего дня", desc: "Таймлайн дня сотрудника · работа/рутина/простой", wired: true },
      { id: 'employee-health', icon: '❤️‍🩹', title: "Здоровье сотрудника", desc: "Детектор выгорания · score · тренд · зона риска", wired: true },
      { id: 'hire-fire-calc', icon: '🧮', title: "Калькулятор найма/увольнения", desc: "Окупаемость · чистый эффект · вердикт — найм или увольнение на лету", wired: true },
      { id: 'team-kpi',     icon: '👥', title: 'KPI команды',       desc: 'Продажи · смены · бонусы',     wired: true  },
      { id: 'hr-trello',    icon: '📋', title: 'Trello — задачи команды', desc: 'Kanban-доска: ставь задачи сотрудникам, двигай по колонкам', wired: true },
      { id: 'users',        icon: '🧑‍💼', title: 'Сотрудники',         desc: 'Роли · филиалы · доступ',     wired: true  },
      { id: 'training',     icon: '🎓', title: 'Обучение',           desc: 'Видеоуроки · курсы по должностям · прогресс', wired: true },
      { id: 'schedules', icon: '🗓️', title: 'Расписание и смены', desc: 'Недельный график · смены · переработки', wired: true },
      { id: 'attendance', icon: '🕒', title: 'Табель и явка', desc: 'Часы · опоздания · прогулы', wired: true },
      { id: 'absences', icon: '🌴', title: 'Отпуска и больничные', desc: 'Текущие · график · баланс дней', wired: true },
      { id: 'salaries', icon: '💵', title: 'Зарплата (ФОТ)', desc: 'Оклады · % с продаж · премии · выплаты', wired: true },
      { id: 'hr-productivity', icon: '🕐', title: 'Производительность по часам', desc: 'Выручка по дням и часам · расстановка', wired: true },
      { id: 'hr-adjustments', icon: '⚖️', title: 'Штрафы и бонусы', desc: 'Премии · штрафы · дисциплина', wired: true },
      { id: 'hr-forecast', icon: '📊', title: 'Прогноз персонала', desc: 'ФОТ · потребность в найме · отпуска', wired: true },
      { id: 'hr-whatif', icon: '🤔', title: 'Что если — Персонал', desc: 'Повышение ЗП · найм · мотивация', wired: true },
      { id: 'motivation',   icon: '🏆', title: 'Мотивация',           desc: 'Лидерборд продаж · 30 дней',  wired: true  },
      { id: 'hr-overview',  icon: '👤', title: 'Картотека HR',        desc: 'Сотрудники · активность',     wired: true  },
    ],
  },

  {
    id: 'support',
    icon: '📞', title: 'Клиентский сервис',
    color: '#1D4ED8',
    desc: 'Горячая линия · отзывы · жалобы · поддержка',
    metrics: ['customers', 'client_debts', 'nps'],
    tools: [
      { id: 'abc-clients', icon: '🅰️', title: "ABC клиентов", desc: "Парето 80/15/5 · ядро · хвост", wired: true },
      { id: 'churn', icon: '🚪', title: "Отток клиентов", desc: "Ушедшие · зона риска · выручка под угрозой", wired: true },
      { id: 'crm',             icon: '👥', title: 'Клиентская база',  desc: 'Карточки клиентов · история', wired: true  },
      { id: 'debts-clients',   icon: '📒', title: 'Долги клиентов',    desc: 'Кто и сколько должен',        wired: true  },
      { id: 'segmentation',    icon: '🎯', title: 'Сегментация',       desc: 'VIP · спящие · ушедшие',     wired: true  },
      { id: 'birthdays',       icon: '🎂', title: 'Дни рождения',     desc: 'События · поздравления · промокоды', wired: true  },
      { id: 'referrals',       icon: '🤝', title: 'Рефералы',           desc: 'Приведи друга · бонусы · ROI', wired: true  },
      { id: 'client-forecast', icon: '🔮', title: 'Прогноз клиентов',  desc: 'Матрица переходов · отток · рост', wired: true  },
      { id: 'what-if-clients', icon: '🎰', title: 'Что если — Клиенты', desc: 'ROI кампаний: SMS · рефералы · ДР', wired: true  },
      { id: 'complaints',      icon: '⚠️', title: 'Жалобы',             desc: 'Тикеты · разбор',            wired: true  },
      { id: 'nps',             icon: '⭐', title: 'NPS и отзывы',        desc: 'NPS · промоутеры · критики · отзывы', wired: true },
    ],
  },

  {
    id: 'settings',
    icon: '⚙️', title: 'Настройки',
    color: '#6B7280',
    desc: 'Интеграции · безопасность · масштабирование',
    metrics: [],
    roles: ['founder', 'director'],
    tools: [
      { id: 'panel-manager', icon: '🎛️', title: 'Управление панелью', desc: 'Включить/выключить любой инструмент для компании', wired: true },
      { id: 'integrations', icon: '🔌', title: 'Интеграции', desc: 'Реальный статус подключений', wired: true },
      { id: 'security',     icon: '🔐', title: 'Безопасность', desc: 'Роли · права · доступы',  wired: true },
      { id: 'scaling',      icon: '🌍', title: 'Масштабирование', desc: 'Филиалы · валюты',     wired: true },
      { id: 'event-journal', icon: '📜', title: 'Журнал событий', desc: 'Лог действий · подозрительные', wired: true },
    ],
  },
];

// ── Доступ ролей: кто какие инструменты ВИДИТ (матрица «кто что видит») ──────────
// Учредитель видит всё. Ниже — что СКРЫТО у роли. Скоупинг данных (свои филиалы)
// обеспечивается на сервере; здесь — только видимость инструментов в панели.
const HIDDEN_TOOLS = {
  // Директор — без стратегических финансов (прибыль/маржа/налоги/модели).
  director: new Set([
    'ab-point', 'pnl', 'cashflow', 'modeling', 'fin-model', 'break-even',
    'profitability', 'payment-calendar', 'currency-ops', 'taxes',
    'financial-ratios', 'fin-whatif', 'cash-gap', 'global-whatif',
    'panel-manager',  // управление панелью — только учредитель
  ]),
  // Менеджер филиала — то же + чужие филиалы, цены, расходы, стратегия,
  // категорийный мгмт, автоматизация.
  manager: new Set([
    'ab-point', 'pnl', 'cashflow', 'modeling', 'fin-model', 'break-even',
    'profitability', 'payment-calendar', 'currency-ops', 'taxes',
    'financial-ratios', 'fin-whatif', 'cash-gap', 'global-whatif',
    'branch-compare', 'pricing', 'expenses-report', 'strategy-3y',
    'automation',
  ]),
};

export function getSectionsForRole(role) {
  const hidden = HIDDEN_TOOLS[role];
  return SECTIONS
    .filter(s => !s.roles || s.roles.includes(role))
    .map(s => ({
      ...s,
      tools: (s.tools || []).filter(t => !hidden || !hidden.has(t.id)),
    }))
    .filter(s => s.id === 'dashboard' || s.tools.length > 0);
}

// Разделы для конкретного пользователя: роль + персональные blocked_tools + инструменты,
// отключённые учредителем для всей компании (company_disabled_tools). panel-manager
// никогда не прячем — иначе учредитель потеряет доступ к самой панели управления.
export function getUserSections(user) {
  const off = new Set([...(user?.blocked_tools || []), ...(user?.company_disabled_tools || [])]);
  off.delete('panel-manager');
  return getSectionsForRole(user?.role)
    .map(s => ({ ...s, tools: (s.tools || []).filter(t => !off.has(t.id)) }))
    .filter(s => s.id === 'dashboard' || s.tools.length > 0);
}
