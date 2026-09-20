// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
// next/font only exists inside the Next build; stand-ins are enough to read the layout's metadata.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "--font-x", className: "x" });
  return { Bricolage_Grotesque: font, DM_Sans: font, IBM_Plex_Mono: font, Playfair_Display: font };
});
vi.mock("next/font/local", () => ({ default: () => ({ variable: "--font-x", className: "x" }) }));
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

import { metadata as rootMetadata } from "../app/layout";
import { metadata as cart } from "../app/(storefront)/cart/layout";
import { metadata as checkout } from "../app/(storefront)/checkout/layout";
import { metadata as search } from "../app/(storefront)/search/layout";
import { metadata as track } from "../app/(storefront)/track/layout";
import { metadata as wishlist } from "../app/(storefront)/wishlist/layout";
import { metadata as account } from "../app/(storefront)/account/layout";
import { generateMetadata as productMeta } from "../app/(storefront)/product/[slug]/layout";
import { generateMetadata as shopMeta } from "../app/(storefront)/shop/[slug]/layout";

const titleOf = (m: { title?: unknown }) => (typeof m.title === "string" ? m.title : JSON.stringify(m.title));

describe("the site never shows another product's name as its title", () => {
  it("has a GTS default title and template, and no leftover template text", () => {
    const t = rootMetadata.title as { default: string; template: string };
    expect(t.default).toMatch(/^GTS/);
    expect(t.template).toBe("%s | GTS");
    expect(JSON.stringify(rootMetadata)).not.toMatch(/aura|vacuum/i);
  });

  it.each([["cart", cart, "Cart"], ["checkout", checkout, "Checkout"], ["search", search, "Search"], ["track", track, "Track your order"], ["wishlist", wishlist, "Wishlist"], ["account", account, "My account"]])("%s has its own title", (_n, m, title) => {
    expect(titleOf(m)).toBe(title);
  });

  it("private pages are kept out of search engines", () => {
    for (const m of [cart, checkout, track, wishlist, account]) expect((m as { robots?: { index?: boolean } }).robots?.index).toBe(false);
  });
});

describe("product and category pages are titled from the catalogue", () => {
  beforeEach(() => db.reset());
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("uses the product's name and description", async () => {
    db.results.products = { data: { name: "Samsung French Door Fridge", short_description: "Bespoke 4-door fridge" }, error: null };
    const m = await productMeta(ctx("samsung-fridge"));
    expect(titleOf(m)).toBe("Samsung French Door Fridge");
    expect(m.description).toBe("Bespoke 4-door fridge");
  });

  it("only looks for active products, and by a valid slug", async () => {
    db.results.products = { data: null, error: null };
    await productMeta(ctx("samsung-fridge"));
    const eqs = db.calls.products!.filter((c) => c.method === "eq").map((c) => c.args.join("="));
    expect(eqs).toContain("status=active");
  });

  it("falls back to a plain title for a missing product, without querying for a junk slug", async () => {
    db.results.products = { data: null, error: null };
    expect(titleOf(await productMeta(ctx("nope")))).toBe("Product not found");
    db.reset();
    await productMeta(ctx("x') or 1=1--"));
    expect(db.touched).toHaveLength(0);
  });

  it("copes with a database failure by using a generic title", async () => {
    db.results.products = { data: null, error: { message: "down" } };
    expect(titleOf(await productMeta(ctx("samsung-fridge")))).toBe("Shop");
  });

  it("titles a category page from the category name", async () => {
    db.results.categories = { data: { name: "Appliances" }, error: null };
    expect(titleOf(await shopMeta(ctx("appliances")))).toBe("Appliances");
  });
});
