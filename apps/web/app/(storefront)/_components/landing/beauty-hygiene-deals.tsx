"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { ProductCard } from "../ui/product-card";
import { useCatalogue } from "../catalogue-context";

export function BeautyHygieneDeals({ categorySlug }: { categorySlug?: string } = {}) {
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { products: catalogue } = useCatalogue();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Beauty and hygiene products come from the shared catalogue (the database).
  const sourceProducts = useMemo(() => {
    return catalogue.filter((p) => {
      if (categorySlug) {
        const catNorm = categorySlug.toLowerCase().replace(/[-_]/g, " ");
        return (
          p.category.toLowerCase().includes(catNorm) ||
          p.subCategory.toLowerCase().includes(catNorm)
        );
      }
      return (
        p.category === "Health & Beauty" ||
        p.category === "Beauty" ||
        p.tags.some((t) => ["beauty", "hygiene", "beauty hygiene deals"].includes(t.toLowerCase()))
      );
    });
  }, [catalogue, categorySlug]);

  const updateScrollState = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      updateScrollState();
      container.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        container.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, [sourceProducts]);

  const toggleWishlist = (id: string) => {
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -290, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 290, behavior: "smooth" });
    }
  };

  return (
    <section className="w-full px-3 md:px-4 pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4 md:pb-5">
      <div className="max-w-[1240px] mx-auto">
        {/* ── Section Header ── */}
        <div className="flex justify-between items-end mb-4 sm:mb-5">
          <div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
              Beauty & Hygiene <span className="text-[#EDCF5D] font-bold">✦</span>
              <span className="font-serif italic font-bold text-[#010101]">Deals</span>
            </h2>
          </div>

          <Link
            href={`/search?category=${encodeURIComponent(categorySlug || "Health & Beauty")}`}
            className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
          >
            <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
              View all deals
            </span>
            <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
          </Link>
        </div>

        {/* ── Cards Carousel Row ── */}
        <div className="relative group overflow-hidden">
          {/* Left Fade Overlay */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
              canScrollLeft ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Left Arrow Button */}
          <button
            aria-label="Previous beauty products"
            onClick={handleScrollLeft}
            className={`absolute left-3 sm:left-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
              canScrollLeft ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Scrollable Products Row */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth no-scrollbar py-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {sourceProducts.map((product) => {
              const isWishlisted = wishlisted[product.id];
              return (
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
                  isWishlisted={isWishlisted}
                  onToggleWishlist={toggleWishlist}
                  className="w-[160px] sm:w-[175px] md:w-[185px] max-w-[190px] shrink-0"
                />
              );
            })}
          </div>

          {/* Right Fade Overlay */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
              canScrollRight ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Right Arrow Button */}
          <button
            aria-label="Next beauty products"
            onClick={handleScrollRight}
            className={`absolute right-3 sm:right-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
              canScrollRight ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
