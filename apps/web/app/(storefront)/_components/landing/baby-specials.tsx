"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { ProductCard } from "../ui/product-card";
import { REAL_PRODUCTS, type ProductItem } from "../../_data/products";
import { createClient } from "@gts/database/client";

export function BabySpecials() {
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [dbProducts, setDbProducts] = useState<ProductItem[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fallback initial products from REAL_PRODUCTS to avoid layout shift
  const fallbackBabyProducts = useMemo(() => {
    return REAL_PRODUCTS.filter((p) => p.category === "Baby Products");
  }, []);

  // Fetch real baby products directly from Supabase Database
  useEffect(() => {
    let isMounted = true;

    async function loadDatabaseBabyProducts() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            slug,
            sku,
            brand,
            sub_category,
            has_transparent_bg,
            description,
            short_description,
            base_price,
            compare_at_price,
            average_rating,
            review_count,
            tags,
            category:categories(name, slug),
            images:product_images(cloudinary_public_id, is_primary)
          `)
          .eq("status", "active");

        if (!error && data && data.length > 0 && isMounted) {
          // Filter for products that belong to Baby Products category or have baby tags
          const babyDbItems = data.filter((p: any) => {
            const catName = p.category?.name?.toLowerCase() || "";
            const catSlug = p.category?.slug?.toLowerCase() || "";
            const tags = (p.tags || []).map((t: string) => t.toLowerCase());
            return (
              catName.includes("baby") ||
              catSlug.includes("baby") ||
              tags.includes("baby") ||
              tags.includes("baby specials")
            );
          });

          if (babyDbItems.length > 0) {
            const formatted: ProductItem[] = babyDbItems.map((p: any) => {
              const priceNaira = (p.base_price || 0) / 100;
              const origPriceNaira = p.compare_at_price ? p.compare_at_price / 100 : undefined;
              const primaryImg =
                p.images?.find((img: any) => img.is_primary)?.cloudinary_public_id ||
                p.images?.[0]?.cloudinary_public_id ||
                "/products/baby_stroller.jpg";

              return {
                id: p.slug || p.id,
                brand: p.brand || "GTS Baby",
                sku: p.sku || `GTS-${p.id.slice(0, 6)}`,
                title: p.name,
                price: `₦${priceNaira.toLocaleString()}`,
                originalPrice: origPriceNaira ? `₦${origPriceNaira.toLocaleString()}` : undefined,
                priceNum: priceNaira,
                badge:
                  origPriceNaira && origPriceNaira > priceNaira
                    ? `${Math.round(((origPriceNaira - priceNaira) / origPriceNaira) * 100)}% OFF`
                    : "SPECIAL",
                rating: Number(p.average_rating || 4.8),
                reviewsCount: Number(p.review_count || 48),
                reviews: `${p.review_count || 48}`,
                description: p.description || p.short_description || "",
                category: "Baby Products",
                subCategory: p.sub_category || "Baby Toys & Play",
                image: primaryImg,
                images: [],
                sizes: ["Standard"],
                tags: p.tags || ["Baby", "Baby Specials"],
                hasTransparentBg: p.has_transparent_bg || false,
              };
            });

            setDbProducts(formatted);
          }
        }
      } catch (err) {
        console.error("Failed to load baby products from DB:", err);
      }
    }

    loadDatabaseBabyProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Products to display: live DB products if fetched, else fallback
  const sourceProducts = dbProducts.length > 0 ? dbProducts : fallbackBabyProducts;

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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-5">
          <div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
              Baby <span className="text-[#EDCF5D] font-bold">✦</span>
              <span className="font-serif italic font-bold text-[#010101]">Specials</span>
            </h2>
          </div>

          <Link
            href="/search?category=Baby%20Products"
            className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
          >
            <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
              Explore baby collection
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
            aria-label="Previous baby products"
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
            aria-label="Next baby products"
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
