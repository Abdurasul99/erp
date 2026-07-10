import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, EmptyState, SkeletonCard, fmtNum, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Минимальный остаток / Алерт — read-only.
// Статусы: critical (остаток<=0), low (<min_stock), ok, overstock (>min_stock*3).
const STATUS_META = {
  critical:  { color: '#DC2626', label: 'Дефицит!',      tone: 'red'   },
  low:       { color: '#D97706', label: 'Скоро дефицит', tone: 'amber' },
  ok:        { color: '#16A34A', label: 'Норма',         tone: 'green' },
  overstock: { color: '#64748B', label: 'Излишек',       tone: 'gray'  },
};

export default function MinStockAlertTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/min-stock-alerts', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const items = data?.items || [];
  const summary = data?.summary || { critical: 0, low: 0, ok: 0, overstock: 0 };
  const alerts = data?.alerts || [];

  return (
    <>
      <PageHeader
        title={tt('🔔 Минимальный остаток / Алерт')}
        sub={tt('Склад · только просмотр · статус запаса по каждому товару')}
        actions={<Badge tone="amber">{tt('Полезно')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🛑" label={tt('Критический дефицит')} value={fmtNum(summary.critical)} sub={tt('остаток = 0 или меньше минимума')} color="#DC2626" />
            <Tile icon="⚠️" label={tt('Требуют внимания')}    value={fmtNum(summary.low)}      sub={tt('ниже минимальной нормы')}        color="#D97706" />
            <Tile icon="✅" label={tt('В норме')}              value={fmtNum(summary.ok)}       sub={tt('запас выше минимума')}          color="#16A34A" />
            <Tile icon="📦" label={tt('Излишек')}              value={fmtNum(summary.overstock)} sub={tt('превышает норму в 3 раза')}     color="#64748B" />
          </div>

          <Card icon="🚨" title={`${tt('Активные алерты')} (${alerts.length})`} style={{ marginBottom: 16 }}>
            {alerts.length === 0 ? (
              <EmptyState icon="✅" title={tt('Активных алертов нет')} description={tt('Все товары в пределах нормы')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alerts.map(a => {
                  const meta = STATUS_META[a.status] || {};
                  return (
                    <div key={a.product_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: meta.color + '0F', border: `1px solid ${meta.color}33`,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: 99, background: meta.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                          {tt('Остаток')}: <b className="mono">{fmtNum(a.quantity)}</b> {a.unit} · {tt('Минимум')}: <b className="mono">{fmtNum(a.min_stock)}</b> {a.unit}
                          {a.shortage > 0 && <> · {tt('Нехватка')}: <b className="mono" style={{ color: meta.color }}>{fmtNum(a.shortage)}</b> {a.unit}</>}
                          {a.days_of_supply != null && <> · {tt('Хватит на')}: <b className="mono">{fmtNum(a.days_of_supply)}</b> {tt('дн.')}</>}
                        </div>
                      </div>
                      {a.suggested_order > 0 && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('Заказать')}</div>
                          <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: meta.color }}>{fmtNum(a.suggested_order)} {a.unit}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card icon="📋" title={`${tt('Товары')} (${items.length})`}>
            {items.length === 0 ? (
              <EmptyState icon="📭" title={tt('Нет товаров')} description={tt('Добавьте товары на склад')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Остаток')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Мин. норма')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Нехватка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Хватит на')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 300).map(it => {
                      const meta = STATUS_META[it.status] || {};
                      return (
                        <tr key={it.product_id}>
                          <td style={{ fontWeight: 700 }}>{it.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.quantity)} {it.unit}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtNum(it.min_stock)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: it.shortage > 0 ? meta.color : 'var(--text3)' }}>
                            {it.shortage > 0 ? fmtNum(it.shortage) : '—'}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)', fontSize: 12 }}>
                            {it.days_of_supply == null ? '—' : `${fmtNum(it.days_of_supply)} ${tt('дн.')}`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                              {tt(meta.label)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
