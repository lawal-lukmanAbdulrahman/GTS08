import { formatKobo, parseNairaInput } from "@gts/utils";

export interface PromoView {
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
}

export function describeDiscount(p: PromoView): string {
  const what = p.discount_type === "percentage" ? `${p.discount_value}% off` : `${formatKobo(p.discount_value)} off`;
  return p.min_order_amount ? `${what} orders over ${formatKobo(p.min_order_amount)}` : what;
}

export const describeUse = (p: PromoView) => (p.max_uses === null ? `${p.used_count} used` : `${p.used_count} of ${p.max_uses} used`);

export function promoStatus(p: PromoView, now: Date = new Date()): "Live" | "Off" | "Expired" | "Not started" | "Used up" {
  if (!p.is_active) return "Off";
  if (p.expires_at && new Date(p.expires_at).getTime() < now.getTime()) return "Expired";
  if (new Date(p.starts_at).getTime() > now.getTime()) return "Not started";
  if (p.max_uses !== null && p.used_count >= p.max_uses) return "Used up";
  return "Live";
}

export interface PromoFormValues {
  code: string;
  type: "percentage" | "fixed_amount";
  value: string;
  minOrder: string;
  maxUses: string;
  expires: string; // a date (YYYY-MM-DD): the code works through the end of that day in Lagos
}

/** Turns what was typed into what the API takes (naira become kobo), or says what's wrong with each field. */
export function buildPromoBody(v: PromoFormValues): { ok: true; body: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const body: Record<string, unknown> = { code: v.code.trim(), discount_type: v.type };
  if (!v.code.trim()) errors.code = "Enter a code.";

  if (v.type === "percentage") {
    const n = Number(v.value);
    if (!v.value.trim() || !Number.isInteger(n) || n < 1 || n > 100) errors.value = "Enter a whole percentage from 1 to 100.";
    else body.discount_value = n;
  } else {
    const kobo = parseNairaInput(v.value);
    if (kobo === null || kobo < 1) errors.value = "Enter an amount in naira.";
    else body.discount_value = kobo;
  }

  if (v.minOrder.trim()) {
    const kobo = parseNairaInput(v.minOrder);
    if (kobo === null) errors.minOrder = "Enter an amount in naira.";
    else body.min_order_amount = kobo;
  }
  if (v.maxUses.trim()) {
    const n = Number(v.maxUses);
    if (!Number.isInteger(n) || n < 1) errors.maxUses = "Enter a whole number of 1 or more.";
    else body.max_uses = n;
  }
  if (v.expires.trim()) {
    const end = /^\d{4}-\d{2}-\d{2}$/.test(v.expires) ? new Date(`${v.expires}T23:59:59.000Z`) : null;
    if (!end || Number.isNaN(end.getTime())) errors.expires = "Choose a date.";
    else body.expires_at = new Date(end.getTime() - 3_600_000).toISOString(); // 23:59:59 in Lagos (UTC+1)
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, body };
}
