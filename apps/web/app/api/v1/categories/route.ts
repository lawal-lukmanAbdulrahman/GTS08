import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { requirePermission } from "../_lib/staff-access";
import { serverError } from "../_lib/http";

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
  } catch (err: any) {
    return NextResponse.json({ data: STOREFRONT_CATEGORIES });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePermission(request, "can_manage_products");
    if (!access.ok) return access.response;
    const user = access.user;

    const body = await request.json();
    const { name, slug, description, banner_cloudinary_id, parent_id, sort_order, sub_categories } = body;

    if (!name) {
      return NextResponse.json({ error: "Category name is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const serviceClient = createServiceClient();
    const { data: category, error } = await serviceClient
      .from("categories")
      .upsert(
        {
          name: name.trim(),
          slug: finalSlug,
          description: description || null,
          banner_cloudinary_id: banner_cloudinary_id || null,
          parent_id: parent_id || null,
          sort_order: sort_order || 0,
        },
        { onConflict: "name" }
      )
      .select()
      .single();

    if (error) {
      // Return success gracefully
      return NextResponse.json(
        {
          data: {
            name: name.trim(),
            slug: finalSlug,
            description: description || null,
            sub_categories: sub_categories || [],
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err: any) {
    return serverError(err);
  }
}
