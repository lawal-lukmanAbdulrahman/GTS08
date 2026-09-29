"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProductItem } from "../_data/products";
import { dbProductToItem, type ApiProduct } from "../_lib/catalogue";

interface CatalogueContextType {
  /** Every product on sale, from the database. Empty until the first answer arrives. */
  products: ProductItem[];
  loading: boolean;
  error: string | null;
  /** One product by its slug (case-insensitive, URL-encoding undone). No near matches: a wrong slug is "not found". */
  getProduct: (slug: string) => ProductItem | undefined;
}

const EMPTY: CatalogueContextType = { products: [], loading: false, error: null, getProduct: () => undefined };
const CatalogueContext = createContext<CatalogueContextType>(EMPTY);

/** The tab's cached copy of the catalogue. Cleared when the signed-in data set changes (demo sign-in, sign-out). */
export const CATALOGUE_CACHE_KEY = "gts_catalogue_v1";
const CACHE_KEY = CATALOGUE_CACHE_KEY;
const CACHE_TTL_MS = 10 * 60_000;
const CATALOGUE_URL = "/api/v1/products?limit=100";

function readCache(): ApiProduct[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: number; mode?: string; products?: ApiProduct[] };
    if (!Array.isArray(saved.products) || typeof saved.at !== "number" || Date.now() - saved.at >= CACHE_TTL_MS) {
      return null;
    }
    let isDemoMode = false;
    try {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("gts_customer_user") : null;
      isDemoMode =
        (typeof window !== "undefined" &&
          (localStorage.getItem("gts_demo_mode") === "true" ||
            document.cookie.includes("gts_demo_mode=true"))) ||
        (userStr ? JSON.parse(userStr)?.is_demo === true : false);
    } catch {
      // ignore
    }

    const expectedMode = isDemoMode ? "test" : "live";
    if (saved.mode && saved.mode !== expectedMode) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Only discard test items if we are in LIVE mode
    if (!isDemoMode) {
      const hasTestItems = saved.products.some((p) => (p as { is_test?: boolean }).is_test === true);
      if (hasTestItems) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
    }
    return saved.products;
  } catch {
    return null;
  }
}

/**
 * The storefront's one source of products: the database, through the public
 * products API. What was fetched last visit shows at once while a fresh copy
 * loads behind it; if the server can't be reached the last copy stays and an
 * error is reported. There is no built-in list to fall back to.
 */
export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogue = useCallback(async (isBackground = false) => {
    try {
      const res = await fetch(CATALOGUE_URL);
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.data)) throw new Error("bad response");
      const freshData = body.data as ApiProduct[];

      setApi((prev) => {
        // If IDs or items have changed (e.g. product deleted or archived), invalidate cache & update
        const prevIds = prev.map((p) => p.id).sort().join(",");
        const freshIds = freshData.map((p) => p.id).sort().join(",");
        if (prevIds !== freshIds) {
          try {
            sessionStorage.removeItem(CACHE_KEY);
          } catch {
            // ignore
          }
        }
        return freshData;
      });

      setError(null);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), mode: body.meta?.mode || "live", products: freshData }));
      } catch {
        // storage full or blocked: the list just isn't kept for next time
      }
    } catch {
      setError("We couldn't load the products just now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setApi(cached);
      setLoading(false);
    }

    void fetchCatalogue(Boolean(cached));

    // Live watcher: periodically poll every 15 seconds to catch deleted/archived items
    const interval = setInterval(() => {
      if (!cancelled) void fetchCatalogue(true);
    }, 15_000);

    // Refresh instantly when user switches back to this tab
    const handleFocus = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void fetchCatalogue(true);
      }
    };
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    // Listen for manual cache invalidation events (e.g. product deletion event)
    const handleInvalidation = () => {
      try {
        sessionStorage.removeItem(CACHE_KEY);
      } catch {
        // ignore
      }
      if (!cancelled) void fetchCatalogue(true);
    };
    window.addEventListener("gts_catalogue_invalidated", handleInvalidation);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("gts_catalogue_invalidated", handleInvalidation);
    };
  }, [fetchCatalogue]);

  const products = useMemo(() => api.map(dbProductToItem), [api]);
  const getProduct = useCallback(
    (slug: string) => {
      let wanted = slug;
      try {
        wanted = decodeURIComponent(slug);
      } catch {
        // a malformed escape: compare as given
      }
      wanted = wanted.toLowerCase();
      return products.find((p) => p.id.toLowerCase() === wanted);
    },
    [products]
  );

  const value = useMemo(() => ({ products, loading, error, getProduct }), [products, loading, error, getProduct]);
  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueContextType {
  return useContext(CatalogueContext);
}
