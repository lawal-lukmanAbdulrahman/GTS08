import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dashboard authentication & role-based routing middleware.
 *
 * TODO: Implement the following checks:
 * 1. Read the Supabase auth session from cookies.
 * 2. If no session, redirect to /login (except for /login itself).
 * 3. If session exists but user role is not one of (admin, cashier, inventory_staff),
 *    redirect to /pending (account not yet approved).
 * 4. Role-based path guards:
 *    - /admin/*  → admin only
 *    - /pos/*    → admin or cashier
 *    - /inventory/* → admin or inventory_staff
 *    - /orders/* → admin, cashier, or inventory_staff
 *    - /tickets/* → any authenticated staff
 *    - /profile  → any authenticated staff
 *
 * For now this is a passthrough stub.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
