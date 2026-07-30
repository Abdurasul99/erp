import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  // For sellers: if a session-branch is chosen, attach it to every request
  // so the backend scopes data and writes to the correct branch.
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const branchId = localStorage.getItem('seller_branch_id');
    if (user?.role === 'seller' && branchId) {
      const method = (cfg.method || 'get').toLowerCase();
      if (method === 'get' || method === 'delete') {
        cfg.params = { ...(cfg.params || {}), branch_id: branchId };
      } else if (cfg.data && typeof cfg.data === 'object' && !(cfg.data instanceof FormData)) {
        cfg.data = { ...cfg.data, branch_id: branchId };
      }
    }
  } catch {}
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    // НЕ разлогиниваем на случайный 401 от произвольного эндпоинта — раньше это
    // давало «самопроизвольный логаут»: один сбойный запрос стирал токен и кидал
    // на /login. ЕДИНСТВЕННОЕ исключение — явный вердикт сервера об одиночной
    // сессии (вход с другого устройства / токен старого формата): это осознанное
    // серверное решение, не сетевой сбой — завершаем сессию и объясняем причину.
    const code = err.response?.data?.code;
    if (err.response?.status === 401 && (code === 'SESSION_REVOKED' || code === 'SESSION_STALE')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = code === 'SESSION_REVOKED' ? '/login?reason=session' : '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
