import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { BranchScope } from '../OwnerShell.jsx';
import { Tile, Card, Badge, AreaChart, BarChart, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum, fmtMoneyFull, fmtSum, todayLabel } from '../ui.jsx';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
  { value: 'all',   label: 'Всё' },
];

function periodRange(p) {
  const now = new Date();
  let from = null;
  if (p === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (p === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 7);
  } else if (p === 'month') {
    from = new Date(now); from.setMonth(now.getMonth() - 1);
  } else if (p === 'year') {
    from = new Date(now); from.setFullYear(now.getFullYear() - 1);
  }
  return { from: from ? from.toISOString() : null, to: null };
}

// Дельта к прошлому периоду. Если прошлый период пуст (0) — процент роста
// не имеет смысла («▲100% от нуля» вводит в заблуждение) → возвращаем null,
// и UI показывает «нет данных за прошлый период».
function deltaPct(current, prev) {
  if (prev == null) return null;
  if (prev === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prev) / Math.abs(prev)) * 100);
}

// Русские названия ролей для списков сотрудников
const ROLE_RU = {
  seller: 'продавец', cashier: 'кассир', warehouse: 'складовщик',
  manager: 'менеджер', gen_dir: 'ген. директор', founder: 'учредитель', admin: 'админ',
};

// Метки для разбивки по способу оплаты.
// Все суммы хранятся в UZS-эквиваленте (конвертация по курсу при продаже),
// поэтому подпись валюты везде UZS — метка «Доллар» означает способ оплаты, не валюту суммы.
const METHOD_LABELS = [
  { key: 'cash_uzs', label: 'Сум',         icon: '💵', curr: 'UZS' },
  { key: 'cash_usd', label: 'Доллар',      icon: '💲', curr: 'UZS' },
  { key: 'card',     label: 'На карту',    icon: '💳', curr: 'UZS' },
  { key: 'transfer', label: 'На кассу',    icon: '🏦', curr: 'UZS' },
];

// Компактная разбивка по способам оплаты — 4 строки внизу плитки
// unit: 'money' (по умолчанию, показывает «4 150 000 UZS») | 'count' (показывает «12 шт»)
function MethodBreakdown({ data, lightOnDark = false, unit = 'money' }) {
  if (!data) return null;
  const labelColor = lightOnDark ? 'rgba(255,255,255,.7)' : 'var(--text3)';
  const valueColor = lightOnDark ? 'rgba(255,255,255,.92)' : 'var(--text)';
  const dividerColor = lightOnDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.06)';
  return (
    <div style={{
      marginTop: 10, paddingTop: 8,
      borderTop: `1px solid ${dividerColor}`,
      display: 'grid', gridTemplateColumns: '1fr', gap: 2,
    }}>
      {METHOD_LABELS.map(m => {
        const v = parseFloat(data[m.key]) || 0;
        const isCount = unit === 'count';
        return (
          <div key={m.key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
            opacity: v > 0 ? 1 : 0.55,
          }}>
            <span style={{ color: labelColor, fontWeight: 700 }}>{m.icon} {m.label}</span>
            <span style={{ color: valueColor, fontWeight: 700 }}>
              {isCount ? fmtNum(v) : fmtMoneyFull(v)} <span style={{ opacity: .6, fontSize: 9 }}>{isCount ? 'шт' : m.curr}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Шапка карты графика — вынесена в module scope, чтобы НЕ пересоздаваться
// на каждый рендер Dashboard (иначе React ремонтирует DOM шапки каждый раз).
function ChartHead({ icon, iconBg, iconColor, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, minHeight: 44 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }} aria-hidden="true">{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

// Масштаб графика продаж (как в банковских приложениях): бар = день/неделя/месяц/год
const CHART_GRAN_OPTIONS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];
const CHART_RANGE_LABEL = {
  day: 'последние 30 дней', week: '12 недель', month: '12 месяцев', year: '5 лет',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { branchId, isOwner, role, branches: allBranches } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // График продаж живёт на своей гранулярности (независимо от периода плиток)
  const [chartGran, setChartGran] = useState('day');
  const [chart, setChart] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    // ignore-флаг: при быстром переключении периода старый ответ не должен
    // перезаписать свежий (защита от out-of-order ответов).
    let ignore = false;
    setLoading(true); setError(null);
    const { from, to } = periodRange(period);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [period, branchId]);

  useEffect(() => {
    let ignore = false;
    setChartLoading(true);
    const params = { granularity: chartGran };
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setChart(r.data); })
      .catch(() => { if (!ignore) setChart(null); })
      .finally(() => { if (!ignore) setChartLoading(false); });
    return () => { ignore = true; };
  }, [chartGran, branchId]);

  const t = data?.totals || {};
  const prev = data?.prev_totals || {};
  const branches = data?.branches || [];
  const trend = data?.sales_trend || [];
  const prevTrend = data?.prev_trend || [];
  const topProducts = data?.top_products || [];
  const topSellers = data?.top_sellers || [];
  const alerts = data?.alerts || [];

  // breakdown[type] === { cash_uzs, cash_usd, card, transfer }
  // type: 'revenue' | 'cash_in' | 'cash_out' | 'deals' | 'avg_check'
  const byMethod = t.by_method || {};

  const trendValues = useMemo(() => trend.map(x => x.revenue), [trend]);

  // Данные бар-чарта с бэкенда: бакеты уже агрегированы по chartGran (день/неделя/месяц/год)
  const chartValues = useMemo(() => (chart?.buckets || []).map(b => b.revenue), [chart]);
  const chartPrevValues = useMemo(() => (chart?.prev_buckets || []).map(b => b.revenue), [chart]);
  const chartLabels = useMemo(() => (chart?.buckets || []).map(b => b.label), [chart]);
  const chartTotal = chart?.total || 0;
  const chartPrevTotal = chart?.prev_total || 0;
  const chartDelta = deltaPct(chartTotal, chartPrevTotal);

  const revDelta = deltaPct(t.sales_revenue, prev.sales_revenue);
  const profitDelta = deltaPct(t.gross_profit, prev.gross_profit);
  const dealsDelta = deltaPct(t.deals_count, prev.deals_count);
  const checkDelta = deltaPct(t.avg_check, prev.avg_check);

  const scopeLabel = isOwner
    ? (branchId ? (allBranches.find(x => x.id === branchId)?.name || `Филиал #${branchId}`) : 'Все филиалы')
    : (role === 'manager' ? 'Мой филиал' : '');

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || '';

  // Single-branch summary — для cashflow-карточки (показывается всегда: для manager — его филиал, для founder/gen_dir — суммарно по всем)
  const branchSummary = (() => {
    if (!isOwner && branches.length === 1) {
      return {
        title: branches[0].branch_name,
        sub: `${branches[0].worker_count} сотр · маржа ${branches[0].margin_pct}%`,
        icon: '🏭',
      };
    }
    if (isOwner && branches.length > 0) {
      const totalWorkers = branches.reduce((a, b) => a + (b.worker_count || 0), 0);
      const avgMargin = t.margin_pct || 0;
      return {
        title: branchId
          ? (allBranches.find(x => x.id === branchId)?.name || `Филиал #${branchId}`)
          : 'Все филиалы',
        sub: `${totalWorkers} сотр · маржа ${avgMargin}%`,
        icon: '🏢',
      };
    }
    return null;
  })();

  return (
    <>
      <PageHeader
        title="Главная панель"
        sub={`${scopeLabel} · ${todayLabel()}`}
        actions={<Pills value={period} onChange={setPeriod} options={PERIOD_OPTIONS} label="Период панели" />}
      />

      {error && (
        <Card icon="⚠️" title="Ошибка загрузки">
          <div style={{ color: 'var(--red)' }}>{error}</div>
        </Card>
      )}

      {loading && !data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 16 }} className="dashboard-hero-row">
            <div className="card" style={{ minHeight: 280, padding: 28 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={44} style={{ width: '70%', marginBottom: 12 }} />
              <Skeleton height={12} style={{ width: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <Skeleton height={12} style={{ width: '50%', marginBottom: 10 }} />
                  <Skeleton height={22} style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <Skeleton height={14} style={{ width: '30%', marginBottom: 16 }} />
            <Skeleton height={40} />
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Hero row: Выручка (large hero tile) + Касса/Продажи/Чек (compact column) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 16 }} className="dashboard-hero-row">
            {/* Hero tile — ГОРИЗОНТАЛЬНЫЙ layout: цифры слева, бар-чарт заполняет
                правую часть на ВСЮ высоту плитки. Никакой пустоты — чарт растёт
                вместе с плиткой, как в банковских приложениях. */}
            <div style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #22C55E 60%, #4ade80 100%)',
              borderRadius: 18,
              padding: '22px 26px',
              color: '#fff',
              boxShadow: '0 8px 28px rgba(34,197,94,.32)',
              display: 'flex', gap: 24, minHeight: 260, flexWrap: 'wrap',
            }}>
              {/* Левая колонка — дата, выручка, breakdown */}
              <div style={{ flex: '0 1 290px', minWidth: 240, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, opacity: .85, textTransform: 'uppercase', letterSpacing: .8 }}>
                  📅 {todayLabel()}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, marginTop: 6 }}>
                  💰 ВЫРУЧКА · {periodLabel}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 34, fontWeight: 900, lineHeight: 1.05, marginTop: 6, letterSpacing: -0.5 }}>
                  {fmtMoneyFull(t.sales_revenue)} <span style={{ fontSize: 14, opacity: .7 }}>сум</span>
                </div>
                {revDelta != null ? (
                  <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 800 }}>
                    {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta)}% к прошлому периоду
                  </div>
                ) : (
                  data?.prev_totals != null && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, opacity: .75 }}>
                      Прошлый период пуст — сравнение появится позже
                    </div>
                  )
                )}
                <div style={{ marginTop: 'auto' }}>
                  <MethodBreakdown data={byMethod.revenue} lightOnDark />
                </div>
              </div>

              {/* Правая колонка — бар-чарт на всю высоту плитки */}
              {trendValues.length > 1 && trendValues.some(v => v > 0) && (
                <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-end', gap: 2,
                    flex: 1, minHeight: 140,
                    borderBottom: '1.5px solid rgba(255,255,255,.35)',
                  }}>
                    {trendValues.map((v, i) => {
                      const max = Math.max(...trendValues, 1);
                      const hPct = Math.max((v / max) * 100, v > 0 ? 4 : 0);
                      const label = trend[i] ? new Date(trend[i].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '';
                      return (
                        <div key={i} title={`${label}: ${fmtMoneyFull(v)} сум`} style={{
                          flex: 1, minWidth: 0, height: '100%',
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        }}>
                          <div style={{
                            width: 'min(65%, 12px)', height: `${hPct}%`,
                            background: 'rgba(255,255,255,.92)', borderRadius: 99,
                            minHeight: v > 0 ? 3 : 0,
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  {/* Даты под барами: первая · середина · последняя */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontWeight: 700, opacity: .75, fontFamily: "'JetBrains Mono', monospace" }}>
                    {[0, Math.floor(trend.length / 2), trend.length - 1].map((idx, k) => (
                      <span key={k}>{trend[idx] ? new Date(trend[idx].date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: 3 compact tiles stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CompactTile icon="🏦" label="Касса (баланс)" value={fmtMoneyFull(t.cash_balance)} sub="сум · остаток на сейчас"
                breakdown={byMethod.cash_in} color="#0EA5E9" />
              <CompactTile icon="📦" label="Продаж" value={fmtNum(t.deals_count)} sub="за период"
                breakdown={byMethod.deals} delta={dealsDelta} color="#5B4FE8" countMode="шт" />
              <CompactTile icon="🧾" label="Средний чек" value={fmtMoneyFull(t.avg_check)} sub="сум"
                breakdown={byMethod.avg_check} delta={checkDelta} color="#FF6B2B" />
            </div>
          </div>

          {/* Денежный поток — ВЫШЕ диаграмм. Слева — филиал/сводка, справа — приход/расход/прибыль/склад */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: branchSummary ? 'minmax(180px, 220px) 1fr' : '1fr', gap: 18, alignItems: 'center' }}>
              {branchSummary && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  paddingRight: 18, borderRight: '1px solid var(--border, #e6e8f2)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--primary-50, rgba(91,79,232,.10))', color: 'var(--primary, #5B4FE8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>{branchSummary.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>
                      💸 Денежный поток
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{branchSummary.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{branchSummary.sub}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {/* Приход/Расход — за выбранный период (синхронно с выручкой).
                    Валовая прибыль — продажи минус себестоимость за период.
                    Склад — текущая стоимость остатков (не зависит от периода). */}
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Приход · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--green)', fontSize: 18, marginTop: 4 }}>+{fmtMoneyFull(t.cash_income)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>сум · в кассу</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Расход · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--red)', fontSize: 18, marginTop: 4 }}>−{fmtMoneyFull(t.cash_expense)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>сум · из кассы</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Валовая прибыль</div>
                  <div className="mono" style={{ fontWeight: 800, color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.gross_profit)}</div>
                  {profitDelta != null ? (
                    <div style={{ fontSize: 10, fontWeight: 800, color: profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {profitDelta >= 0 ? '▲' : '▼'} {Math.abs(profitDelta)}% к прошлому
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>сум · продажи − себестоимость</div>
                  )}
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>Склад · сейчас</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.stock_value)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>сум · стоимость остатков</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Динамика продаж — единый переключатель масштаба + две карты-близнеца.
              Один бар = день / неделя / месяц / год (как в банковских приложениях). */}
          {(() => {
            const hasPrev = chartPrevValues.some(v => v > 0);
            const peak = chartValues.length ? Math.max(...chartValues) : 0;
            const peakIdx = chartValues.indexOf(peak);
            const peakLabel = peakIdx >= 0 ? (chartLabels[peakIdx] || '') : '';
            return (
              <>
                {/* Тулбар: заголовок секции слева, переключатель масштаба справа */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)' }}>📊 Динамика продаж</div>
                  <Pills value={chartGran} onChange={setChartGran} options={CHART_GRAN_OPTIONS} label="Масштаб графика" />
                </div>

                <div className="grid-2 dashboard-charts-row" style={{ marginBottom: 16, alignItems: 'stretch' }}>
                  {/* Карта 1 — Продажи */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <ChartHead icon="📈" iconBg="rgba(37,99,235,.10)" iconColor="#2563EB"
                      label={`Продажи · ${CHART_RANGE_LABEL[chartGran]}`}>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 2, lineHeight: 1.1 }}>
                        {fmtMoneyFull(chartTotal)} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>сум</span>
                      </div>
                    </ChartHead>
                    {chartLoading && !chart ? <Skeleton height={150} /> : (
                      <BarChart data={chartValues} labels={chartLabels} color="#2563EB" height={150} />
                    )}
                    {/* Футер для выравнивания высоты с правой картой */}
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', minHeight: 18 }}>
                      {peak > 0 && <>Пик: <strong className="mono">{fmtMoneyFull(peak)} сум</strong> · {peakLabel}</>}
                    </div>
                  </div>

                  {/* Карта 2 — Сравнение с предыдущим аналогичным диапазоном */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <ChartHead icon="📊" iconBg="rgba(34,197,94,.10)" iconColor="#16a34a"
                      label={`Сравнение · ${CHART_RANGE_LABEL[chartGran]}`}>
                      <div className="mono" style={{
                        fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 2,
                        color: chartDelta == null ? 'var(--text3)' : chartDelta >= 0 ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)',
                      }}>
                        {chartDelta != null
                          ? <>{chartDelta >= 0 ? '▲' : '▼'} {Math.abs(chartDelta)}%</>
                          : <span style={{ fontSize: 13, fontWeight: 700 }}>нет базы для сравнения</span>}
                      </div>
                    </ChartHead>
                    {chartLoading && !chart ? <Skeleton height={150} /> : (
                      <BarChart data={chartValues} prevData={hasPrev ? chartPrevValues : undefined} labels={chartLabels}
                        color="#22C55E" prevColor="#C3C8D4" height={150} />
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, flexWrap: 'wrap', minHeight: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#22C55E', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>Текущий: <strong className="mono">{fmtMoneyFull(chartTotal)} сум</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#C3C8D4', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>Предыдущие: <strong className="mono">{fmtMoneyFull(chartPrevTotal)} сум</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {isOwner && branches.length > 1 && (
            <Card icon="🏭" title="Сравнение филиалов"
              actions={<Badge tone="purple">{branches.length} филиалов</Badge>}
              style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Филиал</th>
                      <th style={{ textAlign: 'right' }}>Выручка</th>
                      <th style={{ textAlign: 'right' }}>Прибыль</th>
                      <th style={{ textAlign: 'right' }}>Маржа</th>
                      <th style={{ textAlign: 'right' }}>Сделок</th>
                      <th style={{ textAlign: 'right' }}>Касса</th>
                      <th style={{ textAlign: 'right' }}>Склад</th>
                      <th style={{ textAlign: 'right' }}>Сотр.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.branch_id}>
                        <td style={{ fontWeight: 700 }}>
                          🏭 {b.branch_name}{' '}
                          {b.margin_pct < 10 && b.sales_revenue > 0 && <Badge tone="red">маржа↓</Badge>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(b.sales_revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.gross_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoneyFull(b.gross_profit)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.margin_pct}%</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(b.deals_count)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.cash_balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoneyFull(b.cash_balance)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(b.stock_value)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.worker_count}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(91,79,232,.05)', fontWeight: 800 }}>
                      <td>ИТОГО</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.sales_revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoneyFull(t.gross_profit)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.margin_pct}%</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(t.deals_count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.cash_balance)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.stock_value)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.worker_count}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Card icon="⚠️" title="Алерты" actions={alerts.length > 0 && <Badge tone="red">{alerts.length}</Badge>}>
              <div className="list">
                {alerts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>✓ Всё спокойно</div>
                ) : alerts.map((a, i) => (
                  <div key={i} className="list-item">
                    <div style={{ width: 5, height: 34, borderRadius: 3, background: ({ red: '#EF4444', yellow: '#F59E0B', blue: '#5B4FE8', purple: '#7c3aed' })[a.tone] || '#6B7280' }} />
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{a.title}</div>
                      <div className="list-item-sub">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="🏆" title="Топ товаров" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/warehouse/stock')}>Все →</button>}>
              <div className="list">
                {topProducts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>Нет данных</div>
                ) : topProducts.map((p, i) => (
                  <div key={p.id} className="list-item">
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: i < 3 ? 'rgba(255,107,43,.15)' : 'var(--bg-2)',
                      color: i < 3 ? 'var(--orange)' : 'var(--text2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 11,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="list-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div className="list-item-sub">{fmtNum(p.qty)} {p.unit}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 12 }}>{fmtMoneyFull(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="👤" title="Топ сотрудников" actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/management/team-kpi')}>KPI →</button>}>
              <div className="list">
                {topSellers.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>Нет данных</div>
                ) : topSellers.map(s => {
                  const init = (s.name || s.username || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={s.id} className="list-item">
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{init}</div>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-sub">{s.deals} {s.deals % 10 === 1 && s.deals % 100 !== 11 ? 'сделка' : (s.deals % 10 >= 2 && s.deals % 10 <= 4 && (s.deals % 100 < 12 || s.deals % 100 > 14) ? 'сделки' : 'сделок')} · {ROLE_RU[s.role] || s.role}</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 12 }}>{fmtMoneyFull(s.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// Compact tile for the right column next to the hero. Now supports breakdown by payment method.
// countMode — если задан, breakdown показывает счётчик (шт), а не суммы.
function CompactTile({ icon, label, value, sub, delta, color, breakdown, countMode = null }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '12px 14px',
      border: '1px solid rgba(230,232,242,.6)',
      borderLeft: `4px solid ${color}`,
      boxShadow: 'var(--shadow)',
      flex: 1,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>
          {icon} {label}
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginTop: 4,
        }}>
          <div className="mono" style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
          {delta != null && (
            <div style={{ fontSize: 10, fontWeight: 800, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </div>
          )}
        </div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      </div>
      {breakdown && <MethodBreakdown data={breakdown} unit={countMode ? 'count' : 'money'} />}
    </div>
  );
}
