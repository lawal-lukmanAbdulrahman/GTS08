"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Recently Viewed / Clicked Items (Max 6) ──────────────────────────────────
const INITIAL_LAST_VIEWED = [
  {
    id: "v1",
    slug: "air-jordan-1",
    title: "Air Jordan 1 Retro High",
    price: "₦85,000",
    discountBadge: "-29%",
    image: "/products/hero/air_jordan_retro_1_blue.png",
  },
  {
    id: "v2",
    slug: "denim-jacket",
    title: "Urban Denim Jacket",
    price: "₦32,400",
    discountBadge: "-50%",
    image: "/products/denim_jacket.png",
  },
  {
    id: "v3",
    slug: "oxford-shirt",
    title: "Classic Oxford Shirt",
    price: "₦32,400",
    discountBadge: "-50%",
    image: "/products/oxford_shirt.png",
  },
  {
    id: "v4",
    slug: "hoodie",
    title: "Streetwear Hoodie",
    price: "₦32,400",
    discountBadge: "-50%",
    image: "/products/hoodie.png",
  },
  {
    id: "v5",
    slug: "linen-coat",
    title: "Tailored Linen Coat",
    price: "₦32,400",
    discountBadge: "-50%",
    image: "/products/linen_coat.png",
  },
  {
    id: "v6",
    slug: "air-jordan-mocha",
    title: "Air Jordan 1 Dark Mocha",
    price: "₦450,000",
    discountBadge: "-15%",
    image: "/products/hero/air_jordan_retro_1_brown.png",
  },
];

// ─── Default Recent & Trending Chip Tags ──────────────────────────────────────
const INITIAL_RECENT_SEARCHES = ["sneakers", "headphones", "bags for men", "air jordan"];
const TRENDING_SEARCHES = [
  "slipper for ladies",
  "imperio privee",
  "tripod stands",
  "itel power bank",
  "solar light",
  "air jordan retro",
  "streetwear hoodie",
];

// ─── Full suggestion pool (simulates autocomplete index) ─────────────────────
const ALL_SUGGESTIONS = [
  "sneakers",
  "sneakers for men",
  "sneakers for women",
  "sneakers on sale",
  "headphones",
  "headphones wireless",
  "headphones bluetooth",
  "bags for men",
  "bags for women",
  "bags for ladies",
  "air jordan",
  "air jordan 1",
  "air jordan 1 retro high",
  "air jordan retro",
  "air jordan 4",
  "slipper for ladies",
  "slipper for men",
  "slippers",
  "imperio privee",
  "tripod stands",
  "tripod",
  "itel power bank",
  "power bank",
  "solar light",
  "solar panel",
  "streetwear hoodie",
  "hoodie for men",
  "hoodie",
  "hoodies on sale",
  "denim jacket",
  "denim jeans",
  "linen shirt",
  "linen coat",
  "oxford shirt",
  "shirts for men",
  "shirts for women",
  "tool box",
  "tool box set",
  "tools",
  "tools box",
  "tools box set",
  "toothpaste",
  "toothbrush",
  "tooth brush holder and tooth dispenser",
  "toothpaste dispenser",
  "washing machine",
  "refrigerator",
  "fridge",
  "smartphone",
  "pixel 10",
  "samsung fridge",
  "laptop bag",
  "gaming chair",
  "office chair",
  "perfume for men",
  "perfume for women",
  "wristwatch",
  "wristwatch for men",
  "sunglasses",
  "cap",
  "cap for men",
  "belt for men",
  "wallet",
  "leather wallet",
  "running shoes",
  "sports shoes",
  "formal shoes",
  "boot",
  "ankle boots",
];

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
  const [recentSearches, setRecentSearches] = useState(INITIAL_RECENT_SEARCHES);
  const router = useRouter();

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
    onSelectTerm(term);
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

// ─── Fuzzy Matcher for Navbar Dropdown ────────────────────────────────────────
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

function isFuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q) return true;
  if (t.includes(q) || q.includes(t)) return true;

  const qWords = q.split(/\s+/);
  const tWords = t.split(/[\s\-_,]+/);

  return qWords.every((qw) => {
    return tWords.some((tw) => {
      if (tw.includes(qw) || qw.includes(tw)) return true;
      const maxLen = Math.max(qw.length, tw.length);
      const maxEdits = qw.length <= 4 ? 1 : qw.length <= 8 ? 2 : 3;
      return levenshteinDistance(qw, tw) <= maxEdits;
    });
  });
}

  const handleClearRecent = () => {
    setRecentSearches([]);
  };

  // ── Filter suggestions when user has typed something (fuzzy match) ─────────
  const trimmed = query.trim().toLowerCase();
  const hasSuggestions = trimmed.length > 0;
  const suggestions = hasSuggestions
    ? ALL_SUGGESTIONS.filter((s) => isFuzzyMatch(trimmed, s)).slice(0, 10)
    : [];

  return (
    /* ── Dropdown Card positioned directly under the navbar search bar ── */
    <div className="absolute top-full mt-2.5 left-0 right-0 z-50 w-full bg-white rounded-[16px] sm:rounded-[16px] overflow-hidden shadow-2xl border border-gray-200/90 animate-in fade-in slide-in-from-top-2 duration-200">

      {/* ── SUGGESTIONS VIEW (when typing) ── */}
      {hasSuggestions ? (
        <div className="flex flex-col">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, i) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleChipClick(suggestion)}
                className={`flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-[#F2F0EA] transition-colors group font-sans ${
                  i < suggestions.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="text-sm font-sans">
                  <HighlightedText text={suggestion} query={trimmed} />
                </span>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-[#010101] transition-colors shrink-0 ml-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
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

          {/* ── Row 1: Recently Viewed Items (Max 6 with scrollbar) ── */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block font-sans">
              RECENTLY VIEWED ITEMS
            </span>

            {/* Horizontal Scrollable Row */}
            <div className="search-card-scroll flex items-center gap-3 overflow-x-auto pb-2 pt-0.5">
              {INITIAL_LAST_VIEWED.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
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
                      src={item.image}
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
                      <span className="bg-[#EDCF5D] text-[#010101] font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow-2xs font-sans">
                        {item.discountBadge}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors font-sans"
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
                    className="px-3.5 py-1.5 rounded-full bg-[#F2F0EA] hover:bg-[#EDCF5D] text-xs font-semibold text-[#010101] transition-all active:scale-95 font-sans"
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
                  className="px-3.5 py-1.5 rounded-full bg-[#F2F0EA] hover:bg-[#EDCF5D] text-xs font-semibold text-[#010101] transition-all active:scale-95 font-sans"
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
