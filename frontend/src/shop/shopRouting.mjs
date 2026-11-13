// Адрес витрины компании: /shop/<адрес> (латиница, цифры, дефис; 2–40 символов — как companies.store_slug)
export function isShopPath(pathname = '') {
  return /^\/shop\/[a-z0-9][a-z0-9-]{1,39}\/?$/i.test(pathname);
}

// Наш интернет-магазин. Прежние адреса витрины ART Store (/store, /art-store) ведут сюда (2026-11-13).
export const MAIN_SHOP_PATH = '/shop/wave-market';
export function isLegacyStorePath(pathname = '') {
  return /^\/(store|art-store)\/?$/i.test(pathname);
}
