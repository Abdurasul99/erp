import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { formatDate, formatTime, useMsg, filterByPeriod, fmtMoney } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import CategoryCombobox from './CategoryCombobox.jsx';
import PeriodFilter from './PeriodFilter.jsx';
import CurrencyAmountInput from './CurrencyAmountInput.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

// ── Сумма «Принято» вводится ТЕКСТОМ ─────────────────────────────────────────
// У <input type="number"> Chrome отдаёт e.target.value === '' на промежуточно
// невалидном вводе («2 500 000», «12,5»): поле само себя очищало, а расчёт
// уходил «пустым» — с подстановкой ожидаемой суммы из placeholder, поэтому
// кассир был уверен, что ввёл свою. type="text" + inputMode="decimal".
// В onChange — только чистка символов, нормализация — в onBlur.
const cleanMoney = (s) => String(s ?? '')
  .replace(/[^\d.,\s\u00A0]/g, '')
  .replace(/[\s\u00A0]+/g, ' ');
const toNum = (s) => {
  // \u0420\u0430\u0437\u0431\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 \u043E\u0431\u0449\u0438\u0439 normalizeDecimal: \u00AB1.500.000\u00BB \u0438 \u00AB1,500,000\u00BB \u2014 \u044D\u0442\u043E \u0440\u0430\u0437\u0440\u044F\u0434\u044B
  // \u0442\u044B\u0441\u044F\u0447, \u0430 \u043D\u0435 \u0434\u0440\u043E\u0431\u044C. \u0417\u0430\u043C\u0435\u043D\u0430 \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u043F\u044F\u0442\u043E\u0439 \u043D\u0430 \u0442\u043E\u0447\u043A\u0443 \u0434\u0430\u0432\u0430\u043B\u0430
  // parseFloat('1.500.000') = 1.5 \u2014 \u043F\u043E\u043B\u0442\u043E\u0440\u0430 \u043C\u0438\u043B\u043B\u0438\u043E\u043D\u0430 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0438\u0441\u044C \u043F\u043E\u043B\u0443\u0442\u043E\u0440\u0430 \u0441\u0443\u043C\u0430\u043C\u0438.
  const raw = normalizeDecimal(s);
  if (!raw || raw === '.') return NaN;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};
const normMoney = (s) => {
  const n = toNum(s);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
};

// Inline helpers for the detail modal
function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #F4F5FA' }}>
      <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: '13px', color: valueColor || 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
const methodLabel = (m) => ({
  cash: '💵 Наличные', card: '💳 Карта', transfer: '🏦 Перевод', wire: '📑 Перечисление',
  click: 'Click', payme: 'Payme', // legacy values still readable in history
}[m] || m || '—');

export default function CashIncome() {
  const { t, lang } = useTranslation();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ description: '', payment_method: 'cash' });
  const [currencyAmount, setCurrencyAmount] = useState({ currency: 'UZS', original_amount: '', exchange_rate: '', amountUZS: 0 });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [historySearch, setHistorySearch] = useState('');
  const [pendingSellers, setPendingSellers] = useState([]);
  const [pendingSales, setPendingSales] = useState([]); // per-sale unsettled list
  const [activeSettlement, setActiveSettlement] = useState(null); // {seller, received}
  const [settlementMsg, setSettlementMsg] = useState(null);
  const [detailItem, setDetailItem] = useState(null); // clicked history row
  const [rightView, setRightView] = useState('settlement'); // 'settlement' | 'history' | 'edit-requests'
  const [editReqs, setEditReqs] = useState([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const { data } = await api.get('/cash/balance'); setData(data);
    try { const r = await api.get('/cash/settlement/pending'); setPendingSellers(r.data); } catch {}
    try { const r = await api.get('/cash/settlement/sales');   setPendingSales(r.data); } catch {}
    try { const r = await api.get('/stock/outcome/edit-requests'); setEditReqs(r.data); } catch {}
  };

  const reviewEditReq = async (id, action) => {
    try {
      await api.post(`/stock/outcome/edit-requests/${id}/${action}`, {});
      await load();
    } catch (e) { alert(e.response?.data?.error || 'Ошибка'); }
  };

  const refreshSettlement = async () => {
    try { const r = await api.get('/cash/settlement/pending'); setPendingSellers(r.data); } catch {}
    try { const r = await api.get('/cash/settlement/sales');   setPendingSales(r.data); } catch {}
    setActiveSettlement(null); setSettlementMsg(null);
  };

  // Per-sale accept (one click confirms exact expected amount)
  const acceptOneSale = async (cashId) => {
    try {
      await api.post('/cash/settlement/accept-one', { cash_id: cashId });
      setSettlementMsg({ type: 'success', text: '✓' });
      setTimeout(() => { setSettlementMsg(null); load(); }, 800);
    } catch (e) { setSettlementMsg({ type: 'error', text: e.response?.data?.error || 'Ошибка' }); }
  };

  // One-click full acceptance — uses the expected amount as received (zero discrepancy)
  const quickAccept = async (sellerObj) => {
    try {
      const r = await api.post('/cash/settlement/accept', {
        seller_id: sellerObj.seller_id,
        received_amount: sellerObj.total_amount,
      });
      const d = r.data;
      setSettlementMsg({ type: 'success', text: `✓ ${d.count} · ${fmtMoney(d.expected)}` });
      setTimeout(() => { setSettlementMsg(null); load(); refreshSettlement(); }, 1200);
    } catch (e) { setSettlementMsg({ type: 'error', text: e.response?.data?.error || t('error') }); }
  };

  // Что реально уйдёт на сервер как received_amount. Пустое поле — это по-прежнему
  // «принял ровно ожидаемую сумму» (она в placeholder), но НИКОГДА не строка и не
  // NaN: сервер делает parseFloat, и «2 500 000» превратилось бы в 2 — с фиктивной
  // недостачей в кассе. Мусор в поле → NaN → кнопка подтверждения заблокирована.
  const settleReceived = () => {
    if (!activeSettlement) return NaN;
    const expected = parseFloat(activeSettlement.singleSale
      ? activeSettlement.singleSale.amount
      : activeSettlement.seller?.total_amount);
    const txt = String(activeSettlement.received ?? '');
    if (!txt.trim()) return Number.isFinite(expected) ? expected : NaN;
    const n = toNum(txt);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  const setReceived = (raw) => setActiveSettlement(a => (a ? { ...a, received: cleanMoney(raw) } : a));
  const blurReceived = () => setActiveSettlement(a => (a ? { ...a, received: normMoney(a.received) } : a));

  const acceptSettlement = async () => {
    if (!activeSettlement) return;
    const received = settleReceived();
    if (!Number.isFinite(received) || received <= 0) return;
    setSettlementMsg(null);
    try {
      const r = await api.post('/cash/settlement/accept', {
        seller_id: activeSettlement.seller.seller_id,
        received_amount: received,
      });
      const d = r.data;
      let txt = `✓ Принято ${d.count} продаж · ${fmtMoney(d.expected)}`;
      if (Math.abs(d.discrepancy) > 0.01) {
        txt += ` · ${d.discrepancy < 0 ? t('shortage') : t('surplus')}: ${fmtMoney(Math.abs(d.discrepancy))}`;
      }
      setSettlementMsg({ type: 'success', text: txt });
      setTimeout(() => { setActiveSettlement(null); load(); refreshSettlement(); }, 1500);
    } catch (e) { setSettlementMsg({ type: 'error', text: e.response?.data?.error || t('error') }); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currencyAmount.amountUZS || currencyAmount.amountUZS <= 0) { setMsg('error', t('error')); return; }
    setLoading(true);
    try {
      await api.post('/cash/income', {
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

  const list = data?.income_list || [];
  // Today's settled-only income (matches backend "balance" semantics)
  const todaySum = list
    .filter(i => new Date(i.created_at).toDateString() === new Date().toDateString())
    .filter(i => i.is_settled !== false)
    .reduce((s, i) => s + parseFloat(i.amount), 0);
  const historyFiltered = filterByPeriod(list, period, customRange).filter(i =>
    !historySearch || (i.description || '').toLowerCase().includes(historySearch.toLowerCase())
  );
  const periodSum = historyFiltered.reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="grid-2" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div style={{ marginBottom: '14px' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{t('cashIncome')}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('todayIncome')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--green)' }}>+{fmtMoney(todaySum)}</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalIncome')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--green)' }}>+{fmtMoney(data?.total_income || 0)}</div>
          </div>
        </div>
        {(data?.pending_income > 0 || data?.pending_count > 0) && (
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: '10px', padding: '8px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                ⏳ {lang === 'uz' ? 'Sotuvchilardan kutilmoqda' : 'Ожидается от продавцов'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{data?.pending_count || 0} {lang === 'uz' ? 'ta sotuv' : 'продаж'}</div>
            </div>
            <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: '#d97706' }}>+{fmtMoney(data?.pending_income || 0)}</div>
          </div>
        )}
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
                    padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${form.payment_method === o.key ? '#4338ca' : '#E2E4F0'}`,
                    background: form.payment_method === o.key ? 'rgba(67,56,202,.08)' : '#fff',
                    color: form.payment_method === o.key ? '#4338ca' : '#6B6F8A',
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
              type="income"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <button type="submit" className="btn btn-success" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>{loading ? t('loading') : t('addIncome')}</button>
        </form>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* View toggle: settlement (default) ↔ history */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            {rightView === 'settlement' ? `🧾 ${t('acceptFromSeller')}`
              : rightView === 'edit-requests' ? `✏️ ${lang === 'uz' ? 'Tahrir soʻrovlari' : 'Запросы на изменение'}`
              : `📜 ${t('incomeList')}`}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { setRightView('settlement'); refreshSettlement(); }} disabled={rightView === 'settlement'}
              style={{ padding: '8px 12px', border: rightView === 'settlement' ? 'none' : '1.5px solid #E2E4F0', borderRadius: '10px',
                background: rightView === 'settlement' ? 'linear-gradient(135deg, #FF6B2B, #FF8C55)' : '#fff',
                color: rightView === 'settlement' ? '#fff' : '#FF6B2B', fontWeight: 800, fontSize: '12px', cursor: rightView === 'settlement' ? 'default' : 'pointer',
                fontFamily: "'Nunito', sans-serif", display: 'flex', alignItems: 'center', gap: '5px',
              }}>
              🧾
              {pendingSales.length > 0 && <span style={{ background: rightView === 'settlement' ? 'rgba(255,255,255,.25)' : 'rgba(255,107,43,.15)', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 900 }}>{pendingSales.length}</span>}
            </button>
            <button onClick={() => setRightView('edit-requests')} disabled={rightView === 'edit-requests'}
              style={{ padding: '8px 12px', border: rightView === 'edit-requests' ? 'none' : '1.5px solid #E2E4F0', borderRadius: '10px',
                background: rightView === 'edit-requests' ? 'linear-gradient(135deg, #5B4FE8, #3D33C4)' : '#fff',
                color: rightView === 'edit-requests' ? '#fff' : '#4338ca', fontWeight: 800, fontSize: '12px', cursor: rightView === 'edit-requests' ? 'default' : 'pointer',
                fontFamily: "'Nunito', sans-serif", display: 'flex', alignItems: 'center', gap: '5px',
              }}>
              ✏️
              {editReqs.length > 0 && <span style={{ background: rightView === 'edit-requests' ? 'rgba(255,255,255,.25)' : 'rgba(67,56,202,.15)', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 900 }}>{editReqs.length}</span>}
            </button>
            <button onClick={() => setRightView('history')} disabled={rightView === 'history'}
              style={{ padding: '8px 12px', border: rightView === 'history' ? 'none' : '1.5px solid #E2E4F0', borderRadius: '10px',
                background: rightView === 'history' ? '#1A1B2E' : '#fff',
                color: rightView === 'history' ? '#fff' : '#6B6F8A', fontWeight: 800, fontSize: '12px', cursor: rightView === 'history' ? 'default' : 'pointer',
                fontFamily: "'Nunito', sans-serif",
              }}>📜</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { load(); refreshSettlement(); }}>{t('refresh')}</button>
          </div>
        </div>

        {/* ===== Settlement panel (default) — PER-SALE confirmation ===== */}
        {rightView === 'settlement' && (
          <>
            {!activeSettlement ? (
              pendingSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9EA3BF', fontSize: '14px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#6B6F8A' }}>{t('noUnsettled')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '650px', overflowY: 'auto' }}>
                  {settlementMsg && (
                    <div className={`alert alert-${settlementMsg.type}`} style={{ margin: 0 }}>{settlementMsg.text}</div>
                  )}
                  {pendingSales.map(s => {
                    const sellerName = [s.seller_first_name, s.seller_last_name].filter(Boolean).join(' ') || s.seller_username;
                    const productName = (lang === 'uz' && s.product_name_uz) ? s.product_name_uz : s.product_name;
                    const ts = new Date(s.created_at);
                    const pm = s.payment_method || 'cash';
                    const pmMeta = {
                      cash:     { label: lang === 'uz' ? 'Naqd'    : 'Нал',     icon: '💵', color: '#16a34a' },
                      card:     { label: lang === 'uz' ? 'Karta'   : 'Карта',   icon: '💳', color: '#2563eb' },
                      transfer: { label: lang === 'uz' ? 'O\'tkazma' : 'Перевод', icon: '🏦', color: '#0891B2' },
                      wire:     { label: lang === 'uz' ? 'Hisobga oʻtkazish' : 'Перечисление', icon: '📑', color: '#7C3AED' },
                      click:    { label: 'Click',                                icon: '⚡', color: '#0EA5E9' },
                      payme:    { label: 'Payme',                                icon: '💠', color: '#7C3AED' },
                    }[pm] || { label: pm, icon: '💰', color: '#6B6F8A' };
                    return (
                      <div key={s.cash_id} style={{
                        padding: '12px 14px', background: '#fff', border: '1.5px solid #E2E4F0',
                        borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: "'Nunito', sans-serif", gap: '12px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: '#1A1B2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {productName}
                            </div>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, color: pmMeta.color,
                              background: pmMeta.color + '18', padding: '2px 8px', borderRadius: '10px',
                              whiteSpace: 'nowrap', flexShrink: 0,
                            }}>{pmMeta.icon} {pmMeta.label}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#6B6F8A', marginTop: '2px' }}>
                            <span className="mono">{parseFloat(parseFloat(s.quantity).toFixed(3))} {s.unit} × {fmtMoney(s.price)}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '2px' }}>
                            👤 {sellerName} · {ts.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="mono" style={{ fontWeight: 900, fontSize: '16px', color: '#FF6B2B', marginTop: '4px' }}>{fmtMoney(s.amount)}</div>
                          {s.currency && s.currency !== 'UZS' && parseFloat(s.original_amount) > 0 && (
                            <div className="mono" style={{ fontSize: '11px', color: '#4338ca', marginTop: '3px', background: 'rgba(67,56,202,.07)', display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
                              💱 {lang === 'uz' ? 'Qabul qiling' : 'Принять'}: {({USD:'$',EUR:'€',RUB:'₽',KZT:'₸',CNY:'¥',TRY:'₺',KRW:'₩',GBP:'£',AED:'د.إ'}[s.currency] || '')}{parseFloat(parseFloat(s.original_amount).toFixed(2)).toLocaleString('ru-RU')} {s.currency} @ {fmtMoney(s.exchange_rate)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => acceptOneSale(s.cash_id)}
                            style={{
                              background: 'linear-gradient(135deg, #22C55E, #16a34a)', border: 'none', color: '#fff',
                              padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                              fontWeight: 800, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                              boxShadow: '0 4px 10px rgba(34,197,94,.3)',
                            }}>
                            ✅
                          </button>
                          <button onClick={() => setActiveSettlement({ singleSale: s, received: '' })}
                            title={lang === 'uz' ? 'Boshqa summa' : 'Другая сумма'}
                            style={{
                              background: '#fff', border: '1.5px solid #E2E4F0', color: '#6B6F8A',
                              padding: '10px 10px', borderRadius: '10px', cursor: 'pointer',
                              fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                            }}>⋯</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeSettlement.singleSale ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>
                    {(lang === 'uz' && activeSettlement.singleSale.product_name_uz) ? activeSettlement.singleSale.product_name_uz : activeSettlement.singleSale.product_name}
                  </div>
                  <button onClick={() => setActiveSettlement(null)} className="btn btn-ghost btn-sm">← {lang === 'uz' ? 'Orqaga' : 'Назад'}</button>
                </div>
                {settlementMsg && <div className={`alert alert-${settlementMsg.type}`} style={{ marginBottom: '12px' }}>{settlementMsg.text}</div>}
                <div style={{ background: 'rgba(255,107,43,.08)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B6F8A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('expectedAmount') || 'Ожидается'}</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 900, color: '#FF6B2B' }}>{fmtMoney(activeSettlement.singleSale.amount)}</div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">{t('receivedAmount') || 'Получено'}</label>
                  <input className="input mono" type="text" inputMode="decimal"
                    value={activeSettlement.received ?? ''}
                    onChange={e => setReceived(e.target.value)}
                    onBlur={blurReceived}
                    placeholder={String(Math.round(parseFloat(activeSettlement.singleSale.amount)))} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button disabled={!Number.isFinite(settleReceived())} onClick={async () => {
                      const received = settleReceived();
                      if (!Number.isFinite(received) || received <= 0) return;
                      try {
                        await api.post('/cash/settlement/accept-one', { cash_id: activeSettlement.singleSale.cash_id, received_amount: received });
                        setActiveSettlement(null); load();
                      } catch (e) { setSettlementMsg({ type: 'error', text: e.response?.data?.error || 'Ошибка' }); }
                    }} className="btn btn-success" style={{ flex: 2, justifyContent: 'center' }}>{t('confirmSettlement') || 'Подтвердить'}</button>
                  <button onClick={() => setActiveSettlement(null)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>{t('cancel') || 'Отмена'}</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '16px' }}>
                    👤 {[activeSettlement.seller.seller_first_name, activeSettlement.seller.seller_last_name].filter(Boolean).join(' ') || '@' + activeSettlement.seller.seller_username}
                  </div>
                  <button onClick={() => setActiveSettlement(null)} className="btn btn-ghost btn-sm">← Назад</button>
                </div>
                {settlementMsg && <div className={`alert alert-${settlementMsg.type}`} style={{ marginBottom: '12px' }}>{settlementMsg.text}</div>}
                <div style={{ background: 'rgba(255,107,43,.08)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B6F8A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('expectedAmount')}</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 900, color: '#FF6B2B' }}>{fmtMoney(activeSettlement.seller.total_amount)}</div>
                  <div style={{ fontSize: '12px', color: '#9EA3BF', marginTop: '4px' }}>{activeSettlement.seller.sales_count} {t('salesCountShort')}</div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">{t('receivedAmount')}</label>
                  <input className="input mono" type="text" inputMode="decimal"
                    value={activeSettlement.received ?? ''}
                    onChange={e => setReceived(e.target.value)}
                    onBlur={blurReceived}
                    placeholder={String(Math.round(parseFloat(activeSettlement.seller.total_amount)))} />
                  <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '4px' }}>{t('settleHint')}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button disabled={!Number.isFinite(settleReceived())} onClick={acceptSettlement} className="btn btn-success" style={{ flex: 2, justifyContent: 'center' }}>{t('confirmSettlement')}</button>
                  <button onClick={() => setActiveSettlement(null)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== Edit-requests panel ===== */}
        {rightView === 'edit-requests' && (
          editReqs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9EA3BF', fontSize: '14px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#6B6F8A' }}>
                {lang === 'uz' ? 'Tahrir soʻrovlari yoʻq' : 'Нет запросов на изменение'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
              {editReqs.map(er => {
                const oldTotal = parseFloat(er.old_quantity) * parseFloat(er.old_price);
                const newTotal = parseFloat(er.new_quantity) * parseFloat(er.new_price);
                const diff = newTotal - oldTotal;
                return (
                  <div key={er.id} style={{ background: '#fff', border: '1.5px solid #E2E4F0', borderRadius: '12px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#1A1B2E' }}>{er.product_name}</div>
                        <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '2px' }}>👤 {er.seller_name} · #{er.outcome_id}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDate(er.created_at)}</div>
                    </div>
                    <div style={{ background: '#F4F5FA', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text3)' }}>{lang === 'uz' ? 'Eski' : 'Старое'}:</span>
                        <span className="mono" style={{ textDecoration: 'line-through', color: 'var(--text3)' }}>
                          {parseFloat(er.old_quantity)} × {fmtMoney(er.old_price)} = {fmtMoney(oldTotal)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{lang === 'uz' ? 'Yangi' : 'Новое'}:</span>
                        <span className="mono" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                          {parseFloat(er.new_quantity)} × {fmtMoney(er.new_price)} = {fmtMoney(newTotal)}
                        </span>
                      </div>
                      {Math.abs(diff) > 0.01 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px', borderTop: '1px solid #E2E4F0', paddingTop: '4px' }}>
                          <span style={{ color: 'var(--text3)' }}>{lang === 'uz' ? 'Farq' : 'Разница'}:</span>
                          <span className="mono" style={{ fontWeight: 800, color: diff > 0 ? 'var(--green)' : 'var(--red)' }}>{diff > 0 ? '+' : ''}{fmtMoney(diff)}</span>
                        </div>
                      )}
                    </div>
                    {er.reason && (
                      <div style={{ background: 'rgba(245,158,11,.08)', borderRadius: '6px', padding: '6px 10px', marginBottom: '8px', fontSize: '12px', color: 'var(--text2)' }}>
                        💬 {er.reason}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => reviewEditReq(er.id, 'approve')} className="btn btn-success btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                        ✅ {lang === 'uz' ? 'Tasdiqlash' : 'Одобрить'}
                      </button>
                      <button onClick={() => reviewEditReq(er.id, 'reject')} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--red)' }}>
                        ❌ {lang === 'uz' ? 'Rad etish' : 'Отклонить'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ===== History panel ===== */}
        {rightView === 'history' && (
          <>
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
              <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSum')}</div>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>+{fmtMoney(periodSum)}</div>
              </div>
            </div>
            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              <table>
                <thead><tr><th>{t('amount')}</th><th>{t('description')}</th><th>{t('date')}</th></tr></thead>
                <tbody>
                  {historyFiltered.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{t('noData')}</td></tr>}
                  {historyFiltered.map(item => {
                    const unsettled = item.is_settled === false;
                    return (
                    <tr key={item.id} onClick={() => setDetailItem(item)}
                      style={{ cursor: 'pointer', transition: 'background .15s', background: unsettled ? 'rgba(245,158,11,.04)' : undefined }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F4F5FA'}
                      onMouseLeave={e => e.currentTarget.style.background = unsettled ? 'rgba(245,158,11,.04)' : ''}>
                      <td>
                        <span className="mono" style={{ fontWeight: 700, color: unsettled ? '#d97706' : 'var(--green)' }}>
                          {unsettled ? '⏳ ' : '+'}{fmtMoney(item.amount)}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {item.description || '—'}
                        {unsettled && (
                          <div style={{ fontSize: '10px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                            {lang === 'uz' ? 'TOPSHIRILMAGAN' : 'НЕ СДАНО'}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{formatDate(item.created_at)}<br /><span style={{ color: 'var(--text3)' }}>{formatTime(item.created_at)}</span></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* === Detail modal (click on history row) === */}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setDetailItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>💰 {t('incomeDetails') || 'Детали прихода'}</div>
              <button onClick={() => setDetailItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ background: 'rgba(34,197,94,.08)', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{t('amount') || 'Сумма'}</div>
              <div className="mono" style={{ fontSize: '32px', fontWeight: 900, color: 'var(--green)' }}>+{fmtMoney(detailItem.amount)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Row label={t('description') || 'Описание'} value={detailItem.description || '—'} />
              <Row label={t('paymentMethod') || 'Способ оплаты'} value={methodLabel(detailItem.payment_method)} />
              <Row label={t('date') || 'Дата'} value={`${formatDate(detailItem.created_at)} ${formatTime(detailItem.created_at)}`} />
              <Row label={t('createdBy') || 'Кем оформлено'} value={detailItem.username || '—'} />
              {detailItem.outcome_id && (
                <Row label={t('linkedSale') || 'Связанная продажа'} value={`#${detailItem.outcome_id}`} />
              )}
              <Row label={t('settled') || 'Статус'} value={detailItem.is_settled ? '✅ Сдано' : '⏳ Не сдано'} valueColor={detailItem.is_settled ? 'var(--green)' : 'var(--orange)'} />
            </div>
            <button onClick={() => setDetailItem(null)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>
              {t('close') || 'Закрыть'}
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
