import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API_BASE", () => {
  it("is same-origin, so the browser calls the dashboard's own /api proxy and CORS never applies", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://gts-08-web-liard.vercel.app");
    const { API_BASE } = await import("./api-base");
    expect(API_BASE).toBe("/api/v1");
  });

  it("does not depend on NEXT_PUBLIC_API_URL being present in the browser bundle", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { API_BASE } = await import("./api-base");
    expect(API_BASE).toBe("/api/v1");
  });
});

describe("apiProxyTarget (the proxy's destination, read by next.config at build time)", () => {
  it("is the configured API origin, whatever path or trailing slash it was written with", async () => {
    const { apiProxyTarget } = await import("./api-base");
    for (const v of ["https://gts-08-web-liard.vercel.app", "https://gts-08-web-liard.vercel.app/", "https://gts-08-web-liard.vercel.app/api/v1", "https://gts-08-web-liard.vercel.app/api/"]) {
      expect(apiProxyTarget(v)).toBe("https://gts-08-web-liard.vercel.app");
    }
  });

  it("falls back to the local API port when unset", async () => {
    const { apiProxyTarget } = await import("./api-base");
    expect(apiProxyTarget(undefined)).toBe("http://localhost:3002");
    expect(apiProxyTarget("")).toBe("http://localhost:3002");
  });
});
