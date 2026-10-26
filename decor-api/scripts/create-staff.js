'use strict';

// Сотрудник «Декора» со входом — то же, что учредитель делает в «Команде»
// (POST /api/decor/employees + POST /api/decor/employees/:id/login): сотрудник с уровнем,
// вход с должностью по уровню (ПМ и ученик → pm, кассир → cashier, кладовщик → warehouse),
// первый филиал компании. Компания — та, где учредитель с логином --founder.
// Пароль случайный, печатается один раз.
//
//   node scripts/create-staff.js --founder doradecor --level trainee --username dora_uchenik --name "Ism Familiya"
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { getPool } = require('../sphere_db');
const { LEVELS } = require('../decor/defaults');
const { randomPassword } = require('./create-company');

// Как в decor/staff.js (там это не экспортируется)
const ROLE_BY_LEVEL = { pm: 'pm', trainee: 'pm', cashier: 'cashier', storekeeper: 'warehouse' };
const LEVEL_LABEL = { pm: 'проект-менеджер', trainee: 'ученик', cashier: 'кассир', storekeeper: 'кладовщик' };

async function createStaff(pool, { founder, level, username, name }) {
  const login = String(username || '').trim();
  if (!LEVELS.includes(level)) throw new Error(`--level: одно из ${LEVELS.join(', ')}`);
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(login)) throw new Error('--username: 3–50 символов, латиница, цифры, _ . -');
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [f] } = await c.query(
      "SELECT id, company_id FROM users WHERE username=$1 AND role='founder'", [String(founder || '').trim()]);
    if (!f) throw new Error(`Учредитель «${founder}» не найден`);
    const empName = String(name || '').trim() || login;
    const { rows: [e] } = await c.query(
      'INSERT INTO decor_employees (company_id, name, level) VALUES ($1, $2, $3) RETURNING id', [f.company_id, empName.slice(0, 120), level]);
    const { rows: [b] } = await c.query('SELECT id FROM branches WHERE company_id=$1 ORDER BY id LIMIT 1', [f.company_id]);
    const { rows: [u] } = await c.query(
      `INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role`,
      [login, hash, ROLE_BY_LEVEL[level], f.company_id, b?.id || null, empName.slice(0, 100), f.id]);
    await c.query('UPDATE decor_employees SET user_id=$1 WHERE id=$2', [u.id, e.id]);
    await c.query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, new_value)
       VALUES (NULL, 'create-staff.js', 'create', 'user', $1, $2)`,
      [u.id, JSON.stringify({ username: login, level, employee_id: e.id })]);
    await c.query('COMMIT');
    return { username: login, password, role: u.role, level, employeeId: e.id, companyId: f.company_id };
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') throw new Error(`Логин «${login}» уже занят`);
    throw err;
  } finally {
    c.release();
  }
}

module.exports = { createStaff, ROLE_BY_LEVEL };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const pool = getPool('decor');
  createStaff(pool, { founder: arg('founder'), level: arg('level'), username: arg('username'), name: arg('name') })
    .then(r => {
      console.log(`${LEVEL_LABEL[r.level]} (должность ${r.role}), компания ${r.companyId}:`);
      console.log(`  логин:  ${r.username}`);
      console.log(`  пароль: ${r.password}   ← показывается один раз`);
    })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
