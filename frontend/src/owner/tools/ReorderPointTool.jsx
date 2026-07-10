import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Progress, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// ROP — точка заказа. Read-only.
// avg_daily_demand = продажи за период / дни периода (stock_outcome, sale, approved)
// ROP = avg_daily_demand * lead_time + safety_stock; «заказать» при остатке <= ROP.
const PERIODS = [
  { value: 'day',   label: 'День',   days: 1 },
  { value: 'week',  label: 'Неделя', days: 7 },
  { value: 'month', label: 'Месяц',  days: 30 },
  { value: 'year',  label: 'Год',    days: 365 },
];

export default function ReorderPointTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');

  // What-if калькулятор (на клиенте)
  const [wAvg, setWAvg] = useState(5);
  const [wLead, setWLead] = useState(7);
  const [wSafe, setWSafe] = useState(10);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/reorder-point', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const items = data?.items || [];
  const summary = data?.summary || {};
  const toOrder = useMemo(() => items.filter(i => i.need_order), [items]);

  const whatIfRop = Math.round((parseFloat(wAvg) || 0) * (parseFloat(wLead) || 0) + (parseFloat(wSafe) || 0));

  return (
    <>
      <PageHeader
        title={tt('🎯 ROP — Точка заказа')}
        sub={tt('Склад · Менеджер · только просмотр')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Pills value={period} onChange={setPeriod}
              options={PERIODS.map(p => ({ value: p.value, label: tt(p.label) }))} />
          </div>

          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Всего товаров')} value={fmtNum(summary.total || 0)} sub={tt('с расчётом ROP')} color="#1D4ED8" />
            <Tile icon="🚨" label={tt('Заказать сейчас')} value={fmtNum(summary.to_order || 0)} sub={tt('остаток ≤ ROP')} color="#DC2626" />
            <Tile icon="📊" label={tt('Ср. срок поставки')} value={`${fmtNum(summary.avg_lead_time || 0)} ${tt('дн')}`} sub={tt('lead time')} color="#0EA5E9" />
            <Tile icon="💰" label={tt('Сумма дозаказа')} value={fmtMoneyFull(summary.reorder_cost || 0)} sub={tt('UZS по себестоимости')} color="#16A34A" />
          </div>

          {toOrder.length > 0 && (
            <Card icon="⚠️" title={tt('Нужно заказать прямо сейчас')} style={{ marginBottom: 16 }}>
              <div className="grid-3">
                {toOrder.slice(0, 12).map(it => (
                  <div key={it.product_id} style={{
                    border: '1px solid var(--border, #E3EAF3)', borderLeft: '4px solid var(--red, #DC2626)',
                    borderRadius: 10, padding: 14, background: 'rgba(220,38,38,.04)',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{it.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)' }}>
                      <span>{tt('Остаток')}</span>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--red, #DC2626)' }}>{fmtNum(it.stock)} {it.unit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      <span>{tt('Точка заказа')}</span>
                      <span className="mono" style={{ fontWeight: 700 }}>{fmtNum(it.rop)} {it.unit}</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Progress value={it.stock} max={Math.max(it.rop, 1)} color="var(--red, #DC2626)" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
                      <span style={{ color: 'var(--text2)' }}>{tt('Заказать')}</span>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>≈ {fmtNum(it.suggest_qty)} {it.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card icon="📋" title={`${tt('Точки заказа по всем товарам')} (${items.length})`} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>{tt('Товар')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Ср. продаж/день')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Срок поставки')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Страх. запас')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Точка заказа')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Остаток')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет товаров')}</td></tr>
                  ) : items.slice(0, 300).map(it => (
                    <tr key={it.product_id}>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{(it.avg_daily_demand || 0).toFixed(2)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.lead_time)} {tt('дн')}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.safety_stock)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtNum(it.rop)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.stock)} {it.unit}</td>
                      <td style={{ textAlign: 'center' }}>
                        {it.need_order
                          ? <Badge tone="red">{tt('ЗАКАЗАТЬ!')}</Badge>
                          : <Badge tone="green">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🤔" title={tt('Что если — рассчитать точку заказа')}>
            <div className="grid-4" style={{ alignItems: 'end' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                {tt('Ср. продаж/день')}
                <input type="number" min="0" step="0.1" value={wAvg}
                  onChange={e => setWAvg(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: '1px solid var(--border, #E3EAF3)', borderRadius: 8 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                {tt('Срок поставки')} ({tt('дн')})
                <input type="number" min="0" step="1" value={wLead}
                  onChange={e => setWLead(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: '1px solid var(--border, #E3EAF3)', borderRadius: 8 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                {tt('Страх. запас')}
                <input type="number" min="0" step="1" value={wSafe}
                  onChange={e => setWSafe(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '8px 10px', border: '1px solid var(--border, #E3EAF3)', borderRadius: 8 }} />
              </label>
              <div style={{
                background: 'rgba(29,78,216,.08)', borderRadius: 10, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{tt('Точка заказа')}</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)' }}>{fmtNum(whatIfRop)}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              {tt('Формула')}: ROP = {tt('Ср. продаж/день')} × {tt('Срок поставки')} + {tt('Страх. запас')}.
              {' '}{tt('Когда остаток падает до этого значения — пора делать заказ.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
