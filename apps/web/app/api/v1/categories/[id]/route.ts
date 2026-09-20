import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { isDbUniqueViolation, isPlainObject, SLUG, textField } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Category not found.", code: "NOT_FOUND" }, { status: 404 });

/** One category, by id or slug. Public, but inactive categories aren't shown. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    if (!isUuid(id) && !SLUG.test(id)) return notFound();
    const { data } = await createServiceClient()
      .from("categories")
      .select("id, name, slug, description, banner_cloudinary_id, mobile_banner_cloudinary_id, parent_id, sort_order, is_active, seo_title, seo_description")
      .eq(isUuid(id) ? "id" : "slug", id)
      .maybeSingle();
    if (!data || (data as { is_active?: boolean }).is_active === false) return notFound();
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

const FIELDS = ["name", "slug", "description", "banner_cloudinary_id", "mobile_banner_cloudinary_id", "parent_id", "sort_order", "is_active", "seo_title", "seo_description"] as const;

export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    if (!isPlainObject(parsed.body)) return NextResponse.json({ error: "Expected a JSON object.", code: "INVALID_BODY" }, { status: 400 });
    const body = parsed.body;

    const patch: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    const text = (key: string, label: string, max: number, required = false) => {
      if (!(key in body)) return;
      const r = textField(body[key], label, { max, required });
      if ("error" in r) errors[key] = r.error;
      else patch[key] = r.value;
    };
    text("name", "Name", 100, true);
    text("description", "Description", 2000);
    text("banner_cloudinary_id", "Banner", 255);
    text("mobile_banner_cloudinary_id", "Mobile banner", 255);
    text("seo_title", "SEO title", 70);
    text("seo_description", "SEO description", 160);

    if ("slug" in body) {
      if (typeof body.slug !== "string" || !SLUG.test(body.slug) || body.slug.length > 100) errors.slug = "Slug can only use lowercase letters, numbers and single dashes.";
      else patch.slug = body.slug;
    }
    if ("sort_order" in body) {
      if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0) errors.sort_order = "Sort order must be a whole number, 0 or more.";
      else patch.sort_order = body.sort_order;
    }
    if ("is_active" in body) {
      if (typeof body.is_active !== "boolean") errors.is_active = "Active must be true or false.";
      else patch.is_active = body.is_active;
    }
    if ("parent_id" in body) {
      if (body.parent_id === null) patch.parent_id = null;
      else if (!isUuid(body.parent_id)) errors.parent_id = "Parent must be a category id.";
      else if (body.parent_id === id) errors.parent_id = "A category can't be its own parent.";
      else patch.parent_id = body.parent_id;
    }

    if (Object.keys(errors).length > 0) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update.", code: "NOTHING_TO_UPDATE" }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("categories")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      if (isDbUniqueViolation(error)) return NextResponse.json({ error: "Another category already uses that slug.", code: "SLUG_TAKEN", details: { slug: "Already in use." } }, { status: 409 });
      return serverError(new Error(error.message));
    }
    if (!data) return notFound();

    await logActivity(client, { actorId: access.user.id, action: "category.update", targetType: "category", targetId: id, changes: patch, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const client = createServiceClient();

    // Deleting would leave products with no category, so it's refused while any are in it.
    const { data: inUse, error: useError } = await client.from("products").select("id").eq("category_id", id).limit(1);
    if (useError) return serverError(new Error(useError.message));
    if (Array.isArray(inUse) && inUse.length > 0) {
      return NextResponse.json({ error: "This category still has products. Move or remove them first.", code: "CATEGORY_IN_USE" }, { status: 409 });
    }

    const { error } = await client.from("categories").delete().eq("id", id);
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: access.user.id, action: "category.delete", targetType: "category", targetId: id, ip: clientIp(request) });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (err) {
    return serverError(err);
  }
}
