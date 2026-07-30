export const DEMO_PRODUCTS = [
  { id: 'soft-current', name: 'Мягкое течение', artist: 'Малика Рахимова', category: 'Картины', price: 2850000, stock: 1, size: '90 × 120 см', medium: 'Акрил, холст', badge: 'Новинка', image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1200&q=88' },
  { id: 'blue-hour', name: 'Синий час', artist: 'Тимур Абдуллаев', category: 'Картины', price: 1950000, stock: 2, size: '70 × 90 см', medium: 'Масло, холст', image: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=88' },
  { id: 'still-life-07', name: 'Still life №07', artist: 'ART Store Studio', category: 'Принты', price: 480000, stock: 12, size: '50 × 70 см', medium: 'Жикле-принт', badge: 'Лимитировано', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=88' },
  { id: 'form-02', name: 'Форма №02', artist: 'Азиза Юсупова', category: 'Объекты', price: 1250000, stock: 3, size: '32 × 18 см', medium: 'Керамика', image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1200&q=88' },
  { id: 'inner-garden', name: 'Внутренний сад', artist: 'Никита Ли', category: 'Картины', price: 3400000, stock: 1, size: '100 × 140 см', medium: 'Смешанная техника', badge: 'Выбор куратора', image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1200&q=88' },
  { id: 'line-and-sun', name: 'Линия и солнце', artist: 'Сабина Ким', category: 'Принты', price: 320000, stock: 18, size: '40 × 50 см', medium: 'Шелкография', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=88' },
  { id: 'balance', name: 'Баланс', artist: 'Данияр Мирза', category: 'Объекты', price: 890000, stock: 4, size: '28 × 24 см', medium: 'Камень, металл', image: 'https://images.unsplash.com/photo-1561839561-b13bcfe95249?auto=format&fit=crop&w=1200&q=88' },
  { id: 'quiet-morning', name: 'Тихое утро', artist: 'Малика Рахимова', category: 'Принты', price: 560000, stock: 8, size: '60 × 80 см', medium: 'Архивная печать', image: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?auto=format&fit=crop&w=1200&q=88' },
];

// Реальные товары ERP → карточки витрины. ВАЖНО: НЕ подставляем чужие демо-фото
// (unsplash-картины на эмалированные кружки вводили бы покупателя в заблуждение) —
// товар без фото получает аккуратный плейсхолдер на витрине (image: null).
export function normalizeErpProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return [];

  return products.map((product, index) => {
    const price = Number(product.price_sell ?? product.sell ?? product.price ?? 0);
    const stock = Number(product.stock ?? product.quantity ?? 0);

    return {
      id: product.id ?? index,                       // реальный id товара — уходит в заказ
      erpId: product.id ?? null,
      name: product.name_ru || product.name_uz || product.name || 'Без названия',
      artist: product.brand || 'ART Store',
      category: product.cat_name_ru || product.type_name_ru || product.category || null,
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,
      size: product.color_size || product.size || null,
      medium: product.type_name_ru || null,
      // 'last' — семантический ключ (переводится на витрине: Последний экземпляр / Oxirgi nusxa / Last one)
      badge: product.badge || (stock > 0 && stock <= 2 ? 'last' : ''),
      image: product.photo_url || product.image_url || product.image || null,
      // Заказ = заявка (куратор подтверждает наличие) — покупать можно и «под заказ».
      available: true,
      source: 'erp',
    };
  });
}

// Уникальные категории каталога (для фильтра). Товары без категории не создают пункт.
export function catalogCategories(products) {
  const seen = [];
  (Array.isArray(products) ? products : []).forEach((p) => {
    if (p.category && !seen.includes(p.category)) seen.push(p.category);
  });
  return seen;
}

export function filterCatalog(products, { category = 'Все', query = '' } = {}) {
  if (!Array.isArray(products)) return [];
  const normalizedQuery = String(query).trim().toLocaleLowerCase('ru');

  return products.filter((product) => {
    const categoryMatches = category === 'Все' || product.category === category;
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;

    const searchText = [product.name, product.artist, product.category, product.medium]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ru');
    return searchText.includes(normalizedQuery);
  });
}

export function getCartSummary(items) {
  return (Array.isArray(items) ? items : []).reduce((summary, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.product?.price) || 0);
    summary.quantity += quantity;
    summary.total += quantity * price;
    return summary;
  }, { quantity: 0, total: 0 });
}

export function formatStorePrice(value, currency = 'сум') {
  const amount = Number(value) || 0;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}
