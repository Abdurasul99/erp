import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoan } from '../src/utils/loan.mjs';

test('annuity matches the fixed 24 month example', () => {
  const loan = calculateLoan('50 000 000', '24', '24');
  assert.ok(Math.abs(loan.payment - 2643554.862662494) < 0.01);
  assert.ok(Math.abs(loan.totalPaid - loan.payment * 24) < 0.01);
  assert.ok(Math.abs(loan.overpay - (loan.totalPaid - 50000000)) < 0.01);
});

test('zero interest repays the principal without overpayment', () => {
  assert.deepEqual(calculateLoan(1200, 0, 12), { payment: 100, totalPaid: 1200, overpay: 0 });
});

test('near-zero interest does not divide by a rounded zero denominator', () => {
  const loan = calculateLoan(1200, '0.0000000000000001', 12);
  assert.ok(Number.isFinite(loan.payment));
  assert.ok(Math.abs(loan.payment - 100) < 0.0001);
  assert.ok(loan.overpay >= 0);
});

for (const [name, args] of [
  ['empty term', [1200, 24, '']], ['zero term', [1200, 24, 0]],
  ['fractional month', [1200, 24, 1.5]], ['over maximum term', [1200, 24, 121]],
  ['negative rate', [1200, -1, 12]], ['over maximum rate', [1200, 101, 12]],
  ['empty rate', [1200, '', 12]], ['negative principal', [-1, 24, 12]],
  ['nonfinite principal', [Infinity, 24, 12]], ['overflow total', [Number.MAX_VALUE, 100, 120]],
]) {
  test(`rejects ${name}`, () => assert.equal(calculateLoan(...args), null));
}

for (const term of [1, 2, 119, 120]) {
  test(`valid term boundary ${term}`, () => assert.ok(calculateLoan(1200, 24, term)));
}
for (const rate of [0, 1, 99, 100]) {
  test(`valid rate boundary ${rate}`, () => assert.ok(calculateLoan(1200, rate, 12)));
}

test('payments are finite with nonnegative overpayment across valid terms', () => {
  for (let term = 1; term <= 120; term++) {
    for (const rate of [0, 0.01, 1, 24, 100]) {
      const loan = calculateLoan(1000000, rate, term);
      assert.ok(Number.isFinite(loan.payment) && loan.payment > 0);
      assert.ok(loan.overpay >= 0);
    }
  }
});
