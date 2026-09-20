/**
 * PostgREST filter expressions are built as text (`name.ilike.%x%,email.eq.y`), so a value
 * with a comma or bracket in it can add conditions of its own. Anything that goes into one
 * of those strings must pass through here first.
 */

/** Letters, numbers, spaces and . - _ @ only, trimmed and capped. */
export function filterText(input: string, max = 60): string {
  return input.replace(/[^\p{L}\p{N}@.\-_ ]/gu, "").trim().slice(0, max);
}

/** An email as it may appear in a filter: lower case, and nothing but the characters an address uses. */
export function filterEmail(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}
