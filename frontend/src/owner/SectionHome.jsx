import React, { useContext, useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { BranchScope } from './OwnerShell.jsx';
import { Badge, Tooltip, Skeleton, fmtMoney, fmtNum } from './ui.jsx';
import { getUserSections } from './modules.js';
import { useTt } from './tt.js';
import { Icon, SECTION_ICON, gradCss } from './icons.jsx';
import { recentInSection } from './recentTools.js';
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

  // Правая часть баннера пустовала. Заполняем делом: кнопки самых частых задач
  // раздела ведут прямо в инструмент, минуя сетку карточек. Берём только те, что
  // реально доступны пользователю — отключённый инструмент кнопкой не покажем.
  const byId = new Map(tools.map(t => [t.id, t]));
  const quick = (section.quick || []).map(id => byId.get(id)).filter(Boolean).slice(0, 3);

  // «Недавнее» — личная история визитов в этом разделе: возврат к работе одним
  // кликом. Список локальный (см. recentTools.js), кнопки быстрых действий не
  // дублируем, иначе строка выглядела бы повтором.
  const quickIds = new Set(quick.map(t => t.id));
  const recent = recentInSection(user?.id, section.id, tools.map(t => t.id), 5)
    .map(r => byId.get(r.tool))
    .filter(t => t && !quickIds.has(t.id))
    .slice(0, 3);

  const openTool = (id) => navigate('/owner/' + section.id + '/' + id);

  return (
    // Единая максимальная ширина 1220px, как на Главной (.o-bento-page) и в окнах
    // инструментов (.o-sheet) — раньше у раздела её не было, и баннер+сетка карточек
    // растягивались во всю ширину экрана на широких мониторах, «выпадая» из общего
    // визуального ритма (на других страницах — по центру, с полями по бокам).
    <div className="o-section-page">
      {/* Градиентный баннер отдела — как в концепте: метрики ВНУТРИ баннера */}
      <div className="o-banner" style={{ background: gradCss(section.id, 120) }}>
        <span className="o-banner-shine" />
        <span className="o-banner-glyph"><Icon name={SECTION_ICON[section.id] || 'home'} size={190} strokeWidth={1.1} /></span>
        <div className="o-section-head-title">{tt(section.title)}</div>
        <div className="o-section-head-desc">{tt(section.desc)}</div>

        {recent.length > 0 && (
          <div className="o-banner-recent">
            <span className="o-banner-recent-cap">{tt('Недавнее')}</span>
            {recent.map(t => (
              <button key={t.id} type="button" className="o-recent-chip"
                onClick={() => openTool(t.id)} title={tt(t.desc)}>
                {tt(t.title)}
              </button>
            ))}
          </div>
        )}

        {quick.length > 0 && (
          <div className="o-banner-actions">
            {quick.map(t => (
              <button key={t.id} type="button" className="o-banner-act"
                onClick={() => openTool(t.id)} title={tt(t.desc)}>
                <span className="o-banner-act-ico"><Icon name={SECTION_ICON[section.id] || 'home'} size={16} /></span>
                <span className="o-banner-act-txt">{tt(t.title)}</span>
                <span className="o-banner-act-arw" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}

        <div className="o-banner-stats">
          <div><b>{tools.length}</b><span>{tt('инструментов')}</span></div>
          {(section.metrics || []).slice(0, 3).map(mKey => {
            const def = METRIC_DEFS[mKey];
            if (!def) return null;
            const val = dashLoading ? null : (def.source ? getByPath(dash, def.source) : null);
            const isMoney = def.format === 'money';
            const shown = dashLoading || val == null || (typeof val === 'number' && isNaN(val));
            return (
              <div key={mKey}>
                <b>
                  {dashLoading ? '…' : formatValue(val, def.format, def.placeholder)}
                  {!shown && isMoney && <em className="o-stat-unit">{tt('сум')}</em>}
                </b>
                <span>{tt(def.label)}</span>
              </div>
            );
          })}
          {hubs > 0 && <div><b>{hubs}</b><span>{tt('с вкладками')}</span></div>}
        </div>
      </div>

      <div className="o-grid-3">
        {tools.map(t => (
          <ToolCard key={t.id} tool={t} section={section} tt={tt} onOpen={() => navigate(`/owner/${section.id}/${t.id}`)} />
        ))}
      </div>
    </div>
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
      <span className="o-tool-go">→</span>
      <span className="o-tool-chip" style={{ background: gradCss(section.id) }}>
        <Icon name={SECTION_ICON[section.id] || 'home'} size={17} />
      </span>
      <div className="o-tool-title">
        {tt(tool.title)}
        {tool.hub ? <Badge tone="blue">{tool.hub} {tt('вкладок')}</Badge>
          : (!tool.wired && <Tooltip text={tt('Дизайн-макет. Реальные данные ещё не подключены — отображаются примеры.')}><Badge tone="yellow">{tt('Скоро')}</Badge></Tooltip>)}
      </div>
      <div className="o-tool-desc">{tt(tool.desc)}</div>
    </div>
  );
}
