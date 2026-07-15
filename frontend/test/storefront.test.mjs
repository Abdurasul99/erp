import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_PRODUCTS,
  normalizeErpProducts,
  filterCatalog,
  getCartSummary,
  formatStorePrice,
} from '../src/store/storeCatalog.mjs';
import { isPublicStorefrontPath } from '../src/store/storeRouting.mjs';

test('public storefront routes are isolated from the ERP shell', () => {
  assert.equal(isPublicStorefrontPath('/store'), true);
  assert.equal(isPublicStorefrontPath('/store/'), true);
  assert.equal(isPublicStorefrontPath('/art-store'), true);
  assert.equal(isPublicStorefrontPath('/desktop'), false);
});

test('store catalog module exposes the required storefront API', async () => {
  let catalog;
  try {
    catalog = await import('../src/store/storeCatalog.mjs');
  } catch (error) {
    assert.fail(`Store catalog module is missing: ${error.code || error.message}`);
  }

  assert.ok(Array.isArray(catalog.DEMO_PRODUCTS));
  assert.equal(typeof catalog.normalizeErpProducts, 'function');
  assert.equal(typeof catalog.filterCatalog, 'function');
  assert.equal(typeof catalog.getCartSummary, 'function');
  assert.equal(typeof catalog.formatStorePrice, 'function');
});

test('normalization keeps the ERP selling data', () => {
  const [product] = normalizeErpProducts([
    { id: 91, name_ru: 'Белое поле', brand: 'Азиза', price_sell: '950000', stock: '2', cat_name_ru: 'Картины' },
  ]);

  assert.equal(product.name, 'Белое поле');
  assert.equal(product.price, 950000);
  assert.equal(product.stock, 2);
});

test('normalization supplies curated imagery for an ERP product', () => {
  const [product] = normalizeErpProducts([{ id: 92, name_ru: 'Ритм', price_sell: 400000 }]);

  assert.match(product.image, /^https:\/\/images\.unsplash\.com\//);
});

test('normalization preserves the curated fallback for an empty ERP response', () => {
  assert.equal(normalizeErpProducts([]), DEMO_PRODUCTS);
  assert.equal(normalizeErpProducts(null), DEMO_PRODUCTS);
});

test('normalization maps alternate ERP aliases', () => {
  const [product] = normalizeErpProducts([{
    id: 93,
    name_uz: 'Yoruglik',
    sell: '725000',
    quantity: '4',
    type_name_ru: 'Принты',
    image_url: 'https://example.com/art.jpg',
    unit: 'шт',
  }]);

  assert.equal(product.name, 'Yoruglik');
  assert.equal(product.category, 'Принты');
  assert.equal(product.image, 'https://example.com/art.jpg');
  assert.equal(product.available, true);
});

test('normalization sanitizes malformed numeric fields', () => {
  const [product] = normalizeErpProducts([{ id: 94, price: 'oops', stock: 'unknown' }]);

  assert.equal(product.name, 'Без названия');
  assert.equal(product.price, 0);
  assert.equal(product.stock, 0);
  assert.equal(product.available, false);
});

test('category filtering returns the selected collection', () => {
  const filtered = filterCatalog(DEMO_PRODUCTS, { category: 'Объекты', query: '' });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((product) => product.category === 'Объекты'));
});

test('search matches an artist without letter case sensitivity', () => {
  const filtered = filterCatalog(DEMO_PRODUCTS, { category: 'Все', query: 'малика' });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((product) => product.artist.includes('Малика')));
});

test('an empty query preserves the selected category', () => {
  const filtered = filterCatalog(DEMO_PRODUCTS, { category: 'Принты', query: '   ' });

  assert.ok(filtered.every((product) => product.category === 'Принты'));
});

test('filtering rejects a non-catalog source', () => {
  assert.deepEqual(filterCatalog(null, { category: 'Все' }), []);
});

test('search returns an empty result for an unknown work', () => {
  assert.deepEqual(filterCatalog(DEMO_PRODUCTS, { category: 'Все', query: 'несуществующая-работа' }), []);
});

test('an empty cart has a zero summary', () => {
  assert.deepEqual(getCartSummary([]), { quantity: 0, total: 0 });
});

test('cart quantity contributes to its total', () => {
  const summary = getCartSummary([
    { product: { price: 480000 }, quantity: 2 },
    { product: { price: 1250000 }, quantity: 1 },
  ]);

  assert.deepEqual(summary, { quantity: 3, total: 2210000 });
});

test('cart ignores negative quantities', () => {
  const summary = getCartSummary([{ product: { price: 100 }, quantity: -1 }]);

  assert.deepEqual(summary, { quantity: 0, total: 0 });
});

test('cart clamps a negative price to zero', () => {
  const summary = getCartSummary([{ product: { price: -100 }, quantity: 2 }]);

  assert.deepEqual(summary, { quantity: 2, total: 0 });
});

test('store prices use the UZS suffix', () => {
  assert.match(formatStorePrice(2850000), /2\s?850\s?000\sсум$/);
});

test('store prices sanitize invalid amounts', () => {
  assert.match(formatStorePrice('not-a-number'), /^0\sсум$/);
});
