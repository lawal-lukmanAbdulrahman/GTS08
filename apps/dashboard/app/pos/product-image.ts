/** Catalogue images that ship inside the app itself ("/products/x.png"), served from this site. */
const LOCAL_PRODUCT_IMAGE = /^\/products\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

/**
 * The picture for a POS product card. The catalogue stores a full https image
 * URL, a bare Cloudinary public id, or the path of an image that ships with
 * the app ("/products/x.png"). Anything else (unsafe values, other hosts,
 * traversal) gets no picture and the card shows a placeholder.
 */
export function resolveProductImageUrl(
  stored: string | null | undefined,
  cloudName: string | undefined = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
): string | null {
  const value = stored?.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (LOCAL_PRODUCT_IMAGE.test(value) && !value.includes("..")) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.startsWith("//")) return null;
  return cloudName ? `https://res.cloudinary.com/${cloudName}/image/upload/${value}` : null;
}
