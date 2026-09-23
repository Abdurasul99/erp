import axios from 'axios';

// Клиент сервиса «Мероприятия» (events-api, адреса /api/events/*).
//
// Токен тот же, что выдал общий вход, — он лежит в localStorage. Отдельный
// экземпляр axios, а не общий api.js Wave: у того свои перехватчики для
// продавцов и филиалов, которые здесь не нужны и не должны сюда протекать.
const eventsApi = axios.create({ baseURL: '/api/events' });

eventsApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Разлогиниваем только по ЯВНОМУ решению сервера — как в Wave: случайный сбой
// сети не должен выкидывать человека на экран входа.
const END_SESSION_CODES = new Set(['SESSION_REVOKED', 'SESSION_STALE', 'COMPANY_DISABLED', 'PRODUCT_MISMATCH']);
const REASON = {
  SESSION_REVOKED: 'session',
  SESSION_STALE: 'session',
  COMPANY_DISABLED: 'company-disabled',
  PRODUCT_MISMATCH: 'session',
};

eventsApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.data?.code;
    if (END_SESSION_CODES.has(code)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = `/login?reason=${REASON[code]}`;
    }
    return Promise.reject(err);
  },
);

// Текст ошибки для человека: сервер уже отдаёт его по-русски.
export function errorText(err, fallback = 'Не удалось выполнить действие') {
  if (!err?.response) return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  return err.response.data?.error || fallback;
}

export default eventsApi;
