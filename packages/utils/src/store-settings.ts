export interface StoreSettingsInput {
  store_name?: string;
  store_address?: string | null;
  support_phone?: string | null;
  whatsapp_number?: string | null;
  support_email?: string;
  store_website?: string | null;
  /** Hours a pay-on-pickup order holds its items before it cancels itself. */
  pickup_hold_hours?: number;
  footer_about?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
}

export const SOCIAL_LINK_FIELDS = ["instagram_url", "facebook_url", "tiktok_url", "x_url", "linkedin_url"] as const;
export const PICKUP_HOLD_HOURS = { min: 1, max: 336 } as const;

export type StoreSettingsValidation =
  | { ok: true; value: StoreSettingsInput }
  | { ok: false; errors: Record<string, string> };

const PHONE = /^[0-9+\-()\s]+$/;
// A domain with a dot and a real ending, optionally with http(s):// and a path. No other schemes.
const WEBSITE = /^(https?:\/\/)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(\/\S*)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Social links open from the storefront, so only secure web addresses: never javascript:, data: or plain http.
const SECURE_URL = /^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(\/\S*)?$/;

// Collapsing whitespace also strips newlines, which would otherwise break the
// fixed-width receipt layout when the value is printed.
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Validates the admin-editable store details. Only the fields present in the
 * request are returned, and only fields this endpoint owns, so a PATCH can't
 * touch tax rate, currency, thresholds, or anything else in the settings row.
 */
export function validateStoreSettings(input: unknown): StoreSettingsValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _body: "Expected a JSON object." } };
  }
  const body = input as Record<string, unknown>;
  const value: StoreSettingsInput = {};
  const errors: Record<string, string> = {};

  if ("store_name" in body) {
    if (typeof body.store_name !== "string") errors.store_name = "Store name must be text.";
    else {
      const v = clean(body.store_name);
      if (!v) errors.store_name = "Store name is required.";
      else if (v.length > 100) errors.store_name = "Store name must be 100 characters or fewer.";
      else value.store_name = v;
    }
  }

  const optionalText = (
    key: "store_address" | "support_phone" | "whatsapp_number" | "store_website",
    label: string,
    max: number,
    pattern?: RegExp
  ) => {
    if (!(key in body)) return;
    const raw = body[key];
    if (raw === null) {
      value[key] = null;
      return;
    }
    if (typeof raw !== "string") {
      errors[key] = `${label} must be text.`;
      return;
    }
    const v = clean(raw);
    if (!v) value[key] = null;
    else if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
    else if (pattern && !pattern.test(v)) errors[key] = pattern === WEBSITE ? `${label} must be a web address like www.example.com.` : `${label} can only contain digits, spaces, +, - and brackets.`;
    else value[key] = v;
  };

  optionalText("store_address", "Address", 255);
  optionalText("support_phone", "Phone number", 20, PHONE);
  optionalText("whatsapp_number", "WhatsApp number", 20, PHONE);
  optionalText("store_website", "Website", 255, WEBSITE);

  if ("support_email" in body) {
    if (typeof body.support_email !== "string") errors.support_email = "Email must be text.";
    else {
      const v = clean(body.support_email);
      if (!EMAIL.test(v)) errors.support_email = "Enter a valid email address.";
      else if (v.length > 255) errors.support_email = "Email must be 255 characters or fewer.";
      else value.support_email = v;
    }
  }

  if ("pickup_hold_hours" in body) {
    const h = body.pickup_hold_hours;
    if (typeof h !== "number" || !Number.isInteger(h) || h < PICKUP_HOLD_HOURS.min || h > PICKUP_HOLD_HOURS.max) {
      errors.pickup_hold_hours = `Enter a whole number of hours from ${PICKUP_HOLD_HOURS.min} to ${PICKUP_HOLD_HOURS.max} (14 days).`;
    } else value.pickup_hold_hours = h;
  }

  if ("footer_about" in body) {
    const raw = body.footer_about;
    if (raw === null || raw === "") value.footer_about = null;
    else if (typeof raw !== "string") errors.footer_about = "About text must be text.";
    else {
      const v = clean(raw);
      if (v.length > 300) errors.footer_about = "Keep the about text to 300 characters or fewer.";
      else value.footer_about = v || null;
    }
  }

  for (const key of SOCIAL_LINK_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      value[key] = null;
      continue;
    }
    if (typeof raw !== "string") errors[key] = "Must be a web address.";
    else {
      const v = raw.trim();
      if (v.length > 255 || !SECURE_URL.test(v)) errors[key] = "Use a full secure address, like https://instagram.com/yourshop.";
      else value[key] = v;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) {
    return { ok: false, errors: { _body: "No store detail fields were provided." } };
  }
  return { ok: true, value };
}
