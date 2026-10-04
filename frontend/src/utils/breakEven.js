// Чистый расчёт точки безубыточности: вход -> выход, без React и без сети.
// Формулы взяты из макета клиента и менять их нельзя:
//
//   check      = revenue / clients                 // средний чек
//   marge      = check - vPer                      // маржа с клиента
//   CM         = marge / check                     // маржинальность
//   BE_clients = F / marge                         // точка безубыточности в клиентах
//   BE_sum     = BE_clients * check                // она же в деньгах
//   profit     = revenue - F - V,  V = vPer*clients
//   safety     = (revenue - BE_sum) / revenue
//   payback    = invest / profit
//
// Главное требование: НИ ОДНО поле результата не может быть NaN или Infinity.
// Там, где формула вырождается (деление на ноль, убыточный клиент), возвращается
// null плюс код причины — экран по этому коду показывает «—» и объяснение словами.
//
// ПРИМЕРЫ (проверялись руками):
//
// 1. Норма:      revenue 100 000 000, clients 50, F 30 000 000, vPer 400 000, invest 200 000 000
//    check 2 000 000; marge 1 600 000; cm 0.8; beClients 18.75 (округляем вверх -> 19);
//    beSum 37 500 000; profit 100 - 30 - 20 = 50 000 000; safety 0.625; payback 4 мес.
//
// 2. Клиентов нет: revenue 0, clients 0, F 30 000 000 -> check null (НЕ Infinity),
//    marge/cm/be null (reason 'no_clients'), profit -30 000 000, safety null
//    (reason 'no_revenue'), payback null (reason 'no_profit').
//
// 3. Убыточный клиент: check 300 000 при vPer 400 000 -> marge -100 000, cm отрицательна,
//    be null (reason 'negative_margin') — «при такой цене каждый клиент приносит убыток».
//    БЕЗ этой ветки формула F/marge дала бы отрицательное число клиентов.
//
// 4. Маржа ровно ноль: check 400 000, vPer 400 000 -> marge 0, F/0 = Infinity,
//    поэтому be тоже null с тем же 'negative_margin'.
//
// 5. Пока в минусе: revenue 20 000 000, clients 10, F 30 000 000, vPer 400 000,
//    invest 200 000 000 -> profit -14 000 000, payback null (reason 'no_profit'),
//    но beClients (F/marge = 30/1.6) = 18.75 считается нормально — цель видна.
//
// 6. Выручка нулевая при заданных клиентах: revenue 0, clients 10 -> check 0,
//    marge = -vPer < 0 -> be null, cm null (делить на check = 0 нельзя), safety null.

import { normalizeDecimal } from './decimalInput.js';

// Значения приходят и строками из полей ввода («1 500 000», «12,5»), и строками из pg
// (numeric отдаётся строкой), и числами. Всё сводим к конечному числу.
export function toNumber(raw, fallback = 0) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = parseFloat(normalizeDecimal(raw));
  return Number.isFinite(n) ? n : fallback;
}

// Деньги и количества отрицательными не бывают — иначе один опечатанный минус
// переворачивает весь экран.
const nonNeg = (raw) => Math.max(0, toNumber(raw, 0));

// Единственная точка, где может родиться Infinity/NaN — деление. Гасим здесь.
const fin = (v) => (Number.isFinite(v) ? (v === 0 ? 0 : v) : null);
const div = (a, b) => (b === 0 ? null : fin(a / b));

// Коды вырожденных случаев. Экран показывает по ним текст, а не число.
export const REASONS = {
  NO_CLIENTS: 'no_clients',
  NEGATIVE_MARGIN: 'negative_margin',
  NO_PROFIT: 'no_profit',
  NO_REVENUE: 'no_revenue',
  NO_INVEST: 'no_invest',
};

const REASON_TEXT = {
  [REASONS.NO_CLIENTS]: 'Нет клиентов за период — средний чек не из чего считать',
  [REASONS.NEGATIVE_MARGIN]: 'При такой цене каждый клиент приносит убыток — точка безубыточности недостижима',
  [REASONS.NO_PROFIT]: 'Пока не окупается: прибыли за период нет',
  [REASONS.NO_REVENUE]: 'Нет выручки за период — запас прочности не считается',
  [REASONS.NO_INVEST]: 'Вложения не заданы — окупаться нечему',
};

export function reasonText(code) {
  return REASON_TEXT[code] || '';
}

// Статьи расходов из JSONB [{ name, amount }] -> одна сумма.
export function sumItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => acc + nonNeg(it && it.amount), 0);
}

// Клиент — это филиал, дробных не бывает: «нужно 18.75» читается как «нужно 19».
export function ceilClients(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const n = Math.ceil(v - 1e-9);   // допуск, чтобы 19.0000000001 не стало 20
  return n === 0 ? 0 : n;          // Math.ceil даёт -0, а в интерфейсе «-0» выглядит как ошибка
}

/**
 * Полный расчёт.
 * Вход: { revenue, clients, fixedTotal, varPerClient, invest, checkOverride? } — числа или строки.
 * Выход: шесть показателей + разложение затрат + данные для inline-SVG графика.
 * Любой показатель, который не считается, приходит как null; рядом лежит *Reason.
 */
export function calcBreakEven(input = {}) {
  const revenue = nonNeg(input.revenue);
  const clients = nonNeg(input.clients);
  const fixedTotal = nonNeg(input.fixedTotal);
  const varPerClient = nonNeg(input.varPerClient);
  const invest = nonNeg(input.invest);

  // 1. Средний чек. В автоматическом режиме цена известна даже при нуле
  // подключённых филиалов, поэтому её можно передать отдельно. Без явной цены
  // сохраняем прежнее правило: clients = 0 -> null, а не Infinity.
  const hasCheckOverride = input.checkOverride !== null
    && input.checkOverride !== undefined
    && input.checkOverride !== '';
  const check = hasCheckOverride ? nonNeg(input.checkOverride) : div(revenue, clients);
  const noClients = check === null;

  // 2. Маржа с клиента.
  const marge = check === null ? null : fin(check - varPerClient);
  // Маржа ровно 0 так же смертельна для F/marge, как и отрицательная.
  const marginPositive = marge !== null && marge > 0;

  // 3. Маржинальность. При check = 0 доля не определена (делить не на что).
  const cm = check === null || check === 0 ? null : div(marge, check);

  // 4. Точка безубыточности.
  let beClients = null;
  let beSum = null;
  let beReason = null;
  if (noClients) {
    beReason = REASONS.NO_CLIENTS;
  } else if (!marginPositive) {
    beReason = REASONS.NEGATIVE_MARGIN;
  } else {
    beClients = div(fixedTotal, marge);
    beSum = beClients === null ? null : fin(beClients * check);
  }

  // 5. Прибыль за период. Считается всегда — она не делит ни на что.
  // В режиме «Факт» переменные расходы известны СУММОЙ за период. Восстанавливать
  // их как varPerClient * clients нельзя: при нуле клиентов произведение даёт ноль,
  // и весь видимый на экране список выпадал из прибыли — убыток занижался ровно
  // на сумму этого списка. varPerClient при этом продолжает работать в марже и БУ.
  const variableTotal = input.variableTotalOverride != null
    ? nonNeg(input.variableTotalOverride)
    : (fin(varPerClient * clients) ?? 0);
  const profit = fin(revenue - fixedTotal - variableTotal) ?? 0;

  // 6. Запас прочности. Нужны и выручка, и достижимый порог.
  let safety = null;
  let safetyReason = null;
  if (revenue === 0) safetyReason = REASONS.NO_REVENUE;
  else if (beSum === null) safetyReason = beReason;
  else safety = div(revenue - beSum, revenue);

  // 7. Окупаемость вложений.
  let payback = null;
  let paybackReason = null;
  if (invest <= 0) paybackReason = REASONS.NO_INVEST;   // «0,0 мес» читалось как сбой
  else if (profit <= 0) paybackReason = REASONS.NO_PROFIT;
  else payback = div(invest, profit);

  return {
    // нормализованный вход — экран показывает ровно то, из чего считали
    revenue, clients, fixedTotal, varPerClient, invest,
    variableTotal,
    totalCost: fin(fixedTotal + variableTotal) ?? 0,
    // полная себестоимость одного клиента (переменные + доля постоянных)
    fullCostPerClient: clients === 0 ? null : div(fixedTotal + variableTotal, clients),

    check,
    checkReason: noClients ? REASONS.NO_CLIENTS : null,
    marge,
    margeReason: noClients ? REASONS.NO_CLIENTS : null,
    cm,
    cmPct: cm === null ? null : fin(cm * 100),
    cmReason: cm === null ? (noClients ? REASONS.NO_CLIENTS : REASONS.NO_REVENUE) : null,

    beClients,
    beClientsCeil: ceilClients(beClients),
    beSum,
    beReason,

    profit,
    profitable: profit > 0,

    safety,
    safetyPct: safety === null ? null : fin(safety * 100),
    safetyReason,

    payback,
    paybackReason,

    chart: buildChart({ clients, check, fixedTotal, varPerClient, beClients, beSum }),
  };
}

// Данные для графика: X — клиенты, слои — постоянные (жёлтая область),
// постоянные+переменные (красная), выручка (зелёная линия), вертикаль в точке БУ.
// Здесь только числа; рисование — задача компонента.
function buildChart({ clients, check, fixedTotal, varPerClient, beClients, beSum }, steps = 40) {
  const slope = check === null ? 0 : check;         // наклон линии выручки
  // Шкала X должна вместить и текущее положение, и точку БУ, и немного запаса,
  // иначе пересечение линий окажется за краем картинки.
  const candidates = [clients * 1.5, (beClients || 0) * 1.4, 10];
  let maxClients = Math.max(...candidates.filter(Number.isFinite));
  if (!Number.isFinite(maxClients) || maxClients <= 0) maxClients = 10;
  maxClients = Math.ceil(maxClients);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const q = (maxClients * i) / steps;
    const variable = varPerClient * q;
    points.push({
      q,
      fixed: fixedTotal,
      cost: fin(fixedTotal + variable) ?? 0,
      revenue: fin(slope * q) ?? 0,
    });
  }

  const last = points[points.length - 1];
  const yMax = Math.max(last.cost, last.revenue, fixedTotal, 1);

  return {
    maxClients,
    yMax,
    points,
    // hasRevenue = false, когда чек неизвестен: линия выручки лежит на нуле,
    // рисовать её как «продажи» нельзя — экран должен сказать, что данных нет.
    hasRevenue: check !== null && check > 0,
    be: beClients !== null && beSum !== null ? { clients: beClients, sum: beSum } : null,
    current: { clients, revenue: fin(slope * clients) ?? 0, cost: fin(fixedTotal + varPerClient * clients) ?? 0 },
  };
}

/**
 * Связывание четырёх полей прогноза: чек / клиенты / выручка / целевая прибыль.
 *
 * field  — какое поле реально менял пользователь
 *          ('check' | 'clients' | 'revenue' | 'profit' | 'costs');
 * values — текущие значения всех четырёх (строки из полей ввода допустимы);
 * costs  — { fixedTotal, varPerClient } для правила целевой прибыли.
 *
 * Пересчёт идёт ТОЛЬКО от изменённого поля и ровно один раз — поэтому цикла
 * «чек поменял выручку, выручка поменяла чек» здесь возникнуть не может.
 * Само изменённое поле никогда не переписывается: пользователь допечатывает цифры.
 */
// opts.anchor — какое из полей «чек»/«клиенты» пользователь правил последним.
// Нужен, чтобы правка выручки двигала одно и то же поле от начала до конца ввода.
export function linkForecastFields(field, values = {}, costs = {}, opts = {}) {
  const check = nonNeg(values.check);
  const clients = nonNeg(values.clients);
  const revenue = nonNeg(values.revenue);
  // Когда чек/объём являются вводными, рассчитанная прибыль может быть ниже нуля.
  // Это важный результат, а не невалидное значение: не зажимаем его в 0.
  const profit = toNumber(values.profit, 0);
  const fixedTotal = nonNeg(costs.fixedTotal);
  const varPerClient = nonNeg(costs.varPerClient);

  const next = { check, clients, revenue, profit };
  const changed = [];
  let reason = null;

  const set = (key, value) => {
    const v = fin(value);
    if (v === null) return;                 // молча не портим поле мусором
    if (v === next[key]) return;
    next[key] = v;
    changed.push(key);
  };

  const recalcProfit = () => {
    set('profit', next.revenue - fixedTotal - varPerClient * next.clients);
  };

  // Целевая прибыль оставляет постоянным последний выбранный пользователем
  // базовый показатель: либо число клиентов, либо средний чек.
  const recalcFromProfit = () => {
    if (opts.anchor === 'clients' && next.clients > 0) {
      const requiredCheck = varPerClient + (fixedTotal + next.profit) / next.clients;
      if (requiredCheck >= 0) {
        set('check', requiredCheck);
        set('revenue', next.check * next.clients);
      } else {
        reason = REASONS.NEGATIVE_MARGIN;
      }
      return;
    }

    const marge = next.check - varPerClient;
    if (marge > 0) {
      set('clients', Math.max(0, (fixedTotal + next.profit) / marge));
      set('revenue', next.check * next.clients);
    } else {
      reason = REASONS.NEGATIVE_MARGIN;
    }
  };

  if (field === 'check' || field === 'clients') {
    // выручка = чек × клиенты
    set('revenue', next.check * next.clients);
    recalcProfit();
  } else if (field === 'revenue') {
    // Цель вывода фиксируем ЗАРАНЕЕ, а не выбираем заново на каждый символ.
    // Иначе первый символ выводил чек, а второй уже видел его ненулевым и начинал
    // двигать клиентов: набор «125» в выручке разгонял клиентов в десять раз
    // на каждую цифру. anchor — поле, которое пользователь правил последним;
    // двигаем ПРОТИВОПОЛОЖНОЕ ему.
    const anchor = opts.anchor === 'clients' ? 'clients' : (opts.anchor === 'check' ? 'check' : null);
    const target = anchor === 'check' ? 'clients' : anchor === 'clients' ? 'check' : null;
    if (target === 'clients' && next.check > 0) set('clients', next.revenue / next.check);
    else if (target === 'check' && next.clients > 0) set('check', next.revenue / next.clients);
    else if (target === null) {
      // Якоря нет (первое действие на экране) — старое правило.
      if (next.check > 0) set('clients', next.revenue / next.check);
      else if (next.clients > 0) set('check', next.revenue / next.clients);
    }
    // считать не из чего — оставляем как есть
    recalcProfit();
  } else if (field === 'profit') {
    recalcFromProfit();
  } else if (field === 'costs') {
    // Расходы всегда вводятся руками. Всё остальное пересчитывается от последнего
    // выбранного критерия прогноза: сохраняем цель или текущий объём.
    if (opts.driver === 'profit') recalcFromProfit();
    else {
      set('revenue', next.check * next.clients);
      recalcProfit();
    }
  }

  return { values: next, changed, reason };
}

export default calcBreakEven;
