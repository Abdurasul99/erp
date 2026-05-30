// Stress test: load 300k products + run sales + measure throughput.
// Run on server: cd /var/www/wareapp/backend && node test/stress.test.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024_xk9q';
const PORT = process.env.PORT || 3001;
const TARGET_PRODUCTS = parseInt(process.env.STRESS_PRODUCTS || '300000');
const SALES_COUNT     = parseInt(process.env.STRESS_SALES    || '1000');
const CONCURRENCY     = parseInt(process.env.STRESS_CONCURRENCY || '20');

const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS || 'Wareapp2024!',
  host: process.env.DB_HOST || 'localhost', port: 5432, max: 30,
});

const log = (...a) => console.log(new Date().toISOString().slice(11,23), ...a);
const fmt = (n) => n.toLocaleString().padStart(10);

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

async function timed(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  log(`⏱  ${label.padEnd(48)} ${fmt(ms)} ms`);
  return { ms, result };
}

async function bulkLoadProducts(branchId, typeId, n) {
  // Use multi-row INSERT in chunks of 1000
  const CHUNK = 1000;
  log(`Loading ${fmt(n)} products into branch ${branchId}...`);
  const t0 = Date.now();
  for (let i = 0; i < n; i += CHUNK) {
    const batch = Math.min(CHUNK, n - i);
    const values = [];
    const params = [];
    for (let j = 0; j < batch; j++) {
      const idx = i + j;
      const k = params.length;
      values.push(`($${k+1},$${k+2},$${k+3},$${k+4},$${k+5},$${k+6},$${k+7},$${k+8})`);
      const barcode = `999${String(idx).padStart(10, '0')}`;
      const buy = 100 + (idx % 5000);
      const sell = buy + 50 + (idx % 1000);
      params.push(`StressProduct_${idx}`, `StressProduct_${idx}`, typeId, barcode, 'шт', buy, sell, branchId);
    }
    await pool.query(
      `INSERT INTO products (name_ru, name_uz, type_id, barcode, unit, price_buy, price_sell, branch_id) VALUES ${values.join(',')} RETURNING id`,
      params
    );
    if ((i + batch) % 10000 === 0 || i + batch === n) {
      const elapsed = Date.now() - t0;
      const rate = Math.round((i + batch) / (elapsed / 1000));
      log(`  inserted ${fmt(i + batch)}/${fmt(n)}  (${fmt(rate)} rows/sec)`);
    }
  }
  // Bulk-create product_stock rows with random initial qty 10..100
  log('Creating product_stock rows...');
  await pool.query(`
    INSERT INTO product_stock (product_id, quantity)
    SELECT id, 10 + (random()*90)::int FROM products
    WHERE name_ru LIKE 'StressProduct_%'
    ON CONFLICT DO NOTHING
  `);
  return Date.now() - t0;
}

async function benchmark(label, token, branchId) {
  log(`\n=== ${label} ===`);
  const results = {};

  // Read benchmarks
  results.listAll      = (await timed('GET /products (full list)',         () => request('GET', '/products', token))).ms;
  results.searchName   = (await timed('GET /products?search=Stress (ILIKE)', () => request('GET', '/products?search=Stress', token))).ms;
  results.barcodeHit   = (await timed('GET /products?barcode=<exact> (point)', () => request('GET', `/products?barcode=999${String(100).padStart(10,'0')}`, token))).ms;
  results.barcodeMiss  = (await timed('GET /products?barcode=<miss>',       () => request('GET', '/products?barcode=NONEXISTENT_BARCODE', token))).ms;
  results.balance      = (await timed('GET /stock/balance',                 () => request('GET', '/stock/balance', token))).ms;
  results.outcomeList  = (await timed('GET /stock/outcome-list',            () => request('GET', '/stock/outcome-list', token))).ms;
  results.incomeList   = (await timed('GET /stock/income-list',             () => request('GET', '/stock/income-list', token))).ms;
  results.cashBalance  = (await timed('GET /cash/balance',                  () => request('GET', '/cash/balance', token))).ms;

  return results;
}

async function bulkSell(token, branchId, count, concurrency) {
  log(`\nRunning ${fmt(count)} sales (concurrency ${concurrency})...`);
  const { rows } = await pool.query(
    `SELECT id FROM products WHERE branch_id=$1 AND name_ru LIKE 'StressProduct_%' LIMIT $2`,
    [branchId, count]
  );
  if (rows.length < count) {
    log(`  WARNING: only ${rows.length} products available`);
  }
  const t0 = Date.now();
  let ok = 0, fail = 0;
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < rows.length) {
      const idx = next++;
      const pid = rows[idx].id;
      const r = await request('POST', '/stock/outcome', token, { product_id: pid, quantity: 1, price: 500 });
      if (r.status === 200) ok++; else fail++;
    }
  }));
  const ms = Date.now() - t0;
  log(`  ${ok} ok, ${fail} failed in ${ms}ms = ${Math.round(ok / (ms/1000))} sales/sec`);
  return { ok, fail, ms };
}

async function cleanup(branchId) {
  log('\nCleaning up test data...');
  // Delete sales for stress products (cascades cash_income)
  await pool.query(`
    DELETE FROM stock_outcome WHERE product_id IN
      (SELECT id FROM products WHERE name_ru LIKE 'StressProduct_%')
  `);
  await pool.query(`
    DELETE FROM stock_income WHERE product_id IN
      (SELECT id FROM products WHERE name_ru LIKE 'StressProduct_%')
  `);
  await pool.query(`
    DELETE FROM product_stock WHERE product_id IN
      (SELECT id FROM products WHERE name_ru LIKE 'StressProduct_%')
  `);
  await pool.query(`DELETE FROM products WHERE name_ru LIKE 'StressProduct_%'`);
  log('  cleanup done');
}

async function addIndexes() {
  log('\nAdding production indexes...');
  const stmts = [
    'CREATE INDEX IF NOT EXISTS idx_products_branch_id           ON products(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_name_ru_lower       ON products(LOWER(name_ru) text_pattern_ops)',
    'CREATE INDEX IF NOT EXISTS idx_stock_outcome_branch_id      ON stock_outcome(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_outcome_product_id     ON stock_outcome(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_outcome_status         ON stock_outcome(status) WHERE status = \'pending\'',
    'CREATE INDEX IF NOT EXISTS idx_stock_outcome_created_at     ON stock_outcome(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_stock_income_branch_id       ON stock_income(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_income_product_id      ON stock_income(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_stock_income_created_at      ON stock_income(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_cash_income_branch_id        ON cash_income(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_cash_income_outcome_id       ON cash_income(outcome_id)',
    'CREATE INDEX IF NOT EXISTS idx_cash_income_created_at       ON cash_income(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_cash_expense_branch_id       ON cash_expense(branch_id)',
    'CREATE INDEX IF NOT EXISTS idx_cash_expense_created_at      ON cash_expense(created_at DESC)',
  ];
  for (const s of stmts) {
    const t0 = Date.now();
    await pool.query(s);
    log(`  ${s.substring(0, 70)}... (${Date.now() - t0}ms)`);
  }
  log('  ANALYZE for query planner...');
  await pool.query('ANALYZE');
}

async function run() {
  // Setup: pick a cashier token and ensure a type exists
  const { rows: users } = await pool.query("SELECT * FROM users WHERE role IN ('seller','cashier') ORDER BY id");
  const cashier = users.find(u => u.role === 'cashier');
  const seller  = users.find(u => u.role === 'seller');
  if (!cashier || !seller) { console.error('Need cashier and seller users'); process.exit(1); }
  const branchId = cashier.branch_id;
  const sellerToken = jwt.sign({ id: seller.id, username: seller.username, role: 'seller', company_id: seller.company_id, branch_id: seller.branch_id }, JWT_SECRET);
  const cashierToken = jwt.sign({ id: cashier.id, username: cashier.username, role: 'cashier', company_id: cashier.company_id, branch_id: cashier.branch_id }, JWT_SECRET);

  let typeId;
  const ex = await pool.query("SELECT id FROM product_types LIMIT 1");
  if (ex.rows[0]) typeId = ex.rows[0].id;
  else {
    const r = await pool.query("INSERT INTO product_types (name_ru, name_uz) VALUES ('StressType','StressType') RETURNING id");
    typeId = r.rows[0].id;
  }

  log(`Branch: ${branchId}, Cashier: @${cashier.username}, Seller: @${seller.username}`);
  log(`Target: ${fmt(TARGET_PRODUCTS)} products, ${fmt(SALES_COUNT)} sales\n`);

  // Step 1: Bulk load
  const loadMs = await bulkLoadProducts(branchId, typeId, TARGET_PRODUCTS);
  log(`Load done in ${(loadMs/1000).toFixed(1)}s (${Math.round(TARGET_PRODUCTS / (loadMs/1000))} rows/sec)`);

  // Step 2: Baseline benchmark (no extra indexes yet)
  const baseline = await benchmark('BASELINE — no extra indexes', cashierToken, branchId);

  // Step 3: Add indexes
  await addIndexes();

  // Step 4: Post-index benchmark
  const optimized = await benchmark('OPTIMIZED — after adding indexes', cashierToken, branchId);

  // Step 5: Sales throughput (writes)
  const sales = await bulkSell(sellerToken, branchId, SALES_COUNT, CONCURRENCY);

  // Step 6: Final read benchmark (with data churn)
  const afterSales = await benchmark('AFTER SALES — reads under load', cashierToken, branchId);

  // Step 7: Cleanup
  await cleanup(branchId);

  // Summary
  log('\n╔════════════════════════════════════════════════════════════════╗');
  log('║                         DIAGNOSIS                              ║');
  log('╚════════════════════════════════════════════════════════════════╝');
  log(`Bulk load:        ${TARGET_PRODUCTS.toLocaleString()} products in ${(loadMs/1000).toFixed(1)}s = ${Math.round(TARGET_PRODUCTS/(loadMs/1000))} rows/sec`);
  log(`Sales throughput: ${sales.ok} of ${sales.ok+sales.fail} ok in ${(sales.ms/1000).toFixed(1)}s = ${Math.round(sales.ok/(sales.ms/1000))} sales/sec`);
  log('\nRead latency (ms):');
  log('Query                                            BASELINE   OPTIMIZED   AFTER-SALES');
  const queries = ['listAll','searchName','barcodeHit','barcodeMiss','balance','outcomeList','incomeList','cashBalance'];
  for (const q of queries) {
    log(`${q.padEnd(48)} ${String(baseline[q]).padStart(8)}    ${String(optimized[q]).padStart(8)}    ${String(afterSales[q]).padStart(8)}`);
  }

  await pool.end();
  log('\nDONE');
}

run().catch(e => { console.error('FATAL:', e); pool.end(); process.exit(1); });
