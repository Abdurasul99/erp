'use strict';

// Прокат: сколько единиц позиции занято в каждый день диапазона.
//
// Бронь занимает вещь с date_from по date_to включительно, пока она не
// возвращена и не отменена. Две ловушки, из-за которых модуль вынесен отдельно:
//
//   1. Складывать все брони, пересекающие диапазон, нельзя. Брони 1–2 и 3–4
//      числа по 5 штук при запасе 5 не конфликтуют, а сумма дала бы 10 и ложный
//      отказ. Правильно — пик занятости по дням.
//
//   2. Выданная и не возвращённая к сроку вещь занята, пока её не вернули, —
//      даже после date_to. Иначе система пообещает клиенту то, чего нет на
//      складе. Такие брони считаются занятыми без конечной даты.
//
// Даты — строки 'YYYY-MM-DD', арифметика в днях по UTC: часовой пояс процесса
// не должен сдвигать бронь на сутки.

const DAY_MS = 86400000;
const ACTIVE_STATUSES = new Set(['reserved', 'issued']);
// Защита от брони «на годы» по ошибке ввода: и от лишней нагрузки на подсчёт.
const MAX_RANGE_DAYS = 366;

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return Number.NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const t = Date.UTC(y, mo, d);
  // Date.UTC молча переносит 31 февраля на март — такую дату считаем неверной.
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== d) return Number.NaN;
  return t / DAY_MS;
}

const isValidDate = (iso) => Number.isFinite(dayNumber(iso));
const isoFromDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

function todayIso(now = new Date()) {
  // Сегодня по Ташкенту (UTC+5, без перехода на летнее время) — там работает бизнес.
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Последний занятый день брони с учётом правила 2.
function effectiveEnd(r, today) {
  const end = dayNumber(r.date_to);
  if (r.status === 'issued' && end < dayNumber(today)) return Number.POSITIVE_INFINITY;
  return end;
}

function isOverdue(r, today) {
  return r.status === 'issued' && dayNumber(r.date_to) < dayNumber(today);
}

// Пик занятости на отрезке [from, to] включительно.
function peakOccupancy(reservations, from, to, today) {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) throw new Error('Неверный диапазон дат');
  if (b - a + 1 > MAX_RANGE_DAYS) throw new Error(`Диапазон больше ${MAX_RANGE_DAYS} дней`);
  const active = reservations
    .filter((r) => ACTIVE_STATUSES.has(r.status))
    .map((r) => ({ from: dayNumber(r.date_from), to: effectiveEnd(r, today), qty: Number(r.qty) || 0 }));
  let peak = 0;
  let peakDay = null;
  for (let d = a; d <= b; d += 1) {
    let used = 0;
    for (const r of active) if (r.from <= d && r.to >= d) used += r.qty;
    if (used > peak) {
      peak = used;
      peakDay = isoFromDay(d);
    }
  }
  return { peak, peak_day: peakDay };
}

function availability(qtyTotal, reservations, from, to, today) {
  const { peak, peak_day: peakDay } = peakOccupancy(reservations, from, to, today);
  const free = Math.round((Number(qtyTotal) - peak) * 100) / 100;
  return { total: Number(qtyTotal), occupied: peak, free, peak_day: peakDay };
}

module.exports = {
  MAX_RANGE_DAYS, dayNumber, isValidDate, isoFromDay, todayIso,
  isOverdue, peakOccupancy, availability,
};
