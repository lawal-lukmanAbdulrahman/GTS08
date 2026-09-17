"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  ProductSearchEngine,
  type SearchableProduct,
} from "../../../../../lib/search-engine";

import { REAL_PRODUCTS, type ProductItem } from "../data/products";

import {
  getRecentlyViewed,
  clearRecentlyViewed,
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
  type RecentlyViewedProduct,
} from "./search-history";

// ─── Default Trending Chip Tags ──────────────────────────────────────────────
const TRENDING_SEARCHES = [
  "slipper for ladies",
  "imperio privee",
  "tripod stands",
  "itel power bank",
  "solar light",
  "air jordan retro",
  "streetwear hoodie",
];

// ─── Adapter: ProductItem → SearchableProduct ────────────────────────────────
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
  if (p.images) {
    for (const img of p.images) {
      if (img.label) {
        const lower = img.label.toLowerCase();
        if (COLOR_WORDS.has(lower) && !colors.includes(lower)) colors.push(lower);
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
    colors: colors.length > 0 ? colors : undefined,
    description: p.description,
    price: p.priceNum,
    inStock: true,
  };
}

// ─── Singleton Engine (built once, shared across overlay renders) ─────────────
let _engine: ProductSearchEngine | null = null;

function getEngine(): ProductSearchEngine {
  if (!_engine) {
    _engine = new ProductSearchEngine();
    _engine.buildIndex(REAL_PRODUCTS.map(toSearchable));
  }
  return _engine;
}

// ─── Highlight matched portion in bold ────────────────────────────────────────
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchIdx = lowerText.indexOf(lowerQuery);
  if (matchIdx === -1) return <span>{text}</span>;

  const before = text.slice(0, matchIdx);
  const match = text.slice(matchIdx, matchIdx + lowerQuery.length);
  const after = text.slice(matchIdx + lowerQuery.length);
  return (
    <span>
      <span className="font-bold text-[#010101]">{before}</span>
      <span className="font-normal text-[#010101]/60">{match}</span>
      <span className="font-bold text-[#010101]">{after}</span>
    </span>
  );
}

interface SearchDropdownCardProps {
  isOpen: boolean;
  query: string;
  onClose: () => void;
  onSelectTerm: (term: string) => void;
}

export function SearchDropdownCard({ isOpen, query, onClose, onSelectTerm }: SearchDropdownCardProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const router = useRouter();

  useEffect(() => {
    const syncData = () => {
      setRecentlyViewed(getRecentlyViewed());
      setRecentSearches(getRecentSearches());
    };

    syncData();

    window.addEventListener("gts_recently_viewed_updated", syncData);
    window.addEventListener("gts_recent_searches_updated", syncData);
    window.addEventListener("storage", syncData);

    return () => {
      window.removeEventListener("gts_recently_viewed_updated", syncData);
      window.removeEventListener("gts_recent_searches_updated", syncData);
      window.removeEventListener("storage", syncData);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChipClick = (term: string) => {
    saveRecentSearch(term);
    onSelectTerm(term);
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleClearRecentlyViewed = () => {
    clearRecentlyViewed();
    setRecentlyViewed([]);
  };

  // ── Autocomplete suggestions powered by the search engine ─────────────────
  const trimmed = query.trim().toLowerCase();
  const hasSuggestions = trimmed.length > 0;

  // Use the engine's autocomplete for instant prefix-trie suggestions
  const suggestions = hasSuggestions
    ? getEngine().autocomplete(trimmed, 10)
    : [];

  return (
    /* ── Dropdown Card positioned directly under the navbar search bar ── */
    <div className="absolute top-full mt-2.5 left-0 right-0 z-50 w-full bg-white rounded-[16px] sm:rounded-[16px] overflow-hidden shadow-2xl border border-gray-200/90 animate-in fade-in slide-in-from-top-2 duration-200">

      {/* ── SUGGESTIONS VIEW (when typing) ── */}
      {hasSuggestions ? (
        <div className="flex flex-col">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleChipClick(suggestion)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#F2F0EA] transition-colors group cursor-pointer border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-[#010101] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 group-hover:text-[#010101] font-sans truncate">
                    <HighlightedText text={suggestion} query={trimmed} />
                  </span>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#010101] shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400 font-sans">No results for &ldquo;<span className="font-semibold text-[#010101]">{query}</span>&rdquo;</p>
              <p className="text-xs text-gray-300 mt-1 font-sans">Try a different search term</p>
            </div>
          )}
        </div>
      ) : (
        /* ── DEFAULT VIEW (recently viewed + recent searches + trending) ── */
        <div className="p-4 sm:p-5 flex flex-col gap-5">

          {/* ── Row 1: Recently Viewed Items ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block font-sans">
                RECENTLY VIEWED ITEMS
              </span>
              {recentlyViewed.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRecentlyViewed}
                  className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors font-sans cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Horizontal Scrollable Row */}
            {recentlyViewed.length > 0 ? (
              <div className="search-card-scroll flex items-center gap-3 overflow-x-auto pb-2 pt-0.5">
                {recentlyViewed.slice(0, 8).map((item) => (
                  <Link
                    key={item.id + (item.slug || "")}
                    href={`/product/${item.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 bg-white rounded-xl p-2 sm:p-2.5 border border-gray-200/90 shrink-0 min-w-[200px] sm:min-w-[220px] hover:border-[#010101] hover:shadow-xs transition-all cursor-pointer group"
                  >
                    {/* Thumbnail — matching ProductCard background */}
                    <div
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg shrink-0 p-1 flex items-center justify-center overflow-hidden border border-gray-200/60"
                      style={{ background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }}
                    >
                      <Image
                        src={item.image || "/placeholder-product.png"}
                        alt={item.title}
                        width={40}
                        height={40}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[#010101] truncate group-hover:text-black font-sans">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-extrabold text-[#010101] font-sans">{item.price}</span>
                        {item.discountBadge && (
                          <span className="bg-[#EDCF5D] text-[#010101] font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow-2xs font-sans">
                            {item.discountBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic font-sans py-0.5">
                No recently viewed items yet. Products you view will appear here.
              </p>
            )}
          </div>

          {/* ── Row 2: Recent Searches ── */}
          {recentSearches.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-sans">
                  RECENT SEARCHES
                </span>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors font-sans cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Recent Search Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleChipClick(term)}
                    className="px-3.5 py-1.5 rounded-full bg-[#F2F0EA] hover:bg-[#EDCF5D] text-xs font-semibold text-[#010101] transition-all active:scale-95 font-sans cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Row 3: Trending Searches ── */}
          <div className="space-y-2.5 pt-0.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block font-sans">
              TRENDING SEARCHES
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleChipClick(term)}
                  className="px-3.5 py-1.5 rounded-full bg-[#F2F0EA] hover:bg-[#EDCF5D] text-xs font-semibold text-[#010101] transition-all active:scale-95 font-sans cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
