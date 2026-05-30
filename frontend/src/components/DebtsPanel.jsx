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

// Reusable panel that lists unpaid items and lets you record a payment.
// Props:
//   mode  — 'customer' (we are owed) | 'supplier' (we owe)
//   id    — customer or supplier id; if null → list across all (only customer mode)
//   inline — render inline (no card wrapper) vs full page
export default function DebtsPanel({ mode = 'customer', id = null, inline = false }) {
  const { t } = useTranslation();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');
  const [msg, setMsg, clearMsg] = useMsg();

  const load = async () => {
    setLoading(true);
    try {
      const url = mode === 'customer'
        ? (id ? `/customers/${id}/history` : '/debts')
        : `/suppliers/${id}/debts`;
      const { data } = await api.get(url);
      // For customer/:id/history we get all outcomes; filter only unpaid
      const filtered = (mode === 'customer' && id)
        ? data.filter(d => d.payment_status && d.payment_status !== 'paid').map(d => ({
            ...d,
            total_amount: parseFloat(d.quantity) * parseFloat(d.price || 0),
            remaining: (parseFloat(d.quantity) * parseFloat(d.price || 0)) - parseFloat(d.paid_amount || 0),
            overdue: d.due_date && new Date(d.due_date) < new Date(),
            product_name: d.product_name,
          }))
        : data;
      setDebts(filtered);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode, id]);

  const totalRemaining = debts.reduce((s, d) => s + parseFloat(d.remaining || 0), 0);
  const overdueCount = debts.filter(d => d.overdue).length;

  const openPay = (d) => {
    setPayTarget(d);
    setPayAmount(String(parseFloat(d.remaining || 0)));
    setPayMethod('cash'); setPayNote(''); setPayErr('');
  };

  const submitPay = async () => {
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setPayErr(t('enterAmount')); return; }
    try {
      const endpoint = mode === 'customer'
        ? `/stock/outcome/${payTarget.id}/pay`
        : `/stock/income/${payTarget.id}/pay`;
      await api.post(endpoint, { amount: amt, payment_method: payMethod, note: payNote });
      setMsg('success', t('successGeneric'));
      setPayTarget(null);
      load();
    } catch (e) { setPayErr(e.response?.data?.error || t('errorGeneric')); }
  };

  return (
    <div style={inline ? {} : { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)' }}>
            {debts.length} {mode === 'customer' ? t('customerDebtsCount') : t('supplierDebtsCount')}
          </span>
          {totalRemaining > 0 && (
            <span className="mono" style={{ fontWeight: 900, color: 'var(--red)' }}>{fmtMoney(totalRemaining)}</span>
          )}
          {overdueCount > 0 && (
            <span style={{ fontSize: '12px', background: 'rgba(220,38,38,.1)', color: 'var(--red)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
              ⏰ {overdueCount}
            </span>
          )}
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm">{t('refresh') || 'Обновить'}</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}<button onClick={clearMsg} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>×</button></div>}

      {loading ? (
        <div className="center" style={{ padding: '30px' }}><div className="spinner" /></div>
      ) : debts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>
          {t('nothingOwed')}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                {!id && mode === 'customer' && <th>Клиент</th>}
                <th>{t('product') || 'Товар'}</th>
                <th>{t('date') || 'Дата'}</th>
                <th style={{ textAlign: 'right' }}>{t('total') || 'Сумма'}</th>
                <th style={{ textAlign: 'right' }}>{t('paid') || 'Оплачено'}</th>
                <th style={{ textAlign: 'right' }}>{t('remaining') || 'Осталось'}</th>
                <th>{t('dueDate') || 'Срок'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {debts.map(d => (
                <tr key={d.id} style={{ background: d.overdue ? 'rgba(220,38,38,.04)' : undefined }}>
                  {!id && mode === 'customer' && (
                    <td>
                      <div style={{ fontWeight: 700 }}>{d.customer_name || '—'}</div>
                      {d.customer_phone && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>📞 {d.customer_phone}</div>}
                    </td>
                  )}
                  <td>{d.product_name} <span style={{ color: 'var(--text3)', fontSize: '12px' }}>× {parseFloat(parseFloat(d.quantity).toFixed(3))} {d.unit}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(d.created_at)}</td>
                  <td style={{ textAlign: 'right' }}><span className="mono">{fmtNum(d.total_amount)}</span></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ color: 'var(--green)' }}>{fmtNum(d.paid_amount)}</span></td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 800, color: 'var(--red)' }}>{fmtNum(d.remaining)}</span></td>
                  <td>
                    {d.due_date
                      ? <span style={{ fontSize: '12px', fontWeight: 700, color: d.overdue ? 'var(--red)' : 'var(--text2)' }}>{d.overdue && '⏰ '}{formatDate(d.due_date)}</span>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => openPay(d)}>
                      {mode === 'customer' ? t('acceptOrder') : t('paySupplier')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment modal */}
      {payTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }} onClick={() => setPayTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>
                💰 {mode === 'customer' ? t('acceptPayment') : t('paySupplierTitle')}
              </div>
              <button onClick={() => setPayTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{payTarget.product_name} × {parseFloat(parseFloat(payTarget.quantity).toFixed(3))} {payTarget.unit}</div>
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
              <button className="btn btn-primary" onClick={submitPay} style={{ flex: 1, justifyContent: 'center' }}>OK</button>
              <button className="btn btn-ghost" onClick={() => setPayTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel') || 'Отмена'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
