"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProductCard } from "../_components/ui/product-card";

import { REAL_PRODUCTS, ALL_BRAND_KEYS } from "../_data/products";

const ALL_PRODUCTS = REAL_PRODUCTS;

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

const CATEGORIES = ["All", ...Array.from(new Set([...MEGA_CATEGORY_NAMES, ...REAL_PRODUCTS.map((p) => p.category)]))];
const ALL_SIZES = Array.from(new Set(REAL_PRODUCTS.flatMap((p) => p.sizes)));
const ALL_TAGS = Array.from(new Set(REAL_PRODUCTS.flatMap((p) => p.tags)));
// ALL_BRANDS comes from the central BRAND_REGISTRY — not derived from product data
const ALL_BRANDS = ALL_BRAND_KEYS;

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest" },
];

const MAX_PRICE = Math.max(3000000, ...REAL_PRODUCTS.map((p) => p.priceNum));
const MIN_PRICE = 0;

// ─── Price Range Slider with Editable Inputs ─────────────────────────────────
function PriceSlider({
  min, max, value, onChange,
}: {
  min: number; max: number;
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

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

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
      if (dragging.current === "low") onChange([Math.min(v, value[1] - 1000), value[1]]);
      else onChange([value[0], Math.max(v, value[0] + 1000)]);
    };
    const up = () => { dragging.current = null; };
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
          onMouseDown={(e) => { e.preventDefault(); dragging.current = "low"; }}
          onTouchStart={() => { dragging.current = "low"; }}
        />
        {/* High thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#010101] border-2 border-[#010101] shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
          style={{ left: `${pct(value[1])}%` }}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = "high"; }}
          onTouchStart={() => { dragging.current = "high"; }}
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

// ─── Levenshtein & Fuzzy Search Helper ────────────────────────────────────────
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

function wordFuzzyScore(qWord: string, targetWords: string[]): number {
  const q = qWord.toLowerCase();
  let maxScore = 0;

  for (const tw of targetWords) {
    const t = tw.toLowerCase();

    // Exact match
    if (q === t) return 1.0;

    // Prefix match
    if (t.startsWith(q)) {
      maxScore = Math.max(maxScore, 0.95);
      continue;
    }

    // Substring match
    if (t.includes(q)) {
      maxScore = Math.max(maxScore, 0.85);
      continue;
    }

    // Levenshtein typo match
    const maxLen = Math.max(q.length, t.length);
    const maxEdits = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
    const dist = levenshteinDistance(q, t);

    if (dist <= maxEdits) {
      const sim = 1 - dist / maxLen;
      maxScore = Math.max(maxScore, sim * 0.8);
    }
  }

  return maxScore;
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
        className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-3.5 py-2 rounded-full transition-colors font-sans"
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
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors font-sans ${value === opt.value ? "bg-[#EDCF5D] text-[#010101]" : "text-[#010101] hover:bg-[#F2F0EA]"}`}
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
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full mb-1.5 select-none"
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
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#010101] text-white text-xs font-semibold shrink-0 font-sans"
          >
            <span>{f.label}</span>
            <button
              onClick={f.remove}
              className="hover:text-[#EDCF5D] transition-colors ml-0.5 text-xs font-bold"
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

  const query = searchParams.get("q") ?? searchParams.get("search") ?? "";
  const initialCat = searchParams.get("category") ?? "All";
  const initialBrand = searchParams.get("brand") ?? "";

  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const [minDiscount, setMinDiscount] = useState<number | null>(null);
  const [activeBrands, setActiveBrands] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [brandSearch, setBrandSearch] = useState("");
  const [activeSizes, setActiveSizes] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // ── Active Filter Chips ───────────────────────────────────────────────────
  const activeFilters: { label: string; remove: () => void }[] = [
    ...(activeCategory !== "All" ? [{ label: activeCategory, remove: () => setActiveCategory("All") }] : []),
    ...(priceRange[0] !== MIN_PRICE || priceRange[1] !== MAX_PRICE
      ? [{
          label: `₦${priceRange[0] >= 1000000 ? `${(priceRange[0]/1000000).toFixed(1)}M` : `${(priceRange[0]/1000).toFixed(0)}K`} – ₦${priceRange[1] >= 1000000 ? `${(priceRange[1]/1000000).toFixed(1)}M` : `${(priceRange[1]/1000).toFixed(0)}K`}`,
          remove: () => setPriceRange([MIN_PRICE, MAX_PRICE]),
        }]
      : []),
    ...(minDiscount !== null ? [{ label: `${minDiscount}%+ Off`, remove: () => setMinDiscount(null) }] : []),
    ...activeBrands.map((b) => ({ label: `Brand: ${b}`, remove: () => toggleBrand(b) })),
    ...activeSizes.map((s) => ({ label: `Size: ${s}`, remove: () => toggleSize(s) })),
    ...activeTags.map((t) => ({ label: t, remove: () => toggleTag(t) })),
  ];

  const clearAll = () => {
    setActiveCategory("All");
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setMinDiscount(null);
    setActiveBrands([]);
    setActiveSizes([]);
    setActiveTags([]);
  };

  // ── Filtered + Sorted Products with Fuzzy Search Engine ─────────────────
  const results = useMemo(() => {
    const queryWords = query ? query.toLowerCase().trim().split(/\s+/).filter(Boolean) : [];

    const scoredList = ALL_PRODUCTS.map((p) => {
      // 1. Strict filters
      if (activeCategory !== "All" && p.category !== activeCategory) return { product: p, score: -1 };
      if (p.priceNum < priceRange[0] || p.priceNum > priceRange[1]) return { product: p, score: -1 };

      if (minDiscount !== null) {
        const orig = p.originalPrice ? parseInt(p.originalPrice.replace(/[^0-9]/g, ""), 10) : p.priceNum;
        const discountPct = orig > p.priceNum ? Math.round(((orig - p.priceNum) / orig) * 100) : 0;
        if (discountPct < minDiscount) return { product: p, score: -1 };
      }

      if (activeBrands.length > 0 && !activeBrands.some((b) => p.brand.toLowerCase() === b.toLowerCase())) {
        return { product: p, score: -1 };
      }

      if (activeSizes.length > 0 && !activeSizes.some((s) => p.sizes.includes(s))) return { product: p, score: -1 };
      if (activeTags.length > 0 && !activeTags.some((t) => p.tags.includes(t))) return { product: p, score: -1 };

      // 2. Fuzzy query matching
      if (queryWords.length === 0) return { product: p, score: 1.0 };

      const targetWords = `${p.title} ${p.brand} ${p.category} ${p.subCategory} ${p.tags.join(" ")}`
        .toLowerCase()
        .split(/[\s\-_,]+/);

      const wordScores = queryWords.map((qw) => wordFuzzyScore(qw, targetWords));
      const minWordScore = Math.min(...wordScores);
      const avgWordScore = wordScores.reduce((sum, s) => sum + s, 0) / wordScores.length;

      // Allow match if every word matches with score >= 0.45 or average score is >= 0.5
      if (minWordScore >= 0.45 || avgWordScore >= 0.5) {
        return { product: p, score: avgWordScore };
      }

      return { product: p, score: -1 };
    });

    let validList = scoredList.filter((item) => item.score >= 0);

    if (sortBy === "price-asc") {
      validList.sort((a, b) => a.product.priceNum - b.product.priceNum);
    } else if (sortBy === "price-desc") {
      validList.sort((a, b) => b.product.priceNum - a.product.priceNum);
    } else if (sortBy === "rating") {
      validList.sort((a, b) => b.product.rating - a.product.rating);
    } else {
      // Relevance sort — highest fuzzy match score first
      validList.sort((a, b) => b.score - a.score);
    }

    return validList.map((item) => item.product);
  }, [query, activeCategory, priceRange, minDiscount, activeBrands, activeSizes, activeTags, sortBy]);

  const renderFilterSections = () => (
    <div className="flex flex-col gap-4 pb-8 font-sans">
      {/* Category */}
      <FilterSection title="Categories">
        <ul className="flex flex-col gap-0.5">
          {CATEGORIES.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between text-left text-xs sm:text-sm py-1.5 px-2.5 rounded-lg transition-all font-sans ${activeCategory === cat
                  ? "font-bold text-[#010101] bg-[#EDCF5D] shadow-2xs"
                  : "font-medium text-[#010101]/60 hover:text-[#010101] hover:bg-[#F2F0EA]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{cat}</span>
                  <span className={`text-[10px] ${activeCategory === cat ? "text-[#010101]/70 font-semibold" : "text-[#A4A4A4]"}`}>
                    {cat === "All"
                      ? ALL_PRODUCTS.length
                      : ALL_PRODUCTS.filter((p) => p.category === cat).length}
                  </span>
                </span>
                {activeCategory === cat && <span className="text-[#010101] text-xs font-bold">•</span>}
              </button>
            </li>
          ))}
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
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                minDiscount === d ? "border-[#010101] bg-white" : "border-[#A4A4A4]/50"
              }`}>
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
              .map((brand) => (
                <label
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#010101] select-none font-sans hover:opacity-80"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    activeBrands.includes(brand) ? "border-[#010101] bg-[#010101]" : "border-[#A4A4A4]/50 bg-white"
                  }`}>
                    {activeBrands.includes(brand) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span>{brand}</span>
                </label>
              ))}
          </div>
        </div>
      </FilterSection>

      {/* Size */}
      <FilterSection title="Size">
        <div className="flex flex-wrap gap-2 pt-0.5">
          {ALL_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              className={`min-w-[34px] h-8 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold whitespace-nowrap transition-all font-sans ${activeSizes.includes(s)
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
          {ALL_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all font-sans ${activeTags.includes(t)
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
    /*
      Full-viewport layout below the navbar.
      Page-level overflow is locked.
    */
    <div className="bg-white flex overflow-hidden h-[calc(100vh-88px)] max-h-[calc(100vh-88px)]">

      {/* ──────── LEFT SIDEBAR PANEL (Desktop) — Full height, vertical divider line ──────── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 h-full bg-white border-r border-gray-200 overflow-hidden">
        {/* Pinned sidebar header — 'Filters' with pill count on left, 'Clear' on right */}
        <div className="px-4 py-3.5 shrink-0 flex items-center justify-between border-b border-gray-100 select-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            <span className="text-sm font-bold text-[#010101] font-sans">Filters</span>
            <span className="text-[11px] font-bold text-[#737373] bg-[#F2F0EA] px-2 py-0.5 rounded-full font-sans">
              {results.length}
            </span>
          </div>

          {activeFilters.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-semibold text-[#010101] hover:underline transition-colors font-sans"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable filter content — scrollbar on the RIGHT with extra bottom space */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-12 filter-card-scroll">
          {renderFilterSections()}
        </div>
      </aside>

      {/* ──────── RIGHT PANEL (Header + Active Filter Chips + Sort + Product Grid) ──────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ── Compact Top Bar: Relevance Dropdown + Active Chips ── */}
        <div className="px-4 sm:px-6 py-2.5 shrink-0 flex items-center gap-2 max-w-full select-none border-b border-gray-100 bg-white">
          <div className="shrink-0">
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          <ActiveFilterChips filters={activeFilters} />

          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden ml-auto shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-3.5 py-2 rounded-full transition-colors font-sans"
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

        {/* ── Scrollable Product Grid inside Right Panel (with custom scrollbar on the right) ── */}
        <main className="flex-1 overflow-y-auto filter-card-scroll">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-b border-gray-100 divide-x divide-y divide-gray-100 pb-8">
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
                    className="w-full max-w-[165px] sm:max-w-[190px]"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 sm:px-6">
              <div className="w-16 h-16 rounded-full bg-[#F2F0EA] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#A4A4A4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="font-athelas text-xl font-bold text-[#010101] mb-1">No results found</h2>
              <p className="text-xs sm:text-sm text-[#A4A4A4] font-sans max-w-xs">
                We couldn&apos;t find anything matching &ldquo;<strong>{query}</strong>&rdquo;. Try adjusting your filters or searching for something else.
              </p>
              <button
                onClick={clearAll}
                className="mt-5 px-5 py-2 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs font-semibold rounded-full transition-all font-sans"
              >
                Clear filters
              </button>
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
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F0EA] flex items-center justify-center hover:bg-[#E5E3DC] transition-colors"
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
                onClick={() => setSidebarOpen(false)}
                className="w-full bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white font-semibold py-3 rounded-full transition-all font-sans"
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
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
