'use strict';

// Новый случайный пароль для входа «Декора» — пока в админке WoW нет раздела «Декора»,
// а у учредителя нет экрана смены пароля. Печатается один раз; прежние токены этого
// пользователя продолжают действовать до истечения (24 ч), блокировка — отдельно.
//
//   node scripts/reset-password.js --username doradecor
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { getPool } = require('../sphere_db');
const { randomPassword } = require('./create-company');

async function resetPassword(pool, { username }) {
  const login = String(username || '').trim();
  if (!login) throw new Error('--username обязателен');
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);
  const { rows: [u] } = await pool.query(
    'UPDATE users SET password_hash=$1 WHERE username=$2 RETURNING id, role, company_id', [hash, login]);
  if (!u) throw new Error(`Пользователь «${login}» не найден`);
  await pool.query(
    `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, new_value)
     VALUES (NULL, 'reset-password.js', 'reset_password', 'user', $1, $2)`,
    [u.id, JSON.stringify({ username: login })]);
  return { username: login, role: u.role, companyId: u.company_id, password };
}

module.exports = { resetPassword };

if (require.main === module) {
  const i = process.argv.indexOf('--username');
  const pool = getPool('decor');
  resetPassword(pool, { username: i > 0 ? process.argv[i + 1] : '' })
    .then(r => {
      console.log(`Новый пароль для ${r.username} (${r.role}, компания ${r.companyId}):`);
      console.log(`  пароль: ${r.password}   ← показывается один раз`);
    })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
