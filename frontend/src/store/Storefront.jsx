import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import api from '../api.js';
import {
  DEMO_PRODUCTS,
  catalogCategories,
  filterCatalog,
  formatStorePrice,
  getCartSummary,
  normalizeErpProducts,
} from './storeCatalog.mjs';
import { STORE_LANGS, STORE_LANG_KEY, getStoreLang, makeStoreT } from './storeI18n.mjs';
import StoreIntro from './StoreIntro.jsx';
import { markStoreIntroSeen, shouldShowStoreIntro } from './storeIntro.mjs';
import './storefront.css';

const CART_KEY = 'art_store_cart_v1';

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i?.product && i.quantity > 0) : [];
  } catch { return []; }
}

function Icon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    menu: <><path d="M4 7h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    external: <><path d="M7 17 17 7M9 7h8v8" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function BrandMark({ light = false }) {
  return (
    <span className={`store-brand${light ? ' is-light' : ''}`} aria-label="ART * Store">
      <span>ART</span><i aria-hidden="true">*</i><span>Store</span>
    </span>
  );
}

function HeroArtifactImage({ heroRef, alt }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '11%']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.1]);

  return (
    <motion.div className="store-hero-media" style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}>
      <img src="/images/store/uzbek-antiquities-hero.webp" alt={alt} fetchpriority="high" />
    </motion.div>
  );
}

// Фото товара или честный плейсхолдер (у части реальных товаров фото ещё нет —
// НЕ показываем чужие картинки, чтобы не вводить покупателя в заблуждение).
function ProductImage({ product, eager = false, t }) {
  if (product.image) {
    return <img src={product.image} alt={`${product.name} — ${product.artist}`} loading={eager ? 'eager' : 'lazy'} />;
  }
  return (
    <span className="store-ph" aria-hidden="true">
      <i>{(product.name || '·').slice(0, 1).toUpperCase()}</i>
      <em>{t('photoSoon')}</em>
    </span>
  );
}

function ProductArticle({ product, index, onOpen, onAdd, t }) {
  const visualClass = index % 5 === 0 ? 'is-portrait' : index % 5 === 3 ? 'is-wide' : '';
  const badge = product.badge === 'last' ? t('lastOne') : product.badge;
  return (
    <article className={`store-product ${visualClass}`} data-reveal>
      <button className="store-product-visual" type="button" onClick={() => onOpen(product)} aria-label={`${t('view')}: ${product.name}`}>
        <ProductImage product={product} eager={index < 4} t={t} />
        {badge && <span className="store-product-badge">{badge}</span>}
        <span className="store-product-view">{t('view')} <Icon name="external" size={17} /></span>
      </button>
      <div className="store-product-copy">
        <button type="button" onClick={() => onOpen(product)}>
          <span>{product.artist}</span>
          <strong>{product.name}</strong>
        </button>
        <div>
          <span>{formatStorePrice(product.price, t('currency'))}</span>
          <button className="store-product-add" type="button" onClick={() => onAdd(product)} aria-label={`${t('mAdd')}: ${product.name}`} disabled={product.available === false}>
            <Icon name="plus" size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Storefront() {
  const [introOpen, setIntroOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return shouldShowStoreIntro(window.sessionStorage);
    } catch {
      return true;
    }
  });
  const [lang, setLang] = useState(getStoreLang);
  const t = useMemo(() => makeStoreT(lang), [lang]);
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [category, setCategory] = useState('Все');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState(loadCart);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);
  const menuButtonRef = useRef(null);
  const cartButtonRef = useRef(null);
  const heroRef = useRef(null);

  const filteredProducts = useMemo(
    () => filterCatalog(products, { category, query }),
    [products, category, query],
  );
  const cartSummary = useMemo(() => getCartSummary(cart), [cart]);
  // Категории — из реального каталога; сентинел 'Все' остаётся стабильным значением,
  // переводится только подпись.
  const categories = useMemo(() => ['Все', ...catalogCategories(products)], [products]);
  const catLabel = (item) => (item === 'Все' ? t('catAll') : item);
  const price = (v) => formatStorePrice(v, t('currency'));

  const changeLang = (l) => {
    setLang(l);
    try { localStorage.setItem(STORE_LANG_KEY, l); } catch { /* noop */ }
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t('docTitle');
    document.body.classList.add('storefront-active');
    return () => {
      document.title = previousTitle;
      document.body.classList.remove('storefront-active');
    };
  }, [t]);

  useEffect(() => {
    // ПУБЛИЧНЫЙ каталог: реальные товары ART Store без логина (демо — только
    // как фолбэк, если бэкенд недоступен).
    api.get('/store/catalog')
      .then(({ data }) => {
        const normalized = normalizeErpProducts(data?.products);
        if (normalized.length > 0) setProducts(normalized);
      })
      .catch(() => {});
  }, []);

  // Корзина переживает перезагрузку страницы.
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* private mode */ }
  }, [cart]);

  useEffect(() => {
    const nodes = document.querySelectorAll('.art-store [data-reveal]');
    if (!('IntersectionObserver' in window)) return undefined;
    nodes.forEach((node) => node.classList.add('reveal-pending'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [filteredProducts.length]);

  useEffect(() => {
    const overlayOpen = introOpen || cartOpen || menuOpen || Boolean(selectedProduct);
    document.body.classList.toggle('storefront-locked', overlayOpen);
    return () => document.body.classList.remove('storefront-locked');
  }, [cartOpen, introOpen, menuOpen, selectedProduct]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const scrollToCollection = () => {
    document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (menuOpen) menuButtonRef.current?.focus();
    setMenuOpen(false);
  };

  const closeMenu = () => {
    menuButtonRef.current?.focus();
    setMenuOpen(false);
  };

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }
      return [...current, { product, quantity: 1 }];
    });
    setToast(t('addedToCart', { name: product.name }));
  };

  const changeQuantity = (productId, delta) => {
    setCart((current) => current
      .map((item) => item.product.id === productId
        ? { ...item, quantity: item.quantity + delta }
        : item)
      .filter((item) => item.quantity > 0));
  };

  const openCart = () => {
    setCheckoutOpen(false);
    setOrderSent(false);
    setCartOpen(true);
  };

  const closeCart = () => {
    cartButtonRef.current?.focus();
    setCartOpen(false);
  };

  // Реальный заказ: заявка уходит в ERP ART Store (лид «Онлайн-магазин»),
  // менеджер перезванивает. Онлайн-оплаты и доставки пока НЕТ — получение и
  // оплату куратор согласует индивидуально.
  const submitOrder = async (event) => {
    event.preventDefault();
    if (sending || cart.length === 0) return;
    const form = new FormData(event.currentTarget);
    setSending(true);
    try {
      const { data } = await api.post('/store/order', {
        name: form.get('name'),
        phone: form.get('phone'),
        comment: form.get('comment') || '',
        items: cart.map((item) => ({ id: item.product.erpId ?? item.product.id, qty: item.quantity })),
      });
      setOrderId(data?.order_id || null);
      setOrderSent(true);
      setCart([]);
    } catch (error) {
      setToast(error?.response?.data?.error || t('coError'));
    } finally {
      setSending(false);
    }
  };

  const completeIntro = useCallback(() => {
    try {
      markStoreIntroSeen(window.sessionStorage);
    } catch {
      // Storage may be unavailable in privacy-restricted browsers.
    }
    setIntroOpen(false);
  }, []);

  return (
    <>
      <StoreIntro open={introOpen} onComplete={completeIntro} t={t} />
      <main className="art-store">
        <section ref={heroRef} className="store-hero" aria-labelledby="store-hero-title">
          <HeroArtifactImage heroRef={heroRef} alt={t('heroAlt')} />
          {/* Честная лента: доставка пока не реализована — обещаем только то, что есть. */}
          <div className="store-announcement">
            <span>{t('annMain')}</span>
            <span className="store-announcement-extra">{t('annExtra')}</span>
          </div>

          <header className="store-header">
            <button ref={menuButtonRef} className="store-mobile-trigger" type="button" onClick={() => setMenuOpen(true)} aria-label={t('aMenu')}><Icon name="menu" /></button>
            <a href="/store" className="store-logo-link"><BrandMark light /></a>
            <nav className="store-nav" aria-label="ART Store">
              <button type="button" onClick={() => { setCategory('Все'); scrollToCollection(); }}>{t('navCatalog')}</button>
              {categories.slice(1, 4).map((item) => (
                <button key={item} type="button" onClick={() => { setCategory(item); scrollToCollection(); }}>{item}</button>
              ))}
              <a href="#story">{t('navAbout')}</a>
            </nav>
            <div className="store-header-actions">
              {/* Переключатель языка витрины: RU / UZ / EN */}
              <div className="store-lang" role="group" aria-label="Language">
                {STORE_LANGS.map((l) => (
                  <button key={l} type="button" className={lang === l ? 'is-active' : ''} onClick={() => changeLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSearchOpen((value) => !value)} aria-label={t('aSearch')}><Icon name="search" /></button>
              <button ref={cartButtonRef} className="store-cart-trigger" type="button" onClick={openCart} aria-label={t('aCart')}>
                <Icon name="bag" /><span>{cartSummary.quantity}</span>
              </button>
            </div>
          </header>

          {searchOpen && (
            <div className="store-search-panel">
              <Icon name="search" />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPh')} aria-label={t('aSearch')} />
              <button type="button" onClick={() => { setSearchOpen(false); if (query) scrollToCollection(); }} aria-label={t('aClose')}><Icon name="close" /></button>
            </div>
          )}

          <div className="store-hero-shade" />
          <motion.div
            className="store-hero-brand"
            aria-label="ART * Store"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>ART</span><i aria-hidden="true">*</i><em>Store</em>
          </motion.div>
          <div className="store-hero-content">
            <p className="store-eyebrow">{t('heroEyebrow')}</p>
            <h1 id="store-hero-title">{t('heroTitle1')}<br /><em>{t('heroTitle2')}</em></h1>
            <p className="store-hero-subtitle">{t('heroSubtitle')}</p>
            <button className="store-primary-cta" type="button" onClick={scrollToCollection}>
              {t('heroCta')} <Icon name="arrow" />
            </button>
          </div>
          <div className="store-hero-index" aria-hidden="true"><span>01</span><i /><span>06</span></div>
          <p className="store-hero-caption">{t('heroCaption1')}<br />{t('heroCaption2')}</p>
        </section>

        <div className="store-marquee" aria-hidden="true">
          <div>
            <span>{t('marq1')}</span><b>●</b><span>{t('marq2')}</span><b>●</b><span>{t('marq3')}</span><b>●</b><span>{t('marq4')}</span><b>●</b>
            <span>{t('marq1')}</span><b>●</b><span>{t('marq2')}</span><b>●</b><span>{t('marq3')}</span><b>●</b><span>{t('marq4')}</span><b>●</b>
          </div>
        </div>

        <section className="store-collection" id="collection" data-testid="store-collection">
          <div className="store-section-heading" data-reveal>
            <div>
              <p className="store-kicker">{t('collKicker')}</p>
              <h2>{t('collTitle1')}<br /><em>{t('collTitle2')}</em></h2>
            </div>
            <p>{t('collText')}</p>
          </div>

          <div className="store-filterbar" data-reveal>
            {/* Фильтр категорий показываем только когда у товаров ЕСТЬ категории. */}
            {categories.length > 1 && (
              <div className="store-categories" role="group" aria-label={t('navCatalog')}>
                {categories.map((item) => (
                  <button className={category === item ? 'is-active' : ''} type="button" key={item} onClick={() => setCategory(item)}>
                    {catLabel(item)}<span>{item === 'Все' ? products.length : products.filter((product) => product.category === item).length}</span>
                  </button>
                ))}
              </div>
            )}
            <label className="store-inline-search">
              <Icon name="search" size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchInlinePh')} />
            </label>
          </div>

          <div className="store-product-grid">
            {filteredProducts.map((product, index) => (
              <ProductArticle product={product} index={index} key={product.id} onOpen={setSelectedProduct} onAdd={addToCart} t={t} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="store-empty">
              <span>0</span><h3>{t('emptyTitle')}</h3><p>{t('emptyText')}</p>
              <button type="button" onClick={() => { setQuery(''); setCategory('Все'); }}>{t('emptyCta')}</button>
            </div>
          )}
        </section>

        <section className="store-story" id="story">
          <div className="store-story-image" data-reveal>
            <img src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1400&q=88" alt={t('storyImgAlt')} loading="lazy" />
            <span>{t('storyCaption')}</span>
          </div>
          <div className="store-story-copy" data-reveal>
            <p className="store-kicker">{t('storyKicker')}</p>
            <h2>{t('storyTitle1')}<br />{t('storyTitle2')}<br /><em>{t('storyTitle3')}</em></h2>
            <p>{t('storyText')}</p>
            <a href="mailto:hello@artstore.uz">{t('storyLink')} <Icon name="arrow" size={20} /></a>
          </div>
        </section>

        <section className="store-services" aria-label="ART Store service">
          <div data-reveal><span>01</span><h3>{t('srv1Title')}</h3><p>{t('srv1Text')}</p></div>
          <div data-reveal><span>02</span><h3>{t('srv2Title')}</h3><p>{t('srv2Text')}</p></div>
          <div data-reveal><span>03</span><h3>{t('srv3Title')}</h3><p>{t('srv3Text')}</p></div>
        </section>

        <section className="store-final-cta">
          <p className="store-kicker">{t('ctaKicker')}</p>
          <h2>{t('ctaTitle1')}<br /><em>{t('ctaTitle2')}</em></h2>
          <p>{t('ctaText')}</p>
          <form onSubmit={(event) => { event.preventDefault(); setToast(t('ctaToast')); event.currentTarget.reset(); }}>
            <label><span className="sr-only">Email</span><input type="email" required placeholder={t('ctaEmailPh')} /></label>
            <button type="submit">{t('ctaSubscribe')} <Icon name="arrow" /></button>
          </form>
        </section>

        <footer className="store-footer">
          <BrandMark light />
          <div><p>{t('footTag1')}<br />{t('footTag2')}</p></div>
          <div><a href="#collection">{t('footCatalog')}</a><a href="#story">{t('footAbout')}</a><a href="mailto:hello@artstore.uz">{t('footContacts')}</a></div>
          <div><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a><a href="https://t.me" target="_blank" rel="noreferrer">Telegram</a><a href="mailto:hello@artstore.uz">hello@artstore.uz</a></div>
          <div className="store-footer-bottom"><span>© 2026 ART Store</span><span>{t('footNote')}</span></div>
        </footer>
      </main>

      <div className={`store-mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="store-mobile-top"><BrandMark /><button type="button" onClick={closeMenu} aria-label={t('aClose')}><Icon name="close" /></button></div>
        <nav>
          {categories.map((item, index) => <button key={item} type="button" onClick={() => { setCategory(item); scrollToCollection(); }}><span>0{index + 1}</span>{item === 'Все' ? t('navCatalog') : item}</button>)}
          <a href="#story" onClick={closeMenu}><span>0{categories.length + 1}</span>{t('navAbout')}</a>
        </nav>
        <div className="store-lang is-mobile" role="group" aria-label="Language">
          {STORE_LANGS.map((l) => (
            <button key={l} type="button" className={lang === l ? 'is-active' : ''} onClick={() => changeLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <p>hello@artstore.uz<br />+998 90 000 00 00</p>
      </div>

      <button className={`store-backdrop ${cartOpen || selectedProduct ? 'is-visible' : ''}`} type="button" onClick={() => { setCartOpen(false); setSelectedProduct(null); }} aria-label={t('aClose')} tabIndex={cartOpen || selectedProduct ? 0 : -1} />

      <aside className={`store-cart ${cartOpen ? 'is-open' : ''}`} aria-hidden={!cartOpen} aria-label={t('cartTitle')}>
        <header><div><p>{t('cartChoice')}</p><h2>{checkoutOpen ? t('checkoutTitle') : t('cartTitle')} <span>{cartSummary.quantity}</span></h2></div><button type="button" onClick={closeCart} aria-label={t('aClose')}><Icon name="close" /></button></header>
        {!checkoutOpen && !orderSent && (
          <>
            <div className="store-cart-items">
              {cart.map((item) => (
                <div className="store-cart-item" key={item.product.id}>
                  {item.product.image ? <img src={item.product.image} alt="" /> : <span className="store-ph is-small" aria-hidden="true"><i>{(item.product.name || '·').slice(0, 1).toUpperCase()}</i></span>}
                  <div><p>{item.product.artist}</p><h3>{item.product.name}</h3><span>{price(item.product.price)}</span><div className="store-quantity"><button type="button" onClick={() => changeQuantity(item.product.id, -1)} aria-label="−"><Icon name="minus" size={15} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.product.id, 1)} aria-label="+"><Icon name="plus" size={15} /></button></div></div>
                </div>
              ))}
              {cart.length === 0 && <div className="store-cart-empty"><Icon name="bag" size={34} /><h3>{t('cartEmptyTitle')}</h3><p>{t('cartEmptyText')}</p><button type="button" onClick={() => { closeCart(); scrollToCollection(); }}>{t('cartEmptyCta')}</button></div>}
            </div>
            {cart.length > 0 && <footer className="store-cart-footer"><div><span>{t('cartTotal')}</span><strong>{price(cartSummary.total)}</strong></div><p>{t('cartNote')}</p><button type="button" onClick={() => setCheckoutOpen(true)}>{t('cartCheckout')} <Icon name="arrow" /></button></footer>}
          </>
        )}
        {checkoutOpen && !orderSent && (
          <form className="store-checkout" onSubmit={submitOrder}>
            <button className="store-checkout-back" type="button" onClick={() => setCheckoutOpen(false)}>{t('coBack')}</button>
            <p>{t('coLead')}</p>
            <label><span>{t('coName')}</span><input name="name" required autoComplete="name" placeholder={t('coNamePh')} /></label>
            <label><span>{t('coPhone')}</span><input name="phone" required autoComplete="tel" placeholder="+998 90 000 00 00" /></label>
            <label><span>{t('coComment')}</span><textarea name="comment" rows="3" placeholder={t('coCommentPh')} /></label>
            <div><span>{t('coDue')}</span><strong>{price(cartSummary.total)}</strong></div>
            <p className="store-checkout-note">{t('coPayNote')}</p>
            <button className="store-checkout-submit" type="submit" disabled={sending}>
              {sending ? t('coSending') : <>{t('coSubmit')} <Icon name="arrow" /></>}
            </button>
          </form>
        )}
        {orderSent && (
          <div className="store-order-success"><span>✓</span><p>{t('okAccepted')}{orderId ? ` · №${orderId}` : ''}</p><h3>{t('okTitle')}</h3><p>{t('okText')}</p><button type="button" onClick={closeCart}>{t('okBack')}</button></div>
        )}
      </aside>

      {selectedProduct && (
        <section className="store-product-modal" role="dialog" aria-modal="true" aria-labelledby="store-product-title">
          <button className="store-modal-close" type="button" onClick={() => setSelectedProduct(null)} aria-label={t('aClose')}><Icon name="close" /></button>
          <div className="store-modal-image"><ProductImage product={selectedProduct} eager t={t} /></div>
          <div className="store-modal-copy"><p className="store-kicker">{[selectedProduct.category, selectedProduct.artist].filter(Boolean).join(' · ')}</p><h2 id="store-product-title">{selectedProduct.name}</h2><p>{t('mDesc')}</p><dl>{selectedProduct.medium && <div><dt>{t('mTech')}</dt><dd>{selectedProduct.medium}</dd></div>}{selectedProduct.size && <div><dt>{t('mSize')}</dt><dd>{selectedProduct.size}</dd></div>}<div><dt>{t('mAvail')}</dt><dd>{selectedProduct.stock > 0 ? `${selectedProduct.stock} ${t('mPcs')}` : t('mOnOrder')}</dd></div></dl><div className="store-modal-buy"><strong>{price(selectedProduct.price)}</strong><button type="button" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setCartOpen(true); }}>{t('mAdd')} <Icon name="arrow" /></button></div></div>
        </section>
      )}

      <div className={`store-toast ${toast ? 'is-visible' : ''}`} role="status"><span>✓</span>{toast}</div>
    </>
  );
}
