import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
const mockRequireSuperAdmin = vi.fn();
const mockAuthUpdate = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (importActual) => ({
  ...(await importActual<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireSuperAdmin: (...a: unknown[]) => mockRequireSuperAdmin(...a),
}));

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...a: unknown[]) => mockLog(...a),
  clientIp: () => "1.2.3.4",
}));

type Result = { data?: unknown; error?: unknown };
let results: Record<string, Result> = {};
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    auth: { admin: { updateUserById: (...a: unknown[]) => mockAuthUpdate(...a) } },
    from: (table: string) => {
      const stub: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then" || prop === "single" || prop === "maybeSingle") {
              const r = results[table] ?? { data: [], error: null };
              if (prop === "then") return (resolve: (v: unknown) => void) => resolve(r);
              return () => Promise.resolve(r);
            }
            return (...args: unknown[]) => {
              calls.push({ table, method: prop, args });
              return stub;
            };
          },
        }
      );
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "../app/api/v1/users/[id]/route";

const ADMIN = { ok: true, user: { id: "ceb8447c-c4ab-48d2-8c34-cd9f11e4bed2", email: "boss@gts.ng" }, role: "admin", isAdmin: true, fullName: "Boss", phone: null, permissions: {} };
const ctx = (id = "e4774cdd-a079-4f86-814e-8b9140bb6db4") => ({ params: Promise.resolve({ id }) });
const get = (q = "") => new NextRequest(`http://localhost:3000/api/v1/users/u1${q}`);
const patch = (body: unknown) => new NextRequest("http://localhost:3000/api/v1/users/u1", { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) });
const find = (table: string, method: string) => calls.find((c) => c.table === table && c.method === method);

const CASHIER_ROW = {
  id: "e4774cdd-a079-4f86-814e-8b9140bb6db4",
  email: "ada@gts.ng",
  full_name: "Ada Cashier",
  phone: "0803 123 4567",
  role: "cashier",
  is_blocked: false,
  created_at: "2026-08-01T00:00:00Z",
  employee_permissions: { can_process_pos: true, can_void_orders: true },
};

const refuse = async () => {
  const { NextResponse } = await import("next/server");
  return { ok: false, response: NextResponse.json({ error: "Only admins can do this.", code: "FORBIDDEN" }, { status: 403 }) };
};

beforeEach(() => {
  calls.length = 0;
  results = {};
  mockLog.mockReset();
  mockRequireAdmin.mockReset();
  mockRequireAdmin.mockResolvedValue(ADMIN);
  results.users = { data: CASHIER_ROW, error: null };
});

describe("GET /api/v1/users/:id (admin views a staff member's record)", () => {
  it("is admin-only", async () => {
    mockRequireAdmin.mockResolvedValue(await refuse());
    expect((await GET(get(), ctx())).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("returns 404 for someone who doesn't exist", async () => {
    results.users = { data: null, error: null };
    expect((await GET(get(), ctx("4101bef8-794f-4d98-8e95-dfb54850c68b"))).status).toBe(404);
  });

  it("won't show a customer's record (this is the staff view)", async () => {
    results.users = { data: { ...CASHIER_ROW, role: "customer" }, error: null };
    const res = await GET(get(), ctx());
    expect(res.status).toBe(404);
  });

  it("returns the profile with effective permissions, their sales and their activity", async () => {
    results.transactions = {
      data: [{ amount: 1000000, payment_method: "cash", created_at: "2026-09-19T09:00:00Z", order: { order_number: "GTS-1", channel: "walk_in", status: "completed", discount_amount: 0 } }],
      error: null,
    };
    results.activity_logs = { data: [{ id: "a1", action: "pos.sale", target_type: "order", target_id: "o1", changes: null, created_at: "2026-09-19T09:00:00Z" }], error: null };

    const { data } = await (await GET(get("?range=week"), ctx())).json();
    expect(data.profile).toMatchObject({ id: "e4774cdd-a079-4f86-814e-8b9140bb6db4", email: "ada@gts.ng", full_name: "Ada Cashier", role: "cashier", is_blocked: false });
    expect(data.profile.permissions).toMatchObject({ can_process_pos: true, can_void_orders: true, can_apply_discounts: false });
    expect(data.sales.range).toBe("week");
    expect(data.sales.summary.sales).toMatchObject({ count: 1, total: 1000000 });
    expect(data.activity).toHaveLength(1);
  });

  it("looks up the sales and activity of the person named in the URL, not the admin", async () => {
    await GET(get(), ctx("e4774cdd-a079-4f86-814e-8b9140bb6db4"));
    expect(calls.find((c) => c.table === "transactions" && c.method === "eq" && c.args[0] === "confirmed_by")?.args[1]).toBe("e4774cdd-a079-4f86-814e-8b9140bb6db4");
    expect(calls.find((c) => c.table === "activity_logs" && c.method === "eq" && c.args[0] === "actor_id")?.args[1]).toBe("e4774cdd-a079-4f86-814e-8b9140bb6db4");
  });

  it("rejects an unknown range", async () => {
    expect((await GET(get("?range=forever"), ctx())).status).toBe(400);
  });
});

describe("GET /api/v1/users/:id says who the super admin is", () => {
  it("so the dashboard never offers to block or remove them", async () => {
    mockRequireAdmin.mockReset().mockResolvedValue({ ...ADMIN, isDemo: false });
    results = { users: { data: { ...CASHIER_ROW, role: "admin", is_super_admin: true, is_demo: false }, error: null } };
    const { data } = await (await GET(get(), ctx())).json();
    expect(data.profile.is_super_admin).toBe(true);
  });
});

describe("the demo account and real staff can't see each other's records", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    results = {};
    calls.length = 0;
  });

  it("the demo account gets 'not found' for a real staff member", async () => {
    mockRequireAdmin.mockResolvedValue({ ...ADMIN, isDemo: true });
    results.users = { data: { ...CASHIER_ROW, is_demo: false }, error: null };
    expect((await GET(get(), ctx())).status).toBe(404);
  });

  it("a real admin gets 'not found' for the demo account", async () => {
    mockRequireAdmin.mockResolvedValue({ ...ADMIN, isDemo: false });
    results.users = { data: { ...CASHIER_ROW, role: "admin", is_demo: true }, error: null };
    expect((await GET(get(), ctx())).status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id (grant, revoke, block)", () => {
  beforeEach(() => {
    results.employee_permissions = { data: { user_id: "e4774cdd-a079-4f86-814e-8b9140bb6db4", can_process_pos: true, can_void_orders: false, can_apply_discounts: true }, error: null };
  });

  it("is admin-only", async () => {
    mockRequireAdmin.mockResolvedValue(await refuse());
    expect((await PATCH(patch({ permissions: { can_void_orders: true } }), ctx())).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects invalid JSON, and a body that asks for nothing", async () => {
    expect((await PATCH(patch("{nope"), ctx())).status).toBe(400);
    const res = await PATCH(patch({ unrelated: true }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NOTHING_TO_UPDATE");
  });

  it("returns 404 for someone who doesn't exist", async () => {
    results.users = { data: null, error: null };
    expect((await PATCH(patch({ permissions: { can_void_orders: true } }), ctx("4101bef8-794f-4d98-8e95-dfb54850c68b"))).status).toBe(404);
  });

  it("won't manage a customer", async () => {
    results.users = { data: { ...CASHIER_ROW, role: "customer" }, error: null };
    const res = await PATCH(patch({ permissions: { can_void_orders: true } }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NOT_STAFF");
  });

  it("grants only the flags sent, recording who granted them, and ignores unknown keys", async () => {
    await PATCH(patch({ permissions: { can_apply_discounts: true, can_void_orders: false, is_admin: true, role: "admin" } }), ctx());
    const [row, options] = find("employee_permissions", "upsert")!.args as [Record<string, unknown>, unknown];
    expect(row).toMatchObject({ user_id: "e4774cdd-a079-4f86-814e-8b9140bb6db4", can_apply_discounts: true, can_void_orders: false, granted_by: "ceb8447c-c4ab-48d2-8c34-cd9f11e4bed2" });
    expect(row).not.toHaveProperty("is_admin");
    expect(row).not.toHaveProperty("role");
    expect(row).not.toHaveProperty("can_process_pos");
    expect(options).toEqual({ onConflict: "user_id" });
  });

  it("rejects a permission value that isn't true or false", async () => {
    const res = await PATCH(patch({ permissions: { can_void_orders: "yes" } }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).details.can_void_orders).toBeDefined();
    expect(find("employee_permissions", "upsert")).toBeUndefined();
  });

  it("blocks and unblocks an account", async () => {
    results.users = { data: { ...CASHIER_ROW, is_blocked: true }, error: null };
    await PATCH(patch({ is_blocked: true }), ctx());
    expect(find("users", "update")?.args[0]).toMatchObject({ is_blocked: true });
  });

  it("won't let an admin block themselves and lock everyone out", async () => {
    results.users = { data: { ...CASHIER_ROW, id: "ceb8447c-c4ab-48d2-8c34-cd9f11e4bed2", role: "admin" }, error: null };
    const res = await PATCH(patch({ is_blocked: true }), ctx("ceb8447c-c4ab-48d2-8c34-cd9f11e4bed2"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_BLOCK_SELF");
  });

  it("won't change another admin, whose access is implicit", async () => {
    results.users = { data: { ...CASHIER_ROW, id: "795f3202-b17c-46bc-8d4b-771d8c6c9eaf", role: "admin" }, error: null };
    const res = await PATCH(patch({ permissions: { can_void_orders: true } }), ctx("795f3202-b17c-46bc-8d4b-771d8c6c9eaf"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_MODIFY_ADMIN");
  });

  it("records what was granted and revoked in the audit log", async () => {
    await PATCH(patch({ permissions: { can_apply_discounts: true, can_void_orders: false }, is_blocked: false }), ctx());
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "ceb8447c-c4ab-48d2-8c34-cd9f11e4bed2",
        action: "staff.permissions_update",
        targetType: "user",
        targetId: "e4774cdd-a079-4f86-814e-8b9140bb6db4",
        changes: { granted: ["can_apply_discounts"], revoked: ["can_void_orders"], is_blocked: false },
      })
    );
  });

  it("returns the staff member's resulting permissions", async () => {
    const { data } = await (await PATCH(patch({ permissions: { can_apply_discounts: true } }), ctx())).json();
    expect(data.permissions).toMatchObject({ can_process_pos: true, can_apply_discounts: true, can_void_orders: false });
    expect(data.is_blocked).toBe(false);
  });

  it("reports a database error and logs nothing", async () => {
    results.employee_permissions = { data: null, error: { message: "column can_void_orders does not exist" } };
    const res = await PATCH(patch({ permissions: { can_void_orders: true } }), ctx());
    expect(res.status).toBe(500);
    expect(mockLog).not.toHaveBeenCalled();
  });
});


describe("super admin: other admins' access", () => {
  const SUPER = { ...ADMIN, isSuperAdmin: true };
  const OTHER_ADMIN = { ...CASHIER_ROW, id: "e4774cdd-a079-4f86-814e-8b9140bb6db4", role: "admin", is_super_admin: false, is_demo: false };
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireSuperAdmin.mockReset();
    mockLog.mockReset();
    mockAuthUpdate.mockReset().mockResolvedValue({ error: null });
    results = {};
    calls.length = 0;
  });

  it("the super admin can block another admin", async () => {
    mockRequireAdmin.mockResolvedValue(SUPER);
    results.users = { data: OTHER_ADMIN, error: null };
    const res = await PATCH(patch({ is_blocked: true }), ctx());
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.table === "users" && c.method === "update")?.args[0]).toMatchObject({ is_blocked: true });
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "staff.block", changes: { blocked: true } }));
  });

  it("an ordinary admin can't block another admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ...ADMIN, isSuperAdmin: false });
    results.users = { data: OTHER_ADMIN, error: null };
    const res = await PATCH(patch({ is_blocked: true }), ctx());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SUPER_ADMIN_ONLY");
  });

  it("nobody can block the super admin", async () => {
    mockRequireAdmin.mockResolvedValue(SUPER);
    results.users = { data: { ...OTHER_ADMIN, is_super_admin: true }, error: null };
    const res = await PATCH(patch({ is_blocked: true }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_BLOCK_SUPER_ADMIN");
  });

  it("an admin's permissions still can't be edited (admins hold every one)", async () => {
    mockRequireAdmin.mockResolvedValue(SUPER);
    results.users = { data: OTHER_ADMIN, error: null };
    expect((await PATCH(patch({ permissions: { can_void_orders: false } }), ctx())).status).toBe(400);
  });
});

describe("DELETE /api/v1/users/:id (remove a staff member)", () => {
  const SUPER = { ...ADMIN, isSuperAdmin: true };
  const del = () => DELETE(new NextRequest("http://localhost:3000/api/v1/users/u1", { method: "DELETE" }), ctx());
  const OTHER_ADMIN = { ...CASHIER_ROW, role: "admin", is_super_admin: false, is_demo: false };
  beforeEach(() => {
    mockRequireSuperAdmin.mockReset().mockResolvedValue(SUPER);
    mockLog.mockReset();
    mockAuthUpdate.mockReset().mockResolvedValue({ error: null });
    results = { users: { data: OTHER_ADMIN, error: null } };
    calls.length = 0;
  });

  it("is for the super admin only", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireSuperAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ code: "SUPER_ADMIN_ONLY" }, { status: 403 }) });
    expect((await del()).status).toBe(403);
    expect(mockAuthUpdate).not.toHaveBeenCalled();
  });

  it("disables the login for good but keeps the account row, so their history keeps their name", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    const update = calls.find((c) => c.table === "users" && c.method === "update")!.args[0] as Record<string, unknown>;
    expect(update).toMatchObject({ is_blocked: true });
    expect(typeof update.removed_at).toBe("string");
    expect(calls.some((c) => c.table === "users" && c.method === "delete")).toBe(false);
    expect(mockAuthUpdate).toHaveBeenCalledWith("e4774cdd-a079-4f86-814e-8b9140bb6db4", { ban_duration: "876000h" });
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "staff.remove", targetId: "e4774cdd-a079-4f86-814e-8b9140bb6db4" }));
  });

  it("can remove a cashier too", async () => {
    results.users = { data: { ...CASHIER_ROW, is_demo: false }, error: null };
    expect((await del()).status).toBe(200);
  });

  it("won't remove the super admin or the caller themself", async () => {
    results.users = { data: { ...OTHER_ADMIN, is_super_admin: true }, error: null };
    expect((await del()).status).toBe(400);
    results.users = { data: OTHER_ADMIN, error: null };
    mockRequireSuperAdmin.mockResolvedValue({ ...SUPER, user: { id: "e4774cdd-a079-4f86-814e-8b9140bb6db4" } });
    expect((await del()).status).toBe(400);
    expect(mockAuthUpdate).not.toHaveBeenCalled();
  });

  it("404s someone who isn't staff or was already removed", async () => {
    results.users = { data: { ...OTHER_ADMIN, removed_at: "2026-09-01T00:00:00Z" }, error: null };
    expect((await del()).status).toBe(404);
  });
});
