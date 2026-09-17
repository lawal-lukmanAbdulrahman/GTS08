"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeroShopCTA } from "./hero-shop-cta";



// ─── Apple HIG spring physics ─────────────────────────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 170, damping: 26, mass: 1 };
const TEXT_SPRING = { type: "spring" as const, stiffness: 200, damping: 24, mass: 1 };

// ─── Slide position definitions ───────────────────────────────────────────────
type SlideRole = "far-left" | "left" | "center" | "right" | "far-right";

const POSITION: Record<SlideRole, {
  x: string; scale: number; opacity: number; zIndex: number;
}> = {
  "far-left":  { x: "-160%", scale: 0.40, opacity: 0,    zIndex: 0  },
  "left":      { x: "-72%",  scale: 0.58, opacity: 0.82, zIndex: 10 },
  "center":    { x: "0%",    scale: 1.0,  opacity: 1,    zIndex: 20 },
  "right":     { x: "72%",   scale: 0.58, opacity: 0.82, zIndex: 10 },
  "far-right": { x: "160%",  scale: 0.40, opacity: 0,    zIndex: 0  },
};

interface ColorVariant {
  id: string;
  colorName: string;
  colorHex: string;
  image: string;
  radialGradient: string;
  glowColor: string;
  edgeColor: string;
  hasTransparentBg?: boolean;
}

interface HeroProduct {
  id: string;
  slug: string;
  headline: string;
  tagline: string;
  price: string;
  originalPrice: string;
  badge?: string;
  rating: number;
  reviews: string;
  variants: ColorVariant[];
}

function getHeroEligibleVariants(product: HeroProduct): ColorVariant[] {
  const eligible = (product.variants || []).filter(
    (v) => v.hasTransparentBg !== false && (v.image.endsWith(".png") || !v.image.endsWith(".jpg"))
  );
  return eligible.length > 0 ? eligible : [product.variants[0]!];
}

// ─── Product Data ─────────────────────────────────────────────────────────────
const HERO_PRODUCTS: HeroProduct[] = [
  {
    id: "air-jordan",
    slug: "air-jordan-1",
    headline: "Air Jordan\nRetro 1",
    tagline: "Classic court meets street culture",
    price: "₦85,000",
    originalPrice: "₦120,000",
    badge: "30% OFF",
    rating: 4.8,
    reviews: "2.1k",
    variants: [
      {
        id: "aj-blue",
        colorName: "Royal Blue",
        colorHex: "#1E3A8A",
        image: "/products/hero/air_jordan_retro_1_blue.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #2A52C4 0%, #1A3678 20%, #0E2050 42%, #070F2C 62%, #030818 80%, #010510 100%)",
        glowColor: "rgba(30, 58, 138, 0.65)",
        edgeColor: "#010510",
      },
      {
        id: "aj-brown",
        colorName: "Mocha Brown",
        colorHex: "#92400E",
        image: "/products/hero/air_jordan_retro_1_brown.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #B45309 0%, #78350F 20%, #452006 42%, #221003 62%, #0E0802 80%, #060402 100%)",
        glowColor: "rgba(120, 53, 15, 0.65)",
        edgeColor: "#060402",
      },
      {
        id: "aj-green",
        colorName: "Forest Green",
        colorHex: "#14532D",
        image: "/products/hero/air_jordan_retro_1_green.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #166534 0%, #0F4024 20%, #082816 42%, #041408 62%, #020A04 80%, #010502 100%)",
        glowColor: "rgba(20, 83, 45, 0.65)",
        edgeColor: "#010502",
      },
    ],
  },
  {
    id: "nexus-washer",
    slug: "nexus-washing-machine",
    headline: "Nexus V8 Pro\nSmart Washer",
    tagline: "Eco Inverter Direct Drive with AI Fabric Care",
    price: "₦480,000",
    originalPrice: "₦550,000",
    badge: "15% OFF",
    rating: 4.9,
    reviews: "142",
    variants: [
      {
        id: "nw-green",
        colorName: "Forest",
        colorHex: "#15803D",
        image: "/products/hero/nexus_washing_machine_green.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #3E7B5A 0%, #2A5C3E 20%, #1C4230 42%, #0E2419 62%, #08130E 80%, #040A07 100%)",
        glowColor: "rgba(52, 105, 76, 0.65)",
        edgeColor: "#040A07",
      },
      {
        id: "nw-blue",
        colorName: "Ocean",
        colorHex: "#1D4ED8",
        image: "/products/hero/nexus_washing_machine_blue.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #2E5E96 0%, #1A3A68 20%, #112848 42%, #0A1528 62%, #050C18 80%, #020610 100%)",
        glowColor: "rgba(40, 80, 135, 0.65)",
        edgeColor: "#020610",
      },
      {
        id: "nw-grey",
        colorName: "Slate",
        colorHex: "#6B7280",
        image: "/products/hero/nexus_washing_machine_grey.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #565F6C 0%, #333A44 20%, #222830 42%, #131820 62%, #080B10 80%, #040608 100%)",
        glowColor: "rgba(90, 100, 115, 0.65)",
        edgeColor: "#040608",
      },
      {
        id: "nw-white",
        colorName: "Pearl",
        colorHex: "#CBD5E1",
        image: "/products/hero/nexus_washing_machine_white.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #4E5968 0%, #2C3340 20%, #1E2535 42%, #111824 62%, #090E18 80%, #050810 100%)",
        glowColor: "rgba(160, 168, 185, 0.55)",
        edgeColor: "#050810",
      },
      {
        id: "nw-yellow",
        colorName: "Amber",
        colorHex: "#B45309",
        image: "/products/hero/nexus_washing_machine_yellow.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #B07820 0%, #6E4A0C 20%, #44290A 42%, #201203 62%, #0E0803 80%, #060402 100%)",
        glowColor: "rgba(190, 140, 30, 0.65)",
        edgeColor: "#060402",
      },
    ],
  },
  {
    id: "pixel-10",
    slug: "pixel-10",
    headline: "Google Pixel\n10 Pro",
    tagline: "Pro camera. Pro power. Pure Google.",
    price: "₦620,000",
    originalPrice: "₦720,000",
    badge: "15% OFF",
    rating: 4.9,
    reviews: "1.8k",
    variants: [
      {
        id: "p10-green",
        colorName: "Matcha",
        colorHex: "#166534",
        image: "/products/hero/pixel_10_green.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #1A7A3E 0%, #0F4C26 20%, #082E18 42%, #041508 62%, #020A04 80%, #010502 100%)",
        glowColor: "rgba(22, 101, 52, 0.65)",
        edgeColor: "#010502",
      },
      {
        id: "p10-metal",
        colorName: "Titanium",
        colorHex: "#64748B",
        image: "/products/hero/pixel_10_metal.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #505E72 0%, #2E3844 20%, #1C2430 42%, #0E1318 62%, #080C12 80%, #040608 100%)",
        glowColor: "rgba(80, 94, 115, 0.65)",
        edgeColor: "#040608",
      },
      {
        id: "p10-purple",
        colorName: "Violet",
        colorHex: "#6D28D9",
        image: "/products/hero/pixel_10_purple.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #7C3AED 0%, #4C1D95 20%, #2E1260 42%, #160840 62%, #080424 80%, #04020E 100%)",
        glowColor: "rgba(109, 40, 217, 0.65)",
        edgeColor: "#04020E",
      },
      {
        id: "p10-red",
        colorName: "Crimson",
        colorHex: "#991B1B",
        image: "/products/hero/pixel_10_red.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #B91C1C 0%, #7F1D1D 20%, #4C0F0F 42%, #280808 62%, #140404 80%, #060102 100%)",
        glowColor: "rgba(153, 27, 27, 0.65)",
        edgeColor: "#060102",
      },
    ],
  },
  {
    id: "samsung-fridge",
    slug: "samsung-fridge",
    headline: "Samsung French\nDoor Fridge",
    tagline: "Smart cooling meets elegant design",
    price: "₦750,000",
    originalPrice: "₦940,000",
    badge: "20% OFF",
    rating: 4.8,
    reviews: "1.1k",
    variants: [
      {
        id: "sf-black",
        colorName: "Matte Black",
        colorHex: "#1F2937",
        image: "/products/hero/samsung_fridge_black.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #252F3E 0%, #161E2A 20%, #0D1218 42%, #080B10 62%, #040608 80%, #020304 100%)",
        glowColor: "rgba(31, 41, 55, 0.65)",
        edgeColor: "#020304",
      },
      {
        id: "sf-bronze",
        colorName: "Bronze",
        colorHex: "#92400E",
        image: "/products/hero/samsung_fridge_bronze.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #A86018 0%, #6A3A0C 20%, #3E2208 42%, #1E1004 62%, #0E0802 80%, #060402 100%)",
        glowColor: "rgba(146, 64, 14, 0.65)",
        edgeColor: "#060402",
      },
      {
        id: "sf-grey",
        colorName: "Graphite",
        colorHex: "#374151",
        image: "/products/hero/samsung_fridge_grey.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #434E60 0%, #272F3C 20%, #181E28 42%, #0C1018 62%, #060810 80%, #030408 100%)",
        glowColor: "rgba(55, 65, 81, 0.65)",
        edgeColor: "#030408",
      },
      {
        id: "sf-white",
        colorName: "Ivory",
        colorHex: "#94A3B8",
        image: "/products/hero/samsung_fridge_white.png",
        radialGradient:
          "radial-gradient(ellipse 90% 80% at 50% 52%, #536070 0%, #303A48 20%, #1C2430 42%, #0E1318 62%, #080C12 80%, #040608 100%)",
        glowColor: "rgba(148, 163, 184, 0.55)",
        edgeColor: "#040608",
      },
    ],
  },
];

const N = HERO_PRODUCTS.length; // 4

// ─── Helper: true modulo (always non-negative, unlike JS's `%`) ──────────────
function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

// ─── Offsets (relative to the centered slide) mapped to visual roles ─────────
// Rendering is driven by 5 fixed offsets, not by shuffling items between
// named slots. A slide's role is purely `OFFSET_ROLE[virtualStep - centerStep]`.
const RENDER_OFFSETS = [-2, -1, 0, 1, 2] as const;
const OFFSET_ROLE: Record<number, SlideRole> = {
  [-2]: "far-left",
  [-1]: "left",
  [0]:  "center",
  [1]:  "right",
  [2]:  "far-right",
};

// ─── Helper: format price compactly ──────────────────────────────────────────
function formatCompact(p: string) {
  const sym = p.match(/^[^\d]+/)?.[0] ?? "";
  const n = parseFloat(p.replace(/[^\d.]/g, ""));
  if (isNaN(n)) return p;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}K`;
  return p;
}

// ─── Helper: 5-Star Rating Component ──────────────────────────────────────────
function FiveStarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillAmount = Math.max(0, Math.min(1, rating - (star - 1)));
        if (fillAmount >= 0.75) {
          return (
            <svg key={star} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EDCF5D] drop-shadow-xs shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          );
        }
        if (fillAmount >= 0.25) {
          const gradId = `hero-star-grad-${star}`;
          const pct = Math.round(fillAmount * 100);
          return (
            <svg key={star} className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 20 20">
              <defs>
                <linearGradient id={gradId}>
                  <stop offset={`${pct}%`} stopColor="#EDCF5D" />
                  <stop offset={`${pct}%`} stopColor="rgba(255,255,255,0.25)" />
                </linearGradient>
              </defs>
              <path fill={`url(#${gradId})`} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          );
        }
        return (
          <svg key={star} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/25 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
    </div>
  );
}


// ─── Component ────────────────────────────────────────────────────────────────
export function Hero() {
  /**
   * `centerStep` is a plain integer that only ever increments (next) or
   * decrements (prev) — it never wraps and nothing ever "recycles" it.
   * The product shown at any virtual step is `HERO_PRODUCTS[mod(step, N)]`.
   *
   * Each rendered slide is keyed by its virtual step, not by product id.
   * Its role is derived every render as `OFFSET_ROLE[step - centerStep]`.
   * That means a slide's role can only ever move exactly one position per
   * navigation, always in the direction of travel:
   *
   *   next: far-right → right → center → left → far-left → (out of range, unmounts)
   *   prev: far-left → left → center → right → far-right → (out of range, unmounts)
   *
   * A brand-new slide always mounts already sitting at far-right (or
   * far-left), invisible — so there's no "teleport" to fake and no timing
   * window where a slide can get caught mid-flight and snapped backwards.
   * A slide can only ever reverse direction if the *user* reverses
   * direction, which is correct, expected behavior.
   */
  const [centerStep, setCenterStep] = useState(2); // HERO_PRODUCTS[2] = Google Pixel 10 Pro


  const [isPaused, setIsPaused] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>(
    Object.fromEntries(HERO_PRODUCTS.map((p) => [p.id, 0]))
  );

  // Derived: which product index is currently centered (for text/gradients)
  const currentIndex = mod(centerStep, N);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const handleNext = useCallback(() => setCenterStep((s) => s + 1), []);
  const handlePrev = useCallback(() => setCenterStep((s) => s - 1), []);

  // Auto-advance every 4 s, paused on hover
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(handleNext, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, handleNext]);

  const activeProduct      = HERO_PRODUCTS[currentIndex] ?? HERO_PRODUCTS[0]!;
  const activeVariants     = getHeroEligibleVariants(activeProduct);
  const activeVariantIndex = Math.min(selectedVariants[activeProduct.id] ?? 0, Math.max(0, activeVariants.length - 1));
  const activeVariant      = activeVariants[activeVariantIndex] ?? activeProduct.variants[0]!;

  return (
    <div
      className="w-full p-3 md:p-4 pt-1 md:pt-2 bg-white flex flex-col box-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <section className="relative w-full h-[75vh] sm:h-[calc(100vh-140px)] min-h-[380px] sm:min-h-[520px] max-h-[780px] overflow-hidden rounded-[18px] border border-white/10 shadow-xl">

        {/* ── Background Gradient Layers ── */}
        {HERO_PRODUCTS.map((product, pi) => {
          const eligible = getHeroEligibleVariants(product);
          return eligible.map((variant, vi) => {
            const isActive = pi === currentIndex && vi === Math.min(selectedVariants[product.id] ?? 0, Math.max(0, eligible.length - 1));
            return (
              <div
                key={variant.id}
                className="absolute inset-0 z-0 transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ background: variant.radialGradient, opacity: isActive ? 1 : 0, pointerEvents: "none" }}
              />
            );
          });
        })}

        {/* ── Ambient Glow ── */}
        {HERO_PRODUCTS.map((product, pi) => {
          const eligible = getHeroEligibleVariants(product);
          return eligible.map((variant, vi) => {
            const isActive = pi === currentIndex && vi === Math.min(selectedVariants[product.id] ?? 0, Math.max(0, eligible.length - 1));
            return (
              <div
                key={`glow-${variant.id}`}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] sm:w-[540px] sm:h-[540px] rounded-full z-0 blur-3xl pointer-events-none transition-opacity duration-1000"
                style={{ background: variant.glowColor, opacity: isActive ? 0.7 : 0 }}
              />
            );
          });
        })}

        {/* ── Edge Fades (match bg edge color) ── */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[28%] z-30 pointer-events-none transition-[background] duration-700"
          style={{ background: `linear-gradient(to right, ${activeVariant.edgeColor} 0%, transparent 100%)` }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-[28%] z-30 pointer-events-none transition-[background] duration-700"
          style={{ background: `linear-gradient(to left, ${activeVariant.edgeColor} 0%, transparent 100%)` }}
        />

        {/* ── Top-Right Discount Badge ── */}
        <AnimatePresence mode="wait">
          {activeProduct.badge && (
            <motion.span
              key={`badge-${currentIndex}`}
              initial={{ opacity: 0, filter: "blur(8px)", y: -6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(8px)", y: -6 }}
              transition={TEXT_SPRING}
              className="absolute top-0 right-0 z-40 bg-[#EDCF5D] text-[#010101] text-sm sm:text-base font-black px-4 sm:px-6 py-2 sm:py-2.5 tracking-wider shadow-md"
              style={{ borderRadius: "0 0 0 18px" }}
            >
              {activeProduct.badge}
            </motion.span>
          )}
        </AnimatePresence>

        {/* ── Product Image Carousel ── */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pt-10 sm:pt-0">
          {RENDER_OFFSETS.map((offset) => {
            const virtualStep = centerStep + offset;
            const pi          = mod(virtualStep, N);
            const product     = HERO_PRODUCTS[pi]!;
            const role        = OFFSET_ROLE[offset];
            const pos         = POSITION[role!];
            const isCenter    = role === "center";
            const isSide      = role === "left" || role === "right";

            const productVariants = getHeroEligibleVariants(product);
            const variantIdx      = Math.min(selectedVariants[product.id] ?? 0, Math.max(0, productVariants.length - 1));
            const variant         = productVariants[variantIdx] ?? product.variants[0]!;

            return (
              <motion.div
                key={virtualStep}
                initial={false}
                animate={{
                  x:       pos.x,
                  scale:   pos.scale,
                  opacity: pos.opacity,
                  zIndex:  pos.zIndex,
                }}
                transition={SPRING}
                className="absolute w-[68vw] sm:w-[42vw] md:w-[38vw] lg:w-[34vw] max-w-[440px] aspect-square"
                style={{ cursor: isCenter ? "pointer" : isSide ? "pointer" : "default" }}
                onClick={() => {
                  if (isCenter) router.push(`/product/${product.slug}`);
                  if (role === "left")  handlePrev();
                  if (role === "right") handleNext();
                }}
              >
                <div
                  className="relative w-full h-full drop-shadow-[0_28px_40px_rgba(0,0,0,0.7)]"
                  style={{ filter: !isCenter ? "brightness(0.72)" : undefined }}
                >
                  <Image
                    src={variant.image}
                    alt={`${product.headline.replace("\n", " ")} — ${variant.colorName}`}
                    fill
                    priority={isCenter}
                    className="object-contain object-center"
                    sizes="(max-width: 640px) 68vw, (max-width: 1024px) 42vw, 420px"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Left Arrow (mid-left edge) ── */}
        <button
          aria-label="Previous product"
          onClick={handlePrev}
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* ── Right Arrow (mid-right edge) ── */}
        <button
          aria-label="Next product"
          onClick={handleNext}
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-white text-[#010101] hover:bg-[#F2F0EA] flex items-center justify-center transition-all active:scale-95 shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* ── Title + Tagline (blur-fade) ── */}
        <div className="absolute top-4 sm:top-7 left-4 sm:left-8 z-40 max-w-[70%] sm:max-w-xs md:max-w-sm pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(12px)", y: -8 }}
              transition={TEXT_SPRING}
            >
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.08] tracking-tight font-sans drop-shadow-lg whitespace-pre-line">
                {activeProduct.headline}
              </h1>
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-white/80 font-light leading-relaxed">
                {activeProduct.tagline}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Color Swatches (hidden on mobile) ── */}
        <div className="absolute bottom-5 sm:bottom-8 left-5 sm:left-8 z-40 hidden sm:flex items-center gap-2 sm:gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`swatches-${currentIndex}`}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ ...TEXT_SPRING, delay: 0.05 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              {activeVariants.map((variant, vi) => {
                const isSelected = vi === activeVariantIndex;
                return (
                  <button
                    key={variant.id}
                    onClick={() =>
                      setSelectedVariants((prev) => ({ ...prev, [activeProduct.id]: vi }))
                    }
                    aria-label={`Select ${variant.colorName}`}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-300 shrink-0 ${
                      isSelected
                        ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/60 shadow-lg"
                        : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ backgroundColor: variant.colorHex }}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Price + Rating + CTA ── */}
        <div
          className="absolute bottom-5 sm:bottom-8 left-3 sm:left-auto right-3 sm:right-8 z-40 flex flex-row sm:flex-col items-center justify-between sm:justify-end sm:items-end gap-2 sm:gap-2"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`price-${currentIndex}-${activeVariantIndex}`}
              initial={{ opacity: 0, filter: "blur(10px)", y: 8 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(10px)", y: -8 }}
              transition={{ ...TEXT_SPRING, delay: 0.08 }}
              className="flex flex-col items-start sm:items-end gap-0.5 sm:gap-1.5 text-left sm:text-right"
            >
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-[#EDCF5D] tracking-tight font-sans drop-shadow-lg">
                  {formatCompact(activeProduct.price)}
                </span>
                <span className="text-xs sm:text-base text-white/50 line-through">
                  {formatCompact(activeProduct.originalPrice)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/90 font-medium whitespace-nowrap">
                <FiveStarRating rating={activeProduct.rating} />
                <span className="text-white/60">({activeProduct.reviews})</span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* CTA — outside AnimatePresence so it never fades with the price */}
          <HeroShopCTA productSlug={activeProduct.slug} />
        </div>

        {/* ── Dot Indicators — always centered, all breakpoints ── */}
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pt-4">
          {HERO_PRODUCTS.map((_, pi) => (
            <button
              key={pi}
              onClick={() => {
                const d = mod(pi - currentIndex, N);
                if (d === 0) return;
                const delta = d <= N / 2 ? d : d - N;
                setCenterStep((s) => s + delta);
              }}
              aria-label={`Go to slide ${pi + 1}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                pi === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
