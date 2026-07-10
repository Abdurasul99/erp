import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills, EmptyState } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Рассылки клиентам — Telegram Bot + SMS / push уведомления.
// KPI: отправлено · % прочтения · вернувшиеся клиенты · доп. выручка.
// История кампаний + форма создания (сегмент / сообщение / канал).

const SEGMENTS = [
  { value: 'all',      label: 'Все клиенты' },
  { value: 'vip',      label: 'VIP' },
  { value: 'sleeping', label: 'Спящие (60+ дней)' },
  { value: 'new',      label: 'Новые' },
];

const CHANNELS = [
  { value: 'telegram', label: 'Telegram Bot' },
  { value: 'sms',      label: 'SMS' },
  { value: 'push',     label: 'Push' },
];

const segLabel = (v) => (SEGMENTS.find(s => s.value === v) || {}).label || v;
const chanLabel = (v) => (CHANNELS.find(c => c.value === v) || {}).label || v;

export default function CustomerCampaignsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // форма
  const [segment, setSegment] = useState('all');
  const [channel, setChannel] = useState('telegram');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/campaigns', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId]);

  const stats = data?.stats || {};
  const campaigns = data?.campaigns || [];
  const audience = data?.audience || 0;

  const readRate = stats.sent_count > 0
    ? Math.round((stats.read_count / stats.sent_count) * 1000) / 10 : 0;

  const submit = (e) => {
    e.preventDefault();
    if (!message.trim()) { setFormErr(tt('Введите текст сообщения')); return; }
    setSaving(true); setFormErr(null);
    api.post('/marketing/campaigns', { segment, channel, message: message.trim() })
      .then(() => { setMessage(''); load(); })
      .catch(e => setFormErr(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <PageHeader
        title={tt('📣 Рассылки клиентам')}
        sub={tt('Telegram Bot · SMS · push — сегментные уведомления и возврат клиентов')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📤" label={tt('Отправлено')} value={fmtNum(stats.sent_count || 0)} sub={tt('уведомлений')} color="var(--primary)" />
            <Tile icon="👁" label={tt('Прочитано')} value={`${readRate}%`} sub={`${fmtNum(stats.read_count || 0)} ${tt('клиентов')}`} color="#16A34A" />
            <Tile icon="🔁" label={tt('Вернулись')} value={fmtNum(stats.returned || 0)} sub={tt('клиентов')} color="#1D4ED8" />
            <Tile icon="💰" label={tt('Доп. выручка')} value={fmtMoneyFull(stats.revenue || 0)} sub="UZS" color="#D97706" />
          </div>

          <Card icon="✍️" title={tt('Новая рассылка')} style={{ marginBottom: 16 }}>
            <form onSubmit={submit}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Сегмент')}</div>
                  <Pills value={segment} onChange={setSegment} options={SEGMENTS.map(s => ({ ...s, label: tt(s.label) }))} label="Сегмент" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Канал')}</div>
                  <Pills value={channel} onChange={setChannel} options={CHANNELS.map(c => ({ ...c, label: tt(c.label) }))} label="Канал" />
                </div>
              </div>
              <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                {tt('Сообщение')} · {tt('аудитория')}: <span className="mono" style={{ color: 'var(--primary)', fontWeight: 800 }}>{fmtNum(audience)}</span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={tt('Например: Скучаем по вам! Дарим −15% на следующий заказ до конца недели.')}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border, #E3EAF3)', resize: 'vertical',
                  fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box',
                }}
              />
              {formErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{formErr}</div>}
              <div style={{ marginTop: 12 }}>
                <button type="submit" disabled={saving} style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  padding: '10px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? tt('Отправка...') : tt('Отправить рассылку')}
                </button>
              </div>
            </form>
          </Card>

          <Card icon="📋" title={`${tt('История рассылок')} (${campaigns.length})`}>
            {campaigns.length === 0 ? (
              <EmptyState icon="📭" title={tt('Пока нет рассылок')} description={tt('Создайте первую рассылку выше — статистика появится здесь.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата')}</th>
                      <th>{tt('Сегмент')}</th>
                      <th>{tt('Канал')}</th>
                      <th>{tt('Сообщение')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Отправлено')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прочитано')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => {
                      const rr = c.sent_count > 0 ? Math.round((c.read_count / c.sent_count) * 100) : 0;
                      return (
                        <tr key={c.id}>
                          <td className="mono" style={{ whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : '—'}
                          </td>
                          <td><Badge tone="blue">{tt(segLabel(c.segment))}</Badge></td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(chanLabel(c.channel))}</td>
                          <td style={{ maxWidth: 320, fontSize: 12.5 }}>{c.message}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(c.sent_count)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: rr >= 50 ? '#16A34A' : 'var(--text2)' }}>{rr}%</td>
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
