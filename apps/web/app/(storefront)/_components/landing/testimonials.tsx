"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Testimonial {
  id: string;
  quote: string;
  nameFirstName: string;
  nameLastName: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    quote: "HomeDine's glass jars are sustainable and awesome for storage. Eco utensils are perfect for everyday use!",
    nameFirstName: "Jane",
    nameLastName: "Cooper",
    role: "Nutritionist",
  },
  {
    id: "2",
    quote: "Fantastic products and fast delivery. My kitchen feels so much greener and more stylish!",
    nameFirstName: "Darlene",
    nameLastName: "Robertson",
    role: "Culinary Instructor",
  },
  {
    id: "3",
    quote: "Love HomeDine's eco-style! Glass jars keep things fresh, and bamboo utensils are so chic.",
    nameFirstName: "Jacob",
    nameLastName: "Jones",
    role: "Food Blogger",
  },
  {
    id: "4",
    quote: "The sustainable bamboo utensils are perfect for daily use in any modern home!",
    nameFirstName: "Esther",
    nameLastName: "Howard",
    role: "Sous Chef",
  },
  {
    id: "5",
    quote: "Thoughtful, planet-friendly designs that look stunning on any kitchen countertop.",
    nameFirstName: "Guy",
    nameLastName: "Hawkins",
    role: "Home Chef",
  },
  {
    id: "6",
    quote: "Switching to HomeDine's eco products was the best decision — quality and sustainability combined!",
    nameFirstName: "Priya",
    nameLastName: "Sharma",
    role: "Wellness Coach",
  },
  {
    id: "7",
    quote: "Beautiful products that actually last. I love how they're kind to both my kitchen and the planet.",
    nameFirstName: "Marcus",
    nameLastName: "Bell",
    role: "Interior Designer",
  },
  {
    id: "8",
    quote: "Every product exceeded expectations. The glass containers look premium and seal perfectly!",
    nameFirstName: "Sofia",
    nameLastName: "Reyes",
    role: "Home Cook",
  },
  {
    id: "9",
    quote: "HomeDine has genuinely changed how I shop. Eco-conscious without compromising on style.",
    nameFirstName: "Tobias",
    nameLastName: "Grant",
    role: "Sustainability Advocate",
  },
  {
    id: "10",
    quote: "The bamboo cutlery set is a gift I now give everyone — gorgeous, functional, and plastic-free.",
    nameFirstName: "Amara",
    nameLastName: "Osei",
    role: "Lifestyle Blogger",
  },
];

const GAP = 12;     // px — matches gap style below
// Middle of 10 cards: index 4. With cards 0-3 to the left, no blank space.
const DEFAULT_ACTIVE = 4;

export function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(DEFAULT_ACTIVE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** Center card `idx` in the viewport using actual DOM positions */
  const scrollToCard = useCallback((idx: number, behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    const card = cardRefs.current[idx];
    if (!container || !card) return;
    const target = card.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior });
  }, []);

  const handleSelect = (idx: number) => {
    setActiveIndex(idx);
    scrollToCard(idx);
  };

  // After mount, wait two paint frames so DOM offsetLeft values are ready
  useEffect(() => {
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => scrollToCard(DEFAULT_ACTIVE, "auto"));
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, [scrollToCard]);

  // Keep activeIndex in sync when user scrolls freely
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScrollEnd = () => {
      // Find whichever card center is closest to the viewport center
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActiveIndex(closest);
    };
    el.addEventListener("scrollend", onScrollEnd);
    return () => el.removeEventListener("scrollend", onScrollEnd);
  }, []);

  return (
    <section className="w-full px-3 md:px-4 pt-3 sm:pt-4 md:pt-5 pb-10 sm:pb-14 md:pb-16">
      <div className="bg-[#F2F0EA] rounded-[14px] overflow-hidden">

        {/* ── Header ── */}
        <div className="pt-7 sm:pt-9 px-5 sm:px-8 md:px-10 pb-5 flex items-start gap-4">
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif italic font-bold text-4xl sm:text-5xl md:text-6xl text-[#010101] tracking-tight leading-none">
              4.9
            </span>
            <span className="font-serif italic font-normal text-2xl sm:text-3xl text-gray-500/70 leading-none">
              /5
            </span>
          </div>
          <div className="text-xs sm:text-sm leading-snug font-normal pt-1 text-[#010101]">
            <p>More than <span className="font-bold">25,000</span></p>
            <p><span className="font-bold">5-Star</span> Reviews for Our Award-</p>
            <p>Winning Eco Products</p>
          </div>
        </div>

        {/* ── Carousel Track ──
            No horizontal padding — cards clip at cream-box edges.
            With 10 cards and DEFAULT_ACTIVE=4, cards 0-3 fill the left
            side naturally so there is no visible blank space.              */}
        <div
          ref={scrollRef}
          className="flex items-start overflow-x-auto no-scrollbar pb-14 sm:pb-16"
          style={{
            gap: `${GAP}px`,
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {TESTIMONIALS.map((item, idx) => {
            const isActive = activeIndex === idx;
            return (
              <div
                key={item.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                onClick={() => handleSelect(idx)}
                style={{
                  /* 4 cards + 4 gaps fill the container →  [½|1|ACTIVE|1|½] */
                  width: "calc((100% - 48px) / 4)",
                  minWidth: "220px",
                  flexShrink: 0,
                  scrollSnapAlign: "center",
                }}
                className={`rounded-[6px] p-5 sm:p-6 flex flex-col transition-all duration-500 cursor-pointer min-h-[280px] sm:min-h-[310px] ${
                  isActive
                    ? "bg-white shadow-xl mt-10 sm:mt-12 z-10"
                    : "bg-[#F8F7F4] mt-0 mb-10 sm:mb-12 opacity-85 hover:opacity-100"
                }`}
              >
                {/* Quote Icon */}
                <div className="mb-2.5">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#6B1F17] fill-current" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>

                {/* Quote – first line indented past quote icon */}
                <p className="text-[12.5px] sm:text-[13.5px] text-[#010101]/90 font-medium leading-relaxed indent-7 sm:indent-8 mt-1 grow">
                  {item.quote}
                </p>

                {/* Author + Rating Row */}
                <div className="pt-5 mt-auto flex items-end justify-between gap-2">
                  {/* Left: name + role */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[#010101] tracking-tight">
                      {item.nameFirstName}{" "}
                      <span className="font-serif italic font-bold">{item.nameLastName}</span>
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500 font-light mt-0.5">
                      {item.role}
                    </p>
                  </div>
                  {/* Right: 5 stars */}
                  <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <svg key={s} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#EDCF5D]" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
