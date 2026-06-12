import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';

export default function FinModelTool() {
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/finance/model', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const months = data?.months || [];
  const projection = data?.projection || [];
  const all = useMemo(() => [...months, ...projection], [months, projection]);
  const maxRev = useMemo(() => Math.max(1, ...all.map(m => m.revenue)), [all]);

  const hasData = months.some(m => m.revenue > 0);
  const lastReal = [...months].reverse().find(m => m.revenue > 0);

  return (
    <>
      <PageHeader title="📈 Финансовая модель" sub="P&L по месяцам + прогноз на 3 месяца · реальные данные" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card><EmptyState icon="📊" title="Недостаточно истории" description="Для финансовой модели нужны продажи хотя бы за месяц. Появятся данные — модель построится." /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label="Выручка (посл. месяц)" value={fmtMoneyFull(lastReal?.revenue || 0)} sub="сум" color="#5B4FE8" />
            <Tile icon="💎" label="Валовая прибыль" value={fmtMoneyFull(lastReal?.gross_profit || 0)} sub="сум" color="#22C55E" />
            <Tile icon="🏦" label="Чистая прибыль" value={fmtMoneyFull(lastReal?.net_profit || 0)} sub="сум · после расходов" color={(lastReal?.net_profit || 0) >= 0 ? '#16a34a' : '#EF4444'} />
            <Tile icon="📈" label="Темп роста" value={(data.growth_pct >= 0 ? '+' : '') + data.growth_pct + '%'} sub="выручка / мес" color={data.growth_pct >= 0 ? '#22C55E' : '#EF4444'} />
          </div>

          <Card icon="📊" title="Выручка по месяцам (факт + прогноз)" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, borderBottom: '1.5px solid var(--border, #e6e8f2)', paddingTop: 10 }}>
              {all.map((m, i) => (
                <div key={i} className="chart-col"
                  data-tip={`${m.label}${m.projected ? ' (прогноз)' : ''} · ${fmtMoneyFull(m.revenue)} сум`}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{
                    width: '70%', height: `${(m.revenue / maxRev) * 100}%`,
                    background: m.projected ? 'repeating-linear-gradient(45deg,#A5B4FC,#A5B4FC 4px,#C7D2FE 4px,#C7D2FE 8px)' : 'linear-gradient(180deg,#5B4FE8,#7c6ff0)',
                    borderRadius: '5px 5px 0 0', minHeight: m.revenue > 0 ? 3 : 0,
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {all.map((m, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: m.projected ? 'var(--primary)' : 'var(--text3)', fontWeight: 700 }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#5B4FE8', borderRadius: 2 }} /> Факт</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#A5B4FC', borderRadius: 2 }} /> Прогноз</span>
            </div>
          </Card>

          <Card icon="📋" title="P&L по месяцам">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th style={{ textAlign: 'right' }}>Выручка</th>
                    <th style={{ textAlign: 'right' }}>Себестоимость</th>
                    <th style={{ textAlign: 'right' }}>Валовая прибыль</th>
                    <th style={{ textAlign: 'right' }}>Расходы</th>
                    <th style={{ textAlign: 'right' }}>Чистая прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((m, i) => (
                    <tr key={i} style={m.projected ? { background: 'rgba(91,79,232,.04)' } : undefined}>
                      <td style={{ fontWeight: 700 }}>{m.label} {m.projected && <Badge tone="purple">прогноз</Badge>}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(m.revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text3)' }}>−{fmtMoneyFull(m.cogs)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--green)' }}>{fmtMoneyFull(m.gross_profit)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text3)' }}>−{fmtMoneyFull(m.opex)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: m.net_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {m.net_profit >= 0 ? '+' : ''}{fmtMoneyFull(m.net_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              ℹ️ Прогноз строится по среднемесячному темпу роста ({(data.growth_pct >= 0 ? '+' : '') + data.growth_pct}%) на основе фактических месяцев. Расходы прогнозируются по среднему уровню.
            </div>
          </Card>

          <AiAnalyze topic="model" branchId={branchId} />
        </>
      )}
    </>
  );
}
