import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App.jsx';
import api from '../api.js';
import { formatDate, formatTime, useMsg } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import ProductCombobox from './ProductCombobox.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

// Количество держим СТРОКОЙ и type="text": у type="number" Chrome отдаёт
// e.target.value === '' на промежуточно-невалидном вводе («0,75» кг), и
// контролируемое поле само себя очищает — дробное количество ввести нельзя.
// В onChange только чистка символов, нормализация — на onBlur.
const cleanDec = (s) => String(s).replace(/[^\d.,\s]/g, '');
// Строка поля → число; пустое/мусор → NaN, чтобы NaN не ушёл на сервер.
const toNum = (s) => {
  const v = normalizeDecimal(s);
  if (v === '' || v === '.') return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};
// На уходе фокуса: пустое остаётся пустым, иначе убираем пробелы, запятую меняем
// на точку и режем до 3 знаков (склад считает с точностью до 0.001).
const normDec = (s, decimals) => {
  const n = toNum(s);
  if (!Number.isFinite(n)) return '';
  return String(parseFloat(Math.max(0, n).toFixed(decimals)));
};

// Spisanie / writeoff: tovar испорчен, утерян, истёк, разбит и т.п.
// Only decrements stock; no cash movement.
export default function WarehouseWriteoff() {
  const { t, lang } = useTranslation();
  const { user } = useContext(AuthContext);
  const uz = lang === 'uz';
  const [products, setProducts] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ product_id: '', quantity: '', writeoff_reason: '', note: '' });
  const [msg, setMsg, clearMsg] = useMsg();
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);
  const loadAll = async () => {
    const [p, l] = await Promise.all([
      api.get('/products'),
      api.get('/stock/outcome-list'),
    ]);
    setProducts(p.data);
    setList((l.data || []).filter(i => i.outcome_type === 'writeoff'));
  };

  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));
  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  const REASONS = uz ? [
    { key: 'damaged',  label: '💥 Sindi / shikastlandi' },
    { key: 'expired',  label: '⏰ Yaroqlilik muddati tugadi' },
    { key: 'lost',     label: '❓ Yo\'qoldi' },
    { key: 'stolen',   label: '🚨 O\'g\'irlandi' },
    { key: 'defect',   label: '⚠️ Zavod nuqsoni' },
    { key: 'other',    label: '📝 Boshqa' },
  ] : [
    { key: 'damaged',  label: '💥 Сломано / повреждено' },
    { key: 'expired',  label: '⏰ Истёк срок' },
    { key: 'lost',     label: '❓ Утеряно' },
    { key: 'stolen',   label: '🚨 Украдено' },
    { key: 'defect',   label: '⚠️ Заводской брак' },
    { key: 'other',    label: '📝 Другое' },
  ];

  const submit = async (e) => {
    e.preventDefault();
    // Своя проверка вместо required: у type="text" нативного пузыря нет, а с
    // required на type="number" браузер ругался «Введите число» на заполненном
    // с виду поле и не давал отправить форму.
    const qtyNum = toNum(form.quantity);
    if (!form.product_id || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setMsg('error', uz ? 'Tovar va miqdor majburiy' : 'Товар и количество обязательны');
      return;
    }
    if (!form.writeoff_reason) {
      setMsg('error', uz ? 'Sababni tanlang' : 'Выберите причину');
      return;
    }
    setLoading(true);
    try {
      await api.post('/stock/writeoff', {
        product_id: parseInt(form.product_id),
        quantity: qtyNum,
        reason: form.writeoff_reason,
        note: form.note,
      });
      setMsg('success', uz ? 'Spisanie ro\'yxatga olindi' : 'Списание зарегистрировано');
      setForm({ product_id: '', quantity: '', writeoff_reason: '', note: '' });
      loadAll();
    } catch (e) { setMsg('error', e.response?.data?.error || (uz ? 'Xato' : 'Ошибка')); }
    setLoading(false);
  };

  const reasonLabel = (key) => {
    const r = REASONS.find(r => r.key === key);
    return r ? r.label : key;
  };

  return (
    <div className="grid-2" style={{ flex: 1, minHeight: 0, height: '100%', alignItems: 'stretch' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div className="section-title">🗑️ {uz ? 'Spisanie (hisobdan chiqarish)' : 'Списание (брак, утеря)'}</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
          {uz ? 'Tovar omborda yo\'q. Pul harakatisiz. Misol: brak, yaroqlilik tugagan, o\'g\'rilik.' : 'Товар уходит со склада без денежного движения. Пример: брак, испорчено, утеряно.'}
        </div>

        {msg && <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{msg.text}</span><button onClick={clearMsg} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>×</button></div>}

        <form onSubmit={submit}>
          <div style={{ marginBottom: '12px' }}>
            <label className="label">{uz ? 'Tovar' : 'Товар'} *</label>
            <ProductCombobox
              products={products}
              value={form.product_id}
              onChange={(id) => setForm({ ...form, product_id: id })}
              accent="#dc2626"
              placeholder={uz ? 'Nom yoki shtrix-kod boʻyicha qidiring...' : 'Найдите по названию или штрих-коду...'}
            />
          </div>

          {selectedProduct && (
            <div style={{ background: 'rgba(220,38,38,.08)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedProduct.name_ru}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                {uz ? 'Qoldiq' : 'Остаток'}: <span className="mono" style={{ fontWeight: 700, color: 'var(--red)' }}>{fmtQty(selectedProduct.stock)} {selectedProduct.unit}</span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label className="label">{uz ? 'Miqdor' : 'Количество'} *</label>
            <input className="input mono" type="text" inputMode="decimal" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: cleanDec(e.target.value) }))}
              onBlur={() => setForm(f => ({ ...f, quantity: normDec(f.quantity, 3) }))}
              placeholder="0" />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="label">{uz ? 'Sabab' : 'Причина'} *</label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {REASONS.map(o => (
                <button key={o.key} type="button" onClick={() => setForm({ ...form, writeoff_reason: o.key })}
                  style={{
                    padding: '6px 12px', borderRadius: '20px',
                    border: `1.5px solid ${form.writeoff_reason === o.key ? '#dc2626' : '#E2E4F0'}`,
                    background: form.writeoff_reason === o.key ? 'rgba(220,38,38,.08)' : '#fff',
                    color: form.writeoff_reason === o.key ? '#dc2626' : '#6B6F8A',
                    cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                  }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="label">{uz ? 'Izoh' : 'Комментарий'}</label>
            <textarea className="input" rows={2} value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder={uz ? 'Qo\'shimcha tafsilotlar' : 'Дополнительные подробности'} />
          </div>

          <button type="submit" className="btn btn-danger" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? (uz ? 'Saqlanmoqda...' : 'Сохранение...') : (uz ? 'Spisat qilish' : 'Списать товар')}
          </button>
        </form>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexShrink: 0 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>📋 {uz ? 'Spisanie tarixi' : 'История списаний'}</div>
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>{t('refresh') || 'Обновить'}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{uz ? 'Tovar' : 'Товар'}</th>
                <th style={{ textAlign: 'right' }}>{uz ? 'Miqdor' : 'Кол-во'}</th>
                <th>{uz ? 'Sabab' : 'Причина'}</th>
                <th>{uz ? 'Sana' : 'Дата'}</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{uz ? 'Hozircha spisaniyalar yoʻq' : 'Списаний пока нет'}</td></tr>}
              {list.map(item => (
                <tr key={item.id}>
                  <td>{item.name_ru}</td>
                  <td style={{ textAlign: 'right' }}><span className="mono" style={{ fontWeight: 700, color: 'var(--red)' }}>−{fmtQty(item.quantity)} {item.unit}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text2)' }}>{reasonLabel(item.writeoff_reason)}</td>
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
