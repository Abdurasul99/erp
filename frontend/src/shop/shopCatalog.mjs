// Каталог витрины /shop/:slug: товары из /api/store/catalog?shop=, категории, поиск, сортировка, корзина.
// Чистые функции (без React) — проверяются тестом frontend/test/shop-catalog.test.mjs.

const ICON_BY_CATEGORY = {
  'Инструменты': 'tools', 'Для кухни': 'kitchen', 'Для дома': 'home', 'Красота и здоровье': 'beauty',
  'Для авто': 'car', 'Свет и электроника': 'bulb', 'Сад, дача, отдых': 'leaf',
};

export function normalizeProducts(rows) {
  return (Array.isArray(rows) ? rows : []).map(r => ({
    id: Number(r.id),
    name_ru: String(r.name_ru || '').trim(),
    name_uz: String(r.name_uz || '').trim(),
    price: Number(r.price_sell) || 0,
    image: r.photo_url ? (/^https?:|^\//.test(r.photo_url) ? r.photo_url : `/${r.photo_url}`) : null,
    unit: r.unit || 'шт',
    stock: Math.max(0, Math.floor(Number(r.stock) || 0)),
    category: r.category_id ? { id: Number(r.category_id), name_ru: r.cat_name_ru || '', name_uz: r.cat_name_uz || '' } : null,
    icon: (r.cat_name_ru && ICON_BY_CATEGORY[r.cat_name_ru]) || 'box',
  })).filter(p => p.id && p.name_ru && p.price > 0);
}

// Категории в порядке количества товаров (больше — раньше), «без категории» — в конце не показывается
export function categoriesOf(products) {
  const m = new Map();
  for (const p of products) {
    if (!p.category) continue;
    const c = m.get(p.category.id) || { ...p.category, icon: p.icon, count: 0 };
    c.count++; m.set(p.category.id, c);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name_ru.localeCompare(b.name_ru, 'ru'));
}

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[‘’ʻ'`]/g, '');

export function filterProducts(products, { category = null, query = '', sort = 'name', lang = 'ru' } = {}) {
  const q = norm(query).trim();
  const words = q ? q.split(/\s+/) : [];
  const list = products.filter(p => (!category || p.category?.id === category)
    && words.every(w => norm(`${p.name_ru} ${p.name_uz} ${p.category?.name_ru || ''} ${p.category?.name_uz || ''}`).includes(w)));
  const name = p => (lang === 'uz' ? p.name_uz || p.name_ru : p.name_ru);
  const by = {
    name: (a, b) => name(a).localeCompare(name(b), lang === 'uz' ? 'uz' : 'ru'),
    cheap: (a, b) => a.price - b.price || a.id - b.id,
    expensive: (a, b) => b.price - a.price || a.id - b.id,
  }[sort] || ((a, b) => 0);
  return [...list].sort(by);
}

// Корзина: [{ id, qty }]. Сверка с каталогом: нет товара — убрать, больше остатка — до остатка.
export function reconcileCart(cart, products) {
  const byId = new Map(products.map(p => [p.id, p]));
  return (Array.isArray(cart) ? cart : [])
    .map(i => ({ id: Number(i.id), qty: Math.floor(Number(i.qty) || 0) }))
    .filter(i => byId.has(i.id) && i.qty > 0)
    .map(i => ({ ...i, qty: Math.min(i.qty, byId.get(i.id).stock || 99, 99) }));
}
export function cartAdd(cart, product, n = 1) {
  const max = Math.min(product.stock || 99, 99);
  const ex = cart.find(i => i.id === product.id);
  if (!ex) return [...cart, { id: product.id, qty: Math.min(n, max) }];
  return cart.map(i => (i.id === product.id ? { ...i, qty: Math.min(i.qty + n, max) } : i));
}
export function cartSet(cart, product, qty) {
  const max = Math.min(product.stock || 99, 99);
  const q = Math.max(0, Math.min(Math.floor(qty) || 0, max));
  return q ? cart.map(i => (i.id === product.id ? { ...i, qty: q } : i)) : cart.filter(i => i.id !== product.id);
}
export function cartSummary(cart, products) {
  const byId = new Map(products.map(p => [p.id, p]));
  const lines = cart.map(i => ({ ...i, product: byId.get(i.id) })).filter(l => l.product);
  return { lines, count: lines.reduce((a, l) => a + l.qty, 0), total: lines.reduce((a, l) => a + l.qty * l.product.price, 0) };
}

export function formatPrice(v, lang = 'ru') {
  const n = Math.round(Number(v) || 0);
  const s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : ' ');
  return lang === 'en' ? `${s} UZS` : `${s} ${lang === 'uz' ? 'so‘m' : 'сум'}`;
}

export const phoneDigits = s => String(s || '').replace(/\D/g, '');
