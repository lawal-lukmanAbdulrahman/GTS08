"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ProductCard } from "../ui/product-card";

interface Product {
  id: string;
  badge?: string;
  title: string;
  price: string;
  originalPrice?: string;
  rating: number;
  reviews: string;
  category: string;
  image: string;
}

const PRODUCTS: Product[] = [
  {
    id: "1",
    badge: "15% OFF",
    title: "Night Serum for Sensitive Skin",
    price: "₦9,490",
    originalPrice: "₦12,880",
    rating: 4.8,
    reviews: "1k Review",
    category: "Serum",
    image: "/products/blender-removebg-preview.png",
  },
  {
    id: "2",
    title: "Acne Cream Green Tea Extract",
    price: "₦10,980",
    rating: 4.9,
    reviews: "2k Review",
    category: "Moisturizer",
    image: "/products/pot-removebg-preview.png",
  },
  {
    id: "3",
    badge: "15% OFF",
    title: "Hair Shampoo Treatment",
    price: "₦19,860",
    originalPrice: "₦15,480",
    rating: 5.0,
    reviews: "1k Review",
    category: "Shampoo",
    image: "/products/juicer-removebg-preview.png",
  },
  {
    id: "4",
    title: "Face Serum for Normal Skin",
    price: "₦12,970",
    rating: 4.9,
    reviews: "2k Review",
    category: "Serum",
    image: "/products/microwave-removebg-preview.png",
  },
  {
    id: "5",
    badge: "20% OFF",
    title: "Hydrating Sunscreen Lotion SPF 50",
    price: "₦14,500",
    originalPrice: "₦18,000",
    rating: 4.7,
    reviews: "850 Review",
    category: "Sunscreen",
    image: "/products/standing_fan-removebg-preview.png",
  },
  {
    id: "6",
    title: "Eco Herbal Cleansing Soap Bar",
    price: "₦8,250",
    rating: 4.9,
    reviews: "3k Review",
    category: "Soap",
    image: "/products/toasters-removebg-preview.png",
  },
  {
    id: "7",
    badge: "15% OFF",
    title: "Revitalizing Collagen Eye Mask Set",
    price: "$22.00",
    originalPrice: "$26.00",
    rating: 4.8,
    reviews: "1.2k Review",
    category: "Eye Mask",
    image: "/products/tv-removebg-preview.png",
  },
  {
    id: "8",
    title: "Nourishing Organic Lip Balm",
    price: "$6.99",
    rating: 4.9,
    reviews: "4k Review",
    category: "Lip Balm",
    image: "/products/blender-removebg-preview (1).png",
  },
];

export function Bestsellers() {
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  }, []);

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
    <section className="w-full px-3 md:px-4 pt-3 sm:pt-4 md:pt-5 pb-3 sm:pb-4 md:pb-5">
      {/* ── Section Header ── */}
      <div className="flex justify-between items-end mb-5 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Bestselling <span className="text-[#EDCF5D] font-bold">✦</span>
            <span className="font-serif italic font-bold text-[#010101]">Products</span>
          </h2>
        </div>

        <Link
          href="/shop"
          className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
        >
          <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
            More products
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
          aria-label="Previous products"
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
                className="w-[230px] sm:w-[250px] md:w-[270px] shrink-0"
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
          aria-label="Next products"
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
