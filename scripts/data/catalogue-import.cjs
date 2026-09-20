#!/usr/bin/env node
/**
 * One-off: moves the storefront's bundled product list (apps/web/app/(storefront)/_data/products.ts,
 * read from git history if the file has already been slimmed) into the database.
 *
 *   node scripts/data/catalogue-import.cjs            # dry run: prints what it would add
 *   node scripts/data/catalogue-import.cjs --apply    # does it
 *
 * Idempotent and additive: it never overwrites anything already in the database. It adds
 *   - products that are missing (by slug),
 *   - colours a product has in the bundle but not in the database (as variants, one per size),
 *   - images for those colours,
 * and fills in blank ratings/sub-category/brand on existing rows.
 * New variants get ZERO stock: the bundle has no stock figures and none are invented. Set real
 * counts in Admin > Inventory.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "../..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };
const rest = async (method, url, body) => {
  const r = await fetch(U + "/rest/v1/" + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

function loadBundle() {
  const rel = "apps/web/app/(storefront)/_data/products.ts";
  let src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (!src.includes("REAL_PRODUCTS: ProductItem[]")) {
    // The list has since been removed from the file: read it from the commit just before that.
    const removedIn = execFileSync("git", ["log", "-1", "--format=%H", "-S", "export const REAL_PRODUCTS", "--", rel], { cwd: ROOT, encoding: "utf8" }).trim();
    if (!removedIn) throw new Error("Can't find the bundled product list in git history.");
    src = execFileSync("git", ["show", `${removedIn}~1:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  }
  if (!src.includes("REAL_PRODUCTS: ProductItem[]")) throw new Error("The bundled product list is no longer in that file.");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports });
  return mod.exports.REAL_PRODUCTS;
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const HEX = { black: "#111111", white: "#FFFFFF", blue: "#1E40AF", brown: "#78350F", green: "#166534", red: "#B91C1C", grey: "#6B7280", gray: "#6B7280", beige: "#D6C7A1", silver: "#C0C0C0", gold: "#CA8A04", pink: "#EC4899", navy: "#1E3A8A" };
const hexFor = (label) => HEX[Object.keys(HEX).find((k) => label.toLowerCase().includes(k))] ?? null;
const norm = (s) => String(s ?? "").trim().toLowerCase();
const priceKobo = (p) => Math.round(p.priceNum * 100);

(async () => {
  const bundle = loadBundle();
  const db = await rest("GET", "products?select=id,slug,sku,brand,sub_category,average_rating,review_count,category_id,tags,variants:product_variants(id,size,color),images:product_images(id,cloudinary_public_id,variant_id)&limit=500");
  const cats = await rest("GET", "categories?select=id,name,slug&limit=500");
  const bySlug = new Map(db.map((p) => [p.slug, p]));
  const plan = { newProducts: [], newColours: 0, newImages: 0, newVariants: 0, filled: 0 };

  for (const p of bundle) {
    let row = bySlug.get(p.id);
    const colours = p.images && p.images.length ? p.images : [{ label: "Default", color: "default", main: p.image, thumbnails: [p.image] }];
    const sizes = p.sizes && p.sizes.length ? p.sizes : ["Standard"];

    if (!row) {
      plan.newProducts.push(p.id);
      console.log(`+ product ${p.id} (${p.title}) with ${colours.length} colour(s) x ${sizes.length} size(s)`);
      if (APPLY) {
        let cat = cats.find((c) => norm(c.name) === norm(p.category));
        if (!cat) {
          [cat] = await rest("POST", "categories", { name: p.category, slug: slugify(p.category) });
          cats.push(cat);
        }
        [row] = await rest("POST", "products", {
          name: p.title, slug: p.id, sku: p.sku, brand: p.brand, sub_category: p.subCategory,
          short_description: (p.shortDescription || p.description || "").slice(0, 300), description: p.description,
          category_id: cat.id, base_price: priceKobo(p), compare_at_price: p.originalPrice ? Math.round(Number(String(p.originalPrice).replace(/[^\d.]/g, "")) * 100) : null,
          status: "active", tags: p.tags || [], average_rating: p.rating || null, review_count: p.reviewsCount || 0,
          has_transparent_bg: !!p.hasTransparentBg,
        });
        row.variants = [];
        row.images = [];
      } else {
        row = { id: "(new)", variants: [], images: [], slug: p.id };
      }
    } else {
      const patch = {};
      if (!row.sub_category && p.subCategory) patch.sub_category = p.subCategory;
      if (!row.brand && p.brand) patch.brand = p.brand;
      if (row.average_rating == null && p.rating) { patch.average_rating = p.rating; patch.review_count = p.reviewsCount || 0; }
      if (Object.keys(patch).length) {
        plan.filled += 1;
        console.log(`~ ${p.id}: fill ${Object.keys(patch).join(", ")}`);
        if (APPLY) await rest("PATCH", `products?id=eq.${row.id}`, patch);
      }
    }

    const knownUrls = new Set((row.images || []).map((i) => i.cloudinary_public_id));
    for (const colour of colours) {
      const haveColour = row.variants.some((v) => norm(v.color) === norm(colour.label) || (norm(colour.label) !== "default" && norm(v.color).includes(norm(colour.color))));
      if (haveColour || (colours.length === 1 && row.variants.length > 0)) {
        // Existing colour: add any bundled gallery images the database doesn't have yet.
        const variant = row.variants.find((v) => norm(v.color) === norm(colour.label) || norm(v.color).includes(norm(colour.color))) || row.variants[0];
        const missing = [...new Set([colour.main, ...(colour.thumbnails || [])].filter(Boolean))].filter((u) => !knownUrls.has(u));
        if (missing.length) {
          plan.newImages += missing.length;
          console.log(`  + ${missing.length} gallery image(s) for "${colour.label}" on ${p.id}`);
          if (APPLY && variant) await rest("POST", "product_images", missing.map((u, i) => ({ product_id: row.id, variant_id: variant.id, cloudinary_public_id: u, alt_text: p.title, sort_order: 10 + i, is_primary: false })));
        }
        continue;
      }
      // A single-colour product whose only DB colour is a different name is left alone.
      if (colours.length === 1 && row.variants.length > 0) continue;
      plan.newColours += 1;
      plan.newVariants += sizes.length;
      console.log(`  + colour "${colour.label}" on ${p.id}: ${sizes.length} variant(s) at 0 stock, ${colour.thumbnails?.length || 1} image(s)`);
      if (!APPLY) continue;
      const created = await rest("POST", "product_variants", sizes.map((size) => ({
        product_id: row.id, size, color: colour.label === "Default" ? null : colour.label, color_hex: hexFor(colour.label),
        sku: `${p.sku}-${slugify(size)}${colour.label === "Default" ? "" : "-" + slugify(colour.label)}`.slice(0, 150), price_modifier: 0, is_active: true,
      })));
      await rest("POST", "inventory", created.map((v) => ({ variant_id: v.id, quantity: 0, reserved_quantity: 0 })));
      const urls = [...new Set([colour.main, ...(colour.thumbnails || [])].filter(Boolean))];
      plan.newImages += urls.length;
      await rest("POST", "product_images", urls.map((u, i) => ({ product_id: row.id, variant_id: created[0].id, cloudinary_public_id: u, alt_text: p.title, sort_order: i, is_primary: false })));
    }
    // Products with no image at all get their bundled one as primary.
    if ((row.images || []).length === 0 && APPLY && row.id !== "(new)") {
      const main = colours[0].main || p.image;
      if (main) await rest("POST", "product_images", { product_id: row.id, cloudinary_public_id: main, alt_text: p.title, sort_order: 0, is_primary: true });
    }
  }

  console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${plan.newProducts.length} new product(s), ${plan.newColours} new colour(s) / ${plan.newVariants} variant(s) at zero stock, ${plan.newImages} image(s), ${plan.filled} product(s) with blanks filled.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
