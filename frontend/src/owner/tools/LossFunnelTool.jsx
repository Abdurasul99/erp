import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum, fmtSum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: '7',  label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: 'quarter', label: 'Квартал' },
];

// Цвет ступени по индексу (градиент сверху воронки вниз).
const STAGE_COLORS = ['#1D4ED8', '#3B82F6', '#0EA5E9', '#16A34A', '#D97706', '#F97316'];

// Тон отвала для Badge: чем больше отвал — тем тревожнее.
function dropTone(pct) {
  if (pct == null) return 'gray';
  if (pct >= 60) return 'red';
  if (pct >= 35) return 'yellow';
  return 'green';
}
function dropColor(pct) {
  const t = dropTone(pct);
  if (t === 'green') return 'var(--green, var(--text2))';
  if (t === 'red') return 'var(--red, var(--text2))';
  if (t === 'yellow') return 'var(--orange, var(--text2))';
  return 'var(--text3)';
}

export default function LossFunnelTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/loss-funnel', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const stages = data?.stages || [];
  const maxCount = Math.max(1, ...stages.map(s => s.count || 0));
  const hasData = stages.some(s => (s.count || 0) > 0);

  return (
    <>
      <PageHeader
        title={tt('🕳️ Воронка потерь')}
        sub={tt('Где отваливаются клиенты: путь от первого контакта до повторной покупки')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : !hasData ? (
        <EmptyState icon="🕳️" title={tt('Нет данных')} description={tt('Недостаточно данных за период. Введите показы и посетители в «Воронке бизнеса».')} />
      ) : (
        <>
          {/* KPI */}
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile
              icon="🚪"
              label={tt('Всего потеряно')}
              value={fmtNum(data.total_lost)}
              sub={data.total_lost_pct != null ? `${data.total_lost_pct}% ${tt('от входа')}` : null}
              color="#DC2626"
            />
            <Tile
              icon="💸"
              label={tt('Упущенная выручка')}
              value={fmtSum(data.lost_revenue)}
              sub={tt('по среднему чеку')}
              color="#D97706"
            />
            <Tile
              icon="🎯"
              label={tt('Худший этап')}
              value={data.worst_stage ? tt(data.worst_stage.label) : '—'}
              sub={data.worst_stage?.drop_pct != null ? `${data.worst_stage.drop_pct}% ${tt('отвал')}` : null}
              color="#1D4ED8"
            />
          </div>

          {/* Воронка — пропорциональные бары */}
          <Card icon="🕳️" title={tt('Воронка потерь')} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stages.map((s, i) => {
                const color = STAGE_COLORS[i] || '#1D4ED8';
                const w = Math.max(8, Math.round(((s.count || 0) / maxCount) * 100));
                const isWorst = data.worst_stage && data.worst_stage.name === s.name;
                return (
                  <div key={s.name}>
                    {i > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 11.5, color: 'var(--text3)', padding: '2px 0' }}>
                        <span className="mono" style={{ fontWeight: 800, color: 'var(--text2)' }}>
                          ▼ {s.conversion_pct != null ? `${s.conversion_pct}%` : '—'} {tt('конв.')}
                        </span>
                        {s.drop_pct != null && s.drop_pct > 0 && (
                          <span className="mono" style={{ color: dropColor(s.drop_pct), fontWeight: 800 }}>
                            −{fmtNum(s.loss)} ({s.drop_pct}%)
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                      <div style={{ width: 180, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{tt(s.label)}</span>
                        {isWorst && <Badge tone="red">{tt('худший')}</Badge>}
                      </div>
                      <div style={{ flex: 1, background: 'var(--bg2, #F1F5F9)', borderRadius: 8, height: 34, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          width: w + '%', height: '100%',
                          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          paddingRight: 10, transition: 'width .35s ease',
                        }}>
                          <span className="mono" style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>{fmtNum(s.count)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Таблица потерь */}
          <Card icon="📋" title={tt('Потери по этапам')} style={{ marginBottom: 18 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Этап')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Вошло')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прошло дальше')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Конверсия')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Отвал')}</th>
                    <th>{tt('Причина')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s, i) => {
                    const next = stages[i + 1];
                    const passed = next ? next.count : null;
                    return (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 700 }}>{tt(s.label)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtNum(s.count)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                          {passed != null ? fmtNum(passed) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {next && next.conversion_pct != null ? (
                            <span style={{ fontWeight: 800 }}>{next.conversion_pct}%</span>
                          ) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {next && next.drop_pct != null ? (
                            <span style={{ color: dropColor(next.drop_pct), fontWeight: 800 }}>
                              {fmtNum(next.loss)} ({next.drop_pct}%)
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {next && next.reason ? tt(next.reason) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('Конверсия = следующая ступень / текущая × 100. Отвал = сколько клиентов не дошло до следующей ступени. Упущенная выручка = потерянные клиенты × средний чек')}
            {data.avg_check ? ` (${fmtSum(data.avg_check)})` : ''}.{' '}
            {tt('Показы/посетители — ручной ввод в «Воронке бизнеса»; лояльные/VIP считаются по RFM.')}
          </div>
        </>
      )}
    </>
  );
}
