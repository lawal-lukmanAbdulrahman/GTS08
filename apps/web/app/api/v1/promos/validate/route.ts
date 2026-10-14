import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { computePromoDiscountWithScope, normalizePromoCode, type PromoRow, type CartItemForPromo } from "@gts/utils";
import { PROMO_COLUMNS } from "../../_lib/promo-db";
import { isPlainObject } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";
import { getAuthenticatedUser } from "../../auth/utils";

const INVALID = { error: "That promo code isn't valid.", code: "INVALID_PROMO" };

/**
 * Public check of a code against a cart total and items, for the storefront to show
 * the saving. It is advice only: checkout re-checks the code against the server's
 * own prices.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = isPlainObject(parsed.body) ? parsed.body : {};

    const code = normalizePromoCode(body.code);
    const total = body.cart_total;
    const customerId = typeof body.customer_id === "string" ? body.customer_id : undefined;
    const userId = typeof body.user_id === "string" ? body.user_id : undefined;
    const items = Array.isArray(body.cart_items) ? (body.cart_items as CartItemForPromo[]) : undefined;

    if (!code || typeof total !== "number" || !Number.isInteger(total) || total < 0) {
      return NextResponse.json({ error: "Send a promo code and the cart total in kobo.", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const client = createServiceClient();
    const { data, error } = await client.from("promos").select(PROMO_COLUMNS).eq("code", code).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return NextResponse.json(INVALID, { status: 400 });

    const promo = data as unknown as PromoRow;

    // Resolve eligible customer identifiers (users.id, customers.id)
    const eligibleCustomerIds = new Set<string>();
    if (customerId) eligibleCustomerIds.add(customerId.toLowerCase());
    if (userId) eligibleCustomerIds.add(userId.toLowerCase());

    const authUser = await getAuthenticatedUser(request);
    if (authUser?.id) eligibleCustomerIds.add(authUser.id.toLowerCase());

    const candidateIds = Array.from(eligibleCustomerIds).filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
    if (candidateIds.length > 0) {
      const orFilter = candidateIds.map((id) => `id.eq.${id},user_id.eq.${id}`).join(",");
      const { data: linkedCusts } = await client.from("customers").select("id, user_id").or(orFilter);
      if (linkedCusts) {
        for (const c of linkedCusts) {
          if (c.id) eligibleCustomerIds.add(String(c.id).toLowerCase());
          if (c.user_id) eligibleCustomerIds.add(String(c.user_id).toLowerCase());
        }
      }
    }

    // Check customer targeting
    if (promo.target_type === "specific_customers") {
      if (eligibleCustomerIds.size === 0 || !Array.isArray(promo.customer_ids) || promo.customer_ids.length === 0) {
        return NextResponse.json({ error: "This promo code is only valid for eligible customer accounts.", code: "CUSTOMER_NOT_ELIGIBLE" }, { status: 400 });
      }
      const isTargeted = promo.customer_ids.some((id: string) =>
        eligibleCustomerIds.has(String(id).toLowerCase())
      );
      if (!isTargeted) {
        return NextResponse.json({ error: "This promo code is only valid for eligible customer accounts.", code: "CUSTOMER_NOT_ELIGIBLE" }, { status: 400 });
      }
    }

    // Check per-customer usage limit
    if (promo.max_uses_per_customer && eligibleCustomerIds.size > 0 && promo.id) {
      const { count } = await client
        .from("promo_code_uses")
        .select("id", { count: "exact", head: true })
        .eq("promo_id", promo.id)
        .in("customer_id", Array.from(eligibleCustomerIds));

      if (typeof count === "number" && count >= promo.max_uses_per_customer) {
        return NextResponse.json({ error: "You have reached the maximum number of uses for this promo code.", code: "MAX_USES_REACHED" }, { status: 400 });
      }
    }

    const result = computePromoDiscountWithScope(promo, total, items);
    if (!result.ok) {
      return result.reason === "MIN_ORDER"
        ? NextResponse.json({ error: "Your order is a little under the minimum for this code.", code: "MIN_ORDER", details: { short_by: result.shortBy } }, { status: 400 })
        : NextResponse.json(INVALID, { status: 400 });
    }

    return NextResponse.json({
      data: {
        code,
        discount: result.discount,
        total_after_discount: total - result.discount,
        product_scope: promo.product_scope,
        product_ids: promo.product_ids,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
