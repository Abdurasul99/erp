import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';

const CH_OPTIONS = [
  { value: 'instagram', label: '📷 Instagram' },
  { value: 'telegram', label: '✈️ Telegram' },
  { value: 'referral', label: '🤝 Сарафан' },
  { value: 'ads', label: '📣 Реклама' },
  { value: 'walk_in', label: '🚶 Прохожий' },
  { value: 'marketplace', label: '🛒 Маркетплейс' },
  { value: 'other', label: '📌 Другое' },
];

export default function ChannelsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spendForm, setSpendForm] = useState({ channel: 'instagram', month: new Date().toISOString().slice(0, 7), amount: '' });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    try { const r = await api.get('/marketing/channels', { params }); setData(r.data); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [branchId]);

  const channels = data?.channels || [];
  const spendRows = data?.spend_rows || [];
  const totalRevenue = channels.reduce((a, c) => a + c.revenue, 0);
  const totalSpend = channels.reduce((a, c) => a + c.spend, 0);
  const totalBuyers = channels.reduce((a, c) => a + c.buyers, 0);
  const best = channels.filter(c => c.roi != null).sort((a, b) => b.roi - a.roi)[0];
  const hasAnySource = channels.some(c => c.channel !== 'unknown' && c.customers > 0);

  const saveSpend = async () => {
    if (!spendForm.amount) return;
    setSaving(true);
    try { await api.post('/marketing/channel-spend', spendForm); setSpendForm({ ...spendForm, amount: '' }); await reload(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    setSaving(false);
  };
  const delSpend = async (id) => { try { await api.delete('/marketing/channel-spend/' + id); await reload(); } catch (e) { setError(e.response?.data?.error || e.message); } };

  return (
    <>
      <PageHeader title={tt('📡 Каналы и ROI')} sub={tt('Откуда приходят клиенты · ROI каждого канала · LTV по источнику')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasAnySource ? (
        <Card>
          <EmptyState icon="🧭" title={tt('Источник клиентов не заполнен')}
            description={tt('Чтобы видеть какой канал приносит деньги — указывайте «Откуда пришёл клиент» при создании клиента (раздел «Клиенты»). Как появятся источники — здесь будет ROI каждого канала.')} />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏆" label={tt('Лучший канал')} value={best ? (tt(best.label)) : '—'} sub={best ? `ROI ${best.roi}x` : tt('добавьте расходы')} color="#16A34A" />
            <Tile icon="💰" label={tt('Выручка с каналов')} value={fmtMoneyFull(totalRevenue)} sub={tt('сум · всё время')} color="#1D4ED8" />
            <Tile icon="📣" label={tt('Всего на рекламу')} value={fmtMoneyFull(totalSpend)} sub={tt('сум · введено')} color="#D97706" />
            <Tile icon="🎯" label={tt('Общий ROI')} value={totalSpend > 0 ? (Math.round((totalRevenue / totalSpend) * 100) / 100) + 'x' : '—'} sub={`${fmtNum(totalBuyers)} ${tt('покупателей')}`} color="#0EA5E9" />
          </div>

          <Card icon="📊" title={tt('Каналы привлечения')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Канал')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Клиентов')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Купили')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний LTV')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Повторные')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Расход')}</th>
                    <th style={{ textAlign: 'right' }}>ROI</th>
                    <th style={{ textAlign: 'right' }}>CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map(c => (
                    <tr key={c.channel}>
                      <td style={{ fontWeight: 700 }}>{c.label}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.customers)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(c.buyers)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(c.revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(c.avg_ltv)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{c.repeat_rate}%</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{c.spend > 0 ? fmtMoneyFull(c.spend) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{c.roi != null ? <Badge tone={c.roi >= 2 ? 'green' : c.roi >= 1 ? 'yellow' : 'red'}>{c.roi}x</Badge> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{c.cac != null ? fmtMoneyFull(c.cac) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ROI = выручка с канала ÷ расход на него. CAC = расход ÷ кол-во покупателей. Чтобы посчитать ROI — внесите расходы ниже.')}
            </div>
          </Card>

          <Card icon="💸" title={tt('Расходы на каналы (для ROI)')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <label className="label">{tt('Канал')}</label>
                <select className="input" value={spendForm.channel} onChange={e => setSpendForm({ ...spendForm, channel: e.target.value })}>
                  {CH_OPTIONS.map(o => <option key={o.value} value={o.value}>{tt(o.label)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{tt('Месяц')}</label>
                <input className="input" type="month" value={spendForm.month} onChange={e => setSpendForm({ ...spendForm, month: e.target.value })} />
              </div>
              <div>
                <label className="label">{tt('Расход (сум)')}</label>
                <input className="input" type="number" min="0" value={spendForm.amount} onChange={e => setSpendForm({ ...spendForm, amount: e.target.value })} placeholder="0" />
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveSpend} disabled={saving || !spendForm.amount}>{saving ? '...' : '💾 ' + tt('Сохранить')}</button>
            </div>
            {spendRows.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>{tt('Канал')}</th><th>{tt('Месяц')}</th><th style={{ textAlign: 'right' }}>{tt('Расход')}</th><th></th></tr></thead>
                  <tbody>
                    {spendRows.map(s => (
                      <tr key={s.id}>
                        <td>{tt((CH_OPTIONS.find(o => o.value === s.channel)?.label) || s.channel)}</td>
                        <td className="mono">{s.month}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(s.amount)} {tt('сум')}</td>
                        <td style={{ textAlign: 'right' }}><button className="action-btn action-btn-del" onClick={() => delSpend(s.id)} title={tt('Удалить')}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <AiAnalyze topic="channels" branchId={branchId} />
        </>
      )}
    </>
  );
}
