import React, { useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { AuthContext } from '../App.jsx';
import { useMsg, fmtMoney, fmtNum, formatDate, formatTime } from '../utils.js';
import { useTranslation } from '../useTranslation.js';
import { Icon } from '../icons.jsx';
import useBarcodePrint from '../utils/useBarcodePrint.jsx';
import { normalizeDecimal } from '../utils/decimalInput.js';

// ── Числовые поля (цены, количество в заказе) ────────────────────────────────
// Стейт таких полей — СТРОКА, а сам input — type="text" inputMode="decimal".
// У type="number" браузер при промежуточно-невалидном вводе («45 000» с пробелом,
// «1,5» с запятой) отдаёт e.target.value = '' — контролируемое поле само себя
// очищало, и сохранялось не то, что ввели. Поэтому: в onChange только чистка
// символов, диапазон и округление — в onBlur.
const cleanDec = (v) => String(v ?? '').replace(/[^\d.,]/g, '');
const isBlank  = (v) => String(v ?? '').trim() === '';
// Строка поля → число. Запятая = десятичный разделитель (RU/UZ раскладка):
// без этой замены parseFloat('45,5') на сервере превратился бы в 45.
const toNum = (v) => {
  const n = parseFloat(normalizeDecimal(v));
  return Number.isFinite(n) ? n : NaN;
};
// Нормализация на blur: пустое остаётся пустым (поле можно полностью очистить),
// число зажимаем в диапазон и округляем. Нечисловой остаток НЕ превращаем в 0 —
// его поймает проверка при сохранении и покажет ошибку.
const normDec = (v, dp = 3, min = 0, max = Infinity) => {
  if (isBlank(v)) return '';
  const n = toNum(v);
  if (!Number.isFinite(n)) return cleanDec(v);
  return String(Number(Math.min(max, Math.max(min, n)).toFixed(dp)));
};
// onBlur-нормализатор поля формы: значение читаем сразу, а стейт обновляем
// функционально — чтобы не перетереть остальные поля формы (фото, категорию).
const blurNorm = (setState, key, dp) => (e) => {
  const v = e.target.value;
  setState(f => ({ ...f, [key]: normDec(v, dp) }));
};

export default function WarehouseBalance() {
  const { t, lang } = useTranslation();
  const { user } = useContext(AuthContext);
  const uz = lang === 'uz';
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [types, setTypes] = useState([]);
  const [editMsg, setEditMsg, clearEditMsg] = useMsg();
  // Email composer modal state
  const [emailDraft, setEmailDraft] = useState(null); // null | { supplierName, supplierId, from, to, subject, orderItems[], note }
  // All suppliers — used to let user pick one inside the email modal
  const [suppliers, setSuppliers] = useState([]);
  // Product picker inside the email modal
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // Multi-product select for bulk label printing
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Split view: id of the product whose detail card is open in the right pane.
  // We keep the ID (not the object) so the card stays fresh after edit/reload.
  const [selectedId, setSelectedId] = useState(null);
  // Photo lightbox — full-screen view of a product photo (null = closed).
  const [photoZoom, setPhotoZoom] = useState(null);
  // Unified barcode-print dialog (copies + size, saved per user) — shared across the app.
  const { openPrint, printModal } = useBarcodePrint(lang);

  useEffect(() => {
    load();
    api.get('/types').then(r => setTypes(r.data));
    api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/stock/balance');
    setItems(data);
    setLoading(false);
  };

  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  const filtered = items.filter(p => {
    const matchSearch = p.name_ru.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search);
    if (!matchSearch) return false;
    if (filter === 'low') return parseFloat(p.stock) > 0 && parseFloat(p.stock) < 5;
    if (filter === 'out') return parseFloat(p.stock) <= 0;
    return true;
  });

  const totalCost = items.reduce((s, p) => s + parseFloat(p.stock) * parseFloat(p.price_buy || 0), 0);
  const lowCount  = items.filter(p => parseFloat(p.stock) > 0 && parseFloat(p.stock) < 5).length;
  const outCount  = items.filter(p => parseFloat(p.stock) <= 0).length;

  // Currently-open product in the right detail pane (resolved fresh from items).
  const selected = selectedId == null ? null : (items.find(i => i.id === selectedId) || null);

  const openEdit = (item) => {
    setEditItem(item);
    // photo_url и category_id ОБЯЗАТЕЛЬНО в форме: без них сохранение затирало фото
    // и категорию товара (жалоба «при сохранении стираются фотографии»).
    setEditForm({ name_ru: item.name_ru, name_uz: item.name_uz || '', type_id: item.type_id || '',
      category_id: item.category_id || '', barcode: item.barcode || '', unit: item.unit || 'шт',
      // Цены — строками: «45000.00» из БД приводим к «45000», чтобы поле можно
      // было дописать и полностью стереть.
      price_buy: item.price_buy == null ? '' : normDec(item.price_buy, 2),
      price_sell: item.price_sell == null ? '' : normDec(item.price_sell, 2),
      color_size: item.color_size || '', brand: item.brand || '',
      photo_url: item.photo_url || '' });
    clearEditMsg();
  };

  // Замена фото прямо в форме редактирования: файл → /upload/photo → url в форму.
  const uploadEditPhoto = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await api.post('/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditForm(f => ({ ...f, photo_url: data.url }));
      clearEditMsg();
    } catch (e) {
      setEditMsg('error', e.response?.data?.error || (uz ? 'Suratni yuklab bo\'lmadi' : 'Не удалось загрузить фото'));
    } finally { setUploadingPhoto(false); }
  };

  const handleEditSave = async () => {
    // Цены в стейте — строки. Приводим их к числам ЗДЕСЬ: пустое поле отправляем
    // как '' (сервер трактует это как «не задано» и оставляет прежнюю цену), а
    // нечисловую строку не отправляем вовсе — показываем ошибку.
    const prices = {};
    for (const [key, label] of [
      ['price_buy',  uz ? 'Sotib olish narxi' : 'Цена закупки'],
      ['price_sell', uz ? 'Sotish narxi'      : 'Цена продажи'],
    ]) {
      if (isBlank(editForm[key])) { prices[key] = ''; continue; }
      const n = toNum(editForm[key]);
      if (!Number.isFinite(n) || n < 0) {
        setEditMsg('error', `${label}: ${uz ? 'raqam kiriting' : 'введите число'}`);
        return;
      }
      prices[key] = n;
    }
    try {
      await api.put(`/products/${editItem.id}`, { ...editForm, ...prices });
      setEditMsg('success', t('success'));
      setEditItem(null);
      load();
    } catch (e) { setEditMsg('error', e.response?.data?.error || t('error')); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${t('delete')} "${name}"?`)) return;
    try { await api.delete(`/products/${id}`); if (id === selectedId) setSelectedId(null); load(); }
    catch (e) { alert(e.response?.data?.error || t('error')); }
  };

  const statusColor = (stock) => parseFloat(stock) <= 0 ? 'var(--red)' : parseFloat(stock) < 5 ? 'var(--yellow)' : 'var(--green)';
  const statusLabel = (stock) => parseFloat(stock) <= 0 ? t('outStatus') : parseFloat(stock) < 5 ? t('lowStatus') : t('inStockStatus');

  // "From" label that goes into the body (mailto: can't set From — the user's email client does)
  const fromLabel = () => {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '';
    const company = user?.company_name || '';
    const branch = user?.branch_name || '';
    return [company, branch, name].filter(Boolean).join(' · ');
  };

  // Language-aware templates for the order email
  const tpl = {
    subjOrder: (n) => uz ? `Buyurtma (${n} ta pozitsiya)` : `Заказ (${n} позиций)`,
    greeting: (name) => uz
      ? `Assalomu alaykum${name ? ', ' + name : ''}!`
      : `Здравствуйте${name ? ', ' + name : ''}!`,
    intro: () => uz
      ? `Quyidagi tovarlarni yetkazib berishingizni iltimos qilamiz:`
      : `Просим организовать поставку следующих товаров:`,
    qtyLabel: () => uz ? 'Buyurtma' : 'Заказ',
    stockShort: () => uz ? 'qoldiq' : 'остаток',
    closing: () => uz
      ? `Iltimos, narx va yetkazib berish muddatini tasdiqlang.`
      : `Просим подтвердить цену и срок поставки.`,
    signOff: () => uz ? 'Hurmat bilan,' : 'С уважением,',
    pickSupplier: (labels) => uz
      ? `Yetkazuvchini tanlang (raqamini kiriting):\n${labels}`
      : `Выберите поставщика (введите номер):\n${labels}`,
    noteHeader: () => uz ? 'Qo\'shimcha:' : 'Доп.:',
  };

  // Build subject from order items list (1 item → single name, more → "N позиций")
  const buildSubject = (orderItems) => {
    if (orderItems.length === 0) return uz ? 'Buyurtma' : 'Заказ';
    if (orderItems.length === 1) {
      const it = orderItems[0];
      return uz ? `Buyurtma: ${it.name}` : `Заказ: ${it.name}`;
    }
    return tpl.subjOrder(orderItems.length);
  };

  // Build email body from current draft state. Re-computed on every send/preview.
  const buildBody = (draft) => {
    const lines = (draft.orderItems || []).map(it => {
      // Количество нормализуем перед отправкой: «1,5» → 1.5, а пустое/нечисловое
      // остаётся прочерком — молчаливый 0 в письме поставщику недопустим.
      const qtyNum = toNum(it.qty);
      const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? String(Number(qtyNum.toFixed(3))) : '___';
      const stockTxt = it.stock != null ? ` (${tpl.stockShort()}: ${parseFloat(it.stock)} ${it.unit || ''})` : '';
      const barcodeTxt = it.barcode ? ` [${it.barcode}]` : '';
      return `  • ${it.name}${barcodeTxt} — ${tpl.qtyLabel()}: ${qty} ${it.unit || ''}${stockTxt}`;
    }).join('\n');
    const noteBlock = draft.note ? `\n\n${tpl.noteHeader()} ${draft.note}` : '';
    return `${tpl.greeting(draft.supplierName)}

${tpl.intro()}

${lines}

${tpl.closing()}${noteBlock}

${tpl.signOff()}
${draft.from || fromLabel()}`;
  };

  // Open composer for a SINGLE product — pre-add to order with empty qty for user to fill
  const emailSupplier = (item) => {
    const supplierName = item.last_supplier_name || '';
    const name = uz && item.name_uz ? item.name_uz : item.name_ru;
    const orderItems = [{
      product_id: item.id, name, barcode: item.barcode, unit: item.unit,
      stock: item.stock, qty: '',
    }];
    setEmailDraft({
      supplierName, supplierId: item.last_supplier_id || null,
      from: fromLabel(), to: item.last_supplier_email || '',
      subject: buildSubject(orderItems),
      orderItems, note: '',
    });
  };

  // Picker — when user selects a supplier from the dropdown in the modal
  const pickSupplierForDraft = (supplierId) => {
    if (!emailDraft) return;
    const sup = suppliers.find(s => s.id === Number(supplierId));
    if (!sup) {
      setEmailDraft({ ...emailDraft, supplierId: null, supplierName: '', to: '' });
      return;
    }
    setEmailDraft({ ...emailDraft, supplierId: sup.id, supplierName: sup.name, to: sup.email || '' });
  };
  // Order list manipulation
  const addOrderItem = (product) => {
    if (!emailDraft) return;
    if (emailDraft.orderItems.some(it => it.product_id === product.id)) { setPickerOpen(false); setPickerQuery(''); return; }
    const name = uz && product.name_uz ? product.name_uz : product.name_ru;
    const newItems = [...emailDraft.orderItems, { product_id: product.id, name, barcode: product.barcode, unit: product.unit, stock: product.stock, qty: '' }];
    setEmailDraft({ ...emailDraft, orderItems: newItems, subject: buildSubject(newItems) });
    setPickerOpen(false); setPickerQuery('');
  };
  const removeOrderItem = (pid) => {
    if (!emailDraft) return;
    const newItems = emailDraft.orderItems.filter(it => it.product_id !== pid);
    setEmailDraft({ ...emailDraft, orderItems: newItems, subject: buildSubject(newItems) });
  };
  const setOrderItemQty = (pid, qty) => {
    if (!emailDraft) return;
    setEmailDraft({ ...emailDraft, orderItems: emailDraft.orderItems.map(it => it.product_id === pid ? { ...it, qty } : it) });
  };

  // Bulk
  const bulkEmail = () => {
    const lowOrOut = items.filter(p => parseFloat(p.stock) < 5 && p.last_supplier_email);
    if (lowOrOut.length === 0) { alert(t('noLowItemsWithEmail')); return; }
    const groups = new Map();
    for (const p of lowOrOut) {
      const key = p.last_supplier_id;
      if (!groups.has(key)) groups.set(key, { email: p.last_supplier_email, name: p.last_supplier_name, items: [] });
      groups.get(key).items.push(p);
    }
    const supplierList = [...groups.values()];
    let target;
    if (supplierList.length === 1) {
      target = supplierList[0];
    } else {
      const labels = supplierList.map((g, i) => `${i+1}. ${g.name} — ${g.items.length} ${uz ? 'ta' : 'шт.'}`).join('\n');
      const picked = prompt(tpl.pickSupplier(labels));
      const idx = parseInt(picked) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= supplierList.length) return;
      target = supplierList[idx];
    }
    const orderItems = target.items.map(p => ({
      product_id: p.id,
      name: (uz && p.name_uz) ? p.name_uz : p.name_ru,
      barcode: p.barcode, unit: p.unit, stock: p.stock, qty: '',
    }));
    setEmailDraft({
      supplierName: target.name, supplierId: target.items[0]?.last_supplier_id || null,
      from: fromLabel(), to: target.email,
      subject: buildSubject(orderItems),
      orderItems, note: '',
    });
  };

  // Send actions — body is computed live from the current draft state
  const openMailto = () => {
    if (!emailDraft) return;
    const body = buildBody(emailDraft);
    const url = `mailto:${encodeURIComponent(emailDraft.to)}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };
  const openGmail = () => {
    if (!emailDraft) return;
    const body = buildBody(emailDraft);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailDraft.to)}&su=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const copyEmailText = async () => {
    if (!emailDraft) return;
    const body = buildBody(emailDraft);
    const text = `${uz ? 'Kimga' : 'Кому'}: ${emailDraft.to}\n${uz ? 'Mavzu' : 'Тема'}: ${emailDraft.subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      alert(uz ? 'Nusxalandi!' : 'Скопировано!');
    } catch { alert(uz ? 'Nusxalashda xato' : 'Не удалось скопировать'); }
  };

  // Per-row single-product print — opens the unified print dialog (copies + size).
  const printBarcode = (item) => openPrint([item]);

  // Bulk print all selected products — opens the unified print dialog.
  const printSelected = () => openPrint(filtered.filter(it => selectedIds.has(it.id)));

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleWithBarcode = filtered.filter(it => it.barcode).map(it => it.id);
    setSelectedIds(prev => {
      const allSelected = visibleWithBarcode.length > 0 && visibleWithBarcode.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleWithBarcode.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleWithBarcode.forEach(id => next.add(id));
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 0 }}>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '20px', flexShrink: 0 }}>
        {[
          { label: t('positions'), value: items.length,    color: 'var(--primary)' },
          { label: t('lowStock'),  value: lowCount,        color: 'var(--yellow)' },
          { label: t('outOfStock'),value: outCount,        color: 'var(--red)' },
          { label: t('costPrice'), value: fmtMoney(totalCost), color: 'var(--orange)', small: true },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value mono" style={{ color: s.color, fontSize: s.small ? '16px' : undefined }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <span style={{ color: 'var(--text3)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('search')}...`} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              ['all',  t('allFilter')],
              ['low',  `${t('lowFilter')} (${lowCount})`],
              ['out',  `${t('outFilter')} (${outCount})`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-ghost'}`}>{label}</button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={bulkEmail}
            style={{ background: 'rgba(34,197,94,.12)', color: '#16a34a', border: 'none', fontWeight: 700 }}
            title={t('emailLowStockSuppliers') || 'Письмо поставщикам по товарам с низким остатком'}>
            ✉️ {t('emailSuppliers') || 'Письмо поставщикам'}
          </button>
          {/* Bulk-print button — visible only when products are selected.
              Copies + label size are chosen in the print dialog itself. */}
          {selectedIds.size > 0 && (
            <button className="btn btn-sm" onClick={printSelected}
              style={{ background: 'linear-gradient(135deg, #4338ca, #5b4fe8)', color: '#fff', border: 'none', fontWeight: 800 }}
              title={uz ? `${selectedIds.size} ta mahsulotni chop etish` : `Печать ${selectedIds.size} выбранных`}>
              🖨️ {uz ? 'Tanlanganni chop etish' : 'Печать выбранных'} ({selectedIds.size})
            </button>
          )}
          {selectedIds.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}
              title={uz ? 'Tanlovni tozalash' : 'Снять выделение'}>
              ✕
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load}>{t('refresh')}</button>
        </div>

        {/* Split layout: products table on the left, scrollable product card on the right */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '14px' }}>
          {loading ? (
            <div className="center" style={{ flex: 1, padding: '40px' }}><div className="spinner" /></div>
          ) : (
            <div className="table-wrap" style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={(() => {
                          const v = filtered.filter(it => it.barcode);
                          return v.length > 0 && v.every(it => selectedIds.has(it.id));
                        })()}
                        onChange={toggleSelectAllVisible}
                        title={uz ? 'Hammasini tanlash / olib tashlash' : 'Выбрать всё / снять'}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                    </th>
                    <th>{t('name')}</th>
                    <th>{t('type')}</th>
                    <th>{t('barcode')}</th>
                    <th>{t('stock')}</th>
                    <th>{t('priceBuy')}</th>
                    <th>{t('priceSell')}</th>
                    <th>{t('saleSum')}</th>
                    <th>{t('status')}</th>
                    <th>{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px' }}>{t('noData')}</td></tr>
                  )}
                  {filtered.map(item => {
                    const clr = statusColor(item.stock);
                    const isChecked = selectedIds.has(item.id);
                    const isActive = item.id === selectedId;
                    return (
                      <tr key={item.id}
                        onClick={() => setSelectedId(isActive ? null : item.id)}
                        title={uz ? 'Kartochkani ochish' : 'Открыть карточку'}
                        style={{ cursor: 'pointer', background: isActive ? 'rgba(67,56,202,.12)' : isChecked ? 'rgba(67,56,202,.05)' : undefined }}>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(item.id)}
                            disabled={!item.barcode}
                            title={!item.barcode ? (uz ? 'Shtrix-kod yo\'q' : 'Нет штрих-кода') : (uz ? 'Etiketkaga tanlash' : 'Выбрать для печати')}
                            style={{ cursor: item.barcode ? 'pointer' : 'not-allowed', width: '16px', height: '16px', opacity: item.barcode ? 1 : 0.3 }} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.photo_url && <img src={item.photo_url} alt=""
                              onClick={e => { e.stopPropagation(); setPhotoZoom(item.photo_url); }}
                              title={uz ? 'Suratni ochish' : 'Открыть фото'}
                              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', cursor: 'zoom-in' }} />}
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.name_ru}</div>
                              {(item.color_size || item.brand) && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{[item.color_size, item.brand].filter(Boolean).join(' · ')}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{item.type_name || '—'}</td>
                        <td><span className="mono" style={{ fontSize: '12px', color: 'var(--text2)' }}>{item.barcode || '—'}</span></td>
                        <td>
                          <span className="mono" style={{ fontWeight: 700, color: clr }}>{fmtQty(item.stock)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>{item.unit}</span>
                        </td>
                        <td><span className="mono">{fmtNum(item.price_buy || 0)}</span></td>
                        <td><span className="mono">{fmtNum(item.price_sell || 0)}</span></td>
                        <td><span className="mono" style={{ fontWeight: 600 }}>{fmtNum(parseFloat(item.stock) * parseFloat(item.price_sell || 0))}</span></td>
                        <td><span style={{ fontSize: '12px', fontWeight: 700, color: clr, background: clr + '18', padding: '3px 10px', borderRadius: '20px' }}>{statusLabel(item.stock)}</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap', lineHeight: '1.3' }}>
                          <div>{formatDate(item.created_at)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{formatTime(item.created_at)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Right product card (scrollable) ── */}
          {selected && (
            <div style={{ width: '380px', flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 4px 18px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                  {selected.photo_url
                    ? <button type="button" onClick={() => setPhotoZoom(selected.photo_url)}
                        title={uz ? 'Suratni ochish' : 'Открыть фото'}
                        style={{ width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: 'none', padding: 0, background: 'none', cursor: 'zoom-in', position: 'relative' }}>
                        <img src={selected.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <span style={{ position: 'absolute', right: 0, bottom: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '11px', lineHeight: 1, padding: '2px 4px', borderTopLeftRadius: '6px' }}>🔍</span>
                      </button>
                    : <div style={{ width: '72px', height: '72px', borderRadius: '12px', background: '#F4F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="box" size={26} color="var(--text3)" /></div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', lineHeight: 1.25 }}>{selected.name_ru}</div>
                    {selected.name_uz && <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{selected.name_uz}</div>}
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor(selected.stock), background: statusColor(selected.stock) + '18', padding: '3px 10px', borderRadius: '20px' }}>{statusLabel(selected.stock)}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)} title={t('close') || 'Закрыть'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text3)', lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>

                {/* Big print button */}
                <button onClick={() => printBarcode(selected)} disabled={!selected.barcode} className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '14px', fontSize: '15px', fontWeight: 800, marginBottom: '6px', opacity: selected.barcode ? 1 : 0.5, cursor: selected.barcode ? 'pointer' : 'not-allowed' }}>
                  🖨️ {t('printBarcode') || 'Печать штрих-кода'}
                </button>
                {!selected.barcode && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center', marginBottom: '8px' }}>{uz ? 'Shtrix-kod yo\'q' : 'Нет штрих-кода'}</div>
                )}

                {/* Email + Edit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0 16px' }}>
                  <button onClick={() => emailSupplier(selected)} className="btn"
                    style={{ justifyContent: 'center', gap: '6px', background: 'rgba(34,197,94,.12)', color: '#16a34a', border: 'none', fontWeight: 700 }}>
                    ✉️ {uz ? 'Pochta' : 'Письмо'}
                  </button>
                  <button onClick={() => openEdit(selected)} className="btn btn-ghost" style={{ justifyContent: 'center', gap: '6px' }}>
                    <Icon name="edit" size={14} color="var(--primary)" /> {t('edit')}
                  </button>
                </div>

                {/* Parameters */}
                <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                  {[
                    [t('type'), selected.type_name || '—'],
                    [t('brand'), selected.brand || '—'],
                    [t('colorSize'), selected.color_size || '—'],
                    [t('barcode'), selected.barcode || '—', true],
                    [t('stock'), `${fmtQty(selected.stock)} ${selected.unit || ''}`],
                    [t('priceBuy'), fmtNum(selected.price_buy || 0)],
                    [t('priceSell'), fmtNum(selected.price_sell || 0)],
                    [t('saleSum'), fmtNum(parseFloat(selected.stock) * parseFloat(selected.price_sell || 0))],
                    [t('date'), `${formatDate(selected.created_at)} ${formatTime(selected.created_at)}`],
                  ].map(([k, v, mono], i) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{k}</span>
                      <span className={mono ? 'mono' : ''} style={{ fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Delete */}
                <button onClick={() => handleDelete(selected.id, selected.name_ru)} className="btn"
                  style={{ width: '100%', justifyContent: 'center', gap: '6px', background: 'rgba(239,68,68,.08)', color: 'var(--red)', border: 'none', fontWeight: 700 }}>
                  <Icon name="trash" size={14} color="var(--red)" /> {t('delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unified barcode-print dialog (copies + size) */}
      {printModal}

      {/* Photo lightbox — click anywhere to close */}
      {photoZoom && (
        <div onClick={() => setPhotoZoom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px', cursor: 'zoom-out' }}>
          <img src={photoZoom} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
          <button onClick={() => setPhotoZoom(null)} title={t('close') || 'Закрыть'}
            style={{ position: 'fixed', top: '18px', right: '22px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,.16)', color: '#fff', border: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Email composer modal */}
      {emailDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setEmailDraft(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>✉️ {t('emailToSupplier') || 'Письмо поставщику'}</div>
              <button onClick={() => setEmailDraft(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
              {t('emailComposerHint') || 'После «Отправить» откроется ваш почтовый клиент с этим письмом — проверьте и нажмите «Отправить» уже там.'}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('from') || 'От'}</label>
                <input className="input" value={emailDraft.from}
                  onChange={e => setEmailDraft({ ...emailDraft, from: e.target.value })} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  {t('fromHint') || 'Эта подпись попадёт в текст письма. Сам отправитель = ваш email-аккаунт.'}
                </div>
              </div>
              {/* Supplier picker — only shown when we have suppliers to pick from */}
              {suppliers.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <label className="label">📦 {t('supplier') || 'Поставщик'}</label>
                  <select className="input"
                    value={emailDraft.supplierId || ''}
                    onChange={e => pickSupplierForDraft(e.target.value)}>
                    <option value="">— {uz ? 'manual kiritish' : 'ввести вручную'} —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.email ? ` · ${s.email}` : ` · ${uz ? 'email yo\'q' : 'нет email'}`}
                      </option>
                    ))}
                  </select>
                  {emailDraft.supplierId && !suppliers.find(s => s.id === emailDraft.supplierId)?.email && (
                    <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>
                      ⚠️ {uz ? 'Tanlangan yetkazib beruvchida email yo\'q — qo\'lda kiriting' : 'У выбранного поставщика нет email — введите вручную ниже'}
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('to') || 'Кому'} *</label>
                <input className="input" type="email" value={emailDraft.to}
                  onChange={e => setEmailDraft({ ...emailDraft, to: e.target.value })} placeholder="supplier@example.com" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label className="label">{t('subject') || 'Тема'} *</label>
                <input className="input" value={emailDraft.subject}
                  onChange={e => setEmailDraft({ ...emailDraft, subject: e.target.value })} />
              </div>

              {/* Order items table */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="label" style={{ marginBottom: 0 }}>📋 {uz ? 'Buyurtma' : 'Заказ'} ({emailDraft.orderItems.length})</label>
                  <button type="button" onClick={() => setPickerOpen(v => !v)}
                    style={{ padding: '6px 12px', background: 'rgba(67,56,202,.10)', border: 'none', borderRadius: '8px', color: '#4338ca', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
                    + {uz ? 'Tovar qo\'shish' : 'Добавить товар'}
                  </button>
                </div>

                {/* Picker */}
                {pickerOpen && (
                  <div style={{ marginBottom: '10px', border: '1.5px solid #E2E4F0', borderRadius: '10px', background: '#F9FAFB' }}>
                    <input className="input" autoFocus value={pickerQuery}
                      onChange={e => setPickerQuery(e.target.value)}
                      placeholder={uz ? 'Tovar nomi yoki shtrix-kod...' : 'Название или штрих-код...'}
                      style={{ margin: '8px', width: 'calc(100% - 16px)', fontSize: '13px' }} />
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {items
                        .filter(p => {
                          if (emailDraft.orderItems.some(oi => oi.product_id === p.id)) return false;
                          if (!pickerQuery.trim()) return true;
                          const q = pickerQuery.toLowerCase();
                          return p.name_ru.toLowerCase().includes(q) || (p.barcode || '').includes(pickerQuery);
                        })
                        .slice(0, 50)
                        .map(p => (
                          <div key={p.id} onClick={() => addOrderItem(p)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #E2E4F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.name_ru}</div>
                              {p.barcode && <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'monospace' }}>{p.barcode}</div>}
                            </div>
                            <div style={{ fontSize: '11px', color: parseFloat(p.stock) <= 0 ? 'var(--red)' : parseFloat(p.stock) < 5 ? 'var(--orange)' : 'var(--green)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {parseFloat(parseFloat(p.stock).toFixed(3)).toString()} {p.unit}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {emailDraft.orderItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', background: '#F4F5FA', borderRadius: '10px', fontSize: '13px' }}>
                    {uz ? 'Tovar qo\'shilmagan. «+ Tovar qo\'shish»ni bosing.' : 'Товаров не добавлено. Нажмите «+ Добавить товар».'}
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E4F0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#F4F5FA' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{uz ? 'Tovar' : 'Товар'}</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{uz ? 'Qoldiq' : 'Остаток'}</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', width: '110px' }}>{uz ? 'Buyurtma' : 'Заказ'}</th>
                          <th style={{ width: '40px' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {emailDraft.orderItems.map(it => (
                          <tr key={it.product_id} style={{ borderTop: '1px solid #F4F5FA' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.name}{it.barcode && <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'monospace' }}>{it.barcode}</div>}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {parseFloat(parseFloat(it.stock || 0).toFixed(3)).toString()} {it.unit}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input type="text" inputMode="decimal"
                                value={it.qty}
                                onChange={e => setOrderItemQty(it.product_id, cleanDec(e.target.value))}
                                onBlur={e => setOrderItemQty(it.product_id, normDec(e.target.value, 3))}
                                placeholder="0"
                                style={{ width: '100%', textAlign: 'right', padding: '6px 8px', border: '1.5px solid #E2E4F0', borderRadius: '6px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, outline: 'none' }} />
                            </td>
                            <td style={{ padding: '6px' }}>
                              <button type="button" onClick={() => removeOrderItem(it.product_id)}
                                title={uz ? 'O\'chirish' : 'Удалить'}
                                style={{ width: '28px', height: '28px', background: 'rgba(239,68,68,.08)', border: 'none', borderRadius: '6px', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Optional note */}
              <div style={{ marginBottom: '12px' }}>
                <label className="label">{uz ? 'Qo\'shimcha (ixtiyoriy)' : 'Доп. примечание (опционально)'}</label>
                <textarea className="input" rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  value={emailDraft.note}
                  onChange={e => setEmailDraft({ ...emailDraft, note: e.target.value })}
                  placeholder={uz ? 'Masalan: shoshilinch, kechgacha kerak...' : 'Например: срочно, нужно до вечера...'} />
              </div>

              {/* Live preview (collapsible) */}
              <details style={{ marginBottom: '12px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--text2)', padding: '6px 0' }}>
                  ▼ {uz ? 'Xatning ko\'rinishi' : 'Превью письма'}
                </summary>
                <pre style={{ background: '#F4F5FA', padding: '12px', borderRadius: '8px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.5, marginTop: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {buildBody(emailDraft)}
                </pre>
              </details>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <button onClick={openGmail}
                disabled={!emailDraft.to.trim() || !emailDraft.subject.trim()}
                style={{ padding: '10px 12px', borderRadius: '10px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
                📧 Gmail
              </button>
              <button onClick={openMailto}
                disabled={!emailDraft.to.trim() || !emailDraft.subject.trim()}
                style={{ padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #5B4FE8, #3D33C4)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
                ✉️ {uz ? 'Pochta dasturi' : 'Почта'}
              </button>
              <button onClick={copyEmailText}
                style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #E2E4F0', background: '#fff', color: '#6B6F8A', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
                📋 {uz ? 'Nusxalash' : 'Копировать'}
              </button>
            </div>
            <button onClick={() => setEmailDraft(null)}
              style={{ marginTop: '10px', width: '100%', padding: '10px', background: 'transparent', border: '1.5px solid #E2E4F0', borderRadius: '10px', color: '#6B6F8A', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
              {t('cancel') || 'Отмена'}
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{t('editProduct')}</div>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text3)' }}>×</button>
            </div>
            {editMsg && <div className={`alert alert-${editMsg.type}`}>{editMsg.text}</div>}
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div><label className="label">{t('nameRu')}</label><input className="input" maxLength={200} value={editForm.name_ru} onChange={e => setEditForm({ ...editForm, name_ru: e.target.value })} /></div>
              <div><label className="label">{t('nameUz')}</label><input className="input" maxLength={200} value={editForm.name_uz} onChange={e => setEditForm({ ...editForm, name_uz: e.target.value })} /></div>
            </div>
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="label">{t('type')}</label>
                <select className="input" value={editForm.type_id} onChange={e => setEditForm({ ...editForm, type_id: e.target.value })}>
                  <option value="">—</option>
                  {types.map(tp => <option key={tp.id} value={tp.id}>{tp.name_ru}</option>)}
                </select>
              </div>
              <div><label className="label">{t('unit')}</label><input className="input" maxLength={32} value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} /></div>
            </div>
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div><label className="label">{t('priceBuy')}</label><input className="input" type="text" inputMode="decimal" value={editForm.price_buy}
                onChange={e => setEditForm({ ...editForm, price_buy: cleanDec(e.target.value) })}
                onBlur={blurNorm(setEditForm, 'price_buy', 2)} /></div>
              <div><label className="label">{t('priceSell')}</label><input className="input" type="text" inputMode="decimal" value={editForm.price_sell}
                onChange={e => setEditForm({ ...editForm, price_sell: cleanDec(e.target.value) })}
                onBlur={blurNorm(setEditForm, 'price_sell', 2)} /></div>
            </div>
            <div className="form-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="label">{t('colorSize')}</label>
                <input className="input" maxLength={255} value={editForm.color_size} onChange={e => setEditForm({ ...editForm, color_size: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('brand')}</label>
                <input className="input" maxLength={150} value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{t('barcode')}</label>
              <input className="input mono" maxLength={50} value={editForm.barcode} onChange={e => setEditForm({ ...editForm, barcode: e.target.value })} />
            </div>

            {/* Фото товара — раньше его нельзя было менять при редактировании,
                и оно к тому же затиралось при сохранении. */}
            <div style={{ marginBottom: '20px' }}>
              <label className="label">{uz ? 'Surat' : 'Фото товара'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--line)', background: '#F4F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {editForm.photo_url
                    ? <img src={editForm.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (
                      /* Line-иконка вместо эмодзи — канон светлой темы. */
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 8.5A2 2 0 0 1 5 6.5h1.6a1 1 0 0 0 .83-.45l.74-1.1A1 1 0 0 1 9 4.5h6a1 1 0 0 1 .83.45l.74 1.1a1 1 0 0 0 .83.45H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z" />
                        <circle cx="12" cy="12.5" r="3.2" />
                      </svg>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="btn btn-ghost btn-sm" style={{ cursor: uploadingPhoto ? 'progress' : 'pointer' }}>
                    {uploadingPhoto ? (uz ? 'Yuklanmoqda…' : 'Загрузка…') : (uz ? 'Suratni almashtirish' : 'Заменить фото')}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingPhoto}
                      onChange={e => uploadEditPhoto(e.target.files?.[0])} />
                  </label>
                  {editForm.photo_url && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                      onClick={() => setEditForm({ ...editForm, photo_url: '' })}>
                      {uz ? 'Olib tashlash' : 'Убрать'}
                    </button>
                  )}
                </div>
              </div>
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
