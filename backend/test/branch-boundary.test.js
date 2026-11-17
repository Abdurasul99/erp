// Граница филиалов: branch_id / from_branch_id / to_branch_id из запроса обязан принадлежать
// компании пользователя. Найдено QA-обходом 2026-11-17: учредитель компании B передавал
// ?branch_id филиала компании A и получал её приходы (GET /api/stock/income-list).
const test = require('node:test');
const assert = require('node:assert/strict');

let mod = {};
try { mod = require('../branchBoundary'); } catch { /* RED: модуля ещё нет */ }

test('collects every branch id from query and body, ignoring empty and non-numeric values', () => {
  assert.equal(typeof mod.requestedBranchIds, 'function');
  const ids = mod.requestedBranchIds({
    query: { branch_id: '7', from_branch_id: 'all' },
    body: { to_branch_id: 9, branch_id: '' },
  });
  assert.deepEqual([...ids].sort(), [7, 9]);
  assert.deepEqual([...mod.requestedBranchIds({ query: {}, body: undefined })], []);
  assert.deepEqual([...mod.requestedBranchIds({ query: { branch_id: ['3', '4'] }, body: {} })].sort(), [3, 4]);
});

function run(mw, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ blocked: true, status: this.statusCode, body: b }); } };
    mw(req, res, () => resolve({ blocked: false }));
  });
}
const COMPANY_OF = { 1: 10, 2: 10, 3: 20 };
const make = (decoded) => mod.createBranchBoundary({
  verify: () => { if (!decoded) throw new Error('bad token'); return decoded; },
  branchCompany: async (id) => COMPANY_OF[id] ?? null,
});
const req = (q = {}, b = {}) => ({ path: '/api/stock/income-list', headers: { authorization: 'Bearer t' }, query: q, body: b });

test('blocks a branch of another company with 403', async () => {
  const r = await run(make({ role: 'founder', company_id: 20 }), req({ branch_id: '1' }));
  assert.equal(r.blocked, true);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'BRANCH_OUT_OF_COMPANY');
});

test('blocks a foreign branch passed in the body (transfer target)', async () => {
  const r = await run(make({ role: 'manager', company_id: 10 }), req({}, { to_branch_id: 3 }));
  assert.equal(r.blocked, true);
});

test('blocks an unknown branch id', async () => {
  const r = await run(make({ role: 'director', company_id: 10 }), req({ branch_id: '999' }));
  assert.equal(r.blocked, true);
});

test('passes own-company branches', async () => {
  const r = await run(make({ role: 'founder', company_id: 10 }), req({ branch_id: '2' }, { from_branch_id: 1 }));
  assert.equal(r.blocked, false);
});

test('impersonation token is checked against the impersonated company', async () => {
  const r = await run(make({ role: 'founder', company_id: 20, act_as: true }), req({ branch_id: '1' }));
  assert.equal(r.blocked, true);
});

test('leaves requests without a token, with a bad token, or from the platform admin to their own guards', async () => {
  assert.equal((await run(make({ role: 'founder', company_id: 20 }), { ...req({ branch_id: '1' }), headers: {} })).blocked, false);
  assert.equal((await run(make(null), req({ branch_id: '1' }))).blocked, false);
  assert.equal((await run(make({ role: 'admin', company_id: null }), req({ branch_id: '1' }))).blocked, false);
});

test('requests without branch ids skip the lookup entirely', async () => {
  let looked = 0;
  const mw = mod.createBranchBoundary({ verify: () => ({ role: 'founder', company_id: 10 }), branchCompany: async () => { looked++; return 10; } });
  assert.equal((await run(mw, req({ period: 'month' }))).blocked, false);
  assert.equal(looked, 0);
});

test('a failing lookup answers 503 instead of letting the request through', async () => {
  const mw = mod.createBranchBoundary({ verify: () => ({ role: 'founder', company_id: 10 }), branchCompany: async () => { throw new Error('db down'); } });
  const r = await run(mw, req({ branch_id: '1' }));
  assert.equal(r.blocked, true);
  assert.equal(r.status, 503);
});
