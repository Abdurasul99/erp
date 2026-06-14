import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';

const SEG_RU = { vip: 'VIP', regular: 'Постоянный', sleeping: 'Засыпает', lost: 'Потерян', new: 'Новый' };
const SEG_TONE = { vip: 'purple', regular: 'green', sleeping: 'yellow', lost: 'red', new: 'blue' };

export default function LtvTool() {
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/ltv', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const lastBuy = (iso) => {
    if (!iso) return '—';
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
    return d === 0 ? 'сегодня' : d === 1 ? 'вчера' : d + ' дн назад';
  };

  return (
    <>
      <PageHeader title="💎 LTV клиентов" sub="Ценность клиента · повторные покупки · сегменты · реальные данные" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !data?.buyers_count ? (
        <Card><EmptyState icon="💎" title="Пока нет покупателей с привязкой к клиенту" description="LTV считается по клиентам из базы. Привязывайте продажи к клиентам в кассе — и здесь появится ценность каждого." /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💎" label="Средний LTV" value={fmtMoneyFull(data.avg_ltv)} sub="сум · на клиента" color="#9333EA" />
            <Tile icon="🔁" label="Повторные покупки" value={data.repeat_rate + '%'} sub="клиентов ≥2 заказов" color="#22C55E" />
            <Tile icon="🧾" label="Средний чек" value={fmtMoneyFull(data.avg_order_value)} sub="сум" color="#FF6B2B" />
            <Tile icon="📦" label="Заказов на клиента" value={data.avg_orders} sub="в среднем" color="#0EA5E9" />
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card icon="🎯" title="LTV по сегментам">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Сегмент</th><th style={{ textAlign: 'right' }}>Клиентов</th><th style={{ textAlign: 'right' }}>Средний LTV</th><th style={{ textAlign: 'right' }}>Всего</th></tr></thead>
                  <tbody>
                    {['vip', 'regular', 'sleeping', 'lost', 'new'].filter(s => data.by_segment.find(x => x.segment === s)).map(s => {
                      const seg = data.by_segment.find(x => x.segment === s);
                      return (
                        <tr key={s}>
                          <td><Badge tone={SEG_TONE[s]}>{SEG_RU[s]}</Badge></td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(seg.count)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(seg.avg_ltv)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoneyFull(seg.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
                Медианный LTV: <strong className="mono">{fmtMoneyFull(data.median_ltv)} сум</strong> · всего клиентов: {fmtNum(data.customers_total)}
              </div>
            </Card>

            <Card icon="🏆" title="Топ клиентов по LTV">
              {data.top_customers.length === 0 ? (
                <EmptyState icon="👤" title="Нет данных" />
              ) : (
                <div className="list">
                  {data.top_customers.map((c, i) => (
                    <div key={c.id} className="list-item">
                      <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: i < 3 ? 'var(--orange)' : 'var(--text3)' }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="list-item-title">{c.name}</div>
                        <div className="list-item-sub">{fmtNum(c.orders)} заказов · {lastBuy(c.last_at)} · {SEG_RU[c.segment]}</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{fmtMoneyFull(c.ltv)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ LTV = сумма всех покупок клиента за всё время. Удержать существующего клиента дешевле,
            чем привлечь нового — растите повторные покупки через лояльность и сервис.
          </div>
        </>
      )}
    </>
  );
}
