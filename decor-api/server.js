'use strict';

// Сервис «Декор» (Dora Decor): /api/decor/* на 127.0.0.1:3003, своя база wave_decor.
// Wave не трогает и от Wave не зависит: свой секрет токенов, свой вход /decor/login.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// «Сегодня» для брони и сроков модуль считает по часам сервера (common.js → todayYmd)
if (!process.env.TZ) process.env.TZ = 'Asia/Tashkent';

function fatal(message) {
  console.error(`decor-api: FATAL — ${message}`);
  process.exit(1);
}

if (process.env.DECOR_TEST_HOOKS === '1' && process.env.NODE_ENV === 'production') {
  fatal('DECOR_TEST_HOOKS=1 на рабочем сервере запрещён (тест-хуки ломают действия намеренно)');
}
if (!process.env.DECOR_DB_PASS) fatal('DECOR_DB_PASS не задан в .env');

// Фото и видео — доказательства по заказам клиентов. Папка не должна попасть туда,
// что отдаётся без входа: Wave раздаёт backend/uploads, nginx — frontend/dist.
const { UPLOAD_DIR } = require('./decor/uploads');
const publicDir = /[\\/](backend[\\/]uploads|frontend[\\/]dist)([\\/]|$)/;
if (publicDir.test(UPLOAD_DIR)) fatal(`DECOR_UPLOADS_DIR=${UPLOAD_DIR} — это публичная папка, фото увидят без входа`);

const { createApp } = require('./src/app');

let app;
try {
  app = createApp({ jwtSecret: process.env.DECOR_JWT_SECRET });
} catch (e) {
  fatal(e.message);
}

const HOST = process.env.DECOR_HOST || '127.0.0.1';
const PORT = Number(process.env.DECOR_PORT) || 3003;
app.listen(PORT, HOST, () => {
  console.log(`decor-api слушает ${HOST}:${PORT}, TZ=${process.env.TZ}, файлы: ${UPLOAD_DIR}`);
});
