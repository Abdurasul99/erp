const PUBLIC_STOREFRONT_PATHS = new Set(['/store', '/art-store']);

export function isPublicStorefrontPath(pathname = '') {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_STOREFRONT_PATHS.has(normalizedPath);
}
