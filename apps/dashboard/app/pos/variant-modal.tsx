"use client";

import { useMemo, useState } from "react";
import { formatKobo } from "@gts/utils";
import type { PosProduct } from "./pos-types";

interface VariantModalProps {
  product: PosProduct;
  preselectedVariantId?: string;
  onAddToCart: (product: PosProduct, variantId: string, quantity: number) => void;
  onCancel: () => void;
}

/**
 * gts_03_cashier_spec.md Part 3.4. Sizes are the primary axis; if more than
 * one color exists for a chosen size, a color swatch row appears too. Add to
 * Cart stays disabled until an exact (size, color) variant is resolved.
 */
export default function VariantModal({
  product,
  preselectedVariantId,
  onAddToCart,
  onCancel,
}: VariantModalProps) {
  const preselected = preselectedVariantId
    ? product.variants.find((v) => v.id === preselectedVariantId)
    : undefined;

  const [selectedSize, setSelectedSize] = useState<string | null>(preselected?.size ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(preselected?.color ?? null);
  const [quantity, setQuantity] = useState(1);

  const sizes = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean))) as string[],
    [product.variants]
  );

  const colorsForSize = useMemo(
    () =>
      selectedSize
        ? Array.from(
            new Set(
              product.variants.filter((v) => v.size === selectedSize).map((v) => v.color).filter(Boolean)
            )
          ) as string[]
        : [],
    [product.variants, selectedSize]
  );

  const selectedVariant = useMemo(() => {
    if (!selectedSize) return null;
    if (colorsForSize.length > 1) {
      if (!selectedColor) return null;
      return product.variants.find((v) => v.size === selectedSize && v.color === selectedColor) ?? null;
    }
    return product.variants.find((v) => v.size === selectedSize) ?? null;
  }, [product.variants, selectedSize, selectedColor, colorsForSize.length]);

  const displayPrice = product.base_price + (selectedVariant?.price_modifier ?? 0);

  function isSizeOutOfStock(size: string): boolean {
    return product.variants.filter((v) => v.size === size).every((v) => v.available <= 0);
  }

  function selectSize(size: string) {
    setSelectedSize(size);
    setSelectedColor(null);
    setQuantity(1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-[12px] bg-white dark:bg-[#1C1C1C] p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{product.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatKobo(displayPrice)}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Select Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const outOfStock = isSizeOutOfStock(size);
              const lowStock = product.variants
                .filter((v) => v.size === size)
                .some((v) => v.available > 0 && v.available <= 5);
              return (
                <button
                  key={size}
                  type="button"
                  role="button"
                  aria-label={size}
                  disabled={outOfStock}
                  onClick={() => selectSize(size)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    selectedSize === size
                      ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                      : "border-gray-300 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                  }`}
                  title={lowStock ? `${product.variants.find((v) => v.size === size)?.available} left` : undefined}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        {colorsForSize.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Select Color</p>
            <div className="flex flex-wrap gap-2">
              {colorsForSize.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border ${
                    selectedColor === color
                      ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                      : "border-gray-300 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Quantity</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="-"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-[#383838] font-bold disabled:opacity-30"
            >
              -
            </button>
            <span className="font-mono w-6 text-center">{quantity}</span>
            <button
              type="button"
              aria-label="+"
              disabled={!!selectedVariant && quantity >= selectedVariant.available}
              onClick={() =>
                setQuantity((q) => (selectedVariant ? Math.min(selectedVariant.available, q + 1) : q))
              }
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-[#383838] font-bold disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            disabled={!selectedVariant}
            onClick={() => selectedVariant && onAddToCart(product, selectedVariant.id, quantity)}
            className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to Cart — {formatKobo(displayPrice * quantity)}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
