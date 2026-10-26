'use strict';

// Новая компания «Декора» с учредителем — то, что в «платформе сфер» делает
// POST /api/admin/spheres/decor/companies. Одна транзакция: компания, основной филиал,
// учредитель, начальные данные (decor/seed_company.js: нормы, полномочия, ставки,
// требования к фото и видео, базовые функции). Пароль выдаётся случайный и печатается
// один раз — передайте его учредителю, он сменит его в «Декоре».
//
//   node scripts/create-company.js --company "Dora Decor" --username dora_founder --name "Имя Фамилия"
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { getPool } = require('../sphere_db');
const seedCompany = require('../decor/seed_company');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (m && argv[i + 1] !== undefined) out[m[1]] = argv[++i];
  }
  return out;
}

// Без похожих символов (0/O, 1/l/I) — пароль диктуют по телефону
function randomPassword(length = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

async function createCompany(pool, { company, username, name }) {
  const companyName = String(company || '').trim();
  const login = String(username || '').trim();
  if (!companyName || companyName.length > 200) throw new Error('--company: название от 1 до 200 символов');
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(login)) throw new Error('--username: 3–50 символов, латиница, цифры, _ . -');
  const [firstName, ...rest] = String(name || '').trim().split(/\s+/).filter(Boolean);
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [co] } = await c.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [companyName]);
    const { rows: [br] } = await c.query('INSERT INTO branches (company_id, name) VALUES ($1, $2) RETURNING id', [co.id, 'Основной']);
    const { rows: [u] } = await c.query(
      `INSERT INTO users (username, password_hash, role, company_id, branch_id, first_name, last_name)
       VALUES ($1, $2, 'founder', $3, $4, $5, $6) RETURNING id`,
      [login, hash, co.id, br.id, firstName || null, rest.join(' ') || null]);
    await seedCompany(c, co.id);
    await c.query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, new_value)
       VALUES (NULL, 'create-company.js', 'create', 'company', $1, $2)`,
      [co.id, JSON.stringify({ name: companyName, founder: login })]);
    await c.query('COMMIT');
    return { companyId: co.id, userId: u.id, username: login, password };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') throw new Error(`Логин «${login}» уже занят`);
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { createCompany, randomPassword };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const pool = getPool('decor');
  createCompany(pool, args)
    .then(r => {
      console.log(`Компания создана: id ${r.companyId}`);
      console.log(`Вход учредителя: /decor/login`);
      console.log(`  логин:  ${r.username}`);
      console.log(`  пароль: ${r.password}   ← показывается один раз`);
    })
    .catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; })
    .finally(() => pool.end());
}
