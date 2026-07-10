// Конфиг симулятора. Все значения переопределяются через env.
// По умолчанию рассчитан на запуск НА СЕРВЕРЕ рядом с WareApp (бьёт в localhost:3001).

// Подхватываем env реального бэкенда (DB-креды, JWT_SECRET) — чтобы минтить ВАЛИДНЫЕ
// токены и ходить в ту же БД, что и WareApp. Парсим backend/.env вручную (без dotenv).
(function loadBackendEnv() {
  try {
    const fs = require('fs'); const path = require('path');
    const p = process.env.SIM_WAREAPP_ENV || path.join(__dirname, '..', '..', 'backend', '.env');
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          let v = m[2];
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    }
  } catch {}
})();

module.exports = {
  // Куда бьёт нагрузка — реальный WareApp API.
  apiBase: process.env.SIM_API_BASE || 'http://127.0.0.1:3001/api',

  // Bootstrap-админ WareApp (создаёт компании). Дефолт из migrations/001_init.sql.
  admin: {
    username: process.env.SIM_ADMIN_USER || 'admin',
    password: process.env.SIM_ADMIN_PASS || 'admin123',
  },

  // Прямое подключение к БД — только для cleanup [SIM]-данных (НЕ для записи нагрузки).
  db: {
    database: process.env.DB_NAME || 'warehouse',
    user: process.env.DB_USER || 'wareapp_user',
    password: process.env.DB_PASS,
    host: process.env.DB_HOST || '127.0.0.1',
    port: +(process.env.DB_PORT || 5432),
    max: 6,
  },

  controlPort: +(process.env.SIM_PORT || 4000),  // HTTP control-API + раздача панели
  mqttPort: +(process.env.SIM_MQTT_PORT || 1883), // Aedes TCP (только localhost)
  wsPort: +(process.env.SIM_WS_PORT || 8888),     // Aedes over WebSocket (только localhost)
  brokerHost: '127.0.0.1',                        // брокер слушает ТОЛЬКО локально (без внешнего publish)

  // Секрет доступа к панели/control-API. Без него /api/sim/* открыт всем — НЕ деплоить так.
  // Панель открывается по http://<сервер>:4000/?key=<SIM_TOKEN>.
  controlToken: process.env.SIM_TOKEN || '',

  // Сколько одновременных API-запросов держит консьюмер (потолок нагрузки).
  concurrency: +(process.env.SIM_CONCURRENCY || 60),

  // Секрет JWT WareApp — минтим токены напрямую (как harness.js), чтобы не упереться
  // в rate-limit логина (10/15мин на IP) при создании десятков симуляторных юзеров.
  jwtSecret: process.env.JWT_SECRET || '',

  // Пометка всех симуляторных сущностей — для очистки и чтобы не трогать реальные данные.
  simTag: '[SIM]',

  // Дефолтные пароли симуляторных юзеров (валидны: >=8, буква+цифра).
  defaultPassword: process.env.SIM_PASS || 'Sim12345',

  // Стартовый остаток на товар (большой, чтобы продажи не упирались в «нет стока»).
  initialStock: +(process.env.SIM_INIT_STOCK || 100000),
};
