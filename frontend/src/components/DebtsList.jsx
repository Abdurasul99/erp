import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { formatDate, fmtMoney, fmtNum, useMsg } from '../utils.js';

const PMETHODS = [
  { key: 'cash',     label: '💵 Наличные' },
  { key: 'card',     label: '💳 Карта' },
  { key: 'transfer', label: '🏦 Перевод' },
  { key: 'wire',     label: '📑 Перечисление' },
];

export default function DebtsList() {
  const { t } = useTranslation();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');
  const [msg, setMsg, clearMsg] = useMsg();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/debts'); setDebts(data); }
    catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = debts.filter(d => {
    if (overdueOnly && !d.overdue) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.customer_name || '').toLowerCase().includes(q)
        || (d.customer_phone || '').includes(search)
        || (d.product_name || '').toLowerCase().includes(q);
  });

  const totalRemaining = filtered.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);
  const overdueCount   = filtered.filter(d => d.overdue).length;

  const openPay = (d) => {
    setPayTarget(d);
    setPayAmount(String(parseFloat(d.remaining || 0)));
    setPayMethod('cash');
    setPayNote('');
    setPayErr('');
  };

  const submitPay = async () => {
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setPayErr('Введите сумму > 0'); return; }
    try {
      await api.post(`/stock/outcome/${payTarget.id}/pay`, { amount: amt, payment_method: payMethod, note: payNote });
      setMsg('success', t('success') || 'Оплата принята');
      setPayTarget(null);
      load();
    } catch (e) { setPayErr(e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 0 }}>
      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--orange)' }}>
          <div className="stat-label">{t('debts') || 'Долги'}</div>
          <div className="stat-value mono" style={{ color: 'var(--orange)' }}>{filtered.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--red)' }}>
          <div className="stat-label">{t('overdue') || 'Просрочено'}</div>
          <div className="stat-value mono" style={{ color: 'var(--red)' }}>{overdueCount}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-label">{t('totalDebt') || 'Сумма долга'}</div>
          <div className="stat-value mono" style={{ color: 'var(--primary)', fontSize: '20px' }}>{fmtMoney(totalRemaining)}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0, marginRight: 'auto' }}>📒 {t('debts') || 'Долги'}</div>
          <input className="input" style={{ width: '220px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`🔍 ${t('search') || 'Поиск'}`} />
          <button className={`btn btn-sm ${overdueOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOverdueOnly(v => !v)}>
            {overdueOnly ? '⏰ ' : ''}{t('overdueOnly') || 'Просроченные'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh') || 'Обновить'}</button>
        </div>

        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}<button onClick={clearMsg} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button></div>}

        {loading ? (
          <div className="center" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : (
          <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('customer') || 'Клиент'}</th>
                  <th>{t('product') || 'Товар'}</th>
                  <th>{t('branch') || 'Филиал'}</th>
                  <th>{t('date') || 'Дата'}</th>
                  <th style={{ textAlign: 'right' }}>{t('total') || 'Сумма'}</th>
                  <th style={{ textAlign: 'right' }}>{t('paid') || 'Оплачено'}</th>
                  <th style={{ textAlign: 'right' }}>{t('remaining') || 'Осталось'}</th>
                  <th>{t('dueDate') || 'Срок'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData') || 'Нет данных'}</td></tr>
                )}
                {filtered.map(d => (
                  <tr key={d.id} style={{ background: d.overdue ? 'rgba(220,38,38,.04)' : undefined }}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{d.customer_name || '—'}</div>
                      {d.customer_phone && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>📞 {d.customer_phone}</div>}
                    </td>
                    <td>{d.product_name} <span style={{ color: 'var(--text3)', fontSize: '12px' }}>× {parseFloat(parseFloat(d.quantity).toFixed(3)).toString()} {d.unit}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{d.branch_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(d.created_at)}</td>
                    <td style={{ textAlign: 'right' }}><span className="mono">{fmtNum(d.total_amount)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono" style={{ color: 'var(--green)' }}>{fmtNum(d.paid_amount)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>{fmtNum(d.remaining)}</span></td>
                    <td>
                      {d.due_date ? (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: d.overdue ? 'var(--red)' : 'var(--text2)' }}>
                          {d.overdue && '⏰ '}{formatDate(d.due_date)}
                        </span>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => openPay(d)}>{t('acceptPayment') || 'Принять'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment modal */}
      {payTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setPayTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>💰 {t('acceptPayment') || 'Принять оплату'}</div>
              <button onClick={() => setPayTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1B2E', marginBottom: '4px' }}>{payTarget.customer_name || '—'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{payTarget.product_name} × {parseFloat(parseFloat(payTarget.quantity).toFixed(3)).toString()} {payTarget.unit}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text3)' }}>Осталось:</span>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>{fmtNum(payTarget.remaining)} UZS</span>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{t('amount') || 'Сумма'} (UZS)</label>
              <input autoFocus className="input" type="number" min="0" step="any" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{t('paymentMethod') || 'Способ оплаты'}</label>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {PMETHODS.map(o => (
                  <button key={o.key} type="button" onClick={() => setPayMethod(o.key)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${payMethod === o.key ? '#4338ca' : '#E2E4F0'}`,
                      background: payMethod === o.key ? 'rgba(67,56,202,.08)' : '#fff',
                      color: payMethod === o.key ? '#4338ca' : '#6B6F8A',
                      cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                    }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('note') || 'Примечание'}</label>
              <input className="input" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="..." />
            </div>
            {payErr && <div className="alert alert-error">{payErr}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={submitPay} style={{ flex: 1, justifyContent: 'center' }}>{t('accept') || 'Принять'}</button>
              <button className="btn btn-ghost" onClick={() => setPayTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel') || 'Отмена'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
