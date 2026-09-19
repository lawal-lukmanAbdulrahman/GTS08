export interface StoreSettingsInput {
  store_name?: string;
  store_address?: string | null;
  support_phone?: string | null;
  whatsapp_number?: string | null;
  support_email?: string;
}

export type StoreSettingsValidation =
  | { ok: true; value: StoreSettingsInput }
  | { ok: false; errors: Record<string, string> };

const PHONE = /^[0-9+\-()\s]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    key: "store_address" | "support_phone" | "whatsapp_number",
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
    else if (pattern && !pattern.test(v)) errors[key] = `${label} can only contain digits, spaces, +, - and brackets.`;
    else value[key] = v;
  };

  optionalText("store_address", "Address", 255);
  optionalText("support_phone", "Phone number", 20, PHONE);
  optionalText("whatsapp_number", "WhatsApp number", 20, PHONE);

  if ("support_email" in body) {
    if (typeof body.support_email !== "string") errors.support_email = "Email must be text.";
    else {
      const v = clean(body.support_email);
      if (!EMAIL.test(v)) errors.support_email = "Enter a valid email address.";
      else if (v.length > 255) errors.support_email = "Email must be 255 characters or fewer.";
      else value.support_email = v;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) {
    return { ok: false, errors: { _body: "No store detail fields were provided." } };
  }
  return { ok: true, value };
}
