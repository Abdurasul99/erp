import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDecimal, parseDecimal } from '../src/utils/decimalInput.js';

for (const [input, expected] of [
  ['-1', -1], ['0', 0], ['1', 1], ['12,5', 12.5], ['12.5', 12.5],
  ['1 234 567,89', 1234567.89], ['1\u202f234,56', 1234.56],
  ['1,234.56', 1234.56], ['1.234,56', 1234.56],
  ['1,234,567.89', 1234567.89], ['1.234.567,89', 1234567.89],
  ['1,500,000', 1500000], ['1.500.000', 1500000],
  ['-1.234,56', -1234.56], ['0.01', 0.01], ['12.', 12],
]) {
  test(`parses decimal amount ${JSON.stringify(input)}`, () => {
    assert.equal(parseDecimal(input), expected);
  });
}

for (const input of ['', '.', '-', '12abc', '1.2.3', '1,23.45', 'Infinity', '0x10']) {
  test(`rejects malformed amount ${JSON.stringify(input)}`, () => {
    assert.ok(Number.isNaN(parseDecimal(input)));
  });
}

test('localized monetary amounts round-trip across a deterministic numeric sample', () => {
  for (const locale of ['en-US', 'de-DE', 'ru-RU']) {
    for (let cents = -1000001; cents <= 1000001; cents += 7919) {
      const value = cents / 100;
      const formatted = value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      assert.equal(parseDecimal(formatted), value, `${locale}: ${formatted}`);
      const normalized = normalizeDecimal(formatted);
      assert.equal(normalizeDecimal(normalized), normalized);
    }
  }
});
