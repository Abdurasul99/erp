require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
// JWT_SECRET must come from env. Hard fail in production if it's missing or weak.
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_jwt_secret_2024_xk9q';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  console.error('FATAL: JWT_SECRET env var is required in production and must be ≥24 chars');
  process.exit(1);
}

process.env.TZ = 'Asia/Tashkent';

const pool = new Pool({
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'wareapp_user',
  password: process.env.DB_PASS || 'Wareapp2024!',
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
});

// Timezone set at DB level via ALTER DATABASE — no need for per-connection override

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Trust the first proxy (nginx) so rate-limit sees the real client IP
app.set('trust proxy', 1);

// Rate-limit on auth endpoints: 10 attempts / 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Подождите 15 минут.' },
});

// Audit helper — records a row in audit_log. Fire-and-forget (won't fail the request).
const audit = (req, action, entityType, entityId, oldValue, newValue) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  pool.query(
    `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.user?.id || null, req.user?.username || null, action, entityType, entityId,
     oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ip]
  ).catch(e => console.error('audit insert error', e.message));
};

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Only allow real image types — extension AND mime must both be in the allow-list.
// Prevents uploading .html/.svg with embedded JS that would be served as stored XSS
// from /uploads (which is served as static files).
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXT.has(ext) ? ext : '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + safeExt);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_EXT.has(ext) && ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Только изображения (jpg, png, webp, gif)'));
  },
});

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return { ok: false, error: 'Пароль минимум 8 символов и должен содержать букву и цифру' };
  if (!/[a-zA-Zа-яА-Я]/.test(pw) || !/[0-9]/.test(pw)) return { ok: false, error: 'Пароль минимум 8 символов и должен содержать букву и цифру' };
  return { ok: true };
}

const auth = (roles = []) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
  }
};

// Company-level roles: tied to company, not to a branch
const COMPANY_LEVEL_ROLES = new Set(['gen_dir', 'founder']);
const isCompanyLevel = (role) => COMPANY_LEVEL_ROLES.has(role);

// Helper: get branch_id filter for queries
// admin/founder/gen_dir can pass ?branch_id=X, others use their own branch_id.
// Seller can also pass branch_id (chosen at session start) — must be within own company;
// scope is enforced server-side in mutation endpoints via assertBranchInCompany.
function getBranchFilter(user, query = {}) {
  if (user.role === 'admin') return query.branch_id ? parseInt(query.branch_id) : null;
  if (isCompanyLevel(user.role)) return query.branch_id ? parseInt(query.branch_id) : null;
  if (user.role === 'seller' && query.branch_id) return parseInt(query.branch_id);
  return user.branch_id || null;
}

// Resolve the set of branch IDs the user is allowed to query.
// Returns { ids, restrictive } where `restrictive` means we MUST constrain by these ids
// (false only when admin queries unscoped across all tenants).
// Throws 403 if a query branch_id falls outside user's company.
async function getUserBranchIds(user, query = {}) {
  const qBranch = query.branch_id ? parseInt(query.branch_id, 10) : null;
  if (user.role === 'admin') {
    if (qBranch) return { ids: [qBranch], restrictive: true };
    return { ids: null, restrictive: false };
  }
  if (user.role === 'manager') {
    if (!user.branch_id) return { ids: [], restrictive: true };
    if (qBranch && qBranch !== user.branch_id) {
      const err = new Error('Out of branch scope'); err.statusCode = 403; throw err;
    }
    return { ids: [user.branch_id], restrictive: true };
  }
  // gen_dir / founder / cashier / warehouse / seller — scope to their company
  if (!user.company_id) return { ids: [], restrictive: true };
  if (qBranch) {
    const o = await pool.query('SELECT id FROM branches WHERE id = $1 AND company_id = $2', [qBranch, user.company_id]);
    if (!o.rows[0]) { const err = new Error('Branch not in your company'); err.statusCode = 403; throw err; }
    return { ids: [qBranch], restrictive: true };
  }
  const all = await pool.query('SELECT id FROM branches WHERE company_id = $1', [user.company_id]);
  return { ids: all.rows.map(r => r.id), restrictive: true };
}

// Guard: makes sure a branch belongs to the user's company. Used on writes by sellers.
async function assertBranchInCompany(user, branchId) {
  if (!branchId) return;
  if (user.role === 'admin') return;
  const { rows } = await pool.query('SELECT company_id FROM branches WHERE id = $1', [branchId]);
  if (rows.length === 0 || rows[0].company_id !== user.company_id) {
    const err = new Error('Branch not in your company');
    err.statusCode = 403;
    throw err;
  }
}

// === COMPANIES ===
app.get('/api/companies', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  let query = `
    SELECT c.*, u.username as created_by_name,
      (SELECT COUNT(*) FROM branches b WHERE b.company_id = c.id) as branch_count,
      (SELECT COUNT(*) FROM users u2 WHERE u2.company_id = c.id) as user_count
    FROM companies c LEFT JOIN users u ON c.created_by = u.id
  `;
  const params = [];
  // gen_dir and manager only see their own company
  if (isCompanyLevel(req.user.role) || req.user.role === 'manager') {
    query += ' WHERE c.id = $1';
    params.push(req.user.company_id);
  }
  query += ' ORDER BY c.created_at DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.post('/api/companies', auth(['admin']), async (req, res) => {
  try {
    const {
      name, address, phone,
      founder_first_name, founder_last_name,
      gen_dir_username, gen_dir_password,
    } = req.body;
    // Founder is required — every company must have a gen_dir
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название компании обязательно' });
    if (!founder_first_name || !founder_first_name.trim()) return res.status(400).json({ error: 'ФИО учредителя обязательно' });
    if (!gen_dir_username || !gen_dir_username.trim()) return res.status(400).json({ error: 'Логин учредителя обязателен' });
    { const v = validatePassword(gen_dir_password); if (!v.ok) return res.status(400).json({ error: v.error }); }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [company] } = await client.query(
        'INSERT INTO companies (name, address, phone, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
        [name.trim(), address || '', phone || '', req.user.id]
      );
      const hash = await bcrypt.hash(gen_dir_password, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, role, company_id, first_name, last_name, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [gen_dir_username.trim(), hash, 'founder', company.id,
         founder_first_name.trim(), (founder_last_name || '').trim() || null, req.user.id]
      );
      await client.query('COMMIT');
      res.json(company);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/companies/:id', auth(['admin']), async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    await pool.query('UPDATE companies SET name=$1, address=$2, phone=$3 WHERE id=$4', [name, address || '', phone || '', req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/companies/:id', auth(['admin']), async (req, res) => {
  await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// === BRANCHES ===
app.get('/api/branches', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse', 'seller']), async (req, res) => {
  let query = `
    SELECT b.*, c.name as company_name,
      (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id) as user_count,
      mgr.username as manager_name, cb.username as created_by_name, cb.role as created_by_role
    FROM branches b
    LEFT JOIN companies c ON b.company_id = c.id
    LEFT JOIN users mgr ON mgr.branch_id = b.id AND mgr.role = 'manager'
    LEFT JOIN users cb ON b.created_by = cb.id
  `;
  const params = [];
  if (req.user.role === 'admin' && req.query.company_id) {
    query += ' WHERE b.company_id = $1';
    params.push(parseInt(req.query.company_id));
  } else if (isCompanyLevel(req.user.role)) {
    query += ' WHERE b.company_id = $1';
    params.push(req.user.company_id);
  } else if (req.user.role === 'manager') {
    query += ' WHERE b.id = $1';
    params.push(req.user.branch_id);
  } else if (req.user.company_id) {
    // seller/cashier/warehouse: only branches in their company
    query += ' WHERE b.company_id = $1';
    params.push(req.user.company_id);
  }
  query += ' ORDER BY b.created_at DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.post('/api/branches', auth(['admin', 'gen_dir', 'founder']), async (req, res) => {
  try {
    const { company_id, name, address, phone, manager_username, manager_password } = req.body;
    const companyId = isCompanyLevel(req.user.role) ? req.user.company_id : company_id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [branch] } = await client.query(
        'INSERT INTO branches (company_id, name, address, phone, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [companyId, name, address || '', phone || '', req.user.id]
      );
      if (manager_username && manager_password) {
        const v = validatePassword(manager_password);
        if (!v.ok) { await client.query('ROLLBACK'); return res.status(400).json({ error: v.error }); }
        const hash = await bcrypt.hash(manager_password, 10);
        await client.query(
          'INSERT INTO users (username, password_hash, role, company_id, branch_id) VALUES ($1,$2,$3,$4,$5)',
          [manager_username, hash, 'manager', companyId, branch.id]
        );
      }
      await client.query('COMMIT');
      res.json(branch);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/branches/:id', auth(['admin', 'gen_dir', 'founder']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { rows: [cur] } = await pool.query('SELECT id, company_id FROM branches WHERE id=$1', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && cur.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Out of scope' });
    }
    const { name, address, phone } = req.body;
    await pool.query(
      'UPDATE branches SET name=$1, address=$2, phone=$3 WHERE id=$4 AND company_id=$5',
      [name, address || '', phone || '', id, cur.company_id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/branches/:id', auth(['admin', 'gen_dir', 'founder']), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
  const { rows: [cur] } = await pool.query('SELECT id, company_id FROM branches WHERE id=$1', [id]);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && cur.company_id !== req.user.company_id) {
    return res.status(403).json({ error: 'Out of scope' });
  }
  await pool.query('DELETE FROM branches WHERE id = $1 AND company_id = $2', [id, cur.company_id]);
  res.json({ ok: true });
});

// === Customer SEGMENTATION (RFM-lite) ===
// Buckets customers into VIP / Regular / Sleeping / Lost / New based on recency + revenue.
// Thresholds tuned for Uzbek retail; tweak later via config table.
app.get('/api/customers/segments', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const branchId = getBranchFilter(req.user, req.query);
    const branchSQL = branchId ? `AND so.branch_id = ${parseInt(branchId)}` : '';

    // Single CTE: per-customer aggregates over the last 365 days
    const { rows } = await pool.query(`
      WITH agg AS (
        SELECT c.id, c.name, c.phone,
               COUNT(so.id) FILTER (WHERE so.status='approved') AS deals,
               COALESCE(SUM(so.quantity*so.price) FILTER (WHERE so.status='approved'), 0) AS revenue,
               MAX(so.created_at) FILTER (WHERE so.status='approved') AS last_at,
               EXTRACT(DAY FROM NOW() - MAX(so.created_at) FILTER (WHERE so.status='approved')) AS days_since,
               EXTRACT(DAY FROM NOW() - c.created_at) AS days_old
        FROM customers c
        LEFT JOIN stock_outcome so ON so.customer_id = c.id ${branchSQL}
        WHERE c.company_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, c.name, c.phone, c.created_at
      )
      SELECT id, name, phone,
             deals::int,
             revenue::numeric,
             last_at,
             COALESCE(days_since, days_old)::int AS days_since,
             CASE
               WHEN deals = 0 AND days_old < 30 THEN 'new'
               WHEN deals = 0 THEN 'lost'
               WHEN days_since >= 120 THEN 'lost'
               WHEN days_since >= 60 THEN 'sleeping'
               WHEN revenue >= 5000000 THEN 'vip'
               ELSE 'regular'
             END AS segment
      FROM agg
      ORDER BY revenue DESC NULLS LAST
      LIMIT 1000
    `, [companyId]);

    // Per-segment totals
    const summary = { vip: 0, regular: 0, sleeping: 0, lost: 0, new: 0, total: rows.length, revenue: 0 };
    for (const r of rows) {
      summary[r.segment] = (summary[r.segment] || 0) + 1;
      summary.revenue += parseFloat(r.revenue) || 0;
    }
    res.json({ customers: rows, summary });
  } catch (e) {
    console.error('segments err', e);
    res.status(500).json({ error: e.message });
  }
});

// === ABC / XYZ analysis ===
// A/B/C — share of revenue. X/Y/Z — coefficient of variation across last 90 days of sales.
app.get('/api/inventory/abc-xyz', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const branchId = getBranchFilter(req.user, req.query);
    const branchSQL = branchId ? `AND so.branch_id = ${parseInt(branchId)}` : '';

    // Aggregate per-product over the last 90 days; compute weekly buckets for stdev.
    const { rows } = await pool.query(`
      WITH per_week AS (
        SELECT p.id AS product_id, p.name_ru, p.unit,
               date_trunc('week', so.created_at) AS wk,
               SUM(so.quantity) AS qty,
               SUM(so.quantity * so.price) AS revenue
        FROM products p
        LEFT JOIN stock_outcome so ON so.product_id = p.id
          AND so.status = 'approved'
          AND so.created_at >= NOW() - INTERVAL '90 days'
          ${branchSQL}
        WHERE p.company_id = $1
        GROUP BY p.id, p.name_ru, p.unit, wk
      ),
      per_product AS (
        SELECT product_id, name_ru, unit,
               COALESCE(SUM(revenue), 0) AS revenue_total,
               COALESCE(SUM(qty), 0) AS qty_total,
               COALESCE(AVG(qty), 0) AS qty_avg,
               COALESCE(STDDEV_POP(qty), 0) AS qty_std,
               COUNT(wk) FILTER (WHERE qty > 0) AS weeks_with_sales
        FROM per_week
        GROUP BY product_id, name_ru, unit
      )
      SELECT *, CASE WHEN qty_avg > 0 THEN qty_std / qty_avg ELSE NULL END AS cov
      FROM per_product
      ORDER BY revenue_total DESC
    `, [companyId]);

    // Assign ABC by cumulative share
    const totalRev = rows.reduce((s, r) => s + parseFloat(r.revenue_total || 0), 0);
    let cum = 0;
    const items = rows.map(r => {
      const rev = parseFloat(r.revenue_total || 0);
      cum += rev;
      const share = totalRev > 0 ? cum / totalRev : 0;
      const abc = share <= 0.80 ? 'A' : share <= 0.95 ? 'B' : 'C';
      const cov = r.cov == null ? null : parseFloat(r.cov);
      const xyz = cov == null ? 'Z' : cov <= 0.25 ? 'X' : cov <= 0.5 ? 'Y' : 'Z';
      return {
        product_id: r.product_id,
        name: r.name_ru,
        unit: r.unit,
        revenue: rev,
        qty: parseFloat(r.qty_total || 0),
        weeks_with_sales: parseInt(r.weeks_with_sales || 0),
        cov,
        abc, xyz,
        cell: abc + xyz,
      };
    });

    // 3×3 matrix summary
    const matrix = {};
    for (const c of ['A', 'B', 'C']) for (const x of ['X', 'Y', 'Z']) matrix[c + x] = { count: 0, revenue: 0 };
    for (const i of items) {
      matrix[i.cell].count++;
      matrix[i.cell].revenue += i.revenue;
    }
    res.json({ items, matrix, total_revenue: totalRev });
  } catch (e) {
    console.error('abc-xyz err', e);
    res.status(500).json({ error: e.message });
  }
});

// === Pricing analyzer — margin by product ===
app.get('/api/pricing/analyze', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const branchId = getBranchFilter(req.user, req.query);
    const branchSQL = branchId ? `AND so.branch_id = ${parseInt(branchId)}` : '';

    // Per-product: price_buy, price_sell from products; recent sales revenue from stock_outcome.
    const { rows } = await pool.query(`
      SELECT p.id, p.name_ru, p.unit, p.price_buy, p.price_sell,
             COALESCE(rev.revenue, 0) AS revenue_90d,
             COALESCE(rev.qty, 0)     AS qty_90d
      FROM products p
      LEFT JOIN LATERAL (
        SELECT SUM(so.quantity * so.price) AS revenue, SUM(so.quantity) AS qty
        FROM stock_outcome so
        WHERE so.product_id = p.id
          AND so.status='approved'
          AND so.created_at >= NOW() - INTERVAL '90 days'
          ${branchSQL}
      ) rev ON TRUE
      WHERE p.company_id = $1
      ORDER BY revenue_90d DESC NULLS LAST
      LIMIT 1000
    `, [companyId]);

    const items = rows.map(r => {
      const buy = parseFloat(r.price_buy) || 0;
      const sell = parseFloat(r.price_sell) || 0;
      const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
      let tone = 'green'; // healthy margin
      if (margin < 10) tone = 'red';
      else if (margin < 25) tone = 'yellow';
      return {
        id: r.id, name: r.name_ru, unit: r.unit,
        price_buy: buy, price_sell: sell,
        margin_pct: Math.round(margin * 10) / 10,
        revenue_90d: parseFloat(r.revenue_90d) || 0,
        qty_90d: parseFloat(r.qty_90d) || 0,
        tone,
      };
    });

    const summary = {
      total: items.length,
      red: items.filter(i => i.tone === 'red').length,
      yellow: items.filter(i => i.tone === 'yellow').length,
      green: items.filter(i => i.tone === 'green').length,
      avg_margin: items.length > 0 ? Math.round(items.reduce((s, i) => s + i.margin_pct, 0) / items.length * 10) / 10 : 0,
    };
    res.json({ items, summary });
  } catch (e) {
    console.error('pricing err', e);
    res.status(500).json({ error: e.message });
  }
});

// === Risk Control — unified alerts feed ===
app.get('/api/risks', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const branchId = getBranchFilter(req.user, req.query);
    const branchSQL = branchId ? `AND ps.branch_id = ${parseInt(branchId)}` : '';
    const branchSQLso = branchId ? `AND so.branch_id = ${parseInt(branchId)}` : '';
    const branchSQLsi = branchId ? `AND si.branch_id = ${parseInt(branchId)}` : '';

    const alerts = [];

    // 1) Low stock (< 5) and out of stock
    const lowStock = await pool.query(`
      SELECT p.id, p.name_ru, ps.quantity, ps.branch_id, b.name AS branch_name
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      LEFT JOIN branches b ON b.id = ps.branch_id
      WHERE p.company_id = $1 AND ps.quantity > 0 AND ps.quantity < 5 ${branchSQL}
      LIMIT 50
    `, [companyId]);
    for (const r of lowStock.rows) {
      alerts.push({
        severity: r.quantity < 2 ? 'critical' : 'warning',
        category: 'stock',
        title: `Низкий остаток: ${r.name_ru}`,
        detail: `Осталось ${parseFloat(r.quantity)} шт${r.branch_name ? ` · ${r.branch_name}` : ''}`,
        action_url: '/owner/warehouse/stock',
      });
    }

    // 2) Out of stock for products that sold recently
    const outOfStock = await pool.query(`
      SELECT p.id, p.name_ru, ps.branch_id, b.name AS branch_name
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      LEFT JOIN branches b ON b.id = ps.branch_id
      WHERE p.company_id = $1 AND ps.quantity = 0 ${branchSQL}
        AND EXISTS (SELECT 1 FROM stock_outcome so WHERE so.product_id = p.id AND so.status='approved' AND so.created_at >= NOW() - INTERVAL '14 days')
      LIMIT 30
    `, [companyId]);
    for (const r of outOfStock.rows) {
      alerts.push({
        severity: 'critical',
        category: 'stock',
        title: `Нет в наличии: ${r.name_ru}`,
        detail: `Был спрос за 14 дней${r.branch_name ? ` · ${r.branch_name}` : ''}`,
        action_url: '/owner/warehouse/income',
      });
    }

    // 3) Overdue client debts
    const overdueDebts = await pool.query(`
      SELECT so.id, so.due_date,
             ((so.quantity * so.price) - COALESCE(so.paid_amount, 0)) AS remaining,
             c.name AS customer_name
      FROM stock_outcome so
      JOIN products p ON p.id = so.product_id
      LEFT JOIN customers c ON c.id = so.customer_id
      WHERE p.company_id = $1 AND so.payment_status <> 'paid' AND so.status='approved'
        AND so.due_date IS NOT NULL AND so.due_date < CURRENT_DATE
        ${branchSQLso}
      ORDER BY so.due_date ASC LIMIT 30
    `, [companyId]);
    for (const r of overdueDebts.rows) {
      const daysLate = Math.floor((new Date() - new Date(r.due_date)) / 86400000);
      alerts.push({
        severity: daysLate > 7 ? 'critical' : 'warning',
        category: 'debt',
        title: `Просрочен долг: ${r.customer_name || 'клиент'}`,
        detail: `${Math.round(parseFloat(r.remaining)).toLocaleString('ru-RU')} UZS · ${daysLate} дн.`,
        action_url: '/owner/clients/debts-clients',
      });
    }

    // 4) Pending outcomes awaiting approval > 1h
    const pending = await pool.query(`
      SELECT COUNT(*) AS c FROM stock_outcome so
      JOIN products p ON p.id = so.product_id
      WHERE p.company_id = $1 AND so.status='pending' AND so.created_at < NOW() - INTERVAL '1 hour'
        ${branchSQLso}
    `, [companyId]);
    const pendingCount = parseInt(pending.rows[0]?.c || 0);
    if (pendingCount > 0) {
      alerts.push({
        severity: 'warning',
        category: 'workflow',
        title: `${pendingCount} продаж ждут подтверждения`,
        detail: 'Менеджер должен подтвердить',
        action_url: '/owner/sales/sales-history',
      });
    }

    // 5) Sleeping VIP customers (revenue > 5M, last_at > 30 days)
    const sleepingVIP = await pool.query(`
      WITH agg AS (
        SELECT c.id, c.name,
               COALESCE(SUM(so.quantity*so.price), 0) AS revenue,
               MAX(so.created_at) AS last_at
        FROM customers c
        LEFT JOIN stock_outcome so ON so.customer_id = c.id AND so.status='approved' ${branchSQLso}
        WHERE c.company_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, c.name
      )
      SELECT id, name, revenue, last_at FROM agg
      WHERE revenue >= 5000000 AND last_at IS NOT NULL AND last_at < NOW() - INTERVAL '30 days'
      ORDER BY revenue DESC LIMIT 10
    `, [companyId]);
    for (const r of sleepingVIP.rows) {
      const days = Math.floor((new Date() - new Date(r.last_at)) / 86400000);
      alerts.push({
        severity: 'info',
        category: 'customer',
        title: `Спящий VIP: ${r.name}`,
        detail: `Без покупок ${days} дн · LTV ${Math.round(parseFloat(r.revenue) / 1e6 * 10) / 10}M UZS`,
        action_url: '/owner/clients/crm',
      });
    }

    // 6) Overdue supplier debts (we owe)
    const overdueSupplier = await pool.query(`
      SELECT si.id, si.due_date,
             ((si.quantity * si.price) - COALESCE(si.paid_amount, 0)) AS remaining,
             s.name AS supplier_name
      FROM stock_income si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN suppliers s ON s.id = si.supplier_id
      WHERE p.company_id = $1 AND si.payment_status <> 'paid'
        AND si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE
        ${branchSQLsi}
      ORDER BY si.due_date ASC LIMIT 30
    `, [companyId]);
    for (const r of overdueSupplier.rows) {
      const daysLate = Math.floor((new Date() - new Date(r.due_date)) / 86400000);
      alerts.push({
        severity: daysLate > 7 ? 'critical' : 'warning',
        category: 'supplier-debt',
        title: `Долг поставщику: ${r.supplier_name || 'поставщик'}`,
        detail: `${Math.round(parseFloat(r.remaining)).toLocaleString('ru-RU')} UZS · ${daysLate} дн. просрочки`,
        action_url: '/owner/warehouse/debts-suppliers',
      });
    }

    // Group by severity for summary
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    };
    res.json({ alerts, summary });
  } catch (e) {
    console.error('risks err', e);
    res.status(500).json({ error: e.message });
  }
});

// === Supplier debts (all unpaid incomes company-wide) ===
app.get('/api/suppliers/debts', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [req.user.company_id];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = `AND si.branch_id = $${params.length}`; }
    const { rows } = await pool.query(`
      SELECT si.id, si.created_at, si.quantity, si.price, si.payment_status, si.payment_method,
             si.paid_amount, si.due_date, si.branch_id,
             (si.quantity * si.price) AS total_amount,
             ((si.quantity * si.price) - COALESCE(si.paid_amount, 0)) AS remaining,
             p.name_ru AS product_name, p.unit,
             s.id AS supplier_id, s.name AS supplier_name, s.phone AS supplier_phone,
             b.name AS branch_name,
             CASE WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS overdue
      FROM stock_income si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN branches b ON b.id = si.branch_id
      WHERE p.company_id = $1 AND si.payment_status <> 'paid' ${branchFilter}
      ORDER BY si.due_date NULLS LAST, si.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === COMPANY DASHBOARD (gen_dir/founder/manager) ===
// Query params:
//   from, to — ISO timestamps for sales period filter (default: lifetime)
//   branch_id — optional drill-down for owner; manager is always pinned to own branch
// Returns: { branches:[{...kpis}], totals:{}, sales_trend:[{date,revenue}], top_products:[], top_sellers:[], alerts:[] }
app.get('/api/company/dashboard', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const isManager = req.user.role === 'manager';
    const scopedBranch = isManager ? req.user.branch_id : (req.query.branch_id ? parseInt(req.query.branch_id, 10) : null);
    const from = req.query.from || null;
    const to = req.query.to || null;

    // Build period predicate for stock_outcome
    const periodParams = [];
    let periodSQL = '';
    if (from) { periodParams.push(from); periodSQL += ` AND so.created_at >= $${periodParams.length}`; }
    if (to)   { periodParams.push(to);   periodSQL += ` AND so.created_at <  $${periodParams.length}`; }

    // Branch list visible to caller
    let branchesQuery;
    if (isManager) {
      branchesQuery = await pool.query('SELECT id, name FROM branches WHERE id=$1 AND company_id=$2', [req.user.branch_id, companyId]);
    } else if (scopedBranch) {
      branchesQuery = await pool.query('SELECT id, name FROM branches WHERE id=$1 AND company_id=$2', [scopedBranch, companyId]);
    } else {
      branchesQuery = await pool.query('SELECT id, name FROM branches WHERE company_id=$1 ORDER BY id', [companyId]);
    }
    const branches = branchesQuery.rows;
    const branchIds = branches.map(b => b.id);
    if (branchIds.length === 0) {
      return res.json({ company_id: companyId, branches: [], totals: {}, sales_trend: [], top_products: [], top_sellers: [], alerts: [] });
    }

    // Per-branch KPIs — single set of grouped queries.
    // ВАЖНО (бизнес-логика): приход/расход кассы фильтруются ВЫБРАННЫМ ПЕРИОДОМ,
    // чтобы «Денежный поток» был сопоставим с выручкой за тот же период.
    // Баланс кассы — накопленный (за всё время): это остаток, а не оборот.
    const branchIdsList = `(${branchIds.join(',')})`;
    // Период для cash-таблиц (колонка created_at без алиаса)
    const cashPeriodParams = [];
    let cashPeriodSQL = '';
    if (from) { cashPeriodParams.push(from); cashPeriodSQL += ` AND created_at >= $${cashPeriodParams.length}`; }
    if (to)   { cashPeriodParams.push(to);   cashPeriodSQL += ` AND created_at <  $${cashPeriodParams.length}`; }
    const [salesAgg, cashIAgg, cashEAgg, cashBalAgg, stockAgg, workersAgg] = await Promise.all([
      pool.query(`
        SELECT so.branch_id,
               COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
               COALESCE(SUM(so.quantity * COALESCE(p.price_buy, 0)), 0) AS cost,
               COUNT(*) AS deals
        FROM stock_outcome so
        JOIN products p ON p.id = so.product_id
        WHERE so.status='approved' AND so.branch_id IN ${branchIdsList} ${periodSQL}
        GROUP BY so.branch_id`,
        periodParams),
      pool.query(`SELECT branch_id, COALESCE(SUM(amount),0) AS t FROM cash_income
                  WHERE branch_id IN ${branchIdsList} AND is_settled IS NOT FALSE ${cashPeriodSQL} GROUP BY branch_id`,
        cashPeriodParams),
      pool.query(`SELECT branch_id, COALESCE(SUM(amount),0) AS t FROM cash_expense
                  WHERE branch_id IN ${branchIdsList} ${cashPeriodSQL} GROUP BY branch_id`,
        cashPeriodParams),
      // Накопленный баланс кассы (всё время) — отдельно от периодных оборотов
      pool.query(`
        SELECT b.branch_id, COALESCE(i.t,0) - COALESCE(e.t,0) AS bal FROM
          (SELECT unnest(ARRAY[${branchIds.join(',')}]::int[]) AS branch_id) b
          LEFT JOIN (SELECT branch_id, SUM(amount) AS t FROM cash_income
                     WHERE branch_id IN ${branchIdsList} AND is_settled IS NOT FALSE GROUP BY branch_id) i USING (branch_id)
          LEFT JOIN (SELECT branch_id, SUM(amount) AS t FROM cash_expense
                     WHERE branch_id IN ${branchIdsList} GROUP BY branch_id) e USING (branch_id)`),
      pool.query(`SELECT ps.branch_id, COALESCE(SUM(ps.quantity * COALESCE(p.price_sell,0)),0) AS value
                  FROM product_stock ps JOIN products p ON p.id = ps.product_id
                  WHERE ps.branch_id IN ${branchIdsList} GROUP BY ps.branch_id`),
      pool.query(`SELECT branch_id, COUNT(*) AS c FROM users
                  WHERE branch_id IN ${branchIdsList} GROUP BY branch_id`),
    ]);
    const idx = (rows, key = 't') => Object.fromEntries(rows.map(r => [r.branch_id, parseFloat(r[key]) || 0]));
    const cashIByB = idx(cashIAgg.rows);
    const cashEByB = idx(cashEAgg.rows);
    const cashBalByB = idx(cashBalAgg.rows, 'bal');
    const stockByB = idx(stockAgg.rows, 'value');
    const workersByB = idx(workersAgg.rows, 'c');
    const salesByB = Object.fromEntries(salesAgg.rows.map(r => [r.branch_id, {
      revenue: parseFloat(r.revenue) || 0,
      cost: parseFloat(r.cost) || 0,
      deals: parseInt(r.deals) || 0,
    }]));
    const perBranch = branches.map(b => {
      const s = salesByB[b.id] || { revenue: 0, cost: 0, deals: 0 };
      const ci = cashIByB[b.id] || 0;
      const ce = cashEByB[b.id] || 0;
      return {
        branch_id: b.id,
        branch_name: b.name,
        cash_income: ci,
        cash_expense: ce,
        cash_balance: cashBalByB[b.id] || 0,
        sales_revenue: s.revenue,
        sales_cost: s.cost,
        gross_profit: s.revenue - s.cost,
        margin_pct: s.revenue > 0 ? Math.round(((s.revenue - s.cost) / s.revenue) * 1000) / 10 : 0,
        deals_count: s.deals,
        avg_check: s.deals > 0 ? Math.round(s.revenue / s.deals) : 0,
        stock_value: stockByB[b.id] || 0,
        worker_count: workersByB[b.id] || 0,
      };
    });

    const totals = perBranch.reduce((acc, b) => ({
      cash_income: acc.cash_income + b.cash_income,
      cash_expense: acc.cash_expense + b.cash_expense,
      cash_balance: acc.cash_balance + b.cash_balance,
      sales_revenue: acc.sales_revenue + b.sales_revenue,
      sales_cost: acc.sales_cost + b.sales_cost,
      gross_profit: acc.gross_profit + b.gross_profit,
      stock_value: acc.stock_value + b.stock_value,
      deals_count: acc.deals_count + b.deals_count,
      worker_count: acc.worker_count + b.worker_count,
    }), { cash_income: 0, cash_expense: 0, cash_balance: 0, sales_revenue: 0, sales_cost: 0, gross_profit: 0, stock_value: 0, deals_count: 0, worker_count: 0 });
    totals.margin_pct = totals.sales_revenue > 0 ? Math.round((totals.gross_profit / totals.sales_revenue) * 1000) / 10 : 0;
    totals.avg_check = totals.deals_count > 0 ? Math.round(totals.sales_revenue / totals.deals_count) : 0;

    // --- payment-method breakdown for the dashboard tiles (Phase B) ---
    // Cash income / sales / avg-check разбиты по 4 категориям:
    //   cash_uzs (наличные в сум) · cash_usd (наличные в долларах) · card · transfer
    // Источник: cash_income/cash_expense.payment_method + .currency для cash +
    //           stock_outcome.payment_method для выручки.
    // Все запросы scoped через branchIds и периодически (если задан period).
    const periodCashI = [];
    let periodCashISQL = '';
    if (from) { periodCashI.push(from); periodCashISQL += ` AND created_at >= $${periodCashI.length}`; }
    if (to)   { periodCashI.push(to);   periodCashISQL += ` AND created_at <  $${periodCashI.length}`; }
    const periodCashE = [...periodCashI];
    const periodCashESQL = periodCashISQL;

    const [revByMethodQ, cashInByMethodQ, cashOutByMethodQ, allTimeCashInQ] = await Promise.all([
      // 1) Выручка от продаж за период по способу оплаты + валюте
      pool.query(`
        SELECT COALESCE(so.payment_method, 'cash') AS method,
               COALESCE(so.currency, 'UZS') AS currency,
               COALESCE(SUM(so.quantity * so.price), 0) AS amount,
               COUNT(*) AS deals
        FROM stock_outcome so
        WHERE so.status='approved' AND so.branch_id IN ${branchIdsList} ${periodSQL}
        GROUP BY COALESCE(so.payment_method, 'cash'), COALESCE(so.currency, 'UZS')`,
        periodParams),
      // 2) Приход в кассу за период по способу + валюте
      pool.query(`
        SELECT COALESCE(payment_method, 'cash') AS method,
               COALESCE(currency, 'UZS') AS currency,
               COALESCE(SUM(amount), 0) AS amount
        FROM cash_income
        WHERE branch_id IN ${branchIdsList} AND is_settled IS NOT FALSE ${periodCashISQL}
        GROUP BY COALESCE(payment_method, 'cash'), COALESCE(currency, 'UZS')`,
        periodCashI),
      // 3) Расход из кассы за период по способу + валюте
      pool.query(`
        SELECT COALESCE(payment_method, 'cash') AS method,
               COALESCE(currency, 'UZS') AS currency,
               COALESCE(SUM(amount), 0) AS amount
        FROM cash_expense
        WHERE branch_id IN ${branchIdsList} ${periodCashESQL}
        GROUP BY COALESCE(payment_method, 'cash'), COALESCE(currency, 'UZS')`,
        periodCashE),
      // 4) Текущий баланс кассы по способу оплаты (cash_balance) — БЕЗ периода (накопленный).
      // DISTINCT берётся по COALESCE-нормализованным значениям — иначе пары (NULL,NULL) и
      // ('cash','UZS') дают две строки t с одинаковым матчем и баланс считается дважды.
      pool.query(`
        SELECT
          t.method,
          t.currency,
          (
            (SELECT COALESCE(SUM(amount),0) FROM cash_income ci
              WHERE ci.branch_id IN ${branchIdsList} AND ci.is_settled IS NOT FALSE
                AND COALESCE(ci.payment_method,'cash')=t.method
                AND COALESCE(ci.currency,'UZS')=t.currency)
            -
            (SELECT COALESCE(SUM(amount),0) FROM cash_expense ce
              WHERE ce.branch_id IN ${branchIdsList}
                AND COALESCE(ce.payment_method,'cash')=t.method
                AND COALESCE(ce.currency,'UZS')=t.currency)
          ) AS balance
        FROM (
          SELECT DISTINCT COALESCE(payment_method,'cash') AS method, COALESCE(currency,'UZS') AS currency
          FROM cash_income WHERE branch_id IN ${branchIdsList}
          UNION
          SELECT DISTINCT COALESCE(payment_method,'cash') AS method, COALESCE(currency,'UZS') AS currency
          FROM cash_expense WHERE branch_id IN ${branchIdsList}
        ) t`),
    ]);

    // Helper — переводит строку (method, currency) → одну из 4 ключей фронтенда
    function bucketize(method, currency) {
      const m = (method || 'cash').toLowerCase();
      const c = (currency || 'UZS').toUpperCase();
      if (m === 'cash' && c === 'USD') return 'cash_usd';
      if (m === 'cash') return 'cash_uzs';
      if (m === 'card') return 'card';
      if (m === 'transfer' || m === 'wire') return 'transfer';
      // долги, прочие — не входят в кассовый баланс, исключаем
      return null;
    }
    const emptyBuckets = () => ({ cash_uzs: 0, cash_usd: 0, card: 0, transfer: 0 });

    const revBuckets = emptyBuckets();
    const dealsBuckets = emptyBuckets();
    for (const r of revByMethodQ.rows) {
      // so.price хранится в UZS-эквиваленте, но валюта оплаты — в so.currency:
      // наличная продажа в долларах должна попадать в «Доллар», не в «Сум».
      const k = bucketize(r.method, r.currency);
      if (k) {
        revBuckets[k] += parseFloat(r.amount) || 0;
        dealsBuckets[k] += parseInt(r.deals) || 0;
      }
    }
    const cashInBuckets = emptyBuckets();
    for (const r of cashInByMethodQ.rows) {
      const k = bucketize(r.method, r.currency);
      if (k) cashInBuckets[k] += parseFloat(r.amount) || 0;
    }
    const cashOutBuckets = emptyBuckets();
    for (const r of cashOutByMethodQ.rows) {
      const k = bucketize(r.method, r.currency);
      if (k) cashOutBuckets[k] += parseFloat(r.amount) || 0;
    }
    // Накопленный баланс кассы по способу — для плитки «Касса (баланс)»
    const cashBalBuckets = emptyBuckets();
    for (const r of allTimeCashInQ.rows) {
      const k = bucketize(r.method, r.currency);
      if (k) cashBalBuckets[k] += parseFloat(r.balance) || 0;
    }
    // Средний чек по способу = выручка / сделок
    const avgCheckBuckets = emptyBuckets();
    for (const k of Object.keys(avgCheckBuckets)) {
      avgCheckBuckets[k] = dealsBuckets[k] > 0 ? Math.round(revBuckets[k] / dealsBuckets[k]) : 0;
    }
    totals.by_method = {
      revenue:   revBuckets,
      cash_in:   cashBalBuckets,   // для плитки «Касса (баланс)» показываем накопленный баланс
      cash_out:  cashOutBuckets,   // период-расход
      deals:     dealsBuckets,
      avg_check: avgCheckBuckets,
    };

    // Sales trend covering the selected period (revenue per day).
    // If no period → last 30 days. The frontend draws this as an area chart.
    let trendFromIso = from;
    let trendToIso = to || new Date().toISOString();
    if (!trendFromIso) {
      const d = new Date(); d.setDate(d.getDate() - 30);
      trendFromIso = d.toISOString();
    }
    const trendQ = await pool.query(`
      SELECT date_trunc('day', so.created_at)::date AS d,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
             COUNT(*) AS deals
      FROM stock_outcome so
      WHERE so.status='approved'
        AND so.branch_id IN ${branchIdsList}
        AND so.created_at >= $1 AND so.created_at < $2
      GROUP BY d ORDER BY d`,
      [trendFromIso, trendToIso]);
    const trendMap = new Map();
    for (const r of trendQ.rows) trendMap.set(new Date(r.d).toISOString().slice(0, 10), { revenue: parseFloat(r.revenue) || 0, deals: parseInt(r.deals) || 0 });
    const sales_trend = [];
    const startDay = new Date(trendFromIso); startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(trendToIso); endDay.setHours(0, 0, 0, 0);
    for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const v = trendMap.get(key) || { revenue: 0, deals: 0 };
      sales_trend.push({ date: key, revenue: v.revenue, deals: v.deals });
    }

    // Previous period comparison — same length as current, ending right before `from`.
    // Lets the frontend show "growth vs previous period" tile deltas + a comparison chart.
    let prev_totals = null;
    let prev_trend = [];
    if (from) {
      const periodMs = new Date(trendToIso) - new Date(from);
      const prevTo = from;
      const prevFrom = new Date(new Date(from) - periodMs).toISOString();
      const prevAgg = await pool.query(`
        SELECT COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
               COALESCE(SUM(so.quantity * COALESCE(p.price_buy, 0)), 0) AS cost,
               COUNT(*) AS deals
        FROM stock_outcome so
        JOIN products p ON p.id = so.product_id
        WHERE so.status='approved' AND so.branch_id IN ${branchIdsList}
          AND so.created_at >= $1 AND so.created_at < $2`,
        [prevFrom, prevTo]);
      const pr = prevAgg.rows[0];
      const pRev = parseFloat(pr.revenue) || 0;
      const pCost = parseFloat(pr.cost) || 0;
      const pDeals = parseInt(pr.deals) || 0;
      prev_totals = {
        sales_revenue: pRev,
        gross_profit: pRev - pCost,
        deals_count: pDeals,
        avg_check: pDeals > 0 ? Math.round(pRev / pDeals) : 0,
      };
      // Prev-period daily trend (for the comparison chart)
      const prevTrendQ = await pool.query(`
        SELECT date_trunc('day', so.created_at)::date AS d,
               COALESCE(SUM(so.quantity * so.price), 0) AS revenue
        FROM stock_outcome so
        WHERE so.status='approved' AND so.branch_id IN ${branchIdsList}
          AND so.created_at >= $1 AND so.created_at < $2
        GROUP BY d ORDER BY d`,
        [prevFrom, prevTo]);
      const prevMap = new Map();
      for (const r of prevTrendQ.rows) prevMap.set(new Date(r.d).toISOString().slice(0, 10), parseFloat(r.revenue) || 0);
      const ps = new Date(prevFrom); ps.setHours(0, 0, 0, 0);
      const pe = new Date(prevTo); pe.setHours(0, 0, 0, 0);
      for (let d = new Date(ps); d < pe; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        prev_trend.push({ date: key, revenue: prevMap.get(key) || 0 });
      }
    }

    // Department-level counters used by department mini-dashboards
    const [custQ, supQ, lowStockCountQ, newCustQ, debtsQ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM customers WHERE company_id = $1 AND deleted_at IS NULL', [companyId]),
      pool.query('SELECT COUNT(*) AS c FROM suppliers WHERE company_id = $1', [companyId]),
      pool.query(`SELECT COUNT(*) AS c FROM product_stock ps JOIN products p ON p.id = ps.product_id
                  WHERE p.company_id = $1 AND ps.branch_id IN ${branchIdsList} AND ps.quantity < 5`, [companyId]),
      pool.query(`SELECT COUNT(*) AS c FROM customers WHERE company_id = $1 AND deleted_at IS NULL
                  AND created_at >= NOW() - INTERVAL '30 days'`, [companyId]),
      pool.query(`SELECT
        (SELECT COALESCE(SUM((so.quantity*so.price) - COALESCE(so.paid_amount,0)),0)
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE p.company_id = $1 AND so.payment_status <> 'paid' AND so.status='approved'
           AND so.branch_id IN ${branchIdsList}) AS client_debts,
        (SELECT COALESCE(SUM((si.quantity*si.price) - COALESCE(si.paid_amount,0)),0)
         FROM stock_income si JOIN products p ON p.id = si.product_id
         WHERE p.company_id = $1 AND si.payment_status <> 'paid'
           AND si.branch_id IN ${branchIdsList}) AS supplier_debts`, [companyId]),
    ]);
    totals.customer_count = parseInt(custQ.rows[0]?.c || 0);
    totals.supplier_count = parseInt(supQ.rows[0]?.c || 0);
    totals.low_stock_count = parseInt(lowStockCountQ.rows[0]?.c || 0);
    totals.new_customers_30d = parseInt(newCustQ.rows[0]?.c || 0);
    totals.client_debts = parseFloat(debtsQ.rows[0]?.client_debts || 0);
    totals.supplier_debts = parseFloat(debtsQ.rows[0]?.supplier_debts || 0);

    // Top 5 products by revenue in period
    const topProdQ = await pool.query(`
      SELECT p.id, p.name_ru, p.unit,
             COALESCE(SUM(so.quantity), 0) AS qty,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue
      FROM stock_outcome so
      JOIN products p ON p.id = so.product_id
      WHERE so.status='approved' AND so.branch_id IN ${branchIdsList} ${periodSQL}
      GROUP BY p.id, p.name_ru, p.unit
      ORDER BY revenue DESC LIMIT 5`,
      periodParams);

    // Top 5 sellers by revenue (created_by user) in period
    const topSellQ = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.role,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
             COUNT(*) AS deals
      FROM stock_outcome so
      JOIN users u ON u.id = so.created_by
      WHERE so.status='approved' AND so.branch_id IN ${branchIdsList} ${periodSQL}
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.role
      ORDER BY revenue DESC LIMIT 5`,
      periodParams);

    // Simple rule-based alerts
    const alerts = [];
    // Русская плюрализация: plural(3, 'товар','товара','товаров') → 'товара'
    const plural = (n, one, few, many) => {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
      return many;
    };
    // Low stock alert — count products with stock < 5
    const lowStockQ = await pool.query(`
      SELECT COUNT(*) AS c FROM product_stock ps
      WHERE ps.branch_id IN ${branchIdsList} AND ps.quantity > 0 AND ps.quantity < 5`);
    const lowStock = parseInt(lowStockQ.rows[0]?.c || 0);
    if (lowStock > 0) {
      alerts.push({ tone: 'red', title: `Низкий остаток: ${lowStock} ${plural(lowStock, 'товар', 'товара', 'товаров')}`, sub: 'Меньше 5 единиц на складе — рискуете остаться без продаж' });
    }
    // Pending outcomes (unconfirmed sales)
    const pendingQ = await pool.query(`
      SELECT COUNT(*) AS c FROM stock_outcome so
      WHERE so.status='pending' AND so.branch_id IN ${branchIdsList}`);
    const pending = parseInt(pendingQ.rows[0]?.c || 0);
    if (pending > 0) {
      alerts.push({
        tone: 'yellow',
        title: `${pending} ${plural(pending, 'сделка ждёт', 'сделки ждут', 'сделок ждут')} подтверждения`,
        sub: 'Менеджер или складовщик должен подтвердить',
      });
    }
    // Branch underperforming — if branch revenue < 50% of the company avg
    if (perBranch.length > 1) {
      const avgRev = totals.sales_revenue / perBranch.length;
      for (const b of perBranch) {
        if (avgRev > 0 && b.sales_revenue < avgRev * 0.5) {
          alerts.push({ tone: 'purple', title: `Филиал "${b.branch_name}" отстаёт`, sub: `Выручка ${Math.round(b.sales_revenue / 1e6 * 10) / 10}M vs средняя ${Math.round(avgRev / 1e6 * 10) / 10}M` });
        }
      }
    }

    res.json({
      company_id: companyId,
      branches: perBranch,
      totals,
      prev_totals,
      sales_trend,
      prev_trend,
      top_products: topProdQ.rows.map(r => ({ id: r.id, name: r.name_ru, unit: r.unit, qty: parseFloat(r.qty), revenue: parseFloat(r.revenue) })),
      top_sellers: topSellQ.rows.map(r => ({
        id: r.id, username: r.username, role: r.role,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
        revenue: parseFloat(r.revenue), deals: parseInt(r.deals),
      })),
      alerts,
    });
  } catch (e) {
    console.error('dashboard error', e);
    res.status(500).json({ error: e.message });
  }
});

// === SALES CHART (банковский стиль: бар = день/неделя/месяц/год) ===
// granularity задаёт МАСШТАБ бара, а не просто диапазон:
//   day   → 30 баров по дням      week → 12 баров по неделям (Пн-старт)
//   month → 12 баров по месяцам   year → 5 баров по годам
// prev_buckets — аналогичный диапазон сразу ДО текущего (для сравнения бар-к-бару).
app.get('/api/company/sales-chart', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const isManager = req.user.role === 'manager';
    const scopedBranch = isManager ? req.user.branch_id : (req.query.branch_id ? parseInt(req.query.branch_id, 10) : null);
    const gran = ['day', 'week', 'month', 'year'].includes(req.query.granularity) ? req.query.granularity : 'day';

    let bq;
    if (isManager) {
      bq = await pool.query('SELECT id FROM branches WHERE id=$1 AND company_id=$2', [req.user.branch_id, companyId]);
    } else if (scopedBranch) {
      bq = await pool.query('SELECT id FROM branches WHERE id=$1 AND company_id=$2', [scopedBranch, companyId]);
    } else {
      bq = await pool.query('SELECT id FROM branches WHERE company_id=$1', [companyId]);
    }
    const ids = bq.rows.map(r => r.id);
    if (!ids.length) return res.json({ granularity: gran, buckets: [], prev_buckets: [], total: 0, prev_total: 0 });

    const COUNT = { day: 30, week: 12, month: 12, year: 5 }[gran];

    // Старты бакетов текущего диапазона (локальный календарь сервера = календарь БД)
    const now = new Date();
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const shift = (base, i) => {
      const d = new Date(base);
      if (gran === 'day') d.setDate(d.getDate() + i);
      else if (gran === 'week') d.setDate(d.getDate() + i * 7);
      else if (gran === 'month') return new Date(base.getFullYear(), base.getMonth() + i, 1);
      else return new Date(base.getFullYear() + i, 0, 1);
      return d;
    };
    let base;
    if (gran === 'day') base = startOf(now);
    else if (gran === 'week') { base = startOf(now); base.setDate(base.getDate() - ((base.getDay() + 6) % 7)); }
    else if (gran === 'month') base = new Date(now.getFullYear(), now.getMonth(), 1);
    else base = new Date(now.getFullYear(), 0, 1);

    const starts = [];
    for (let i = COUNT - 1; i >= 0; i--) starts.push(shift(base, -i));
    const prevStarts = starts.map(s => shift(s, -COUNT));
    const rangeFrom = prevStarts[0]; // одним SQL берём prev + current

    // gran из белого списка — интерполяция безопасна
    const q = await pool.query(`
      SELECT to_char(date_trunc('${gran}', so.created_at), 'YYYY-MM-DD') AS k,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
             COUNT(*) AS deals
      FROM stock_outcome so
      WHERE so.status = 'approved' AND so.branch_id = ANY($1::int[])
        AND so.created_at >= $2
      GROUP BY k`,
      [ids, rangeFrom.toISOString()]);
    const byKey = new Map(q.rows.map(r => [r.k, { revenue: parseFloat(r.revenue) || 0, deals: parseInt(r.deals) || 0 }]));

    const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const labelOf = (d) => {
      if (gran === 'year') return String(d.getFullYear());
      if (gran === 'month') {
        const m = d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
        return d.getMonth() === 0 ? `${m} ${String(d.getFullYear()).slice(2)}` : m;
      }
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };
    const toBuckets = (arr) => arr.map(d => {
      const v = byKey.get(keyOf(d)) || { revenue: 0, deals: 0 };
      return { date: keyOf(d), label: labelOf(d), revenue: v.revenue, deals: v.deals };
    });

    const buckets = toBuckets(starts);
    const prev_buckets = toBuckets(prevStarts);
    const total = buckets.reduce((a, b) => a + b.revenue, 0);
    const prev_total = prev_buckets.reduce((a, b) => a + b.revenue, 0);
    res.json({ granularity: gran, buckets, prev_buckets, total, prev_total });
  } catch (e) {
    console.error('sales-chart error', e);
    res.status(500).json({ error: e.message });
  }
});

// === AUTH ===
// In-memory rate limiter for login attempts: 5 fails per 15 min per (IP+username)
const loginAttempts = new Map(); // key → { count, firstAt }
function loginRateCheck(ip, username) {
  const key = `${ip}|${(username || '').toLowerCase()}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const rec = loginAttempts.get(key);
  if (rec && now - rec.firstAt > windowMs) loginAttempts.delete(key);
  const cur = loginAttempts.get(key);
  if (cur && cur.count >= 5) {
    const waitMin = Math.ceil((windowMs - (now - cur.firstAt)) / 60000);
    return { blocked: true, waitMin };
  }
  return { blocked: false };
}
function loginRecordFail(ip, username) {
  const key = `${ip}|${(username || '').toLowerCase()}`;
  const rec = loginAttempts.get(key);
  if (rec) rec.count++; else loginAttempts.set(key, { count: 1, firstAt: Date.now() });
}
function loginClearFails(ip, username) {
  loginAttempts.delete(`${ip}|${(username || '').toLowerCase()}`);
}
// Cleanup stale entries every hour
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of loginAttempts) if (v.firstAt < cutoff) loginAttempts.delete(k);
}, 60 * 60 * 1000);

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const rl = loginRateCheck(ip, username);
    if (rl.blocked) return res.status(429).json({ error: `Слишком много попыток. Попробуйте через ${rl.waitMin} мин.` });
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!rows[0]) { loginRecordFail(ip, username); return res.status(401).json({ error: 'Пользователь не найден' }); }
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) { loginRecordFail(ip, username); return res.status(401).json({ error: 'Неверный пароль' }); }
    loginClearFails(ip, username);
    if (rows[0].is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован. Обратитесь к администратору.' });
    // Fetch company/branch names for display
    let companyName = null, branchName = null;
    if (rows[0].company_id) {
      const c = await pool.query('SELECT name FROM companies WHERE id=$1', [rows[0].company_id]);
      companyName = c.rows[0]?.name || null;
    }
    if (rows[0].branch_id) {
      const b = await pool.query('SELECT name FROM branches WHERE id=$1', [rows[0].branch_id]);
      branchName = b.rows[0]?.name || null;
    }
    const payload = {
      id: rows[0].id, username: rows[0].username, role: rows[0].role,
      company_id: rows[0].company_id || null,
      branch_id: rows[0].branch_id || null,
      first_name: rows[0].first_name || null,
      last_name: rows[0].last_name || null,
      company_name: companyName, branch_name: branchName,
    };
    const token = jwt.sign({
      id: payload.id, username: payload.username, role: payload.role,
      company_id: payload.company_id, branch_id: payload.branch_id,
    }, JWT_SECRET, { expiresIn: '24h' });
    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});
    res.json({ token, user: payload });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify token and return current user (used on page load)
app.get('/api/auth/me', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.role, u.company_id, u.branch_id, u.first_name, u.last_name, u.is_blocked,
              c.name AS company_name, b.name AS branch_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id=$1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Пользователь не найден' });
    if (rows[0].is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });
    res.json({ user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === USERS ===
app.get('/api/users', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  let query = `SELECT u.id, u.username, u.first_name, u.last_name, u.role, u.company_id, u.branch_id,
    u.is_blocked, u.created_at, u.last_login_at, u.created_by,
    cb.username as created_by_name, cb.role as created_by_role
    FROM users u LEFT JOIN users cb ON u.created_by = cb.id WHERE u.role != $1`;
  const params = ['admin'];
  if (isCompanyLevel(req.user.role)) { query += ' AND u.company_id = $2'; params.push(req.user.company_id); }
  else if (req.user.role === 'manager') { query += ' AND u.branch_id = $2'; params.push(req.user.branch_id); }
  query += ' ORDER BY u.id';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.post('/api/users', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const { username, password, role, branch_id, company_id, first_name, last_name } = req.body;
    { const v = validatePassword(password); if (!v.ok) return res.status(400).json({ error: v.error }); }
    const hash = await bcrypt.hash(password, 10);
    let companyId, branchId;
    if (req.user.role === 'admin') {
      companyId = company_id ? parseInt(company_id) : null;
      branchId = branch_id ? parseInt(branch_id) : null;
    } else if (isCompanyLevel(req.user.role)) {
      companyId = req.user.company_id;
      branchId = branch_id ? parseInt(branch_id) : null;
    } else if (req.user.role === 'manager') {
      companyId = req.user.company_id;
      branchId = req.user.branch_id;
    } else {
      companyId = null; branchId = null;
    }
    // Company-level roles — never attach a branch
    if (isCompanyLevel(role)) branchId = null;
    // Pre-check: only one founder/gen_dir per company
    if (isCompanyLevel(role) && companyId) {
      const dup = await pool.query('SELECT id, username FROM users WHERE role=$1 AND company_id=$2 LIMIT 1', [role, companyId]);
      if (dup.rows[0]) {
        const label = role === 'founder' ? 'учредитель' : 'ген. директор';
        return res.status(409).json({ error: `У компании уже есть ${label}: @${dup.rows[0].username}. Сначала измените его роль.` });
      }
    }
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, last_name, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, username, first_name, last_name, role, created_at',
        [username, hash, role, companyId, branchId, first_name || null, last_name || null, req.user.id]
      );
      res.json(rows[0]);
    } catch (e) {
      if (e.code === '23505' && (e.constraint === 'one_gen_dir_per_company' || e.constraint === 'one_founder_per_company')) {
        return res.status(409).json({ error: 'У компании уже есть такой пользователь с этой ролью' });
      }
      if (e.code === '23505') return res.status(409).json({ error: 'Логин уже занят' });
      throw e;
    }
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Returns true if the calling user is allowed to mutate the target user.
// Non-admin can only touch users in their own company; manager additionally restricted to own branch
// and forbidden from touching admin/founder/gen_dir roles.
function canMutateUser(actor, target) {
  if (actor.role === 'admin') return true;
  if (!target) return false;
  if (target.company_id !== actor.company_id) return false;
  if (actor.role === 'manager') {
    if (target.branch_id !== actor.branch_id) return false;
    if (['admin', 'founder', 'gen_dir', 'manager'].includes(target.role)) return false;
  }
  if (actor.role === 'gen_dir' || actor.role === 'founder') {
    if (target.role === 'admin') return false;
  }
  return true;
}

app.put('/api/users/:id', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { role, company_id, branch_id, first_name, last_name, username } = req.body;
    const { rows: [cur] } = await pool.query('SELECT id, role, username, company_id, branch_id FROM users WHERE id=$1', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    if (!canMutateUser(req.user, cur)) return res.status(403).json({ error: 'Out of scope' });
    // Force tenant fields to caller's scope for non-admin to prevent escalation
    let effectiveCompany = company_id;
    let effectiveBranch = branch_id;
    if (req.user.role !== 'admin') {
      effectiveCompany = req.user.company_id;
      if (req.user.role === 'manager') effectiveBranch = req.user.branch_id;
    }
    if (cur && role && cur.role !== role) {
      await pool.query(
        'INSERT INTO role_change_log (user_id, username, old_role, new_role, changed_by, changed_by_username) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, cur.username, cur.role, role, req.user.id, req.user.username]
      );
    }
    const branchVal = isCompanyLevel(role) ? null : (effectiveBranch || null);
    if (isCompanyLevel(role) && (effectiveCompany || cur?.company_id)) {
      const targetCompany = effectiveCompany || cur?.company_id;
      const dup = await pool.query('SELECT id, username FROM users WHERE role=$1 AND company_id=$2 AND id != $3 LIMIT 1', [role, targetCompany, id]);
      if (dup.rows[0]) {
        const label = role === 'founder' ? 'учредитель' : 'ген. директор';
        return res.status(409).json({ error: `У компании уже есть ${label}: @${dup.rows[0].username}. Сначала измените его роль.` });
      }
    }
    const sets = ['role=$1','company_id=$2','branch_id=$3','first_name=$4','last_name=$5'];
    const vals = [role, effectiveCompany || null, branchVal, first_name || null, last_name || null];
    if (req.user.role === 'admin' && username && username.trim()) {
      sets.push(`username=$${vals.length + 1}`);
      vals.push(username.trim());
    }
    vals.push(id);
    try {
      await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    } catch (e) {
      if (e.code === '23505' && (e.constraint === 'one_gen_dir_per_company' || e.constraint === 'one_founder_per_company')) {
        return res.status(409).json({ error: 'У компании уже есть такой пользователь с этой ролью' });
      }
      if (e.code === '23505') return res.status(409).json({ error: 'Логин уже занят' });
      throw e;
    }
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/users/:id', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { rows: [cur] } = await pool.query('SELECT id, username, role, branch_id, company_id FROM users WHERE id=$1', [id]);
    if (!cur) return res.json({ ok: true });
    if (!canMutateUser(req.user, cur)) return res.status(403).json({ error: 'Out of scope' });
    if (cur.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    audit(req, 'delete', 'user', cur.id, cur, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/block', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { rows: [cur] } = await pool.query('SELECT id, role, branch_id, company_id FROM users WHERE id=$1', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    if (!canMutateUser(req.user, cur)) return res.status(403).json({ error: 'Out of scope' });
    if (cur.id === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    const { is_blocked } = req.body;
    await pool.query('UPDATE users SET is_blocked = $1 WHERE id = $2', [is_blocked, id]);
    audit(req, is_blocked ? 'block' : 'unblock', 'user', id, null, { is_blocked });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// User changes their OWN password (any role) — requires current password
app.post('/api/auth/change-password', auth(), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    { const v = validatePassword(new_password); if (!v.ok) return res.status(400).json({ error: v.error }); }
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const ok = await bcrypt.compare(current_password || '', rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/reset-password', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    const { user_id, password } = req.body;
    const targetId = parseInt(user_id, 10);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'bad user_id' });
    { const v = validatePassword(password); if (!v.ok) return res.status(400).json({ error: v.error }); }
    const { rows: [cur] } = await pool.query('SELECT id, role, branch_id, company_id FROM users WHERE id=$1', [targetId]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    if (!canMutateUser(req.user, cur)) return res.status(403).json({ error: 'Out of scope' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, targetId]);
    audit(req, 'reset_password', 'user', targetId, null, { by: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// === PRODUCT TYPES ===
app.get('/api/types', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM product_types ORDER BY name_ru');
  res.json(rows);
});

app.post('/api/types', auth(['admin', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const { name_ru, name_uz } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO product_types (name_ru, name_uz) VALUES ($1, $2) RETURNING *',
      [name_ru, name_uz || name_ru]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/types/:id', auth(['admin']), async (req, res) => {
  const { name_ru, name_uz } = req.body;
  const { rows } = await pool.query(
    'UPDATE product_types SET name_ru=$1, name_uz=$2 WHERE id=$3 RETURNING *',
    [name_ru, name_uz || name_ru, req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/api/types/:id', auth(['admin']), async (req, res) => {
  await pool.query('DELETE FROM product_types WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// === CATEGORIES ===
app.get('/api/categories', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY name_ru');
  res.json(rows);
});

app.post('/api/categories', auth(['admin', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const { name_ru, name_uz } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO categories (name_ru, name_uz) VALUES ($1, $2) RETURNING *',
      [name_ru, name_uz || name_ru]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// === PRODUCTS ===
// Catalog is company-wide: any branch sees products created by any other branch of
// the same company. Stock is per-branch (with COALESCE 0 if a branch hasn't stocked it yet).
app.get('/api/products', auth(), async (req, res) => {
  try {
    const { search, barcode } = req.query;
    const branchId = getBranchFilter(req.user, req.query);
    const params = [];
    // Stock subquery: per-branch when branchId known, otherwise sum across branches
    let stockJoin;
    if (branchId) {
      params.push(branchId);
      stockJoin = `LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.branch_id = $${params.length}`;
    } else {
      stockJoin = `LEFT JOIN (SELECT product_id, SUM(quantity) AS quantity FROM product_stock GROUP BY product_id) ps ON p.id = ps.product_id`;
    }
    let query = `
      SELECT p.*, pt.name_ru AS type_name_ru, pt.name_uz AS type_name_uz,
             c.name_ru AS cat_name_ru, c.name_uz AS cat_name_uz,
             COALESCE(ps.quantity, 0) AS stock
      FROM products p
      LEFT JOIN product_types pt ON p.type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${stockJoin}
    `;
    const conditions = ['p.deleted_at IS NULL'];
    // Scope by company (admin can see all)
    if (req.user.role !== 'admin' && req.user.company_id) {
      conditions.push(`p.company_id = $${params.length+1}`); params.push(req.user.company_id);
    }
    if (barcode) { conditions.push(`p.barcode = $${params.length+1}`); params.push(barcode); }
    else if (search) {
      conditions.push(`(p.name_ru ILIKE $${params.length+1} OR p.name_uz ILIKE $${params.length+1} OR p.barcode ILIKE $${params.length+1} OR p.brand ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY p.name_ru LIMIT 200';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', auth(), async (req, res) => {
  const branchId = getBranchFilter(req.user, req.query);
  const params = [req.params.id];
  let stockJoin;
  if (branchId) {
    params.push(branchId);
    stockJoin = `LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.branch_id = $${params.length}`;
  } else {
    stockJoin = `LEFT JOIN (SELECT product_id, SUM(quantity) AS quantity FROM product_stock GROUP BY product_id) ps ON p.id = ps.product_id`;
  }
  // Tenant isolation: non-admin users only see products of their own company.
  let companyCond = '';
  if (req.user.role !== 'admin' && req.user.company_id) {
    params.push(req.user.company_id);
    companyCond = ` AND p.company_id = $${params.length}`;
  }
  const { rows } = await pool.query(`
    SELECT p.*, pt.name_ru AS type_name_ru, c.name_ru AS cat_name_ru,
           COALESCE(ps.quantity, 0) AS stock
    FROM products p
    LEFT JOIN product_types pt ON p.type_id = pt.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${stockJoin}
    WHERE p.id = $1 AND p.deleted_at IS NULL${companyCond}
  `, params);
  if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
  res.json(rows[0]);
});

app.post('/api/products', auth(['admin', 'cashier', 'warehouse', 'manager']), async (req, res) => {
  try {
    const { name_ru, name_uz, type_id, category_id, barcode, photo_url, unit, price_buy, price_sell, color_size, brand } = req.body;
    // Catalog scope = company, not branch. branch_id retained for legacy queries (= user's branch).
    const companyId = req.user.company_id || null;
    const branchId = getBranchFilter(req.user, req.body);
    const { rows } = await pool.query(
      `INSERT INTO products (name_ru, name_uz, type_id, category_id, barcode, photo_url, unit, price_buy, price_sell, color_size, brand, branch_id, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name_ru, name_uz || name_ru, type_id || null, category_id || null, barcode || null,
       photo_url || null, unit || 'шт', price_buy || 0, price_sell || 0, color_size || null, brand || null, branchId, companyId]
    );
    // No pre-created product_stock row. Each branch gets one on first income/outcome.
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/products/:id', auth(['admin', 'cashier', 'warehouse', 'manager']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { rows: [cur] } = await pool.query(
      'SELECT id, company_id FROM products WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!cur) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && cur.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Out of scope' });
    }
    const { name_ru, name_uz, type_id, category_id, barcode, photo_url, unit, price_buy, price_sell, color_size, brand } = req.body;
    const { rows } = await pool.query(
      `UPDATE products SET name_ru=$1, name_uz=$2, type_id=$3, category_id=$4, barcode=$5,
       photo_url=$6, unit=$7, price_buy=$8, price_sell=$9, color_size=$10, brand=$11
       WHERE id=$12 AND company_id=$13 RETURNING *`,
      [name_ru, name_uz || name_ru, type_id || null, category_id || null, barcode || null,
       photo_url || null, unit || 'шт', price_buy || 0, price_sell || 0, color_size || null, brand || null,
       id, cur.company_id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/products/:id', auth(['admin', 'manager', 'gen_dir', 'founder']), async (req, res) => {
  try {
    // Soft-delete — preserves history. Use a real DELETE later via cleanup task if truly needed.
    const { rows: [cur] } = await pool.query('SELECT id, name_ru, branch_id, company_id FROM products WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    // Scope: non-admin can only delete own company's products
    if (req.user.role !== 'admin' && cur.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Out of scope' });
    }
    await pool.query('UPDATE products SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    audit(req, 'delete', 'product', cur.id, { name_ru: cur.name_ru }, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products/generate-barcode', auth(['admin', 'cashier', 'warehouse']), async (req, res) => {
  try {
    let barcode, exists = true;
    while (exists) {
      const ts = Date.now().toString().slice(-9);
      const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      barcode = `2${ts}${rand}`.slice(0, 13);
      const { rows } = await pool.query('SELECT id FROM products WHERE barcode = $1', [barcode]);
      exists = rows.length > 0;
    }
    res.json({ barcode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === STOCK INCOME ===
app.get('/api/stock/income-list', auth(), async (req, res) => {
  const branchId = getBranchFilter(req.user, req.query);
  const params = [];
  let where = '';
  if (branchId) { where = 'WHERE si.branch_id = $1'; params.push(branchId); }
  const { rows } = await pool.query(`
    SELECT si.*, p.name_ru, p.barcode, p.unit,
           u.username AS created_by_name, u.first_name AS created_by_first_name,
           u.last_name AS created_by_last_name, u.role AS created_by_role
    FROM stock_income si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN users u ON si.created_by = u.id
    ${where}
    ORDER BY si.created_at DESC LIMIT 200
  `, params);
  res.json(rows);
});

app.post('/api/stock/income', auth(['cashier', 'warehouse', 'manager']), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      product_id, quantity, price, price_sell, note, supplier, supplier_id, exchange_rate,
      payment_status, paid_amount, due_date, payment_method, currency,
    } = req.body;
    const pid = parseInt(product_id);
    const qty = parseFloat(quantity);
    if (!pid || !Number.isFinite(pid))     return res.status(400).json({ error: 'product_id обязателен' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'quantity должен быть > 0' });
    await client.query('BEGIN');
    const branchId = getBranchFilter(req.user, req.body);
    // Resolve supplier: prefer explicit supplier_id, fallback to text 'supplier' for legacy callers
    let supId = supplier_id ? parseInt(supplier_id) : null;
    let supText = supplier || null;
    if (supId) {
      const sup = await client.query('SELECT name, company_id FROM suppliers WHERE id=$1 AND deleted_at IS NULL', [supId]);
      if (!sup.rows[0] || sup.rows[0].company_id !== req.user.company_id) {
        await client.query('ROLLBACK'); return res.status(400).json({ error: 'Supplier out of scope' });
      }
      supText = sup.rows[0].name;
    }
    // Payment status (we OWE supplier scenarios)
    const total = qty * parseFloat(price || 0);
    let pstatus = ['paid','debt','partial'].includes(payment_status) ? payment_status : 'paid';
    let paid = parseFloat(paid_amount);
    if (!Number.isFinite(paid) || paid < 0) paid = pstatus === 'paid' ? total : 0;
    if (pstatus === 'paid')  paid = total;
    if (pstatus === 'debt')  paid = 0;
    if (pstatus === 'partial' && paid >= total) pstatus = 'paid';
    if (pstatus === 'partial' && paid <= 0)     pstatus = 'debt';
    const dueDate = pstatus !== 'paid' && due_date ? due_date : null;
    const pmethod = ['cash','card','transfer','wire','debt'].includes(payment_method) ? payment_method : 'cash';
    const cur = (currency || 'UZS').toUpperCase();

    const { rows } = await client.query(
      `INSERT INTO stock_income (product_id, quantity, price, note, created_by, supplier, supplier_id, exchange_rate, branch_id,
                                 payment_status, paid_amount, due_date, payment_method, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, $10,$11,$12,$13,$14) RETURNING *`,
      [pid, qty, price || 0, note || '', req.user.id, supText, supId, exchange_rate || 0, branchId,
       pstatus, paid, dueDate, pmethod, cur]
    );

    // If money was actually paid → mirror as cash_expense (so it shows in cash balance)
    if (paid > 0) {
      const prodName = await client.query('SELECT name_ru FROM products WHERE id=$1', [pid]);
      const desc = `Закупка${supText ? ': ' + supText : ''} — ${prodName.rows[0]?.name_ru || ''} × ${qty}${pstatus === 'partial' ? ' (частично)' : ''}`;
      await client.query(
        `INSERT INTO cash_expense (amount, description, created_by, branch_id, payment_method, currency, original_amount, exchange_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [paid, desc, req.user.id, branchId, pmethod === 'debt' ? 'cash' : pmethod, 'UZS', paid, 1]
      );
    }
    await client.query(
      `INSERT INTO product_stock (product_id, branch_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = product_stock.quantity + $3, updated_at = NOW()`,
      [pid, branchId, qty]
    );

    // Update product prices from this shipment.
    // - Buy price: if provided > 0 and changed, write the new buy price.
    //   Future: could become an average; for now we keep "latest wins" so cashier sees current cost.
    // - Sell price: only update if cashier explicitly provided a non-null value (price_sell !== null && >= 0).
    //   Passing null = "don't touch sell price for this product".
    const newBuy = parseFloat(price);
    if (Number.isFinite(newBuy) && newBuy > 0) {
      await client.query('UPDATE products SET price_buy = $1 WHERE id = $2', [newBuy, pid]);
    }
    if (price_sell !== null && price_sell !== undefined) {
      const newSell = parseFloat(price_sell);
      if (Number.isFinite(newSell) && newSell >= 0) {
        await client.query('UPDATE products SET price_sell = $1 WHERE id = $2', [newSell, pid]);
      }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// === STOCK OUTCOME ===
app.get('/api/stock/outcome-list', auth(), async (req, res) => {
  const branchId = getBranchFilter(req.user, req.query);
  const params = [];
  const conds = [];
  if (branchId) { conds.push(`so.branch_id = $${params.length+1}`); params.push(branchId); }
  // Tenant isolation: non-admin без branch-фильтра всё равно ограничен своей компанией
  // (иначе founder/gen_dir по «Все филиалы» видел бы продажи чужих компаний).
  if (req.user.role !== 'admin' && req.user.company_id) {
    conds.push(`p.company_id = $${params.length+1}`); params.push(req.user.company_id);
  }
  // Sellers see ONLY their own sales — enforced server-side
  if (req.user.role === 'seller') { conds.push(`so.created_by = $${params.length+1}`); params.push(req.user.id); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { rows } = await pool.query(`
    SELECT so.*, p.name_ru, p.name_uz, p.barcode, p.unit,
           u.username AS created_by_name, u.first_name AS created_by_first_name,
           u.last_name AS created_by_last_name, u.role AS created_by_role,
           a.username AS approved_by_name,
           s.name AS supplier_name,
           c.name AS customer_name,
           ci.is_settled AS cash_settled
    FROM stock_outcome so
    JOIN products p ON so.product_id = p.id
    LEFT JOIN users u ON so.created_by = u.id
    LEFT JOIN users a ON so.approved_by = a.id
    LEFT JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN customers c ON so.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT bool_and(is_settled) AS is_settled FROM cash_income WHERE outcome_id = so.id
    ) ci ON TRUE
    ${where}
    ORDER BY so.created_at DESC LIMIT 200
  `, params);
  res.json(rows);
});

// === SALES HISTORY (для окна руководителя — реальные продажи, read-only) ===
// Каждая строка stock_outcome = продажа N единиц одного товара (чек-группировки
// в текущей схеме нет, поэтому показываем построчно). Фильтры: период, филиал,
// способ оплаты, тип (B2B = есть клиент в базе / B2C = розница без клиента), поиск.
app.get('/api/sales/history', auth(['admin', 'founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    let scope;
    try { scope = await getUserBranchIds(req.user, req.query); }
    catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) {
      return res.json({ kpi: { today_count: 0, today_sum: 0, period_count: 0, period_sum: 0, avg_check: 0, b2b_count: 0, b2b_share: 0, returns_count: 0 }, rows: [] });
    }
    const companyId = req.user.company_id;
    const from = req.query.from || null;
    const to = req.query.to || null;
    const pm = req.query.pm && ['cash', 'card', 'transfer', 'wire', 'debt'].includes(req.query.pm) ? req.query.pm : null;
    const type = ['b2b', 'b2c'].includes(req.query.type) ? req.query.type : null;
    const search = (req.query.search || '').trim();

    const params = [];
    const conds = [`so.status = 'approved'`];
    if (scope.ids) { params.push(scope.ids); conds.push(`so.branch_id = ANY($${params.length}::int[])`); }
    if (req.user.role !== 'admin' && companyId) { params.push(companyId); conds.push(`p.company_id = $${params.length}`); }
    if (from) { params.push(from); conds.push(`so.created_at >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`so.created_at <  $${params.length}`); }
    if (pm)   { params.push(pm);   conds.push(`COALESCE(so.payment_method,'cash') = $${params.length}`); }
    if (type === 'b2b') conds.push(`so.customer_id IS NOT NULL`);
    if (type === 'b2c') conds.push(`so.customer_id IS NULL`);
    if (search) { params.push('%' + search + '%'); conds.push(`(p.name_ru ILIKE $${params.length} OR c.name ILIKE $${params.length} OR CAST(so.id AS TEXT) = ${"'" + search.replace(/'/g, '') + "'"})`); }
    const where = 'WHERE ' + conds.join(' AND ');

    const listQ = await pool.query(`
      SELECT so.id, so.created_at, so.quantity, so.price, so.payment_method, so.payment_status,
             so.paid_amount, so.currency, so.customer_id,
             p.name_ru, p.unit,
             c.name AS customer_name,
             b.name AS branch_name,
             COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name,'')), ''), u.username) AS seller_name,
             u.role AS seller_role
      FROM stock_outcome so
      JOIN products p ON p.id = so.product_id
      LEFT JOIN customers c ON c.id = so.customer_id
      LEFT JOIN branches b ON b.id = so.branch_id
      LEFT JOIN users u ON u.id = so.created_by
      ${where}
      ORDER BY so.created_at DESC
      LIMIT 300`, params);

    // KPI-агрегаты по тому же scope (без фильтров pm/type/search — общая картина периода)
    const kpiParams = [];
    const kpiConds = [`so.status = 'approved'`];
    if (scope.ids) { kpiParams.push(scope.ids); kpiConds.push(`so.branch_id = ANY($${kpiParams.length}::int[])`); }
    if (req.user.role !== 'admin' && companyId) { kpiParams.push(companyId); kpiConds.push(`p.company_id = $${kpiParams.length}`); }
    if (from) { kpiParams.push(from); kpiConds.push(`so.created_at >= $${kpiParams.length}`); }
    if (to)   { kpiParams.push(to);   kpiConds.push(`so.created_at <  $${kpiParams.length}`); }
    const kpiWhere = 'WHERE ' + kpiConds.join(' AND ');
    const kpiQ = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE so.created_at::date = CURRENT_DATE) AS today_count,
        COALESCE(SUM(so.quantity * so.price) FILTER (WHERE so.created_at::date = CURRENT_DATE), 0) AS today_sum,
        COUNT(*) AS period_count,
        COALESCE(SUM(so.quantity * so.price), 0) AS period_sum,
        COUNT(*) FILTER (WHERE so.customer_id IS NOT NULL) AS b2b_count,
        COUNT(*) FILTER (WHERE so.payment_status <> 'paid') AS debt_count
      FROM stock_outcome so JOIN products p ON p.id = so.product_id
      ${kpiWhere}`, kpiParams);
    const k = kpiQ.rows[0] || {};
    const periodCount = parseInt(k.period_count) || 0;
    const periodSum = parseFloat(k.period_sum) || 0;
    const b2bCount = parseInt(k.b2b_count) || 0;

    res.json({
      kpi: {
        today_count: parseInt(k.today_count) || 0,
        today_sum: parseFloat(k.today_sum) || 0,
        period_count: periodCount,
        period_sum: periodSum,
        avg_check: periodCount > 0 ? Math.round(periodSum / periodCount) : 0,
        b2b_count: b2bCount,
        b2b_share: periodCount > 0 ? Math.round((b2bCount / periodCount) * 100) : 0,
        debt_count: parseInt(k.debt_count) || 0,
      },
      rows: listQ.rows.map(r => ({
        id: r.id,
        date: r.created_at,
        product: r.name_ru,
        unit: r.unit,
        qty: parseFloat(r.quantity) || 0,
        price: parseFloat(r.price) || 0,
        total: (parseFloat(r.quantity) || 0) * (parseFloat(r.price) || 0),
        pm: r.payment_method || 'cash',
        payment_status: r.payment_status || 'paid',
        currency: r.currency || 'UZS',
        customer: r.customer_name,
        type: r.customer_id ? 'B2B' : 'B2C',
        branch: r.branch_name,
        seller: r.seller_name,
        seller_role: r.seller_role,
      })),
    });
  } catch (e) {
    console.error('sales/history error', e);
    res.status(500).json({ error: e.message });
  }
});

// ===================================================================
// === ФИНАНСОВАЯ АНАЛИТИКА (Cash Flow / Break-even / Финмодель) ===
// Всё считается из РЕАЛЬНЫХ данных (cash_income/expense + продажи).
// Helper-функции переиспользуются GET-эндпоинтами И AI-агентом (/api/ai/analyze),
// чтобы AI анализировал ровно те же реальные цифры, что видит пользователь.
// ===================================================================

function branchArrayCond(scope, params, col = 'branch_id') {
  if (scope.ids) { params.push(scope.ids); return `${col} = ANY($${params.length}::int[])`; }
  return '1=1';
}

// — Cash Flow: приход/расход/сальдо + по дням + 7-дневный трендовый прогноз
async function computeCashflow(scope, fromIso, toIso) {
  const toD = toIso ? new Date(toIso) : new Date();
  const fromD = fromIso ? new Date(fromIso) : (() => { const d = new Date(toD); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d; })();
  const from = fromD.toISOString(), to = toD.toISOString();
  const periodMs = new Date(to) - new Date(from);
  const prevFrom = new Date(new Date(from) - periodMs).toISOString();

  const ip = []; const ic = branchArrayCond(scope, ip);
  const ep = []; const ec = branchArrayCond(scope, ep);
  // by_day: $1 = branch ids (если есть), затем from/to для generate_series.
  const bp = scope.ids ? [scope.ids] : [];
  const branchSub = scope.ids ? `AND branch_id = ANY($1::int[])` : '';
  const fi = bp.length + 1, ti = bp.length + 2;
  bp.push(from, to);
  const [inc, exp, prevInc, prevExp, byDayQ] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_income WHERE ${ic} AND is_settled IS NOT FALSE AND created_at>=$${ip.length+1} AND created_at<$${ip.length+2}`, [...ip, from, to]),
    pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_expense WHERE ${ec} AND created_at>=$${ep.length+1} AND created_at<$${ep.length+2}`, [...ep, from, to]),
    pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_income WHERE ${ic} AND is_settled IS NOT FALSE AND created_at>=$${ip.length+1} AND created_at<$${ip.length+2}`, [...ip, prevFrom, from]),
    pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_expense WHERE ${ec} AND created_at>=$${ep.length+1} AND created_at<$${ep.length+2}`, [...ep, prevFrom, from]),
    pool.query(`
      SELECT d::date AS day,
        COALESCE((SELECT SUM(amount) FROM cash_income WHERE is_settled IS NOT FALSE AND created_at::date = d::date ${branchSub}),0) AS income,
        COALESCE((SELECT SUM(amount) FROM cash_expense WHERE created_at::date = d::date ${branchSub}),0) AS expense
      FROM generate_series($${fi}::date, $${ti}::date, '1 day') d`, bp),
  ]);
  const income = parseFloat(inc.rows[0].t) || 0;
  const expense = parseFloat(exp.rows[0].t) || 0;
  const prevBalance = (parseFloat(prevInc.rows[0].t) || 0) - (parseFloat(prevExp.rows[0].t) || 0);
  const balance = income - expense;
  const by_day = byDayQ.rows.map(r => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    income: parseFloat(r.income) || 0,
    expense: parseFloat(r.expense) || 0,
    net: (parseFloat(r.income) || 0) - (parseFloat(r.expense) || 0),
  }));
  // Прогноз: средний чистый поток за последние 7 дней с данными → проекция на 7 дней вперёд
  const last7 = by_day.slice(-7);
  const avgNet = last7.length ? last7.reduce((a, b) => a + b.net, 0) / last7.length : 0;
  let running = balance;
  const forecast_7d = [];
  const lastDay = by_day.length ? new Date(by_day[by_day.length - 1].day) : new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(lastDay); d.setDate(d.getDate() + i);
    running += avgNet;
    forecast_7d.push({ day: d.toISOString().slice(0, 10), projected_balance: Math.round(running) });
  }
  return {
    period: { from, to },
    income, expense, balance,
    prev_balance: prevBalance,
    balance_delta_pct: prevBalance !== 0 ? Math.round(((balance - prevBalance) / Math.abs(prevBalance)) * 100) : null,
    by_day,
    forecast_avg_net: Math.round(avgNet),
    forecast_7d,
    forecast_end_balance: forecast_7d.length ? forecast_7d[forecast_7d.length - 1].projected_balance : balance,
  };
}

// — Точка безубыточности: постоянные расходы / маржинальность
async function computeBreakEven(scope, fromIso, toIso) {
  // По умолчанию — текущий календарный месяц
  const now = new Date();
  const fromD = fromIso ? new Date(fromIso) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toD = toIso ? new Date(toIso) : now;
  const from = fromD.toISOString(), to = toD.toISOString();

  const sp = []; const sc = branchArrayCond(scope, sp, 'so.branch_id');
  const salesQ = await pool.query(`
    SELECT COALESCE(SUM(so.quantity*so.price),0) revenue,
           COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) cogs,
           COUNT(*) deals
    FROM stock_outcome so JOIN products p ON p.id=so.product_id
    WHERE so.status='approved' AND ${sc} AND so.created_at>=$${sp.length+1} AND so.created_at<$${sp.length+2}`,
    [...sp, from, to]);
  const ep = []; const ec = branchArrayCond(scope, ep);
  const expQ = await pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_expense WHERE ${ec} AND created_at>=$${ep.length+1} AND created_at<$${ep.length+2}`, [...ep, from, to]);

  const revenue = parseFloat(salesQ.rows[0].revenue) || 0;
  const cogs = parseFloat(salesQ.rows[0].cogs) || 0;
  const deals = parseInt(salesQ.rows[0].deals) || 0;
  const fixedCosts = parseFloat(expQ.rows[0].t) || 0;   // постоянные/операционные расходы (касса)
  const grossProfit = revenue - cogs;
  const marginRatio = revenue > 0 ? grossProfit / revenue : 0;   // маржинальность (доля)
  const breakEvenRevenue = marginRatio > 0 ? fixedCosts / marginRatio : null;
  const aboveBreakEven = breakEvenRevenue != null && revenue >= breakEvenRevenue;
  // Темп: дней прошло в месяце, дневная выручка, прогноз на конец месяца
  const daysInMonth = new Date(toD.getFullYear(), toD.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.max(1, toD.getDate());
  const dailyRevenue = revenue / dayOfMonth;
  const projectedMonthRevenue = dailyRevenue * daysInMonth;
  // На какой день месяца выходим в плюс (по текущему темпу)
  let breakEvenDay = null;
  if (breakEvenRevenue != null && dailyRevenue > 0) {
    breakEvenDay = Math.ceil(breakEvenRevenue / dailyRevenue);
    if (breakEvenDay > daysInMonth) breakEvenDay = null; // не успеваем в этом месяце
  }
  const safetyMarginPct = (breakEvenRevenue && revenue > 0) ? Math.round(((revenue - breakEvenRevenue) / revenue) * 100) : null;
  const remainingToBreakEven = (breakEvenRevenue != null && !aboveBreakEven) ? breakEvenRevenue - revenue : 0;
  const avgCheck = deals > 0 ? revenue / deals : 0;
  const salesNeeded = (remainingToBreakEven > 0 && avgCheck > 0) ? Math.ceil(remainingToBreakEven / avgCheck) : 0;

  return {
    period: { from, to },
    revenue, cogs, gross_profit: grossProfit,
    margin_ratio: Math.round(marginRatio * 1000) / 10,    // в процентах
    fixed_costs: fixedCosts,
    break_even_revenue: breakEvenRevenue != null ? Math.round(breakEvenRevenue) : null,
    above_break_even: aboveBreakEven,
    remaining_to_break_even: Math.round(remainingToBreakEven),
    sales_needed: salesNeeded,
    avg_check: Math.round(avgCheck),
    break_even_day: breakEvenDay,
    days_in_month: daysInMonth,
    day_of_month: dayOfMonth,
    daily_revenue: Math.round(dailyRevenue),
    projected_month_revenue: Math.round(projectedMonthRevenue),
    safety_margin_pct: safetyMarginPct,
    net_profit: grossProfit - fixedCosts,
  };
}

// — Финансовая модель: помесячный P&L за 6 мес + проекция на 3 мес
async function computeFinModel(scope) {
  const sp = []; const sc = branchArrayCond(scope, sp, 'so.branch_id');
  const salesByMonth = await pool.query(`
    SELECT to_char(date_trunc('month', so.created_at), 'YYYY-MM') AS m,
           COALESCE(SUM(so.quantity*so.price),0) revenue,
           COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) cogs
    FROM stock_outcome so JOIN products p ON p.id=so.product_id
    WHERE so.status='approved' AND ${sc} AND so.created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
    GROUP BY m`, sp);
  const ep = []; const ec = branchArrayCond(scope, ep);
  const expByMonth = await pool.query(`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS m, COALESCE(SUM(amount),0) opex
    FROM cash_expense WHERE ${ec} AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
    GROUP BY m`, ep);
  const salesMap = new Map(salesByMonth.rows.map(r => [r.m, r]));
  const expMap = new Map(expByMonth.rows.map(r => [r.m, parseFloat(r.opex) || 0]));

  const months = [];
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = salesMap.get(key);
    const revenue = s ? parseFloat(s.revenue) || 0 : 0;
    const cogs = s ? parseFloat(s.cogs) || 0 : 0;
    const opex = expMap.get(key) || 0;
    const grossProfit = revenue - cogs;
    months.push({
      month: key,
      label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      revenue, cogs, gross_profit: grossProfit, opex, net_profit: grossProfit - opex,
    });
  }
  // Темп роста выручки (среднемесячный, по месяцам с данными)
  const withData = months.filter(m => m.revenue > 0);
  let growth = 0;
  if (withData.length >= 2) {
    const ratios = [];
    for (let i = 1; i < withData.length; i++) {
      if (withData[i - 1].revenue > 0) ratios.push(withData[i].revenue / withData[i - 1].revenue - 1);
    }
    growth = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  }
  growth = Math.max(-0.5, Math.min(0.5, growth)); // ограничиваем разумным диапазоном
  // Средние доли для проекции
  const lastReal = withData[withData.length - 1] || months[months.length - 1];
  const cogsRatio = lastReal.revenue > 0 ? lastReal.cogs / lastReal.revenue : 0.6;
  const avgOpex = withData.length ? withData.reduce((a, b) => a + b.opex, 0) / withData.length : (lastReal.opex || 0);
  const projection = [];
  let projRev = lastReal.revenue || 0;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    projRev = projRev * (1 + growth);
    const cogs = projRev * cogsRatio;
    const grossProfit = projRev - cogs;
    projection.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      revenue: Math.round(projRev), cogs: Math.round(cogs), gross_profit: Math.round(grossProfit),
      opex: Math.round(avgOpex), net_profit: Math.round(grossProfit - avgOpex), projected: true,
    });
  }
  return { months, projection, growth_pct: Math.round(growth * 1000) / 10 };
}

app.get('/api/finance/cashflow', auth(['admin', 'founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    let scope; try { scope = await getUserBranchIds(req.user, req.query); } catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) return res.json({ income: 0, expense: 0, balance: 0, by_day: [], forecast_7d: [] });
    res.json(await computeCashflow(scope, req.query.from, req.query.to));
  } catch (e) { console.error('cashflow err', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/finance/break-even', auth(['admin', 'founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    let scope; try { scope = await getUserBranchIds(req.user, req.query); } catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) return res.json({ revenue: 0, fixed_costs: 0, break_even_revenue: null });
    res.json(await computeBreakEven(scope, req.query.from, req.query.to));
  } catch (e) { console.error('break-even err', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/finance/model', auth(['admin', 'founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    let scope; try { scope = await getUserBranchIds(req.user, req.query); } catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) return res.json({ months: [], projection: [] });
    res.json(await computeFinModel(scope));
  } catch (e) { console.error('fin-model err', e); res.status(500).json({ error: e.message }); }
});

// === SETTINGS OVERVIEW (реальные данные для раздела «Настройки») ===
// Интеграции: честные статусы (env-based) — фейковых «Активна» больше нет.
// Безопасность: реальные пользователи по ролям, смены ролей, AI-запросы.
// Масштабирование: реальные филиалы и валюты из транзакций.
app.get('/api/settings/overview', auth(['admin', 'founder', 'gen_dir']), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [companyQ, branchesQ, usersQ, roleChangesQ, aiUsageQ, currenciesQ] = await Promise.all([
      companyId ? pool.query('SELECT id, name FROM companies WHERE id=$1', [companyId]) : Promise.resolve({ rows: [] }),
      pool.query('SELECT id, name, created_at FROM branches WHERE company_id=$1 ORDER BY id', [companyId]),
      pool.query('SELECT role, COUNT(*) c FROM users WHERE company_id=$1 GROUP BY role', [companyId]),
      pool.query(`SELECT COUNT(*) c FROM role_change_log rcl JOIN users u ON u.id = rcl.user_id
                  WHERE u.company_id=$1 AND rcl.changed_at >= NOW() - INTERVAL '30 days'`, [companyId]),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(prompt_tokens+completion_tokens),0) tokens
                  FROM ai_chat_log WHERE company_id=$1 AND created_at >= NOW() - INTERVAL '30 days'`, [companyId]),
      pool.query(`
        SELECT currency, COUNT(*) c, MAX(exchange_rate) last_rate FROM (
          SELECT COALESCE(ci.currency,'UZS') currency, ci.exchange_rate
          FROM cash_income ci JOIN branches b ON b.id = ci.branch_id WHERE b.company_id = $1
          UNION ALL
          SELECT COALESCE(so.currency,'UZS'), so.exchange_rate
          FROM stock_outcome so JOIN branches b ON b.id = so.branch_id WHERE b.company_id = $1
        ) t GROUP BY currency ORDER BY c DESC`, [companyId]),
    ]);
    res.json({
      company: companyQ.rows[0] || null,
      branches: branchesQ.rows,
      users_by_role: Object.fromEntries(usersQ.rows.map(r => [r.role, parseInt(r.c)])),
      users_total: usersQ.rows.reduce((a, r) => a + parseInt(r.c), 0),
      role_changes_30d: parseInt(roleChangesQ.rows[0]?.c || 0),
      ai_requests_30d: parseInt(aiUsageQ.rows[0]?.c || 0),
      ai_tokens_30d: parseInt(aiUsageQ.rows[0]?.tokens || 0),
      currencies: currenciesQ.rows.map(r => ({ currency: r.currency, tx_count: parseInt(r.c), last_rate: r.last_rate ? parseFloat(r.last_rate) : null })),
      languages: ['RU', 'UZ'],
      integrations: {
        // Честные статусы: активна = реально работает в коде сервера
        deepseek: !!process.env.DEEPSEEK_API_KEY,
        eskiz_sms: false, telegram: false, click: false, payme: false,
        bank_client: false, accounting_1c: false, marketplaces: false,
      },
    });
  } catch (e) { console.error('settings/overview err', e); res.status(500).json({ error: e.message }); }
});

// === HR OVERVIEW (картотека + мотивация — реальные данные) ===
// Сотрудники компании с реальной активностью: продажи за 30 дней,
// последняя активность, стаж. Один эндпоинт обслуживает Картотеку и Мотивацию.
app.get('/api/hr/overview', auth(['admin', 'founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    let scope; try { scope = await getUserBranchIds(req.user, req.query); } catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) return res.json({ employees: [] });
    const companyId = req.user.company_id;

    const params = [companyId];
    let branchCond = '';
    if (scope.ids) { params.push(scope.ids); branchCond = `AND (u.branch_id = ANY($${params.length}::int[]) OR u.branch_id IS NULL)`; }
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.role, u.created_at,
             b.name AS branch_name,
             s.deals_30d, s.revenue_30d, s.last_sale_at
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS deals_30d,
               COALESCE(SUM(so.quantity * so.price), 0) AS revenue_30d,
               MAX(so.created_at) AS last_sale_at
        FROM stock_outcome so
        WHERE so.created_by = u.id AND so.status = 'approved'
          AND so.created_at >= NOW() - INTERVAL '30 days'
      ) s ON TRUE
      WHERE u.company_id = $1 AND u.role <> 'admin' ${branchCond}
      ORDER BY s.revenue_30d DESC NULLS LAST, u.created_at`, params);

    res.json({
      employees: rows.map(r => ({
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
        username: r.username,
        role: r.role,
        branch: r.branch_name,
        hired_at: r.created_at,
        deals_30d: parseInt(r.deals_30d) || 0,
        revenue_30d: parseFloat(r.revenue_30d) || 0,
        last_sale_at: r.last_sale_at,
      })),
    });
  } catch (e) { console.error('hr/overview err', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/stock/pending', auth(['admin', 'founder', 'gen_dir', 'manager', 'warehouse', 'cashier']), async (req, res) => {
  const branchId = getBranchFilter(req.user, req.query);
  const params = [];
  let where = `so.status = 'pending'`;
  if (branchId) { params.push(branchId); where += ` AND so.branch_id = $${params.length}`; }
  const { rows } = await pool.query(`
    SELECT so.*, p.name_ru, p.barcode, p.unit,
           u.username AS created_by_name,
           c.name AS customer_name
    FROM stock_outcome so
    JOIN products p ON so.product_id = p.id
    LEFT JOIN users u ON so.created_by = u.id
    LEFT JOIN customers c ON so.customer_id = c.id
    WHERE ${where}
    ORDER BY so.created_at DESC
  `, params);
  res.json(rows);
});

app.post('/api/stock/outcome', auth(['admin', 'cashier', 'warehouse', 'seller']), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      product_id, quantity, price, note, branch_id: bodyBranch,
      customer_id, payment_method, payment_status, paid_amount, due_date,
      currency, original_price, exchange_rate,
    } = req.body;
    // Currency: if seller picked non-UZS, store original_price + rate, and compute UZS price.
    const cur = currency || 'UZS';
    const origPrice = parseFloat(original_price);
    const rate = parseFloat(exchange_rate);
    let resolvedPrice = parseFloat(price);  // UZS equivalent, what stock_outcome.price stores
    let storedOrigPrice = null;
    let storedRate = 1;
    if (cur !== 'UZS' && Number.isFinite(origPrice) && origPrice > 0 && Number.isFinite(rate) && rate > 0) {
      resolvedPrice = origPrice * rate;
      storedOrigPrice = origPrice;
      storedRate = rate;
    } else {
      storedOrigPrice = Number.isFinite(parseFloat(price)) ? parseFloat(price) : 0;
    }
    // Validate inputs before opening a transaction
    const pid = parseInt(product_id);
    const qty = parseFloat(quantity);
    if (!pid || !Number.isFinite(pid))            return res.status(400).json({ error: 'product_id обязателен' });
    if (!Number.isFinite(qty) || qty <= 0)        return res.status(400).json({ error: 'quantity должен быть > 0' });
    // If seller picked a branch, make sure it's in their company
    if (req.user.role === 'seller' && bodyBranch) {
      try { await assertBranchInCompany(req.user, parseInt(bodyBranch)); }
      catch (e) { return res.status(e.statusCode || 403).json({ error: e.message }); }
    }
    // Payment fields with safe defaults
    const total = qty * (Number.isFinite(resolvedPrice) ? resolvedPrice : parseFloat(price || 0));
    const pmethod = ['cash','card','transfer','wire','debt'].includes(payment_method) ? payment_method : 'cash';
    let pstatus = ['paid','debt','partial'].includes(payment_status) ? payment_status : 'paid';
    let paid = parseFloat(paid_amount);
    if (!Number.isFinite(paid) || paid < 0) paid = pstatus === 'paid' ? total : 0;
    // Coerce paid to match status
    if (pstatus === 'paid')   paid = total;
    if (pstatus === 'debt')   paid = 0;
    if (pstatus === 'partial' && paid >= total) pstatus = 'paid'; // promote
    if (pstatus === 'partial' && paid <= 0)     pstatus = 'debt'; // demote
    const dueDate = pstatus !== 'paid' && due_date ? due_date : null;
    const custId = customer_id ? parseInt(customer_id) : null;
    const branchId = getBranchFilter(req.user, req.body);

    // Нельзя продать больше, чем есть на складе филиала. Проверка на создании
    // (даже для pending) — даёт понятную ошибку и защищает от переполнения сумм
    // при абсурдных количествах. Жёсткая атомарная проверка остаётся на approve.
    if (branchId) {
      const av = await client.query('SELECT COALESCE(quantity,0) AS q FROM product_stock WHERE product_id=$1 AND branch_id=$2', [pid, branchId]);
      const avail = parseFloat(av.rows[0]?.q || 0);
      if (qty > avail) return res.status(400).json({ error: `Недостаточно остатка: есть ${avail}, запрошено ${qty}` });
    }

    await client.query('BEGIN');
    // Seller sales go to PENDING — warehouse/manager must verify before stock is decremented.
    // Trusted roles (admin, founder, gen_dir, manager, warehouse) auto-approve.
    // Cashier sales also go pending (no change).
    const autoApprove = ['admin', 'founder', 'gen_dir', 'manager', 'warehouse'].includes(req.user.role);
    const status = autoApprove ? 'approved' : 'pending';

    const { rows } = await client.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, note, created_by, approved_by, status, branch_id,
                                  customer_id, payment_method, payment_status, paid_amount, due_date, outcome_type,
                                  currency, original_price, exchange_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9,$10,$11,$12,$13,'sale', $14,$15,$16) RETURNING *`,
      [pid, qty, resolvedPrice || 0, note || '', req.user.id,
       autoApprove ? req.user.id : null, status, branchId,
       custId, pmethod, pstatus, paid, dueDate,
       cur, storedOrigPrice, storedRate]
    );

    if (autoApprove) {
      await client.query(
        `INSERT INTO product_stock (product_id, branch_id, quantity) VALUES ($1, $2, 0) ON CONFLICT (product_id, branch_id) DO NOTHING`,
        [pid, branchId]
      );
      // Atomic, race-safe decrement: only succeeds if enough stock is on hand.
      const dec = await client.query(
        'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3 AND quantity >= $1',
        [qty, pid, branchId]
      );
      if (dec.rowCount === 0) {
        const avail = await client.query('SELECT COALESCE(quantity, 0) AS q FROM product_stock WHERE product_id=$1 AND branch_id=$2', [pid, branchId]);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Недостаточно остатка: есть ${parseFloat(avail.rows[0]?.q || 0)}, нужно ${qty}` });
      }
      // Cash income — only the actually paid portion. Debt portion is tracked in stock_outcome.payment_status.
      if (paid > 0) {
        const prod = await client.query('SELECT name_ru FROM products WHERE id=$1', [pid]);
        const cust = custId ? await client.query('SELECT name FROM customers WHERE id=$1', [custId]) : { rows: [] };
        const custLabel = cust.rows[0] ? ` (${cust.rows[0].name})` : '';
        const desc = `Продажа${custLabel}: ${prod.rows[0]?.name_ru || ''} × ${qty}${pstatus === 'partial' ? ' (частично)' : ''}`;
        // Seller-created sales are UNSETTLED — seller must hand cash to cashier later.
        // Other roles' sales are immediately settled (cashier is the register operator).
        const isSettled = req.user.role !== 'seller';
        // For foreign-currency sales: the actual cash received is in `cur`, paid_orig = paid / rate.
        const paidOrig = cur === 'UZS' ? paid : paid / storedRate;
        await client.query(
          `INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method,
                                     currency, original_amount, exchange_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7, $8,$9,$10)`,
          [paid, desc, req.user.id, branchId, rows[0].id, isSettled, pmethod === 'debt' ? 'cash' : pmethod,
           cur, paidOrig, storedRate]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// === RETURN TO SUPPLIER (товар уходит обратно поставщику) ===
// Decrements stock at branch. If `refund_amount` > 0, records cash_income (мы получили деньги обратно).
app.post('/api/stock/return-to-supplier', auth(['admin', 'manager', 'warehouse', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, quantity, supplier_id, refund_amount, payment_method, note } = req.body;
    const pid = parseInt(product_id);
    const qty = parseFloat(quantity);
    const supId = supplier_id ? parseInt(supplier_id) : null;
    if (!pid || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'product_id и quantity обязательны' });
    const branchId = getBranchFilter(req.user, req.body);
    if (!supId) return res.status(400).json({ error: 'Выберите поставщика' });
    await client.query('BEGIN');
    // Validate supplier in user's company (admin bypasses company check)
    const sup = await client.query('SELECT name, company_id FROM suppliers WHERE id=$1 AND deleted_at IS NULL', [supId]);
    if (!sup.rows[0]) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Поставщик не найден' });
    }
    if (req.user.role !== 'admin' && sup.rows[0].company_id !== req.user.company_id) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Поставщик не в вашей компании' });
    }
    // Get cost price for record
    const p = await client.query('SELECT price_buy FROM products WHERE id=$1', [pid]);
    const price = parseFloat(p.rows[0]?.price_buy || 0);
    // Atomic, race-safe decrement: only succeeds if enough stock is on hand.
    const dec = await client.query(
      'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3 AND quantity >= $1',
      [qty, pid, branchId]
    );
    if (dec.rowCount === 0) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Недостаточно остатка' });
    }
    // Record outcome of type return_to_supplier
    const out = await client.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, note, created_by, approved_by, status, branch_id,
                                  outcome_type, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,'return_to_supplier',$8) RETURNING *`,
      [pid, qty, price, note || '', req.user.id, req.user.id, branchId, supId]
    );
    // Cash inflow if supplier refunded
    const refund = parseFloat(refund_amount) || 0;
    if (refund > 0) {
      const pm = ['cash','card','transfer','wire'].includes(payment_method) ? payment_method : 'cash';
      await client.query(
        `INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method, currency, original_amount, exchange_rate)
         VALUES ($1,$2,$3,$4,$5,TRUE,$6,'UZS',$1,1)`,
        [refund, `Возврат поставщику (${sup.rows[0].name}): ${qty} шт`, req.user.id, branchId, out.rows[0].id, pm]
      );
    }
    audit(req, 'return_to_supplier', 'stock_outcome', out.rows[0].id, null, { product_id: pid, quantity: qty, supplier_id: supId, refund });
    await client.query('COMMIT');
    res.json(out.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// === WRITEOFF (списание — товар испорчен/потерян, никаких денег) ===
app.post('/api/stock/writeoff', auth(['admin', 'manager', 'warehouse', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, quantity, reason, note } = req.body;
    const pid = parseInt(product_id);
    const qty = parseFloat(quantity);
    if (!pid || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'product_id и quantity обязательны' });
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Причина списания обязательна' });
    const branchId = getBranchFilter(req.user, req.body);
    await client.query('BEGIN');
    const p = await client.query('SELECT price_buy FROM products WHERE id=$1', [pid]);
    const price = parseFloat(p.rows[0]?.price_buy || 0);
    // Atomic, race-safe decrement: only succeeds if enough stock is on hand.
    const dec = await client.query(
      'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3 AND quantity >= $1',
      [qty, pid, branchId]
    );
    if (dec.rowCount === 0) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Недостаточно остатка' });
    }
    const out = await client.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, note, created_by, approved_by, status, branch_id,
                                  outcome_type, writeoff_reason)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,'writeoff',$8) RETURNING *`,
      [pid, qty, price, note || '', req.user.id, req.user.id, branchId, reason.trim()]
    );
    audit(req, 'writeoff', 'stock_outcome', out.rows[0].id, null, { product_id: pid, quantity: qty, reason: reason.trim(), value: qty * price });
    await client.query('COMMIT');
    res.json(out.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// === CUSTOMER RETURN (клиент вернул товар → товар на склад, деньги обратно клиенту) ===
// Optionally references original_outcome_id (the original sale)
app.post('/api/stock/customer-return', auth(['admin', 'manager', 'cashier', 'seller']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, quantity, refund_amount, payment_method, original_outcome_id, note, branch_id: bodyBranch } = req.body;
    const pid = parseInt(product_id);
    const qty = parseFloat(quantity);
    if (!pid || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'product_id и quantity обязательны' });
    const branchId = getBranchFilter(req.user, req.body);
    if (req.user.role === 'seller' && bodyBranch) {
      try { await assertBranchInCompany(req.user, parseInt(bodyBranch)); }
      catch (e) { return res.status(e.statusCode || 403).json({ error: e.message }); }
    }
    await client.query('BEGIN');
    // Use sale's price as basis if linked
    let unitPrice = 0;
    let origId = null;
    let origRow = null;
    let origQtyRemaining = Infinity;
    if (original_outcome_id) {
      const orig = await client.query('SELECT * FROM stock_outcome WHERE id=$1 FOR UPDATE', [original_outcome_id]);
      if (orig.rows[0]) {
        if (orig.rows[0].branch_id !== branchId) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Original sale is in a different branch' });
        }
        unitPrice = parseFloat(orig.rows[0].price);
        origId = orig.rows[0].id;
        origRow = orig.rows[0];
        const sold = parseFloat(orig.rows[0].quantity);
        const { rows: [agg] } = await client.query(
          'SELECT COALESCE(SUM(quantity), 0) AS returned FROM stock_outcome WHERE original_outcome_id=$1 AND outcome_type=$2',
          [origId, 'customer_return']
        );
        origQtyRemaining = sold - parseFloat(agg.returned);
        if (qty > origQtyRemaining + 0.0001) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Return qty exceeds available: max ${origQtyRemaining}` });
        }
      }
    }
    // CAP the cash refund at what the customer ACTUALLY paid.
    // If they bought on debt and never paid, we don't pay them anything in cash —
    // we just decrement their outstanding debt by the same amount.
    // Without this cap, a debt-buying customer could "return" goods and walk out with cash.
    let refundTotal = parseFloat(refund_amount) || (qty * unitPrice);
    let debtCancellation = 0;
    if (origRow) {
      const origTotal = parseFloat(origRow.quantity) * parseFloat(origRow.price || 0);
      const paid = parseFloat(origRow.paid_amount || 0);
      const cashCapForFullReturn = paid;
      const proportional = origTotal > 0 ? (qty / parseFloat(origRow.quantity)) * paid : 0;
      const maxCash = Math.min(cashCapForFullReturn, proportional);
      if (refundTotal > maxCash) {
        debtCancellation = refundTotal - maxCash;
        refundTotal = maxCash;
      }
    }
    // Record a CUSTOMER_RETURN outcome with NEGATIVE-flow logic: actually we INCREASE stock,
    // and create a cash_expense. We record qty as positive for accounting clarity.
    const out = await client.query(
      `INSERT INTO stock_outcome (product_id, quantity, price, note, created_by, approved_by, status, branch_id,
                                  outcome_type, original_outcome_id)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,'customer_return',$8) RETURNING *`,
      [pid, qty, unitPrice, note || '', req.user.id, req.user.id, branchId, origId]
    );
    // Stock goes UP (we got the product back)
    await client.query(
      `INSERT INTO product_stock (product_id, branch_id, quantity) VALUES ($1, $2, 0) ON CONFLICT (product_id, branch_id) DO NOTHING`,
      [pid, branchId]
    );
    await client.query(
      'UPDATE product_stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3',
      [qty, pid, branchId]
    );
    // Cash goes OUT (only when the customer actually paid in cash for this portion).
    // Card/transfer/wire returns don't touch the cash till — they reverse on the original channel.
    if (refundTotal > 0) {
      const pm = ['cash','card','transfer','wire'].includes(payment_method) ? payment_method : 'cash';
      const touchesCash = pm === 'cash';
      const prodName = await client.query('SELECT name_ru FROM products WHERE id=$1', [pid]);
      if (touchesCash) {
        await client.query(
          `INSERT INTO cash_expense (amount, description, created_by, branch_id, payment_method, currency, original_amount, exchange_rate)
           VALUES ($1,$2,$3,$4,$5,'UZS',$1,1)`,
          [refundTotal, `Возврат клиенту: ${prodName.rows[0]?.name_ru || ''} × ${qty}`, req.user.id, branchId, pm]
        );
      }
    }
    // Decrement the customer's outstanding debt on the original sale.
    if (origRow && debtCancellation > 0) {
      const origTotal = parseFloat(origRow.quantity) * parseFloat(origRow.price || 0);
      const origPaid = parseFloat(origRow.paid_amount || 0);
      const newPaid = origPaid;
      const remainingAfter = Math.max(0, origTotal - newPaid - debtCancellation);
      const newStatus = remainingAfter < 0.01 ? 'paid' : (newPaid > 0 ? 'partial' : 'debt');
      await client.query(
        `UPDATE stock_outcome
            SET quantity = quantity - $1,
                payment_status = CASE
                  WHEN (quantity - $1) * price - COALESCE(paid_amount, 0) < 0.01 THEN 'paid'
                  WHEN COALESCE(paid_amount, 0) > 0 THEN 'partial'
                  ELSE 'debt'
                END
          WHERE id = $2`,
        [qty, origId]
      );
    }
    audit(req, 'customer_return', 'stock_outcome', out.rows[0].id, null, {
      product_id: pid, quantity: qty, refund_cash: refundTotal, debt_cancelled: debtCancellation, original_outcome_id: origId,
    });
    await client.query('COMMIT');
    res.json(out.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Seller can cancel their OWN pending sale
app.delete('/api/stock/outcome/:id/cancel', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_outcome WHERE id=$1 AND created_by=$2 AND status=$3',
      [req.params.id, req.user.id, 'pending']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Нет доступа или уже обработано' });
    await pool.query('DELETE FROM stock_outcome WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stock/outcome/:id/approve', auth(['admin', 'founder', 'gen_dir', 'manager', 'warehouse']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scoped = await loadScopedOutcome(client, req.params.id, req.user);
    if (scoped.error) { await client.query('ROLLBACK'); return res.status(scoped.error.status).json({ error: scoped.error.msg }); }
    if (scoped.row.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Уже обработано' });
    }

    const { action } = req.body;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { rows } = await client.query(
      `UPDATE stock_outcome SET status=$1, approved_by=$2
       WHERE id=$3 AND status='pending' RETURNING *`,
      [newStatus, req.user.id, req.params.id]
    );
    if (!rows[0]) throw new Error('Не найдено или уже обработано');
    if (action === 'approve') {
      await client.query(
        `INSERT INTO product_stock (product_id, branch_id, quantity) VALUES ($1, $2, 0) ON CONFLICT (product_id, branch_id) DO NOTHING`,
        [rows[0].product_id, rows[0].branch_id]
      );
      const needed = parseFloat(rows[0].quantity);
      const dec = await client.query(
        'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3 AND quantity >= $1',
        [rows[0].quantity, rows[0].product_id, rows[0].branch_id]
      );
      if (dec.rowCount === 0) {
        const avail = await client.query('SELECT COALESCE(quantity, 0) AS q FROM product_stock WHERE product_id=$1 AND branch_id=$2', [rows[0].product_id, rows[0].branch_id]);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Недостаточно остатка: есть ${parseFloat(avail.rows[0]?.q || 0)}, нужно ${needed}` });
      }
      // CASH BOOKING — only the amount the customer ACTUALLY paid, never the full revenue.
      // Debt sales (payment_status='debt' or 'partial') leave the unpaid portion to be booked later
      // when the customer settles via POST /api/sales/:id/pay or PUT /api/stock/outcome/:id/pay.
      // Все способы оплаты (нал/карта/перевод) фиксируются в кассовом журнале
      // с payment_method — так же, как делает прямой флоу продажи (autoApprove).
      // Раньше карта/перевод тут пропускались → продажи через подтверждение
      // складовщиком не попадали в кассовые отчёты и breakdown по способам оплаты.
      const total = parseFloat(rows[0].quantity) * parseFloat(rows[0].price || 0);
      const paid = parseFloat(rows[0].paid_amount);
      const cashAmount = Number.isFinite(paid) ? Math.min(paid, total) : (rows[0].payment_status === 'paid' ? total : 0);
      const pmethod = rows[0].payment_method || 'cash';
      if (cashAmount > 0) {
        const prod = await client.query('SELECT name_ru FROM products WHERE id=$1', [rows[0].product_id]);
        const desc = `Продажа: ${prod.rows[0]?.name_ru || ''} × ${rows[0].quantity}`;
        const sellerRoleQ = await client.query('SELECT role FROM users WHERE id=$1', [rows[0].created_by]);
        // Наличные от продавца требуют сдачи кассиру (settlement);
        // карта/перевод приходят на счёт напрямую — сдавать нечего, сразу settled.
        const isSettled = pmethod !== 'cash' || sellerRoleQ.rows[0]?.role !== 'seller';
        await client.query(
          `INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method, currency, original_amount, exchange_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
          [cashAmount, desc, rows[0].created_by, rows[0].branch_id, rows[0].id, isSettled, pmethod,
           rows[0].currency || 'UZS', cashAmount / (parseFloat(rows[0].exchange_rate) || 1),
           parseFloat(rows[0].exchange_rate) || 1]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Helper — load a stock_outcome row scoped to caller's company (returns null if cross-tenant).
// All outcome mutators (PUT, DELETE, /approve, /pay) must go through this to avoid cross-tenant tampering.
async function loadScopedOutcome(client, outcomeId, reqUser) {
  const { rows } = await client.query(
    `SELECT so.*, b.company_id AS branch_company_id
     FROM stock_outcome so
     LEFT JOIN branches b ON b.id = so.branch_id
     WHERE so.id = $1`,
    [outcomeId]
  );
  if (!rows[0]) return { row: null, error: { status: 404, msg: 'Not found' } };
  const cur = rows[0];
  if (reqUser.role !== 'admin' && cur.branch_company_id !== reqUser.company_id) {
    return { row: null, error: { status: 403, msg: 'Out of scope' } };
  }
  if (reqUser.role === 'manager' && reqUser.branch_id && cur.branch_id !== reqUser.branch_id) {
    return { row: null, error: { status: 403, msg: 'Out of branch scope' } };
  }
  return { row: cur, error: null };
}

// Edit stock outcome (price, note, quantity). Adjusts stock if quantity changes on approved record.
app.put('/api/stock/outcome/:id', auth(['admin', 'cashier', 'manager']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, price, note } = req.body;
    const scoped = await loadScopedOutcome(client, req.params.id, req.user);
    if (scoped.error) { await client.query('ROLLBACK'); return res.status(scoped.error.status).json({ error: scoped.error.msg }); }
    const cur = scoped.row;
    const newQty = quantity !== undefined ? parseFloat(quantity) : parseFloat(cur.quantity);
    if (newQty <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Quantity must be > 0' }); }
    // If approved and qty changed, adjust stock by the delta
    if (cur.status === 'approved' && newQty !== parseFloat(cur.quantity)) {
      const delta = newQty - parseFloat(cur.quantity); // positive = take more from stock
      await client.query(
        'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3',
        [delta, cur.product_id, cur.branch_id]
      );
    }
    const newPrice = price !== undefined ? parseFloat(price) || 0 : parseFloat(cur.price);
    const { rows } = await client.query(
      `UPDATE stock_outcome SET quantity=$1, price=$2, note=$3 WHERE id=$4 RETURNING *`,
      [newQty, newPrice, note !== undefined ? note : cur.note, req.params.id]
    );
    // Sync the ORIGINAL-sale cash_income only — preserve any /pay debt-payment rows that legitimately
    // booked customer payments against this outcome. Only touch the original auto-row if it was created
    // for the FULL sale (i.e. on paid status) — for debt sales, the original row is 0/null and /pay
    // creates per-payment rows separately.
    if (cur.status === 'approved' && cur.payment_method !== 'card' && cur.payment_method !== 'transfer' && cur.payment_method !== 'wire') {
      const newAmount = newQty * newPrice;
      const prod = await client.query('SELECT name_ru FROM products WHERE id=$1', [cur.product_id]);
      const newDesc = `Продажа: ${prod.rows[0]?.name_ru || ''} × ${newQty}`;
      // Try UPDATE in place to preserve is_settled / settled_at / settled_by metadata
      const upd = await client.query(
        `UPDATE cash_income
           SET amount = $1, description = $2
         WHERE outcome_id = $3
           AND description LIKE 'Продажа:%'
         RETURNING id`,
        [newAmount, newDesc, req.params.id]
      );
      if (upd.rowCount === 0 && newAmount > 0 && cur.payment_status === 'paid') {
        // No original-sale row existed yet (e.g. was debt, now changed to paid via edit) — create one.
        const sellerRoleQ = await client.query('SELECT role FROM users WHERE id=$1', [cur.created_by]);
        const isSettled = sellerRoleQ.rows[0]?.role !== 'seller';
        await client.query(
          'INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [newAmount, newDesc, cur.created_by, cur.branch_id, cur.id, isSettled, cur.payment_method || 'cash']
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// Delete stock outcome. Restocks if was approved.
app.delete('/api/stock/outcome/:id', auth(['admin', 'cashier', 'manager']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scoped = await loadScopedOutcome(client, req.params.id, req.user);
    if (scoped.error) { await client.query('ROLLBACK'); return res.status(scoped.error.status).json({ error: scoped.error.msg }); }
    const cur = scoped.row;
    if (cur.status === 'approved') {
      await client.query(
        'UPDATE product_stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3',
        [cur.quantity, cur.product_id, cur.branch_id]
      );
    }
    await client.query('DELETE FROM cash_income WHERE outcome_id = $1', [req.params.id]);
    await client.query('DELETE FROM stock_outcome WHERE id=$1', [req.params.id]);
    audit(req, 'delete', 'stock_outcome', cur.id, { quantity: cur.quantity, price: cur.price, branch_id: cur.branch_id }, null);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// === STOCK BALANCE ===
// Returns the catalog of products in user's company. Stock is per-branch:
// - if branchId given → that branch's stock (0 if not yet stocked there)
// - else → sum across all branches in company
app.get('/api/stock/balance', auth(), async (req, res) => {
  try {
    const { search } = req.query;
    const branchId = getBranchFilter(req.user, req.query);
    const params = [];
    let stockJoin;
    if (branchId) {
      params.push(branchId);
      stockJoin = `LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.branch_id = $${params.length}`;
    } else {
      stockJoin = `LEFT JOIN (SELECT product_id, SUM(quantity) AS quantity FROM product_stock GROUP BY product_id) ps ON p.id = ps.product_id`;
    }
    let query = `
      SELECT p.id, p.name_ru, p.name_uz, p.barcode, p.photo_url, p.unit, p.price_buy, p.price_sell,
             p.created_at,
             pt.name_ru AS type_name, c.name_ru AS cat_name,
             COALESCE(ps.quantity, 0) AS stock,
             ls.id    AS last_supplier_id,
             ls.name  AS last_supplier_name,
             ls.email AS last_supplier_email,
             ls.phone AS last_supplier_phone
      FROM products p
      LEFT JOIN product_types pt ON p.type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${stockJoin}
      LEFT JOIN LATERAL (
        SELECT s.id, s.name, s.email, s.phone
        FROM stock_income si
        JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.product_id = p.id AND s.deleted_at IS NULL
        ORDER BY si.created_at DESC LIMIT 1
      ) ls ON TRUE
    `;
    const conds = ['p.deleted_at IS NULL'];
    if (req.user.role !== 'admin' && req.user.company_id) {
      conds.push(`p.company_id = $${params.length+1}`); params.push(req.user.company_id);
    }
    if (search) { conds.push(`(p.name_ru ILIKE $${params.length+1} OR p.barcode ILIKE $${params.length+1})`); params.push(`%${search}%`); }
    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    // Cap result size: catalogs with 100k+ products would otherwise dump megabytes of JSON.
    // The frontend filter/search lives on top of this anyway.
    query += ' ORDER BY p.name_ru LIMIT 1000';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === CASH CATEGORIES (presets for description) ===
app.get('/api/cash/categories', auth(['cashier', 'manager', 'gen_dir', 'founder', 'admin']), async (req, res) => {
  try {
    const { type } = req.query; // 'income' or 'expense'
    if (type && !['income','expense'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const branchId = getBranchFilter(req.user, req.query);
    const conds = [], params = [];
    if (branchId) { conds.push(`branch_id = $${params.length+1}`); params.push(branchId); }
    if (type)     { conds.push(`type = $${params.length+1}`);      params.push(type); }
    const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(`SELECT id, name, type, branch_id, created_at FROM cash_categories${where} ORDER BY name`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cash/categories', auth(['cashier', 'manager', 'gen_dir', 'founder']), async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
    if (!['income','expense'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const branchId = getBranchFilter(req.user, req.body) || req.user.branch_id;
    const { rows } = await pool.query(
      `INSERT INTO cash_categories (name, type, branch_id, created_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (branch_id, type, name) DO UPDATE SET name=EXCLUDED.name
       RETURNING id, name, type, branch_id, created_at`,
      [name.trim(), type, branchId, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/cash/categories/:id', auth(['cashier', 'manager', 'gen_dir', 'founder']), async (req, res) => {
  try {
    // Only allow delete within own branch (gen_dir within own company)
    const { rows } = await pool.query('SELECT branch_id FROM cash_categories WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      if (isCompanyLevel(req.user.role)) {
        const b = await pool.query('SELECT company_id FROM branches WHERE id=$1', [rows[0].branch_id]);
        if (b.rows[0]?.company_id !== req.user.company_id) return res.status(403).json({ error: 'Нет доступа' });
      } else if (rows[0].branch_id !== req.user.branch_id) {
        return res.status(403).json({ error: 'Нет доступа' });
      }
    }
    await pool.query('DELETE FROM cash_categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === CASH ===
app.get('/api/cash/balance', auth(['cashier', 'manager', 'gen_dir', 'founder']), async (req, res) => {
  try {
    let scope;
    try { scope = await getUserBranchIds(req.user, req.query); }
    catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    // Empty allowed-branch list → no data at all (avoids unscoped global query).
    if (scope.restrictive && scope.ids.length === 0) {
      return res.json({ total_income: 0, total_expense: 0, balance: 0, pending_income: 0, pending_count: 0, income_list: [], expense_list: [] });
    }
    const ids = scope.ids;
    const branchFilterSimple = ids ? 'WHERE branch_id = ANY($1::int[])' : '';
    const branchFilterCi     = ids ? 'WHERE ci.branch_id = ANY($1::int[])' : '';
    const branchFilterCe     = ids ? 'WHERE ce.branch_id = ANY($1::int[])' : '';
    const settledFilter = ids
      ? 'WHERE branch_id = ANY($1::int[]) AND is_settled IS NOT FALSE'
      : 'WHERE is_settled IS NOT FALSE';
    const pendingFilter = ids
      ? 'WHERE branch_id = ANY($1::int[]) AND is_settled = FALSE'
      : 'WHERE is_settled = FALSE';
    const params = ids ? [ids] : [];

    const income = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_income ${settledFilter}`, params);
    const expense = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_expense ${branchFilterSimple}`, params);
    const pending = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM cash_income ${pendingFilter}`, params);
    const incomeList = await pool.query(
      `SELECT ci.*, u.username FROM cash_income ci
       LEFT JOIN users u ON ci.created_by = u.id
       ${branchFilterCi} ORDER BY ci.created_at DESC LIMIT 50`, params);
    const expenseList = await pool.query(
      `SELECT ce.*, u.username FROM cash_expense ce
       LEFT JOIN users u ON ce.created_by = u.id
       ${branchFilterCe} ORDER BY ce.created_at DESC LIMIT 50`, params);
    res.json({
      total_income: parseFloat(income.rows[0].total),
      total_expense: parseFloat(expense.rows[0].total),
      balance: parseFloat(income.rows[0].total) - parseFloat(expense.rows[0].total),
      pending_income: parseFloat(pending.rows[0].total),
      pending_count: parseInt(pending.rows[0].cnt),
      income_list: incomeList.rows,
      expense_list: expenseList.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Cash REPORT — period-aware aggregate for the cashier's «Отчёт» tab.
// Returns: settled income, pending income, expense, profit, sales (by method/seller/day/product),
// outstanding debts, foreign-currency breakdown.
app.get('/api/cash/report', auth(['cashier', 'manager', 'gen_dir', 'founder', 'admin']), async (req, res) => {
  try {
    let scope;
    try { scope = await getUserBranchIds(req.user, req.query); }
    catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) {
      return res.json({ settled: { total: 0, cnt: 0 }, pending: { total: 0, cnt: 0 }, expense: { total: 0, cnt: 0 }, sales: { revenue: 0, cost: 0, qty_total: 0, cnt: 0 }, by_method: [], by_seller: [], by_day: [], debts: { client: 0, supplier: 0 }, foreign_currency: [] });
    }
    const { from, to } = req.query;
    const params = [];
    const conds = [];
    if (scope.ids) { params.push(scope.ids); conds.push(`branch_id = ANY($${params.length}::int[])`); }
    if (from) { params.push(from); conds.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); conds.push(`created_at < $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const soConds = conds.map(c => c.replace(/^([a-z_]+)/, 'so.$1'));
    const soWhere = soConds.length ? 'WHERE ' + soConds.join(' AND ') + ` AND so.status='approved'` : `WHERE so.status='approved'`;

    // 1. Settled income (in till)
    const settled = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS cnt
       FROM cash_income ${where} ${where ? 'AND' : 'WHERE'} is_settled IS NOT FALSE`, params);
    // 2. Pending income (from sellers, not yet handed over)
    const pending = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS cnt
       FROM cash_income ${where} ${where ? 'AND' : 'WHERE'} is_settled = FALSE`, params);
    // 3. Expense
    const expense = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS cnt FROM cash_expense ${where}`, params);
    // 4. Sales: revenue, cost, qty, count (only sale outcomes — not returns/writeoffs)
    const sales = await pool.query(
      `SELECT COALESCE(SUM(so.quantity * so.price),0) AS revenue,
              COALESCE(SUM(so.quantity * COALESCE(p.price_buy, 0)),0) AS cost,
              COALESCE(SUM(so.quantity),0) AS qty_total,
              COUNT(*)::int AS cnt
       FROM stock_outcome so JOIN products p ON so.product_id = p.id
       ${soWhere} AND (so.outcome_type = 'sale' OR so.outcome_type IS NULL)`, params);
    // 5. By payment method (settled cash_income)
    const byMethod = await pool.query(
      `SELECT COALESCE(payment_method,'cash') AS method,
              COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS cnt
       FROM cash_income ${where} ${where ? 'AND' : 'WHERE'} is_settled IS NOT FALSE
       GROUP BY payment_method
       ORDER BY total DESC`, params);
    // 6. By seller (top 10) — based on stock_outcome.created_by
    const bySeller = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.role,
              COUNT(so.id)::int AS sales_count,
              COALESCE(SUM(so.quantity * so.price),0) AS revenue,
              COALESCE(SUM(CASE WHEN ci.is_settled IS NOT FALSE THEN ci.amount ELSE 0 END),0) AS settled,
              COALESCE(SUM(CASE WHEN ci.is_settled = FALSE THEN ci.amount ELSE 0 END),0) AS pending
       FROM stock_outcome so
       JOIN users u ON so.created_by = u.id
       LEFT JOIN cash_income ci ON ci.outcome_id = so.id
       ${soWhere} AND (so.outcome_type = 'sale' OR so.outcome_type IS NULL)
       GROUP BY u.id
       ORDER BY revenue DESC
       LIMIT 10`, params);
    // 7. Daily series — for chart (last N days)
    const byDay = await pool.query(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
              COALESCE(SUM(amount),0) AS income
       FROM cash_income ${where} ${where ? 'AND' : 'WHERE'} is_settled IS NOT FALSE
       GROUP BY day ORDER BY day`, params);
    const byDayExp = await pool.query(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
              COALESCE(SUM(amount),0) AS expense
       FROM cash_expense ${where}
       GROUP BY day ORDER BY day`, params);
    // 8. Top products
    const topProducts = await pool.query(
      `SELECT p.id, p.name_ru, p.name_uz, p.unit,
              COALESCE(SUM(so.quantity),0) AS qty,
              COALESCE(SUM(so.quantity * so.price),0) AS revenue,
              COUNT(so.id)::int AS sales_count
       FROM stock_outcome so JOIN products p ON so.product_id = p.id
       ${soWhere} AND (so.outcome_type = 'sale' OR so.outcome_type IS NULL)
       GROUP BY p.id
       ORDER BY revenue DESC
       LIMIT 10`, params);
    // 9. Outstanding debts (sales with payment_status='debt' or 'partial')
    const debtsConds = [...soConds.filter(c => !c.includes("created_at"))]; // ignore period for debt (they accumulate)
    if (branchId) {} // already in conds
    const debtsWhere = debtsConds.length ? 'WHERE ' + debtsConds.join(' AND ') : 'WHERE 1=1';
    const debtsParams = branchId ? [branchId] : [];
    const debts = await pool.query(
      `SELECT COUNT(*)::int AS cnt,
              COALESCE(SUM(so.quantity * so.price - COALESCE(so.paid_amount,0)),0) AS owed
       FROM stock_outcome so
       ${debtsWhere} AND so.status='approved' AND so.payment_status IN ('debt','partial')`, debtsParams);
    // 10. Foreign-currency breakdown (sales paid in non-UZS)
    const byCurrency = await pool.query(
      `SELECT COALESCE(so.currency,'UZS') AS currency,
              COUNT(*)::int AS cnt,
              COALESCE(SUM(so.quantity * COALESCE(so.original_price, so.price)),0) AS original_total,
              COALESCE(SUM(so.quantity * so.price),0) AS uzs_total
       FROM stock_outcome so
       ${soWhere} AND COALESCE(so.currency,'UZS') <> 'UZS'
       GROUP BY currency
       ORDER BY uzs_total DESC`, params);

    const settledTotal = parseFloat(settled.rows[0].total);
    const expenseTotal = parseFloat(expense.rows[0].total);
    const salesRow = sales.rows[0];
    const revenue = parseFloat(salesRow.revenue);
    const cost = parseFloat(salesRow.cost);

    res.json({
      period: { from: from || null, to: to || null },
      income: { settled: settledTotal, pending: parseFloat(pending.rows[0].total),
                settled_count: settled.rows[0].cnt, pending_count: pending.rows[0].cnt },
      expense: { total: expenseTotal, count: expense.rows[0].cnt },
      sales: { revenue, cost, qty: parseFloat(salesRow.qty_total), count: salesRow.cnt,
               margin: revenue - cost, margin_pct: revenue > 0 ? (revenue - cost) / revenue * 100 : 0 },
      profit: { gross: revenue - cost, net: settledTotal - expenseTotal },
      by_method: byMethod.rows.map(r => ({ method: r.method, total: parseFloat(r.total), count: r.cnt })),
      by_seller: bySeller.rows.map(r => ({
        user_id: r.id, username: r.username, role: r.role,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
        sales_count: r.sales_count, revenue: parseFloat(r.revenue),
        settled: parseFloat(r.settled), pending: parseFloat(r.pending),
      })),
      by_day: (() => {
        const inc = Object.fromEntries(byDay.rows.map(r => [r.day, parseFloat(r.income)]));
        const exp = Object.fromEntries(byDayExp.rows.map(r => [r.day, parseFloat(r.expense)]));
        const days = Array.from(new Set([...Object.keys(inc), ...Object.keys(exp)])).sort();
        return days.map(d => ({ day: d, income: inc[d] || 0, expense: exp[d] || 0 }));
      })(),
      top_products: topProducts.rows.map(r => ({
        product_id: r.id, name_ru: r.name_ru, name_uz: r.name_uz, unit: r.unit,
        qty: parseFloat(r.qty), revenue: parseFloat(r.revenue), sales_count: r.sales_count,
      })),
      debts: { count: debts.rows[0].cnt, owed: parseFloat(debts.rows[0].owed) },
      by_currency: byCurrency.rows.map(r => ({
        currency: r.currency, count: r.cnt,
        original_total: parseFloat(r.original_total),
        uzs_total: parseFloat(r.uzs_total),
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === SETTLEMENT (seller → cashier money handover) ===
// Cashier sees sellers with un-handed-over cash, accepts it, and marks records settled.

// List sellers with unsettled balance (cashier/manager/admin/founder/gen_dir for the branch)
// Individual unsettled cash_income rows (one per sale) — for the new per-sale confirmation flow
app.get('/api/cash/settlement/sales', auth(['admin', 'founder', 'gen_dir', 'manager', 'cashier']), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [];
    let where = 'ci.is_settled = FALSE';
    if (branchId) { params.push(branchId); where += ` AND ci.branch_id = $${params.length}`; }
    const { rows } = await pool.query(`
      SELECT ci.id AS cash_id, ci.amount, ci.created_at, ci.description, ci.outcome_id, ci.payment_method,
             ci.currency, ci.original_amount, ci.exchange_rate,
             so.quantity, so.price, so.note, so.original_price, so.currency AS sale_currency,
             p.name_ru AS product_name, p.name_uz AS product_name_uz, p.unit, p.barcode,
             u.id AS seller_id, u.username AS seller_username,
             u.first_name AS seller_first_name, u.last_name AS seller_last_name
      FROM cash_income ci
      JOIN stock_outcome so ON ci.outcome_id = so.id
      JOIN products p ON so.product_id = p.id
      JOIN users u ON ci.created_by = u.id
      WHERE ${where}
      ORDER BY ci.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Confirm a SINGLE cash_income (one sale) — preferred over the bulk-by-seller endpoint
app.post('/api/cash/settlement/accept-one', auth(['admin', 'founder', 'gen_dir', 'manager', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { cash_id, received_amount } = req.body;
    const id = parseInt(cash_id);
    if (!id) return res.status(400).json({ error: 'cash_id required' });
    const branchId = getBranchFilter(req.user, req.query);
    await client.query('BEGIN');
    // Branch isolation check before claiming the row.
    const { rows: [ci] } = await client.query('SELECT branch_id, is_settled FROM cash_income WHERE id=$1 FOR UPDATE', [id]);
    if (!ci) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (branchId && ci.branch_id !== branchId) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not in your branch' });
    }
    // Atomic, idempotent claim: only one concurrent request wins.
    const claim = await client.query(
      'UPDATE cash_income SET is_settled = TRUE, settled_at = NOW(), settled_by = $1 WHERE id = $2 AND is_settled = FALSE RETURNING amount, branch_id, outcome_id',
      [req.user.id, id]
    );
    if (claim.rowCount === 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Уже подтверждено' }); }
    const claimed = claim.rows[0];
    const expected = parseFloat(claimed.amount);
    const received = Number.isFinite(parseFloat(received_amount)) ? parseFloat(received_amount) : expected;
    const discrepancy = received - expected;
    // If under/over — record the difference as a separate cash flow so the till stays correct.
    if (Math.abs(discrepancy) > 0.01) {
      const desc = discrepancy < 0
        ? `Недостача при сдаче #${claimed.outcome_id || id}: ${Math.abs(discrepancy)}`
        : `Излишек при сдаче #${claimed.outcome_id || id}: +${discrepancy}`;
      if (discrepancy < 0) {
        await client.query(
          `INSERT INTO cash_expense (amount, description, created_by, branch_id) VALUES ($1,$2,$3,$4)`,
          [Math.abs(discrepancy), desc, req.user.id, claimed.branch_id]
        );
      } else {
        await client.query(
          `INSERT INTO cash_income (amount, description, created_by, branch_id, is_settled, payment_method) VALUES ($1,$2,$3,$4,TRUE,'cash')`,
          [discrepancy, desc, req.user.id, claimed.branch_id]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, expected, received, discrepancy });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.get('/api/cash/settlement/pending', auth(['admin', 'founder', 'gen_dir', 'manager', 'cashier']), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [];
    let where = 'WHERE ci.is_settled = FALSE';
    if (branchId) { where += ` AND ci.branch_id = $${params.length+1}`; params.push(branchId); }
    const { rows } = await pool.query(`
      SELECT
        u.id   AS seller_id,
        u.username AS seller_username,
        u.first_name AS seller_first_name,
        u.last_name AS seller_last_name,
        COUNT(ci.id) AS sales_count,
        COALESCE(SUM(ci.amount), 0) AS total_amount,
        MIN(ci.created_at) AS oldest_at
      FROM cash_income ci
      JOIN users u ON ci.created_by = u.id
      ${where}
      GROUP BY u.id, u.username, u.first_name, u.last_name
      ORDER BY total_amount DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Detailed list of one seller's unsettled sales
app.get('/api/cash/settlement/seller/:id', auth(['admin', 'founder', 'gen_dir', 'manager', 'cashier']), async (req, res) => {
  try {
    const sellerId = parseInt(req.params.id);
    const branchId = getBranchFilter(req.user, req.query);
    const params = [sellerId];
    let where = 'WHERE ci.is_settled = FALSE AND ci.created_by = $1';
    if (branchId) { where += ` AND ci.branch_id = $${params.length+1}`; params.push(branchId); }
    const { rows } = await pool.query(`
      SELECT ci.id, ci.amount, ci.description, ci.created_at, ci.outcome_id
      FROM cash_income ci
      ${where}
      ORDER BY ci.created_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Accept money handed over by a seller → mark all their unsettled records settled.
// Optional `received_amount` for verification: if mismatch, log a cash_expense (недостача) or cash_income (излишек).
app.post('/api/cash/settlement/accept', auth(['admin', 'founder', 'gen_dir', 'manager', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { seller_id, received_amount } = req.body;
    const sid = parseInt(seller_id);
    if (!sid) return res.status(400).json({ error: 'seller_id обязателен' });
    await client.query('BEGIN');
    const branchId = getBranchFilter(req.user, req.body);
    // Atomically claim all of this seller's unsettled rows. expected/count come from the rows
    // we actually settled — not a prior SELECT — so a concurrent accept can't double-count.
    const updParams = [req.user.id, sid];
    let updWhere = 'WHERE is_settled = FALSE AND created_by = $2';
    if (branchId) { updParams.push(branchId); updWhere += ` AND branch_id = $${updParams.length}`; }
    const upd = await client.query(
      `UPDATE cash_income SET is_settled=TRUE, settled_at=NOW(), settled_by=$1 ${updWhere} RETURNING amount`,
      updParams
    );
    const count = upd.rowCount;
    if (count === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Нет несданной выручки от этого продавца' }); }
    const expected = upd.rows.reduce((s, r) => s + parseFloat(r.amount), 0);

    // Discrepancy handling
    let discrepancy = 0;
    if (received_amount !== undefined && received_amount !== null && received_amount !== '') {
      const received = parseFloat(received_amount);
      discrepancy = received - expected;
      if (Math.abs(discrepancy) > 0.01) {
        const sellerNameQ = await client.query('SELECT username FROM users WHERE id=$1', [sid]);
        const sellerName = sellerNameQ.rows[0]?.username || `#${sid}`;
        if (discrepancy < 0) {
          // Shortage: record a cash_expense
          await client.query(
            `INSERT INTO cash_expense (amount, description, created_by, branch_id) VALUES ($1, $2, $3, $4)`,
            [Math.abs(discrepancy), `Недостача от @${sellerName}`, req.user.id, branchId]
          );
        } else {
          // Surplus: record extra cash_income (already settled)
          await client.query(
            `INSERT INTO cash_income (amount, description, created_by, branch_id, is_settled) VALUES ($1, $2, $3, $4, TRUE)`,
            [discrepancy, `Излишек от @${sellerName}`, req.user.id, branchId]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, count, expected, discrepancy });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Seller's own unsettled balance
app.get('/api/cash/settlement/my', auth(['seller', 'cashier', 'manager', 'warehouse']), async (req, res) => {
  try {
    const { rows: [agg] } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
       FROM cash_income WHERE is_settled = FALSE AND created_by = $1`,
      [req.user.id]
    );
    res.json({ total: parseFloat(agg.total), count: parseInt(agg.cnt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Helper: normalize currency payload (currency, original_amount, exchange_rate) → UZS amount
// Caller sends either:
//   - amount in UZS (legacy)
//   - original_amount + currency + exchange_rate → we compute amount in UZS
function resolveAmountUZS(body) {
  const { amount, original_amount, currency, exchange_rate, payment_method } = body;
  const cur = (currency || 'UZS').toUpperCase();
  const rate = parseFloat(exchange_rate);
  const orig = parseFloat(original_amount);
  // If full currency payload — recompute UZS
  if (Number.isFinite(orig) && orig > 0 && Number.isFinite(rate) && rate > 0) {
    return {
      amountUZS: cur === 'UZS' ? orig : orig * rate,
      currency: cur,
      original_amount: orig,
      exchange_rate: cur === 'UZS' ? 1 : rate,
      payment_method: payment_method || 'cash',
    };
  }
  // Legacy callers send only "amount" in UZS
  const amt = parseFloat(amount);
  return {
    amountUZS: Number.isFinite(amt) ? amt : 0,
    currency: 'UZS',
    original_amount: Number.isFinite(amt) ? amt : 0,
    exchange_rate: 1,
    payment_method: payment_method || 'cash',
  };
}

app.post('/api/cash/income', auth(['cashier', 'manager']), async (req, res) => {
  try {
    const { description } = req.body;
    const branchId = getBranchFilter(req.user, req.body);
    const r = resolveAmountUZS(req.body);
    if (r.amountUZS <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const { rows } = await pool.query(
      `INSERT INTO cash_income (amount, description, created_by, branch_id, currency, original_amount, exchange_rate, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [r.amountUZS, description || '', req.user.id, branchId, r.currency, r.original_amount, r.exchange_rate, r.payment_method]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/cash/expense', auth(['cashier', 'manager']), async (req, res) => {
  try {
    const { description } = req.body;
    const branchId = getBranchFilter(req.user, req.body);
    const r = resolveAmountUZS(req.body);
    if (r.amountUZS <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const { rows } = await pool.query(
      `INSERT INTO cash_expense (amount, description, created_by, branch_id, currency, original_amount, exchange_rate, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [r.amountUZS, description || '', req.user.id, branchId, r.currency, r.original_amount, r.exchange_rate, r.payment_method]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// === TEAM KPI === manager/gen_dir/founder see employees of their branch/company.
// Admin is intentionally excluded — system admin doesn't monitor business KPI.
app.get('/api/team/kpi', auth(['founder', 'gen_dir', 'manager']), async (req, res) => {
  try {
    const { from, to } = req.query; // optional ISO date strings
    const params = [];
    // Exclude admin (not in this company) and manager (manager monitors others, not themselves)
    const userScopeConds = ["u.role NOT IN ('admin', 'manager')"];
    if (req.user.role === 'manager' && req.user.branch_id) {
      userScopeConds.push(`u.branch_id = $${params.length + 1}`); params.push(req.user.branch_id);
    } else if (isCompanyLevel(req.user.role) && req.user.company_id) {
      userScopeConds.push(`u.company_id = $${params.length + 1}`); params.push(req.user.company_id);
    }
    const userScope = userScopeConds.join(' AND ');

    // Period bounds — placeholders must be indexed against the COMBINED params array
    const periodConds = [];
    if (from) { periodConds.push(`so.created_at >= $${params.length + 1}`); params.push(from); }
    if (to)   { periodConds.push(`so.created_at <  $${params.length + 1}`); params.push(to); }
    const periodWhere = periodConds.length ? ' AND ' + periodConds.join(' AND ') : '';

    // Per-employee aggregation
    const { rows } = await pool.query(`
      SELECT
        u.id, u.username, u.first_name, u.last_name, u.role, u.branch_id, u.last_login_at,
        b.name AS branch_name,
        COALESCE(s.sales_count, 0)                                          AS sales_count,
        COALESCE(s.revenue, 0)                                              AS revenue,
        COALESCE(s.cost, 0)                                                 AS cost,
        COALESCE(s.revenue, 0) - COALESCE(s.cost, 0)                        AS profit,
        COALESCE(u_pending.cnt, 0)                                          AS pending_count,
        COALESCE(u_unsettled.total, 0)                                      AS unsettled_amount,
        COALESCE(u_unsettled.cnt, 0)                                        AS unsettled_count
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                            AS sales_count,
          COALESCE(SUM(so.quantity * so.price), 0)            AS revenue,
          COALESCE(SUM(so.quantity * p.price_buy), 0)         AS cost
        FROM stock_outcome so
        JOIN products p ON so.product_id = p.id
        WHERE so.created_by = u.id AND so.status = 'approved' ${periodWhere}
      ) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt FROM stock_outcome
        WHERE created_by = u.id AND status = 'pending'
      ) u_pending ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM cash_income
        WHERE created_by = u.id AND is_settled = FALSE
      ) u_unsettled ON TRUE
      WHERE ${userScope}
      ORDER BY revenue DESC NULLS LAST, u.id
    `, params);

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cash/profit', auth(['gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    let scope;
    try { scope = await getUserBranchIds(req.user, req.query); }
    catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) {
      return res.json({ cash_income: 0, cash_expense: 0, cash_balance: 0, sales_revenue: 0, sales_cost: 0, gross_profit: 0, net_profit: 0 });
    }
    const ids = scope.ids;
    const cashWhere = ids ? 'WHERE branch_id = ANY($1::int[])' : '';
    const cashSettled = ids
      ? 'WHERE branch_id = ANY($1::int[]) AND is_settled IS NOT FALSE'
      : 'WHERE is_settled IS NOT FALSE';
    const soWhere = ids ? "WHERE so.status = 'approved' AND so.branch_id = ANY($1::int[])" : "WHERE so.status = 'approved'";
    const params = ids ? [ids] : [];

    const cashI = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS t FROM cash_income ${cashSettled}`, params);
    const cashE = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS t FROM cash_expense ${cashWhere}`, params);
    const sales = await pool.query(
      `SELECT COALESCE(SUM(so.quantity * p.price_sell), 0) AS revenue,
              COALESCE(SUM(so.quantity * p.price_buy), 0) AS cost
       FROM stock_outcome so JOIN products p ON so.product_id = p.id
       ${soWhere}`, params);
    const revenue = parseFloat(sales.rows[0].revenue);
    const cost = parseFloat(sales.rows[0].cost);
    const cashBalance = parseFloat(cashI.rows[0].t) - parseFloat(cashE.rows[0].t);
    res.json({
      cash_income: parseFloat(cashI.rows[0].t),
      cash_expense: parseFloat(cashE.rows[0].t),
      cash_balance: cashBalance,
      sales_revenue: revenue,
      sales_cost: cost,
      gross_profit: revenue - cost,
      net_profit: cashBalance,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === UPLOAD ===
app.post('/api/upload/photo', auth(['admin', 'cashier', 'warehouse']), (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    if (!req.file) return res.status(400).json({ error: 'Файл не найден' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// === ROLE CHANGE LOG ===
app.get('/api/role-change-log', auth(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM role_change_log ORDER BY changed_at DESC LIMIT 200');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === FULL BUSINESS REPORT (xlsx) ===
// Manager → own branch. Gen_dir/founder → can pass branch_id, otherwise all branches in company.
app.get('/api/reports/full', auth(['manager', 'gen_dir', 'founder']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const explicitBranch = getBranchFilter(req.user, req.query);
    const companyId = req.user.company_id;

    // Resolve scope: which branches are included
    let branchIds;
    if (explicitBranch) {
      branchIds = [explicitBranch];
    } else if (isCompanyLevel(req.user.role)) {
      const r = await pool.query('SELECT id FROM branches WHERE company_id = $1', [companyId]);
      branchIds = r.rows.map(x => x.id);
    } else {
      branchIds = req.user.branch_id ? [req.user.branch_id] : [];
    }
    if (branchIds.length === 0) return res.status(400).json({ error: 'No branches in scope' });

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate   = to   ? new Date(to)   : new Date();
    const scopeArr = `$1::int[]`;
    const baseParams = [branchIds];
    const periodParams = [branchIds, fromDate, toDate];

    // --- Branches + company info
    const branchInfo = await pool.query(
      `SELECT b.id, b.name, b.address, b.phone, c.name AS company_name
       FROM branches b LEFT JOIN companies c ON b.company_id = c.id
       WHERE b.id = ANY($1::int[]) ORDER BY b.name`, [branchIds]);

    // --- Sales (approved outcomes in period)
    const sales = await pool.query(`
      SELECT so.id, so.created_at, so.status, so.note, so.quantity, so.price, so.branch_id,
             p.name_ru AS product, p.barcode, p.unit, p.price_buy,
             pt.name_ru AS product_type,
             u.username AS seller_username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS seller_name,
             u.role AS seller_role,
             b.name AS branch_name
      FROM stock_outcome so
      JOIN products p ON so.product_id = p.id
      LEFT JOIN product_types pt ON p.type_id = pt.id
      LEFT JOIN users u ON so.created_by = u.id
      LEFT JOIN branches b ON so.branch_id = b.id
      WHERE so.branch_id = ANY(${scopeArr})
        AND so.created_at >= $2 AND so.created_at < $3
      ORDER BY so.created_at DESC
    `, periodParams);

    // --- Stock income (товары приход)
    const stockIn = await pool.query(`
      SELECT si.created_at, si.quantity, si.price, si.supplier, si.branch_id,
             p.name_ru AS product, p.barcode, p.unit,
             u.username AS added_by_username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS added_by_name,
             b.name AS branch_name
      FROM stock_income si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN users u ON si.created_by = u.id
      LEFT JOIN branches b ON si.branch_id = b.id
      WHERE si.branch_id = ANY(${scopeArr})
        AND si.created_at >= $2 AND si.created_at < $3
      ORDER BY si.created_at DESC
    `, periodParams);

    // --- Cash income (no category column on cash_income — categories are unused FK-wise)
    const cashIn = await pool.query(`
      SELECT ci.created_at, ci.amount, ci.description, ci.is_settled, ci.outcome_id, ci.branch_id,
             u.username AS by_username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS by_name,
             u.role AS by_role,
             b.name AS branch_name
      FROM cash_income ci
      LEFT JOIN users u ON ci.created_by = u.id
      LEFT JOIN branches b ON ci.branch_id = b.id
      WHERE ci.branch_id = ANY(${scopeArr})
        AND ci.created_at >= $2 AND ci.created_at < $3
      ORDER BY ci.created_at DESC
    `, periodParams);

    // --- Cash expense
    const cashOut = await pool.query(`
      SELECT ce.created_at, ce.amount, ce.description, ce.branch_id,
             u.username AS by_username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS by_name,
             u.role AS by_role,
             b.name AS branch_name
      FROM cash_expense ce
      LEFT JOIN users u ON ce.created_by = u.id
      LEFT JOIN branches b ON ce.branch_id = b.id
      WHERE ce.branch_id = ANY(${scopeArr})
        AND ce.created_at >= $2 AND ce.created_at < $3
      ORDER BY ce.created_at DESC
    `, periodParams);

    // --- Stock balance: one row per (product × branch in scope). Stock = 0 if not yet stocked in that branch.
    const stockBal = await pool.query(`
      SELECT p.name_ru AS product, p.barcode, p.unit, p.price_buy, p.price_sell,
             pt.name_ru AS product_type,
             COALESCE(ps.quantity, 0) AS stock,
             COALESCE(ps.quantity, 0) * p.price_buy AS stock_value_cost,
             COALESCE(ps.quantity, 0) * p.price_sell AS stock_value_sale,
             b.name AS branch_name
      FROM products p
      LEFT JOIN product_types pt ON p.type_id = pt.id
      JOIN branches b ON b.id = ANY($1::int[]) AND b.company_id = p.company_id
      LEFT JOIN product_stock ps ON p.id = ps.product_id AND ps.branch_id = b.id
      WHERE p.company_id = $2
      ORDER BY b.name, p.name_ru
    `, [branchIds, companyId]);

    // --- Team KPI (per employee, for period)
    const kpi = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.role, u.last_login_at,
             b.name AS branch_name,
             COALESCE(s.sales_count, 0)                AS sales_count,
             COALESCE(s.revenue, 0)                    AS revenue,
             COALESCE(s.cost, 0)                       AS cost,
             COALESCE(s.revenue, 0) - COALESCE(s.cost, 0) AS profit,
             COALESCE(u_pending.cnt, 0)                AS pending_count,
             COALESCE(u_unsettled.total, 0)            AS unsettled_amount
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS sales_count,
               COALESCE(SUM(so.quantity * so.price), 0)    AS revenue,
               COALESCE(SUM(so.quantity * p.price_buy), 0) AS cost
        FROM stock_outcome so JOIN products p ON so.product_id = p.id
        WHERE so.created_by = u.id AND so.status = 'approved'
          AND so.created_at >= $2 AND so.created_at < $3
      ) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt FROM stock_outcome
        WHERE created_by = u.id AND status = 'pending'
      ) u_pending ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS total FROM cash_income
        WHERE created_by = u.id AND is_settled = FALSE
      ) u_unsettled ON TRUE
      WHERE u.role NOT IN ('admin', 'manager')
        AND u.branch_id = ANY(${scopeArr})
      ORDER BY revenue DESC NULLS LAST, u.id
    `, periodParams);

    // --- Staff list (all employees in scope)
    const staff = await pool.query(`
      SELECT u.username, u.first_name, u.last_name, u.role, u.last_login_at, u.is_blocked,
             b.name AS branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.role <> 'admin' AND u.branch_id = ANY(${scopeArr})
      ORDER BY b.name, u.role, u.username
    `, baseParams);

    // ---- Compute totals
    const num = v => parseFloat(v || 0);
    const salesRevenue = sales.rows.reduce((a, r) => a + num(r.quantity) * num(r.price), 0);
    const salesCost    = sales.rows.reduce((a, r) => a + num(r.quantity) * num(r.price_buy), 0);
    const salesProfit  = salesRevenue - salesCost;
    const cashInTotal  = cashIn.rows.reduce((a, r) => a + num(r.amount), 0);
    const cashOutTotal = cashOut.rows.reduce((a, r) => a + num(r.amount), 0);
    const stockBalValue = stockBal.rows.reduce((a, r) => a + num(r.stock_value_cost), 0);
    const stockLow = stockBal.rows.filter(r => num(r.stock) > 0 && num(r.stock) < 5).length;
    const stockOut = stockBal.rows.filter(r => num(r.stock) <= 0).length;
    const unsettledTotal = kpi.rows.reduce((a, r) => a + num(r.unsettled_amount), 0);

    // ---- Build workbook
    // ===== i18n =====
    const lang = req.query.lang === 'uz' ? 'uz' : 'ru';
    const dictRu = {
      // Cover
      title: '📊  ПОЛНЫЙ ОТЧЁТ ПО БИЗНЕСУ',
      periodPrefix: 'Период', generatedAt: 'Сформирован', generatedBy: '',
      // Sheet tab names
      tabSummary: 'Сводка', tabSales: 'Продажи', tabStockIn: 'Приход товара',
      tabCashIn: 'Касса приход', tabCashOut: 'Касса расход', tabStockBal: 'Остаток',
      tabKpi: 'KPI сотрудников', tabStaff: 'Сотрудники',
      // Sheet titles
      titleSales: '🛒  Продажи за период',
      titleStockIn: '📥  Приход товара (закуп)',
      titleCashIn: '💵  Касса — приход',
      titleCashOut: '💸  Касса — расход',
      titleStockBal: '📦  Остаток (на текущий момент)',
      titleKpi: '🏆  KPI сотрудников',
      titleStaff: '👥  Сотрудники филиала',
      // Sections in Сводка
      sectGeneral: '🏢  ОБЩАЯ ИНФОРМАЦИЯ',
      sectSales:   '🛒  ПРОДАЖИ ЗА ПЕРИОД',
      sectCash:    '💰  КАССА ЗА ПЕРИОД',
      sectStock:   '📦  ОСТАТКИ (ТЕКУЩИЕ)',
      sectStaff:   '👥  СОТРУДНИКИ',
      // KV labels
      lblCompany: 'Компания', lblBranches: 'Филиал(ы)',
      lblFrom: 'Период с', lblTo: 'Период по',
      lblBuiltAt: 'Сформирован', lblBuiltBy: 'Сформировал',
      lblSalesCount: 'Кол-во продаж (всего)', lblApproved: 'Одобрено',
      lblPending: 'Ожидает подтверждения',
      lblRevenue: 'Выручка', lblCost: 'Себестоимость', lblGrossProfit: 'Валовая прибыль',
      lblCashIn: 'Приход', lblCashOut: 'Расход',
      lblNetProfit: 'Чистая прибыль (приход − расход)', lblUnsettled: 'К сдаче от продавцов',
      lblTotalPositions: 'Всего позиций', lblLow: 'Мало на складе (< 5)', lblOut: 'Нет в наличии',
      lblStockValue: 'Стоимость остатка (по закупке)',
      lblTotalStaff: 'Всего', lblActiveStaff: 'Активных (за 30 дней)', lblBlockedStaff: 'Заблокировано',
      // Column headers
      colDate:'Дата', colTime:'Время', colProduct:'Товар', colCategory:'Категория',
      colBarcode:'Штрих-код', colQty:'Кол-во', colUnit:'Ед.', colPrice:'Цена', colSum:'Сумма',
      colCost:'Себестоимость', colProfit:'Прибыль', colStatus:'Статус',
      colSeller:'Продавец', colLogin:'Логин', colRole:'Роль', colBranch:'Филиал', colNote:'Примечание',
      colPriceBuy:'Цена закупки', colPriceSell:'Цена продажи', colSupplier:'Поставщик',
      colAcceptedBy:'Принял', colDescription:'Описание', colRelSale:'Связ. продажа',
      colHandover:'Статус сдачи', colDoneBy:'Провёл',
      colStock:'Остаток', colStockValBuy:'Стоимость (закуп)', colStockValSell:'Стоимость (продаж)',
      colEmployee:'Сотрудник', colLastLogin:'Последний вход', colSalesCount:'Продаж',
      colToSettle:'К сдаче', colPendingApprovals:'На утверждении', colFullName:'ФИО',
      // Statuses
      stApproved:'Одобрено', stPending:'Ожидает', stRejected:'Отклонено',
      stInStock:'В наличии', stLow:'Мало', stOut:'Нет',
      stSettled:'Сдано', stToSettle:'К сдаче',
      stActive:'Активен', stBlocked:'Заблокирован',
      total: 'ИТОГО:',
      // Roles
      roleFounder:'Учредитель', roleGenDir:'Ген. директор', roleManager:'Менеджер',
      roleCashier:'Кассир', roleWarehouse:'Кладовщик', roleSeller:'Продавец', roleAdmin:'Админ',
      dash: '—',
    };
    const dictUz = {
      title: "📊  TO'LIQ BIZNES HISOBOTI",
      periodPrefix: 'Davr', generatedAt: 'Tayyorlandi', generatedBy: '',
      tabSummary: 'Xulosa', tabSales: 'Sotuvlar', tabStockIn: 'Tovar kirimi',
      tabCashIn: 'Kassa kirimi', tabCashOut: 'Kassa chiqimi', tabStockBal: 'Qoldiq',
      tabKpi: 'Xodimlar KPI', tabStaff: 'Xodimlar',
      titleSales: '🛒  Davr sotuvlari',
      titleStockIn: '📥  Tovar kirimi (xarid)',
      titleCashIn: '💵  Kassa — kirim',
      titleCashOut: '💸  Kassa — chiqim',
      titleStockBal: '📦  Qoldiq (hozirgi paytda)',
      titleKpi: '🏆  Xodimlar KPI',
      titleStaff: '👥  Filial xodimlari',
      sectGeneral: "🏢  UMUMIY MA'LUMOT",
      sectSales:   '🛒  DAVR SOTUVLARI',
      sectCash:    '💰  DAVR KASSASI',
      sectStock:   '📦  QOLDIQLAR (JORIY)',
      sectStaff:   '👥  XODIMLAR',
      lblCompany: 'Kompaniya', lblBranches: 'Filial(lar)',
      lblFrom: 'Davr (boshi)', lblTo: 'Davr (oxiri)',
      lblBuiltAt: 'Tayyorlangan vaqt', lblBuiltBy: 'Kim tayyorladi',
      lblSalesCount: 'Sotuvlar soni (jami)', lblApproved: 'Tasdiqlangan',
      lblPending: 'Tasdiqlanishi kutilmoqda',
      lblRevenue: 'Tushum', lblCost: 'Tannarx', lblGrossProfit: 'Yalpi foyda',
      lblCashIn: 'Kirim', lblCashOut: 'Chiqim',
      lblNetProfit: 'Sof foyda (kirim − chiqim)', lblUnsettled: 'Topshirilishi kerak (sotuvchilardan)',
      lblTotalPositions: 'Pozitsiyalar jami', lblLow: 'Ombor kam (< 5)', lblOut: 'Mavjud emas',
      lblStockValue: "Qoldiq qiymati (xarid bo'yicha)",
      lblTotalStaff: 'Jami', lblActiveStaff: 'Faol (30 kun ichida)', lblBlockedStaff: 'Bloklangan',
      colDate:'Sana', colTime:'Vaqt', colProduct:'Tovar', colCategory:'Kategoriya',
      colBarcode:'Shtrix-kod', colQty:'Soni', colUnit:'Birlik', colPrice:'Narxi', colSum:'Summa',
      colCost:'Tannarx', colProfit:'Foyda', colStatus:'Holat',
      colSeller:'Sotuvchi', colLogin:'Login', colRole:'Rol', colBranch:'Filial', colNote:'Izoh',
      colPriceBuy:'Xarid narxi', colPriceSell:'Sotish narxi', colSupplier:'Yetkazib beruvchi',
      colAcceptedBy:'Qabul qildi', colDescription:'Tavsif', colRelSale:"Bog'liq sotuv",
      colHandover:'Topshirish holati', colDoneBy:"Kim o'tkazdi",
      colStock:'Qoldiq', colStockValBuy:'Qiymati (xarid)', colStockValSell:'Qiymati (sotish)',
      colEmployee:'Xodim', colLastLogin:"So'nggi kirish", colSalesCount:'Sotuvlar',
      colToSettle:'Topshirish', colPendingApprovals:'Tasdiqlashda', colFullName:'F.I.O',
      stApproved:'Tasdiqlangan', stPending:'Kutilmoqda', stRejected:'Rad etilgan',
      stInStock:'Mavjud', stLow:'Kam', stOut:"Yo'q",
      stSettled:'Topshirilgan', stToSettle:'Topshirish kerak',
      stActive:'Faol', stBlocked:'Bloklangan',
      total: 'JAMI:',
      roleFounder:"Ta'sischi", roleGenDir:'Bosh direktor', roleManager:'Menejer',
      roleCashier:'Kassir', roleWarehouse:'Omborchi', roleSeller:'Sotuvchi', roleAdmin:'Admin',
      dash: '—',
    };
    const L = lang === 'uz' ? dictUz : dictRu;
    const ROLE_LBL = { founder:L.roleFounder, gen_dir:L.roleGenDir, manager:L.roleManager, cashier:L.roleCashier, warehouse:L.roleWarehouse, seller:L.roleSeller, admin:L.roleAdmin };
    const STATUS_LBL = { approved:L.stApproved, pending:L.stPending, rejected:L.stRejected };
    const fmtDate = d => d ? new Date(d) : null;
    const localeCode = lang === 'uz' ? 'uz-UZ' : 'ru-RU';

    // ===== ExcelJS styled workbook =====
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WareApp';
    wb.lastModifiedBy = req.user.username;
    wb.created = new Date();

    // Palette (ARGB hex — alpha "FF" prefix required)
    const C = {
      titleBg:    'FFEEF0FF',
      titleText:  'FF1E1B4B',
      sectionBg:  'FF6B5FE8',
      sectionText:'FFFFFFFF',
      headerBg:   'FF4338CA',
      headerText: 'FFFFFFFF',
      totalBg:    'FF1E1B4B',
      totalText:  'FFFFFFFF',
      zebra:      'FFF8F9FB',
      border:     'FFE2E4F0',
      muted:      'FF6B6F8A',
      green:      'FF15803D',
      red:        'FFB91C1C',
      orange:     'FFC2410C',
      yellowBg:   'FFFEF3C7',
      redBg:      'FFFEE2E2',
      greenBg:    'FFD1FAE5',
    };
    const MONEY_FMT = '#,##0;[Red]-#,##0';
    const QTY_FMT   = '#,##0.###';
    const DT_FMT    = 'dd.mm.yyyy hh:mm';
    const thinBorder = (col = C.border) => ({
      top:    { style: 'thin', color: { argb: col } },
      bottom: { style: 'thin', color: { argb: col } },
      left:   { style: 'thin', color: { argb: col } },
      right:  { style: 'thin', color: { argb: col } },
    });
    const periodLabel = `${L.periodPrefix}: ${fromDate.toLocaleDateString(localeCode)} — ${toDate.toLocaleDateString(localeCode)}  •  ${L.generatedAt}: ${new Date().toLocaleString(localeCode)}  •  ${req.user.username} (${ROLE_LBL[req.user.role]||req.user.role})`;

    function applyHeader(ws, rowNum, colCount) {
      const row = ws.getRow(rowNum);
      row.font = { bold: true, color: { argb: C.headerText }, size: 11 };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 26;
      for (let c = 1; c <= colCount; c++) row.getCell(c).border = thinBorder('FF312E81');
      ws.autoFilter = { from: { row: rowNum, column: 1 }, to: { row: rowNum, column: colCount } };
      ws.views = [{ state: 'frozen', ySplit: rowNum }];
    }
    function applyZebraAndBorders(ws, dataStart, dataEnd, colCount, numericCols = []) {
      for (let r = dataStart; r <= dataEnd; r++) {
        const row = ws.getRow(r);
        const isZebra = (r - dataStart) % 2 === 1;
        row.height = 18;
        for (let c = 1; c <= colCount; c++) {
          const cell = row.getCell(c);
          cell.border = thinBorder();
          if (isZebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
          cell.alignment = { vertical: 'middle', horizontal: numericCols.includes(c-1) ? 'right' : 'left', wrapText: false };
        }
      }
    }
    function applyTotalsRow(ws, rowNum, colCount) {
      const row = ws.getRow(rowNum);
      row.font = { bold: true, color: { argb: C.totalText }, size: 11 };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } };
      row.height = 24;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'medium', color: { argb: C.totalBg } },
          bottom: { style: 'medium', color: { argb: C.totalBg } },
          left: { style: 'thin', color: { argb: C.totalBg } },
          right: { style: 'thin', color: { argb: C.totalBg } },
        };
      }
    }
    function buildTableSheet({ name, title, tabColor, headers, widths, rows, numFormats = {}, numericCols = [], totals = null, statusCol = null }) {
      const safeName = name.length > 31 ? name.slice(0, 31) : name;
      const ws = wb.addWorksheet(safeName, { properties: { tabColor: { argb: tabColor || C.headerBg } } });
      const N = headers.length;
      // Row 1: title (merged)
      ws.mergeCells(1, 1, 1, N);
      const t1 = ws.getCell(1, 1);
      t1.value = title;
      t1.font = { bold: true, size: 16, color: { argb: C.titleText } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.titleBg } };
      t1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(1).height = 32;
      // Row 2: subtitle
      ws.mergeCells(2, 1, 2, N);
      const t2 = ws.getCell(2, 1);
      t2.value = periodLabel;
      t2.font = { italic: true, size: 10, color: { argb: C.muted } };
      t2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(2).height = 20;
      // Row 3: spacer is left blank intentionally
      // Row 4: headers
      const HEAD = 4;
      headers.forEach((h, i) => { ws.getCell(HEAD, i + 1).value = h; });
      // Column widths
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      applyHeader(ws, HEAD, N);
      // Row 5+: data
      const dataStart = HEAD + 1;
      rows.forEach((rowData, i) => {
        const row = ws.getRow(dataStart + i);
        rowData.forEach((v, c) => { if (v != null && v !== '') row.getCell(c + 1).value = v; });
      });
      // Apply per-column number formats
      Object.entries(numFormats).forEach(([col, fmt]) => {
        const C0 = parseInt(col) + 1;
        for (let r = dataStart; r < dataStart + rows.length; r++) {
          const cell = ws.getCell(r, C0);
          if (cell.value != null && cell.value !== '') cell.numFmt = fmt;
        }
      });
      // Zebra + borders + alignment
      if (rows.length > 0) applyZebraAndBorders(ws, dataStart, dataStart + rows.length - 1, N, numericCols);
      // Status column colored chip
      if (statusCol != null && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          const cell = ws.getCell(dataStart + i, statusCol + 1);
          const v = String(cell.value || '');
          let bg = null, fg = null;
          const okSet = new Set([L.stApproved, L.stInStock, L.stSettled, L.stActive]);
          const warnSet = new Set([L.stPending, L.stLow, L.stToSettle]);
          const badSet = new Set([L.stRejected, L.stOut, L.stBlocked]);
          if (okSet.has(v))      { bg = C.greenBg;  fg = C.green; }
          else if (warnSet.has(v)) { bg = C.yellowBg; fg = C.orange; }
          else if (badSet.has(v))  { bg = C.redBg;    fg = C.red; }
          if (bg) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.font = { color: { argb: fg }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }
      }
      // Totals row
      if (totals) {
        const totalRowNum = dataStart + rows.length;
        totals.forEach((v, c) => { if (v != null && v !== '') ws.getCell(totalRowNum, c + 1).value = v; });
        // Number formats again on totals row
        Object.entries(numFormats).forEach(([col, fmt]) => {
          const cell = ws.getCell(totalRowNum, parseInt(col) + 1);
          if (cell.value != null && cell.value !== '') cell.numFmt = fmt;
        });
        applyTotalsRow(ws, totalRowNum, N);
        // Right-align numeric cols in totals row
        for (let c = 0; c < N; c++) {
          const cell = ws.getCell(totalRowNum, c + 1);
          cell.alignment = { vertical: 'middle', horizontal: numericCols.includes(c) ? 'right' : 'left', indent: numericCols.includes(c) ? 0 : 1 };
        }
      }
      // Page setup — useful when printed
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };
      return ws;
    }

    function makeSheet(headers, rows, colFormats = {}, colWidths = []) {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      if (colWidths.length) ws['!cols'] = colWidths.map(w => ({ wch: w }));
      const range = XLSX.utils.decode_range(ws['!ref']);
      // Bold header row
      for (let C = range.s.c; C <= range.e.c; C++) {
        const a = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[a]) ws[a].s = { font: { bold: true } };
      }
      // Apply per-column number/date formats. Date formats must only be applied
      // to actual Date values — applying to empty strings makes xlsx call
      // toISOString on a string and throw "Invalid time value".
      Object.entries(colFormats).forEach(([colStr, fmt]) => {
        const C = parseInt(colStr);
        const isDateFmt = fmt === DTFMT || fmt === DFMT;
        for (let R = 1; R <= range.e.r; R++) {
          const a = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[a];
          if (!cell || cell.v == null || cell.v === '') continue;
          if (isDateFmt) {
            if (cell.v instanceof Date && !isNaN(cell.v.getTime())) {
              cell.z = fmt; cell.t = 'd';
            }
          } else {
            cell.z = fmt;
          }
        }
      });
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: range.s.c }, e: { r: range.e.r, c: range.e.c } }) };
      return ws;
    }

    // ====== SHEET 1: Сводка (custom layout with sections) ======
    const branchNames = branchInfo.rows.map(b => b.name).join(', ') || '—';
    const companyName = branchInfo.rows[0]?.company_name || '—';
    const activeStaff = staff.rows.filter(s => s.last_login_at && (Date.now() - new Date(s.last_login_at).getTime()) < 30*86400000).length;
    const blockedStaff = staff.rows.filter(s => s.is_blocked).length;
    const netProfitCash = cashInTotal - cashOutTotal;

    const wsSum = wb.addWorksheet(L.tabSummary, { properties: { tabColor: { argb: 'FF1E1B4B' } }, views: [{ showGridLines: false }] });
    wsSum.getColumn(1).width = 42;
    wsSum.getColumn(2).width = 32;
    // Cover title
    wsSum.mergeCells('A1:B1');
    const cT = wsSum.getCell('A1');
    cT.value = L.title;
    cT.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    cT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
    cT.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    wsSum.getRow(1).height = 42;
    // Subtitle
    wsSum.mergeCells('A2:B2');
    const cS = wsSum.getCell('A2');
    cS.value = periodLabel;
    cS.font = { italic: true, size: 11, color: { argb: C.muted } };
    cS.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    wsSum.getRow(2).height = 22;

    let R = 3;
    const section = (label) => {
      R += 1;
      wsSum.mergeCells(R, 1, R, 2);
      const c = wsSum.getCell(R, 1);
      c.value = label;
      c.font = { bold: true, size: 12, color: { argb: C.sectionText } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.sectionBg } };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      wsSum.getRow(R).height = 24;
    };
    const kv = (label, value, opts = {}) => {
      R += 1;
      const lcell = wsSum.getCell(R, 1);
      const vcell = wsSum.getCell(R, 2);
      lcell.value = label;
      vcell.value = value;
      lcell.font = { color: { argb: C.muted }, size: 11 };
      lcell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      vcell.font = { bold: true, size: 11, color: { argb: opts.color || 'FF1A1B2E' } };
      vcell.alignment = { vertical: 'middle', horizontal: typeof value === 'number' ? 'right' : 'left', indent: 1 };
      if (opts.numFmt) vcell.numFmt = opts.numFmt;
      else if (value instanceof Date) vcell.numFmt = DT_FMT;
      lcell.border = thinBorder();
      vcell.border = thinBorder();
      wsSum.getRow(R).height = 20;
    };

    section(L.sectGeneral);
    kv(L.lblCompany, companyName);
    kv(L.lblBranches, branchNames);
    kv(L.lblFrom, fromDate);
    kv(L.lblTo, toDate);
    kv(L.lblBuiltAt, new Date());
    kv(L.lblBuiltBy, `${req.user.username} (${ROLE_LBL[req.user.role]||req.user.role})`);

    section(L.sectSales);
    kv(L.lblSalesCount, sales.rows.length);
    kv(L.lblApproved, sales.rows.filter(r => r.status === 'approved').length, { color: C.green });
    kv(L.lblPending, sales.rows.filter(r => r.status === 'pending').length, { color: C.orange });
    kv(L.lblRevenue, salesRevenue, { numFmt: MONEY_FMT, color: C.green });
    kv(L.lblCost, salesCost, { numFmt: MONEY_FMT, color: C.orange });
    kv(L.lblGrossProfit, salesProfit, { numFmt: MONEY_FMT, color: salesProfit >= 0 ? C.green : C.red });

    section(L.sectCash);
    kv(L.lblCashIn, cashInTotal, { numFmt: MONEY_FMT, color: C.green });
    kv(L.lblCashOut, cashOutTotal, { numFmt: MONEY_FMT, color: C.red });
    kv(L.lblNetProfit, netProfitCash, { numFmt: MONEY_FMT, color: netProfitCash >= 0 ? C.green : C.red });
    kv(L.lblUnsettled, unsettledTotal, { numFmt: MONEY_FMT, color: unsettledTotal > 0 ? C.orange : C.muted });

    section(L.sectStock);
    kv(L.lblTotalPositions, stockBal.rows.length);
    kv(L.lblLow, stockLow, { color: C.orange });
    kv(L.lblOut, stockOut, { color: C.red });
    kv(L.lblStockValue, stockBalValue, { numFmt: MONEY_FMT });

    section(L.sectStaff);
    kv(L.lblTotalStaff, staff.rows.length);
    kv(L.lblActiveStaff, activeStaff, { color: C.green });
    kv(L.lblBlockedStaff, blockedStaff, { color: blockedStaff > 0 ? C.red : C.muted });

    wsSum.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    // ====== SHEET 2: Sales ======
    const salesData = sales.rows.map(r => {
      const qty = num(r.quantity), price = num(r.price), buy = num(r.price_buy);
      return [
        fmtDate(r.created_at), r.product, r.product_type || '', r.barcode || '',
        qty, r.unit || '', price, qty * price, qty * buy, qty * (price - buy),
        STATUS_LBL[r.status] || r.status, r.seller_name || '', r.seller_username || '',
        ROLE_LBL[r.seller_role] || r.seller_role, r.branch_name || '', r.note || '',
      ];
    });
    const salesTotals = salesData.length ? [
      null, L.total, null, null,
      salesData.reduce((a, r) => a + r[4], 0), null, null,
      salesRevenue, salesCost, salesProfit, null, null, null, null, null, null,
    ] : null;
    buildTableSheet({
      name: L.tabSales,
      title: L.titleSales,
      tabColor: 'FF4338CA',
      headers: [L.colDate, L.colProduct, L.colCategory, L.colBarcode, L.colQty, L.colUnit, L.colPrice, L.colSum, L.colCost, L.colProfit, L.colStatus, L.colSeller, L.colLogin, L.colRole, L.colBranch, L.colNote],
      widths:  [18, 28, 16, 16, 10, 6, 12, 16, 16, 16, 14, 22, 14, 14, 16, 26],
      rows: salesData,
      numFormats: { 0: DT_FMT, 4: QTY_FMT, 6: MONEY_FMT, 7: MONEY_FMT, 8: MONEY_FMT, 9: MONEY_FMT },
      numericCols: [4, 6, 7, 8, 9],
      totals: salesTotals,
      statusCol: 10,
    });

    // ====== SHEET 3: Stock-in ======
    const stockInData = stockIn.rows.map(r => {
      const qty = num(r.quantity), price = num(r.price);
      return [
        fmtDate(r.created_at), r.product, r.barcode || '',
        qty, r.unit || '', price, qty * price,
        r.supplier || '', r.added_by_name || '', r.added_by_username || '', r.branch_name || '',
      ];
    });
    const stockInTotals = stockInData.length ? [
      null, L.total, null,
      stockInData.reduce((a, r) => a + r[3], 0), null, null,
      stockInData.reduce((a, r) => a + r[6], 0), null, null, null, null,
    ] : null;
    buildTableSheet({
      name: L.tabStockIn,
      title: L.titleStockIn,
      tabColor: 'FF16A34A',
      headers: [L.colDate, L.colProduct, L.colBarcode, L.colQty, L.colUnit, L.colPriceBuy, L.colSum, L.colSupplier, L.colAcceptedBy, L.colLogin, L.colBranch],
      widths:  [18, 28, 16, 10, 6, 16, 16, 20, 22, 14, 16],
      rows: stockInData,
      numFormats: { 0: DT_FMT, 3: QTY_FMT, 5: MONEY_FMT, 6: MONEY_FMT },
      numericCols: [3, 5, 6],
      totals: stockInTotals,
    });

    // ====== SHEET 4: Cash income ======
    const cashInData = cashIn.rows.map(r => [
      fmtDate(r.created_at), num(r.amount), r.description || '',
      r.outcome_id || null, r.is_settled ? L.stSettled : L.stToSettle,
      r.by_name || '', r.by_username || '', ROLE_LBL[r.by_role] || r.by_role || '', r.branch_name || '',
    ]);
    const cashInTotals = cashInData.length ? [null, cashInTotal, L.total, null, null, null, null, null, null] : null;
    buildTableSheet({
      name: L.tabCashIn,
      title: L.titleCashIn,
      tabColor: 'FF16A34A',
      headers: [L.colDate, L.colSum, L.colDescription, L.colRelSale, L.colHandover, L.colAcceptedBy, L.colLogin, L.colRole, L.colBranch],
      widths:  [18, 16, 32, 14, 14, 22, 14, 14, 16],
      rows: cashInData,
      numFormats: { 0: DT_FMT, 1: MONEY_FMT },
      numericCols: [1, 3],
      totals: cashInTotals,
      statusCol: 4,
    });

    // ====== SHEET 5: Cash expense ======
    const cashOutData = cashOut.rows.map(r => [
      fmtDate(r.created_at), num(r.amount), r.description || '',
      r.by_name || '', r.by_username || '', ROLE_LBL[r.by_role] || r.by_role || '', r.branch_name || '',
    ]);
    const cashOutTotals = cashOutData.length ? [null, cashOutTotal, L.total, null, null, null, null] : null;
    buildTableSheet({
      name: L.tabCashOut,
      title: L.titleCashOut,
      tabColor: 'FFDC2626',
      headers: [L.colDate, L.colSum, L.colDescription, L.colDoneBy, L.colLogin, L.colRole, L.colBranch],
      widths:  [18, 16, 32, 22, 14, 14, 16],
      rows: cashOutData,
      numFormats: { 0: DT_FMT, 1: MONEY_FMT },
      numericCols: [1],
      totals: cashOutTotals,
    });

    // ====== SHEET 6: Stock balance ======
    const stockBalData = stockBal.rows.map(r => {
      const s = num(r.stock);
      const status = s <= 0 ? L.stOut : s < 5 ? L.stLow : L.stInStock;
      return [
        r.product, r.product_type || '', r.barcode || '', s, r.unit || '',
        num(r.price_buy), num(r.price_sell), num(r.stock_value_cost), num(r.stock_value_sale),
        status, r.branch_name || '',
      ];
    });
    const stockBalTotals = stockBalData.length ? [
      L.total, null, null, null, null, null, null,
      stockBalData.reduce((a, r) => a + r[7], 0),
      stockBalData.reduce((a, r) => a + r[8], 0),
      null, null,
    ] : null;
    buildTableSheet({
      name: L.tabStockBal,
      title: L.titleStockBal,
      tabColor: 'FFD97706',
      headers: [L.colProduct, L.colCategory, L.colBarcode, L.colStock, L.colUnit, L.colPriceBuy, L.colPriceSell, L.colStockValBuy, L.colStockValSell, L.colStatus, L.colBranch],
      widths:  [30, 16, 16, 10, 6, 16, 16, 18, 18, 14, 16],
      rows: stockBalData,
      numFormats: { 3: QTY_FMT, 5: MONEY_FMT, 6: MONEY_FMT, 7: MONEY_FMT, 8: MONEY_FMT },
      numericCols: [3, 5, 6, 7, 8],
      totals: stockBalTotals,
      statusCol: 9,
    });

    // ====== SHEET 7: KPI ======
    const kpiData = kpi.rows.map(r => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username;
      return [
        name, r.username, ROLE_LBL[r.role] || r.role, r.branch_name || '',
        r.last_login_at ? fmtDate(r.last_login_at) : '',
        parseInt(r.sales_count || 0), num(r.revenue), num(r.cost), num(r.profit),
        num(r.unsettled_amount), parseInt(r.pending_count || 0),
      ];
    });
    const kpiTotals = kpiData.length ? [
      L.total, null, null, null, null,
      kpiData.reduce((a, r) => a + r[5], 0),
      kpiData.reduce((a, r) => a + r[6], 0),
      kpiData.reduce((a, r) => a + r[7], 0),
      kpiData.reduce((a, r) => a + r[8], 0),
      kpiData.reduce((a, r) => a + r[9], 0),
      kpiData.reduce((a, r) => a + r[10], 0),
    ] : null;
    buildTableSheet({
      name: L.tabKpi,
      title: L.titleKpi,
      tabColor: 'FF7C3AED',
      headers: [L.colEmployee, L.colLogin, L.colRole, L.colBranch, L.colLastLogin, L.colSalesCount, L.lblRevenue, L.colCost, L.colProfit, L.colToSettle, L.colPendingApprovals],
      widths:  [24, 14, 14, 16, 18, 10, 16, 16, 16, 16, 14],
      rows: kpiData,
      numFormats: { 4: DT_FMT, 6: MONEY_FMT, 7: MONEY_FMT, 8: MONEY_FMT, 9: MONEY_FMT },
      numericCols: [5, 6, 7, 8, 9, 10],
      totals: kpiTotals,
    });

    // ====== SHEET 8: Staff ======
    const staffData = staff.rows.map(r => [
      r.username, [r.first_name, r.last_name].filter(Boolean).join(' ') || '',
      ROLE_LBL[r.role] || r.role, r.branch_name || '',
      r.last_login_at ? fmtDate(r.last_login_at) : '', r.is_blocked ? L.stBlocked : L.stActive,
    ]);
    buildTableSheet({
      name: L.tabStaff,
      title: L.titleStaff,
      tabColor: 'FF6366F1',
      headers: [L.colLogin, L.colFullName, L.colRole, L.colBranch, L.colLastLogin, L.colStatus],
      widths:  [16, 24, 16, 16, 18, 16],
      rows: staffData,
      numFormats: { 4: DT_FMT },
      numericCols: [],
      totals: null,
      statusCol: 5,
    });

    // Stream output
    const ymd = d => d.toISOString().slice(0, 10);
    const scopeLabel = explicitBranch ? `branch${explicitBranch}` : `company${companyId}`;
    const fname = `report_${scopeLabel}_${ymd(fromDate)}_${ymd(toDate)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('reports/full err', e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else res.end();
  }
});

// === SUPPLIERS (per-company) ===
app.get('/api/suppliers', auth(), async (req, res) => {
  try {
    const { search } = req.query;
    const params = [req.user.company_id];
    let where = 's.deleted_at IS NULL AND s.company_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (s.name ILIKE $${params.length} OR s.phone ILIKE $${params.length} OR s.email ILIKE $${params.length} OR s.contact_person ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(`
      SELECT s.*, u.username AS created_by_name,
             COALESCE(stats.income_count, 0)::int AS income_count,
             COALESCE(stats.total_value, 0)        AS total_value,
             stats.last_income_at,
             COALESCE(debt.debt_count, 0)::int  AS debt_count,
             COALESCE(debt.debt_amount, 0)       AS debt_amount
      FROM suppliers s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS income_count,
               COALESCE(SUM(quantity * price), 0) AS total_value,
               MAX(created_at) AS last_income_at
        FROM stock_income WHERE supplier_id = s.id
      ) stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS debt_count,
               COALESCE(SUM((quantity * price) - COALESCE(paid_amount,0)), 0) AS debt_amount
        FROM stock_income WHERE supplier_id = s.id AND payment_status <> 'paid'
      ) debt ON TRUE
      WHERE ${where}
      ORDER BY stats.last_income_at DESC NULLS LAST, s.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/suppliers', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const { name, phone, email, contact_person, address, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const { rows } = await pool.query(
      `INSERT INTO suppliers (company_id, name, phone, email, contact_person, address, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.company_id, name.trim(), phone || null, email || null, contact_person || null, address || null, note || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/suppliers/:id', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const { name, phone, email, contact_person, address, note } = req.body;
    const { rows } = await pool.query(
      `UPDATE suppliers SET name=$1, phone=$2, email=$3, contact_person=$4, address=$5, note=$6
       WHERE id=$7 AND company_id=$8 AND deleted_at IS NULL RETURNING *`,
      [name, phone || null, email || null, contact_person || null, address || null, note || null,
       req.params.id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/suppliers/:id', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    await pool.query(
      'UPDATE suppliers SET deleted_at=NOW() WHERE id=$1 AND company_id=$2',
      [req.params.id, req.user.company_id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Supplier debts — unpaid stock_income rows by this supplier (we owe them)
app.get('/api/suppliers/:id/debts', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT si.id, si.created_at, si.quantity, si.price, si.payment_status,
             si.payment_method, si.paid_amount, si.due_date, si.branch_id,
             (si.quantity * si.price) AS total_amount,
             ((si.quantity * si.price) - COALESCE(si.paid_amount, 0)) AS remaining,
             p.name_ru AS product_name, p.unit,
             b.name AS branch_name,
             CASE WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS overdue
      FROM stock_income si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN branches b ON si.branch_id = b.id
      WHERE si.supplier_id = $1 AND p.company_id = $2 AND si.payment_status <> 'paid'
      ORDER BY si.due_date NULLS LAST, si.created_at DESC
    `, [req.params.id, req.user.company_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pay a supplier-debt income (we are paying THEM)
app.post('/api/stock/income/:id/pay', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, payment_method, note } = req.body;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const pmethod = ['cash','card','transfer','wire'].includes(payment_method) ? payment_method : 'cash';
    await client.query('BEGIN');
    const { rows: [cur] } = await client.query(
      `SELECT si.*, p.company_id, s.name AS supplier_name
       FROM stock_income si JOIN products p ON si.product_id = p.id
       LEFT JOIN suppliers s ON si.supplier_id = s.id
       WHERE si.id = $1 FOR UPDATE`, [req.params.id]);
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Income not found' }); }
    if (cur.company_id !== req.user.company_id && req.user.role !== 'admin') {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Out of scope' });
    }
    if (cur.payment_status === 'paid') {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already paid' });
    }
    const total = parseFloat(cur.quantity) * parseFloat(cur.price || 0);
    const already = parseFloat(cur.paid_amount || 0);
    const remaining = total - already;
    if (amt > remaining + 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount > remaining (${remaining})` });
    }
    const newPaid = already + amt;
    const newStatus = newPaid >= total - 0.01 ? 'paid' : 'partial';
    await client.query(
      'INSERT INTO supplier_debt_payments (income_id, amount, payment_method, paid_by, note) VALUES ($1,$2,$3,$4,$5)',
      [cur.id, amt, pmethod, req.user.id, note || null]
    );
    await client.query('UPDATE stock_income SET paid_amount=$1, payment_status=$2 WHERE id=$3', [newPaid, newStatus, cur.id]);
    // Record cash outflow
    const desc = `Оплата поставщику${cur.supplier_name ? ' ('+cur.supplier_name+')' : ''}: приход #${cur.id}`;
    await client.query(
      `INSERT INTO cash_expense (amount, description, created_by, branch_id, payment_method, currency, original_amount, exchange_rate)
       VALUES ($1,$2,$3,$4,$5,'UZS',$1,1)`,
      [amt, desc, req.user.id, cur.branch_id, pmethod]
    );
    await client.query('COMMIT');
    res.json({ ok: true, paid_amount: newPaid, payment_status: newStatus });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.get('/api/suppliers/:id/history', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT si.id, si.created_at, si.quantity, si.price, si.note,
             p.name_ru AS product_name, p.unit,
             b.name AS branch_name,
             (si.quantity * si.price) AS total
      FROM stock_income si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN branches b ON si.branch_id = b.id
      WHERE si.supplier_id = $1 AND p.company_id = $2
      ORDER BY si.created_at DESC
      LIMIT 200
    `, [req.params.id, req.user.company_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === CUSTOMERS (per-company) ===
// View permitted to everyone (sellers need it for the picker). Mutations restricted.
app.get('/api/customers', auth(), async (req, res) => {
  try {
    const { search } = req.query;
    const branchId = getBranchFilter(req.user, req.query);
    const params = [req.user.company_id];
    let where = 'c.deleted_at IS NULL AND c.company_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }
    // Debt aggregate (per-branch if branchId, else company-wide)
    const debtJoin = branchId
      ? `LEFT JOIN LATERAL (
           SELECT COUNT(*) AS debts_count,
                  COALESCE(SUM((so.quantity * so.price) - COALESCE(so.paid_amount,0)), 0) AS debt_amount
           FROM stock_outcome so
           WHERE so.customer_id = c.id AND so.payment_status <> 'paid' AND so.status = 'approved'
             AND so.branch_id = $${params.push(branchId)}
         ) d ON TRUE`
      : `LEFT JOIN LATERAL (
           SELECT COUNT(*) AS debts_count,
                  COALESCE(SUM((so.quantity * so.price) - COALESCE(so.paid_amount,0)), 0) AS debt_amount
           FROM stock_outcome so
           WHERE so.customer_id = c.id AND so.payment_status <> 'paid' AND so.status = 'approved'
         ) d ON TRUE`;
    const { rows } = await pool.query(`
      SELECT c.*, u.username AS created_by_name,
             COALESCE(d.debts_count, 0)::int AS debts_count,
             COALESCE(d.debt_amount, 0)      AS debt_amount
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
      ${debtJoin}
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier']), async (req, res) => {
  try {
    const { name, phone, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const { rows } = await pool.query(
      'INSERT INTO customers (company_id, name, phone, note, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.company_id, name.trim(), phone || null, note || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/customers/:id', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier']), async (req, res) => {
  try {
    const { name, phone, note } = req.body;
    const { rows } = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, note=$3
       WHERE id=$4 AND company_id=$5 AND deleted_at IS NULL RETURNING *`,
      [name, phone || null, note || null, req.params.id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/customers/:id', auth(['admin', 'gen_dir', 'founder', 'manager']), async (req, res) => {
  try {
    await pool.query(
      'UPDATE customers SET deleted_at = NOW() WHERE id=$1 AND company_id=$2',
      [req.params.id, req.user.company_id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer history (all outcomes by this customer in scope)
app.get('/api/customers/:id/history', auth(), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [req.params.id, req.user.company_id];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = `AND so.branch_id = $${params.length}`; }
    const { rows } = await pool.query(`
      SELECT so.*, p.name_ru AS product_name, p.unit, b.name AS branch_name,
             u.username AS seller_username,
             (so.quantity * so.price) AS total_amount
      FROM stock_outcome so
      JOIN products p ON so.product_id = p.id
      LEFT JOIN branches b ON so.branch_id = b.id
      LEFT JOIN users u ON so.created_by = u.id
      WHERE so.customer_id = $1
        AND p.company_id = $2
        ${branchFilter}
      ORDER BY so.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === DEBTS — unpaid (or partially paid) outcomes ===
app.get('/api/debts', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier']), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [req.user.company_id];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = `AND so.branch_id = $${params.length}`; }
    const { rows } = await pool.query(`
      SELECT so.id, so.created_at, so.quantity, so.price, so.payment_status, so.payment_method,
             so.paid_amount, so.due_date, so.branch_id,
             (so.quantity * so.price) AS total_amount,
             ((so.quantity * so.price) - COALESCE(so.paid_amount, 0)) AS remaining,
             p.name_ru AS product_name, p.unit,
             c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
             b.name AS branch_name,
             u.username AS seller_username,
             CASE WHEN so.due_date IS NOT NULL AND so.due_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS overdue
      FROM stock_outcome so
      JOIN products p ON so.product_id = p.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN branches b ON so.branch_id = b.id
      LEFT JOIN users u ON so.created_by = u.id
      WHERE so.payment_status <> 'paid' AND so.status = 'approved'
        AND p.company_id = $1 ${branchFilter}
      ORDER BY so.due_date NULLS LAST, so.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record a debt payment against an outcome. Creates a cash_income for the amount.
app.post('/api/stock/outcome/:id/pay', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, payment_method, note } = req.body;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const pmethod = ['cash','card','transfer','wire'].includes(payment_method) ? payment_method : 'cash';
    await client.query('BEGIN');
    const { rows: [cur] } = await client.query(
      `SELECT so.*, p.company_id, c.name AS customer_name
       FROM stock_outcome so JOIN products p ON so.product_id = p.id
       LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.id = $1 FOR UPDATE`, [req.params.id]);
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sale not found' }); }
    if (cur.company_id !== req.user.company_id && req.user.role !== 'admin') {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Out of scope' });
    }
    if (cur.payment_status === 'paid') {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already paid' });
    }
    const total = parseFloat(cur.quantity) * parseFloat(cur.price || 0);
    const already = parseFloat(cur.paid_amount || 0);
    const remaining = total - already;
    if (amt > remaining + 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount > remaining (${remaining})` });
    }
    const newPaid = already + amt;
    const newStatus = newPaid >= total - 0.01 ? 'paid' : 'partial';
    // Record the payment row
    await client.query(
      'INSERT INTO debt_payments (outcome_id, amount, payment_method, received_by, note) VALUES ($1,$2,$3,$4,$5)',
      [cur.id, amt, pmethod, req.user.id, note || null]
    );
    // Update outcome
    await client.query(
      'UPDATE stock_outcome SET paid_amount=$1, payment_status=$2 WHERE id=$3',
      [newPaid, newStatus, cur.id]
    );
    // Create cash_income for this payment
    const desc = `Погашение долга${cur.customer_name ? ' ('+cur.customer_name+')' : ''}: #${cur.id}`;
    await client.query(
      'INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method) VALUES ($1,$2,$3,$4,$5,TRUE,$6)',
      [amt, desc, req.user.id, cur.branch_id, cur.id, pmethod]
    );
    await client.query('COMMIT');
    res.json({ ok: true, paid_amount: newPaid, payment_status: newStatus });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// === SELLER EDIT REQUESTS ===
// Seller submits a request to change quantity/price/note on one of their own approved sales.
// Cashier (or manager/admin) reviews and approves/rejects. On approve, the change is applied
// transactionally (incl. stock delta + cash_income sync).
app.post('/api/stock/outcome/:id/edit-request', auth(['seller']), async (req, res) => {
  try {
    const { new_quantity, new_price, new_note, reason } = req.body;
    const { rows: [cur] } = await pool.query('SELECT * FROM stock_outcome WHERE id=$1', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Sale not found' });
    if (cur.created_by !== req.user.id) return res.status(403).json({ error: 'Not your sale' });
    // Block if there's already a pending request for this sale
    const pending = await pool.query("SELECT id FROM sale_edit_requests WHERE outcome_id=$1 AND status='pending'", [cur.id]);
    if (pending.rows.length) return res.status(409).json({ error: 'Уже есть ожидающий запрос на изменение этой продажи' });
    const newQty = new_quantity != null ? parseFloat(new_quantity) : parseFloat(cur.quantity);
    const newPrice = new_price != null ? parseFloat(new_price) : parseFloat(cur.price);
    const newNote = new_note != null ? new_note : cur.note;
    if (!Number.isFinite(newQty) || newQty <= 0) return res.status(400).json({ error: 'quantity must be > 0' });
    if (!Number.isFinite(newPrice) || newPrice < 0) return res.status(400).json({ error: 'price >= 0' });
    const { rows } = await pool.query(
      `INSERT INTO sale_edit_requests (outcome_id, requested_by, old_quantity, old_price, old_note, new_quantity, new_price, new_note, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [cur.id, req.user.id, cur.quantity, cur.price, cur.note, newQty, newPrice, newNote, reason || null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List edit requests — cashier/manager/admin see PENDING in their branch (with seller info).
// Seller sees their own requests (all statuses).
app.get('/api/stock/outcome/edit-requests', auth(), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    const params = [];
    let where = '1=1';
    if (req.user.role === 'seller') {
      params.push(req.user.id);
      where = `er.requested_by = $${params.length}`;
    } else {
      // Pending only for reviewers, scoped to branch
      where = `er.status = 'pending'`;
      if (branchId) { params.push(branchId); where += ` AND so.branch_id = $${params.length}`; }
    }
    const { rows } = await pool.query(`
      SELECT er.*,
             so.branch_id, so.status AS sale_status,
             p.name_ru AS product_name, p.unit,
             u.username AS seller_username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''), u.username) AS seller_name
      FROM sale_edit_requests er
      JOIN stock_outcome so ON er.outcome_id = so.id
      JOIN products p ON so.product_id = p.id
      JOIN users u ON er.requested_by = u.id
      WHERE ${where}
      ORDER BY er.created_at DESC LIMIT 200
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cashier/manager/admin approves a pending edit request → apply changes
app.post('/api/stock/outcome/edit-requests/:id/approve', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [er] } = await client.query('SELECT * FROM sale_edit_requests WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!er) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (er.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already reviewed' }); }
    const { rows: [cur] } = await client.query('SELECT * FROM stock_outcome WHERE id=$1 FOR UPDATE', [er.outcome_id]);
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sale gone' }); }

    // Apply changes: if approved sale and quantity changed → adjust stock by delta
    const newQty = parseFloat(er.new_quantity);
    const newPrice = parseFloat(er.new_price);
    if (cur.status === 'approved' && newQty !== parseFloat(cur.quantity)) {
      const delta = newQty - parseFloat(cur.quantity); // positive = take more from stock
      await client.query(
        'UPDATE product_stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3',
        [delta, cur.product_id, cur.branch_id]
      );
    }
    await client.query(
      'UPDATE stock_outcome SET quantity=$1, price=$2, note=$3 WHERE id=$4',
      [newQty, newPrice, er.new_note, cur.id]
    );
    // Re-sync linked cash_income for approved sales
    if (cur.status === 'approved') {
      const newAmount = newQty * newPrice;
      await client.query('DELETE FROM cash_income WHERE outcome_id=$1', [cur.id]);
      if (newAmount > 0) {
        const prod = await client.query('SELECT name_ru FROM products WHERE id=$1', [cur.product_id]);
        const desc = `Продажа: ${prod.rows[0]?.name_ru || ''} × ${newQty}`;
        const sellerRoleQ = await client.query('SELECT role FROM users WHERE id=$1', [cur.created_by]);
        const isSettled = sellerRoleQ.rows[0]?.role !== 'seller';
        await client.query(
          'INSERT INTO cash_income (amount, description, created_by, branch_id, outcome_id, is_settled, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [newAmount, desc, cur.created_by, cur.branch_id, cur.id, isSettled, cur.payment_method || 'cash']
        );
      }
    }
    await client.query(
      "UPDATE sale_edit_requests SET status='approved', reviewed_by=$1, reviewed_at=NOW(), review_note=$2 WHERE id=$3",
      [req.user.id, req.body.review_note || null, er.id]
    );
    audit(req, 'approve', 'edit_request', er.id, { old: { qty: cur.quantity, price: cur.price } }, { new: { qty: newQty, price: newPrice } });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.post('/api/stock/outcome/edit-requests/:id/reject', auth(['admin', 'gen_dir', 'founder', 'manager', 'cashier', 'warehouse']), async (req, res) => {
  try {
    const { rows: [er] } = await pool.query('SELECT * FROM sale_edit_requests WHERE id=$1', [req.params.id]);
    if (!er) return res.status(404).json({ error: 'Request not found' });
    if (er.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });
    await pool.query(
      "UPDATE sale_edit_requests SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), review_note=$2 WHERE id=$3",
      [req.user.id, req.body.review_note || null, er.id]
    );
    audit(req, 'reject', 'edit_request', er.id, null, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === SHIFTS ===
// Cashier / manager can open and close shifts at their branch.
// One open shift per branch at a time (enforced by partial unique index).
app.post('/api/shifts/open', auth(['cashier', 'manager', 'admin']), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.body);
    if (!branchId) return res.status(400).json({ error: 'Branch is required' });
    const openingCash = parseFloat(req.body.opening_cash) || 0;
    const { rows } = await pool.query(
      `INSERT INTO shifts (branch_id, opened_by, opening_cash, status)
       VALUES ($1, $2, $3, 'open') RETURNING *`,
      [branchId, req.user.id, openingCash]
    );
    audit(req, 'open', 'shift', rows[0].id, null, { opening_cash: openingCash });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Смена уже открыта в этом филиале' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/shifts/current', auth(), async (req, res) => {
  try {
    const branchId = getBranchFilter(req.user, req.query);
    if (!branchId) return res.json(null);
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS opened_by_name
       FROM shifts s LEFT JOIN users u ON s.opened_by = u.id
       WHERE s.branch_id = $1 AND s.status = 'open' LIMIT 1`,
      [branchId]
    );
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Z-report for a specific shift (or for the OPEN shift if id='current')
app.get('/api/shifts/:id/zreport', auth(), async (req, res) => {
  try {
    let shift;
    if (req.params.id === 'current') {
      const branchId = getBranchFilter(req.user, req.query);
      const r = await pool.query("SELECT * FROM shifts WHERE branch_id=$1 AND status='open' LIMIT 1", [branchId]);
      shift = r.rows[0];
    } else {
      const r = await pool.query('SELECT * FROM shifts WHERE id=$1', [req.params.id]);
      shift = r.rows[0];
    }
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const start = shift.opened_at;
    const end = shift.closed_at || new Date();
    const params = [shift.branch_id, start, end];

    // Income breakdown by payment_method (only the actual cash flow)
    const incomeRows = await pool.query(`
      SELECT COALESCE(payment_method, 'cash') AS method, COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0) AS total
      FROM cash_income WHERE branch_id=$1 AND created_at >= $2 AND created_at < $3
      GROUP BY 1 ORDER BY 1
    `, params);
    const expenseRows = await pool.query(`
      SELECT COALESCE(payment_method, 'cash') AS method, COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0) AS total
      FROM cash_expense WHERE branch_id=$1 AND created_at >= $2 AND created_at < $3
      GROUP BY 1 ORDER BY 1
    `, params);
    // Sales: count + revenue + profit
    const sales = await pool.query(`
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue,
             COALESCE(SUM(so.quantity * p.price_buy), 0) AS cost
      FROM stock_outcome so JOIN products p ON so.product_id = p.id
      WHERE so.branch_id = $1 AND so.status = 'approved'
        AND so.created_at >= $2 AND so.created_at < $3
    `, params);
    const sellers = await pool.query(`
      SELECT u.id, u.username,
             COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''), u.username) AS name,
             COUNT(so.id)::int AS sales_count,
             COALESCE(SUM(so.quantity * so.price), 0) AS revenue
      FROM stock_outcome so JOIN users u ON so.created_by = u.id
      WHERE so.branch_id = $1 AND so.status = 'approved'
        AND so.created_at >= $2 AND so.created_at < $3
      GROUP BY u.id, u.username, u.first_name, u.last_name
      ORDER BY revenue DESC
    `, params);

    const cashIn  = (incomeRows.rows.find(r => r.method === 'cash')?.total) || 0;
    const cashOut = (expenseRows.rows.find(r => r.method === 'cash')?.total) || 0;
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(cashIn) - parseFloat(cashOut);

    res.json({
      shift,
      period: { from: start, to: end },
      income_by_method: incomeRows.rows,
      expense_by_method: expenseRows.rows,
      sales: sales.rows[0],
      sellers: sellers.rows,
      opening_cash: parseFloat(shift.opening_cash || 0),
      expected_cash: expectedCash,
      cash_in: parseFloat(cashIn),
      cash_out: parseFloat(cashOut),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shifts/:id/close', auth(['cashier', 'manager', 'admin']), async (req, res) => {
  try {
    const { actual_cash, note } = req.body;
    const actual = parseFloat(actual_cash);
    const { rows: [shift] } = await pool.query('SELECT * FROM shifts WHERE id=$1', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status === 'closed') return res.status(400).json({ error: 'Shift already closed' });
    // Compute expected cash
    const inR  = await pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_income  WHERE branch_id=$1 AND created_at >= $2 AND payment_method='cash'`, [shift.branch_id, shift.opened_at]);
    const outR = await pool.query(`SELECT COALESCE(SUM(amount),0) t FROM cash_expense WHERE branch_id=$1 AND created_at >= $2 AND payment_method='cash'`, [shift.branch_id, shift.opened_at]);
    const expected = parseFloat(shift.opening_cash) + parseFloat(inR.rows[0].t) - parseFloat(outR.rows[0].t);
    const disc = Number.isFinite(actual) ? actual - expected : null;
    const { rows } = await pool.query(
      `UPDATE shifts SET status='closed', closed_at=NOW(), closed_by=$1,
                         actual_cash=$2, expected_cash=$3, discrepancy=$4, note=$5
       WHERE id=$6 RETURNING *`,
      [req.user.id, Number.isFinite(actual) ? actual : null, expected, disc, note || null, shift.id]
    );
    audit(req, 'close', 'shift', shift.id, { opening_cash: shift.opening_cash }, { actual_cash: actual, expected, discrepancy: disc });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === AUDIT LOG view (admin / company management) ===
app.get('/api/audit-log', auth(['admin', 'gen_dir', 'founder']), async (req, res) => {
  try {
    const { entity_type, action, limit } = req.query;
    const params = [];
    const conds = [];
    if (entity_type) { params.push(entity_type); conds.push(`entity_type = $${params.length}`); }
    if (action)      { params.push(action);      conds.push(`action      = $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const lim = Math.min(parseInt(limit) || 200, 1000);
    const { rows } = await pool.query(`
      SELECT * FROM audit_log ${where}
      ORDER BY created_at DESC
      LIMIT ${lim}
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ADMIN SAAS DASHBOARD — meta-level view across all client companies ===
// Only admin sees this. Returns: list of companies + KPIs + health indicator + system totals.
app.get('/api/admin/dashboard', auth(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const periodParams = [];
    let periodSQL = '';
    if (from) { periodParams.push(from); periodSQL += ` AND so.created_at >= $${periodParams.length}`; }
    if (to)   { periodParams.push(to);   periodSQL += ` AND so.created_at <  $${periodParams.length}`; }

    const companiesQ = await pool.query(`
      SELECT c.id, c.name, c.created_at,
             (SELECT COUNT(*) FROM branches b WHERE b.company_id = c.id) AS branches_count,
             (SELECT COUNT(*) FROM users u   WHERE u.company_id = c.id AND COALESCE(u.is_blocked, false) = false) AS users_count,
             (SELECT MAX(u.last_login_at) FROM users u WHERE u.company_id = c.id) AS last_login_at
      FROM companies c
      ORDER BY c.id
    `);

    const enriched = await Promise.all(companiesQ.rows.map(async (c) => {
      const branchIdsR = await pool.query('SELECT id FROM branches WHERE company_id = $1', [c.id]);
      const branchIds = branchIdsR.rows.map(r => r.id);
      if (branchIds.length === 0) {
        return { ...c, sales_revenue: 0, gross_profit: 0, deals_count: 0, cash_balance: 0, health: scoreHealth(c.last_login_at, 0) };
      }
      const idList = `(${branchIds.join(',')})`;
      const [salesQ, cashIQ, cashEQ] = await Promise.all([
        pool.query(`
          SELECT COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                 COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) AS cost,
                 COUNT(*) AS deals
          FROM stock_outcome so JOIN products p ON p.id = so.product_id
          WHERE so.status='approved' AND so.branch_id IN ${idList} ${periodSQL}`,
          periodParams),
        pool.query(`SELECT COALESCE(SUM(amount),0) AS t FROM cash_income  WHERE branch_id IN ${idList} AND is_settled IS NOT FALSE`),
        pool.query(`SELECT COALESCE(SUM(amount),0) AS t FROM cash_expense WHERE branch_id IN ${idList}`),
      ]);
      const rev = parseFloat(salesQ.rows[0].revenue) || 0;
      const cost = parseFloat(salesQ.rows[0].cost) || 0;
      const deals = parseInt(salesQ.rows[0].deals) || 0;
      const ci = parseFloat(cashIQ.rows[0].t) || 0;
      const ce = parseFloat(cashEQ.rows[0].t) || 0;
      return {
        ...c,
        sales_revenue: rev,
        gross_profit: rev - cost,
        margin_pct: rev > 0 ? Math.round(((rev - cost) / rev) * 1000) / 10 : 0,
        deals_count: deals,
        cash_balance: ci - ce,
        health: scoreHealth(c.last_login_at, deals),
      };
    }));

    // System-wide totals
    const sysTotals = enriched.reduce((acc, c) => ({
      sales_revenue: acc.sales_revenue + c.sales_revenue,
      gross_profit:  acc.gross_profit + c.gross_profit,
      deals_count:   acc.deals_count + c.deals_count,
      cash_balance:  acc.cash_balance + c.cash_balance,
      users_count:   acc.users_count + parseInt(c.users_count || 0),
      branches_count: acc.branches_count + parseInt(c.branches_count || 0),
    }), { sales_revenue: 0, gross_profit: 0, deals_count: 0, cash_balance: 0, users_count: 0, branches_count: 0 });

    const summary = {
      total_companies: enriched.length,
      active_30d: enriched.filter(c => c.health.status !== 'inactive').length,
      at_risk: enriched.filter(c => c.health.status === 'risk' || c.health.status === 'inactive').length,
      new_this_month: enriched.filter(c => {
        const ageDays = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
        return ageDays <= 30;
      }).length,
    };

    res.json({ companies: enriched, totals: sysTotals, summary });
  } catch (e) {
    console.error('admin/dashboard err', e);
    res.status(500).json({ error: e.message });
  }
});

function scoreHealth(lastLoginAt, dealsCount) {
  if (!lastLoginAt) return { status: 'inactive', label: 'Не активна', tone: 'red', days_since: null };
  const days = Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / 86400000);
  if (days >= 30) return { status: 'inactive', label: 'Не активна 30+ дн', tone: 'red', days_since: days };
  if (days >= 7 || dealsCount === 0) return { status: 'risk', label: 'В риске', tone: 'yellow', days_since: days };
  return { status: 'healthy', label: 'Активна', tone: 'green', days_since: days };
}

// === ADMIN — drill-down per company ===
app.get('/api/admin/companies/:id', auth(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });

    const cQ = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (!cQ.rows[0]) return res.status(404).json({ error: 'Company not found' });

    const [branchesQ, usersQ] = await Promise.all([
      pool.query('SELECT id, name FROM branches WHERE company_id = $1 ORDER BY id', [id]),
      pool.query(`
        SELECT id, username, role, first_name, last_name, branch_id, last_login_at, is_blocked
        FROM users WHERE company_id = $1
        ORDER BY role, username
      `, [id]),
    ]);
    const branchIds = branchesQ.rows.map(r => r.id);
    let kpi = { sales_revenue: 0, deals_count: 0, cash_balance: 0, stock_value: 0 };
    if (branchIds.length > 0) {
      const list = `(${branchIds.join(',')})`;
      const r1 = await pool.query(`
        SELECT COALESCE(SUM(so.quantity*so.price),0) AS rev,
               COUNT(*) AS deals
        FROM stock_outcome so WHERE so.status='approved' AND so.branch_id IN ${list}`);
      const r2 = await pool.query(`SELECT COALESCE(SUM(amount),0) AS t FROM cash_income  WHERE branch_id IN ${list} AND is_settled IS NOT FALSE`);
      const r3 = await pool.query(`SELECT COALESCE(SUM(amount),0) AS t FROM cash_expense WHERE branch_id IN ${list}`);
      const r4 = await pool.query(`
        SELECT COALESCE(SUM(ps.quantity * COALESCE(p.price_sell,0)),0) AS v
        FROM product_stock ps JOIN products p ON p.id = ps.product_id
        WHERE ps.branch_id IN ${list}`);
      kpi = {
        sales_revenue: parseFloat(r1.rows[0].rev) || 0,
        deals_count: parseInt(r1.rows[0].deals) || 0,
        cash_balance: (parseFloat(r2.rows[0].t) || 0) - (parseFloat(r3.rows[0].t) || 0),
        stock_value: parseFloat(r4.rows[0].v) || 0,
      };
    }
    res.json({
      company: cQ.rows[0],
      branches: branchesQ.rows,
      users: usersQ.rows,
      kpi,
    });
  } catch (e) {
    console.error('admin/company err', e);
    res.status(500).json({ error: e.message });
  }
});

// === FEATURE FLAGS ===
const FEATURE_CATALOG = [
  { key: 'multi-branch-dashboard', label: 'Multi-branch dashboard',  tier: 'basic',  desc: 'Сводка по всем филиалам' },
  { key: 'ai-advisor',             label: 'AI-консультант',           tier: 'pro',    desc: 'Чат-бот + советы' },
  { key: 'segmentation',           label: 'Сегментация клиентов',     tier: 'pro',    desc: 'VIP / спящие / ушли' },
  { key: 'abc-xyz',                label: 'ABC/XYZ анализ',           tier: 'pro',    desc: 'Точка заказа, мёртвый товар' },
  { key: 'pricing',                label: 'Pricing analyzer',         tier: 'pro',    desc: 'Маржа по товарам' },
  { key: 'risk-control',           label: 'Risk Control',             tier: 'pro',    desc: 'Единая лента алертов' },
  { key: 'loyalty',                label: 'Программа лояльности',     tier: 'enterprise', desc: 'Tier-кэшбек' },
  { key: 'nps',                    label: 'NPS опросы',               tier: 'enterprise', desc: 'Авто-опросы покупателей' },
  { key: 'b2b-pipeline',           label: 'B2B Kanban',               tier: 'enterprise', desc: 'Sales-pipeline' },
  { key: 'whatif-modeling',        label: 'What-If модель',           tier: 'enterprise', desc: 'Симулятор цен/скидок' },
  { key: 'marketing-roi',          label: 'Marketing ROI',            tier: 'enterprise', desc: 'CPL × LTV по каналам' },
];

app.get('/api/admin/features/catalog', auth(['admin']), (req, res) => {
  res.json(FEATURE_CATALOG);
});

app.get('/api/admin/features', auth(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cf.company_id, cf.feature_key, cf.enabled, cf.plan_tier, cf.enabled_at, cf.enabled_by,
             c.name AS company_name, u.username AS enabled_by_username
      FROM company_features cf
      JOIN companies c ON c.id = cf.company_id
      LEFT JOIN users u ON u.id = cf.enabled_by
      ORDER BY c.id, cf.feature_key
    `);
    res.json(rows);
  } catch (e) {
    console.error('admin/features list err', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/features/toggle', auth(['admin']), async (req, res) => {
  try {
    const { company_id, feature_key, enabled } = req.body;
    if (!company_id || !feature_key || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'company_id, feature_key, enabled required' });
    }
    if (!FEATURE_CATALOG.find(f => f.key === feature_key)) {
      return res.status(400).json({ error: 'Unknown feature_key' });
    }
    const tier = (FEATURE_CATALOG.find(f => f.key === feature_key) || {}).tier || 'basic';
    await pool.query(`
      INSERT INTO company_features (company_id, feature_key, enabled, plan_tier, enabled_at, enabled_by)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (company_id, feature_key)
      DO UPDATE SET enabled = EXCLUDED.enabled, plan_tier = EXCLUDED.plan_tier,
                    enabled_at = NOW(), enabled_by = EXCLUDED.enabled_by
    `, [company_id, feature_key, enabled, tier, req.user.id]);
    audit(req, enabled ? 'feature_on' : 'feature_off', 'company_feature', company_id, null, { feature_key, enabled });
    res.json({ ok: true });
  } catch (e) {
    console.error('admin/features toggle err', e);
    res.status(500).json({ error: e.message });
  }
});

// Get feature keys enabled for current user's company. Used by frontend FeaturesContext.
app.get('/api/me/features', auth(), async (req, res) => {
  try {
    if (!req.user.company_id) return res.json({ keys: [] });
    const { rows } = await pool.query(
      'SELECT feature_key FROM company_features WHERE company_id = $1 AND enabled = true',
      [req.user.company_id]
    );
    res.json({ keys: rows.map(r => r.feature_key) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === MARKETING: Personas (JTBD / avatars / pains) ===
const MKT_ROLES = ['admin','founder','gen_dir','manager'];

app.get('/api/marketing/personas', auth(MKT_ROLES), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.username AS created_by_username
       FROM marketing_personas p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.company_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/marketing/personas', auth(MKT_ROLES), async (req, res) => {
  try {
    const { name, age_range, gender, jtbd, pains, objections, channels, budget, notes } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
    const { rows } = await pool.query(
      `INSERT INTO marketing_personas
         (company_id, name, age_range, gender, jtbd, pains, objections, channels, budget, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.company_id, name.trim(), age_range || null, gender || null, jtbd || null,
       pains || null, objections || null, channels || null, budget || null, notes || null, req.user.id]
    );
    audit(req, 'create', 'marketing_persona', rows[0].id, null, rows[0]);
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/marketing/personas/:id', auth(MKT_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { name, age_range, gender, jtbd, pains, objections, channels, budget, notes } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE marketing_personas
         SET name = COALESCE($1, name),
             age_range = $2, gender = $3, jtbd = $4, pains = $5, objections = $6,
             channels = $7, budget = $8, notes = $9, updated_at = NOW()
       WHERE id = $10 AND company_id = $11
       RETURNING *`,
      [name?.trim() || null, age_range || null, gender || null, jtbd || null, pains || null,
       objections || null, channels || null, budget || null, notes || null, id, req.user.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    audit(req, 'update', 'marketing_persona', id, null, rows[0]);
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/marketing/personas/:id', auth(MKT_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query(
      'DELETE FROM marketing_personas WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    audit(req, 'delete', 'marketing_persona', id, null, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === MARKETING: Content plan ===
app.get('/api/marketing/content', auth(MKT_ROLES), async (req, res) => {
  try {
    const { from, to, status, platform } = req.query;
    const params = [req.user.company_id];
    const conds = ['c.company_id = $1'];
    if (from)     { params.push(from);     conds.push(`c.scheduled_for >= $${params.length}`); }
    if (to)       { params.push(to);       conds.push(`c.scheduled_for <= $${params.length}`); }
    if (status)   { params.push(status);   conds.push(`c.status = $${params.length}`); }
    if (platform) { params.push(platform); conds.push(`c.platform = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT c.*, p.name AS persona_name, u.username AS created_by_username
       FROM marketing_content c
       LEFT JOIN marketing_personas p ON p.id = c.persona_id
       LEFT JOIN users u ON u.id = c.created_by
       WHERE ${conds.join(' AND ')}
       ORDER BY c.scheduled_for DESC NULLS LAST, c.created_at DESC
       LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/marketing/content', auth(MKT_ROLES), async (req, res) => {
  try {
    const { title, platform, format, scheduled_for, status, persona_id, hook, body, cta, notes,
            funnel_stage, reference_link, plan_views, plan_likes, plan_comments,
            fact_views, fact_likes, fact_comments, analysis } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    const allowedPlatform = ['instagram','telegram','tiktok','youtube','facebook','email','sms','website','other'];
    const allowedFormat = ['post','reels','story','video','photo','carousel','article','email','sms','live','other'];
    const allowedStatus = ['planned','in_progress','published','cancelled'];
    const plat = allowedPlatform.includes(platform) ? platform : 'instagram';
    const fmt  = allowedFormat.includes(format) ? format : 'post';
    const st   = allowedStatus.includes(status) ? status : 'planned';
    const stage = ['tofu','mofu','bofu'].includes(funnel_stage) ? funnel_stage : null;
    const numOrNull = (v) => (v === '' || v == null || isNaN(parseInt(v))) ? null : parseInt(v);
    const pid  = persona_id ? parseInt(persona_id, 10) : null;
    if (pid != null) {
      const o = await pool.query('SELECT company_id FROM marketing_personas WHERE id = $1', [pid]);
      if (!o.rows[0] || o.rows[0].company_id !== req.user.company_id) {
        return res.status(400).json({ error: 'persona out of scope' });
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO marketing_content
         (company_id, title, platform, format, scheduled_for, status, persona_id, hook, body, cta, notes, created_by,
          funnel_stage, reference_link, plan_views, plan_likes, plan_comments, fact_views, fact_likes, fact_comments, analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [req.user.company_id, title.trim(), plat, fmt, scheduled_for || null, st, pid,
       hook || null, body || null, cta || null, notes || null, req.user.id,
       stage, reference_link || null, numOrNull(plan_views), numOrNull(plan_likes), numOrNull(plan_comments),
       numOrNull(fact_views), numOrNull(fact_likes), numOrNull(fact_comments), analysis || null]
    );
    audit(req, 'create', 'marketing_content', rows[0].id, null, rows[0]);
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/marketing/content/:id', auth(MKT_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad id' });
    const { title, platform, format, scheduled_for, status, persona_id, hook, body, cta, notes,
            funnel_stage, reference_link, plan_views, plan_likes, plan_comments,
            fact_views, fact_likes, fact_comments, analysis } = req.body || {};
    const pid = persona_id === null ? null : persona_id ? parseInt(persona_id, 10) : null;
    const stage = ['tofu','mofu','bofu'].includes(funnel_stage) ? funnel_stage : null;
    const numOrNull = (v) => (v === '' || v == null || isNaN(parseInt(v))) ? null : parseInt(v);
    const { rows } = await pool.query(
      `UPDATE marketing_content
         SET title = COALESCE($1, title),
             platform = COALESCE($2, platform),
             format   = COALESCE($3, format),
             scheduled_for = $4,
             status   = COALESCE($5, status),
             persona_id = $6,
             hook = $7, body = $8, cta = $9, notes = $10,
             funnel_stage = $13, reference_link = $14,
             plan_views = $15, plan_likes = $16, plan_comments = $17,
             fact_views = $18, fact_likes = $19, fact_comments = $20, analysis = $21,
             updated_at = NOW()
       WHERE id = $11 AND company_id = $12 RETURNING *`,
      [title?.trim() || null, platform || null, format || null, scheduled_for || null,
       status || null, pid, hook || null, body || null, cta || null, notes || null,
       id, req.user.company_id,
       stage, reference_link || null, numOrNull(plan_views), numOrNull(plan_likes), numOrNull(plan_comments),
       numOrNull(fact_views), numOrNull(fact_likes), numOrNull(fact_comments), analysis || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    audit(req, 'update', 'marketing_content', id, null, rows[0]);
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/marketing/content/:id', auth(MKT_ROLES), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query(
      'DELETE FROM marketing_content WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    audit(req, 'delete', 'marketing_content', id, null, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === LTV (ценность клиента) — на реальных продажах, company/branch-scoped ===
app.get('/api/marketing/ltv', auth(MKT_ROLES), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const branchId = getBranchFilter(req.user, req.query);
    const params = [companyId];
    let branchSQL = '';
    if (branchId) { params.push(branchId); branchSQL = `AND so.branch_id = $${params.length}`; }
    const { rows } = await pool.query(`
      WITH agg AS (
        SELECT c.id, c.name, c.phone,
               COUNT(so.id) FILTER (WHERE so.status='approved') AS orders,
               COALESCE(SUM(so.quantity*so.price) FILTER (WHERE so.status='approved'), 0) AS revenue,
               MAX(so.created_at) FILTER (WHERE so.status='approved') AS last_at,
               EXTRACT(DAY FROM NOW() - MAX(so.created_at) FILTER (WHERE so.status='approved')) AS days_since
        FROM customers c
        LEFT JOIN stock_outcome so ON so.customer_id = c.id ${branchSQL}
        WHERE c.company_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, c.name, c.phone
      )
      SELECT id, name, phone, orders::int, revenue::numeric, last_at,
             COALESCE(days_since,0)::int AS days_since,
             CASE
               WHEN orders = 0 THEN 'new'
               WHEN days_since >= 120 THEN 'lost'
               WHEN days_since >= 60 THEN 'sleeping'
               WHEN revenue >= 5000000 THEN 'vip'
               ELSE 'regular'
             END AS segment
      FROM agg ORDER BY revenue DESC NULLS LAST`, params);

    const buyers = rows.filter(r => r.orders > 0);
    const totalRevenue = buyers.reduce((a, r) => a + parseFloat(r.revenue), 0);
    const totalOrders = buyers.reduce((a, r) => a + r.orders, 0);
    const repeatBuyers = buyers.filter(r => r.orders >= 2).length;
    const ltvs = buyers.map(r => parseFloat(r.revenue)).sort((a, b) => a - b);
    const median = ltvs.length ? (ltvs.length % 2 ? ltvs[(ltvs.length - 1) / 2] : (ltvs[ltvs.length / 2 - 1] + ltvs[ltvs.length / 2]) / 2) : 0;

    const segMap = {};
    for (const r of rows) {
      const s = r.segment;
      if (!segMap[s]) segMap[s] = { count: 0, revenue: 0 };
      segMap[s].count++; segMap[s].revenue += parseFloat(r.revenue);
    }
    const by_segment = Object.entries(segMap).map(([segment, v]) => ({
      segment, count: v.count, avg_ltv: v.count ? Math.round(v.revenue / v.count) : 0, total: v.revenue,
    }));

    res.json({
      customers_total: rows.length,
      buyers_count: buyers.length,
      avg_ltv: buyers.length ? Math.round(totalRevenue / buyers.length) : 0,
      median_ltv: Math.round(median),
      avg_orders: buyers.length ? Math.round((totalOrders / buyers.length) * 10) / 10 : 0,
      avg_order_value: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
      repeat_rate: buyers.length ? Math.round((repeatBuyers / buyers.length) * 100) : 0,
      by_segment,
      top_customers: buyers.slice(0, 15).map(r => ({
        id: r.id, name: r.name, phone: r.phone, orders: r.orders,
        ltv: parseFloat(r.revenue), last_at: r.last_at, segment: r.segment,
      })),
    });
  } catch (e) { console.error('marketing/ltv err', e); res.status(500).json({ error: e.message }); }
});

// === AI CHAT — DeepSeek proxy ===
// Token loaded from env (DEEPSEEK_API_KEY). Owner roles only. Logs usage to ai_chat_log.
// Backend acts as proxy so the key never reaches the browser.
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const AI_ROLES = ['admin','founder','gen_dir'];

function fmtUZS(v) {
  const n = parseFloat(v) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return Math.round(n).toString();
}

// Fetch a snapshot of the user's company business state — gets injected into the AI's system prompt
// so the assistant can reason with REAL numbers instead of saying "I don't have access".
//
// SCOPE STRICTNESS:
//   - All queries filtered by user.company_id (directly OR through branchIds derived from
//     `branches WHERE company_id = user.company_id`).
//   - Manager: only their own branch_id appears in branchIds.
//   - AI receives ONLY this company's data. There is no path to another company's rows.
//
// PERIOD STRATEGY:
//   - Lifetime totals: revenue, profit, deals across ALL history of the company.
//   - Current 30d vs previous 30d for delta% (so AI can say "growing/shrinking").
//   - Last 24 months as monthly buckets (full history overview without flooding tokens).
//   - All-time top products + top sellers.
async function getCompanyContextForAI(user) {
  if (!user.company_id) return '';
  try {
    const isManager = user.role === 'manager';
    let branchIds;
    if (isManager) {
      branchIds = user.branch_id ? [user.branch_id] : [];
    } else {
      const br = await pool.query('SELECT id FROM branches WHERE company_id = $1', [user.company_id]);
      branchIds = br.rows.map(r => r.id);
    }
    if (branchIds.length === 0) return '';

    const now = new Date();
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
    const prevMonthAgo = new Date(monthAgo); prevMonthAgo.setDate(prevMonthAgo.getDate() - 30);
    const twoYearsAgo = new Date(now); twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);

    const [
      branchesQ,
      lifetimeQ,
      salesNowQ, salesPrevQ,
      cashIQ, cashEQ,
      stockQ, lowStockQ,
      custQ, custNewQ, custLifetimeQ,
      supQ,
      debtsClientQ, debtsSupQ,
      pendingQ,
      topProdAllQ, topProdNowQ,
      topSellAllQ,
      perBranchLifetimeQ, perBranchNowQ,
      monthlyTrendQ,
      productsCountQ,
    ] = await Promise.all([
      pool.query('SELECT id, name FROM branches WHERE id = ANY($1::int[])', [branchIds]),
      pool.query(
        `SELECT COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) AS cost,
                COUNT(*) AS deals,
                MIN(so.created_at) AS first_sale,
                MAX(so.created_at) AS last_sale
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2`,
        [branchIds, user.company_id]
      ),
      pool.query(
        `SELECT COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) AS cost,
                COUNT(*) AS deals
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[])
           AND p.company_id = $4 AND so.created_at >= $2 AND so.created_at < $3`,
        [branchIds, monthAgo.toISOString(), now.toISOString(), user.company_id]
      ),
      pool.query(
        `SELECT COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COALESCE(SUM(so.quantity*COALESCE(p.price_buy,0)),0) AS cost,
                COUNT(*) AS deals
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[])
           AND p.company_id = $4 AND so.created_at >= $2 AND so.created_at < $3`,
        [branchIds, prevMonthAgo.toISOString(), monthAgo.toISOString(), user.company_id]
      ),
      pool.query('SELECT COALESCE(SUM(amount),0) AS t FROM cash_income WHERE branch_id = ANY($1::int[]) AND is_settled IS NOT FALSE', [branchIds]),
      pool.query('SELECT COALESCE(SUM(amount),0) AS t FROM cash_expense WHERE branch_id = ANY($1::int[])', [branchIds]),
      pool.query(
        `SELECT COALESCE(SUM(ps.quantity * COALESCE(p.price_sell,0)),0) AS value,
                COUNT(*) AS sku
         FROM product_stock ps JOIN products p ON p.id = ps.product_id
         WHERE ps.branch_id = ANY($1::int[]) AND p.company_id = $2`,
        [branchIds, user.company_id]
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM product_stock ps JOIN products p ON p.id = ps.product_id
         WHERE ps.branch_id = ANY($1::int[]) AND p.company_id = $2 AND ps.quantity < 5`,
        [branchIds, user.company_id]
      ),
      pool.query('SELECT COUNT(*) AS c FROM customers WHERE company_id = $1 AND deleted_at IS NULL', [user.company_id]),
      pool.query(
        `SELECT COUNT(*) AS c FROM customers WHERE company_id = $1 AND deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days'`,
        [user.company_id]
      ),
      pool.query(
        `SELECT COALESCE(SUM(so.quantity*so.price),0) AS total_spent
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND p.company_id = $1 AND so.customer_id IS NOT NULL`,
        [user.company_id]
      ),
      pool.query('SELECT COUNT(*) AS c FROM suppliers WHERE company_id = $1', [user.company_id]),
      pool.query(
        `SELECT COALESCE(SUM((so.quantity*so.price) - COALESCE(so.paid_amount,0)),0) AS amt, COUNT(*) AS cnt
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE p.company_id = $1 AND so.payment_status <> 'paid' AND so.status='approved'
           AND so.branch_id = ANY($2::int[])`,
        [user.company_id, branchIds]
      ),
      pool.query(
        `SELECT COALESCE(SUM((si.quantity*si.price) - COALESCE(si.paid_amount,0)),0) AS amt, COUNT(*) AS cnt
         FROM stock_income si JOIN products p ON p.id = si.product_id
         WHERE p.company_id = $1 AND si.payment_status <> 'paid'
           AND si.branch_id = ANY($2::int[])`,
        [user.company_id, branchIds]
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE p.company_id = $1 AND so.status='pending' AND so.branch_id = ANY($2::int[])`,
        [user.company_id, branchIds]
      ),
      pool.query(
        `SELECT p.name_ru AS name,
                COALESCE(SUM(so.quantity),0) AS qty,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
         GROUP BY p.id, p.name_ru ORDER BY revenue DESC LIMIT 10`,
        [branchIds, user.company_id]
      ),
      pool.query(
        `SELECT p.name_ru AS name,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
           AND so.created_at >= $3
         GROUP BY p.id, p.name_ru ORDER BY revenue DESC LIMIT 5`,
        [branchIds, user.company_id, monthAgo.toISOString()]
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',COALESCE(u.last_name,''))), ''), u.username) AS name,
                u.role,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM stock_outcome so
         JOIN users u ON u.id = so.created_by
         JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
         GROUP BY u.id, u.username, u.first_name, u.last_name, u.role
         ORDER BY revenue DESC LIMIT 5`,
        [branchIds, user.company_id]
      ),
      pool.query(
        `SELECT b.name AS branch_name,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM branches b
         LEFT JOIN stock_outcome so ON so.branch_id = b.id AND so.status='approved'
         LEFT JOIN products p ON p.id = so.product_id AND p.company_id = $2
         WHERE b.id = ANY($1::int[])
         GROUP BY b.id, b.name ORDER BY revenue DESC`,
        [branchIds, user.company_id]
      ),
      pool.query(
        `SELECT b.name AS branch_name,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM branches b
         LEFT JOIN stock_outcome so ON so.branch_id = b.id AND so.status='approved' AND so.created_at >= $3
         LEFT JOIN products p ON p.id = so.product_id AND p.company_id = $2
         WHERE b.id = ANY($1::int[])
         GROUP BY b.id, b.name ORDER BY revenue DESC`,
        [branchIds, user.company_id, monthAgo.toISOString()]
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', so.created_at), 'YYYY-MM') AS month,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
           AND so.created_at >= $3
         GROUP BY month ORDER BY month`,
        [branchIds, user.company_id, twoYearsAgo.toISOString()]
      ),
      pool.query('SELECT COUNT(*) AS c FROM products WHERE company_id = $1 AND (deleted_at IS NULL OR deleted_at IS NULL)', [user.company_id]),
    ]);

    const lt = lifetimeQ.rows[0];
    const ltRev = parseFloat(lt.revenue) || 0;
    const ltCost = parseFloat(lt.cost) || 0;
    const ltDeals = parseInt(lt.deals) || 0;
    const ltProfit = ltRev - ltCost;
    const ltMargin = ltRev > 0 ? Math.round((ltProfit / ltRev) * 1000) / 10 : 0;
    const ltAvgCheck = ltDeals > 0 ? Math.round(ltRev / ltDeals) : 0;

    const nowRev = parseFloat(salesNowQ.rows[0].revenue) || 0;
    const nowCost = parseFloat(salesNowQ.rows[0].cost) || 0;
    const nowDeals = parseInt(salesNowQ.rows[0].deals) || 0;
    const nowProfit = nowRev - nowCost;
    const nowMargin = nowRev > 0 ? Math.round((nowProfit / nowRev) * 1000) / 10 : 0;
    const nowAvgCheck = nowDeals > 0 ? Math.round(nowRev / nowDeals) : 0;

    const prevRev = parseFloat(salesPrevQ.rows[0].revenue) || 0;
    const prevDeals = parseInt(salesPrevQ.rows[0].deals) || 0;
    const revDelta = prevRev > 0 ? Math.round(((nowRev - prevRev) / prevRev) * 100) : null;
    const dealsDelta = prevDeals > 0 ? Math.round(((nowDeals - prevDeals) / prevDeals) * 100) : null;

    const cashI = parseFloat(cashIQ.rows[0].t) || 0;
    const cashE = parseFloat(cashEQ.rows[0].t) || 0;

    const lines = [];
    lines.push('');
    lines.push('=== ДАННЫЕ ВАШЕЙ КОМПАНИИ (только она, никакие другие) ===');
    const firstSaleStr = lt.first_sale ? new Date(lt.first_sale).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'нет данных';
    const lastSaleStr = lt.last_sale ? new Date(lt.last_sale).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'нет данных';
    lines.push(`Период всей истории: с ${firstSaleStr} по ${lastSaleStr}.`);
    lines.push(`Филиалов: ${branchesQ.rows.length} (${branchesQ.rows.map(b => b.name).join(', ')}). Товаров в каталоге: ${productsCountQ.rows[0].c}.`);
    lines.push('');
    lines.push('--- ЗА ВСЁ ВРЕМЯ (lifetime) ---');
    lines.push(`Выручка: ${fmtUZS(ltRev)} UZS. Прибыль: ${fmtUZS(ltProfit)} UZS. Маржа: ${ltMargin}%.`);
    lines.push(`Сделок: ${ltDeals}. Средний чек: ${fmtUZS(ltAvgCheck)} UZS.`);
    lines.push(`Касса (всё время): приход ${fmtUZS(cashI)}, расход ${fmtUZS(cashE)}, баланс ${fmtUZS(cashI - cashE)} UZS.`);
    lines.push('');
    lines.push('--- ТЕКУЩИЕ 30 ДНЕЙ vs ПРЕДЫДУЩИЕ 30 ДНЕЙ ---');
    lines.push(`Выручка 30д: ${fmtUZS(nowRev)} UZS${revDelta != null ? ` (${revDelta >= 0 ? '+' : ''}${revDelta}% к прошлым 30д = ${fmtUZS(prevRev)})` : ''}.`);
    lines.push(`Прибыль 30д: ${fmtUZS(nowProfit)} UZS, маржа ${nowMargin}%. Сделок: ${nowDeals}${dealsDelta != null ? ` (${dealsDelta >= 0 ? '+' : ''}${dealsDelta}%)` : ''}. Средний чек: ${fmtUZS(nowAvgCheck)} UZS.`);
    lines.push('');
    lines.push('--- СКЛАД (текущее состояние) ---');
    lines.push(`Стоимость склада: ${fmtUZS(stockQ.rows[0].value)} UZS, ${stockQ.rows[0].sku} SKU. Низкий остаток (<5 шт): ${lowStockQ.rows[0].c}.`);
    lines.push('');
    lines.push('--- КЛИЕНТЫ И ПОСТАВЩИКИ ---');
    lines.push(`Клиентов в базе: ${custQ.rows[0].c} (новых за 30д: ${custNewQ.rows[0].c}). Совокупно потратили: ${fmtUZS(custLifetimeQ.rows[0].total_spent)} UZS.`);
    lines.push(`Поставщиков: ${supQ.rows[0].c}.`);
    if (parseInt(debtsClientQ.rows[0].cnt) > 0) lines.push(`Долги клиентов (нам): ${debtsClientQ.rows[0].cnt} сделок на ${fmtUZS(debtsClientQ.rows[0].amt)} UZS.`);
    if (parseInt(debtsSupQ.rows[0].cnt) > 0)    lines.push(`Долги поставщикам (мы): ${debtsSupQ.rows[0].cnt} приходов на ${fmtUZS(debtsSupQ.rows[0].amt)} UZS.`);
    if (parseInt(pendingQ.rows[0].c) > 0)        lines.push(`Ожидают подтверждения: ${pendingQ.rows[0].c} продаж.`);

    if (perBranchLifetimeQ.rows.length > 1) {
      lines.push('');
      lines.push('--- ФИЛИАЛЫ (всё время) ---');
      for (const b of perBranchLifetimeQ.rows) {
        lines.push(`  ${b.branch_name}: ${fmtUZS(b.revenue)} UZS (${b.deals} сделок).`);
      }
      lines.push('--- ФИЛИАЛЫ (последние 30д) ---');
      for (const b of perBranchNowQ.rows) {
        lines.push(`  ${b.branch_name}: ${fmtUZS(b.revenue)} UZS (${b.deals} сделок).`);
      }
    }

    if (topProdAllQ.rows.length > 0) {
      lines.push('');
      lines.push('--- ТОП-10 ТОВАРОВ (всё время, по выручке) ---');
      topProdAllQ.rows.forEach((p, i) => {
        lines.push(`  ${i + 1}. ${p.name} — ${fmtUZS(p.revenue)} UZS (${parseFloat(p.qty)} шт).`);
      });
    }
    if (topProdNowQ.rows.length > 0) {
      lines.push('--- ТОП-5 ТОВАРОВ (последние 30д) ---');
      topProdNowQ.rows.forEach((p, i) => {
        lines.push(`  ${i + 1}. ${p.name} — ${fmtUZS(p.revenue)} UZS.`);
      });
    }
    if (topSellAllQ.rows.length > 0) {
      lines.push('');
      lines.push('--- ТОП-5 ПРОДАВЦОВ (всё время) ---');
      topSellAllQ.rows.forEach((s, i) => {
        lines.push(`  ${i + 1}. ${s.name} (${s.role}) — ${fmtUZS(s.revenue)} UZS, ${s.deals} сделок.`);
      });
    }
    if (monthlyTrendQ.rows.length > 0) {
      lines.push('');
      lines.push('--- ТРЕНД ВЫРУЧКИ ПО МЕСЯЦАМ (последние 24 месяца) ---');
      for (const m of monthlyTrendQ.rows) {
        lines.push(`  ${m.month}: ${fmtUZS(m.revenue)} UZS (${m.deals} сделок).`);
      }
    }
    lines.push('');
    lines.push('=== КОНЕЦ ДАННЫХ — это ИСКЛЮЧИТЕЛЬНО данные одной компании пользователя ===');
    return lines.join('\n');
  } catch (e) {
    console.error('getCompanyContextForAI err', e.message);
    return '';
  }
}

async function buildSystemPrompt(user) {
  const lines = [
    'Ты — встроенный AI-консультант ERP-системы WareApp для розничной и оптовой торговли в Узбекистане.',
    'У ТЕБЯ ЕСТЬ доступ к данным компании пользователя за всё время её существования — они в блоке "ДАННЫЕ ВАШЕЙ КОМПАНИИ" ниже. Используй эти цифры в ответах, ссылайся на них как на факт.',
    'СТРОГО: данные ниже относятся ТОЛЬКО к одной компании — компании текущего пользователя. Ты НЕ видишь данные других компаний SaaS-системы и НЕ должен сравнивать с ними.',
    'НИКОГДА не говори "у меня нет доступа к данным", "я не подключён к базе" или "я не могу анализировать историю" — данные за весь период работы компании уже в этом промпте.',
    'Отвечай кратко (2-6 предложений), по делу, на русском. ВСЕГДА приводи конкретные цифры из данных компании когда они уместны (выручка, маржа, сделки, имена филиалов и товаров).',
    'Для прогнозов используй помесячный тренд (он за 24 месяца внизу) — посчитай средний рост/спад и экстраполируй.',
    'Для сравнения "сейчас vs раньше" сопоставляй "Текущие 30 дней" и "Предыдущие 30 дней" — там уже посчитана дельта в %.',
    'ВИЗУАЛИЗАЦИЯ: если пользователь явно просит график/диаграмму/визуализацию (слова: график, диаграмма, визуализируй, покажи график, нарисуй), заверши ответ ОТДЕЛЬНОЙ строкой:',
    '  [[CHART:TYPE]]',
    'где TYPE — один из: monthly_revenue (помесячная выручка), top_products (топ-товары), top_sellers (топ-продавцы), branches (филиалы), period_compare (текущие 30д vs предыдущие).',
    'Можешь вставить НЕСКОЛЬКО тегов подряд (каждый на новой строке) если нужно несколько графиков.',
    'НЕ рисуй ASCII-графики или текстовые палочки — система отрендерит настоящий график автоматически на основе тега.',
    'НЕ объясняй что такое тег [[CHART:...]] — пользователь его не видит, он видит уже отрендеренный график.',
    'Будь конкретен: ссылайся на разделы системы (Главная, Склад, Касса, Клиентский сервис, Финансы, HR, Маркетинг, Закупки, Операции).',
    'Если нужно действие — указывай куда нажать (например: «Склад → Остатки → выбери товар → подними цену в Sotish narxi»).',
    'Если данных не хватает (например пользователь спросил про что-то конкретное чего нет в блоке) — честно скажи «в текущих данных этого не вижу, проверь сам в разделе X».',
    'Никаких длинных списков и markdown-заголовков (кроме случаев когда явно нужны). Простой связный текст.',
    'Все суммы — в узбекских сумах (UZS). Сокращения: K=тысяча, M=миллион, B=миллиард.',
  ];
  if (user.company_id) {
    try {
      const r = await pool.query('SELECT name FROM companies WHERE id = $1', [user.company_id]);
      if (r.rows[0]?.name) lines.push(`Название компании: "${r.rows[0].name}".`);
    } catch {}
  }
  if (user.role) {
    const roleMap = { founder: 'Учредитель', gen_dir: 'Ген. директор', manager: 'Менеджер', admin: 'Администратор SaaS' };
    lines.push(`Роль собеседника: ${roleMap[user.role] || user.role}.`);
    if (user.role === 'manager') lines.push('Менеджер — данные ниже ТОЛЬКО по его филиалу, не по всей компании.');
  }
  const context = await getCompanyContextForAI(user);
  return lines.join(' ') + (context ? '\n' + context : '');
}

app.post('/api/ai/chat', auth(AI_ROLES), async (req, res) => {
  const startedAt = Date.now();
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(503).json({ error: 'AI не настроен. Администратор должен задать DEEPSEEK_API_KEY на сервере.' });
    }
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const cleaned = messages
      .filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (cleaned.length === 0) return res.status(400).json({ error: 'no valid messages' });

    const sys = await buildSystemPrompt(req.user);
    const requestBody = {
      model: model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat',
      messages: [{ role: 'system', content: sys }, ...cleaned],
      stream: false,
      temperature: 0.5,
      max_tokens: 600,
    };

    const r = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });
    const latency = Date.now() - startedAt;

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('deepseek non-ok', r.status, text.slice(0, 200));
      return res.status(502).json({ error: `Upstream AI error ${r.status}. Попробуйте ещё раз через минуту.` });
    }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    const usage = data?.usage || {};
    pool.query(
      'INSERT INTO ai_chat_log (user_id, company_id, prompt_tokens, completion_tokens, model, latency_ms) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, req.user.company_id, usage.prompt_tokens || null, usage.completion_tokens || null, requestBody.model, latency]
    ).catch(e => console.error('ai_chat_log insert err', e.message));

    res.json({
      reply,
      model: requestBody.model,
      usage: { prompt: usage.prompt_tokens, completion: usage.completion_tokens },
      latency_ms: latency,
    });
  } catch (e) {
    console.error('ai/chat err', e);
    res.status(500).json({ error: 'AI временно недоступен. Попробуйте позже.' });
  }
});

// Chart data for AI-rendered visualizations. Frontend asks for a chart type, backend returns
// the data already scoped to the user's company (or branch for manager). The AI itself never
// returns chart pixels — it tags responses like [[CHART:monthly_revenue]] and the UI renders
// the real chart next to the message using this endpoint.
app.get('/api/ai/chart-data', auth(AI_ROLES), async (req, res) => {
  try {
    const type = (req.query.type || '').toString();
    if (!req.user.company_id) return res.json({ type, data: null });

    const isManager = req.user.role === 'manager';
    let branchIds;
    if (isManager) {
      branchIds = req.user.branch_id ? [req.user.branch_id] : [];
    } else {
      const br = await pool.query('SELECT id FROM branches WHERE company_id = $1', [req.user.company_id]);
      branchIds = br.rows.map(r => r.id);
    }
    if (branchIds.length === 0) return res.json({ type, data: null });

    const now = new Date();
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
    const prevMonthAgo = new Date(monthAgo); prevMonthAgo.setDate(prevMonthAgo.getDate() - 30);
    const twoYearsAgo = new Date(now); twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);

    if (type === 'monthly_revenue') {
      const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', so.created_at), 'YYYY-MM') AS month,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
           AND so.created_at >= $3
         GROUP BY month ORDER BY month`,
        [branchIds, req.user.company_id, twoYearsAgo.toISOString()]
      );
      return res.json({
        type, title: 'Помесячная выручка за 24 месяца', unit: 'UZS',
        data: rows.map(r => ({ label: r.month, value: parseFloat(r.revenue), sub: r.deals + ' сделок' })),
      });
    }

    if (type === 'top_products') {
      const { rows } = await pool.query(
        `SELECT p.name_ru AS name,
                COALESCE(SUM(so.quantity),0) AS qty,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                p.unit
         FROM stock_outcome so JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
         GROUP BY p.id, p.name_ru, p.unit ORDER BY revenue DESC LIMIT 10`,
        [branchIds, req.user.company_id]
      );
      return res.json({
        type, title: 'Топ-10 товаров (за всё время)', unit: 'UZS',
        data: rows.map(r => ({ label: r.name, value: parseFloat(r.revenue), sub: parseFloat(r.qty) + ' ' + (r.unit || 'шт') })),
      });
    }

    if (type === 'top_sellers') {
      const { rows } = await pool.query(
        `SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',COALESCE(u.last_name,''))), ''), u.username) AS name,
                u.role,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM stock_outcome so
         JOIN users u ON u.id = so.created_by
         JOIN products p ON p.id = so.product_id
         WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
         GROUP BY u.id, u.username, u.first_name, u.last_name, u.role
         ORDER BY revenue DESC LIMIT 10`,
        [branchIds, req.user.company_id]
      );
      return res.json({
        type, title: 'Топ продавцов (за всё время)', unit: 'UZS',
        data: rows.map(r => ({ label: r.name, value: parseFloat(r.revenue), sub: r.deals + ' сделок · ' + r.role })),
      });
    }

    if (type === 'branches') {
      const { rows } = await pool.query(
        `SELECT b.name AS branch_name,
                COALESCE(SUM(so.quantity*so.price),0) AS revenue,
                COUNT(so.id) AS deals
         FROM branches b
         LEFT JOIN stock_outcome so ON so.branch_id = b.id AND so.status='approved'
         LEFT JOIN products p ON p.id = so.product_id AND p.company_id = $2
         WHERE b.id = ANY($1::int[])
         GROUP BY b.id, b.name ORDER BY revenue DESC`,
        [branchIds, req.user.company_id]
      );
      return res.json({
        type, title: 'Выручка по филиалам (за всё время)', unit: 'UZS',
        data: rows.map(r => ({ label: r.branch_name, value: parseFloat(r.revenue), sub: r.deals + ' сделок' })),
      });
    }

    if (type === 'period_compare') {
      const [curR, prevR] = await Promise.all([
        pool.query(
          `SELECT date_trunc('day', so.created_at)::date AS d,
                  COALESCE(SUM(so.quantity*so.price),0) AS revenue
           FROM stock_outcome so JOIN products p ON p.id = so.product_id
           WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
             AND so.created_at >= $3 AND so.created_at < $4
           GROUP BY d ORDER BY d`,
          [branchIds, req.user.company_id, monthAgo.toISOString(), now.toISOString()]
        ),
        pool.query(
          `SELECT date_trunc('day', so.created_at)::date AS d,
                  COALESCE(SUM(so.quantity*so.price),0) AS revenue
           FROM stock_outcome so JOIN products p ON p.id = so.product_id
           WHERE so.status='approved' AND so.branch_id = ANY($1::int[]) AND p.company_id = $2
             AND so.created_at >= $3 AND so.created_at < $4
           GROUP BY d ORDER BY d`,
          [branchIds, req.user.company_id, prevMonthAgo.toISOString(), monthAgo.toISOString()]
        ),
      ]);
      const fmt = (rows) => rows.map(r => ({ label: new Date(r.d).toISOString().slice(5, 10), value: parseFloat(r.revenue) }));
      return res.json({
        type, title: 'Сравнение: текущие 30 дней vs предыдущие 30 дней', unit: 'UZS',
        data: { current: fmt(curR.rows), prev: fmt(prevR.rows) },
      });
    }

    return res.status(400).json({ error: 'unknown chart type', allowed: ['monthly_revenue','top_products','top_sellers','branches','period_compare'] });
  } catch (e) {
    console.error('ai/chart-data err', e);
    res.status(500).json({ error: e.message });
  }
});

// Suggest follow-up questions based on a prior assistant reply. Stateless — quick second LLM call.
// AI-агент анализа финансов: пересчитывает РЕАЛЬНЫЕ цифры на сервере
// (те же helper'ы, что и GET-эндпоинты — не доверяем данным от клиента),
// затем просит DeepSeek дать короткий разбор + 2-3 конкретных действия.
const FIN_TOPICS = {
  cashflow:    { name: 'Денежный поток (Cash Flow)', fn: computeCashflow },
  'break-even':{ name: 'Точка безубыточности',       fn: computeBreakEven },
  model:       { name: 'Финансовая модель',          fn: computeFinModel },
};
app.post('/api/ai/analyze', auth(AI_ROLES), async (req, res) => {
  try {
    const topic = req.body?.topic;
    const meta = FIN_TOPICS[topic];
    if (!meta) return res.status(400).json({ error: 'Unknown topic' });
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(503).json({ error: 'AI не настроен. Администратор должен задать DEEPSEEK_API_KEY.' });
    }
    let scope; try { scope = await getUserBranchIds(req.user, req.query); } catch (e) { return res.status(e.statusCode || 500).json({ error: e.message }); }
    if (scope.restrictive && scope.ids.length === 0) return res.json({ analysis: 'Нет данных для анализа — у вас нет доступных филиалов.' });

    // Реальные цифры (server-side, доверенные)
    const data = meta.fn === computeFinModel ? await meta.fn(scope) : await meta.fn(scope, null, null);
    const fmtN = (n) => Math.round(parseFloat(n) || 0).toLocaleString('ru-RU');

    let factSheet = '';
    if (topic === 'cashflow') {
      factSheet = `Приход за период: ${fmtN(data.income)} сум\nРасход за период: ${fmtN(data.expense)} сум\nСальдо (баланс): ${fmtN(data.balance)} сум\nИзменение к прошлому периоду: ${data.balance_delta_pct ?? 'н/д'}%\nСредний чистый поток/день: ${fmtN(data.forecast_avg_net)} сум\nПрогноз баланса через 7 дней: ${fmtN(data.forecast_end_balance)} сум`;
    } else if (topic === 'break-even') {
      factSheet = `Выручка (месяц): ${fmtN(data.revenue)} сум\nСебестоимость: ${fmtN(data.cogs)} сум\nМаржинальность: ${data.margin_ratio}%\nПостоянные расходы: ${fmtN(data.fixed_costs)} сум\nТочка безубыточности: ${data.break_even_revenue != null ? fmtN(data.break_even_revenue) + ' сум' : 'не определена'}\nСтатус: ${data.above_break_even ? 'выше точки безубыточности (в плюсе)' : 'ниже точки безубыточности'}\nЕщё нужно продать на: ${fmtN(data.remaining_to_break_even)} сум (≈${data.sales_needed} продаж)\nЗапас прочности: ${data.safety_margin_pct ?? 'н/д'}%\nЧистая прибыль: ${fmtN(data.net_profit)} сум`;
    } else {
      const rows = [...data.months, ...data.projection].map(m => `${m.label}${m.projected ? ' (прогноз)' : ''}: выручка ${fmtN(m.revenue)}, валовая прибыль ${fmtN(m.gross_profit)}, чистая ${fmtN(m.net_profit)}`).join('\n');
      factSheet = `Среднемесячный рост выручки: ${data.growth_pct}%\n${rows}`;
    }

    const sys = `Ты — финансовый аналитик ERP-системы для розничного бизнеса в Узбекистане. Отвечай по-русски, кратко и по делу. На основе реальных цифр компании дай: (1) короткий вывод о состоянии (2-3 предложения), (2) 2-3 конкретных действия. Без воды, без общих фраз. Суммы в сумах. Используй ТОЛЬКО приведённые цифры, не выдумывай.`;
    const userMsg = `Раздел: ${meta.name}\n\nРеальные данные компании:\n${factSheet}\n\nДай разбор и рекомендации.`;

    const r = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', stream: false, temperature: 0.4, max_tokens: 500,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }] }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('deepseek analyze non-ok', r.status, t.slice(0, 200)); return res.status(502).json({ error: 'AI временно недоступен, попробуйте позже.' }); }
    const j = await r.json();
    const analysis = j?.choices?.[0]?.message?.content || '';
    const usage = j?.usage || {};
    pool.query('INSERT INTO ai_chat_log (user_id, company_id, prompt_tokens, completion_tokens, model, latency_ms) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, req.user.company_id, usage.prompt_tokens || null, usage.completion_tokens || null, 'deepseek-chat', null]).catch(() => {});
    res.json({ analysis, facts: factSheet });
  } catch (e) { console.error('ai/analyze err', e); res.status(500).json({ error: 'AI временно недоступен.' }); }
});

app.post('/api/ai/suggest', auth(AI_ROLES), async (req, res) => {
  try {
    if (!process.env.DEEPSEEK_API_KEY) return res.json({ questions: [] });
    const { last_reply } = req.body || {};
    if (!last_reply || typeof last_reply !== 'string') return res.json({ questions: [] });
    const prompt = 'На основе предыдущего ответа предложи 3 коротких follow-up вопроса от лица владельца розничного бизнеса. Возвращай ТОЛЬКО JSON-массив строк, без пояснений. Пример: ["...","...","..."]';
    const r = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Ответ AI:\n\n' + last_reply.slice(0, 2000) },
        ],
        stream: false, temperature: 0.7, max_tokens: 200,
      }),
    });
    if (!r.ok) return res.json({ questions: [] });
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    let parsed = [];
    try {
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {}
    res.json({ questions: Array.isArray(parsed) ? parsed.slice(0, 5).filter(s => typeof s === 'string' && s.length > 0) : [] });
  } catch (e) {
    res.json({ questions: [] });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

async function ensureSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_features (
        company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        feature_key VARCHAR(60) NOT NULL,
        enabled     BOOLEAN DEFAULT false,
        plan_tier   VARCHAR(30) DEFAULT 'basic',
        enabled_at  TIMESTAMP DEFAULT NOW(),
        enabled_by  INT REFERENCES users(id) ON DELETE SET NULL,
        PRIMARY KEY (company_id, feature_key)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_personas (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        age_range VARCHAR(40),
        gender VARCHAR(20),
        jtbd TEXT,
        pains TEXT,
        objections TEXT,
        channels VARCHAR(200),
        budget VARCHAR(60),
        notes TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_marketing_personas_company ON marketing_personas(company_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_content (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        platform VARCHAR(40) NOT NULL DEFAULT 'instagram',
        format VARCHAR(40) NOT NULL DEFAULT 'post',
        scheduled_for DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'planned',
        persona_id INT REFERENCES marketing_personas(id) ON DELETE SET NULL,
        hook TEXT,
        body TEXT,
        cta TEXT,
        notes TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_marketing_content_company ON marketing_content(company_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_marketing_content_scheduled ON marketing_content(company_id, scheduled_for)`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS funnel_stage VARCHAR(8)`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS reference_link TEXT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS plan_views INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS plan_likes INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS plan_comments INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS fact_views INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS fact_likes INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS fact_comments INT`);
    await pool.query(`ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS analysis TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_log (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        prompt_tokens INT,
        completion_tokens INT,
        model VARCHAR(60),
        latency_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_chat_log_co_user ON ai_chat_log(company_id, user_id, created_at DESC)`);

    console.log('schema OK');
  } catch (e) {
    console.error('ensureSchema err', e.message);
  }
}
ensureSchema();

app.listen(PORT, () => console.log(`WareApp API running on port ${PORT}`));
