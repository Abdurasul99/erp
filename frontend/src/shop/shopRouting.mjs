// Адрес витрины компании: /shop/<адрес> (латиница, цифры, дефис; 2–40 символов — как companies.store_slug)
export function isShopPath(pathname = '') {
  return /^\/shop\/[a-z0-9][a-z0-9-]{1,39}\/?$/i.test(pathname);
}
