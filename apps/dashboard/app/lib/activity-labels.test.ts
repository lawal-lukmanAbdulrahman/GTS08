import { describe, it, expect } from "vitest";
import { describeActivity } from "./activity-labels";

const entry = (action: string, changes: Record<string, unknown> | null = null) => ({
  id: "a1",
  action,
  target_type: "order",
  target_id: "o1",
  changes,
  created_at: "2026-09-19T09:00:00Z",
});

describe("describeActivity", () => {
  it("describes a sale with its order number, total and how it was paid", () => {
    expect(describeActivity(entry("pos.sale", { order_number: "GTS-202609-000010", total: 8500000, payment_method: "cash", item_count: 2 }))).toEqual({
      title: "Sold order GTS-202609-000010",
      detail: "₦85,000 · cash · 2 items",
    });
  });

  it("says 'card' for a terminal payment and '1 item' in the singular", () => {
    expect(describeActivity(entry("pos.sale", { order_number: "GTS-1", total: 100, payment_method: "pos_terminal", item_count: 1 })).detail).toBe("₦1 · card · 1 item");
  });

  it("describes a void with its reason", () => {
    expect(describeActivity(entry("pos.void", { reason: "wrong item scanned" }))).toEqual({ title: "Voided a sale", detail: "Reason: wrong item scanned" });
  });

  it("describes a manual discount as an amount and a share of the subtotal", () => {
    expect(describeActivity(entry("pos.manual_discount", { amount: 300000, subtotal: 3000000, share_bps: 1000 }))).toEqual({
      title: "Gave a discount",
      detail: "₦3,000 off ₦30,000 (10%)",
    });
  });

  it("describes the WhatsApp actions", () => {
    expect(describeActivity(entry("pos.whatsapp_create", { order_number: "GTS-2", total: 4500000, item_count: 1 }))).toEqual({
      title: "Recorded WhatsApp order GTS-2",
      detail: "₦45,000 · 1 item",
    });
    expect(describeActivity(entry("pos.whatsapp_confirm", { order_number: "GTS-2", total: 4500000, payment_method: "cash" }))).toEqual({
      title: "Took payment on WhatsApp order GTS-2",
      detail: "₦45,000 · cash",
    });
    expect(describeActivity(entry("pos.whatsapp_cancel", { reason: "went quiet" }))).toEqual({
      title: "Cancelled a WhatsApp order",
      detail: "Reason: went quiet",
    });
  });

  it("describes a reprint", () => {
    expect(describeActivity(entry("pos.receipt_reprint", { order_number: "GTS-3" }))).toEqual({ title: "Reprinted the receipt for GTS-3" });
  });

  it("describes account actions without exposing anything sensitive", () => {
    expect(describeActivity(entry("auth.login")).title).toBe("Signed in");
    expect(describeActivity(entry("auth.logout")).title).toBe("Signed out");
    expect(describeActivity(entry("profile.change_password")).title).toBe("Changed their password");
    expect(describeActivity(entry("profile.update_phone", { cleared: false })).title).toBe("Updated their phone number");
    expect(describeActivity(entry("profile.update_phone", { cleared: true })).title).toBe("Removed their phone number");
  });

  it("describes permission changes in plain words", () => {
    expect(
      describeActivity(entry("staff.permissions_update", { granted: ["can_void_orders"], revoked: ["can_apply_discounts"], is_blocked: true }))
    ).toEqual({
      title: "Changed a staff member's access",
      detail: "Allowed: void sales · Removed: apply manual discounts · Account blocked",
    });
  });

  it("describes product flags", () => {
    expect(describeActivity(entry("product_flag.raise", { product_id: "p1", reason: "wrong_price" }))).toEqual({
      title: "Flagged a product",
      detail: "Wrong price",
    });
    expect(describeActivity(entry("product_flag.update", { status: "resolved" }))).toEqual({ title: "Reviewed a product flag", detail: "Marked resolved" });
  });

  it("falls back to the raw action for one it doesn't know, rather than hiding it", () => {
    expect(describeActivity(entry("something.new"))).toEqual({ title: "something.new" });
  });

  it("copes with missing details on a known action", () => {
    expect(describeActivity(entry("pos.sale", null))).toEqual({ title: "Sold an order" });
    expect(describeActivity(entry("pos.void", {}))).toEqual({ title: "Voided a sale" });
  });
});
