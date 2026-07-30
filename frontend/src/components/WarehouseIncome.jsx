import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { formatDate, formatTime, useMsg, filterByPeriod, fmtMoney, fmtNum } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import PeriodFilter from './PeriodFilter.jsx';
import SupplierCombobox from './SupplierCombobox.jsx';
import ProductCombobox from './ProductCombobox.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

// ── Числовые поля (деньги и количество) ──────────────────────────────────────
// Стейт таких полей — СТРОКА, а сам input — type="text" inputMode="decimal".
// У type="number" браузер при промежуточно-невалидном вводе («12 500» с пробелом,
// «1500,» с запятой) отдаёт e.target.value = '' — контролируемое поле само себя
// очищало, а на сервер уходил приход с ценой 0. Поэтому: в onChange только чистка
// символов, диапазон и округление — в onBlur.
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

export default function WarehouseIncome() {
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const [products, setProducts] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ product_id: '', quantity: '', price: '', price_sell: '', supplier_id: null, note: '' });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => { loadList(); loadProducts(); }, []);

  const loadProducts = async () => { const { data } = await api.get('/products'); setProducts(data); };
  const loadList = async () => { const { data } = await api.get('/stock/income-list'); setList(data); };

  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));

  // When a product is picked, pre-fill price fields with its current buy/sell prices
  // so the cashier sees what's currently set and can keep or change them.
  useEffect(() => {
    if (selectedProduct) {
      setForm(f => ({
        ...f,
        // normDec, а не String(): «45000.00» из БД в поле выглядит как «45000».
        price:      f.price      === '' ? (selectedProduct.price_buy  ? normDec(selectedProduct.price_buy, 2)  : '') : f.price,
        price_sell: f.price_sell === '' ? (selectedProduct.price_sell ? normDec(selectedProduct.price_sell, 2) : '') : f.price_sell,
      }));
    }
  }, [selectedProduct?.id]);
  // product_id → last income row (used both for supplier_id and the option label)
  const lastIncomeByProduct = (() => {
    const seen = new Map();
    for (const i of list) {
      const ts = new Date(i.created_at).getTime();
      const prev = seen.get(i.product_id);
      if (!prev || prev.ts < ts) seen.set(i.product_id, { name: i.supplier, id: i.supplier_id, ts });
    }
    return seen;
  })();
  const lastSupplierForProduct = selectedProduct ? (lastIncomeByProduct.get(selectedProduct.id) || null) : null;
  const todayIncome = list.filter(i => new Date(i.created_at).toDateString() === new Date().toDateString());
  const todayQty = todayIncome.reduce((s, i) => s + parseFloat(i.quantity), 0);
  const todaySum = todayIncome.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.price || 0), 0);

  const historyFiltered = filterByPeriod(list, period, customRange).filter(i => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (i.name_ru || '').toLowerCase().includes(q) || (i.barcode || '').includes(historySearch);
  });
  const historyStats = historyFiltered.reduce((acc, i) => {
    acc.count++;
    acc.qty += parseFloat(i.quantity);
    acc.sum += parseFloat(i.quantity) * parseFloat(i.price || 0);
    return acc;
  }, { count: 0, qty: 0, sum: 0 });

  // Числа из строковых полей — считаем один раз и для формы, и для отправки.
  const qtyNum   = toNum(form.quantity);
  const buyNum   = toNum(form.price);
  const sellNum  = toNum(form.price_sell);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) { setMsg('error', t('error')); return; }
    // Пустая цена = «не указана» (как и раньше → 0), но набранный мусор молча
    // нулём не подменяем: иначе приход проведётся с нулевой себестоимостью.
    const priceOut = isBlank(form.price) ? 0 : buyNum;
    if (!Number.isFinite(priceOut) || priceOut < 0) {
      setMsg('error', uz ? 'Sotib olish narxini tekshiring — raqam kiriting'
                         : 'Проверьте цену закупки — введите число');
      return;
    }
    const priceSellOut = isBlank(form.price_sell) ? null : sellNum;
    if (priceSellOut !== null && (!Number.isFinite(priceSellOut) || priceSellOut < 0)) {
      setMsg('error', uz ? 'Sotish narxini tekshiring — raqam kiriting'
                         : 'Проверьте цену продажи — введите число');
      return;
    }
    setLoading(true);
    try {
      await api.post('/stock/income', {
        product_id: parseInt(form.product_id),
        quantity: qtyNum,
        price: priceOut,
        price_sell: priceSellOut,
        supplier_id: form.supplier_id || null,
        note: form.note,
      });
      setMsg('success', t('success'));
      setForm({ product_id: '', quantity: '', price: '', price_sell: '', supplier_id: null, note: '' });
      loadList(); loadProducts();
    } catch (e) { setMsg('error', e.response?.data?.error || t('error')); }
    setLoading(false);
  };

  return (
    <div className="grid-2" style={{ height: 'calc(100vh - 180px)', minHeight: 0 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div className="section-title">{t('warehouseIncome')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('todayQty')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>+{parseFloat(todayQty.toFixed(3)).toString()}</div>
          </div>
          <div style={{ background: 'rgba(91,79,232,.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('todaySum')}</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{fmtMoney(todaySum)}</div>
          </div>
        </div>
        {msg && <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{msg.text}</span><button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: 'inherit' }}>×</button></div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label className="label">{t('searchProduct')}</label>
            <ProductCombobox
              products={products}
              value={form.product_id}
              onChange={(id) => setForm({ ...form, product_id: id })}
              accent="#5B4FE8"
              placeholder={t('searchPlaceholder')}
            />
          </div>
          {selectedProduct && (
            <div style={{ background: 'rgba(91,79,232,.05)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedProduct.photo_url && <img src={selectedProduct.photo_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedProduct.name_ru}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                  {t('stock')}: <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{parseFloat(parseFloat(selectedProduct.stock).toFixed(3)).toString()} {selectedProduct.unit}</span>
                  {selectedProduct.type_name_ru && ` · ${selectedProduct.type_name_ru}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>📥 {t('priceBuy') || 'Закуп'}: <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtNum(selectedProduct.price_buy || 0)} UZS</span></span>
                  <span>🏷️ {t('priceSell') || 'Продажа'}: <span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{fmtNum(selectedProduct.price_sell || 0)} UZS</span></span>
                </div>
                {lastSupplierForProduct?.name && (
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
                    {t('lastSupplier')}: <button type="button"
                      onClick={() => setForm(f => ({ ...f, supplier_id: lastSupplierForProduct.id || null }))}
                      style={{ background: 'rgba(91,79,232,.12)', border: 'none', color: 'var(--primary)', padding: '2px 10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif" }}>
                      📦 {lastSupplierForProduct.name}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div>
              <label className="label">{t('quantity')}{selectedProduct ? ` (${selectedProduct.unit})` : ''} *</label>
              <input className="input mono" type="text" inputMode="decimal"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: cleanDec(e.target.value) })}
                onBlur={blurNorm(setForm, 'quantity', 3)}
                required placeholder="0" />
            </div>
            <div>
              <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📥 {t('priceBuySum')}</span>
                {selectedProduct?.price_buy && Number.isFinite(buyNum) && buyNum !== parseFloat(selectedProduct.price_buy) && (
                  <span style={{ color: 'var(--orange)', fontSize: '10px', fontWeight: 800 }}>↑ ИЗМЕНИТСЯ</span>
                )}
              </label>
              <input className="input mono" type="text" inputMode="decimal"
                value={form.price}
                onChange={e => setForm({ ...form, price: cleanDec(e.target.value) })}
                onBlur={blurNorm(setForm, 'price', 2)}
                placeholder={selectedProduct?.price_buy ? String(selectedProduct.price_buy) : '0'} />
            </div>
          </div>
          <div className="form-grid" style={{ marginBottom: '12px' }}>
            <div>
              <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏷️ {t('priceSellSum')}</span>
                {selectedProduct?.price_sell && Number.isFinite(sellNum) && sellNum !== parseFloat(selectedProduct.price_sell) && (
                  <span style={{ color: 'var(--orange)', fontSize: '10px', fontWeight: 800 }}>↑ ИЗМЕНИТСЯ</span>
                )}
              </label>
              <input className="input mono" type="text" inputMode="decimal"
                value={form.price_sell}
                onChange={e => setForm({ ...form, price_sell: cleanDec(e.target.value) })}
                onBlur={blurNorm(setForm, 'price_sell', 2)}
                placeholder={selectedProduct?.price_sell ? String(selectedProduct.price_sell) : '0'}
                style={{ borderColor: 'rgba(34,197,94,.3)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {buyNum > 0 && sellNum > 0 && (
                <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,.08)', borderRadius: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 700 }}>Маржа: </span>
                  <span className="mono" style={{ fontWeight: 800, color: 'var(--green)' }}>
                    {Math.round((sellNum - buyNum) / sellNum * 1000) / 10}%
                  </span>
                  <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 11 }}>
                    +{fmtNum(sellNum - buyNum)} UZS/шт
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="label">{t('supplier')}</label>
            <SupplierCombobox
              value={form.supplier_id}
              onChange={v => setForm({ ...form, supplier_id: v })}
              placeholder={t('supplierPlaceholder')}
            />
          </div>
          <div style={{ marginBottom: '16px' }}><label className="label">{t('note')}</label><input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder={t('notePlaceholder')} /></div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? t('loading') : t('saveIncome')}
          </button>
        </form>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{t('incomeHistory')}</div>
          <button className="btn btn-ghost btn-sm" onClick={loadList}>{t('refresh')}</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
          <input className="input" style={{ flex: 1, minWidth: '160px', padding: '7px 12px', fontSize: '13px' }}
            value={historySearch} onChange={e => setHistorySearch(e.target.value)}
            placeholder={`🔍 ${t('search')}`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: 'rgba(67,56,202,.06)', borderRadius: '10px', padding: '8px 12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSales')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: '#4338ca' }}>{historyStats.count}</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: '10px', padding: '8px 12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalQty')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: '#FF6B2B' }}>{parseFloat(historyStats.qty.toFixed(3)).toString()}</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.06)', borderRadius: '10px', padding: '8px 12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('totalSum')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>+{fmtMoney(historyStats.sum)}</div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('quantity')}</th><th>{t('price')}</th><th>{t('supplier')}</th><th>{t('date')}</th></tr></thead>
            <tbody>
              {historyFiltered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData')}</td></tr>}
              {historyFiltered.map(item => (
                <tr key={item.id}>
                  <td><div style={{ fontWeight: 600 }}>{item.name_ru}</div>{item.barcode && <div style={{ fontSize: '11px', color: 'var(--text3)' }} className="mono">{item.barcode}</div>}</td>
                  <td><span className="mono" style={{ fontWeight: 700, color: 'var(--green)' }}>+{parseFloat(parseFloat(item.quantity).toFixed(3)).toString()} {item.unit}</span></td>
                  <td><span className="mono">{fmtNum(item.price || 0)}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{item.supplier || '—'}</td>
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
