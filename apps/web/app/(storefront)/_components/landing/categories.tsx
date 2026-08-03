"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface CategoryCard {
  id: string;
  subtitle: string;
  titleMain: string;
  titleItalic: string;
  image: string;
  href: string;
}

const CATEGORIES: CategoryCard[] = [
  {
    id: "1",
    subtitle: "Explore",
    titleMain: "Home &",
    titleItalic: "Office",
    image: "/products/home_and_office_section.jpg",
    href: "/categories/home-office",
  },
  {
    id: "2",
    subtitle: "Explore",
    titleMain: "Smart",
    titleItalic: "Appliances",
    image: "/products/appliance_section.webp",
    href: "/categories/appliances",
  },
  {
    id: "3",
    subtitle: "Explore",
    titleMain: "Computing",
    titleItalic: "Gear",
    image: "/products/computing_section.jpg",
    href: "/categories/computing",
  },
  {
    id: "4",
    subtitle: "Explore",
    titleMain: "Gaming",
    titleItalic: "Zone",
    image: "/products/gaming_section.jpg",
    href: "/categories/gaming",
  },
  {
    id: "5",
    subtitle: "Explore",
    titleMain: "Phones &",
    titleItalic: "Tech",
    image: "/products/phones_section.jpg",
    href: "/categories/phones",
  },
  {
    id: "6",
    subtitle: "Explore",
    titleMain: "Fashion &",
    titleItalic: "Style",
    image: "/products/fashion_section.jpg",
    href: "/categories/fashion",
  },
  {
    id: "7",
    subtitle: "Explore",
    titleMain: "Health &",
    titleItalic: "Beauty",
    image: "/products/health_and_beauty_section.jpg",
    href: "/categories/health-beauty",
  },
  {
    id: "8",
    subtitle: "Explore",
    titleMain: "Baby",
    titleItalic: "Essentials",
    image: "/products/baby_products_section.jpg",
    href: "/categories/baby",
  },
  {
    id: "9",
    subtitle: "Explore",
    titleMain: "Fresh",
    titleItalic: "Groceries",
    image: "/products/groceries_section.jpg",
    href: "/categories/groceries",
  },
];

export function Categories() {
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

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -310, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 310, behavior: "smooth" });
    }
  };

  return (
    <section className="w-full px-3 md:px-4 pt-3 sm:pt-4 md:pt-5 pb-2 sm:pb-3 md:pb-4">
      {/* Section Header */}
      <div className="flex justify-between items-end mb-5 sm:mb-6">
        <div>

          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Featured <span className="text-[#EDCF5D] font-bold">✦</span>
            <span className="font-serif italic font-bold text-[#010101]">Categories</span>
          </h2>
        </div>

        <Link
          href="/shop"
          className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
        >
          <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
            More categories
          </span>
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

      {/* Cards Row Container */}
      <div className="relative group overflow-hidden">
        {/* Left Fade Overlay */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/65 via-white/30 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Left Arrow Button */}
        <button
          aria-label="Previous categories"
          onClick={handleScrollLeft}
          className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/70 backdrop-blur-md flex items-center justify-center text-black hover:bg-white/90 transition-all active:scale-95 shadow-sm ${
            canScrollLeft ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Scrollable Category Cards Row */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-4.5 overflow-x-auto scroll-smooth no-scrollbar py-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className="relative w-[260px] sm:w-[280px] md:w-[295px] aspect-[3/4.2] shrink-0 rounded-[14px] overflow-hidden flex flex-col justify-end p-5 group/card transition-all duration-300 hover:shadow-xl"
            >
              {/* Full-bleed Category Image */}
              <Image
                src={cat.image}
                alt={`${cat.titleMain} ${cat.titleItalic}`}
                fill
                className="object-cover object-center group-hover/card:scale-105 transition-transform duration-700"
                sizes="(max-width: 640px) 260px, (max-width: 768px) 280px, 295px"
              />

              {/* Dark Gradient Overlay for Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent rounded-[14px]" />

              {/* Card Content - Centered Bottom */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <span className="text-xs text-white/80 font-light tracking-wide uppercase mb-1">
                  {cat.subtitle}
                </span>

                <h3 className="text-xl sm:text-2xl font-normal text-white tracking-tight mb-4">
                  {cat.titleMain}{" "}
                  <span className="font-serif italic font-normal">
                    {cat.titleItalic}
                  </span>
                </h3>

                <span className="inline-flex items-center gap-1.5 bg-[#F2F0EA] text-[#010101] text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md group-hover/card:scale-105">
                  Shop
                  <svg
                    className="w-3.5 h-3.5 group-hover/card:translate-x-0.5 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Right Fade Overlay */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/65 via-white/30 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Right Arrow Button */}
        <button
          aria-label="Next categories"
          onClick={handleScrollRight}
          className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/70 backdrop-blur-md flex items-center justify-center text-black hover:bg-white/90 transition-all active:scale-95 shadow-sm ${
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
