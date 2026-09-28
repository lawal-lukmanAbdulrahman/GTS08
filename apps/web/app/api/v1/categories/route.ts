import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePermission } from "../_lib/staff-access";
import { serverError, readJson } from "../_lib/http";
import { isUuid, toSlug } from "@gts/utils";
import { clientIp, logActivity } from "../_lib/activity";
import { isDbUniqueViolation, isPlainObject, SLUG, textField } from "../_lib/validate";

const LIST_COLUMNS = "id, name, slug, description, parent_id, sort_order, is_active, banner_cloudinary_id";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  banner_cloudinary_id: string | null;
}

/**
 * The shop's categories, straight from the database (so a new live shop has
 * none until an admin creates them; the demo account sees the demo ones). Each
 * comes with its sub-categories' names for the storefront menu. Staff who manage
 * products can ask for hidden ones too (?all=true).
 */
export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "true";
  if (all) {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
  }
  let query = createServiceClient().from("categories").select(LIST_COLUMNS);
  if (!all) query = query.eq("is_active", true);
  const { data, error } = await query.order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (error) return serverError(new Error(error.message));

  const rows = (data ?? []) as CategoryRow[];
  return NextResponse.json({
    data: rows.map((c) => ({ ...c, sub_categories: rows.filter((x) => x.parent_id === c.id).map((x) => x.name) })),
  });
}

export async function POST(request: NextRequest) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;

  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const b = isPlainObject(parsed.body) ? parsed.body : {};

    const errors: Record<string, string> = {};
    const name = textField(b.name, "Name", { max: 100, required: true });
    if ("error" in name) errors.name = name.error;
    const description = textField(b.description, "Description", { max: 2000 });
    if ("error" in description) errors.description = description.error;
    const banner = textField(b.banner_cloudinary_id, "Banner", { max: 255 });
    if ("error" in banner) errors.banner_cloudinary_id = banner.error;

    let slug = "";
    if (b.slug !== undefined && b.slug !== null && b.slug !== "") {
      if (typeof b.slug !== "string" || !SLUG.test(b.slug) || b.slug.length > 100) errors.slug = "Slug can only use lowercase letters, numbers and single dashes.";
      else slug = b.slug;
    } else if (!("error" in name) && name.value) {
      slug = toSlug(name.value);
      if (!slug) errors.slug = "Give the category a name with letters or numbers.";
    }
    if (b.sort_order !== undefined && (typeof b.sort_order !== "number" || !Number.isInteger(b.sort_order) || b.sort_order < 0)) errors.sort_order = "Sort order must be a whole number, 0 or more.";
    if (b.parent_id !== undefined && b.parent_id !== null && !isUuid(b.parent_id)) errors.parent_id = "Parent must be a category id.";

    if (Object.keys(errors).length > 0) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("categories")
      .insert({
        name: (name as { value: string }).value,
        slug,
        description: (description as { value: string | null }).value,
        banner_cloudinary_id: (banner as { value: string | null }).value,
        parent_id: (b.parent_id as string | null | undefined) ?? null,
        sort_order: (b.sort_order as number | undefined) ?? 0,
      })
      .select()
      .single();
    if (error) {
      if (isDbUniqueViolation(error)) return NextResponse.json({ error: "A category with that name or slug already exists.", code: "CATEGORY_EXISTS" }, { status: 409 });
      return serverError(new Error(error.message));
    }
    await logActivity(client, { actorId: access.user.id, action: "category.create", targetType: "category", targetId: (data as { id: string }).id, ip: clientIp(request) });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
