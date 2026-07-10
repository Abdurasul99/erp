// Минтинг JWT-токенов WareApp (тот же секрет и payload, что и harness.js).
// Используем вместо логина, чтобы не упереться в rate-limit /auth/login.
const jwt = require('jsonwebtoken');
const cfg = require('./config');

// payload как в server.js: { id, username, role, company_id, branch_id }
// Длинный срок (365d): симулятор может работать неделями/месяцами — токены не должны протухать.
function mint({ id, username, role, company_id = null, branch_id = null }) {
  return jwt.sign({ id, username, role, company_id, branch_id }, cfg.jwtSecret, { expiresIn: '365d' });
}

module.exports = { mint };
