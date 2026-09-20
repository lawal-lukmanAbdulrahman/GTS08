import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consume, createRateLimitStore, detectAttackPayload, planBuckets, userIdFromAuthHeader } from "@gts/utils";

const rateLimitStore = createRateLimitStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Allowed origins for CORS (Storefront, Staff Dashboard, & Staging/Production GTS domains)
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:(3000|3001)$/,
  /^https:\/\/(.*\.)?gts\.ng$/,
  /^https:\/\/dashboard\.gts\.ng$/,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

// Content Security Policy directives
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.paystack.com https://js.paystack.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: res.cloudinary.com images.unsplash.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
  "frame-src 'self' https://checkout.paystack.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.paystack.com",
].join("; ");

function applySecurityHeaders(headers: Headers, isEditor = false) {
  if (isEditor) {
    headers.delete("X-Frame-Options");
    headers.set(
      "Content-Security-Policy",
      CSP_HEADER + "; frame-ancestors 'self' http://localhost:3000 http://localhost:3001 https://*.gts.ng"
    );
  } else {
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Content-Security-Policy", CSP_HEADER + "; frame-ancestors 'self'");
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  headers.set("X-XSS-Protection", "1; mode=block");
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isAllowed = isOriginAllowed(origin);
  const allowOriginValue = isAllowed && origin ? origin : "";
  const { pathname, search } = request.nextUrl;

  // ── 1. Edge WAF Query Inspection ──
  if (search) {
    const wafCheck = detectAttackPayload(search);
    if (!wafCheck.isSafe) {
      const res = NextResponse.json(
        {
          error: "Request blocked by Web Application Firewall (WAF).",
          code: "BLOCKED_BY_WAF",
          threat: wafCheck.threat,
        },
        { status: 400 }
      );
      applySecurityHeaders(res.headers);
      return res;
    }
  }

  // ── 2. Handle CORS Preflight (OPTIONS) for /api/* ──
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const preflightHeaders = new Headers();
    if (isAllowed) {
      preflightHeaders.set("Access-Control-Allow-Origin", allowOriginValue);
      preflightHeaders.set("Access-Control-Allow-Credentials", "true");
    }
    preflightHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    preflightHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Idempotency-Key, x-idempotency-key"
    );
    preflightHeaders.set(
      "Access-Control-Expose-Headers",
      "Idempotency-Key, Idempotent-Replayed, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
    );
    preflightHeaders.set("Access-Control-Max-Age", "86400");
    applySecurityHeaders(preflightHeaders);

    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }

  // ── 3. Edge Rate Limiting for /api/* ──
  // Signed-in callers are counted per person (a shop's tills share one address);
  // every caller also sits under a per-address ceiling. See @gts/utils rate-limit.
  let rateLimitResult: Awaited<ReturnType<typeof consume>> | null = null;
  if (pathname.startsWith("/api/")) {
    const rawIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "127.0.0.1";

    const buckets = planBuckets(request.method, pathname, {
      ip: rawIp,
      userId: userIdFromAuthHeader(request.headers.get("authorization")),
    });
    rateLimitResult = await consume(rateLimitStore, buckets);

    if (!rateLimitResult.allowed) {
      const res = NextResponse.json(
        {
          error: "Too many requests. Please slow down and try again.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimitResult.resetTime),
          },
        }
      );
      if (isAllowed) {
        res.headers.set("Access-Control-Allow-Origin", allowOriginValue);
        res.headers.set("Access-Control-Allow-Credentials", "true");
      }
      applySecurityHeaders(res.headers);
      return res;
    }
  }

  const response = NextResponse.next();

  // Attach standard security headers (allow framing when edit_mode=true in dashboard)
  const isEditor = search.includes("edit_mode=true");
  applySecurityHeaders(response.headers, isEditor);

  // Attach CORS headers if applicable
  if (pathname.startsWith("/api/")) {
    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", allowOriginValue);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Idempotency-Key, x-idempotency-key"
    );
    response.headers.set(
      "Access-Control-Expose-Headers",
      "Idempotency-Key, Idempotent-Replayed, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
    );

    // Attach rate limit feedback headers
    if (rateLimitResult) {
      response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      response.headers.set("X-RateLimit-Reset", String(rateLimitResult.resetTime));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|llms.txt).*)",
  ],
};
