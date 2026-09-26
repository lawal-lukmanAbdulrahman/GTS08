import { describe, it, expect } from "vitest";
import { validateNewStaff } from "@gts/utils";

const ok = { email: "Ada@Example.com ", full_name: "  Ada   Obi ", role: "cashier" };

describe("validateNewStaff", () => {
  it("cleans and accepts a cashier, defaulting to only POS access", () => {
    const r = validateNewStaff(ok);
    expect(r).toEqual({
      ok: true,
      value: {
        email: "ada@example.com",
        full_name: "Ada Obi",
        role: "cashier",
        permissions: {
          can_process_pos: true,
          can_manage_inventory: false,
          can_view_all_orders: false,
          can_manage_products: false,
          can_handle_tickets: false,
          can_void_orders: false,
          can_apply_discounts: false,
          can_manage_broadcasts: false,
        },
      },
    });
  });

  it("takes the grants that were sent, leaving the rest off", () => {
    const r = validateNewStaff({ ...ok, permissions: { can_void_orders: true, can_process_pos: false } });
    expect(r.ok && r.value.permissions.can_void_orders).toBe(true);
    expect(r.ok && r.value.permissions.can_process_pos).toBe(false);
  });

  it("gives an inventory_staff member inventory access by default", () => {
    const r = validateNewStaff({ ...ok, role: "inventory_staff" });
    expect(r.ok && r.value.permissions.can_manage_inventory).toBe(true);
    expect(r.ok && r.value.permissions.can_process_pos).toBe(false);
  });

  it("ignores permission grants for an admin (their access is implicit)", () => {
    const r = validateNewStaff({ ...ok, role: "admin", permissions: { can_void_orders: false } });
    expect(r.ok && Object.values(r.value.permissions).every(Boolean)).toBe(true);
  });

  it.each([
    [{ ...ok, email: "" }, "email"],
    [{ ...ok, email: "not-an-email" }, "email"],
    [{ ...ok, full_name: "" }, "full_name"],
    [{ ...ok, full_name: "x".repeat(101) }, "full_name"],
    [{ ...ok, role: "customer" }, "role"],
    [{ ...ok, role: "super_admin" }, "role"],
    [{ ...ok, role: undefined }, "role"],
    [{ ...ok, permissions: { can_void_orders: "yes" } }, "permissions"],
  ])("rejects %j", (input, field) => {
    const r = validateNewStaff(input);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });

  it("rejects a non-object body", () => {
    expect(validateNewStaff(null).ok).toBe(false);
    expect(validateNewStaff("x").ok).toBe(false);
  });
});
