"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductCard } from "../ui/product-card";

interface Product {
  id: string;
  badge?: string;
  title: string;
  price: string;
  originalPrice?: string;
  rating: number;
  reviews: string;
  image: string;
}

const PRODUCTS: Product[] = [
  {
    id: "na-1",
    badge: "50% OFF",
    title: "Urban Classic Denim Jacket",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.8,
    reviews: "1.2k",
    image: "/products/denim_jacket.png",
  },
  {
    id: "na-2",
    badge: "50% OFF",
    title: "Classic Oxford Shirt",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.9,
    reviews: "850",
    image: "/products/oxford_shirt.png",
  },
  {
    id: "na-3",
    badge: "50% OFF",
    title: "Premium Streetwear Hoodie",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.7,
    reviews: "2.1k",
    image: "/products/hoodie.png",
  },
  {
    id: "na-4",
    badge: "50% OFF",
    title: "Urban Tailored Linen Coat",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.9,
    reviews: "1.5k",
    image: "/products/linen_coat.png",
  },
];

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
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});

  const toggleWishlist = (id: string) => {
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="w-full px-3 md:px-4 pt-1 sm:pt-2 md:pt-3 pb-3 sm:pb-10 md:pb-12">
      {/* ── Crossed Banner Strips Marquee Wrapper (New Arrivals Full Bleed Edge-to-Edge) ── */}
      <div className="relative -mx-3 md:-mx-4 w-[calc(100%+1.5rem)] md:w-[calc(100%+2rem)] overflow-hidden my-6 sm:my-10 py-12 sm:py-16 flex items-center justify-center select-none bg-white">
        {/* Strip 1: Angled Upwards (-rotate-3), Sliding Left */}
        <div className="absolute w-[150%] -left-[25%] bg-[#010101] text-white py-3 sm:py-4.5 border-y border-white -rotate-3 sm:-rotate-4 z-10 flex items-center overflow-hidden">
          <div className="animate-marquee-infinite flex items-center whitespace-nowrap text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight uppercase font-sans">
            {[1, 2].map((groupKey) => (
              <div key={groupKey} className="flex items-center">
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

        {/* Strip 2: Angled Downwards (rotate-3), Sliding Right */}
        <div className="absolute w-[150%] -left-[25%] bg-[#010101] text-white py-3 sm:py-4.5 border-y border-white rotate-3 sm:rotate-4 z-20 flex items-center overflow-hidden">
          <div className="animate-marquee-reverse flex items-center whitespace-nowrap text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight uppercase font-sans">
            {[1, 2].map((groupKey) => (
              <div key={groupKey} className="flex items-center">
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
      {/* ── Section Header matching Crazy Finds & Bestsellers ── */}
      <div className="flex justify-between items-end mb-4 sm:mb-5">
        <div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Fresh Season <span className="text-[#EDCF5D] font-bold">✦</span>
            <span className="font-serif italic font-bold text-[#010101]">New Arrivals</span>
          </h2>
        </div>

        {/* See More Link */}
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

      {/* ── Grid Layout: Compact 2x2 Products (Left) + Promo Banner (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4.5 items-stretch">
        
        {/* Left Side: Compact 2x2 Product Grid */}
        <div className="lg:col-span-6 xl:col-span-6 grid grid-cols-2 gap-3 sm:gap-4">
          {PRODUCTS.map((product) => {
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
                isWishlisted={isWishlisted}
                onToggleWishlist={toggleWishlist}
                className="w-full max-w-[230px] sm:max-w-[250px] md:max-w-[270px] justify-self-center"
              />
            );
          })}
        </div>

        {/* Right Side: Compact Promo Banner */}
        <div className="lg:col-span-6 xl:col-span-6 min-h-[300px] sm:min-h-[340px] lg:min-h-full rounded-[14px] overflow-hidden relative group/banner flex flex-col justify-end p-5 sm:p-7 border border-gray-200/60 shadow-xs">
          {/* Background Image */}
          <Image
            src="/banner_img.jpg"
            alt="Enjoy 50% Off Promo"
            fill
            className="object-cover object-center group-hover/banner:scale-105 transition-transform duration-700"
            sizes="(max-width: 1024px) 100vw, 40vw"
          />

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent z-10 pointer-events-none" />

          {/* Banner Content */}
          <div className="relative z-20 text-center flex flex-col items-center max-w-xs sm:max-w-sm mx-auto">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-serif leading-tight mb-2 tracking-tight text-white">
              Enjoy 50% Off Your First{" "}
              <span className="font-serif italic font-bold text-white">
                GTS Order
              </span>
            </h3>

            <p className="text-xs text-gray-200/90 font-light leading-relaxed mb-4">
              Join GTS today and unlock exclusive member savings on curated modern fashion designed to elevate your everyday look.
            </p>

            <Link
              href="/shop"
              className="inline-block px-6 py-2 rounded-full border border-white/70 text-white hover:bg-white hover:text-black transition-all text-xs font-medium backdrop-blur-xs tracking-wide shadow-xs"
            >
              Shop Collection
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
