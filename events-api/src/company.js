'use strict';

const { HttpError } = require('./errors');
const { EVENTS_ROLES, ROLE_LABELS } = require('./access');

const DEFAULT_SETTINGS = Object.freeze({
  target_margin_pct: 35,
  payment_overdue_days: 3,
  rental_overdue_days: 1,
  deficit_horizon_days: 14,
});

async function loadSettings(q, companyId) {
  const { rows: [row] } = await q.query(
    `SELECT target_margin_pct, payment_overdue_days, rental_overdue_days, deficit_horizon_days
       FROM ev_settings WHERE company_id = $1`, [companyId]);
  return row ? { ...DEFAULT_SETTINGS, ...row } : { ...DEFAULT_SETTINGS };
}

// Сотрудники компании с ролями мероприятий — из учёток (база warehouse).
// Столбцы перечислены явно: у сервиса там права только на них.
async function listStaff(identity, companyId) {
  const { rows } = await identity.query(
    `SELECT id, username, role, branch_id, first_name, last_name, is_blocked
       FROM users WHERE company_id = $1 ORDER BY first_name NULLS LAST, username`, [companyId]);
  return rows
    .filter((u) => EVENTS_ROLES.includes(u.role))
    .map((u) => ({
      id: u.id,
      name: displayName(u),
      username: u.username,
      role: u.role,
      role_label: ROLE_LABELS[u.role],
      branch_id: u.branch_id,
      is_blocked: !!u.is_blocked,
    }));
}

// Сотрудник для назначения в бригаду: обязан быть из ЭТОЙ компании и с ролью
// мероприятий. Иначе через user_id можно было бы вписать в бригаду человека
// чужой компании — и тогда он увидел бы это мероприятие.
async function loadStaffMember(identity, companyId, userId) {
  const { rows: [u] } = await identity.query(
    `SELECT id, username, role, company_id, branch_id, first_name, last_name, is_blocked
       FROM users WHERE id = $1`, [userId]);
  if (!u || u.company_id !== companyId || !EVENTS_ROLES.includes(u.role)) {
    throw new HttpError(400, 'Сотрудник не найден в этой компании');
  }
  if (u.is_blocked) throw new HttpError(400, 'Сотрудник заблокирован');
  return { id: u.id, name: displayName(u), role: u.role, role_label: ROLE_LABELS[u.role], branch_id: u.branch_id };
}

async function assertBranchInCompany(identity, companyId, branchId) {
  if (branchId === null || branchId === undefined) return;
  const { rows: [b] } = await identity.query('SELECT id, company_id FROM branches WHERE id = $1', [branchId]);
  if (!b || b.company_id !== companyId) throw new HttpError(400, 'Филиал не принадлежит компании');
}

async function listBranches(identity, companyId) {
  const { rows } = await identity.query(
    'SELECT id, name FROM branches WHERE company_id = $1 ORDER BY name', [companyId]);
  return rows;
}

function displayName(u) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return full || u.username;
}

module.exports = {
  DEFAULT_SETTINGS, loadSettings, listStaff, loadStaffMember,
  assertBranchInCompany, listBranches, displayName,
};
