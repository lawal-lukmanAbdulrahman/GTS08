"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall } from "../lib/staff-api";
import type { PosProduct } from "./pos-types";

export interface PosCategory {
  id: string;
  name: string;
  slug: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 30;
/** How long an answer for a filter is reused on screen while a fresh one is fetched. */
const CACHE_TTL_MS = 60_000;

interface CachedPage {
  at: number;
  products: PosProduct[];
  hasMore: boolean;
}

/**
 * What the till shows in its product grid: the catalogue as soon as it opens
 * (best sellers), narrowed by what the cashier types and the category they pick,
 * a page at a time. A slow answer for a search that has since changed is dropped.
 */
export function usePosCatalogue(query: string, category: string) {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const cache = useRef(new Map<string, CachedPage>());
  const nextPage = useRef(2);

  const buildPath = useCallback(
    (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);
      return `/pos/products/search?${params}`;
    },
    [query, category]
  );

  useEffect(() => {
    apiCall<PosCategory[]>("/pos/categories").then((r) => {
      if (r.ok) setCategories(r.data);
    });
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    const path = buildPath(1);
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    // Coming back to a filter used a moment ago: show what we had at once, refresh behind it.
    const seen = cache.current.get(path);
    if (seen && Date.now() - seen.at < CACHE_TTL_MS) {
      setProducts(seen.products);
      setHasMore(seen.hasMore);
      nextPage.current = 2;
    }

    const handle = setTimeout(async () => {
      const result = await apiCall<PosProduct[]>(path);
      if (id !== requestId.current) return;
      if (result.ok) {
        const more = (result.meta?.page ?? 1) < (result.meta?.pages ?? 1);
        cache.current.set(path, { at: Date.now(), products: result.data, hasMore: more });
        setProducts(result.data);
        setHasMore(more);
        nextPage.current = 2;
      } else {
        setProducts([]);
        setHasMore(false);
        setError(result.message);
      }
      setLoading(false);
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(handle);
  }, [buildPath, query]);

  const loadMore = useCallback(async () => {
    const id = requestId.current;
    setLoadingMore(true);
    const result = await apiCall<PosProduct[]>(buildPath(nextPage.current));
    if (id !== requestId.current) return;
    if (result.ok) {
      setProducts((prev) => [...prev, ...result.data.filter((p) => !prev.some((q) => q.id === p.id))]);
      setHasMore((result.meta?.page ?? 1) < (result.meta?.pages ?? 1));
      nextPage.current += 1;
    } else {
      setError(result.message);
    }
    setLoadingMore(false);
  }, [buildPath]);

  return { products, categories, loading, loadingMore, hasMore, error, loadMore };
}
