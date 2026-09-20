import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockApiCall = vi.fn();
vi.mock("../lib/staff-api", () => ({ apiCall: (...a: unknown[]) => mockApiCall(...a) }));

import { usePosCatalogue } from "./use-pos-catalogue";

const product = (id: string) => ({ id, name: `P${id}` });
const page = (ids: string[], p: number, pages: number) => ({
  ok: true,
  status: 200,
  data: ids.map(product),
  meta: { total: 99, page: p, limit: 30, pages },
});

function route(handlers: { search?: (path: string) => unknown; categories?: unknown }) {
  mockApiCall.mockImplementation(async (path: string) => {
    if (path.startsWith("/pos/categories")) return handlers.categories ?? { ok: true, status: 200, data: [{ id: "c", name: "Shirts", slug: "shirts" }] };
    return handlers.search?.(path) ?? page(["1"], 1, 1);
  });
}
const searchPaths = () => mockApiCall.mock.calls.map((c) => c[0] as string).filter((p) => p.startsWith("/pos/products/search"));

describe("usePosCatalogue", () => {
  beforeEach(() => {
    mockApiCall.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("loads products and categories on open, with nothing typed", async () => {
    route({});
    const { result } = renderHook(() => usePosCatalogue("", "all"));
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.categories).toEqual([{ id: "c", name: "Shirts", slug: "shirts" }]);
    expect(searchPaths()[0]).not.toContain("q=");
    expect(result.current.hasMore).toBe(false);
  });

  it("searches after a 300ms pause, sending the text and category", async () => {
    route({});
    const { result, rerender } = renderHook(({ q, c }) => usePosCatalogue(q, c), { initialProps: { q: "", c: "all" } });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    mockApiCall.mockClear();
    rerender({ q: "shirt", c: "shirts" });
    expect(searchPaths()).toHaveLength(0); // still debouncing
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await waitFor(() => expect(searchPaths()).toHaveLength(1));
    expect(searchPaths()[0]).toContain("q=shirt");
    expect(searchPaths()[0]).toContain("category=shirts");
  });

  it("offers more when there are more pages, and appends the next page", async () => {
    route({ search: (path) => (path.includes("page=2") ? page(["3", "4"], 2, 2) : page(["1", "2"], 1, 2)) });
    const { result } = renderHook(() => usePosCatalogue("", "all"));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.products.map((p) => p.id)).toEqual(["1", "2", "3", "4"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores a slow answer for a search that's since changed", async () => {
    let resolveSlow!: (v: unknown) => void;
    const slow = new Promise((r) => (resolveSlow = r));
    mockApiCall.mockImplementation(async (path: string) => {
      if (path.startsWith("/pos/categories")) return { ok: true, status: 200, data: [] };
      if (path.includes("q=old")) return slow;
      return page(["new"], 1, 1);
    });
    const { result, rerender } = renderHook(({ q }) => usePosCatalogue(q, "all"), { initialProps: { q: "old" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    rerender({ q: "new" });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["new"]));
    await act(async () => { resolveSlow(page(["old"], 1, 1)); });
    expect(result.current.products.map((p) => p.id)).toEqual(["new"]);
  });

  it("reports a failed load and keeps the screen usable", async () => {
    route({ search: () => ({ ok: false, status: 500, message: "Product search failed." }) });
    const { result } = renderHook(() => usePosCatalogue("", "all"));
    await waitFor(() => expect(result.current.error).toBe("Product search failed."));
    expect(result.current.products).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("carries on without categories if they fail to load", async () => {
    route({ categories: { ok: false, status: 500, message: "nope" } });
    const { result } = renderHook(() => usePosCatalogue("", "all"));
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.categories).toEqual([]);
  });

  it("shows a category's products instantly when returning to it, then refreshes quietly", async () => {
    let resolveSecond!: (v: unknown) => void;
    let calls = 0;
    mockApiCall.mockImplementation(async (path: string) => {
      if (path.startsWith("/pos/categories")) return { ok: true, status: 200, data: [] };
      calls += 1;
      if (path.includes("category=b")) return page(["b1"], 1, 1);
      if (calls <= 2) return page(["a1"], 1, 1);
      return new Promise((r) => (resolveSecond = r)); // the refresh of "all" stays pending
    });
    const { result, rerender } = renderHook(({ c }) => usePosCatalogue("", c), { initialProps: { c: "all" } });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["a1"]));
    rerender({ c: "b" });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["b1"]));
    rerender({ c: "all" });
    // the earlier answer for "all" is on screen straight away, without waiting for the network
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["a1"]));
    expect(result.current.loading).toBe(true); // ...while it refreshes in the background
    await act(async () => { resolveSecond(page(["a1", "a2"], 1, 1)); });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["a1", "a2"]));
    expect(result.current.loading).toBe(false);
  });

  it("doesn't reuse an old answer after it has gone stale", async () => {
    vi.setSystemTime(new Date("2026-09-20T10:00:00Z"));
    mockApiCall.mockImplementation(async (path: string) => (path.startsWith("/pos/categories") ? { ok: true, status: 200, data: [] } : path.includes("category=b") ? page(["b1"], 1, 1) : page(["a1"], 1, 1)));
    const { result, rerender } = renderHook(({ c }) => usePosCatalogue("", c), { initialProps: { c: "all" } });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    rerender({ c: "b" });
    await waitFor(() => expect(result.current.products[0]?.id).toBe("b1"));
    vi.setSystemTime(new Date("2026-09-20T10:05:00Z")); // 5 minutes later
    let release!: (v: unknown) => void;
    mockApiCall.mockImplementation(async (path: string) => (path.startsWith("/pos/categories") ? { ok: true, status: 200, data: [] } : new Promise((r) => (release = r))));
    rerender({ c: "all" });
    await waitFor(() => expect(release).toBeTypeOf("function")); // the refresh has started
    expect(result.current.products.map((p) => p.id)).not.toEqual(["a1"]); // the 5-minute-old answer is not shown
    release(page(["a9"], 1, 1));
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(["a9"]));
  });

  describe("live refresh (stock changes while the till is open)", () => {
    const stocked = (id: string, available: number) => ({ id, name: `P${id}`, variants: [{ id: `v${id}`, available }] });
    const withStock = (items: Array<[string, number]>) => ({ ok: true, status: 200, data: items.map(([id, a]) => stocked(id, a)), meta: { total: 9, page: 1, limit: 30, pages: 1 } });

    it("refreshes stock quietly every 15 seconds, without the grid flashing to a loading state", async () => {
      let stock = 9;
      route({ search: () => withStock([["1", stock], ["2", 4]]) });
      const { result } = renderHook(() => usePosCatalogue("", "all"));
      await waitFor(() => expect(result.current.products).toHaveLength(2));
      stock = 1;
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      await waitFor(() => expect((result.current.products[0] as any).variants[0].available).toBe(1));
      expect(result.current.loading).toBe(false);
      expect(result.current.products.map((p) => p.id)).toEqual(["1", "2"]);
    });

    it("keeps the order and any extra pages already loaded while updating stock", async () => {
      route({ search: (path) => (path.includes("page=2") ? withStock([["3", 7]]) : { ...withStock([["1", 5], ["2", 5]]), meta: { total: 3, page: 1, limit: 30, pages: 2 } }) });
      const { result } = renderHook(() => usePosCatalogue("", "all"));
      await waitFor(() => expect(result.current.hasMore).toBe(true));
      await act(async () => { await result.current.loadMore(); });
      route({ search: () => ({ ...withStock([["2", 0], ["1", 5]]), meta: { total: 3, page: 1, limit: 30, pages: 2 } }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      await waitFor(() => expect((result.current.products.find((p) => p.id === "2") as any).variants[0].available).toBe(0));
      expect(result.current.products.map((p) => p.id)).toEqual(["1", "2", "3"]);
    });

    it("refresh() pulls fresh stock straight away, e.g. after a sale", async () => {
      let stock = 9;
      route({ search: () => withStock([["1", stock]]) });
      const { result } = renderHook(() => usePosCatalogue("", "all"));
      await waitFor(() => expect(result.current.products).toHaveLength(1));
      stock = 4;
      await act(async () => { await result.current.refresh(); });
      expect((result.current.products[0] as any).variants[0].available).toBe(4);
    });

    it("leaves the grid as it was if a refresh fails", async () => {
      route({ search: () => withStock([["1", 5]]) });
      const { result } = renderHook(() => usePosCatalogue("", "all"));
      await waitFor(() => expect(result.current.products).toHaveLength(1));
      route({ search: () => ({ ok: false, status: 500, message: "down" }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      expect(result.current.products).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it("doesn't refresh while the tab is hidden", async () => {
      route({ search: () => withStock([["1", 5]]) });
      renderHook(() => usePosCatalogue("", "all"));
      await waitFor(() => expect(searchPaths()).toHaveLength(1));
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
      expect(searchPaths()).toHaveLength(1);
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    });
  });
});
