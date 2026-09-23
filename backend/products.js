'use strict';

// Два продукта на одних учётках.
//
// Компания относится либо к Wave ERP (product = 'wave'), либо к «Мероприятиям»
// (product = 'events' — свой сервис events-api и своя база events). Учётки
// общие: вход один (/api/auth/login), ведёт их админка WoW. Роли у продуктов
// разные, а имя founder есть в обоих — поэтому граница проходит по продукту,
// а не по роли.
//
// Список ролей «Мероприятий» повторён в events-api/src/access.js и во
// frontend/src/events/access.js. Совпадение копий проверяет
// events-api/test/roles-sync.test.js: разойдись они — админка создавала бы
// учётки, которые не могут войти.

const PRODUCTS = ['wave', 'events'];

const PRODUCT_LABELS = { wave: 'Wave ERP', events: 'Мероприятия' };

const WAVE_ROLES = ['founder', 'director', 'manager', 'cashier', 'warehouse', 'seller'];
const EVENTS_ROLES = ['founder', 'project_manager', 'coordinator', 'decorator', 'florist', 'installer'];

// «Войти как» в компанию мероприятий — только управленческие роли: исполнитель
// видит мероприятия, где он в бригаде, а у админа своей бригады нет.
const IMPERSONATABLE_ROLES = {
  wave: WAVE_ROLES,
  events: ['founder', 'project_manager', 'coordinator'],
};

const productOf = (value) => (value === 'events' ? 'events' : 'wave');

// Продукт из формы создания компании. Не передан — Wave, как было до сих пор.
function parseProduct(value) {
  if (value === undefined || value === null || value === '') return 'wave';
  if (!PRODUCTS.includes(value)) {
    throw Object.assign(new Error('Неизвестный продукт компании'), { statusCode: 400 });
  }
  return value;
}

const rolesForProduct = (product) => (productOf(product) === 'events' ? EVENTS_ROLES : WAVE_ROLES);
const roleFitsProduct = (role, product) => rolesForProduct(product).includes(role);

// Граница на API Wave. Учётка «Мероприятий» получает здесь только общий вход:
// /api/auth/* (логин, профиль, смена пароля — они про учётку, не про данные).
// Всё остальное — 403. Продукт берём из подписанного токена; auth() отдельно
// сверяет его с базой, так что подделать его, не зная секрета, нельзя.
function productGate(path, decoded) {
  if (!path.startsWith('/api/')) return null;
  if (path === '/api/auth' || path.startsWith('/api/auth/')) return null;
  if (decoded && decoded.product === 'events') {
    return {
      status: 403,
      body: { error: 'Эта учётка работает в продукте «Мероприятия»', code: 'PRODUCT_MISMATCH' },
    };
  }
  return null;
}

// Продукт в токене разошёлся с базой — токен выписан до переноса компании или
// подделан. У токенов, выписанных до появления продуктов, поля нет: это Wave.
const tokenProductMismatch = (decoded, company) => productOf(decoded.product) !== productOf(company && company.product);

module.exports = {
  PRODUCTS, PRODUCT_LABELS, WAVE_ROLES, EVENTS_ROLES, IMPERSONATABLE_ROLES,
  productOf, parseProduct, rolesForProduct, roleFitsProduct, productGate, tokenProductMismatch,
};
