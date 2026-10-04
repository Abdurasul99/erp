import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REASONS,
  calcBreakEven,
  linkForecastFields,
} from '../src/utils/breakEven.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('calculates the complete break-even model from revenue and expenses', () => {
  const result = calcBreakEven({
    revenue: 100_000_000,
    clients: 50,
    fixedTotal: 30_000_000,
    varPerClient: 400_000,
    invest: 200_000_000,
  });

  assert.equal(result.check, 2_000_000);
  assert.equal(result.marge, 1_600_000);
  assert.equal(result.cmPct, 80);
  assert.equal(result.beClients, 18.75);
  assert.equal(result.beClientsCeil, 19);
  assert.equal(result.beSum, 37_500_000);
  assert.equal(result.variableTotal, 20_000_000);
  assert.equal(result.totalCost, 50_000_000);
  assert.equal(result.fullCostPerClient, 1_000_000);
  assert.equal(result.profit, 50_000_000);
  assert.equal(result.safetyPct, 62.5);
  assert.equal(result.payback, 4);
});

test('calculates the threshold from a known price even before the first client', () => {
  const result = calcBreakEven({
    revenue: 0,
    clients: 0,
    checkOverride: 1_000,
    fixedTotal: 3_000,
    varPerClient: 100,
    invest: 10_000,
  });

  assert.equal(result.check, 1_000);
  assert.equal(result.marge, 900);
  assert.equal(result.cmPct, 90);
  closeTo(result.beClients, 10 / 3);
  assert.equal(result.beClientsCeil, 4);
  closeTo(result.beSum, 10_000 / 3);
  assert.equal(result.profit, -3_000);
  assert.equal(result.safety, null);
  assert.equal(result.safetyReason, REASONS.NO_REVENUE);
  assert.equal(result.payback, null);
  assert.equal(result.paybackReason, REASONS.NO_PROFIT);
});

test('editing the average check recalculates revenue and a negative profit', () => {
  const result = linkForecastFields(
    'check',
    { check: 1_000, clients: 5, revenue: 0, profit: 0 },
    { fixedTotal: 1_000, varPerClient: 2_000 },
  );

  assert.equal(result.values.revenue, 5_000);
  assert.equal(result.values.profit, -6_000);
});

test('editing clients recalculates revenue and profit', () => {
  const result = linkForecastFields(
    'clients',
    { check: 1_000, clients: 8, revenue: 0, profit: 0 },
    { fixedTotal: 1_000, varPerClient: 200 },
  );

  assert.equal(result.values.revenue, 8_000);
  assert.equal(result.values.profit, 5_400);
});

test('editing revenue keeps the selected anchor and recalculates profit', () => {
  const result = linkForecastFields(
    'revenue',
    { check: 1_000, clients: 5, revenue: 8_000, profit: 0 },
    { fixedTotal: 1_000, varPerClient: 200 },
    { anchor: 'check' },
  );

  assert.equal(result.values.check, 1_000);
  assert.equal(result.values.clients, 8);
  assert.equal(result.values.profit, 5_400);
});

test('editing target profit can keep the client count and derive the required check', () => {
  const result = linkForecastFields(
    'profit',
    { check: 1_000, clients: 5, revenue: 5_000, profit: 2_000 },
    { fixedTotal: 1_000, varPerClient: 200 },
    { anchor: 'clients' },
  );

  assert.equal(result.values.clients, 5);
  assert.equal(result.values.check, 800);
  assert.equal(result.values.revenue, 4_000);
  assert.equal(result.values.profit, 2_000);
});

test('changing expenses recalculates profit when volume is the forecast driver', () => {
  const result = linkForecastFields(
    'costs',
    { check: 1_000, clients: 5, revenue: 5_000, profit: 0 },
    { fixedTotal: 2_000, varPerClient: 100 },
    { driver: 'clients' },
  );

  assert.equal(result.values.clients, 5);
  assert.equal(result.values.revenue, 5_000);
  assert.equal(result.values.profit, 2_500);
});

test('changing expenses preserves a target profit and recalculates required volume', () => {
  const result = linkForecastFields(
    'costs',
    { check: 1_000, clients: 3.75, revenue: 3_750, profit: 2_000 },
    { fixedTotal: 2_000, varPerClient: 200 },
    { driver: 'profit' },
  );

  assert.equal(result.values.check, 1_000);
  assert.equal(result.values.clients, 5);
  assert.equal(result.values.revenue, 5_000);
  assert.equal(result.values.profit, 2_000);
});

test('does not invent a target volume when price does not cover variable cost', () => {
  const result = linkForecastFields(
    'profit',
    { check: 1_000, clients: 5, revenue: 5_000, profit: 2_000 },
    { fixedTotal: 1_000, varPerClient: 2_000 },
  );

  assert.equal(result.reason, REASONS.NEGATIVE_MARGIN);
  assert.equal(result.values.clients, 5);
  assert.equal(result.values.revenue, 5_000);
});
