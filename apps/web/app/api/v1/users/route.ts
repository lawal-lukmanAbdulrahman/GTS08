import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../_lib/staff-access";
import { noStore } from "../_lib/cart";
import { serverError } from "../_lib/http";

const ROLES = ["customer", "cashier", "inventory_staff", "admin"];

/**
 * Everyone with an account, for admins. Query: ?role=&is_blocked=&q=&page=&limit=
 * (Adding a person is `POST /users/staff`, which is the super admin's alone.)
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const p = request.nextUrl.searchParams;
    const bad = (m: string) => NextResponse.json({ error: m, code: "VALIDATION_ERROR" }, { status: 400 });
    const role = p.get("role");
    const blocked = p.get("is_blocked");
    const page = p.has("page") ? Number(p.get("page")) : 1;
    const limit = p.has("limit") ? Number(p.get("limit")) : 25;
    if (role && !ROLES.includes(role)) return bad("Unknown role.");
    if (blocked !== null && blocked !== "true" && blocked !== "false") return bad("is_blocked must be true or false.");
    if (!Number.isInteger(page) || page < 1) return bad("page must be 1 or more.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return bad("limit must be 1 to 100.");

    let query = createServiceClient()
      .from("users")
      .select("id, email, full_name, phone, role, is_blocked, created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (role) query = query.eq("role", role);
    if (blocked !== null) query = query.eq("is_blocked", blocked === "true");
    // Keep only characters that can't change the meaning of the filter expression.
    const q = (p.get("q") ?? "").replace(/[^\p{L}\p{N}@.\-_ ]/gu, "").trim().slice(0, 60);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: data ?? [], meta: { total: count ?? 0, page, limit, pages: Math.max(1, Math.ceil((count ?? 0) / limit)) } }, noStore);
  } catch (err) {
    return serverError(err);
  }
}
