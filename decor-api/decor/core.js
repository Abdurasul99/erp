// Вход в сферу «Декор» и «кто я». Логика повторяет /api/auth/login Wave и /api/edu/auth/login —
// только по базе wave_decor и с полем sphere='decor' в JWT.
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { wrap, fail, text } = require('./common');

module.exports = ({ app, pool, A, authLimiter, JWT_SECRET, SPHERE }) => {
  app.post('/api/decor/auth/login', authLimiter, wrap(async (req, res) => {
    const username = text(req.body?.username, 50);
    const password = String(req.body?.password || '');
    const { rows: [u] } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (!u || !(await bcrypt.compare(password, u.password_hash))) fail(401, 'Неверный логин или пароль');
    if (u.is_blocked) fail(403, 'Аккаунт заблокирован. Обратитесь к учредителю.');
    if (!u.company_id) fail(403, 'Пользователь не привязан к компании');
    const payload = { id: u.id, username: u.username, role: u.role, company_id: u.company_id, branch_id: u.branch_id || null, sphere: SPHERE };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [u.id]).catch(() => {});
    res.json({ token, user: { ...payload, first_name: u.first_name, last_name: u.last_name } });
  }));

  // Всё, что нужно экрану после входа: человек, компания, должность, полномочия, функции, выключенные разделы
  app.get('/api/decor/auth/me', A(), wrap(async (req, res) => {
    const { cid } = req.decor;
    const [{ rows: [u] }, { rows: [s] }] = await Promise.all([
      pool.query(`SELECT u.id, u.username, u.role, u.first_name, u.last_name, u.branch_id, c.name AS company_name, b.name AS branch_name
        FROM users u JOIN companies c ON c.id=u.company_id LEFT JOIN branches b ON b.id=u.branch_id WHERE u.id=$1`, [req.user.id]),
      pool.query('SELECT rate_uzs::float8 AS rate_uzs, days_on_site, panel_off FROM decor_settings WHERE company_id=$1', [cid]),
    ]);
    res.json({
      user: { ...u, sphere: SPHERE },
      employee: req.decor.employee,
      is_owner: req.decor.isOwner,
      permissions: [...req.decor.perms],
      features: [...req.decor.features],
      panel_off: s?.panel_off || [],
      rate_uzs: s?.rate_uzs ?? null,
      days_on_site: s?.days_on_site ?? null,
    });
  }));

  app.post('/api/decor/auth/change-password', A(), wrap(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!new_password || String(new_password).length < 4) fail(400, 'Новый пароль минимум 4 символа');
    const { rows: [u] } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!u || !(await bcrypt.compare(String(current_password || ''), u.password_hash))) fail(401, 'Неверный текущий пароль');
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(String(new_password), 10), req.user.id]);
    res.json({ ok: true });
  }));
};
