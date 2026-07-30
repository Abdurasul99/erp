import React, { useContext, useState, useEffect, useRef, createContext } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getUserSections, NAV_GROUPS } from './modules.js';
import { useTt } from './tt.js';
import { PageHeaderContext } from './PageHeaderContext.js';
import CommandPalette from './CommandPalette.jsx';
import { Icon, SECTION_ICON } from './icons.jsx';
import NotificationsBell from '../components/NotificationsBell.jsx';
import api from '../api.js';
import './styles.css';

import DashboardBento from './pages/DashboardBento.jsx';
import SectionHome from './SectionHome.jsx';
import ToolRouter from './ToolRouter.jsx';
import AiChatPage from './pages/AiChatPage.jsx';
import Dock from './Dock.jsx';
import StartMenu from './StartMenu.jsx';
import { ScrollTicks } from './ScrollTicks.jsx';

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

  // Скролл контента — для колонки штрихов (.o-ticks, стиль OpenAI Sora) справа.
  const contentRef = useRef(null);

  // AI chat drawer state
  // Меню профиля в топбаре (открывается по клику на аватар — раньше сразу был logout)
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Глобальный поиск по инструментам (Ctrl+K / Cmd+K)
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Launchpad всех инструментов (радужная кнопка в доке)
  const [lpOpen, setLpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
      if (e.key === 'Escape') setLpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  // Страница инструмента (/owner/:section/:tool) — контент не скроллится сам,
  // окно инструмента заполняет высоту и скроллится внутри (см. .o-content-tool).
  const isToolPage = parts.length >= 3 && parts[1] !== 'ai';
  // AI-воркспейс занимает весь вьюпорт оболочки (full-bleed, без внешних паддингов
  // и рамок) — «увеличено на экран», удобно смотреть и писать.
  const isAiPage = parts[1] === 'ai';
  // Кнопка периода нужна только там, где данные зависят от периода: Главная, Аналитика,
  // Финансы, Закупки, Склад, Продажи/Операции. На остальных (Маркетинг, Персонал,
  // Клиентский сервис, Настройки) её быть не должно.
  // 'myboard' сюда НЕ добавлять: у ролевого дашборда свои локальные периоды —
  // ведомость просит 'YYYY-MM', нарушения — day|week|month|year, глобальный
  // пресет ('Всё', произвольный диапазон) в них не ложится.
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
      <div className="owner-shell dock-shell">
        <div className="o-main">
          <header className="o-topbar">
            {/* Бренд — переехал из сайдбара (сайдбар заменён доком) */}
            <div className="o-brand o-brand-top" onClick={() => navigate('/owner')}>
              {user?.company_logo_url
                ? <img className="o-brand-logo" src={user.company_logo_url} alt="" />
                : <div className="o-brand-ico">{(user?.company_name || 'W').slice(0, 1).toUpperCase()}</div>}
              <div className="o-brand-copy">
                <div className="o-brand-name">{user?.company_name || 'WareApp'}</div>
                <div className="o-brand-sub">ERP · {roleLabel}</div>
              </div>
            </div>

            {/* Средняя зона: заголовок страницы + все контролы. Вынесена в отдельный
                флекс-блок, чтобы БРЕНД (слева) и ПРОФИЛЬ (справа) НИКОГДА не переносились
                на вторую строку — при нехватке места переносятся ТОЛЬКО контролы внутри
                этой зоны. Профиль учредителя всегда наверху справа, на любом экране. */}
            <div className="o-topbar-mid">
              {pageHead.title && (
                <div className="o-topbar-head">
                  <div className="o-topbar-copy">
                    <div className="o-topbar-title">{pageHead.title}</div>
                    {pageHead.sub && <div className="o-topbar-sub" title={typeof pageHead.sub === 'string' ? pageHead.sub : undefined}>{pageHead.sub}</div>}
                  </div>
                </div>
              )}

              <div className="o-topbar-controls">
                {pageHead.actions && <div className="o-topbar-actions">{pageHead.actions}</div>}

                {/* Глобальный поиск — Ctrl+K или клик */}
                <button type="button" className="o-search-btn" onClick={() => setPaletteOpen(true)} title={tt('Найти инструмент…')}>
                  <Icon name='search' size={15} />
                  <span>{tt('Поиск')}</span>
                  <kbd>Ctrl K</kbd>
                </button>

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

                {/* Кнопка AI в топбаре — открывает воркспейс Wave Intelligence. */}
                {isOwner && aiEnabled && (
                  <button type="button" className="o-ai-btn" onClick={() => navigate('/owner/ai')} title={tt('Wave Intelligence')}>
                    <Icon name='sparkles' size={16} />
                  </button>
                )}

                {/* Колокольчик задач. Для учредителя/директора/менеджера это
                    единственный вход в уведомления: своего окна задач в панели
                    нет, поэтому клик по событию ведёт на ролевой дашборд. */}
                <NotificationsBell variant="owner" onOpenTask={() => navigate('/owner/myboard/my-board')} />

                {/* Выбор филиала — прячем на странице AI (по просьбе клиента). */}
                {!isAiPage && (isOwner ? (
                  <BranchPicker branches={branches} value={branchId} onChange={setBranchId} tt={tt} />
                ) : (
                  <div className="o-branch-pick" title={tt('Менеджер видит только свой филиал')}>
                    {currentBranchName}
                  </div>
                ))}
              </div>
            </div>

            <div className="o-user-wrap" style={{ position: 'relative' }}>
              <div className="o-user" onClick={() => setUserMenuOpen(v => !v)} title={tt('Профиль')} style={{ cursor: 'pointer' }}>
                <div className="o-avatar">{initials}</div>
                <div className="o-user-text" style={{ lineHeight: 1.2, fontSize: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                  </div>
                  <div style={{ color: 'var(--text3)' }}>{roleLabel}</div>
                </div>
                <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text3)', transition: 'transform .15s', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
              </div>
              {userMenuOpen && (
                <>
                  {/* оверлей — клик вне меню закрывает */}
                  <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--surface)', borderRadius: 12, boxShadow: '0 14px 40px rgba(0,0,0,.18)', border: '1px solid var(--line, #E9EEF6)', minWidth: 230, zIndex: 200, overflow: 'hidden' }}>
                    {/* профиль-шапка */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line, #E9EEF6)', display: 'flex', gap: 11, alignItems: 'center' }}>
                      <div className="o-avatar" style={{ width: 42, height: 42, minWidth: 42, fontSize: 16 }}>{initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{roleLabel}{user?.username ? ` · @${user.username}` : ''}</div>
                        {user?.company_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{user.company_name}{role === 'manager' && user?.branch_name ? ` · ${user.branch_name}` : ''}</div>}
                      </div>
                    </div>
                    {/* пункты */}
                    {sections.some(s => s.id === 'settings') && (
                      <button onClick={() => { setUserMenuOpen(false); navigate('/owner/settings'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Icon name='settings' size={16} /> {tt('Настройки')}
                      </button>
                    )}
                    <button onClick={() => { setUserMenuOpen(false); logout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: '#dc2626', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF1F1'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <Icon name='logout' size={16} /> {tt('Выйти')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          <main className={'o-content' + (isToolPage ? ' o-content-tool' : '') + (isAiPage ? ' o-content-ai' : '')} ref={contentRef}>
            <Routes>
              <Route index element={<DashboardBento />} />
              <Route path="dashboard" element={<DashboardBento />} />
              <Route path="ai" element={isOwner && aiEnabled ? <AiChatPage /> : <Navigate to="/owner" replace />} />
              <Route path=":sectionId" element={<SectionHome />} />
              <Route path=":sectionId/:toolId" element={<ToolRouter />} />
              <Route path="*" element={<Navigate to="/owner" replace />} />
            </Routes>
          </main>
          {/* Sora-штрихи для скролла Главной/разделов (окна инструментов скроллятся
              внутри себя и рисуют собственные штрихи в ToolRouter). */}
          <ScrollTicks targetRef={contentRef} count={24} right={10} />

          {/* AI drawer guarded — manager can never trigger it because the button is hidden, but extra-safe block here too */}
        </div>

        {/* Док (нижняя панель) скрыт на странице AI — иммерсивный воркспейс без «панели». */}
        {!isAiPage && (
          <Dock sections={sections} activeSection={activeSection} navigate={navigate} aiEnabled={aiEnabled} isOwner={isOwner} tt={tt}
            lpOpen={lpOpen} onLaunchpad={() => setLpOpen(v => !v)} compact={isToolPage} />
        )}

        {lpOpen && <StartMenu sections={sections} navigate={navigate} onClose={() => setLpOpen(false)} tt={tt} />}

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} sections={sections} />
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
        <Icon name='calendar' size={15} style={{ marginRight: 2 }} /> {periodLabel} <span style={{ opacity: .6 }}>▾</span>
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
    ? { label: tt('Все филиалы'), sub: branches.length ? `${branches.length} ${tt('Филиал').toLowerCase()}` : null }
    : (() => {
        const b = branches.find(x => x.id === value);
        return { label: b?.name || '...', sub: tt('Один филиал') };
      })();

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="o-branch-pick"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{current.label}</span>
          {current.sub && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>{current.sub}</span>}
        </span>
        <span style={{ color: 'var(--text3)', fontSize: 11, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(26,27,46,.10), 0 4px 8px rgba(26,27,46,.05)',
          zIndex: 200, minWidth: 220, padding: 4, maxHeight: 360, overflowY: 'auto',
        }}>
          <BranchOption
            active={value == null}
            title={tt('Все филиалы')}
            sub={tt('Сводка по всей компании')}
            onClick={() => { onChange(null); setOpen(false); }}
          />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {branches.length === 0
            ? <div style={{ padding: '14px 10px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{tt('Нет филиалов')}</div>
            : branches.map(b => (
              <BranchOption key={b.id}
                active={value === b.id}
                title={b.name}
                sub={tt('Только этот филиал')}
                onClick={() => { onChange(b.id); setOpen(false); }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function BranchOption({ active, title, sub, onClick }) {
  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', cursor: 'pointer', borderRadius: 7,
        background: active ? 'var(--primary-50)' : 'transparent',
        outline: 'none',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{sub}</div>
      </div>
      {active && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>✓</span>}
    </div>
  );
}
