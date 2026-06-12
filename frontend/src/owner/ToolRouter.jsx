import React, { useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getSectionsForRole } from './modules.js';
import { Card, PageHeader, ComingSoon, Badge } from './ui.jsx';

// Live wareapp components — wrap these so owner-shell tools can use real data.
import WarehouseBalance from '../components/WarehouseBalance.jsx';
import WarehouseIncome from '../components/WarehouseIncome.jsx';
import CashReport from '../components/CashReport.jsx';
import CashProfit from '../components/CashProfit.jsx';
import TeamKPI from '../components/TeamKPI.jsx';
import CustomersManager from '../components/CustomersManager.jsx';
import SuppliersManager from '../components/SuppliersManager.jsx';
import GenDirUsers from '../components/GenDirUsers.jsx';

// Real-data prototype tools (already wired)
import SegmentationTool from './tools/SegmentationTool.jsx';
import InventoryMgmtTool from './tools/InventoryMgmtTool.jsx';
import PricingTool from './tools/PricingTool.jsx';
import RiskControlTool from './tools/RiskControlTool.jsx';
import DebtsClientsTool from './tools/DebtsClientsTool.jsx';
import DebtsTool from './tools/DebtsTool.jsx';
import ReferencesTool from './tools/ReferencesTool.jsx';
import PersonasTool from './tools/PersonasTool.jsx';

// Mockup-only tools (visual placeholders — wire real data in later iterations)
import PosTool from './tools/PosTool.jsx';
import B2BTool from './tools/B2BTool.jsx';
import CommercialOfferTool from './tools/CommercialOfferTool.jsx';
import ScriptsTool from './tools/ScriptsTool.jsx';
import SalesHistoryTool from './tools/SalesHistoryTool.jsx';
import CrmTool from './tools/CrmTool.jsx';
import CjmTool from './tools/CjmTool.jsx';
import NpsTool from './tools/NpsTool.jsx';
import ContactPointsTool from './tools/ContactPointsTool.jsx';
import ProcurementTool from './tools/ProcurementTool.jsx';
import BundlesTool from './tools/BundlesTool.jsx';
import LogisticsTool from './tools/LogisticsTool.jsx';
import AuditTool from './tools/AuditTool.jsx';
import CashflowTool from './tools/CashflowTool.jsx';
import BreakEvenTool from './tools/BreakEvenTool.jsx';
import FinModelTool from './tools/FinModelTool.jsx';
import ModelingTool from './tools/ModelingTool.jsx';
import MktOverviewTool from './tools/MktOverviewTool.jsx';
import Strategy3yTool from './tools/Strategy3yTool.jsx';
import ContentPlanTool from './tools/ContentPlanTool.jsx';
import LeadGenTool from './tools/LeadGenTool.jsx';
import CompetitorsTool from './tools/CompetitorsTool.jsx';
import LoyaltyTool from './tools/LoyaltyTool.jsx';
import AnalyticsTool from './tools/AnalyticsTool.jsx';
import PlanningTool from './tools/PlanningTool.jsx';
import AiAdvisorTool from './tools/AiAdvisorTool.jsx';
import AutomationTool from './tools/AutomationTool.jsx';
import MgmtTool from './tools/MgmtTool.jsx';
import HrTool from './tools/HrTool.jsx';
import TrainingTool from './tools/TrainingTool.jsx';
import IntegrationsTool from './tools/IntegrationsTool.jsx';
import SecurityTool from './tools/SecurityTool.jsx';
import ScalingTool from './tools/ScalingTool.jsx';

// Wrap a legacy live component so it slots into the owner shell layout.
function LiveWrapper({ Component, title, sub }) {
  return (
    <>
      {title && <PageHeader title={title} sub={sub} actions={<Badge tone="green">Готов</Badge>} />}
      <div className="card" style={{ padding: 20 }}>
        <Component />
      </div>
    </>
  );
}

// Tool resolver: sectionId/toolId → component to render.
// Catalog section has been merged into Warehouse — products now live under warehouse/stock,
// and the four reference dictionaries (types/brands/units/attrs) are unified under warehouse/references.
const RESOLVE = {
  finance: {
    cash:        { Comp: () => <LiveWrapper title="🏦 Кассы" sub="Приход, расход и баланс по 10 валютам" Component={CashReport} /> },
    pnl:         { Comp: () => <LiveWrapper title="📊 P&L отчёт" sub="Выручка · себестоимость · маржа · прибыль" Component={CashProfit} /> },
    pricing:     { Comp: PricingTool },
    cashflow:    { Comp: CashflowTool },
    'break-even':{ Comp: BreakEvenTool },
    'fin-model': { Comp: FinModelTool },
    modeling:    { Comp: ModelingTool },
  },
  marketing: {
    'ca-analysis':  { Comp: PersonasTool },
    'content-plan': { Comp: ContentPlanTool },
    'mkt-overview': { Comp: MktOverviewTool },
    'strategy-3y':  { Comp: Strategy3yTool },
    leadgen:        { Comp: LeadGenTool },
    competitors:    { Comp: CompetitorsTool },
    loyalty:        { Comp: LoyaltyTool },
    cjm:            { Comp: CjmTool },
    ssp:            { Comp: MgmtTool },
  },
  procurement: {
    suppliers:         { Comp: () => <LiveWrapper title="🏭 Поставщики" sub="База поставщиков · контакты · история" Component={SuppliersManager} /> },
    'debts-suppliers': { Comp: DebtsTool },
    income:            { Comp: () => <LiveWrapper title="📥 Приход товара" sub="От поставщиков · оплата · долги" Component={WarehouseIncome} /> },
    'procurement-orders': { Comp: ProcurementTool },
  },
  warehouse: {
    stock:           { Comp: () => <LiveWrapper title="📦 Товары и остатки" sub="Каталог · цены · фото · штрих-коды · печать ценников" Component={WarehouseBalance} /> },
    'inventory-mgmt':{ Comp: InventoryMgmtTool },
    references:      { Comp: ReferencesTool },
    bundles:         { Comp: BundlesTool },
    logistics:       { Comp: LogisticsTool },
    audit:           { Comp: AuditTool },
  },
  operations: {
    'sales-history':    { Comp: SalesHistoryTool },
    pos:                { Comp: PosTool },
    b2b:                { Comp: B2BTool },
    'commercial-offer': { Comp: CommercialOfferTool },
    scripts:            { Comp: ScriptsTool },
    'risk-control':     { Comp: RiskControlTool },
    planning:           { Comp: PlanningTool },
    automation:         { Comp: AutomationTool },
  },
  hr: {
    'team-kpi':  { Comp: () => <LiveWrapper title="👥 KPI команды" sub="Продажи, маржа и эффективность сотрудников" Component={TeamKPI} /> },
    users:       { Comp: () => <LiveWrapper title="🧑‍💼 Сотрудники компании" sub="Роли · филиалы · доступ" Component={GenDirUsers} /> },
    training:    { Comp: TrainingTool },
    'hr-overview': { Comp: HrTool },
  },
  support: {
    crm:             { Comp: () => <LiveWrapper title="👥 Клиентская база" sub="Карточки · история покупок · долги" Component={CustomersManager} /> },
    'debts-clients': { Comp: DebtsClientsTool },
    segmentation:    { Comp: SegmentationTool },
    nps:             { Comp: NpsTool },
    'cjm-client':    { Comp: CjmTool },
    'contact-points':{ Comp: ContactPointsTool },
  },
  settings: {
    integrations: { Comp: IntegrationsTool },
    security:     { Comp: SecurityTool },
    scaling:      { Comp: ScalingTool },
  },
};

export default function ToolRouter() {
  const { user } = useContext(AuthContext);
  const { sectionId, toolId } = useParams();
  const navigate = useNavigate();
  const sections = getSectionsForRole(user?.role);
  const section = sections.find(s => s.id === sectionId);
  const tool = section?.tools.find(t => t.id === toolId);

  if (!section || !tool) return <Navigate to="/owner" replace />;
  const entry = RESOLVE[sectionId]?.[toolId];

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <button onClick={() => navigate('/owner/' + section.id)} className="btn btn-ghost btn-sm" title="Назад к секции">
        ← Назад
      </button>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>
        <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate('/owner/' + section.id)}>
          {section.icon} {section.title}
        </span>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--text2)' }}>{tool.title}</span>
      </div>
    </div>
  );

  if (!entry) {
    return (
      <>
        {header}
        <ComingSoon icon={tool.icon} title={tool.title}>
          <div>{tool.desc}</div>
          <div style={{ marginTop: 14, fontSize: 12 }}>Этот инструмент будет реализован в следующих обновлениях. Если он критичен — напишите, поднимем приоритет.</div>
        </ComingSoon>
      </>
    );
  }

  const Comp = entry.Comp;
  const isMockup = !tool.wired;

  return (
    <>
      {header}
      {isMockup && (
        <div className="alert" style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,.10), rgba(255,107,43,.10))',
          borderColor: 'rgba(245,158,11,.30)',
          color: '#92400E',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🚧</span>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>Дизайн-макет — данные ниже не настоящие</div>
            <div style={{ fontWeight: 500 }}>
              Это образец интерфейса для согласования. Реальные данные подключим в следующих обновлениях.
              Кнопки в макете не сохраняют ничего.
            </div>
          </div>
        </div>
      )}
      <Comp />
    </>
  );
}
