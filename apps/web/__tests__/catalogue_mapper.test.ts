import { describe, it, expect } from "vitest";
import { dbProductToItem, compactCount } from "../app/(storefront)/_lib/catalogue";

const V = (id: string, size: string | null, color: string | null, extra: Record<string, unknown> = {}) => ({ id, size, color, color_hex: null, sku: "s", price_modifier: 0, available: 5, ...extra });
const IMG = (id: string, url: string, over: Record<string, unknown> = {}) => ({ id, cloudinary_id: url, is_primary: false, sort_order: 0, variant_id: null, ...over });

const P = {
  id: "uuid-1", name: "Air Jordan 1", slug: "air-jordan-1", sku: "AJ1", brand: "Air Jordan", sub_category: "Sneakers", has_transparent_bg: true,
  short_description: "Short", description: "Long", base_price: 45000000, compare_at_price: 52000000, average_rating: 4.9, review_count: 3200,
  category: { name: "Fashion", slug: "fashion" }, tags: ["popular"], badges: ["sale", "bestseller"],
  primary_image: { cloudinary_id: "/products/blue.png" },
  images: [IMG("i1", "/products/blue.png", { is_primary: true }), IMG("i2", "/products/blue2.png", { variant_id: "v1", sort_order: 1 }), IMG("i3", "/products/brown.png", { variant_id: "v3" }), IMG("d1", "/products/desc.png", { sort_order: 2 })],
  variants: [V("v1", "42", "University Blue", { color_hex: "#1E40AF" }), V("v2", "43", "University Blue"), V("v3", "42", "Mocha Brown"), V("v4", "43", "Mocha Brown", { is_active: false })],
  description_image_urls: ["/products/desc.png"],
};

describe("dbProductToItem", () => {
  const item = dbProductToItem(P as never);

  it("groups a narrow category under its parent, keeping the narrow one as the sub-category when none is set", () => {
    const leaf = dbProductToItem({ ...P, sub_category: null, category: { name: "Air Fryers", slug: "air-fryers", parent: { name: "Appliances", slug: "appliances" } } } as never);
    expect(leaf.category).toBe("Appliances");
    expect(leaf.subCategory).toBe("Air Fryers");
    expect(item.category).toBe("Fashion"); // no parent: it is the top level itself
  });

  it("carries the basics, with the slug as the storefront's id", () => {
    expect(item).toMatchObject({ id: "air-jordan-1", brand: "Air Jordan", sku: "AJ1", title: "Air Jordan 1", category: "Fashion", subCategory: "Sneakers", hasTransparentBg: true, description: "Long", shortDescription: "Short", tags: ["popular"] });
  });
  it("formats money from kobo: ₦ text, a naira number, and the was-price", () => {
    expect(item.price).toBe("₦450,000");
    expect(item.priceNum).toBe(450000);
    expect(item.originalPrice).toBe("₦520,000");
  });
  it("only shows a was-price when it is higher", () => {
    expect(dbProductToItem({ ...P, compare_at_price: null } as never).originalPrice).toBeUndefined();
    expect(dbProductToItem({ ...P, compare_at_price: 100 } as never).originalPrice).toBeUndefined();
  });
  it("gives a badge for a sale or best seller", () => {
    expect(item.badge).toBe("SALE");
    expect(dbProductToItem({ ...P, badges: ["bestseller"] } as never).badge).toBe("BESTSELLER");
    expect(dbProductToItem({ ...P, badges: [] } as never).badge).toBeUndefined();
  });
  it("lists each size once, and skips variants that are switched off", () => {
    expect(item.sizes).toEqual(["42", "43"]);
  });
  it("groups images by colour, main first, falling back to the product's picture", () => {
    expect(item.images.map((c) => c.label)).toEqual(["University Blue", "Mocha Brown"]);
    expect(item.images[0]).toMatchObject({ color: "university-blue", main: "/products/blue2.png", thumbnails: ["/products/blue2.png"] });
    expect(item.images[1]!.thumbnails).toEqual(["/products/brown.png"]);
    const noneAttached = dbProductToItem({ ...P, primary_image: { cloudinary_id: "/products/x.png" }, images: [IMG("i1", "/products/x.png", { is_primary: true })] } as never);
    expect(noneAttached.images[0]!.main).toBe("/products/x.png");
  });
  it("uses the primary image as the card picture", () => {
    expect(item.image).toBe("/products/blue.png");
  });
  it("copes with a product that has no variants, images or category", () => {
    const bare = dbProductToItem({ ...P, variants: [], images: [], primary_image: null, category: null, brand: null, sub_category: null, average_rating: null, review_count: 0, tags: null, description: null, short_description: null } as never);
    expect(bare.sizes).toEqual(["Standard"]);
    expect(bare.images).toEqual([{ color: "default", label: "Default", main: "/products/placeholder.svg", thumbnails: ["/products/placeholder.svg"] }]);
    expect(bare).toMatchObject({ category: "Other", brand: "GTS", subCategory: "", rating: 0, description: "", tags: [] });
  });
  it("turns a bare Cloudinary id into a delivery URL", () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo";
    const c = dbProductToItem({ ...P, primary_image: { cloudinary_id: "gts/products/a" }, images: [IMG("i1", "gts/products/a", { is_primary: true })] } as never);
    expect(c.image).toBe("https://res.cloudinary.com/demo/image/upload/gts/products/a");
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  });
  it("never keeps a script URL", () => {
    const bad = dbProductToItem({ ...P, primary_image: { cloudinary_id: "javascript:alert(1)" } } as never);
    expect(bad.image).toBe("/products/placeholder.svg");
  });
});

describe("compactCount", () => {
  it("shortens review counts like the storefront shows them", () => {
    expect([compactCount(0), compactCount(56), compactCount(999), compactCount(3200), compactCount(12500)]).toEqual(["0", "56", "999", "3.2k", "12.5k"]);
  });
});
