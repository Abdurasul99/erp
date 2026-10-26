// API сферы «Декор» (/api/decor/*): свой токен базы сферы (не смешивается с токеном Wave и учебного центра).
import axios from 'axios';

export const TOKEN_KEY = 'decor_token';
export const USER_KEY = 'decor_user';
export const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* недоступно */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* недоступно */ } },
};

const api = axios.create({ baseURL: '/api/decor', timeout: 30000 });
api.interceptors.request.use(cfg => {
  const token = store.get(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !String(err.config?.url).includes('/auth/login')) {
    store.del(TOKEN_KEY); store.del(USER_KEY);
    window.location.href = '/decor/login';
  }
  return Promise.reject(err);
});

export const errText = (e, fallback) => e?.response?.data?.error || fallback;

// Ключ повтора (Idempotency-Key) для записывающих действий. crypto.randomUUID есть только на https и localhost —
// иначе (телефон по адресу в сети) запасной вариант из того же набора символов.
export const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`);
export const errCode = e => e?.response?.data?.code || null;
export default api;
