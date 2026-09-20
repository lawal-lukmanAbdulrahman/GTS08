import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLog(...args),
  clientIp: () => "5.6.7.8",
}));

const mockSignIn = vi.fn();
let profile: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@gts/database", () => ({
  createServerClient: async () => ({ auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } }),
  createServiceClient: () => ({
    from: (table: string) => {
      const stub: any = {
        select: () => stub,
        eq: () => stub,
        single: () => Promise.resolve(table === "users" ? profile : { data: { can_process_pos: true }, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
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

  it("logs nothing for a failed sign-in", async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const res = await POST(login());
    expect(res.status).toBe(401);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("logs nothing for a blocked account", async () => {
    profile = { data: { id: "u1", role: "cashier", is_blocked: true }, error: null };
    const res = await POST(login());
    expect(res.status).toBe(403);
    expect(mockLog).not.toHaveBeenCalled();
  });
});
