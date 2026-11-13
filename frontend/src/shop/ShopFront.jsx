// Витрина магазина mywarehouse.uz/shop/<slug> (2026-11-13): товары для дома, инструменты, техника — формат маркетплейса.
// Каталог — /api/store/catalog?shop=<slug> (только то, что есть на складе и с ценой); заказ — /api/store/order без
// онлайн-оплаты: заявка падает лидом «Онлайн-магазин» в компанию, кассир перезванивает и подтверждает.
// Корзина — в localStorage (своя у каждого магазина), языки RU / UZ / EN. Без фото — аккуратная заглушка с иконкой категории.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { normalizeProducts, categoriesOf, filterProducts, reconcileCart, cartAdd, cartSet, cartSummary, formatPrice, phoneDigits } from './shopCatalog.mjs';
import { SHOP_LANGS, SHOP_LANG_KEY, getShopLang, makeShopT, categoryLabel, productName } from './shopI18n.mjs';
import './shop.css';

const ICONS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8M8 13h5" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  tools: <><path d="M14.5 5.5a4 4 0 0 0 4.9 4.9l-9.2 9.2a2 2 0 0 1-2.8-2.8l9.2-9.2" /><path d="M4 4l3 3M6.5 3.5 3.5 6.5" /></>,
  kitchen: <><path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" /><path d="M8 11V8M12 11V6M16 11V8M20 12h2" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  beauty: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></>,
  car: <><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v2H3z" /><circle cx="7.5" cy="13" r="1" /><circle cx="16.5" cy="13" r="1" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.8-1.5 1.7-1.5 2.5h-4c0-.8-.6-1.7-1.5-2.5z" /></>,
  leaf: <><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19l7-7" /></>,
  box: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || ICONS.box}
    </svg>
  );
}

const cartKey = slug => `shop_cart_${slug}`;
const loadCart = slug => { try { const c = JSON.parse(localStorage.getItem(cartKey(slug)) || '[]'); return Array.isArray(c) ? c : []; } catch { return []; } };
const initials = s => String(s || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'S';
const tel = p => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;

function ProductImage({ p, t, big }) {
  const [broken, setBroken] = useState(false);
  if (p.image && !broken) return <img src={p.image} alt="" loading="lazy" onError={() => setBroken(true)} />;
  return (
    <span className={`shp-ph ic-${p.icon}`} aria-hidden="true">
      <Icon name={p.icon} size={big ? 64 : 40} />
      <em>{t('photoSoon')}</em>
    </span>
  );
}

function Qty({ value, max, onChange, t, size }) {
  return (
    <div className={`shp-qty ${size || ''}`} role="group" aria-label={t('qty')}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="−"><Icon name="minus" size={16} /></button>
      <b className="num">{value}</b>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="+"><Icon name="plus" size={16} /></button>
    </div>
  );
}

function StockNote({ p, t }) {
  return p.stock > 0 && p.stock <= 5 ? <span className="shp-stock low">{t('left', p.stock)}</span> : <span className="shp-stock">{t('inStock')}</span>;
}

function ProductCard({ p, lang, t, qty, onOpen, onAdd, onQty }) {
  const name = productName(p, lang);
  return (
    <article className="shp-card">
      <button type="button" className="shp-card-img" onClick={() => onOpen(p)} aria-label={name}><ProductImage p={p} t={t} /></button>
      <div className="shp-card-body">
        <button type="button" className="shp-card-name" onClick={() => onOpen(p)}>{name}</button>
        <StockNote p={p} t={t} />
        <div className="shp-card-foot">
          <b className="shp-price">{formatPrice(p.price, lang)}</b>
          {qty > 0 ? <Qty value={qty} max={Math.min(p.stock, 99)} onChange={v => onQty(p, v)} t={t} size="sm" />
            : <button type="button" className="shp-add" onClick={() => onAdd(p)}><Icon name="bag" size={17} /> <span>{t('toCart')}</span></button>}
        </div>
      </div>
    </article>
  );
}

function Modal({ onClose, label, children, side }) {
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className={`shp-scrim ${side ? 'side' : ''}`} onClick={onClose}>
      <div ref={box} tabIndex={-1} className={side ? 'shp-drawer' : 'shp-modal'} role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function ShopFront() {
  const { slug: rawSlug } = useParams();
  const slug = String(rawSlug || '').toLowerCase();
  const [lang, setLangState] = useState(getShopLang);
  const t = useMemo(() => makeShopT(lang), [lang]);
  const setLang = l => { setLangState(l); try { localStorage.setItem(SHOP_LANG_KEY, l); } catch { /* только на сессию */ } };
  const [state, setState] = useState({ loading: true, error: null, shop: null, products: [] });
  const [cart, setCart] = useState(() => loadCart(slug));
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [open, setOpen] = useState(null);           // товар в окне
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  const say = useCallback(m => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2600); }, []);
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetch(`/api/store/catalog?shop=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      if (r.status === 404) { setState({ loading: false, error: 'notfound', shop: null, products: [] }); return; }
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const products = normalizeProducts(d.products);
      setState({ loading: false, error: null, shop: d.shop || { title: d.company }, products });
      setCart(c => reconcileCart(c, products));
    } catch { setState(s => ({ ...s, loading: false, error: 'load' })); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { localStorage.setItem(cartKey(slug), JSON.stringify(cart)); } catch { /* недоступно */ } }, [cart, slug]);
  useEffect(() => {
    if (state.shop?.title) document.title = state.shop.title;
    document.documentElement.lang = lang === 'uz' ? 'uz' : lang;
  }, [state.shop, lang]);

  const { shop, products } = state;
  const cats = useMemo(() => categoriesOf(products), [products]);
  const shown = useMemo(() => filterProducts(products, { category, query, sort, lang }), [products, category, query, sort, lang]);
  const sum = useMemo(() => cartSummary(cart, products), [cart, products]);
  const qtyOf = id => cart.find(i => i.id === id)?.qty || 0;
  const add = (p, n = 1) => { setCart(c => cartAdd(c, p, n)); say(`${productName(p, lang)} — ${t('inCart').toLowerCase()}`); };
  const setQty = (p, v) => setCart(c => cartSet(c, p, v));
  const title = shop?.title || '';
  const tagline = lang === 'uz' ? shop?.tagline_uz || shop?.tagline : shop?.tagline;
  const address = lang === 'uz' ? shop?.address_uz || shop?.address : shop?.address;

  if (state.loading && !products.length) {
    return <div className="shp"><div className="shp-center"><div className="shp-spinner" aria-label="…" /></div></div>;
  }
  if (state.error === 'notfound') {
    return <div className="shp"><div className="shp-center"><h1>{t('notFound')}</h1><p>{t('notFoundText')}</p></div></div>;
  }
  if (state.error && !products.length) {
    return <div className="shp"><div className="shp-center"><h1>{t('loadError')}</h1><button type="button" className="shp-btn" onClick={load}>{t('retry')}</button></div></div>;
  }

  return (
    <div className="shp">
      <header className="shp-top">
        <div className="shp-top-in">
          <a className="shp-logo" href={`/shop/${slug}`} aria-label={title}>
            <span className="shp-logo-mark">{initials(title)}</span>
            <span className="shp-logo-text"><b>{title}</b>{tagline && <small>{tagline}</small>}</span>
          </a>
          <label className="shp-search">
            <Icon name="search" size={18} />
            <input type="search" value={query} placeholder={t('search')} aria-label={t('search')} onChange={e => setQuery(e.target.value)} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label={t('close')}><Icon name="close" size={16} /></button>}
          </label>
          <div className="shp-lang" role="group" aria-label="Language">
            {SHOP_LANGS.map(l => <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button type="button" className="shp-cartbtn" onClick={() => setCartOpen(true)} aria-label={t('openCart')}>
            <Icon name="bag" size={20} /><span className="shp-cartbtn-label">{t('cart')}</span>
            {sum.count > 0 && <span className="shp-badge num">{sum.count}</span>}
          </button>
        </div>
      </header>

      <main className="shp-main">
        <section className="shp-trust" aria-label={title}>
          <div><Icon name="chat" /><span>{t('trustOrder')}</span></div>
          {address && <div><Icon name="pin" /><span>{t('trustPickup')}: {address}</span></div>}
          <div><Icon name="card" /><span>{t('trustPay')}</span></div>
          {shop?.phone && <a href={tel(shop.phone)}><Icon name="phone" /><span>{shop.phone}</span></a>}
        </section>

        <nav className="shp-cats" aria-label={t('category')}>
          <button type="button" className={!category ? 'on' : ''} aria-pressed={!category} onClick={() => setCategory(null)}>
            <Icon name="grid" size={18} /><span>{t('all')}</span><i className="num">{products.length}</i>
          </button>
          {cats.map(c => (
            <button key={c.id} type="button" className={category === c.id ? 'on' : ''} aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              <Icon name={c.icon} size={18} /><span>{categoryLabel(c, lang)}</span><i className="num">{c.count}</i>
            </button>
          ))}
        </nav>

        <div className="shp-bar">
          <h1>{category ? categoryLabel(cats.find(c => c.id === category), lang) : t('all')} <small>{t('items', shown.length)}</small></h1>
          <label className="shp-sort"><span>{t('sort')}</span>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="name">{t('sortName')}</option>
              <option value="cheap">{t('sortCheap')}</option>
              <option value="expensive">{t('sortExpensive')}</option>
            </select>
          </label>
        </div>

        {!shown.length ? (
          <div className="shp-empty"><Icon name="search" size={36} /><b>{t('nothing')}</b><span>{t('nothingHint')}</span></div>
        ) : (
          <div className="shp-grid">
            {shown.map(p => <ProductCard key={p.id} p={p} lang={lang} t={t} qty={qtyOf(p.id)} onOpen={setOpen} onAdd={add} onQty={setQty} />)}
          </div>
        )}
      </main>

      <footer className="shp-foot">
        <div className="shp-foot-in">
          <div><b>{title}</b>{tagline && <span>{tagline}</span>}</div>
          <div>
            {shop?.phone && <a href={tel(shop.phone)}><Icon name="phone" size={16} /> {shop.phone}</a>}
            {address && <span><Icon name="pin" size={16} /> {address}</span>}
            {shop?.hours && <span><Icon name="clock" size={16} /> {shop.hours}</span>}
            {shop?.telegram && <a href={`https://t.me/${shop.telegram.replace(/^@|https?:\/\/t\.me\//g, '')}`} target="_blank" rel="noreferrer">Telegram</a>}
            {shop?.instagram && <a href={`https://instagram.com/${shop.instagram.replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, '')}`} target="_blank" rel="noreferrer">Instagram</a>}
          </div>
          <small>{t('poweredBy')}</small>
        </div>
      </footer>

      {sum.count > 0 && !cartOpen && (
        <button type="button" className="shp-floatcart" onClick={() => setCartOpen(true)}>
          <Icon name="bag" size={20} /><span>{t('cart')} · {t('items', sum.count)}</span><b>{formatPrice(sum.total, lang)}</b><Icon name="arrow" size={18} />
        </button>
      )}

      {open && <ProductSheet p={open} lang={lang} t={t} qty={qtyOf(open.id)} onClose={() => setOpen(null)}
        onAdd={(p, n) => { add(p, n); setOpen(null); }} />}
      {cartOpen && <CartDrawer slug={slug} shop={shop} lang={lang} t={t} sum={sum} onQty={setQty} onClose={() => setCartOpen(false)}
        onDone={() => setCart([])} say={say} />}
      {toast && <div className="shp-toast" role="status">{toast}</div>}
    </div>
  );
}

function ProductSheet({ p, lang, t, qty, onClose, onAdd }) {
  const max = Math.max(1, Math.min(p.stock, 99) - qty);
  const [n, setN] = useState(1);
  const [photo, setPhoto] = useState(0);            // галерея: какое фото крупно
  const name = productName(p, lang);
  const photos = p.photos?.length ? p.photos : [];
  const desc = (lang === 'uz' ? p.description_uz || p.description_ru : p.description_ru || p.description_uz) || '';
  return (
    <Modal onClose={onClose} label={name}>
      <button type="button" className="shp-x" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
      <div className="shp-sheet">
        <div className="shp-sheet-media">
          <div className="shp-sheet-img"><ProductImage p={photos.length ? { ...p, image: photos[photo] } : p} t={t} big /></div>
          {photos.length > 1 && (
            <div className="shp-thumbs" role="group" aria-label={name}>
              {photos.map((u, i) => (
                <button key={u} type="button" className={i === photo ? 'on' : ''} onClick={() => setPhoto(i)} aria-label={`${i + 1} / ${photos.length}`} aria-pressed={i === photo}>
                  <img src={u} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="shp-sheet-info">
          {p.category && <span className="shp-eyebrow">{categoryLabel(p.category, lang)}</span>}
          <h2>{name}</h2>
          <StockNote p={p} t={t} />
          {desc && <p className="shp-desc">{desc}</p>}
          <b className="shp-price big">{formatPrice(p.price, lang)}</b>
          <span className="shp-muted">{t('perPiece')}{qty > 0 ? ` · ${t('inCart')}: ${qty}` : ''}</span>
          <div className="shp-sheet-buy">
            <Qty value={n} max={max} onChange={v => setN(Math.max(1, Math.min(v, max)))} t={t} />
            <button type="button" className="shp-btn" disabled={qty >= Math.min(p.stock, 99)} onClick={() => onAdd(p, n)}>
              <Icon name="bag" size={18} /> {t('add')}
            </button>
          </div>
          <p className="shp-muted shp-small">{t('payNote')}</p>
        </div>
      </div>
    </Modal>
  );
}

function CartDrawer({ slug, shop, lang, t, sum, onQty, onClose, onDone, say }) {
  const [f, setF] = useState(() => { try { return JSON.parse(localStorage.getItem('shop_buyer') || '{}'); } catch { return {}; } });
  const [errs, setErrs] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const set = p => { setF(x => ({ ...x, ...p })); setErrs({}); };
  const submit = async e => {
    e.preventDefault();
    const name = String(f.name || '').trim(); const phone = String(f.phone || '').trim();
    const bad = { ...(!name ? { name: t('needName') } : {}), ...(phoneDigits(phone).length < 9 ? { phone: t('needPhone') } : {}) };
    if (Object.keys(bad).length) { setErrs(bad); return; }
    setSending(true);
    try {
      const r = await fetch('/api/store/order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: slug, name, phone, comment: String(f.comment || '').trim(), items: sum.lines.map(l => ({ id: l.id, qty: l.qty })) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || t('sendError'));
      try { localStorage.setItem('shop_buyer', JSON.stringify({ name, phone })); } catch { /* только на сессию */ }
      setDone({ id: d.order_id, phone, total: d.total });
      onDone();
    } catch (ex) { say(ex.message || t('sendError')); } finally { setSending(false); }
  };
  return (
    <Modal onClose={onClose} label={t('cart')} side>
      <div className="shp-drawer-head"><h2>{done ? t('doneTitle', done.id) : t('cart')}</h2>
        <button type="button" className="shp-x static" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button></div>
      {done ? (
        <div className="shp-done">
          <span className="shp-done-ic"><Icon name="check" size={34} /></span>
          <p>{t('doneText', done.phone)}</p>
          {shop?.phone && <a className="shp-btn ghost" href={tel(shop.phone)}><Icon name="phone" size={18} /> {shop.phone}</a>}
          <button type="button" className="shp-btn" onClick={onClose}>{t('doneClose')}</button>
        </div>
      ) : !sum.lines.length ? (
        <div className="shp-empty"><Icon name="bag" size={36} /><b>{t('cartEmpty')}</b><span>{t('cartEmptyHint')}</span></div>
      ) : (
        <form className="shp-drawer-body" onSubmit={submit} noValidate>
          <ul className="shp-lines">
            {sum.lines.map(l => (
              <li key={l.id}>
                <span className="shp-line-img"><ProductImage p={l.product} t={t} /></span>
                <div className="shp-line-info">
                  <b>{productName(l.product, lang)}</b>
                  <span className="shp-muted">{formatPrice(l.product.price, lang)} × {l.qty}</span>
                  <div className="shp-line-acts">
                    <Qty value={l.qty} max={Math.min(l.product.stock, 99)} onChange={v => onQty(l.product, v)} t={t} size="sm" />
                    <button type="button" className="shp-link" onClick={() => onQty(l.product, 0)}>{t('remove')}</button>
                  </div>
                </div>
                <b className="shp-line-sum num">{formatPrice(l.qty * l.product.price, lang)}</b>
              </li>
            ))}
          </ul>
          <div className="shp-total"><span>{t('total')}</span><b className="num">{formatPrice(sum.total, lang)}</b></div>
          <label className="shp-field"><span>{t('yourName')}</span>
            <input value={f.name || ''} autoComplete="name" maxLength={120} onChange={e => set({ name: e.target.value })} aria-invalid={!!errs.name} />
            {errs.name && <em>{errs.name}</em>}</label>
          <label className="shp-field"><span>{t('yourPhone')}</span>
            <input value={f.phone || ''} type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 __ ___ __ __" maxLength={40}
              onChange={e => set({ phone: e.target.value })} aria-invalid={!!errs.phone} />
            {errs.phone && <em>{errs.phone}</em>}</label>
          <label className="shp-field"><span>{t('comment')}</span>
            <textarea rows={2} maxLength={500} placeholder={t('commentPh')} value={f.comment || ''} onChange={e => set({ comment: e.target.value })} /></label>
          <p className="shp-muted shp-small">{t('payNote')}</p>
          <button type="submit" className="shp-btn wide" disabled={sending}>{sending ? t('sending') : `${t('send')} · ${formatPrice(sum.total, lang)}`}</button>
        </form>
      )}
    </Modal>
  );
}
