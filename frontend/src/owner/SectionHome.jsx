import React, { useContext, useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { BranchScope } from './OwnerShell.jsx';
import { Badge, Tooltip, Skeleton, fmtMoney, fmtNum } from './ui.jsx';
import { getUserSections } from './modules.js';
import { useTt } from './tt.js';
import api from '../api.js';

const METRIC_DEFS = {
  revenue:        { label: 'Выручка',          source: 'totals.sales_revenue', format: 'money', sub: 'UZS · период' },
  profit:         { label: 'Прибыль',          source: 'totals.gross_profit',  format: 'money', sub: 'UZS · период' },
  cash:           { label: 'Касса',            source: 'totals.cash_balance',  format: 'money', sub: 'баланс' },
  customers:      { label: 'Клиентов',         source: 'totals.customer_count', format: 'num',  sub: 'всего в базе' },
  new_customers:  { label: 'Новых клиентов',   source: 'totals.new_customers_30d', format: 'num', sub: 'за 30 дней' },
  loyalty:        { label: 'В лояльности',     source: null, format: 'num', placeholder: '—', sub: 'нужно подключить' },
  suppliers:      { label: 'Поставщиков',      source: 'totals.supplier_count', format: 'num', sub: 'в базе' },
  supplier_debts: { label: 'Долги поставщикам', source: 'totals.supplier_debts', format: 'money', sub: 'UZS' },
  stock_value:    { label: 'Стоимость склада', source: 'totals.stock_value', format: 'money', sub: 'UZS' },
  low_stock:      { label: 'Низкий остаток',   source: 'totals.low_stock_count', format: 'num', sub: '< 5 единиц' },
  sku_count:      { label: 'SKU всего',        source: null, format: 'num', placeholder: '—', sub: 'товарных позиций' },
  deals:          { label: 'Сделок',           source: 'totals.deals_count', format: 'num', sub: 'за период' },
  avg_check:      { label: 'Средний чек',      source: 'totals.avg_check', format: 'money', sub: 'UZS' },
  users:          { label: 'Сотрудников',      source: 'totals.worker_count', format: 'num', sub: 'активных' },
  team_kpi:       { label: 'Средний KPI',      source: null, format: 'pct', placeholder: '—', sub: 'будет подключено' },
  salary_fund:    { label: 'ФОТ',              source: null, format: 'money', placeholder: '—', sub: 'нужна настройка' },
  client_debts:   { label: 'Долги клиентов',   source: 'totals.client_debts', format: 'money', sub: 'UZS' },
  nps:            { label: 'NPS',              source: null, format: 'pct', placeholder: '—', sub: 'после запуска опросов' },
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
  const { branchId, periodFrom, periodTo } = useContext(BranchScope);
  const { tt } = useTt();
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const sections = getUserSections(user);
  const section = sections.find(s => s.id === sectionId);

  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    if (!section || section.id === 'dashboard' || !section.metrics || section.metrics.length === 0) {
      setDashLoading(false);
      return;
    }
    setDashLoading(true);
    // Учитываем глобальный период (иначе плитки «за период» игнорируют видимый селектор).
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    api.get('/company/dashboard', { params })
      .then(r => setDash(r.data))
      .catch(() => setDash(null))
      .finally(() => setDashLoading(false));
  }, [sectionId, branchId, periodFrom, periodTo]);

  if (!section) return <Navigate to="/owner" replace />;
  if (section.id === 'dashboard') return <Navigate to="/owner" replace />;

  const tools = section.tools;
  const hubs = tools.filter(t => t.hub).length;

  return (
    <>
      {/* Плоский заголовок раздела — минимализм вместо градиентного hero */}
      <div className="o-section-head">
        <div className="o-section-head-title">{tt(section.title)}</div>
        <div className="o-section-head-desc">{tt(section.desc)}</div>
        <div className="o-section-head-meta">
          <span><strong>{tools.length}</strong> {tt('инструментов')}</span>
          {hubs > 0 && <span><strong>{hubs}</strong> {tt('с вкладками')}</span>}
        </div>
      </div>

      {section.metrics && section.metrics.length > 0 && (
        <div className={`grid-${Math.min(section.metrics.length, 4)}`} style={{ marginBottom: 22 }}>
          {section.metrics.map(mKey => {
            const def = METRIC_DEFS[mKey];
            if (!def) return null;
            const val = dashLoading ? null : (def.source ? getByPath(dash, def.source) : null);
            return (
              <div key={mKey} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {tt(def.label)}
                </div>
                {dashLoading ? (
                  <Skeleton height={22} style={{ width: '60%', marginTop: 8 }} />
                ) : (
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginTop: 6 }}>
                    {formatValue(val, def.format, def.placeholder)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>{tt(def.sub)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="o-grid-3">
        {tools.map(t => (
          <ToolCard key={t.id} tool={t} section={section} tt={tt} onOpen={() => navigate(`/owner/${section.id}/${t.id}`)} />
        ))}
      </div>
    </>
  );
}

function ToolCard({ tool, section, onOpen, tt }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={tt(tool.title)}
      className="o-tool-card"
    >
      <div className="o-tool-title">{tt(tool.title)}</div>
      <div className="o-tool-desc">{tt(tool.desc)}</div>
      <div className="o-tool-cta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--primary)' }}>{tt('Открыть')} →</span>
        {tool.hub
          ? <Badge tone="blue">{tool.hub} {tt('вкладок')}</Badge>
          : (tool.wired
            ? null
            : <Tooltip text={tt('Дизайн-макет. Реальные данные ещё не подключены — отображаются примеры.')}><Badge tone="yellow">{tt('Скоро')}</Badge></Tooltip>)}
      </div>
    </div>
  );
}
