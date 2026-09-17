"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { useWishlist } from "../_components/wishlist-context";
import { useCart } from "../_components/cart-context";
import { ProductCard } from "../_components/ui/product-card";
import { Footer } from "../_components/landing/footer";
import { REAL_PRODUCTS } from "../_data/products";

export default function WishlistPage() {
  const { wishlistItems, wishlistCount, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleMoveAllToCart = () => {
    wishlistItems.forEach((product) => {
      addToCart(product);
    });
  };

  // Trending recommendations for popular products carousel
  const recommendedProducts = REAL_PRODUCTS.slice(0, 10);

  // ── Carousel scroll state ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      updateScrollState();
      el.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        el.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, []);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -290, behavior: "smooth" });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 290, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white text-[#010101] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-6 select-none">
          <Link href="/" className="hover:text-[#010101] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#010101] font-bold">Wishlist</span>
        </nav>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-gray-200/80 mb-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#010101] tracking-tight">
              My Wishlist
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">
              {wishlistCount} {wishlistCount === 1 ? "saved item" : "saved items"} in your personal collection
            </p>
          </div>

          {wishlistCount > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleMoveAllToCart}
                className="px-4 py-2 rounded-full bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Add All to Cart
              </button>

              <button
                onClick={clearWishlist}
                className="px-4 py-2 rounded-full bg-white text-gray-700 hover:text-red-600 border border-gray-300 hover:border-red-300 text-xs font-semibold transition-all shadow-2xs"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* ── Wishlist Grid — divider grid style (2 cols mobile, 3 sm+, 4 lg+) ── */}
        {wishlistCount > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-b border-gray-100 divide-x divide-y divide-gray-100 mb-16 -mx-4 sm:-mx-6 lg:-mx-8">
            {wishlistItems.map((product) => (
              <div
                key={product.id}
                className="flex flex-col items-center justify-between py-4 sm:py-5 px-1.5 sm:px-3 bg-white hover:bg-[#FAFAF8] transition-colors"
              >
                <ProductCard
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  originalPrice={product.originalPrice}
                  badge={product.badge}
                  rating={product.rating}
                  reviews={product.reviews}
                  image={product.image}
                  hasTransparentBg={product.hasTransparentBg}
                  showAddToCart={false}
                  showWishlistButton={false}
                  className="w-full max-w-[165px] sm:max-w-[190px]"
                />

                {/* Action buttons */}
                <div className="mt-2 flex items-center gap-2 w-full px-1">
                  <button
                    onClick={() => addToCart(product)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add to Cart
                  </button>

                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    aria-label="Remove from wishlist"
                    className="p-2 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all shrink-0 active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Empty Wishlist State ── */
          <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4 mb-16 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#F2F0EA] flex items-center justify-center mb-5 text-[#010101]">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#010101] mb-2">
              Your Wishlist is Empty
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-6 font-medium leading-relaxed">
              Explore our catalog and save your favorite fashion, electronics, and lifestyle pieces for later.
            </p>
            <Link
              href="/search"
              className="px-7 py-3 rounded-full bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              Start Exploring
              <span>→</span>
            </Link>
          </div>
        )}

        {/* ── Popular Products — Horizontal Carousel with Fade + Arrows ── */}
        <div className="pt-10 border-t border-gray-200/80">
          <div className="flex items-center justify-between mb-5 sm:mb-6 px-0">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#A4A4A4] block">
                DISCOVER MORE
              </span>
              <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
                Popular Products <span className="text-[#EDCF5D] font-bold">✦</span>
                <span className="font-serif italic font-bold text-[#010101]">You Might Like</span>
              </h2>
            </div>
            <Link
              href="/search"
              className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
            >
              <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">View all</span>
              <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
            </Link>
          </div>

          {/* Carousel */}
          <div className="relative group overflow-hidden">
            {/* Left fade */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
                canScrollLeft ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Left arrow */}
            <button
              aria-label="Scroll left"
              onClick={scrollLeft}
              className={`absolute left-3 sm:left-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
                canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Scrollable row */}
            <div
              ref={scrollRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth no-scrollbar py-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {recommendedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  originalPrice={product.originalPrice}
                  badge={product.badge}
                  rating={product.rating}
                  reviews={product.reviews}
                  image={product.image}
                  hasTransparentBg={product.hasTransparentBg}
                  className="w-[160px] sm:w-[175px] md:w-[185px] max-w-[190px] shrink-0"
                />
              ))}
            </div>

            {/* Right fade */}
            <div
              className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
                canScrollRight ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Right arrow */}
            <button
              aria-label="Scroll right"
              onClick={scrollRight}
              className={`absolute right-3 sm:right-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
                canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
