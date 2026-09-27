import { describe, it, expect } from "vitest";
import { isOriginAllowed } from "../lib/cors";

describe("isOriginAllowed", () => {
  const env = { NEXT_PUBLIC_STOREFRONT_URL: "https://gts-08-web-liard.vercel.app/", NEXT_PUBLIC_DASHBOARD_URL: "https://gts-08-dashboard.vercel.app" };

  it("allows the exact storefront and dashboard origins from env, trailing slash and all", () => {
    expect(isOriginAllowed("https://gts-08-web-liard.vercel.app", env)).toBe(true);
    expect(isOriginAllowed("https://gts-08-dashboard.vercel.app", env)).toBe(true);
  });

  it("still allows local dev and the real domains without any env set", () => {
    expect(isOriginAllowed("http://localhost:3000", {})).toBe(true);
    expect(isOriginAllowed("http://localhost:3001", {})).toBe(true);
    expect(isOriginAllowed("https://gts.ng", {})).toBe(true);
    expect(isOriginAllowed("https://shop.gts.ng", {})).toBe(true);
    expect(isOriginAllowed("https://dashboard.gts.ng", {})).toBe(true);
  });

  it("refuses an origin that merely resembles an allowed one", () => {
    expect(isOriginAllowed("https://gts-08-web-liard.vercel.app.evil.com", env)).toBe(false);
    expect(isOriginAllowed("https://evil.com", env)).toBe(false);
    expect(isOriginAllowed("https://notgts.ng", {})).toBe(false);
    expect(isOriginAllowed("https://gts.ng.evil.com", {})).toBe(false);
  });

  it("refuses no origin, an empty env value, and a malformed env URL, without throwing", () => {
    expect(isOriginAllowed(null, env)).toBe(false);
    expect(isOriginAllowed("https://gts-08-web-liard.vercel.app", { NEXT_PUBLIC_STOREFRONT_URL: "" })).toBe(false);
    expect(isOriginAllowed("https://gts-08-web-liard.vercel.app", { NEXT_PUBLIC_STOREFRONT_URL: "not a url" })).toBe(false);
  });

  it("does not open the door to every vercel.app deployment, only the two configured ones", () => {
    expect(isOriginAllowed("https://some-random-app.vercel.app", env)).toBe(false);
  });

  it("ignores mismatched scheme or port on an otherwise-matching env origin", () => {
    expect(isOriginAllowed("http://gts-08-web-liard.vercel.app", env)).toBe(false);
    expect(isOriginAllowed("https://gts-08-web-liard.vercel.app:8443", env)).toBe(false);
  });
});
