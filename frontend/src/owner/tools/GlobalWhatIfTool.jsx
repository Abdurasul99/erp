import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Глобальный «Что если» — единый бизнес-симулятор поверх РЕАЛЬНОГО baseline компании.
// Никакого нового бэка: baseline тянем из GET /api/company/dashboard (totals),
// вся математика — на фронте, вживую в useMemo.
//
// 6 рычагов:
//   price        — изменение цены ±50%
//   traffic      — поток клиентов (кол-во чеков) ±70%
//   payroll      — ФОТ (оплата труда) ±100%
//   rent         — аренда / постоянные расходы ±100%
//   cogsRate     — себестоимость как % от выручки (сдвиг маржи)
//   elasticity   — эластичность спроса по цене (деф. 0.4): при +1% цены спрос −elasticity%
//
// Модель:
//   Δспрос от цены = −elasticity × pricePct
//   итоговый трафик-множитель = (1 + trafficPct) × (1 + Δспрос)
//   выручка     R1 = R0 × (1 + pricePct) × трафик-множитель
//   себестоим.  C1 = R1 × cogsRate   (доля от выручки фиксируется ползунком)
//   валовая     = R1 − C1
//   опер.расход = (ФОТ × payrollFactor) + (аренда × rentFactor)
//   чистая      = валовая − опер.расход
//   точка безуб = опер.расход / margin   (margin = валовая / выручка)

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Пресеты — каждый просто выставляет набор рычагов
const PRESETS = [
  { key: 'price_up', label: 'Цены +10%', hint: 'Аккуратное повышение цен', set: { price: 10, traffic: 0, payroll: 0, rent: 0 } },
  { key: 'crisis', label: 'Кризис −30% поток', hint: 'Падение клиентского потока', set: { price: 0, traffic: -30, payroll: 0, rent: 0 } },
  { key: 'second_point', label: '2-я точка', hint: 'Удвоение трафика и ФОТ/аренды', set: { price: 0, traffic: 90, payroll: 80, rent: 80 } },
  { key: 'discount', label: 'Скидка −15%', hint: 'Стимулировать спрос скидкой', set: { price: -15, traffic: 0, payroll: 0, rent: 0 } },
  { key: 'optimize', label: 'Оптимизация −20% аренда', hint: 'Срезать постоянные расходы', set: { price: 0, traffic: 0, payroll: -10, rent: -20 } },
  { key: 'base', label: 'Сброс к базе', hint: 'Вернуть все рычаги в 0', set: { price: 0, traffic: 0, payroll: 0, rent: 0 } },
];

// Ползунок одного рычага
function Lever({ icon, label, value, onChange, min, max, unit = '%', color, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{icon} {label}</span>
        <span className="mono" style={{ fontWeight: 900, fontSize: 18, color: value > 0 ? '#16A34A' : value < 0 ? '#DC2626' : 'var(--text2)', whiteSpace: 'nowrap' }}>
          {value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        aria-label={label}
        style={{ width: '100%', height: 7, appearance: 'none', background: `linear-gradient(90deg, #DC2626, #94A3B8 50%, ${color || '#16A34A'})`, borderRadius: 4, outline: 'none' }}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function GlobalWhatIfTool() {
  const { tt } = useTt();
  const { branchId, periodFrom, periodTo, periodLabel } = useContext(BranchScope);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Рычаги
  const [price, setPrice] = useState(0);        // ±50%
  const [traffic, setTraffic] = useState(0);    // ±70%
  const [payroll, setPayroll] = useState(0);    // ±100%
  const [rent, setRent] = useState(0);          // ±100%
  const [cogsRate, setCogsRate] = useState(null); // % от выручки (инициализируем из baseline)
  const [elasticity, setElasticity] = useState(0.4);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    api.get('/company/dashboard', { params })
      .then(r => { if (!ignore) setBase(r.data?.totals || {}); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, periodFrom, periodTo]);

  // baseline-разложение расходов: dashboard даёт выручку, себестоимость и общий cash_expense.
  // Операционные (постоянные) расходы ≈ cash_expense − себестоимость. Их делим на
  // ФОТ и аренду эвристикой 60/40 — пользователь может крутить рычаги независимо.
  const baseModel = useMemo(() => {
    if (!base) return null;
    const R0 = num(base.sales_revenue);
    const C0 = num(base.sales_cost);
    const cashOut = num(base.cash_expense);
    const opex0 = Math.max(0, cashOut - C0); // постоянные/операционные сверх себестоимости
    const payroll0 = Math.round(opex0 * 0.6);
    const rent0 = opex0 - payroll0;
    const baseCogsRate = R0 > 0 ? clamp((C0 / R0) * 100, 0, 95) : 50;
    const grossProfit0 = R0 - C0;
    const netProfit0 = grossProfit0 - opex0;
    return { R0, C0, cashOut, opex0, payroll0, rent0, baseCogsRate, grossProfit0, netProfit0 };
  }, [base]);

  // Инициализация ползунка себестоимости из baseline (один раз, когда пришли данные)
  useEffect(() => {
    if (baseModel && cogsRate == null) setCogsRate(Math.round(baseModel.baseCogsRate));
  }, [baseModel, cogsRate]);

  const sim = useMemo(() => {
    if (!baseModel) return null;
    const { R0, payroll0, rent0, baseCogsRate } = baseModel;
    const cr = (cogsRate == null ? baseCogsRate : cogsRate) / 100;
    const p = price / 100;
    const demandDelta = -elasticity * p;                       // реакция спроса на цену
    const trafficFactor = (1 + traffic / 100) * (1 + demandDelta);

    const R1 = R0 * (1 + p) * trafficFactor;
    const C1 = R1 * cr;
    const gross1 = R1 - C1;
    const payroll1 = payroll0 * (1 + payroll / 100);
    const rent1 = rent0 * (1 + rent / 100);
    const opex1 = payroll1 + rent1;
    const net1 = gross1 - opex1;
    const marginRatio = R1 > 0 ? gross1 / R1 : 0;
    const breakEven1 = marginRatio > 0 ? opex1 / marginRatio : 0;

    // База (для сравнения) — реальная точка безуб. при текущей марже
    const grossR0 = baseModel.grossProfit0;
    const opex0 = baseModel.opex0;
    const marginRatio0 = R0 > 0 ? grossR0 / R0 : 0;
    const breakEven0 = marginRatio0 > 0 ? opex0 / marginRatio0 : 0;
    const net0 = baseModel.netProfit0;

    const pct = (a, b) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : (a > 0 ? 100 : 0));

    // Водопад прибыли: вклад каждого рычага относительно базовой чистой прибыли.
    // Считаем дельты пошагово (каждый шаг включает предыдущий) для аддитивного разложения.
    const wf = [];
    let cur = net0;
    // шаг 1: цена + эластичность
    {
      const tf = (1 + 0) * (1 + (-elasticity * p));
      const R = R0 * (1 + p) * tf;
      const g = R - R * cr;
      const n = g - (payroll0 + rent0);
      // нормализуем себестоимость и в базе тоже (cr применяется), берём чистый эффект цены
      const baseN = (R0 - R0 * cr) - (payroll0 + rent0);
      wf.push({ key: 'price', label: 'Цена', value: n - baseN }); cur = n;
    }
    // шаг 2: + трафик
    {
      const tf = (1 + traffic / 100) * (1 + (-elasticity * p));
      const R = R0 * (1 + p) * tf;
      const g = R - R * cr;
      const n = g - (payroll0 + rent0);
      wf.push({ key: 'traffic', label: 'Поток клиентов', value: n - cur }); cur = n;
    }
    // шаг 3: + ФОТ
    {
      const n = gross1 - (payroll1 + rent0);
      wf.push({ key: 'payroll', label: 'ФОТ', value: n - cur }); cur = n;
    }
    // шаг 4: + аренда
    {
      wf.push({ key: 'rent', label: 'Аренда', value: net1 - cur }); cur = net1;
    }

    return {
      R0, R1, gross1, opex1, net0, net1, breakEven0, breakEven1,
      revPct: pct(R1, R0), netPct: pct(net1, net0), bePct: pct(breakEven1, breakEven0),
      marginPct: marginRatio * 100, marginPct0: marginRatio0 * 100,
      wf,
    };
  }, [baseModel, price, traffic, payroll, rent, cogsRate, elasticity]);

  const applyPreset = (set) => {
    setPrice(set.price); setTraffic(set.traffic); setPayroll(set.payroll); setRent(set.rent);
  };

  const hasData = baseModel && baseModel.R0 > 0;
  const isDirty = price !== 0 || traffic !== 0 || payroll !== 0 || rent !== 0 ||
    (cogsRate != null && baseModel && Math.round(baseModel.baseCogsRate) !== cogsRate);

  return (
    <>
      <PageHeader
        title={tt('🌐 Глобальный «Что если»')}
        sub={tt('Симулятор бизнеса: цена · поток · ФОТ · аренда · маржа — на ваших реальных данных')}
      />

      {loading && !base ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState icon="📊" title={tt('Недостаточно данных для симуляции')}
            description={tt('За выбранный период нет выручки — симулятору не на чём строить baseline. Появятся продажи — прогноз заработает.')} />
        </Card>
      ) : (
        <>
          {/* Пресеты */}
          <Card icon="⚡" title={tt('Готовые сценарии')} style={{ marginBottom: 16 }}>
            <div className="grid-3">
              {PRESETS.map(ps => (
                <button key={ps.key} onClick={() => applyPreset(ps.set)}
                  style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border, #E3EAF3)', background: 'var(--bg-2)' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{tt(ps.label)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{tt(ps.hint)}</div>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Рычаги */}
            <Card icon="🎚️" title={tt('Рычаги')}>
              <div style={{ padding: '8px 4px' }}>
                <Lever icon="💲" label={tt('Цена')} value={price} onChange={setPrice} min={-50} max={50} color="#16A34A"
                  hint={tt('Изменение цен по всему ассортименту')} />
                <Lever icon="🚶" label={tt('Поток клиентов')} value={traffic} onChange={setTraffic} min={-70} max={70} color="#0EA5E9"
                  hint={tt('Кол-во чеков / посещений')} />
                <Lever icon="👷" label={tt('ФОТ (оплата труда)')} value={payroll} onChange={setPayroll} min={-100} max={100} color="#6366F1"
                  hint={tt('Фонд оплаты труда сотрудников')} />
                <Lever icon="🏠" label={tt('Аренда / постоянные')} value={rent} onChange={setRent} min={-100} max={100} color="#D97706"
                  hint={tt('Аренда и прочие постоянные расходы')} />
                <Lever icon="📦" label={tt('Себестоимость')} value={cogsRate == null ? 0 : cogsRate}
                  onChange={setCogsRate} min={0} max={95} color="#DC2626"
                  hint={tt('Доля себестоимости в выручке (сдвигает маржу)')} />

                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>📐 {tt('Эластичность спроса')}</span>
                    <span className="mono" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text2)' }}>{elasticity.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="20" value={Math.round(elasticity * 10)}
                    onChange={e => setElasticity(parseInt(e.target.value, 10) / 10)}
                    aria-label={tt('Эластичность спроса по цене')}
                    style={{ width: '100%', height: 7, appearance: 'none', background: 'linear-gradient(90deg, #94A3B8, #1D4ED8)', borderRadius: 4, outline: 'none' }} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    {tt('При +1% цены спрос меняется на')} −{(elasticity).toFixed(1)}%{' '}
                    ({elasticity < 0.4 ? tt('низкая') : elasticity > 0.8 ? tt('высокая') : tt('средняя')})
                  </div>
                </div>
              </div>
            </Card>

            {/* Результат: база vs симуляция */}
            <div>
              <div className="grid-3" style={{ marginBottom: 12 }}>
                <Tile icon="💰" label={tt('Выручка / период')} value={fmtMoneyFull(sim.R1)}
                  sub={`${tt('было')} ${fmtMoneyFull(sim.R0)}`}
                  delta={Math.round(sim.revPct)} color="#1D4ED8" />
                <Tile icon="🏦" label={tt('Чистая прибыль')} value={fmtMoneyFull(sim.net1)}
                  sub={`${tt('было')} ${fmtMoneyFull(sim.net0)}`}
                  delta={Math.round(sim.netPct)} color={sim.net1 >= 0 ? '#16A34A' : '#DC2626'} />
                <Tile icon="⚖️" label={tt('Точка безубыточности')} value={fmtMoneyFull(sim.breakEven1)}
                  sub={`${tt('было')} ${fmtMoneyFull(sim.breakEven0)}`}
                  delta={Math.round(-sim.bePct)} color="#D97706" />
              </div>

              {/* Водопад прибыли */}
              <Card icon="🌊" title={tt('Водопад прибыли — вклад рычагов')}>
                <ProfitWaterfall base={sim.net0} steps={sim.wf} final={sim.net1} tt={tt} />
              </Card>
            </div>
          </div>

          {/* Интерпретация */}
          <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong>💡 {tt('Итог:')}</strong>{' '}
            {tt('Чистая прибыль перейдёт с')} <strong className="mono">{fmtMoneyFull(sim.net0)}</strong> {tt('до')}{' '}
            <strong className="mono" style={{ color: sim.net1 >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoneyFull(sim.net1)} {tt('сум')}</strong>{' '}
            ({sim.netPct >= 0 ? '+' : ''}{sim.netPct.toFixed(1)}%).{' '}
            {tt('Маржа')}: <strong>{sim.marginPct.toFixed(1)}%</strong> ({tt('было')} {sim.marginPct0.toFixed(1)}%).{' '}
            {sim.net1 < 0 && <strong style={{ color: 'var(--red)' }}>{tt('Внимание: при таком сценарии бизнес уходит в минус.')}</strong>}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('Baseline взят из дашборда за период')} «{periodLabel || tt('текущий')}»
            {branchId ? ' (' + tt('выбранный филиал') + ')' : ' (' + tt('все филиалы') + ')'}.{' '}
            {tt('ФОТ и аренда оценены из общих расходов (60/40) — крутите рычаги независимо. Всё считается на лету, ничего не сохраняется.')}
            {isDirty ? '' : ' ' + tt('(сейчас показан baseline — двигайте рычаги или выберите сценарий)')}
          </div>
        </>
      )}
    </>
  );
}

// Водопад прибыли: база → вклад каждого рычага → итог. Горизонтальные бары.
function ProfitWaterfall({ base, steps, final, tt }) {
  // Масштаб по максимальному абсолютному значению среди базы, итога и накопленных уровней
  let cum = base;
  const levels = [base];
  steps.forEach(s => { cum += s.value; levels.push(cum); });
  const span = Math.max(Math.abs(base), Math.abs(final), ...levels.map(Math.abs), 1);

  const Row = ({ label, value, isTotal, level }) => {
    const pos = value >= 0;
    const widthPct = clamp((Math.abs(value) / span) * 100, value === 0 ? 0 : 2, 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 120, fontSize: 12, fontWeight: isTotal ? 800 : 600, color: isTotal ? 'var(--text)' : 'var(--text2)', textAlign: 'right', flexShrink: 0 }}>
          {label}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 18, background: 'var(--bg-2)', borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: pos ? '50%' : `${50 - widthPct / 2}%`,
            width: `${widthPct / 2}%`,
            background: isTotal ? (value >= 0 ? '#1D4ED8' : '#DC2626') : (pos ? '#16A34A' : '#DC2626'),
            borderRadius: 4,
          }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border, #E3EAF3)' }} />
        </div>
        <div className="mono" style={{ width: 130, fontSize: 12, fontWeight: isTotal ? 800 : 700, textAlign: 'right', flexShrink: 0, color: isTotal ? 'var(--text)' : (value >= 0 ? '#16A34A' : '#DC2626') }}>
          {value >= 0 && !isTotal ? '+' : ''}{fmtMoneyFull(value)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '6px 2px' }}>
      <Row label={tt('База (факт)')} value={base} isTotal />
      {steps.map(s => (
        <Row key={s.key} label={tt(s.label)} value={s.value} />
      ))}
      <div style={{ borderTop: '1px dashed var(--border, #E3EAF3)', margin: '6px 0' }} />
      <Row label={tt('Итог (симуляция)')} value={final} isTotal />
    </div>
  );
}
