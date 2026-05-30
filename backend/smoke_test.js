// Comprehensive API smoke test — hits every endpoint as every role
// Run on server with: cd /var/www/wareapp/backend && node smoke_test.js
require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024_xk9q';
const PORT = process.env.PORT || 3001;
const HOST = 'localhost';

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
    const opts = {
      host: HOST, port: PORT, path: '/api' + path, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', e => resolve({ status: 0, body: { error: e.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function makeToken(user) {
  return jwt.sign({
    id: user.id, username: user.username, role: user.role,
    company_id: user.company_id, branch_id: user.branch_id,
  }, JWT_SECRET);
}

function check(name, expected, actual, body) {
  const ok = expected.includes(actual);
  if (ok) {
    results.pass++;
    console.log(`  ✓ ${name} → ${actual}`);
  } else {
    results.fail++;
    const err = `  ✗ ${name} → ${actual} (expected ${expected.join('|')}) ${body?.error ? '— ' + body.error : ''}`;
    console.log(err);
    results.errors.push(err);
  }
}

async function run() {
  // Load users
  const { rows: users } = await pool.query('SELECT * FROM users ORDER BY id');
  const byRole = Object.fromEntries(users.map(u => [u.role, u]));
  const tokens = Object.fromEntries(users.map(u => [u.role, makeToken(u)]));

  if (!byRole.admin || !byRole.cashier || !byRole.seller || !byRole.manager || !byRole.gen_dir) {
    console.log('Missing required test users. Have:', Object.keys(byRole).join(', '));
    process.exit(1);
  }

  console.log('\n=== AUTH ===');
  let r;
  r = await request('GET', '/health'); check('GET /health', [200], r.status);
  r = await request('GET', '/users', null); check('GET /users (no token)', [401], r.status);

  console.log('\n=== COMPANIES ===');
  r = await request('GET', '/companies', tokens.admin); check('GET /companies (admin)', [200], r.status);
  r = await request('GET', '/companies', tokens.gen_dir); check('GET /companies (gen_dir)', [200], r.status);
  r = await request('GET', '/companies', tokens.manager); check('GET /companies (manager)', [200], r.status);
  r = await request('GET', '/companies', tokens.cashier); check('GET /companies (cashier)', [403], r.status);
  r = await request('GET', '/companies', tokens.seller); check('GET /companies (seller)', [403], r.status);

  console.log('\n=== BRANCHES ===');
  r = await request('GET', '/branches', tokens.admin); check('GET /branches (admin)', [200], r.status);
  r = await request('GET', '/branches', tokens.gen_dir); check('GET /branches (gen_dir)', [200], r.status);
  r = await request('GET', '/branches', tokens.cashier); check('GET /branches (cashier)', [200], r.status);
  r = await request('GET', '/branches', tokens.seller); check('GET /branches (seller)', [200], r.status);

  console.log('\n=== USERS ===');
  r = await request('GET', '/users', tokens.admin); check('GET /users (admin)', [200], r.status);
  if (r.body[0]) check('  user has created_by_name field', [true], 'created_by_name' in r.body[0]);
  r = await request('GET', '/users', tokens.gen_dir); check('GET /users (gen_dir)', [200], r.status);
  r = await request('GET', '/users', tokens.manager); check('GET /users (manager)', [200], r.status);
  r = await request('GET', '/users', tokens.cashier); check('GET /users (cashier)', [403], r.status);

  console.log('\n=== ROLE CHANGE LOG ===');
  r = await request('GET', '/role-change-log', tokens.admin); check('GET /role-change-log (admin)', [200], r.status, r.body);
  r = await request('GET', '/role-change-log', tokens.gen_dir); check('GET /role-change-log (gen_dir)', [403], r.status);

  console.log('\n=== PRODUCTS ===');
  r = await request('GET', '/products', tokens.admin); check('GET /products (admin)', [200], r.status);
  r = await request('GET', '/products', tokens.cashier); check('GET /products (cashier)', [200], r.status);
  r = await request('GET', '/products', tokens.seller); check('GET /products (seller)', [200], r.status);
  r = await request('GET', '/products?search=test', tokens.cashier); check('GET /products?search', [200], r.status);

  console.log('\n=== PRODUCT TYPES ===');
  r = await request('GET', '/types', tokens.admin); check('GET /types (admin)', [200], r.status);
  r = await request('GET', '/types', tokens.cashier); check('GET /types (cashier)', [200], r.status);
  r = await request('POST', '/types', tokens.cashier, { name_ru: 'TestType1', name_uz: 'TestType1' });
  check('POST /types (cashier)', [200], r.status, r.body);
  const typeId = r.body?.id;

  console.log('\n=== STOCK BALANCE ===');
  r = await request('GET', '/stock/balance', tokens.admin); check('GET /stock/balance (admin)', [200], r.status, r.body);
  r = await request('GET', '/stock/balance', tokens.cashier); check('GET /stock/balance (cashier)', [200], r.status, r.body);
  r = await request('GET', '/stock/balance', tokens.manager); check('GET /stock/balance (manager)', [200], r.status, r.body);

  console.log('\n=== STOCK PENDING ===');
  r = await request('GET', '/stock/pending', tokens.admin); check('GET /stock/pending (admin)', [200], r.status, r.body);
  r = await request('GET', '/stock/pending', tokens.cashier); check('GET /stock/pending (cashier)', [200], r.status, r.body);
  r = await request('GET', '/stock/pending', tokens.manager); check('GET /stock/pending (manager)', [200], r.status, r.body);
  r = await request('GET', '/stock/pending', tokens.warehouse || tokens.seller); check('GET /stock/pending (seller)', [403], r.status);

  console.log('\n=== STOCK INCOME / OUTCOME LIST ===');
  r = await request('GET', '/stock/income-list', tokens.cashier); check('GET /stock/income-list', [200], r.status, r.body);
  r = await request('GET', '/stock/outcome-list', tokens.cashier); check('GET /stock/outcome-list', [200], r.status, r.body);

  console.log('\n=== PRODUCT CREATE / EDIT (cashier) ===');
  r = await request('POST', '/products/generate-barcode', tokens.cashier);
  check('POST /products/generate-barcode', [200], r.status, r.body);
  const barcode = r.body?.barcode;

  r = await request('POST', '/products', tokens.cashier, {
    name_ru: 'SmokeTestProduct', name_uz: 'SmokeTestProduct',
    type_id: typeId, barcode, unit: 'шт', price_buy: 1000, price_sell: 1500,
  });
  check('POST /products (cashier)', [200], r.status, r.body);
  const productId = r.body?.id;

  if (productId) {
    r = await request('GET', `/products/${productId}`, tokens.cashier);
    check('GET /products/:id', [200], r.status, r.body);

    r = await request('PUT', `/products/${productId}`, tokens.cashier, {
      name_ru: 'SmokeTestProductEdited', name_uz: 'SmokeTestProductEdited',
      type_id: typeId, barcode, unit: 'шт', price_buy: 1200, price_sell: 1800,
    });
    check('PUT /products/:id (cashier)', [200], r.status, r.body);

    r = await request('PUT', `/products/${productId}`, tokens.manager, {
      name_ru: 'EditedByMgr', name_uz: 'EditedByMgr',
      type_id: typeId, barcode, unit: 'шт', price_buy: 1200, price_sell: 1800,
    });
    check('PUT /products/:id (manager)', [200], r.status, r.body);

    console.log('\n=== STOCK INCOME ===');
    r = await request('POST', '/stock/income', tokens.cashier, {
      product_id: productId, quantity: 10, price: 1000, supplier: 'Test',
    });
    check('POST /stock/income', [200], r.status, r.body);

    console.log('\n=== STOCK OUTCOME (auto-approved for cashier) ===');
    r = await request('POST', '/stock/outcome', tokens.cashier, {
      product_id: productId, quantity: 2, price: 1500,
    });
    check('POST /stock/outcome (cashier auto-approve)', [200], r.status, r.body);

    console.log('\n=== STOCK OUTCOME (seller auto-approved) ===');
    r = await request('POST', '/stock/outcome', tokens.seller, {
      product_id: productId, quantity: 1, price: 1500,
    });
    check('POST /stock/outcome (seller auto-approve)', [200], r.status, r.body);

    // Cleanup
    r = await request('DELETE', `/products/${productId}`, tokens.admin);
    check('DELETE /products/:id (admin)', [200, 204], r.status, r.body);
  }

  if (typeId) {
    r = await request('DELETE', `/types/${typeId}`, tokens.admin);
    check('DELETE /types/:id (admin)', [200, 204], r.status, r.body);
  }

  console.log('\n=== CASH ===');
  r = await request('GET', '/cash/balance', tokens.cashier); check('GET /cash/balance (cashier)', [200], r.status, r.body);
  r = await request('GET', '/cash/balance', tokens.manager); check('GET /cash/balance (manager)', [200], r.status, r.body);
  r = await request('POST', '/cash/income', tokens.cashier, { amount: 5000, description: 'smoke test' });
  check('POST /cash/income', [200], r.status, r.body);
  const cashIncId = r.body?.id;
  r = await request('POST', '/cash/expense', tokens.cashier, { amount: 1000, description: 'smoke test' });
  check('POST /cash/expense', [200], r.status, r.body);
  const cashExpId = r.body?.id;
  // Cleanup cash records via DB to avoid leaving test data
  if (cashIncId) await pool.query('DELETE FROM cash_income WHERE id=$1', [cashIncId]);
  if (cashExpId) await pool.query('DELETE FROM cash_expense WHERE id=$1', [cashExpId]);

  console.log('\n=== COMPANY DASHBOARD ===');
  r = await request('GET', '/company/dashboard', tokens.gen_dir);
  check('GET /company/dashboard (gen_dir)', [200], r.status, r.body);
  r = await request('GET', '/company/dashboard', tokens.admin);
  check('GET /company/dashboard (admin)', [200], r.status, r.body);

  console.log('\n=== CASH PROFIT ===');
  r = await request('GET', '/cash/profit', tokens.manager); check('GET /cash/profit (manager)', [200], r.status, r.body);
  r = await request('GET', '/cash/profit', tokens.gen_dir); check('GET /cash/profit (gen_dir)', [200], r.status, r.body);
  r = await request('GET', '/cash/profit', tokens.cashier); check('GET /cash/profit (cashier)', [403], r.status, r.body);

  console.log('\n=== USER MANAGEMENT (admin) ===');
  r = await request('POST', '/users', tokens.admin, {
    username: 'smoke_test_user_' + Date.now(),
    password: 'test1234', role: 'cashier', company_id: 1, branch_id: 1,
    first_name: 'Smoke', last_name: 'Test',
  });
  check('POST /users (admin)', [200], r.status, r.body);
  const newUserId = r.body?.id;

  if (newUserId) {
    r = await request('PUT', `/users/${newUserId}`, tokens.admin, {
      role: 'warehouse', company_id: 1, branch_id: 1,
      first_name: 'Smoke', last_name: 'Test',
    });
    check('PUT /users/:id (admin, role change → log entry)', [200], r.status, r.body);

    r = await request('PUT', `/users/${newUserId}/block`, tokens.admin, { is_blocked: true });
    check('PUT /users/:id/block (admin)', [200], r.status, r.body);

    r = await request('POST', '/users/reset-password', tokens.admin, {
      user_id: newUserId, password: 'newpass1234',
    });
    check('POST /users/reset-password (admin)', [200], r.status, r.body);

    r = await request('POST', '/users/reset-password', tokens.gen_dir, {
      user_id: newUserId, password: 'newpass5678',
    });
    check('POST /users/reset-password (gen_dir)', [200], r.status, r.body);

    r = await request('DELETE', `/users/${newUserId}`, tokens.admin);
    check('DELETE /users/:id (admin)', [200, 204], r.status, r.body);
  }

  console.log('\n=========================================');
  console.log(`PASSED: ${results.pass}  FAILED: ${results.fail}`);
  if (results.fail > 0) {
    console.log('\nFailures:');
    results.errors.forEach(e => console.log(e));
  }
  console.log('=========================================');

  await pool.end();
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(2); });
