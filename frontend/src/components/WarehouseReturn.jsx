import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App.jsx';
import api from '../api.js';
import { formatDate, formatTime, useMsg, fmtMoney, fmtNum } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import SupplierCombobox from './SupplierCombobox.jsx';
import ProductCombobox from './ProductCombobox.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

// Числовые поля (количество, деньги) держим СТРОКОЙ и type="text":
// у type="number" Chrome отдаёт e.target.value === '' на промежуточно-невалидном
// вводе («1,5», «250 000»), и контролируемое поле само себя очищает — человек
// «не может ввести число». В onChange только чистка символов, нормализация и
// округление — на onBlur.
const cleanDec = (s) => String(s).replace(/[^\d.,\s]/g, '');
// Строка поля → число. Пустое/мусор → NaN, чтобы вызывающий сам решил, что делать
// (в расчёты и на сервер NaN уходить не должен).
const toNum = (s) => {
  const v = normalizeDecimal(s);
  if (v === '' || v === '.') return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};
// Приведение к аккуратному виду на уходе фокуса: пустое остаётся пустым,
// иначе убираем пробелы, запятую меняем на точку, режем лишние знаки.
const normDec = (s, decimals) => {
  const n = toNum(s);
  if (!Number.isFinite(n)) return '';
  return String(parseFloat(Math.max(0, n).toFixed(decimals)));
};

// Return goods TO the supplier (товар уходит обратно поставщику — обычно брак).
// Decrements stock; optionally records cash inflow if supplier refunded the money.
export default function WarehouseReturn() {
  const { t, lang } = useTranslation();
  const { user } = useContext(AuthContext);
  const uz = lang === 'uz';
  const [products, setProducts] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    product_id: '', quantity: '', supplier_id: null, refund_amount: '',
    payment_method: 'cash', note: '',
  });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);
  const loadAll = async () => {
    const [p, l] = await Promise.all([
      api.get('/products'),
      api.get('/stock/outcome-list'),
    ]);
    setProducts(p.data);
    setList((l.data || []).filter(i => i.outcome_type === 'return_to_supplier'));
  };

  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));
  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  // Считаем один раз: и для проверки, и для показа блока способа оплаты.
  const qtyNum = toNum(form.quantity);
  const refundNum = toNum(form.refund_amount);

  const submit = async (e) => {
    e.preventDefault();
    // Своя проверка вместо required: у type="text" нативного пузыря нет, а с
    // required на type="number" браузер ругался «Введите число» на заполненном
    // с виду поле и вообще не давал отправить форму.
    if (!form.product_id || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setMsg('error', uz ? 'Tovar va miqdor majburiy' : 'Товар и количество обязательны');
      return;
    }
    if (!form.supplier_id) {
      setMsg('error', uz ? 'Yetkazib beruvchini tanlang' : 'Выберите поставщика');
      return;
    }
    setLoading(true);
    try {
      await api.post('/stock/return-to-supplier', {
        product_id: parseInt(form.product_id),
        quantity: qtyNum,
        supplier_id: form.supplier_id,
        refund_amount: Number.isFinite(refundNum) && refundNum > 0 ? refundNum : 0,
        payment_method: form.payment_method,
        note: form.note,
      });
      setMsg('success', uz ? 'Vozvrat ro\'yxatga olindi' : 'Возврат зарегистрирован');
      setForm({ product_id: '', quantity: '', supplier_id: null, refund_amount: '', payment_method: 'cash', note: '' });
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || (uz ? 'Xato' : 'Ошибка')); }
    setLoading(false);
  };

  return (
    <div className="grid-2" style={{ flex: 1, minHeight: 0, height: '100%', alignItems: 'stretch' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div className="section-title">↩️ {uz ? 'Yetkazib beruvchiga qaytarish' : 'Возврат поставщику'}</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
          {uz ? 'Tovar omborda yo\'q bo\'lib qaytadi. Pul qaytarilsa, kassada kirim hisoblanadi.' : 'Товар уходит со склада обратно поставщику. Если возвращают деньги — учтётся как приход кассы.'}
        </div>

        {msg && <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{msg.text}</span><button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button></div>}

        <form onSubmit={submit}>
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
            <div style={{ background: 'rgba(245,158,11,.08)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedProduct.name_ru}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                {uz ? 'Qoldiq' : 'Остаток'}: <span className="mono" style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtQty(selectedProduct.stock)} {selectedProduct.unit}</span>
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginBottom: '12px' }}>
            <div>
              <label className="label">{uz ? 'Miqdor' : 'Количество'} *</label>
              <input className="input mono" type="text" inputMode="decimal" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: cleanDec(e.target.value) }))}
                onBlur={() => setForm(f => ({ ...f, quantity: normDec(f.quantity, 3) }))}
                placeholder="0" />
            </div>
            <div>
              <label className="label">{uz ? 'Qaytarilgan summa (UZS)' : 'Возвращено денег (UZS)'}</label>
              <input className="input mono" type="text" inputMode="decimal" value={form.refund_amount}
                onChange={e => setForm(f => ({ ...f, refund_amount: cleanDec(e.target.value) }))}
                onBlur={() => setForm(f => ({ ...f, refund_amount: normDec(f.refund_amount, 2) }))}
                placeholder="0" />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="label">{uz ? 'Yetkazib beruvchi' : 'Поставщик'} *</label>
            <SupplierCombobox value={form.supplier_id} onChange={v => setForm({ ...form, supplier_id: v })} />
          </div>

          {Number.isFinite(refundNum) && refundNum > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label className="label">{uz ? 'Toʻlov usuli' : 'Способ оплаты'}</label>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: 'cash',     label: '💵 ' + (uz ? 'Naqd' : 'Нал') },
                  { key: 'card',     label: '💳 ' + (uz ? 'Karta' : 'Карта') },
                  { key: 'transfer', label: '🏦 ' + (uz ? 'O\'tkazma' : 'Перевод') },
                  { key: 'wire',     label: '📑 ' + (uz ? 'Hisobga oʻtkazish' : 'Перечисление') },
                ].map(o => (
                  <button key={o.key} type="button" onClick={() => setForm({ ...form, payment_method: o.key })}
                    style={{
                      padding: '6px 12px', borderRadius: '20px',
                      border: `1.5px solid ${form.payment_method === o.key ? '#4338ca' : '#E2E4F0'}`,
                      background: form.payment_method === o.key ? 'rgba(67,56,202,.08)' : '#fff',
                      color: form.payment_method === o.key ? '#4338ca' : '#6B6F8A',
                      cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                    }}>{o.label}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="label">{uz ? 'Izoh (sabab, dalil)' : 'Примечание (причина, документ)'}</label>
            <textarea className="input" rows={2} value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder={uz ? 'Masalan: brakli partiya № 123' : 'Например: бракованная партия № 123'} />
          </div>

          <button type="submit" className="btn btn-orange" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? (uz ? 'Saqlanmoqda...' : 'Сохранение...') : (uz ? 'Qaytarishni saqlash' : 'Записать возврат')}
          </button>
        </form>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>📋 {uz ? 'Qaytarish tarixi' : 'История возвратов'}</div>
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>{t('refresh') || 'Обновить'}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{uz ? 'Tovar' : 'Товар'}</th>
                <th style={{ textAlign: 'right' }}>{uz ? 'Miqdor' : 'Кол-во'}</th>
                <th>{uz ? 'Yetkazuvchi' : 'Поставщик'}</th>
                <th>{uz ? 'Sana' : 'Дата'}</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{uz ? 'Hozircha qaytarishlar yoʻq' : 'Возвратов пока нет'}</td></tr>}
              {list.map(item => (
                <tr key={item.id}>
                  <td>{item.name_ru}</td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 700, color: 'var(--orange)' }}>−{fmtQty(item.quantity)} {item.unit}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{item.supplier_name || '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}<br /><span style={{ color: 'var(--text3)' }}>{formatTime(item.created_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
