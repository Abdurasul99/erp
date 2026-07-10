import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';

export default function CashflowTool() {
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
    api.get('/finance/cashflow', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const byDay = data?.by_day || [];
  const forecast = data?.forecast_7d || [];
  const maxFlow = useMemo(() => Math.max(1, ...byDay.map(d => Math.max(d.income, d.expense))), [byDay]);

  const fmtDay = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const hasData = byDay.some(d => d.income > 0 || d.expense > 0);

  return (
    <>
      <PageHeader title="💸 Cash Flow" sub={tt('Движение денег по дням · приход и расход · реальные данные')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={180} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon="💤" title={tt('Нет движений по кассе за период')} description={tt('Как только появятся приходы/расходы в кассе — поток отобразится здесь.')} /></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile icon="📥" label={tt('Приход (период)')} value={'+' + fmtMoneyFull(data.income)} sub={tt('сум · в кассу')} color="#16A34A" />
            <Tile icon="📤" label={tt('Расход (период)')} value={'−' + fmtMoneyFull(data.expense)} sub={tt('сум · из кассы')} color="#DC2626" />
            <Tile icon="💎" label={tt('Сальдо')} value={(data.balance >= 0 ? '+' : '') + fmtMoneyFull(data.balance)}
              sub={data.balance_delta_pct != null ? `${data.balance_delta_pct >= 0 ? '▲' : '▼'} ${Math.abs(data.balance_delta_pct)}% ${tt('к прошлому периоду')}` : tt('сум')}
              color="#1D4ED8" />
          </div>

          <Card icon="📊" title={tt('Движение по дням')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, borderBottom: '1.5px solid var(--border, #E3EAF3)', paddingTop: 10 }}>
              {byDay.map((d, i) => (
                <div key={i} className="chart-col"
                  data-tip={`${fmtDay(d.day)}\n+${fmtMoneyFull(d.income)} · −${fmtMoneyFull(d.expense)}\nитого ${fmtMoneyFull(d.net)}`}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1 }}>
                  <div style={{ width: '40%', height: `${(d.income / maxFlow) * 100}%`, background: '#16A34A', borderRadius: '3px 3px 0 0', minHeight: d.income > 0 ? 2 : 0 }} />
                  <div style={{ width: '40%', height: `${(d.expense / maxFlow) * 100}%`, background: '#DC2626', borderRadius: '3px 3px 0 0', minHeight: d.expense > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>{byDay.length ? fmtDay(byDay[0].day) : ''}</span>
              <span>{byDay.length ? fmtDay(byDay[byDay.length - 1].day) : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#16A34A', borderRadius: 2 }} /> {tt('Приход')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#DC2626', borderRadius: 2 }} /> {tt('Расход')}</span>
            </div>
          </Card>

          <Card icon="📈" title={tt('Прогноз баланса на 7 дней')}>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
              {tt('По текущей динамике (средний чистый поток')} <strong className="mono">{(data.forecast_avg_net >= 0 ? '+' : '') + fmtMoneyFull(data.forecast_avg_net)}</strong> {tt('сум/день)')}
              {' '}{tt('баланс кассы к концу недели составит')}{' '}
              <strong className="mono" style={{ color: data.forecast_end_balance >= data.balance ? 'var(--green)' : 'var(--red)' }}>
                {(data.forecast_end_balance >= 0 ? '+' : '') + fmtMoneyFull(data.forecast_end_balance)} {tt('сум')}
              </strong>.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {forecast.map((f, i) => (
                <div key={i} style={{ flex: '1 1 80px', padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{fmtDay(f.day)}</div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 800, marginTop: 2, color: f.projected_balance >= 0 ? 'var(--text)' : 'var(--red)' }}>
                    {fmtMoneyFull(f.projected_balance)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              ℹ️ {tt('Это трендовая проекция по фактическим данным, а не гарантия. Резкие изменения продаж/расходов её меняют.')}
            </div>
          </Card>

          <AiAnalyze topic="cashflow" branchId={branchId} />
        </>
      )}
    </>
  );
}
