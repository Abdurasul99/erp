// Sidebar split into 7 business departments (отделы) — each is a top-level section
// with its own mini-dashboard and tools. Plus Dashboard at top and Settings at bottom.
//
// `wired: true` → backed by real live data and existing components.
// `wired: false` → placeholder mockup (user will detail tools per department later).
// `roles` → who sees this tool. Empty = all owner roles (founder/gen_dir/manager).

export const SECTIONS = [
  {
    id: 'dashboard',
    icon: '🏠', title: 'Главная',
    color: '#5B4FE8',
    desc: 'Сводка по всему бизнесу одним взглядом',
    tools: [],
  },

  {
    id: 'finance',
    icon: '💰', title: 'Финансы',
    color: '#16A34A',
    desc: 'Финансовая модель · P&L · себестоимость · Cash flow · точка безубыточности',
    metrics: ['revenue', 'profit', 'cash'],
    tools: [
      { id: 'cash',           icon: '🏦', title: 'Кассы',                desc: 'Приход/расход в 10 валютах', wired: true  },
      { id: 'pnl',            icon: '📊', title: 'P&L отчёт',            desc: 'Выручка · маржа · прибыль',  wired: true  },
      { id: 'pricing',        icon: '🏷️', title: 'Ценообразование',      desc: 'Себестоимость · маржа',     wired: true  },
      { id: 'cashflow',       icon: '💸', title: 'Cash Flow',             desc: 'Движение денег по дням',    wired: true  },
      { id: 'modeling',       icon: '🎰', title: 'Что-если симулятор',   desc: 'Цена · маржа · прогноз',    wired: true  },
      { id: 'fin-model',      icon: '📈', title: 'Финансовая модель',    desc: 'P&L · прогноз 3 мес',        wired: true  },
      { id: 'break-even',     icon: '⚖️', title: 'Точка безубыточности', desc: 'Когда выходишь в плюс',     wired: true  },
    ],
  },

  {
    id: 'marketing',
    icon: '📣', title: 'Маркетинг',
    color: '#EC4899',
    desc: 'ЦА · CJM · ССП · контент · Reels · копирайтинг',
    metrics: ['customers', 'new_customers', 'loyalty'],
    tools: [
      { id: 'ca-analysis',    icon: '🎯', title: 'Анализ ЦА (JTBD)',     desc: 'Аватары · боли · возражения', wired: true  },
      { id: 'content-plan',   icon: '📝', title: 'Контент-план',          desc: 'Расписание · типы · ритм',    wired: true  },
      { id: 'cjm',            icon: '🗺️', title: 'CJM',                   desc: 'Карта пути клиента',          wired: false },
      { id: 'ssp',            icon: '🧭', title: 'ССП — стратегия',       desc: 'Cистема сбалансированных показателей', wired: false },
      { id: 'reels',          icon: '🎬', title: 'Reels-механики',        desc: 'Hook · удержание · CTA',     wired: false },
      { id: 'storytelling',   icon: '✍️', title: 'Сторителлинг',          desc: 'AIDA · PAS · 4U',            wired: false },
      { id: 'reels-shoot',    icon: '📹', title: 'Сценарии Reels',        desc: 'Структура · монтаж',          wired: false },
      { id: 'mkt-overview',   icon: '📣', title: 'Кампании',              desc: 'Активные акции и промо',     wired: false },
      { id: 'strategy-3y',    icon: '🗓️', title: 'Стратегия 3 года',      desc: 'Сезонность · этапы',         wired: false },
      { id: 'leadgen',        icon: '📡', title: 'Лидогенерация',         desc: 'ROI каналов · CPL',          wired: false },
      { id: 'competitors',    icon: '🔭', title: 'Конкуренты',            desc: 'Цены · мониторинг',          wired: false },
      { id: 'loyalty',        icon: '🎁', title: 'Лояльность',            desc: 'Bronze→Platinum',            wired: false },
    ],
  },

  {
    id: 'procurement',
    icon: '🛒', title: 'Закупки',
    color: '#FF6B2B',
    desc: 'Категорийный менеджмент · поставщики · ассортимент',
    metrics: ['suppliers', 'supplier_debts', 'stock_value'],
    tools: [
      { id: 'suppliers',       icon: '🏭', title: 'Поставщики',          desc: 'База поставщиков',           wired: true  },
      { id: 'debts-suppliers', icon: '📒', title: 'Долги поставщикам',   desc: 'Что мы должны',              wired: true  },
      { id: 'income',          icon: '📥', title: 'Приход товара',       desc: 'От поставщиков',             wired: true  },
      { id: 'procurement-orders', icon: '📋', title: 'Заказы поставщикам', desc: 'Что заказано / в пути',   wired: false },
      { id: 'category-mgmt',   icon: '🧩', title: 'Категорийный мгмт',   desc: 'Ассортимент по категориям',  wired: false },
      { id: 'supplier-compare',icon: '⚖️', title: 'Сравнение поставщиков',desc: 'Цены · качество · сроки',   wired: false },
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
      { id: 'references',      icon: '🏷️', title: 'Справочники',         desc: 'Типы · бренды · единицы',    wired: true  },
      { id: 'bundles',         icon: '🎁', title: 'Наборы',             desc: 'Сборка · BOM',               wired: false },
      { id: 'logistics',       icon: '🚚', title: 'Логистика',          desc: 'Курьеры · карта · статусы',   wired: false },
      { id: 'audit',           icon: '🔍', title: 'Инвентаризация',     desc: 'Сверка факт vs учёт',        wired: false },
    ],
  },

  {
    id: 'operations',
    icon: '💼', title: 'Продажи / Операции',
    color: '#22C55E',
    desc: 'Управление работой магазинов · B2C касса · B2B сделки · риски',
    metrics: ['deals', 'avg_check', 'revenue'],
    tools: [
      { id: 'sales-history',   icon: '📋', title: 'История продаж',     desc: 'Все продажи · фильтры',      wired: true  },
      { id: 'pos',             icon: '🛒', title: 'Касса · монитор',    desc: 'Смена в реальном времени',   wired: true  },
      { id: 'b2b',             icon: '🏢', title: 'B2B / B2G',          desc: 'Pipeline · сделки',          wired: false },
      { id: 'commercial-offer',icon: '📄', title: 'Коммерческое предл.', desc: 'Генератор КП',              wired: false },
      { id: 'scripts',         icon: '📞', title: 'Скрипты продаж',     desc: 'Cold call · возражения',    wired: false },
      { id: 'risk-control',    icon: '⚠️', title: 'Контроль рисков',    desc: 'Алерты · аномалии',          wired: true  },
      { id: 'planning',        icon: '🎯', title: 'Планирование',       desc: 'План продаж · бюджет',       wired: false },
      { id: 'automation',      icon: '⚡', title: 'Автоматизация',      desc: 'Если → То · сценарии',       wired: false },
    ],
  },

  {
    id: 'hr',
    icon: '👤', title: 'Персонал (HR)',
    color: '#9333EA',
    desc: 'Найм · обучение · мотивация · KPI',
    metrics: ['users', 'team_kpi', 'salary_fund'],
    tools: [
      { id: 'team-kpi',     icon: '👥', title: 'KPI команды',       desc: 'Продажи · смены · бонусы',     wired: true  },
      { id: 'users',        icon: '🧑‍💼', title: 'Сотрудники',         desc: 'Роли · филиалы · доступ',     wired: true  },
      { id: 'hiring',       icon: '📋', title: 'Найм',               desc: 'Вакансии · кандидаты',         wired: false },
      { id: 'onboarding',   icon: '🎒', title: 'Адаптация',          desc: 'Чек-листы для новых',         wired: false },
      { id: 'training',     icon: '🎬', title: 'Обучение',           desc: 'Курсы · аттестация',           wired: false },
      { id: 'motivation',   icon: '🏆', title: 'Мотивация',           desc: 'Лидерборд продаж · 30 дней',  wired: true  },
      { id: 'hr-overview',  icon: '👤', title: 'Картотека HR',        desc: 'Сотрудники · активность',     wired: true  },
    ],
  },

  {
    id: 'support',
    icon: '📞', title: 'Клиентский сервис',
    color: '#7C3AED',
    desc: 'Горячая линия · отзывы · жалобы · поддержка',
    metrics: ['customers', 'client_debts', 'nps'],
    tools: [
      { id: 'crm',             icon: '👥', title: 'Клиентская база',  desc: 'Карточки клиентов · история', wired: true  },
      { id: 'debts-clients',   icon: '📒', title: 'Долги клиентов',    desc: 'Кто и сколько должен',        wired: true  },
      { id: 'segmentation',    icon: '🎯', title: 'Сегментация',       desc: 'VIP · спящие · ушедшие',     wired: true  },
      { id: 'hotline',         icon: '☎️', title: 'Горячая линия',     desc: 'Звонки · обращения',         wired: false },
      { id: 'complaints',      icon: '⚠️', title: 'Жалобы',             desc: 'Тикеты · разбор',            wired: false },
      { id: 'reviews',         icon: '⭐', title: 'Отзывы',             desc: 'Сбор · мониторинг · ответ',  wired: false },
      { id: 'nps',             icon: '🌟', title: 'NPS-опросы',         desc: 'Лояльность · детракторы',    wired: false },
      { id: 'cjm-client',      icon: '🗺️', title: 'CJM (клиент)',       desc: 'Путь клиента · ретеншн',    wired: false },
      { id: 'contact-points',  icon: '📍', title: 'Точки контакта',     desc: 'До/во время/после',           wired: false },
    ],
  },

  {
    id: 'settings',
    icon: '⚙️', title: 'Настройки',
    color: '#6B7280',
    desc: 'Интеграции · безопасность · масштабирование',
    metrics: [],
    roles: ['founder', 'gen_dir'],
    tools: [
      { id: 'integrations', icon: '🔌', title: 'Интеграции', desc: 'Реальный статус подключений', wired: true, roles: ['founder', 'gen_dir'] },
      { id: 'security',     icon: '🔐', title: 'Безопасность', desc: 'Роли · права · доступы',  wired: true, roles: ['founder', 'gen_dir'] },
      { id: 'scaling',      icon: '🌍', title: 'Масштабирование', desc: 'Филиалы · валюты',     wired: true, roles: ['founder', 'gen_dir'] },
    ],
  },
];

export function getSectionsForRole(role) {
  return SECTIONS
    .filter(s => !s.roles || s.roles.includes(role))
    .map(s => ({
      ...s,
      tools: (s.tools || []).filter(t => !t.roles || t.roles.includes(role)),
    }))
    .filter(s => s.id === 'dashboard' || s.tools.length > 0);
}
