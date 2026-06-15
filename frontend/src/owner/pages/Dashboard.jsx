import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { BranchScope } from '../OwnerShell.jsx';
import { Tile, Card, Badge, AreaChart, BarChart, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum, fmtMoneyFull, fmtSum, todayLabel } from '../ui.jsx';
import { useTt, fmtDate } from '../tt.js';

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
  { key: 'transfer', label: 'На счёт',     icon: '🏦', curr: 'UZS' },
];

// Компактная разбивка по способам оплаты — 4 строки внизу плитки
// unit: 'money' (по умолчанию, показывает «4 150 000 UZS») | 'count' (показывает «12 шт»)
function MethodBreakdown({ data, lightOnDark = false, unit = 'money', usdOrig = 0 }) {
  const { tt } = useTt();
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
            <span style={{ color: labelColor, fontWeight: 700 }}>{m.icon} {tt(m.label)}</span>
            <span style={{ color: valueColor, fontWeight: 700 }}>
              {isCount ? fmtNum(v) : fmtMoneyFull(v)} <span style={{ opacity: .6, fontSize: 9 }}>{isCount ? tt('шт') : m.curr}</span>
              {!isCount && m.key === 'cash_usd' && usdOrig > 0 && (
                <span style={{ opacity: .85, fontSize: 9.5, marginLeft: 4 }}>{`(${fmtNum(usdOrig)} $)`}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Хиро-чарт: крипто-стайл лайн — плавная линия + градиентная заливка,
// светящаяся точка «сейчас», вертикальная направляющая и тултип при наведении.
function HeroLineChart({ daily, dates, lang }) {
  const { tt } = useTt();
  const [hover, setHover] = useState(null);
  if (!daily || daily.length < 2 || !dates) return null;
  const n = daily.length;
  const W = 1000, H = 120, TOP = 8;
  const max = Math.max(...daily, 1);
  const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (v) => TOP + (1 - (v || 0) / max) * (H - TOP);
  const pts = daily.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

  // Catmull-Rom → cubic Bezier: плавно, но без «кардиограммы».
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const last = pts[n - 1];
  const lastLeft = (last.x / W) * 100, lastTop = (last.y / H) * 100;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };
  const hx = hover != null ? (xAt(hover) / W) * 100 : 0;
  const hyTop = hover != null ? (yAt(daily[hover]) / H) * 100 : 0;
  const labelIdx = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 130, paddingTop: 18 }}>
      <div style={{ position: 'relative', height: H, cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.40" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#heroFill)" />
          <path d={line} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.18))' }} />
          {hover != null && (
            <line x1={xAt(hover)} y1={TOP} x2={xAt(hover)} y2={H} stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* Светящаяся точка «сейчас» */}
        <span style={{ position: 'absolute', left: `${lastLeft}%`, top: `${lastTop}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,.32), 0 0 10px rgba(255,255,255,.85)', pointerEvents: 'none' }} />

        {/* Точка + тултип при наведении */}
        {hover != null && (
          <>
            <span style={{ position: 'absolute', left: `${hx}%`, top: `${hyTop}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: '#15803d', border: '2px solid #fff', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${hx}%`, top: -4, transform: `translateX(${hx > 70 ? '-100%' : hx < 30 ? '0' : '-50%'})`, background: 'rgba(255,255,255,.97)', color: '#15803d', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.18)', pointerEvents: 'none' }}>
              {fmtMoneyFull(daily[hover])} {tt('сум')}
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>{fmtDate(dates[hover], { day: 'numeric', month: 'short' }, lang)}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, fontWeight: 700, opacity: .8, fontFamily: "'JetBrains Mono', monospace" }}>
        {labelIdx.map((idx, k) => (
          <span key={k}>{dates[idx] ? fmtDate(dates[idx], { day: 'numeric', month: 'short' }, lang) : ''}</span>
        ))}
      </div>
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { tt, lang } = useTt();
  const { branchId, isOwner, role, branches: allBranches, periodFrom, periodTo, periodLabel } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Два графика — каждый со СВОЕЙ гранулярностью (независимо друг от друга и от плиток)
  const [salesGran, setSalesGran] = useState('day');
  const [salesChart, setSalesChart] = useState(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [compareGran, setCompareGran] = useState('day');
  const [compareChart, setCompareChart] = useState(null);
  const [compareLoading, setCompareLoading] = useState(true);

  useEffect(() => {
    // ignore-флаг: при быстром переключении периода старый ответ не должен
    // перезаписать свежий (защита от out-of-order ответов).
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [periodFrom, periodTo, branchId]);

  useEffect(() => {
    let ignore = false;
    setSalesLoading(true);
    const params = { granularity: salesGran };
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setSalesChart(r.data); })
      .catch(() => { if (!ignore) setSalesChart(null); })
      .finally(() => { if (!ignore) setSalesLoading(false); });
    return () => { ignore = true; };
  }, [salesGran, periodFrom, periodTo, branchId]);

  useEffect(() => {
    let ignore = false;
    setCompareLoading(true);
    const params = { granularity: compareGran };
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setCompareChart(r.data); })
      .catch(() => { if (!ignore) setCompareChart(null); })
      .finally(() => { if (!ignore) setCompareLoading(false); });
    return () => { ignore = true; };
  }, [compareGran, periodFrom, periodTo, branchId]);

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

  // Данные бар-чартов с бэкенда: бакеты агрегированы по своей гранулярности у каждого графика
  const salesValues = useMemo(() => (salesChart?.buckets || []).map(b => b.revenue), [salesChart]);
  const salesLabels = useMemo(() => (salesChart?.buckets || []).map(b => b.label), [salesChart]);
  const salesTotal = salesChart?.total || 0;

  const compareValues = useMemo(() => (compareChart?.buckets || []).map(b => b.revenue), [compareChart]);
  const comparePrevValues = useMemo(() => (compareChart?.prev_buckets || []).map(b => b.revenue), [compareChart]);
  const compareLabels = useMemo(() => (compareChart?.buckets || []).map(b => b.label), [compareChart]);
  const compareTotal = compareChart?.total || 0;
  const comparePrevTotal = compareChart?.prev_total || 0;
  const compareDelta = deltaPct(compareTotal, comparePrevTotal);

  const revDelta = deltaPct(t.sales_revenue, prev.sales_revenue);
  const profitDelta = deltaPct(t.gross_profit, prev.gross_profit);
  const dealsDelta = deltaPct(t.deals_count, prev.deals_count);
  const checkDelta = deltaPct(t.avg_check, prev.avg_check);

  const scopeLabel = isOwner
    ? (branchId ? (allBranches.find(x => x.id === branchId)?.name || `${tt('Филиал')} #${branchId}`) : tt('Все филиалы'))
    : (role === 'manager' ? tt('Мой филиал') : '');

  // Single-branch summary — для cashflow-карточки (показывается всегда: для manager — его филиал, для founder/gen_dir — суммарно по всем)
  const branchSummary = (() => {
    if (!isOwner && branches.length === 1) {
      return {
        title: branches[0].branch_name,
        sub: `${branches[0].worker_count} ${tt('сотр · маржа ')}${branches[0].margin_pct}%`,
        icon: '🏭',
      };
    }
    if (isOwner && branches.length > 0) {
      const totalWorkers = branches.reduce((a, b) => a + (b.worker_count || 0), 0);
      const avgMargin = t.margin_pct || 0;
      return {
        title: branchId
          ? (allBranches.find(x => x.id === branchId)?.name || `${tt('Филиал')} #${branchId}`)
          : tt('Все филиалы'),
        sub: `${totalWorkers} ${tt('сотр · маржа ')}${avgMargin}%`,
        icon: '🏢',
      };
    }
    return null;
  })();

  return (
    <>
      <PageHeader
        title={tt('Главная панель')}
        sub={`${scopeLabel} · ${todayLabel(lang)}`}
      />

      {error && (
        <Card icon="⚠️" title={tt('Ошибка загрузки')}>
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
          {/* Hero — БАННЕР на всю ширину с фиксированной высотой (не растягивается
              под соседние колонки → нет пустоты). Слева цифры, справа плавная
              area-кривая с точкой пика. Плитки — отдельным рядом ниже. */}
          <div style={{
            background: 'linear-gradient(135deg, #16a34a 0%, #22C55E 60%, #4ade80 100%)',
            borderRadius: 18,
            padding: '22px 26px',
            color: '#fff',
            boxShadow: '0 8px 28px rgba(34,197,94,.32)',
            display: 'flex', gap: 28, flexWrap: 'wrap',
            marginBottom: 14,
          }}>
            {/* Левая колонка — дата, выручка, breakdown */}
            <div style={{ flex: '0 1 300px', minWidth: 250, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, opacity: .85, textTransform: 'uppercase', letterSpacing: .8 }}>
                📅 {todayLabel(lang)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, marginTop: 4 }}>
                💰 {tt('ВЫРУЧКА')} · {periodLabel}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 900, lineHeight: 1.05, marginTop: 4, letterSpacing: -0.5 }}>
                {fmtMoneyFull(t.sales_revenue)} <span style={{ fontSize: 14, opacity: .7 }}>{tt('сум')}</span>
              </div>
              {revDelta != null ? (
                <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                  {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta)}% {tt('к прошлому периоду')}
                </div>
              ) : (
                data?.prev_totals != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>
                    {tt('Прошлый период пуст — сравнение появится позже')}
                  </div>
                )
              )}
              <div style={{ marginTop: 8 }}>
                <MethodBreakdown data={byMethod.revenue} lightOnDark usdOrig={byMethod.revenue_usd_orig} />
              </div>
            </div>

            {/* Правая колонка — недельные столбцы, фикс. высота */}
            {trendValues.length > 1 && trendValues.some(v => v > 0) && (
              <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', minHeight: 170 }}>
                <HeroLineChart
                  daily={trendValues}
                  dates={trend.map(x => x.date)}
                  lang={lang}
                />
              </div>
            )}
          </div>

          {/* Три плитки — отдельный ряд под хиро (равная высота между собой) */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <CompactTile icon="🏦" label={tt('Касса (баланс)')} value={fmtMoneyFull(t.cash_balance)} sub={tt('сум') + ' · ' + tt('остаток на сейчас')}
              breakdown={byMethod.cash_in} usdOrig={byMethod.cash_in_usd_orig} color="#0EA5E9" />
            <CompactTile icon="📦" label={tt('Продаж')} value={fmtNum(t.deals_count)} sub={tt('за период')}
              breakdown={byMethod.deals} delta={dealsDelta} color="#5B4FE8" countMode="шт" />
            <CompactTile icon="🧾" label={tt('Средний чек')} value={fmtMoneyFull(t.avg_check)} sub={tt('сум')}
              breakdown={byMethod.avg_check} delta={checkDelta} color="#FF6B2B" />
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
                      💸 {tt('Денежный поток')}
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
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Приход')} · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--green)', fontSize: 18, marginTop: 4 }}>+{fmtMoneyFull(t.cash_income)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · в кассу')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Расход')} · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--red)', fontSize: 18, marginTop: 4 }}>−{fmtMoneyFull(t.cash_expense)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · из кассы')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Валовая прибыль')}</div>
                  <div className="mono" style={{ fontWeight: 800, color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.gross_profit)}</div>
                  {profitDelta != null ? (
                    <div style={{ fontSize: 10, fontWeight: 800, color: profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {profitDelta >= 0 ? '▲' : '▼'} {Math.abs(profitDelta)}% {tt('к прошлому периоду')}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · продажи − себестоимость')}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Склад')} · {tt('сейчас')}</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.stock_value)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · стоимость остатков')}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Динамика продаж — единый переключатель масштаба + две карты-близнеца.
              Один бар = день / неделя / месяц / год (как в банковских приложениях). */}
          {(() => {
            const hasPrev = comparePrevValues.some(v => v > 0);
            const peak = salesValues.length ? Math.max(...salesValues) : 0;
            const peakIdx = salesValues.indexOf(peak);
            const peakLabel = peakIdx >= 0 ? (salesLabels[peakIdx] || '') : '';
            const granOpts = CHART_GRAN_OPTIONS.map(o => ({ ...o, label: tt(o.label) }));
            return (
              <>
                {/* Заголовок секции — у каждой карты свой переключатель масштаба */}
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 12 }}>📊 {tt('Динамика продаж')}</div>

                <div className="grid-2 dashboard-charts-row" style={{ marginBottom: 16, alignItems: 'stretch' }}>
                  {/* Карта 1 — Продажи (свой переключатель) */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <ChartHead icon="📈" iconBg="rgba(37,99,235,.10)" iconColor="#2563EB"
                        label={tt('Продажи') + ' · ' + periodLabel}>
                        <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 2, lineHeight: 1.1 }}>
                          {fmtMoneyFull(salesTotal)} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('сум')}</span>
                        </div>
                      </ChartHead>
                      <Pills value={salesGran} onChange={setSalesGran} options={granOpts} label={tt('Продажи')} />
                    </div>
                    {salesLoading && !salesChart ? <Skeleton height={150} /> : (
                      <BarChart data={salesValues} labels={salesLabels} color="#2563EB" height={150} />
                    )}
                    {/* Футер для выравнивания высоты с правой картой */}
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', minHeight: 18 }}>
                      {peak > 0 && <>{tt('Пик')}: <strong className="mono">{fmtMoneyFull(peak)} {tt('сум')}</strong> · {peakLabel}</>}
                    </div>
                  </div>

                  {/* Карта 2 — Сравнение (свой переключатель) */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <ChartHead icon="📊" iconBg="rgba(34,197,94,.10)" iconColor="#16a34a"
                        label={tt('Сравнение') + ' · ' + periodLabel}>
                        <div className="mono" style={{
                          fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 2,
                          color: compareDelta == null ? 'var(--text3)' : compareDelta >= 0 ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)',
                        }}>
                          {compareDelta != null
                            ? <>{compareDelta >= 0 ? '▲' : '▼'} {Math.abs(compareDelta)}%</>
                            : <span style={{ fontSize: 13, fontWeight: 700 }}>{tt('нет базы для сравнения')}</span>}
                        </div>
                      </ChartHead>
                      <Pills value={compareGran} onChange={setCompareGran} options={granOpts} label={tt('Сравнение')} />
                    </div>
                    {compareLoading && !compareChart ? <Skeleton height={150} /> : (
                      <BarChart data={compareValues} prevData={hasPrev ? comparePrevValues : undefined} labels={compareLabels}
                        color="#22C55E" prevColor="#C3C8D4" height={150} />
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, flexWrap: 'wrap', minHeight: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#22C55E', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>{tt('Текущий')}: <strong className="mono">{fmtMoneyFull(compareTotal)} {tt('сум')}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#C3C8D4', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>{tt('Предыдущие')}: <strong className="mono">{fmtMoneyFull(comparePrevTotal)} {tt('сум')}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {isOwner && branches.length > 1 && (
            <Card icon="🏭" title={tt('Сравнение филиалов')}
              actions={<Badge tone="purple">{branches.length} {tt('филиалов')}</Badge>}
              style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Филиал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прибыль')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Маржа')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сделок')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Касса')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Склад')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сотр.')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.branch_id}>
                        <td style={{ fontWeight: 700 }}>
                          🏭 {b.branch_name}{' '}
                          {b.margin_pct < 10 && b.sales_revenue > 0 && <Badge tone="red">{tt('маржа↓')}</Badge>}
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
                      <td>{tt('ИТОГО')}</td>
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
            <Card icon="⚠️" title={tt('Алерты')} actions={alerts.length > 0 && <Badge tone="red">{alerts.length}</Badge>}>
              <div className="list">
                {alerts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>✓ {tt('Всё спокойно')}</div>
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

            <Card icon="🏆" title={tt('Топ товаров')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/warehouse/stock')}>{tt('Все →')}</button>}>
              <div className="list">
                {topProducts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных')}</div>
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

            <Card icon="👤" title={tt('Топ сотрудников')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/management/team-kpi')}>KPI →</button>}>
              <div className="list">
                {topSellers.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных')}</div>
                ) : topSellers.map(s => {
                  const init = (s.name || s.username || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={s.id} className="list-item">
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{init}</div>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-sub">{s.deals} {s.deals % 10 === 1 && s.deals % 100 !== 11 ? tt('сделка') : (s.deals % 10 >= 2 && s.deals % 10 <= 4 && (s.deals % 100 < 12 || s.deals % 100 > 14) ? tt('сделки') : tt('сделок'))} · {tt(ROLE_RU[s.role] || s.role)}</div>
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
function CompactTile({ icon, label, value, sub, delta, color, breakdown, countMode = null, usdOrig = 0 }) {
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
      {breakdown && <MethodBreakdown data={breakdown} unit={countMode ? 'count' : 'money'} usdOrig={usdOrig} />}
    </div>
  );
}
