import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Sparkline, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Прогноз потребности склада — когда и сколько закупать, чтобы не было дефицита/затоваривания.
// Категории срочности: urgent (исчерпание до дедлайна заказа), soon (2–4 недели),
// normal (запас есть), excess (затоварка). Read-only.
const URGENCY = {
  urgent: { color: '#DC2626', icon: '🔴', label: 'Срочно сейчас' },
  soon:   { color: '#D97706', icon: '⏰', label: 'Заказать заранее' },
  normal: { color: '#16A34A', icon: '✅', label: 'Запланировано' },
  excess: { color: '#0EA5E9', icon: '📦', label: 'Излишек' },
};

const HORIZONS = [
  { value: '14', label: '14 дней' },
  { value: '30', label: '30 дней' },
  { value: '60', label: '60 дней' },
  { value: '90', label: '90 дней' },
];

const TABS = [
  { value: 'all',    label: 'Все' },
  { value: 'urgent', label: '🔴 Срочно' },
  { value: 'soon',   label: '⏰ Заранее' },
  { value: 'normal', label: '✅ Норма' },
  { value: 'excess', label: '📦 Излишек' },
];

export default function DemandForecastTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [horizon, setHorizon] = useState('30');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { horizon };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/demand-forecast', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, horizon]);

  const items = data?.items || [];
  const summary = data?.summary || {};

  const filtered = tab === 'all' ? items : items.filter(i => i.urgency === tab);

  return (
    <>
      <PageHeader
        title={tt('📦 Прогноз потребности склада')}
        sub={tt('Сколько и когда закупить · прогноз по продажам за 90 дней')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pills value={horizon} onChange={setHorizon} label={tt('Горизонт')}
              options={HORIZONS.map(h => ({ ...h, label: tt(h.label) }))} />
          </div>

          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔴" label={tt('Нужно заказать срочно')} value={fmtNum(summary.urgent_count || 0)}
              sub={tt('исчерпаются до дедлайна заказа')} color="#DC2626" />
            <Tile icon="⏰" label={tt('Нужно заказать заранее')} value={fmtNum(summary.soon_count || 0)}
              sub={tt('закончатся в ближайшие недели')} color="#D97706" />
            <Tile icon="💰" label={tt('Сумма необходимых закупок')} value={fmtMoneyFull(summary.total_purchase_cost || 0)}
              sub="UZS" color="#1D4ED8" />
            <Tile icon="✅" label={tt('Не нужно заказывать')} value={fmtNum(summary.ok_count || 0)}
              sub={tt('запаса достаточно')} color="#16A34A" />
          </div>

          <Card icon="📋" title={`${tt('Рекомендации по закупкам')} (${filtered.length})`}
            actions={<Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />}
            style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прогноз продаж')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Текущий остаток')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Дни до исчерпания')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Нужно закупить')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Стоимость закупки')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Срочность')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : filtered.slice(0, 200).map(it => {
                    const u = URGENCY[it.urgency] || URGENCY.normal;
                    return (
                      <tr key={it.product_id}>
                        <td style={{ fontWeight: 700 }}>{it.name}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.forecast_qty)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)} {it.unit}</td>
                        <td className="mono" style={{ textAlign: 'center', color: it.days_left != null && it.days_left <= 7 ? 'var(--red)' : 'var(--text2)' }}>
                          {it.days_left == null ? '∞' : it.days_left}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {it.order_qty > 0 ? `${fmtNum(it.order_qty)} ${it.unit}` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {it.order_cost > 0 ? fmtMoneyFull(it.order_cost) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: u.color + '20', color: u.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {u.icon} {tt(u.label)}
                          </span>
                          {it.order_deadline && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                              {tt('до')} {it.order_deadline}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {items.some(i => i.urgency === 'urgent' || i.urgency === 'excess') && (
            <Card icon="🎯" title={tt('Приоритетные действия')}>
              {items.filter(i => i.urgency === 'urgent').slice(0, 5).map(it => (
                <div key={'u' + it.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: '#DC2626', fontWeight: 800 }}>🔴</span>
                  <div style={{ flex: 1 }}>
                    <b>{it.name}</b> — {tt('заказать')} {fmtNum(it.order_qty)} {it.unit} {tt('на сумму')} {fmtMoneyFull(it.order_cost)} UZS
                    {it.order_deadline && <span style={{ color: 'var(--text3)' }}> · {tt('до')} {it.order_deadline}</span>}
                  </div>
                </div>
              ))}
              {items.filter(i => i.urgency === 'excess').slice(0, 5).map(it => (
                <div key={'e' + it.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: '#0EA5E9', fontWeight: 800 }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <b>{it.name}</b> — {tt('излишек')}: {tt('остаток')} {fmtNum(it.stock)} {it.unit}, {tt('прогноз спроса')} {fmtNum(it.forecast_qty)} {it.unit}. {tt('Стимулируйте продажи или скидку.')}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}
