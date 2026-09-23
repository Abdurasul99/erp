import React, { useCallback, useContext, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
// Единственная точка связи с остальным приложением — общий вход (AuthContext).
// Всё прочее «Мероприятия» берут только из своей папки src/events.
import { AuthContext } from '../App.jsx';
import eventsApi, { errorText } from './api.js';
import { SECTIONS } from './access.js';
import { Button, Empty, Loading, ErrorAlert } from './ui.jsx';
import './events.css';

const Dashboard = lazy(() => import('./screens/Dashboard.jsx'));
const Orders = lazy(() => import('./screens/Orders.jsx'));
const OrderCard = lazy(() => import('./screens/OrderCard.jsx'));
const Calendar = lazy(() => import('./screens/Calendar.jsx'));

export const EventsContext = React.createContext(null);

export default function EventsShell() {
  const { logout } = useContext(AuthContext);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    eventsApi.get('/me')
      .then(({ data }) => setMe(data))
      .catch((e) => setError(errorText(e, 'Не удалось загрузить профиль')));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Меню — пересечение матрицы доступа роли (решает сервер) и готовых экранов.
  const sections = useMemo(
    () => (me ? SECTIONS.filter((s) => s.ready && me.screens.includes(s.id)) : []),
    [me],
  );

  if (error) {
    return (
      <div className="ev-app">
        <main className="ev-main">
          <ErrorAlert>{error}</ErrorAlert>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button onClick={load}>Повторить</Button>
            <Button variant="ghost" onClick={logout}>Выйти</Button>
          </div>
        </main>
      </div>
    );
  }
  if (!me) return <div className="ev-app"><Loading /></div>;

  const u = me.user;
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
  const home = sections[0] ? `/events/${sections[0].path}` : null;

  return (
    <EventsContext.Provider value={{ me }}>
      <div className="ev-app">
        <header className="ev-header">
          <div className="ev-header-row">
            <div className="ev-brand">
              <div className="ev-brand-mark" aria-hidden="true">{(u.company_name || 'М').slice(0, 1).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="ev-brand-name">{u.company_name}</div>
                <div className="ev-brand-sub">Панель руководителя проектов</div>
              </div>
            </div>
            <div className="ev-header-spacer" />
            <div className="ev-user">
              <div className="ev-user-text">
                <div className="ev-user-name">{fullName}</div>
                <div className="ev-user-role">{u.role_label}</div>
              </div>
              {/* В режиме «войти как» выход делает полоса WoW внизу экрана. */}
              {!u.act_as && <Button variant="ghost" size="sm" onClick={logout}>Выйти</Button>}
            </div>
          </div>
          {sections.length > 1 && (
            <nav className="ev-nav" aria-label="Разделы">
              {sections.map((s) => (
                <NavLink key={s.id} to={`/events/${s.path}`} end={s.path === ''}>{s.label}</NavLink>
              ))}
            </nav>
          )}
        </header>

        <main className="ev-main">
          <Suspense fallback={<Loading />}>
            <Routes>
              {sections.some((s) => s.id === 'dash') && <Route index element={<Dashboard />} />}
              {sections.some((s) => s.id === 'order') && (
                <>
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:id" element={<OrderCard />} />
                </>
              )}
              {sections.some((s) => s.id === 'cal') && <Route path="calendar" element={<Calendar />} />}
              <Route path="*" element={home ? <Navigate to={home} replace /> : <NoScreens role={u.role_label} />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </EventsContext.Provider>
  );
}

// Роль, чьи разделы ещё не построены (монтажник: склад и этапы). Честно говорим
// об этом, а не показываем пустую страницу или чужой экран.
function NoScreens({ role }) {
  return (
    <Empty title="Разделы для вашей роли готовятся">
      Для роли «{role}» основные разделы — склад и этапы работ. Они появятся в ближайшем обновлении.
    </Empty>
  );
}
