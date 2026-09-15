"use client";

import Image from "next/image";
import Link from "next/link";

interface ShowcaseCard {
  id: string;
  spanClass: string;
  badge?: string | null;
  badgeBg?: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
}

const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    id: "1",
    spanClass: "lg:col-span-7",
    title: "Street-Ready Styles",
    subtitle: "Stay sharp with bold, urban fashion essentials.",
    image: "/products/fashion_section.jpg",
    href: "/search?category=Fashion",
  },
  {
    id: "2",
    spanClass: "lg:col-span-5",
    badge: "-30%",
    badgeBg: "bg-[#EDCF5D] text-[#010101]",
    title: "Everyday Classics",
    subtitle: "Timeless designs for your daily lifestyle.",
    image: "/products/home_and_office_section.jpg",
    href: "/search?category=Home%20%26%20Office",
  },
  {
    id: "3",
    spanClass: "lg:col-span-5",
    title: "Fresh Kicks Only",
    subtitle: "Elevate your collection with top tier drops.",
    image: "/products/health_and_beauty_section.jpg",
    href: "/search?category=Health%20%26%20Beauty",
  },
  {
    id: "4",
    spanClass: "lg:col-span-7",
    badge: "20% OFF",
    badgeBg: "bg-[#EDCF5D] text-[#010101]",
    title: "Tailored to Impress",
    subtitle: "Precision crafted gear engineered to perform.",
    image: "/products/computing_section.jpg",
    href: "/search?category=Computing",
  },
];

export function ShowcaseBanners() {
  return (
    <section className="w-full px-3 md:px-4 pt-2 sm:pt-4 pb-5 sm:pb-3 md:pb-4">
      <div className="max-w-[1240px] mx-auto">
        {/* ── 4-Card Asymmetric Grid Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {SHOWCASE_CARDS.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`relative ${card.spanClass} min-h-[200px] sm:min-h-[220px] lg:min-h-[250px] rounded-[14px] overflow-hidden p-5 sm:p-7 flex flex-col justify-between group border border-gray-200/60 transition-all duration-300 hover:shadow-lg`}
            >
              {/* Background Image — renders first so overlay sits on top naturally */}
              <Image
                src={card.image}
                alt={card.title}
                fill
                className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-110"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />

              {/* Dark Brand Overlay — #010101 at high opacity, renders after image so it sits on top */}
              <div className="absolute inset-0 bg-[#010101]/50" />

              {/* Bottom-up readability vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

              {/* Top Row: Badge if available */}
              <div className="relative z-10 flex justify-end w-full">
                {card.badge && (
                  <span className={`text-xs sm:text-sm font-extrabold px-3.5 py-1 rounded-full shadow-sm ${card.badgeBg}`}>
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Bottom Row: Text Content & Shop Now Pill Button */}
              <div className="relative z-10 flex flex-col items-start max-w-sm mt-auto">
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight mb-2">
                  {card.title}
                </h3>

                <p className="text-xs sm:text-sm text-white/90 font-light leading-relaxed mb-5">
                  {card.subtitle}
                </p>

                <span className="inline-flex items-center gap-1.5 bg-[#F2F0EA] text-[#010101] text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md group-hover:scale-105">
                  Shop Now
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
