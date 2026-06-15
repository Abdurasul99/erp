import { useContext } from 'react';
import { LangContext } from '../App.jsx';
import { TOOLS_UZ } from './tt_tools.js';

// Owner-shell перевод: ключ = русская строка, значение = узбекская (латиница).
// Если перевода нет — показываем русский (graceful fallback). Это позволяет
// переводить постепенно по файлам без поломки ключей.
export const OWNER_UZ = {
  // — Навигация (разделы) —
  'Главная': 'Asosiy',
  'Финансы': 'Moliya',
  'Маркетинг': 'Marketing',
  'Закупки': 'Xaridlar',
  'Склад': 'Ombor',
  'Продажи / Операции': 'Sotuvlar / Operatsiyalar',
  'Персонал (HR)': 'Xodimlar (HR)',
  'Клиентский сервис': 'Mijozlar xizmati',
  'Настройки': 'Sozlamalar',
  'AI-помощник': 'AI-yordamchi',
  'Быстрый чат': 'Tezkor chat',
  'Свернуть панель': 'Panelni yopish',
  'Развернуть': 'Yoyish',
  'Свернуть': 'Yopish',
  'Все системы в норме': 'Barcha tizimlar joyida',

  // — Разделы: описания —
  'Сводка по всему бизнесу одним взглядом': 'Butun biznes bir qarashda',
  'Финансовая модель · P&L · себестоимость · Cash flow · точка безубыточности': 'Moliyaviy model · P&L · tannarx · Cash flow · zararsizlik nuqtasi',
  'ЦА · контент · LTV · воронка · стратегия': 'Auditoriya · kontent · LTV · voronka · strategiya',
  'Категорийный менеджмент · поставщики · ассортимент': 'Kategoriya menejmenti · yetkazib beruvchilar · assortiment',
  'Остатки · приход · ABC/XYZ · инвентаризация': 'Qoldiqlar · kirim · ABC/XYZ · inventarizatsiya',
  'Управление работой магазинов · B2C касса · B2B сделки · риски': "Do'konlar ishi · B2C kassa · B2B bitimlar · risklar",
  'Найм · обучение · мотивация · KPI': "Yollash · o'qitish · motivatsiya · KPI",
  'Горячая линия · отзывы · жалобы · поддержка': "Issiq liniya · sharhlar · shikoyatlar · qo'llab-quvvatlash",
  'Интеграции · безопасность · масштабирование': 'Integratsiyalar · xavfsizlik · masshtablash',

  // — Инструменты: финансы —
  'Кассы': 'Kassalar', 'Приход/расход в 10 валютах': "10 valyutada kirim/chiqim",
  'P&L отчёт': 'P&L hisobot', 'Выручка · маржа · прибыль': 'Tushum · marja · foyda',
  'Ценообразование': 'Narx belgilash', 'Себестоимость · маржа': 'Tannarx · marja',
  'Cash Flow': 'Cash Flow', 'Движение денег по дням': "Pul harakati kunlar bo'yicha",
  'Что-если симулятор': 'Nima-bo‘lsa simulyator', 'Цена · маржа · прогноз': 'Narx · marja · prognoz',
  'Финансовая модель': 'Moliyaviy model', 'P&L · прогноз 3 мес': 'P&L · 3 oylik prognoz',
  'Точка безубыточности': 'Zararsizlik nuqtasi', 'Когда выходишь в плюс': "Qachon plyusga chiqasiz",

  // — Инструменты: маркетинг —
  'Анализ ЦА (JTBD)': 'Auditoriya tahlili (JTBD)', 'Аватары · боли · возражения': "Avatar · og'riq · e'tiroz",
  'Конструктор контента': 'Kontent konstruktori', 'Воронка · план/факт · аналитика': 'Voronka · reja/fakt · tahlil',
  'Каналы и ROI': 'Kanallar va ROI', 'Откуда клиенты · ROI · LTV по источнику': 'Mijozlar qayerdan · ROI · manba LTV',
  'LTV клиентов': 'Mijozlar LTV', 'Ценность · повторные · сегменты': 'Qiymat · takroriy · segmentlar',
  'ССП — стратегия': 'SSP — strategiya', 'Cистема сбалансированных показателей': "Muvozanatli ko'rsatkichlar tizimi",
  'Стратегия 3 года': '3 yillik strategiya', 'Сезонность · этапы': 'Mavsumiylik · bosqichlar',
  'Воронка продаж': 'Sotuv voronkasi', 'Бюджет→охват→лиды→продажа': "Byudjet→qamrov→lidlar→sotuv",
  'Конкуренты': 'Raqobatchilar', 'Цены · мониторинг': 'Narxlar · monitoring',
  'Лояльность': 'Sodiqlik', 'Bronze→Platinum': 'Bronze→Platinum',

  // — Инструменты: закупки —
  'Поставщики': 'Yetkazib beruvchilar', 'База поставщиков': 'Yetkazib beruvchilar bazasi',
  'Долги поставщикам': 'Yetkazib beruvchilarga qarz', 'Что мы должны': 'Biz nima qarzdormiz',
  'Приход товара': 'Tovar kirimi', 'От поставщиков': 'Yetkazib beruvchilardan',
  'Заказы поставщикам': 'Yetkazib beruvchilarga buyurtma', 'Что заказано / в пути': "Nima buyurtma qilingan / yo'lda",
  'Категорийный мгмт': 'Kategoriya menejmenti', 'Ассортимент по категориям': "Kategoriyalar bo'yicha assortiment",
  'Сравнение поставщиков': 'Yetkazib beruvchilarni solishtirish', 'Цены · качество · сроки': 'Narx · sifat · muddat',

  // — Инструменты: склад —
  'Товары и остатки': 'Tovarlar va qoldiqlar', 'Каталог · цены · фото · штрих-коды': 'Katalog · narx · foto · shtrix-kod',
  'ABC/XYZ анализ': 'ABC/XYZ tahlil', 'Точка заказа · мёртвый': "Buyurtma nuqtasi · o'lik tovar",
  'Справочники': 'Ma‘lumotnomalar', 'Типы · бренды · единицы': "Turlar · brendlar · birliklar",
  'Наборы': 'To‘plamlar', 'Сборка · BOM': 'Yig‘ish · BOM',
  'Логистика': 'Logistika', 'Курьеры · карта · статусы': 'Kuryerlar · xarita · statuslar',
  'Инвентаризация': 'Inventarizatsiya', 'Сверка факт vs учёт': 'Fakt vs hisob solishtiruvi',

  // — Инструменты: продажи/операции —
  'История продаж': 'Sotuvlar tarixi', 'Все продажи · фильтры': 'Barcha sotuvlar · filtrlar',
  'Касса · монитор': 'Kassa · monitor', 'Смена в реальном времени': 'Smena real vaqtda',
  'B2B / B2G': 'B2B / B2G', 'Pipeline · сделки': 'Pipeline · bitimlar',
  'Коммерческое предл.': 'Tijoriy taklif', 'Генератор КП': 'Tijoriy taklif generatori',
  'Скрипты продаж': 'Sotuv skriptlari', 'Cold call · возражения': "Sovuq qo'ng'iroq · e'tirozlar",
  'Контроль рисков': 'Risklarni nazorat', 'Алерты · аномалии': 'Ogohlantirishlar · anomaliyalar',
  'Планирование': 'Rejalashtirish', 'План продаж · бюджет': 'Sotuv rejasi · byudjet',
  'Автоматизация': 'Avtomatlashtirish', 'Если → То · сценарии': 'Agar → Unda · stsenariylar',

  // — Инструменты: HR —
  'KPI команды': 'Jamoa KPI', 'Продажи · смены · бонусы': 'Sotuvlar · smenalar · bonuslar',
  'Сотрудники': 'Xodimlar', 'Роли · филиалы · доступ': 'Rollar · filiallar · ruxsat',
  'Найм': 'Yollash', 'Вакансии · кандидаты': 'Vakansiyalar · nomzodlar',
  'Адаптация': 'Adaptatsiya', 'Чек-листы для новых': 'Yangilar uchun chek-list',
  'Обучение': "O'qitish", 'Курсы · аттестация': 'Kurslar · attestatsiya',
  'Мотивация': 'Motivatsiya', 'Лидерборд продаж · 30 дней': 'Sotuv liderbordi · 30 kun',
  'Картотека HR': 'HR kartotekasi', 'Сотрудники · активность': 'Xodimlar · faollik',

  // — Инструменты: клиентский сервис —
  'Клиентская база': 'Mijozlar bazasi', 'Карточки клиентов · история': 'Mijoz kartalari · tarix',
  'Долги клиентов': 'Mijozlar qarzi', 'Кто и сколько должен': 'Kim qancha qarzdor',
  'Сегментация': 'Segmentatsiya', 'VIP · спящие · ушедшие': 'VIP · uxlayotgan · ketgan',
  'Горячая линия': 'Issiq liniya', 'Звонки · обращения': "Qo'ng'iroqlar · murojaatlar",
  'Жалобы': 'Shikoyatlar', 'Тикеты · разбор': 'Tiketlar · tahlil',
  'Отзывы': 'Sharhlar', 'Сбор · мониторинг · ответ': "Yig'ish · monitoring · javob",
  'NPS-опросы': "NPS so'rovlari", 'Лояльность · детракторы': 'Sodiqlik · detraktorlar',
  'CJM (клиент)': 'CJM (mijoz)', 'Путь клиента · ретеншн': "Mijoz yo'li · ushlab qolish",
  'Точки контакта': 'Kontakt nuqtalari', 'До/во время/после': 'Oldin/vaqtida/keyin',

  // — Инструменты: настройки —
  'Интеграции': 'Integratsiyalar', 'Реальный статус подключений': 'Ulanishlarning haqiqiy holati',
  'Безопасность': 'Xavfsizlik', 'Роли · права · доступы': 'Rollar · huquqlar · ruxsatlar',
  'Масштабирование': 'Masshtablash', 'Филиалы · валюты': 'Filiallar · valyutalar',

  // — Оболочка / роли —
  'Учредитель': 'Muassis', 'Ген. директор': 'Bosh direktor', 'Менеджер': 'Menejer',
  'Мой филиал': 'Mening filialim', 'Все филиалы': 'Barcha filiallar', 'Один филиал': 'Bitta filial',
  'Менеджер видит только свой филиал': "Menejer faqat o'z filialini ko'radi",
  'Сводка по всей компании': "Butun kompaniya bo'yicha xulosa", 'Только этот филиал': 'Faqat shu filial',
  'Нет филиалов': 'Filiallar yo‘q', 'Выйти': 'Chiqish',

  // — Дашборд —
  'Главная панель': 'Bosh panel', 'Сегодня': 'Bugun', 'Неделя': 'Hafta', 'Месяц': 'Oy', 'Год': 'Yil', 'Всё': 'Hammasi',
  'ВЫРУЧКА': 'TUSHUM', 'Выручка': 'Tushum', 'Касса (баланс)': 'Kassa (balans)', 'Продаж': 'Sotuvlar', 'Средний чек': "O'rtacha chek",
  'за период': 'davr uchun', 'сум · остаток на сейчас': "so'm · hozirgi qoldiq",
  'Сум': "So'm", 'Доллар': 'Dollar', 'На карту': 'Kartaga', 'На кассу': 'Kassaga',
  'Денежный поток': 'Pul oqimi', 'Приход': 'Kirim', 'Расход': 'Chiqim', 'Валовая прибыль': 'Yalpi foyda', 'Склад': 'Ombor',
  'Прошлый период пуст — сравнение появится позже': "O'tgan davr bo'sh — solishtirish keyinroq paydo bo'ladi",
  'нет базы для сравнения': "solishtirish uchun asos yo'q",
  'Динамика продаж': 'Sotuvlar dinamikasi',
  'Сравнение филиалов': 'Filiallarni solishtirish', 'Филиал': 'Filial', 'Маржа': 'Marja', 'Сделок': 'Bitimlar', 'Касса': 'Kassa', 'Сотр.': 'Xodim', 'ИТОГО': 'JAMI',
  'Алерты': 'Ogohlantirishlar', 'Всё спокойно': 'Hammasi tinch', 'Топ товаров': 'Top tovarlar', 'Все →': 'Hammasi →', 'Нет данных': "Ma'lumot yo'q",
  'Топ сотрудников': 'Top xodimlar', 'Ошибка загрузки': 'Yuklashda xato',

  // — Общие (ui / tool router) —
  '← Назад': '← Orqaga', 'Назад': 'Orqaga', 'Нет данных за период': "Davr uchun ma'lumot yo'q",
  'В разработке': 'Ishlab chiqilmoqda', 'Скоро': 'Tez orada', 'Загрузка...': 'Yuklanmoqda...',
  'Сохранить': 'Saqlash', 'Отмена': 'Bekor qilish', 'Удалить': "O'chirish", 'Редактировать': 'Tahrirlash', 'Добавить': "Qo'shish",
  'Поиск': 'Qidiruv', 'Статус': 'Holat', 'Дата': 'Sana', 'Сумма': 'Summa', 'Действия': 'Amallar', 'шт': 'dona',
  'сум': "so'm", 'сум · в кассу': "so'm · kassaga", 'сум · из кассы': "so'm · kassadan",
  'сум · продажи − себестоимость': "so'm · sotuv − tannarx", 'сум · стоимость остатков': "so'm · qoldiq qiymati",
  'остаток на сейчас': 'hozirgi qoldiq', 'сотр · маржа': 'xodim · marja',
  'Продажи · последние 30 дней': 'Sotuvlar · oxirgi 30 kun', 'Сравнение · последние 30 дней': 'Solishtirish · oxirgi 30 kun',
  'к прошлому периоду': "o'tgan davrga nisbatan", 'Текущий': 'Joriy', 'Прошлый': "O'tgan", 'Предыдущие': 'Oldingilari',
  'Пик': 'Cho‘qqi', 'последние 30 дней': 'oxirgi 30 kun', '12 недель': '12 hafta', '12 месяцев': '12 oy', '5 лет': '5 yil',
  'День': 'Kun', 'Сравнение с прошлым периодом': "O'tgan davr bilan solishtirish",
  'Низкий остаток': 'Past qoldiq', 'товаров': 'tovar', 'Меньше 5 единиц на складе — рискуете остаться без продаж': "Omborda 5 donadan kam — sotuvsiz qolish xavfi",
  'сделок': 'bitim', 'Все филиалы · ': 'Barcha filiallar · ', 'сейчас': 'hozir',
  'Сравнение': 'Solishtirish', 'Продажи': 'Sotuvlar', 'филиалов': 'filial', 'Сотр.': 'Xodim', 'маржа↓': 'marja↓',
  'сотр · маржа ': 'xodim · marja ',

  // — SectionHome: метрики + UI карточек разделов —
  'Прибыль': 'Foyda', 'Клиентов': 'Mijozlar', 'Новых клиентов': 'Yangi mijozlar', 'В лояльности': 'Sodiqlikda',
  'Поставщиков': 'Yetkazib beruvchilar', 'Стоимость склада': 'Ombor qiymati', 'Низкий остаток': 'Past qoldiq',
  'SKU всего': 'Jami SKU', 'Сотрудников': 'Xodimlar', 'Средний KPI': "O'rtacha KPI", 'ФОТ': 'Ish haqi fondi', 'NPS': 'NPS',
  'UZS · период': 'UZS · davr', 'баланс': 'balans', 'всего в базе': 'bazada jami', 'за 30 дней': '30 kun ichida',
  'нужно подключить': 'ulash kerak', 'в базе': 'bazada', '< 5 единиц': '< 5 dona', 'товарных позиций': 'tovar pozitsiyalari',
  'активных': 'faol', 'будет подключено': 'ulanadi', 'нужна настройка': 'sozlash kerak', 'после запуска опросов': "so'rovlardan keyin",
  'ОТДЕЛ': "BO'LIM", 'инструментов': 'vosita', 'готовых': 'tayyor', 'в разработке': 'ishlanmoqda',
  'Готово к работе': 'Ishga tayyor', 'В разработке · можно посмотреть макет': 'Ishlanmoqda · maketni ko‘rish mumkin',
  'Смотреть макет →': "Maketni ko'rish →", 'Открыть →': 'Ochish →', '🚧 Скоро': '🚧 Tez orada', '✓ Готов': '✓ Tayyor',
  'Дизайн-макет. Реальные данные ещё не подключены — отображаются примеры.': "Dizayn-maket. Haqiqiy ma'lumotlar hali ulanmagan — namunalar ko'rsatilmoqda.",
  'Работает с реальными данными вашей компании.': "Kompaniyangizning haqiqiy ma'lumotlari bilan ishlaydi.",
  'Этот инструмент будет реализован в следующих обновлениях. Если он критичен — напишите, поднимем приоритет.': "Bu vosita keyingi yangilanishlarda amalga oshiriladi. Agar muhim bo'lsa — yozing, ustuvorlikni oshiramiz.",
  'Готов': 'Tayyor',
};

export function tt(ru, lang) {
  if (lang !== 'uz') return ru;
  return OWNER_UZ[ru] || TOOLS_UZ[ru] || ru;
}

// Хук: читает текущий язык из LangContext, возвращает переводчик + смену языка.
export function useTt() {
  const ctx = useContext(LangContext);
  const lang = ctx?.lang || (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ru';
  return { tt: (ru) => tt(ru, lang), lang, changeLang: ctx?.changeLang };
}

// Локаль для дат по языку
export const dateLocale = (lang) => (lang === 'uz' ? 'uz-UZ' : 'ru-RU');

// Узбекские названия (латиница) — не полагаемся на Intl 'uz-UZ': во многих
// браузерах/ICU-сборках узбекская локаль дат отсутствует и даёт «M06 15, Mon».
const UZ_MONTHS       = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_WEEKDAYS     = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

// Локаль-безопасный формат даты. Для uz собираем строку вручную, для ru — через Intl.
// opts поддерживает: day:'numeric', month:'long'|'short', year:'numeric', weekday:'long'.
export function fmtDate(value, opts = {}, lang) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  if (lang !== 'uz') return d.toLocaleDateString('ru-RU', opts);
  const head = [];
  if (opts.day) head.push(String(d.getDate()));
  if (opts.month === 'long') head.push(UZ_MONTHS[d.getMonth()]);
  else if (opts.month === 'short') head.push(UZ_MONTHS_SHORT[d.getMonth()]);
  else if (opts.month) head.push(String(d.getMonth() + 1).padStart(2, '0'));
  if (opts.year) head.push(String(d.getFullYear()));
  let s = head.join(' ');
  if (opts.weekday) s += (s ? ', ' : '') + UZ_WEEKDAYS[d.getDay()];
  return s;
}
