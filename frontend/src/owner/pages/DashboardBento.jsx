import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../../App.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { PageHeaderContext } from '../PageHeaderContext.js';
import { getUserSections } from '../modules.js';
import { useTt } from '../tt.js';
import { Icon, SECTION_ICON, gradCss } from '../icons.jsx';
import { fmtMoney, fmtNum, Skeleton } from '../ui.jsx';
import { boardTitle } from '../taskMeta.js';
import { useTaskInbox } from '../../hooks/useTaskInbox.jsx';
import api from '../../api.js';

// ── Bento-Главная: перенос дизайна wave-erp-design на реальные данные ──
const SPRING = { type: 'spring', stiffness: 420, damping: 38 };

function Tile({ children, className = '', i = 0, onClick, style }) {
  const C = onClick ? motion.button : motion.div;
  return (
    <C
      className={`o-bt ${className}`} onClick={onClick} style={style}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.04 + i * 0.045 }}
      whileHover={{ y: -4 }}
    >
      {children}
    </C>
  );
}

// Дельта к прошлому периоду
function delta(cur, prev) {
  if (cur == null || prev == null || !prev) return null;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  if (!isFinite(d)) return null;
  return d;
}
function DeltaTag({ d, tt }) {
  if (d == null) return null;
  const up = d >= 0;
  return (
    <div className={`o-bt-delta ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(d).toFixed(1)}% {tt('к прошлому периоду')}
    </div>
  );
}

// ── Мини-график (SVG area) ──
function AreaChart({ values, labels, height = 190, format = (v) => v }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640, H = height, PB = 18, PT = 10;
  if (!values || values.length < 2) return <div style={{ padding: '30px 0', color: 'var(--text3)', fontSize: 13 }}>Нет данных за период</div>;
  const mn = Math.min(...values) * 0.92, mx = Math.max(...values) * 1.05 || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: PT + (1 - (v - mn) / (mx - mn || 1)) * (H - PB - PT),
    v, i,
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M0,${H - PB} L${line.replace(/ /g, ' L')} L${W},${H - PB} Z`;
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round((x / W) * (values.length - 1))));
    setHover({ ...pts[idx], px: (pts[idx].x / W) * r.width, py: (pts[idx].y / H) * r.height });
  };
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: 'crosshair' }}>
        <defs>
          <linearGradient id="obg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4da3ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4da3ff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.3, 0.62].map((g) => (
          <line key={g} x1="0" x2={W} y1={PT + g * (H - PB - PT)} y2={PT + g * (H - PB - PT)} stroke="rgba(20,20,40,.07)" strokeWidth="1" />
        ))}
        <line x1="0" x2={W} y1={H - PB} y2={H - PB} stroke="rgba(20,20,40,.14)" strokeWidth="1" />
        <path d={area} fill="url(#obg)" />
        <motion.polyline points={line} fill="none" stroke="#0a6ae0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={PT} y2={H - PB} stroke="rgba(20,20,40,.2)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hover.x} cy={hover.y} r="4.5" fill="#0a6ae0" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="o-bt-tt" style={{ left: hover.px, top: hover.py }}>
          <div className="l">{labels?.[hover.i] ?? ''}</div>
          <div className="v">{format(hover.v)}</div>
        </div>
      )}
    </div>
  );
}

// ── Кольцо BHI ──
function Ring({ value, size = 96, color }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,20,40,.08)" strokeWidth="8" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>{value}</span>
        <span style={{ fontSize: 9.5, color: 'var(--text3)', fontWeight: 700 }}>BHI</span>
      </div>
    </div>
  );
}

// ── Погода (Open-Meteo, Ташкент) ──
const WPATHS = {
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 3.4v2M12 18.6v2M20.6 12h-2M5.4 12h-2M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4M18.1 18.1l-1.4-1.4M7.3 7.3 5.9 5.9" /></>,
  cloud: <path d="M7 18.2h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 9.4 3.9 3.9 0 0 0 7 18.2Z" />,
  cloudsun: <><path d="M17.2 10.1a3.3 3.3 0 1 0-4.3-4.6" /><path d="M17.5 4.2v-1M21 7.7h1M19.9 4.5l.7-.7M20 11l.7.7" /><path d="M6.3 19h7.4a3.4 3.4 0 0 0 .6-6.7 4.9 4.9 0 0 0-9.5-.9A3.4 3.4 0 0 0 6.3 19Z" /></>,
  rain: <><path d="M7 15.4h9.2a3.9 3.9 0 0 0 .7-7.7A5.6 5.6 0 0 0 6.1 6.6 3.9 3.9 0 0 0 7 15.4Z" /><path d="M8.5 18.2 7.8 20M12.4 18.2l-.7 1.8M16.3 18.2l-.7 1.8" /></>,
};
function WIcon({ name, size = 18, sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {WPATHS[name] || WPATHS.cloudsun}
    </svg>
  );
}
function wmo(code) {
  if (code === 0) return { icon: 'sun', label: 'Ясно' };
  if (code <= 2) return { icon: 'cloudsun', label: 'Малооблачно' };
  if (code === 3 || code === 45 || code === 48) return { icon: 'cloud', label: 'Облачно' };
  return { icon: 'rain', label: 'Осадки' };
}
function WeatherTile() {
  const [w, setW] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('https://api.open-meteo.com/v1/forecast?latitude=41.31&longitude=69.28&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FTashkent&forecast_days=2', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        const nowIso = j.current.time.slice(0, 13);
        let idx = j.hourly.time.findIndex((t) => t.slice(0, 13) === nowIso);
        if (idx < 0) idx = 0;
        setW({
          temp: Math.round(j.current.temperature_2m), code: j.current.weather_code,
          hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]),
          hours: j.hourly.time.slice(idx + 1, idx + 6).map((t, k) => ({
            h: t.slice(11, 13), t: Math.round(j.hourly.temperature_2m[idx + 1 + k]), code: j.hourly.weather_code[idx + 1 + k],
          })),
        });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  if (!w) return <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>Ташкент · погода…</div>;
  const cur = wmo(w.code);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Ташкент</div>
          <div style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.05, marginTop: 2 }}>{w.temp}°</div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{cur.label} · Д:{w.hi}° Н:{w.lo}°</div>
        </div>
        <motion.span style={{ marginLeft: 'auto', display: 'flex' }} animate={{ y: [0, -4, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <WIcon name={cur.icon} size={44} sw={1.4} />
        </motion.span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 'auto', paddingTop: 8 }}>
        {w.hours.map((h, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,.14)', borderRadius: 10, padding: '6px 2px' }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.8 }}>{h.h}</span>
            <WIcon name={wmo(h.code).icon} size={14} />
            <span style={{ fontSize: 11, fontWeight: 650 }}>{h.t}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Календарь ──
const WD = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
function CalendarTile({ alerts, tt }) {
  const now = new Date();
  const day = now.getDate(), y = now.getFullYear(), m = now.getMonth();
  const weekday = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const toneColor = { red: '#E5484D', yellow: '#D97706', blue: '#0A84FF', purple: '#BF5AF2' };
  const events = (alerts || []).slice(0, 3);
  return (
    <div style={{ display: 'flex', gap: 14, height: '100%', minWidth: 0 }}>
      <div style={{ flexShrink: 0, width: 82 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#FF3B30' }}>{weekday}</div>
        <div style={{ fontSize: 40, fontWeight: 300, lineHeight: 1.05 }}>{day}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', textTransform: 'capitalize' }}>{monthName}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
        {events.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', paddingTop: 6 }}>✓ {tt('Всё спокойно')} — {tt('событий нет')}</div>}
        {events.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0 }}>
            <span style={{ width: 3.5, alignSelf: 'stretch', borderRadius: 4, background: toneColor[a.tone] || '#8E8E93', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ flexShrink: 0, width: 132, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', alignContent: 'start' }}>
        {WD.map((d, i) => <span key={'h' + i} style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--text3)' }}>{d}</span>)}
        {cells.map((d, i) => (
          <span key={i} style={{
            height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8.5, fontWeight: 550, color: 'var(--text2)',
            ...(d === day ? { background: '#FF3B30', color: '#fff', borderRadius: '50%', width: 17, justifySelf: 'center', fontWeight: 700 } : {}),
          }}>{d || ''}</span>
        ))}
      </div>
    </div>
  );
}

// ── Главная ──
export default function DashboardBento() {
  const { user } = useContext(AuthContext);
  const { branchId, periodFrom, periodTo, periodLabel, role } = useContext(BranchScope);
  const setPageHead = useContext(PageHeaderContext);
  const { tt, lang } = useTt();
  const navigate = useNavigate();
  const inbox = useTaskInbox();
  const isOwner = role === 'founder' || role === 'director';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState(null);
  const [bhi, setBhi] = useState(null);

  useEffect(() => {
    setPageHead({ title: tt('Главная'), sub: null, actions: null });
    return () => setPageHead({ title: '', sub: null, actions: null });
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = {};
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then((r) => { if (!ignore) setData(r.data); })
      .catch(() => { if (!ignore) setData(null); })
      .finally(() => { if (!ignore) setLoading(false); });
    api.get('/company/sales-chart', { params: { ...params, granularity: 'day' } })
      .then((r) => { if (!ignore) setChart(r.data); })
      .catch(() => { if (!ignore) setChart(null); });
    return () => { ignore = true; };
  }, [periodFrom, periodTo, branchId]);

  useEffect(() => {
    let ignore = false;
    api.get('/bhi/monthly', { params: { month: new Date().toISOString().slice(0, 7) } })
      .then((r) => { if (!ignore) setBhi(r.data); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const t = data?.totals || {};
  const prev = data?.prev_totals || {};
  const branches = data?.branches || [];
  const alerts = data?.alerts || [];
  const topProducts = data?.top_products || [];
  const topSellers = data?.top_sellers || [];
  const buckets = chart?.buckets || [];
  const values = useMemo(() => buckets.map((b) => b.revenue), [buckets]);
  const labels = useMemo(() => buckets.map((b) => b.label), [buckets]);

  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const name = user?.first_name || user?.username || '';
  const sections = getUserSections(user).filter((s) => s.id !== 'dashboard');
  const toolsTotal = sections.reduce((n, s) => n + (s.tools?.length || 0), 0);
  // Вход в ролевой дашборд рисуем, только если раздел реально доступен: роль,
  // персональные blocked_tools и отключённые компанией инструменты уже учтены
  // в getUserSections, иначе клик увёл бы на несуществующий маршрут.
  const hasBoard = sections.some((s) => s.id === 'myboard');

  const bhiColor = bhi?.zone === 'good' || (bhi?.current ?? 0) >= 70 ? '#1D7A35' : (bhi?.current ?? 0) >= 45 ? '#D97706' : '#E5484D';
  const maxBranch = Math.max(...branches.map((b) => b.sales_revenue || 0), 1);
  const aiText = alerts[0]
    ? `${alerts[0].title}${alerts[0].sub ? ' — ' + alerts[0].sub : ''}`
    : tt('Все системы в норме. Задайте вопрос о вашем бизнесе — отвечу по живым данным.');

  const kpis = [
    { label: tt('Прибыль'), val: t.gross_profit != null ? fmtMoney(t.gross_profit) : '—', d: delta(t.gross_profit, prev.gross_profit) },
    { label: tt('Касса'), val: t.cash_balance != null ? fmtMoney(t.cash_balance) : '—', d: null, sub: tt('остаток на сейчас') },
    { label: tt('Продаж'), val: t.deals_count != null ? fmtNum(t.deals_count) : '—', d: delta(t.deals_count, prev.deals_count) },
    { label: tt('Средний чек'), val: t.avg_check != null ? fmtMoney(t.avg_check) : '—', d: delta(t.avg_check, prev.avg_check) },
  ];

  return (
    <div className="o-bento-page">
      <div className="o-bento-greet">
        <h1>{hello}{name ? `, ${name}` : ''}</h1>
        <p><span className="o-live-dot" />{today[0].toUpperCase() + today.slice(1)} · {periodLabel} · {toolsTotal} {tt('инструментов')}</p>
      </div>

      <div className="o-bento">
        <Tile className="c2 r4" i={0}>
          <div className="o-bt-label">{tt('Выручка')} · {periodLabel}</div>
          {loading ? <Skeleton height={38} style={{ width: '55%', marginTop: 8 }} /> : (
            <>
              <div className="o-bt-hero">{fmtMoney(t.sales_revenue || 0)} <span className="cur">{tt('сум')}</span></div>
              <DeltaTag d={delta(t.sales_revenue, prev.sales_revenue)} tt={tt} />
            </>
          )}
          <div style={{ marginTop: 'auto' }}>
            <AreaChart values={values} labels={labels} format={(v) => fmtMoney(v) + ' ' + tt('сум')} height={188} />
          </div>
        </Tile>

        <Tile className="c2 r2 o-bt-ai" i={1} onClick={() => (isOwner && user?.ai_enabled !== false ? navigate('/owner/ai') : null)} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <span className="o-bt-ai-orb" />
          <div className="o-bt-label" style={{ color: 'rgba(255,255,255,.6)' }}>
            <Icon name="sparkles" size={13} /> Wave Intelligence {isOwner ? '· ' + tt('спросить') : ''}
          </div>
          <div className="o-bt-ai-text">{aiText}</div>
        </Tile>

        <Tile className="c1 r2" i={2} style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="o-bt-label">{tt('Здоровье бизнеса')}</div>
          {bhi?.current != null ? (
            <>
              <div style={{ marginTop: 4 }}><Ring value={bhi.current} color={bhiColor} /></div>
              <span className="o-bt-pill" style={{ marginTop: 6, background: bhiColor + '1c', color: bhiColor }}>
                {tt('Цель')}: {bhi.goal ?? 100}
              </span>
            </>
          ) : <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 20 }}>{tt('Нет данных')}</div>}
        </Tile>

        <Tile className="c1 r2" i={3}>
          <div className="o-bt-label">{tt('Отделы')} · {toolsTotal}</div>
          <div className="o-bt-depts">
            {sections.slice(0, 9).map((s) => (
              <motion.button key={s.id} title={tt(s.title)} style={{ background: gradCss(s.id) }}
                whileHover={{ scale: 1.12, rotate: -3 }} whileTap={{ scale: 0.94 }}
                onClick={() => navigate('/owner/' + s.id)}>
                <Icon name={SECTION_ICON[s.id] || 'home'} size={15} />
              </motion.button>
            ))}
          </div>
        </Tile>

        {hasBoard && (
          <Tile className="c4 r2" i={4} onClick={() => navigate('/owner/myboard/my-board')} style={{ textAlign: 'left', cursor: 'pointer' }}>
            <div className="o-bt-label"><Icon name="clipboard" size={12} /> {boardTitle(role, lang === 'uz')}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginTop: 7 }}>
              {tt('Мои дела, поручения, зарплаты и нарушения')}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginTop: 'auto' }}>
              <div>
                <div className="o-bt-value" style={{ marginTop: 0 }}>{fmtNum(inbox.active || 0)}</div>
                <div className="o-bt-sub">{tt('активных задач')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 4 }}>
                {inbox.unread > 0 && (
                  <span className="o-bt-pill" style={{ background: 'rgba(220,38,38,.12)', color: '#DC2626' }}>
                    {inbox.unread} {tt('новых')}
                  </span>
                )}
                {inbox.overdue > 0 && (
                  <span className="o-bt-pill" style={{ background: 'rgba(217,119,6,.12)', color: '#D97706' }}>
                    {tt('Просрочено')}: {inbox.overdue}
                  </span>
                )}
                {!inbox.unread && !inbox.overdue && (
                  <span className="o-bt-pill" style={{ background: 'rgba(22,163,74,.12)', color: '#16A34A' }}>
                    {tt('Всё под контролем')}
                  </span>
                )}
              </div>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 4, fontSize: 12.5, fontWeight: 650, color: '#0a6ae0' }}>
                {tt('Открыть доску')} <Icon name="chevron" size={13} />
              </span>
            </div>
          </Tile>
        )}

        {kpis.map((k, i) => (
          <Tile className="c1 r2" i={5 + i} key={k.label}>
            <div className="o-bt-label">{k.label}</div>
            {loading ? <Skeleton height={24} style={{ width: '70%', marginTop: 8 }} /> : (
              <>
                <div className="o-bt-value">{k.val}</div>
                {k.d != null ? <DeltaTag d={k.d} tt={tt} /> : (k.sub && <div className="o-bt-sub">{k.sub}</div>)}
              </>
            )}
          </Tile>
        ))}

        <Tile className="c1 r2 o-bt-weather" i={9}>
          <WeatherTile />
        </Tile>

        <Tile className="c2 r2" i={10}>
          <CalendarTile alerts={alerts} tt={tt} />
        </Tile>

        <Tile className="c1 r2" i={11} onClick={() => navigate('/owner/hr/team')} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="o-bt-label">{tt('Команда')}</div>
          <div className="o-bt-value">{t.worker_count != null ? fmtNum(t.worker_count) : '—'}</div>
          <div className="o-bt-sub">{tt('активных сотрудников')}</div>
          <div className="o-bt-sub" style={{ color: 'var(--green)', marginTop: 2 }}>{tt('Склад')}: {t.stock_value != null ? fmtMoney(t.stock_value) : '—'}</div>
        </Tile>

        {isOwner && branches.length > 0 && (
          <Tile className="c2 r3" i={12}>
            <div className="o-bt-label">{tt('Филиалы')} · {tt('выручка')}</div>
            <div style={{ marginTop: 8 }}>
              {branches.slice(0, 5).map((b, i) => (
                <div className="o-bt-bar" key={b.branch_id}>
                  <span className="n">{b.branch_name}</span>
                  <span className="t">
                    <motion.span className="f" style={{ background: ['#0a6ae0', '#5598e7', '#86b6ef', '#aecdf5', '#cfe2fa'][Math.min(i, 4)] }}
                      initial={{ width: 0 }} animate={{ width: `${((b.sales_revenue || 0) / maxBranch) * 100}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }} />
                  </span>
                  <span className="v">{fmtMoney(b.sales_revenue || 0)}</span>
                </div>
              ))}
            </div>
          </Tile>
        )}

        <Tile className={isOwner && branches.length > 0 ? 'c2 r3' : 'c4 r3'} i={13}>
          <div className="o-bt-label"><Icon name="bell" size={12} /> {tt('Алерты')} {alerts.length > 0 && <span className="o-bt-cnt">{alerts.length}</span>}</div>
          <div style={{ marginTop: 4, overflow: 'hidden' }}>
            {alerts.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 0' }}>✓ {tt('Всё спокойно')}</div>}
            {alerts.slice(0, 4).map((a, i) => (
              <div key={i} className="o-bt-alert">
                <span className="d" style={{ background: ({ red: '#E5484D', yellow: '#D97706', blue: '#0A84FF', purple: '#BF5AF2' })[a.tone] || '#8E8E93' }} />
                <div style={{ minWidth: 0 }}>
                  <div className="t1">{a.title}</div>
                  {a.sub && <div className="t2">{a.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile className="c2 r3" i={14}>
          <div className="o-bt-label">{tt('Топ товаров')}</div>
          <div style={{ marginTop: 4 }}>
            {topProducts.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 0' }}>{tt('Нет данных')}</div>}
            {topProducts.slice(0, 5).map((p, i) => (
              <div key={p.id ?? i} className="o-bt-rank">
                <span className="n">{i + 1}</span>
                <span className="name">{p.name}<span className="sub">{fmtNum(p.qty)} {p.unit || ''}</span></span>
                <span className="val">{fmtMoney(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile className="c2 r3" i={15}>
          <div className="o-bt-label">{tt('Топ сотрудников')}</div>
          <div style={{ marginTop: 4 }}>
            {topSellers.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 0' }}>{tt('Нет данных')}</div>}
            {topSellers.slice(0, 5).map((s, i) => (
              <div key={s.id ?? i} className="o-bt-rank">
                <span className="n">{i + 1}</span>
                <span className="name">{s.name || s.username}<span className="sub">{fmtNum(s.deals)} {tt('сделок')}</span></span>
                <span className="val">{fmtMoney(s.revenue)}</span>
              </div>
            ))}
          </div>
        </Tile>
      </div>
    </div>
  );
}
