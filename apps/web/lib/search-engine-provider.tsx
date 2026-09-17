"use client";

/**
 * Search Engine Provider
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side singleton React context that initializes the ProductSearchEngine
 * with the product catalog. Provides instant search/autocomplete to all
 * consuming components with ZERO network round-trips.
 *
 * Flow:
 *   1. Products loaded (static + DB) → buildIndex() once
 *   2. Components call search()/autocomplete() → pure in-memory, ~1.5ms avg
 *   3. No API calls, no debounce needed for autocomplete
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import {
  ProductSearchEngine,
  type SearchableProduct,
  type SearchResult,
  type SearchOptions,
} from "./search-engine";

import type { ProductItem } from "../app/(storefront)/_data/products";

// ─── Context Types ───────────────────────────────────────────────────────────

interface SearchEngineContextValue {
  /** Whether the index has been built */
  ready: boolean;
  /** Total indexed products */
  indexSize: number;
  /** Run a full search query — returns scored results with IDs */
  search: (query: string, options?: SearchOptions) => SearchResult[];
  /** Get autocomplete suggestions for a prefix */
  autocomplete: (prefix: string, limit?: number) => string[];
  /** Look up a ProductItem by its ID (slug) after search */
  getProduct: (id: string) => ProductItem | undefined;
  /** Search and return full ProductItem objects (convenience) */
  searchProducts: (query: string, options?: SearchOptions) => ProductItem[];
}

const SearchEngineContext = createContext<SearchEngineContextValue>({
  ready: false,
  indexSize: 0,
  search: () => [],
  autocomplete: () => [],
  getProduct: () => undefined,
  searchProducts: () => [],
});

// ─── ProductItem → SearchableProduct Adapter ─────────────────────────────────

function toSearchable(p: ProductItem): SearchableProduct {
  // Extract color names from tags/title heuristically
  const colorHints: string[] = [];
  const colorWords = new Set([
    "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
    "white", "brown", "grey", "gray", "navy", "gold", "silver", "cream",
    "beige", "olive", "coral", "teal", "cyan", "maroon",
  ]);
  for (const word of p.title.toLowerCase().split(/\s+/)) {
    if (colorWords.has(word)) colorHints.push(word);
  }
  for (const tag of p.tags) {
    const lower = tag.toLowerCase();
    if (colorWords.has(lower)) colorHints.push(lower);
  }
  // Also extract from color option labels if available
  if (p.images && p.images.length > 0) {
    for (const img of p.images) {
      if (img.label) {
        const lower = img.label.toLowerCase();
        if (colorWords.has(lower) && !colorHints.includes(lower)) {
          colorHints.push(lower);
        }
      }
    }
  }

  return {
    id: p.id,
    name: p.title,
    brand: p.brand,
    category: p.category,
    subCategory: p.subCategory,
    tags: p.tags,
    colors: colorHints.length > 0 ? colorHints : undefined,
    description: p.description,
    price: p.priceNum,
    inStock: true, // Assume in-stock for display products
  };
}

// ─── Provider Component ──────────────────────────────────────────────────────

export function SearchEngineProvider({
  products,
  children,
}: {
  products: ProductItem[];
  children: ReactNode;
}) {
  const engineRef = useRef<ProductSearchEngine | null>(null);
  const productMapRef = useRef<Map<string, ProductItem>>(new Map());
  const [ready, setReady] = useState(false);
  const [indexSize, setIndexSize] = useState(0);

  // Build/rebuild index whenever products change
  useEffect(() => {
    const engine = new ProductSearchEngine();
    const searchable = products.map(toSearchable);

    // Build product lookup map
    const map = new Map<string, ProductItem>();
    for (const p of products) {
      map.set(p.id, p);
    }

    engine.buildIndex(searchable);

    engineRef.current = engine;
    productMapRef.current = map;
    setIndexSize(engine.size);
    setReady(true);
  }, [products]);

  const search = useCallback(
    (query: string, options?: SearchOptions): SearchResult[] => {
      if (!engineRef.current) return [];
      return engineRef.current.search(query, options);
    },
    []
  );

  const autocomplete = useCallback(
    (prefix: string, limit: number = 10): string[] => {
      if (!engineRef.current) return [];
      return engineRef.current.autocomplete(prefix, limit);
    },
    []
  );

  const getProduct = useCallback((id: string): ProductItem | undefined => {
    return productMapRef.current.get(id);
  }, []);

  const searchProducts = useCallback(
    (query: string, options?: SearchOptions): ProductItem[] => {
      if (!engineRef.current) return [];
      const results = engineRef.current.search(query, options);
      const items: ProductItem[] = [];
      for (const r of results) {
        const p = productMapRef.current.get(r.id);
        if (p) items.push(p);
      }
      return items;
    },
    []
  );

  return (
    <SearchEngineContext.Provider
      value={{ ready, indexSize, search, autocomplete, getProduct, searchProducts }}
    >
      {children}
    </SearchEngineContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSearchEngine() {
  return useContext(SearchEngineContext);
}
