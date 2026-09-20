import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetUser(...args),
}));

let profileResult: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: () => {
      const stub: any = {
        select: vi.fn(() => stub),
        eq: vi.fn(() => stub),
        maybeSingle: vi.fn(() => Promise.resolve(profileResult)),
      };
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import {
  requireStaff,
  requireAdmin,
  requirePosAccess,
  requirePosPermission,
  requireSuperAdmin,
  requirePermission,
  optionalStaff,
} from "../app/api/v1/_lib/staff-access";

const req = () => new NextRequest("http://localhost:3000/api/v1/x");

function profile(overrides: Record<string, unknown> = {}, perms: Record<string, unknown> | null = { can_process_pos: true }) {
  profileResult = {
    data: {
      id: "u1",
      email: "cashier@gts.ng",
      full_name: "Ada Cashier",
      phone: "0803 123 4567",
      role: "cashier",
      is_blocked: false,
      employee_permissions: perms,
      ...overrides,
    },
    error: null,
  };
}

async function denied(p: Promise<any>, status: number, code: string) {
  const r = await p;
  expect(r.ok).toBe(false);
  expect(r.response.status).toBe(status);
  expect((await r.response.json()).code).toBe(code);
}

describe("requireStaff", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "cashier@gts.ng" });
    profile();
  });

  it("returns 401 with no login", async () => {
    mockGetUser.mockResolvedValue(null);
    await denied(requireStaff(req()), 401, "UNAUTHORIZED");
  });

  it("returns 403 when there is no staff profile", async () => {
    profileResult = { data: null, error: null };
    await denied(requireStaff(req()), 403, "FORBIDDEN");
  });

  it("signs a blocked account out with a clear code and message", async () => {
    profile({ is_blocked: true });
    const r: any = await requireStaff(req());
    expect(r.ok).toBe(false);
    expect(r.response.status).toBe(403);
    const body = await r.response.json();
    expect(body.code).toBe("ACCOUNT_BLOCKED");
    expect(body.error).toMatch(/suspended/i);
  });

  it("refuses customers", async () => {
    profile({ role: "customer" });
    await denied(requireStaff(req()), 403, "FORBIDDEN");
  });

  it("returns the staff member's identity and effective permissions", async () => {
    const r: any = await requireStaff(req());
    expect(r.ok).toBe(true);
    expect(r.user).toEqual({ id: "u1", email: "cashier@gts.ng" });
    expect(r.role).toBe("cashier");
    expect(r.isAdmin).toBe(false);
    expect(r.fullName).toBe("Ada Cashier");
    expect(r.phone).toBe("0803 123 4567");
    expect(r.permissions).toMatchObject({
      can_process_pos: true,
      can_void_orders: false,
      can_apply_discounts: false,
    });
  });

  it("treats permission columns that don't exist yet (migration pending) as not granted", async () => {
    profile({}, { can_process_pos: true });
    const r: any = await requireStaff(req());
    expect(r.permissions.can_void_orders).toBe(false);
    expect(r.permissions.can_apply_discounts).toBe(false);
  });

  it("reads the permissions whether the embed arrives as an object or a one-item array", async () => {
    profile({}, [{ can_process_pos: true, can_void_orders: true }] as never);
    const r: any = await requireStaff(req());
    expect(r.permissions.can_process_pos).toBe(true);
    expect(r.permissions.can_void_orders).toBe(true);
  });

  it("treats a missing permissions row as nothing granted", async () => {
    profile({}, null);
    const r: any = await requireStaff(req());
    expect(r.ok).toBe(true);
    expect(r.permissions.can_process_pos).toBe(false);
  });

  it("gives admins every permission implicitly", async () => {
    profile({ role: "admin" }, null);
    const r: any = await requireStaff(req());
    expect(r.isAdmin).toBe(true);
    expect(Object.values(r.permissions).every((v) => v === true)).toBe(true);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "a@gts.ng" });
  });

  it("refuses a cashier, even with every flag", async () => {
    profile({}, { can_process_pos: true, can_void_orders: true, can_apply_discounts: true });
    await denied(requireAdmin(req()), 403, "FORBIDDEN");
  });

  it("allows an admin", async () => {
    profile({ role: "admin" }, null);
    expect(((await requireAdmin(req())) as any).ok).toBe(true);
  });

  it("still refuses a blocked admin", async () => {
    profile({ role: "admin", is_blocked: true }, null);
    await denied(requireAdmin(req()), 403, "ACCOUNT_BLOCKED");
  });
});

describe("requirePosAccess", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "c@gts.ng" });
  });

  it("refuses staff without can_process_pos", async () => {
    profile({}, { can_process_pos: false });
    await denied(requirePosAccess(req()), 403, "POS_ACCESS_DENIED");
  });

  it("allows a cashier with can_process_pos", async () => {
    profile();
    expect(((await requirePosAccess(req())) as any).ok).toBe(true);
  });

  it("allows an admin without the flag set", async () => {
    profile({ role: "admin" }, null);
    expect(((await requirePosAccess(req())) as any).ok).toBe(true);
  });

  it("refuses a blocked cashier before anything else", async () => {
    profile({ is_blocked: true });
    await denied(requirePosAccess(req()), 403, "ACCOUNT_BLOCKED");
  });
});

describe("requirePosPermission", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "c@gts.ng" });
  });

  it("refuses a POS cashier who hasn't been granted voiding", async () => {
    profile({}, { can_process_pos: true, can_void_orders: false });
    const r: any = await requirePosPermission(req(), "can_void_orders");
    expect(r.ok).toBe(false);
    expect(r.response.status).toBe(403);
    const body = await r.response.json();
    expect(body.code).toBe("PERMISSION_DENIED");
    expect(body.error).toMatch(/void/i);
  });

  it("allows a cashier who has been granted it", async () => {
    profile({}, { can_process_pos: true, can_void_orders: true });
    expect(((await requirePosPermission(req(), "can_void_orders")) as any).ok).toBe(true);
  });

  it("keeps the two grants separate", async () => {
    profile({}, { can_process_pos: true, can_void_orders: true, can_apply_discounts: false });
    expect(((await requirePosPermission(req(), "can_apply_discounts")) as any).ok).toBe(false);
  });

  it("does not let the grant substitute for POS access itself", async () => {
    profile({}, { can_process_pos: false, can_void_orders: true });
    await denied(requirePosPermission(req(), "can_void_orders"), 403, "POS_ACCESS_DENIED");
  });

  it("allows an admin implicitly", async () => {
    profile({ role: "admin" }, null);
    expect(((await requirePosPermission(req(), "can_apply_discounts")) as any).ok).toBe(true);
  });
});


describe("requireSuperAdmin", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "boss@gts.ng" });
  });

  it("lets the super admin through", async () => {
    profile({ role: "admin", is_super_admin: true }, null);
    const r = await requireSuperAdmin(req());
    expect(r.ok && r.isSuperAdmin).toBe(true);
  });

  it("refuses an ordinary admin", async () => {
    profile({ role: "admin", is_super_admin: false }, null);
    await denied(requireSuperAdmin(req()), 403, "SUPER_ADMIN_ONLY");
  });

  it("refuses a cashier, even one wrongly flagged", async () => {
    profile({ role: "cashier", is_super_admin: true });
    await denied(requireSuperAdmin(req()), 403, "SUPER_ADMIN_ONLY");
  });

  it("treats a database without the column yet (migration pending) as not a super admin", async () => {
    profile({ role: "admin" }, null); // no is_super_admin key at all
    await denied(requireSuperAdmin(req()), 403, "SUPER_ADMIN_ONLY");
    const r = await requireAdmin(req());
    expect(r.ok && r.isSuperAdmin).toBe(false);
  });

  it("still refuses a blocked super admin", async () => {
    profile({ role: "admin", is_super_admin: true, is_blocked: true }, null);
    await denied(requireSuperAdmin(req()), 403, "ACCOUNT_BLOCKED");
  });
});


describe("requirePermission (any grant, any route)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "x@gts.ng" });
  });

  it("refuses an anonymous caller with 401", async () => {
    mockGetUser.mockResolvedValue(null);
    await denied(requirePermission(req(), "can_manage_inventory"), 401, "UNAUTHORIZED");
  });

  it("refuses a staff member without that grant, with a 403 that names the action", async () => {
    profile({ role: "cashier" }, { can_process_pos: true });
    const r: any = await requirePermission(req(), "can_manage_inventory");
    expect(r.ok).toBe(false);
    expect(r.response.status).toBe(403);
    expect((await r.response.json()).code).toBe("PERMISSION_DENIED");
  });

  it("lets a staff member with the grant through", async () => {
    profile({ role: "inventory_staff" }, { can_manage_inventory: true });
    expect((await requirePermission(req(), "can_manage_inventory")).ok).toBe(true);
  });

  it("lets an admin through without any grant row", async () => {
    profile({ role: "admin" }, null);
    expect((await requirePermission(req(), "can_manage_products")).ok).toBe(true);
  });

  it("refuses a blocked account even with the grant", async () => {
    profile({ role: "inventory_staff", is_blocked: true }, { can_manage_inventory: true });
    await denied(requirePermission(req(), "can_manage_inventory"), 403, "ACCOUNT_BLOCKED");
  });

  it("refuses a customer", async () => {
    profile({ role: "customer" }, null);
    await denied(requirePermission(req(), "can_view_all_orders"), 403, "FORBIDDEN");
  });
});

describe("optionalStaff (public routes that show more to staff)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("is null for an anonymous caller", async () => {
    mockGetUser.mockResolvedValue(null);
    expect(await optionalStaff(req())).toBeNull();
  });

  it("is null for a customer or a blocked account", async () => {
    mockGetUser.mockResolvedValue({ id: "u1", email: "x@gts.ng" });
    profile({ role: "customer" }, null);
    expect(await optionalStaff(req())).toBeNull();
    profile({ role: "admin", is_blocked: true }, null);
    expect(await optionalStaff(req())).toBeNull();
  });

  it("is the staff context for a signed-in staff member", async () => {
    mockGetUser.mockResolvedValue({ id: "u1", email: "x@gts.ng" });
    profile({ role: "admin" }, null);
    const s = await optionalStaff(req());
    expect(s?.isAdmin).toBe(true);
  });
});

describe("a staff account that must change its one-time password", () => {
  const at = (path: string) => new NextRequest(`http://localhost:3000${path}`);
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "new@gts.ng" });
    profile({ role: "cashier", must_change_password: true }, { can_process_pos: true });
  });

  it.each(["/api/v1/pos/orders", "/api/v1/inventory", "/api/v1/staff/me/sales", "/api/v1/staff/me/activity", "/api/v1/flags"])(
    "is refused on %s until the password is changed",
    async (path) => {
      await denied(requireStaff(at(path)), 403, "PASSWORD_CHANGE_REQUIRED");
      await denied(requirePosAccess(at(path)), 403, "PASSWORD_CHANGE_REQUIRED");
    }
  );

  it.each(["/api/v1/staff/me", "/api/v1/staff/me/password"])("can still reach %s so it can be done", async (path) => {
    const r = await requireStaff(at(path));
    expect(r.ok && r.mustChangePassword).toBe(true);
  });

  it("is a normal account once the flag is cleared", async () => {
    profile({ role: "cashier", must_change_password: false }, { can_process_pos: true });
    const r = await requireStaff(at("/api/v1/pos/orders"));
    expect(r.ok && r.mustChangePassword).toBe(false);
  });

  it("treats a database without the column yet (migration pending) as no requirement", async () => {
    profile({ role: "cashier" }, { can_process_pos: true });
    expect((await requireStaff(at("/api/v1/pos/orders"))).ok).toBe(true);
  });
});
