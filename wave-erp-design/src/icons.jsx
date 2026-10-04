import React from 'react';

// Монохромные stroke-иконки в духе SF Symbols (24×24, stroke 1.7)
const PATHS = {
  home: <><path d="M4 11.3 12 4.3l8 7" /><path d="M6.3 9.8v9.7h11.4V9.8" /></>,
  chart: <><path d="M6 19.5v-7" /><path d="M12 19.5v-13" /><path d="M18 19.5v-9.5" /></>,
  dollar: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.2v9.6M14.6 9.1c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.7-2.4 1.9 0 2.6 5.2 1.2 5.2 3.9 0 1.2-1.1 1.9-2.7 1.9-1.3 0-2.3-.5-2.9-1.3" /></>,
  megaphone: <><path d="M4 10.5v3.6l2.6.5L9 19.4h1.9l-1.3-4.2 9.4 2V6.5L6.6 9.9 4 10.5Z" /><path d="M21 10.2a2.6 2.6 0 0 1 0 3.4" /></>,
  cart: <><path d="M3.5 5H6l2.3 10.3h8.9L19.8 8H6.7" /><circle cx="9" cy="19" r="1.5" /><circle cx="16" cy="19" r="1.5" /></>,
  box: <><path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" /><path d="m4.2 7.5 7.8 4.3 7.8-4.3" /><path d="M12 11.8V21" /></>,
  bag: <><path d="M6.2 8.3h11.6l-.9 11.2H7.1L6.2 8.3Z" /><path d="M9.2 8.3V6.5a2.8 2.8 0 0 1 5.6 0v1.8" /></>,
  people: <><circle cx="9" cy="8.6" r="3" /><path d="M3.6 19c.5-2.9 2.7-4.4 5.4-4.4s4.9 1.5 5.4 4.4" /><circle cx="16.6" cy="9.6" r="2.3" /><path d="M16 14.8c2.4.3 4 1.6 4.4 4.2" /></>,
  headset: <><path d="M4.5 14v-1.5a7.5 7.5 0 0 1 15 0V14" /><rect x="3.4" y="13.6" width="3.6" height="5.2" rx="1.6" /><rect x="17" y="13.6" width="3.6" height="5.2" rx="1.6" /><path d="M19 18.8v.6a2.4 2.4 0 0 1-2.4 2.4H13" /></>,
  gear: <><circle cx="12" cy="12" r="3.1" /><path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1" /></>,
  search: <><circle cx="11" cy="11" r="6.2" /><path d="m15.6 15.6 4.4 4.4" /></>,
  bell: <><path d="M12 4.2a5.3 5.3 0 0 0-5.3 5.3c0 3.9-1.4 5.2-1.9 6h14.4c-.5-.8-1.9-2.1-1.9-6A5.3 5.3 0 0 0 12 4.2Z" /><path d="M10.2 18.8a1.9 1.9 0 0 0 3.6 0" /></>,
  moon: <path d="M19.8 14.7A7.8 7.8 0 1 1 9.9 4.5a6.6 6.6 0 0 0 9.9 10.2Z" />,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 3.4v2M12 18.6v2M20.6 12h-2M5.4 12h-2M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4M18.1 18.1l-1.4-1.4M7.3 7.3 5.9 5.9" /></>,
  sparkle: <><path d="m12 3.5 1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5Z" /><path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></>,
  alert: <><path d="M12 4.6 21 19H3L12 4.6Z" /><path d="M12 10.2v3.6" /><path d="M12 16.4v.1" /></>,
  check: <><circle cx="12" cy="12" r="8.4" /><path d="m8.4 12.3 2.5 2.5 4.7-5.4" /></>,
  chevron: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  back: <><path d="M19 12H5.5" /><path d="m11 6-6 6 6 6" /></>,
  pulse: <path d="M3 12.2h3.8L9.4 6l4.3 12 2.5-5.8H21" />,
  doc: <><path d="M7 3.8h7l4 4v12.4H7V3.8Z" /><path d="M13.6 3.8v4.4H18" /><path d="M9.6 12.4h5M9.6 15.6h5" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  wave: <path d="M3 14.5c2.5-5 4.5-5 6 0s3.5 5 6 0 3.7-4.6 6-1.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3.2 2.2" /></>,
  cloud: <path d="M7 18.2h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 9.4 3.9 3.9 0 0 0 7 18.2Z" />,
  cloudsun: <><path d="M15.3 8.5a3.4 3.4 0 0 0-.2-.5" opacity="0" /><path d="M17.2 10.1a3.3 3.3 0 1 0-4.3-4.6" /><path d="M17.5 4.2v-1M21 7.7h1M19.9 4.5l.7-.7M20 11l.7.7" /><path d="M6.3 19h7.4a3.4 3.4 0 0 0 .6-6.7 4.9 4.9 0 0 0-9.5-.9A3.4 3.4 0 0 0 6.3 19Z" /></>,
  rain: <><path d="M7 15.4h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 6.6 3.9 3.9 0 0 0 7 15.4Z" /><path d="M8.5 18.2 7.8 20M12.4 18.2l-.7 1.8M16.3 18.2l-.7 1.8" /></>,
  snow: <><path d="M7 15.4h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 6.6 3.9 3.9 0 0 0 7 15.4Z" /><path d="M8.4 18.4v.1M12.1 19.6v.1M15.8 18.4v.1" /></>,
  storm: <><path d="M7 14.6h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 5.8 3.9 3.9 0 0 0 7 14.6Z" /><path d="m12.8 16-2.2 3.4h2.8L11.2 23" /></>,
  power: <><path d="M12 3.4v8" /><path d="M7 5.9a8 8 0 1 0 10 0" /></>,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  arrowup: <><path d="M12 19V5.5" /><path d="m6.5 11 5.5-5.5L17.5 11" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.7, style, className }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true"
    >
      {PATHS[name] || PATHS.grid}
    </svg>
  );
}

// Визуальные метаданные отделов: иконка + цвет + duotone-градиент (Apple-палитра)
export const SECTION_META = {
  dashboard: { icon: 'home', color: '#0A84FF', grad: ['#0A84FF', '#5E5CE6'] },
  analytics: { icon: 'chart', color: '#0A84FF', grad: ['#0A84FF', '#5E5CE6'] },
  finance: { icon: 'dollar', color: '#28A745', grad: ['#30D158', '#00A88E'] },
  marketing: { icon: 'megaphone', color: '#FF2D55', grad: ['#FF2D55', '#BF5AF2'] },
  procurement: { icon: 'cart', color: '#F08A00', grad: ['#FF9F0A', '#FF6B22'] },
  warehouse: { icon: 'box', color: '#1B9AD2', grad: ['#32ADE6', '#0A84FF'] },
  operations: { icon: 'bag', color: '#E8590C', grad: ['#FF6B22', '#FFB340'] },
  hr: { icon: 'people', color: '#AF52DE', grad: ['#BF5AF2', '#5E5CE6'] },
  support: { icon: 'headset', color: '#5E5CE6', grad: ['#5E5CE6', '#32ADE6'] },
  settings: { icon: 'gear', color: '#71717A', grad: ['#8E8E93', '#636366'] },
};

export const meta = (id) => SECTION_META[id] || SECTION_META.dashboard;
export const gradCss = (id, deg = 135) => {
  const [a, b] = meta(id).grad;
  return `linear-gradient(${deg}deg, ${a}, ${b})`;
};

// Смысловой глиф инструмента (по id/названию), иначе глиф отдела
export function toolGlyph(tool, sectionId) {
  const s = tool.id + ' ' + tool.title.toLowerCase();
  if (/whatif|what-if|modeling|симулятор/.test(s)) return 'sparkle';
  if (/forecast|прогноз|trend|тренд/.test(s)) return 'pulse';
  if (/alert|risk|police|аномал|anomaly|контроль/.test(s)) return 'alert';
  if (/report|отчёт|истори|history|journal|журнал|табел/.test(s)) return 'doc';
  if (/расписан|смен|явка|birthday|рожден|календар/.test(s)) return 'clock';
  if (/сотруд|команд|kpi|hr|найм|увольн|мотивац|картотек/.test(s)) return 'people';
  if (/денежн|касс|валют|зарплат|salar|цен|налог|долг|pnl|p&l|cash|фин|ltv|роі|roi/.test(s)) return 'dollar';
  if (/склад|остат|товар|запас|приход|приём|перемещ|инвентар|брак|eoq|rop|штрих|barcode/.test(s)) return 'box';
  if (/закуп|поставщ|заказ/.test(s)) return 'cart';
  if (/клиент|crm|nps|отзыв|лояльн|сегмент|отток|refer|рефер/.test(s)) return 'headset';
  if (/маркет|рассылк|контент|канал|воронк|лид|кампан|скрипт/.test(s)) return 'megaphone';
  if (/настро|интеграц|безопас|масштаб|панел/.test(s)) return 'gear';
  return meta(sectionId).icon;
}
