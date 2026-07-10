import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, BarChart, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Топ товаров — read-only по stock_outcome (status=approved, outcome_type=sale).
// Топ по выручке (доля, тренд) + продажи по дням недели и по часам.
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // EXTRACT(DOW): 0=Вс .. 6=Сб
const MEDAL = ['🥇', '🥈', '🥉'];

function trendMark(t) {
  if (t == null) return { sym: '→', color: 'var(--text3)' };
  if (t > 1) return { sym: '▲', color: 'var(--green, #16A34A)' };
  if (t < -1) return { sym: '▼', color: 'var(--red, #DC2626)' };
  return { sym: '→', color: 'var(--text3)' };
}

export default function SalesTopProductsTool() {
  const { tt } = useTt();
  const { branchId, periodFrom, periodTo, period } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    api.get('/sales/top-products', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, periodFrom, periodTo]);

  const kpi = data?.kpi || {};
  const products = data?.products || [];
  const byDow = data?.by_dow || [];   // [{dow:0..6, revenue}]
  const byHour = data?.by_hour || []; // [{hour:0..23, revenue}]

  // День недели — 7 баров (Пн..Вс по EXTRACT DOW: индекс = dow)
  const dowMap = {};
  byDow.forEach(d => { dowMap[d.dow] = parseFloat(d.revenue) || 0; });
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // Пн..Сб, Вс
  const dowData = dowOrder.map(i => dowMap[i] || 0);
  const dowLabels = dowOrder.map(i => DOW[i]);
  const dowPeak = dowData.indexOf(Math.max(...dowData, 0));

  // Час — 24 бара
  const hourMap = {};
  byHour.forEach(h => { hourMap[h.hour] = parseFloat(h.revenue) || 0; });
  const hourData = Array.from({ length: 24 }, (_, h) => hourMap[h] || 0);
  const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const hourPeak = hourData.indexOf(Math.max(...hourData, 0));

  const empty = !loading && !error && products.length === 0;

  return (
    <>
      <PageHeader
        title={tt('🏆 Топ товаров')}
        sub={tt('Лидеры по выручке · доля · тренд · продажи по дням и часам')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : empty ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📭</div><div>{tt('Нет продаж за период')}</div></div></Card>
      ) : (
        <>
          <div className="o-grid-4" style={{ marginBottom: 16 }}>
            <Tile
              icon="🏆" label={tt('Лидер')}
              value={kpi.leader_name || '—'}
              sub={kpi.leader_revenue ? `${fmtMoneyFull(kpi.leader_revenue)} UZS · ${fmtNum(kpi.leader_qty || 0)} ${tt('шт')}` : tt('нет данных')}
              color="#16A34A"
            />
            <Tile
              icon="📅" label={tt('Лучший день')}
              value={kpi.best_dow != null ? tt(DOW[kpi.best_dow]) : '—'}
              sub={kpi.best_dow_revenue ? `${fmtMoneyFull(kpi.best_dow_revenue)} UZS` : tt('нет данных')}
              color="#1D4ED8"
            />
            <Tile
              icon="🕐" label={tt('Пик-час')}
              value={kpi.peak_hour != null ? `${String(kpi.peak_hour).padStart(2, '0')}:00` : '—'}
              sub={kpi.peak_hour_share != null ? `${kpi.peak_hour_share}% ${tt('выручки')}` : tt('нет данных')}
              color="#D97706"
            />
            <Tile
              icon="🗂️" label={tt('Топ-категория')}
              value={kpi.top_category || '—'}
              sub={kpi.top_category_share != null ? `${kpi.top_category_share}% ${tt('выручки')}` : tt('нет данных')}
              color="#7C3AED"
            />
          </div>

          <Card icon="📋" title={`${tt('Топ товаров по выручке')} (${products.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Доля')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Тренд')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 50).map((p, i) => {
                    const tr = trendMark(p.trend);
                    return (
                      <tr key={p.product_id}>
                        <td style={{ fontWeight: 800, textAlign: 'center' }}>{MEDAL[i] || (i + 1)}</td>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(p.qty)} {p.unit}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(p.revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.share != null ? `${p.share}%` : '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: tr.color }}>
                          {tr.sym}{p.trend != null ? ` ${Math.abs(Math.round(p.trend))}%` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="o-grid-2">
            <Card icon="📅" title={tt('Продажи по дням недели')}>
              <BarChart
                data={dowData}
                labels={dowLabels}
                height={180}
                maxLabels={7}
                peakIdx={dowPeak}
                peakColor="#1D4ED8"
                normalColor="#93C5FD"
              />
            </Card>
            <Card icon="🕐" title={tt('Продажи по часам')}>
              <BarChart
                data={hourData}
                labels={hourLabels}
                height={180}
                maxLabels={8}
                peakIdx={hourPeak}
                peakColor="#D97706"
                normalColor="#FCD9A8"
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
