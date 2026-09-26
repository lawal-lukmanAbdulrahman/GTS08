import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Content Security Policy for Staff / Admin Dashboard
const DASHBOARD_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: res.cloudinary.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function applyDashboardSecurityHeaders(headers: Headers) {
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Content-Security-Policy", DASHBOARD_CSP);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("gts_access_token")?.value;
  const role = request.cookies.get("gts_user_role")?.value;

  // Allow static assets, images, and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const getRoleRedirect = () => {
    if (role === "cashier") return "/pos";
    if (role === "inventory_staff") return "/inventory";
    if (role === "pending") return "/pending";
    return "/admin";
  };

  // If user accesses the root "/"
  if (pathname === "/") {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      const res = NextResponse.redirect(loginUrl);
      applyDashboardSecurityHeaders(res.headers);
      return res;
    }
    const res = NextResponse.redirect(new URL(getRoleRedirect(), request.url));
    applyDashboardSecurityHeaders(res.headers);
    return res;
  }

  // Password recovery must work without a session (and while signed in elsewhere).
  if (pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) {
    const res = NextResponse.next();
    applyDashboardSecurityHeaders(res.headers);
    return res;
  }

  // If user visits "/login" while already authenticated
  if (pathname.startsWith("/login")) {
    if (token) {
      const res = NextResponse.redirect(new URL(getRoleRedirect(), request.url));
      applyDashboardSecurityHeaders(res.headers);
      return res;
    }
    const res = NextResponse.next();
    applyDashboardSecurityHeaders(res.headers);
    return res;
  }

  // Protected portal routes: redirect unauthenticated users to /login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(loginUrl);
    applyDashboardSecurityHeaders(res.headers);
    return res;
  }

  const response = NextResponse.next();
  applyDashboardSecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
