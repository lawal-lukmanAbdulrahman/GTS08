"use client";

import { useEffect, useState } from "react";
import { formatKobo } from "@gts/utils";
import { resolveProductImageUrl } from "./product-image";
import type { PosProduct } from "./pos-types";
import { resolveQuickAddVariant } from "./quick-add";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: Category[];
  products: PosProduct[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onQuickAdd: (product: PosProduct, variantId: string) => void;
  onOpenVariantModal: (product: PosProduct) => void;
  onFlagProduct: (product: PosProduct) => void;
  /** Enter pressed in the search box (a barcode scanner types a SKU then Enter). */
  onSubmitQuery?: (text: string) => void;
  /** Outcome of the last scan, e.g. "Added Plain Tee". */
  scanMessage?: string | null;
}

const DENSITY_KEY = "gts_pos_density";

const STOCK_BADGE: Record<PosProduct["stock_status"], { label: string; className: string }> = {
  in_stock: { label: "In Stock", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  low_stock: { label: "Low Stock", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  out_of_stock: { label: "Out of Stock", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function Thumb({ image }: { image: PosProduct["primary_image"] }) {
  const [failed, setFailed] = useState(false);
  const url = resolveProductImageUrl(image?.cloudinary_id);
  if (!url || failed) {
    return (
      <div data-testid="no-image" className="w-full h-full flex items-center justify-center text-gray-300 dark:text-[#444]">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM8.25 8.625a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={image?.alt ?? ""} onError={() => setFailed(true)} className="w-full h-full object-cover" />;
}

export default function SearchPanel({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  products,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onQuickAdd,
  onOpenVariantModal,
  onFlagProduct,
  onSubmitQuery,
  scanMessage,
}: SearchPanelProps) {
  const searching = query.trim() !== "";

  // Compact view fits more products on screen for a busy till; the choice is remembered on this device.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    try {
      setCompact(localStorage.getItem(DENSITY_KEY) === "compact");
    } catch {
      // storage blocked: stay on the default
    }
  }, []);
  function toggleDensity() {
    const next = !compact;
    setCompact(next);
    try {
      localStorage.setItem(DENSITY_KEY, next ? "compact" : "comfortable");
    } catch {
      // not remembered, still works
    }
  }
  function handleProductTap(product: PosProduct) {
    if (product.stock_status === "out_of_stock") return;
    const quickVariantId = resolveQuickAddVariant(product);
    if (quickVariantId) {
      onQuickAdd(product, quickVariantId);
    } else {
      onOpenVariantModal(product);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
            if (e.key === "Enter" && query.trim() && onSubmitQuery) onSubmitQuery(query.trim());
          }}
          placeholder="Search by product name or SKU..."
          className="w-full px-4 py-3 text-base rounded-[8px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#1C1C1C]"
        />
        {scanMessage && (
          <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {scanMessage}
          </p>
        )}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange("all")}
            aria-pressed={category === "all"}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
              category === "all"
                ? "bg-[#EDCF5D] text-[#010101]"
                : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.slug)}
              aria-pressed={category === cat.slug}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                category === cat.slug
                  ? "bg-[#EDCF5D] text-[#010101]"
                  : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
          </div>
          <button
            type="button"
            onClick={toggleDensity}
            aria-label="Compact view"
            aria-pressed={compact}
            className={`shrink-0 px-3 min-h-[44px] rounded-[8px] text-sm font-semibold border ${compact ? "bg-[#010101] text-white border-[#010101] dark:bg-[#EDCF5D] dark:text-[#010101]" : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200"}`}
          >
            Compact
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading && products.length === 0 ? (
          <p className="text-base text-gray-500 text-center pt-10">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-base text-gray-500 text-center pt-10">
            {searching ? "No products found." : "No products available."}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {searching ? `Results for "${query.trim()}"` : "Best sellers"}
              </p>
              {loading && (
                <p role="status" className="text-sm font-semibold text-gray-500 dark:text-gray-400 animate-pulse">
                  Updating...
                </p>
              )}
            </div>
            <div
              data-testid="product-grid"
              aria-busy={loading}
              className={`grid gap-4 transition-opacity ${loading ? "opacity-50 pointer-events-none" : "opacity-100"} ${compact ? "grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-2 lg:grid-cols-3"}`}
            >
              {products.map((product) => {
                const badge = STOCK_BADGE[product.stock_status];
                const outOfStock = product.stock_status === "out_of_stock";
                return (
                  <div
                    key={product.id}
                    data-testid="product-card"
                    className={`flex flex-col rounded-[12px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] p-3 hover:border-gray-400 dark:hover:border-[#444] transition-colors ${outOfStock ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleProductTap(product)}
                      disabled={outOfStock}
                      className={`flex-1 w-full text-left ${outOfStock ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className={`${compact ? "aspect-[4/3]" : "aspect-square"} rounded-[8px] bg-gray-100 dark:bg-[#242424] mb-3 overflow-hidden`}>
                        <Thumb image={product.primary_image} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatKobo(product.base_price)}</p>
                    </button>
                    <div data-testid="product-card-footer" className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.className}`}>{badge.label}</span>
                        {product.stock_status === "low_stock" && (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                            {product.variants.reduce((n, v) => n + Math.max(0, v.available), 0)} left
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Flag ${product.name}`}
                        title="Report a problem with this product"
                        onClick={() => onFlagProduct(product)}
                        className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-[8px] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-300"
                      >
                        ⚑ Flag
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm font-semibold rounded-[8px] bg-gray-100 dark:bg-[#242424] disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
