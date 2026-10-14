import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { PROMO_COLUMNS } from "../../_lib/promo-db";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const client = createServiceClient();
    const eligibleCustomerIds = new Set<string>();

    // 1. Try authenticated user
    const authUser = await getAuthenticatedUser(request);
    if (authUser?.id) {
      eligibleCustomerIds.add(authUser.id.toLowerCase());
      const safeEmail = (authUser.email ?? "").toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
      const filters = [`user_id.eq.${authUser.id}`];
      if (safeEmail) filters.push(`email.eq.${safeEmail}`);
      const { data: custs } = await client.from("customers").select("id, user_id").or(filters.join(","));
      if (custs) {
        for (const c of custs) {
          if (c.id) eligibleCustomerIds.add(String(c.id).toLowerCase());
          if (c.user_id) eligibleCustomerIds.add(String(c.user_id).toLowerCase());
        }
      }
    }

    // 2. Query param fallbacks / supplements: customerId & userId
    const candidateQueryIds: string[] = [];
    const paramCustomerId = request.nextUrl.searchParams.get("customerId");
    if (paramCustomerId && /^[0-9a-fA-F-]{36}$/.test(paramCustomerId)) {
      candidateQueryIds.push(paramCustomerId.toLowerCase());
      eligibleCustomerIds.add(paramCustomerId.toLowerCase());
    }

    const paramUserId = request.nextUrl.searchParams.get("userId");
    if (paramUserId && /^[0-9a-fA-F-]{36}$/.test(paramUserId)) {
      candidateQueryIds.push(paramUserId.toLowerCase());
      eligibleCustomerIds.add(paramUserId.toLowerCase());
    }

    // 3. Resolve cross-table IDs between `users` and `customers`
    if (candidateQueryIds.length > 0) {
      const orFilter = candidateQueryIds.map((id) => `id.eq.${id},user_id.eq.${id}`).join(",");
      const { data: linkedCusts } = await client.from("customers").select("id, user_id").or(orFilter);
      if (linkedCusts) {
        for (const c of linkedCusts) {
          if (c.id) eligibleCustomerIds.add(String(c.id).toLowerCase());
          if (c.user_id) eligibleCustomerIds.add(String(c.user_id).toLowerCase());
        }
      }

      // Also check if any candidate ID is a user in `users`
      const { data: linkedUsers } = await client.from("users").select("id").in("id", candidateQueryIds);
      if (linkedUsers) {
        for (const u of linkedUsers) {
          if (u.id) eligibleCustomerIds.add(String(u.id).toLowerCase());
        }
      }
    }

    const nowIso = new Date().toISOString();

    // Query active and valid date promos
    const { data: rawPromos, error } = await client
      .from("promos")
      .select(PROMO_COLUMNS)
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .order("created_at", { ascending: false });

    if (error) return serverError(new Error(error.message));
    if (!rawPromos || rawPromos.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Filter by expiration, max_uses, and customer targeting
    const validPromos = rawPromos.filter((p: any) => {
      if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return false;
      if (p.max_uses !== null && p.used_count >= p.max_uses) return false;

      // Targeting check
      if (p.target_type === "specific_customers") {
        if (eligibleCustomerIds.size === 0) return false;
        if (!Array.isArray(p.customer_ids) || p.customer_ids.length === 0) return false;
        const isTargeted = p.customer_ids.some((id: string) =>
          eligibleCustomerIds.has(String(id).toLowerCase())
        );
        if (!isTargeted) return false;
      }

      return true;
    });

    // Check customer-specific usage limit if eligible customer IDs are present
    const eligiblePromos: any[] = [];
    for (const promo of validPromos) {
      if (promo.max_uses_per_customer && eligibleCustomerIds.size > 0) {
        const idList = Array.from(eligibleCustomerIds);
        const { count } = await client
          .from("promo_code_uses")
          .select("id", { count: "exact", head: true })
          .eq("promo_id", promo.id)
          .in("customer_id", idList);

        if (typeof count === "number" && count >= promo.max_uses_per_customer) {
          continue; // customer reached limit
        }
      }
      eligiblePromos.push(promo);
    }

    // Load product previews for eligible promos that target specific products
    const allProductIds = new Set<string>();
    eligiblePromos.forEach((p) => {
      if (p.product_scope === "specific_products" && Array.isArray(p.product_ids)) {
        p.product_ids.forEach((id: string) => allProductIds.add(id));
      }
    });

    const productMap: Record<string, { id: string; name: string; image_url: string; base_price: number }> = {};
    if (allProductIds.size > 0) {
      const { data: products } = await client
        .from("products")
        .select("id, name, slug, base_price, images:product_images(cloudinary_public_id, is_primary)")
        .in("id", Array.from(allProductIds));

      if (products) {
        products.forEach((prod: any) => {
          const primaryImg = prod.images?.find((img: any) => img.is_primary) || prod.images?.[0];
          productMap[prod.id] = {
            id: prod.id,
            name: prod.name,
            image_url: primaryImg?.cloudinary_public_id || "/products/denim_jacket.png",
            base_price: prod.base_price,
          };
        });
      }
    }

    const result = eligiblePromos.map((p) => ({
      ...p,
      products:
        p.product_scope === "specific_products" && Array.isArray(p.product_ids)
          ? p.product_ids.map((id: string) => productMap[id]).filter(Boolean)
          : [],
    }));

    return NextResponse.json(
      { data: result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError(err);
  }
}
