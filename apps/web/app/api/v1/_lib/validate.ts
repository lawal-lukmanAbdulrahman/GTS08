/** Small, dependency-free input checks shared by the admin routes. Each returns a message, or null when the value is fine. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Collapses whitespace (so a newline can't sneak into a one-line field) and trims. */
export const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export function textField(value: unknown, label: string, { max, required = false }: { max: number; required?: boolean }): { value: string | null } | { error: string } {
  if (value === null || value === undefined) return required ? { error: `${label} is required.` } : { value: null };
  if (typeof value !== "string") return { error: `${label} must be text.` };
  const v = oneLine(value);
  if (!v) return required ? { error: `${label} is required.` } : { value: null };
  if (v.length > max) return { error: `${label} must be ${max} characters or fewer.` };
  return { value: v };
}

export const isDbUniqueViolation = (e: { code?: string; message?: string } | null | undefined) => !!e && (e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? ""));
