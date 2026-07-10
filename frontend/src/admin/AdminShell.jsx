import React, { useContext, useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import '../owner/styles.css';

import AdminDashboard from './pages/AdminDashboard.jsx';
import CompanyDetail from './pages/CompanyDetail.jsx';
import FeatureFlags from './pages/FeatureFlags.jsx';
import AuditLog from './pages/AuditLog.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import TeamPage from './pages/TeamPage.jsx';

const SECTIONS = [
  { id: 'dashboard', icon: '🏠', title: 'Главная',          desc: 'Сводка по всем клиентам' },
  { id: 'team',      icon: '👥', title: 'Наша команда',     desc: 'Сотрудники WoW · доступ ко всем' },
  { id: 'companies', icon: '🏢', title: 'Компании-клиенты', desc: 'Создать/изменить · филиалы · доступы' },
  { id: 'features',  icon: '🚦', title: 'Фичи · тарифы',     desc: 'Включить премиум клиенту' },
  { id: 'audit',     icon: '📋', title: 'Журнал действий',   desc: 'Операции пользователей' },
];

export default function AdminShell() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin_sidebar_collapsed') === '1');
  useEffect(() => { localStorage.setItem('admin_sidebar_collapsed', collapsed ? '1' : '0'); }, [collapsed]);

  const parts = pathname.split('/').filter(Boolean);
  const activeSection = parts[1] || 'dashboard';
  const initials = (user?.first_name || user?.username || 'A').slice(0, 2).toUpperCase();

  return (
    <div className={'owner-shell' + (collapsed ? ' collapsed' : '')}>
      <aside className="o-sidebar" style={{ background: 'linear-gradient(180deg, #4338ca 0%, #1e1b4b 100%)' }}>
        <div className="o-brand" onClick={() => navigate('/admin')}>
          <div className="o-brand-ico" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', fontWeight: 900, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>W</div>
          {!collapsed && (
            <div>
              <div className="o-brand-name" style={{ letterSpacing: '.5px' }}>WoW</div>
              <div className="o-brand-sub">Панель управления</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 4 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => navigate('/admin/' + (s.id === 'dashboard' ? '' : s.id))}
              className={'o-link' + (activeSection === s.id ? ' active' : '')}
              title={collapsed ? s.title : undefined}
            >
              <span className="o-link-ico">{s.icon}</span>
              {!collapsed && <span>{s.title}</span>}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              {(SECTIONS.find(s => s.id === activeSection) || SECTIONS[0])?.icon}{' '}
              {(SECTIONS.find(s => s.id === activeSection) || SECTIONS[0])?.title}
            </div>
            <div className="o-topbar-sub">WoW · панель управления · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
          </div>

          <div className="o-branch-pick" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', color: '#fff', border: 'none', cursor: 'default' }}>
            WoW · все компании
          </div>

          <div className="o-user" onClick={logout} title="Выйти" style={{ cursor: 'pointer' }}>
            <div className="o-avatar">{initials}</div>
            <div style={{ lineHeight: 1.2, fontSize: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{user?.username}</div>
              <div style={{ color: 'var(--text3)' }}>Администратор</div>
            </div>
          </div>
        </header>

        <main className="o-content">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="team" element={<TeamPage />} />
            {/* Companies+branches+staff CRUD (was a separate /desktop screen) now lives here. */}
            <Route path="companies" element={<AdminPanel />} />
            <Route path="companies/:id" element={<CompanyDetail />} />
            <Route path="features" element={<FeatureFlags />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
