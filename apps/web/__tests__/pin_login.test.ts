// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPin } from "../lib/pin-security";

vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({ logActivity: (...a: unknown[]) => mockLog(...a), clientIp: () => "9.9.9.9" }));

let profile: { data: unknown; error: unknown };
let authUser: { data: { user: unknown } | null; error: unknown };
const generateLink = vi.fn();
const verifyOtp = vi.fn();
const updateUserById = vi.fn();
const listUsers = vi.fn();
vi.mock("@gts/database", () => ({
  createServerClient: async () => ({ auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } }),
  createServiceClient: () => ({
    from: () => {
      const stub: any = { select: () => stub, eq: () => stub, ilike: () => stub, maybeSingle: () => Promise.resolve(profile) };
      return stub;
    },
    auth: {
      admin: {
        listUsers: (...a: unknown[]) => listUsers(...a),
        getUserById: async () => authUser,
        generateLink: (...a: unknown[]) => generateLink(...a),
        updateUserById: (...a: unknown[]) => updateUserById(...a),
      },
    },
  }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/auth/pin-login/route";

let n = 0;
// A fresh address each time so one test's attempts never count against another's.
const email = () => `shopper-${++n}@example.com`;
const login = (body: unknown) => POST(new NextRequest("http://localhost/api/v1/auth/pin-login", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  mockLog.mockReset();
  generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null });
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  updateUserById.mockReset().mockResolvedValue({ error: null });
  listUsers.mockReset();
  profile = { data: { id: "c1", role: "customer", is_blocked: false }, error: null };
  authUser = { data: { user: { id: "c1", email: "x", user_metadata: { login_pin_hash: hashPin("123456"), full_name: "Ada" } } }, error: null };
});

describe("POST /auth/pin-login", () => {
  it("signs a customer in with the right PIN", async () => {
    const res = await login({ email: email(), pin: "123456" });
    expect(res.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalled();
  });

  it("finds the account by address rather than reading one page of the whole user list", async () => {
    await login({ email: email(), pin: "123456" });
    expect(listUsers).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown address", () => { profile = { data: null, error: null }; }],
    ["an account with no PIN set", () => { authUser = { data: { user: { id: "c1", user_metadata: {} } }, error: null }; }],
    ["a wrong PIN", () => { authUser = { data: { user: { id: "c1", user_metadata: { login_pin_hash: hashPin("999999") } } }, error: null }; }],
  ])("gives one identical refusal for %s, so the form can't be used to find accounts", async (_label, arrange) => {
    arrange();
    const res = await login({ email: email(), pin: "123456" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Incorrect email or PIN. Try again or sign in with your password.");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("refuses a suspended account", async () => {
    profile = { data: { id: "c1", role: "customer", is_blocked: true }, error: null };
    const res = await login({ email: email(), pin: "123456" });
    expect(res.status).toBe(401);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("never signs staff in with a 6-digit PIN, and records the attempt", async () => {
    profile = { data: { id: "s1", role: "admin", is_blocked: false }, error: null };
    const res = await login({ email: email(), pin: "123456" });
    expect(res.status).toBe(401);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: "s1", action: "auth.login_failed", changes: { reason: "pin_not_allowed_for_staff" } }));
  });

  it("stops guessing at one account after 5 tries, even with the right PIN on the 6th", async () => {
    const e = email();
    authUser = { data: { user: { id: "c1", user_metadata: { login_pin_hash: hashPin("999999") } } }, error: null };
    for (let i = 0; i < 5; i++) expect((await login({ email: e, pin: `00000${i}` })).status).toBe(401);
    authUser = { data: { user: { id: "c1", user_metadata: { login_pin_hash: hashPin("123456") } } }, error: null };
    const res = await login({ email: e, pin: "123456" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it.each([{}, { email: "a@b.co" }, { email: "a@b.co", pin: "12345" }, { email: "a@b.co", pin: "12345a" }, { email: 5, pin: "123456" }, { email: "a@b.co", pin: 123456 }])("rejects the malformed body %j", async (body) => {
    expect((await login(body)).status).toBe(400);
  });

  it("moves an old plaintext PIN to a hash on first use", async () => {
    authUser = { data: { user: { id: "c1", user_metadata: { login_pin: "123456", full_name: "Ada" } } }, error: null };
    expect((await login({ email: email(), pin: "123456" })).status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("c1", { user_metadata: expect.objectContaining({ login_pin_hash: hashPin("123456"), login_pin: null }) });
  });

  it("does not describe internal failures", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "secret internal detail" } });
    const res = await login({ email: email(), pin: "123456" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret internal detail/);
  });
});
