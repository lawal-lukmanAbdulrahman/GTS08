import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid, validatePromoInput } from "@gts/utils";
import { requireAdmin } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { PROMO_COLUMNS } from "../../_lib/promo-db";
import { isDbUniqueViolation } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Promo code not found.", code: "NOT_FOUND" }, { status: 404 });

async function load(id: string) {
  const { data, error } = await createServiceClient().from("promos").select(PROMO_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function GET(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const client = createServiceClient();
    const { data: promo, error } = await client.from("promos").select(PROMO_COLUMNS).eq("id", id).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!promo) return notFound();

    // Load usage history
    const { data: uses } = await client
      .from("promo_code_uses")
      .select("id, promo_id, order_id, customer_id, customer_email, customer_name, discount_applied_kobo, used_at")
      .eq("promo_id", id)
      .order("used_at", { ascending: false });

    // Load associated products
    let products: any[] = [];
    if (promo.product_ids && Array.isArray(promo.product_ids) && promo.product_ids.length > 0) {
      const { data: prods } = await client
        .from("products")
        .select("id, name, slug, base_price, cost_price, status, images:product_images(cloudinary_public_id, is_primary)")
        .in("id", promo.product_ids);

      products = (prods || []).map((p: any) => {
        const primaryImg = p.images?.find((img: any) => img.is_primary) || p.images?.[0];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          base_price: p.base_price,
          cost_price: p.cost_price,
          status: p.status,
          image_url: primaryImg?.cloudinary_public_id || "/products/denim_jacket.png",
        };
      });
    }

    // Load targeted customers from users table and customers table
    let targetedCustomers: any[] = [];
    if (promo.customer_ids && Array.isArray(promo.customer_ids) && promo.customer_ids.length > 0) {
      const { data: userCusts } = await client
        .from("users")
        .select("id, full_name, email, phone")
        .in("id", promo.customer_ids);

      const foundUserIds = new Set((userCusts || []).map((u: any) => u.id));
      const missingIds = promo.customer_ids.filter((id: string) => !foundUserIds.has(id));

      let dbCusts: any[] = [];
      if (missingIds.length > 0) {
        const { data: custRows } = await client
          .from("customers")
          .select("id, user_id, full_name, email, phone")
          .in("id", missingIds);
        dbCusts = custRows || [];
      }

      const allFound = [...(userCusts || []), ...dbCusts];
      targetedCustomers = allFound.map((c: any) => ({
        id: c.id,
        first_name: c.full_name ? c.full_name.split(" ")[0] : null,
        last_name: c.full_name && c.full_name.split(" ").length > 1 ? c.full_name.split(" ").slice(1).join(" ") : null,
        full_name: c.full_name || c.email,
        email: c.email,
        phone: c.phone || null,
      }));
    }

    return NextResponse.json({
      data: {
        ...promo,
        uses: uses || [],
        products,
        targeted_customers: targetedCustomers,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

/** Edits a code. The use count is only ever changed by orders, never here. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validatePromoInput(parsed.body, "update");
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const current = await load(id);
    if (!current) return notFound();
    if (check.value.code && check.value.code !== current.code && current.used_count > 0) {
      return NextResponse.json({ error: "This code has been used, so it can't be renamed. Make a new one instead.", code: "CODE_IN_USE" }, { status: 409 });
    }

    const client = createServiceClient();
    const { data, error } = await client.from("promos").update(check.value).eq("id", id).select(PROMO_COLUMNS).maybeSingle();
    if (error) {
      if (isDbUniqueViolation(error)) return NextResponse.json({ error: "That code already exists.", code: "CODE_TAKEN", details: { code: "Already in use." } }, { status: 409 });
      return serverError(new Error(error.message));
    }
    if (!data) return notFound();
    await logActivity(client, { actorId: admin.user.id, action: "promo.update", targetType: "promo", targetId: id, changes: { fields: Object.keys(check.value) }, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

/** Deletes a code that has never been used. A used one is switched off instead, so past orders keep their history. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const promo = await load(id);
    if (!promo) return notFound();
    if (promo.used_count > 0) return NextResponse.json({ error: "This code has been used, so it can't be deleted. Switch it off instead.", code: "CODE_IN_USE" }, { status: 409 });

    const client = createServiceClient();
    const { error } = await client.from("promos").delete().eq("id", id);
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: admin.user.id, action: "promo.delete", targetType: "promo", targetId: id, changes: { code: promo.code }, ip: clientIp(request) });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (err) {
    return serverError(err);
  }
}
