// Тонкий клиент WareApp API на undici (keep-alive пул соединений для высокой пропускной способности).
// На сервере бьёт в localhost — сетевого боттлнека нет, меряем реальную ёмкость сервера/БД.
const { Agent, request } = require('undici');
const cfg = require('./config');

// Много keep-alive соединений: позволяет держать десятки in-flight запросов.
const agent = new Agent({
  connections: 256,
  pipelining: 1,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 120_000,
  bodyTimeout: 30_000,
  headersTimeout: 30_000,
});

// Базовый вызов. Возвращает { status, body, raw, ms }.
async function api(method, path, token, body) {
  const t0 = Date.now();
  try {
    const res = await request(cfg.apiBase + path, {
      method,
      dispatcher: agent,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const raw = await res.body.text();
    let json = null;
    try { json = raw ? JSON.parse(raw) : null; } catch {}
    return { status: res.statusCode, body: json, raw, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, body: null, raw: String(e && e.message || e), ms: Date.now() - t0, err: e };
  }
}

// Логин с кэшем токенов по username (24ч живёт, нам хватает на прогон).
const tokenCache = new Map();
async function login(username, password) {
  if (tokenCache.has(username)) return tokenCache.get(username);
  const r = await api('POST', '/auth/login', null, { username, password });
  if (r.status !== 200 || !r.body || !r.body.token) {
    throw new Error(`login ${username} failed: HTTP ${r.status} ${r.raw?.slice(0, 160)}`);
  }
  const out = { token: r.body.token, user: r.body.user };
  tokenCache.set(username, out);
  return out;
}

function clearTokens() { tokenCache.clear(); }

module.exports = { api, login, clearTokens, agent };
