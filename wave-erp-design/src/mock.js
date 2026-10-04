// Детерминированные мок-данные для экранов инструментов (seed = id инструмента)

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = ['Футболка базовая', 'Джинсы slim', 'Кроссовки Runner', 'Куртка зимняя', 'Рюкзак городской', 'Худи oversize', 'Кепка классик', 'Ремень кожаный'];
const PEOPLE = ['Азиз', 'Дильноза', 'Санжар', 'Мадина', 'Тимур', 'Нилюфар', 'Бекзод'];
const BRANCHES = ['Ташкент Сити', 'Чиланзар', 'Юнусабад'];

const INSIGHTS = [
  'Основной вклад в динамику дал филиал «Ташкент Сити» — {p1}% изменения метрики. Рекомендую перенести часть остатков из «Юнусабад», там оборачиваемость ниже на {p2}%.',
  'За последние 30 дней метрика растёт устойчиво (+{p1}%), но темп замедляется. Если тренд сохранится, к концу квартала рост составит ~{p2}%. Точка внимания — средний чек по будням.',
  'Обнаружено отклонение от нормы: {p1}% значения приходится на 3 позиции. Диверсификация снизит риск. Потенциальный эффект — +${p2} к месячной выручке.',
  'Сравнение с прошлым периодом: улучшение на {p1}%. Главный драйвер — повторные покупки. Следующий шаг: кампания по «спящим» клиентам, прогнозный ROI {p2}%.',
];

export function toolMock(tool, sectionTitle) {
  const rnd = mulberry32(hash(tool.id));
  const pct = (lo, hi) => (lo + rnd() * (hi - lo)).toFixed(1);
  const money = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;

  const stats = [
    { label: 'Текущее значение', value: '$' + money(8000, 96000).toLocaleString('en-US'), delta: `+${pct(2, 18)}%`, up: true },
    { label: 'За период', value: '$' + money(2000, 30000).toLocaleString('en-US'), delta: `+${pct(1, 9)}%`, up: true },
    { label: 'Отклонение от плана', value: pct(1, 12) + '%', delta: `−${pct(0.4, 4)}%`, up: false },
    { label: 'Прогноз на месяц', value: '$' + money(10000, 120000).toLocaleString('en-US'), delta: `+${pct(3, 14)}%`, up: true },
  ];

  const n = 14;
  let base = 40 + rnd() * 30;
  const series = Array.from({ length: n }, () => {
    base += (rnd() - 0.42) * 9;
    base = Math.max(18, base);
    return Math.round(base * 100);
  });

  const namePool = /hr|users|team|fire|health|workday|motiv|salar|attend|absen|schedul/.test(tool.id)
    ? PEOPLE
    : /branch|scaling|compare/.test(tool.id) ? BRANCHES : PRODUCTS;

  const rows = Array.from({ length: 5 }, (_, i) => {
    const v = money(1200, 18000);
    return {
      name: namePool[(i + Math.floor(rnd() * namePool.length)) % namePool.length],
      value: '$' + v.toLocaleString('en-US'),
      share: pct(4, 34) + '%',
      delta: (rnd() > 0.3 ? '+' : '−') + pct(0.5, 12) + '%',
      good: rnd() > 0.3,
    };
  });

  const tpl = INSIGHTS[Math.floor(rnd() * INSIGHTS.length)];
  const insight = tpl
    .replace('{p1}', pct(18, 64))
    .replace('{p2}', money(120, 4200).toLocaleString('en-US'));

  return { stats, series, rows, insight, sectionTitle };
}
