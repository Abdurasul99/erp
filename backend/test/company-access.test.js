const test = require('node:test');
const assert = require('node:assert/strict');

let policy = {};
try {
  policy = require('../companyAccess');
} catch {
  // RED: the policy module does not exist until the feature is implemented.
}

test('rejects a regular user when their company is disabled', () => {
  assert.equal(typeof policy.companyAccessError, 'function');

  const result = policy.companyAccessError(
    { role: 'cashier', company_id: 17 },
    { is_enabled: false },
  );

  assert.deepEqual(result, {
    status: 403,
    code: 'COMPANY_DISABLED',
    error: 'Доступ компании приостановлен. Обратитесь к администратору.',
  });
});

test('allows enabled companies and users without a company', () => {
  assert.equal(typeof policy.companyAccessError, 'function');
  assert.equal(policy.companyAccessError({ company_id: 17 }, { is_enabled: true }), null);
  assert.equal(policy.companyAccessError({ role: 'admin', company_id: null }, null), null);
});

test('keeps SaaS impersonation available for managing a disabled company', () => {
  assert.equal(typeof policy.companyAccessError, 'function');
  assert.equal(
    policy.companyAccessError({ role: 'founder', company_id: 17, act_as: true }, { is_enabled: false }),
    null,
  );
});

test('fails closed when an attached company no longer exists', () => {
  assert.equal(typeof policy.companyAccessError, 'function');
  assert.equal(policy.companyAccessError({ company_id: 17 }, null)?.code, 'COMPANY_DISABLED');
});

test('accepts only boolean status values', () => {
  assert.equal(typeof policy.parseCompanyEnabled, 'function');
  assert.equal(policy.parseCompanyEnabled(true), true);
  assert.equal(policy.parseCompanyEnabled(false), false);
  assert.throws(() => policy.parseCompanyEnabled('false'), /boolean/i);
  assert.throws(() => policy.parseCompanyEnabled(undefined), /boolean/i);
});
