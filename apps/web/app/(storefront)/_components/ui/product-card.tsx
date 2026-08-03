"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export interface ProductCardProps {
  id: string;
  title: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  rating: number;
  reviews: string;
  image: string;
  className?: string;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  onAddToCart?: (id: string) => void;
}

/** Convert "₦450,000" → "₦450K", "₦1,200,000" → "₦1.2M" */
function formatCompactPrice(price: string): string {
  const currencyMatch = price.match(/^[^\d]+/);
  const currency = currencyMatch ? currencyMatch[0] : "";
  const num = parseFloat(price.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return price;
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${currency}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (num >= 1_000) return `${currency}${Math.round(num / 1_000)}K`;
  return price;
}

export function ProductCard({
  id,
  title,
  price,
  originalPrice,
  badge,
  image,
  className = "",
  isWishlisted: externalIsWishlisted,
  onToggleWishlist,
  onAddToCart,
}: ProductCardProps) {
  const [internalWishlisted, setInternalWishlisted] = useState(false);
  const [qty, setQty] = useState(1);

  const isWishlisted =
    externalIsWishlisted !== undefined ? externalIsWishlisted : internalWishlisted;

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(id);
    } else {
      setInternalWishlisted((prev) => !prev);
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) onAddToCart(id);
  };

  const compactPrice = formatCompactPrice(price);
  const compactOriginal = originalPrice ? formatCompactPrice(originalPrice) : undefined;
  const productSlug = id && id !== "1" ? id : "air-jordan-1";

  return (
    <div className={`flex flex-col group/card transition-all duration-300 ${className}`}>
      {/* Clickable Image & Title Area linking to Product Detail Page */}
      <Link href={`/product/${productSlug}`} className="flex flex-col flex-1">
        {/* ── Image Box ── */}
        <div
          className="relative w-full aspect-[4/4.2] rounded-[14px] overflow-hidden flex items-center justify-center p-6 border border-gray-200/80"
          style={{ background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }}
        >
          {/* Top-Right Discount Badge — matching hero section */}
          {badge && (
            <span
              className="absolute top-0 right-0 z-10 bg-[#EDCF5D] text-[#010101] text-xs sm:text-sm font-extrabold px-3 py-1.5 tracking-wide shadow-xs"
              style={{ borderRadius: "0 0 0 14px" }}
            >
              {badge}
            </span>
          )}

          {/* Bottom-Right Wishlist Button */}
          <button
            aria-label="Add to wishlist"
            onClick={handleWishlistClick}
            className="absolute bottom-2.5 right-2.5 z-10 bg-[#010101] text-white p-2 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          >
            <svg
              className="w-4 h-4 transition-colors"
              fill={isWishlisted ? "#EDCF5D" : "none"}
              stroke={isWishlisted ? "#EDCF5D" : "currentColor"}
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>

          {/* Product Image */}
          <Image
            src={image}
            alt={title}
            fill
            className="object-contain object-center p-6 group-hover/card:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 30vw"
          />
        </div>

        {/* ── Card Body ── */}
        <div className="pt-2.5 flex flex-col flex-1 items-center text-center gap-2">
          {/* Title — grows to push stepper+btn to the bottom */}
          <h3 className="w-full flex-1 text-sm sm:text-[15px] font-semibold text-[#010101] leading-snug line-clamp-2 text-center group-hover/card:text-[#010101]">
            {title}
          </h3>

          {/* Compact Price — centered, large */}
          <div className="flex items-baseline justify-center gap-2 w-full">
            <span className="text-xl sm:text-2xl font-extrabold text-[#010101] tracking-tight">
              {compactPrice}
            </span>
            {compactOriginal && (
              <span className="text-xs sm:text-sm text-[#A4A4A4] line-through font-normal">
                {compactOriginal}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ── Stepper and Buy Now Button ── */}
      <div className="pt-2.5 flex flex-col items-center gap-2">
        {/* Quantity Stepper */}
        <div className="flex items-center justify-center gap-3 w-full">
          <button
            aria-label="Decrease quantity"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty((q) => Math.max(1, q - 1)); }}
            className="w-8 h-8 rounded-xl bg-[#F2F0EA] hover:bg-[#EAE7DF] text-[#010101] flex items-center justify-center transition-all active:scale-90 shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>

          <span className="text-base font-bold text-[#010101] min-w-[20px] text-center tabular-nums">
            {qty}
          </span>

          <button
            aria-label="Increase quantity"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty((q) => q + 1); }}
            className="w-8 h-8 rounded-xl bg-[#F2F0EA] hover:bg-[#EAE7DF] text-[#010101] flex items-center justify-center transition-all active:scale-90 shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Buy Now Button */}
        <button
          aria-label="Buy now"
          onClick={handleCartClick}
          className="w-full bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-semibold text-xs sm:text-sm py-2 rounded-full flex items-center justify-center gap-1.5 shadow-xs transition-all duration-300 active:scale-95"
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
