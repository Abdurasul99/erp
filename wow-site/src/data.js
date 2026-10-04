// Тарифы и раскладка инструментов.
// ВАЖНО: список инструментов — не маркетинговая выдумка, а реальные разделы
// системы (frontend/src/owner/modules.js, 80 инструментов, 115 экранов).
// Если в продукте появился новый инструмент — добавьте его сюда же, иначе сайт
// начнёт обещать не то, что открывается у клиента.

export const APP_URL = 'https://mywarehouse.uz';
export const DEMO_URL = 'https://mywarehouse.uz/store';
export const CONTACT_TG = 'https://t.me/wowcombinator';
export const CONTACT_PHONE = '+998 (71) 200-00-00';

export const YEAR_DISCOUNT = 0.2;  // −20% при оплате за год

export const TIERS = [
  {
    id: 'start',
    name: 'Старт',
    price: 990000,
    tagline: 'Одна точка. Приход, продажи, склад, касса.',
    forWhom: 'Магазин или склад, который ведёт учёт в тетради и Excel',
    branches: '1 филиал',
    users: 'Пользователи без ограничений',
    tools: 22,
    highlights: [
      'Приход товара от поставщика с ценами и долгом',
      'Товары и остатки: каталог, фото, штрих-коды, печать ценников',
      'Продажа со сканера — с телефона продавца',
      'Касса: приход, расход, сдача смены, Z-отчёт',
      'Долги клиентов и напоминания',
      'Мобильные окна для продавца, кассира и складовщика',
    ],
  },
  {
    id: 'business',
    name: 'Бизнес',
    price: 2900000,
    popular: true,
    tagline: 'Деньги под контролем: закупки, финансы, клиенты, задачи.',
    forWhom: 'Сеть из 2–3 точек, где владелец уже не успевает всё держать в голове',
    branches: 'до 3 филиалов',
    users: 'Пользователи без ограничений',
    tools: 50,
    highlights: [
      'Всё из «Старта»',
      'Закупки: поставщики, заказы, приёмка, возвраты, долги',
      'Финансы: P&L, денежный поток, расходы, ценообразование',
      'Клиенты: база, сегменты, дни рождения, отзывы',
      'Задачи и поручения сотрудникам с историей статусов',
      'Отчёты и тренды: что выросло, что просело, что делать',
    ],
  },
  {
    id: 'pro',
    name: 'Профи',
    price: 5900000,
    tagline: 'Люди, маркетинг и аналитика. Плюс ИИ на ваших данных.',
    forWhom: 'Сеть 4–10 точек со штатом, планом продаж и рекламным бюджетом',
    branches: 'до 10 филиалов',
    users: 'Пользователи без ограничений',
    tools: 72,
    highlights: [
      'Всё из «Бизнеса»',
      'Персонал: смены, табель, зарплата, штрафы и бонусы, обучение',
      'Маркетинг: воронка, каналы и ROI, LTV, лояльность, рассылки',
      'Аналитика: ABC/XYZ, когорты, юнит-экономика, сравнение филиалов',
      'ИИ-помощник: спрашиваете словами — отвечает по вашим цифрам',
      'Центр контроля: аномалии, риски, «полиция магазина»',
    ],
  },
  {
    id: 'corp',
    name: 'Корпоративный',
    price: 12000000,
    tagline: 'Вся система без ограничений и живой человек на вашей стороне.',
    forWhom: 'Сеть от 10 точек, дистрибуция, несколько юрлиц и валют',
    branches: 'Филиалы без ограничений',
    users: 'Пользователи без ограничений',
    tools: 80,
    highlights: [
      'Всё из «Профи»',
      'Стратегия: ССП, финансовая модель, симулятор «что если»',
      'Налоги, валютные операции, мультивалютная касса',
      'Интеграции и доступ к API',
      'Выделенный менеджер, обучение команды, SLA на ответ',
      'Приоритет в доработках под ваши процессы',
    ],
  },
];

// Матрица: раздел системы × тариф. Значения: true | false | строка-примечание.
// Названия разделов и инструментов совпадают с меню продукта.
export const MATRIX = [
  {
    section: 'Склад',
    items: [
      { name: 'Товары и остатки, фото, штрих-коды', start: true, business: true, pro: true, corp: true },
      { name: 'Печать ценников и этикеток', start: true, business: true, pro: true, corp: true },
      { name: 'Инвентаризация', start: true, business: true, pro: true, corp: true },
      { name: 'Брак и списание', start: true, business: true, pro: true, corp: true },
      { name: 'Движение товара, оборачиваемость', start: false, business: true, pro: true, corp: true },
      { name: 'ABC/XYZ-анализ, расчёт запасов, ROI закупки', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Продажи и касса',
    items: [
      { name: 'Продажа со сканера, история продаж', start: true, business: true, pro: true, corp: true },
      { name: 'Касса: приход, расход, сдача смены, Z-отчёт', start: true, business: true, pro: true, corp: true },
      { name: 'Скидочная политика по цветам (зелёный/жёлтый/красный)', start: true, business: true, pro: true, corp: true },
      { name: 'Возвраты и причины, топ товаров, средний чек', start: false, business: true, pro: true, corp: true },
      { name: 'Прогноз продаж, скрипты продаж', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Закупки',
    items: [
      { name: 'Приход товара от поставщика', start: true, business: true, pro: true, corp: true },
      { name: 'Поставщики, заказы, приёмка, возвраты', start: false, business: true, pro: true, corp: true },
      { name: 'Долги поставщикам, платёжный календарь', start: false, business: true, pro: true, corp: true },
      { name: 'Прогноз закупок, оценка поставщиков', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Финансы',
    items: [
      { name: 'Долги клиентов', start: true, business: true, pro: true, corp: true },
      { name: 'P&L, денежный поток, отчёт расходов', start: false, business: true, pro: true, corp: true },
      { name: 'Ценообразование и маржа', start: false, business: true, pro: true, corp: true },
      { name: 'Точка безубыточности, прогноз кассы', start: false, business: false, pro: true, corp: true },
      { name: 'Финансовая модель, налоги, валютные операции', start: false, business: false, pro: false, corp: true },
    ],
  },
  {
    section: 'Клиенты',
    items: [
      { name: 'Клиентская база', start: true, business: true, pro: true, corp: true },
      { name: 'Сегменты, дни рождения, отзывы и жалобы', start: false, business: true, pro: true, corp: true },
      { name: 'Рефералы, прогноз клиентов, LTV', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Задачи и люди',
    items: [
      { name: 'Задачи и поручения сотрудникам', start: false, business: true, pro: true, corp: true },
      { name: 'Ролевой дашборд: свои дела, зарплата, нарушения', start: false, business: true, pro: true, corp: true },
      { name: 'Смены, табель, отпуска', start: false, business: false, pro: true, corp: true },
      { name: 'Зарплата (ФОТ), штрафы и бонусы, обучение', start: false, business: false, pro: true, corp: true },
      { name: 'HR-аналитика, производительность, прогноз персонала', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Маркетинг',
    items: [
      { name: 'Воронка продаж и лиды', start: false, business: false, pro: true, corp: true },
      { name: 'Каналы и ROI, LTV, лояльность', start: false, business: false, pro: true, corp: true },
      { name: 'Рассылки клиентам, конструктор контента', start: false, business: false, pro: true, corp: true },
      { name: 'Зеркало конкурентов, анализ ЦА', start: false, business: false, pro: true, corp: true },
    ],
  },
  {
    section: 'Аналитика и управление',
    items: [
      { name: 'Отчёты и тренды за период', start: false, business: true, pro: true, corp: true },
      { name: 'Сравнение филиалов, индекс здоровья бизнеса', start: false, business: true, pro: true, corp: true },
      { name: 'Центр контроля: алерты, аномалии, риски', start: false, business: false, pro: true, corp: true },
      { name: 'Когорты, анализ корзины, юнит-экономика, A/B точка', start: false, business: false, pro: true, corp: true },
      { name: 'ССП, стратегия 3 года, симулятор «что если»', start: false, business: false, pro: false, corp: true },
    ],
  },
  {
    section: 'ИИ-помощник',
    items: [
      { name: 'Диагноз «где у меня проблемы»: где → кто → что → почему → как решить', start: false, business: false, pro: true, corp: true },
      { name: 'Чат по вашим цифрам с графиками', start: false, business: false, pro: true, corp: true },
      { name: 'Подсказки и советы на Главной', start: false, business: 'базовые', pro: true, corp: true },
    ],
  },
  {
    section: 'Платформа',
    items: [
      { name: 'Мобильные окна: продавец, кассир, складовщик', start: true, business: true, pro: true, corp: true },
      { name: 'Два языка: русский и узбекский', start: true, business: true, pro: true, corp: true },
      { name: 'Права по ролям, журнал действий, одна сессия на устройство', start: true, business: true, pro: true, corp: true },
      { name: 'Витрина заказов с сайта', start: false, business: true, pro: true, corp: true },
      { name: 'Интеграции и API', start: false, business: false, pro: false, corp: true },
      { name: 'Выделенный менеджер, обучение, SLA', start: false, business: false, pro: false, corp: true },
    ],
  },
];

// Рынок: цены с публичных сайтов (август 2026). Показываем честно — это снимает
// возражение «а Billz дешевле» до того, как клиент его произнёс.
export const MARKET = [
  { name: 'Кассовые программы', price: '99 000 – 520 000', what: 'Пробить чек, остаток по складу', erp: false },
  { name: 'Billz Start / Advanced / Pro', price: '299 000 / 499 000 / 999 000', what: 'Розница: касса, склад, лояльность', erp: false },
  { name: 'МойСклад · CloudShop', price: 'до 1 097 600 / 2 187 000', what: 'Складской и торговый учёт', erp: false },
  { name: 'Wave', price: '990 000 – 12 000 000', what: 'Склад, финансы, персонал, маркетинг, аналитика, ИИ', erp: true, us: true },
  { name: '1С:ERP', price: '157 732 000 разово за 1 пользователя + внедрение', what: 'Полноценная ERP', erp: true },
];

export const FAQ = [
  {
    q: 'Чем это отличается от кассовой программы за 300 тысяч?',
    a: 'Касса отвечает на вопрос «сколько пробили». Wave отвечает на вопросы «сколько заработали», «где деньги застряли», «кто из продавцов тянет вниз», «что закупать на следующей неделе». Это 80 инструментов вместо одного экрана продажи, и мобильные окна для каждой роли — продавец, кассир, складовщик работают с телефона.',
  },
  {
    q: 'Сколько занимает запуск?',
    a: 'Открываем доступ в день оплаты. Заводим компанию, филиалы и сотрудников, загружаем товары — обычно 1–3 дня вместе с вами. Внедрения на месяцы, как у больших ERP, здесь нет.',
  },
  {
    q: 'А если у нас уже есть учёт в Excel или другой программе?',
    a: 'Загружаем остатки и справочники, дальше работаете в системе. Excel останется для того, для чего он и нужен — разовых расчётов.',
  },
  {
    q: 'Данные наши или ваши?',
    a: 'Ваши. Выгрузка по запросу в любой момент. Доступ разграничен по ролям: менеджер видит только свой филиал, оператор платформы не видит ваши финансы вообще — это ограничение зашито на сервере, а не нарисовано в интерфейсе.',
  },
  {
    q: 'Что если через полгода мы вырастем?',
    a: 'Переходите на следующий тариф в тот же день — данные остаются, просто открываются новые разделы. Обратно тоже можно.',
  },
  {
    q: 'Есть тестовый период?',
    a: 'Да, 7 дней на реальных данных вашего магазина, без оплаты и без карты.',
  },
];

export const STEPS = [
  { n: '1', title: 'Показываем систему', text: 'Созвон 30 минут: смотрим ваши процессы и говорим прямо, поможет ли Wave. Если не поможет — скажем сразу.' },
  { n: '2', title: 'Заводим вашу компанию', text: 'Филиалы, сотрудники, роли, товары и остатки. Обучаем команду на их же экранах — продавца на телефоне, кассира на кассе.' },
  { n: '3', title: 'Работаете и смотрите цифры', text: 'Через месяц вместе разбираем первый отчёт: что выросло, что просело и что с этим делать.' },
];
