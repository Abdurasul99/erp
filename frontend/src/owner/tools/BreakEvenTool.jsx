import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';

export default function BreakEvenTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/finance/break-even', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const d = data || {};
  const be = d.break_even_revenue;
  // Прогресс-бар: какая доля точки безубыточности уже покрыта выручкой
  const coverage = be ? Math.min(100, Math.round((d.revenue / be) * 100)) : 0;

  return (
    <>
      <PageHeader title={'⚖️ ' + tt('Точка безубыточности')} sub={tt('Когда выходишь в плюс · текущий месяц · реальные данные')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !d.revenue ? (
        <Card><EmptyState icon="📊" title={tt('Нет продаж за месяц')} description={tt('Точку безубыточности не на чём рассчитать. Появятся продажи — расчёт заработает.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка (месяц)')} value={fmtMoneyFull(d.revenue)} sub={tt('сум')} color="#5B4FE8" />
            <Tile icon="🏭" label={tt('Постоянные расходы')} value={fmtMoneyFull(d.fixed_costs)} sub={tt('сум · из кассы')} color="#FF6B2B" />
            <Tile icon="💎" label={tt('Маржинальность')} value={d.margin_ratio + '%'} sub={tt('валовая')} color="#22C55E" />
            <Tile icon="⚖️" label={tt('Точка безубыточности')} value={be != null ? fmtMoneyFull(be) : '—'} sub={tt('сум выручки')} color="#0EA5E9" />
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {d.above_break_even
                  ? <span style={{ color: 'var(--green)' }}>✅ {tt('Вы прошли точку безубыточности — бизнес в плюсе')}</span>
                  : <span style={{ color: 'var(--orange)' }}>⚠️ {tt('Ещё не вышли в плюс в этом месяце')}</span>}
              </div>
              <Badge tone={d.above_break_even ? 'green' : 'yellow'}>{coverage}% {tt('покрытия')}</Badge>
            </div>
            <div style={{ height: 14, background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: coverage + '%', height: '100%', background: d.above_break_even ? 'linear-gradient(90deg,#16a34a,#22C55E)' : 'linear-gradient(90deg,#F59E0B,#FB923C)', borderRadius: 8 }} />
            </div>
            <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)' }}>
              {d.above_break_even ? (
                <>
                  {tt('Постоянные расходы')} <strong className="mono">{fmtMoneyFull(d.fixed_costs)}</strong> {tt('сум уже покрыты.')}
                  {' '}{tt('Запас прочности —')} <strong style={{ color: 'var(--green)' }}>{d.safety_margin_pct}%</strong>:
                  {' '}{tt('выручка может упасть на столько, прежде чем уйти в минус.')}
                  {' '}{tt('Чистая прибыль месяца:')} <strong className="mono" style={{ color: 'var(--green)' }}>+{fmtMoneyFull(d.net_profit)}</strong> {tt('сум.')}
                </>
              ) : (
                <>
                  {tt('Чтобы выйти в ноль, нужно ещё продать на')}{' '}
                  <strong className="mono" style={{ color: 'var(--orange)' }}>{fmtMoneyFull(d.remaining_to_break_even)}</strong> {tt('сум')}
                  {d.sales_needed > 0 && <> (≈ <strong>{fmtNum(d.sales_needed)}</strong> {tt('продаж по среднему чеку')} {fmtMoneyFull(d.avg_check)} {tt('сум')})</>}.
                  {d.break_even_day
                    ? <> {tt('По текущему темпу выйдете в плюс примерно к')} <strong>{d.break_even_day}-{tt('му числу')}</strong> {tt('месяца.')}</>
                    : <> {tt('По текущему темпу в этом месяце выйти в плюс не успеваете — нужно ускорять продажи или снижать постоянные расходы.')}</>}
                </>
              )}
            </div>
          </Card>

          <Card icon="🧮" title={tt('Как это считается')}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div>{tt('Точка безубыточности = Постоянные расходы ÷ Маржинальность')}</div>
              <div className="mono" style={{ marginTop: 6, color: 'var(--text)' }}>
                {fmtMoneyFull(d.fixed_costs)} ÷ {d.margin_ratio}% = {be != null ? fmtMoneyFull(be) : '—'} {tt('сум выручки')}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {tt('Постоянные расходы берутся из кассовых расходов за месяц, маржинальность — из продаж (выручка минус себестоимость).')}
              </div>
            </div>
          </Card>

          <AiAnalyze topic="break-even" branchId={branchId} />
        </>
      )}
    </>
  );
}
