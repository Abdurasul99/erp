import React, { useContext, useState, useEffect, useRef, createContext } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getSectionsForRole } from './modules.js';
import api from '../api.js';
import './styles.css';

import Dashboard from './pages/Dashboard.jsx';
import SectionHome from './SectionHome.jsx';
import ToolRouter from './ToolRouter.jsx';
import AiChatDrawer from './AiChatDrawer.jsx';
import AiChatPage from './pages/AiChatPage.jsx';

// BranchScope — what slice of data the current view is showing.
export const BranchScope = createContext({
  branchId: null,
  setBranchId: () => {},
  branches: [],
  role: 'manager',
  isOwner: false,
});

export default function OwnerShell() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = user?.role;
  const isOwner = role === 'founder' || role === 'gen_dir';

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => {
    if (role === 'manager') return user?.branch_id || null;
    return null;
  });

  // Sidebar collapse — persisted to localStorage so the choice survives reloads.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('owner_sidebar_collapsed') === '1');
  useEffect(() => { localStorage.setItem('owner_sidebar_collapsed', collapsed ? '1' : '0'); }, [collapsed]);

  // AI chat drawer state
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    api.get('/branches').then(r => setBranches(r.data || [])).catch(() => {});
  }, [isOwner]);

  const sections = getSectionsForRole(role);
  const parts = pathname.split('/').filter(Boolean);
  const activeSection = parts[1] || 'dashboard';

  const initials = (user?.first_name || user?.username || 'U').slice(0, 2).toUpperCase();
  const roleLabel = ({ founder: 'Учредитель', gen_dir: 'Ген. директор', manager: 'Менеджер' })[role] || role;

  const currentBranchName = (() => {
    if (role === 'manager') return user?.branch_name || 'Мой филиал';
    if (!branchId) return 'Все филиалы';
    const b = branches.find(x => x.id === branchId);
    return b?.name || '...';
  })();

  return (
    <BranchScope.Provider value={{ branchId, setBranchId, branches, role, isOwner }}>
      <div className={'owner-shell' + (collapsed ? ' collapsed' : '')}>
        <aside className="o-sidebar">
          <div className="o-brand" onClick={() => navigate('/owner')}>
            <div className="o-brand-ico">📊</div>
            {!collapsed && (
              <div>
                <div className="o-brand-name">{user?.company_name || 'WareApp'}</div>
                <div className="o-brand-sub">ERP · {roleLabel}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 4 }}>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => navigate('/owner/' + (s.id === 'dashboard' ? '' : s.id))}
                className={'o-link' + (activeSection === s.id ? ' active' : '')}
                title={collapsed ? s.title : undefined}
              >
                <span className="o-link-ico">{s.icon}</span>
                {!collapsed && <span>{s.title}</span>}
                {!collapsed && s.tools.length > 0 && <span className="o-link-badge">{s.tools.length}</span>}
              </button>
            ))}

            {isOwner && (
              <button
                onClick={() => navigate('/owner/ai')}
                className={'o-link' + (activeSection === 'ai' ? ' active' : '')}
                title={collapsed ? 'AI-помощник' : undefined}
                style={activeSection === 'ai' ? undefined : {
                  background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(91,79,232,.18))',
                  color: '#fff',
                  marginTop: 8,
                }}
              >
                <span className="o-link-ico">🤖</span>
                {!collapsed && <span>AI-помощник</span>}
                {!collapsed && <span className="o-link-badge" style={{ background: 'linear-gradient(135deg, #FF6B2B, #F59E0B)' }}>NEW</span>}
              </button>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Quick AI popup — only for founder/gen_dir. Manager has no AI access. */}
            {isOwner && (
              <button onClick={() => setAiOpen(true)} className="o-link" style={{
                background: 'linear-gradient(135deg, #7c3aed, #5B4FE8)',
                color: '#fff', fontWeight: 800,
              }} title={collapsed ? 'Быстрый AI-чат' : undefined}>
                <span className="o-link-ico">⚡</span>
                {!collapsed && <span>Быстрый чат</span>}
                {!collapsed && <span className="o-link-badge" style={{ background: 'rgba(255,255,255,.25)' }}>popup</span>}
              </button>
            )}

            {/* Collapse toggle */}
            <button onClick={() => setCollapsed(c => !c)} className="o-link" style={{ fontSize: 12 }} title={collapsed ? 'Развернуть' : 'Свернуть'}>
              <span className="o-link-ico">{collapsed ? '»' : '«'}</span>
              {!collapsed && <span>Свернуть панель</span>}
            </button>

            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.6)', fontSize: 11, padding: '4px 12px' }}>
                <span className="o-dot" />
                Все системы в норме
              </div>
            )}
          </div>
        </aside>

        <div className="o-main">
          <header className="o-topbar">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="o-topbar-title">
                {(sections.find(s => s.id === activeSection) || sections[0])?.icon}{' '}
                {(sections.find(s => s.id === activeSection) || sections[0])?.title}
              </div>
              <div className="o-topbar-sub">
                {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {isOwner ? (
              <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
            ) : (
              <div className="o-branch-pick" title="Менеджер видит только свой филиал">
                🏭 {currentBranchName}
              </div>
            )}

            <div className="o-user" onClick={logout} title="Выйти" style={{ cursor: 'pointer' }}>
              <div className="o-avatar">{initials}</div>
              <div style={{ lineHeight: 1.2, fontSize: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                </div>
                <div style={{ color: 'var(--text3)' }}>{roleLabel}</div>
              </div>
            </div>
          </header>

          <main className="o-content">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="ai" element={isOwner ? <AiChatPage /> : <Navigate to="/owner" replace />} />
              <Route path=":sectionId" element={<SectionHome />} />
              <Route path=":sectionId/:toolId" element={<ToolRouter />} />
              <Route path="*" element={<Navigate to="/owner" replace />} />
            </Routes>
          </main>

          {/* AI drawer guarded — manager can never trigger it because the button is hidden, but extra-safe block here too */}
        </div>

        {isOwner && <AiChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} />}
      </div>
    </BranchScope.Provider>
  );
}

function BranchPicker({ branches, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = value == null
    ? { icon: '🌐', label: 'Все филиалы', sub: branches.length ? `${branches.length} филиал${branches.length === 1 ? '' : 'ов'}` : null }
    : (() => {
        const b = branches.find(x => x.id === value);
        return { icon: '🏭', label: b?.name || '...', sub: 'Один филиал' };
      })();

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="o-branch-pick"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{current.icon}</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{current.label}</span>
            {current.sub && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{current.sub}</span>}
          </span>
        </span>
        <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(26,27,46,.12), 0 4px 8px rgba(26,27,46,.06)',
          zIndex: 200, minWidth: 220, padding: 4, maxHeight: 360, overflowY: 'auto',
        }}>
          <BranchOption
            active={value == null}
            icon="🌐" title="Все филиалы"
            sub="Сводка по всей компании"
            onClick={() => { onChange(null); setOpen(false); }}
          />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {branches.length === 0
            ? <div style={{ padding: '14px 10px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Нет филиалов</div>
            : branches.map(b => (
              <BranchOption key={b.id}
                active={value === b.id}
                icon="🏭" title={b.name}
                sub="Только этот филиал"
                onClick={() => { onChange(b.id); setOpen(false); }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function BranchOption({ active, icon, title, sub, onClick }) {
  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', cursor: 'pointer', borderRadius: 8,
        background: active ? 'var(--primary-50)' : 'transparent',
        outline: 'none',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{sub}</div>
      </div>
      {active && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
    </div>
  );
}
