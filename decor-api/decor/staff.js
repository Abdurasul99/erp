// Сотрудники «Декора» и их входы. Сотрудник — уровень оплаты (ПМ, ученик, кассир, кладовщик);
// вход в систему есть не у всех. Вход создаёт учредитель, должность = роль по уровню.
const bcrypt = require('bcryptjs');
const { LEVELS } = require('./defaults');
const { wrap, fail, idParam, text, oneOf } = require('./common');

// Должность входа по уровню сотрудника (полномочия — по должности, Настройки → Полномочия)
const ROLE_BY_LEVEL = { pm: 'pm', trainee: 'pm', cashier: 'cashier', storekeeper: 'warehouse' };

module.exports = ({ app, pool, A, can, has, ownerOnly, audit, txFor }) => {
  const owned = async (req, id) => (await pool.query('SELECT * FROM decor_employees WHERE id=$1 AND company_id=$2', [id, req.decor.cid])).rows[0]
    || fail(404, 'Сотрудник не найден');

  // Список нужен всем: команда в калькуляторе, кто принял деньги, исполнитель отчёта.
  // Логины видят учредитель и тот, кто меняет настройки.
  app.get('/api/decor/employees', A(), wrap(async (req, res) => {
    const full = req.decor.isOwner || has(req, 'edit_settings');
    const { rows } = await pool.query(`SELECT e.id, e.name, e.phone, e.level, e.is_active, e.user_id, u.username, u.role, u.is_blocked
      FROM decor_employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.company_id=$1 ORDER BY e.is_active DESC, e.id`, [req.decor.cid]);
    res.json(rows.map(r => ({
      id: r.id, name: r.name, level: r.level, is_active: r.is_active, has_login: !!r.user_id,
      ...(full ? { phone: r.phone, user_id: r.user_id, username: r.username, role: r.role, is_blocked: r.is_blocked } : {}),
    })));
  }));

  app.post('/api/decor/employees', A(can('edit_settings')), wrap(async (req, res) => {
    const name = text(req.body?.name, 120) || fail(400, 'Имя сотрудника обязательно');
    const level = oneOf(req.body?.level, LEVELS, 'Уровень');
    const e = await txFor(req)(async c => (await c.query('INSERT INTO decor_employees (company_id, name, level, phone) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.decor.cid, name, level, text(req.body?.phone, 40)])).rows[0]);
    audit(req, 'create', 'decor_employee', e.id, null, e);
    res.json(e);
  }));

  app.put('/api/decor/employees/:id', A(can('edit_settings')), wrap(async (req, res) => {
    const e = await owned(req, idParam(req));
    const b = req.body || {};
    const next = {
      name: b.name !== undefined ? text(b.name, 120) || fail(400, 'Имя сотрудника обязательно') : e.name,
      level: b.level !== undefined ? oneOf(b.level, LEVELS, 'Уровень') : e.level,
      phone: b.phone !== undefined ? text(b.phone, 40) : e.phone,
      is_active: b.is_active !== undefined ? !!b.is_active : e.is_active,
    };
    const row = await txFor(req)(async c => {
      const { rows: [r] } = await c.query('UPDATE decor_employees SET name=$1, level=$2, phone=$3, is_active=$4 WHERE id=$5 RETURNING *',
        [next.name, next.level, next.phone, next.is_active, e.id]);
      // Уровень сменился — должность входа следом (старый токен перестанет работать, человек войдёт заново)
      if (e.user_id && ROLE_BY_LEVEL[next.level] !== ROLE_BY_LEVEL[e.level]) {
        const { rows: [u] } = await c.query('SELECT username, role FROM users WHERE id=$1', [e.user_id]);
        await c.query('UPDATE users SET role=$1 WHERE id=$2 AND company_id=$3', [ROLE_BY_LEVEL[next.level], e.user_id, req.decor.cid]);
        await c.query(`INSERT INTO role_change_log (user_id, username, old_role, new_role, changed_by, changed_by_username) VALUES ($1,$2,$3,$4,$5,$6)`,
          [e.user_id, u?.username, u?.role, ROLE_BY_LEVEL[next.level], req.user.id, req.user.username]);
      }
      return r;
    });
    audit(req, 'update', 'decor_employee', e.id, e, row);
    res.json(row);
  }));

  // Вход для сотрудника (учредитель). Должность — по уровню: ПМ и ученик → pm, кассир → cashier, кладовщик → warehouse.
  app.post('/api/decor/employees/:id/login', A(ownerOnly), wrap(async (req, res) => {
    const e = await owned(req, idParam(req));
    if (e.user_id) fail(409, 'У сотрудника уже есть вход');
    const username = text(req.body?.username, 50) || fail(400, 'Логин обязателен');
    const password = String(req.body?.password || '');
    if (password.length < 4) fail(400, 'Пароль минимум 4 символа');
    const role = ROLE_BY_LEVEL[e.level];
    const hash = await bcrypt.hash(password, 10);
    const u = await txFor(req)(async c => {
      const { rows: [b] } = await c.query('SELECT id FROM branches WHERE company_id=$1 ORDER BY id LIMIT 1', [req.decor.cid]);
      const { rows: [nu] } = await c.query(`INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, username, role`, [username, hash, role, req.decor.cid, b?.id || null, e.name, req.user.id]);
      await c.query('UPDATE decor_employees SET user_id=$1 WHERE id=$2', [nu.id, e.id]);
      return nu;
    });
    audit(req, 'create', 'user', u.id, null, { ...u, employee_id: e.id });
    res.json({ employee_id: e.id, user_id: u.id, username: u.username, role: u.role });
  }));

  // Блокировка и новый пароль входа сотрудника (учредитель)
  app.put('/api/decor/employees/:id/login', A(ownerOnly), wrap(async (req, res) => {
    const e = await owned(req, idParam(req));
    if (!e.user_id) fail(404, 'У сотрудника нет входа');
    const b = req.body || {};
    if (b.password !== undefined && String(b.password).length < 4) fail(400, 'Пароль минимум 4 символа');
    const hash = b.password !== undefined ? await bcrypt.hash(String(b.password), 10) : null;
    await txFor(req)(async c => {
      if (b.is_blocked !== undefined) await c.query('UPDATE users SET is_blocked=$1 WHERE id=$2 AND company_id=$3', [!!b.is_blocked, e.user_id, req.decor.cid]);
      if (hash) await c.query('UPDATE users SET password_hash=$1 WHERE id=$2 AND company_id=$3', [hash, e.user_id, req.decor.cid]);
      return { is_blocked: b.is_blocked, password_reset: !!hash };
    });
    audit(req, 'update', 'user', e.user_id, null, { is_blocked: b.is_blocked, password_reset: b.password !== undefined });
    res.json({ ok: true });
  }));
};
module.exports.ROLE_BY_LEVEL = ROLE_BY_LEVEL;
