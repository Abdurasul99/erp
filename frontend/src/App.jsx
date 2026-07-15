import React, { createContext, useContext, useState, useEffect, Suspense, lazy } from 'react';
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

function Splash() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0B1640 0%, #16307A 50%, #1E40AF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: '64px', height: '64px', margin: '0 auto 16px',
          border: '4px solid rgba(255,255,255,.2)', borderTopColor: '#fff',
          borderRadius: '50%', animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: '14px', fontWeight: 700, opacity: .8 }}>Wave ERP</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    <div style={{
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
  const [user, setUser] = useState(null);
  // If there's a token, we need to verify it before rendering routes
  const [authChecking, setAuthChecking] = useState(() => !!localStorage.getItem('token'));
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
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
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

  // Block rendering until token check completes — prevents Desktop flash on stale token
  if (authChecking) return <Splash />;

  return (
    <AuthContext.Provider value={{ user, login, logout, impersonate, stopImpersonate }}>
      <LangContext.Provider value={{ lang, changeLang }}>
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
      </LangContext.Provider>
    </AuthContext.Provider>
  );
}

export default function App() {
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  return isPublicStorefrontPath(pathname) ? <PublicStorefrontApp /> : <ErpApp />;
}
