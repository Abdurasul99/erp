// Разбор числа, введённого человеком в поле.
//
// Ключевое правило: ДВА И БОЛЬШЕ разделителя — это разряды тысяч
// («1.500.000», «1,500,000»), ОДИН — десятичный («12,5», «12.5»).
// Без этого правила замена всех запятых на точку давала parseFloat('1.500.000')
// = 1.5, то есть цена 1 500 000 сум превращалась в 1.5 сума.
//
// Пробелы-разряды («1 500 000») отбрасываются всегда.
export function normalizeDecimal(raw) {
  const s = String(raw ?? '').replace(/\s+/g, '');
  const seps = (s.match(/[.,]/g) || []).length;
  return seps > 1 ? s.replace(/[.,]/g, '') : s.replace(',', '.');
}

// Число или NaN — вызывающий сам решает, что делать с пустым полем.
// Пустая строка и одинокий разделитель числом не считаются.
export function parseDecimal(raw) {
  const s = normalizeDecimal(raw);
  if (s === '' || s === '.') return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
