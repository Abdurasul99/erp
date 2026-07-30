import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App.jsx';
import api from '../api.js';
import { formatDate, formatTime, useMsg, filterByPeriod, fmtMoney, fmtNum } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import { Icon } from '../icons.jsx';
import PeriodFilter from './PeriodFilter.jsx';
import CustomerCombobox from './CustomerCombobox.jsx';
import ProductCombobox from './ProductCombobox.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

const sellerName = (item) => {
  const fn = [item.created_by_first_name, item.created_by_last_name].filter(Boolean).join(' ');
  return fn || item.created_by_name || '—';
};
const roleColor = { admin: '#6B6F8A', director: '#4338ca', manager: '#4338ca', cashier: '#16a34a', warehouse: '#d97706', seller: '#dc2626' };

// ── Числовые поля (деньги и количество) ──────────────────────────────────────
// Стейт таких полей — СТРОКА, а сам input — type="text" inputMode="decimal".
// У type="number" браузер при промежуточно-невалидном вводе («12 500» с пробелом,
// «1500,» с запятой) отдаёт e.target.value = '' — контролируемое поле само себя
// очищало, итого и заканчивалось нулём, и продажа уходила с ценой 0. Поэтому: в
// onChange только чистка символов, диапазон и округление — в onBlur.
const cleanDec = (v) => String(v ?? '').replace(/[^\d.,]/g, '');
const isBlank  = (v) => String(v ?? '').trim() === '';
// Строка поля → число. Запятая = десятичный разделитель (RU/UZ раскладка).
const toNum = (v) => {
  const n = parseFloat(normalizeDecimal(v));
  return Number.isFinite(n) ? n : NaN;
};
// Нормализация на blur: пустое остаётся пустым (поле можно полностью очистить),
// число зажимаем в диапазон и округляем. Нечисловой остаток НЕ превращаем в 0 —
// его поймает проверка при отправке и покажет ошибку.
const normDec = (v, dp = 3, min = 0, max = Infinity) => {
  if (isBlank(v)) return '';
  const n = toNum(v);
  if (!Number.isFinite(n)) return cleanDec(v);
  return String(Number(Math.min(max, Math.max(min, n)).toFixed(dp)));
};
// onBlur-нормализатор поля формы: значение читаем сразу, а стейт обновляем
// функционально — чтобы не перетереть остальные поля формы.
const blurNorm = (setState, key, dp) => (e) => {
  const v = e.target.value;
  setState(f => ({ ...f, [key]: normDec(v, dp) }));
};

export default function WarehouseOutcome() {
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const { user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [list, setList] = useState([]);
  const [pending, setPending] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    product_id: '', quantity: '', price: '', note: '',
    customer_id: null, payment_method: 'cash',
    payment_status: 'paid', paid_amount: '', due_date: '',
  });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: '', price: '', note: '' });
  const [period, setPeriod] = useState('week'); // today | week | month | year | custom
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [historySearch, setHistorySearch] = useState('');
  const [view, setView] = useState('form'); // 'form' (form + pending) | 'history'
  const canApprove     = ['admin', 'founder', 'director', 'manager', 'warehouse'].includes(user?.role);
  const canViewPending = ['admin', 'founder', 'director', 'manager', 'warehouse', 'cashier'].includes(user?.role);
  const canEdit        = ['admin', 'founder', 'director', 'manager', 'warehouse'].includes(user?.role);

  const [incomes, setIncomes] = useState([]); // history of stock_income — needed to show last supplier per product

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [p, l, pend, inc] = await Promise.all([
      api.get('/products'),
      api.get('/stock/outcome-list'),
      canViewPending ? api.get('/stock/pending') : Promise.resolve({ data: [] }),
      api.get('/stock/income-list').catch(() => ({ data: [] })),
    ]);
    setProducts(p.data);
    // Only show regular sales (B2B-style) — returns/writeoffs have their own tabs
    setList((l.data || []).filter(i => !i.outcome_type || i.outcome_type === 'sale'));
    setPending((pend.data || []).filter(i => !i.outcome_type || i.outcome_type === 'sale'));
    setIncomes(inc.data || []);
  };

  // product_id → last known supplier (from income history)
  const lastSupplierByProduct = (() => {
    const seen = new Map();
    for (const i of incomes) {
      if (!i.supplier) continue;
      const ts = new Date(i.created_at).getTime();
      const prev = seen.get(i.product_id);
      if (!prev || prev.ts < ts) seen.set(i.product_id, { supplier: i.supplier, ts });
    }
    return seen;
  })();

  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));
  const todayOutcome = list.filter(i => new Date(i.created_at).toDateString() === new Date().toDateString() && i.status === 'approved');
  const todayQty = todayOutcome.reduce((s, i) => s + parseFloat(i.quantity), 0);
  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  // Date-range filter for the sales history table
  const historyFiltered = filterByPeriod(list, period, customRange).filter(i => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (i.name_ru || '').toLowerCase().includes(q) || (i.barcode || '').includes(historySearch);
  });
  const historyStats = historyFiltered.reduce((acc, i) => {
    if (i.status === 'approved') {
      acc.count++;
      acc.qty += parseFloat(i.quantity);
      acc.sum += parseFloat(i.quantity) * parseFloat(i.price || 0);
    }
    return acc;
  }, { count: 0, qty: 0, sum: 0 });

  // Числа из строковых полей формы — считаем один раз: и для итога, и для отправки.
  const qtyNum   = toNum(form.quantity);
  const priceNum = toNum(form.price);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = qtyNum;
    if (!form.product_id) { setMsg('error', uz ? 'Tovarni tanlang' : 'Выберите товар'); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setMsg('error', uz ? 'Miqdor majburiy' : 'Введите количество'); return; }
    if (selectedProduct && qty > parseFloat(selectedProduct.stock)) {
      setMsg('error', `${t('stock')}: ${fmtQty(selectedProduct.stock)} ${selectedProduct.unit}`);
      return;
    }
    // B2B sale requires a customer (for debt tracking, history, invoicing)
    if (!form.customer_id) {
      setMsg('error', uz ? 'B2B sotuv uchun mijoz majburiy' : 'Для B2B продажи нужно выбрать клиента');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setMsg('error', uz ? 'Narxni kiriting' : 'Введите цену'); return;
    }
    const total = qty * priceNum;
    // «Внесено сейчас»: пусто = ничего не внесли (0), но нечитаемую строку молча
    // нулём не подменяем — иначе долг клиента посчитается неверно.
    let paidAmt = total;
    if (form.payment_status === 'debt') paidAmt = 0;
    else if (form.payment_status === 'partial') {
      if (isBlank(form.paid_amount)) paidAmt = 0;
      else {
        const p = toNum(form.paid_amount);
        if (!Number.isFinite(p) || p < 0) {
          setMsg('error', uz ? 'Kiritilgan summani tekshiring — raqam kiriting'
                             : 'Проверьте сумму «Внесено сейчас» — введите число');
          return;
        }
        paidAmt = p;
      }
    }
    setLoading(true);
    try {
      const res = await api.post('/stock/outcome', {
        product_id: parseInt(form.product_id), quantity: qty,
        price: priceNum, note: form.note,
        customer_id: form.customer_id || null,
        payment_method: form.payment_status === 'debt' ? 'debt' : form.payment_method,
        payment_status: form.payment_status,
        paid_amount: paidAmt,
        due_date: form.payment_status !== 'paid' ? (form.due_date || null) : null,
      });
      setMsg('success', t('success'));
      setForm({ product_id: '', quantity: '', price: '', note: '',
                customer_id: null, payment_method: 'cash',
                payment_status: 'paid', paid_amount: '', due_date: '' });
      setSearch('');
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
    setLoading(false);
  };

  const handleApprove = async (id, action) => {
    setApproving(id);
    try { await api.put(`/stock/outcome/${id}/approve`, { action }); loadAll(); }
    catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
    setApproving(null);
  };

  const openEdit = (item) => {
    setEditItem(item);
    clearMsg();
    // Поля модалки тоже строковые — приводим значения из БД («5.000») к виду,
    // который человек может дописать и стереть.
    setEditForm({
      quantity: normDec(item.quantity, 3),
      price: item.price == null ? '' : normDec(item.price, 2),
      note: item.note || '',
    });
  };

  const handleEditSave = async () => {
    const qty = toNum(editForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMsg('error', uz ? 'Miqdor majburiy' : 'Введите количество'); return;
    }
    // Пусто = цена 0 (как и раньше), мусор — ошибка, а не молчаливый 0.
    const price = isBlank(editForm.price) ? 0 : toNum(editForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setMsg('error', uz ? 'Narxni tekshiring — raqam kiriting' : 'Проверьте цену — введите число'); return;
    }
    try {
      await api.put(`/stock/outcome/${editItem.id}`, {
        quantity: qty,
        price,
        note: editForm.note,
      });
      setEditItem(null);
      loadAll();
      setMsg('success', t('success'));
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`${t('confirmDelete')} «${item.name_ru}»?`)) return;
    try {
      await api.delete(`/stock/outcome/${item.id}`);
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
  };

  const statusBadge = (status) => {
    const map = { approved: ['badge-green', t('approved')], rejected: ['badge-red', t('rejected')], pending: ['badge-yellow', t('pending')] };
    const [cls, label] = map[status] || ['badge-blue', status];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, height: '100%' }}>
      {/* TOP: form + pending OR history table — toggle */}
      {view === 'form' ? (
      <div className={canViewPending ? 'grid-2' : ''}
           style={{
             gap: '20px', flex: 1, minHeight: 0, alignItems: 'stretch',
             ...(canViewPending ? {} : { display: 'flex', flexDirection: 'column' }),
           }}>
        {/* Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          <div className="section-title">🏢 {uz ? 'B2B Klientga sotish' : 'B2B продажа клиенту'}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
            {uz
              ? 'Ulgurji sotuv yoki yuridik shaxsga toʻgʻridan-toʻgʻri chiqim. Mijozni tanlang, qarz / qisman / toʻliq toʻlovni belgilang.'
              : 'Оптовая продажа или прямой расход юр-лицу. Выберите клиента, отметьте оплату (полная/частичная/в долг).'}
          </div>

          <div className="grid-2" style={{ marginBottom: '14px' }}>
            <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('todaySold')}</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--red)' }}>−{fmtQty(todayQty)}</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('waiting')}</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--yellow)' }}>{pending.length}</div>
            </div>
          </div>

          {msg && (
            <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{msg.text}</span>
              <button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: 'inherit' }}>×</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* 1. Product */}
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{uz ? 'Tovar' : 'Товар'} *</label>
              <ProductCombobox
                products={products}
                value={form.product_id}
                onChange={(id) => setForm({ ...form, product_id: id })}
                accent="#FF6B2B"
                placeholder={uz ? 'Nom yoki shtrix-kod boʻyicha qidiring...' : 'Найдите по названию или штрих-коду...'}
              />
            </div>

            {selectedProduct && (
              <div style={{ background: 'rgba(255,107,43,.05)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', border: '1px solid rgba(255,107,43,.15)' }}>
                <strong>{selectedProduct.name_ru}</strong>
                <span style={{ color: 'var(--text2)', marginLeft: '8px' }}>
                  {t('stock')}: <span className="mono" style={{ fontWeight: 700, color: selectedProduct.stock > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmtQty(selectedProduct.stock)} {selectedProduct.unit}
                  </span>
                </span>
                {lastSupplierByProduct.get(selectedProduct.id)?.supplier && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                    📦 {uz ? 'Yetkazib beruvchi' : 'Поставщик'}: {lastSupplierByProduct.get(selectedProduct.id).supplier}
                  </div>
                )}
              </div>
            )}

            {/* 2. Customer (required for B2B) */}
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{uz ? 'Mijoz' : 'Клиент'} *</label>
              <CustomerCombobox value={form.customer_id} onChange={v => setForm({ ...form, customer_id: v })} />
              {!form.customer_id && (
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  {uz ? 'B2B uchun mijoz majburiy — qarz va tarix shu yerda saqlanadi' : 'Для B2B клиент обязателен — долг и история привязываются к нему'}
                </div>
              )}
            </div>

            {/* 3. Quantity + Price (with unit labels) */}
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="label">
                  {uz ? 'Miqdor' : 'Количество'}{selectedProduct ? ` (${selectedProduct.unit})` : ''} *
                </label>
                <input className="input mono" type="text" inputMode="decimal" value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: cleanDec(e.target.value) })}
                  onBlur={blurNorm(setForm, 'quantity', 3)}
                  required placeholder="0" />
              </div>
              <div>
                <label className="label">
                  {uz ? 'Narxi' : 'Цена'}{selectedProduct ? ` (UZS / ${selectedProduct.unit})` : ' (UZS)'}
                </label>
                <input className="input mono" type="text" inputMode="decimal" value={form.price}
                  onChange={e => setForm({ ...form, price: cleanDec(e.target.value) })}
                  onBlur={blurNorm(setForm, 'price', 2)}
                  placeholder="0" />
              </div>
            </div>

            {/* Total summary */}
            {qtyNum > 0 && priceNum > 0 && (
              <div style={{ background: 'rgba(67,56,202,.06)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)' }}>{uz ? 'Jami:' : 'Итого:'}</span>
                <span className="mono" style={{ fontSize: '18px', fontWeight: 900, color: '#4338ca' }}>
                  {fmtMoney(qtyNum * priceNum)}
                </span>
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label className="label">{t('paymentType') || 'Тип оплаты'}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { key: 'paid',    label: t('payFull') || '💵 Сразу', color: '#16a34a' },
                  { key: 'partial', label: t('payPartial') || '⚖️ Частично', color: '#d97706' },
                  { key: 'debt',    label: t('payDebt') || '📒 В долг', color: '#dc2626' },
                ].map(o => (
                  <button key={o.key} type="button"
                    onClick={() => setForm({ ...form, payment_status: o.key })}
                    style={{
                      padding: '8px 6px', borderRadius: '10px', border: `1.5px solid ${form.payment_status === o.key ? o.color : '#E2E4F0'}`,
                      background: form.payment_status === o.key ? o.color + '15' : '#fff',
                      color: form.payment_status === o.key ? o.color : '#6B6F8A',
                      cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                    }}>{o.label}</button>
                ))}
              </div>
            </div>

            {/* Payment method — hidden when full-debt */}
            {form.payment_status !== 'debt' && (
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('paymentMethod') || 'Способ оплаты'}</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'cash',     label: '💵 Нал' },
                    { key: 'card',     label: '💳 Карта' },
                    { key: 'transfer', label: '🏦 Перевод' },
                    { key: 'wire',     label: '📑 Перечисление' },
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
            )}

            {/* Partial: amount paid now */}
            {form.payment_status === 'partial' && (
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('paidNow') || 'Внесено сейчас (UZS)'}</label>
                <input className="input" type="text" inputMode="decimal" value={form.paid_amount}
                  onChange={e => setForm({ ...form, paid_amount: cleanDec(e.target.value) })}
                  onBlur={blurNorm(setForm, 'paid_amount', 2)}
                  placeholder="0" />
              </div>
            )}

            {/* Due date for debt / partial */}
            {(form.payment_status === 'debt' || form.payment_status === 'partial') && (
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('dueDate') || 'Срок возврата'}</label>
                <input className="input" type="date" value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} />
                {!form.customer_id && (
                  <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>
                    ⚠️ {t('debtRequiresCustomer') || 'Для долга желательно выбрать клиента'}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('note')}</label>
              <input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder={t('notePlaceholder')} />
            </div>

            <button type="submit" className="btn btn-orange" disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? t('loading') : t('makeOutcome')}
            </button>
          </form>
        </div>

        {/* Pending panel — visible to all who can view (cashier sees but can't approve) */}
        {canViewPending && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                {t('pendingApprovals')}
                {pending.length > 0 && <span className="badge badge-yellow">{pending.length}</span>}
              </span>
              <button onClick={() => setView('history')} style={{
                padding: '6px 12px', background: 'rgba(67,56,202,.08)', border: 'none',
                color: 'var(--primary)', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
              }}>{t('showHistory')}</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {pending.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px', fontSize: '14px' }}>{t('noPending')}</div>
              )}
              {pending.map(item => (
                <div key={item.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,.05)', marginBottom: '8px', border: '1px solid rgba(245,158,11,.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.name_ru}</div>
                      {item.customer_name && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#4338ca', background: 'rgba(67,56,202,.08)', display: 'inline-block', padding: '2px 8px', borderRadius: '8px', marginTop: '3px' }}>
                          🏢 {item.customer_name}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                        <span className="mono" style={{ fontWeight: 700 }}>{fmtQty(item.quantity)} {item.unit}</span>
                        {item.price > 0 && <> · <span className="mono">{fmtMoney(item.price)}</span></>}
                        {item.payment_status === 'debt' && <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 700 }}>📒 {uz ? 'qarz' : 'долг'}</span>}
                        {item.payment_status === 'partial' && <span style={{ color: '#d97706', marginLeft: 6, fontWeight: 700 }}>⚖️ {uz ? 'qisman' : 'частично'}</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                        {item.created_by_name} · {formatDate(item.created_at)}
                      </div>
                    </div>
                    {canApprove ? (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button className="btn btn-success btn-sm"
                          onClick={() => handleApprove(item.id, 'approve')}
                          disabled={approving === item.id}>
                          {approving === item.id ? '...' : t('approve')}
                        </button>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => handleApprove(item.id, 'reject')}
                          disabled={approving === item.id}>
                          {t('reject')}
                        </button>
                      </div>
                    ) : (
                      <span className="badge badge-yellow" style={{ flexShrink: 0 }}>{t('pending')}</span>
                    )}
                  </div>
                  {item.note && <div style={{ fontSize: '11px', color: 'var(--text2)', fontStyle: 'italic' }}>"{item.note}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      ) : (
      /* History view — full width when toggled */
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{t('outcomeHistory')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('form')} style={{
              padding: '6px 12px', background: 'rgba(107,111,138,.08)', border: 'none',
              color: '#6B6F8A', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
            }}>{t('backToForm')}</button>
            <button className="btn btn-ghost btn-sm" onClick={loadAll}>{t('refresh')}</button>
          </div>
        </div>

        {/* Period + search filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
          <input className="input" style={{ flex: 1, minWidth: '180px', padding: '7px 12px', fontSize: '13px' }}
            value={historySearch} onChange={e => setHistorySearch(e.target.value)}
            placeholder={`🔍 ${t('search')}: ${t('name')} / ${t('barcode')}`} />
        </div>

        {/* Period summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: 'rgba(67,56,202,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSales')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#4338ca' }}>{historyStats.count}</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalQty')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#FF6B2B' }}>{fmtQty(historyStats.qty)}</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSum')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>+{fmtMoney(historyStats.sum)}</div>
          </div>
        </div>

        <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{uz ? 'Mijoz' : 'Клиент'}</th>
                <th>{t('quantity')}</th>
                <th>{t('price')}</th>
                <th>{t('status')}</th>
                <th>{t('soldBy')}</th>
                <th>{t('date')}</th>
                {canEdit && <th>{t('actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {historyFiltered.length === 0 && <tr><td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{t('noData')}</td></tr>}
              {historyFiltered.map(item => {
                const clr = roleColor[item.created_by_role] || '#6B6F8A';
                const pstatusColor = item.payment_status === 'debt' ? '#dc2626' : item.payment_status === 'partial' ? '#d97706' : '#16a34a';
                return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name_ru}</div>
                    {item.note && <div style={{ fontSize: '11px', color: 'var(--text3)', fontStyle: 'italic', marginTop: '2px' }}>"{item.note}"</div>}
                  </td>
                  <td style={{ fontSize: '12px' }}>
                    {item.customer_name ? (
                      <span style={{ background: 'rgba(67,56,202,.08)', color: '#4338ca', padding: '3px 9px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>
                        🏢 {item.customer_name}
                      </span>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    {item.payment_status && item.payment_status !== 'paid' && (
                      <div style={{ fontSize: '10px', fontWeight: 700, color: pstatusColor, marginTop: '3px' }}>
                        {item.payment_status === 'debt' ? (uz ? '📒 Qarzga' : '📒 В долг') :
                         (uz ? `⚖️ Qisman ${fmtNum(item.paid_amount || 0)}` : `⚖️ Частично ${fmtNum(item.paid_amount || 0)}`)}
                      </div>
                    )}
                  </td>
                  <td><span className="mono" style={{ fontWeight: 700 }}>{fmtQty(item.quantity)} {item.unit}</span></td>
                  <td><span className="mono">{fmtNum(item.price || 0)}</span></td>
                  <td>{statusBadge(item.status)}</td>
                  <td style={{ fontSize: '12px' }}>
                    <span style={{ background: clr + '15', color: clr, padding: '3px 9px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>
                      👤 {sellerName(item)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap', lineHeight: '1.3' }}>
                    <div>{formatDate(item.created_at)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{formatTime(item.created_at)}</div>
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="action-btn action-btn-edit" title={t('edit')} onClick={() => openEdit(item)}>
                          <Icon name="edit" size={12} color="var(--primary)" />
                        </button>
                        <button className="action-btn action-btn-del" title={t('delete')} onClick={() => handleDelete(item)}>
                          <Icon name="trash" size={12} color="var(--red)" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Edit outcome modal */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{t('editOutcome')}</div>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{editItem.name_ru}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                {sellerName(editItem)} · {formatDate(editItem.created_at)} · {statusBadge(editItem.status)}
              </div>
            </div>
            {/* Ошибки проверки цены/количества показываем здесь — из окна истории
                общий баннер формы не виден. */}
            {msg && msg.type === 'error' && (
              <div className={`alert alert-${msg.type}`} style={{ marginBottom: '12px' }}>{msg.text}</div>
            )}
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="label">{t('quantity')}</label>
                <input className="input mono" type="text" inputMode="decimal" value={editForm.quantity}
                  onChange={e => setEditForm({ ...editForm, quantity: cleanDec(e.target.value) })}
                  onBlur={blurNorm(setEditForm, 'quantity', 3)} />
              </div>
              <div>
                <label className="label">{t('priceSellSum')}</label>
                <input className="input mono" type="text" inputMode="decimal" value={editForm.price}
                  onChange={e => setEditForm({ ...editForm, price: cleanDec(e.target.value) })}
                  onBlur={blurNorm(setEditForm, 'price', 2)} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('note')}</label>
              <input className="input" value={editForm.note}
                onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder={t('notePlaceholder')} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={handleEditSave} style={{ flex: 1, justifyContent: 'center' }}>{t('save')}</button>
              <button className="btn btn-ghost" onClick={() => setEditItem(null)} style={{ flex: 1, justifyContent: 'center' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
