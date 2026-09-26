// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (task: () => Promise<unknown>) => void task() }));
const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({ logActivity: (...a: unknown[]) => mockLog(...a), clientIp: () => "7.7.7.7" }));
const mockResetMail = vi.fn();
const mockChangedMail = vi.fn();
vi.mock("../app/api/v1/_lib/email/events", () => ({
  notifyPasswordReset: (...a: unknown[]) => mockResetMail(...a),
  notifyPasswordChanged: (...a: unknown[]) => mockChangedMail(...a),
}));

const verifyOtp = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } }) }));

let profile: { data: unknown; error: unknown };
const generateLink = vi.fn();
const updateUserById = vi.fn();
const adminSignOut = vi.fn();
const tableCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const stub: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
          return (...args: unknown[]) => {
            tableCalls.push({ table, method: prop, args });
            return prop === "maybeSingle" ? Promise.resolve(profile) : stub;
          };
        },
      });
      return stub;
    },
    auth: { admin: { generateLink: (...a: unknown[]) => generateLink(...a), updateUserById: (...a: unknown[]) => updateUserById(...a), signOut: (...a: unknown[]) => adminSignOut(...a) } },
  }),
}));

import { NextRequest } from "next/server";
import { POST as forgot } from "../app/api/v1/auth/forgot-password/route";
import { POST as reset } from "../app/api/v1/auth/reset-password/route";

// The route finishes its work after the response; give it a moment before asserting that something did NOT happen.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
let n = 0;
const address = () => `person-${++n}@example.com`;
const call = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, raw?: string) =>
  handler(new NextRequest(`http://localhost/api/v1/auth/${path}`, { method: "POST", body: raw ?? JSON.stringify(body) }));

beforeEach(() => {
  tableCalls.length = 0;
  mockLog.mockReset();
  mockResetMail.mockReset().mockResolvedValue({ ok: true, id: "e1" });
  mockChangedMail.mockReset().mockResolvedValue(undefined);
  generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: "tok/en+1" } }, error: null });
  updateUserById.mockReset().mockResolvedValue({ error: null });
  adminSignOut.mockReset().mockResolvedValue({ error: null });
  verifyOtp.mockReset().mockResolvedValue({ data: { user: { id: "c1", email: "c@example.com" }, session: { access_token: "jwt" } }, error: null });
  profile = { data: { id: "c1", role: "customer", is_blocked: false, full_name: "Ada" }, error: null };
  process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://gts.ng";
  process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://dash.gts.ng";
});

describe("POST /auth/forgot-password", () => {
  it("emails a customer a reset link to the storefront, with the token encoded", async () => {
    const e = address();
    const res = await call(forgot, "forgot-password", { email: e });
    expect(res.status).toBe(200);
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: e });
    await vi.waitFor(() => expect(mockResetMail).toHaveBeenCalledWith(expect.anything(), { name: "Ada", email: e, resetUrl: "https://gts.ng/reset-password?token=tok%2Fen%2B1" }));
  });

  it("sends staff to the dashboard's reset page instead", async () => {
    profile = { data: { id: "s1", role: "cashier", is_blocked: false, full_name: "Sam" }, error: null };
    await call(forgot, "forgot-password", { email: address() });
    await vi.waitFor(() => expect(mockResetMail.mock.calls[0]![1].resetUrl).toBe("https://dash.gts.ng/reset-password?token=tok%2Fen%2B1"));
  });

  it("gives the same answer whether or not the address has an account, and sends nothing for one that doesn't", async () => {
    const known = await (await call(forgot, "forgot-password", { email: address() })).json();
    profile = { data: null, error: null };
    const res = await call(forgot, "forgot-password", { email: address() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(known);
    await vi.waitFor(() => expect(mockResetMail).toHaveBeenCalledTimes(1));
    await settle();
    expect(mockResetMail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a suspended account, but answers the same", async () => {
    profile = { data: { id: "c1", role: "customer", is_blocked: true }, error: null };
    const res = await call(forgot, "forgot-password", { email: address() });
    expect(res.status).toBe(200);
    await settle();
    expect(mockResetMail).not.toHaveBeenCalled();
  });

  it("limits requests for one address, so it can't be used to flood someone's inbox", async () => {
    const e = address();
    for (let i = 0; i < 3; i++) expect((await call(forgot, "forgot-password", { email: e })).status).toBe(200);
    const res = await call(forgot, "forgot-password", { email: e });
    expect(res.status).toBe(429);
    await settle();
    expect(mockResetMail).toHaveBeenCalledTimes(3);
  });

  it("rejects a malformed address or body", async () => {
    expect((await call(forgot, "forgot-password", { email: "nope" })).status).toBe(400);
    expect((await call(forgot, "forgot-password", {})).status).toBe(400);
    expect((await call(forgot, "forgot-password", null, "{bad")).status).toBe(400);
  });

  it("does not fail the request if the link can't be created", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "internal detail" } });
    const res = await call(forgot, "forgot-password", { email: address() });
    expect(res.status).toBe(200);
    await settle();
    expect(mockResetMail).not.toHaveBeenCalled();
  });
});

describe("POST /auth/reset-password", () => {
  const GOOD = { token: "tok", new_password: "BrandNew123", confirm_password: "BrandNew123" };

  it("sets the new password, ends every existing session, and tells the owner", async () => {
    const res = await call(reset, "reset-password", GOOD);
    expect(res.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "tok", type: "recovery" });
    expect(updateUserById).toHaveBeenCalledWith("c1", { password: "BrandNew123" });
    expect(adminSignOut).toHaveBeenCalledWith("jwt", "global");
    await vi.waitFor(() => expect(mockChangedMail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: "c@example.com", account: "customer" })));
  });

  it("ends the sessions before changing the password, while the link's own session can still do it", async () => {
    const order: string[] = [];
    adminSignOut.mockImplementation(async () => { order.push("signOut"); return { error: null }; });
    updateUserById.mockImplementation(async () => { order.push("update"); return { error: null }; });
    await call(reset, "reset-password", GOOD);
    expect(order).toEqual(["signOut", "update"]);
  });

  it("records a staff reset in the audit trail, and clears a forced password change", async () => {
    profile = { data: { id: "c1", role: "admin", is_blocked: false, full_name: "Boss" }, error: null };
    await call(reset, "reset-password", GOOD);
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: "c1", action: "auth.password_reset", ip: "7.7.7.7" }));
    expect(tableCalls.find((c) => c.table === "users" && c.method === "update")!.args[0]).toMatchObject({ must_change_password: false });
  });

  it("does not put the password or the token in the audit trail", async () => {
    profile = { data: { id: "c1", role: "admin", is_blocked: false }, error: null };
    await call(reset, "reset-password", GOOD);
    expect(JSON.stringify(mockLog.mock.calls)).not.toMatch(/BrandNew123|"tok"/);
  });

  it("does not log customers", async () => {
    await call(reset, "reset-password", GOOD);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("refuses an expired or already-used link, changing nothing", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Token has expired or is invalid" } });
    const res = await call(reset, "reset-password", GOOD);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_OR_EXPIRED_LINK");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a suspended account", async () => {
    profile = { data: { id: "c1", role: "customer", is_blocked: true }, error: null };
    const res = await call(reset, "reset-password", GOOD);
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...GOOD, new_password: "short1", confirm_password: "short1" }],
    [{ ...GOOD, new_password: "nodigitshere", confirm_password: "nodigitshere" }],
    [{ ...GOOD, confirm_password: "Different123" }],
    [{ new_password: "BrandNew123", confirm_password: "BrandNew123" }],
    [{ ...GOOD, token: 5 }],
  ])("rejects a bad request %j before touching the token", async (body) => {
    const res = await call(reset, "reset-password", body);
    expect(res.status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("does not describe internal failures", async () => {
    updateUserById.mockResolvedValue({ error: { message: "secret internal detail" } });
    const res = await call(reset, "reset-password", GOOD);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret internal detail/);
  });
});
