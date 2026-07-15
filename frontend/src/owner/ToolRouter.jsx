import React, { useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getUserSections } from './modules.js';
import { PageHeader, ComingSoon, Badge } from './ui.jsx';
import { useTt } from './tt.js';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

// ═══ Объединённые хабы (упрощение панели: вкладки вместо десятков кнопок) ═══
import {
  SimulatorHub, ControlCenterHub, TasksHub, FunnelHub, CashForecastHub,
  FinHealthHub, PurchaseForecastHub, StockMathHub, HrAnalyticsHub, TeamHub, SegmentsHub,
  ReportsHub, SupplierEvalHub, GoodsFlowHub, ReferencesHub, FeedbackHub,
} from './tools/CombinedTools.jsx';

// Live wareapp components — wrap these so owner-shell tools can use real data.
import WarehouseBalance from '../components/WarehouseBalance.jsx';
import WarehouseIncome from '../components/WarehouseIncome.jsx';
import CashReport from '../components/CashReport.jsx';
import CashProfit from '../components/CashProfit.jsx';
import CustomersManager from '../components/CustomersManager.jsx';
import SuppliersManager from '../components/SuppliersManager.jsx';
import GenDirUsers from '../components/GenDirUsers.jsx';

// Инструменты (по одному экрану на карточку)
import PanelManagerTool from './tools/PanelManagerTool.jsx';
import FounderBoardTool from './tools/FounderBoardTool.jsx';
import UnitEconomicsTool from './tools/UnitEconomicsTool.jsx';
import SspTool from './tools/SspTool.jsx';
import BasketTool from './tools/BasketTool.jsx';
import EventJournalTool from './tools/EventJournalTool.jsx';
import BranchCompareTool from './tools/BranchCompareTool.jsx';
import CohortsTool from './tools/CohortsTool.jsx';
import AbPointTool from './tools/AbPointTool.jsx';
import BirthdaysTool from './tools/BirthdaysTool.jsx';
import ReferralsTool from './tools/ReferralsTool.jsx';
import ClientForecastTool from './tools/ClientForecastTool.jsx';
import InventoryMgmtTool from './tools/InventoryMgmtTool.jsx';
import PricingTool from './tools/PricingTool.jsx';
import DebtsClientsTool from './tools/DebtsClientsTool.jsx';
// Склад
import TurnoverDeadstockTool from './tools/TurnoverDeadstockTool.jsx';
import PurchaseRoiTool from './tools/PurchaseRoiTool.jsx';
import InventoryAuditTool from './tools/InventoryAuditTool.jsx';
import DefectsTool from './tools/DefectsTool.jsx';
// Финансы
import ExpensesReportTool from './tools/ExpensesReportTool.jsx';
import CurrencyOpsTool from './tools/CurrencyOpsTool.jsx';
import TaxesTool from './tools/TaxesTool.jsx';
import CashflowTool from './tools/CashflowTool.jsx';
import BreakEvenTool from './tools/BreakEvenTool.jsx';
import FinModelTool from './tools/FinModelTool.jsx';
// Закупки
import PurchaseHistoryTool from './tools/PurchaseHistoryTool.jsx';
import SupplierReturnsTool from './tools/SupplierReturnsTool.jsx';
import ProcurementOrdersTool from './tools/ProcurementOrdersTool.jsx';
import ReceivingsTool from './tools/ReceivingsTool.jsx';
import DebtsTool from './tools/DebtsTool.jsx';
// Продажи
import SalesHistoryTool from './tools/SalesHistoryTool.jsx';
import PosTool from './tools/PosTool.jsx';
import DiscountsTool from './tools/DiscountsTool.jsx';
import SalesTopProductsTool from './tools/SalesTopProductsTool.jsx';
import SellerAvgCheckTool from './tools/SellerAvgCheckTool.jsx';
import ReturnsReportTool from './tools/ReturnsReportTool.jsx';
import SalesForecastTool from './tools/SalesForecastTool.jsx';
import SalesScriptsTool from './tools/SalesScriptsTool.jsx';
// Маркетинг
import PersonasTool from './tools/PersonasTool.jsx';
import ContentPlanTool from './tools/ContentPlanTool.jsx';
import ChannelsTool from './tools/ChannelsTool.jsx';
import LtvTool from './tools/LtvTool.jsx';
import CustomerCampaignsTool from './tools/CustomerCampaignsTool.jsx';
import LoyaltyPointsTool from './tools/LoyaltyPointsTool.jsx';
import CompetitorMirrorTool from './tools/CompetitorMirrorTool.jsx';
// Персонал
import SchedulesTool from './tools/SchedulesTool.jsx';
import AttendanceTool from './tools/AttendanceTool.jsx';
import AbsencesTool from './tools/AbsencesTool.jsx';
import SalariesTool from './tools/SalariesTool.jsx';
import HrProductivityTool from './tools/HrProductivityTool.jsx';
import HrAdjustmentsTool from './tools/HrAdjustmentsTool.jsx';
import HrForecastTool from './tools/HrForecastTool.jsx';
import TrainingCoursesTool from './tools/TrainingCoursesTool.jsx';
// Настройки
import IntegrationsTool from './tools/IntegrationsTool.jsx';
import SecurityTool from './tools/SecurityTool.jsx';
import ScalingTool from './tools/ScalingTool.jsx';

// Wrap a legacy live component so it slots into the owner shell layout.
function LiveWrapper({ Component, title, sub }) {
  const { tt } = useTt();
  return (
    <>
      {title && <PageHeader title={tt(title)} sub={tt(sub)} actions={<Badge tone="green">{tt('Готов')}</Badge>} />}
      <div className="card" style={{ padding: 20 }}>
        <Component />
      </div>
    </>
  );
}

// Tool resolver: sectionId/toolId → component to render.
const RESOLVE = {
  analytics: {
    'founder-board':  { Comp: FounderBoardTool },
    'control-center': { Comp: ControlCenterHub },
    simulator:        { Comp: SimulatorHub },
    'branch-compare': { Comp: BranchCompareTool },
    reports:          { Comp: ReportsHub },
    'basket-analysis':{ Comp: BasketTool },
    cohorts:          { Comp: CohortsTool },
    'unit-economics': { Comp: UnitEconomicsTool },
    'ab-point':       { Comp: AbPointTool },
    ssp:              { Comp: SspTool },
  },
  finance: {
    cash:        { Comp: () => <LiveWrapper title="Кассы" sub="Приход, расход и баланс по 10 валютам" Component={CashReport} /> },
    pnl:         { Comp: () => <LiveWrapper title="P&L отчёт" sub="Выручка · себестоимость · маржа · прибыль" Component={CashProfit} /> },
    cashflow:    { Comp: CashflowTool },
    'cash-forecast': { Comp: CashForecastHub },
    'expenses-report': { Comp: ExpensesReportTool },
    'fin-health':      { Comp: FinHealthHub },
    pricing:     { Comp: PricingTool },
    'break-even':{ Comp: BreakEvenTool },
    'fin-model': { Comp: FinModelTool },
    'currency-ops':     { Comp: CurrencyOpsTool },
    taxes:              { Comp: TaxesTool },
  },
  marketing: {
    funnel:         { Comp: FunnelHub },
    channels:       { Comp: ChannelsTool },
    ltv:            { Comp: LtvTool },
    'customer-campaigns': { Comp: CustomerCampaignsTool },
    loyalty:        { Comp: LoyaltyPointsTool },
    'competitor-mirror': { Comp: CompetitorMirrorTool },
    'ca-analysis':  { Comp: PersonasTool },
    'content-plan': { Comp: ContentPlanTool },
  },
  procurement: {
    suppliers:         { Comp: () => <LiveWrapper title="Поставщики" sub="База поставщиков · контакты · история" Component={SuppliersManager} /> },
    income:            { Comp: () => <LiveWrapper title="Приход товара" sub="От поставщиков · оплата · долги" Component={WarehouseIncome} /> },
    receivings:        { Comp: ReceivingsTool },
    'procurement-orders': { Comp: ProcurementOrdersTool },
    'purchase-forecast':  { Comp: PurchaseForecastHub },
    'purchase-history':   { Comp: PurchaseHistoryTool },
    'supplier-returns':   { Comp: SupplierReturnsTool },
    'debts-suppliers':    { Comp: DebtsTool },
    'supplier-eval':      { Comp: SupplierEvalHub },
  },
  warehouse: {
    stock:           { Comp: () => <LiveWrapper title="Товары и остатки" sub="Каталог · цены · фото · штрих-коды · печать ценников" Component={WarehouseBalance} /> },
    'inventory-mgmt':{ Comp: InventoryMgmtTool },
    'goods-flow':           { Comp: GoodsFlowHub },
    'turnover-deadstock':   { Comp: TurnoverDeadstockTool },
    'stock-math':           { Comp: StockMathHub },
    'purchase-roi':         { Comp: PurchaseRoiTool },
    defects:                { Comp: DefectsTool },
    audit:                  { Comp: InventoryAuditTool },
    references:             { Comp: ReferencesHub },
  },
  operations: {
    'sales-history':      { Comp: SalesHistoryTool },
    pos:                  { Comp: PosTool },
    'sales-top-products': { Comp: SalesTopProductsTool },
    'seller-avg-check':   { Comp: SellerAvgCheckTool },
    discounts:            { Comp: DiscountsTool },
    'returns-report':     { Comp: ReturnsReportTool },
    'sales-forecast':     { Comp: SalesForecastTool },
    scripts:              { Comp: SalesScriptsTool },
    tasks:                { Comp: TasksHub },
  },
  hr: {
    team:        { Comp: TeamHub },
    users:       { Comp: () => <LiveWrapper title="Сотрудники компании" sub="Роли · филиалы · доступ" Component={GenDirUsers} /> },
    schedules:         { Comp: SchedulesTool },
    attendance:        { Comp: AttendanceTool },
    absences:          { Comp: AbsencesTool },
    salaries:          { Comp: SalariesTool },
    'hr-adjustments':  { Comp: HrAdjustmentsTool },
    'hr-productivity': { Comp: HrProductivityTool },
    'hr-analytics':    { Comp: HrAnalyticsHub },
    'hr-forecast':     { Comp: HrForecastTool },
    training:          { Comp: TrainingCoursesTool },
  },
  support: {
    crm:             { Comp: () => <LiveWrapper title="Клиентская база" sub="Карточки · история покупок · долги" Component={CustomersManager} /> },
    segments:        { Comp: SegmentsHub },
    'debts-clients': { Comp: DebtsClientsTool },
    birthdays:       { Comp: BirthdaysTool },
    referrals:       { Comp: ReferralsTool },
    'client-forecast': { Comp: ClientForecastTool },
    feedback:        { Comp: FeedbackHub },
  },
  settings: {
    'panel-manager': { Comp: PanelManagerTool },
    integrations:  { Comp: IntegrationsTool },
    security:      { Comp: SecurityTool },
    scaling:       { Comp: ScalingTool },
    'event-journal': { Comp: EventJournalTool },
  },
};

export default function ToolRouter() {
  const { user } = useContext(AuthContext);
  const { tt } = useTt();
  const { sectionId, toolId } = useParams();
  const navigate = useNavigate();
  const sections = getUserSections(user);
  const section = sections.find(s => s.id === sectionId);
  const tool = section?.tools.find(t => t.id === toolId);

  if (!section || !tool) return <Navigate to="/owner" replace />;
  const entry = RESOLVE[sectionId]?.[toolId];

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <button onClick={() => navigate('/owner/' + section.id)} className="btn btn-ghost btn-sm" title={tt('Назад')}>
        {tt('← Назад')}
      </button>
      <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
        <span style={{ cursor: 'pointer', color: 'var(--text2)' }} onClick={() => navigate('/owner/' + section.id)}>
          {tt(section.title)}
        </span>
        <span style={{ margin: '0 7px', color: 'var(--text3)' }}>/</span>
        <span style={{ color: 'var(--text)' }}>{tt(tool.title)}</span>
      </div>
    </div>
  );

  if (!entry) {
    return (
      <>
        {header}
        <ComingSoon title={tt(tool.title)}>
          <div>{tt(tool.desc)}</div>
          <div style={{ marginTop: 14, fontSize: 12 }}>{tt('Этот инструмент будет реализован в следующих обновлениях. Если он критичен — напишите, поднимем приоритет.')}</div>
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
          background: '#FFFBEB',
          borderColor: '#FDE68A',
          color: '#92400E',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginBottom: 14,
        }}>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>{tt('Дизайн-макет — данные ниже не настоящие')}</div>
            <div style={{ fontWeight: 500 }}>
              {tt('Это образец интерфейса для согласования. Реальные данные подключим в следующих обновлениях. Кнопки в макете не сохраняют ничего.')}
            </div>
          </div>
        </div>
      )}
      {/* Каждый инструмент изолирован: его краш показывает карточку, а оболочка и
          другие инструменты продолжают работать. key сбрасывает ошибку при смене инструмента. */}
      <ErrorBoundary compact key={sectionId + '/' + toolId}>
        <Comp />
      </ErrorBoundary>
    </>
  );
}
