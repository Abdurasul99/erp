// Сфера «Декор» (/decor/*): свой вход и токен базы сферы, оболочка Wave (верхняя панель + нижний док),
// инструменты — изолированные экраны. Подключение в App.jsx Wave — 2 строки (patches/App.jsx.patch).
import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import api, { TOKEN_KEY, store } from './api.js';
import { DecorCtx, useToast, Loading, Hero, NoAccess, section } from './kit.jsx';
import { TopBar, Dock, Login, Tools, logoutNow } from './shell.jsx';
import { UpdateBanner } from './update.jsx';
import Home from './home/Home.jsx';
import Warehouse from './warehouse/Warehouse.jsx';
import Calc from './calc/Calc.jsx';
import Orders from './orders/Orders.jsx';
import Booking from './booking/Booking.jsx';
import Finance from './finance/Finance.jsx';
import Team from './team/Team.jsx';
import Settings from './settings/Settings.jsx';
import Reports from './reports/Reports.jsx';
import AI from './ai/AI.jsx';
import './decor.css';

// Раздел с функцией компании: выключена админом Wave — баннер и пояснение вместо экрана
function Guard({ id, children }) {
  const s = section(id);
  const { me } = React.useContext(DecorCtx);
  if (s.feature && !me.features.includes(s.feature)) {
    return <><Hero id={id} /><NoAccess err={{ response: { data: { code: 'feature_off', error: `«${s.feature}»` } } }} /></>;
  }
  return children;
}

function Shell() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [hints, setHints] = useState(0);
  const [toast, show] = useToast();
  const loadMe = useCallback(() => api.get('/auth/me').then(r => { setMe(r.data); setErr(null); }).catch(setErr), []);
  const refreshHints = useCallback(() => api.get('/hints').then(r => setHints(r.data.length)).catch(() => setHints(0)), []);
  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { if (me?.features.includes('decor-ai')) refreshHints(); }, [me, refreshHints]);
  if (!me) return <div className="dd"><main className="dd-page"><Loading err={err} retry={loadMe} /></main></div>;
  const ctx = { me, can: a => me.permissions.includes(a), reloadMe: loadMe, toast: show, logout: logoutNow, refreshHints };
  return (
    <DecorCtx.Provider value={ctx}>
      <div className="dd">
        <TopBar hints={hints} />
        <UpdateBanner />
        <main className="dd-page">
          <Routes>
            <Route index element={<Home />} />
            <Route path="tools" element={<Tools />} />
            <Route path="calc" element={<Guard id="calc"><Calc /></Guard>} />
            <Route path="warehouse" element={<Guard id="decor"><Warehouse /></Guard>} />
            <Route path="orders" element={<Guard id="orders"><Orders /></Guard>} />
            <Route path="booking" element={<Guard id="booking"><Booking /></Guard>} />
            <Route path="finance" element={<Guard id="finance"><Finance /></Guard>} />
            <Route path="team" element={<Guard id="team"><Team /></Guard>} />
            <Route path="settings" element={<Guard id="settings"><Settings /></Guard>} />
            <Route path="reports" element={<Guard id="reports"><Reports /></Guard>} />
            <Route path="ai" element={<Guard id="ai"><AI /></Guard>} />
            <Route path="*" element={<Navigate to="/decor" replace />} />
          </Routes>
        </main>
        <Dock />
        {toast}
      </div>
    </DecorCtx.Provider>
  );
}

export default function DecorApp() {
  return (
    <Routes>
      <Route path="login" element={store.get(TOKEN_KEY) ? <Navigate to="/decor" replace /> : <Login />} />
      <Route path="*" element={store.get(TOKEN_KEY) ? <Shell /> : <Navigate to="/decor/login" replace />} />
    </Routes>
  );
}
