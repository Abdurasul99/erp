import React, { useContext } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, useMotionValue } from 'framer-motion';
import { AuthContext } from '../App.jsx';
import { Icon } from '../owner/icons.jsx';
import { DockItem } from '../owner/Dock.jsx';
import '../owner/styles.css';

import AdminDashboard from './pages/AdminDashboard.jsx';
import CompanyDetail from './pages/CompanyDetail.jsx';
import FeatureFlags from './pages/FeatureFlags.jsx';
import AuditLog from './pages/AuditLog.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import TeamPage from './pages/TeamPage.jsx';
import BreakEven from './pages/BreakEven.jsx';

// Админ-шелл «WoW» — тот же Wave Bento-канон, что и клиентская панель
// (стеклянный топбар + macOS-док), но со своей идентичностью: фиолетово-розовый
// бренд WoW и свои duotone-градиенты разделов. Никаких эмодзи — только SVG-иконки.

const SECTIONS = [
  { id: 'dashboard', icon: 'home',     title: 'Главная',          desc: 'Сводка по всем клиентам',                grad: ['#7C3AED', '#EC4899'] },
  { id: 'team',      icon: 'users',    title: 'Наша команда',     desc: 'Сотрудники WoW · доступ ко всем',        grad: ['#BF5AF2', '#5E5CE6'] },
  { id: 'companies', icon: 'building', title: 'Компании-клиенты', desc: 'Создать/изменить · филиалы · доступы',   grad: ['#0A84FF', '#5E5CE6'] },
  { id: 'features',  icon: 'trophy',   title: 'Фичи · тарифы',     desc: 'Включить премиум клиенту',               grad: ['#FF9F0A', '#FF6B22'] },
  { id: 'break-even',icon: 'trending', title: 'Точка безубыточности', desc: 'Когда WoW выходит в плюс',            grad: ['#30D158', '#0A84FF'] },
  { id: 'audit',     icon: 'activity', title: 'Журнал действий',   desc: 'Операции пользователей',                 grad: ['#8E8E93', '#636366'] },
];
const grad = (s, deg = 135) => `linear-gradient(${deg}deg, ${s.grad[0]}, ${s.grad[1]})`;

function AdminDock({ activeSection, navigate }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <div className="dock-wrap">
      <motion.div
        className="dock"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38, delay: 0.15 }}
      >
        {SECTIONS.map((s) => (
          <DockItem
            key={s.id}
            title={s.title}
            icon={s.icon}
            bg={grad(s)}
            active={activeSection === s.id}
            mouseX={mouseX}
            onClick={() => navigate('/admin/' + (s.id === 'dashboard' ? '' : s.id))}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default function AdminShell() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const parts = pathname.split('/').filter(Boolean);
  const activeSection = parts[1] || 'dashboard';
  const current = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];
  const initials = (user?.first_name || user?.username || 'A').slice(0, 2).toUpperCase();

  return (
    <div className="owner-shell dock-shell">
      <div className="o-main">
        <header className="o-topbar">
          {/* Бренд WoW — фиолетово-розовая идентичность оператора платформы */}
          <div className="o-brand o-brand-top" onClick={() => navigate('/admin')}>
            <div className="o-brand-ico" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', boxShadow: '0 6px 16px -6px rgba(196, 58, 220, 0.7)' }}>
              <Icon name="sparkles" size={17} />
            </div>
            <div className="o-brand-copy">
              <div className="o-brand-name">WoW</div>
              <div className="o-brand-sub">Панель управления</div>
            </div>
          </div>

          <div className="o-topbar-head">
            <div className="o-topbar-copy">
              <div className="o-topbar-title">{current.title}</div>
              <div className="o-topbar-sub">{current.desc} · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
            </div>
          </div>

          <div className="o-branch-pick" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', color: '#fff', border: 'none', cursor: 'default' }}>
            Все компании
          </div>

          <div className="o-user" onClick={logout} title="Выйти" style={{ cursor: 'pointer' }}>
            <div className="o-avatar" style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>{initials}</div>
            <div style={{ lineHeight: 1.2, fontSize: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{user?.username}</div>
              <div style={{ color: 'var(--text3)' }}>Администратор</div>
            </div>
          </div>
        </header>

        <main className="o-content">
          <div className="o-section-page">
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="team" element={<TeamPage />} />
              {/* Companies+branches+staff CRUD (was a separate /desktop screen) now lives here. */}
              <Route path="companies" element={<AdminPanel />} />
              <Route path="companies/:id" element={<CompanyDetail />} />
              <Route path="features" element={<FeatureFlags />} />
              <Route path="break-even" element={<BreakEven />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <AdminDock activeSection={activeSection} navigate={navigate} />
    </div>
  );
}
