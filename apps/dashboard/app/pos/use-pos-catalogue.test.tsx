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
});
