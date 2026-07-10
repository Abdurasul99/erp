// Оркестратор симулятора: брокер + консьюмер + агенты + control-API (Express) + раздача Vue-панели.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cfg = require('./config');
const { startBroker, aedes } = require('./broker');
const { startConsumer } = require('./consumer');
const { startAgents } = require('./agents');
const { provisionCompany } = require('./bootstrap');
const { runCleanup } = require('./cleanup');
const { pool } = require('./db');
const { api } = require('./wareapp');
const metrics = require('./metrics');

// --- общее состояние симуляции (в памяти одного процесса) ---
const state = {
  companies: new Map(), // id -> провизированная компания (с токенами)
  running: new Set(),   // id запущенных компаний
  rate: 0,              // целевой темп msg/s
  endAt: null,          // ms-таймстамп авто-стопа (для запусков на часы/дни/недели/месяцы)
  startedAt: null,
  nextIdx: 1,
};

// --- сессии панели: вход реальным админом WareApp (admin + пароль из БД) ---
const sessions = new Map(); // session-token -> expiry ms
function newSession() { const t = crypto.randomBytes(18).toString('hex'); sessions.set(t, Date.now() + 12 * 3600e3); return t; }
function validSession(t) { const e = t && sessions.get(t); if (!e) return false; if (Date.now() > e) { sessions.delete(t); return false; } return true; }

// Эндпоинты для кнопки «Проверить инструменты» (читаются под founder свежей компании; ждём 200).
const VERIFY_EPS = [
  '/company/dashboard', '/company/sales-chart?gran=day', '/bhi/monthly',
  '/analytics/founder-dashboard', '/analytics/alerts', '/analytics/trends', '/analytics/branches/compare',
  '/analytics/funnel?period=month', '/analytics/report?period=month', '/analytics/unit-economics?period=month',
  '/customers/segments', '/crm/complaints', '/sales/history', '/pricing/analyze', '/inventory/abc-xyz',
  '/finance/model', '/finance/cashflow', '/finance/break-even',
  '/finance/expenses/summary', '/finance/profitability', '/finance/payment-calendar', '/finance/currency', '/finance/taxes', '/finance/ratios', '/finance/whatif-base',
  '/warehouse/outcome-summary', '/warehouse/turnover', '/warehouse/eoq', '/warehouse/reorder-point', '/warehouse/min-stock-alerts', '/warehouse/barcodes-coverage', '/warehouse/demand-forecast', '/warehouse/whatif-base', '/warehouse/writeoff-summary',
  '/procurement/history', '/procurement/ratings', '/procurement/forecast', '/procurement/whatif-base', '/procurement/orders', '/procurement/receivings',
  '/discounts', '/sales/top-products', '/operations/seller-avg-check', '/operations/returns-report', '/marketing/campaigns', '/sales/forecast', '/sales/whatif-base', '/nps/reviews', '/sales/scripts', '/marketing/leads', '/marketing/loyalty/overview',
  '/hr/schedules', '/hr/attendance', '/hr/absences/current', '/hr/salaries', '/hr/productivity', '/hr/adjustments', '/hr/forecast', '/hr/whatif-base', '/hr/training', '/hr/overview', '/team/kpi',
  '/settings/overview', '/integrations',
];

function summary(c) {
  const sellers = c.branches.reduce((s, b) => s + b.sellers.length, 0);
  return {
    id: c.id, name: c.name, branches: c.branches.length, products: c.products.length,
    sellers, customers: c.customers.length, running: state.running.has(c.id),
    revenue: c.kpi ? c.kpi.revenue : 0, deals: c.kpi ? c.kpi.deals : 0, cashIn: c.kpi ? c.kpi.cashIn : 0,
    founder: { username: c.founder.username, password: c.founder.password },
  };
}

// Фоновый сбор «денежных» KPI по каждой компании ПРЯМО ИЗ БД (дёшево, не грузит API):
// выручка = SUM(quantity*price) по одобренным продажам; чеки; приход кассы. Раз в 4с.
async function refreshKpis() {
  for (const c of state.companies.values()) {
    try {
      const r = await pool.query(
        "SELECT COALESCE(SUM(so.quantity*so.price),0) rev, COUNT(*) deals FROM stock_outcome so JOIN products p ON p.id=so.product_id WHERE p.company_id=$1 AND so.status='approved'",
        [c.id]);
      const bids = c.branches.map((b) => b.id);
      const ci = await pool.query('SELECT COALESCE(SUM(amount),0) c FROM cash_income WHERE branch_id = ANY($1::int[])', [bids]);
      c.kpi = { revenue: Math.round(parseFloat(r.rows[0].rev) || 0), deals: parseInt(r.rows[0].deals) || 0, cashIn: Math.round(parseFloat(ci.rows[0].c) || 0) };
    } catch (e) { /* оставляем прошлое значение */ }
  }
}
setInterval(refreshKpis, 4000);

// ------------------- boot -------------------
startBroker();
startConsumer();
startAgents(state);

// раз в секунду: авто-стоп по расписанию + публикация снимка метрик
setInterval(() => {
  // авто-стоп: запуск на часы/дни/недели/месяцы — выключаемся по достижении endAt
  if (state.endAt && Date.now() >= state.endAt) {
    state.running.clear(); state.rate = 0; state.endAt = null; state.startedAt = null;
    console.log('[sim] расписание истекло — нагрузка остановлена');
  }
  const snap = metrics.snapshot();
  snap.rateTarget = state.rate;
  snap.running = [...state.running];
  snap.endAt = state.endAt;
  snap.companies = [...state.companies.values()].map(summary);
  aedes.publish({ topic: 'sim/stats', payload: Buffer.from(JSON.stringify(snap)), qos: 0, retain: true }, () => {});
}, 1000);

// ------------------- control API -------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// ВХОД: логин = реальный админ WareApp (admin + пароль из БД). Проверяем через /api/auth/login.
app.post('/api/sim/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'нужны логин и пароль' });
  const r = await api('POST', '/auth/login', null, { username, password });
  if (r.status === 200 && r.body && r.body.user && r.body.user.role === 'admin') {
    return res.json({ ok: true, token: newSession(), user: r.body.user.username });
  }
  if (r.status === 200) return res.status(403).json({ ok: false, error: 'нужен админ-аккаунт' });
  if (r.status === 429) return res.status(429).json({ ok: false, error: 'слишком много попыток, подожди 15 мин' });
  return res.status(401).json({ ok: false, error: 'неверный логин или пароль' });
});

// Защита остальных /api/sim/* — нужна валидная сессия (или master-ключ SIM_TOKEN, если задан).
app.use('/api/sim', (req, res, next) => {
  const k = req.get('x-sim-key') || req.query.key;
  if (validSession(k)) return next();
  if (cfg.controlToken && k === cfg.controlToken) return next();
  res.status(401).json({ ok: false, error: 'unauthorized' });
});

app.get('/api/sim/state', (req, res) => {
  res.json({
    config: { wsPort: cfg.wsPort, apiBase: cfg.apiBase, concurrency: cfg.concurrency },
    rate: state.rate, running: [...state.running],
    endAt: state.endAt, startedAt: state.startedAt, now: Date.now(),
    companies: [...state.companies.values()].map(summary),
    metrics: metrics.snapshot(),
  });
});

// создать N компаний по спеке
app.post('/api/sim/companies', async (req, res) => {
  const b = req.body || {};
  const count = Math.min(Math.max(parseInt(b.count) || 1, 1), 20);
  const spec = {
    branches: Math.min(Math.max(parseInt(b.branches) || 2, 1), 10),
    warehouses: Math.min(Math.max(parseInt(b.warehouses) || 1, 1), 10),
    sellers: Math.min(Math.max(parseInt(b.sellers) || 3, 1), 30),
    cashiers: Math.min(Math.max(parseInt(b.cashiers) || 1, 1), 10),
    products: Math.min(Math.max(parseInt(b.products) || 30, 1), 500),
    customers: Math.min(Math.max(parseInt(b.customers ?? 10), 0), 200),
  };
  const made = [];
  try {
    for (let i = 0; i < count; i++) {
      const c = await provisionCompany({ ...spec, idx: state.nextIdx++ });
      state.companies.set(c.id, c);
      made.push(summary(c));
    }
    res.json({ ok: true, created: made });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, created: made });
  }
});

app.post('/api/sim/start', (req, res) => {
  const ids = Array.isArray(req.body?.ids) && req.body.ids.length ? req.body.ids.map(Number) : [...state.companies.keys()];
  ids.forEach((id) => state.companies.has(id) && state.running.add(id));
  if (req.body?.rate != null) state.rate = Math.max(0, parseInt(req.body.rate) || 0);
  // длительность прогона (часы/дни/недели/месяцы). durationMs=0/нет → бессрочно (до ручного стопа).
  const durationMs = Math.max(0, parseInt(req.body?.durationMs) || 0);
  state.startedAt = Date.now();
  state.endAt = durationMs > 0 ? Date.now() + durationMs : null;
  res.json({ ok: true, running: [...state.running], rate: state.rate, endAt: state.endAt });
});

app.post('/api/sim/stop', (req, res) => {
  if (Array.isArray(req.body?.ids) && req.body.ids.length) req.body.ids.map(Number).forEach((id) => state.running.delete(id));
  else { state.running.clear(); state.rate = 0; state.endAt = null; state.startedAt = null; }
  res.json({ ok: true, running: [...state.running], rate: state.rate });
});

app.post('/api/sim/rate', (req, res) => {
  state.rate = Math.max(0, parseInt(req.body?.rate) || 0);
  res.json({ ok: true, rate: state.rate });
});

// проверить, что все инструменты отдают данные под founder этой компании
app.post('/api/sim/verify', async (req, res) => {
  const c = state.companies.get(Number(req.body?.id));
  if (!c) return res.status(404).json({ ok: false, error: 'company not found' });
  const results = [];
  for (const ep of VERIFY_EPS) {
    const r = await api('GET', ep, c.founder.token);
    results.push({ ep, status: r.status, ok: r.status === 200 });
  }
  const pass = results.filter((x) => x.ok).length;
  res.json({ ok: true, pass, fail: results.length - pass, total: results.length, results });
});

app.post('/api/sim/cleanup', async (req, res) => {
  state.running.clear(); state.rate = 0; state.companies.clear();
  try { const r = await runCleanup(); res.json({ ok: true, ...r }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.listen(cfg.controlPort, () => {
  console.log(`[sim] control-API + панель: http://0.0.0.0:${cfg.controlPort}`);
  console.log(`[sim] цель нагрузки: ${cfg.apiBase}`);
});
