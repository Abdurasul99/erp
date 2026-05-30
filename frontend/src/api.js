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
    if (err.response?.status === 401) {
      // Clear session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect from /auth/me (App.jsx handles it) and don't loop on /login
      const url = err.config?.url || '';
      const onLogin = window.location.pathname === '/login';
      if (!url.includes('/auth/me') && !onLogin) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
