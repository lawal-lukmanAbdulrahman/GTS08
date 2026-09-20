import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCartSessionId, pushCart, mergeCart, linesToCartItems, fetchWishlistSlugs, saveWishlistSlug, removeWishlistSlug, unionCart } from "../app/(storefront)/_lib/server-sync";

const PRODUCT = { id: "oxford-shirt", title: "Oxford Shirt", images: [{ label: "Light Blue", color: "blue" }], sizes: ["S", "M"] } as never;
const item = (over: Record<string, unknown> = {}) => ({ product: PRODUCT, size: "M", color: "Light Blue", quantity: 2, ...over }) as never;
const line = (over: Record<string, unknown> = {}) => ({ variant_id: "v1", product_slug: "oxford-shirt", name: "Oxford Shirt", size: "M", color: "Light Blue", quantity: 2, ...over });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("getCartSessionId", () => {
  it("makes a random uuid once and keeps it", () => {
    const a = getCartSessionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getCartSessionId()).toBe(a);
  });
  it("replaces a stored value that isn't a uuid", () => {
    localStorage.setItem("gts_cart_session", "not-a-uuid");
    expect(getCartSessionId()).not.toBe("not-a-uuid");
  });
});

describe("pushCart", () => {
  it("sends only product, size, colour and quantity, never a price", async () => {
    fetchMock.mockResolvedValue(json({ data: { lines: [] } }));
    expect(await pushCart("sess", [item()])).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/sess");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ items: [{ product_slug: "oxford-shirt", size: "M", color: "Light Blue", quantity: 2 }] });
  });
  it("reports failure without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await pushCart("sess", [item()])).toBe(false);
    fetchMock.mockResolvedValue(json({ error: "x" }, 500));
    expect(await pushCart("sess", [item()])).toBe(false);
  });
});

describe("mergeCart", () => {
  it("merges the browser's cart into the account's, with the sign-in token", async () => {
    fetchMock.mockResolvedValue(json({ data: { session_id: "acct", lines: [line()] } }));
    const out = await mergeCart("sess", "tok");
    expect(out).toEqual({ sessionId: "acct", lines: [expect.objectContaining({ product_slug: "oxford-shirt" })] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/cart/merge");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ session_id: "sess" });
  });
  it("returns null when it can't", async () => {
    fetchMock.mockResolvedValue(json({ error: "x" }, 401));
    expect(await mergeCart("sess", "tok")).toBeNull();
    fetchMock.mockRejectedValue(new Error("x"));
    expect(await mergeCart("sess", "tok")).toBeNull();
  });
});

describe("linesToCartItems", () => {
  const catalogue = [PRODUCT];
  it("turns server lines back into cart items using the storefront's own product", () => {
    expect(linesToCartItems([line()], catalogue)).toEqual([{ product: PRODUCT, size: "M", color: "Light Blue", quantity: 2 }]);
  });
  it("uses the product's own colour name when the server's is a longer or different form", () => {
    expect(linesToCartItems([line({ color: "Light Blue Denim" })], catalogue)[0]!.color).toBe("Light Blue");
  });
  it("skips products the storefront doesn't have", () => {
    expect(linesToCartItems([line({ product_slug: "ghost" })], catalogue)).toEqual([]);
  });
  it("gives a plain default when a variant has no size or colour", () => {
    const [i] = linesToCartItems([line({ size: null, color: null })], catalogue);
    expect(i!.size).toBe("S");
    expect(i!.color).toBe("Light Blue");
  });
});

describe("unionCart", () => {
  it("takes the server's version of any product it knows and keeps local items it doesn't", () => {
    const other = { id: "sample-only", title: "Sample", images: [], sizes: [] } as never;
    const merged = unionCart([item({ size: "S", quantity: 5 }), { product: other, size: "M", color: "x", quantity: 1 } as never], [item({ quantity: 2 })]);
    expect(merged.map((m) => [m.product.id, m.size, m.quantity])).toEqual([["oxford-shirt", "M", 2], ["sample-only", "M", 1]]);
  });
});

describe("wishlist calls", () => {
  it("lists saved product slugs for the signed-in user", async () => {
    fetchMock.mockResolvedValue(json({ data: [{ slug: "a" }, { slug: "b" }] }));
    expect(await fetchWishlistSlugs("tok")).toEqual(["a", "b"]);
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe("Bearer tok");
  });
  it("saves and removes by slug", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }));
    expect(await saveWishlistSlug("tok", "a")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ product_slug: "a" });
    expect(await removeWishlistSlug("tok", "a")).toBe(true);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/v1/wishlist/a");
    expect(fetchMock.mock.calls[1]![1].method).toBe("DELETE");
  });
  it("returns null or false rather than throwing when the server is down", async () => {
    fetchMock.mockRejectedValue(new Error("x"));
    expect(await fetchWishlistSlugs("tok")).toBeNull();
    expect(await saveWishlistSlug("tok", "a")).toBe(false);
    expect(await removeWishlistSlug("tok", "a")).toBe(false);
  });
});
