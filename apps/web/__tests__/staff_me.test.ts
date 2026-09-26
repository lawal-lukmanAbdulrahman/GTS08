import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireStaff = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requireStaff: (...args: unknown[]) => mockRequireStaff(...args),
}));

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLog(...args),
  clientIp: () => "1.2.3.4",
}));

type Result = { data?: unknown; error?: unknown };
let results: Record<string, Result> = {};
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockSignIn = vi.fn();
const mockUpdateUser = vi.fn();

function makeStub(table: string) {
  const stub: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: [], error: null });
        return (...args: unknown[]) => {
          calls.push({ table, method: prop, args });
          return stub;
        };
      },
    }
  );
  return stub;
}
// The service client has no signInWithPassword on purpose: signing in on it would make its later writes run as the user.
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: (table: string) => makeStub(table),
    auth: { admin: { updateUserById: (...a: unknown[]) => mockUpdateUser(...a) } },
  }),
}));
vi.mock("../app/api/v1/_lib/verify-password", () => ({
  verifyPassword: async (email: string, password: string) => {
    const r = (await mockSignIn({ email, password })) as { data?: { user?: unknown }; error?: unknown } | undefined;
    return !r?.error && !!r?.data?.user;
  },
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "../app/api/v1/staff/me/route";
import { POST as changePassword } from "../app/api/v1/staff/me/password/route";

const STAFF = {
  ok: true,
  user: { id: "u1", email: "ada@gts.ng" },
  role: "cashier",
  isAdmin: false,
  fullName: "Ada Cashier",
  phone: "0803 123 4567",
  permissions: {
    can_process_pos: true,
    can_manage_inventory: false,
    can_view_all_orders: false,
    can_manage_products: false,
    can_handle_tickets: false,
    can_void_orders: false,
    can_apply_discounts: true,
  },
};

const json = (method: string, body: unknown) =>
  new NextRequest("http://localhost:3000/api/v1/staff/me", { method, body: typeof body === "string" ? body : JSON.stringify(body) });

const blocked = async () => {
  const { NextResponse } = await import("next/server");
  return { ok: false, response: NextResponse.json({ error: "Your account access has been suspended.", code: "ACCOUNT_BLOCKED" }, { status: 403 }) };
};

beforeEach(() => {
  calls.length = 0;
  results = {};
  mockLog.mockReset();
  mockSignIn.mockReset();
  mockUpdateUser.mockReset();
  mockRequireStaff.mockReset();
  mockRequireStaff.mockResolvedValue(STAFF);
});

describe("GET /api/v1/staff/me", () => {
  it("passes through a refusal (not signed in, blocked, ...)", async () => {
    mockRequireStaff.mockResolvedValue(await blocked());
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/staff/me"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_BLOCKED");
  });

  it("returns the staff member's own profile and what they may do", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/staff/me"));
    expect((await res.json()).data).toEqual({
      id: "u1",
      email: "ada@gts.ng",
      full_name: "Ada Cashier",
      phone: "0803 123 4567",
      role: "cashier",
      is_admin: false,
      permissions: STAFF.permissions,
    });
  });
});

describe("PATCH /api/v1/staff/me (phone only)", () => {
  it("passes through a refusal", async () => {
    mockRequireStaff.mockResolvedValue(await blocked());
    expect((await PATCH(json("PATCH", { phone: "0803 000 0000" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("updates the phone number on the staff member's own row and records it", async () => {
    results.users = { data: { phone: "0801 234 5678" }, error: null };
    const res = await PATCH(json("PATCH", { phone: " 0801 234 5678 " }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.phone).toBe("0801 234 5678");

    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ phone: "0801 234 5678" });
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["id", "u1"]);
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "u1", action: "profile.update_phone", targetType: "user", targetId: "u1", ip: "1.2.3.4" })
    );
  });

  it("does not put the phone number itself in the audit log", async () => {
    results.users = { data: { phone: "0801 234 5678" }, error: null };
    await PATCH(json("PATCH", { phone: "0801 234 5678" }));
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain("0801 234 5678");
  });

  it("can clear the number", async () => {
    results.users = { data: { phone: null }, error: null };
    const res = await PATCH(json("PATCH", { phone: "" }));
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ phone: null });
  });

  it("cannot be used to change email, role or anything else", async () => {
    results.users = { data: { phone: "0801 234 5678" }, error: null };
    await PATCH(json("PATCH", { phone: "0801 234 5678", email: "x@evil.com", role: "admin", is_blocked: false, full_name: "Boss" }));
    const written = calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(["phone", "updated_at"]);
  });

  it("requires a phone field", async () => {
    const res = await PATCH(json("PATCH", { email: "x@evil.com" }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects an invalid number without writing", async () => {
    const res = await PATCH(json("PATCH", { phone: "call me" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.phone).toBeDefined();
    expect(calls).toHaveLength(0);
  });

  it("rejects invalid JSON", async () => {
    expect((await PATCH(json("PATCH", "{nope"))).status).toBe(400);
  });

  it("reports a database error", async () => {
    results.users = { data: null, error: { message: "boom" } };
    const res = await PATCH(json("PATCH", { phone: "0801 234 5678" }));
    expect(res.status).toBe(500);
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/staff/me/password", () => {
  const body = { current_password: "OldPass123!", new_password: "NewPass456!", confirm_password: "NewPass456!" };
  const post = (b: unknown) => new NextRequest("http://localhost:3000/api/v1/staff/me/password", { method: "POST", body: JSON.stringify(b) });

  beforeEach(() => {
    mockSignIn.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("passes through a refusal", async () => {
    mockRequireStaff.mockResolvedValue(await blocked());
    expect((await changePassword(post(body))).status).toBe(403);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid change with field errors and never touches the account", async () => {
    const res = await changePassword(post({ current_password: "", new_password: "abc", confirm_password: "xyz" }));
    const b = await res.json();
    expect(res.status).toBe(400);
    expect(b.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(b.details).sort()).toEqual(["confirm_password", "current_password", "new_password"]);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("checks the current password against the account's own email", async () => {
    await changePassword(post(body));
    expect(mockSignIn).toHaveBeenCalledWith({ email: "ada@gts.ng", password: "OldPass123!" });
  });

  it("refuses a wrong current password with a 400 (not 401, so the UI doesn't sign the user out)", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    const res = await changePassword(post(body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CURRENT_PASSWORD_INCORRECT");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("sets the new password on the signed-in account and records the change", async () => {
    const res = await changePassword(post(body));
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("u1", { password: "NewPass456!" });
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "u1", action: "profile.change_password", targetId: "u1" })
    );
  });

  it("never writes any password into the audit log", async () => {
    await changePassword(post(body));
    const logged = JSON.stringify(mockLog.mock.calls);
    expect(logged).not.toContain("OldPass123!");
    expect(logged).not.toContain("NewPass456!");
  });

  it("reports a failure to set the new password", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "weak" } });
    const res = await changePassword(post(body));
    expect(res.status).toBe(500);
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe("must_change_password (one-time passwords)", () => {
  const body = { current_password: "OldPass123!", new_password: "NewPass456!", confirm_password: "NewPass456!" };
  const post = (b: unknown) => new NextRequest("http://localhost:3000/api/v1/staff/me/password", { method: "POST", body: JSON.stringify(b) });

  beforeEach(() => {
    calls.length = 0;
    results = {};
    mockRequireStaff.mockResolvedValue({ ...STAFF, mustChangePassword: true });
    mockSignIn.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("GET /staff/me tells the app the password must be changed", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/staff/me"));
    expect((await res.json()).data.must_change_password).toBe(true);
  });

  it("GET /staff/me says false for a normal account", async () => {
    mockRequireStaff.mockResolvedValue({ ...STAFF, mustChangePassword: false });
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/staff/me"));
    expect((await res.json()).data.must_change_password).toBe(false);
  });

  it("changing the password clears the requirement", async () => {
    const res = await changePassword(post(body));
    expect(res.status).toBe(200);
    const update = calls.find((c) => c.table === "users" && c.method === "update");
    expect(update?.args[0]).toMatchObject({ must_change_password: false });
  });

  it("doesn't clear it if the password change failed", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "nope" } });
    await changePassword(post(body));
    expect(calls.find((c) => c.table === "users" && c.method === "update")).toBeUndefined();
  });

  it("still succeeds if the flag column doesn't exist yet (migration pending)", async () => {
    results.users = { error: { message: 'column "must_change_password" does not exist' } };
    expect((await changePassword(post(body))).status).toBe(200);
  });
});
