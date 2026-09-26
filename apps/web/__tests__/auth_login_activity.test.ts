import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLog(...args),
  clientIp: () => "5.6.7.8",
}));

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
// What the by-email lookup used after a failed sign-in finds: a staff account, a customer, or nothing.
let byEmail: { data: unknown; error: unknown } = { data: null, error: null };
let profile: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@gts/database", () => ({
  createServerClient: async () => ({ auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a), signOut: (...a: unknown[]) => mockSignOut(...a) } }),
  createServiceClient: () => ({
    from: (table: string) => {
      const stub: any = {
        select: () => stub,
        eq: () => stub,
        single: () => Promise.resolve(table === "users" ? profile : { data: { can_process_pos: true }, error: null }),
        maybeSingle: () => Promise.resolve(table === "users" ? byEmail : { data: null, error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      };
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/auth/login/route";

const login = () =>
  new NextRequest("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "ada@gts.ng", password: "Secret123!" }),
  });

describe("POST /api/v1/auth/login audit trail", () => {
  beforeEach(() => {
    mockLog.mockReset();
    mockSignOut.mockReset().mockResolvedValue({ error: null });
    byEmail = { data: null, error: null };
    mockSignIn.mockReset();
    mockSignIn.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t", refresh_token: "r", expires_at: 1 } },
      error: null,
    });
    profile = { data: { id: "u1", role: "cashier", is_blocked: false, full_name: "Ada" }, error: null };
  });

  it("records a staff sign-in with the address it came from", async () => {
    const res = await POST(login());
    expect(res.status).toBe(200);
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "u1", action: "auth.login", targetType: "user", targetId: "u1", ip: "5.6.7.8" })
    );
  });

  it("does not put the password or token in the log", async () => {
    await POST(login());
    const logged = JSON.stringify(mockLog.mock.calls);
    expect(logged).not.toContain("Secret123!");
    expect(logged).not.toContain('"t"');
  });

  it("does not log customers signing in (this trail is for staff actions)", async () => {
    profile = { data: { id: "u2", role: "customer", is_blocked: false }, error: null };
    await POST(login());
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("records a failed sign-in against a staff account, without the password", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    byEmail = { data: { id: "u1", role: "cashier" }, error: null };
    const res = await POST(login());
    expect(res.status).toBe(401);
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "u1", action: "auth.login_failed", targetType: "user", targetId: "u1", ip: "5.6.7.8", changes: { reason: "wrong_password" } })
    );
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain("Secret123!");
  });

  it("does not log a failed sign-in for an unknown address or a customer", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    byEmail = { data: null, error: null };
    expect((await POST(login())).status).toBe(401);
    byEmail = { data: { id: "u2", role: "customer" }, error: null };
    expect((await POST(login())).status).toBe(401);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("answers a failed sign-in the same way even if the audit lookup breaks", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    byEmail = Promise.reject(new Error("db down")) as never;
    const res = await POST(login());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("refuses a suspended staff account, records the attempt, and ends the session it just opened", async () => {
    profile = { data: { id: "u1", role: "cashier", is_blocked: true }, error: null };
    const res = await POST(login());
    expect(res.status).toBe(403);
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: "u1", action: "auth.login_blocked", ip: "5.6.7.8" }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("does not hand a suspended account's data back in the refusal", async () => {
    profile = { data: { id: "u1", role: "cashier", is_blocked: true, email: "ada@gts.ng" }, error: null };
    const body = JSON.stringify(await (await POST(login())).json());
    expect(body).not.toContain("ada@gts.ng");
  });
});
