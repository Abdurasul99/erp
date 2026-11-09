// Модуль сферы «Декор» (Dora Decor): REST /api/decor/* поверх своей базы (wave_decor).
// Подключение в server.js (одна строка рядом с модулем учебного центра, см. patches/server.js.patch):
//   require('./decor')(app, { auth, authLimiter, JWT_SECRET });
// Основной pool (warehouse) модуль не использует: база берётся из sphere_db по ключу 'decor'.
// sphereGuard (sphere_db.js) пускает токен сферы 'decor' только в /api/decor/*, /api/m/* и /api/health.
// Полномочия проверяются на сервере по матрице должностей (access.js); формулы — только formulas.js.
const { getPool } = require('../sphere_db');
const F = require('./formulas');
const { loadCompany } = require('./data');
const makeCommon = require('./common');
const makeAccess = require('./access');

const SPHERE = 'decor';

module.exports = function mountDecor(app, { auth, authLimiter, JWT_SECRET }) {
  let pool;
  try {
    pool = getPool(SPHERE);
  } catch (e) {
    console.error('decor module disabled:', e.message);
    app.use('/api/decor', (req, res) => res.status(503).json({ error: 'Сфера «Декор» не настроена на сервере' }));
    return;
  }
  if (!pool) throw new Error('Сфера decor должна иметь свою базу (db как объект в spheres.json)');

  // Данные компании + модель формул на сегодня (один раз на запрос)
  const loadModel = async (req, db = pool) => {
    const data = await loadCompany(db, req.decor.cid);
    return { data, m: F.model(data, makeCommon.todayYmd()) };
  };
  // Защита от повторной отправки (D23): idem — middleware записывающих маршрутов, ключ пишется в транзакции действия
  const idemMod = require('./idem');
  idemMod.init(pool);
  const ctx = { app, pool, auth, authLimiter, JWT_SECRET, SPHERE, loadModel, idem: idemMod.middleware,
    ...makeCommon(pool), ...makeAccess({ pool, auth, SPHERE }) };

  require('./core')(ctx);        // вход, «кто я», смена пароля
  require('./settings')(ctx);    // нормы и курс, полномочия, ставки, управление панелью
  require('./staff')(ctx);       // сотрудники и их входы
  require('./items')(ctx);       // декор: цена, ресурс, износ, остатки
  require('./designs')(ctx);     // готовые дизайны: состав вещей с количествами (D26)
  Object.assign(ctx, require('./evidence')(ctx));   // доказательства (фото/видео): требования, проверка, «добавить» (D24)
  require('./orders')(ctx);      // заказы, канбан, карточка, статусы и закрытие, калькулятор
  require('./warehouse')(ctx);   // заявки на сборку, выдача и возвраты, бронь, свободно на дату
  require('./money')(ctx);       // оплаты, ПМ → касса (с фото чека), касса, себестоимость, фонд материалов
  require('./reports')(ctx);     // фото и видео отчёты, одобрение → начисления
  require('./team')(ctx);        // сдельная оплата: начисления и выплаты
  require('./hints')(ctx);       // подсказки Wave Intelligence и главная
  require('./ai')(ctx);          // ИИ-помощник Wave Intelligence: вопросы по данным компании (только чтение)

  // Здоровье сферы: база и обязательная защита от повторной отправки (таблица decor_idempotency, D23)
  app.get('/api/decor/health', async (req, res) => {
    try {
      const { rows: [r] } = await pool.query(`SELECT (SELECT array_agg(version ORDER BY version) FROM schema_migrations) AS v,
        to_regclass('public.decor_idempotency') IS NOT NULL AS idem`);
      if (!r.idem) {
        return res.status(503).json({ status: 'db_error', sphere: SPHERE, migrations: r.v,
          error: 'Нет таблицы decor_idempotency: миграция D23 обязательна — без неё защита от повторной отправки не работает' });
      }
      res.json({ status: 'ok', sphere: SPHERE, migrations: r.v });
    } catch (e) { res.status(503).json({ status: 'db_error', error: e.message }); }
  });
  console.log('decor module mounted at /api/decor');
};
