"use client";

import { API_BASE } from "../../../lib/api-base";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProductItem } from "./data/products";
import { dbProductToItem, type ApiProduct } from "./data/catalogue";

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

const CACHE_KEY = "gts_catalogue_v1";
const CACHE_TTL_MS = 10 * 60_000;
const CATALOGUE_URL = `${API_BASE}/products?limit=100`;

function readCache(): ApiProduct[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: number; products?: ApiProduct[] };
    return Array.isArray(saved.products) && typeof saved.at === "number" && Date.now() - saved.at < CACHE_TTL_MS ? saved.products : null;
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

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setApi(cached);
      setLoading(false);
    }
    (async () => {
      try {
        const res = await fetch(CATALOGUE_URL);
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(body?.data)) throw new Error("bad response");
        setApi(body.data as ApiProduct[]);
        setError(null);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), products: body.data }));
        } catch {
          // storage full or blocked: the list just isn't kept for next time
        }
      } catch {
        if (!cancelled) setError("We couldn't load the products just now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
