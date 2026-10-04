// Разбор числа, введённого человеком в поле.
//
// Один разделитель — десятичный; повторяющиеся группы по три цифры — тысячи.
// При смешанном формате («1,234.56», «1.234,56») последний разделитель
// десятичный. Нельзя просто удалять все разделители: это увеличивает сумму в 100 раз.
//
// Пробелы-разряды («1 500 000») отбрасываются всегда.
export function normalizeDecimal(raw) {
  const s = String(raw ?? '').replace(/\s+/g, '');
  if (s.includes('.') && s.includes(',')) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    const split = s.lastIndexOf(decimal);
    const whole = s.slice(0, split);
    const fraction = s.slice(split + 1);
    const grouped = new RegExp(`^[+-]?\\d{1,3}(?:\\${group}\\d{3})+$`);
    if (grouped.test(whole) && /^\d*$/.test(fraction)) {
      return whole.split(group).join('') + '.' + fraction;
    }
    return s; // malformed input stays invalid instead of silently changing value
  }
  const seps = (s.match(/[.,]/g) || []).length;
  if (seps > 1) {
    return /^[+-]?\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(s) ? s.replace(/[.,]/g, '') : s;
  }
  return s.replace(',', '.');
}

// Число или NaN — вызывающий сам решает, что делать с пустым полем.
// Пустая строка и одинокий разделитель числом не считаются.
export function parseDecimal(raw) {
  const s = normalizeDecimal(raw);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
