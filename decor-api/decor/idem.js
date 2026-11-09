// Защита от повторной отправки (ключ идемпотентности; таблица decor_idempotency — миграция D23).
// Клиент шлёт заголовок Idempotency-Key: один ключ на одно действие, тот же ключ — при повторе этого действия.
// Ключ записывается в ТОЙ ЖЕ транзакции, что и действие (common.tx(fn, req)): сохраняется всё или ничего.
//   • тот же ключ, другое тело запроса (отпечаток request_hash) или другой адрес → 409 idem_mismatch, ничего не выполняется;
//   • ключ уже выполнен (done) → повтор получает первый ответ, дубль не создаётся (заголовок Idempotent-Replay: true);
//   • тот же ключ выполняется прямо сейчас (двойное нажатие) → второй запрос ждёт окончания первого (до 2 минут)
//     и получает его ответ; дольше 2 минут → 409 idem_running;
//   • status='running' старше 2 минут считается failed — повтор выполняется заново;
//   • строки старше 30 дней удаляются при старте сервера и раз в сутки.
const crypto = require('crypto');
const { httpError } = require('./common');

const KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;
const WAIT = '120s';                 // сколько повтор ждёт уже идущий запрос с тем же ключом
const KEEP_DAYS = 30;
let POOL = null;

class IdemReplay extends Error {
  constructor(row) { super('idempotent replay'); this.idemReplay = row; }
}

// Отпечаток запроса: метод, адрес и тело (ключи по алфавиту); для загрузки файлов — имена, размеры и типы файлов
const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
    : JSON.stringify(v ?? null));
// Поля с паролем в отпечаток не попадают (быстрый sha256 пароля в базе позволил бы подобрать слабый пароль)
const redact = v => (Array.isArray(v) ? v.map(redact) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /pass/i.test(k) ? '[скрыто]' : redact(x)])) : v);
function requestHash(req) {
  const files = (req.files || []).map(f => ({ n: f.originalname, s: f.size, t: f.mimetype }));
  return crypto.createHash('sha256').update(`${req.method}\n${req.idem.path}\n${canon(redact(req.body || {}))}\n${canon(files)}`).digest('hex');
}
const pk = req => [req.decor.cid, req.user.id, req.idem.key];

// Таблица ключей есть? Миграция D23 ОБЯЗАТЕЛЬНА (решение 2026-10-24): без таблицы защита не выключается молча —
// /api/decor/health показывает ошибку, а записывающий запрос с ключом получает 503 и не выполняется.
let TABLE_OK = null;          // null — ещё не проверяли
async function checkTable() {
  const was = TABLE_OK;
  try { TABLE_OK = (await POOL.query("SELECT to_regclass('public.decor_idempotency') IS NOT NULL AS ok")).rows[0].ok; } catch { TABLE_OK = false; }
  if (!TABLE_OK && was !== false) console.error('decor idem: НЕТ таблицы decor_idempotency (миграция D23) — записывающие действия с ключом отвечают 503');
  return TABLE_OK;
}
const UNAVAILABLE = { error: 'Защита от повторной отправки не установлена на сервере (миграция D23). Действие не выполнено — сообщите администратору.', code: 'idem_unavailable' };

// Ключ ОБЯЗАТЕЛЕН для каждого записывающего запроса (решение 2026-10-24): проверка стоит в контексте доступа
// (access.js) для всех POST/PUT/PATCH/DELETE /api/decor/*, кроме EXEMPT — новый маршрут не может её «забыть».
// Без ключа — 400 idem_missing, без таблицы — 503 idem_unavailable; действие не выполняется.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT = new Set([
  '/api/decor/calc/preview',          // предрасчёт калькулятора — только читает
  '/api/decor/auth/change-password',  // смена своего пароля — повтор безвреден, экрана пока нет
  '/api/decor/ai/chat',               // вопрос ИИ — ничего не записывает
]);
const needsKey = req => WRITE_METHODS.has(req.method) && !EXEMPT.has(req.originalUrl.split('?')[0]);
const MISSING = { error: 'Нет ключа повторной отправки (Idempotency-Key) — действие не выполнено. Обновите страницу и повторите.', code: 'idem_missing' };

// Разбирает ключ и сохраняет первый ответ для повторов (один раз на запрос; повторный вызов на маршруте — пропуск)
function middleware(req, res, next) {
  if (req.idemChecked) return next();
  const key = req.get('Idempotency-Key');
  if (!key) return needsKey(req) ? res.status(400).json(MISSING) : next();
  if (!TABLE_OK) {   // перепроверить (могли применить D23 без перезапуска); нет таблицы — 503
    return checkTable().then(okNow => (okNow ? middleware(req, res, next) : res.status(503).json(UNAVAILABLE))).catch(next);
  }
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Неверный ключ повтора (Idempotency-Key)', code: 'idem_bad_key' });
  req.idemChecked = true;
  req.idem = { key, method: req.method, path: req.originalUrl.split('?')[0], claimed: false };
  const json = res.json.bind(res);
  res.json = body => {
    if (req.idem.claimed && res.statusCode < 500) {
      POOL.query(`UPDATE decor_idempotency SET http_status=$4, response=$5 WHERE company_id=$1 AND user_id=$2 AND idem_key=$3 AND status='done'`,
        [...pk(req), res.statusCode, JSON.stringify(body)]).catch(e => console.error('decor idem save', e.message));
    } else if (!req.idem.claimed && res.statusCode < 300 && !res.get('Idempotent-Replay')) {
      // Маршрут принял ключ, но не записал его в транзакции (нет txFor) — повтор такого действия не защищён
      console.error(`decor idem: ${req.method} ${req.idem.path} выполнен без записи ключа (нужен txFor(req))`);
      if (process.env.DECOR_TEST_HOOKS === '1') res.set('X-Idem-Unclaimed', 'true');
    }
    return json(body);
  };
  next();
}

// В транзакции действия, до него: занять ключ
async function claim(c, req) {
  req.idem.hash = requestHash(req);
  await c.query(`SET LOCAL lock_timeout = '${WAIT}'`);
  const ins = await c.query(`INSERT INTO decor_idempotency (company_id, user_id, idem_key, method, path, request_hash)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING 1`, [...pk(req), req.idem.method, req.idem.path, req.idem.hash]);
  if (!ins.rowCount) {
    // Ключ уже есть (если первый запрос ещё шёл — INSERT дождался его конца)
    const { rows: [row] } = await c.query(`SELECT *, (NOW() - created_at) > INTERVAL '2 minutes' AS stale
      FROM decor_idempotency WHERE company_id=$1 AND user_id=$2 AND idem_key=$3 FOR UPDATE`, pk(req));
    if (row.method !== req.idem.method || row.path !== req.idem.path || row.request_hash !== req.idem.hash) {
      throw httpError(409, 'Этот ключ повтора уже использован для другого действия или с другими данными — ничего не выполнено', { code: 'idem_mismatch' });
    }
    if (row.status === 'done') throw new IdemReplay(row);
    if (row.status === 'running' && !row.stale) throw httpError(409, 'Это действие уже выполняется — подождите и обновите экран', { code: 'idem_running' });
    // failed или зависший running (старше 2 минут) — выполнить заново
    await c.query(`UPDATE decor_idempotency SET status='running', created_at=NOW(), finished_at=NULL, result=NULL, http_status=NULL, response=NULL
      WHERE company_id=$1 AND user_id=$2 AND idem_key=$3`, pk(req));
  }
  req.idem.claimed = true;
}

// В той же транзакции, после действия: отметить выполненным (result — что создано или изменено)
async function finish(c, req, result) {
  await c.query(`UPDATE decor_idempotency SET status='done', result=$4, finished_at=NOW() WHERE company_id=$1 AND user_id=$2 AND idem_key=$3`,
    [...pk(req), JSON.stringify(result ?? null)]);
}

// Повтор выполненного: первый ответ (он сохраняется сразу после ответа — подождём его до 3 с)
async function sendReplay(req, res, row) {
  let r = row;
  for (let i = 0; i < 15 && !r.response; i++) {
    await new Promise(ok => setTimeout(ok, 200));
    r = (await POOL.query('SELECT * FROM decor_idempotency WHERE company_id=$1 AND user_id=$2 AND idem_key=$3', pk(req))).rows[0] || r;
  }
  res.set('Idempotent-Replay', 'true');
  if (r.response) return res.status(r.http_status || 200).json(r.response);
  return res.status(200).json({ idempotent_replay: true, result: r.result });
}

// Хуки для теста повторов — работают ТОЛЬКО при DECOR_TEST_HOOKS=1 (на рабочем сервере не включать):
// X-Test-Hook: fail-before-commit — «падение посреди действия» (всё откатывается); delay-<мс> — пауза перед COMMIT.
async function testHook(req) {
  if (process.env.DECOR_TEST_HOOKS !== '1') return;
  const h = req.get('X-Test-Hook') || '';
  if (h === 'fail-before-commit') throw httpError(500, 'Тест: падение посреди действия');
  const m = h.match(/^delay-(\d{1,5})$/);
  if (m) await new Promise(ok => setTimeout(ok, Number(m[1])));
}

// Очистка ключей старше 30 дней: при старте и раз в сутки
function startCleanup() {
  const run = () => POOL.query(`DELETE FROM decor_idempotency WHERE created_at < NOW() - INTERVAL '${KEEP_DAYS} days'`)
    .then(r => { if (r.rowCount) console.log(`decor idem: удалено старых ключей ${r.rowCount}`); })
    .catch(e => { if (e.code !== '42P01') console.error('decor idem cleanup', e.message); });
  setTimeout(run, 10000).unref();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}

function init(pool) {
  POOL = pool;
  checkTable();
  setInterval(checkTable, 5 * 60 * 1000).unref();   // после применения D23 защита включится без перезапуска (до 5 минут)
  startCleanup();
}

module.exports = { init, middleware, needsKey, claim, finish, sendReplay, testHook, requestHash, checkTable, IdemReplay };
