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
