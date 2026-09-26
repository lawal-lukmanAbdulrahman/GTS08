import { FLAG_REASON_LABELS, formatKobo, type FlagReason } from "@gts/utils";

export interface ActivityLike {
  action: string;
  changes: Record<string, unknown> | null;
}

const PERMISSION_WORDS: Record<string, string> = {
  can_process_pos: "use the POS",
  can_manage_inventory: "manage inventory",
  can_view_all_orders: "view all orders",
  can_manage_products: "manage products",
  can_handle_tickets: "handle support tickets",
  can_void_orders: "void sales",
  can_apply_discounts: "apply manual discounts",
  can_manage_broadcasts: "manage broadcasts & popups",
};

const METHOD_WORDS: Record<string, string> = { cash: "cash", pos_terminal: "card" };

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const items = (n: number | null) => (n === null ? null : `${n} item${n === 1 ? "" : "s"}`);
const join = (parts: Array<string | null>) => parts.filter(Boolean).join(" · ") || undefined;
const reason = (c: Record<string, unknown>) => (str(c.reason) ? `Reason: ${str(c.reason)}` : undefined);

/**
 * A sentence for an audit-trail row. Shows what happened and the useful
 * details, never anything sensitive (the log doesn't hold passwords, tokens or
 * phone numbers to begin with).
 */
export function describeActivity(entry: ActivityLike): { title: string; detail?: string } {
  const c = entry.changes ?? {};
  const money = (k: string) => (num(c[k]) === null ? null : formatKobo(num(c[k])!));
  const withDetail = (title: string, detail: string | undefined) => (detail ? { title, detail } : { title });

  switch (entry.action) {
    case "pos.sale":
      return withDetail(
        str(c.order_number) ? `Sold order ${c.order_number}` : "Sold an order",
        join([money("total"), METHOD_WORDS[str(c.payment_method) ?? ""] ?? null, items(num(c.item_count))])
      );
    case "pos.void":
      return withDetail("Voided a sale", reason(c));
    case "pos.manual_discount": {
      const bps = num(c.share_bps);
      const pct = bps === null ? null : `${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(1)}%`;
      return withDetail(
        "Gave a discount",
        money("amount") && money("subtotal") ? `${money("amount")} off ${money("subtotal")}${pct ? ` (${pct})` : ""}` : undefined
      );
    }
    case "pos.whatsapp_create":
      return withDetail(str(c.order_number) ? `Recorded WhatsApp order ${c.order_number}` : "Recorded a WhatsApp order", join([money("total"), items(num(c.item_count))]));
    case "pos.whatsapp_confirm":
      return withDetail(
        str(c.order_number) ? `Took payment on WhatsApp order ${c.order_number}` : "Took payment on a WhatsApp order",
        join([money("total"), METHOD_WORDS[str(c.payment_method) ?? ""] ?? null])
      );
    case "pos.whatsapp_cancel":
      return withDetail("Cancelled a WhatsApp order", reason(c));
    case "pos.receipt_reprint":
      return { title: str(c.order_number) ? `Reprinted the receipt for ${c.order_number}` : "Reprinted a receipt" };
    case "auth.login":
      return { title: "Signed in" };
    case "auth.logout":
      return { title: "Signed out" };
    case "profile.change_password":
      return { title: "Changed their password" };
    case "profile.update_phone":
      return { title: c.cleared === true ? "Removed their phone number" : "Updated their phone number" };
    case "staff.create":
      return withDetail("Added a staff account", join([str(c.email), str(c.role) ? `as ${String(c.role).replace("_", " ")}` : null]));
    case "staff.permissions_update": {
      const words = (k: string) => (Array.isArray(c[k]) ? (c[k] as string[]).map((p) => PERMISSION_WORDS[p] ?? p).join(", ") : "");
      return withDetail(
        "Changed a staff member's access",
        join([
          words("granted") ? `Allowed: ${words("granted")}` : null,
          words("revoked") ? `Removed: ${words("revoked")}` : null,
          typeof c.is_blocked === "boolean" ? (c.is_blocked ? "Account blocked" : "Account unblocked") : null,
        ])
      );
    }
    case "product_flag.raise":
      return withDetail("Flagged a product", FLAG_REASON_LABELS[str(c.reason) as FlagReason]);
    case "product_flag.update":
      return withDetail("Reviewed a product flag", str(c.status) ? `Marked ${String(c.status).replace("_", " ")}` : undefined);
    case "category.create":
      return { title: "Created a category" };
    case "category.update":
      return { title: "Edited a category" };
    case "category.delete":
      return { title: "Deleted a category" };
    case "category.reorder":
      return { title: "Reordered categories" };
    case "order.update":
      return { title: "Edited an order's notes or courier" };
    case "order.status":
      return withDetail("Moved an order", str(c.from) && str(c.to) ? `${String(c.from).replace("_", " ")} to ${String(c.to).replace("_", " ")}` : undefined);
    case "promo.create":
      return { title: str(c.code) ? `Created promo code ${c.code}` : "Created a promo code" };
    case "promo.update":
      return { title: "Changed a promo code" };
    case "promo.delete":
      return { title: "Deleted a promo code" };
    case "ticket.update":
      return { title: "Updated a support ticket" };
    case "size_guide.update":
      return { title: "Edited a size guide" };
    case "content_slot.update":
      return { title: "Edited homepage content" };
    case "campaign.create":
      return { title: "Created an email campaign" };
    case "campaign.update":
      return { title: "Edited an email campaign" };
    case "campaign.delete":
      return { title: "Deleted an email campaign" };
    case "campaign.send":
      return { title: "Sent or scheduled an email campaign" };
    default:
      return { title: entry.action };
  }
}
