import React from 'react';

// Профессиональные line-иконки (стиль Lucide): монохром, штрих 1.8, currentColor.
// НЕ эмодзи — вписываются в Confluent-канон. Используются в сайдбаре, топбаре,
// заголовках разделов и палитре поиска.
const PATHS = {
  home: <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>,
  wallet: <>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </>,
  cart: <>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </>,
  package: <>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </>,
  trending: <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>,
  users: <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
  client: <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.2 18.9a7 7 0 0 1 11.6 0" />
  </>,
  chart: <>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </>,
  megaphone: <>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </>,
  settings: <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>,
  sparkles: <>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </>,
  message: <>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </>,
  search: <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
  calendar: <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </>,
  building: <>
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
  </>,
  logout: <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </>,
  activity: <>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </>,
  bell: <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
  layout: <>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </>,
  clipboard: <>
    <rect width="8" height="4" x="8" y="2" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </>,
  trophy: <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>,
  // Одинарная искра (AI-воркспейс: аватар, статус-пилюля генерации) — отличается
  // от `sparkles` (главная навигация) более острым силуэтом под askew-анимацию.
  sparkle: <>
    <path d="m12 3.5 1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5Z" />
    <path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
  </>,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  arrowup: <>
    <path d="M12 19V5.5" />
    <path d="m6.5 11 5.5-5.5L17.5 11" />
  </>,
  chevron: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
};

// Иконки виджетов Главной (окно «Виджеты» + возможные будущие места)
export const WIDGET_ICON = {
  'revenue-hero': 'trending',
  bhi: 'activity',
  'kpi-tiles': 'layout',
  cashflow: 'wallet',
  'sales-chart': 'chart',
  'branch-compare': 'building',
  alerts: 'bell',
  'top-products': 'trophy',
  'top-sellers': 'users',
};

export function Icon({ name, size = 18, strokeWidth = 1.8, style }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {body}
    </svg>
  );
}

// Иконка раздела по id (сайдбар, заголовок раздела, палитра поиска)
export const SECTION_ICON = {
  dashboard: 'home',
  analytics: 'chart',
  finance: 'wallet',
  marketing: 'megaphone',
  procurement: 'cart',
  warehouse: 'package',
  operations: 'trending',
  hr: 'users',
  support: 'client',
  settings: 'settings',
};

// Duotone-градиенты отделов (Apple-палитра) — док, баннеры, чипы инструментов.
export const SECTION_GRAD = {
  dashboard: ['#0A84FF', '#5E5CE6'],
  analytics: ['#0A84FF', '#5E5CE6'],
  finance: ['#30D158', '#00A88E'],
  marketing: ['#FF2D55', '#BF5AF2'],
  procurement: ['#FF9F0A', '#FF6B22'],
  warehouse: ['#32ADE6', '#0A84FF'],
  operations: ['#FF6B22', '#FFB340'],
  hr: ['#BF5AF2', '#5E5CE6'],
  support: ['#5E5CE6', '#32ADE6'],
  settings: ['#8E8E93', '#636366'],
  ai: ['#0A84FF', '#C05CFF'],
};

export const gradCss = (id, deg = 135) => {
  const [a, b] = SECTION_GRAD[id] || SECTION_GRAD.dashboard;
  return `linear-gradient(${deg}deg, ${a}, ${b})`;
};

// Сплошной акцентный цвет отдела (первый стоп градиента) — для текста/чипов,
// где градиент неуместен (AI-воркспейс: заголовок нарисованного экрана и т.п.)
export const sectionColor = (id) => (SECTION_GRAD[id] || SECTION_GRAD.dashboard)[0];

// Смысловой глиф инструмента по его id/названию (рус.) — используется там, где
// нужна иконка конкретного инструмента, а не просто иконка его отдела
// (AI-воркспейс, Launchpad, поиск).
export function toolGlyph(title = '', sectionId) {
  const s = title.toLowerCase();
  if (/что.если|whatif|симулятор/.test(s)) return 'sparkles';
  if (/прогноз|тренд|forecast/.test(s)) return 'trending';
  if (/алерт|риск|аномал|police|полиция|контрол/.test(s)) return 'bell';
  if (/отчёт|история|журнал|табель/.test(s)) return 'chart';
  if (/расписан|смен|явка|день рожд|календар/.test(s)) return 'calendar';
  if (/сотруд|команд|kpi|найм|увольн|мотивац|картотек/.test(s)) return 'users';
  if (/деньг|касс|валют|зарплат|цен|налог|долг|pnl|p&l|cash|фин/.test(s)) return 'wallet';
  if (/склад|остат|товар|запас|приход|приём|перемещ|инвентар|брак|штрих/.test(s)) return 'package';
  if (/закуп|поставщ|заказ/.test(s)) return 'cart';
  if (/клиент|crm|nps|отзыв|лояльн|сегмент|отток|рефер/.test(s)) return 'client';
  if (/маркет|рассылк|контент|канал|воронк|лид|кампан/.test(s)) return 'megaphone';
  if (/настро|интеграц|безопас|масштаб|панел/.test(s)) return 'settings';
  return SECTION_ICON[sectionId] || 'home';
}
