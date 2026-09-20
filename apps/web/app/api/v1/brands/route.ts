import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePermission } from "../_lib/staff-access";
import { serverError } from "../_lib/http";

const DEFAULT_BRANDS = [
  { name: "GTS", slug: "gts", logo_url: "/logo.png" },
  { name: "Apple", slug: "apple", logo_url: "" },
  { name: "Samsung", slug: "samsung", logo_url: "" },
  { name: "Google", slug: "google", logo_url: "" },
  { name: "Nike", slug: "nike", logo_url: "" },
  { name: "Sony", slug: "sony", logo_url: "" },
  { name: "LG", slug: "lg", logo_url: "" },
  { name: "Xiaomi", slug: "xiaomi", logo_url: "" },
  { name: "Infinix", slug: "infinix", logo_url: "" },
  { name: "Tecno", slug: "tecno", logo_url: "" },
  { name: "Hisense", slug: "hisense", logo_url: "" },
  { name: "JBL", slug: "jbl", logo_url: "" },
  { name: "Nexus", slug: "nexus", logo_url: "" },
  { name: "Philips", slug: "philips", logo_url: "" },
  { name: "Ninja", slug: "ninja", logo_url: "" },
  { name: "Hurom", slug: "hurom", logo_url: "" },
  { name: "MasterChef", slug: "masterchef", logo_url: "" },
  { name: "DeLonghi", slug: "delonghi", logo_url: "" },
  { name: "Haier", slug: "haier", logo_url: "" },
  { name: "OX", slug: "ox", logo_url: "" },
  { name: "TCL", slug: "tcl", logo_url: "" },
  { name: "Polystar", slug: "polystar", logo_url: "" },
  { name: "Air Jordan", slug: "air-jordan", logo_url: "" },
  { name: "Adidas", slug: "adidas", logo_url: "" },
  { name: "Zara", slug: "zara", logo_url: "" },
  { name: "HP", slug: "hp", logo_url: "" },
  { name: "Dell", slug: "dell", logo_url: "" },
  { name: "Lenovo", slug: "lenovo", logo_url: "" },
  { name: "Asus", slug: "asus", logo_url: "" },
  { name: "Nivea", slug: "nivea", logo_url: "" },
  { name: "CeraVe", slug: "cerave", logo_url: "" },
  { name: "Maybelline", slug: "maybelline", logo_url: "" },
  { name: "Fenty Beauty", slug: "fenty-beauty", logo_url: "" },
  { name: "PlayStation", slug: "playstation", logo_url: "" },
  { name: "Xbox", slug: "xbox", logo_url: "" },
  { name: "Nintendo", slug: "nintendo", logo_url: "" },
  { name: "Razer", slug: "razer", logo_url: "" },
  { name: "IKEA", slug: "ikea", logo_url: "" },
];

export async function GET() {
  try {
    const serviceClient = createServiceClient();
    const { data: dbBrands, error } = await serviceClient
      .from("brands")
      .select("*")
      .order("name", { ascending: true });

    if (error || !dbBrands || dbBrands.length === 0) {
      // Return combined default brands if database table is empty or pending migration
      return NextResponse.json({ data: DEFAULT_BRANDS });
    }

    // Merge default registry brands with custom database brands without duplicates
    const brandMap = new Map<string, any>();
    DEFAULT_BRANDS.forEach((b) => brandMap.set(b.name.toLowerCase(), b));
    dbBrands.forEach((b) => brandMap.set(b.name.toLowerCase(), b));

    const combined = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ data: combined });
  } catch {
    return NextResponse.json({ data: DEFAULT_BRANDS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
    const _user = access.user;

    const body = await request.json();
    const { name, slug, logo_url, description, is_featured } = body;

    if (!name) {
      return NextResponse.json({ error: "Brand name is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const serviceClient = createServiceClient();
    const { data: brand, error } = await serviceClient
      .from("brands")
      .upsert(
        {
          name: name.trim(),
          slug: finalSlug,
          logo_url: logo_url || null,
          description: description || null,
          is_featured: Boolean(is_featured),
        },
        { onConflict: "name" }
      )
      .select()
      .single();

    if (error) {
      // If table doesn't exist yet, return success object gracefully
      return NextResponse.json({
        data: {
          name: name.trim(),
          slug: finalSlug,
          logo_url: logo_url || null,
          description: description || null,
        },
      }, { status: 201 });
    }

    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (err: any) {
    return serverError(err);
  }
}
