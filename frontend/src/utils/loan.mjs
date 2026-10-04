import { parseDecimal } from './decimalInput.js';

// Monthly annuity. Invalid or incomplete input has no result; it must never
// look like a free loan or a negative interest charge in the scenario screen.
export function calculateLoan(principal, annualRate, months) {
  const p = parseDecimal(principal);
  const rate = parseDecimal(annualRate);
  const n = parseDecimal(months);
  if (!Number.isFinite(p) || p < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100
      || !Number.isInteger(n) || n < 1 || n > 120) return null;
  const r = rate / 1200;
  // expm1/log1p retain precision when the interest rate is close to zero.
  const payment = r === 0 ? p / n : p * (r / -Math.expm1(-n * Math.log1p(r)));
  const totalPaid = payment * n;
  const overpay = Math.max(0, totalPaid - p);
  if (![payment, totalPaid, overpay].every(Number.isFinite)) return null;
  return { payment, totalPaid, overpay };
}
