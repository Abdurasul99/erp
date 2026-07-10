import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const SEG_TONE = {
  champions: 'orange', loyal: 'green', potential_loyal: 'green', new: 'blue',
  promising: 'blue', need_attention: 'yellow', about_to_sleep: 'yellow',
  at_risk: 'red', cant_lose: 'red', hibernating: 'purple', lost: 'red',
};
const CHANNEL_LABEL = { sms: 'SMS', telegram: 'Telegram', whatsapp: 'WhatsApp', email: 'Email' };

function daysLabel(tt, d) {
  if (d === 0) return tt('сегодня');
  if (d === 1) return tt('завтра');
  return d + ' ' + tt('дн');
}

export default function BirthdaysTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [days, setDays] = useState(7);
  const [period, setPeriod] = useState('month');
  const [channel, setChannel] = useState('sms');

  const [bd, setBd] = useState(null);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(null); // customer_id в процессе отправки
  const [redeeming, setRedeeming] = useState(null); // customer_id в процессе отметки «использован»

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = {}; if (branchId) p.branch_id = branchId;
    Promise.all([
      api.get('/crm/birthdays', { params: { ...p, days } }),
      api.get('/crm/events', { params: { ...p, period } }),
    ])
      .then(([b, e]) => { setBd(b.data); setEvents(e.data); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, days, period]);

  useEffect(() => { load(); }, [load]);

  const sendGreeting = (customerId) => {
    setSending(customerId);
    api.post(`/crm/birthdays/${customerId}/send-greeting`, { channel })
      .then(() => load())
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSending(null));
  };

  const redeemGreeting = (customerId) => {
    setRedeeming(customerId);
    api.post(`/crm/birthdays/${customerId}/redeem`, {})
      .then(() => load())
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setRedeeming(null));
  };

  const dayOpts = [7, 14, 30].map(d => ({ value: d, label: d + ' ' + tt('дн') }));
  const periodOpts = [
    { value: 'day', label: tt('День') },
    { value: 'week', label: tt('Неделя') },
    { value: 'month', label: tt('Месяц') },
    { value: 'year', label: tt('Год') },
  ];

  const list = bd?.birthdays || [];

  return (
    <>
      <PageHeader
        title={tt('🎂 Дни рождения и события')}
        sub={tt('Ближайшие ДР · поздравления с промокодом · конверсия и выручка')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card style={{ marginBottom: 14 }}><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading && !bd ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : (
        <>
          {/* Сводка по событиям за период */}
          <Card icon="📊" title={tt('Сводка событий')}
            actions={<Pills value={period} onChange={setPeriod} options={periodOpts} />}
            style={{ marginBottom: 16 }}>
            <div className="grid-4">
              <Tile icon="🎂" label={tt('Событий за период')} value={fmtNum(events?.upcoming || 0)} color="#EC4899" />
              <Tile icon="📨" label={tt('Отправлено')} value={fmtNum(events?.sent || 0)} color="#1D4ED8" />
              <Tile icon="✅" label={tt('Использовано')} value={fmtNum(events?.used || 0)}
                sub={`${tt('конверсия')} ${events?.conversion || 0}%`} color="#16A34A" />
              <Tile icon="💰" label={tt('Выручка с промо')} value={fmtMoneyFull(events?.revenue || 0)} color="#D97706" />
            </div>
            {(events?.by_type?.length > 0) && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {events.by_type.map(t => (
                  <Badge key={t.event_type} tone="blue">
                    {t.event_type}: {t.sent} {tt('отпр.')} · {t.used} {tt('исп.')}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {/* Канал отправки + окно */}
          <Card icon="⚙️" title={tt('Параметры поздравления')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>{tt('Окно ближайших ДР')}</div>
                <Pills value={days} onChange={setDays} options={dayOpts} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>{tt('Канал')}</div>
                <Pills value={channel} onChange={setChannel}
                  options={(bd?.channels || ['sms', 'telegram', 'whatsapp', 'email']).map(c => ({ value: c, label: CHANNEL_LABEL[c] || c }))} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              {tt('Скидка зависит от RFM-сегмента: Чемпионы 25% · Лояльные 20% · Новички 10% · В зоне риска / Спящие 25% (возврат) · остальные 15%. Промокод: BD + ID клиента + год. Отправка только записывается (без реальной SMS).')}
            </div>
          </Card>

          {/* Таблица ближайших ДР */}
          <Card icon="🎂" title={`${tt('Ближайшие дни рождения')} (${list.length})`} style={{ marginBottom: 16 }}>
            {list.length === 0 ? (
              <EmptyState icon="🎂" title={tt('Нет ближайших дней рождения')}
                description={tt('В выбранном окне нет клиентов с заполненной датой рождения. Заполните дату в карточке клиента.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Клиент')}</th>
                      <th>{tt('Телефон')}</th>
                      <th>{tt('Когда')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Возраст')}</th>
                      <th>{tt('Сегмент')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('LTV')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Скидка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Поздравление')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{c.phone || '—'}</td>
                        <td>
                          <Badge tone={c.days_until <= 1 ? 'red' : c.days_until <= 3 ? 'yellow' : 'blue'}>
                            {daysLabel(tt, c.days_until)}
                          </Badge>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.turning_age != null ? c.turning_age : '—'}</td>
                        <td>
                          {c.segment
                            ? <Badge tone={SEG_TONE[c.segment] || 'blue'}>{c.segment_label || c.segment}</Badge>
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(c.ltv)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: '#16A34A' }}>{c.suggested_discount}%</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.greeted ? (
                            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <Badge tone={c.greeting?.used ? 'green' : 'blue'}>
                                {c.greeting?.used ? tt('использован') : tt('отправлено')}
                              </Badge>
                              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{c.greeting?.promo_code}</span>
                              {!c.greeting?.used && (
                                <button className="btn btn-ghost btn-sm" disabled={redeeming === c.id}
                                  onClick={() => redeemGreeting(c.id)} style={{ marginTop: 2 }}>
                                  {redeeming === c.id ? tt('...') : `✓ ${tt('Использован')}`}
                                </button>
                              )}
                            </span>
                          ) : (
                            <button className="btn btn-primary btn-sm" disabled={sending === c.id}
                              onClick={() => sendGreeting(c.id)}>
                              {sending === c.id ? tt('...') : `🎁 ${tt('Поздравить')}`}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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