import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireSuperAdmin: (...a: unknown[]) => mockRequireSuperAdmin(...a),
  requireAdmin: vi.fn(),
}));

type Call = { table?: string; method: string; args: unknown[] };
let calls: Call[] = [];
let failTable: string | null = null;
let missingColumn = false; // simulates a database where migration 00012 is not applied yet
let createUserResult: { data: any; error: any } = { data: { user: { id: "new-1" } }, error: null };
const mockDeleteUser = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        createUser: (arg: unknown) => {
          calls.push({ method: "createUser", args: [arg] });
          return Promise.resolve(createUserResult);
        },
        deleteUser: (...a: unknown[]) => mockDeleteUser(...(a as [])),
      },
    },
    from: (table: string) => {
      const stub: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => {
              const lastUpsert = [...calls].reverse().find((c) => c.table === table && c.method === "upsert");
              const hasFlag = table === "users" && !!lastUpsert && typeof lastUpsert.args[0] === "object" && "must_change_password" in (lastUpsert.args[0] as object);
              if (missingColumn && hasFlag) return resolve({ data: null, error: { message: 'column "must_change_password" of relation "users" does not exist' } });
              resolve({ data: null, error: failTable === table ? { message: `${table} failed` } : null });
            };
          }
          return (...args: unknown[]) => {
            calls.push({ table, method: prop, args });
            return stub;
          };
        },
      });
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/users/staff/route";

const SUPER = { ok: true, user: { id: "boss", email: "boss@gts.ng" }, role: "admin", isAdmin: true, isSuperAdmin: true, fullName: "Boss", phone: null, permissions: {} };
const post = (body: unknown) => POST(new NextRequest("http://localhost:3000/api/v1/users/staff", { method: "POST", body: JSON.stringify(body) }));
const GOOD = { email: "ada@example.com", full_name: "Ada Obi", role: "cashier" };
const on = (table: string, method: string) => calls.filter((c) => c.table === table && c.method === method);

describe("POST /api/v1/users/staff (super admin adds a person)", () => {
  beforeEach(() => {
    calls = [];
    failTable = null;
    missingColumn = false;
    createUserResult = { data: { user: { id: "new-1" } }, error: null };
    mockDeleteUser.mockClear();
    mockRequireSuperAdmin.mockReset();
    mockRequireSuperAdmin.mockResolvedValue(SUPER);
  });

  it("refuses anyone who isn't the super admin", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireSuperAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ code: "SUPER_ADMIN_ONLY" }, { status: 403 }) });
    const res = await post(GOOD);
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects bad input with field errors and creates nothing", async () => {
    const res = await post({ ...GOOD, email: "nope" });
    expect(res.status).toBe(400);
    expect((await res.json()).details.email).toBeTruthy();
    expect(calls.filter((c) => c.method === "createUser")).toHaveLength(0);
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(new NextRequest("http://localhost:3000/api/v1/users/staff", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });

  it("creates a confirmed login with a random password, the profile, and the grants; returns the password once", async () => {
    const res = await post({ ...GOOD, permissions: { can_void_orders: true } });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { data } = await res.json();
    expect(data).toMatchObject({ id: "new-1", email: "ada@example.com", full_name: "Ada Obi", role: "cashier" });
    expect(data.temporary_password).toMatch(/^.{12,}$/);

    const created = calls.find((c) => c.method === "createUser")!.args[0] as any;
    expect(created).toMatchObject({ email: "ada@example.com", email_confirm: true, password: data.temporary_password });

    expect(on("users", "upsert")[0]!.args[0]).toMatchObject({ id: "new-1", role: "cashier", is_blocked: false, full_name: "Ada Obi" });
    expect(on("employee_permissions", "upsert")[0]!.args[0]).toMatchObject({
      user_id: "new-1", can_process_pos: true, can_void_orders: true, can_apply_discounts: false, granted_by: "boss",
    });
  });

  it("marks the account as needing a password change on first sign-in", async () => {
    await post(GOOD);
    expect(on("users", "upsert")[0]!.args[0]).toMatchObject({ must_change_password: true });
  });

  it("still creates the account if the flag column doesn't exist yet (migration pending), retrying without it", async () => {
    missingColumn = true;
    const res = await post(GOOD);
    expect(res.status).toBe(201);
    const upserts = on("users", "upsert");
    expect(upserts).toHaveLength(2);
    expect("must_change_password" in (upserts[1]!.args[0] as object)).toBe(false);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("gives every new person a different password", async () => {
    const a = (await (await post(GOOD)).json()).data.temporary_password;
    const b = (await (await post(GOOD)).json()).data.temporary_password;
    expect(a).not.toBe(b);
  });

  it("makes an admin without a permissions row (their access is implicit), and never a super admin", async () => {
    const res = await post({ ...GOOD, role: "admin" });
    expect(res.status).toBe(201);
    expect(on("employee_permissions", "upsert")).toHaveLength(0);
    expect(on("users", "upsert")[0]!.args[0]).toMatchObject({ role: "admin" });
    expect(JSON.stringify(on("users", "upsert")[0]!.args[0])).not.toContain("is_super_admin");
  });

  it("says the email is taken, and creates nothing else", async () => {
    createUserResult = { data: { user: null }, error: { message: "User already registered", status: 422 } };
    const res = await post(GOOD);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("EMAIL_TAKEN");
    expect(on("users", "upsert")).toHaveLength(0);
  });

  it("undoes the login if the profile can't be saved", async () => {
    failTable = "users";
    const res = await post(GOOD);
    expect(res.status).toBe(500);
    expect(mockDeleteUser).toHaveBeenCalledWith("new-1");
  });

  it("undoes the login and profile if the permissions can't be saved", async () => {
    failTable = "employee_permissions";
    const res = await post(GOOD);
    expect(res.status).toBe(500);
    expect(on("users", "delete")).toHaveLength(1);
    expect(mockDeleteUser).toHaveBeenCalledWith("new-1");
  });

  it("audits the creation without recording the password", async () => {
    await post(GOOD);
    const log = on("activity_logs", "insert")[0]!.args[0] as any;
    expect(log).toMatchObject({ actor_id: "boss", action: "staff.create", target_type: "user", target_id: "new-1" });
    expect(JSON.stringify(log)).not.toMatch(/password/i);
  });
});
