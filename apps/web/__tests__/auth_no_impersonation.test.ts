// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: "bad token" } }) },
    // If anything asks the users table for an admin to impersonate, hand one over: it must not be used.
    from: () => {
      const chain: any = new Proxy({}, { get: (_t, p) => (p === "then" ? undefined : p === "maybeSingle" ? async () => ({ data: { id: "admin-1", email: "admin@gts.ng", role: "admin" }, error: null }) : () => chain) });
      return chain;
    },
  }),
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { message: "no session" } }) } }),
}));

import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "../app/api/v1/auth/utils";

describe("getAuthenticatedUser never invents a user", () => {
  const env = { ...process.env };
  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.ENABLE_DEV_ADMIN_BYPASS = "true";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("returns null for a request with no valid session, even in development with the old bypass flag set", async () => {
    const user = await getAuthenticatedUser(new NextRequest("http://localhost:3000/api/v1/x"));
    expect(user).toBeNull();
  });

  it("returns null for a bad token too", async () => {
    const user = await getAuthenticatedUser(new NextRequest("http://localhost:3000/api/v1/x", { headers: { authorization: "Bearer nope" } }));
    expect(user).toBeNull();
  });
});
