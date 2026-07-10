import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, PageHeader, Pills, Skeleton, EmptyState, BarChart, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const DOW_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const PERIODS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

export default function HrProductivityTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/productivity', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const byDow = data?.byDow || [];
  const byHour = data?.byHour || [];
  const employees = data?.employees || [];
  const bestDay = data?.bestDay || null;
  const worstDay = data?.worstDay || null;
  const bestHour = data?.bestHour || null;
  const worstHour = data?.worstHour || null;
  const hasData = byDow.some(d => d.revenue > 0) || byHour.some(h => h.revenue > 0);

  const hourLabel = (h) => (h == null ? '—' : `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`);
  const dayName = (dow) => (dow == null ? '—' : tt(DOW_RU[dow]));

  // Charts use revenue-per-hour where хватает данных, иначе чистую выручку.
  const dowData = DOW_SHORT.map((_, i) => {
    const row = byDow.find(d => d.dow === i);
    return row ? Number(row.revenue) : 0;
  });
  const dowLabels = DOW_SHORT.map(d => tt(d));
  const dowPeak = dowData.indexOf(Math.max(...dowData, 0));

  const hourData = Array.from({ length: 24 }, (_, h) => {
    const row = byHour.find(x => x.hour === h);
    return row ? Number(row.revenue) : 0;
  });
  const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const hourPeak = hourData.indexOf(Math.max(...hourData, 0));

  return (
    <>
      <PageHeader
        title={tt('🕐 Производительность по часам и дням')}
        sub={tt('Персонал · выручка по дням недели и часам · только просмотр')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} label={tt('Период')} />}
      />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState
            icon="🕐"
            title={tt('Нет данных о продажах')}
            description={tt('За выбранный период нет одобренных продаж для анализа производительности по часам.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile
              icon="🏆"
              label={tt('Лучший день')}
              value={dayName(bestDay?.dow)}
              sub={bestDay ? `${fmtMoneyFull(bestDay.revenue)} ${tt('сум')}` : '—'}
              color="#16A34A"
            />
            <Tile
              icon="🏆"
              label={tt('Лучший час')}
              value={hourLabel(bestHour?.hour)}
              sub={tt('пиковые продажи')}
              color="#16A34A"
            />
            <Tile
              icon="📉"
              label={tt('Худший день')}
              value={dayName(worstDay?.dow)}
              sub={worstDay ? `${fmtMoneyFull(worstDay.revenue)} ${tt('сум')}` : '—'}
              color="#DC2626"
            />
            <Tile
              icon="📉"
              label={tt('Худший час')}
              value={hourLabel(worstHour?.hour)}
              sub={tt('мало посетителей')}
              color="#DC2626"
            />
          </div>

          <div className="grid-2" style={{ marginBottom: 18 }}>
            <Card icon="📅" title={tt('Производительность по дням недели')}>
              <BarChart
                data={dowData}
                labels={dowLabels}
                height={200}
                peakIdx={dowPeak}
                peakColor="var(--primary)"
                normalColor="#93C5FD"
                maxLabels={7}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                {tt('ℹ️ Выручка по одобренным продажам, сгруппированная по дню недели.')}
              </div>
            </Card>

            <Card icon="🕐" title={tt('Производительность по часам дня')}>
              <BarChart
                data={hourData}
                labels={hourLabels}
                height={200}
                peakIdx={hourPeak}
                peakColor="var(--primary)"
                normalColor="#93C5FD"
                maxLabels={8}
              />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                {tt('ℹ️ Выручка по часам (0–23). Используйте для расстановки смен.')}
              </div>
            </Card>
          </div>

          <Card icon="👥" title={tt('Расстановка персонала')}>
            {employees.length === 0 ? (
              <EmptyState icon="👤" title={tt('Нет продавцов с продажами')} description={tt('За период никто не оформлял продажи.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Лучший день')}</th>
                      <th>{tt('Лучший час')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка/час')}</th>
                      <th>{tt('Рекомендация')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(e => {
                      const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <tr key={e.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                              <div>
                                <div style={{ fontWeight: 700 }}>{e.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text2)' }}>{e.best_dow != null ? dayName(e.best_dow) : '—'}</td>
                          <td className="mono">{e.best_hour != null ? hourLabel(e.best_hour) : '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                            {e.rev_per_hour > 0 ? fmtMoneyFull(e.rev_per_hour) : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(e.recommendation || '—')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Рекомендации построены по пиковому дню и часу каждого продавца. Точные рабочие часы появятся при учёте посещаемости.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
