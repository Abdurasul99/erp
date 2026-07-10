import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Read-only прогноз закупок: спрос (скользящее среднее 90д), остаток ps.quantity,
// дни до исчерпания, срочность, дедлайн заказа (lead_time), рекомендованный объём, сумма-ориентир.

const HORIZONS = [
  { value: 30, label: '30 дней' },
  { value: 60, label: '60 дней' },
  { value: 90, label: '90 дней' },
];

const URGENCY = {
  urgent: { color: '#DC2626', icon: '🔴', label: 'Срочно' },
  soon:   { color: '#D97706', icon: '⏰', label: 'Заказать заранее' },
  normal: { color: '#16A34A', icon: '✅', label: 'В плане' },
};

function fmtDateShort(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function PurchaseForecastTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [horizon, setHorizon] = useState(30);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { horizon };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/forecast', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, horizon]);

  const items = data?.items || [];
  const summary = data?.summary || {};
  const urgentItems = items.filter(i => i.urgency === 'urgent');

  return (
    <>
      <PageHeader
        title={tt('🛒 Прогноз закупок')}
        sub={tt('Что и когда заказать · прогноз спроса · дедлайн заказа · сумма-ориентир')}
        actions={<Pills value={horizon} onChange={setHorizon} options={HORIZONS.map(h => ({ ...h, label: tt(h.label) }))} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔴" label={tt('Срочно заказать (позиций)')} value={fmtNum(summary.urgent_count || 0)} sub={tt('1–7 дней')} color="#DC2626" />
            <Tile icon="⏰" label={tt('Заказать заранее (позиций)')} value={fmtNum(summary.soon_count || 0)} sub={tt('2–4 недели')} color="#D97706" />
            <Tile icon="💰" label={tt('Сумма закупок (сум)')} value={fmtMoneyFull(summary.total_cost || 0)} sub={tt('ориентир на период')} color="var(--primary)" />
            <Tile icon="📦" label={tt('Позиций к заказу')} value={fmtNum(summary.order_count || 0)} sub={tt('всего рекомендаций')} color="#16A34A" />
          </div>

          {urgentItems.length > 0 && (
            <Card icon="⚡" title={tt('Срочные заказы — сделать прямо сейчас')} style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th>{tt('Поставщик')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Остаток (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Дней до 0')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Нужно (шт)')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Заказать до')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentItems.slice(0, 100).map(it => (
                      <tr key={it.product_id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td style={{ color: 'var(--text2)' }}>{it.supplier || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'right', color: '#DC2626', fontWeight: 800 }}>{it.days_left == null ? '∞' : fmtNum(it.days_left)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(it.order_qty)}</td>
                        <td className="mono" style={{ textAlign: 'center', color: '#DC2626', fontWeight: 700 }}>{fmtDateShort(it.order_deadline)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.order_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card icon="📋" title={`${tt('Все рекомендации на следующий период')} (${items.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прогноз продаж (шт)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Текущий остаток (шт)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Нужно заказать (шт)')}</th>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Срочность')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет рекомендаций — запасов достаточно')}</td></tr>
                  ) : items.slice(0, 300).map(it => {
                    const u = URGENCY[it.urgency] || URGENCY.normal;
                    const badgeLabel = it.urgency === 'urgent'
                      ? `${u.icon} ${tt('Срочно')}`
                      : `${u.icon} ${tt('До')} ${fmtDateShort(it.order_deadline)}`;
                    return (
                      <tr key={it.product_id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.forecast_qty)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(it.order_qty)}</td>
                        <td style={{ color: 'var(--text2)' }}>{it.supplier || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.order_cost)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: u.color + '20', color: u.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {badgeLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
