export function isUsableImageUrl(value: string | null | undefined) {
  if (!value) return false;
  if (value.includes("images.example.com")) return false;
  if (value.endsWith("momo-cover.jpg")) return false;
  if (value.endsWith("coffee-cover.jpg")) return false;
  if (value.endsWith("momo-logo.jpg")) return false;
  if (value.endsWith("coffee-logo.jpg")) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const FALLBACK_RESTAURANT_COVER =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop";

export const FALLBACK_MENU_ITEM_IMAGE =
  "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop";
