import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

// Статусы заказа поставщику → значок + цвет + русская подпись.
const STATUS_META = {
  draft:     { icon: '📝', label: 'Черновик',    color: '#64748B' },
  confirmed: { icon: '✅', label: 'Подтверждён', color: '#16A34A' },
  in_transit:{ icon: '🚚', label: 'В пути',      color: '#1D4ED8' },
  received:  { icon: '📦', label: 'Принят',       color: '#0EA5E9' },
  cancelled: { icon: '🚫', label: 'Отменён',     color: '#DC2626' },
};

const TABS = [
  { value: 'all',        label: 'Все' },
  { value: 'draft',      label: 'Черновики' },
  { value: 'confirmed',  label: 'Подтверждённые' },
  { value: 'in_transit', label: 'В пути' },
  { value: 'received',   label: 'Принятые' },
];

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
};

export default function ProcurementOrdersTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/orders', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId]);

  const openOrder = (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setDetailLoading(true);
    api.get(`/procurement/orders/${id}`)
      .then(r => setDetail(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setDetailLoading(false));
  };

  const kpi = data?.kpi || {};
  const orders = data?.orders || [];
  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  const nextDelivery = kpi.next_delivery; // { expected_at, supplier, days }

  return (
    <>
      <PageHeader
        title={tt('🛒 Заказ поставщику')}
        sub={tt('Закупки · заказы поставщикам · сроки поставки')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📋" label={tt('Активных заказов')} value={fmtNum(kpi.active_count || 0)} sub={tt('в пути или формируются')} color="#1D4ED8" />
            <Tile icon="💰" label={tt('Сумма активных')} value={fmtMoneyFull(kpi.active_amount || 0)} sub={tt('сум')} color="#16A34A" />
            <Tile
              icon="🚚"
              label={tt('Ближайшая поставка')}
              value={nextDelivery?.expected_at ? fmtDate(new Date(nextDelivery.expected_at), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang) : '—'}
              sub={nextDelivery?.expected_at ? `${nextDelivery.supplier || ''}${nextDelivery.days != null ? ' · ' + tt('через') + ' ' + nextDelivery.days + ' ' + tt('дн.') : ''}` : tt('нет активных')}
              color="#0EA5E9"
            />
            <Tile icon="⚠️" label={tt('Просрочены')} value={fmtNum(kpi.overdue_count || 0)} sub={tt('требует звонка')} color="#DC2626" />
          </div>

          <Card
            icon="📦"
            title={`${tt('Все заказы · клик для деталей')} (${filtered.length})`}
            actions={<Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />}
          >
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('№ заказа')}</th>
                    <th>{tt('Дата заказа')}</th>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Позиций')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                    <th>{tt('Дата поставки')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет заказов')}</td></tr>
                  ) : filtered.map(o => {
                    const meta = STATUS_META[o.status] || { icon: '•', label: o.status, color: 'var(--text2)' };
                    const dl = daysLeft(o.expected_at);
                    const isOpen = openId === o.id;
                    return (
                      <React.Fragment key={o.id}>
                        <tr onClick={() => openOrder(o.id)} style={{ cursor: 'pointer', background: isOpen ? 'rgba(29,78,216,.06)' : undefined }}>
                          <td style={{ fontWeight: 800 }}>{o.number || `ЗП-${o.id}`}</td>
                          <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{o.created_at ? fmtDate(new Date(o.created_at), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang) : '—'}</td>
                          <td style={{ fontWeight: 700 }}>{o.supplier_name || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(o.items_count || 0)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(o.total_amount)}</td>
                          <td className="mono" style={{ fontSize: 12 }}>
                            {o.expected_at ? fmtDate(new Date(o.expected_at), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang) : '—'}
                            {dl != null && o.status !== 'received' && o.status !== 'cancelled' && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: dl < 0 ? 'var(--red)' : 'var(--text3)' }}>
                                {dl < 0 ? `${tt('просрочено')} ${Math.abs(dl)} ${tt('дн.')}` : `${tt('через')} ${dl} ${tt('дн.')}`}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
                              {meta.icon} {tt(meta.label)}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={7} style={{ background: 'var(--bg2, #F7F9FC)', padding: 0 }}>
                              {detailLoading ? (
                                <div style={{ padding: 20, color: 'var(--text3)' }}>{tt('Загрузка...')}</div>
                              ) : detail ? (
                                <div style={{ padding: '14px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                  <div style={{ flex: '2 1 360px', minWidth: 320 }}>
                                    <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13 }}>{tt('Позиции заказа')}</div>
                                    <table>
                                      <thead>
                                        <tr>
                                          <th>{tt('Товар')}</th>
                                          <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                                          <th style={{ textAlign: 'right' }}>{tt('Цена/шт')}</th>
                                          <th style={{ textAlign: 'right' }}>{tt('Итого')}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(detail.items || []).length === 0 ? (
                                          <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 16 }}>{tt('Нет позиций')}</td></tr>
                                        ) : detail.items.map(it => (
                                          <tr key={it.id}>
                                            <td style={{ fontWeight: 700 }}>{it.product_name || '—'}</td>
                                            <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.qty)}</td>
                                            <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(it.price)}</td>
                                            <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div style={{ flex: '1 1 240px', minWidth: 220 }}>
                                    <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13 }}>{tt('⏱️ Хронология')}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {(detail.timeline || []).length === 0 ? (
                                        <div style={{ color: 'var(--text3)', fontSize: 12 }}>{tt('Нет событий')}</div>
                                      ) : detail.timeline.map((ev, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8 }}>
                                          <div style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                                          <div>
                                            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{tt(ev.label) || ev.label}</div>
                                            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{ev.at ? fmtDate(new Date(ev.at), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang) : ''}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 20, color: 'var(--text3)' }}>{tt('Не удалось загрузить детали')}</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
