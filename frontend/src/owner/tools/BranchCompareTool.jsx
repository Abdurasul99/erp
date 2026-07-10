import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Pills, fmtMoney, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Цвета линий тренда по индексу филиала.
const TREND_COLORS = ['#1D4ED8', '#EC4899', '#16A34A', '#D97706', '#0EA5E9', '#9333EA', '#DC2626', '#16A34A'];

const INSIGHT_META = {
  leader:      { icon: '🏆', tone: 'green',  color: '#16A34A' },
  laggard:     { icon: '📉', tone: 'red',    color: '#DC2626' },
  opportunity: { icon: '💡', tone: 'yellow', color: '#D97706' },
};

function fmtCell(v, fmt) {
  if (v === null || v === undefined) return '—';
  if (fmt === 'money') return fmtMoney(v);
  if (fmt === 'pct')   return `${fmtNum(v)}%`;
  return fmtNum(v);
}

// Мини мульти-линейный график выручки по месяцам (inline SVG — без зависимостей).
function MultiLine({ series, months }) {
  const W = 720, H = 200, padL = 8, padR = 8, padT = 12, padB = 26;
  const allVals = series.flatMap(s => (s.points || []).map(p => p.revenue));
  const max = Math.max(1, ...allVals);
  const n = months.length;
  const x = (i) => padL + (n <= 1 ? 0 : (i * (W - padL - padR) / (n - 1)));
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480 }}>
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={padT + (1 - g) * (H - padT - padB)} y2={padT + (1 - g) * (H - padT - padB)}
            stroke="var(--border, #E5E7EB)" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        {series.map((s, si) => {
          const color = TREND_COLORS[si % TREND_COLORS.length];
          const d = (s.points || []).map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.revenue).toFixed(1)}`).join(' ');
          return (
            <g key={s.branch_id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.revenue)} r="3" fill={color} />)}
            </g>
          );
        })}
        {months.map((m, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text3, #94A0B5)">{m.slice(5)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        {series.map((s, si) => (
          <div key={s.branch_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: TREND_COLORS[si % TREND_COLORS.length] }} />
            {s.branch_name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BranchCompareTool() {
  const { tt } = useTt();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.get('/analytics/branches/compare', { params: { period } })
      .then(r => { if (alive) setData(r.data); })
      .catch(e => { if (alive) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  const branches = data?.branches || [];
  const metrics = data?.metrics || [];
  const trend = data?.trend || [];
  const insights = data?.insights || [];
  const months = trend[0]?.points?.map(p => p.month) || [];

  return (
    <>
      <PageHeader
        title={tt('🏭 Сравнение филиалов')}
        sub={tt('Выручка · прибыль · маржа · BHI по всем филиалам компании')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : branches.length === 0 ? (
        <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>{tt('Нет филиалов для сравнения')}</div></Card>
      ) : (
        <>
          {/* Таблица метрик по филиалам */}
          <Card icon="📊" title={tt('Ключевые метрики')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('Метрика')}</th>
                    {branches.map(b => (
                      <th key={b.id} style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12.5, fontWeight: 800 }}>{b.name}</th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>🏆 {tt('Лидер')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(m => {
                    const leaderName = m.leader_branch_id ? branches.find(b => b.id === m.leader_branch_id)?.name : null;
                    return (
                      <tr key={m.metric} style={{ borderTop: '1px solid var(--border, #EEF0F4)' }}>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                          {tt(m.label)}{m.placeholder && <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · {tt('нет данных')}</span>}
                        </td>
                        {branches.map(b => {
                          const v = m.values[b.id];
                          const isLeader = m.leader_branch_id === b.id;
                          return (
                            <td key={b.id} className="mono" style={{
                              textAlign: 'right', padding: '8px 10px', fontSize: 13.5,
                              fontWeight: isLeader ? 900 : 600,
                              color: isLeader ? 'var(--primary)' : (v == null ? 'var(--text3)' : 'var(--text)'),
                            }}>
                              {fmtCell(v, m.fmt)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                          {leaderName ? <Badge tone="green">{leaderName}</Badge> : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data?.bhi_company != null && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                {tt('BHI — единый индекс по компании (не разбивается по филиалам); NPS — данных пока нет.')}
              </div>
            )}
          </Card>

          {/* Тренд выручки 6 месяцев */}
          <Card icon="📈" title={`${tt('Выручка по филиалам')} · ${tt('6 месяцев')}`} style={{ marginBottom: 16 }}>
            {months.length > 0 ? (
              <MultiLine series={trend} months={months} />
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>{tt('Нет данных по выручке за период')}</div>
            )}
          </Card>

          {/* Инсайты */}
          {insights.length > 0 && (
            <Card icon="💡" title={tt('Выводы')}>
              <div className="list">
                {insights.map((ins, i) => {
                  const meta = INSIGHT_META[ins.type] || INSIGHT_META.opportunity;
                  return (
                    <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: 5, alignSelf: 'stretch', minHeight: 36, borderRadius: 3, background: meta.color }} />
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div className="list-item-title">{ins.title}</div>
                          <Badge tone={meta.tone}>{tt(ins.type === 'leader' ? 'Лидер' : ins.type === 'laggard' ? 'Отстаёт' : 'Возможность')}</Badge>
                        </div>
                        <div className="list-item-sub" style={{ marginTop: 3 }}>{ins.recommendation}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}