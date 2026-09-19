export const FLAG_REASONS = ["wrong_price", "wrong_stock", "damaged", "missing_image", "barcode_issue", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  wrong_price: "Wrong price",
  wrong_stock: "Stock count is off",
  damaged: "Damaged item",
  missing_image: "Missing or wrong image",
  barcode_issue: "Barcode won't scan",
  other: "Something else",
};

export const FLAG_NOTE_MAX = 500;

export interface ProductFlagInput {
  product_id: string;
  variant_id: string | null;
  reason: FlagReason;
  note: string | null;
}

export type ProductFlagValidation =
  | { ok: true; value: ProductFlagInput }
  | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A cashier raising an issue on a product. Shared by the POS form and the API. */
export function validateProductFlag(input: unknown): ProductFlagValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _body: "Expected a JSON object." } };
  }
  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const productId = typeof body.product_id === "string" ? body.product_id : "";
  if (!UUID.test(productId)) errors.product_id = "Choose a product to flag.";

  let variantId: string | null = null;
  if (body.variant_id !== undefined && body.variant_id !== null) {
    if (typeof body.variant_id === "string" && UUID.test(body.variant_id)) variantId = body.variant_id;
    else errors.variant_id = "That variant isn't valid.";
  }

  const reason = body.reason as FlagReason;
  if (!FLAG_REASONS.includes(reason)) errors.reason = "Choose what's wrong.";

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") errors.note = "The note must be text.";
    else {
      const cleaned = body.note.replace(/\s+/g, " ").trim();
      if (cleaned.length > FLAG_NOTE_MAX) errors.note = `Keep the note to ${FLAG_NOTE_MAX} characters or fewer.`;
      else note = cleaned || null;
    }
  }
  if (reason === "other" && !errors.note && !note) errors.note = "Tell us what's wrong.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { product_id: productId, variant_id: variantId, reason, note } };
}

export const FLAG_STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const FLAG_STATUS_LABELS: Record<FlagStatus, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export interface FlagUpdateInput {
  status: FlagStatus;
  resolution_note: string | null;
}

export type FlagUpdateValidation =
  | { ok: true; value: FlagUpdateInput }
  | { ok: false; errors: Record<string, string> };

/** An admin moving a flag along: reviewing, resolving or dismissing it. */
export function validateFlagUpdate(input: unknown): FlagUpdateValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { _body: "Expected a JSON object." } };
  }
  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const status = body.status as FlagStatus;
  if (!FLAG_STATUSES.includes(status)) errors.status = "Choose a valid status.";

  let note: string | null = null;
  if (body.resolution_note !== undefined && body.resolution_note !== null) {
    if (typeof body.resolution_note !== "string") errors.resolution_note = "The note must be text.";
    else {
      const cleaned = body.resolution_note.replace(/\s+/g, " ").trim();
      if (cleaned.length > FLAG_NOTE_MAX) errors.resolution_note = `Keep the note to ${FLAG_NOTE_MAX} characters or fewer.`;
      else note = cleaned || null;
    }
  }
  // Closing a flag without saying why leaves the cashier guessing.
  if ((status === "resolved" || status === "dismissed") && !errors.resolution_note && !note) {
    errors.resolution_note = "Add a short note for the cashier.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { status, resolution_note: note } };
}
