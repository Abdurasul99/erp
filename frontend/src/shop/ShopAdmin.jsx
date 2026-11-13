// Админка интернет-магазина (2026-11-13): товары витрины /shop/<адрес> — фото (до 8, первое — главное), названия RU/UZ,
// категория, цена, количество на складе, описание, «показывать на сайте»; настройки витрины (учредитель и директор).
// Панель учредителя → «Интернет-магазин»; у кассира и склада — «Товары магазина» в доке. Сервер: /api/shop-admin.
// «На склад» — приход с закупкой 0 (касса не трогается). Фото сжимаются в браузере до 1600 px перед загрузкой.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api.js';
import { useTt } from '../owner/tt.js';
import './shopAdmin.css';

const UZ = {
  'Интернет-магазин': 'Internet-do‘kon', 'Открыть сайт': 'Saytni ochish', 'Настройки': 'Sozlamalar', 'Добавить товар': 'Mahsulot qo‘shish',
  'На сайте': 'Saytda', 'Скрыт': 'Yashirin', 'Нет на складе': 'Omborda yo‘q', 'Нет цены': 'Narx yo‘q', 'Без фото': 'Rasmsiz', 'Все': 'Hammasi',
  'Не на сайте': 'Saytda emas', 'Поиск товара': 'Mahsulot qidirish', 'Изменить': 'O‘zgartirish', 'Скрыть с сайта': 'Saytdan yashirish',
  'Показать на сайте': 'Saytda ko‘rsatish', 'Загрузка…': 'Yuklanmoqda…', 'Повторить': 'Qayta urinish', 'шт': 'dona',
  'Интернет-магазин ещё не подключён': 'Internet-do‘kon hali ulanmagan', 'Подключить магазин': 'Do‘konni ulash',
  'Подключить магазин может учредитель или директор.': 'Do‘konni ta’sischi yoki direktor ulashi mumkin.',
  'Новый товар': 'Yangi mahsulot', 'Фото товара': 'Mahsulot rasmlari', 'Добавить фото': 'Rasm qo‘shish', 'Главное': 'Asosiy',
  'Сделать главным': 'Asosiy qilish', 'Убрать': 'Olib tashlash', 'до 8 фото · первое — на карточке товара': '8 tagacha rasm · birinchisi — mahsulot kartochkasida',
  'Название (RU)': 'Nomi (RU)', 'Название (UZ)': 'Nomi (UZ)', 'Категория': 'Toifa', 'Без категории': 'Toifasiz', '+ Новая категория': '+ Yangi toifa',
  'Название категории': 'Toifa nomi', 'Создать': 'Yaratish', 'Цена продажи, сум': 'Sotish narxi, so‘m', 'Количество на складе': 'Ombordagi soni',
  'Добавить на склад': 'Omborga qo‘shish', 'Сейчас на складе': 'Hozir omborda', 'Ед. изм.': 'O‘lchov', 'Описание (RU)': 'Tavsif (RU)',
  'Описание (UZ)': 'Tavsif (UZ)', 'Показывать на сайте': 'Saytda ko‘rsatish', 'Сохранить': 'Saqlash', 'Отмена': 'Bekor qilish', 'Закрыть': 'Yopish',
  'Сохраняю…': 'Saqlanmoqda…', 'Загружаю фото…': 'Rasm yuklanmoqda…', 'Товар добавлен': 'Mahsulot qo‘shildi', 'Товар сохранён': 'Mahsulot saqlandi',
  'Скрыт с сайта': 'Saytdan yashirildi', 'Снова на сайте': 'Yana saytda', 'Настройки витрины': 'Vitrina sozlamalari',
  'Адрес витрины': 'Vitrina manzili', 'Название магазина': 'Do‘kon nomi', 'Подпись (RU)': 'Qisqa tavsif (RU)', 'Подпись (UZ)': 'Qisqa tavsif (UZ)',
  'Телефон': 'Telefon', 'Адрес самовывоза (RU)': 'Olib ketish manzili (RU)', 'Адрес самовывоза (UZ)': 'Olib ketish manzili (UZ)',
  'Часы работы': 'Ish vaqti', 'Скрывать товары, которых нет на складе': 'Omborda yo‘q mahsulotlarni yashirish', 'Настройки сохранены': 'Sozlamalar saqlandi',
  'латиница, цифры и дефис': 'lotin harflari, raqamlar va chiziqcha', 'Название обязательно': 'Nom majburiy', 'Цена обязательна': 'Narx majburiy',
  'Сайт показывает товар, если он не скрыт, у него есть цена и он есть на складе.': 'Sayt mahsulotni ko‘rsatadi: yashirilmagan, narxi bor va omborda bor bo‘lsa.',
  'товаров': 'ta mahsulot', 'Ничего не найдено': 'Hech narsa topilmadi', 'Заказы с сайта приходят кассиру в «Заказы с сайта».': 'Saytdan buyurtmalar kassirga «Saytdan buyurtmalar» bo‘limiga keladi.',
};

const UNITS = ['шт', 'упак', 'компл', 'кг', 'л', 'м'];
const fmt = v => (Math.round(Number(v) || 0)).toLocaleString('ru-RU');
const statusOf = (p, shop) => (p.shop_hidden ? 'hidden' : !(p.price_sell > 0) ? 'noPrice' : (p.stock <= 0 && shop?.hide_out_of_stock !== false) ? 'noStock' : 'onSite');
const STATUS = { onSite: ['На сайте', 'ok'], hidden: ['Скрыт', 'gray'], noStock: ['Нет на складе', 'warn'], noPrice: ['Нет цены', 'bad'] };
const photosOf = p => [p.photo_url, ...(p.gallery || [])].filter(Boolean);
const errOf = (e, fb) => e?.response?.data?.error || e?.message || fb;

// Сжать фото до 1600 px по длинной стороне (JPEG 85%, прозрачность — на белом): быстрее грузится на телефоне покупателя
async function compress(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    if (k === 1 && file.size < 700 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg' }) : file;
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append('photo', await compress(file));
  const { data } = await api.post('/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.url;
}

function Thumb({ src, size = 56 }) {
  return src
    ? <img className="sha-thumb" src={src} alt="" style={{ width: size, height: size }} loading="lazy" />
    : <span className="sha-thumb ph" style={{ width: size, height: size }} aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
    </span>;
}

function Dialog({ title, onClose, children, footer }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sha-scrim" onClick={onClose}>
      <div className="sha-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sha-dialog-head"><h3>{title}</h3><button type="button" className="sha-x" onClick={onClose} aria-label="×">×</button></div>
        <div className="sha-dialog-body">{children}</div>
        {footer && <div className="sha-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export default function ShopAdmin() {
  const { lang } = useTt();
  const T = s => (lang === 'uz' ? UZ[s] || s : s);
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);           // товар или { isNew: true }
  const [settings, setSettings] = useState(false);
  const [note, setNote] = useState(null);           // { text, tone }
  const timer = useRef();
  const say = (text, tone = 'ok') => { setNote({ text, tone }); clearTimeout(timer.current); timer.current = setTimeout(() => setNote(null), 3200); };
  const load = () => { setErr(null); api.get('/shop-admin').then(r => setSt(r.data)).catch(e => setErr(errOf(e, 'Ошибка'))); };
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const products = st?.products || [];
  const shop = st?.shop || null;
  const counts = useMemo(() => {
    const c = { onSite: 0, hidden: 0, noStock: 0, noPrice: 0, noPhoto: 0 };
    for (const p of products) { c[statusOf(p, shop)]++; if (!p.photo_url) c.noPhoto++; }
    return c;
  }, [products, shop]);
  const catName = id => { const c = (st?.categories || []).find(x => x.id === id); return c ? (lang === 'uz' ? c.name_uz || c.name_ru : c.name_ru) : ''; };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter(p => {
      const status = statusOf(p, shop);
      if (filter === 'onSite' && status !== 'onSite') return false;
      if (filter === 'off' && status === 'onSite') return false;
      if (filter === 'noPhoto' && p.photo_url) return false;
      return !s || `${p.name_ru} ${p.name_uz || ''}`.toLowerCase().includes(s);
    });
  }, [products, shop, filter, q]);
  const put = p => setSt(x => ({ ...x, products: x.products.some(y => y.id === p.id) ? x.products.map(y => (y.id === p.id ? p : y)) : [p, ...x.products] }));
  const toggleHidden = async p => {
    try { const { data } = await api.put(`/shop-admin/products/${p.id}`, { shop_hidden: !p.shop_hidden }); put(data); say(T(data.shop_hidden ? 'Скрыт с сайта' : 'Снова на сайте')); }
    catch (e) { say(errOf(e, 'Ошибка'), 'bad'); }
  };

  if (!st) {
    return <div className="sha"><div className="sha-empty">{err ? <><b>{err}</b><button type="button" className="btn btn-ghost btn-sm" onClick={load}>{T('Повторить')}</button></> : T('Загрузка…')}</div></div>;
  }
  return (
    <div className="sha">
      <div className="sha-head">
        <div className="sha-head-title">
          <b>{shop?.title || st.company}</b>
          {shop && <a href={`/shop/${shop.slug}`} target="_blank" rel="noreferrer" className="sha-link">mywarehouse.uz/shop/{shop.slug} ↗</a>}
        </div>
        <div className="sha-head-acts">
          {shop && <a className="btn btn-ghost btn-sm" href={`/shop/${shop.slug}`} target="_blank" rel="noreferrer">{T('Открыть сайт')}</a>}
          {st.can_settings && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSettings(true)}>{T('Настройки')}</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit({ isNew: true })}>+ {T('Добавить товар')}</button>
        </div>
      </div>

      {!shop && (
        <div className="sha-card sha-setup">
          <b>{T('Интернет-магазин ещё не подключён')}</b>
          {st.can_settings ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setSettings(true)}>{T('Подключить магазин')}</button>
            : <span>{T('Подключить магазин может учредитель или директор.')}</span>}
        </div>
      )}

      <div className="sha-tiles">
        {[['onSite', 'На сайте', counts.onSite, 'ok'], ['off', 'Не на сайте', counts.hidden + counts.noStock + counts.noPrice, 'warn'], ['noPhoto', 'Без фото', counts.noPhoto, 'bad'], ['all', 'Все', products.length, '']].map(([k, label, n, tone]) => (
          <button key={k} type="button" className={`sha-tile ${filter === k ? 'on' : ''} ${tone}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>
            <b className="num">{n}</b><span>{T(label)}</span>
          </button>
        ))}
      </div>
      <p className="sha-hint">{T('Сайт показывает товар, если он не скрыт, у него есть цена и он есть на складе.')} {T('Заказы с сайта приходят кассиру в «Заказы с сайта».')}</p>

      <input className="input sha-search" value={q} placeholder={T('Поиск товара')} aria-label={T('Поиск товара')} onChange={e => setQ(e.target.value)} />

      {!shown.length ? <div className="sha-empty">{T('Ничего не найдено')}</div> : (
        <div className="sha-list">
          {shown.map(p => {
            const status = statusOf(p, shop);
            const [label, tone] = STATUS[status];
            return (
              <div key={p.id} className="sha-row">
                <button type="button" className="sha-row-main" onClick={() => setEdit(p)}>
                  <Thumb src={p.photo_url} />
                  <span className="sha-row-text">
                    <b>{lang === 'uz' && p.name_uz ? p.name_uz : p.name_ru}</b>
                    <small>{[catName(p.category_id), `${fmt(p.price_sell)} ${lang === 'uz' ? 'so‘m' : 'сум'}`, `${fmt(p.stock)} ${T(p.unit || 'шт')}`].filter(Boolean).join(' · ')}{photosOf(p).length > 1 ? ` · ${photosOf(p).length} ${lang === 'uz' ? 'rasm' : 'фото'}` : ''}</small>
                  </span>
                </button>
                <span className={`sha-chip ${tone}`}>{T(label)}</span>
                <div className="sha-row-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(p)}>{T('Изменить')}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleHidden(p)}>{T(p.shop_hidden ? 'Показать на сайте' : 'Скрыть с сайта')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <ProductDialog T={T} product={edit.isNew ? null : edit} categories={st.categories} onClose={() => setEdit(null)}
        onCategory={c => setSt(x => ({ ...x, categories: x.categories.some(y => y.id === c.id) ? x.categories : [...x.categories, c].sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru')) }))}
        onSaved={(p, isNew) => { put(p); setEdit(null); say(T(isNew ? 'Товар добавлен' : 'Товар сохранён')); }} />}
      {settings && <SettingsDialog T={T} shop={shop} company={st.company} onClose={() => setSettings(false)}
        onSaved={data => { setSt(data); setSettings(false); say(T('Настройки сохранены')); }} />}
      {note && <div className={`sha-note ${note.tone}`} role="status">{note.text}</div>}
    </div>
  );
}

function ProductDialog({ T, product, categories, onClose, onSaved, onCategory }) {
  const isNew = !product;
  const [f, setF] = useState(() => ({
    name_ru: product?.name_ru || '', name_uz: product?.name_uz && product.name_uz !== product.name_ru ? product.name_uz : '',
    category_id: product?.category_id ? String(product.category_id) : '', price_sell: product ? String(Math.round(product.price_sell || 0)) : '',
    qty: '', unit: product?.unit || 'шт', description_ru: product?.description_ru || '', description_uz: product?.description_uz || '',
    visible: product ? !product.shop_hidden : true, photos: product ? photosOf(product) : [],
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState(null);       // строка — поле «новая категория» открыто
  const fileRef = useRef(null);
  const set = p => { setF(x => ({ ...x, ...p })); setError(''); };

  const addPhotos = async e => {
    const files = [...(e.target.files || [])].filter(x => /^image\//.test(x.type)); e.target.value = '';
    const room = 8 - f.photos.length;
    if (!files.length || room <= 0) return;
    setUploading(n => n + Math.min(room, files.length));
    for (const file of files.slice(0, room)) {
      try { const url = await uploadPhoto(file); setF(x => ({ ...x, photos: [...x.photos, url].slice(0, 8) })); }
      catch (ex) { setError(errOf(ex, 'Ошибка загрузки')); }
      setUploading(n => n - 1);
    }
  };
  const makeMain = i => set({ photos: [f.photos[i], ...f.photos.filter((_, k) => k !== i)] });
  const removePhoto = i => set({ photos: f.photos.filter((_, k) => k !== i) });
  const createCategory = async () => {
    const name = String(newCat || '').trim();
    if (!name) return;
    try { const { data } = await api.post('/shop-admin/categories', { name_ru: name }); onCategory(data); set({ category_id: String(data.id) }); setNewCat(null); }
    catch (ex) { setError(errOf(ex, 'Ошибка')); }
  };
  const save = async () => {
    if (!f.name_ru.trim()) { setError(T('Название обязательно')); return; }
    if (f.price_sell === '') { setError(T('Цена обязательна')); return; }
    const body = { name_ru: f.name_ru.trim(), name_uz: f.name_uz.trim() || null, category_id: f.category_id ? Number(f.category_id) : null,
      price_sell: f.price_sell, unit: f.unit, description_ru: f.description_ru, description_uz: f.description_uz, shop_hidden: !f.visible, photos: f.photos,
      ...(isNew ? { qty: f.qty || 0 } : { add_qty: f.qty || 0 }) };
    setBusy(true);
    try {
      const { data } = isNew ? await api.post('/shop-admin/products', body) : await api.put(`/shop-admin/products/${product.id}`, body);
      onSaved(data, isNew);
    } catch (ex) { setError(errOf(ex, 'Ошибка')); setBusy(false); }
  };
  const footer = <>
    <button type="button" className="btn btn-ghost" onClick={onClose}>{T('Отмена')}</button>
    <button type="button" className="btn btn-primary" disabled={busy || uploading > 0} onClick={save}>{busy ? T('Сохраняю…') : uploading ? T('Загружаю фото…') : T('Сохранить')}</button>
  </>;
  return (
    <Dialog title={isNew ? T('Новый товар') : f.name_ru || product.name_ru} onClose={onClose} footer={footer}>
      <div className="sha-field">
        <span className="label">{T('Фото товара')} <small className="sha-muted">— {T('до 8 фото · первое — на карточке товара')}</small></span>
        <div className="sha-photos">
          {f.photos.map((u, i) => (
            <div key={u} className={`sha-photo ${i === 0 ? 'main' : ''}`}>
              <img src={u} alt="" />
              {i === 0 ? <span className="sha-photo-badge">{T('Главное')}</span>
                : <button type="button" className="sha-photo-main" onClick={() => makeMain(i)}>{T('Сделать главным')}</button>}
              <button type="button" className="sha-photo-x" onClick={() => removePhoto(i)} aria-label={T('Убрать')}>×</button>
            </div>
          ))}
          {Array.from({ length: uploading }, (_, i) => <div key={`up${i}`} className="sha-photo loading"><span /></div>)}
          {f.photos.length + uploading < 8 && (
            <button type="button" className="sha-photo-add" onClick={() => fileRef.current?.click()}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>
              <span>{T('Добавить фото')}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
        </div>
      </div>
      <div className="sha-grid2">
        <label className="sha-field"><span className="label">{T('Название (RU)')} *</span>
          <input className="input" value={f.name_ru} maxLength={200} onChange={e => set({ name_ru: e.target.value })} /></label>
        <label className="sha-field"><span className="label">{T('Название (UZ)')}</span>
          <input className="input" value={f.name_uz} maxLength={200} onChange={e => set({ name_uz: e.target.value })} /></label>
      </div>
      <div className="sha-field">
        <span className="label">{T('Категория')}</span>
        {newCat === null ? (
          <div className="sha-inline">
            <select className="input" value={f.category_id} onChange={e => set({ category_id: e.target.value })}>
              <option value="">{T('Без категории')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_ru}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCat('')}>{T('+ Новая категория')}</button>
          </div>
        ) : (
          <div className="sha-inline">
            <input className="input" autoFocus value={newCat} maxLength={100} placeholder={T('Название категории')} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={createCategory}>{T('Создать')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCat(null)}>{T('Отмена')}</button>
          </div>
        )}
      </div>
      <div className="sha-grid3">
        <label className="sha-field"><span className="label">{T('Цена продажи, сум')} *</span>
          <input className="input" inputMode="numeric" value={f.price_sell} onChange={e => set({ price_sell: e.target.value.replace(/[^\d]/g, '') })} /></label>
        <label className="sha-field"><span className="label">{T(isNew ? 'Количество на складе' : 'Добавить на склад')}</span>
          <input className="input" inputMode="numeric" value={f.qty} placeholder="0" onChange={e => set({ qty: e.target.value.replace(/[^\d]/g, '') })} />
          {!isNew && <small className="sha-muted">{T('Сейчас на складе')}: {fmt(product.stock)} {T(product.unit || 'шт')}</small>}</label>
        <label className="sha-field"><span className="label">{T('Ед. изм.')}</span>
          <select className="input" value={f.unit} onChange={e => set({ unit: e.target.value })}>
            {[...new Set([f.unit, ...UNITS])].map(u => <option key={u} value={u}>{u}</option>)}
          </select></label>
      </div>
      <div className="sha-grid2">
        <label className="sha-field"><span className="label">{T('Описание (RU)')}</span>
          <textarea className="input" rows={4} maxLength={4000} value={f.description_ru} onChange={e => set({ description_ru: e.target.value })} /></label>
        <label className="sha-field"><span className="label">{T('Описание (UZ)')}</span>
          <textarea className="input" rows={4} maxLength={4000} value={f.description_uz} onChange={e => set({ description_uz: e.target.value })} /></label>
      </div>
      <label className="sha-check"><input type="checkbox" checked={f.visible} onChange={e => set({ visible: e.target.checked })} /> {T('Показывать на сайте')}</label>
      {error && <div className="sha-error">{error}</div>}
    </Dialog>
  );
}

function SettingsDialog({ T, shop, company, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    slug: shop?.slug || '', title: shop?.title || company || '', tagline: shop?.tagline || '', tagline_uz: shop?.tagline_uz || '',
    phone: shop?.phone || '', address: shop?.address || '', address_uz: shop?.address_uz || '', hours: shop?.hours || '',
    telegram: shop?.telegram || '', instagram: shop?.instagram || '', hide_out_of_stock: shop ? shop.hide_out_of_stock !== false : true,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = p => { setF(x => ({ ...x, ...p })); setError(''); };
  const save = async () => {
    setBusy(true);
    try { const { data } = await api.put('/shop-admin/settings', f); onSaved(data); } catch (ex) { setError(errOf(ex, 'Ошибка')); setBusy(false); }
  };
  const field = (k, label, props = {}) => (
    <label className="sha-field"><span className="label">{T(label)}</span>
      <input className="input" value={f[k]} onChange={e => set({ [k]: e.target.value })} {...props} /></label>
  );
  return (
    <Dialog title={T('Настройки витрины')} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>{T('Отмена')}</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? T('Сохраняю…') : T('Сохранить')}</button></>}>
      <label className="sha-field"><span className="label">{T('Адрес витрины')} <small className="sha-muted">— {T('латиница, цифры и дефис')}</small></span>
        <div className="sha-slug"><span>mywarehouse.uz/shop/</span>
          <input className="input" value={f.slug} maxLength={40} onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></div></label>
      {field('title', 'Название магазина', { maxLength: 120 })}
      <div className="sha-grid2">{field('tagline', 'Подпись (RU)', { maxLength: 200 })}{field('tagline_uz', 'Подпись (UZ)', { maxLength: 200 })}</div>
      <div className="sha-grid2">{field('phone', 'Телефон', { maxLength: 40, inputMode: 'tel', placeholder: '+998' })}{field('hours', 'Часы работы', { maxLength: 120 })}</div>
      <div className="sha-grid2">{field('address', 'Адрес самовывоза (RU)', { maxLength: 300 })}{field('address_uz', 'Адрес самовывоза (UZ)', { maxLength: 300 })}</div>
      <div className="sha-grid2">{field('telegram', 'Telegram', { maxLength: 100, placeholder: '@' })}{field('instagram', 'Instagram', { maxLength: 100, placeholder: '@' })}</div>
      <label className="sha-check"><input type="checkbox" checked={f.hide_out_of_stock} onChange={e => set({ hide_out_of_stock: e.target.checked })} /> {T('Скрывать товары, которых нет на складе')}</label>
      {error && <div className="sha-error">{error}</div>}
    </Dialog>
  );
}
