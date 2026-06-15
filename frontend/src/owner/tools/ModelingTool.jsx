import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, PageHeader, Skeleton, EmptyState, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Что-если симулятор цены. Это КЛИЕНТСКАЯ математика поверх РЕАЛЬНОГО baseline
// компании (выручка, себестоимость, кол-во сделок за период). Backend не нужен —
// берём текущие показатели из /company/dashboard и пересчитываем сценарий вживую.
//
// Модель ценовой эластичности:
//   при изменении цены на p% спрос меняется на (−sensitivity × p)%
//   выручка R₁ = R₀ · (1+p) · (1 + Δспрос)
//   себестоимость C₁ = C₀ · (1 + Δспрос)   (цена закупки на единицу не меняется)
//   прибыль = R₁ − C₁
const SENS_OPTIONS = [
  { value: 0.3, label: 'Низкая (уникальный товар)' },
  { value: 0.6, label: 'Средняя (обычная розница)' },
  { value: 1.0, label: 'Высокая (ширпотреб)' },
];
// Готовые ценовые сценарии — каждый просто выставляет слайдер
const PRICE_PRESETS = [
  { label: 'Скидка −25%', pct: -25, hint: 'Распродажа / акция' },
  { label: 'Скидка −10%', pct: -10, hint: 'Лёгкое стимулирование спроса' },
  { label: 'Базовые цены', pct: 0, hint: 'Текущее состояние' },
  { label: 'Поднять +5%', pct: 5, hint: 'Аккуратное повышение' },
  { label: 'Поднять +15%', pct: 15, hint: 'Заметное повышение маржи' },
  { label: 'Поднять +25%', pct: 25, hint: 'Агрессивное повышение' },
];

function periodMonthFrom() {
  const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString();
}

export default function ModelingTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [pct, setPct] = useState(12);
  const [sens, setSens] = useState(0.6);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { from: periodMonthFrom() };
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then(r => { if (!ignore) setBase(r.data?.totals || {}); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  // Расчёт сценария на реальных данных
  const calc = useMemo(() => {
    if (!base) return null;
    const R0 = parseFloat(base.sales_revenue) || 0;     // выручка за месяц
    const C0 = parseFloat(base.sales_cost) || 0;        // себестоимость проданного
    const U0 = parseInt(base.deals_count) || 0;         // кол-во продаж
    const profit0 = R0 - C0;
    const p = pct / 100;
    const demandDelta = -sens * p;                      // изменение спроса
    const unitFactor = 1 + demandDelta;
    const R1 = R0 * (1 + p) * unitFactor;
    const C1 = C0 * unitFactor;
    const profit1 = R1 - C1;
    const U1 = U0 * unitFactor;
    const margin0 = R0 > 0 ? (profit0 / R0) * 100 : 0;
    const margin1 = R1 > 0 ? (profit1 / R1) * 100 : 0;
    const unitsLost = Math.max(0, Math.round(U0 - U1));
    const unitsGained = Math.max(0, Math.round(U1 - U0));
    const profitDelta = profit1 - profit0;
    const profitDeltaPct = profit0 !== 0 ? (profitDelta / Math.abs(profit0)) * 100 : 0;
    // Рекомендация: смотрим на дельту прибыли + риск оттока
    let verdict, verdictLabel, verdictColor;
    if (profitDelta > 0 && unitsLost <= U0 * 0.1) { verdict = '✅'; verdictLabel = tt('Безопасно'); verdictColor = '#22C55E'; }
    else if (profitDelta > 0) { verdict = '⚠️'; verdictLabel = tt('Прибыльно, но риск оттока'); verdictColor = '#F59E0B'; }
    else { verdict = '❌'; verdictLabel = tt('Невыгодно'); verdictColor = '#EF4444'; }
    return { R0, C0, U0, profit0, R1, profit1, U1, margin0, margin1, unitsLost, unitsGained, profitDelta, profitDeltaPct, verdict, verdictLabel, verdictColor };
  }, [base, pct, sens, tt]);

  const hasData = calc && calc.R0 > 0;

  return (
    <>
      <PageHeader title={tt('🎰 Что-если симулятор')} sub={tt('Цена · скидка · маржа — прогноз на ваших реальных данных')} />

      {loading && !base ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState icon="📊" title={tt('Недостаточно данных для прогноза')}
            description={tt('За последний месяц не было продаж — симулятору не на чём строить baseline. Появятся продажи — прогноз заработает.')} />
        </Card>
      ) : (
        <>
          {/* Baseline — реальные текущие цифры */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка / мес (факт)')} value={fmtMoneyFull(calc.R0)} sub={tt('сум')} color="#5B4FE8" />
            <Tile icon="📦" label={tt('Продаж / мес')} value={fmtNum(calc.U0)} sub={tt('сделок')} color="#0EA5E9" />
            <Tile icon="💎" label={tt('Текущая маржа')} value={calc.margin0.toFixed(1) + '%'} color="#22C55E" />
            <Tile icon="🏦" label={tt('Прибыль / мес (факт)')} value={fmtMoneyFull(calc.profit0)} sub={tt('сум')} color="#FF6B2B" />
          </div>

          <Card icon="🎯" title={tt('Сценарий: изменить цены на X%')}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontWeight: 700 }}>{tt('Изменение цен по всему ассортименту:')}</span>
                <span className="mono" style={{ fontWeight: 900, fontSize: 28, color: pct > 0 ? '#22C55E' : pct < 0 ? '#EF4444' : '#5B4FE8' }}>
                  {pct > 0 ? '+' : ''}{pct}%
                </span>
              </div>
              <input type="range" min="-30" max="50" value={pct} onChange={e => setPct(parseInt(e.target.value))}
                aria-label={tt('Изменение цен в процентах')}
                style={{ width: '100%', height: 8, appearance: 'none', background: 'linear-gradient(90deg, #EF4444, #5B4FE8, #22C55E)', borderRadius: 4, outline: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                <span>−30%</span><span>0</span><span>+50%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{tt('Чувствительность к цене:')}</span>
                <Pills value={sens} onChange={setSens} options={SENS_OPTIONS.map(o => ({ ...o, label: tt(o.label) }))} label={tt('Чувствительность к цене')} />
              </div>
            </div>

            <div className="grid-4" style={{ marginTop: 8 }}>
              <Tile icon="💰" label={tt('Прогноз выручки')} value={fmtMoneyFull(calc.R1)}
                sub={`${tt('было')} ${fmtMoneyFull(calc.R0)}`} color="#5B4FE8" />
              <Tile icon={calc.unitsLost > 0 ? '📉' : '📈'} label={calc.unitsLost > 0 ? tt('Потеря продаж') : tt('Прирост продаж')}
                value={fmtNum(calc.unitsLost > 0 ? calc.unitsLost : calc.unitsGained)}
                sub={calc.unitsLost > 0 ? tt('клиенты уйдут') : tt('новые продажи')} color={calc.unitsLost > 0 ? '#EF4444' : '#22C55E'} />
              <Tile icon="💎" label={tt('Маржа')} value={calc.margin1.toFixed(1) + '%'}
                sub={`${calc.margin1 >= calc.margin0 ? '▲' : '▼'} ${Math.abs(calc.margin1 - calc.margin0).toFixed(1)} ${tt('п.п.')}`} color="#22C55E" />
              <Tile icon="🎯" label={tt('Рекомендация')} value={calc.verdict} sub={calc.verdictLabel} color={calc.verdictColor} />
            </div>

            <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong>💡 {tt('Интерпретация:')}</strong> {tt('При изменении цен на')} <strong>{pct > 0 ? '+' : ''}{pct}%</strong>{' '}
              {tt('выручка перейдёт с')} <strong className="mono">{fmtMoneyFull(calc.R0)}</strong> {tt('до')}{' '}
              <strong className="mono" style={{ color: 'var(--primary)' }}>{fmtMoneyFull(calc.R1)} {tt('сум')}</strong>.{' '}
              {calc.unitsLost > 0
                ? <>~<strong>{fmtNum(calc.unitsLost)}</strong> {tt('продаж могут уйти из-за чувствительности к цене.')} </>
                : pct < 0 ? <>{tt('Снижение цены может добавить ~')}<strong>{fmtNum(calc.unitsGained)}</strong> {tt('продаж.')} </> : ''}
              {tt('Прибыль')} {calc.profitDelta >= 0 ? tt('вырастет') : tt('упадёт')} {tt('на')}{' '}
              <strong style={{ color: calc.profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {calc.profitDelta >= 0 ? '+' : ''}{calc.profitDeltaPct.toFixed(1)}%
              </strong>{' '}
              (≈ <strong className="mono">{calc.profitDelta >= 0 ? '+' : ''}{fmtMoneyFull(calc.profitDelta)} {tt('сум')}</strong> {tt('в месяц')}).
            </div>
          </Card>

          {/* Реальные ценовые сценарии-кнопки — двигают слайдер */}
          <div className="section-title">{tt('Быстрые сценарии')}</div>
          <div className="grid-3">
            {PRICE_PRESETS.map(s => (
              <Card key={s.label} style={{ padding: 14, cursor: 'pointer', borderLeft: pct === s.pct ? '3px solid var(--primary)' : '3px solid transparent' }}>
                <button onClick={() => setPct(s.pct)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{tt(s.label)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{tt(s.hint)}</div>
                  <div className="btn btn-ghost btn-sm" style={{ marginTop: 8, display: 'inline-block' }}>{tt('🎰 Применить →')}</div>
                </button>
              </Card>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('Расчёт строится на ваших реальных продажах за последний месяц')}
            {branchId ? ' (' + tt('выбранный филиал') + ')' : ' (' + tt('все филиалы') + ')'}. {tt('Сценарии запаса, найма и рекламы требуют дополнительных данных — появятся в следующих обновлениях.')}
          </div>
        </>
      )}
    </>
  );
}
