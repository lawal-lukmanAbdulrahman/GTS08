// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const req = (path: string, init: { method?: string; cookie?: string } = {}) =>
  new NextRequest(`https://gts-08-dashboard.vercel.app${path}`, { method: init.method ?? "GET", headers: init.cookie ? { cookie: init.cookie } : {} });

describe("dashboard middleware", () => {
  it("lets API calls through to the proxy even when signed out, so sign-in itself can reach the API", () => {
    const res = middleware(req("/api/v1/auth/login", { method: "POST" }));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets forgot-password and reset-password API calls through while signed out", () => {
    for (const p of ["/api/v1/auth/forgot-password", "/api/v1/auth/reset-password"]) {
      expect(middleware(req(p, { method: "POST" })).headers.get("location")).toBeNull();
    }
  });

  it("still sends a signed-out visitor from a portal page to sign-in", () => {
    const res = middleware(req("/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?redirect=%2Fadmin");
  });

  it("does not let a path that only starts with 'api' skip the sign-in check", () => {
    expect(middleware(req("/apix/admin")).headers.get("location")).toContain("/login");
  });
});
