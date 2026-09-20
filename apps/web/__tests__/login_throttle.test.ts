// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const signIn = vi.fn();
vi.mock("@gts/database", () => ({
  createServerClient: async () => ({ auth: { signInWithPassword: (...a: unknown[]) => signIn(...a) } }),
  createServiceClient: () => ({ from: () => ({}) }),
}));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/auth/login/route";

const login = (body: unknown, raw?: string) =>
  POST(new NextRequest("http://localhost:3000/api/v1/auth/login", { method: "POST", body: raw ?? JSON.stringify(body), headers: { "x-forwarded-for": "203.0.113.7" } }));

describe("POST /auth/login", () => {
  beforeEach(() => signIn.mockReset().mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } }));

  it("answers a malformed JSON body with 400, not 500", async () => {
    expect((await login(null, "{not json")).status).toBe(400);
  });

  it.each([[null], ["text"], [42], [[]]])("answers a body of %j with 400", async (body) => {
    expect((await login(body)).status).toBe(400);
  });

  it("gives the same answer for a wrong password whether or not the account exists", async () => {
    const a = await (await login({ email: "known-a@example.com", password: "x" })).json();
    const b = await (await login({ email: "unknown-a@example.com", password: "x" })).json();
    expect(a.error).toBe(b.error);
  });

  it("stops guessing at ONE account after 8 attempts a minute, without asking the auth provider again", async () => {
    const email = "victim-1@example.com";
    for (let i = 0; i < 8; i++) expect((await login({ email, password: `guess${i}` })).status).toBe(401);
    const blocked = await login({ email, password: "guess9" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await blocked.json()).code).toBe("RATE_LIMIT_EXCEEDED");
    expect(signIn).toHaveBeenCalledTimes(8);
  });

  it("treats upper- and lower-case spellings of the address as the same account", async () => {
    for (let i = 0; i < 8; i++) await login({ email: i % 2 ? "Victim-2@Example.com" : "victim-2@example.com", password: "x" });
    expect((await login({ email: "VICTIM-2@example.com", password: "x" })).status).toBe(429);
  });

  it("does not slow down a different account from the same address", async () => {
    for (let i = 0; i < 8; i++) await login({ email: "victim-3@example.com", password: "x" });
    expect((await login({ email: "someone-else@example.com", password: "x" })).status).toBe(401);
  });
});
