import React, { useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import { getUserSections } from './modules.js';
import { Card, PageHeader, ComingSoon, Badge } from './ui.jsx';
import { useTt } from './tt.js';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import PanelManagerTool from './tools/PanelManagerTool.jsx';

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
import FounderBoardTool from './tools/FounderBoardTool.jsx';
import PeriodReportTool from './tools/PeriodReportTool.jsx';
import UnitEconomicsTool from './tools/UnitEconomicsTool.jsx';
import BusinessFunnelTool from './tools/BusinessFunnelTool.jsx';
import SspTool from './tools/SspTool.jsx';
import TasksTool from './tools/TasksTool.jsx';
import TaskTemplatesTool from './tools/TaskTemplatesTool.jsx';
import TaskAnalyticsTool from './tools/TaskAnalyticsTool.jsx';
import ChecklistsTool from './tools/ChecklistsTool.jsx';
import BasketTool from './tools/BasketTool.jsx';
import EventJournalTool from './tools/EventJournalTool.jsx';
import AlertCenterTool from './tools/AlertCenterTool.jsx';
import BranchCompareTool from './tools/BranchCompareTool.jsx';
import TrendsTool from './tools/TrendsTool.jsx';
import AnomalyTool from './tools/AnomalyTool.jsx';
import CohortsTool from './tools/CohortsTool.jsx';
import ComplaintsTool from './tools/ComplaintsTool.jsx';
import BirthdaysTool from './tools/BirthdaysTool.jsx';
import ReferralsTool from './tools/ReferralsTool.jsx';
import ClientForecastTool from './tools/ClientForecastTool.jsx';
import WhatIfClientsTool from './tools/WhatIfClientsTool.jsx';
import InventoryMgmtTool from './tools/InventoryMgmtTool.jsx';
import PricingTool from './tools/PricingTool.jsx';
import RiskControlTool from './tools/RiskControlTool.jsx';
import DebtsClientsTool from './tools/DebtsClientsTool.jsx';
// Волна 1 — Склад
import StockOutcomeReportTool from './tools/StockOutcomeReportTool.jsx';
import StockTransfersTool from './tools/StockTransfersTool.jsx';
import ProductMovementsTool from './tools/ProductMovementsTool.jsx';
import TurnoverDeadstockTool from './tools/TurnoverDeadstockTool.jsx';
import EoqTool from './tools/EoqTool.jsx';
import ReorderPointTool from './tools/ReorderPointTool.jsx';
import SafetyStockTool from './tools/SafetyStockTool.jsx';
import PurchaseRoiTool from './tools/PurchaseRoiTool.jsx';
import MinStockAlertTool from './tools/MinStockAlertTool.jsx';
import BarcodesTool from './tools/BarcodesTool.jsx';
import DemandForecastTool from './tools/DemandForecastTool.jsx';
import InventoryWhatifTool from './tools/InventoryWhatifTool.jsx';
import InventoryAuditTool from './tools/InventoryAuditTool.jsx';
import DefectsTool from './tools/DefectsTool.jsx';
// Волна 2 — Финансы
import ExpensesReportTool from './tools/ExpensesReportTool.jsx';
import ProfitabilityTool from './tools/ProfitabilityTool.jsx';
import PaymentCalendarTool from './tools/PaymentCalendarTool.jsx';
import CurrencyOpsTool from './tools/CurrencyOpsTool.jsx';
import TaxesTool from './tools/TaxesTool.jsx';
import FinancialRatiosTool from './tools/FinancialRatiosTool.jsx';
import FinWhatifTool from './tools/FinWhatifTool.jsx';
// Волна 3 — Закупки
import PurchaseHistoryTool from './tools/PurchaseHistoryTool.jsx';
import SupplierReturnsTool from './tools/SupplierReturnsTool.jsx';
import SupplierRatingsTool from './tools/SupplierRatingsTool.jsx';
import PurchaseForecastTool from './tools/PurchaseForecastTool.jsx';
import WhatIfPurchasesTool from './tools/WhatIfPurchasesTool.jsx';
import ProcurementOrdersTool from './tools/ProcurementOrdersTool.jsx';
import ReceivingsTool from './tools/ReceivingsTool.jsx';
import SupplierCompareTool from './tools/SupplierCompareTool.jsx';
// Волна 4 — Продажи
import DiscountsTool from './tools/DiscountsTool.jsx';
import SalesTopProductsTool from './tools/SalesTopProductsTool.jsx';
import SellerAvgCheckTool from './tools/SellerAvgCheckTool.jsx';
import ReturnsReportTool from './tools/ReturnsReportTool.jsx';
import CustomerCampaignsTool from './tools/CustomerCampaignsTool.jsx';
import SalesForecastTool from './tools/SalesForecastTool.jsx';
import SalesWhatifTool from './tools/SalesWhatifTool.jsx';
import NpsReviewsTool from './tools/NpsReviewsTool.jsx';
import SalesScriptsTool from './tools/SalesScriptsTool.jsx';
import LeadTrackerTool from './tools/LeadTrackerTool.jsx';
import LoyaltyPointsTool from './tools/LoyaltyPointsTool.jsx';
// Волна 5 — Персонал
import SchedulesTool from './tools/SchedulesTool.jsx';
import AttendanceTool from './tools/AttendanceTool.jsx';
import AbsencesTool from './tools/AbsencesTool.jsx';
import SalariesTool from './tools/SalariesTool.jsx';
import HrProductivityTool from './tools/HrProductivityTool.jsx';
import HrAdjustmentsTool from './tools/HrAdjustmentsTool.jsx';
import HrForecastTool from './tools/HrForecastTool.jsx';
import HrWhatifTool from './tools/HrWhatifTool.jsx';
import TrainingCoursesTool from './tools/TrainingCoursesTool.jsx';
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
import LtvTool from './tools/LtvTool.jsx';
import ChannelsTool from './tools/ChannelsTool.jsx';
import LeadGenTool from './tools/LeadGenTool.jsx';
import CompetitorsTool from './tools/CompetitorsTool.jsx';
import LoyaltyTool from './tools/LoyaltyTool.jsx';
import AnalyticsTool from './tools/AnalyticsTool.jsx';
import PlanningTool from './tools/PlanningTool.jsx';
import AiAdvisorTool from './tools/AiAdvisorTool.jsx';
import AutomationTool from './tools/AutomationTool.jsx';
import MgmtTool from './tools/MgmtTool.jsx';
import HrTool from './tools/HrTool.jsx';
import MotivationTool from './tools/MotivationTool.jsx';
import TrainingTool from './tools/TrainingTool.jsx';
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
// Catalog section has been merged into Warehouse — products now live under warehouse/stock,
// and the four reference dictionaries (types/brands/units/attrs) are unified under warehouse/references.
// === Волна новых инструментов ===
import ChurnTool from './tools/ChurnTool.jsx';
import AbcClientsTool from './tools/AbcClientsTool.jsx';
import CashGapTool from './tools/CashGapTool.jsx';
import HireFireCalcTool from './tools/HireFireCalcTool.jsx';
import GlobalWhatIfTool from './tools/GlobalWhatIfTool.jsx';

// === build wave2 ===
import LossFunnelTool from './tools/LossFunnelTool.jsx';
import CompetitorMirrorTool from './tools/CompetitorMirrorTool.jsx';
import AbPointTool from './tools/AbPointTool.jsx';
import StorePoliceTool from './tools/StorePoliceTool.jsx';

// === build wave3 ===
import EmployeeHealthTool from './tools/EmployeeHealthTool.jsx';
import WorkdayMapTool from './tools/WorkdayMapTool.jsx';
import FireAnalysisTool from './tools/FireAnalysisTool.jsx';
import HrTrelloTool from './tools/HrTrelloTool.jsx';
import SalesFunnelTool from './tools/SalesFunnelTool.jsx';

const RESOLVE = {
  analytics: {
    'ab-point':       { Comp: AbPointTool },
    'founder-board':  { Comp: FounderBoardTool },
    'alert-center':   { Comp: AlertCenterTool },
    anomaly:          { Comp: AnomalyTool },
    'branch-compare': { Comp: BranchCompareTool },
    trends:           { Comp: TrendsTool },
    'business-funnel':{ Comp: BusinessFunnelTool },
    'period-report':  { Comp: PeriodReportTool },
    'basket-analysis':{ Comp: BasketTool },
    cohorts:          { Comp: CohortsTool },
    'unit-economics': { Comp: UnitEconomicsTool },
    ssp:              { Comp: SspTool },
  },
  finance: {
    'cash-gap':         { Comp: CashGapTool },
    cash:        { Comp: () => <LiveWrapper title="🏦 Кассы" sub="Приход, расход и баланс по 10 валютам" Component={CashReport} /> },
    pnl:         { Comp: () => <LiveWrapper title="📊 P&L отчёт" sub="Выручка · себестоимость · маржа · прибыль" Component={CashProfit} /> },
    'branch-compare': { Comp: BranchCompareTool },
    pricing:     { Comp: PricingTool },
    cashflow:    { Comp: CashflowTool },
    'break-even':{ Comp: BreakEvenTool },
    'fin-model': { Comp: FinModelTool },
    'expenses-report': { Comp: ExpensesReportTool },
    'profitability':    { Comp: ProfitabilityTool },
    'payment-calendar': { Comp: PaymentCalendarTool },
    'currency-ops':     { Comp: CurrencyOpsTool },
    'taxes':            { Comp: TaxesTool },
    'financial-ratios': { Comp: FinancialRatiosTool },
    'fin-whatif':       { Comp: FinWhatifTool },
    modeling:    { Comp: ModelingTool },
    trends:      { Comp: TrendsTool },
    'founder-board':  { Comp: FounderBoardTool },
    'period-report':  { Comp: PeriodReportTool },
    'unit-economics': { Comp: UnitEconomicsTool },
  },
  marketing: {
    'sales-funnel': { Comp: SalesFunnelTool },
    'competitor-mirror': { Comp: CompetitorMirrorTool },
    'loss-funnel':{ Comp: LossFunnelTool },
    'ca-analysis':  { Comp: PersonasTool },
    'content-plan': { Comp: ContentPlanTool },
    channels:       { Comp: ChannelsTool },
    ltv:            { Comp: LtvTool },
    'strategy-3y':  { Comp: Strategy3yTool },
    leadgen:        { Comp: LeadTrackerTool },
    'customer-campaigns': { Comp: CustomerCampaignsTool },
    competitors:    { Comp: CompetitorsTool },
    loyalty:        { Comp: LoyaltyPointsTool },
    ssp:            { Comp: SspTool },
    'business-funnel':{ Comp: BusinessFunnelTool },
  },
  procurement: {
    suppliers:         { Comp: () => <LiveWrapper title="🏭 Поставщики" sub="База поставщиков · контакты · история" Component={SuppliersManager} /> },
    'debts-suppliers': { Comp: DebtsTool },
    income:            { Comp: () => <LiveWrapper title="📥 Приход товара" sub="От поставщиков · оплата · долги" Component={WarehouseIncome} /> },
    'procurement-orders': { Comp: ProcurementOrdersTool },
    'purchase-history':    { Comp: PurchaseHistoryTool },
    'supplier-returns':    { Comp: SupplierReturnsTool },
    'supplier-ratings':    { Comp: SupplierRatingsTool },
    'purchase-forecast':   { Comp: PurchaseForecastTool },
    'what-if-purchases':   { Comp: WhatIfPurchasesTool },
    'receivings':          { Comp: ReceivingsTool },
    'supplier-compare':    { Comp: SupplierCompareTool },
  },
  warehouse: {
    stock:           { Comp: () => <LiveWrapper title="📦 Товары и остатки" sub="Каталог · цены · фото · штрих-коды · печать ценников" Component={WarehouseBalance} /> },
    'inventory-mgmt':{ Comp: InventoryMgmtTool },
    'stock-outcome-report': { Comp: StockOutcomeReportTool },
    'stock-transfers':      { Comp: StockTransfersTool },
    'product-movements':    { Comp: ProductMovementsTool },
    'turnover-deadstock':   { Comp: TurnoverDeadstockTool },
    'eoq':                  { Comp: EoqTool },
    'reorder-point':        { Comp: ReorderPointTool },
    'safety-stock':         { Comp: SafetyStockTool },
    'purchase-roi':         { Comp: PurchaseRoiTool },
    'min-stock-alert':      { Comp: MinStockAlertTool },
    'barcodes':             { Comp: BarcodesTool },
    'demand-forecast':      { Comp: DemandForecastTool },
    'inventory-whatif':     { Comp: InventoryWhatifTool },
    'defects':              { Comp: DefectsTool },
    references:      { Comp: ReferencesTool },
    bundles:         { Comp: BundlesTool },
    logistics:       { Comp: LogisticsTool },
    audit:           { Comp: InventoryAuditTool },
  },
  operations: {
    'store-police': { Comp: StorePoliceTool },
    'global-whatif':      { Comp: GlobalWhatIfTool },
    'sales-history':    { Comp: SalesHistoryTool },
    pos:                { Comp: PosTool },
    b2b:                { Comp: B2BTool },
    'commercial-offer': { Comp: CommercialOfferTool },
    scripts:            { Comp: SalesScriptsTool },
    'discounts':          { Comp: DiscountsTool },
    'sales-top-products': { Comp: SalesTopProductsTool },
    'seller-avg-check':   { Comp: SellerAvgCheckTool },
    'returns-report':     { Comp: ReturnsReportTool },
    'sales-forecast':     { Comp: SalesForecastTool },
    'sales-whatif':       { Comp: SalesWhatifTool },
    'risk-control':     { Comp: RiskControlTool },
    'alert-center':  { Comp: AlertCenterTool },
    anomaly:         { Comp: AnomalyTool },
    planning:           { Comp: PlanningTool },
    automation:         { Comp: AutomationTool },
    tasks:              { Comp: TasksTool },
    'task-templates':   { Comp: TaskTemplatesTool },
    'task-analytics':   { Comp: TaskAnalyticsTool },
    checklists:         { Comp: ChecklistsTool },
    'basket-analysis':  { Comp: BasketTool },
  },
  hr: {
    'hr-trello': { Comp: HrTrelloTool },
    'fire-analysis':   { Comp: FireAnalysisTool },
    'workday-map': { Comp: WorkdayMapTool },
    'employee-health': { Comp: EmployeeHealthTool },
    'hire-fire-calc': { Comp: HireFireCalcTool },
    'team-kpi':  { Comp: () => <LiveWrapper title="👥 KPI команды" sub="Продажи, маржа и эффективность сотрудников" Component={TeamKPI} /> },
    users:       { Comp: () => <LiveWrapper title="🧑‍💼 Сотрудники компании" sub="Роли · филиалы · доступ" Component={GenDirUsers} /> },
    training:    { Comp: TrainingCoursesTool },
    'schedules':       { Comp: SchedulesTool },
    'attendance':      { Comp: AttendanceTool },
    'absences':        { Comp: AbsencesTool },
    'salaries':        { Comp: SalariesTool },
    'hr-productivity': { Comp: HrProductivityTool },
    'hr-adjustments':  { Comp: HrAdjustmentsTool },
    'hr-forecast':     { Comp: HrForecastTool },
    'hr-whatif':       { Comp: HrWhatifTool },
    motivation:  { Comp: MotivationTool },
    'hr-overview': { Comp: HrTool },
  },
  support: {
    'abc-clients':   { Comp: AbcClientsTool },
    churn:            { Comp: ChurnTool },
    crm:             { Comp: () => <LiveWrapper title="👥 Клиентская база" sub="Карточки · история покупок · долги" Component={CustomersManager} /> },
    'debts-clients': { Comp: DebtsClientsTool },
    segmentation:    { Comp: SegmentationTool },
    complaints:       { Comp: ComplaintsTool },
    cohorts:          { Comp: CohortsTool },
    birthdays:        { Comp: BirthdaysTool },
    referrals:        { Comp: ReferralsTool },
    'client-forecast':{ Comp: ClientForecastTool },
    'what-if-clients':{ Comp: WhatIfClientsTool },
    nps:             { Comp: NpsReviewsTool },
    'cjm-client':    { Comp: CjmTool },
    'contact-points':{ Comp: ContactPointsTool },
  },
  settings: {
    'panel-manager': { Comp: PanelManagerTool },
    integrations: { Comp: IntegrationsTool },
    security:     { Comp: SecurityTool },
    scaling:      { Comp: ScalingTool },
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <button onClick={() => navigate('/owner/' + section.id)} className="btn btn-ghost btn-sm" title={tt('Назад')}>
        {tt('← Назад')}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>
        <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate('/owner/' + section.id)}>
          {section.icon} {tt(section.title)}
        </span>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--text2)' }}>{tt(tool.title)}</span>
      </div>
    </div>
  );

  if (!entry) {
    return (
      <>
        {header}
        <ComingSoon icon={tool.icon} title={tt(tool.title)}>
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
          background: 'linear-gradient(135deg, rgba(245,158,11,.10), rgba(255,107,43,.10))',
          borderColor: 'rgba(245,158,11,.30)',
          color: '#92400E',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🚧</span>
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
