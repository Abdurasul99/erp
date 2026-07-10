import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Форматирование значения метрики по единице измерения.
function fmtMetric(v, unit) {
  if (v == null) return '—';
  if (unit === '%') return `${(Number(v) || 0).toFixed(1)}%`;
  if (unit === 'сум') return fmtMoney(v);
  if (unit === 'шт' || unit === 'чел') return fmtNum(Math.round((Number(v) || 0) * 10) / 10);
  return fmtNum(v);
}

function deltaLabel(d) {
  if (d == null) return '—';
  const n = Number(d) || 0;
  return `${n > 0 ? '+' : ''}${n}%`;
}

// Цвет дельты с учётом направления (down_is_good → снижение зелёное).
function deltaColor(d, direction) {
  if (d == null) return 'var(--text3)';
  const good = direction === 'down_is_good' ? -d : d;
  if (good > 5) return '#16A34A';
  if (good < -5) return '#DC2626';
  return 'var(--text3)';
}

// Зоны BHI — ключи совпадают с backend bhiZone(): normal | attention | critical.
const BHI_ZONE = {
  normal:    { tone: 'green',  label: 'Здоровый' },
  attention: { tone: 'yellow', label: 'Внимание' },
  critical:  { tone: 'red',    label: 'Критично' },
};

export default function PeriodReportTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/report', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const h = data?.headline || {};
  const metrics = data?.metrics || [];
  const improved = data?.improved || [];
  const worsened = data?.worsened || [];
  const recommendations = data?.recommendations || [];
  const bhiZone = h.bhi_zone ? (BHI_ZONE[h.bhi_zone] || { tone: 'blue', label: '—' }) : null;

  return (
    <>
      <PageHeader
        title={tt('📑 Сводный отчёт за период')}
        sub={tt('One-click отчёт: KPI · что улучшилось/ухудшилось · авто-рекомендации')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} />
          </div>
          <Card><Skeleton height={14} style={{ marginBottom: 8 }} /><Skeleton height={14} width="70%" /></Card>
        </>
      ) : !data ? (
        <EmptyState icon="📭" title={tt('Нет данных')} description={tt('За выбранный период данных нет')} />
      ) : (
        <>
          {/* Headline KPI */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка')} value={fmtMoney(h.revenue)} sub="UZS" color="#16A34A" />
            <Tile icon="📈" label={tt('Прибыль')} value={fmtMoney(h.profit)} sub="UZS" color="#1D4ED8" />
            <Tile icon="🧾" label={tt('Средний чек')} value={fmtMoney(h.avg_check)} sub="UZS" color="#1D4ED8" />
            <Tile icon="📅" label={tt('Чеков в день')} value={fmtNum(Math.round((h.checks_per_day || 0) * 10) / 10)} color="#0EA5E9" />
            <Tile icon="🧍" label={tt('Новых клиентов')} value={fmtNum(h.new_customers)} color="#EC4899" />
            <Tile
              icon="❤️"
              label={tt('BHI · здоровье бизнеса')}
              value={h.bhi == null ? '—' : `${h.bhi}/100`}
              sub={bhiZone ? tt(bhiZone.label) : ''}
              color="#D97706"
            />
          </div>

          {/* Прибл. deadstock */}
          {h.deadstock > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🧊</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>{tt('Товары без продаж за период (прибл.)')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
                    {tt('Заморожено в складе')}: <b className="mono">{fmtMoney(h.deadstock)} UZS</b> {tt('(по себестоимости)')}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Что улучшилось / ухудшилось */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="✅" title={tt('Что улучшилось')}>
              {improved.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{tt('Существенного роста (>5%) нет')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {improved.map((x, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#16A34A12', border: '1px solid #16A34A30' }}>
                      <Badge tone="green">{deltaLabel(x.delta_pct)}</Badge>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tt(x.text)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card icon="⚠️" title={tt('Что ухудшилось')}>
              {worsened.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{tt('Существенного спада (>5%) нет')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {worsened.map((x, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#DC262612', border: '1px solid #DC262630' }}>
                      <Badge tone="red">{x.delta_pct == null ? '!' : deltaLabel(x.delta_pct)}</Badge>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tt(x.text)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Рекомендации */}
          {recommendations.length > 0 && (
            <Card icon="💡" title={tt('Рекомендации')} style={{ marginBottom: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recommendations.map((rec, i) => (
                  <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text2)' }}>{tt(rec)}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Таблица метрик: текущий vs прошлый период */}
          <Card icon="📋" title={tt('Ключевые метрики · текущий vs прошлый период')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Метрика')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прошлый')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Текущий')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Δ %')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(m => (
                    <tr key={m.name}>
                      <td style={{ fontWeight: 700 }}>
                        {tt(m.label)}
                        {m.direction === 'down_is_good' && (
                          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>{tt('↓ лучше')}</span>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMetric(m.previous, m.unit)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMetric(m.current, m.unit)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: deltaColor(m.delta_pct, m.direction) }}>
                        {deltaLabel(m.delta_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('Порог «улучшилось/ухудшилось» — ±5% к прошлому периоду той же длины. Deadstock — приблизительный (товары без продаж за период, по себестоимости). NPS не отслеживается — нет данных. Экспорт в PDF и отправка на email — в планах.')}
          </div>
        </>
      )}
    </>
  );
}