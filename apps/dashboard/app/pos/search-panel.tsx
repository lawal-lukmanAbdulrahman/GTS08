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
  category?: string;
  onCategoryChange?: (category: string) => void;
  categories?: Category[];
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

const VIEW_MODE_KEY = "gts_pos_view_mode";

function checkIsTransparent(product: PosProduct): boolean {
  if (product.has_transparent_bg) return true;
  const rawId = (product.primary_image?.cloudinary_id || "").toLowerCase();
  return rawId.endsWith(".png") || rawId.includes(".png") || rawId.includes("transparent");
}

function Thumb({
  image,
  isTransparent,
  paddingClass = "p-2",
}: {
  image: PosProduct["primary_image"];
  isTransparent?: boolean;
  paddingClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = resolveProductImageUrl(image?.cloudinary_id);
  if (!url || failed) {
    return (
      <div data-testid="no-image" className="w-full h-full flex items-center justify-center text-gray-300 dark:text-[#444]">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM8.25 8.625a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={image?.alt ?? ""}
      onError={() => setFailed(true)}
      className={`w-full h-full ${
        isTransparent ? `object-contain ${paddingClass}` : "object-cover"
      }`}
    />
  );
}

export default function SearchPanel({
  query,
  onQueryChange,
  category: _category,
  onCategoryChange: _onCategoryChange,
  categories: _categories,
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

  // View mode defaults to grid, can switch to list
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(VIEW_MODE_KEY);
      if (savedMode === "list" || savedMode === "grid") setViewMode(savedMode);
    } catch {
      // storage blocked: stay on the default
    }
  }, []);

  function changeViewMode(next: "grid" | "list") {
    setViewMode(next);
    try {
      localStorage.setItem(VIEW_MODE_KEY, next);
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
      <div className="p-3.5 sm:p-4 space-y-2">
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
          className="w-full px-3.5 py-2 text-sm rounded-[8px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#1C1C1C] focus:outline-none focus:border-[#EDCF5D]"
        />
        {scanMessage && (
          <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {scanMessage}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3.5 sm:px-4 sm:pb-4 [scrollbar-width:thin]">
        {loading && products.length === 0 ? (
          <p className="text-sm sm:text-base text-gray-500 text-center pt-8">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-sm sm:text-base text-gray-500 text-center pt-8">
            {searching ? "No products found." : "No products available."}
          </p>
        ) : (
          <>
            {/* Header row with Products title on left, and View Selector on right */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
                {searching ? `Results for "${query.trim()}"` : "Products"}
              </p>
              <div className="flex items-center gap-2">
                {loading && (
                  <p role="status" className="text-xs font-semibold text-gray-500 dark:text-gray-400 animate-pulse">
                    Updating...
                  </p>
                )}
                {/* View Mode Dropdown (Grid vs List) */}
                <div className="relative">
                  <select
                    value={viewMode}
                    onChange={(e) => changeViewMode(e.target.value as "grid" | "list")}
                    aria-label="View layout"
                    className="appearance-none pl-2.5 pr-6 py-1 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all cursor-pointer focus:outline-none shadow-2xs"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                  </select>
                  <svg className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Products Layout (Grid or List) */}
            <div
              data-testid="product-grid"
              aria-busy={loading}
              className={`transition-opacity ${loading ? "opacity-50 pointer-events-none" : "opacity-100"} ${
                viewMode === "list"
                  ? "space-y-1.5"
                  : "grid gap-2 sm:gap-2.5 grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              }`}
            >
              {products.map((product) => {
                const outOfStock = product.stock_status === "out_of_stock";
                const isLowStock = product.stock_status === "low_stock";
                const leftCount = product.variants.reduce((n, v) => n + Math.max(0, v.available), 0);
                const isTransparent = checkIsTransparent(product);

                if (viewMode === "list") {
                  return (
                    <div
                      key={product.id}
                      data-testid="product-card"
                      className={`flex items-center gap-2.5 p-2 rounded-[8px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] hover:border-gray-400 dark:hover:border-[#444] transition-colors ${outOfStock ? "opacity-60" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleProductTap(product)}
                        disabled={outOfStock}
                        className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${outOfStock ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="w-12 h-12 shrink-0 rounded-[6px] bg-gray-100 dark:bg-[#242424] overflow-hidden flex items-center justify-center">
                          <Thumb image={product.primary_image} isTransparent={isTransparent} paddingClass="p-1" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatKobo(product.base_price)}</p>
                        </div>
                      </button>
                      <div data-testid="product-card-footer" className="flex items-center gap-2 shrink-0">
                        {outOfStock ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-gray-100 text-gray-500 dark:bg-[#252525] dark:text-gray-400">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 inline-flex items-center gap-1">
                            <span>Low Stock</span>
                            <span className="font-bold">{leftCount} left</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                            In Stock
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Flag ${product.name}`}
                          title="Report a problem with this product"
                          onClick={() => onFlagProduct(product)}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[6px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#222222] text-gray-500 dark:text-gray-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.779V4.246l-3.114.778a9 9 0 01-6.086-.71l-.108-.054a9 9 0 00-6.208-.682L3 4.5v10.5z" />
                          </svg>
                          <span className="sr-only">Flag</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Grid View Card (compact image size and clean layout)
                return (
                  <div
                    key={product.id}
                    data-testid="product-card"
                    className={`flex flex-col rounded-[8px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] p-2 hover:border-gray-400 dark:hover:border-[#444] transition-colors ${outOfStock ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleProductTap(product)}
                      disabled={outOfStock}
                      className={`flex-1 w-full text-left ${outOfStock ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="aspect-square w-full rounded-[6px] bg-gray-100 dark:bg-[#242424] mb-1.5 overflow-hidden flex items-center justify-center">
                        <Thumb image={product.primary_image} isTransparent={isTransparent} paddingClass="p-2" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{formatKobo(product.base_price)}</p>
                    </button>
                    <div data-testid="product-card-footer" className="mt-1.5 flex items-center justify-between gap-1">
                      <div className="flex flex-wrap items-center gap-1 min-w-0">
                        {outOfStock ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-gray-100 text-gray-500 dark:bg-[#252525] dark:text-gray-400">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 inline-flex items-center gap-1">
                            <span>Low Stock</span>
                            <span className="font-bold">{leftCount} left</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                            In Stock
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Flag ${product.name}`}
                        title="Report a problem with this product"
                        onClick={() => onFlagProduct(product)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[6px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#222222] text-gray-500 dark:text-gray-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.779V4.246l-3.114.778a9 9 0 01-6.086-.71l-.108-.054a9 9 0 00-6.208-.682L3 4.5v10.5z" />
                        </svg>
                        <span className="sr-only">Flag</span>
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
                  className="px-4 py-2 text-sm font-semibold rounded-[8px] bg-gray-100 dark:bg-[#242424] disabled:opacity-50 cursor-pointer"
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
