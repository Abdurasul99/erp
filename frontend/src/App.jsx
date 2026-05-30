import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import InterfaceSelect from './pages/InterfaceSelect.jsx';
import Desktop from './pages/Desktop.jsx';
import Mobile from './pages/Mobile.jsx';
import SellerView from './pages/SellerView.jsx';
import SellerBranchPicker from './pages/SellerBranchPicker.jsx';
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
  if (['admin', 'founder', 'gen_dir', 'manager'].includes(user.role)) return <Navigate to="/desktop" replace />;
  return <Navigate to="/select" replace />;
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

function Splash() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1e1b4b 0%, #3730a3 50%, #4338ca 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: '64px', height: '64px', margin: '0 auto 16px',
          border: '4px solid rgba(255,255,255,.2)', borderTopColor: '#fff',
          borderRadius: '50%', animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: '14px', fontWeight: 700, opacity: .8 }}>ERP System</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
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
    setUser(null);
  };

  const changeLang = (l) => {
    setLang(l);
    setLangState(l);
  };

  // Block rendering until token check completes — prevents Desktop flash on stale token
  if (authChecking) return <Splash />;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <LangContext.Provider value={{ lang, changeLang }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <RootRedirect /> : <Login />} />
            <Route path="/select" element={<RequireAuth><RequireNonSeller><InterfaceSelect /></RequireNonSeller></RequireAuth>} />
            <Route path="/desktop" element={<RequireAuth><RequireNonSeller><Desktop /></RequireNonSeller></RequireAuth>} />
            <Route path="/mobile" element={<RequireAuth><RequireNonSeller><Mobile /></RequireNonSeller></RequireAuth>} />
            <Route path="/select-branch" element={<RequireAuth><SellerBranchPicker /></RequireAuth>} />
            <Route path="/sell" element={<RequireAuth><RequireSellerBranch><SellerView /></RequireSellerBranch></RequireAuth>} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </LangContext.Provider>
    </AuthContext.Provider>
  );
}
