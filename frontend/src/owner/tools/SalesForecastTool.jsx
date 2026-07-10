import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, AreaChart, Progress, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function pctTone(v) {
  if (v > 0) return 'green';
  if (v < 0) return 'red';
  return 'gray';
}

export default function SalesForecastTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/sales/forecast', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const days = data?.days || [];
  const top = data?.top_products || [];
  const recs = data?.recommendations || [];
  const sum = data?.summary || {};

  // данные для графика: история (факт) + прогноз
  const actualSeries = (data?.history || []).map(h => h.revenue);
  const forecastSeries = days.map(d => d.forecast);
  const chartData = [...actualSeries, ...forecastSeries];
  const chartLabels = [
    ...(data?.history || []).map(() => ''),
    ...days.map((d, i) => (i % 5 === 0 ? d.date.slice(8, 10) : '')),
  ];

  const planPct = sum.plan_target > 0 ? Math.round((sum.plan_fact / sum.plan_target) * 100) : 0;

  return (
    <>
      <PageHeader
        title={tt('📈 Прогноз продаж')}
        sub={tt('Прогноз выручки и чеков на месяц · скользящее среднее + сезонность по дням недели')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (!data || days.length === 0) ? (
        <Card>
          <EmptyState
            icon="📉"
            title={tt('Недостаточно данных для прогноза')}
            description={tt('Прогноз строится по истории продаж. Добавьте продажи за несколько недель.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile
              icon="💰" label={tt('Прогноз выручки (месяц)')}
              value={`${fmtMoneyFull(sum.forecast_revenue)} UZS`}
              sub={`${sum.revenue_delta >= 0 ? '+' : ''}${sum.revenue_delta}% ${tt('к текущему')}`}
              color="#16A34A"
            />
            <Tile
              icon="🧾" label={tt('Прогноз чеков (месяц)')}
              value={fmtNum(sum.forecast_checks)}
              sub={`${sum.checks_delta >= 0 ? '+' : ''}${sum.checks_delta}% ${tt('к текущему')}`}
              color="#1D4ED8"
            />
            <Tile
              icon="🎯" label={tt('Точность прогноза')}
              value={`${sum.accuracy}%`}
              sub={`${tt('по истории')} · ${sum.history_days} ${tt('дн')}`}
              color="#7C3AED"
            />
            <Tile
              icon="📊" label={tt('Выполнение текущего плана')}
              value={`${planPct}%`}
              sub={`${fmtMoneyFull(sum.plan_fact)} / ${fmtMoneyFull(sum.plan_target)} ${tt('сум')}`}
              color="#D97706"
            />
          </div>

          <Card icon="📉" title={tt('Динамика: факт и прогноз')} style={{ marginBottom: 16 }}
            actions={<span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('Метод')}: {sum.method || tt('скользящее среднее + сезонность')}</span>}>
            <AreaChart data={chartData} labels={chartLabels} color="var(--primary)" height={180} />
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span>◼ {tt('История (факт)')}: {actualSeries.length} {tt('дн')}</span>
              <span>◻ {tt('Прогноз')}: {forecastSeries.length} {tt('дн')}</span>
              <span>{tt('Коридор мин/макс ниже в таблице')}</span>
            </div>
          </Card>

          <div className="grid-2" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card icon="📅" title={`${tt('Прогноз по дням')} (${days.length})`}>
              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата')}</th>
                      <th>{tt('День')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прогноз')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Мин')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Макс')}</th>
                      <th>{tt('Примечание')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(d => (
                      <tr key={d.date} style={d.is_peak ? { background: 'var(--primary-10, rgba(37,99,235,.06))' } : undefined}>
                        <td className="mono" style={{ fontWeight: 700 }}>{d.date.slice(5)}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{tt(DOW_RU[d.dow] || '')}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtMoneyFull(d.forecast)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text3)', fontSize: 12 }}>{fmtMoneyFull(d.min)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text3)', fontSize: 12 }}>{fmtMoneyFull(d.max)}</td>
                        <td style={{ fontSize: 11 }}>
                          {d.is_peak ? <span style={{ color: 'var(--primary)', fontWeight: 800 }}>🔥 {tt('пик')}</span> : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card icon="🏆" title={`${tt('Топ-товары (прогноз)')} (${top.length})`}>
              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                {top.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет данных')}</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{tt('Товар')}</th>
                        <th style={{ textAlign: 'right' }}>{tt('Сейчас, шт')}</th>
                        <th style={{ textAlign: 'right' }}>{tt('Прогноз, шт')}</th>
                        <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                        <th style={{ textAlign: 'right' }}>{tt('Тренд')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map(p => (
                        <tr key={p.product_id}>
                          <td style={{ fontWeight: 700 }}>{p.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(p.qty_now)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtNum(p.qty_forecast)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(p.revenue_forecast)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Badge tone={pctTone(p.trend)}>{p.trend >= 0 ? '+' : ''}{p.trend}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          <Card icon="💡" title={tt('Рекомендации')}>
            {recs.length === 0 ? (
              <div style={{ color: 'var(--text3)' }}>{tt('Рекомендаций пока нет')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: 'var(--bg2, #F6F8FB)', borderRadius: 10 }}>
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{r.icon || '•'}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{tt(r.title)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{tt(r.text)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
