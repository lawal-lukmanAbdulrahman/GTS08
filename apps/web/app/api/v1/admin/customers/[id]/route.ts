import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { requireStaff } from "../../../_lib/staff-access";
import { serverError } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff(request);
  if (!staff.ok) return staff.response;

  const { id: customerId } = await context.params;
  const serviceClient = createServiceClient();

  try {
    // 1. Fetch user / customer record by id (user id or customer id)
    const { data: userRow } = await serviceClient
      .from("users")
      .select("id, email, full_name, phone, role, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at")
      .eq("id", customerId)
      .maybeSingle();

    const { data: customerRow } = await serviceClient
      .from("customers")
      .select("id, user_id, email, full_name, phone, is_disabled, disabled_reason, disabled_at, deleted_at, deletion_reason, created_at")
      .or(`id.eq.${customerId},user_id.eq.${customerId}`)
      .limit(1)
      .maybeSingle();

    if (!userRow && !customerRow) {
      return NextResponse.json({ error: "Customer not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const email = userRow?.email || customerRow?.email || "";
    const fullName = userRow?.full_name || customerRow?.full_name || email.split("@")[0] || "Customer";
    const phone = userRow?.phone || customerRow?.phone || null;
    const isDisabled = (userRow?.is_disabled === true) || (customerRow?.is_disabled === true);
    const disabledReason = userRow?.disabled_reason || customerRow?.disabled_reason || null;
    const disabledAt = userRow?.disabled_at || customerRow?.disabled_at || null;
    const deletedAt = userRow?.deleted_at || customerRow?.deleted_at || null;
    const deletionReason = userRow?.deletion_reason || customerRow?.deletion_reason || null;
    const createdAt = userRow?.created_at || customerRow?.created_at || new Date().toISOString();
    const daysRemaining = deletedAt
      ? Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // 2. Fetch products for cost prices
    const { data: productsData } = await serviceClient
      .from("products")
      .select("id, cost_price, base_price");
    
    const productCostMap = new Map<string, number>();
    if (productsData) {
      for (const p of productsData) {
        productCostMap.set(p.id, p.cost_price || Math.round((p.base_price || 0) * 0.65));
      }
    }

    // 3. Fetch Orders for this customer
    const cIds = [customerId];
    if (customerRow?.id && !cIds.includes(customerRow.id)) cIds.push(customerRow.id);
    if (userRow?.id && !cIds.includes(userRow.id)) cIds.push(userRow.id);

    const { data: rawOrders } = await serviceClient
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        subtotal,
        delivery_fee,
        created_at,
        order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot)
      `)
      .in("customer_id", cIds)
      .order("created_at", { ascending: false });

    let totalSpentKobo = 0;
    let totalProfitKobo = 0;

    const orders = (rawOrders || []).map((ord) => {
      const isPaid = ["paid", "confirmed", "processing", "shipped", "delivered", "completed"].includes(ord.status);
      if (isPaid) {
        totalSpentKobo += ord.total || 0;
      }

      let orderProfitKobo = 0;
      const items = (ord.order_items || []).map((it: any) => {
        const qty = it.quantity || 1;
        const lineTotal = it.line_total || (it.unit_price || 0) * qty;
        const snap = it.product_snapshot || {};
        const pId = snap.productId || snap.id;
        const costPerUnit = (pId && productCostMap.has(pId))
          ? productCostMap.get(pId)!
          : Math.round((it.unit_price || 0) * 0.65);

        const itemCost = costPerUnit * qty;
        const itemProfit = Math.max(0, lineTotal - itemCost);
        orderProfitKobo += itemProfit;

        return {
          id: it.id,
          name: snap.name || snap.title || "Product Item",
          quantity: qty,
          unitPriceKobo: it.unit_price,
          unitPriceNgn: Math.round(it.unit_price / 100),
          lineTotalKobo: lineTotal,
          lineTotalNgn: Math.round(lineTotal / 100),
          profitKobo: itemProfit,
          profitNgn: Math.round(itemProfit / 100),
        };
      });

      if (isPaid) {
        totalProfitKobo += orderProfitKobo;
      }

      return {
        id: ord.id,
        orderNumber: ord.order_number,
        status: ord.status,
        totalKobo: ord.total,
        totalNgn: Math.round((ord.total || 0) / 100),
        profitKobo: orderProfitKobo,
        profitNgn: Math.round(orderProfitKobo / 100),
        createdAt: ord.created_at,
        itemCount: items.length,
        items,
      };
    });

    // 4. Fetch Inquiries / Support Tickets made by this customer
    let inquiriesQuery = serviceClient
      .from("support_tickets")
      .select("id, reference, subject, status, priority, created_at");

    if (userRow?.id && email) {
      inquiriesQuery = inquiriesQuery.or(`user_id.eq.${userRow.id},customer_email.eq.${email}`);
    } else if (userRow?.id) {
      inquiriesQuery = inquiriesQuery.eq("user_id", userRow.id);
    } else if (email) {
      inquiriesQuery = inquiriesQuery.eq("customer_email", email);
    }

    const { data: rawInquiries } = await inquiriesQuery.order("created_at", { ascending: false });

    const inquiries = (rawInquiries || []).map((t) => ({
      id: t.id,
      reference: t.reference,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
    }));

    return NextResponse.json({
      data: {
        customer: {
          id: userRow?.id || customerRow?.id || customerId,
          userId: userRow?.id || customerRow?.user_id || null,
          customerId: customerRow?.id || null,
          fullName,
          email,
          phone,
          isDisabled,
          disabledReason,
          disabledAt,
          deletedAt,
          deletionReason,
          daysRemaining,
          createdAt,
        },
        stats: {
          totalOrders: orders.length,
          totalSpentKobo,
          totalSpentNgn: Math.round(totalSpentKobo / 100),
          totalProfitKobo,
          totalProfitNgn: Math.round(totalProfitKobo / 100),
          profitMarginPct: totalSpentKobo > 0 ? Math.round((totalProfitKobo / totalSpentKobo) * 100) : 0,
        },
        orders,
        inquiries,
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}
