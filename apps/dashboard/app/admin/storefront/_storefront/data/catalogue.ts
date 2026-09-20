import type { ProductColorOption, ProductItem } from "./products";

/** The parts of the public products API the storefront reads. */
export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  sub_category: string | null;
  has_transparent_bg?: boolean;
  short_description: string | null;
  description: string | null;
  base_price: number;
  compare_at_price: number | null;
  average_rating: number | null;
  review_count: number | null;
  tags: string[] | null;
  badges?: string[];
  /** A product's own category, which may be narrow ("Air Fryers"); `parent` is the top-level group ("Appliances"). */
  category: { name: string; slug: string; parent?: { name: string; slug: string } | null } | null;
  primary_image: { cloudinary_id: string } | null;
  images: Array<{ id: string; cloudinary_id: string; is_primary: boolean; sort_order: number; variant_id?: string | null }>;
  variants: Array<{ id: string; size: string | null; color: string | null; color_hex: string | null; is_active?: boolean }>;
  description_image_urls?: string[];
}

export const PLACEHOLDER_IMAGE = "/products/placeholder.svg";

/** 3200 -> "3.2k": how the storefront shows review counts. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const k = Math.round((n / 1000) * 10) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** A picture reference from the database as something a browser can load: a site path, an https URL, or a Cloudinary id. Anything else is refused. */
export function imageUrl(ref: string | null | undefined): string {
  const v = (ref ?? "").trim();
  if (!v) return PLACEHOLDER_IMAGE;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^https:\/\//i.test(v)) return v;
  if (/^[A-Za-z0-9_./-]+$/.test(v) && !v.includes("..")) {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (cloud) return `https://res.cloudinary.com/${cloud}/image/upload/${v}`;
  }
  return PLACEHOLDER_IMAGE;
}

/** A product from the API as the storefront's own product record. The slug is the id, so links and carts keep working. */
export function dbProductToItem(p: ApiProduct): ProductItem {
  const variants = (p.variants ?? []).filter((v) => v.is_active !== false);
  const primary = p.primary_image?.cloudinary_id ?? p.images?.find((i) => i.is_primary)?.cloudinary_id ?? p.images?.[0]?.cloudinary_id;
  const cardImage = imageUrl(primary);

  const sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];

  // One option per colour, in the order the variants list them, with the pictures attached to that colour's variants.
  const byColour = new Map<string, string[]>();
  for (const v of variants) {
    const label = v.color?.trim();
    if (!label) continue;
    byColour.set(label, [...(byColour.get(label) ?? []), v.id]);
  }
  const imagesFor = (variantIds: string[]) =>
    (p.images ?? [])
      .filter((i) => i.variant_id && variantIds.includes(i.variant_id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => imageUrl(i.cloudinary_id));

  const options: ProductColorOption[] = [...byColour.entries()].map(([label, ids]) => {
    const own = imagesFor(ids);
    const list = own.length > 0 ? own : [cardImage];
    return { color: slugify(label), label, main: list[0]!, thumbnails: list };
  });
  if (options.length === 0) options.push({ color: "default", label: "Default", main: cardImage, thumbnails: [cardImage] });

  const badges = p.badges ?? [];
  const rating = Number(p.average_rating ?? 0);
  const count = Number(p.review_count ?? 0);

  return {
    id: p.slug,
    brand: p.brand || "GTS",
    sku: p.sku || p.slug,
    title: p.name,
    price: naira(p.base_price),
    ...(p.compare_at_price && p.compare_at_price > p.base_price ? { originalPrice: naira(p.compare_at_price) } : {}),
    priceNum: p.base_price / 100,
    ...(badges.includes("sale") ? { badge: "SALE" } : badges.includes("bestseller") ? { badge: "BESTSELLER" } : {}),
    rating,
    reviewsCount: count,
    reviews: compactCount(count),
    shortDescription: p.short_description || undefined,
    description: p.description || p.short_description || "",
    category: p.category?.parent?.name || p.category?.name || "Other",
    subCategory: p.sub_category || (p.category?.parent ? p.category.name : ""),
    image: cardImage,
    images: options,
    sizes: sizes.length > 0 ? sizes : ["Standard"],
    tags: p.tags ?? [],
    hasTransparentBg: Boolean(p.has_transparent_bg),
    descriptionImages: (p.description_image_urls ?? []).map(imageUrl),
  };
}
