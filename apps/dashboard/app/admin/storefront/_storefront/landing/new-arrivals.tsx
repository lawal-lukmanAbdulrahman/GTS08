"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo } from "react";
import { ProductCard } from "../ui/product-card";
import { useCatalogue } from "../catalogue-context";

function SparkleStar() {
  return (
    <svg
      className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-current inline-block mx-4 sm:mx-6 shrink-0"
      viewBox="0 0 24 24"
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

export function NewArrivals() {
  const { products: catalogue } = useCatalogue();
  const PRODUCTS = useMemo(() => catalogue.filter((p) => p.category === "Fashion").slice(0, 6), [catalogue]);
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const toggleWishlist = (id: string) =>
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="w-full pt-1 sm:pt-2 md:pt-3 pb-3 sm:pb-10 md:pb-12">

      {/* ── Crossed Banner Strips Marquee — full bleed ── */}
      <div className="relative w-full overflow-hidden my-6 sm:my-10 py-12 sm:py-16 flex items-center justify-center select-none bg-white">
        {/* Strip 1: angled upward, slides left */}
        <div className="absolute w-[150%] -left-[25%] bg-[#010101] text-white py-3 sm:py-4.5 border-y border-white -rotate-3 sm:-rotate-4 z-10 flex items-center overflow-hidden">
          <div className="animate-marquee-infinite flex items-center whitespace-nowrap text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight uppercase font-sans">
            {[1, 2].map((k) => (
              <div key={k} className="flex items-center">
                <span className="text-white">NEW ARRIVALS</span>
                <SparkleStar />
                <span className="text-white font-serif italic">JUST DROPPED</span>
                <SparkleStar />
                <span className="text-[#EDCF5D]">FRESH SEASON STYLES</span>
                <SparkleStar />
                <span className="text-white">EXPLORE NEW ARRIVALS</span>
                <SparkleStar />
              </div>
            ))}
          </div>
        </div>
        {/* Strip 2: angled downward, slides right */}
        <div className="absolute w-[150%] -left-[25%] bg-[#010101] text-white py-3 sm:py-4.5 border-y border-white rotate-3 sm:rotate-4 z-20 flex items-center overflow-hidden">
          <div className="animate-marquee-reverse flex items-center whitespace-nowrap text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight uppercase font-sans">
            {[1, 2].map((k) => (
              <div key={k} className="flex items-center">
                <span className="text-[#EDCF5D]">DISCOVER NEW ARRIVALS</span>
                <SparkleStar />
                <span className="text-white">EXCLUSIVE DROPS</span>
                <SparkleStar />
                <span className="text-white font-serif italic">CURATED FASHION</span>
                <SparkleStar />
                <span className="text-gray-200">ALWAYS AHEAD</span>
                <SparkleStar />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section Header & Grid Container matching FAQ padding ── */}
      <div className="w-full px-3 md:px-4">
        <div className="max-w-[1240px] mx-auto">
          {/* Section Header */}
          <div className="flex justify-between items-end mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
              Fresh Season <span className="text-[#EDCF5D] font-bold">✦</span>
              <span className="font-serif italic font-bold text-[#010101]">New Arrivals</span>
            </h2>
            <Link
              href="/search"
              className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
            >
              <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">See more</span>
              <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
            </Link>
          </div>

          {/* 3×2 grid + promo banner */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] items-stretch rounded-2xl overflow-hidden border border-gray-100">
            {/* Left: 2 cols on mobile, 3 cols on sm+ product grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-gray-100">
              {PRODUCTS.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-center py-4 sm:py-5 px-1.5 sm:px-3 bg-white hover:bg-[#FAFAF8] transition-colors"
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
                    isWishlisted={wishlisted[product.id]}
                    onToggleWishlist={toggleWishlist}
                    className="w-full max-w-[165px] sm:max-w-[190px]"
                  />
                </div>
              ))}
            </div>

            {/* Right: promo banner — hidden on mobile, shown lg+ */}
            <div className="hidden lg:flex relative group/banner flex-col justify-end p-6 sm:p-8 border-l border-gray-100 overflow-hidden">
              <Image
                src="/banner_img.jpg"
                alt="Enjoy 50% Off Promo"
                fill
                className="object-cover object-center group-hover/banner:scale-105 transition-transform duration-700"
                sizes="380px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent z-10 pointer-events-none" />
              <div className="relative z-20 text-center flex flex-col items-center">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-serif leading-tight mb-2 tracking-tight text-white">
                  Enjoy 50% Off Your First{" "}
                  <span className="font-serif italic font-bold">GTS Order</span>
                </h3>
                <p className="text-xs text-gray-200/90 font-light leading-relaxed mb-4 max-w-[220px]">
                  Join GTS today and unlock exclusive member savings on curated modern fashion.
                </p>
                <Link
                  href="/search"
                  className="inline-block px-6 py-2 rounded-full border border-white/70 text-white hover:bg-white hover:text-black transition-all text-xs font-medium tracking-wide"
                >
                  Shop Collection
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
