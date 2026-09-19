import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (importActual) => ({
  ...(await importActual<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
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
import { GET, PATCH } from "../app/api/v1/users/[id]/route";

const ADMIN = { ok: true, user: { id: "boss", email: "boss@gts.ng" }, role: "admin", isAdmin: true, fullName: "Boss", phone: null, permissions: {} };
const ctx = (id = "u1") => ({ params: Promise.resolve({ id }) });
const get = (q = "") => new NextRequest(`http://localhost:3000/api/v1/users/u1${q}`);
const patch = (body: unknown) => new NextRequest("http://localhost:3000/api/v1/users/u1", { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) });
const find = (table: string, method: string) => calls.find((c) => c.table === table && c.method === method);

const CASHIER_ROW = {
  id: "u1",
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
    expect((await GET(get(), ctx("nope"))).status).toBe(404);
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
    expect(data.profile).toMatchObject({ id: "u1", email: "ada@gts.ng", full_name: "Ada Cashier", role: "cashier", is_blocked: false });
    expect(data.profile.permissions).toMatchObject({ can_process_pos: true, can_void_orders: true, can_apply_discounts: false });
    expect(data.sales.range).toBe("week");
    expect(data.sales.summary.sales).toMatchObject({ count: 1, total: 1000000 });
    expect(data.activity).toHaveLength(1);
  });

  it("looks up the sales and activity of the person named in the URL, not the admin", async () => {
    await GET(get(), ctx("u1"));
    expect(calls.find((c) => c.table === "transactions" && c.method === "eq" && c.args[0] === "confirmed_by")?.args[1]).toBe("u1");
    expect(calls.find((c) => c.table === "activity_logs" && c.method === "eq" && c.args[0] === "actor_id")?.args[1]).toBe("u1");
  });

  it("rejects an unknown range", async () => {
    expect((await GET(get("?range=forever"), ctx())).status).toBe(400);
  });
});

describe("PATCH /api/v1/users/:id (grant, revoke, block)", () => {
  beforeEach(() => {
    results.employee_permissions = { data: { user_id: "u1", can_process_pos: true, can_void_orders: false, can_apply_discounts: true }, error: null };
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
    expect((await PATCH(patch({ permissions: { can_void_orders: true } }), ctx("nope"))).status).toBe(404);
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
    expect(row).toMatchObject({ user_id: "u1", can_apply_discounts: true, can_void_orders: false, granted_by: "boss" });
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
    results.users = { data: { ...CASHIER_ROW, id: "boss", role: "admin" }, error: null };
    const res = await PATCH(patch({ is_blocked: true }), ctx("boss"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_BLOCK_SELF");
  });

  it("won't change another admin, whose access is implicit", async () => {
    results.users = { data: { ...CASHIER_ROW, id: "other", role: "admin" }, error: null };
    const res = await PATCH(patch({ permissions: { can_void_orders: true } }), ctx("other"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_MODIFY_ADMIN");
  });

  it("records what was granted and revoked in the audit log", async () => {
    await PATCH(patch({ permissions: { can_apply_discounts: true, can_void_orders: false }, is_blocked: false }), ctx());
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "boss",
        action: "staff.permissions_update",
        targetType: "user",
        targetId: "u1",
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
