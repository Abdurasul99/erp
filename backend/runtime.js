'use strict';

function envInteger(value, fallback, min = 1, max = 2147483647) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

// Express 4 does not forward rejected promises. Preserve error-handler arity
// and app.get(setting), and wrap nested middleware arrays as well as routes.
function protectAsync(app) {
  const wrap = handler => {
    if (Array.isArray(handler)) return handler.map(wrap);
    if (typeof handler !== 'function' || handler.length === 4) return handler;
    return function protectedHandler(req, res, next) {
      try { Promise.resolve(handler(req, res, next)).catch(next); }
      catch (error) { next(error); }
    };
  };
  for (const method of ['use', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']) {
    const register = app[method];
    app[method] = function (...args) {
      if (method === 'get' && args.length === 1) return register.apply(this, args);
      return register.apply(this, args.map(wrap));
    };
  }
  return app;
}

function jsonError(error, req, res, next) {
  if (res.headersSent) return next(error);
  const requested = Number(error.statusCode || error.status);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413
    : requested >= 400 && requested <= 599 ? requested : 500;
  console.error('Request failed', req.method, req.path, error.code || error.name || 'Error');
  res.status(status).json({ error: status === 413 ? 'Слишком большой запрос или файл'
    : status === 400 ? 'Некорректный запрос'
    : 'Сервис временно недоступен. Попробуйте позже.' });
}

module.exports = { envInteger, protectAsync, jsonError };
