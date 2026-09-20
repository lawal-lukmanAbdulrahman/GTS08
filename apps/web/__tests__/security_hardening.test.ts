import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  clearRateLimitStore,
  escapeHtml,
  sanitizeXss,
  sanitizeUrl,
  detectAttackPayload,
} from "@gts/utils";
import { middleware } from "../middleware";
import { NextRequest } from "next/server";

// Mock Supabase Database Module for API Route security tests
vi.mock("@gts/database", () => {
  return {
    createServerClient: vi.fn().mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })),
    createServiceClient: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "cust-1", role: "customer", is_blocked: false },
              error: null,
            }),
          };
        }
        if (table === "content_slots") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "support_tickets") {
          return {
            select: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      channel: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({}),
        subscribe: vi.fn(),
      }),
    })),
  };
});

describe("Pillar 1: Rate Limiting Engine", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("permits requests within quota and reports accurate remaining tokens", () => {
    const key = "ip:127.0.0.1:auth";
    const res1 = checkRateLimit(key, { limit: 3, windowMs: 60000 });
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);
    expect(res1.limit).toBe(3);

    const res2 = checkRateLimit(key, { limit: 3, windowMs: 60000 });
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit(key, { limit: 3, windowMs: 60000 });
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests when quota is exceeded and calculates Retry-After", () => {
    const key = "ip:192.168.1.5:login";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 60000 });
    }

    const breach = checkRateLimit(key, { limit: 5, windowMs: 60000 });
    expect(breach.allowed).toBe(false);
    expect(breach.remaining).toBe(0);
    expect(breach.retryAfterSeconds).toBeGreaterThan(0);
    expect(breach.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(breach.resetTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("Pillar 2: XSS and Injection Guards", () => {
  it("strips malicious <script> tags and inline event handlers", () => {
    const dirty = "<p>Hello</p><script>alert('xss')</script><img src='x' onerror='stealCookie()' />";
    const cleaned = sanitizeXss(dirty);

    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("alert('xss')");
    expect(cleaned).not.toContain("onerror");
    expect(cleaned).toContain("<p>Hello</p>");
  });

  it("neutralizes dangerous pseudo-protocols like javascript: and data:text/html", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("/");
    expect(sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe("/");
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("/");

    // Allowed URLs
    expect(sanitizeUrl("/shop/classic-shirt")).toBe("/shop/classic-shirt");
    expect(sanitizeUrl("https://checkout.paystack.com/pay")).toBe("https://checkout.paystack.com/pay");
    expect(sanitizeUrl("mailto:support@gts.ng")).toBe("mailto:support@gts.ng");
  });

  it("escapes raw HTML entities safely", () => {
    const unescaped = "<div class=\"hero\" test='true'>GTS & Co.</div>";
    const escaped = escapeHtml(unescaped);

    expect(escaped).toBe("&lt;div class=&quot;hero&quot; test=&#039;true&#039;&gt;GTS &amp; Co.&lt;/div&gt;");
  });

  it("detects cyber attack payloads for edge WAF inspection", () => {
    expect(detectAttackPayload("?search=normal%20shirt").isSafe).toBe(true);
    expect(detectAttackPayload("?id=1%00admin").isSafe).toBe(false);
    expect(detectAttackPayload("?file=../../../../etc/passwd").isSafe).toBe(false);
    expect(detectAttackPayload("?query=%27%20UNION%20SELECT%20password%20FROM%20users--").isSafe).toBe(false);
    expect(detectAttackPayload("?tag=<script>alert(1)</script>").isSafe).toBe(false);
  });
});

describe("Pillar 3 & 6: Edge Middleware Security Headers & CORS Protection", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("injects complete OWASP security headers (CSP, HSTS, X-Frame-Options, nosniff)", async () => {
    const req = new NextRequest("http://localhost:3000/shop");
    const res = await middleware(req);

    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("strictly whitelists CORS origins and rejects unknown cross-origins", async () => {
    // 1. Whitelisted local dev dashboard
    const reqAllowed = new NextRequest("http://localhost:3000/api/v1/products", {
      headers: { origin: "http://localhost:3001" },
    });
    const resAllowed = await middleware(reqAllowed);
    expect(resAllowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
    expect(resAllowed.headers.get("Access-Control-Allow-Credentials")).toBe("true");

    // 2. Malicious / unknown external origin
    const reqBlocked = new NextRequest("http://localhost:3000/api/v1/products", {
      headers: { origin: "https://evil-hacker-site.com" },
    });
    const resBlocked = await middleware(reqBlocked);
    expect(resBlocked.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(resBlocked.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("WAF query filter blocks malicious URL requests with HTTP 400 Bad Request", async () => {
    const reqAttack = new NextRequest("http://localhost:3000/api/v1/products?cat=../../etc/passwd");
    const res = await middleware(reqAttack);

    expect(res.status).toBe(400);
  });

  it("middleware rate limits brute-force attempts to /api/v1/auth/ routes with HTTP 429", async () => {
    const ipHeaders = { "x-forwarded-for": "203.0.113.45" };

    // Fire 20 allowed attempts (a whole shop can sign in from one address)
    for (let i = 0; i < 20; i++) {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        headers: ipHeaders,
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    }

    // 21st attempt breaches the limit
    const breachReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      headers: ipHeaders,
    });
    const breachRes = await middleware(breachReq);

    expect(breachRes.status).toBe(429);
    const body = await breachRes.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(breachRes.headers.get("Retry-After")).toBeDefined();
    expect(breachRes.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("Pillar 4 & 7: Authorization & Idempotency Safeguards", () => {
  it("rejects unauthorized callers attempting to list all inquiries (?all=true) with HTTP 401/403", async () => {
    const { GET } = await import("../app/api/v1/inquiries/route");
    const req = new NextRequest("http://localhost:3000/api/v1/inquiries?all=true");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated POST /api/v1/broadcast with HTTP 401 Unauthorized", async () => {
    const { POST } = await import("../app/api/v1/broadcast/route");
    const req = new NextRequest("http://localhost:3000/api/v1/broadcast", {
      method: "POST",
      body: JSON.stringify({ title: "Hacked Banner", subtitle: "Defaced" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
