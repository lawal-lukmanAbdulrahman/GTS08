/**
 * The picture for a POS product card. The catalogue stores either a full
 * https image URL or a bare Cloudinary public id; older seed rows hold local
 * paths like "/products/x.png" that were never uploaded, so those (and
 * anything unsafe) get no picture and the card shows a placeholder instead
 * of a broken-image icon.
 */
export function resolveProductImageUrl(
  stored: string | null | undefined,
  cloudName: string | undefined = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
): string | null {
  const value = stored?.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.startsWith("//")) return null;
  return cloudName ? `https://res.cloudinary.com/${cloudName}/image/upload/${value}` : null;
}
