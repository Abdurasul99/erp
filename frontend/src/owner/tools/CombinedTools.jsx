import React, { useContext, useState } from 'react';
import { AuthContext } from '../../App.jsx';
import { useTt } from '../tt.js';

// ═══ Объединённые хабы — ядро упрощения панели ═══
// Было 116 отдельных кнопок; родственные экраны («что если» ×8, алерты ×5, задачи ×4,
// воронки ×4, прогнозы, HR-аналитика…) собраны в хабы с вкладками. Внутри вкладок —
// ТЕ ЖЕ существующие компоненты: ничего не удалено, только сгруппировано. Каждый
// дочерний инструмент сам публикует свой PageHeader в топбар — заголовок меняется
// вместе с вкладкой.

// Существующие инструменты (перенесены из ToolRouter — рендерятся теперь отсюда)
import GlobalWhatIfTool from './GlobalWhatIfTool.jsx';
import ModelingTool from './ModelingTool.jsx';
import FinWhatifTool from './FinWhatifTool.jsx';
import SalesWhatifTool from './SalesWhatifTool.jsx';
import InventoryWhatifTool from './InventoryWhatifTool.jsx';
import WhatIfPurchasesTool from './WhatIfPurchasesTool.jsx';
import HrWhatifTool from './HrWhatifTool.jsx';
import WhatIfClientsTool from './WhatIfClientsTool.jsx';

import AlertCenterTool from './AlertCenterTool.jsx';
import AnomalyTool from './AnomalyTool.jsx';
import StorePoliceTool from './StorePoliceTool.jsx';
import RiskControlTool from './RiskControlTool.jsx';
import MinStockAlertTool from './MinStockAlertTool.jsx';

import TasksTool from './TasksTool.jsx';
import TaskTemplatesTool from './TaskTemplatesTool.jsx';
import TaskAnalyticsTool from './TaskAnalyticsTool.jsx';
import ChecklistsTool from './ChecklistsTool.jsx';

import BusinessFunnelTool from './BusinessFunnelTool.jsx';
import LossFunnelTool from './LossFunnelTool.jsx';
import SalesFunnelTool from './SalesFunnelTool.jsx';
import LeadTrackerTool from './LeadTrackerTool.jsx';

import CashGapTool from './CashGapTool.jsx';
import PaymentCalendarTool from './PaymentCalendarTool.jsx';
import ProfitabilityTool from './ProfitabilityTool.jsx';
import FinancialRatiosTool from './FinancialRatiosTool.jsx';

import PurchaseForecastTool from './PurchaseForecastTool.jsx';
import DemandForecastTool from './DemandForecastTool.jsx';

import EoqTool from './EoqTool.jsx';
import ReorderPointTool from './ReorderPointTool.jsx';
import SafetyStockTool from './SafetyStockTool.jsx';

import FireAnalysisTool from './FireAnalysisTool.jsx';
import WorkdayMapTool from './WorkdayMapTool.jsx';
import EmployeeHealthTool from './EmployeeHealthTool.jsx';
import HireFireCalcTool from './HireFireCalcTool.jsx';

import MotivationTool from './MotivationTool.jsx';
import HrTool from './HrTool.jsx';
import TeamKPI from '../../components/TeamKPI.jsx';

import AbcClientsTool from './AbcClientsTool.jsx';
import SegmentationTool from './SegmentationTool.jsx';
import ChurnTool from './ChurnTool.jsx';

import TrendsTool from './TrendsTool.jsx';
import PeriodReportTool from './PeriodReportTool.jsx';
import SupplierRatingsTool from './SupplierRatingsTool.jsx';
import SupplierCompareTool from './SupplierCompareTool.jsx';
import StockOutcomeReportTool from './StockOutcomeReportTool.jsx';
import StockTransfersTool from './StockTransfersTool.jsx';
import ProductMovementsTool from './ProductMovementsTool.jsx';
import ReferencesTool from './ReferencesTool.jsx';
import BarcodesTool from './BarcodesTool.jsx';
import NpsReviewsTool from './NpsReviewsTool.jsx';
import ComplaintsTool from './ComplaintsTool.jsx';

// Общий каркас хаба: сегмент-контрол вкладок + активный инструмент.
// roles на вкладке ограничивает её видимость (напр. финансовые сценарии — только учредителю).
function TabHub({ tabs, storageKey }) {
  const { user } = useContext(AuthContext);
  const { tt } = useTt();
  const role = user?.role;
  const visible = tabs.filter(t => !t.roles || t.roles.includes(role));
  const [active, setActive] = useState(() => {
    const saved = storageKey ? localStorage.getItem('hub_' + storageKey) : null;
    return visible.some(t => t.key === saved) ? saved : visible[0]?.key;
  });
  const pick = (k) => { setActive(k); if (storageKey) localStorage.setItem('hub_' + storageKey, k); };
  const current = visible.find(t => t.key === active) || visible[0];
  if (!current) return null;
  const Comp = current.Comp;
  return (
    <>
      <div className="hub-tabs" role="tablist">
        {visible.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === current.key}
            className={'hub-tab' + (t.key === current.key ? ' active' : '')}
            onClick={() => pick(t.key)}>
            {tt(t.label)}
          </button>
        ))}
      </div>
      <Comp key={current.key} />
    </>
  );
}

// «Симулятор» — все сценарии «что если» в одном месте.
// Финансовые сценарии (бизнес целиком, цена/маржа, финансы) — только учредителю.
export function SimulatorHub() {
  return <TabHub storageKey="simulator" tabs={[
    { key: 'business',  label: 'Бизнес целиком', roles: ['founder'], Comp: GlobalWhatIfTool },
    { key: 'price',     label: 'Цена и маржа',   roles: ['founder'], Comp: ModelingTool },
    { key: 'finance',   label: 'Финансы',        roles: ['founder'], Comp: FinWhatifTool },
    { key: 'sales',     label: 'Продажи',        Comp: SalesWhatifTool },
    { key: 'stock',     label: 'Склад',          Comp: InventoryWhatifTool },
    { key: 'purchases', label: 'Закупки',        Comp: WhatIfPurchasesTool },
    { key: 'hr',        label: 'Персонал',       Comp: HrWhatifTool },
    { key: 'clients',   label: 'Клиенты',        Comp: WhatIfClientsTool },
  ]} />;
}

// «Центр контроля» — все сигналы о проблемах: алерты, аномалии, злоупотребления, риски, дефицит.
export function ControlCenterHub() {
  return <TabHub storageKey="control" tabs={[
    { key: 'alerts',    label: 'Алерты',           Comp: AlertCenterTool },
    { key: 'anomaly',   label: 'Аномалии',         Comp: AnomalyTool },
    { key: 'police',    label: 'Полиция магазина', Comp: StorePoliceTool },
    { key: 'risks',     label: 'Риски',            Comp: RiskControlTool },
    { key: 'minstock',  label: 'Дефицит товара',   Comp: MinStockAlertTool },
  ]} />;
}

// «Задачи» — доска, шаблоны, аналитика, чеклисты.
export function TasksHub() {
  return <TabHub storageKey="tasks" tabs={[
    { key: 'board',      label: 'Доска',      Comp: TasksTool },
    { key: 'templates',  label: 'Шаблоны',    Comp: TaskTemplatesTool },
    { key: 'analytics',  label: 'Аналитика',  Comp: TaskAnalyticsTool },
    { key: 'checklists', label: 'Чеклисты',   Comp: ChecklistsTool },
  ]} />;
}

// «Воронка» — путь клиента: от показов до VIP, потери, планировщик, лиды.
export function FunnelHub() {
  return <TabHub storageKey="funnel" tabs={[
    { key: 'business', label: 'Воронка бизнеса', Comp: BusinessFunnelTool },
    { key: 'loss',     label: 'Потери',          Comp: LossFunnelTool },
    { key: 'planner',  label: 'Планировщик',     Comp: SalesFunnelTool },
    { key: 'leads',    label: 'Лиды',            Comp: LeadTrackerTool },
  ]} />;
}

// «Прогноз кассы» — кассовый разрыв + платёжный календарь.
export function CashForecastHub() {
  return <TabHub storageKey="cashfc" tabs={[
    { key: 'gap',      label: 'Кассовый разрыв',    Comp: CashGapTool },
    { key: 'calendar', label: 'Платёжный календарь', Comp: PaymentCalendarTool },
  ]} />;
}

// «Показатели» — рентабельность + финансовые коэффициенты.
export function FinHealthHub() {
  return <TabHub storageKey="finhealth" tabs={[
    { key: 'profitability', label: 'Рентабельность', Comp: ProfitabilityTool },
    { key: 'ratios',        label: 'Коэффициенты',   Comp: FinancialRatiosTool },
  ]} />;
}

// «Прогноз закупок» — что заказать + потребность склада.
export function PurchaseForecastHub() {
  return <TabHub storageKey="purchfc" tabs={[
    { key: 'orders', label: 'Что заказать',       Comp: PurchaseForecastTool },
    { key: 'demand', label: 'Потребность склада', Comp: DemandForecastTool },
  ]} />;
}

// «Расчёты запасов» — EOQ, точка заказа, страховой запас.
export function StockMathHub() {
  return <TabHub storageKey="stockmath" tabs={[
    { key: 'eoq',    label: 'Оптимальный заказ (EOQ)', Comp: EoqTool },
    { key: 'rop',    label: 'Точка заказа',            Comp: ReorderPointTool },
    { key: 'safety', label: 'Страховой запас',         Comp: SafetyStockTool },
  ]} />;
}

// «HR-аналитика» — глубокий разбор персонала (4 бывших отдельных экрана).
export function HrAnalyticsHub() {
  return <TabHub storageKey="hranalytics" tabs={[
    { key: 'fire',    label: 'Рейтинг и увольнение', Comp: FireAnalysisTool },
    { key: 'workday', label: 'Карта рабочего дня',   Comp: WorkdayMapTool },
    { key: 'health',  label: 'Выгорание',            Comp: EmployeeHealthTool },
    { key: 'calc',    label: 'Калькулятор найма',    Comp: HireFireCalcTool },
  ]} />;
}

// «Команда» — KPI + лидерборд + картотека.
function TeamKpiWrapped() {
  return <div className="card" style={{ padding: 20 }}><TeamKPI /></div>;
}
export function TeamHub() {
  return <TabHub storageKey="team" tabs={[
    { key: 'kpi',        label: 'KPI команды', Comp: TeamKpiWrapped },
    { key: 'leaderboard', label: 'Лидерборд',  Comp: MotivationTool },
    { key: 'cards',      label: 'Картотека',   Comp: HrTool },
  ]} />;
}

// «Сегменты клиентов» — ABC, RFM-сегменты, отток.
export function SegmentsHub() {
  return <TabHub storageKey="segments" tabs={[
    { key: 'abc',      label: 'ABC-анализ', Comp: AbcClientsTool },
    { key: 'segments', label: 'Сегменты',   Comp: SegmentationTool },
    { key: 'churn',    label: 'Отток',      Comp: ChurnTool },
  ]} />;
}

// «Отчёты и тренды» — 12-мес динамика + сводный отчёт периода.
export function ReportsHub() {
  return <TabHub storageKey="reports" tabs={[
    { key: 'trends', label: 'Тренды',        Comp: TrendsTool },
    { key: 'period', label: 'Сводный отчёт', Comp: PeriodReportTool },
  ]} />;
}

// «Оценка поставщиков» — рейтинг + сравнение.
export function SupplierEvalHub() {
  return <TabHub storageKey="supeval" tabs={[
    { key: 'ratings', label: 'Рейтинг',   Comp: SupplierRatingsTool },
    { key: 'compare', label: 'Сравнение', Comp: SupplierCompareTool },
  ]} />;
}

// «Движение товара» — расход, перемещения между складами, история.
export function GoodsFlowHub() {
  return <TabHub storageKey="goodsflow" tabs={[
    { key: 'outcome',   label: 'Расход',      Comp: StockOutcomeReportTool },
    { key: 'transfers', label: 'Перемещения', Comp: StockTransfersTool },
    { key: 'history',   label: 'История',     Comp: ProductMovementsTool },
  ]} />;
}

// «Справочники» — словари + штрихкоды.
export function ReferencesHub() {
  return <TabHub storageKey="references" tabs={[
    { key: 'dicts',    label: 'Справочники', Comp: ReferencesTool },
    { key: 'barcodes', label: 'Штрихкоды',   Comp: BarcodesTool },
  ]} />;
}

// «Отзывы и жалобы» — NPS/отзывы + тикеты жалоб.
export function FeedbackHub() {
  return <TabHub storageKey="feedback" tabs={[
    { key: 'nps',        label: 'NPS и отзывы', Comp: NpsReviewsTool },
    { key: 'complaints', label: 'Жалобы',       Comp: ComplaintsTool },
  ]} />;
}
