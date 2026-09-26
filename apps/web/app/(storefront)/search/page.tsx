"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProductCard } from "../_components/ui/product-card";
import type { ProductItem } from "../_data/products";
import { ALL_BRAND_KEYS } from "../_data/brands";
import { useCatalogue } from "../_components/catalogue-context";
import { ProductSearchEngine, type SearchableProduct } from "../../../lib/search-engine";
import { dbProductToItem, type ApiProduct } from "../_lib/catalogue";
import { getCartSessionId } from "../_lib/server-sync";

const MEGA_CATEGORY_NAMES = [
  "Appliances",
  "Phones & Tablets",
  "Health & Beauty",
  "Home & Office",
  "Electronics",
  "Fashion",
  "Supermarket",
  "Computing",
  "Baby Products",
  "Gaming",
];

const ALL_BRANDS = ALL_BRAND_KEYS;

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest" },
];

const MAX_PRICE = 3000000;
const MIN_PRICE = 0;

// ─── Price Range Slider with Editable Inputs ─────────────────────────────────
function PriceSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<null | "low" | "high">(null);

  const [lowStr, setLowStr] = useState(value[0].toString());
  const [highStr, setHighStr] = useState(value[1].toString());

  useEffect(() => {
    setLowStr(value[0].toString());
    setHighStr(value[1].toString());
  }, [value]);

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  const valueFromEvent = (e: MouseEvent | TouchEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]!.clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round((min + ratio * (max - min)) / 1000) * 1000;
  };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const v = valueFromEvent(e);
      if (dragging.current === "low") {
        onChange([Math.min(v, value[1] - 1000), value[1]]);
      } else {
        onChange([value[0], Math.max(v, value[0] + 1000)]);
      }
    };
    const up = () => {
      dragging.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  });

  const commitLow = () => {
    let parsed = parseInt(lowStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsed)) parsed = min;
    parsed = Math.max(min, Math.min(parsed, value[1] - 1000));
    onChange([parsed, value[1]]);
  };

  const commitHigh = () => {
    let parsed = parseInt(highStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsed)) parsed = max;
    parsed = Math.min(max, Math.max(parsed, value[0] + 1000));
    onChange([value[0], parsed]);
  };

  return (
    <div className="px-1 pt-2 pb-1 select-none">
      {/* Track */}
      <div ref={trackRef} className="relative h-1.5 rounded-full bg-[#E8E6E0] cursor-pointer">
        {/* Fill */}
        <div
          className="absolute h-full rounded-full bg-[#010101]"
          style={{ left: `${pct(value[0])}%`, right: `${100 - pct(value[1])}%` }}
        />
        {/* Low thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#010101] shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
          style={{ left: `${pct(value[0])}%` }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = "low";
          }}
          onTouchStart={() => {
            dragging.current = "low";
          }}
        />
        {/* High thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#010101] border-2 border-[#010101] shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
          style={{ left: `${pct(value[1])}%` }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = "high";
          }}
          onTouchStart={() => {
            dragging.current = "high";
          }}
        />
      </div>

      {/* Editable Price Boxes */}
      <div className="flex items-center justify-between gap-1.5 mt-3">
        <div className="flex items-center gap-1 bg-[#F2F0EA] px-2 py-1 rounded-lg border border-transparent focus-within:border-[#010101] transition-all">
          <span className="text-xs font-bold text-[#010101] font-sans">₦</span>
          <input
            type="text"
            value={lowStr}
            onChange={(e) => setLowStr(e.target.value)}
            onBlur={commitLow}
            onKeyDown={(e) => e.key === "Enter" && commitLow()}
            className="w-16 text-xs font-bold text-[#010101] bg-transparent outline-none font-sans"
          />
        </div>
        <span className="text-xs text-[#A4A4A4] font-medium font-sans">–</span>
        <div className="flex items-center gap-1 bg-[#F2F0EA] px-2 py-1 rounded-lg border border-transparent focus-within:border-[#010101] transition-all">
          <span className="text-xs font-bold text-[#010101] font-sans">₦</span>
          <input
            type="text"
            value={highStr}
            onChange={(e) => setHighStr(e.target.value)}
            onBlur={commitHigh}
            onKeyDown={(e) => e.key === "Enter" && commitHigh()}
            className="w-16 text-xs font-bold text-[#010101] bg-transparent outline-none font-sans"
          />
        </div>
      </div>
    </div>
  );
}

// ─── ProductItem → SearchableProduct Adapter ─────────────────────────────────
const COLOR_WORDS = new Set([
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
  "white", "brown", "grey", "gray", "navy", "gold", "silver", "cream",
  "beige", "olive", "coral", "teal", "cyan", "maroon",
]);

function toSearchable(p: ProductItem): SearchableProduct {
  const colors: string[] = [];
  for (const word of p.title.toLowerCase().split(/\s+/)) {
    if (COLOR_WORDS.has(word)) colors.push(word);
  }
  for (const tag of p.tags) {
    const lower = tag.toLowerCase();
    if (COLOR_WORDS.has(lower) && !colors.includes(lower)) colors.push(lower);
  }
  return {
    id: p.id,
    name: p.title,
    brand: p.brand,
    category: p.category,
    subCategory: p.subCategory,
    tags: p.tags,
    colors: colors.length > 0 ? colors : undefined,
    description: p.description,
    price: p.priceNum,
    inStock: true,
  };
}

// ─── Sort Dropdown ─────────────────────────────────────────────────────────────
function SortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const label = SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Sort";
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-3.5 py-2 rounded-full transition-colors font-sans cursor-pointer"
      >
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-48 animate-in fade-in duration-150">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors font-sans cursor-pointer ${
                value === opt.value ? "bg-[#EDCF5D] text-[#010101]" : "text-[#010101] hover:bg-[#F2F0EA]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Section wrapper ───────────────────────────────────────────────────
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full mb-1.5 select-none cursor-pointer"
      >
        <span className="text-[11px] font-bold text-[#A4A4A4] uppercase tracking-widest font-sans">{title}</span>
        <svg className={`w-3.5 h-3.5 text-[#A4A4A4] transition-transform ${open ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ─── Active Filter Chips Horizontal Scroll Container ──────────────────────
function ActiveFilterChips({ filters }: { filters: { label: string; remove: () => void }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [filters]);

  if (filters.length === 0) return null;

  return (
    <div className="relative flex-1 min-w-0 flex items-center overflow-hidden">
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10" />
      )}

      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {filters.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#010101] text-white text-xs font-semibold shrink-0 font-sans shadow-2xs"
          >
            <span>{f.label}</span>
            <button
              type="button"
              onClick={f.remove}
              className="hover:text-[#EDCF5D] transition-colors ml-0.5 text-xs font-bold cursor-pointer"
              aria-label={`Remove filter ${f.label}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10" />
      )}
    </div>
  );
}

// ─── Main Inner Page Component ────────────────────────────────────────────────
function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const initialCat = searchParams.get("category") ?? "All";
  const initialBrand = searchParams.get("brand") ?? "";
  const initialFilter = (searchParams.get("filter") ?? searchParams.get("section") ?? "").trim();

  // Products come from the database through the shared catalogue.
  const { products: allCatalogProducts, loading: loadingDb } = useCatalogue();

  // Storefront section filter state (trending, bestselling, new-arrivals, for-you, deals)
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [sectionProducts, setSectionProducts] = useState<ProductItem[]>([]);
  const [loadingSection, setLoadingSection] = useState(false);

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  // Fetch section data when activeFilter is an API-driven algorithmic section
  useEffect(() => {
    if (!activeFilter) {
      setSectionProducts([]);
      return;
    }

    let isMounted = true;

    async function loadSectionItems() {
      const norm = activeFilter.toLowerCase();
      if (norm === "trending") {
        setLoadingSection(true);
        try {
          const res = await fetch("/api/v1/storefront/trending?limit=100");
          if (res.ok) {
            const json = await res.json();
            if (isMounted && Array.isArray(json.data)) {
              setSectionProducts(json.data.map((p: ApiProduct) => dbProductToItem(p)));
            }
          }
        } catch {
          // fallback to catalog
        } finally {
          if (isMounted) setLoadingSection(false);
        }
      } else if (norm === "bestselling") {
        setLoadingSection(true);
        try {
          const res = await fetch("/api/v1/storefront/bestselling?limit=100");
          if (res.ok) {
            const json = await res.json();
            if (isMounted && Array.isArray(json.data)) {
              setSectionProducts(json.data.map((p: ApiProduct) => dbProductToItem(p)));
            }
          }
        } catch {
          // fallback to catalog
        } finally {
          if (isMounted) setLoadingSection(false);
        }
      } else if (norm === "for-you") {
        setLoadingSection(true);
        try {
          const sessionId = getCartSessionId();
          const res = await fetch(`/api/v1/storefront/for-you?limit=100&session_id=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const json = await res.json();
            if (isMounted && Array.isArray(json.data)) {
              setSectionProducts(json.data.map((p: ApiProduct) => dbProductToItem(p)));
            }
          }
        } catch {
          // fallback to catalog
        } finally {
          if (isMounted) setLoadingSection(false);
        }
      } else {
        setSectionProducts([]);
      }
    }

    void loadSectionItems();
    return () => {
      isMounted = false;
    };
  }, [activeFilter]);

  // Base products computed from active section filter
  const baseProducts = useMemo(() => {
    const norm = activeFilter.toLowerCase();

    if (norm === "new-arrivals") {
      return [...allCatalogProducts].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    if (norm === "deals" || norm === "crazy-deals") {
      return [...allCatalogProducts]
        .filter(
          (p) =>
            (p.rawCompareAtPrice && p.rawCompareAtPrice > (p.rawBasePrice ?? 0)) ||
            Boolean(p.originalPrice) ||
            p.badge === "SALE"
        )
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
    }

    if (sectionProducts.length > 0 && (norm === "trending" || norm === "bestselling" || norm === "for-you")) {
      return sectionProducts;
    }

    if (norm === "bestselling") {
      return [...allCatalogProducts].sort((a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0));
    }

    if (norm === "trending") {
      return [...allCatalogProducts].sort((a, b) => {
        const scoreB = (Number(b.rating) || 0) * 10 + (Number(b.reviews) || 0);
        const scoreA = (Number(a.rating) || 0) * 10 + (Number(a.reviews) || 0);
        return scoreB - scoreA;
      });
    }

    if (norm === "for-you") {
      return [...allCatalogProducts].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return allCatalogProducts;
  }, [allCatalogProducts, activeFilter, sectionProducts]);

  const CATEGORIES = useMemo(
    () => ["All", ...Array.from(new Set([...MEGA_CATEGORY_NAMES, ...baseProducts.map((p) => p.category)]))],
    [baseProducts]
  );
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const [minDiscount, setMinDiscount] = useState<number | null>(null);
  const [activeBrands, setActiveBrands] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [brandSearch, setBrandSearch] = useState("");
  const [activeSizes, setActiveSizes] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync when searchParams change
  useEffect(() => {
    if (initialCat) setActiveCategory(initialCat);
    if (initialBrand) setActiveBrands([initialBrand]);
  }, [initialCat, initialBrand]);

  const toggleBrand = (b: string) =>
    setActiveBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const toggleSize = (s: string) =>
    setActiveSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // ── Search Engine: build synchronously so results are ready on FIRST render ─
  const { engine, productMap } = useMemo(() => {
    const e = new ProductSearchEngine();
    e.buildIndex(baseProducts.map(toSearchable));
    const map = new Map<string, ProductItem>();
    for (const p of baseProducts) map.set(p.id, p);
    return { engine: e, productMap: map };
  }, [baseProducts]);

  // ── Step 1: Text Query Matching via Search Engine ─────────────────────────
  const queryMatchedProducts = useMemo(() => {
    if (!query) return baseProducts;

    const results = engine.search(query, { limit: 200 });
    const matched: ProductItem[] = [];
    for (const r of results) {
      const p = productMap.get(r.id);
      if (p) matched.push(p);
    }
    return matched.length > 0 ? matched : baseProducts;
  }, [query, baseProducts, engine, productMap]);

  // Log search query in analytics for Trending and For-You personalization
  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => {
      void fetch("/api/v1/analytics/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          results_count: queryMatchedProducts.length,
        }),
      }).catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, [query, queryMatchedProducts.length]);

  // ── Step 2: Dynamic Category & Brand Counts (Derived directly from Query Matches!) ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: queryMatchedProducts.length };
    for (const p of queryMatchedProducts) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [queryMatchedProducts]);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of queryMatchedProducts) {
      if (p.brand) {
        counts[p.brand.toLowerCase()] = (counts[p.brand.toLowerCase()] || 0) + 1;
      }
    }
    return counts;
  }, [queryMatchedProducts]);

  const allAvailableSizes = useMemo(() => {
    const sizes = new Set<string>();
    for (const p of baseProducts) {
      for (const s of p.sizes || []) sizes.add(s);
    }
    return Array.from(sizes);
  }, [baseProducts]);

  const allAvailableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of baseProducts) {
      for (const t of p.tags || []) tags.add(t);
    }
    return Array.from(tags);
  }, [baseProducts]);

  // ── Step 3: Secondary Filters Applied on Top of Query Matches ─────────────
  const results = useMemo(() => {
    const list = queryMatchedProducts.filter((p) => {
      // Category filter
      if (activeCategory !== "All" && p.category !== activeCategory) return false;

      // Price filter
      if (p.priceNum < priceRange[0] || p.priceNum > priceRange[1]) return false;

      // Discount filter
      if (minDiscount !== null) {
        const orig = p.originalPrice ? parseInt(p.originalPrice.replace(/[^0-9]/g, ""), 10) : p.priceNum;
        const discountPct = orig > p.priceNum ? Math.round(((orig - p.priceNum) / orig) * 100) : 0;
        if (discountPct < minDiscount) return false;
      }

      // Brand filter
      if (activeBrands.length > 0 && !activeBrands.some((b) => p.brand.toLowerCase() === b.toLowerCase())) {
        return false;
      }

      // Size filter
      if (activeSizes.length > 0 && !activeSizes.some((s) => p.sizes.includes(s))) return false;

      // Tag filter
      if (activeTags.length > 0 && !activeTags.some((t) => p.tags.includes(t))) return false;

      return true;
    });

    // Sorting
    if (sortBy === "price-asc") {
      list.sort((a, b) => a.priceNum - b.priceNum);
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => b.priceNum - a.priceNum);
    } else if (sortBy === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "newest") {
      list.reverse();
    }

    return list;
  }, [queryMatchedProducts, activeCategory, priceRange, minDiscount, activeBrands, activeSizes, activeTags, sortBy]);

  const removeSectionFilter = () => {
    setActiveFilter("");
    setSectionProducts([]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("filter");
    params.delete("section");
    const newQuery = params.toString();
    router.push(newQuery ? `/search?${newQuery}` : "/search");
  };

  const getSectionLabel = (f: string) => {
    switch (f.toLowerCase()) {
      case "trending":
        return "Trending";
      case "bestselling":
        return "Bestselling";
      case "new-arrivals":
        return "New Arrivals";
      case "for-you":
        return "For You";
      case "deals":
      case "crazy-deals":
        return "Crazy Deals";
      default:
        return f;
    }
  };

  // ── Active Filter Chips ───────────────────────────────────────────────────
  const activeFilters: { label: string; remove: () => void }[] = [
    ...(activeFilter ? [{ label: getSectionLabel(activeFilter), remove: removeSectionFilter }] : []),
    ...(activeCategory !== "All" ? [{ label: activeCategory, remove: () => setActiveCategory("All") }] : []),
    ...(priceRange[0] !== MIN_PRICE || priceRange[1] !== MAX_PRICE
      ? [
          {
            label: `₦${priceRange[0] >= 1000000 ? `${(priceRange[0] / 1000000).toFixed(1)}M` : `${(priceRange[0] / 1000).toFixed(0)}K`} – ₦${priceRange[1] >= 1000000 ? `${(priceRange[1] / 1000000).toFixed(1)}M` : `${(priceRange[1] / 1000).toFixed(0)}K`}`,
            remove: () => setPriceRange([MIN_PRICE, MAX_PRICE]),
          },
        ]
      : []),
    ...(minDiscount !== null ? [{ label: `${minDiscount}%+ Off`, remove: () => setMinDiscount(null) }] : []),
    ...activeBrands.map((b) => ({ label: `Brand: ${b}`, remove: () => toggleBrand(b) })),
    ...activeSizes.map((s) => ({ label: `Size: ${s}`, remove: () => toggleSize(s) })),
    ...activeTags.map((t) => ({ label: t, remove: () => toggleTag(t) })),
  ];

  const clearAll = () => {
    removeSectionFilter();
    setActiveCategory("All");
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setMinDiscount(null);
    setActiveBrands([]);
    setActiveSizes([]);
    setActiveTags([]);
  };

  const renderFilterSections = () => (
    <div className="flex flex-col gap-4 pb-8 font-sans">
      {/* Category */}
      <FilterSection title="Categories">
        <ul className="flex flex-col gap-0.5">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const isSelected = activeCategory === cat;

            return (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full flex items-center justify-between text-left text-xs sm:text-sm py-1.5 px-2.5 rounded-lg transition-all font-sans cursor-pointer ${
                    isSelected
                      ? "font-bold text-[#010101] bg-[#EDCF5D] shadow-2xs"
                      : "font-medium text-[#010101]/70 hover:text-[#010101] hover:bg-[#F2F0EA]"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate pr-1">
                    <span className="truncate">{cat}</span>
                    <span
                      className={`text-[10px] ${
                        isSelected ? "text-[#010101]/80 font-bold" : count > 0 ? "text-gray-500 font-semibold" : "text-gray-300"
                      }`}
                    >
                      {count}
                    </span>
                  </span>
                  {isSelected && <span className="text-[#010101] text-xs font-black shrink-0">•</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Price">
        <PriceSlider min={MIN_PRICE} max={MAX_PRICE} value={priceRange} onChange={setPriceRange} />
      </FilterSection>

      {/* Discount Percentage */}
      <FilterSection title="Discount Percentage">
        <div className="flex flex-col gap-2 pt-0.5">
          {[50, 40, 30, 20, 10].map((d) => (
            <label
              key={d}
              onClick={() => setMinDiscount((prev) => (prev === d ? null : d))}
              className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#010101] hover:opacity-80 select-none font-sans"
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  minDiscount === d ? "border-[#010101] bg-white" : "border-[#A4A4A4]/50"
                }`}
              >
                {minDiscount === d && <div className="w-2 h-2 rounded-full bg-[#010101]" />}
              </div>
              <span>{d}% or more</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Brand */}
      <FilterSection title="Brand">
        <div className="pt-0.5">
          <div className="relative mb-2">
            <svg className="w-3.5 h-3.5 text-[#A4A4A4] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search brand..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F2F0EA] border border-transparent focus:border-[#010101] focus:bg-white rounded-full text-xs font-semibold text-[#010101] placeholder-[#A4A4A4] outline-none transition-all font-sans"
            />
          </div>
          <div className="max-h-36 overflow-y-auto filter-card-scroll flex flex-col gap-2 pr-1">
            {ALL_BRANDS
              .filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
              .map((brand) => {
                const bCount = brandCounts[brand.toLowerCase()] ?? 0;
                const isChecked = activeBrands.includes(brand);

                return (
                  <label
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="flex items-center justify-between cursor-pointer text-xs font-semibold text-[#010101] select-none font-sans hover:opacity-80 py-0.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          isChecked ? "border-[#010101] bg-[#010101]" : "border-[#A4A4A4]/50 bg-white"
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span>{brand}</span>
                    </div>
                    {bCount > 0 && <span className="text-[10px] text-gray-400 font-medium">({bCount})</span>}
                  </label>
                );
              })}
          </div>
        </div>
      </FilterSection>

      {/* Size */}
      <FilterSection title="Size">
        <div className="flex flex-wrap gap-2 pt-0.5">
          {allAvailableSizes.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggleSize(s)}
              className={`min-w-[34px] h-8 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold whitespace-nowrap transition-all font-sans cursor-pointer ${
                activeSizes.includes(s)
                  ? "bg-[#010101] text-white shadow-sm"
                  : "bg-[#F2F0EA] text-[#010101] hover:bg-[#E5E3DC]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Tags */}
      <FilterSection title="Tags">
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {allAvailableTags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleTag(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all font-sans cursor-pointer ${
                activeTags.includes(t)
                  ? "bg-[#010101] text-white"
                  : "bg-[#F2F0EA] text-[#010101] hover:bg-[#EDCF5D]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <div className="bg-white flex overflow-hidden h-[calc(100vh-88px)] max-h-[calc(100vh-88px)]">
      {/* ──────── LEFT SIDEBAR PANEL (Desktop) ──────── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 h-full bg-white border-r border-gray-200 overflow-hidden">
        {/* Pinned sidebar header — 'Filters' with active filter count */}
        <div className="px-4 py-3.5 shrink-0 flex items-center justify-between border-b border-gray-100 select-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            <span className="text-sm font-bold text-[#010101] font-sans">Filters</span>
            {activeFilters.length > 0 && (
              <span className="text-[10px] font-extrabold text-white bg-[#010101] px-2 py-0.5 rounded-full font-sans">
                {activeFilters.length}
              </span>
            )}
          </div>

          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-[#010101] hover:underline transition-colors font-sans cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-12 filter-card-scroll">
          {renderFilterSections()}
        </div>
      </aside>

      {/* ──────── RIGHT PANEL (Header + Active Filter Chips + Sort + Product Grid) ──────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ── Compact Top Bar: Relevance Dropdown + Active Chips + Results Count ── */}
        <div className="px-4 sm:px-6 py-2.5 shrink-0 flex items-center justify-between gap-3 max-w-full select-none border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0">
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>

            <ActiveFilterChips filters={activeFilters} />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-gray-500 font-sans hidden sm:inline-block">
              {results.length} {results.length === 1 ? "product found" : "products found"}
            </span>

            {/* Mobile filter toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-3.5 py-2 rounded-full transition-colors font-sans cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
              </svg>
              Filters
              {activeFilters.length > 0 && (
                <span className="bg-[#010101] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Scrollable Product Grid inside Right Panel ── */}
        <main className="flex-1 overflow-y-auto filter-card-scroll">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-b border-gray-100 divide-x divide-y divide-gray-100 pb-12">
              {results.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-center py-4 sm:py-5 px-1.5 sm:px-3 bg-white hover:bg-[#FAFAF8] transition-colors"
                >
                  <ProductCard
                    id={product.id}
                    title={product.title}
                    price={product.price}
                    originalPrice={product.originalPrice}
                    badge={product.badge}
                    rating={product.rating}
                    reviews={product.reviews}
                    image={product.image}
                    hasTransparentBg={product.hasTransparentBg}
                    className="w-full max-w-[165px] sm:max-w-[190px]"
                  />
                </div>
              ))}
            </div>
          ) : loadingDb || (loadingSection && results.length === 0) ? (
            /* ── Shimmer Skeleton Loading ── */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-b border-gray-100 divide-x divide-y divide-gray-100 pb-12 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex flex-col items-center py-5 px-3">
                  <div className="w-full aspect-[4/4.2] rounded-[14px] bg-[#ECEAE6] mb-3" />
                  <div className="w-3/4 h-3.5 bg-[#E2DFD9] rounded-md mb-2" />
                  <div className="w-1/2 h-4 bg-[#D5D1C9] rounded-md mb-3" />
                  <div className="w-full h-8 bg-[#ECEAE6] rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-16 px-4 sm:px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F2F0EA] flex items-center justify-center mb-4 text-[#A4A4A4]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <h2 className="font-athelas text-2xl font-bold text-[#010101] mb-1">
                {query ? `No results found for "${query}"` : "No products match your filters"}
              </h2>

              <p className="text-xs sm:text-sm text-[#737373] font-sans max-w-sm mx-auto mb-6">
                We couldn&apos;t find any matches. Try checking your spelling, using more general search terms, or clearing some filters.
              </p>

              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-6 py-2.5 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs font-bold rounded-full transition-all shadow-xs cursor-pointer mb-8"
                >
                  Clear All Filters
                </button>
              )}

              {/* Popular Search Suggestions */}
              <div className="w-full max-w-lg mx-auto pt-6 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Popular Searches</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Air Jordan", "Washing Machine", "Denim Jacket", "Nike", "Nexus", "Smart TV"].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => router.push(`/search?q=${encodeURIComponent(term)}`)}
                      className="px-3.5 py-1.5 bg-[#F2F0EA] hover:bg-[#EDCF5D] rounded-full text-xs font-semibold text-[#010101] transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommended Alternatives Grid */}
              <div className="w-full max-w-4xl mx-auto pt-10 text-left">
                <h3 className="font-athelas text-lg font-bold text-[#010101] mb-4 text-center">
                  Recommended For You
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allCatalogProducts.slice(0, 4).map((p) => (
                    <div key={p.id} className="bg-[#F9F8F5] p-3 rounded-2xl border border-gray-200/80">
                      <ProductCard
                        id={p.id}
                        title={p.title}
                        price={p.price}
                        originalPrice={p.originalPrice}
                        badge={p.badge}
                        rating={p.rating}
                        reviews={p.reviews}
                        image={p.image}
                        hasTransparentBg={p.hasTransparentBg}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ──────── MOBILE SIDEBAR DRAWER ──────── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col lg:hidden">
            {/* Mobile drawer header */}
            <div className="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between border-b border-gray-100">
              <span className="font-athelas text-lg font-bold text-[#010101]">Filters</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F0EA] flex items-center justify-center hover:bg-[#E5E3DC] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Mobile drawer scrollable filter body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
              {renderFilterSections()}
            </div>
            {/* Mobile drawer CTA */}
            <div className="px-6 py-4 shrink-0 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-full bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white font-semibold py-3 rounded-full transition-all font-sans cursor-pointer"
              >
                Show {results.length} results
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
