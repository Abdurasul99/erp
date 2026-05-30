// Smoke test for backend API (runs against a running server)
// Usage: node test/smoke.test.js
// Exits with code 0 if all pass, 1 if any fail.
//
// This is a black-box integration test — it issues real HTTP requests against
// the running server and verifies status codes and response shapes for each
// role. Add new endpoints here when adding routes to server.js.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024_xk9q';
const PORT = process.env.PORT || 3001;
const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS || 'Wareapp2024!',
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
});

const results = { pass: 0, fail: 0, errors: [] };

function request(method, path, token, body) {
  return new Promise((resolve) => {
    const opts = { host: 'localhost', port: PORT, path: '/api' + path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { let p; try { p = JSON.parse(data); } catch { p = data; } resolve({ status: res.statusCode, body: p }); });
    });
    req.on('error', e => resolve({ status: 0, body: { error: e.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
function tokenFor(u) {
  return jwt.sign({ id: u.id, username: u.username, role: u.role, company_id: u.company_id, branch_id: u.branch_id }, JWT_SECRET);
}
function check(name, expectedStatuses, actual, body) {
  const ok = expectedStatuses.includes(actual);
  results[ok ? 'pass' : 'fail']++;
  const line = `  ${ok ? '✓' : '✗'} ${name} → ${actual}${ok ? '' : ` (expected ${expectedStatuses.join('|')})${body?.error ? ' — ' + body.error : ''}`}`;
  console.log(line);
  if (!ok) results.errors.push(line);
}

async function run() {
  const { rows: users } = await pool.query('SELECT * FROM users ORDER BY id');
  const byRole = Object.fromEntries(users.map(u => [u.role, u]));
  const tk = Object.fromEntries(users.map(u => [u.role, tokenFor(u)]));
  for (const r of ['admin', 'gen_dir', 'manager', 'cashier', 'seller']) {
    if (!byRole[r]) { console.error('Missing role:', r); process.exit(2); }
  }

  let r;
  console.log('\n=== AUTH ===');
  check('GET /health', [200], (await request('GET', '/health')).status);
  check('GET /users unauthorized', [401], (await request('GET', '/users')).status);
  // Change my own password — wrong current password is rejected
  r = await request('POST', '/auth/change-password', tk.admin, { current_password: 'wrong', new_password: 'newpwd' });
  check('POST /auth/change-password (wrong current) → 401', [401], r.status, r.body);
  r = await request('POST', '/auth/change-password', tk.admin, { current_password: 'admin', new_password: 'ab' });
  check('POST /auth/change-password (too short) → 400', [400], r.status, r.body);
  // /auth/me with valid token
  r = await request('GET', '/auth/me', tk.admin);
  check('GET /auth/me (valid token)', [200], r.status, r.body);
  if (r.body?.user) {
    check('  /auth/me returns id', [true], typeof r.body.user.id === 'number');
    check('  /auth/me returns role', [true], typeof r.body.user.role === 'string');
  }
  // /auth/me with no token
  check('GET /auth/me (no token)', [401], (await request('GET', '/auth/me')).status);
  // /auth/me with garbage token
  check('GET /auth/me (bad token)', [401], (await request('GET', '/auth/me', 'garbage.token.here')).status);

  console.log('\n=== COMPANIES ===');
  for (const [role, expected] of [['admin', 200], ['gen_dir', 200], ['manager', 200], ['cashier', 403], ['seller', 403]]) {
    const r = await request('GET', '/companies', tk[role]);
    check(`GET /companies (${role})`, [expected], r.status, r.body);
  }
  // Creation requires founder fields
  let cr = await request('POST', '/companies', tk.admin, { name: 'NoFounder Inc' });
  check('POST /companies without founder → 400', [400], cr.status, cr.body);
  cr = await request('POST', '/companies', tk.admin, {
    name: 'SmokeCompany_' + Date.now(),
    founder_first_name: 'Test', founder_last_name: 'Founder',
    gen_dir_username: 'smk_founder_' + Date.now(), gen_dir_password: 'pwd1234',
  });
  check('POST /companies with founder → 200', [200], cr.status, cr.body);
  const newCompId = cr.body?.id;
  if (newCompId) {
    // Verify the founder user was created with role='founder' + first_name
    const { rows: founders } = await pool.query(
      'SELECT username, role, first_name, last_name FROM users WHERE company_id=$1 AND role=$2', [newCompId, 'founder']
    );
    check('  founder user created with role=founder', [true], founders.length === 1 && founders[0].first_name === 'Test');
    // Try to add a 2nd founder — must fail with 409
    const dupF = await request('POST', '/users', tk.admin, {
      username: 'dup_founder_' + Date.now(), password: 'pwd1234',
      role: 'founder', company_id: newCompId, first_name: 'X',
    });
    check('  POST 2nd founder → 409', [409], dupF.status, dupF.body);
    // Adding a gen_dir alongside founder must work (different role)
    const gd = await request('POST', '/users', tk.admin, {
      username: 'smk_gendir_' + Date.now(), password: 'pwd1234',
      role: 'gen_dir', company_id: newCompId, first_name: 'GenDir',
    });
    check('  POST gen_dir alongside founder → 200', [200], gd.status, gd.body);
    // Cleanup
    await pool.query('DELETE FROM users WHERE company_id=$1', [newCompId]);
    await pool.query('DELETE FROM companies WHERE id=$1', [newCompId]);
  }

  console.log('\n=== USERS ===');
  for (const [role, expected] of [['admin', 200], ['gen_dir', 200], ['manager', 200], ['cashier', 403], ['seller', 403]]) {
    const r = await request('GET', '/users', tk[role]);
    check(`GET /users (${role})`, [expected], r.status, r.body);
  }

  console.log('\n=== ROLE CHANGE LOG ===');
  check('GET /role-change-log (admin)', [200], (await request('GET', '/role-change-log', tk.admin)).status);
  check('GET /role-change-log (gen_dir denied)', [403], (await request('GET', '/role-change-log', tk.gen_dir)).status);

  console.log('\n=== STOCK ===');
  check('GET /stock/balance (cashier)', [200], (await request('GET', '/stock/balance', tk.cashier)).status);
  check('GET /stock/pending (manager)', [200], (await request('GET', '/stock/pending', tk.manager)).status);
  check('GET /stock/pending (seller denied)', [403], (await request('GET', '/stock/pending', tk.seller)).status);
  check('GET /stock/pending (cashier read-only)', [200], (await request('GET', '/stock/pending', tk.cashier)).status);
  // Cashier still cannot actually approve
  check('PUT /stock/outcome/:id/approve (cashier denied)', [403], (await request('PUT', '/stock/outcome/0/approve', tk.cashier, { action: 'approve' })).status);
  r = await request('GET', '/stock/income-list', tk.cashier);
  check('GET /stock/income-list (cashier)', [200], r.status, r.body);
  r = await request('GET', '/stock/outcome-list', tk.cashier);
  check('GET /stock/outcome-list (cashier)', [200], r.status, r.body);
  // Seller must see ONLY their own outcomes (server-side enforced)
  r = await request('GET', '/stock/outcome-list', tk.seller);
  check('GET /stock/outcome-list (seller)', [200], r.status, r.body);
  if (Array.isArray(r.body)) {
    const otherSellersData = r.body.filter(o => o.created_by !== byRole.seller.id);
    check('  seller sees only own outcomes', [true], otherSellersData.length === 0);
  }

  console.log('\n=== PRODUCT CRUD lifecycle ===');
  // Setup
  r = await request('POST', '/types', tk.cashier, { name_ru: 'SmokeType', name_uz: 'SmokeType' });
  check('POST /types', [200], r.status, r.body);
  const typeId = r.body?.id;

  r = await request('POST', '/products/generate-barcode', tk.cashier);
  check('POST /products/generate-barcode', [200], r.status, r.body);
  const barcode = r.body?.barcode;

  r = await request('POST', '/products', tk.cashier, {
    name_ru: 'SmokeProduct', type_id: typeId, barcode, unit: 'шт', price_buy: 100, price_sell: 200,
  });
  check('POST /products (cashier)', [200], r.status, r.body);
  const pid = r.body?.id;

  if (pid) {
    r = await request('PUT', `/products/${pid}`, tk.manager, {
      name_ru: 'Edited', type_id: typeId, barcode, unit: 'шт', price_buy: 110, price_sell: 220,
    });
    check('PUT /products/:id (manager)', [200], r.status, r.body);

    r = await request('POST', '/stock/income', tk.cashier, { product_id: pid, quantity: 5, price: 100 });
    check('POST /stock/income', [200], r.status, r.body);

    r = await request('POST', '/stock/outcome', tk.seller, { product_id: pid, quantity: 1, price: 200 });
    check('POST /stock/outcome (seller auto-approve)', [200], r.status, r.body);
    check('  seller outcome status=approved', [true], r.body?.status === 'approved');
    const outcomeId = r.body?.id;
    // Verify cash_income was auto-created for the sale
    if (outcomeId) {
      const { rows: cashRows } = await pool.query('SELECT amount FROM cash_income WHERE outcome_id=$1', [outcomeId]);
      check('  cash_income auto-created from sale', [true], cashRows.length === 1 && parseFloat(cashRows[0].amount) === 200);
    }

    // Cashier outcome must be PENDING (waiting for warehouse approval)
    const cr = await request('POST', '/stock/outcome', tk.cashier, { product_id: pid, quantity: 1, price: 200 });
    check('POST /stock/outcome (cashier)', [200], cr.status, cr.body);
    check('  cashier outcome status=pending', [true], cr.body?.status === 'pending');
    // No cash_income should be created yet (pending)
    if (cr.body?.id) {
      const before = await pool.query('SELECT COUNT(*) FROM cash_income WHERE outcome_id=$1', [cr.body.id]);
      check('  no cash on pending outcome', [true], parseInt(before.rows[0].count) === 0);
      // Approve via warehouse (or manager)
      const ap = await request('PUT', `/stock/outcome/${cr.body.id}/approve`, tk.manager, { action: 'approve' });
      check('  approve outcome (manager)', [200], ap.status, ap.body);
      const after = await pool.query('SELECT amount FROM cash_income WHERE outcome_id=$1', [cr.body.id]);
      check('  cash_income created on approve', [true], after.rows.length === 1 && parseFloat(after.rows[0].amount) === 200);
      // Delete the outcome → cash_income should cascade
      await request('DELETE', `/stock/outcome/${cr.body.id}`, tk.admin);
      const gone = await pool.query('SELECT COUNT(*) FROM cash_income WHERE outcome_id=$1', [cr.body.id]);
      check('  cash_income cascaded on outcome delete', [true], parseInt(gone.rows[0].count) === 0);
    }

    if (outcomeId) {
      // Edit outcome
      r = await request('PUT', `/stock/outcome/${outcomeId}`, tk.cashier, { quantity: 2, price: 250, note: 'edited' });
      check('PUT /stock/outcome/:id (cashier edit)', [200], r.status, r.body);
      // Delete outcome (should restock if approved)
      r = await request('DELETE', `/stock/outcome/${outcomeId}`, tk.cashier);
      check('DELETE /stock/outcome/:id (cashier delete)', [200], r.status, r.body);
    }

    await request('DELETE', `/products/${pid}`, tk.admin);
  }
  if (typeId) await request('DELETE', `/types/${typeId}`, tk.admin);

  console.log('\n=== CASH CATEGORIES ===');
  check('GET /cash/categories?type=income (cashier)', [200], (await request('GET', '/cash/categories?type=income', tk.cashier)).status);
  check('GET /cash/categories?type=bad (400)', [400], (await request('GET', '/cash/categories?type=bad', tk.cashier)).status);
  r = await request('POST', '/cash/categories', tk.cashier, { name: 'SmokeCat_' + Date.now(), type: 'income' });
  check('POST /cash/categories (cashier)', [200], r.status, r.body);
  const catId = r.body?.id;
  check('POST /cash/categories without name → 400', [400], (await request('POST', '/cash/categories', tk.cashier, { type: 'income' })).status);
  if (catId) {
    check('DELETE /cash/categories/:id (own branch)', [200], (await request('DELETE', `/cash/categories/${catId}`, tk.cashier)).status);
  }

  console.log('\n=== CASH ===');
  check('GET /cash/balance', [200], (await request('GET', '/cash/balance', tk.cashier)).status);
  r = await request('POST', '/cash/income', tk.cashier, { amount: 100, description: 'smoke' });
  check('POST /cash/income', [200], r.status, r.body);
  const cinc = r.body?.id;
  r = await request('POST', '/cash/expense', tk.cashier, { amount: 50, description: 'smoke' });
  check('POST /cash/expense', [200], r.status, r.body);
  const cexp = r.body?.id;
  if (cinc) await pool.query('DELETE FROM cash_income WHERE id=$1', [cinc]);
  if (cexp) await pool.query('DELETE FROM cash_expense WHERE id=$1', [cexp]);

  console.log('\n=== TEAM KPI ===');
  check('GET /team/kpi (manager)',  [200], (await request('GET', '/team/kpi', tk.manager)).status);
  check('GET /team/kpi (gen_dir)',  [200], (await request('GET', '/team/kpi', tk.gen_dir)).status);
  check('GET /team/kpi (admin denied)',  [403], (await request('GET', '/team/kpi', tk.admin)).status);
  check('GET /team/kpi (cashier 403)',   [403], (await request('GET', '/team/kpi', tk.cashier)).status);
  check('GET /team/kpi (seller 403)',    [403], (await request('GET', '/team/kpi', tk.seller)).status);
  r = await request('GET', '/team/kpi', tk.manager);
  if (Array.isArray(r.body) && r.body.length > 0) {
    check('  team/kpi rows have revenue field', [true], r.body[0].revenue !== undefined);
    check('  team/kpi rows have sales_count',   [true], r.body[0].sales_count !== undefined);
  }
  // Regression: date-range params must not 500 (placeholder-index collision bug)
  {
    const yesterday = new Date(Date.now() - 24*3600*1000).toISOString();
    const now = new Date().toISOString();
    const qs = `?from=${encodeURIComponent(yesterday)}&to=${encodeURIComponent(now)}`;
    check('GET /team/kpi?from&to (manager)', [200], (await request('GET', '/team/kpi' + qs, tk.manager)).status);
    check('GET /team/kpi?from&to (gen_dir)', [200], (await request('GET', '/team/kpi' + qs, tk.gen_dir)).status);
  }

  console.log('\n=== SETTLEMENT (seller → cashier handover) ===');
  check('GET /cash/settlement/pending (cashier)', [200], (await request('GET', '/cash/settlement/pending', tk.cashier)).status);
  check('GET /cash/settlement/pending (seller denied)', [403], (await request('GET', '/cash/settlement/pending', tk.seller)).status);
  check('GET /cash/settlement/my (seller)', [200], (await request('GET', '/cash/settlement/my', tk.seller)).status);
  // Seller sale creates UNSETTLED cash_income
  // (verified via the typeId/pid product lifecycle above — auto cash_income test already runs)

  console.log('\n=== PROFIT / DASHBOARD ===');
  check('GET /cash/profit (manager)', [200], (await request('GET', '/cash/profit', tk.manager)).status);
  check('GET /cash/profit (cashier denied)', [403], (await request('GET', '/cash/profit', tk.cashier)).status);
  check('GET /company/dashboard (gen_dir)', [200], (await request('GET', '/company/dashboard', tk.gen_dir)).status);

  console.log('\n=== GEN_DIR UNIQUENESS ===');
  // Try to create a 2nd gen_dir for company 1 (should already have aziz)
  r = await request('POST', '/users', tk.admin, {
    username: 'dup_gendir_' + Date.now(), password: 'pwd1234',
    role: 'gen_dir', company_id: 1, first_name: 'Dup', last_name: 'GenDir',
  });
  check('POST /users 2nd gen_dir → 409 conflict', [409], r.status, r.body);

  console.log('\n=== USER MGMT lifecycle ===');
  r = await request('POST', '/users', tk.admin, {
    username: 'smoke_' + Date.now(), password: 'pwd1234', role: 'cashier',
    company_id: 1, branch_id: 1, first_name: 'Smk', last_name: 'Tst',
  });
  check('POST /users (admin)', [200], r.status, r.body);
  const uid = r.body?.id;
  if (uid) {
    r = await request('PUT', `/users/${uid}`, tk.admin, { role: 'warehouse', company_id: 1, branch_id: 1 });
    check('PUT /users/:id (role change logged)', [200], r.status, r.body);
    r = await request('PUT', `/users/${uid}/block`, tk.admin, { is_blocked: true });
    check('PUT /users/:id/block', [200], r.status, r.body);
    r = await request('POST', '/users/reset-password', tk.gen_dir, { user_id: uid, password: 'newpwd' });
    check('POST /users/reset-password (gen_dir)', [200], r.status, r.body);
    r = await request('DELETE', `/users/${uid}`, tk.admin);
    check('DELETE /users/:id (admin)', [200, 204], r.status, r.body);
  }

  console.log('\n========================================');
  console.log(`PASSED: ${results.pass}  FAILED: ${results.fail}`);
  if (results.fail > 0) { console.log('\nFailures:'); results.errors.forEach(e => console.log(e)); }
  console.log('========================================');

  await pool.end();
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); pool.end(); process.exit(2); });
