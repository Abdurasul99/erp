// Stress test #2 — 100k products + many stock incomes via API + bug hunt.
// Tests data integrity, concurrency, edge cases, and pagination boundaries.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024_xk9q';
const PORT = process.env.PORT || 3001;
const TARGET_PRODUCTS = 100000;
const INCOMES_VIA_API = 2000;   // real API calls
const CONCURRENT_SAME_PRODUCT = 50; // race-condition test
const CONCURRENCY = 20;

const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS || 'Wareapp2024!',
  host: process.env.DB_HOST || 'localhost', port: 5432, max: 50,
});

const log = (...a) => console.log(new Date().toISOString().slice(11,23), ...a);
const fmt = (n) => Number(n).toLocaleString().padStart(10);

let bugs = []; // collect bug findings here
const bug = (msg) => { bugs.push(msg); log('🐛 BUG:', msg); };
let passes = 0;
const pass = (msg) => { passes++; log('✓', msg); };

function request(method, path, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { host: 'localhost', port: PORT, path: '/api' + path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const t0 = Date.now();
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { let p; try { p = JSON.parse(d); } catch { p = d; } resolve({ status: res.statusCode, body: p, ms: Date.now() - t0 }); });
    });
    req.on('error', e => resolve({ status: 0, body: { error: e.message }, ms: Date.now() - t0 }));
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Setup
  const { rows: users } = await pool.query("SELECT * FROM users WHERE role IN ('cashier','warehouse','seller','manager') ORDER BY id");
  const cashier = users.find(u => u.role === 'cashier');
  const warehouse = users.find(u => u.role === 'warehouse') || cashier;
  const seller = users.find(u => u.role === 'seller');
  const manager = users.find(u => u.role === 'manager');
  if (!cashier || !seller) { console.error('Need cashier and seller'); process.exit(1); }

  const tokenFor = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role, company_id: u.company_id, branch_id: u.branch_id }, JWT_SECRET);
  const tk = {
    cashier: tokenFor(cashier),
    warehouse: tokenFor(warehouse),
    seller: tokenFor(seller),
    manager: tokenFor(manager),
  };

  const branchId = cashier.branch_id;
  const { rows: typeRows } = await pool.query("SELECT id FROM product_types LIMIT 1");
  const typeId = typeRows[0]?.id;

  log(`╔════════════════════════════════════════════════════════╗`);
  log(`║      STRESS TEST #2 — ${TARGET_PRODUCTS.toLocaleString()} products + bug hunt       ║`);
  log(`╚════════════════════════════════════════════════════════╝`);

  // === STEP 1: Bulk load products ===
  log(`\n[1/6] Loading ${fmt(TARGET_PRODUCTS)} products...`);
  const tLoad = Date.now();
  const CHUNK = 1000;
  for (let i = 0; i < TARGET_PRODUCTS; i += CHUNK) {
    const batch = Math.min(CHUNK, TARGET_PRODUCTS - i);
    const values = [], params = [];
    for (let j = 0; j < batch; j++) {
      const idx = i + j;
      const k = params.length;
      values.push(`($${k+1},$${k+2},$${k+3},$${k+4},$${k+5},$${k+6},$${k+7},$${k+8})`);
      params.push(`Stress2_${idx}`, `Stress2_${idx}`, typeId, `888${String(idx).padStart(10,'0')}`, 'шт', 100 + (idx % 5000), 200 + (idx % 5000), branchId);
    }
    await pool.query(
      `INSERT INTO products (name_ru, name_uz, type_id, barcode, unit, price_buy, price_sell, branch_id) VALUES ${values.join(',')}`,
      params
    );
  }
  await pool.query("INSERT INTO product_stock (product_id, quantity) SELECT id, 0 FROM products WHERE name_ru LIKE 'Stress2_%' ON CONFLICT DO NOTHING");
  log(`  Loaded ${fmt(TARGET_PRODUCTS)} products in ${((Date.now()-tLoad)/1000).toFixed(1)}s`);

  // === STEP 2: Bulk stock income via API ===
  log(`\n[2/6] Running ${fmt(INCOMES_VIA_API)} stock incomes via API (concurrency ${CONCURRENCY})...`);
  const { rows: pids } = await pool.query("SELECT id FROM products WHERE name_ru LIKE 'Stress2_%' LIMIT $1", [INCOMES_VIA_API]);
  const tInc = Date.now();
  let okI = 0, failI = 0;
  let nextI = 0;
  // Each income: random qty 1..20
  const incomes = pids.map((p, i) => ({ pid: p.id, qty: 1 + (i % 20) }));
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (nextI < incomes.length) {
      const job = incomes[nextI++];
      const r = await request('POST', '/stock/income', tk.warehouse, { product_id: job.pid, quantity: job.qty, price: 50 });
      if (r.status === 200) okI++; else failI++;
    }
  }));
  log(`  ${okI} ok, ${failI} failed in ${((Date.now()-tInc)/1000).toFixed(1)}s = ${Math.round(okI/((Date.now()-tInc)/1000))} ops/sec`);
  if (failI === 0) pass(`All ${okI} stock incomes succeeded`);
  else bug(`${failI} stock incomes failed`);

  // === STEP 3: Data integrity check ===
  log(`\n[3/6] Verifying data integrity (stock == sum(income))...`);
  const integrityCheck = await pool.query(`
    SELECT COUNT(*) AS mismatched FROM (
      SELECT p.id, ps.quantity AS actual,
             COALESCE((SELECT SUM(quantity) FROM stock_income WHERE product_id=p.id), 0) AS expected
      FROM products p JOIN product_stock ps ON p.id=ps.product_id
      WHERE p.name_ru LIKE 'Stress2_%' AND ps.quantity != COALESCE((SELECT SUM(quantity) FROM stock_income WHERE product_id=p.id), 0)
    ) m
  `);
  const mismatched = parseInt(integrityCheck.rows[0].mismatched);
  if (mismatched === 0) pass('All products: stock = sum(incomes) — integrity intact');
  else bug(`${mismatched} products have stock mismatch (stock != sum of incomes)`);

  // === STEP 4: Concurrency race test — same product, parallel updates ===
  log(`\n[4/6] Race test: ${CONCURRENT_SAME_PRODUCT} concurrent sales on ONE product...`);
  const racePid = pids[0].id;
  // Set stock to a known value
  await pool.query('UPDATE product_stock SET quantity = 1000 WHERE product_id=$1', [racePid]);
  const tRace = Date.now();
  let okR = 0, failR = 0;
  await Promise.all(Array.from({ length: CONCURRENT_SAME_PRODUCT }, async () => {
    const r = await request('POST', '/stock/outcome', tk.seller, { product_id: racePid, quantity: 1, price: 100 });
    if (r.status === 200) okR++; else failR++;
  }));
  const { rows: [{ quantity: finalStock }] } = await pool.query('SELECT quantity FROM product_stock WHERE product_id=$1', [racePid]);
  const expectedStock = 1000 - okR;
  log(`  ${okR} ok, ${failR} failed in ${Date.now()-tRace}ms; final stock=${finalStock} expected=${expectedStock}`);
  if (parseFloat(finalStock) === expectedStock) pass('No race condition — concurrent sales correctly decremented stock');
  else bug(`Race condition: expected stock ${expectedStock} but got ${finalStock} (lost ${expectedStock - parseFloat(finalStock)} units)`);

  // Verify cash_income count matches successful sales
  const { rows: cashRace } = await pool.query("SELECT COUNT(*) FROM cash_income WHERE description LIKE 'Продажа: Stress2_0 %'");
  if (parseInt(cashRace[0].count) === okR) pass(`cash_income count (${cashRace[0].count}) matches sales count (${okR})`);
  else bug(`cash_income count (${cashRace[0].count}) does NOT match sales (${okR})`);

  // === STEP 5: Edge cases ===
  log(`\n[5/6] Edge cases...`);
  // 5.1: zero quantity
  let r = await request('POST', '/stock/outcome', tk.seller, { product_id: racePid, quantity: 0, price: 100 });
  if (r.status === 200) bug(`Zero qty outcome was accepted (should be rejected)`);
  else pass(`Zero qty outcome rejected (${r.status})`);

  // 5.2: negative quantity
  r = await request('POST', '/stock/outcome', tk.seller, { product_id: racePid, quantity: -5, price: 100 });
  if (r.status === 200) bug(`Negative qty outcome was accepted`);
  else pass(`Negative qty outcome rejected (${r.status})`);

  // 5.3: outcome larger than stock (CHECK constraint should block)
  await pool.query('UPDATE product_stock SET quantity = 5 WHERE product_id=$1', [racePid]);
  r = await request('POST', '/stock/outcome', tk.seller, { product_id: racePid, quantity: 100, price: 100 });
  if (r.status === 200) bug(`Outcome exceeding stock was accepted (should fail CHECK constraint)`);
  else pass(`Outcome > stock blocked (${r.status})`);

  // 5.4: missing product_id
  r = await request('POST', '/stock/outcome', tk.seller, { quantity: 1, price: 100 });
  if (r.status === 200) bug(`Outcome without product_id accepted`);
  else pass(`Missing product_id rejected (${r.status})`);

  // 5.5: non-existent product_id
  r = await request('POST', '/stock/outcome', tk.seller, { product_id: 99999999, quantity: 1, price: 100 });
  if (r.status === 200) bug(`Outcome on non-existent product accepted`);
  else pass(`Non-existent product rejected (${r.status})`);

  // 5.6: SQL injection attempt in search (URL-encoded)
  r = await request('GET', '/products?search=' + encodeURIComponent("' OR 1=1--"), tk.cashier);
  if (r.status === 200 && Array.isArray(r.body) && r.body.length > 100) bug(`Possible SQL injection: search returned ${r.body.length} rows for OR 1=1`);
  else pass(`SQL injection attempt safe (${r.status}, ${Array.isArray(r.body) ? r.body.length : '?'} rows)`);

  // 5.7: huge limit attempt
  r = await request('GET', '/stock/balance?limit=999999999', tk.cashier);
  if (r.status === 200 && Array.isArray(r.body)) {
    if (r.body.length > 1100) bug(`/stock/balance returned ${r.body.length} rows, LIMIT cap not enforced`);
    else pass(`/stock/balance capped at ${r.body.length} rows (LIMIT 1000)`);
  } else bug(`/stock/balance failed: ${r.status}`);

  // 5.8: token from blocked user
  // Block a user, try their token, should get 401/403
  const tmpUserRes = await pool.query(
    `INSERT INTO users (username, password_hash, role, company_id, branch_id, is_blocked) VALUES ($1,$2,$3,$4,$5,true) RETURNING id, username, role, company_id, branch_id`,
    ['stress2_blocked_' + Date.now(), 'fakehash', 'cashier', 1, 1]
  );
  const blockedToken = jwt.sign({ id: tmpUserRes.rows[0].id, username: tmpUserRes.rows[0].username, role: 'cashier', company_id: 1, branch_id: 1 }, JWT_SECRET);
  r = await request('GET', '/auth/me', blockedToken);
  if (r.status === 403) pass(`Blocked user gets 403 on /auth/me`);
  else bug(`Blocked user got ${r.status} instead of 403 on /auth/me`);
  await pool.query('DELETE FROM users WHERE id=$1', [tmpUserRes.rows[0].id]);

  // === STEP 6: Read performance at scale ===
  log(`\n[6/6] Read performance under load (${TARGET_PRODUCTS.toLocaleString()} products)...`);
  const reads = {
    listProducts:   (await request('GET', '/products', tk.cashier)).ms,
    searchExact:    (await request('GET', '/products?search=Stress2_500', tk.cashier)).ms,
    searchPrefix:   (await request('GET', '/products?search=Stress2_99', tk.cashier)).ms,
    barcodeHit:     (await request('GET', '/products?barcode=8880000000500', tk.cashier)).ms,
    stockBalance:   (await request('GET', '/stock/balance', tk.cashier)).ms,
    outcomeList:    (await request('GET', '/stock/outcome-list', tk.cashier)).ms,
    incomeList:     (await request('GET', '/stock/income-list', tk.cashier)).ms,
    cashBalance:    (await request('GET', '/cash/balance', tk.cashier)).ms,
  };
  for (const [q, ms] of Object.entries(reads)) {
    const tag = ms < 200 ? '✓' : ms < 1000 ? '⚠' : '🐌';
    log(`  ${tag} ${q.padEnd(20)} ${ms}ms`);
    if (ms > 2000) bug(`${q} too slow: ${ms}ms`);
  }

  // === CLEANUP ===
  log(`\nCleaning up...`);
  const tClean = Date.now();
  await pool.query(`DELETE FROM stock_outcome WHERE product_id IN (SELECT id FROM products WHERE name_ru LIKE 'Stress2_%')`);
  await pool.query(`DELETE FROM stock_income  WHERE product_id IN (SELECT id FROM products WHERE name_ru LIKE 'Stress2_%')`);
  await pool.query(`DELETE FROM product_stock WHERE product_id IN (SELECT id FROM products WHERE name_ru LIKE 'Stress2_%')`);
  await pool.query(`DELETE FROM products WHERE name_ru LIKE 'Stress2_%'`);
  log(`  Cleanup done in ${((Date.now()-tClean)/1000).toFixed(1)}s`);

  // === REPORT ===
  log(`\n╔════════════════════════════════════════════════════════╗`);
  log(`║                       REPORT                            ║`);
  log(`╚════════════════════════════════════════════════════════╝`);
  log(`Passed: ${passes}`);
  log(`Bugs:   ${bugs.length}`);
  if (bugs.length > 0) {
    log(`\n🐛 BUGS FOUND:`);
    bugs.forEach((b, i) => log(`  ${i+1}. ${b}`));
  } else {
    log(`\n✅ NO BUGS FOUND at scale`);
  }

  await pool.end();
}

run().catch(e => { console.error('FATAL:', e); pool.end(); process.exit(1); });
