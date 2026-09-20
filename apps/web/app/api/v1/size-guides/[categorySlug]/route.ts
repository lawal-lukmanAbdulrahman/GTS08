import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePermission } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { isPlainObject, SLUG, textField } from "../../_lib/validate";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ categorySlug: string }> };
const notFound = () => NextResponse.json({ error: "Size guide not found.", code: "NOT_FOUND" }, { status: 404 });

const MAX_COLUMNS = 10;
const MAX_ROWS = 50;

/** A chart is { columns: string[], rows: (string|number)[][] } with every row as wide as the header. */
function validateChart(chart: unknown): string | null {
  if (!isPlainObject(chart) || !Array.isArray(chart.columns) || !Array.isArray(chart.rows)) return "The chart needs columns and rows.";
  const { columns, rows } = chart;
  if (columns.length < 1 || columns.length > MAX_COLUMNS || columns.some((c) => typeof c !== "string" || !c.trim() || c.length > 50)) return `Use 1 to ${MAX_COLUMNS} column headings of up to 50 characters.`;
  if (rows.length < 1 || rows.length > MAX_ROWS) return `Use 1 to ${MAX_ROWS} rows.`;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== columns.length || row.some((v) => !(typeof v === "number" && Number.isFinite(v)) && !(typeof v === "string" && v.length <= 50))) return "Every row needs one short value (text or number) for each column.";
  }
  return null;
}

async function categoryId(slug: string): Promise<string | null | "bad"> {
  if (!SLUG.test(slug)) return "bad";
  const { data, error } = await createServiceClient().from("categories").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

/** A category's size guide. Public. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { categorySlug } = await params;
    const id = await categoryId(categorySlug);
    if (id === "bad" || !id) return notFound();
    const { data, error } = await createServiceClient().from("size_guides").select("title, chart_data, how_to_measure, updated_at").eq("category_id", id).maybeSingle();
    if (error) return serverError(new Error(error.message));
    return data ? NextResponse.json({ data }) : notFound();
  } catch (err) {
    return serverError(err);
  }
}

/** Creates or replaces a category's size guide. */
export async function PUT(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_manage_products");
  if (!access.ok) return access.response;
  try {
    const { categorySlug } = await params;
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const b = isPlainObject(parsed.body) ? parsed.body : {};

    const errors: Record<string, string> = {};
    const chartError = validateChart(b.chart_data);
    if (chartError) errors.chart_data = chartError;
    const title = "title" in b ? textField(b.title, "Title", { max: 100 }) : { value: "Size Guide" };
    if ("error" in title) errors.title = title.error;
    let how: string | null = null;
    if (b.how_to_measure !== undefined && b.how_to_measure !== null) {
      if (typeof b.how_to_measure !== "string" || b.how_to_measure.length > 5000) errors.how_to_measure = "Keep the instructions under 5,000 characters.";
      else how = b.how_to_measure.trim() || null;
    }
    if (Object.keys(errors).length > 0) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: errors }, { status: 400 });

    const id = await categoryId(categorySlug);
    if (id === "bad" || !id) return NextResponse.json({ error: "Category not found.", code: "NOT_FOUND" }, { status: 404 });

    const client = createServiceClient();
    const { data, error } = await client
      .from("size_guides")
      .upsert({ category_id: id, title: (title as { value: string | null }).value ?? "Size Guide", chart_data: b.chart_data, how_to_measure: how, updated_at: new Date().toISOString() }, { onConflict: "category_id" })
      .select("title, chart_data, how_to_measure, updated_at")
      .single();
    if (error) return serverError(new Error(error.message));
    await logActivity(client, { actorId: access.user.id, action: "size_guide.update", targetType: "category", targetId: id, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
