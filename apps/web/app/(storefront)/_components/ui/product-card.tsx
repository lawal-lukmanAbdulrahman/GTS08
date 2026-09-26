"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "../cart-context";
import { useWishlist } from "../wishlist-context";
import { useCatalogue } from "../catalogue-context";
import { saveRecentlyViewed } from "../landing/search-history";
import { trackProductClick, trackProductWishlist, trackProductCart } from "../../_lib/analytics";

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
  inStock?: boolean;
  availableStock?: number;
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
  inStock,
  availableStock,
  onToggleWishlist,
  onAddToCart,
  showAddToCart = true,
  showWishlistButton = true,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { products: catalogue } = useCatalogue();

  const matchingProduct = catalogue.find((p) => p.id === id);
  const isOutOfStock =
    inStock === false ||
    availableStock === 0 ||
    (matchingProduct && (matchingProduct.inStock === false || (typeof matchingProduct.availableStock === "number" && matchingProduct.availableStock <= 0)));

  // Resolve transparent background:
  // 1. If explicit boolean passed, use it.
  // 2. Otherwise look it up in the catalogue.
  // 3. Fallback: check image path for transparent formats (.png, transparent)
  const isTransparent =
    (typeof hasTransparentBg === "boolean" && hasTransparentBg) ||
    Boolean(catalogue.find((p) => p.id === id)?.hasTransparentBg) ||
    (typeof image === "string" &&
      (image.toLowerCase().endsWith(".png") ||
        image.toLowerCase().includes("transparent") ||
        image.toLowerCase().includes(".png?")));

  const isWishlisted =
    externalIsWishlisted !== undefined ? externalIsWishlisted : isInWishlist(id);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackProductWishlist(id, !isWishlisted ? "add" : "remove");
    if (onToggleWishlist) {
      onToggleWishlist(id);
    } else {
      toggleWishlist(id);
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    trackProductCart(id);
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
        inStock: !isOutOfStock,
        availableStock: availableStock ?? 0,
      };

      const res = addToCart(fullProduct);
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }
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
          trackProductClick(id, "product_card");
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
          className="relative w-full aspect-[4/4.2] rounded-[14px] overflow-hidden flex items-center justify-center border border-gray-200/80"
          style={
            isTransparent
              ? { background: "radial-gradient(ellipse at center, #F4F3F0 0%, #E7E5E0 100%)" }
              : { background: "#F2F0EA" }
          }
        >
          {/* Top-Left Sold Out Badge */}
          {isOutOfStock && (
            <span className="absolute top-2 left-2 z-20 bg-[#010101]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase shadow-xs">
              Sold Out
            </span>
          )}

          {/* Top-Right Discount Badge — matching hero section */}
          {badge && !isOutOfStock && (
            <span
              className="absolute top-0 right-0 z-20 bg-[#EDCF5D] text-[#010101] text-[10px] sm:text-xs font-extrabold px-2 sm:px-2.5 py-0.5 sm:py-1 tracking-wider shadow-2xs"
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
              className="absolute bottom-2.5 right-2.5 z-20 bg-[#010101] text-white p-2 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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

          {/* Centered Product Image with proper internal padding */}
          <div
            className={`absolute inset-0 flex items-center justify-center z-10 ${
              isTransparent ? "p-3.5 sm:p-4.5" : "p-0"
            }`}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={image}
                alt={title}
                fill
                className={`transition-transform duration-500 group-hover/card:scale-105 ${
                  isOutOfStock ? "opacity-60 grayscale-[30%]" : ""
                } ${
                  isTransparent
                    ? "object-contain object-center"
                    : "object-cover object-center"
                }`}
                sizes="(max-width: 768px) 50vw, 20vw"
              />
            </div>
          </div>
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
            aria-label={isOutOfStock ? "Out of stock" : "Add to cart"}
            disabled={isOutOfStock}
            onClick={isOutOfStock ? undefined : handleCartClick}
            className={`w-full font-semibold text-xs py-1.5 rounded-full flex items-center justify-center gap-1.5 shadow-2xs transition-all duration-300 font-sans ${
              isOutOfStock
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                : added
                ? "bg-emerald-600 text-white"
                : "bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] active:scale-95 cursor-pointer"
            }`}
          >
            {isOutOfStock ? "Out of stock" : added ? "Added!" : "Add to cart"}
          </button>
        </div>
      )}
    </div>
  );
}
