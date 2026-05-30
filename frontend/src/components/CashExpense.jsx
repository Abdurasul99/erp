import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { formatDate, formatTime, useMsg, filterByPeriod, fmtMoney } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import CategoryCombobox from './CategoryCombobox.jsx';
import PeriodFilter from './PeriodFilter.jsx';
import CurrencyAmountInput from './CurrencyAmountInput.jsx';

export default function CashExpense() {
  const { t, lang } = useTranslation();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ description: '', payment_method: 'cash' });
  const [currencyAmount, setCurrencyAmount] = useState({ currency: 'UZS', original_amount: '', exchange_rate: '', amountUZS: 0 });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { const { data } = await api.get('/cash/balance'); setData(data); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currencyAmount.amountUZS || currencyAmount.amountUZS <= 0) { setMsg('error', t('error')); return; }
    setLoading(true);
    try {
      await api.post('/cash/expense', {
        currency: currencyAmount.currency,
        original_amount: currencyAmount.original_amount,
        exchange_rate: currencyAmount.exchange_rate,
        payment_method: form.payment_method,
        description: form.description,
      });
      setMsg('success', t('success'));
      setForm({ description: '', payment_method: 'cash' });
      setCurrencyAmount({ currency: 'UZS', original_amount: '', exchange_rate: '', amountUZS: 0 });
      load();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
    setLoading(false);
  };

  const list = data?.expense_list || [];
  const todaySum = list.filter(i => new Date(i.created_at).toDateString() === new Date().toDateString()).reduce((s, i) => s + parseFloat(i.amount), 0);
  const historyFiltered = filterByPeriod(list, period, customRange).filter(i =>
    !historySearch || (i.description || '').toLowerCase().includes(historySearch.toLowerCase())
  );
  const periodSum = historyFiltered.reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="grid-2" style={{ flex: 1, minHeight: 0, height: '100%', alignItems: 'stretch' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div className="section-title">{t('cashExpense')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('todayExpense')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)' }}>−{fmtMoney(todaySum)}</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalExpense')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)' }}>−{fmtMoney(data?.total_expense || 0)}</div>
          </div>
        </div>
        {msg && <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{msg.text}</span><button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button></div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <CurrencyAmountInput value={currencyAmount} onChange={setCurrencyAmount} required />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="label">{lang === 'uz' ? 'Toʻlov usuli' : 'Способ оплаты'}</label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { key: 'cash',     label: '💵 ' + (lang === 'uz' ? 'Naqd' : 'Нал') },
                { key: 'card',     label: '💳 ' + (lang === 'uz' ? 'Karta' : 'Карта') },
                { key: 'transfer', label: '🏦 ' + (lang === 'uz' ? 'O\'tkazma' : 'Перевод') },
                { key: 'wire',     label: '📑 ' + (lang === 'uz' ? 'Hisobga oʻtkazish' : 'Перечисление') },
              ].map(o => (
                <button key={o.key} type="button" onClick={() => setForm({ ...form, payment_method: o.key })}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${form.payment_method === o.key ? '#dc2626' : '#E2E4F0'}`,
                    background: form.payment_method === o.key ? 'rgba(220,38,38,.08)' : '#fff',
                    color: form.payment_method === o.key ? '#dc2626' : '#6B6F8A',
                    cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                  }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="label">{t('description')}</label>
            <CategoryCombobox
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              type="expense"
              placeholder={t('expensePlaceholder')}
            />
          </div>
          <button type="submit" className="btn btn-danger" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>{loading ? t('loading') : t('addExpense')}</button>
        </form>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{t('expenseList')}</div>
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh')}</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
          <input className="input" style={{ flex: 1, minWidth: '160px', padding: '7px 12px', fontSize: '13px' }}
            value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder={`🔍 ${t('description')}`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: 'rgba(67,56,202,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSales')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#4338ca' }}>{historyFiltered.length}</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSum')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--red)' }}>−{fmtMoney(periodSum)}</div>
          </div>
        </div>
        <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
          <table>
            <thead><tr><th>{t('amount')}</th><th>{t('description')}</th><th>{t('date')}</th></tr></thead>
            <tbody>
              {historyFiltered.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{t('noData')}</td></tr>}
              {historyFiltered.map(item => (
                <tr key={item.id}>
                  <td><span className="mono" style={{ fontWeight: 700, color: 'var(--red)' }}>−{fmtMoney(item.amount)}</span></td>
                  <td style={{ fontSize: '13px' }}>{item.description || '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatDate(item.created_at)}<br /><span style={{ color: 'var(--text3)' }}>{formatTime(item.created_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
