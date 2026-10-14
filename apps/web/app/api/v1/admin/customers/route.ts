import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../_lib/staff-access";
import { dbError, serverError } from "../../_lib/http";

export const dynamic = "force-dynamic";

interface OrderProfitCalculation {
  totalSpentKobo: number;
  totalProfitKobo: number;
  totalOrders: number;
}

export async function GET(request: NextRequest) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const statusFilter = url.searchParams.get("status") || "all"; // all | active | disabled
  const isDeleted = url.searchParams.get("deleted") === "true"; // true = recently deleted (<= 30 days)

  const serviceClient = createServiceClient();

  try {
    // 1. Fetch products to get cost prices for profit calculation
    const { data: productsData } = await serviceClient
      .from("products")
      .select("id, cost_price, base_price");
    
    const productCostMap = new Map<string, { costPrice: number; basePrice: number }>();
    if (productsData) {
      for (const p of productsData) {
        productCostMap.set(p.id, {
          costPrice: p.cost_price || Math.round((p.base_price || 0) * 0.65),
          basePrice: p.base_price || 0,
        });
      }
    }

    // 2. Fetch customer records from users table (role = 'customer')
    let usersQuery = serviceClient
      .from("users")
      .select("id, email, full_name, phone, role, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at")
      .eq("role", "customer");

    if (isDeleted) {
      // Recently deleted within 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      usersQuery = usersQuery
        .not("deleted_at", "is", null)
        .gte("deleted_at", thirtyDaysAgo)
        .order("deleted_at", { ascending: false });
    } else {
      // Active or disabled, not deleted
      usersQuery = usersQuery.is("deleted_at", null).order("created_at", { ascending: false });

      if (statusFilter === "disabled") {
        usersQuery = usersQuery.eq("is_disabled", true);
      } else if (statusFilter === "active") {
        usersQuery = usersQuery.eq("is_disabled", false);
      }
    }

    const { data: usersData, error: usersErr } = await usersQuery;
    if (usersErr) {
      return dbError(usersErr, "USERS_FETCH_FAILED", 500);
    }

    // Also fetch records from customers table to catch guest checkouts or linked profiles
    let customersQuery = serviceClient
      .from("customers")
      .select("id, user_id, email, full_name, phone, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at");

    if (isDeleted) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      customersQuery = customersQuery
        .not("deleted_at", "is", null)
        .gte("deleted_at", thirtyDaysAgo)
        .order("deleted_at", { ascending: false });
    } else {
      customersQuery = customersQuery.is("deleted_at", null).order("created_at", { ascending: false });
      if (statusFilter === "disabled") {
        customersQuery = customersQuery.eq("is_disabled", true);
      } else if (statusFilter === "active") {
        customersQuery = customersQuery.eq("is_disabled", false);
      }
    }

    const { data: customersData } = await customersQuery;

    // Merge users & customers by user_id or email
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
    };

    const customerMap = new Map<string, MergedCustomer>();

    // Add users
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
        });
      }
    }

    // Merge or add customers table records
    if (customersData) {
      for (const c of customersData) {
        const key = c.email ? c.email.toLowerCase() : (c.user_id || c.id);
        const existing = customerMap.get(key);
        const daysRemaining = c.deleted_at
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(c.deleted_at).getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        if (existing) {
          existing.customerId = c.id;
          if (!existing.phone && c.phone) existing.phone = c.phone;
          if (c.is_disabled) {
            existing.isDisabled = true;
            existing.disabledReason = existing.disabledReason || c.disabled_reason;
          }
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
          });
        }
      }
    }

    let customerList = Array.from(customerMap.values());

    // Filter by search if provided
    if (search) {
      customerList = customerList.filter((c) => {
        const nameMatch = c.fullName.toLowerCase().includes(search);
        const emailMatch = c.email.toLowerCase().includes(search);
        const phoneMatch = c.phone ? c.phone.toLowerCase().includes(search) : false;
        const idMatch =
          c.id.toLowerCase().includes(search) ||
          (c.customerId ? c.customerId.toLowerCase().includes(search) : false) ||
          (c.userId ? c.userId.toLowerCase().includes(search) : false);
        return nameMatch || emailMatch || phoneMatch || idMatch;
      });
    }

    // 3. Fetch orders for all matching customers to calculate spent and profit
    const customerIds = customerList.map((c) => c.customerId).filter(Boolean) as string[];

    // Fetch orders
    const ordersQuery = serviceClient
      .from("orders")
      .select("id, customer_id, total, status, created_at, order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot)")
      .in("status", ["paid", "confirmed", "processing", "shipped", "delivered", "completed"]);

    const { data: allOrders } = customerIds.length > 0 ? await ordersQuery.in("customer_id", customerIds) : { data: [] };

    // Calculate profit & spend per customer
    const statsMap = new Map<string, OrderProfitCalculation>();

    if (allOrders) {
      for (const ord of allOrders) {
        const cId = ord.customer_id;
        if (!cId) continue;

        let existing = statsMap.get(cId);
        if (!existing) {
          existing = { totalSpentKobo: 0, totalProfitKobo: 0, totalOrders: 0 };
          statsMap.set(cId, existing);
        }

        existing.totalOrders += 1;
        existing.totalSpentKobo += ord.total || 0;

        // Calculate profit from order items
        const items = ord.order_items || [];
        for (const it of items) {
          const qty = it.quantity || 1;
          const lineTotal = it.line_total || (it.unit_price || 0) * qty;
          
          let costPerUnit = 0;
          const snap = it.product_snapshot || {};
          const productId = snap.productId || snap.id;
          if (productId && productCostMap.has(productId)) {
            costPerUnit = productCostMap.get(productId)!.costPrice;
          } else {
            // Default 35% margin estimate if cost_price unknown
            costPerUnit = Math.round((it.unit_price || 0) * 0.65);
          }

          const itemCost = costPerUnit * qty;
          const itemProfit = Math.max(0, lineTotal - itemCost);
          existing.totalProfitKobo += itemProfit;
        }
      }
    }

    // Attach stats to customer list
    const enriched = customerList.map((c) => {
      const stats = (c.customerId ? statsMap.get(c.customerId) : null) || {
        totalSpentKobo: 0,
        totalProfitKobo: 0,
        totalOrders: 0,
      };

      return {
        ...c,
        totalOrders: stats.totalOrders,
        totalSpentKobo: stats.totalSpentKobo,
        totalSpentNgn: Math.round(stats.totalSpentKobo / 100),
        totalProfitKobo: stats.totalProfitKobo,
        totalProfitNgn: Math.round(stats.totalProfitKobo / 100),
        profitMarginPct: stats.totalSpentKobo > 0 ? Math.round((stats.totalProfitKobo / stats.totalSpentKobo) * 100) : 0,
      };
    });

    // Also get count of recently deleted accounts for badge
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: deletedCount } = await serviceClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null)
      .gte("deleted_at", thirtyDaysAgoIso);

    return NextResponse.json({
      data: {
        customers: enriched,
        total: enriched.length,
        deletedCount: deletedCount || 0,
      },
      customers: enriched,
      meta: {
        total: enriched.length,
        deletedCount: deletedCount || 0,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
