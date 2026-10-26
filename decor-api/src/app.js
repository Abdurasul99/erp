'use strict';

// Express-приложение сервиса «Декор». Сам модуль decor/ — код сферы без изменений;
// здесь только то, что в «платформе сфер» давал процесс Wave: разбор JSON,
// проверка токена auth([роли]) и ограничитель входа authLimiter.
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const SPHERE = 'decor';

// auth([роли]) — как в Wave: [] = любой вошедший. Токен подписан СВОИМ секретом сервиса,
// поэтому токен Wave здесь не пройдёт, а токен «Декора» не пройдёт в Wave.
function makeAuth(jwtSecret) {
  return (roles = []) => (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Войдите в систему' });
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Сессия истекла — войдите заново' });
    }
    if (decoded.sphere !== SPHERE) return res.status(401).json({ error: 'Войдите в «Декор»', code: 'wrong_sphere' });
    if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ error: 'Нет доступа' });
    req.user = decoded;
    next();
  };
}

function createApp({ jwtSecret, loginLimit = { windowMs: 15 * 60 * 1000, max: 10 } }) {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('DECOR_JWT_SECRET: нужен секрет не короче 32 символов');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);                       // за nginx: IP клиента — из X-Forwarded-For
  // Файлы отдаются с типом, который прислал телефон; браузер не должен «угадывать» в них HTML
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(express.json({ limit: '10mb' }));        // как в Wave; файлы идут multipart через multer

  const authLimiter = rateLimit({
    ...loginLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Подождите 15 минут.' },
  });

  require('../decor')(app, { auth: makeAuth(jwtSecret), authLimiter, JWT_SECRET: jwtSecret });

  app.use('/api/decor', (req, res) => res.status(404).json({ error: 'Не найдено' }));
  // Битый JSON и прочие ошибки до маршрутов — ответ JSON, без стека
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Неверный формат данных' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой запрос' });
    console.error('decor-api: необработанная ошибка', req.method, req.path, err);
    res.status(500).json({ error: 'Ошибка сервера' });
  });
  return app;
}

module.exports = { createApp, makeAuth, SPHERE };
