import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";

export interface StorefrontSectionConfig {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  order: number;
}

export interface StorefrontLayoutConfig {
  sections: StorefrontSectionConfig[];
  heroProductIds: string[];
  updatedAt: string;
}

const DEFAULT_STOREFRONT_SECTIONS: StorefrontSectionConfig[] = [
  { id: "hero", name: "Hero Showcase", category: "Hero", enabled: true, order: 0 },
  { id: "bestsellers", name: "Bestselling Products", category: "Products", enabled: true, order: 1 },
  { id: "categories", name: "Featured Categories", category: "Categories", enabled: true, order: 2 },
  { id: "appliances", name: "Upgrade Your Appliances", category: "Products", enabled: true, order: 3 },
  { id: "baby", name: "Baby Specials", category: "Products", enabled: true, order: 4 },
  { id: "new-arrivals", name: "Fresh Season New Arrivals", category: "Showcase", enabled: true, order: 5 },
  { id: "beauty", name: "Beauty & Hygiene Deals", category: "Products", enabled: true, order: 6 },
  { id: "showcase", name: "Showcase Banners", category: "Banners", enabled: true, order: 7 },
  { id: "crazy-finds", name: "Crazy Finds", category: "Products", enabled: true, order: 8 },
  { id: "faq", name: "Frequently Asked Questions", category: "Support", enabled: true, order: 9 },
  { id: "footer", name: "Storefront Footer", category: "Footer", enabled: true, order: 10 },
];

const DEFAULT_HERO_PRODUCT_IDS = [
  "air-jordan-1",
  "pixel-10",
  "samsung-fridge",
  "nexus-washing-machine",
];

// In-memory fallback cache
let cachedConfig: StorefrontLayoutConfig = {
  sections: DEFAULT_STOREFRONT_SECTIONS,
  heroProductIds: DEFAULT_HERO_PRODUCT_IDS,
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("content_slots")
      .select("*")
      .eq("slot_key", "hero_1")
      .maybeSingle();

    if (!error && data && data.headline) {
      try {
        const parsed = JSON.parse(data.headline);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          cachedConfig = parsed;
        }
      } catch {
        // use cached config
      }
    }

    return NextResponse.json({
      success: true,
      data: cachedConfig,
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: cachedConfig,
    });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sections, heroProductIds } = body;

    if (!Array.isArray(sections)) {
      return NextResponse.json(
        { success: false, error: "Sections array is required" },
        { status: 400 }
      );
    }

    const updatedConfig: StorefrontLayoutConfig = {
      sections,
      heroProductIds: Array.isArray(heroProductIds) ? heroProductIds : cachedConfig.heroProductIds,
      updatedAt: new Date().toISOString(),
    };

    cachedConfig = updatedConfig;

    try {
      const supabase = createServiceClient();
      // Store in content_slots as JSON payload in headline
      await supabase
        .from("content_slots")
        .upsert({
          slot_key: "hero_1",
          headline: JSON.stringify(updatedConfig),
          subheadline: "Storefront Sections Layout Configuration",
          is_active: true,
          updated_at: new Date().toISOString(),
        });
    } catch (dbErr) {
      console.error("Failed to persist to Supabase content_slots:", dbErr);
    }

    return NextResponse.json({
      success: true,
      data: updatedConfig,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update storefront config" },
      { status: 500 }
    );
  }
}
