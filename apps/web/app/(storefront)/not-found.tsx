"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Footer } from "./_components/landing/footer";
import { ProductCard } from "./_components/ui/product-card";
import { useCatalogue } from "./_components/catalogue-context";

// Dynamically import WarpText with SSR disabled to ensure WebGL initializes smoothly client-side
const WarpText = dynamic(() => import("./_components/ui/WarpText"), {
  ssr: false,
});

export default function NotFound() {
  const { products } = useCatalogue();
  const recommendedProducts = products.slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-[#010101] flex flex-col font-sans">
      <main className="flex-1 flex flex-col items-center justify-center pt-2 sm:pt-4 pb-12 px-4 sm:px-6 lg:px-8">
        {/* ── 404 Brand Hero Container ── */}
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center">
          
          {/* Interactive WebGL WarpText "404" */}
          <div className="w-full relative h-[160px] sm:h-[220px] md:h-[280px] overflow-hidden flex items-center justify-center mb-1">
            <WarpText
              text="404"
              color="#010101"
              warpStrength={0.28}
              warpScale={2.2}
              speed={0.7}
              pointerInfluence={0.5}
              pointerStrength={0.75}
              refraction={0.035}
              ripple={true}
              fontSize="clamp(7rem, 24vw, 16rem)"
              fontWeight={900}
              fontFamily="var(--font-display), Bricolage Grotesque, system-ui, sans-serif"
              letterSpacing="-0.06em"
              lineHeight={1}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto mb-5 font-sans leading-relaxed">
            The page you are looking for might have been moved, renamed, or is temporarily unavailable. Let&apos;s get you back on track.
          </p>

          {/* Action CTAs (Compact) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-10">
            <Link
              href="/"
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] font-semibold text-[11px] sm:text-xs transition-all duration-300 shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return to Homepage
            </Link>

            <Link
              href="/search"
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white text-[#010101] border border-gray-300 hover:border-[#010101] font-semibold text-[11px] sm:text-xs transition-all duration-300 shadow-2xs active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse Catalog
            </Link>

            <Link
              href="/cart"
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#F2F0EA] text-[#010101] hover:bg-gray-200 font-semibold text-[11px] sm:text-xs transition-all duration-300 active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              View Cart
            </Link>
          </div>

          {/* ── Featured Recommendations Grid ── */}
          <div className="w-full text-left pt-10 border-t border-gray-200/80">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#A4A4A4] block">
                  RECOMMENDED FOR YOU
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#010101]">
                  Explore Popular GTS Products
                </h2>
              </div>

              <Link
                href="/search"
                className="text-xs sm:text-sm font-semibold text-[#010101] hover:underline flex items-center gap-1"
              >
                View all <span className="text-base">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
                  className="w-full"
                />
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Storefront Footer */}
      <Footer />
    </div>
  );
}
