import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import api from '../api.js';
import {
  DEMO_PRODUCTS,
  filterCatalog,
  formatStorePrice,
  getCartSummary,
  normalizeErpProducts,
} from './storeCatalog.mjs';
import StoreIntro from './StoreIntro.jsx';
import { markStoreIntroSeen, shouldShowStoreIntro } from './storeIntro.mjs';
import './storefront.css';

const CATEGORIES = ['Все', 'Картины', 'Принты', 'Объекты'];

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

function HeroArtifactImage({ heroRef }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '11%']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.1]);

  return (
    <motion.div className="store-hero-media" style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}>
      <img
        src="/images/store/uzbek-antiquities-hero.webp"
        alt="Лазурная керамика и бронзовый кумган — артефакты в традициях Узбекистана"
        fetchpriority="high"
      />
    </motion.div>
  );
}

function ProductArticle({ product, index, onOpen, onAdd }) {
  const visualClass = index % 5 === 0 ? 'is-portrait' : index % 5 === 3 ? 'is-wide' : '';
  return (
    <article className={`store-product ${visualClass}`} data-reveal>
      <button className="store-product-visual" type="button" onClick={() => onOpen(product)} aria-label={`Открыть ${product.name}`}>
        <img src={product.image} alt={`${product.name} — ${product.artist}`} loading={index < 4 ? 'eager' : 'lazy'} />
        {product.badge && <span className="store-product-badge">{product.badge}</span>}
        <span className="store-product-view">Смотреть <Icon name="external" size={17} /></span>
      </button>
      <div className="store-product-copy">
        <button type="button" onClick={() => onOpen(product)}>
          <span>{product.artist}</span>
          <strong>{product.name}</strong>
        </button>
        <div>
          <span>{formatStorePrice(product.price)}</span>
          <button className="store-product-add" type="button" onClick={() => onAdd(product)} aria-label={`Добавить ${product.name} в корзину`} disabled={product.available === false}>
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
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [category, setCategory] = useState('Все');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
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

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ART Store — современное искусство';
    document.body.classList.add('storefront-active');

    const token = localStorage.getItem('token');
    if (token) {
      api.get('/products')
        .then(({ data }) => {
          if (Array.isArray(data) && data.length > 0) setProducts(normalizeErpProducts(data));
        })
        .catch(() => {});
    }

    return () => {
      document.title = previousTitle;
      document.body.classList.remove('storefront-active');
    };
  }, []);

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
    setToast(`«${product.name}» добавлено в корзину`);
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

  const submitOrder = (event) => {
    event.preventDefault();
    setOrderSent(true);
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
      <StoreIntro open={introOpen} onComplete={completeIntro} />
      <main className="art-store">
        <section ref={heroRef} className="store-hero" aria-labelledby="store-hero-title">
          <HeroArtifactImage heroRef={heroRef} />
          <div className="store-announcement">
            <span>Доставка по Ташкенту за 24 часа</span>
            <span className="store-announcement-extra">Помощь куратора бесплатно</span>
          </div>

          <header className="store-header">
            <button ref={menuButtonRef} className="store-mobile-trigger" type="button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><Icon name="menu" /></button>
            <a href="/store" className="store-logo-link"><BrandMark light /></a>
            <nav className="store-nav" aria-label="Навигация ART Store">
              <button type="button" onClick={scrollToCollection}>Новинки</button>
              <button type="button" onClick={() => { setCategory('Картины'); scrollToCollection(); }}>Картины</button>
              <button type="button" onClick={() => { setCategory('Принты'); scrollToCollection(); }}>Принты</button>
              <button type="button" onClick={() => { setCategory('Объекты'); scrollToCollection(); }}>Объекты</button>
              <a href="#story">О нас</a>
            </nav>
            <div className="store-header-actions">
              <button type="button" onClick={() => setSearchOpen((value) => !value)} aria-label="Открыть поиск"><Icon name="search" /></button>
              <button ref={cartButtonRef} className="store-cart-trigger" type="button" onClick={openCart} aria-label="Открыть корзину">
                <Icon name="bag" /><span>{cartSummary.quantity}</span>
              </button>
            </div>
          </header>

          {searchOpen && (
            <div className="store-search-panel">
              <Icon name="search" />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Художник, работа или техника" aria-label="Поиск по каталогу" />
              <button type="button" onClick={() => { setSearchOpen(false); if (query) scrollToCollection(); }} aria-label="Закрыть поиск"><Icon name="close" /></button>
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
            <p className="store-eyebrow">Антиквариат Узбекистана · частная коллекция</p>
            <h1 id="store-hero-title">История,<br /><em>которую можно сохранить.</em></h1>
            <p className="store-hero-subtitle">Редкие предметы Центральной Азии — с вниманием к происхождению, материалу и времени.</p>
            <button className="store-primary-cta" type="button" onClick={scrollToCollection}>
              Смотреть коллекцию <Icon name="arrow" />
            </button>
          </div>
          <div className="store-hero-index" aria-hidden="true"><span>01</span><i /><span>06</span></div>
          <p className="store-hero-caption">Лазурная керамика<br />Средняя Азия, музейная серия</p>
        </section>

        <div className="store-marquee" aria-hidden="true">
          <div>
            <span>Оригиналы</span><b>●</b><span>Лимитированные принты</span><b>●</b><span>Керамика</span><b>●</b><span>Новые имена</span><b>●</b>
            <span>Оригиналы</span><b>●</b><span>Лимитированные принты</span><b>●</b><span>Керамика</span><b>●</b><span>Новые имена</span><b>●</b>
          </div>
        </div>

        <section className="store-collection" id="collection" data-testid="store-collection">
          <div className="store-section-heading" data-reveal>
            <div>
              <p className="store-kicker">Выбор ART Store</p>
              <h2>Работы, которые<br /><em>меняют пространство.</em></h2>
            </div>
            <p>Каждую работу мы выбираем лично — за сильную идею, честный материал и то чувство, которое остаётся надолго.</p>
          </div>

          <div className="store-filterbar" data-reveal>
            <div className="store-categories" role="group" aria-label="Фильтр по категории">
              {CATEGORIES.map((item) => (
                <button className={category === item ? 'is-active' : ''} type="button" key={item} onClick={() => setCategory(item)}>
                  {item}<span>{item === 'Все' ? products.length : products.filter((product) => product.category === item).length}</span>
                </button>
              ))}
            </div>
            <label className="store-inline-search">
              <Icon name="search" size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти работу" />
            </label>
          </div>

          <div className="store-product-grid">
            {filteredProducts.map((product, index) => (
              <ProductArticle product={product} index={index} key={product.id} onOpen={setSelectedProduct} onAdd={addToCart} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="store-empty">
              <span>0</span><h3>Ничего не нашли</h3><p>Попробуйте другой запрос или сбросьте фильтр.</p>
              <button type="button" onClick={() => { setQuery(''); setCategory('Все'); }}>Показать всё</button>
            </div>
          )}
        </section>

        <section className="store-story" id="story">
          <div className="store-story-image" data-reveal>
            <img src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1400&q=88" alt="Художник за работой в студии" loading="lazy" />
            <span>Студия автора · Ташкент</span>
          </div>
          <div className="store-story-copy" data-reveal>
            <p className="store-kicker">ART Store и авторы</p>
            <h2>Мы не ищем<br />декор. Мы ищем<br /><em>новый взгляд.</em></h2>
            <p>Знакомимся с художниками в их мастерских, отбираем работы и помогаем им найти своего зрителя. Покупая в ART Store, вы поддерживаете живую арт-сцену региона.</p>
            <a href="mailto:hello@artstore.uz">Стать автором ART Store <Icon name="arrow" size={20} /></a>
          </div>
        </section>

        <section className="store-services" aria-label="Сервис ART Store">
          <div data-reveal><span>01</span><h3>Поможем выбрать</h3><p>Пришлите фото интерьера — куратор подберёт работы по масштабу и настроению.</p></div>
          <div data-reveal><span>02</span><h3>Бережно доставим</h3><p>Упакуем как музейный объект и доставим по Узбекистану. По Ташкенту — за 24 часа.</p></div>
          <div data-reveal><span>03</span><h3>Оформим пространство</h3><p>Примерим работу в интерьере, подберём раму и найдём идеальную высоту.</p></div>
        </section>

        <section className="store-final-cta">
          <p className="store-kicker">Letters from ART Store</p>
          <h2>Новые имена.<br /><em>Сильные работы.</em></h2>
          <p>Письмо раз в месяц о том, что мы нашли в мастерских и галереях.</p>
          <form onSubmit={(event) => { event.preventDefault(); setToast('Вы в списке. Первое письмо уже в пути.'); event.currentTarget.reset(); }}>
            <label><span className="sr-only">Email</span><input type="email" required placeholder="Ваш email" /></label>
            <button type="submit">Подписаться <Icon name="arrow" /></button>
          </form>
        </section>

        <footer className="store-footer">
          <BrandMark light />
          <div><p>Современное искусство<br />и объекты для жизни.</p></div>
          <div><a href="#collection">Каталог</a><a href="#story">О нас</a><a href="mailto:hello@artstore.uz">Контакты</a></div>
          <div><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a><a href="https://t.me" target="_blank" rel="noreferrer">Telegram</a><a href="mailto:hello@artstore.uz">hello@artstore.uz</a></div>
          <div className="store-footer-bottom"><span>© 2026 ART Store</span><span>Оригинальные работы · сертификат подлинности</span></div>
        </footer>
      </main>

      <div className={`store-mobile-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="store-mobile-top"><BrandMark /><button type="button" onClick={closeMenu} aria-label="Закрыть меню"><Icon name="close" /></button></div>
        <nav>
          {CATEGORIES.map((item, index) => <button key={item} type="button" onClick={() => { setCategory(item); scrollToCollection(); }}><span>0{index + 1}</span>{item === 'Все' ? 'Новинки' : item}</button>)}
          <a href="#story" onClick={closeMenu}><span>05</span>О нас</a>
        </nav>
        <p>hello@artstore.uz<br />+998 90 000 00 00</p>
      </div>

      <button className={`store-backdrop ${cartOpen || selectedProduct ? 'is-visible' : ''}`} type="button" onClick={() => { setCartOpen(false); setSelectedProduct(null); }} aria-label="Закрыть" tabIndex={cartOpen || selectedProduct ? 0 : -1} />

      <aside className={`store-cart ${cartOpen ? 'is-open' : ''}`} aria-hidden={!cartOpen} aria-label="Корзина">
        <header><div><p>Ваш выбор</p><h2>{checkoutOpen ? 'Оформление' : 'Корзина'} <span>{cartSummary.quantity}</span></h2></div><button type="button" onClick={closeCart} aria-label="Закрыть корзину"><Icon name="close" /></button></header>
        {!checkoutOpen && !orderSent && (
          <>
            <div className="store-cart-items">
              {cart.map((item) => (
                <div className="store-cart-item" key={item.product.id}>
                  <img src={item.product.image} alt="" />
                  <div><p>{item.product.artist}</p><h3>{item.product.name}</h3><span>{formatStorePrice(item.product.price)}</span><div className="store-quantity"><button type="button" onClick={() => changeQuantity(item.product.id, -1)} aria-label="Уменьшить"><Icon name="minus" size={15} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.product.id, 1)} aria-label="Увеличить"><Icon name="plus" size={15} /></button></div></div>
                </div>
              ))}
              {cart.length === 0 && <div className="store-cart-empty"><Icon name="bag" size={34} /><h3>Здесь пока тихо</h3><p>Добавьте работы, которые хочется рассматривать каждый день.</p><button type="button" onClick={() => { closeCart(); scrollToCollection(); }}>К коллекции</button></div>}
            </div>
            {cart.length > 0 && <footer className="store-cart-footer"><div><span>Итого</span><strong>{formatStorePrice(cartSummary.total)}</strong></div><p>Доставку и способ оплаты уточнит менеджер.</p><button type="button" onClick={() => setCheckoutOpen(true)}>Оформить заказ <Icon name="arrow" /></button></footer>}
          </>
        )}
        {checkoutOpen && !orderSent && (
          <form className="store-checkout" onSubmit={submitOrder}>
            <button className="store-checkout-back" type="button" onClick={() => setCheckoutOpen(false)}>← Назад к корзине</button>
            <p>Оставьте контакты. Куратор свяжется с вами, подтвердит наличие и поможет с доставкой.</p>
            <label><span>Имя</span><input name="name" required autoComplete="name" placeholder="Как к вам обращаться" /></label>
            <label><span>Телефон</span><input name="phone" required autoComplete="tel" placeholder="+998 90 000 00 00" /></label>
            <label><span>Комментарий</span><textarea name="comment" rows="3" placeholder="Адрес, удобное время или вопрос" /></label>
            <div><span>К оплате</span><strong>{formatStorePrice(cartSummary.total)}</strong></div>
            <button className="store-checkout-submit" type="submit">Отправить заявку <Icon name="arrow" /></button>
          </form>
        )}
        {orderSent && (
          <div className="store-order-success"><span>✓</span><p>Заявка принята</p><h3>Скоро свяжемся с вами.</h3><p>Пока можно ещё раз посмотреть коллекцию — искусства много не бывает.</p><button type="button" onClick={closeCart}>Вернуться в магазин</button></div>
        )}
      </aside>

      {selectedProduct && (
        <section className="store-product-modal" role="dialog" aria-modal="true" aria-labelledby="store-product-title">
          <button className="store-modal-close" type="button" onClick={() => setSelectedProduct(null)} aria-label="Закрыть карточку"><Icon name="close" /></button>
          <div className="store-modal-image"><img src={selectedProduct.image} alt={`${selectedProduct.name} — ${selectedProduct.artist}`} /></div>
          <div className="store-modal-copy"><p className="store-kicker">{selectedProduct.category} · {selectedProduct.artist}</p><h2 id="store-product-title">{selectedProduct.name}</h2><p>Работа с тихой, но уверенной энергией. Она не спорит с пространством, а собирает его вокруг себя.</p><dl><div><dt>Техника</dt><dd>{selectedProduct.medium}</dd></div><div><dt>Размер</dt><dd>{selectedProduct.size}</dd></div><div><dt>Наличие</dt><dd>{selectedProduct.stock > 0 ? `${selectedProduct.stock} шт.` : 'Под заказ'}</dd></div></dl><div className="store-modal-buy"><strong>{formatStorePrice(selectedProduct.price)}</strong><button type="button" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setCartOpen(true); }}>Добавить в корзину <Icon name="arrow" /></button></div></div>
        </section>
      )}

      <div className={`store-toast ${toast ? 'is-visible' : ''}`} role="status"><span>✓</span>{toast}</div>
    </>
  );
}
