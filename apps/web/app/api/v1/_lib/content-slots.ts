import { isPlainObject, textField } from "./validate";

export const SLOT_KEYS = ["hero_1", "hero_2", "hero_3", "promo_banner", "deal_banner", "announcement_bar"] as const;
export const isSlotKey = (k: string): k is (typeof SLOT_KEYS)[number] => (SLOT_KEYS as readonly string[]).includes(k);

/** A link must stay on the site (/path) or be a secure web address: never a script or a protocol-relative URL. */
const LINK = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/i;

export function validateSlot(input: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  if (!isPlainObject(input)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const value: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [key, label, max] of [["headline", "Headline", 200], ["subheadline", "Subheadline", 300], ["cta_label", "Button text", 100], ["image_cloudinary_id", "Image", 255], ["mobile_image_cloudinary_id", "Mobile image", 255]] as const) {
    if (!(key in input)) continue;
    const r = textField(input[key], label, { max });
    if ("error" in r) errors[key] = r.error;
    else value[key] = r.value;
  }
  if ("cta_link" in input) {
    if (input.cta_link === null || input.cta_link === "") value.cta_link = null;
    else if (typeof input.cta_link !== "string" || input.cta_link.length > 500 || !LINK.test(input.cta_link.trim())) errors.cta_link = "Use a link on this site (like /shop) or a secure https address.";
    else value.cta_link = input.cta_link.trim();
  }
  if ("is_active" in input) {
    if (typeof input.is_active !== "boolean") errors.is_active = "Active must be true or false.";
    else value.is_active = input.is_active;
  }
  for (const key of ["start_date", "end_date"] as const) {
    if (!(key in input)) continue;
    if (input[key] === null) value[key] = null;
    else if (typeof input[key] !== "string" || Number.isNaN(new Date(input[key] as string).getTime())) errors[key] = "Enter a valid date and time.";
    else value[key] = new Date(input[key] as string).toISOString();
  }
  if (typeof value.start_date === "string" && typeof value.end_date === "string" && value.end_date <= value.start_date) errors.end_date = "The end must be after the start.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) return { ok: false, errors: { _body: "Nothing to update." } };
  return { ok: true, value };
}
