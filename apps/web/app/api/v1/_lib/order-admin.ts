import { isPlainObject, oneLine } from "./validate";

export interface CourierFields {
  carrier_name?: string | null;
  tracking_number?: string | null;
  carrier_tracking_url?: string | null;
  internal_notes?: string | null;
}

/** Validates the courier and note fields an admin can set on an order. Only fields present are returned. */
export function validateCourierFields(body: unknown): { ok: true; value: CourierFields } | { ok: false; errors: Record<string, string> } {
  if (!isPlainObject(body)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const value: CourierFields = {};
  const errors: Record<string, string> = {};

  const text = (key: "carrier_name" | "tracking_number" | "internal_notes", label: string, max: number, multiline = false) => {
    if (!(key in body)) return;
    const raw = body[key];
    if (raw === null) return void (value[key] = null);
    if (typeof raw !== "string") return void (errors[key] = `${label} must be text.`);
    const v = multiline ? raw.trim() : oneLine(raw);
    if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
    else value[key] = v || null;
  };
  text("carrier_name", "Courier", 100);
  text("tracking_number", "Tracking number", 100);
  text("internal_notes", "Notes", 2000, true);

  if ("carrier_tracking_url" in body) {
    const raw = body.carrier_tracking_url;
    if (raw === null || raw === "") value.carrier_tracking_url = null;
    else if (typeof raw !== "string" || raw.length > 500 || !/^https:\/\/[^\s]+$/i.test(raw.trim())) errors.carrier_tracking_url = "Tracking link must be a secure (https) web address.";
    else value.carrier_tracking_url = raw.trim();
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}
