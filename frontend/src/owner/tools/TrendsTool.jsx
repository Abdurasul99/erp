import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Pills, fmtMoney, fmtNum, BarChart } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Цвет/тон/иконка статуса тренда (good/ok/bad/flat). tone ∈ набор ui.jsx Badge.
const STATUS_META = {
  good: { color: '#16A34A', tone: 'green', arrow: '▲' },
  ok:   { color: '#1D4ED8', tone: 'blue',  arrow: '▲' },
  bad:  { color: '#DC2626', tone: 'red',   arrow: '▼' },
  flat: { color: '#94A3B8', tone: 'gray',  arrow: '–' },
};

const WINDOWS = [
  { value: 6,  label: '6 мес' },
  { value: 12, label: '12 мес' },
  { value: 24, label: '24 мес' },
];

// Форматирование значения метрики по единице измерения.
function fmtMetric(v, unit) {
  if (unit === '%') return `${(Number(v) || 0).toFixed(1)}%`;
  if (unit === 'сум') return `${fmtMoney(v)}`;
  if (unit === 'шт') return fmtNum(Math.round((Number(v) || 0) * 10) / 10);
  return fmtNum(v);
}

function growthLabel(g) {
  const n = Number(g) || 0;
  return `${n > 0 ? '+' : ''}${n}%`;
}

export default function TrendsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { months };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/trends', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, months]);

  const metrics = data?.metrics || [];
  const labels = data?.labels || [];
  const insights = data?.insights || [];

  return (
    <>
      <PageHeader
        title={tt('📈 Тренды и динамика')}
        sub={tt('Тренд ключевых метрик · первая половина окна vs вторая · авто-инсайты')}
        actions={<Pills value={months} onChange={setMonths} options={WINDOWS.map(w => ({ ...w, label: tt(w.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : metrics.length === 0 ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📊</div><div>{tt('Недостаточно данных за период')}</div></div></Card>
      ) : (
        <>
          {/* Авто-инсайты */}
          {insights.length > 0 && (
            <Card icon="💡" title={tt('Авто-инсайты')} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map((ins, i) => {
                  const positive = ins.type === 'positive';
                  const c = positive ? '#16A34A' : '#DC2626';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: c + '12', border: `1px solid ${c}30`,
                    }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>{positive ? '✅' : '⚠️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: c }}>{tt(ins.title)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>{tt(ins.description)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Карточки метрик с мини-графиком */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            {metrics.map(m => {
              const sm = STATUS_META[m.status] || STATUS_META.flat;
              const last = m.values[m.values.length - 1];
              return (
                <Card key={m.name} style={{ padding: 0 }}>
                  <div style={{ padding: '14px 16px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt(m.label)}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }} className="mono">
                          {fmtMetric(last, m.unit)}
                          {m.unit === 'сум' && <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>UZS</span>}
                        </div>
                      </div>
                      <Badge tone={sm.tone}>{sm.arrow} {tt(m.status_label)}</Badge>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, color: sm.color, fontWeight: 800 }} className="mono">
                      {growthLabel(m.growth_pct)} {tt('за период')}
                    </div>
                  </div>
                  <div style={{ padding: '0 12px 12px' }}>
                    <BarChart data={m.values} labels={labels} color={sm.color} height={90} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Таблица всех метрик */}
          <Card icon="📋" title={tt('Все метрики')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Метрика')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Начало')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Конец')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Тренд')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(m => {
                    const sm = STATUS_META[m.status] || STATUS_META.flat;
                    const first = m.values[0];
                    const last = m.values[m.values.length - 1];
                    return (
                      <tr key={m.name}>
                        <td style={{ fontWeight: 700 }}>
                          {tt(m.label)}
                          {m.direction === 'down_is_good' && (
                            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>{tt('↓ лучше')}</span>
                          )}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMetric(first, m.unit)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMetric(last, m.unit)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: sm.color }}>{growthLabel(m.growth_pct)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: sm.color + '20', color: sm.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                            {sm.arrow} {tt(m.status_label)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('Тренд = (среднее второй половины окна − среднее первой) / первой × 100%. Для расходов и склада снижение считается улучшением. NPS, ФОТ и история мёртвого стока не отслеживаются — нет данных.')}
          </div>
        </>
      )}
    </>
  );
}