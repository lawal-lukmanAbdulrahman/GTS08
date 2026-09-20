import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { requirePermission } from "../_lib/staff-access";
import { serverError, readJson } from "../_lib/http";
import { isUuid, toSlug } from "@gts/utils";
import { clientIp, logActivity } from "../_lib/activity";
import { isDbUniqueViolation, isPlainObject, SLUG, textField } from "../_lib/validate";

const STOREFRONT_CATEGORIES = [
  {
    name: "Appliances",
    slug: "appliances",
    sub_categories: [
      "Washing Machines", "Fridges", "Freezers", "Air Conditioners", "Heaters", "Fans",
      "Air Purifiers", "Water Dispensers", "Generators & Inverters", "Blenders",
      "Deep Fryers", "Juicers", "Air Fryers", "Rice Cookers", "Toasters & Ovens",
      "Microwaves", "Bundles", "Vacuum Cleaners", "Kettles", "Yam Pounders", "Irons",
      "Electric Cookware", "Electric Drink Mixers", "Food Processors", "Coffee Makers",
      "Electric Pressure Cookers", "Air Quality Control", "Cleaning Equipment", "Sewing Machines", "Water Heaters"
    ],
  },
  {
    name: "Phones & Tablets",
    slug: "phones-tablets",
    sub_categories: [
      "Smartphones", "iOS Phones", "Android Phones", "Basic Phones", "Refurbished Phones",
      "iPads", "Android Tablets", "Educational Tablets", "Graphics Tablets",
      "Cases & Covers", "Screen Protectors", "Power Banks", "Chargers & Cables",
      "Earphones & Headsets", "Smartwatches & Bands"
    ],
  },
  {
    name: "Health & Beauty",
    slug: "health-beauty",
    sub_categories: [
      "Face Cleansers", "Moisturizers & Creams", "Sunscreen & SPF", "Serums & Oils",
      "Face Masks", "Men's Perfumes", "Women's Perfumes", "Body Mists & Sprays",
      "Deodorants", "Shampoos & Conditioners", "Styling Tools & Irons", "Wigs & Extensions"
    ],
  },
  {
    name: "Home & Office",
    slug: "home-office",
    sub_categories: [
      "Office Chairs", "Executive Desks", "Living Room Sofas", "Bed Frames & Tables",
      "Bed Sheets & Pillowcases", "Duvets & Comforters", "Bath Towels",
      "Table Lamps & Bulbs", "Wall Art & Clocks", "Rugs & Carpets"
    ],
  },
  {
    name: "Electronics",
    slug: "electronics",
    sub_categories: [
      "Smart TVs", "OLED & QLED TVs", "4K UHD TVs", "Projectors & Screens",
      "Soundbars & Subwoofers", "Home Theatre Systems", "Bluetooth Speakers"
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    sub_categories: [
      "Dresses", "Tops & Blouses", "Footwear & Heels", "Handbags & Clutches",
      "Casual T-Shirts", "Formal Shirts", "Jeans & Trousers", "Sneakers & Boots"
    ],
  },
  {
    name: "Supermarket",
    slug: "supermarket",
    sub_categories: [
      "Juices & Drinks", "Coffee & Tea", "Energy & Soft Drinks",
      "Rice & Grains", "Pasta & Noodles", "Cooking Oils"
    ],
  },
  {
    name: "Computing",
    slug: "computing",
    sub_categories: [
      "Gaming Laptops", "MacBooks", "Ultrabooks & Slims", "Business Laptops",
      "Monitors & Screens", "External Hard Drives", "SSDs & Flash Drives", "Keyboards & Mice"
    ],
  },
  {
    name: "Baby Products",
    slug: "baby-products",
    sub_categories: [
      "Diapers & Wipes", "Baby Bottles", "High Chairs", "Strollers & Prams", "Car Seats", "Walkers"
    ],
  },
  {
    name: "Gaming",
    slug: "gaming",
    sub_categories: [
      "PlayStation 5", "Xbox Series X/S", "Nintendo Switch",
      "Wireless Controllers", "Gaming Headsets", "Gaming Chairs"
    ],
  },
  {
    name: "Automotive & Sports",
    slug: "automotive-sports",
    sub_categories: [
      "Car Care & Polish", "Auto Electronics", "Fitness Equipment"
    ],
  },
];

export async function GET() {
  try {
    const serviceClient = createServiceClient();
    const { data: dbCategories, error } = await serviceClient
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    const catMap = new Map<string, any>();

    // Seed standard storefront categories
    STOREFRONT_CATEGORIES.forEach((cat, idx) => {
      catMap.set(cat.name.toLowerCase(), {
        name: cat.name,
        slug: cat.slug,
        sub_categories: cat.sub_categories,
        sort_order: idx,
      });
    });

    // Merge database categories
    if (!error && dbCategories && dbCategories.length > 0) {
      dbCategories.forEach((dbCat: any) => {
        const key = (dbCat.name || "").toLowerCase();
        if (catMap.has(key)) {
          catMap.set(key, { ...catMap.get(key), ...dbCat });
        } else {
          catMap.set(key, {
            id: dbCat.id,
            name: dbCat.name,
            slug: dbCat.slug,
            description: dbCat.description,
            sub_categories: dbCat.sub_categories || [],
            sort_order: dbCat.sort_order || 99,
          });
        }
      });
    }

    return NextResponse.json({ data: Array.from(catMap.values()) });
  } catch {
    return NextResponse.json({ data: STOREFRONT_CATEGORIES });
  }
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
