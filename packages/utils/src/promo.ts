import { isPlainObjectLike } from "./_object";

const CODE = /^[A-Z0-9_-]{3,50}$/;
const MAX_FIXED_KOBO = 1_000_000_000;

/** A code as customers type it: trimmed and upper-cased. Null if it isn't a plain code. */
export function normalizePromoCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

export interface PromoRow {
  id?: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  target_type?: "all" | "specific_customers";
  customer_ids?: string[];
  product_scope?: "all" | "specific_products";
  product_ids?: string[];
  max_uses_per_customer?: number | null;
}

export type PromoResult = { ok: true; discount: number } | { ok: false; reason: "INVALID_PROMO" } | { ok: false; reason: "MIN_ORDER"; shortBy: number };

/**
 * What a code takes off a subtotal (kobo). An inactive, not-yet-started,
 * expired or used-up code all give the same "invalid" answer, so a shopper
 * (or a script) can't tell which codes exist.
 */
export function computePromoDiscount(promo: PromoRow, subtotal: number, now: Date = new Date()): PromoResult {
  const started = new Date(promo.starts_at).getTime() <= now.getTime();
  const notExpired = promo.expires_at === null || new Date(promo.expires_at).getTime() >= now.getTime();
  const hasUses = promo.max_uses === null || promo.used_count < promo.max_uses;
  if (!promo.is_active || !started || !notExpired || !hasUses || subtotal <= 0) return { ok: false, reason: "INVALID_PROMO" };

  const min = promo.min_order_amount ?? 0;
  if (subtotal < min) return { ok: false, reason: "MIN_ORDER", shortBy: min - subtotal };

  const raw = promo.discount_type === "percentage" ? Math.floor((subtotal * promo.discount_value) / 100) : promo.discount_value;
  return { ok: true, discount: Math.min(raw, subtotal) };
}

export interface CartItemForPromo {
  product_id?: string;
  price: number;
  quantity: number;
}

export function computePromoDiscountWithScope(
  promo: PromoRow,
  subtotal: number,
  items?: CartItemForPromo[],
  now: Date = new Date()
): PromoResult {
  const started = new Date(promo.starts_at).getTime() <= now.getTime();
  const notExpired = promo.expires_at === null || new Date(promo.expires_at).getTime() >= now.getTime();
  const hasUses = promo.max_uses === null || promo.used_count < promo.max_uses;
  if (!promo.is_active || !started || !notExpired || !hasUses || subtotal <= 0) return { ok: false, reason: "INVALID_PROMO" };

  const min = promo.min_order_amount ?? 0;
  if (subtotal < min) return { ok: false, reason: "MIN_ORDER", shortBy: min - subtotal };

  if (promo.product_scope === "specific_products" && promo.product_ids && promo.product_ids.length > 0 && items && items.length > 0) {
    const eligibleIds = new Set(promo.product_ids);
    const eligibleSubtotal = items
      .filter((it) => it.product_id && eligibleIds.has(it.product_id))
      .reduce((sum, it) => sum + (it.price * it.quantity), 0);

    if (eligibleSubtotal <= 0) {
      return { ok: false, reason: "INVALID_PROMO" };
    }

    const raw = promo.discount_type === "percentage"
      ? Math.floor((eligibleSubtotal * promo.discount_value) / 100)
      : Math.min(promo.discount_value, eligibleSubtotal);

    return { ok: true, discount: Math.min(raw, eligibleSubtotal) };
  }

  const raw = promo.discount_type === "percentage" ? Math.floor((subtotal * promo.discount_value) / 100) : promo.discount_value;
  return { ok: true, discount: Math.min(raw, subtotal) };
}

export interface PromoInput {
  code?: string;
  discount_type?: "percentage" | "fixed_amount";
  discount_value?: number;
  min_order_amount?: number | null;
  max_uses?: number | null;
  starts_at?: string;
  expires_at?: string | null;
  is_active?: boolean;
  target_type?: "all" | "specific_customers";
  customer_ids?: string[];
  product_scope?: "all" | "specific_products";
  product_ids?: string[];
  max_uses_per_customer?: number | null;
}

export type PromoInputResult = { ok: true; value: PromoInput } | { ok: false; errors: Record<string, string> };

const isWhole = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const asDate = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Admin input for creating or updating a promo. Only the fields sent are returned; the use count is never accepted. */
export function validatePromoInput(input: unknown, mode: "create" | "update"): PromoInputResult {
  if (!isPlainObjectLike(input)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const b = input;
  const value: PromoInput = {};
  const errors: Record<string, string> = {};

  if ("code" in b || mode === "create") {
    const code = normalizePromoCode(b.code);
    if (!code) errors.code = "Use 3 to 50 letters, numbers, dashes or underscores.";
    else value.code = code;
  }

  if ("discount_type" in b || mode === "create") {
    if (b.discount_type !== "percentage" && b.discount_type !== "fixed_amount") errors.discount_type = "Choose percentage or fixed amount.";
    else value.discount_type = b.discount_type;
  }

  if ("discount_value" in b || mode === "create") {
    const type = value.discount_type ?? (b.discount_type as string | undefined);
    if (!isWhole(b.discount_value) || b.discount_value < 1) errors.discount_value = "Enter a whole number of 1 or more.";
    else if (type === "percentage" && b.discount_value > 100) errors.discount_value = "A percentage can't be more than 100.";
    else if (b.discount_value > MAX_FIXED_KOBO) errors.discount_value = "That amount is too large.";
    else value.discount_value = b.discount_value;
  }

  if ("min_order_amount" in b) {
    if (b.min_order_amount === null || b.min_order_amount === undefined) {
      value.min_order_amount = null;
    } else if (!isWhole(b.min_order_amount) || b.min_order_amount < 0 || b.min_order_amount > MAX_FIXED_KOBO) {
      errors.min_order_amount = "Enter a whole amount of 0 or more.";
    } else {
      value.min_order_amount = b.min_order_amount;
    }
  }

  if ("max_uses" in b) {
    if (b.max_uses === null) value.max_uses = null;
    else if (!isWhole(b.max_uses) || b.max_uses < 1 || b.max_uses > 10_000_000) errors.max_uses = "Enter a whole number of 1 or more, or leave it unlimited.";
    else value.max_uses = b.max_uses;
  }

  if ("starts_at" in b) {
    const d = asDate(b.starts_at);
    if (!d) errors.starts_at = "Enter a valid date and time.";
    else value.starts_at = d;
  }

  if ("expires_at" in b) {
    if (b.expires_at === null) value.expires_at = null;
    else {
      const d = asDate(b.expires_at);
      if (!d) errors.expires_at = "Enter a valid date and time.";
      else if (value.starts_at && d <= value.starts_at) errors.expires_at = "The end must be after the start.";
      else value.expires_at = d;
    }
  }

  if ("is_active" in b) {
    if (typeof b.is_active !== "boolean") errors.is_active = "Active must be true or false.";
    else value.is_active = b.is_active;
  }

  if ("target_type" in b) {
    if (b.target_type !== "all" && b.target_type !== "specific_customers") {
      errors.target_type = "Choose all or specific customers.";
    } else {
      value.target_type = b.target_type;
    }
  }

  if ("customer_ids" in b) {
    if (!Array.isArray(b.customer_ids)) {
      errors.customer_ids = "customer_ids must be an array of IDs.";
    } else {
      value.customer_ids = b.customer_ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0);
    }
  }

  if ("product_scope" in b) {
    if (b.product_scope !== "all" && b.product_scope !== "specific_products") {
      errors.product_scope = "Choose all or specific products.";
    } else {
      value.product_scope = b.product_scope;
    }
  }

  if ("product_ids" in b) {
    if (!Array.isArray(b.product_ids)) {
      errors.product_ids = "product_ids must be an array of IDs.";
    } else {
      value.product_ids = b.product_ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0);
    }
  }

  if ("max_uses_per_customer" in b) {
    if (b.max_uses_per_customer === null || b.max_uses_per_customer === undefined) {
      value.max_uses_per_customer = null;
    } else if (!isWhole(b.max_uses_per_customer) || b.max_uses_per_customer < 1) {
      errors.max_uses_per_customer = "Enter a whole number of 1 or more, or leave it unlimited.";
    } else {
      value.max_uses_per_customer = b.max_uses_per_customer;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) return { ok: false, errors: { _body: "Nothing to update." } };
  return { ok: true, value };
}
