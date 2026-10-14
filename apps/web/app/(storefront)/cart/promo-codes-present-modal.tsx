"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CartItem } from "../_components/cart-context";

interface EligibleCartItemPreview {
  item: CartItem;
  discountPercent: number;
  originalPrice: number;
  discountedPrice: number;
}

interface PromoCodesPresentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUse: () => void;
  eligibleItems: EligibleCartItemPreview[];
  oldCumulativePrice: number;
  newCumulativePrice: number;
  appliedPromoCount: number;
}

export default function PromoCodesPresentModal({
  isOpen,
  onClose,
  onUse,
  eligibleItems,
  oldCumulativePrice,
  newCumulativePrice,
  appliedPromoCount,
}: PromoCodesPresentModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      {/* Full Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl mx-auto mb-3">
            🏷️
          </div>
          <h2 className="text-xl font-black text-[#010101] tracking-tight">
            Promo Codes Present
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            You have active promotional discounts waiting for items currently in your shopping cart!
          </p>
        </div>

        {/* Small Grid with Item Pictures & Dark Overlays with Discount Percentage */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {eligibleItems.map((entry, idx) => {
              const imgUrl = entry.item.product.image;
              return (
                <div
                  key={`${entry.item.product.id}-${idx}`}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-2xs group"
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={entry.item.product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      GTS
                    </div>
                  )}

                  {/* Dark Overlay with Discount Percentage */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-2 text-white">
                    <span className="text-lg sm:text-xl font-black tracking-tight text-[#EDCF5D] drop-shadow-sm">
                      -{entry.discountPercent}%
                    </span>
                    <span className="text-[10px] font-bold line-clamp-1 mt-0.5 text-gray-200">
                      {entry.item.product.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cumulative Price Slashed at the Bottom */}
          <div className="mt-6 p-4 rounded-2xl bg-[#F9F8F5] border border-gray-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">
              New Cart Total:
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-sm font-semibold text-gray-400 line-through">
                ₦{oldCumulativePrice.toLocaleString()}
              </span>
              <span className="text-xl font-black text-[#010101]">
                ₦{newCumulativePrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Use or Later */}
        <div className="px-6 pb-6 pt-1 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Later
          </button>

          <button
            type="button"
            onClick={() => {
              onUse();
              onClose();
            }}
            className="w-full py-3 rounded-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Use ({appliedPromoCount || "Discounts"})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
