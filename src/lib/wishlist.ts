export const WISHLIST_ITEM_MAX_LENGTH = 120;
export const WISHLIST_MAX_LENGTH = 5000;
export const WISHLIST_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const WISHLIST_MAX_PHOTOS = 10;
export const WISHLIST_PHOTO_TOO_LARGE = "Escolha uma foto de até 3 MB.";

export type WishlistPhotoIds = Record<number, string>;

export function wishlistItems(text: string): string[] {
  return text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

// Existing long suggestions remain editable/removable without truncating them.
// Only occurrences already stored may exceed the new per-suggestion limit.
export function hasOnlyShortNewSuggestions(text: string, previousText: string): boolean {
  const legacy = wishlistItems(previousText).filter(item => item.length > WISHLIST_ITEM_MAX_LENGTH);
  for (const item of wishlistItems(text)) {
    if (item.length <= WISHLIST_ITEM_MAX_LENGTH) continue;
    const index = legacy.indexOf(item);
    if (index < 0) return false;
    legacy.splice(index, 1);
  }
  return true;
}
