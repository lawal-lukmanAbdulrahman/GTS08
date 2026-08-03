"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ProductCard } from "../ui/product-card";

interface CrazyFindProduct {
  id: string;
  badge?: string;
  title: string;
  price: string;
  originalPrice?: string;
  rating: number;
  reviews: string;
  image: string;
}

const CRAZY_FINDS: CrazyFindProduct[] = [
  {
    id: "cf-1",
    badge: "HOT",
    title: "Crispy Air Fryer Pro",
    price: "₦85,000",
    originalPrice: "₦120,000",
    rating: 4.9,
    reviews: "3.4k",
    image: "/products/airfryer.png",
  },
  {
    id: "cf-2",
    badge: "20% OFF",
    title: "Smart Four-Door Fridge",
    price: "₦750,000",
    originalPrice: "₦940,000",
    rating: 4.8,
    reviews: "1.1k",
    image: "/products/four_fridge.png",
  },
  {
    id: "cf-3",
    title: "Breezy Linen Summer Shirt",
    price: "₦28,000",
    originalPrice: "₦45,000",
    rating: 4.7,
    reviews: "920",
    image: "/products/linen.png",
  },
  {
    id: "cf-4",
    badge: "LIMITED",
    title: "Spider-Man 2 PS5 Console",
    price: "₦320,000",
    originalPrice: "₦380,000",
    rating: 5.0,
    reviews: "2.7k",
    image: "/products/spiderman_ps5.png",
  },
  {
    id: "cf-5",
    badge: "NEW",
    title: "Google Pixel 10 Pro Phone",
    price: "₦620,000",
    originalPrice: "₦720,000",
    rating: 4.9,
    reviews: "1.8k",
    image: "/products/pixel_10.png",
  },
];

export function CrazyFinds() {
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleWishlist = (id: string) => {
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
  }, []);

  const handleScrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" });
  };

  return (
    <section className="w-full px-3 md:px-4 pt-6 sm:pt-2 md:pt-3 pb-10 sm:pb-12 md:pb-16">
      {/* ── Section Header ── */}
      <div className="flex justify-between items-end mb-5 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Mind Blowing <span className="text-[#EDCF5D] font-bold">✧</span>
            <span className="font-serif italic font-bold text-[#010101]">Crazy Finds</span>
          </h2>
        </div>

        <Link
          href="/shop"
          className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
        >
          <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
            See more
          </span>
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

      {/* ── Cards Carousel Row — matches Bestsellers layout exactly ── */}
      <div className="relative group overflow-hidden">
        {/* Left Fade Overlay */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Left Arrow */}
        <button
          aria-label="Previous finds"
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
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth no-scrollbar py-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CRAZY_FINDS.map((product) => (
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
              isWishlisted={wishlisted[product.id]}
              onToggleWishlist={toggleWishlist}
              className="w-[230px] sm:w-[250px] md:w-[270px] shrink-0"
            />
          ))}
        </div>

        {/* Right Fade Overlay */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Right Arrow */}
        <button
          aria-label="Next finds"
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
    </section>
  );
}
