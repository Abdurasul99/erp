import React, { createContext, useContext, useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import InterfaceSelect from './pages/InterfaceSelect.jsx';
import SellerBranchPicker from './pages/SellerBranchPicker.jsx';
// Тяжёлые «оболочки» грузятся лениво — каждая роль качает только свой код:
// касса/продавец не тянут owner+admin бандл и наоборот. Уменьшает первый бандл.
const Desktop    = lazy(() => import('./pages/Desktop.jsx'));
const Mobile     = lazy(() => import('./pages/Mobile.jsx'));
const SellerView = lazy(() => import('./pages/SellerView.jsx'));
const OwnerShell = lazy(() => import('./owner/OwnerShell.jsx'));
const AdminShell = lazy(() => import('./admin/AdminShell.jsx'));
const Storefront = lazy(() => import('./store/Storefront.jsx'));
import { isPublicStorefrontPath } from './store/storeRouting.mjs';
import { getLang, setLang } from './i18n.js';
import { TaskInboxProvider } from './hooks/useTaskInbox.jsx';
import api from './api.js';

export const AuthContext = createContext(null);
export const LangContext = createContext(null);

function RequireAuth({ children }) {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RootRedirect() {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'seller') {
    return <Navigate to={localStorage.getItem('seller_branch_id') ? '/sell' : '/select-branch'} replace />;
  }
  if (['founder', 'director', 'manager'].includes(user.role)) return <Navigate to="/owner" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/select" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useContext(AuthContext);
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function RequireSellerBranch({ children }) {
  const { user } = useContext(AuthContext);
  if (user?.role === 'seller' && !localStorage.getItem('seller_branch_id')) {
    return <Navigate to="/select-branch" replace />;
  }
  return children;
}

// Block sellers from /desktop and /mobile (they belong on /sell).
// Without this they land on a broken Desktop view with no section tabs.
function RequireNonSeller({ children }) {
  const { user } = useContext(AuthContext);
  if (user?.role === 'seller') return <Navigate to="/sell" replace />;
  return children;
}

// Owner roles (founder/director/manager) now belong on /owner with the new shell.
// If they hit /desktop directly (bookmark, old link) — bounce them to /owner.
// Admin still uses /desktop because AdminPanel is admin-only.
function RequireNotOwner({ children }) {
  const { user } = useContext(AuthContext);
  if (['founder', 'director', 'manager'].includes(user?.role)) return <Navigate to="/owner" replace />;
  // Admin now has a single, dedicated shell at /admin (dashboard + company/staff
  // management + features + audit). Keep them out of the staff /desktop shell.
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

// Сплеш первой загрузки: «волна собирает бренд». Логотип компании берём из кэша
// прошлой сессии (localStorage.user) — постоянный пользователь видит СВОЮ компанию,
// самый первый визит — волну Wave. Чистый CSS/SVG (без framer) — сплеш обязан быть
// легче самого приложения, которое он прикрывает. out=true → мягкое растворение.
function Splash({ out = false }) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('user') || 'null'); } catch { /* повреждённый кэш — не критично */ }
  const logoUrl = cached?.company_logo_url;
  const name = cached?.company_name || 'Wave ERP';
  const letter = (name || 'W').slice(0, 1).toUpperCase();
  const uz = getLang() === 'uz';
  return (
    <div className={'wv-splash' + (out ? ' wv-out' : '')}>
      <div className="wv-center">
        <div className="wv-logo">
          {logoUrl
            ? <img src={logoUrl} alt="" />
            : <span className="wv-letter">{letter}</span>}
        </div>
        <svg className="wv-wave" viewBox="0 0 120 24" fill="none" aria-hidden="true">
          <path d="M4 14.5c9-16 15-16 21 0s12 16 21 0 12-15 21 0 12 16 21 0 8.5-12.5 17-5"
            stroke="url(#wvg)" strokeWidth="2.6" strokeLinecap="round" pathLength="100" />
          <defs>
            <linearGradient id="wvg" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0A84FF" /><stop offset="1" stopColor="#5E5CE6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="wv-name">{name}</div>
        <div className="wv-tag">{uz ? 'ERP · biznesingiz yuklanmoqda…' : 'ERP · загружаем ваш бизнес…'}</div>
        <div className="wv-bar"><span /></div>
      </div>
      <style>{`
        .wv-splash {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', 'Nunito', -apple-system, sans-serif;
          background:
            radial-gradient(900px 520px at 82% -8%, rgba(10,132,255,.08), transparent 60%),
            radial-gradient(760px 500px at -6% 106%, rgba(175,82,222,.06), transparent 56%),
            #F4F4F6;
          transition: opacity .45s ease, transform .45s ease;
        }
        .wv-splash.wv-out { opacity: 0; transform: scale(1.03); pointer-events: none; }
        .wv-center { text-align: center; }
        .wv-logo {
          width: 76px; height: 76px; margin: 0 auto; border-radius: 22px;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          background: linear-gradient(135deg, #0A84FF, #5E5CE6);
          box-shadow: 0 18px 44px -12px rgba(10, 132, 255, .55);
          animation: wvPop .7s cubic-bezier(.22, 1.4, .36, 1) both;
        }
        .wv-logo img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
        .wv-letter { color: #fff; font-size: 34px; font-weight: 800; letter-spacing: -.02em; }
        .wv-wave { width: 150px; height: 30px; margin: 14px auto 2px; display: block; }
        .wv-wave path {
          stroke-dasharray: 100; stroke-dashoffset: 100;
          animation: wvDraw 1s cubic-bezier(.45, 0, .2, 1) .25s forwards, wvFlow 2.4s ease-in-out 1.4s infinite;
        }
        .wv-name {
          font-size: 21px; font-weight: 800; letter-spacing: -.02em; color: #141419;
          animation: wvUp .55s cubic-bezier(.22, 1, .36, 1) .45s both;
        }
        .wv-tag {
          font-size: 11.5px; font-weight: 600; color: #8E8E96; margin-top: 5px;
          text-transform: uppercase; letter-spacing: .09em;
          animation: wvUp .55s cubic-bezier(.22, 1, .36, 1) .6s both;
        }
        .wv-bar {
          width: 132px; height: 3px; border-radius: 980px; margin: 18px auto 0;
          background: rgba(20, 20, 40, .08); overflow: hidden;
          animation: wvUp .5s ease .75s both;
        }
        .wv-bar span {
          display: block; height: 100%; width: 40%; border-radius: 980px;
          background: linear-gradient(90deg, #0A84FF, #5E5CE6);
          animation: wvSlide 1.1s ease-in-out .8s infinite;
        }
        @keyframes wvPop { from { opacity: 0; transform: scale(.55) translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes wvDraw { to { stroke-dashoffset: 0; } }
        @keyframes wvFlow { 0%, 100% { stroke-dashoffset: 0; opacity: 1; } 50% { stroke-dashoffset: -8; opacity: .75; } }
        @keyframes wvUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes wvSlide { 0% { margin-left: -45%; } 100% { margin-left: 105%; } }
        @media (prefers-reduced-motion: reduce) { .wv-splash * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
      `}</style>
    </div>
  );
}

function StorefrontLoading() {
  return (
    <div aria-label="Загрузка ART Store" style={{
      minHeight: '100vh', background: '#F3EFE6', color: '#171713',
      display: 'grid', placeItems: 'center', fontFamily: "'Cormorant Garamond', serif",
    }}>
      <div style={{ textAlign: 'center', fontSize: 24, letterSpacing: '.12em' }}>ART Store</div>
    </div>
  );
}

function PublicStorefrontApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<StorefrontLoading />}>
        <Routes>
          <Route path="/store" element={<Storefront />} />
          <Route path="/art-store" element={<Navigate to="/store" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Плашка режима «войти как» (WoW). Видна во всех оболочках, пока активна impersonation.
const IMP_ROLE_LABEL = {
  founder: 'Учредитель', director: 'Директор', manager: 'Менеджер',
  cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};
function ImpersonationBanner() {
  const { user, stopImpersonate } = useContext(AuthContext);
  const navigate = useNavigate();
  if (!user?.act_as) return null;
  const back = () => { stopImpersonate(); navigate('/admin'); };
  const where = [user.company_name, user.branch_name].filter(Boolean).join(' / ');
  return (
    <div className="wow-imp-bar" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap',
      padding: '9px 16px', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
      boxShadow: '0 -4px 18px rgba(0,0,0,.28)',
    }}>
      <span>👁 Режим WoW — вы вошли как <b>{IMP_ROLE_LABEL[user.role] || user.role}</b>{where ? <> · {where}</> : null}</span>
      <button onClick={back} style={{
        background: '#fff', color: '#7C3AED', border: 'none', borderRadius: 8,
        padding: '5px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12,
      }}>← Вернуться в WoW</button>
    </div>
  );
}

function ErpApp() {
  // Start with no user — verification happens on mount
  // Мгновенная гидрация сессии из кэша: пока идёт ФОНОВАЯ проверка /auth/me,
  // пользователь уже «залогинен» по кэшированному профилю. Это убирает
  // самопроизвольный логаут — вкладку могло перезагрузить (типично на мобильном,
  // когда браузер выгружает фоновую вкладку), а при медленной сети /auth/me
  // отвечает не сразу; раньше в этот момент показывался /login.
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem('token')) return null;
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  // Блокируем рендер сплэшем ТОЛЬКО если есть токен, но кэша профиля нет
  // (редкий случай — сразу после логина кэш всегда есть). Иначе рисуем сразу из кэша.
  const [authChecking, setAuthChecking] = useState(() => {
    return !!localStorage.getItem('token') && !localStorage.getItem('user');
  });
  const [lang, setLangState] = useState(getLang());

  // Verify token on mount: if valid, populate user; if invalid, clear and proceed to login.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAuthChecking(false); return; }
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          // Сервер ЯВНО сказал: токен невалиден — разлогиниваем по-настоящему.
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        } else {
          // Сеть моргнула / сервер недоступен (типично на мобильном при
          // возврате в браузер: вкладка перезагружается, а радио ещё спит).
          // НЕ разлогиниваем — продолжаем на кэшированном профиле; если токен
          // на самом деле мёртв, ближайший запрос получит 401 и интерсептор
          // в api.js корректно отправит на /login.
          try {
            const cached = JSON.parse(localStorage.getItem('user') || 'null');
            if (cached) setUser(cached);
          } catch { /* повреждённый кэш — просто покажем /login */ }
        }
      })
      .finally(() => { if (!cancelled) setAuthChecking(false); });
    return () => { cancelled = true; };
  }, []);

  // Seller's branch choice is valid for the day only.
  // After local midnight: clear it and force the picker on next interaction.
  // Avoids the case where a seller carries the phone to another branch the next day.
  useEffect(() => {
    const todayStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const check = () => {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u?.role !== 'seller') return;
      const pickedDate = localStorage.getItem('seller_branch_picked_date');
      if (pickedDate && pickedDate !== todayStr()) {
        localStorage.removeItem('seller_branch_id');
        localStorage.removeItem('seller_branch_name');
        localStorage.removeItem('seller_branch_picked_date');
        if (!window.location.pathname.startsWith('/select-branch') &&
            !window.location.pathname.startsWith('/login')) {
          window.location.href = '/select-branch';
        }
      }
    };
    check();
    const id = setInterval(check, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('seller_branch_id');
    localStorage.removeItem('seller_branch_name');
    localStorage.removeItem('seller_branch_picked_date');
    localStorage.removeItem('wow_admin_token');
    localStorage.removeItem('wow_admin_user');
    setUser(null);
  };

  // WoW «войти как»: подменяем активную сессию scoped-токеном компании, сохранив
  // админ-сессию, чтобы можно было вернуться. Бэкенд минтит токен с act_as.
  const impersonate = (userData, token) => {
    if (!localStorage.getItem('wow_admin_token')) {
      localStorage.setItem('wow_admin_token', localStorage.getItem('token') || '');
      localStorage.setItem('wow_admin_user', localStorage.getItem('user') || '');
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  // Возврат из режима «войти как» обратно в WoW-админку.
  const stopImpersonate = () => {
    const t = localStorage.getItem('wow_admin_token');
    const u = localStorage.getItem('wow_admin_user');
    localStorage.removeItem('wow_admin_token');
    localStorage.removeItem('wow_admin_user');
    localStorage.removeItem('seller_branch_id');
    localStorage.removeItem('seller_branch_name');
    localStorage.removeItem('seller_branch_picked_date');
    if (t) {
      localStorage.setItem('token', t);
      localStorage.setItem('user', u || 'null');
      setUser(u ? JSON.parse(u) : null);
    } else {
      logout();
    }
  };

  const changeLang = (l) => {
    setLang(l);
    setLangState(l);
  };

  // Сплеш-анимация бренда при первой загрузке: живёт минимум 1.1с (чтобы анимация
  // «прочиталась», а не мигнула), затем мягко растворяется над УЖЕ готовым
  // приложением. Один экземпляр на всё время — анимация не перезапускается.
  const [splashVisible, setSplashVisible] = useState(() => !!localStorage.getItem('token'));
  const [splashOut, setSplashOut] = useState(false);
  const splashStart = useRef(Date.now());
  useEffect(() => {
    // Шаг 1: приложение готово → дождаться минимума показа и запустить растворение.
    if (!authChecking && splashVisible && !splashOut) {
      const wait = Math.max(0, 1100 - (Date.now() - splashStart.current));
      const t = setTimeout(() => setSplashOut(true), wait);
      return () => clearTimeout(t);
    }
  }, [authChecking, splashVisible, splashOut]);
  useEffect(() => {
    // Шаг 2 (отдельным эффектом — иначе смена splashOut чистила бы таймер удаления):
    // после растворения снять оверлей из DOM.
    if (splashOut) {
      const t = setTimeout(() => setSplashVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [splashOut]);

  // Пока идёт проверка токена — приложение не рендерим (иначе мигнёт /login на
  // устаревшем токене), виден только сплеш. Сплеш — ВСЕГДА вторым ребёнком
  // фрагмента: React сохраняет его экземпляр при появлении приложения, и
  // анимация продолжается без перезапуска до самого растворения.
  return (
    <>
    {!authChecking && (
    <AuthContext.Provider value={{ user, login, logout, impersonate, stopImpersonate }}>
      <LangContext.Provider value={{ lang, changeLang }}>
        {/* Инбокс задач — один на всё приложение: колокольчик стоит и в панели
            (OwnerShell), и в staff-навбаре, и оба должны видеть один счётчик,
            иначе поллинг /notifications/count пойдёт в два потока. Внутри
            AuthContext — провайдер читает оттуда пользователя. */}
        <TaskInboxProvider>
          <BrowserRouter>
            <ImpersonationBanner />
            <Suspense fallback={<Splash />}>
              <Routes>
                <Route path="/login" element={user ? <RootRedirect /> : <Login />} />
                <Route path="/select" element={<RequireAuth><RequireNonSeller><InterfaceSelect /></RequireNonSeller></RequireAuth>} />
                <Route path="/desktop" element={<RequireAuth><RequireNonSeller><RequireNotOwner><Desktop /></RequireNotOwner></RequireNonSeller></RequireAuth>} />
                <Route path="/mobile" element={<RequireAuth><RequireNonSeller><Mobile /></RequireNonSeller></RequireAuth>} />
                <Route path="/select-branch" element={<RequireAuth><SellerBranchPicker /></RequireAuth>} />
                <Route path="/sell" element={<RequireAuth><RequireSellerBranch><SellerView /></RequireSellerBranch></RequireAuth>} />
                <Route path="/owner/*" element={<RequireAuth><RequireNonSeller><OwnerShell /></RequireNonSeller></RequireAuth>} />
                <Route path="/admin/*" element={<RequireAuth><RequireAdmin><AdminShell /></RequireAdmin></RequireAuth>} />
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TaskInboxProvider>
      </LangContext.Provider>
    </AuthContext.Provider>
    )}
    {(authChecking || splashVisible) && <Splash out={splashOut} />}
    </>
  );
}

export default function App() {
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  return isPublicStorefrontPath(pathname) ? <PublicStorefrontApp /> : <ErpApp />;
}
