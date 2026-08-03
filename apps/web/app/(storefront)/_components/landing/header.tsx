"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { CategoryMegaMenu } from "./category-mega-menu";
import { UserAccountMenu } from "./user-account-menu";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const chipsRef = useRef<HTMLDivElement>(null);
  const secondaryRowRef = useRef<HTMLDivElement>(null);
  // Outer clip wrapper — we animate height on this via ref (exact measured height → 0)
  const secondaryClipRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // All scroll tracking stays in refs — zero React re-renders from scroll
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const isHidden = useRef(false);
  const secondaryRowHeight = useRef(0);
  // Cooldown: prevent toggling faster than the CSS transition duration (220ms)
  // This stops rapid scroll reversals from interrupting mid-animation
  const lastToggleTime = useRef(0);
  const TOGGLE_COOLDOWN_MS = 280;

  const updateScrollState = () => {
    if (chipsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = chipsRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  const scrollChips = (direction: "left" | "right") => {
    if (chipsRef.current) {
      const amount = direction === "left" ? -140 : 140;
      chipsRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    updateScrollState();
    const currentChips = chipsRef.current;
    if (currentChips) {
      currentChips.addEventListener("scroll", updateScrollState, { passive: true });
    }

    // Measure the inner secondary row height once after mount
    if (secondaryRowRef.current && secondaryClipRef.current) {
      const h = secondaryRowRef.current.getBoundingClientRect().height;
      secondaryRowHeight.current = h;
      // Set the clip wrapper to the exact measured height
      secondaryClipRef.current.style.height = `${h}px`;
    }

    const showSecondary = () => {
      if (!secondaryClipRef.current || !secondaryRowRef.current) return;
      secondaryClipRef.current.style.height = `${secondaryRowHeight.current}px`;
      secondaryClipRef.current.style.overflow = "visible";
      secondaryRowRef.current.style.transform = "translateY(0)";
      secondaryRowRef.current.style.opacity = "1";
      secondaryRowRef.current.style.pointerEvents = "";
    };

    const hideSecondary = () => {
      if (!secondaryClipRef.current || !secondaryRowRef.current) return;
      secondaryClipRef.current.style.overflow = "hidden";
      secondaryClipRef.current.style.height = "0px";
      secondaryRowRef.current.style.transform = `translateY(-${secondaryRowHeight.current}px)`;
      secondaryRowRef.current.style.opacity = "0";
      secondaryRowRef.current.style.pointerEvents = "none";
    };

    const onScroll = () => {
      // rAF ticking: only one execution per animation frame
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;

          // Update header border — direct DOM write, no React state
          if (headerRef.current) {
            if (currentScrollY > 10) {
              headerRef.current.style.borderBottomColor = "rgba(209,213,219,0.8)";
              headerRef.current.style.boxShadow = "0 1px 2px 0 rgba(0,0,0,0.05)";
            } else {
              headerRef.current.style.borderBottomColor = "transparent";
              headerRef.current.style.boxShadow = "none";
            }
          }

          const now = performance.now();
          const cooldownElapsed = now - lastToggleTime.current > TOGGLE_COOLDOWN_MS;

          // Near top → always reveal immediately (bypass cooldown so user is never stuck)
          if (currentScrollY < 100) {
            if (isHidden.current) {
              isHidden.current = false;
              lastToggleTime.current = now;
              showSecondary();
            }
          } else if (cooldownElapsed && Math.abs(delta) >= 10) {
            // Only allow a state change if the previous transition has had time to finish
            if (delta > 0 && !isHidden.current) {
              isHidden.current = true;
              lastToggleTime.current = now;
              hideSecondary();
            } else if (delta < 0 && isHidden.current) {
              isHidden.current = false;
              lastToggleTime.current = now;
              showSecondary();
            }
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      if (currentChips) {
        currentChips.removeEventListener("scroll", updateScrollState);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full bg-white pt-2 px-3 md:px-4 border-b border-transparent"
      style={{ willChange: "box-shadow" }}
    >
      {/* Row 1: Always visible — Hamburger | GTS Brand Center | About FAQs Cart */}
      <div className="relative w-full flex items-center justify-between min-h-[38px] pb-1.5">
        {/* Left: Mobile Hamburger / Desktop User Account Pill */}
        <div className="flex-1 flex justify-start items-center">
          {/* Mobile Hamburger Icon */}
          <button
            aria-label="Open menu"
            className="sm:hidden p-1 text-[#010101] hover:opacity-75 transition-opacity"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Desktop User Account Pill (Replaces Hamburger on Desktop) */}
          <div className="hidden sm:block">
            <UserAccountMenu />
          </div>
        </div>

        {/* Center: Brand GTS Logo (Absolute Dead Center) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <Link
            href="/"
            className="text-2xl sm:text-3xl font-black text-[#010101] tracking-tighter hover:opacity-95 transition-opacity font-moara"
          >
            GTS
          </Link>
        </div>

        {/* Right: About, FAQs, Cart Icon Button */}
        <div className="flex-1 flex justify-end items-center gap-4 sm:gap-6">
          <Link
            href="/about"
            className="hidden sm:inline text-xs sm:text-sm font-medium text-[#010101] hover:text-[#EDCF5D] transition-colors"
          >
            About
          </Link>
          <Link
            href="/#faq"
            className="hidden sm:inline text-xs sm:text-sm font-medium text-[#010101] underline underline-offset-4 decoration-gray-300 hover:decoration-[#010101] transition-colors"
          >
            FAQs
          </Link>
          <Link
            href="/cart"
            aria-label="Shopping Cart"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-gray-50 transition-all shrink-0 shadow-2xs"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/*
        Outer clip wrapper — overflow:hidden clips the sliding row.
        Height is transitioned between measured value ↔ 0 directly via ref (no React state, no reflow loop).
      */}
      <div
        ref={secondaryClipRef}
        className="w-full overflow-visible"
        style={{
          transition: "height 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "height",
        }}
      >
        {/* Inner row — transforms up behind Row 1 as height collapses */}
        <div
          ref={secondaryRowRef}
          className="w-full flex items-center justify-between gap-2.5 pb-2"
          style={{
            transform: "translateY(0)",
            opacity: 1,
            transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out",
            willChange: "transform, opacity",
          }}
        >
          {/* Left Dropdown Pills: Categories + New Product — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0">
            <CategoryMegaMenu />

            <button className="flex items-center justify-between min-w-[130px] sm:min-w-[148px] bg-[#F2F0EA] hover:bg-[#EDCF5D] text-[#010101] text-xs sm:text-sm font-medium pl-4 sm:pl-5 pr-1 h-9 sm:h-[38px] rounded-full transition-colors group shrink-0">
              <span className="text-[#010101]/80 group-hover:text-[#010101]">New Product</span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#010101] shrink-0">
                <svg className="w-3 h-3 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Center Search Pill — taller on mobile, expands to fill space */}
          <div className="relative flex items-center justify-between bg-[#F2F0EA] hover:bg-[#EAE7DF] rounded-full pl-4 sm:pl-5.5 pr-1 h-9 sm:h-[38px] flex-1 sm:max-w-md lg:max-w-lg transition-colors group">
            <input
              type="text"
              placeholder="search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs sm:text-sm text-[#010101] placeholder-[#A4A4A4] outline-none w-full font-normal"
            />
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#010101] shrink-0 ml-2">
              <svg className="w-3.5 h-3.5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Mobile-only compact Categories pill */}
          <div className="sm:hidden shrink-0">
            <CategoryMegaMenu />
          </div>

          {/* Right Category Chips Track — hidden on mobile */}
          <div className="hidden sm:flex group/track relative items-center gap-1 min-w-0 flex-1 max-w-[200px] sm:max-w-[280px] md:max-w-[340px] overflow-hidden">
            <button
              aria-label="Scroll chips left"
              onClick={() => scrollChips("left")}
              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-[#F2F0EA] active:scale-95 transition-all opacity-0 group-hover/track:opacity-100 pointer-events-none group-hover/track:pointer-events-auto shrink-0 z-20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="relative flex-1 min-w-0 flex items-center overflow-hidden">
              <div
                className={`absolute left-0 top-0 bottom-0 w-7 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10 transition-opacity duration-300 ${
                  canScrollLeft ? "opacity-100" : "opacity-0"
                }`}
              />

              <div
                ref={chipsRef}
                onScroll={updateScrollState}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 w-full scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {["Men", "Women", "Children", "Brand", "Apparel", "Footwear", "Beauty", "Gifts"].map(
                  (tag) => (
                    <button
                      key={tag}
                      className="px-4 py-1.5 rounded-full border border-gray-200/90 text-xs sm:text-sm font-medium text-[#010101] hover:bg-[#F2F0EA] transition-colors shrink-0 whitespace-nowrap"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>

              <div
                className={`absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10 transition-opacity duration-300 ${
                  canScrollRight ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>

            <button
              aria-label="Scroll chips right"
              onClick={() => scrollChips("right")}
              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-[#F2F0EA] active:scale-95 transition-all opacity-0 group-hover/track:opacity-100 pointer-events-none group-hover/track:pointer-events-auto shrink-0 z-20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
