// Витрина /shop/:slug: товары из API, категории, поиск (RU/UZ, ё=е), сортировка, корзина не больше остатка, цены.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProducts, categoriesOf, filterProducts, reconcileCart, cartAdd, cartSet, cartSummary, formatPrice, phoneDigits } from '../src/shop/shopCatalog.mjs';
import { makeShopT, categoryLabel, productName } from '../src/shop/shopI18n.mjs';
import { isShopPath, isLegacyStorePath, MAIN_SHOP_PATH } from '../src/shop/shopRouting.mjs';

const rows = [
  { id: 1, name_ru: 'Тактический фонарь', name_uz: 'Taktik fonar', price_sell: '86000.00', stock: '20', category_id: 7, cat_name_ru: 'Свет и электроника', cat_name_uz: 'Yoritish va elektronika' },
  { id: 2, name_ru: 'Соковыжималка', name_uz: 'Sharbat siqgich', price_sell: '125000', stock: '3', category_id: 2, cat_name_ru: 'Для кухни', cat_name_uz: 'Oshxona uchun', photo_url: 'uploads/p/2.jpg' },
  { id: 3, name_ru: 'Нож №1', name_uz: 'Pichoq №1', price_sell: '35000', stock: '20', category_id: 2, cat_name_ru: 'Для кухни', cat_name_uz: 'Oshxona uchun' },
  { id: 4, name_ru: 'Без цены', price_sell: '0', stock: '5' },
  { id: 5, name_ru: 'Чётки', name_uz: 'Tasbeh', price_sell: '25000', stock: '1' },
];

test('товары: цена > 0, фото с ведущим /, иконка по категории, без категории — коробка', () => {
  const p = normalizeProducts(rows);
  assert.deepEqual(p.map(x => x.id), [1, 2, 3, 5]);
  assert.equal(p[1].image, '/uploads/p/2.jpg');
  assert.equal(p[0].icon, 'bulb'); assert.equal(p[1].icon, 'kitchen'); assert.equal(p[3].icon, 'box');
  assert.equal(p[0].price, 86000); assert.equal(p[1].stock, 3);
  const g = normalizeProducts([{ id: 9, name_ru: 'Г', price_sell: 1, photo_url: '/uploads/a.jpg', gallery: ['/uploads/b.jpg', 'uploads/c.jpg'], description_ru: ' Описание ' }])[0];
  assert.deepEqual(g.photos, ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'], 'галерея: главное + дополнительные');
  assert.equal(g.description_ru, 'Описание'); assert.equal(p[0].photos.length, 0);
});

test('категории — по числу товаров; поиск по RU и UZ, «ё» = «е»; сортировка по цене', () => {
  const p = normalizeProducts(rows);
  assert.deepEqual(categoriesOf(p).map(c => [c.name_ru, c.count]), [['Для кухни', 2], ['Свет и электроника', 1]]);
  assert.deepEqual(filterProducts(p, { query: 'четки' }).map(x => x.id), [5]);
  assert.deepEqual(filterProducts(p, { query: 'sharbat' }).map(x => x.id), [2]);
  assert.deepEqual(filterProducts(p, { query: 'кухни' }).map(x => x.id).sort(), [2, 3]);
  assert.deepEqual(filterProducts(p, { category: 2, sort: 'cheap' }).map(x => x.id), [3, 2]);
  assert.deepEqual(filterProducts(p, { sort: 'expensive' }).map(x => x.id), [2, 1, 3, 5]);
});

test('корзина: не больше остатка, ноль — убрать, сверка с каталогом, итог', () => {
  const p = normalizeProducts(rows);
  const juicer = p.find(x => x.id === 2);
  let c = cartAdd([], juicer, 2);
  c = cartAdd(c, juicer, 5);
  assert.deepEqual(c, [{ id: 2, qty: 3 }], 'остаток 3');
  c = cartSet(c, juicer, 0);
  assert.deepEqual(c, []);
  const saved = [{ id: 2, qty: 9 }, { id: 99, qty: 1 }, { id: 1, qty: 2 }];
  assert.deepEqual(reconcileCart(saved, p), [{ id: 2, qty: 3 }, { id: 1, qty: 2 }]);
  assert.deepEqual(cartSummary([{ id: 2, qty: 3 }, { id: 1, qty: 2 }], p).total, 3 * 125000 + 2 * 86000);
});

test('цены, телефон, тексты и адрес витрины', () => {
  assert.equal(formatPrice(125000, 'ru'), '125 000 сум');
  assert.equal(formatPrice(125000, 'uz'), '125 000 so‘m');
  assert.equal(formatPrice(125000, 'en'), '125,000 UZS');
  assert.equal(phoneDigits('+998 (90) 123-45-67'), '998901234567');
  assert.equal(makeShopT('ru')('items', 21), '21 товар'); assert.equal(makeShopT('ru')('items', 3), '3 товара'); assert.equal(makeShopT('ru')('items', 11), '11 товаров');
  assert.equal(makeShopT('uz')('left', 2), '2 dona qoldi');
  const cat = { name_ru: 'Для кухни', name_uz: 'Oshxona uchun' };
  assert.deepEqual([categoryLabel(cat, 'ru'), categoryLabel(cat, 'uz'), categoryLabel(cat, 'en')], ['Для кухни', 'Oshxona uchun', 'Kitchen']);
  assert.equal(productName({ name_ru: 'Нож', name_uz: '' }, 'uz'), 'Нож');
  assert.ok(isLegacyStorePath('/store') && isLegacyStorePath('/art-store/') && !isLegacyStorePath('/store/x') && !isLegacyStorePath('/shop/wave-market'), 'старые адреса ART Store');
  assert.ok(isShopPath(MAIN_SHOP_PATH), 'наш магазин — адрес витрины');
  assert.ok(isShopPath('/shop/uy-market') && isShopPath('/shop/uy-market/') && !isShopPath('/shop') && !isShopPath('/store') && !isShopPath('/shop/a') && !isShopPath('/shop/x/y'));
});
