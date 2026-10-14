import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../_lib/staff-access";
import { dbError, serverError } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const serviceClient = createServiceClient();

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch deleted users
    const { data: usersData, error: usersErr } = await serviceClient
      .from("users")
      .select("id, email, full_name, phone, role, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at")
      .not("deleted_at", "is", null)
      .gte("deleted_at", thirtyDaysAgo)
      .order("deleted_at", { ascending: false });

    if (usersErr) {
      return dbError(usersErr, "USERS_FETCH_FAILED", 500);
    }

    // 2. Fetch deleted customers
    const { data: customersData } = await serviceClient
      .from("customers")
      .select("id, user_id, email, full_name, phone, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at")
      .not("deleted_at", "is", null)
      .gte("deleted_at", thirtyDaysAgo)
      .order("deleted_at", { ascending: false });

    type MergedCustomer = {
      id: string;
      userId: string | null;
      customerId: string | null;
      fullName: string;
      email: string;
      phone: string | null;
      isDisabled: boolean;
      disabledReason: string | null;
      disabledAt: string | null;
      deletedAt: string | null;
      deletionReason: string | null;
      daysRemaining: number | null;
      createdAt: string;
      totalOrders: number;
      totalSpentKobo: number;
      totalSpentNgn: number;
      totalProfitKobo: number;
      totalProfitNgn: number;
      profitMarginPct: number;
    };

    const customerMap = new Map<string, MergedCustomer>();

    if (usersData) {
      for (const u of usersData) {
        const key = u.email ? u.email.toLowerCase() : u.id;
        const daysRemaining = u.deleted_at
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(u.deleted_at).getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        customerMap.set(key, {
          id: u.id,
          userId: u.id,
          customerId: null,
          fullName: u.full_name || u.email?.split("@")[0] || "Customer",
          email: u.email || "",
          phone: u.phone || null,
          isDisabled: u.is_disabled === true,
          disabledReason: u.disabled_reason || null,
          disabledAt: u.disabled_at || null,
          deletedAt: u.deleted_at || null,
          deletionReason: u.deletion_reason || null,
          daysRemaining,
          createdAt: u.created_at,
          totalOrders: 0,
          totalSpentKobo: 0,
          totalSpentNgn: 0,
          totalProfitKobo: 0,
          totalProfitNgn: 0,
          profitMarginPct: 0,
        });
      }
    }

    if (customersData) {
      for (const c of customersData) {
        const key = c.email ? c.email.toLowerCase() : (c.user_id || c.id);
        const existing = customerMap.get(key);
        const daysRemaining = c.deleted_at
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(c.deleted_at).getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        if (existing) {
          existing.customerId = c.id;
          if (c.deleted_at && !existing.deletedAt) {
            existing.deletedAt = c.deleted_at;
            existing.deletionReason = c.deletion_reason;
            existing.daysRemaining = daysRemaining;
          }
        } else {
          customerMap.set(key, {
            id: c.user_id || c.id,
            userId: c.user_id || null,
            customerId: c.id,
            fullName: c.full_name || c.email?.split("@")[0] || "Customer",
            email: c.email || "",
            phone: c.phone || null,
            isDisabled: c.is_disabled === true,
            disabledReason: c.disabled_reason || null,
            disabledAt: c.disabled_at || null,
            deletedAt: c.deleted_at || null,
            deletionReason: c.deletion_reason || null,
            daysRemaining,
            createdAt: c.created_at,
            totalOrders: 0,
            totalSpentKobo: 0,
            totalSpentNgn: 0,
            totalProfitKobo: 0,
            totalProfitNgn: 0,
            profitMarginPct: 0,
          });
        }
      }
    }

    let customerList = Array.from(customerMap.values());

    if (search) {
      customerList = customerList.filter((c) => {
        const nameMatch = c.fullName.toLowerCase().includes(search);
        const emailMatch = c.email.toLowerCase().includes(search);
        const phoneMatch = c.phone ? c.phone.toLowerCase().includes(search) : false;
        const idMatch = c.id.toLowerCase().includes(search);
        return nameMatch || emailMatch || phoneMatch || idMatch;
      });
    }

    return NextResponse.json({
      data: {
        deletedAccounts: customerList,
        customers: customerList,
        count: customerList.length,
        deletedCount: customerList.length,
      },
      deletedAccounts: customerList,
      customers: customerList,
      count: customerList.length,
      meta: {
        total: customerList.length,
        deletedCount: customerList.length,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
