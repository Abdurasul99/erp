'use strict';

const express = require('express');
const { createAuth } = require('./auth');
const { errorMiddleware, HttpError } = require('./errors');
const { meRouter } = require('./routes/me');
const { eventsRouter } = require('./routes/events');
const { eventPartsRouter } = require('./routes/event-parts');
const { dashboardRouter } = require('./routes/dashboard');
const { clientsRouter } = require('./routes/clients');

// Приложение собирается фабрикой, а не на уровне модуля: тесты поднимают его на
// PGlite с подставными учётками, прод — на двух пулах pg. Код маршрутов один.
function createApp({ db, identity, jwtSecret }) {
  const app = express();
  app.disable('x-powered-by');
  // Сервис стоит за nginx на том же хосте — берём реальный IP клиента из заголовка.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Здоровье — без входа: его дёргает сторож на сервере.
  app.get('/api/events/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', service: 'events-api' });
    } catch {
      res.status(503).json({ status: 'db_unavailable', service: 'events-api' });
    }
  });

  const deps = { db, identity };
  app.use('/api/events', createAuth({ identity, jwtSecret }));
  app.use('/api/events', meRouter(deps));
  app.use('/api/events/events', eventsRouter(deps));
  app.use('/api/events/events', eventPartsRouter(deps));
  app.use('/api/events/dashboard', dashboardRouter(deps));
  app.use('/api/events/clients', clientsRouter(deps));

  // Неизвестный адрес внутри сервиса — внятный 404, а не HTML-заглушка.
  app.use('/api/events', (req, res, next) => next(new HttpError(404, 'Нет такого адреса в сервисе мероприятий')));
  app.use(errorMiddleware);
  return app;
}

module.exports = { createApp };
