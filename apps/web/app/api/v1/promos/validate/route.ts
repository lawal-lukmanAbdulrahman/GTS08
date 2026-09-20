import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { computePromoDiscount, normalizePromoCode, type PromoRow } from "@gts/utils";
import { PROMO_COLUMNS } from "../../_lib/promo-db";
import { isPlainObject } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

const INVALID = { error: "That promo code isn't valid.", code: "INVALID_PROMO" };

/**
 * Public check of a code against a cart total, for the storefront to show the
 * saving. It is advice only: checkout re-checks the code against the server's
 * own prices, so nothing sent here can lower what is charged. An unknown code
 * and an unusable one give the same answer.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = isPlainObject(parsed.body) ? parsed.body : {};

    const code = normalizePromoCode(body.code);
    const total = body.cart_total;
    if (!code || typeof total !== "number" || !Number.isInteger(total) || total < 0) {
      return NextResponse.json({ error: "Send a promo code and the cart total in kobo.", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const { data, error } = await createServiceClient().from("promos").select(PROMO_COLUMNS).eq("code", code).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return NextResponse.json(INVALID, { status: 400 });

    const result = computePromoDiscount(data as unknown as PromoRow, total);
    if (!result.ok) {
      return result.reason === "MIN_ORDER"
        ? NextResponse.json({ error: "Your order is a little under the minimum for this code.", code: "MIN_ORDER", details: { short_by: result.shortBy } }, { status: 400 })
        : NextResponse.json(INVALID, { status: 400 });
    }
    return NextResponse.json({ data: { code, discount: result.discount, total_after_discount: total - result.discount } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
