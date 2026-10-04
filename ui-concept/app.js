const people = {
  founder: { name: 'Азиз Садыков', role: 'Основатель', photo: 'assets/people/founder.jpg' },
  director: { name: 'Малика Рахимова', role: 'Директор', photo: 'assets/people/director.jpg' },
  manager: { name: 'Алишер Каримов', role: 'Менеджер филиала', photo: 'assets/people/manager.jpg' },
  cashier: { name: 'Шахноза Юсупова', role: 'Кассир', photo: 'assets/people/cashier.jpg' },
  seller: { name: 'Сарвар Турсунов', role: 'Продавец', photo: 'assets/people/seller.jpg' },
  operator: { name: 'Нодира Камилова', role: 'Оператор склада', photo: 'assets/people/operator.jpg' }
};

const makeTool = (id, title, description) => ({ id, title, description });

const modules = {
  dashboard: { title: 'Главная', description: 'Сводка по всему бизнесу одним взглядом', icon: 'layout-dashboard', color: '#0c66e4', soft: '#e9f2ff', tools: [] },
  analytics: {
    title: 'Аналитика', description: 'BHI, алерты, аномалии, тренды, воронки и юнит-экономика', icon: 'chart-no-axes-combined', color: '#0c66e4', soft: '#e9f2ff', tools: [
      makeTool('ab-point', 'A/B точка', 'Точка A против точки B, разница и направление'), makeTool('founder-board', 'Дашборд учредителя', 'Сводка компании, филиалы и алерты'), makeTool('alert-center', 'Центр алертов', 'Все уведомления системы'), makeTool('anomaly', 'Детектор аномалий', 'Отклонения дня от нормы и severity'), makeTool('branch-compare', 'Сравнение филиалов', 'Выручка, маржа и BHI по филиалам'), makeTool('trends', 'Тренды и динамика', 'Тренд метрик за 12 месяцев'), makeTool('business-funnel', 'Воронка бизнеса', 'Показы, лиды, продажи и конверсии'), makeTool('period-report', 'Сводный отчёт', 'Итоги периода и изменения'), makeTool('basket-analysis', 'Анализ корзины', 'Совместные покупки и апселл'), makeTool('cohorts', 'Когортный анализ', 'Ретеншн и LTV по когортам'), makeTool('unit-economics', 'Юнит-экономика', 'LTV, CAC, ROAS и прибыль на сделку'), makeTool('ssp', 'ССП — стратегия', 'Система сбалансированных показателей')
    ]
  },
  finance: {
    title: 'Финансы', description: 'P&L, Cash Flow, кассы, платежи, налоги и финансовое моделирование', icon: 'landmark', color: '#1f845a', soft: '#dffcf0', tools: [
      makeTool('cash-gap', 'Прогноз кассового разрыва', 'Когда касса уйдёт в минус на 30/60/90 дней'), makeTool('cash', 'Кассы', 'Приход и расход в 10 валютах'), makeTool('pnl', 'P&L отчёт', 'Выручка, маржа и прибыль'), makeTool('pricing', 'Ценообразование', 'Себестоимость и маржа'), makeTool('cashflow', 'Cash Flow', 'Движение денег по дням'), makeTool('modeling', 'Что-если симулятор', 'Цена, маржа и прогноз'), makeTool('fin-model', 'Финансовая модель', 'P&L и прогноз на три месяца'), makeTool('break-even', 'Точка безубыточности', 'Когда бизнес выходит в плюс'), makeTool('expenses-report', 'Отчёт расходов', 'Расходы по категориям и реестр операций'), makeTool('profitability', 'Рентабельность', 'ROS, ROA, ROE и EBITDA'), makeTool('payment-calendar', 'Платёжный календарь', 'Прогноз кассы и платежи на 14 дней'), makeTool('currency-ops', 'Валютные операции', 'Валютные сделки, курс и потери'), makeTool('taxes', 'Налоги', 'Платежи, нагрузка и режим'), makeTool('financial-ratios', 'Финансовые коэффициенты', 'Ликвидность, долги и оборачиваемость'), makeTool('fin-whatif', 'Что если — Финансы', 'Филиал, кредит и цены')
    ]
  },
  marketing: {
    title: 'Маркетинг', description: 'Целевая аудитория, контент, лиды, каналы, LTV и лояльность', icon: 'megaphone', color: '#ae4787', soft: '#fce7f3', tools: [
      makeTool('competitor-mirror', 'Зеркало конкурентов', 'Сравнение конкурентов по ключевым KPI'), makeTool('loss-funnel', 'Воронка потерь', 'Где теряются клиенты и выручка'), makeTool('ca-analysis', 'Анализ ЦА (JTBD)', 'Аватары, боли и возражения'), makeTool('content-plan', 'Конструктор контента', 'План, факт и аналитика контента'), makeTool('channels', 'Каналы и ROI', 'Источники клиентов, ROI и LTV'), makeTool('ltv', 'LTV клиентов', 'Ценность, повторные продажи и сегменты'), makeTool('leadgen', 'Лид-трекер', 'Воронка лидов, источники и конверсия'), makeTool('customer-campaigns', 'Рассылки клиентам', 'Telegram, SMS и сегменты'), makeTool('loyalty', 'Лояльность', 'Баллы, уровни и рейтинг участников')
    ]
  },
  procurement: {
    title: 'Закупки', description: 'Поставщики, заказы, приёмки, возвраты и прогноз потребности', icon: 'truck', color: '#b65c02', soft: '#fff7d6', tools: [
      makeTool('suppliers', 'Поставщики', 'Единая база поставщиков'), makeTool('debts-suppliers', 'Долги поставщикам', 'Что и когда компания должна'), makeTool('income', 'Приход товара', 'Поступления от поставщиков'), makeTool('procurement-orders', 'Заказы поставщикам', 'Что заказано и находится в пути'), makeTool('purchase-history', 'История закупок', 'Реестр приходов и динамика'), makeTool('receivings', 'Приёмка товара', 'Накладные, расхождения и брак'), makeTool('supplier-returns', 'Возвраты поставщику', 'Брак, недопоставка и компенсации'), makeTool('supplier-ratings', 'Рейтинг поставщиков', 'Сроки, качество и итоговый балл'), makeTool('purchase-forecast', 'Прогноз закупок', 'Что и когда заказать'), makeTool('what-if-purchases', 'Что если — Закупки', 'Объём, поставщик и отсрочка'), makeTool('supplier-compare', 'Сравнение поставщиков', 'Цены, качество и сроки')
    ]
  },
  warehouse: {
    title: 'Склад', description: 'Товары, остатки, движения, перемещения, прогноз и инвентаризация', icon: 'warehouse', color: '#0e7490', soft: '#cffafe', tools: [
      makeTool('stock', 'Товары и остатки', 'Каталог, цены, фото и штрихкоды'), makeTool('inventory-mgmt', 'ABC/XYZ анализ', 'Точка заказа и мёртвый сток'), makeTool('stock-outcome-report', 'Расход товара', 'Продажи, списания и перемещения'), makeTool('stock-transfers', 'Перемещения между складами', 'Отправка и подтверждение приёмки'), makeTool('product-movements', 'История движения товара', 'Приход, расход и накопительный остаток'), makeTool('turnover-deadstock', 'Оборачиваемость и мёртвый сток', 'Скорость оборота и замороженный капитал'), makeTool('eoq', 'EOQ — оптимальный заказ', 'Экономичный размер партии'), makeTool('reorder-point', 'Точка заказа (ROP)', 'Когда и сколько заказывать'), makeTool('safety-stock', 'Страховой запас', 'Буфер на спрос и задержку'), makeTool('purchase-roi', 'ROI закупки', 'Возврат на вложения по товарам'), makeTool('min-stock-alert', 'Минимальный остаток', 'Дефицит и дни до нуля'), makeTool('barcodes', 'Штрихкоды и QR', 'Покрытие SKU, EAN-13 и QR'), makeTool('demand-forecast', 'Прогноз потребности склада', 'Сколько и когда закупить'), makeTool('inventory-whatif', 'Что если — Склад', 'Симулятор складских решений'), makeTool('defects', 'Брак и списание', 'Потери, доля и журнал'), makeTool('references', 'Справочники', 'Типы, бренды и единицы'), makeTool('audit', 'Инвентаризация', 'Сверка факта с учётом')
    ]
  },
  operations: {
    title: 'Продажи / Операции', description: 'Касса, продажи, возвраты, скидки, прогнозы, задачи и контроль рисков', icon: 'shopping-cart', color: '#1f845a', soft: '#dffcf0', tools: [
      makeTool('store-police', 'Полиция магазина', 'Автодетектор отмен, скидок и расхождений'), makeTool('global-whatif', 'Глобальный «Что если»', 'Цена, поток, ФОТ, аренда и маржа'), makeTool('sales-history', 'История продаж', 'Все продажи и фильтры'), makeTool('pos', 'Касса · монитор', 'Кассовая смена в реальном времени'), makeTool('scripts', 'Скрипты продаж', 'Библиотека, конверсия и возражения'), makeTool('discounts', 'Скидки и акции', 'Активные акции и потери маржи'), makeTool('sales-top-products', 'Топ товаров', 'Лидеры по выручке и времени'), makeTool('seller-avg-check', 'Средний чек по продавцу', 'Чеки, выручка и потенциал'), makeTool('returns-report', 'Возвраты и причины', 'Реестр и доля возвратов'), makeTool('sales-forecast', 'Прогноз продаж', 'Выручка, чеки и сезонность'), makeTool('sales-whatif', 'Что если — Продажи', 'Цена, скидка, продавцы и клиенты'), makeTool('risk-control', 'Контроль рисков', 'Алерты и аномалии'), makeTool('tasks', 'Задачи / Поручения', 'Kanban и поручения из алертов'), makeTool('task-templates', 'Шаблоны процессов', 'Повторяющиеся задачи'), makeTool('task-analytics', 'Аналитика задач', 'Сроки и эффективность сотрудников'), makeTool('checklists', 'Чеклисты', 'Открытие, закрытие и фото')
    ]
  },
  hr: {
    title: 'Персонал (HR)', description: 'Сотрудники, смены, зарплата, KPI, обучение и кадровые решения', icon: 'users', color: '#6e5dc6', soft: '#f3f0ff', tools: [
      makeTool('fire-analysis', 'Анализ на увольнение', 'KEEP, WATCH и REPLACE по KPI'), makeTool('workday-map', 'Карта рабочего дня', 'Работа, рутина и простой'), makeTool('employee-health', 'Здоровье сотрудника', 'Выгорание, score и зона риска'), makeTool('hire-fire-calc', 'Калькулятор найма/увольнения', 'Окупаемость и чистый эффект'), makeTool('team-kpi', 'KPI команды', 'Продажи, смены и бонусы'), makeTool('users', 'Сотрудники', 'Роли, филиалы и доступ'), makeTool('training', 'Обучение', 'Курсы и прогресс'), makeTool('schedules', 'Расписание и смены', 'Недельный график и переработки'), makeTool('attendance', 'Табель и явка', 'Часы, опоздания и прогулы'), makeTool('absences', 'Отпуска и больничные', 'График и баланс дней'), makeTool('salaries', 'Зарплата (ФОТ)', 'Оклады, проценты и премии'), makeTool('hr-productivity', 'Производительность по часам', 'Выручка и расстановка'), makeTool('hr-adjustments', 'Штрафы и бонусы', 'Премии, штрафы и дисциплина'), makeTool('hr-forecast', 'Прогноз персонала', 'ФОТ, найм и отпуска'), makeTool('hr-whatif', 'Что если — Персонал', 'Зарплата, найм и мотивация'), makeTool('motivation', 'Мотивация', 'Лидерборд продаж'), makeTool('hr-overview', 'Картотека HR', 'Сотрудники и активность')
    ]
  },
  support: {
    title: 'Клиентский сервис', description: 'CRM, долги, сегменты, лояльность, жалобы и NPS', icon: 'contact-round', color: '#0055cc', soft: '#e9f2ff', tools: [
      makeTool('abc-clients', 'ABC клиентов', 'Парето 80/15/5 и ядро базы'), makeTool('churn', 'Отток клиентов', 'Ушедшие, риски и выручка под угрозой'), makeTool('crm', 'Клиентская база', 'Карточки клиентов и история'), makeTool('debts-clients', 'Долги клиентов', 'Кто и сколько должен'), makeTool('segmentation', 'Сегментация', 'VIP, спящие и ушедшие'), makeTool('birthdays', 'Дни рождения', 'События, поздравления и промокоды'), makeTool('referrals', 'Рефералы', 'Приведи друга, бонусы и ROI'), makeTool('client-forecast', 'Прогноз клиентов', 'Отток, переходы и рост'), makeTool('what-if-clients', 'Что если — Клиенты', 'ROI кампаний и возврат клиентов'), makeTool('complaints', 'Жалобы', 'Тикеты и разбор'), makeTool('nps', 'NPS и отзывы', 'Промоутеры, критики и отзывы')
    ]
  },
  settings: {
    title: 'Настройки', description: 'Панель, интеграции, безопасность, филиалы и журнал событий', icon: 'settings', color: '#626f86', soft: '#f1f2f4', tools: [
      makeTool('panel-manager', 'Управление панелью', 'Включение инструментов для компании'), makeTool('integrations', 'Интеграции', 'Статус подключений'), makeTool('security', 'Безопасность', 'Роли, права и доступы'), makeTool('scaling', 'Масштабирование', 'Филиалы и валюты'), makeTool('event-journal', 'Журнал событий', 'Лог действий и подозрительные события')
    ]
  }
};

const roleConfigs = {
  founder: { person: 'founder', label: 'Основатель', scope: 'Все компании и филиалы', modules: Object.keys(modules), home: ['dashboard', null] },
  director: { person: 'director', label: 'Директор', scope: 'Все подразделения', modules: Object.keys(modules), home: ['dashboard', null] },
  manager: { person: 'manager', label: 'Менеджер', scope: 'Филиал Юнусабад', modules: ['dashboard', 'analytics', 'marketing', 'procurement', 'warehouse', 'operations', 'hr', 'support'], home: ['dashboard', null] },
  cashier: { person: 'cashier', label: 'Кассир', scope: 'Касса №2 · Смена 284', modules: ['dashboard', 'operations', 'support'], home: ['operations', 'pos'] },
  seller: { person: 'seller', label: 'Продавец', scope: 'Личная воронка · Юнусабад', modules: ['dashboard', 'marketing', 'warehouse', 'operations', 'support'], home: ['support', 'crm'] }
};

const hiddenTools = {
  director: new Set(['ab-point', 'pnl', 'cashflow', 'modeling', 'fin-model', 'break-even', 'profitability', 'payment-calendar', 'currency-ops', 'taxes', 'financial-ratios', 'fin-whatif', 'cash-gap', 'global-whatif', 'panel-manager']),
  manager: new Set(['ab-point', 'pnl', 'cashflow', 'modeling', 'fin-model', 'break-even', 'profitability', 'payment-calendar', 'currency-ops', 'taxes', 'financial-ratios', 'fin-whatif', 'cash-gap', 'global-whatif', 'branch-compare', 'pricing', 'expenses-report']),
  cashier: new Set(), seller: new Set()
};

const limitedTools = {
  cashier: new Set(['pos', 'sales-history', 'returns-report', 'tasks', 'checklists', 'crm', 'complaints']),
  seller: new Set(['stock', 'min-stock-alert', 'sales-history', 'scripts', 'discounts', 'sales-top-products', 'seller-avg-check', 'tasks', 'checklists', 'leadgen', 'customer-campaigns', 'loyalty', 'crm', 'segmentation', 'birthdays', 'referrals', 'complaints', 'nps'])
};

const branches = [
  { id: 'yunusabad', name: 'Юнусабад', manager: 'Малика Рахимова', owner: 'director', revenue: '318,4 млн', plan: 102, margin: '32,1%', stock: '1,28 млрд', status: 'Стабильно' },
  { id: 'chilanzar', name: 'Чиланзар', manager: 'Алишер Каримов', owner: 'manager', revenue: '284,7 млн', plan: 94, margin: '29,8%', stock: '986 млн', status: 'Внимание' },
  { id: 'sergeli', name: 'Сергели', manager: 'Нодира Камилова', owner: 'operator', revenue: '197,2 млн', plan: 81, margin: '27,4%', stock: '742 млн', status: 'Риск' },
  { id: 'mirabad', name: 'Мирабад', manager: 'Сарвар Турсунов', owner: 'seller', revenue: '231,8 млн', plan: 98, margin: '30,6%', stock: '814 млн', status: 'Стабильно' },
  { id: 'almazar', name: 'Алмазар', manager: 'Шахноза Юсупова', owner: 'cashier', revenue: '188,6 млн', plan: 91, margin: '28,9%', stock: '621 млн', status: 'Внимание' }
];

const products = [
  { id: 1, name: 'Кофе Arabica Premium 1 кг', sku: 'CF-1004', category: 'Продукты', stock: 24, min: 12, price: 186000, cost: 129000, supplier: 'Coffee Line', icon: 'coffee' },
  { id: 2, name: 'Беспроводные наушники Pro', sku: 'EL-2408', category: 'Электроника', stock: 8, min: 10, price: 420000, cost: 286000, supplier: 'Tech Import', icon: 'headphones' },
  { id: 3, name: 'Термос Steel 700 мл', sku: 'HM-0841', category: 'Дом', stock: 17, min: 8, price: 149000, cost: 92000, supplier: 'Home Asia', icon: 'cup-soda' },
  { id: 4, name: 'Рюкзак Urban Daily', sku: 'AC-3150', category: 'Аксессуары', stock: 11, min: 7, price: 315000, cost: 210000, supplier: 'Urban Goods', icon: 'backpack' },
  { id: 5, name: 'Power Bank 20 000 mAh', sku: 'EL-2010', category: 'Электроника', stock: 6, min: 12, price: 278000, cost: 194000, supplier: 'Tech Import', icon: 'battery-charging' },
  { id: 6, name: 'Настольная LED лампа', sku: 'HM-4420', category: 'Дом', stock: 14, min: 8, price: 198000, cost: 124000, supplier: 'Home Asia', icon: 'lamp-desk' },
  { id: 7, name: 'Кабель USB-C Premium', sku: 'EL-0117', category: 'Электроника', stock: 42, min: 20, price: 78000, cost: 39000, supplier: 'Tech Import', icon: 'cable' },
  { id: 8, name: 'Чехол Laptop 14″', sku: 'AC-1414', category: 'Аксессуары', stock: 19, min: 9, price: 165000, cost: 98000, supplier: 'Urban Goods', icon: 'briefcase-business' },
  { id: 9, name: 'Чай Green Jasmine 500 г', sku: 'FD-0550', category: 'Продукты', stock: 4, min: 15, price: 124000, cost: 76000, supplier: 'Tea House', icon: 'leaf' }
];

const purchaseOrders = [
  { id: 'PO-1048', supplier: 'Tech Import', date: '13 июл', delivery: '15 июл', items: 24, amount: '86,4 млн', branch: 'Центральный склад', status: 'В пути' },
  { id: 'PO-1047', supplier: 'Coffee Line', date: '12 июл', delivery: '14 июл', items: 8, amount: '42,8 млн', branch: 'Юнусабад', status: 'К приёмке' },
  { id: 'PO-1046', supplier: 'Home Asia', date: '11 июл', delivery: '16 июл', items: 17, amount: '68,1 млн', branch: 'Чиланзар', status: 'Подтверждён' },
  { id: 'PO-1045', supplier: 'Urban Goods', date: '10 июл', delivery: '13 июл', items: 12, amount: '31,5 млн', branch: 'Сергели', status: 'Принят' },
  { id: 'PO-1044', supplier: 'Tea House', date: '9 июл', delivery: '14 июл', items: 6, amount: '18,9 млн', branch: 'Все филиалы', status: 'Задержка' },
  { id: 'PO-1043', supplier: 'Office Pro', date: '8 июл', delivery: '12 июл', items: 15, amount: '27,2 млн', branch: 'Мирабад', status: 'Принят' }
];

const transactions = [
  { id: 'TX-5841', date: '13 июл · 15:42', type: 'Приход', category: 'Продажи', account: 'Расчётный счёт', counterparty: 'Эквайринг Uzcard', amount: '18 420 000', status: 'Проведено' },
  { id: 'TX-5840', date: '13 июл · 14:18', type: 'Расход', category: 'Закупки', account: 'Расчётный счёт', counterparty: 'Tech Import', amount: '−42 000 000', status: 'Проведено' },
  { id: 'TX-5839', date: '13 июл · 13:05', type: 'Приход', category: 'B2B', account: 'Kapitalbank', counterparty: 'Orion Trade', amount: '12 400 000', status: 'Проведено' },
  { id: 'TX-5838', date: '13 июл · 11:30', type: 'Расход', category: 'Аренда', account: 'Kapitalbank', counterparty: 'Property Group', amount: '−28 500 000', status: 'Ожидает' },
  { id: 'TX-5837', date: '13 июл · 10:44', type: 'Расход', category: 'Маркетинг', account: 'Корп. карта', counterparty: 'Meta Ads', amount: '−4 800 000', status: 'Проведено' },
  { id: 'TX-5836', date: '13 июл · 09:20', type: 'Приход', category: 'Продажи', account: 'Касса Юнусабад', counterparty: 'Розничные продажи', amount: '8 760 000', status: 'Проведено' }
];

const customers = [
  { id: 'CL-2048', name: 'Orion Trade', contact: '+998 90 410 28 18', segment: 'B2B · VIP', last: 'Сегодня', revenue: '84,2 млн', debt: '0', owner: 'seller', stage: 'Переговоры' },
  { id: 'CL-2047', name: 'Абдуллаев Тимур', contact: '+998 93 520 11 06', segment: 'VIP', last: 'Сегодня', revenue: '18,6 млн', debt: '0', owner: 'seller', stage: 'Новый' },
  { id: 'CL-2046', name: 'Mega Office', contact: '+998 71 205 44 10', segment: 'B2B', last: 'Вчера', revenue: '61,4 млн', debt: '12,8 млн', owner: 'manager', stage: 'Предложение' },
  { id: 'CL-2045', name: 'Мирзаева Лола', contact: '+998 99 144 80 20', segment: 'Постоянный', last: '2 дня назад', revenue: '9,2 млн', debt: '0', owner: 'seller', stage: 'Продажа' },
  { id: 'CL-2044', name: 'Nova Group', contact: '+998 71 244 18 70', segment: 'B2B · Риск', last: '5 дней назад', revenue: '42,7 млн', debt: '18,4 млн', owner: 'director', stage: 'Просрочено' },
  { id: 'CL-2043', name: 'Хамидов Руслан', contact: '+998 90 880 12 44', segment: 'Спящий', last: '31 день назад', revenue: '6,8 млн', debt: '0', owner: 'seller', stage: 'Возврат' }
];

const employees = [
  { id: 'EMP-001', person: 'director', branch: 'Все филиалы', status: 'На работе', shift: '09:00–18:00', kpi: 96, sales: '—', salary: '18,5 млн' },
  { id: 'EMP-014', person: 'manager', branch: 'Юнусабад', status: 'На смене', shift: '08:30–18:00', kpi: 92, sales: '86,2 млн', salary: '12,8 млн' },
  { id: 'EMP-028', person: 'cashier', branch: 'Юнусабад', status: 'На смене', shift: '09:00–17:00', kpi: 94, sales: '18,4 млн', salary: '6,4 млн' },
  { id: 'EMP-031', person: 'seller', branch: 'Юнусабад', status: 'На смене', shift: '09:00–18:00', kpi: 88, sales: '42,6 млн', salary: '8,9 млн' },
  { id: 'EMP-036', person: 'operator', branch: 'Центральный склад', status: 'На работе', shift: '08:00–17:00', kpi: 97, sales: '—', salary: '7,2 млн' },
  { id: 'EMP-041', person: 'founder', branch: 'Головной офис', status: 'Онлайн', shift: 'Гибкий', kpi: 100, sales: '—', salary: '—' }
];

const sales = [
  { id: 'SALE-9831', time: '15:42', branch: 'Юнусабад', seller: 'seller', cashier: 'cashier', customer: 'Orion Trade', items: 4, amount: '1 260 000', payment: 'Карта', status: 'Оплачено' },
  { id: 'SALE-9830', time: '15:28', branch: 'Юнусабад', seller: 'seller', cashier: 'cashier', customer: 'Розничный клиент', items: 2, amount: '606 000', payment: 'Наличные', status: 'Оплачено' },
  { id: 'SALE-9829', time: '15:06', branch: 'Чиланзар', seller: 'manager', cashier: 'cashier', customer: 'Мирзаева Лола', items: 1, amount: '315 000', payment: 'QR', status: 'Оплачено' },
  { id: 'SALE-9828', time: '14:51', branch: 'Сергели', seller: 'seller', cashier: 'cashier', customer: 'Хамидов Руслан', items: 3, amount: '512 000', payment: 'Карта', status: 'Возврат' },
  { id: 'SALE-9827', time: '14:35', branch: 'Мирабад', seller: 'seller', cashier: 'cashier', customer: 'Mega Office', items: 8, amount: '12 400 000', payment: 'Счёт', status: 'Оплачено' },
  { id: 'SALE-9826', time: '14:12', branch: 'Юнусабад', seller: 'seller', cashier: 'cashier', customer: 'Розничный клиент', items: 2, amount: '464 000', payment: 'Карта', status: 'Оплачено' }
];

const campaigns = [
  { id: 'CMP-148', name: 'Возврат спящих клиентов', channel: 'Telegram + SMS', segment: '31–90 дней', budget: '8,4 млн', revenue: '31,6 млн', roi: '276%', status: 'Активна' },
  { id: 'CMP-147', name: 'Летняя электроника', channel: 'Meta Ads', segment: 'Lookalike VIP', budget: '18,2 млн', revenue: '54,8 млн', roi: '201%', status: 'Активна' },
  { id: 'CMP-146', name: 'B2B для офисов', channel: 'Lead forms', segment: 'B2B', budget: '12,5 млн', revenue: '42,7 млн', roi: '242%', status: 'Активна' },
  { id: 'CMP-145', name: 'День рождения', channel: 'SMS', segment: 'Событие', budget: '1,8 млн', revenue: '7,4 млн', roi: '311%', status: 'Авто' },
  { id: 'CMP-144', name: 'Реферальная неделя', channel: 'Telegram', segment: 'Постоянные', budget: '4,2 млн', revenue: '16,1 млн', roi: '283%', status: 'Завершена' }
];

const erpTasks = [
  { id: 'TASK-201', title: 'Подтвердить закупку кофе на 14 дней', status: 'todo', priority: 'high', owner: 'director', due: 'Сегодня' },
  { id: 'TASK-204', title: 'Разобрать отклонение плана Чиланзар', status: 'todo', priority: 'highest', owner: 'manager', due: 'Сегодня' },
  { id: 'TASK-207', title: 'Пополнить остаток наушников Pro', status: 'progress', priority: 'high', owner: 'operator', due: 'До 16:00' },
  { id: 'TASK-210', title: 'Ответить на жалобу клиента #1482', status: 'progress', priority: 'medium', owner: 'manager', due: 'Сегодня' },
  { id: 'TASK-213', title: 'Проверить кассовую смену №284', status: 'review', priority: 'high', owner: 'cashier', due: '17:00' },
  { id: 'TASK-216', title: 'Согласовать скидку Orion Trade', status: 'review', priority: 'medium', owner: 'seller', due: 'Сегодня' },
  { id: 'TASK-219', title: 'Обновить график обедов', status: 'done', priority: 'low', owner: 'manager', due: 'Готово' },
  { id: 'TASK-222', title: 'Подтвердить приёмку #1048', status: 'done', priority: 'medium', owner: 'operator', due: 'Готово' }
];

const moduleOrder = ['dashboard', 'analytics', 'finance', 'marketing', 'procurement', 'warehouse', 'operations', 'hr', 'support', 'settings'];
const storedRole = localStorage.getItem('wave-erp-role');
const initialRole = roleConfigs[storedRole] ? storedRole : 'founder';
const initialHome = roleConfigs[initialRole].home;

const state = {
  role: initialRole,
  module: initialHome[0],
  tool: initialHome[1],
  search: '',
  period: 'month',
  branch: 'all',
  density: localStorage.getItem('wave-erp-density') || 'comfortable',
  sitemapCollapsed: localStorage.getItem('wave-erp-sitemap') === 'collapsed',
  copilotOpen: window.innerWidth >= 1100 && localStorage.getItem('wave-erp-copilot') !== 'closed',
  cart: [{ productId: 1, quantity: 1 }],
  paymentMethod: 'cash',
  selectedRecord: null,
  draggedTask: null
};

const elements = {
  headerProfile: document.getElementById('headerProfile'), spaceSelector: document.getElementById('spaceSelector'), moduleNav: document.getElementById('moduleNav'), quickAccess: document.querySelector('.quick-access'), sidebarPerson: document.getElementById('sidebarPerson'), mobileModuleDock: document.getElementById('mobileModuleDock'), breadcrumbs: document.getElementById('breadcrumbs'), projectTitle: document.getElementById('projectTitle'), moduleTabs: document.getElementById('moduleTabs'), moduleToolbar: document.getElementById('moduleToolbar'), workspaceRoot: document.getElementById('workspaceRoot'), copilotPane: document.getElementById('copilotPane'), copilotBody: document.getElementById('copilotBody'), copilotForm: document.getElementById('copilotForm'), copilotInput: document.getElementById('copilotInput'), recordDrawer: document.getElementById('recordDrawer'), drawerKey: document.getElementById('drawerKey'), drawerContent: document.getElementById('drawerContent'), rolePopover: document.getElementById('rolePopover'), roleList: document.getElementById('roleList'), notificationPopover: document.getElementById('notificationPopover'), notificationList: document.getElementById('notificationList'), createLayer: document.getElementById('createLayer'), createForm: document.getElementById('createForm'), paymentLayer: document.getElementById('paymentLayer'), paymentTotal: document.getElementById('paymentTotal'), paymentMethods: document.getElementById('paymentMethods'), receivedAmount: document.getElementById('receivedAmount'), commandLayer: document.getElementById('commandLayer'), commandInput: document.getElementById('commandInput'), commandResults: document.getElementById('commandResults'), toast: document.getElementById('toast'), mobileBackdrop: document.getElementById('mobileBackdrop')
};

const icon = name => `<i data-lucide="${name}"></i>`;
const currentRole = () => roleConfigs[state.role];
const currentPerson = () => people[currentRole().person];
const currentModule = () => modules[state.module];
const money = value => `${new Intl.NumberFormat('ru-RU').format(value)} сум`;

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function accessibleModules() {
  return moduleOrder.filter(id => currentRole().modules.includes(id));
}

function visibleTools(moduleId = state.module) {
  const source = modules[moduleId]?.tools || [];
  const hidden = hiddenTools[state.role] || new Set();
  const limited = limitedTools[state.role];
  return source.filter(tool => !hidden.has(tool.id) && (!limited || limited.has(tool.id)));
}

function findTool(toolId) {
  for (const [moduleId, module] of Object.entries(modules)) {
    const tool = module.tools.find(item => item.id === toolId);
    if (tool) return { ...tool, moduleId };
  }
  return null;
}

function toolIcon(toolId) {
  if (/cash|pnl|profit|expense|payment|tax|financial|pricing|currency/.test(toolId)) return 'wallet-cards';
  if (/stock|inventory|product|barcode|eoq|reorder|safety|defect/.test(toolId)) return 'package-search';
  if (/supplier|purchase|procurement|receiv|income/.test(toolId)) return 'truck';
  if (/sale|pos|discount|return|script|basket/.test(toolId)) return 'shopping-cart';
  if (/client|crm|churn|nps|complaint|referral|loyalty|segment/.test(toolId)) return 'contact-round';
  if (/hr|user|employee|attendance|salary|schedule|training|motivation|workday/.test(toolId)) return 'users';
  if (/alert|risk|anomaly|police|audit|security/.test(toolId)) return 'shield-alert';
  if (/report|analytic|trend|forecast|funnel|cohort|unit|ssp|compare/.test(toolId)) return 'chart-no-axes-combined';
  if (/task|checklist/.test(toolId)) return 'list-checks';
  if (/setting|panel|integration|event|scaling|reference/.test(toolId)) return 'settings-2';
  return 'wrench';
}

function moduleStyles(moduleId = state.module) {
  const module = modules[moduleId];
  return `--module-color:${module.color};--module-soft:${module.soft}`;
}

function renderShell() {
  const person = currentPerson();
  const role = currentRole();
  const module = currentModule();
  const activeTool = state.tool ? findTool(state.tool) : null;

  elements.headerProfile.innerHTML = `<img src="${person.photo}" alt="${person.name}" /><div><strong>${person.name.split(' ')[0]}</strong><span>${person.role}</span></div>${icon('chevron-down')}`;
  elements.spaceSelector.innerHTML = `<button class="space-button" type="button" data-action="company-switcher"><span class="space-icon">W</span><div><strong>Wave Holding</strong><span>${role.scope}</span></div>${icon('chevron-up-down')}</button>`;
  elements.moduleNav.innerHTML = accessibleModules().map(moduleId => {
    const item = modules[moduleId];
    const count = visibleTools(moduleId).length;
    return `<button class="sidebar-link ${state.module === moduleId ? 'active' : ''}" type="button" data-module="${moduleId}" style="--module-color:${item.color}">${icon(item.icon)}<span>${item.title}</span>${count ? `<em>${count}</em>` : ''}</button>`;
  }).join('');
  const quickLinks = {
    founder: [['tasks', 'operations', 'list-checks', 'Задачи', '8'], ['alert-center', 'analytics', 'siren', 'Центр алертов', '6'], ['payment-calendar', 'finance', 'calendar-clock', 'Платежи', '']],
    director: [['tasks', 'operations', 'list-checks', 'Задачи', '8'], ['alert-center', 'analytics', 'siren', 'Центр алертов', '6'], ['stock', 'warehouse', 'package-search', 'Остатки', '17']],
    manager: [['tasks', 'operations', 'list-checks', 'Задачи', '8'], ['alert-center', 'analytics', 'siren', 'Центр алертов', '6'], ['stock', 'warehouse', 'package-search', 'Остатки', '17']],
    cashier: [['pos', 'operations', 'scan-line', 'Касса', ''], ['tasks', 'operations', 'list-checks', 'Задачи', '3'], ['complaints', 'support', 'messages-square', 'Обращения', '2']],
    seller: [['crm', 'support', 'contact-round', 'Клиенты', '24'], ['leadgen', 'marketing', 'funnel', 'Лиды', '8'], ['tasks', 'operations', 'list-checks', 'Задачи', '5']]
  }[state.role];
  elements.quickAccess.innerHTML = `<div class="sidebar-label"><span>Быстрый доступ</span><button type="button" data-action="manage-favorites" aria-label="Настроить">${icon('settings-2')}</button></div>${quickLinks.map(([toolId, moduleId, quickIcon, label, count]) => `<button class="sidebar-link compact" type="button" data-tool="${toolId}" data-module-target="${moduleId}">${icon(quickIcon)}<span>${label}</span>${count ? `<em>${count}</em>` : ''}</button>`).join('')}`;
  elements.sidebarPerson.innerHTML = `<img src="${person.photo}" alt="${person.name}" /><div><strong>${person.name}</strong><span>${role.label} · сменить роль</span></div>`;
  renderMobileDock();
  renderCopilot();

  elements.breadcrumbs.innerHTML = `<button type="button" data-module="dashboard">Wave ERP</button>${icon('chevron-right')}<button type="button" data-module="${state.module}">${module.title}</button>${activeTool ? `${icon('chevron-right')}<span>${activeTool.title}</span>` : ''}`;
  elements.projectTitle.innerHTML = `<div class="project-title-row" style="${moduleStyles()}"><span class="module-symbol">${icon(activeTool ? toolIcon(activeTool.id) : module.icon)}</span><div><span class="title-kicker">${role.label} · ${state.branch === 'all' ? 'вся компания' : branches.find(branch => branch.id === state.branch)?.name}</span><h1>${activeTool ? activeTool.title : module.title}</h1></div></div><p>${activeTool ? activeTool.description : module.description}</p>`;
  renderModuleTabs();
  renderToolbar();
  renderRoleList();
  renderNotifications();
}

function renderModuleTabs() {
  if (state.module === 'dashboard') {
    elements.moduleTabs.innerHTML = `<button class="view-tab active" type="button" data-module="dashboard">${icon('layout-dashboard')}<span>Обзор бизнеса</span></button><button class="view-tab" type="button" data-tool="founder-board" data-module-target="analytics">${icon('activity')}<span>Пульс</span></button><button class="view-tab" type="button" data-tool="tasks" data-module-target="operations">${icon('list-checks')}<span>Задачи</span></button>`;
    return;
  }
  const tools = visibleTools();
  const featuredIds = {
    analytics: ['founder-board', 'alert-center', 'branch-compare'], finance: ['cash', 'pnl', 'cashflow'], marketing: ['leadgen', 'channels', 'loyalty'], procurement: ['procurement-orders', 'receivings', 'suppliers'], warehouse: ['stock', 'inventory-mgmt', 'audit'], operations: state.role === 'cashier' ? ['pos', 'sales-history', 'returns-report'] : ['sales-history', 'pos', 'tasks'], hr: ['users', 'schedules', 'salaries'], support: ['crm', 'complaints', 'nps'], settings: ['integrations', 'security', 'event-journal']
  }[state.module] || [];
  const featured = featuredIds.map(id => tools.find(tool => tool.id === id)).filter(Boolean);
  const active = state.tool ? findTool(state.tool) : null;
  if (active && !featured.some(tool => tool.id === active.id)) featured.push(active);
  elements.moduleTabs.innerHTML = `<button class="view-tab ${!state.tool ? 'active' : ''}" type="button" data-module-overview="${state.module}">${icon('layout-grid')}<span>Обзор</span></button>${featured.map(tool => `<button class="view-tab ${state.tool === tool.id ? 'active' : ''}" type="button" data-tool="${tool.id}" data-module-target="${state.module}">${icon(toolIcon(tool.id))}<span>${tool.title}</span></button>`).join('')}<button class="view-tab" type="button" data-action="all-tools">${icon('blocks')}<span>Все инструменты · ${tools.length}</span></button>`;
}

function renderToolbar() {
  const primaryLabel = state.module === 'operations' ? 'Новая продажа' : state.module === 'warehouse' ? 'Приход товара' : state.module === 'support' ? 'Новый клиент' : state.module === 'hr' ? 'Новый сотрудник' : 'Создать';
  elements.moduleToolbar.innerHTML = `<div class="command-actions"><button class="accent-button" type="button" data-action="quick-create">${icon('plus')}<span>${primaryLabel}</span></button><button class="command-icon" type="button" data-action="refresh" title="Обновить">${icon('rotate-cw')}</button><button class="command-icon" type="button" data-action="export" title="Экспорт">${icon('square-arrow-up')}</button></div><div class="command-filters"><label class="command-search">${icon('search')}<input id="workspaceSearch" type="search" value="${state.search}" placeholder="Найти на экране" autocomplete="off" /></label><select class="command-select" id="branchSelect" aria-label="Филиал"><option value="all">Все филиалы</option>${branches.map(branch => `<option value="${branch.id}" ${state.branch === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select><select class="command-select period-select" id="periodSelect" aria-label="Период"><option value="today" ${state.period === 'today' ? 'selected' : ''}>Сегодня</option><option value="week" ${state.period === 'week' ? 'selected' : ''}>7 дней</option><option value="month" ${state.period === 'month' ? 'selected' : ''}>30 дней</option><option value="quarter" ${state.period === 'quarter' ? 'selected' : ''}>Квартал</option></select><button class="command-icon ${state.density === 'compact' ? 'active' : ''}" type="button" data-action="toggle-density" title="Плотность данных">${icon('list-filter')}</button></div>`;
}

function renderCopilot() {
  const insights = {
    founder: ['Кассовый разрыв возможен через 18 дней', 'Перенос платежа Tech Import на 7 дней сохранит положительный остаток 36 млн сум.'],
    director: ['Чиланзар отстаёт от плана на 6%', 'Основная причина — снижение среднего чека в категории электроники.'],
    manager: ['Пять SKU закончатся до поставки', 'Перемещение 18 единиц из Мирабада закроет дефицит на четыре дня.'],
    cashier: ['Три заказа ждут оплату', 'Общая сумма — 4,85 млн сум. Первый клиент ожидает 7 минут.'],
    seller: ['Три клиента требуют контакта', 'Orion Trade имеет максимальную вероятность сделки — 82%.']
  }[state.role];
  elements.copilotBody.innerHTML = `<section class="copilot-context"><span>${icon(currentModule().icon)} ${currentModule().title}</span><span>${state.branch === 'all' ? 'Все филиалы' : branches.find(branch => branch.id === state.branch)?.name}</span><span>${state.period === 'month' ? '30 дней' : state.period}</span></section><section class="copilot-brief"><span class="copilot-brief-icon">${icon('lightbulb')}</span><div><span>Главный инсайт</span><strong>${insights[0]}</strong><p>${insights[1]}</p></div></section><section class="copilot-prompts"><span>Предлагаемые вопросы</span><button type="button" data-copilot-prompt="Покажи главные риски текущего периода">${icon('shield-alert')} Главные риски</button><button type="button" data-copilot-prompt="Почему изменился результат по сравнению с прошлым периодом?">${icon('chart-spline')} Объяснить изменение</button><button type="button" data-copilot-prompt="Какие действия дадут максимальный эффект сегодня?">${icon('zap')} Следующие действия</button></section><section class="copilot-sources"><span>Источники</span><div><i></i> Продажи обновлены 1 мин назад</div><div><i></i> Склад обновлён 3 мин назад</div><div><i></i> Финансы обновлены 8 мин назад</div></section>`;
}

function renderMobileDock() {
  const configs = {
    founder: [['module', 'dashboard', 'layout-dashboard', 'Главная'], ['module', 'finance', 'landmark', 'Финансы'], ['module', 'analytics', 'chart-no-axes-combined', 'Аналитика']],
    director: [['module', 'dashboard', 'layout-dashboard', 'Главная'], ['module', 'operations', 'shopping-cart', 'Продажи'], ['module', 'warehouse', 'warehouse', 'Склад']],
    manager: [['module', 'dashboard', 'layout-dashboard', 'Главная'], ['module', 'operations', 'shopping-cart', 'Продажи'], ['module', 'warehouse', 'warehouse', 'Склад']],
    cashier: [['tool', 'pos', 'scan-line', 'Касса', 'operations'], ['tool', 'sales-history', 'receipt-text', 'Чеки', 'operations'], ['tool', 'tasks', 'list-checks', 'Задачи', 'operations']],
    seller: [['tool', 'crm', 'contact-round', 'Клиенты', 'support'], ['tool', 'sales-history', 'shopping-bag', 'Продажи', 'operations'], ['tool', 'stock', 'package-search', 'Остатки', 'warehouse']]
  }[state.role];
  elements.mobileModuleDock.innerHTML = `${configs.map(([type, id, dockIcon, label, moduleId]) => {
    const active = type === 'module' ? state.module === id : state.tool === id;
    return `<button class="mobile-dock-item ${active ? 'active' : ''}" type="button" ${type === 'module' ? `data-module="${id}"` : `data-tool="${id}" data-module-target="${moduleId}"`}>${icon(dockIcon)}<span>${label}</span></button>`;
  }).join('')}<button class="mobile-dock-item" type="button" data-action="open-mobile-menu">${icon('menu')}<span>Ещё</span></button>`;
}

function renderRoleList() {
  elements.roleList.innerHTML = Object.entries(roleConfigs).map(([roleId, config]) => {
    const person = people[config.person];
    return `<button class="role-option ${state.role === roleId ? 'active' : ''}" type="button" data-role="${roleId}"><img src="${person.photo}" alt="${person.name}" /><div><strong>${person.name}</strong><span>${config.label} · ${config.scope}</span></div>${state.role === roleId ? icon('check') : ''}</button>`;
  }).join('');
}

function renderNotifications() {
  const items = [
    ['operator', 'Остаток Power Bank ниже минимума', 'Склад · 2 минуты назад'], ['director', 'Платёж 42 млн сум ожидает подтверждения', 'Финансы · 8 минут назад'], ['manager', 'Филиал Чиланзар отстаёт от плана на 6%', 'Аналитика · 14 минут назад'], ['cashier', 'Кассовая смена №284 готова к сверке', 'Продажи · 21 минуту назад'], ['seller', 'Orion Trade открыл коммерческое предложение', 'CRM · 34 минуты назад'], ['founder', 'Прогноз кассового разрыва изменился', 'Финансы · 46 минут назад']
  ];
  elements.notificationList.innerHTML = items.map(([personId, text, meta]) => `<div class="notification-item"><img src="${people[personId].photo}" alt="${people[personId].name}" /><div><strong>${text}</strong><span>${meta}</span></div></div>`).join('');
}

function renderKpis(items) {
  const metricIcons = ['banknote', 'chart-spline', 'circle-dollar-sign', 'activity'];
  return `<section class="erp-kpi-strip">${items.map(([label, value, change, tone = 'up'], index) => `<article class="erp-kpi"><div class="erp-kpi-head"><span>${label}</span>${icon(metricIcons[index % metricIcons.length])}</div><strong>${value}</strong><footer><span class="metric-${tone}">${change}</span><span>к прошлому периоду</span></footer></article>`).join('')}</section>`;
}

function renderPanelHeader(title, subtitle, action = '') {
  return `<header class="erp-panel-header"><div class="erp-panel-title"><strong>${title}</strong><span>${subtitle}</span></div>${action}</header>`;
}

function renderBarChart() {
  const values = [[54, 39], [62, 46], [58, 43], [74, 55], [69, 51], [81, 62], [76, 58], [88, 68], [84, 64], [93, 72], [89, 70], [97, 76]];
  const labels = ['авг', 'сен', 'окт', 'ноя', 'дек', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл'];
  return `<div class="chart-area"><div class="bar-chart">${values.map(([revenue, profit]) => `<div class="bar-group"><i style="height:${revenue}%"></i><i style="height:${profit}%"></i></div>`).join('')}</div><div class="chart-labels">${labels.map(label => `<span>${label}</span>`).join('')}</div></div>`;
}

function statusTone(status) {
  if (/Стабильно|Оплачено|Проведено|Принят|Активна|Онлайн|На работе|На смене|Готово/.test(status)) return 'success';
  if (/Риск|Задержка|Просрочено|Возврат|Критично/.test(status)) return 'danger';
  if (/Внимание|Ожидает|К приёмке|Ниже min/.test(status)) return 'warning';
  return 'info';
}

function statusBadge(status) {
  return `<span class="status-badge ${statusTone(status)}">${status}</span>`;
}

function renderAttentionList() {
  const items = [
    ['triangle-alert', 'danger', 'Кассовый разрыв через 18 дней', 'Если подтвердить все платежи', '−74 млн'],
    ['package-x', 'warning', '5 SKU закончатся до поставки', 'Юнусабад и Сергели', '5 позиций'],
    ['trending-down', 'danger', 'Чиланзар ниже плана', 'Отклонение растёт третий день', '−6%'],
    ['user-round-x', 'info', '3 клиента в зоне оттока', 'Выручка под риском 24,8 млн', '3 клиента']
  ];
  return `<div class="attention-list">${items.map(([itemIcon, tone, title, subtitle, value], index) => `<div class="attention-item" data-record="ALERT-${index + 1}" data-record-type="alert"><span class="attention-icon ${tone}">${icon(itemIcon)}</span><div><strong>${title}</strong><span>${subtitle}</span></div><em>${value}</em></div>`).join('')}</div>`;
}

function renderBranchesTable() {
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Филиал</th><th>Ответственный</th><th>Выручка</th><th>План</th><th>Маржа</th><th>Здоровье</th><th>Статус</th></tr></thead><tbody>${branches.map(branch => `<tr data-record="${branch.id}" data-record-type="branch"><td><strong>${branch.name}</strong></td><td><span class="entity-cell"><img src="${people[branch.owner].photo}" alt="${people[branch.owner].name}" /><span>${branch.manager}</span></span></td><td class="money">${branch.revenue}</td><td>${branch.plan}%</td><td>${branch.margin}</td><td><span class="branch-health"><span class="health-track"><i style="width:${branch.plan}%"></i></span><span>${Math.min(100, branch.plan)}</span></span></td><td>${statusBadge(branch.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderDashboard() {
  const roleKpis = {
    founder: [['Выручка за 30 дней', '1,42 млрд', '+12,4%'], ['Валовая прибыль', '451,6 млн', '+8,7%'], ['Денежный остаток', '428 млн', '+5,2%'], ['Здоровье бизнеса', '84 / 100', '+4 пункта']],
    director: [['Выполнение плана', '94%', '+3,1%'], ['Оборот недели', '428 млн', '+5,2%'], ['Активные алерты', '6', '−2', 'up'], ['Команда на смене', '38 / 41', '92,6%']],
    manager: [['Выручка смены', '86,2 млн', '+6,1%'], ['План филиала', '102%', '+8%'], ['Остаток товара', '1,28 млрд', '+3,4%'], ['Задачи команды', '18 / 24', '75%', 'neutral']],
    cashier: [['Выручка смены', '18,4 млн', '+11%'], ['Чеки', '56', '+8'], ['Наличные', '8,7 млн', '+4,7%'], ['Ждут оплаты', '3', '4,85 млн', 'neutral']],
    seller: [['Личные продажи', '42,6 млн', '+9,4%'], ['План', '78%', '+12%'], ['Активные клиенты', '24', '+5'], ['Следующие контакты', '8', '3 сегодня', 'neutral']]
  }[state.role];
  const roleSpecific = state.role === 'cashier' ? `<section class="erp-panel">${renderPanelHeader('Последние чеки', 'Касса №2 · сегодня', '<button class="text-button" type="button" data-tool="pos" data-module-target="operations">Открыть кассу</button>')}${renderSalesTable(4)}</section>` : state.role === 'seller' ? renderPipelinePanel() : `<section class="erp-panel">${renderPanelHeader('Состояние филиалов', 'План, маржа и операционное здоровье', '<button class="text-button" type="button" data-tool="branch-compare" data-module-target="analytics">Сравнить</button>')}${renderBranchesTable()}</section>`;
  return `${renderFocusStrip()}${renderKpis(roleKpis)}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Динамика бизнеса', 'Выручка и валовая прибыль · 12 месяцев', '<div class="chart-legend"><span><i></i>Выручка</span><span><i></i>Прибыль</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Требует внимания', 'Приоритеты по влиянию на результат', '<button class="text-button" type="button" data-tool="alert-center" data-module-target="analytics">Все алерты</button>')}${renderAttentionList()}</section></div>${roleSpecific}${renderModuleMap()}`;
}

function renderFocusStrip() {
  const focus = {
    founder: ['Кассовый разрыв возможен через 18 дней', 'Проверить платёжный календарь до подтверждения закупок.', 'cash-gap', 'finance', 'Открыть прогноз'],
    director: ['До 16:00 подтвердить закупку кофе', 'Остатка хватит на четыре дня во всех филиалах.', 'procurement-orders', 'procurement', 'Открыть заказ'],
    manager: ['17 товаров находятся ниже минимума', 'Пять позиций закончатся до следующей поставки.', 'stock', 'warehouse', 'Открыть остатки'],
    cashier: ['Три заказа ожидают оплату', 'Общая сумма ожидающих заказов — 4,85 млн сум.', 'pos', 'operations', 'Перейти к кассе'],
    seller: ['Три клиента требуют контакта сегодня', 'Потенциальная выручка следующего шага — 22,4 млн сум.', 'crm', 'support', 'Открыть клиентов']
  }[state.role];
  const presence = ['director', 'manager', 'cashier', 'seller'];
  return `<section class="focus-strip"><span class="focus-icon">${icon('sparkles')}</span><div class="focus-copy"><span>Фокус дня</span><strong>${focus[0]}</strong><p>${focus[1]}</p></div><div class="focus-people">${presence.map(personId => `<img src="${people[personId].photo}" alt="${people[personId].name}" />`).join('')}<span>4 онлайн</span></div><button class="secondary-button" type="button" data-tool="${focus[2]}" data-module-target="${focus[3]}">${focus[4]} ${icon('arrow-right')}</button></section>`;
}

function renderModuleMap() {
  const available = accessibleModules().filter(id => id !== 'dashboard');
  return `<section class="tool-directory"><header class="tool-directory-header"><div><strong>Все процессы Wave ERP</strong><span>${available.length} модулей · ${available.reduce((sum, id) => sum + visibleTools(id).length, 0)} доступных инструментов для роли</span></div><span class="tool-count">${available.length}</span></header><div class="tool-grid">${available.map(moduleId => {
    const module = modules[moduleId];
    return `<button class="tool-card" type="button" data-module="${moduleId}" style="${moduleStyles(moduleId)}"><span class="tool-card-icon">${icon(module.icon)}</span><div><strong>${module.title}</strong><span>${module.description}</span></div>${icon('arrow-right')}</button>`;
  }).join('')}</div></section>`;
}

function renderToolDirectory(moduleId = state.module) {
  const module = modules[moduleId];
  const query = state.search.trim().toLowerCase();
  const tools = visibleTools(moduleId).filter(tool => !query || `${tool.title} ${tool.description}`.toLowerCase().includes(query));
  return `<section class="tool-directory" id="allTools"><header class="tool-directory-header"><div><strong>Инструменты: ${module.title}</strong><span>Рабочие окна из текущей архитектуры Wave ERP</span></div><span class="tool-count">${tools.length}</span></header><div class="tool-grid">${tools.map(tool => `<button class="tool-card" type="button" data-tool="${tool.id}" data-module-target="${moduleId}" style="${moduleStyles(moduleId)}"><span class="tool-card-icon">${icon(toolIcon(tool.id))}</span><div><strong>${tool.title}</strong><span>${tool.description}</span></div>${icon('arrow-up-right')}</button>`).join('') || '<div class="empty-state"><div><strong>Инструменты не найдены</strong><span>Измените поисковый запрос.</span></div></div>'}</div></section>`;
}

function renderModuleBanner(moduleId = state.module) {
  const module = modules[moduleId];
  return `<section class="module-overview-banner" style="${moduleStyles(moduleId)}"><span class="module-symbol">${icon(module.icon)}</span><div><strong>${module.title}: единое рабочее пространство</strong><span>${module.description}. Доступно инструментов: ${visibleTools(moduleId).length}.</span></div><button class="secondary-button" type="button" data-action="all-tools">${icon('blocks')} Все инструменты</button></section>`;
}

function renderAnalytics() {
  return `${renderKpis([['BHI бизнеса', '84 / 100', '+4 пункта'], ['Аномалии сегодня', '6', '−2'], ['Филиалов в риске', '1', 'без изменений', 'neutral'], ['Точность прогноза', '92,4%', '+1,8%']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Выручка и прогноз', 'Факт против модели · 12 месяцев', '<div class="chart-legend"><span><i></i>Факт</span><span><i></i>Прогноз</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Центр алертов', '6 активных сигналов')}${renderAttentionList()}</section></div><section class="erp-panel">${renderPanelHeader('Сравнение филиалов', 'Результат и здоровье сети')}${renderBranchesTable()}</section>${renderToolDirectory('analytics')}`;
}

function renderFinance() {
  return `${renderKpis([['Деньги на счетах', '428 млн', '+5,2%'], ['Поступления', '186,4 млн', '+8,7%'], ['Платежи', '142,8 млн', '+3,1%'], ['Свободный cash flow', '43,6 млн', '+18,2%']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Cash Flow', 'Движение денег · 30 дней', '<div class="chart-legend"><span><i></i>Приход</span><span><i></i>Расход</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Счета и кассы', 'Остатки в реальном времени')}<div class="cash-accounts"><article class="cash-account"><header><span>Kapitalbank</span>${icon('landmark')}</header><strong>284,6 млн</strong><footer>+18,4 млн сегодня</footer></article><article class="cash-account"><header><span>Кассы филиалов</span>${icon('banknote')}</header><strong>96,8 млн</strong><footer>5 открытых смен</footer></article><article class="cash-account"><header><span>Валютный счёт</span>${icon('circle-dollar-sign')}</header><strong>$3 820</strong><footer>Курс 12 640</footer></article></div></section></div><section class="erp-panel">${renderPanelHeader('Последние операции', 'Все счета и филиалы', '<button class="primary-button" type="button" data-action="quick-create">Добавить операцию</button>')}${renderTransactionsTable()}</section>${renderToolDirectory('finance')}`;
}

function renderTransactionsTable() {
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Операция</th><th>Дата</th><th>Категория</th><th>Счёт</th><th>Контрагент</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${transactions.filter(item => !state.search || `${item.id} ${item.counterparty} ${item.category}`.toLowerCase().includes(state.search.toLowerCase())).map(item => `<tr data-record="${item.id}" data-record-type="transaction"><td><strong>${item.id}</strong></td><td>${item.date}</td><td>${item.category}</td><td>${item.account}</td><td>${item.counterparty}</td><td class="money">${item.amount}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderMarketing() {
  return `${renderKpis([['Маркетинговая выручка', '152,6 млн', '+21,4%'], ['Расходы', '45,1 млн', '+8,2%'], ['Средний ROI', '238%', '+17 п.п.'], ['Новых лидов', '486', '+64']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Эффективность каналов', 'Выручка и стоимость привлечения')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Воронка лидов', 'Последние 30 дней')}<div class="generic-insight"><div class="insight-score">28%</div><div><strong>486 → 136 клиентов</strong><p>Лучший канал — Telegram referrals. Самая большая потеря происходит между предложением и оплатой.</p><button class="text-button" type="button" data-tool="loss-funnel" data-module-target="marketing">Разобрать воронку</button></div></div></section></div><section class="erp-panel">${renderPanelHeader('Кампании', 'Активные и автоматические сценарии', '<button class="primary-button" type="button" data-action="quick-create">Новая кампания</button>')}${renderCampaignsTable()}</section>${renderToolDirectory('marketing')}`;
}

function renderCampaignsTable() {
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Кампания</th><th>Канал</th><th>Сегмент</th><th>Бюджет</th><th>Выручка</th><th>ROI</th><th>Статус</th></tr></thead><tbody>${campaigns.map(item => `<tr data-record="${item.id}" data-record-type="campaign"><td><strong>${item.name}</strong><br><span class="muted-cell">${item.id}</span></td><td>${item.channel}</td><td>${item.segment}</td><td>${item.budget}</td><td class="money">${item.revenue}</td><td class="metric-up">${item.roi}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderProcurement() {
  return `${renderKpis([['Закупки в пути', '246,8 млн', '+12,1%'], ['Открытые заказы', '14', '+3'], ['Средний срок', '4,2 дня', '−0,6 дня'], ['Долг поставщикам', '118,4 млн', '+6,2%', 'down']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('План закупок', 'Объём по неделям', '<div class="chart-legend"><span><i></i>План</span><span><i></i>Факт</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Требует решения', 'Поставки и поставщики')}<div class="attention-list"><div class="attention-item" data-record="PO-1044" data-record-type="purchase"><span class="attention-icon danger">${icon('clock-alert')}</span><div><strong>Tea House задерживает поставку</strong><span>Просрочка 2 дня · 6 позиций</span></div><em>18,9 млн</em></div><div class="attention-item" data-record="PO-1048" data-record-type="purchase"><span class="attention-icon warning">${icon('package-check')}</span><div><strong>Приёмка PO-1048 завтра</strong><span>Нужно назначить комиссию</span></div><em>24 SKU</em></div><div class="attention-item" data-record="SUP-08" data-record-type="supplier"><span class="attention-icon info">${icon('badge-percent')}</span><div><strong>Новая цена Tech Import</strong><span>Рост прайса на 3,8%</span></div><em>+3,8%</em></div></div></section></div><section class="erp-panel">${renderPanelHeader('Заказы поставщикам', 'Заказано, в пути и к приёмке', '<button class="primary-button" type="button" data-action="quick-create">Новый заказ</button>')}${renderPurchasesTable()}</section>${renderToolDirectory('procurement')}`;
}

function renderPurchasesTable() {
  const items = purchaseOrders.filter(item => !state.search || `${item.id} ${item.supplier} ${item.branch}`.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Заказ</th><th>Поставщик</th><th>Создан</th><th>Поставка</th><th>Позиций</th><th>Сумма</th><th>Склад</th><th>Статус</th></tr></thead><tbody>${items.map(item => `<tr data-record="${item.id}" data-record-type="purchase"><td><strong>${item.id}</strong></td><td>${item.supplier}</td><td>${item.date}</td><td>${item.delivery}</td><td>${item.items}</td><td class="money">${item.amount}</td><td>${item.branch}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderWarehouse() {
  return `${renderKpis([['Стоимость остатков', '4,46 млрд', '+3,4%'], ['Активных SKU', '1 284', '+26'], ['Ниже минимума', '17', '+5', 'down'], ['Оборачиваемость', '38 дней', '−4 дня']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Движение запасов', 'Приход и расход · 30 дней', '<div class="chart-legend"><span><i></i>Приход</span><span><i></i>Расход</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Здоровье склада', 'Распределение SKU')}<div class="stock-health-grid"><div class="stock-health-item"><span>Норма</span><strong>1 082</strong><em class="metric-up">84,2%</em></div><div class="stock-health-item"><span>Ниже min</span><strong>17</strong><em class="metric-down">Срочно</em></div><div class="stock-health-item"><span>Перезапас</span><strong>64</strong><em class="metric-neutral">286 млн</em></div><div class="stock-health-item"><span>Мёртвый</span><strong>121</strong><em class="metric-down">412 млн</em></div></div>${renderAttentionList().replace('Кассовый разрыв через 18 дней', 'Power Bank закончится через 2 дня').replace('Чиланзар ниже плана', 'Чай Green Jasmine ниже min')}</section></div><section class="erp-panel">${renderPanelHeader('Товары и остатки', 'Все склады · актуальный учёт', '<div class="panel-actions"><button class="secondary-button" type="button" data-action="scan">Сканировать</button><button class="primary-button" type="button" data-action="quick-create">Приход товара</button></div>')}${renderProductsTable()}</section>${renderToolDirectory('warehouse')}`;
}

function productStatus(item) {
  if (item.stock <= item.min * 0.5) return 'Критично';
  if (item.stock < item.min) return 'Ниже min';
  return 'В норме';
}

function renderProductsTable() {
  const items = products.filter(item => !state.search || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Товар</th><th>SKU</th><th>Категория</th><th>Остаток</th><th>Минимум</th><th>Цена</th><th>Себестоимость</th><th>Поставщик</th><th>Статус</th></tr></thead><tbody>${items.map(item => `<tr data-record="${item.id}" data-record-type="product"><td><span class="entity-cell"><span class="entity-icon">${icon(item.icon)}</span><strong>${item.name}</strong></span></td><td>${item.sku}</td><td>${item.category}</td><td class="money">${item.stock} шт.</td><td>${item.min} шт.</td><td class="money">${money(item.price)}</td><td>${money(item.cost)}</td><td>${item.supplier}</td><td>${statusBadge(productStatus(item))}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSalesTable(limit = sales.length) {
  const items = sales.filter(item => !state.search || `${item.id} ${item.customer} ${item.branch}`.toLowerCase().includes(state.search.toLowerCase())).slice(0, limit);
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Продажа</th><th>Время</th><th>Филиал</th><th>Продавец</th><th>Клиент</th><th>Товаров</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead><tbody>${items.map(item => `<tr data-record="${item.id}" data-record-type="sale"><td><strong>${item.id}</strong></td><td>${item.time}</td><td>${item.branch}</td><td><span class="entity-cell"><img src="${people[item.seller].photo}" alt="${people[item.seller].name}" /><span>${people[item.seller].name}</span></span></td><td>${item.customer}</td><td>${item.items}</td><td class="money">${item.amount}</td><td>${item.payment}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderOperations() {
  return `${renderKpis([['Выручка сегодня', '86,2 млн', '+6,1%'], ['Чеки', '284', '+18'], ['Средний чек', '303 500', '+4,7%'], ['Возвраты', '1,8%', '−0,4%']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Продажи по часам', 'Сегодня · все филиалы', '<div class="chart-legend"><span><i></i>Выручка</span><span><i></i>Чеки</span></div>')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Операционные сигналы', 'Кассы, скидки и возвраты')}<div class="attention-list"><div class="attention-item" data-record="SALE-9828" data-record-type="sale"><span class="attention-icon danger">${icon('undo-2')}</span><div><strong>Возврат выше лимита кассира</strong><span>Сергели · требуется менеджер</span></div><em>512 000</em></div><div class="attention-item" data-record="SHIFT-284" data-record-type="shift"><span class="attention-icon warning">${icon('badge-percent')}</span><div><strong>Скидки по смене выше нормы</strong><span>Касса №2 · 8,4% чеков</span></div><em>+2,1%</em></div><div class="attention-item" data-record="TASK-204" data-record-type="task"><span class="attention-icon info">${icon('list-checks')}</span><div><strong>8 задач ожидают выполнения</strong><span>3 просрочены сегодня</span></div><em>8</em></div></div></section></div><section class="erp-panel">${renderPanelHeader('История продаж', 'Последние операции', '<button class="primary-button" type="button" data-tool="pos" data-module-target="operations">Открыть кассу</button>')}${renderSalesTable()}</section>${renderToolDirectory('operations')}`;
}

function cartTotal() {
  return state.cart.reduce((sum, line) => sum + products.find(product => product.id === line.productId).price * line.quantity, 0);
}

function renderPOS() {
  const query = state.search.trim().toLowerCase();
  const filtered = products.filter(item => !query || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(query));
  const cartLines = state.cart.map(line => ({ ...line, product: products.find(product => product.id === line.productId) }));
  const total = cartTotal();
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  return `${renderKpis([['Выручка смены', '18,4 млн', '+11%'], ['Чеки', '56', '+8'], ['Наличные', '8,7 млн', '+4,7%'], ['Ждут оплаты', '3', '4,85 млн', 'neutral']])}<section class="pos-layout"><div class="pos-catalog"><div class="pos-search-row"><label class="work-search" style="width:100%">${icon('search')}<input id="posSearch" type="search" value="${state.search}" placeholder="Название, SKU или штрихкод" /></label><button class="scan-button" type="button" data-action="scan">${icon('scan-line')}</button></div><div class="pos-categories"><button class="active" type="button">Все товары</button><button type="button">Популярные</button><button type="button">Электроника</button><button type="button">Аксессуары</button><button type="button">Дом</button><button type="button">Продукты</button></div><div class="product-grid">${filtered.map(product => `<button class="product-tile" type="button" data-product-add="${product.id}"><span class="product-icon">${icon(product.icon)}</span><strong>${product.name}</strong><footer><div><span>Остаток ${product.stock} шт.</span><b>${money(product.price)}</b></div><i>${icon('plus')}</i></footer></button>`).join('')}</div></div><aside class="pos-cart"><header class="pos-cart-header"><div><strong>Текущая продажа</strong><span>Касса №2 · ${currentPerson().name}</span></div><button class="icon-button" type="button" data-action="clear-cart">${icon('trash-2')}</button></header><div class="cart-list">${cartLines.length ? cartLines.map(line => `<div class="cart-item"><div><strong>${line.product.name}</strong><span>${money(line.product.price)} × ${line.quantity}</span></div><div><b>${money(line.product.price * line.quantity)}</b><span class="quantity-control"><button type="button" data-cart-change="${line.product.id}" data-delta="-1">${icon('minus')}</button><em>${line.quantity}</em><button type="button" data-cart-change="${line.product.id}" data-delta="1">${icon('plus')}</button></span></div></div>`).join('') : `<div class="cart-empty"><div>${icon('shopping-basket')}<strong>Корзина пуста</strong><span>Выберите товар или отсканируйте штрихкод.</span></div></div>`}</div><footer class="cart-summary"><div class="cart-summary-row"><span>Позиций</span><strong>${itemCount}</strong></div><div class="cart-summary-row"><span>Скидка</span><strong>0 сум</strong></div><div class="cart-summary-total"><span>Итого</span><strong>${money(total)}</strong></div><button class="primary-button pay-button" type="button" data-action="open-payment" ${total ? '' : 'disabled'}>${icon('credit-card')} Перейти к оплате</button></footer></aside></section><button class="mobile-cart-bar" type="button" data-action="open-payment" ${total ? '' : 'disabled'}><span><b>${itemCount} ${itemCount === 1 ? 'товар' : 'товара'}</b><small>Текущая продажа</small></span><strong>${money(total)}</strong><em>Оплатить ${icon('arrow-right')}</em></button>`;
}

function renderHR() {
  return `${renderKpis([['Сотрудников', '41', '+3'], ['На смене', '38', '92,6%'], ['ФОТ месяца', '286,4 млн', '+4,2%', 'neutral'], ['Средний KPI', '91%', '+3%']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Производительность команды', 'KPI и выручка по неделям')}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Состояние команды', 'Сегодня')}<div class="stock-health-grid"><div class="stock-health-item"><span>На смене</span><strong>38</strong><em class="metric-up">92,6%</em></div><div class="stock-health-item"><span>Опоздали</span><strong>2</strong><em class="metric-down">18 мин</em></div><div class="stock-health-item"><span>Отпуск</span><strong>2</strong><em class="metric-neutral">план</em></div><div class="stock-health-item"><span>Больничный</span><strong>1</strong><em class="metric-down">сегодня</em></div></div>${renderAttentionList().replace('Кассовый разрыв через 18 дней', '1 сотрудник в зоне выгорания').replace('5 SKU закончатся до поставки', '2 смены требуют замены')}</section></div><section class="erp-panel">${renderPanelHeader('Сотрудники', 'Роли, филиалы, KPI и выплаты', '<button class="primary-button" type="button" data-action="quick-create">Добавить сотрудника</button>')}${renderEmployeesTable()}</section>${renderToolDirectory('hr')}`;
}

function renderEmployeesTable() {
  const items = employees.filter(item => !state.search || `${item.id} ${people[item.person].name} ${item.branch}`.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Сотрудник</th><th>ID</th><th>Роль</th><th>Филиал</th><th>Смена</th><th>KPI</th><th>Продажи</th><th>Зарплата</th><th>Статус</th></tr></thead><tbody>${items.map(item => `<tr data-record="${item.id}" data-record-type="employee"><td><span class="entity-cell"><img src="${people[item.person].photo}" alt="${people[item.person].name}" /><strong>${people[item.person].name}</strong></span></td><td>${item.id}</td><td>${people[item.person].role}</td><td>${item.branch}</td><td>${item.shift}</td><td><span class="branch-health"><span class="health-track"><i style="width:${item.kpi}%"></i></span><span>${item.kpi}%</span></span></td><td>${item.sales}</td><td>${item.salary}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderPipelinePanel() {
  const stages = [['Новые', customers.filter(item => item.stage === 'Новый' || item.stage === 'Возврат')], ['В работе', customers.filter(item => item.stage === 'Переговоры')], ['Предложение', customers.filter(item => item.stage === 'Предложение')], ['Результат', customers.filter(item => ['Продажа', 'Просрочено'].includes(item.stage))]];
  return `<section class="erp-panel pipeline-panel">${renderPanelHeader('Воронка клиентов', 'Сделки и следующие действия', '<button class="primary-button" type="button" data-action="quick-create">Новый клиент</button>')}<div class="pipeline-scroll"><div class="pipeline">${stages.map(([label, items]) => `<section class="pipeline-column"><header>${label}<span>${items.length}</span></header>${items.map(item => `<button class="deal-card" type="button" data-record="${item.id}" data-record-type="customer"><strong>${item.name}</strong><span>${item.segment} · ${item.last}</span><footer><b>${item.revenue}</b><img src="${people[item.owner].photo}" alt="${people[item.owner].name}" /></footer></button>`).join('')}</section>`).join('')}</div></div></section>`;
}

function renderCRM() {
  return `${renderKpis([['Клиентов', '2 846', '+124'], ['Активные 30 дней', '1 184', '+8,2%'], ['LTV', '4,86 млн', '+6,4%'], ['Долги клиентов', '31,2 млн', '+4,1%', 'down']])}${renderPipelinePanel()}<section class="erp-panel">${renderPanelHeader('Клиентская база', 'Контакты, сегменты, история и долги', '<button class="primary-button" type="button" data-action="quick-create">Новый клиент</button>')}${renderCustomersTable()}</section>${renderToolDirectory('support')}`;
}

function renderCustomersTable() {
  const items = customers.filter(item => !state.search || `${item.id} ${item.name} ${item.segment}`.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Клиент</th><th>Контакт</th><th>Сегмент</th><th>Последний контакт</th><th>Выручка</th><th>Долг</th><th>Ответственный</th><th>Этап</th></tr></thead><tbody>${items.map(item => `<tr data-record="${item.id}" data-record-type="customer"><td><strong>${item.name}</strong><br><span class="muted-cell">${item.id}</span></td><td>${item.contact}</td><td>${item.segment}</td><td>${item.last}</td><td class="money">${item.revenue}</td><td class="${item.debt !== '0' ? 'metric-down' : ''}">${item.debt}</td><td><span class="entity-cell"><img src="${people[item.owner].photo}" alt="${people[item.owner].name}" /><span>${people[item.owner].name}</span></span></td><td>${statusBadge(item.stage)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSettings() {
  const integrations = [['Telegram', 'Уведомления и рассылки', 'Подключено'], ['Click / Payme', 'Онлайн-оплата', 'Подключено'], ['1C', 'Обмен проводками', 'Настройка'], ['Google Sheets', 'Экспорт отчётов', 'Подключено'], ['Fiscal API', 'Онлайн-касса', 'Подключено']];
  return `${renderKpis([['Пользователей', '41', '+3'], ['Ролей доступа', '5', 'актуально', 'neutral'], ['Интеграций', '12', '9 активны'], ['Событий аудита', '286', 'за 30 дней', 'neutral']])}<div class="erp-grid equal"><section class="erp-panel">${renderPanelHeader('Интеграции', 'Подключения Wave ERP')}<div class="attention-list">${integrations.map(([name, description, status], index) => `<div class="attention-item" data-record="INT-${index + 1}" data-record-type="integration"><span class="attention-icon info">${icon('plug-zap')}</span><div><strong>${name}</strong><span>${description}</span></div>${statusBadge(status)}</div>`).join('')}</div></section><section class="erp-panel">${renderPanelHeader('Роли и доступ', 'Матрица видимости инструментов')}<div class="attention-list">${Object.entries(roleConfigs).map(([roleId, config]) => `<div class="attention-item" data-record="${roleId}" data-record-type="role"><img class="activity-avatar" src="${people[config.person].photo}" alt="${people[config.person].name}" /><div><strong>${config.label}</strong><span>${config.modules.length} модулей · ${config.scope}</span></div><em>${roleId === 'founder' ? 'Все права' : 'Настроено'}</em></div>`).join('')}</div></section></div>${renderToolDirectory('settings')}`;
}

function renderTasks() {
  const statuses = [['todo', 'Нужно сделать'], ['progress', 'В работе'], ['review', 'На проверке'], ['done', 'Готово']];
  return `<div class="board-meta"><div><strong>Операционный поток</strong><span>${erpTasks.filter(item => item.status !== 'done').length} активных · ${erpTasks.filter(item => item.status === 'done').length} завершено</span></div><button class="primary-button" type="button" data-action="quick-create">${icon('plus')} Новая задача</button></div><div class="board-scroll"><section class="kanban-board">${statuses.map(([status, label]) => {
    const items = erpTasks.filter(item => item.status === status);
    return `<section class="board-column"><header class="column-header"><div class="column-title">${label}<span>${items.length}</span></div>${icon('more-horizontal')}</header><div class="board-column-body" data-task-drop="${status}">${items.map(item => `<button class="work-card" type="button" draggable="true" data-task-id="${item.id}"><span class="card-top"><span class="card-key">${item.id}</span><span class="priority ${item.priority}">${icon(item.priority === 'highest' ? 'chevrons-up' : item.priority === 'high' ? 'chevron-up' : item.priority === 'low' ? 'chevron-down' : 'equal')}</span></span><h3>${item.title}</h3><span class="card-bottom"><span class="card-signals"><span>${icon('calendar-clock')}${item.due}</span></span><img src="${people[item.owner].photo}" alt="${people[item.owner].name}" /></span></button>`).join('')}</div></section>`;
  }).join('')}</section></div>`;
}

function renderGenericTool(tool) {
  const module = modules[tool.moduleId];
  const genericRows = [
    ['REC-1048', 'Основная запись', 'Сегодня · 15:42', 'Активно', '84,6 млн'], ['REC-1047', 'Проверка показателей', 'Сегодня · 14:18', 'На проверке', '42,8 млн'], ['REC-1046', 'Плановое действие', 'Вчера · 18:05', 'Запланировано', '18,4 млн'], ['REC-1045', 'Корректировка данных', 'Вчера · 12:30', 'Завершено', '12,6 млн'], ['REC-1044', 'Новый сценарий', '12 июл · 16:10', 'Активно', '8,9 млн']
  ];
  return `<section class="tool-hero" style="${moduleStyles(tool.moduleId)}"><div><h2>${tool.title}</h2><p>${tool.description}. Инструмент подключён к единой модели данных Wave ERP и учитывает выбранный филиал и период.</p></div><button class="primary-button" type="button" data-action="quick-create">${icon('plus')} Новая запись</button></section>${renderKpis([['Активных записей', '128', '+14'], ['Результат периода', '84,6 млн', '+8,2%'], ['Требуют внимания', '6', '−2'], ['Качество данных', '96%', '+1,4%']])}<div class="erp-grid"><section class="erp-panel">${renderPanelHeader('Динамика показателя', `${tool.title} · выбранный период`)}${renderBarChart()}</section><section class="erp-panel">${renderPanelHeader('Wave Insight', 'Автоматический анализ')}<div class="generic-insight"><div class="insight-score">84</div><div><strong>Показатель в устойчивой зоне</strong><p>Wave обнаружил положительный тренд и одно отклонение, которое может повлиять на итог месяца.</p><button class="text-button" type="button" data-action="ai-help">Разобрать с Wave AI</button></div></div></section></div><section class="erp-panel">${renderPanelHeader('Рабочие данные', 'Последние записи и действия')}<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>ID</th><th>Название</th><th>Обновлено</th><th>Статус</th><th>Значение</th></tr></thead><tbody>${genericRows.map(row => `<tr data-record="${row[0]}" data-record-type="generic"><td><strong>${row[0]}</strong></td><td>${row[1]}</td><td>${row[2]}</td><td>${statusBadge(row[3])}</td><td class="money">${row[4]}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderModuleHome() {
  const module = currentModule();
  const body = {
    analytics: renderAnalytics, finance: renderFinance, marketing: renderMarketing, procurement: renderProcurement, warehouse: renderWarehouse, operations: renderOperations, hr: renderHR, support: renderCRM, settings: renderSettings
  }[state.module];
  return `${renderModuleBanner()}${body ? body() : ''}`;
}

function renderTool() {
  const tool = findTool(state.tool);
  if (!tool) return renderModuleHome();
  const custom = {
    pos: renderPOS,
    tasks: renderTasks,
    stock: renderWarehouse, 'inventory-mgmt': renderWarehouse, 'min-stock-alert': renderWarehouse, audit: renderWarehouse,
    'procurement-orders': renderProcurement, suppliers: renderProcurement, income: renderProcurement, receivings: renderProcurement,
    cash: renderFinance, cashflow: renderFinance, pnl: renderFinance, 'payment-calendar': renderFinance, 'expenses-report': renderFinance,
    crm: renderCRM, 'debts-clients': renderCRM, complaints: renderCRM, nps: renderCRM,
    users: renderHR, 'team-kpi': renderHR, schedules: renderHR, attendance: renderHR, salaries: renderHR,
    'founder-board': renderAnalytics, 'branch-compare': renderAnalytics, 'alert-center': renderAnalytics,
    'sales-history': renderOperations, 'sales-top-products': renderOperations, 'seller-avg-check': renderOperations, 'returns-report': renderOperations,
    leadgen: renderMarketing, channels: renderMarketing, loyalty: renderMarketing,
    integrations: renderSettings, security: renderSettings, 'event-journal': renderSettings, scaling: renderSettings
  }[tool.id];
  return custom ? custom() : renderGenericTool(tool);
}

function renderWorkspace() {
  elements.workspaceRoot.innerHTML = state.module === 'dashboard' ? renderDashboard() : state.tool ? renderTool() : renderModuleHome();
  elements.workspaceRoot.style.cssText = moduleStyles();
  refreshIcons();
}

function renderApp() {
  document.body.classList.toggle('compact-density', state.density === 'compact');
  document.body.classList.toggle('sitemap-collapsed', state.sitemapCollapsed);
  document.body.classList.toggle('copilot-collapsed', !state.copilotOpen);
  renderShell();
  renderWorkspace();
  refreshIcons();
}

function setModule(moduleId, toolId = null) {
  if (!currentRole().modules.includes(moduleId)) {
    showToast('Этот модуль недоступен для текущей роли');
    return;
  }
  state.module = moduleId;
  state.tool = toolId;
  state.search = '';
  closeDrawer();
  closeSidebar();
  closeOverlays();
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setTool(toolId, moduleId) {
  const found = findTool(toolId);
  const targetModule = moduleId || found?.moduleId;
  if (!found || !targetModule || !visibleTools(targetModule).some(tool => tool.id === toolId)) {
    showToast('Инструмент недоступен для текущей роли');
    return;
  }
  setModule(targetModule, toolId);
}

function switchRole(roleId) {
  if (!roleConfigs[roleId]) return;
  state.role = roleId;
  [state.module, state.tool] = roleConfigs[roleId].home;
  state.search = '';
  state.cart = [{ productId: 1, quantity: 1 }];
  localStorage.setItem('wave-erp-role', roleId);
  closeOverlays();
  closeDrawer();
  closeSidebar();
  renderApp();
  showToast(`Открыто рабочее место: ${roleConfigs[roleId].label}`);
}

function findRecord(type, id) {
  const sources = { product: products, purchase: purchaseOrders, transaction: transactions, customer: customers, employee: employees, sale: sales, campaign: campaigns, branch: branches, task: erpTasks };
  const source = sources[type];
  if (!source) return { id, name: id, status: 'Активно', description: 'Рабочая запись Wave ERP' };
  return source.find(item => String(item.id) === String(id)) || { id, name: id, status: 'Активно' };
}

function recordTitle(type, record) {
  return record.name || record.title || record.supplier || record.counterparty || record.customer || record.id;
}

function openRecord(type, id) {
  const record = findRecord(type, id);
  state.selectedRecord = { type, id };
  const title = recordTitle(type, record);
  const readable = Object.entries(record).filter(([key]) => !['photo', 'person', 'owner', 'seller', 'cashier'].includes(key)).slice(0, 8);
  elements.drawerKey.innerHTML = `<span class="issue-type-icon">${icon(type === 'product' ? 'package' : type === 'customer' ? 'contact-round' : type === 'employee' ? 'user-round' : 'file-text')}</span><span>${record.id || id}</span>`;
  elements.drawerContent.innerHTML = `<div class="process-flow"><div class="complete"><i>${icon('check')}</i><span>Создано</span></div><div class="complete"><i>${icon('check')}</i><span>Проверка</span></div><div class="active"><i>3</i><span>В работе</span></div><div><i>4</i><span>Закрыто</span></div></div><h2 class="drawer-title">${title}</h2><p class="drawer-description">Детальная карточка записи из модуля «${currentModule().title}». Все изменения синхронизируются между связанными процессами ERP.</p><div class="drawer-data-grid">${readable.map(([key, value]) => `<div class="drawer-data-item"><span>${key.replace(/_/g, ' ')}</span><strong>${value}</strong></div>`).join('')}</div><div class="drawer-timeline"><div class="drawer-timeline-item"><i>${icon('plus')}</i><div><strong>Запись создана</strong><span>Система · 12 июля, 09:14</span></div></div><div class="drawer-timeline-item"><i>${icon('pencil')}</i><div><strong>Данные обновлены</strong><span>${currentPerson().name} · сегодня, 14:28</span></div></div><div class="drawer-timeline-item"><i>${icon('link-2')}</i><div><strong>Связанные документы синхронизированы</strong><span>Wave ERP · сейчас</span></div></div></div>`;
  elements.recordDrawer.classList.add('open');
  elements.recordDrawer.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closeDrawer() {
  elements.recordDrawer.classList.remove('open');
  elements.recordDrawer.setAttribute('aria-hidden', 'true');
  state.selectedRecord = null;
}

function changeCart(productId, delta) {
  const line = state.cart.find(item => item.productId === productId);
  if (!line && delta > 0) state.cart.push({ productId, quantity: 1 });
  else if (line) {
    line.quantity += delta;
    if (line.quantity <= 0) state.cart = state.cart.filter(item => item.productId !== productId);
  }
  renderWorkspace();
}

function openPayment() {
  const total = cartTotal();
  if (!total) return showToast('Добавьте товары в корзину');
  elements.paymentTotal.textContent = money(total);
  elements.receivedAmount.value = new Intl.NumberFormat('ru-RU').format(total);
  elements.paymentMethods.innerHTML = [['cash', 'banknote', 'Наличные'], ['card', 'credit-card', 'Карта'], ['qr', 'qr-code', 'QR']].map(([id, methodIcon, label]) => `<button class="payment-method ${state.paymentMethod === id ? 'active' : ''}" type="button" data-payment-method="${id}">${icon(methodIcon)}<span>${label}</span></button>`).join('');
  elements.paymentLayer.classList.add('open');
  elements.paymentLayer.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function completePayment() {
  const total = cartTotal();
  if (!total) return;
  sales.unshift({ id: `SALE-${9832 + sales.length}`, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), branch: 'Юнусабад', seller: 'seller', cashier: 'cashier', customer: 'Розничный клиент', items: state.cart.reduce((sum, item) => sum + item.quantity, 0), amount: new Intl.NumberFormat('ru-RU').format(total), payment: { cash: 'Наличные', card: 'Карта', qr: 'QR' }[state.paymentMethod], status: 'Оплачено' });
  state.cart = [];
  closePayment();
  renderWorkspace();
  showToast(`Продажа на ${money(total)} завершена`);
}

function closePayment() {
  elements.paymentLayer.classList.remove('open');
  elements.paymentLayer.setAttribute('aria-hidden', 'true');
}

function togglePopover(element) {
  const shouldOpen = !element.classList.contains('open');
  closePopovers();
  if (shouldOpen) {
    element.classList.add('open');
    element.setAttribute('aria-hidden', 'false');
  }
}

function closePopovers() {
  [elements.rolePopover, elements.notificationPopover].forEach(element => {
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');
  });
}

function openCreate(type = '') {
  closePopovers();
  elements.createLayer.classList.add('open');
  elements.createLayer.setAttribute('aria-hidden', 'false');
  if (type) elements.createForm.elements.type.value = type;
  setTimeout(() => elements.createForm.elements.title.focus(), 30);
}

function closeOverlays() {
  closePopovers();
  [elements.createLayer, elements.commandLayer].forEach(element => {
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');
  });
  closePayment();
}

function openCommand() {
  closePopovers();
  elements.commandLayer.classList.add('open');
  elements.commandLayer.setAttribute('aria-hidden', 'false');
  elements.commandInput.value = '';
  renderCommandResults('');
  setTimeout(() => elements.commandInput.focus(), 30);
}

function renderCommandResults(query) {
  const normalized = query.trim().toLowerCase();
  const moduleResults = accessibleModules().filter(moduleId => !normalized || modules[moduleId].title.toLowerCase().includes(normalized));
  const toolResults = accessibleModules().flatMap(moduleId => visibleTools(moduleId).map(tool => ({ ...tool, moduleId }))).filter(tool => !normalized || `${tool.title} ${tool.description}`.toLowerCase().includes(normalized)).slice(0, 10);
  elements.commandResults.innerHTML = `<span class="command-group-label">Быстрые действия</span><button class="command-result" type="button" data-command-action="quick-create">${icon('plus')}<div><strong>Добавить операцию</strong><span>Продажа, приход, расход, клиент или задача</span></div><em>Создать</em></button>${moduleResults.length ? `<span class="command-group-label">Модули</span>${moduleResults.slice(0, 6).map(moduleId => `<button class="command-result" type="button" data-command-module="${moduleId}">${icon(modules[moduleId].icon)}<div><strong>${modules[moduleId].title}</strong><span>${modules[moduleId].description}</span></div><em>${visibleTools(moduleId).length}</em></button>`).join('')}` : ''}${toolResults.length ? `<span class="command-group-label">Инструменты</span>${toolResults.map(tool => `<button class="command-result" type="button" data-command-tool="${tool.id}" data-module-target="${tool.moduleId}">${icon(toolIcon(tool.id))}<div><strong>${tool.title}</strong><span>${modules[tool.moduleId].title} · ${tool.description}</span></div><em>Открыть</em></button>`).join('')}` : ''}`;
  refreshIcons();
}

function createRecord(formData) {
  const type = String(formData.get('type'));
  const title = String(formData.get('title') || '').trim();
  if (!title) return;
  if (type === 'customer') customers.unshift({ id: `CL-${2050 + customers.length}`, name: title, contact: 'Контакт не указан', segment: 'Новый', last: 'Сейчас', revenue: '0', debt: '0', owner: currentRole().person, stage: 'Новый' });
  if (type === 'task') erpTasks.unshift({ id: `TASK-${230 + erpTasks.length}`, title, status: 'todo', priority: 'medium', owner: currentRole().person, due: 'Сегодня' });
  if (type === 'expense') transactions.unshift({ id: `TX-${5850 + transactions.length}`, date: 'Сейчас', type: 'Расход', category: title, account: 'Расчётный счёт', counterparty: title, amount: `−${formData.get('amount') || '0'}`, status: 'Ожидает' });
  elements.createForm.reset();
  closeOverlays();
  renderApp();
  showToast(`Операция «${title}» сохранена`);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.querySelector('span').textContent = message;
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2400);
}

function openSidebar() { document.body.classList.add('sidebar-open'); }
function closeSidebar() { document.body.classList.remove('sidebar-open'); }

document.addEventListener('click', event => {
  const target = event.target;
  const moduleButton = target.closest('[data-module]');
  if (moduleButton) { event.preventDefault(); setModule(moduleButton.dataset.module); return; }

  const overviewButton = target.closest('[data-module-overview]');
  if (overviewButton) { setModule(overviewButton.dataset.moduleOverview); return; }

  const toolButton = target.closest('[data-tool]');
  if (toolButton) { setTool(toolButton.dataset.tool, toolButton.dataset.moduleTarget); return; }

  const productButton = target.closest('[data-product-add]');
  if (productButton) { changeCart(Number(productButton.dataset.productAdd), 1); return; }

  const cartButton = target.closest('[data-cart-change]');
  if (cartButton) { changeCart(Number(cartButton.dataset.cartChange), Number(cartButton.dataset.delta)); return; }

  const paymentMethod = target.closest('[data-payment-method]');
  if (paymentMethod) { state.paymentMethod = paymentMethod.dataset.paymentMethod; openPayment(); return; }

  const record = target.closest('[data-record]');
  if (record) { openRecord(record.dataset.recordType, record.dataset.record); return; }

  const taskCard = target.closest('[data-task-id]');
  if (taskCard && !state.draggedTask) { openRecord('task', taskCard.dataset.taskId); return; }

  const roleButton = target.closest('[data-role]');
  if (roleButton) { switchRole(roleButton.dataset.role); return; }

  const commandModule = target.closest('[data-command-module]');
  if (commandModule) { closeOverlays(); setModule(commandModule.dataset.commandModule); return; }

  const commandTool = target.closest('[data-command-tool]');
  if (commandTool) { closeOverlays(); setTool(commandTool.dataset.commandTool, commandTool.dataset.moduleTarget); return; }

  const commandAction = target.closest('[data-command-action]');
  if (commandAction) { closeOverlays(); openCreate(); return; }

  if (target.closest('#mobileMenu')) { openSidebar(); return; }
  if (target.closest('#mobileBackdrop')) { closeSidebar(); return; }
  if (target.closest('#notificationTrigger')) { togglePopover(elements.notificationPopover); return; }

  const copilotPrompt = target.closest('[data-copilot-prompt]');
  if (copilotPrompt) {
    elements.copilotInput.value = copilotPrompt.dataset.copilotPrompt;
    elements.copilotInput.focus();
    return;
  }

  const actionButton = target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'open-roles') return togglePopover(elements.rolePopover);
    if (['open-command', 'module-launcher'].includes(action)) return openCommand();
    if (action === 'quick-create') return openCreate();
    if (action === 'close-modal') return closeOverlays();
    if (action === 'open-payment') return openPayment();
    if (action === 'close-payment') return closePayment();
    if (action === 'complete-payment') return completePayment();
    if (action === 'clear-cart') { state.cart = []; renderWorkspace(); return; }
    if (action === 'close-drawer') return closeDrawer();
    if (action === 'close-popovers') return closePopovers();
    if (action === 'all-tools') { document.getElementById('allTools')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (action === 'toggle-density') {
      state.density = state.density === 'compact' ? 'comfortable' : 'compact';
      localStorage.setItem('wave-erp-density', state.density);
      renderApp();
      return showToast(state.density === 'compact' ? 'Включена компактная плотность' : 'Включена комфортная плотность');
    }
    if (action === 'toggle-sitemap') {
      state.sitemapCollapsed = !state.sitemapCollapsed;
      localStorage.setItem('wave-erp-sitemap', state.sitemapCollapsed ? 'collapsed' : 'open');
      renderApp();
      return;
    }
    if (action === 'toggle-copilot') {
      state.copilotOpen = !state.copilotOpen;
      localStorage.setItem('wave-erp-copilot', state.copilotOpen ? 'open' : 'closed');
      renderApp();
      return;
    }
    if (action === 'open-mobile-menu') return openSidebar();
    if (action === 'export') return showToast('Отчёт подготовлен к экспорту');
    if (action === 'refresh') { renderApp(); return showToast('Данные обновлены'); }
    if (action === 'ai-help') return showToast('Wave AI подготовил краткий анализ и 3 рекомендации');
    if (action === 'scan') return showToast('Сканер штрихкодов активирован');
    if (action === 'copy-link') return showToast('Ссылка скопирована');
    if (action === 'drawer-edit') return showToast('Карточка открыта для редактирования');
    if (action === 'read-all') { closePopovers(); return showToast('Все события прочитаны'); }
    if (action === 'share') return showToast('Ссылка на рабочее представление скопирована');
    if (['advanced-filter', 'company-switcher', 'manage-favorites', 'manage-navigation', 'more'].includes(action)) return showToast('Настройки доступны в интерактивном прототипе');
  }

  if (!target.closest('.popover')) closePopovers();
});

document.addEventListener('input', event => {
  if (event.target.matches('#workspaceSearch, #posSearch')) {
    state.search = event.target.value;
    renderWorkspace();
    const nextInput = document.getElementById(event.target.id);
    if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(state.search.length, state.search.length); }
  }
  if (event.target === elements.commandInput) renderCommandResults(event.target.value);
});

document.addEventListener('change', event => {
  if (event.target.id === 'branchSelect') { state.branch = event.target.value; showToast('Филиал изменён'); }
  if (event.target.id === 'periodSelect') { state.period = event.target.value; showToast('Период обновлён'); }
});

elements.createForm.addEventListener('submit', event => {
  event.preventDefault();
  createRecord(new FormData(event.currentTarget));
});

elements.copilotForm.addEventListener('submit', event => {
  event.preventDefault();
  const question = elements.copilotInput.value.trim();
  if (!question) return;
  elements.copilotBody.insertAdjacentHTML('beforeend', `<div class="copilot-message user"><span>${question}</span></div><div class="copilot-message assistant"><span class="copilot-mark">${icon('sparkles')}</span><div><strong>Wave Copilot</strong><p>Я проанализировал текущий модуль и выбранный период. Главный приоритет — действие с наибольшим финансовым влиянием; соответствующая запись уже выделена в рабочей области.</p></div></div>`);
  elements.copilotInput.value = '';
  elements.copilotBody.scrollTop = elements.copilotBody.scrollHeight;
  refreshIcons();
});

document.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-task-id]');
  if (!card) return;
  state.draggedTask = card.dataset.taskId;
  card.classList.add('dragging');
  event.dataTransfer.setData('text/plain', state.draggedTask);
});

document.addEventListener('dragend', event => {
  event.target.closest('[data-task-id]')?.classList.remove('dragging');
  document.querySelectorAll('.board-column').forEach(column => column.classList.remove('drag-over'));
  setTimeout(() => { state.draggedTask = null; }, 0);
});

document.addEventListener('dragover', event => {
  const dropZone = event.target.closest('[data-task-drop]');
  if (!dropZone) return;
  event.preventDefault();
  dropZone.closest('.board-column')?.classList.add('drag-over');
});

document.addEventListener('drop', event => {
  const dropZone = event.target.closest('[data-task-drop]');
  if (!dropZone) return;
  event.preventDefault();
  const id = event.dataTransfer.getData('text/plain') || state.draggedTask;
  const task = erpTasks.find(item => item.id === id);
  if (task) task.status = dropZone.dataset.taskDrop;
  renderWorkspace();
  showToast(`${id} перемещена`);
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommand(); }
  if (event.key === 'Escape') { closeOverlays(); closePopovers(); closeDrawer(); closeSidebar(); }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 820) closeSidebar();
  if (window.innerWidth < 900 && state.copilotOpen) {
    state.copilotOpen = false;
    document.body.classList.add('copilot-collapsed');
  }
});

renderApp();
