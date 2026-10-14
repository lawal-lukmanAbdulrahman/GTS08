"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatKobo } from "@gts/utils";
import { API_BASE } from "../../lib/api-base";
import type { PromoProductPreview } from "./types";

let cachedProductList: PromoProductPreview[] | null = null;

function extractProductImage(p: any): string {
  if (p.primary_image?.cloudinary_id && typeof p.primary_image.cloudinary_id === "string") {
    return p.primary_image.cloudinary_id;
  }
  if (typeof p.primary_image === "string" && p.primary_image.trim()) {
    return p.primary_image.trim();
  }
  if (p.image_url && typeof p.image_url === "string" && p.image_url.trim()) {
    return p.image_url.trim();
  }
  if (p.image && typeof p.image === "string" && p.image.trim()) {
    return p.image.trim();
  }
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first?.cloudinary_id && typeof first.cloudinary_id === "string") return first.cloudinary_id;
    if (first?.url && typeof first.url === "string") return first.url;
  }
  return "/products/denim_jacket.png";
}

interface ProductSelectModalProps {
  isOpen: boolean;
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (selectedProducts: PromoProductPreview[]) => void;
}

export default function ProductSelectModal({
  isOpen,
  selectedIds,
  onClose,
  onConfirm,
}: ProductSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<PromoProductPreview[]>(cachedProductList || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentSelected, setCurrentSelected] = useState<PromoProductPreview[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // If cached, render immediately with 0ms delay
      if (cachedProductList && cachedProductList.length > 0) {
        setProducts(cachedProductList);
        const initial = cachedProductList.filter((p) => selectedIds.includes(p.id));
        setCurrentSelected(initial);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Revalidate in background to guarantee freshness
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
      fetch(`${API_BASE}/products?include_all_status=true&limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.json())
        .then((data) => {
          const rawList = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.products)
            ? data.products
            : [];

          const list: PromoProductPreview[] = rawList.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            image_url: extractProductImage(p),
            base_price: p.base_price,
            cost_price: p.cost_price,
            status: p.status,
          }));

          cachedProductList = list;
          setProducts(list);
          const initial = list.filter((p) => selectedIds.includes(p.id));
          setCurrentSelected(initial);
        })
        .catch((err) => console.error("Failed to load products:", err))
        .finally(() => setLoading(false));

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, selectedIds]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q)
    );
  }, [products, search]);

  if (!isOpen || !mounted) return null;

  const toggleSelect = (prod: PromoProductPreview) => {
    setCurrentSelected((prev) =>
      prev.some((p) => p.id === prod.id)
        ? prev.filter((p) => p.id !== prod.id)
        : [...prev, prod]
    );
  };

  const toggleSelectAll = () => {
    if (currentSelected.length === filteredProducts.length) {
      setCurrentSelected([]);
    } else {
      setCurrentSelected([...filteredProducts]);
    }
  };

  const handleApply = () => {
    onConfirm(currentSelected);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#181818] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2C2C2C] flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Select Discount Eligible Products
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5">
              Choose the catalog items this promo code will exclusively apply to
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#151515] flex items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search products by title or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
            />
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:bg-white dark:hover:bg-[#222] text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            {currentSelected.length === filteredProducts.length && filteredProducts.length > 0
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-gray-100 dark:divide-[#222222]">
          {loading && products.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No matching products found
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isSelected = currentSelected.some((p) => p.id === prod.id);
              return (
                <div
                  key={prod.id}
                  onClick={() => toggleSelect(prod)}
                  className={`pt-2 flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-black accent-[#EDCF5D] cursor-pointer"
                    />
                    <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-[#2A2A2A] overflow-hidden flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333]">
                      <img
                        src={prod.image_url || "/products/denim_jacket.png"}
                        alt={prod.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/products/denim_jacket.png";
                        }}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                        <span>Price: {formatKobo(prod.base_price)}</span>
                        {prod.cost_price ? (
                          <span className="text-gray-400">
                            • Cost: {formatKobo(prod.cost_price)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300">
                      {prod.status || "active"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">{currentSelected.length}</strong> product{currentSelected.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-[#2C2C2C] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] hover:bg-[#EDCF5D] hover:text-[#010101] dark:hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Apply Selection ({currentSelected.length})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
