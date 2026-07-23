const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate a slug against the project convention.
 * Slugs are used in all public URLs.
 */
export function isValidSlug(s: string): boolean {
  return SLUG_REGEX.test(s);
}

/**
 * Convert a string to a valid slug.
 */
export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
