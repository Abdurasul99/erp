// Форматирование для интерфейса «Мероприятий». Время — всегда ташкентское:
// бизнес работает в Узбекистане, а браузер руководителя может стоять в поездке
// в другом поясе — дата мероприятия не должна «съезжать».

const TZ = 'Asia/Tashkent';

export function money(value, { sign = false } = {}) {
  const n = Math.round(Number(value) || 0);
  const s = Math.abs(n).toLocaleString('ru-RU').replace(/ /g, ' ');
  const prefix = n < 0 ? '−' : (sign && n > 0 ? '+' : '');
  return `${prefix}${s} сум`;
}

export function percent(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(1).replace('.', ',')}%`;
}

export function date(iso, opts = {}) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', ...opts });
}

export function dateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: TZ, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export function time(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// Значение для <input type="datetime-local"> в ташкентском времени.
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

// Календарная дата 'YYYY-MM-DD' по Ташкенту.
export function dayKey(iso) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function todayKey() {
  return dayKey(new Date().toISOString());
}

// Разбор суммы из поля ввода: «1 200 000», «1 200 000,50». null — не число.
export function parseAmount(text) {
  const s = String(text ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export function relativeDays(iso) {
  const diff = Math.round((new Date(dayKey(iso)).getTime() - new Date(todayKey()).getTime()) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  if (diff > 1) return `через ${diff} ${plural(diff, 'день', 'дня', 'дней')}`;
  return `${-diff} ${plural(-diff, 'день', 'дня', 'дней')} назад`;
}

export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
