export const STORE_INTRO_KEY = 'art-store-intro';

export function shouldShowStoreIntro(storage) {
  try {
    return storage?.getItem(STORE_INTRO_KEY) !== 'seen';
  } catch {
    return true;
  }
}

export function markStoreIntroSeen(storage) {
  try {
    storage?.setItem(STORE_INTRO_KEY, 'seen');
    return Boolean(storage);
  } catch {
    return false;
  }
}
