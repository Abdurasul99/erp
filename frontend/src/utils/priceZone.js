// Скидочная политика по цветам — единственный источник правды о том,
// в какую зону попала цена. Импортируется экранами прихода (WarehouseIncome,
// Mobile), продажи (SellerView, Mobile) и остатков (WarehouseBalance).
//
// Модуль намеренно чистый: без React, без обращений к API. Его зовут и внутри
// .owner-shell, и снаружи (телефон продавца), поэтому цвета здесь — явные hex,
// а НЕ var(--green): за пределами owner-shell эти переменные другие или их нет.
//
// Три абсолютные цены в сумах задаёт складовщик при приходе:
//   зелёная >= жёлтая >= красная.
// Порог, который не задан (NULL в БД), границы не создаёт — он просто выпадает
// из проверок. Если не задан НИ ОДИН порог, политики нет: color === null,
// экран не красит ничего и ничего не блокирует. Это обязательное условие
// обратной совместимости — у существующих товаров порогов нет.
//
// ПРИМЕРЫ (зелёная 800 000 / жёлтая 730 000 / красная 700 000):
//   850 000 → color 'green',  blocked false — «Можно ещё скидку»
//   750 000 → color 'yellow', blocked false — «Близко к пределу»
//   710 000 → color 'red',    blocked false — «Ниже нельзя»
//   690 000 → color 'red',    blocked TRUE  — «Ниже минимальной цены 700 000 сум»

import { normalizeDecimal } from './decimalInput.js';

// Явные hex: hex — рамка и цифра, soft — фон метки/подсказки.
export const ZONE_COLORS = {
  green:  { hex: '#16A34A', soft: '#F0FDF4' },
  yellow: { hex: '#D97706', soft: '#FFFBEB' },
  red:    { hex: '#DC2626', soft: '#FEF2F2' },
};

// Пара ru/uz на каждый ключ: экраны вне owner-shell держат язык сами
// (SellerView, Mobile — через `uz ? … : …`), поэтому отдаём и пару, и
// уже выбранную строку.
export const ZONE_HINTS = {
  canDiscount: { ru: 'Можно ещё скидку', uz: 'Yana chegirma qilish mumkin' },
  nearLimit:   { ru: 'Близко к пределу', uz: 'Chegaraga yaqin' },
  noLower:     { ru: 'Ниже нельзя',      uz: "Pastga tushirib bo'lmaydi" },
  belowMin:    { ru: 'Ниже минимальной цены', uz: "Minimal narxdan past" },
};

const EMPTY_PAIR = { ru: '', uz: '' };

// Язык интерфейса: всё, что не 'uz', показываем по-русски — тот же
// graceful fallback, что и в useTranslation.
function pick(pair, lang) {
  return lang === 'uz' ? pair.uz : pair.ru;
}

// Пороги приходят из pg строкой (DECIMAL сериализуется в строку!), а из формы —
// строкой с пробелами-разрядами и запятой. Поэтому разбор только через
// normalizeDecimal: parseFloat('1.500.000') дал бы 1.5.
// Возвращаем null, а не NaN — «значения нет» и «значение сломано» для нас одно.
function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const s = normalizeDecimal(v);
  if (s === '' || s === '.' || s === '-') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Принимает и карточку товара с сервера (price_green/price_yellow/price_red),
// и «сырой» объект формы прихода ({ green, yellow, red }) — формам удобно
// проверять то, что человек только что набрал, до сохранения товара.
export function readThresholds(source) {
  const s = source || {};
  return {
    green:  toNum(s.price_green  ?? s.green),
    yellow: toNum(s.price_yellow ?? s.yellow),
    red:    toNum(s.price_red    ?? s.red),
  };
}

// Задана ли политика хоть каким-то порогом. Нужно там, где метку рисуют
// до ввода цены (таблица остатков).
export function hasPricePolicy(source) {
  const { green, yellow, red } = readThresholds(source);
  return green !== null || yellow !== null || red !== null;
}

// Разряды как везде в проекте: toLocaleString('ru-RU') → «700 000».
export function formatSum(value) {
  const n = toNum(value);
  if (n === null) return '';
  return parseFloat(n.toFixed(2)).toLocaleString('ru-RU');
}

function noZone(hasPolicy, thresholds) {
  return {
    color: null, hex: null, soft: null,
    blocked: false,
    hasPolicy,
    hintKey: null,
    hint: '', hints: EMPTY_PAIR,
    message: '', messages: EMPTY_PAIR,
    min: thresholds.red,
    thresholds,
  };
}

/**
 * Цветовая зона фактической цены за единицу (в сумах, ПОСЛЕ скидки).
 *
 * @param {number|string} price   цена за единицу; пустое/нечитаемое → зоны нет
 * @param {object} product        карточка товара либо { green, yellow, red }
 * @param {'ru'|'uz'} [lang]      язык подсказки, по умолчанию 'ru'
 */
export function priceZone(price, product, lang = 'ru') {
  const thresholds = readThresholds(product);
  const { green, yellow, red } = thresholds;
  const hasPolicy = green !== null || yellow !== null || red !== null;

  // Политики нет — экран работает ровно как до появления порогов.
  if (!hasPolicy) return noZone(false, thresholds);

  // Поле цены пустое или ещё дописывается. Красить нечего, и — важно —
  // блокировать продажу тоже нельзя: иначе кнопка гаснет на промежуточном вводе.
  const p = toNum(price);
  if (p === null) return noZone(true, thresholds);

  // Проверки снизу вверх, незаданный порог пропускаем.
  let color, hintKey, blocked = false;
  if (red !== null && p < red) {
    color = 'red'; hintKey = 'belowMin'; blocked = true;
  } else if (yellow !== null && p < yellow) {
    color = 'red'; hintKey = 'noLower';
  } else if (green !== null && p < green) {
    color = 'yellow'; hintKey = 'nearLimit';
  } else {
    color = 'green'; hintKey = 'canDiscount';
  }

  const hints = ZONE_HINTS[hintKey];
  // В блокировке одной подсказки мало — человек должен увидеть сам минимум
  // ДО нажатия кнопки, а не узнать его из ответа сервера.
  const messages = blocked
    ? {
        ru: `Ниже минимальной цены ${formatSum(red)} сум`,
        uz: `Minimal narxdan past: ${formatSum(red)} so'm`,
      }
    : hints;

  return {
    color,
    hex: ZONE_COLORS[color].hex,
    soft: ZONE_COLORS[color].soft,
    blocked,
    hasPolicy: true,
    hintKey,
    hint: pick(hints, lang), hints,
    message: pick(messages, lang), messages,
    min: red,
    thresholds,
  };
}

// Спека называет функцию zone(price, product) — держим оба имени, чтобы
// экраны подключались любым привычным импортом.
export { priceZone as zone };

/**
 * Проверка набранных порогов перед отправкой (приход на компьютере и на телефоне).
 * Незаданные пороги в сравнении не участвуют — политику можно задать частично.
 *
 * @param {object} source          { green, yellow, red } или карточка товара
 * @param {object} [opts]
 * @param {number|string} [opts.priceBuy]  себестоимость — для предупреждения об убытке
 * @param {'ru'|'uz'} [opts.lang]
 * @returns {{ ok: boolean, field: string|null, message: string, messages: {ru,uz},
 *            warning: string, warnings: {ru,uz} }}
 */
export function validateThresholds(source, opts = {}) {
  const lang = opts.lang || 'ru';
  const { green, yellow, red } = readThresholds(source);
  const buy = toNum(opts.priceBuy);

  let field = null;
  let messages = EMPTY_PAIR;
  if (green !== null && yellow !== null && yellow > green) {
    field = 'yellow';
    messages = {
      ru: 'Жёлтая цена не может быть выше зелёной',
      uz: "Sariq narx yashil narxdan yuqori bo'lishi mumkin emas",
    };
  } else if (yellow !== null && red !== null && red > yellow) {
    field = 'red';
    messages = {
      ru: 'Красная цена не может быть выше жёлтой',
      uz: "Qizil narx sariq narxdan yuqori bo'lishi mumkin emas",
    };
  } else if (yellow === null && green !== null && red !== null && red > green) {
    // Жёлтой нет — но красная всё равно не может быть выше зелёной.
    field = 'red';
    messages = {
      ru: 'Красная цена не может быть выше зелёной',
      uz: "Qizil narx yashil narxdan yuqori bo'lishi mumkin emas",
    };
  }

  // Предупреждения (не запреты): обе ситуации законны, но о них надо сказать вслух.
  const sell = toNum(opts.priceSell);
  let warnings = EMPTY_PAIR;
  if (field === null && red !== null && sell !== null && red > sell) {
    // Опаснее убытка: товар становится непродаваемым. У продавца поле горит
    // красным и кнопка гаснет на обычной прайсовой цене, а причину со своего
    // экрана он не видит и исправить не может.
    warnings = {
      ru: `Красная цена выше цены продажи ${formatSum(sell)} сум — продавец не сможет продать товар`,
      uz: `Qizil narx sotuv narxidan (${formatSum(sell)} so'm) yuqori — sotuvchi tovarni sota olmaydi`,
    };
  } else if (field === null && red !== null && buy !== null && red < buy) {
    // Убыток — предупреждение, а не запрет: бывают распродажи ниже себестоимости.
    warnings = {
      ru: `Красная цена ниже себестоимости ${formatSum(buy)} сум — продажа в убыток`,
      uz: `Qizil narx tannarxdan (${formatSum(buy)} so'm) past — zarariga sotuv`,
    };
  }

  return {
    ok: field === null,
    field,
    message: pick(messages, lang), messages,
    warning: pick(warnings, lang), warnings,
  };
}

export default priceZone;
