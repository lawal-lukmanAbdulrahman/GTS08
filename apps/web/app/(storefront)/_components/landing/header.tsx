"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategoryMegaMenu } from "./category-mega-menu";
import { UserAccountMenu } from "./user-account-menu";
import { SearchDropdownCard } from "./search-overlay";
import { useCart } from "../cart-context";
import { useWishlist } from "../wishlist-context";
import { useAuthModal } from "../auth-modal-context";

export function Header() {
  const { totalItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { openAuthModal } = useAuthModal();
  const searchParams = useSearchParams();
  const rawUrlQ = searchParams.get("q") ?? searchParams.get("search") ?? searchParams.get("category") ?? "";
  const [searchQuery, setSearchQuery] = useState(rawUrlQ);

  useEffect(() => {
    setSearchQuery(rawUrlQ);
  }, [rawUrlQ]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isSearchPage = pathname === "/search";
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
      // Do NOT run scroll-hide / border animations on the search page!
      if (isSearchPage) {
        if (headerRef.current) {
          headerRef.current.style.borderBottomColor = "#E5E7EB";
          headerRef.current.style.boxShadow = "none";
        }
        if (isHidden.current) {
          isHidden.current = false;
          showSecondary();
        }
        return;
      }
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

    if (!isSearchPage) {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      if (headerRef.current) {
        headerRef.current.style.borderBottomColor = "#E5E7EB";
        headerRef.current.style.boxShadow = "none";
      }
      if (isHidden.current) {
        isHidden.current = false;
        showSecondary();
      }
    }
    window.addEventListener("resize", updateScrollState);

    return () => {
      if (currentChips) {
        currentChips.removeEventListener("scroll", updateScrollState);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [isSearchPage]);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 w-full bg-white pt-2 px-3 md:px-4 ${
        isSearchPage ? "border-b border-gray-200 shadow-none" : "border-b border-transparent"
      } ${isSearchOpen ? "z-[100]" : "z-50"}`}
      style={{ willChange: "box-shadow", boxShadow: isSearchPage ? "none" : undefined }}
    >
      {/* ── Dark Backdrop overlay covering ENTIRE screen & navbar ── */}
      {isSearchOpen && (
        <div
          onClick={() => setIsSearchOpen(false)}
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-40 transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Row 1: Always visible — Hamburger | GTS Brand Center | About FAQs Cart */}
      <div className="relative w-full flex items-center justify-between min-h-[38px] pb-1.5">
        {/* Left: Mobile Hamburger / Desktop User Account Pill */}
        <div className="flex-1 flex justify-start items-center">
          {/* Mobile Hamburger Menu Icon Button */}
          <button
            aria-label="Open menu"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="sm:hidden p-1.5 text-[#010101] hover:bg-gray-100 rounded-full transition-colors shrink-0"
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
          {/* Wishlist Icon Button */}
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-gray-50 transition-all shrink-0 shadow-2xs"
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
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#010101] text-white text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-2xs font-sans animate-fade-in">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart Icon Button */}
          <Link
            href="/cart"
            aria-label="Shopping Cart"
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-gray-50 transition-all shrink-0 shadow-2xs"
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
            {totalItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#010101] text-white text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-2xs font-sans animate-fade-in">
                {totalItemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Backdrop overlay when search is open */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsSearchOpen(false)}
        />
      )}

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
            transform: isSearchOpen ? "none" : "translateY(0)",
            opacity: 1,
            transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out",
            willChange: isSearchOpen ? "auto" : "transform, opacity",
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

          {/* Center Search Pill — single search bar in navbar; expands & mounts dropdown card when active */}
          <div
            className={`relative flex-1 transition-all duration-300 ${
              isSearchOpen ? "sm:max-w-xl lg:max-w-2xl z-50" : "sm:max-w-md lg:max-w-lg z-10"
            }`}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = searchQuery.trim();
                if (trimmed) {
                  setIsSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                }
              }}
              className={`flex items-center justify-between rounded-full pl-4 sm:pl-5 pr-1 h-9 sm:h-[38px] transition-all relative ${
                isSearchOpen
                  ? "bg-white border border-[#010101] shadow-md ring-1 ring-[#010101]/10 z-50"
                  : "bg-[#F2F0EA] hover:bg-[#EAE7DF]"
              }`}
            >
              <input
                type="text"
                placeholder="Search products, brands and categories"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-[#010101] placeholder-[#A4A4A4] outline-none w-full font-medium cursor-text"
              />
              <button
                type="submit"
                aria-label="Search"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#010101] text-white shadow-2xs flex items-center justify-center shrink-0 ml-2 hover:bg-black transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>

            {/* Dropdown Card attached directly under the navbar search bar */}
            <SearchDropdownCard
              isOpen={isSearchOpen}
              query={searchQuery}
              onClose={() => setIsSearchOpen(false)}
              onSelectTerm={(term) => setSearchQuery(term)}
            />
          </div>

          {/* Mobile-only compact Categories pill — animatedly fades away when search is focused */}
          <div
            className={`sm:hidden shrink-0 transition-all duration-300 ease-out origin-right ${
              isSearchOpen
                ? "max-w-0 opacity-0 pointer-events-none scale-95 overflow-hidden -ml-2.5"
                : "max-w-[140px] opacity-100 scale-100 ml-0"
            }`}
          >
            <CategoryMegaMenu />
          </div>

          {/* Right Category Chips Track */}
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

      {/* ── Mobile Navigation Drawer ── */}
      {isMobileDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 text-[#010101] font-sans">
            {/* ── Drawer Body: Account + Navigation ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6">
              {/* Account Menu Items */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    openAuthModal("login");
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left"
                >
                  <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>My Account</span>
                </button>

                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                  <svg className="w-5 h-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <span>Orders</span>
                </div>

                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                  <svg className="w-5 h-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span>Inbox</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    router.push("/wishlist");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    <span>Wishlist</span>
                  </div>
                  {wishlistCount > 0 && (
                    <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                      {wishlistCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    router.push("/cart");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span>My Cart</span>
                  </div>
                  {totalItemCount > 0 && (
                    <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                      {totalItemCount}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                  <svg className="w-5 h-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3 7.5h18a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 013 7.5z" />
                  </svg>
                  <span>Voucher</span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="pt-2 space-y-1">
                <p className="text-[11px] font-bold text-[#A4A4A4] uppercase tracking-widest px-3 mb-2 font-sans">Navigation</p>
                <Link
                  href="/search"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA]"
                >
                  <span>Shop Catalog</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/about"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA]"
                >
                  <span>About GTS</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/#faq"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA]"
                >
                  <span>FAQs</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* ── Anchored Drawer Footer: Sign In Button Pinned at Bottom ── */}
            <div className="p-4 border-t border-gray-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  openAuthModal("login");
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#010101] hover:bg-[#010101]/90 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] group/btn cursor-pointer"
              >
                <span>Sign in</span>
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
