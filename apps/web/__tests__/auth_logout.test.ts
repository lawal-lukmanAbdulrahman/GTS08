import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLog(...args),
  clientIp: () => "1.2.3.4",
}));

const mockSignOut = vi.fn();
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ auth: { admin: { signOut: (...a: unknown[]) => mockSignOut(...a) } } }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/auth/logout/route";

const req = (token?: string) =>
  new NextRequest("http://localhost:3000/api/v1/auth/logout", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockLog.mockReset();
    mockSignOut.mockReset();
    mockGetUser.mockResolvedValue({ id: "u1", email: "ada@gts.ng" });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("succeeds quietly when nobody is signed in (already signed out)", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("revokes this session's token", async () => {
    const res = await POST(req("tok123"));
    expect(res.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledWith("tok123", "local");
    expect((await res.json()).data).toEqual({ signed_out: true, revoked: true });
  });

  it("records the sign-out against the user", async () => {
    await POST(req("tok123"));
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "u1", action: "auth.logout", targetType: "user", targetId: "u1", ip: "1.2.3.4" })
    );
  });

  it("never puts the token in the audit log", async () => {
    await POST(req("tok123"));
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain("tok123");
  });

  it("still reports success if revoking fails, so the till always signs out locally", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST(req("tok123"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ signed_out: true, revoked: false });
  });

  it("still reports success if the revoke call throws", async () => {
    mockSignOut.mockRejectedValue(new Error("network"));
    const res = await POST(req("tok123"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.revoked).toBe(false);
  });
});
