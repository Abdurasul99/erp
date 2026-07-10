import React, { useContext, useState, useEffect, useRef, createContext } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getUserSections } from './modules.js';
import { useTt } from './tt.js';
import { PageHeaderContext } from './PageHeaderContext.js';
import api from '../api.js';
import './styles.css';

import Dashboard from './pages/Dashboard.jsx';
import SectionHome from './SectionHome.jsx';
import ToolRouter from './ToolRouter.jsx';
import AiChatDrawer from './AiChatDrawer.jsx';
import AiChatPage from './pages/AiChatPage.jsx';

// BranchScope — what slice of data the current view is showing.
// Также несёт глобальный период (preset или произвольный диапазон дат) — он
// живёт в шелле и доступен всем окнам через контекст.
export const BranchScope = createContext({
  branchId: null,
  setBranchId: () => {},
  branches: [],
  role: 'manager',
  isOwner: false,
  period: 'month',
  periodFrom: null,
  periodTo: null,
  periodLabel: '',
  setPeriod: () => {},
  setCustomRange: () => {},
});

export const PERIOD_PRESETS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
  { value: 'all',   label: 'Всё' },
];

function presetRange(p) {
  const now = new Date();
  let from = null;
  // Все окна начинаются с полуночи (setHours 0) — чтобы совпадать с бэкендом (periodRangeUnified)
  // и не расходиться по цифрам с «Дашбордом учредителя»/отчётами.
  if (p === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (p === 'week') { from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0); }
  // 'month' = последние 30 дней (скользящее окно) — чтобы свежая активность была видна,
  // даже если продажи пришлись на конец прошлого месяца. Единый канон с бэкендом.
  else if (p === 'month') { from = new Date(now); from.setDate(now.getDate() - 30); from.setHours(0, 0, 0, 0); }
  else if (p === 'year') { from = new Date(now); from.setFullYear(now.getFullYear() - 1); from.setHours(0, 0, 0, 0); }
  return { from: from ? from.toISOString() : null, to: null };
}

export default function OwnerShell() {
  const { user, logout } = useContext(AuthContext);
  const { tt, lang, changeLang } = useTt();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = user?.role;
  const isOwner = role === 'founder' || role === 'director';

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => {
    if (role === 'manager') return user?.branch_id || null;
    return null;
  });

  // Глобальный период: preset ('today'…'all') ИЛИ 'custom' с произвольным диапазоном.
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const setCustomRange = (f, t) => { setCustomFrom(f); setCustomTo(t); setPeriod('custom'); };
  const range = period === 'custom'
    ? { from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : null,
        to: customTo ? new Date(customTo + 'T23:59:59.999').toISOString() : null }
    : presetRange(period);
  const periodLabel = period === 'custom'
    ? (customFrom && customTo ? `${customFrom} — ${customTo}` : tt('Период'))
    : tt(PERIOD_PRESETS.find(p => p.value === period)?.label || '');

  // Sidebar collapse — persisted to localStorage so the choice survives reloads.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('owner_sidebar_collapsed') === '1');
  useEffect(() => { localStorage.setItem('owner_sidebar_collapsed', collapsed ? '1' : '0'); }, [collapsed]);

  // AI chat drawer state
  const [aiOpen, setAiOpen] = useState(false);

  // Заголовок текущей страницы — «публикуется» компонентом PageHeader в топбар.
  const [pageHead, setPageHead] = useState({ title: '', sub: null, actions: null });

  useEffect(() => {
    if (!isOwner) return;
    api.get('/branches').then(r => setBranches(r.data || [])).catch(() => {});
  }, [isOwner]);

  // Гранулярные доступы: учредитель/админ мог скрыть конкретные инструменты и/или AI этому пользователю.
  const aiEnabled = user?.ai_enabled !== false;
  // Роль + персональные blocked_tools + инструменты, отключённые учредителем для компании.
  const sections = getUserSections(user);
  const parts = pathname.split('/').filter(Boolean);
  const activeSection = parts[1] || 'dashboard';
  // Кнопка периода нужна только там, где данные зависят от периода: Главная, Аналитика,
  // Финансы, Закупки, Склад, Продажи/Операции. На остальных (Маркетинг, Персонал,
  // Клиентский сервис, Настройки) её быть не должно.
  const showPeriod = ['dashboard', 'analytics', 'finance', 'procurement', 'warehouse', 'operations'].includes(activeSection);

  const initials = (user?.first_name || user?.username || 'U').slice(0, 2).toUpperCase();
  const roleLabel = tt(({ founder: 'Учредитель', director: 'Директор', manager: 'Менеджер' })[role] || role);

  const currentBranchName = (() => {
    if (role === 'manager') return user?.branch_name || tt('Мой филиал');
    if (!branchId) return tt('Все филиалы');
    const b = branches.find(x => x.id === branchId);
    return b?.name || '...';
  })();

  return (
    <BranchScope.Provider value={{ branchId, setBranchId, branches, role, isOwner, period, periodFrom: range.from, periodTo: range.to, periodLabel, setPeriod, customFrom, customTo, setCustomRange }}>
     <PageHeaderContext.Provider value={setPageHead}>
      <div className={'owner-shell' + (collapsed ? ' collapsed' : '') + (aiOpen && isOwner ? ' ai-open' : '')}>
        <aside className="o-sidebar">
          <div className="o-brand" onClick={() => navigate('/owner')}>
            <div className="o-brand-ico">🌊</div>
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
                {!collapsed && <span>{tt(s.title)}</span>}
                {!collapsed && s.tools.length > 0 && <span className="o-link-badge">{s.tools.length}</span>}
              </button>
            ))}

            {isOwner && aiEnabled && (
              <button
                onClick={() => navigate('/owner/ai')}
                className={'o-link' + (activeSection === 'ai' ? ' active' : '')}
                title={collapsed ? tt('AI-помощник') : undefined}
                style={activeSection === 'ai' ? undefined : {
                  background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(29,78,216,.18))',
                  color: '#fff',
                  marginTop: 8,
                }}
              >
                <span className="o-link-ico">🤖</span>
                {!collapsed && <span>{tt('AI-помощник')}</span>}
                {!collapsed && <span className="o-link-badge" style={{ background: 'linear-gradient(135deg, #D97706, #D97706)' }}>NEW</span>}
              </button>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Quick AI popup — only for founder/director с включённым AI. Manager has no AI access. */}
            {isOwner && aiEnabled && (
              <button onClick={() => setAiOpen(true)} className="o-link" style={{
                background: 'linear-gradient(135deg, #1D4ED8, #1D4ED8)',
                color: '#fff', fontWeight: 800,
              }} title={collapsed ? tt('Быстрый чат') : undefined}>
                <span className="o-link-ico">⚡</span>
                {!collapsed && <span>{tt('Быстрый чат')}</span>}
                {!collapsed && <span className="o-link-badge" style={{ background: 'rgba(255,255,255,.25)' }}>popup</span>}
              </button>
            )}

            {/* Collapse toggle */}
            <button onClick={() => setCollapsed(c => !c)} className="o-link" style={{ fontSize: 12 }} title={collapsed ? tt('Развернуть') : tt('Свернуть')}>
              <span className="o-link-ico">{collapsed ? '»' : '«'}</span>
              {!collapsed && <span>{tt('Свернуть панель')}</span>}
            </button>

            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.6)', fontSize: 11, padding: '4px 12px' }}>
                <span className="o-dot" />
                {tt('Все системы в норме')}
              </div>
            )}
          </div>
        </aside>

        <div className="o-main">
          <header className="o-topbar">
            {/* Заголовок текущей страницы — вынесен сюда из контента (PageHeader → топбар).
                Ведущий эмодзи названия выносим в иконку-квадрат — как в макетах (.h-icon). */}
            {(() => {
              const raw = pageHead.title;
              const s = typeof raw === 'string' ? raw : '';
              const sp = s.indexOf(' ');
              const head = sp > 0 ? s.slice(0, sp) : '';
              const isEmoji = head && !/[\p{L}\p{N}]/u.test(head);
              const ico = isEmoji ? head : null;
              const name = isEmoji ? s.slice(sp + 1) : raw;
              if (!raw) return <div style={{ minWidth: 0, flex: 1 }} />;
              return (
                <div className="o-topbar-head">
                  {ico && <div className="o-topbar-ico">{ico}</div>}
                  <div className="o-topbar-copy">
                    <div className="o-topbar-title">{name}</div>
                    {pageHead.sub && <div className="o-topbar-sub" title={typeof pageHead.sub === 'string' ? pageHead.sub : undefined}>{pageHead.sub}</div>}
                  </div>
                </div>
              );
            })()}

            {pageHead.actions && <div className="o-topbar-actions">{pageHead.actions}</div>}

            {/* Фильтр периода — только в разделах, где данные зависят от периода. */}
            {showPeriod && (
              <PeriodFilter period={period} setPeriod={setPeriod} customFrom={customFrom} customTo={customTo}
                setCustomRange={setCustomRange} periodLabel={periodLabel} tt={tt} />
            )}

            {/* Переключатель языка RU / UZ */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 8, padding: 3 }}>
              {['ru', 'uz'].map(l => (
                <button key={l} type="button" onClick={() => changeLang && changeLang(l)}
                  style={{
                    border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 6,
                    fontWeight: 800, fontSize: 11, fontFamily: 'inherit',
                    background: lang === l ? 'var(--surface, #fff)' : 'transparent',
                    color: lang === l ? 'var(--primary)' : 'var(--text3)',
                    boxShadow: lang === l ? 'var(--shadow-sm)' : 'none',
                  }}>
                  {l === 'ru' ? 'RU' : 'UZ'}
                </button>
              ))}
            </div>

            {isOwner ? (
              <BranchPicker branches={branches} value={branchId} onChange={setBranchId} tt={tt} />
            ) : (
              <div className="o-branch-pick" title={tt('Менеджер видит только свой филиал')}>
                🏭 {currentBranchName}
              </div>
            )}

            <div className="o-user" onClick={logout} title={tt('Выйти')} style={{ cursor: 'pointer' }}>
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
              <Route path="ai" element={isOwner && aiEnabled ? <AiChatPage /> : <Navigate to="/owner" replace />} />
              <Route path=":sectionId" element={<SectionHome />} />
              <Route path=":sectionId/:toolId" element={<ToolRouter />} />
              <Route path="*" element={<Navigate to="/owner" replace />} />
            </Routes>
          </main>

          {/* AI drawer guarded — manager can never trigger it because the button is hidden, but extra-safe block here too */}
        </div>

        {isOwner && aiEnabled && <AiChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} />}
      </div>
     </PageHeaderContext.Provider>
    </BranchScope.Provider>
  );
}

// Глобальный фильтр периода в топбаре: быстрые пресеты + произвольный диапазон (календарь).
function PeriodFilter({ period, setPeriod, customFrom, customTo, setCustomRange, periodLabel, tt }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(customFrom || '');
  const [t, setT] = useState(customTo || '');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEffect(() => { setF(customFrom || ''); setT(customTo || ''); }, [customFrom, customTo]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="o-branch-pick"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        📅 {periodLabel} <span style={{ opacity: .6 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,.14)', padding: 12, minWidth: 240,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {PERIOD_PRESETS.map(p => (
              <button key={p.value} type="button" onClick={() => { setPeriod(p.value); setOpen(false); }}
                style={{
                  border: 'none', cursor: 'pointer', padding: '6px 11px', borderRadius: 8, fontFamily: 'inherit',
                  fontWeight: 700, fontSize: 12,
                  background: period === p.value ? 'var(--primary)' : 'var(--bg-2)',
                  color: period === p.value ? '#fff' : 'var(--text2)',
                }}>{tt(p.label)}</button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{tt('Произвольный период')}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="date" className="input" value={f} max={t || undefined} onChange={e => setF(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '6px 8px' }} />
              <span style={{ color: 'var(--text3)' }}>—</span>
              <input type="date" className="input" value={t} min={f || undefined} onChange={e => setT(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '6px 8px' }} />
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={!f || !t}
              onClick={() => { if (f && t) { setCustomRange(f, t); setOpen(false); } }}>
              {tt('Применить')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchPicker({ branches, value, onChange, tt }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = value == null
    ? { icon: '🌐', label: tt('Все филиалы'), sub: branches.length ? `${branches.length} ${tt('Филиал').toLowerCase()}` : null }
    : (() => {
        const b = branches.find(x => x.id === value);
        return { icon: '🏭', label: b?.name || '...', sub: tt('Один филиал') };
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
            icon="🌐" title={tt('Все филиалы')}
            sub={tt('Сводка по всей компании')}
            onClick={() => { onChange(null); setOpen(false); }}
          />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {branches.length === 0
            ? <div style={{ padding: '14px 10px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{tt('Нет филиалов')}</div>
            : branches.map(b => (
              <BranchOption key={b.id}
                active={value === b.id}
                icon="🏭" title={b.name}
                sub={tt('Только этот филиал')}
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
