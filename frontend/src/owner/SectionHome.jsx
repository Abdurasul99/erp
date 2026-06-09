import React, { useContext, useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { BranchScope } from './OwnerShell.jsx';
import { getSectionsForRole } from './modules.js';
import { Badge, Tooltip, Skeleton, fmtMoney, fmtNum } from './ui.jsx';
import { shade } from './ui.jsx';
import api from '../api.js';

const METRIC_DEFS = {
  revenue:        { icon: '💰', label: 'Выручка',          source: 'totals.sales_revenue', format: 'money', sub: 'UZS · период' },
  profit:         { icon: '📈', label: 'Прибыль',          source: 'totals.gross_profit',  format: 'money', sub: 'UZS · период' },
  cash:           { icon: '🏦', label: 'Касса',            source: 'totals.cash_balance',  format: 'money', sub: 'баланс' },
  customers:      { icon: '👥', label: 'Клиентов',         source: 'totals.customer_count', format: 'num',  sub: 'всего в базе' },
  new_customers:  { icon: '✨', label: 'Новых клиентов',   source: 'totals.new_customers_30d', format: 'num', sub: 'за 30 дней' },
  loyalty:        { icon: '🎁', label: 'В лояльности',     source: null, format: 'num', placeholder: '—', sub: 'нужно подключить' },
  suppliers:      { icon: '🏭', label: 'Поставщиков',      source: 'totals.supplier_count', format: 'num', sub: 'в базе' },
  supplier_debts: { icon: '📒', label: 'Долги поставщикам', source: 'totals.supplier_debts', format: 'money', sub: 'UZS' },
  stock_value:    { icon: '📦', label: 'Стоимость склада', source: 'totals.stock_value', format: 'money', sub: 'UZS' },
  low_stock:      { icon: '⚠️', label: 'Низкий остаток',   source: 'totals.low_stock_count', format: 'num', sub: '< 5 единиц' },
  sku_count:      { icon: '🔢', label: 'SKU всего',        source: null, format: 'num', placeholder: '—', sub: 'товарных позиций' },
  deals:          { icon: '🛒', label: 'Сделок',           source: 'totals.deals_count', format: 'num', sub: 'за период' },
  avg_check:      { icon: '🧾', label: 'Средний чек',      source: 'totals.avg_check', format: 'money', sub: 'UZS' },
  users:          { icon: '👤', label: 'Сотрудников',      source: 'totals.worker_count', format: 'num', sub: 'активных' },
  team_kpi:       { icon: '🎯', label: 'Средний KPI',      source: null, format: 'pct', placeholder: '—', sub: 'будет подключено' },
  salary_fund:    { icon: '💵', label: 'ФОТ',              source: null, format: 'money', placeholder: '—', sub: 'нужна настройка' },
  client_debts:   { icon: '📒', label: 'Долги клиентов',   source: 'totals.client_debts', format: 'money', sub: 'UZS' },
  nps:            { icon: '⭐', label: 'NPS',               source: null, format: 'pct', placeholder: '—', sub: 'после запуска опросов' },
};

function getByPath(obj, path) {
  if (!path) return null;
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function formatValue(val, type, placeholder) {
  if (val == null || (typeof val === 'number' && isNaN(val))) return placeholder || '—';
  if (type === 'money') return fmtMoney(val);
  if (type === 'num') return fmtNum(val);
  if (type === 'pct') return val + '%';
  return String(val);
}

export default function SectionHome() {
  const { user } = useContext(AuthContext);
  const { branchId } = useContext(BranchScope);
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const sections = getSectionsForRole(user?.role);
  const section = sections.find(s => s.id === sectionId);

  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    if (!section || section.id === 'dashboard' || !section.metrics || section.metrics.length === 0) {
      setDashLoading(false);
      return;
    }
    setDashLoading(true);
    const params = branchId ? { branch_id: branchId } : {};
    api.get('/company/dashboard', { params })
      .then(r => setDash(r.data))
      .catch(() => setDash(null))
      .finally(() => setDashLoading(false));
  }, [sectionId, branchId]);

  if (!section) return <Navigate to="/owner" replace />;
  if (section.id === 'dashboard') return <Navigate to="/owner" replace />;

  const ready = section.tools.filter(t => t.wired);
  const upcoming = section.tools.filter(t => !t.wired);

  return (
    <>
      <div
        className="o-section-hero"
        style={{
          background: `linear-gradient(135deg, ${section.color}, ${shade(section.color, -25)})`,
          boxShadow: `0 10px 30px ${section.color}44`,
        }}
      >
        <div className="o-section-hero-eyebrow">ОТДЕЛ</div>
        <div className="o-section-hero-title">{section.icon} {section.title}</div>
        <div className="o-section-hero-desc">{section.desc}</div>
        <div style={{ marginTop: 14, fontSize: 12, opacity: .85, display: 'flex', gap: 18 }}>
          <span>📦 <strong>{section.tools.length}</strong> инструментов</span>
          <span>✅ <strong>{ready.length}</strong> готовых</span>
          {upcoming.length > 0 && <span>🚧 <strong>{upcoming.length}</strong> в разработке</span>}
        </div>
      </div>

      {section.metrics && section.metrics.length > 0 && (
        <div className={`grid-${Math.min(section.metrics.length, 4)}`} style={{ marginBottom: 22 }}>
          {section.metrics.map(mKey => {
            const def = METRIC_DEFS[mKey];
            if (!def) return null;
            const val = dashLoading ? null : (def.source ? getByPath(dash, def.source) : null);
            return (
              <div key={mKey} className="card" style={{ padding: 16, borderLeft: `4px solid ${section.color}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {def.icon} {def.label}
                </div>
                {dashLoading ? (
                  <Skeleton height={22} style={{ width: '60%', marginTop: 8 }} />
                ) : (
                  <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: section.color, lineHeight: 1.1, marginTop: 4 }}>
                    {formatValue(val, def.format, def.placeholder)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{def.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      {ready.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
            Готово к работе
          </div>
          <div className="o-grid-3" style={{ marginBottom: 22 }}>
            {ready.map(t => (
              <ToolCard key={t.id} tool={t} section={section} onOpen={() => navigate(`/owner/${section.id}/${t.id}`)} />
            ))}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
            В разработке · можно посмотреть макет
          </div>
          <div className="o-grid-3">
            {upcoming.map(t => (
              <ToolCard key={t.id} tool={t} section={section} upcoming onOpen={() => navigate(`/owner/${section.id}/${t.id}`)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ToolCard({ tool, section, upcoming = false, onOpen }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={`${tool.title} — ${upcoming ? 'в разработке' : 'готов к работе'}`}
      className="o-tool-card"
      style={upcoming ? { opacity: .72 } : undefined}
    >
      <div className="o-tool-ico" style={{ background: section.color + '18', color: section.color }}>
        {tool.icon}
      </div>
      <div className="o-tool-title">{tool.title}</div>
      <div className="o-tool-desc">{tool.desc}</div>
      <div className="o-tool-cta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: section.color }}>{upcoming ? 'Смотреть макет →' : 'Открыть →'}</span>
        {upcoming
          ? <Tooltip text="Дизайн-макет. Реальные данные ещё не подключены — отображаются примеры."><Badge tone="yellow">🚧 Скоро</Badge></Tooltip>
          : <Tooltip text="Работает с реальными данными вашей компании."><Badge tone="green">✓ Готов</Badge></Tooltip>}
      </div>
    </div>
  );
}
