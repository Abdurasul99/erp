'use strict';

const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');
const { EVENTS_ROLES, canAccess } = require('./access');

// Проверка входа в сервис мероприятий.
//
// Токен выдаёт ОБЩИЙ вход Wave (/api/auth/login) тем же JWT_SECRET. Сервис
// принимает токен, только если:
//   1) подпись верна;
//   2) продукт в токене — events (быстрый отказ, ещё до обращения к БД);
//   3) по учёткам: компания существует и её продукт — events;
//   4) обычная учётка — не заблокирована, привязана именно к этой компании,
//      её роль — роль мероприятий, sid совпадает (одиночная сессия, как в Wave),
//      компания включена;
//   5) режим «войти как» (act_as) — токен выписал живой незаблокированный админ
//      WoW; как и в Wave, он может зайти и в приостановленную компанию.
//
// Роль берём из учётки, а НЕ из токена: токены Wave почти бессрочные, и смена
// роли админом иначе вступила бы в силу только после перелогина.
//
// Все запросы к учёткам перечисляют столбцы явно: на проде у сервиса роль БД с
// правами только на эти столбцы, и SELECT * просто упадёт.

// Роли, под которыми админ WoW может «войти как» в компанию мероприятий.
// Только управленческие: исполнитель видит мероприятия, где он в бригаде, а у
// админа своей бригады нет — вход «как декоратор» показал бы пустоту.
const IMPERSONATABLE_EVENTS_ROLES = ['founder', 'project_manager', 'coordinator'];

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function createAuth({ identity, jwtSecret }) {
  if (!jwtSecret) throw new Error('createAuth: нужен jwtSecret');

  return async function requireEventsUser(req, res, next) {
    try {
      const token = bearer(req);
      if (!token) throw new HttpError(401, 'Нет токена');

      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch {
        throw new HttpError(401, 'Неверный токен');
      }

      if (decoded.product !== 'events') {
        throw new HttpError(403, 'Эта учётка не относится к продукту «Мероприятия»', 'PRODUCT_MISMATCH');
      }
      const companyId = Number.parseInt(decoded.company_id, 10);
      if (!Number.isInteger(companyId)) throw new HttpError(403, 'Учётка не привязана к компании');

      const { rows: [company] } = await identity.query(
        'SELECT id, name, is_enabled, product, logo_url FROM companies WHERE id = $1', [companyId]);
      // Проверяем продукт ещё и по базе: подпись защищает токен от подделки, но
      // не от ошибки выдачи. Источник правды о продукте компании — учётки.
      if (!company || company.product !== 'events') {
        throw new HttpError(403, 'Компания не относится к продукту «Мероприятия»', 'PRODUCT_MISMATCH');
      }

      if (decoded.act_as) {
        const adminId = Number.parseInt(decoded.imp_by || decoded.id, 10);
        const { rows: [admin] } = await identity.query(
          'SELECT id, username, role, is_blocked, first_name, last_name FROM users WHERE id = $1', [adminId]);
        if (!admin || admin.role !== 'admin' || admin.is_blocked) {
          throw new HttpError(401, 'Режим «войти как» больше недействителен — войдите заново', 'SESSION_STALE');
        }
        if (!IMPERSONATABLE_EVENTS_ROLES.includes(decoded.role)) {
          throw new HttpError(403, 'Недопустимая роль для входа в продукт «Мероприятия»');
        }
        req.user = {
          id: admin.id,
          username: admin.username,
          role: decoded.role,
          company_id: companyId,
          branch_id: decoded.branch_id || null,
          first_name: admin.first_name,
          last_name: admin.last_name,
          company_name: company.name,
          company_logo_url: company.logo_url || null,
          act_as: true,
          impersonator_name: decoded.imp_name || admin.username,
        };
        return next();
      }

      if (company.is_enabled === false) {
        throw new HttpError(403, 'Доступ компании приостановлен. Обратитесь к администратору.', 'COMPANY_DISABLED');
      }

      const { rows: [user] } = await identity.query(
        `SELECT id, username, role, company_id, branch_id, session_id, is_blocked, first_name, last_name
           FROM users WHERE id = $1`, [decoded.id]);
      if (!user) throw new HttpError(401, 'Пользователь не найден', 'SESSION_STALE');
      if (user.is_blocked) throw new HttpError(403, 'Аккаунт заблокирован. Обратитесь к администратору.');
      // Учётку перевели в другую компанию — старый токен не должен открывать прежнюю.
      if (user.company_id !== companyId) throw new HttpError(401, 'Сессия устарела — войдите заново', 'SESSION_STALE');
      if (!EVENTS_ROLES.includes(user.role)) {
        throw new HttpError(403, 'Роль учётки не относится к продукту «Мероприятия»', 'PRODUCT_MISMATCH');
      }
      if (!decoded.sid) throw new HttpError(401, 'Сессия устарела — войдите заново', 'SESSION_STALE');
      if (user.session_id !== decoded.sid) {
        throw new HttpError(401, 'Вход выполнен на другом устройстве — эта сессия завершена', 'SESSION_REVOKED');
      }

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        company_id: companyId,
        branch_id: user.branch_id || null,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: company.name,
        company_logo_url: company.logo_url || null,
        act_as: false,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

const requireScreen = (group) => (req, res, next) => (
  canAccess(req.user.role, group)
    ? next()
    : next(new HttpError(403, 'Нет доступа к этому разделу'))
);

module.exports = { createAuth, requireScreen, IMPERSONATABLE_EVENTS_ROLES };
