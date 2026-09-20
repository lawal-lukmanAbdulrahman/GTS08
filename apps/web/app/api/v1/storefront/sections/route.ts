import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServiceClient } from "@gts/database";
import { requireAdmin } from "../../_lib/staff-access";

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

function validateLayout(body: unknown): { ok: true; sections: StorefrontSectionConfig[]; heroProductIds?: string[] } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) return { ok: false, message: "Send a JSON object." };
  const { sections, heroProductIds } = body as Record<string, unknown>;
  if (!Array.isArray(sections)) return { ok: false, message: "Sections array is required" };
  if (sections.length > 50) return { ok: false, message: "Too many sections." };
  const clean: StorefrontSectionConfig[] = [];
  for (const raw of sections) {
    const s = raw as Record<string, unknown> | null;
    const okShape =
      !!s &&
      typeof s.id === "string" && s.id.length > 0 && s.id.length <= 64 &&
      typeof s.name === "string" && s.name.length <= 100 &&
      typeof s.category === "string" && s.category.length <= 50 &&
      typeof s.enabled === "boolean" &&
      typeof s.order === "number" && Number.isFinite(s.order);
    if (!okShape) return { ok: false, message: "Each section needs an id, name, category, enabled flag and order." };
    clean.push({ id: s.id as string, name: s.name as string, category: s.category as string, enabled: s.enabled as boolean, order: s.order as number });
  }
  let hero: string[] | undefined;
  if (heroProductIds !== undefined) {
    if (!Array.isArray(heroProductIds) || heroProductIds.length > 20 || heroProductIds.some((h) => typeof h !== "string" || h.length > 100)) {
      return { ok: false, message: "heroProductIds must be a short list of product ids." };
    }
    hero = heroProductIds as string[];
  }
  return { ok: true, sections: clean, heroProductIds: hero };
}

/** Only an admin can change the storefront layout. Checked before the body is even read. */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }
    const check = validateLayout(body);
    if (!check.ok) return NextResponse.json({ success: false, error: check.message }, { status: 400 });

    const updatedConfig: StorefrontLayoutConfig = {
      sections: check.sections,
      heroProductIds: check.heroProductIds ?? cachedConfig.heroProductIds,
      updatedAt: new Date().toISOString(),
    };

    const supabase = createServiceClient();
    // Store in content_slots as JSON payload in headline
    const { error } = await supabase.from("content_slots").upsert({
      slot_key: "hero_1",
      headline: JSON.stringify(updatedConfig),
      subheadline: "Storefront Sections Layout Configuration",
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ success: false, error: "Could not save the layout. Try again." }, { status: 500 });
    }

    cachedConfig = updatedConfig;
    return NextResponse.json({ success: true, data: updatedConfig });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update storefront config" },
      { status: 500 }
    );
  }
}
