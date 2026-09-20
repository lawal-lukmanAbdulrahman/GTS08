"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "../cart-context";
import { useWishlist } from "../wishlist-context";
import { useCatalogue } from "../catalogue-context";
import { saveRecentlyViewed } from "../landing/search-history";

export interface ProductCardProps {
  id: string;
  title: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  rating?: number;
  reviews?: string;
  image: string;
  hasTransparentBg?: boolean;
  className?: string;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  showAddToCart?: boolean;
  showWishlistButton?: boolean;
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
  hasTransparentBg,
  className = "",
  isWishlisted: externalIsWishlisted,
  onToggleWishlist,
  onAddToCart,
  showAddToCart = true,
  showWishlistButton = true,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const cartContext = useCart();
  const addToCart = cartContext?.addToCart;
  const wishlistContext = useWishlist();
  const isInWishlist = wishlistContext?.isInWishlist;
  const toggleWishlist = wishlistContext?.toggleWishlist;
  const { products: catalogue } = useCatalogue();

  // Resolve transparent background:
  // 1. If explicit boolean passed, use it.
  // 2. Otherwise look it up in the catalogue.
  // 3. Fallback to false (no padding, full bleed cover)
  const isTransparent =
    typeof hasTransparentBg === "boolean"
      ? hasTransparentBg
      : (catalogue.find((p) => p.id === id)?.hasTransparentBg ?? false);

  const isWishlisted =
    externalIsWishlisted !== undefined
      ? externalIsWishlisted
      : (typeof isInWishlist === "function" ? isInWishlist(id) : false);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(id);
    } else if (typeof toggleWishlist === "function") {
      toggleWishlist(id);
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(id);
    } else {
      // Find full product or construct item
      const fullProduct = catalogue.find((p) => p.id === id) || {
        id,
        brand: "GTS",
        sku: id,
        title,
        price,
        originalPrice,
        priceNum: parseFloat(price.replace(/[^\d.]/g, "")) || 0,
        badge,
        rating: 4.8,
        reviewsCount: 120,
        reviews: "120",
        description: title,
        category: "General",
        subCategory: "All",
        image,
        images: [{ color: "default", label: "Default", main: image, thumbnails: [image] }],
        sizes: ["Standard"],
        tags: [],
        hasTransparentBg: isTransparent,
      };

      if (typeof addToCart === "function") {
        addToCart(fullProduct);
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

  const compactPrice = formatCompactPrice(price);
  const compactOriginal = originalPrice ? formatCompactPrice(originalPrice) : undefined;
  const productSlug = id || "air-jordan-1";

  return (
    <div className={`flex flex-col group/card transition-all duration-300 ${className}`}>
      {/* Clickable Image & Title Area linking to Product Detail Page */}
      <Link
        href={`/product/${productSlug}`}
        onClick={() => {
          saveRecentlyViewed({
            id,
            slug: productSlug,
            title,
            price,
            discountBadge: badge,
            image,
          });
        }}
        className="flex flex-col flex-1"
      >
        {/* ── Image Box ── */}
        <div
          className={`relative w-full aspect-[4/4.2] rounded-[14px] overflow-hidden flex items-center justify-center border border-gray-200/80 ${
            isTransparent ? "p-3 sm:p-3.5" : "p-0"
          }`}
          style={
            isTransparent
              ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
              : { background: "#F2F0EA" }
          }
        >
          {/* Top-Right Discount Badge — matching hero section */}
          {badge && (
            <span
              className="absolute top-0 right-0 z-10 bg-[#EDCF5D] text-[#010101] text-[10px] sm:text-xs font-extrabold px-2 sm:px-2.5 py-0.5 sm:py-1 tracking-wider shadow-2xs"
              style={{ borderRadius: "0 0 0 10px" }}
            >
              {badge}
            </span>
          )}

          {/* Bottom-Right Wishlist Button */}
          {showWishlistButton && (
            <button
              aria-label="Add to wishlist"
              onClick={handleWishlistClick}
              className="absolute bottom-2.5 right-2.5 z-10 bg-[#010101] text-white p-2 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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
          )}

          {/* Product Image */}
          <Image
            src={image}
            alt={title}
            fill
            className={`transition-transform duration-500 group-hover/card:scale-105 ${
              isTransparent
                ? "object-contain object-center"
                : "object-cover object-center p-0"
            }`}
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        </div>

        {/* ── Card Body ── */}
        <div className="pt-2 flex flex-col flex-1 items-center text-center gap-1">
          {/* Title — fixed height so all card prices & buttons align horizontally */}
          <div className="w-full h-8 sm:h-9 flex items-center justify-center">
            <h3
              title={title}
              className="w-full text-xs sm:text-sm font-semibold text-[#010101] leading-tight line-clamp-2 text-center group-hover/card:text-[#010101]"
            >
              {title}
            </h3>
          </div>

          {/* Compact Price — refined smaller font */}
          <div className="flex items-baseline justify-center gap-1.5 w-full">
            <span className="text-base sm:text-lg font-extrabold text-[#010101] tracking-tight">
              {compactPrice}
            </span>
            {compactOriginal && (
              <span className="text-[11px] sm:text-xs text-[#A4A4A4] line-through font-normal">
                {compactOriginal}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ── Add to Cart Button ── */}
      {showAddToCart && (
        <div className="pt-2 flex flex-col items-center">
          <button
            aria-label="Add to cart"
            onClick={handleCartClick}
            className={`w-full font-semibold text-xs py-1.5 rounded-full flex items-center justify-center gap-1.5 shadow-2xs transition-all duration-300 active:scale-95 font-sans ${
              added
                ? "bg-emerald-600 text-white"
                : "bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101]"
            }`}
          >
            {added ? "Added!" : "Add to cart"}
          </button>
        </div>
      )}
    </div>
  );
}
