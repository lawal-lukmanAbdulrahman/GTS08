"use client";

import { formatKobo } from "@gts/utils";
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
  onQuickAdd: (product: PosProduct, variantId: string) => void;
  onOpenVariantModal: (product: PosProduct) => void;
}

const STOCK_BADGE: Record<PosProduct["stock_status"], { label: string; className: string }> = {
  in_stock: { label: "In Stock", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  low_stock: { label: "Low Stock", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  out_of_stock: { label: "Out of Stock", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export default function SearchPanel({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  products,
  loading,
  onQuickAdd,
  onOpenVariantModal,
}: SearchPanelProps) {
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
      <div className="p-4 space-y-3">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
          }}
          placeholder="Search by product name or SKU..."
          className="w-full px-4 py-3 text-sm rounded-[8px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#1C1C1C]"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                category === cat.slug
                  ? "bg-[#EDCF5D] text-[#010101]"
                  : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <p className="text-sm text-gray-500 text-center pt-10">Searching...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-500 text-center pt-10">
            {query ? "No products found." : "Start typing to search products."}
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((product) => {
              const badge = STOCK_BADGE[product.stock_status];
              const outOfStock = product.stock_status === "out_of_stock";
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductTap(product)}
                  disabled={outOfStock}
                  className={`text-left rounded-[10px] border border-gray-200 dark:border-[#262626] p-2.5 bg-white dark:bg-[#1C1C1C] hover:border-gray-400 dark:hover:border-[#444] transition-all ${
                    outOfStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <div className="aspect-square rounded-[8px] bg-gray-100 dark:bg-[#242424] mb-2 overflow-hidden">
                    {product.primary_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://res.cloudinary.com/daht6d5ck/image/upload/${product.primary_image.cloudinary_id}`}
                        alt={product.primary_image.alt}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatKobo(product.base_price)}
                  </p>
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
