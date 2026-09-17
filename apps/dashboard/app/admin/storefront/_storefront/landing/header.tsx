"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategoryMegaMenu } from "./category-mega-menu";
import { UserAccountMenu } from "./user-account-menu";
import { SearchDropdownCard } from "./search-overlay";
import { saveRecentSearch } from "./search-history";
import { useCart } from "../cart-context";
import { useWishlist } from "../wishlist-context";
import { useAuthModal } from "../auth-modal-context";
import { useAuth } from "../auth-context";
import {
  getCustomerInboxSeenAt,
  getCustomerNotifications,
} from "../../../../../lib/notifications";

// ── Mobile Drawer Categories List (Matches Storefront Catalog) ──
const DRAWER_CATEGORIES = [
  {
    name: "Phone & Tablets",
    query: "Phones & Tablets",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M10 18h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Appliances",
    query: "Appliances",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v3H5zM8 7v4a4 4 0 008 0V7M5 19h14M7 19v2m10-2v2" />
      </svg>
    ),
  },
  {
    name: "Electronics",
    query: "Electronics",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path strokeLinecap="round" d="M16 3l-4 4-4-4" />
        <circle cx="8.5" cy="13.5" r="1.5" fill="currentColor" />
        <path strokeLinecap="round" d="M13 11h4M13 14h4M13 17h2" />
      </svg>
    ),
  },
  {
    name: "Supermarket",
    query: "Supermarket",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a7 7 0 007-7c0-4-3-6-7-6s-7 2-7 6a7 7 0 007 7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V4c2 0 4 1 4 1" />
      </svg>
    ),
  },
  {
    name: "Health & Beauty",
    query: "Health & Beauty",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h4v11H6zM7 10V6l2-2 1 1v5M14 13h4v8h-4zM16 13V9l1-1 1 1v4" />
      </svg>
    ),
  },
  {
    name: "Home & Office",
    query: "Home & Office",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v3H5zM8 7v4a4 4 0 008 0V7M5 19h14M7 19v2m10-2v2" />
        <circle cx="12" cy="14" r="1.5" />
      </svg>
    ),
  },
  {
    name: "Power",
    query: "Power",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5v9.75a1.5 1.5 0 01-1.5 1.5h-15a1.5 1.5 0 01-1.5-1.5V10.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 8.5l-3 4.5h3l-1.5 4.5" />
      </svg>
    ),
  },
  {
    name: "Computing",
    query: "Computing",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M9 20h6M12 16v4" />
      </svg>
    ),
  },
  {
    name: "Women's Fashion",
    query: "Fashion",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3l-2 5 2 2-3 11h12l-3-11 2-2-2-5H9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3a3 3 0 006 0" />
      </svg>
    ),
  },
  {
    name: "Men's Fashion",
    query: "Fashion",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l4 2 3-2 3 2 4-2v17H5V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 7l1 1 1-1-1 7-1-7z" />
      </svg>
    ),
  },
  {
    name: "Baby Products",
    query: "Baby Products",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path strokeLinecap="round" d="M9.5 15a3.5 3.5 0 005 0" />
        <path strokeLinecap="round" d="M12 3a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    name: "Gaming",
    query: "Gaming",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h12a4 4 0 014 4v1a4 4 0 01-6.5 3.1L13 17h-2l-2.5 2.1A4 4 0 012 16v-1a4 4 0 014-4z" />
        <path strokeLinecap="round" d="M6 15h4M8 13v4M16 14h.01M18 16h.01" />
      </svg>
    ),
  },
  {
    name: "Sporting Goods",
    query: "Sporting Goods",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8v8M4 9.5v5M8 9.5v5M18 8v8M16 9.5v5M20 9.5v5M8 12h8" />
      </svg>
    ),
  },
  {
    name: "Automobile",
    query: "Automobile",
    icon: (
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l2-5h10l2 5M4 11h16v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6z" />
        <circle cx="7.5" cy="15.5" r="1.5" />
        <circle cx="16.5" cy="15.5" r="1.5" />
      </svg>
    ),
  },
];

export function Header() {
  const { totalItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { openAuthModal } = useAuthModal();
  const { user, customer, signOut } = useAuth();
  const [inboxBadge, setInboxBadge] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setInboxBadge(0);
      return;
    }
    const checkInbox = async () => {
      try {
        const seenAt = getCustomerInboxSeenAt();
        let unreadCount = 0;

        // 1. Inquiries from API (staff replies)
        const res = await fetch("/api/v1/inquiries");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            const unreadInquiries = json.data.filter((item: any) => {
              if (item.lastSenderType !== "staff") return false;
              if (!seenAt) return true;
              return new Date(item.lastMessageAt).getTime() > new Date(seenAt).getTime();
            });
            unreadCount += unreadInquiries.length;
          }
        }

        // 2. Saved customer notifications (review replies, order phase updates)
        const notifs = getCustomerNotifications();
        const unreadNotifs = notifs.filter((n) => {
          if (!seenAt) return true;
          return new Date(n.createdAt).getTime() > new Date(seenAt).getTime();
        });
        unreadCount += unreadNotifs.length;

        // 3. Fallback check for gts_inbox_notifications
        try {
          const rawReviewNotifs = JSON.parse(localStorage.getItem("gts_inbox_notifications") || "[]");
          if (Array.isArray(rawReviewNotifs)) {
            const existingIds = new Set(notifs.map((n) => n.id));
            const unreadReviews = rawReviewNotifs.filter((n: any) => {
              if (existingIds.has(n.id)) return false;
              if (!seenAt) return true;
              return new Date(n.createdAt || n.date).getTime() > new Date(seenAt).getTime();
            });
            unreadCount += unreadReviews.length;
          }
        } catch {}

        setInboxBadge(unreadCount);
      } catch {}
    };

    checkInbox();

    const handleInboxRead = () => {
      setInboxBadge(0);
    };

    window.addEventListener("gts_inbox_read", handleInboxRead);
    window.addEventListener("gts_notification_received", checkInbox);

    return () => {
      window.removeEventListener("gts_inbox_read", handleInboxRead);
      window.removeEventListener("gts_notification_received", checkInbox);
    };
  }, [user]);

  const displayName =
    customer?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim() ||
    (user?.user_metadata?.name as string)?.trim() ||
    customer?.email?.split("@")[0] ||
    user?.email?.split("@")[0] ||
    "Shopper";

  const avatarInitial = (
    customer?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim() ||
    (user?.user_metadata?.name as string)?.trim() ||
    user?.email ||
    "U"
  ).charAt(0).toUpperCase();
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
  const headerRef = useRef<HTMLElement>(null);

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

    const onScroll = () => {
      if (headerRef.current) {
        const currentScrollY = window.scrollY;
        if (currentScrollY > 10) {
          headerRef.current.style.borderBottomColor = "rgba(209,213,219,0.8)";
          headerRef.current.style.boxShadow = "0 1px 2px 0 rgba(0,0,0,0.05)";
        } else {
          headerRef.current.style.borderBottomColor = isSearchPage ? "#E5E7EB" : "transparent";
          headerRef.current.style.boxShadow = "none";
        }
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
            className="sm:hidden p-1.5 text-[#010101] hover:bg-gray-100 rounded-full transition-colors shrink-0 relative"
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
            {inboxBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#010101] text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white shadow-2xs font-sans animate-fade-in">
                {inboxBadge}
              </span>
            )}
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

      {/* ── SECONDARY ROW: Categories + Single Search Pill + Filter Chips (Stationary) ── */}
      <div className="w-full overflow-visible">
        <div className="w-full flex items-center justify-between gap-3 pb-2">
          {/* Left Wrapper: flex-1 to balance right side width and guarantee search bar is dead-center */}
          <div className="hidden sm:flex items-center gap-2.5 flex-1 min-w-0 justify-start shrink-0">
            <CategoryMegaMenu />
          </div>

          {/* Center Search Pill — dead-center in the header */}
          <div
            className={`relative w-full transition-all duration-300 ${
              isSearchOpen ? "sm:max-w-xl lg:max-w-2xl xl:max-w-3xl z-50" : "sm:max-w-lg lg:max-w-xl xl:max-w-2xl z-10"
            }`}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = searchQuery.trim();
                if (trimmed) {
                  saveRecentSearch(trimmed);
                  setIsSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                }
              }}
              className={`flex items-center justify-between rounded-full pl-4 sm:pl-5 pr-[6px] sm:pr-[5px] h-11 sm:h-[38px] transition-all relative ${
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
                className="bg-transparent text-sm sm:text-sm text-[#010101] placeholder-[#A4A4A4] outline-none w-full font-medium cursor-text"
              />
              <button
                type="submit"
                aria-label="Search"
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-[#010101] text-white shadow-2xs flex items-center justify-center shrink-0 hover:bg-black transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
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

          {/* Right Wrapper: flex-1 to mirror left side width and guarantee search bar is dead-center */}
          <div className="hidden sm:flex group/track relative items-center gap-1 flex-1 min-w-0 justify-end overflow-hidden">
            <button
              aria-label="Scroll chips left"
              onClick={() => scrollChips("left")}
              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-[#010101] hover:bg-[#F2F0EA] active:scale-95 transition-all opacity-0 group-hover/track:opacity-100 pointer-events-none group-hover/track:pointer-events-auto shrink-0 z-20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="relative max-w-[200px] sm:max-w-[280px] md:max-w-[340px] flex-1 min-w-0 flex items-center overflow-hidden">
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
              {/* Guest Welcome Banner */}
              {!user && (
                <div className="flex items-center justify-between p-3.5 bg-[#F9F8F5] rounded-2xl border border-gray-200/80">
                  <div>
                    <p className="font-bold text-sm text-[#010101]">Welcome to GTS</p>
                    <p className="text-xs text-gray-500">Sign in for orders & chat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      openAuthModal("login");
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#010101] text-white text-xs font-bold hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-2xs"
                  >
                    Sign in
                  </button>
                </div>
              )}

              {/* Account Menu Items */}
              <div className="space-y-1">
                {/* My Account */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (user) {
                      router.push("/account");
                    } else {
                      openAuthModal("login");
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>My Account</span>
                </button>

                {/* Orders */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (user) {
                      router.push("/account?tab=orders");
                    } else {
                      openAuthModal("login");
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <span>Orders</span>
                </button>

                {/* Inbox */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (user) {
                      router.push("/account?tab=inbox");
                    } else {
                      openAuthModal("login");
                    }
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span>Inbox</span>
                  </div>
                  {inboxBadge > 0 && (
                    <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                      {inboxBadge}
                    </span>
                  )}
                </button>

                {/* Wishlist */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    router.push("/wishlist");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
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

                {/* My Cart */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    router.push("/cart");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
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

                {/* Vouchers */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (user) {
                      router.push("/account?tab=vouchers");
                    } else {
                      openAuthModal("login");
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3 7.5h18a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 013 7.5z" />
                  </svg>
                  <span>Vouchers & Promos</span>
                </button>
              </div>

              {/* ── OUR CATEGORIES SECTION ── */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between px-3.5 mb-2.5">
                  <span className="text-[11px] font-extrabold text-[#707070] uppercase tracking-wider font-sans">
                    Our Categories
                  </span>
                </div>

                <div className="space-y-0.5">
                  {DRAWER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        router.push(`/search?category=${encodeURIComponent(cat.query)}`);
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-800 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors text-left cursor-pointer group"
                    >
                      <span className="w-5 h-5 flex items-center justify-center text-gray-500 group-hover:text-[#010101] transition-colors shrink-0">
                        {cat.icon}
                      </span>
                      <span className="text-[13.5px] font-medium text-gray-800 group-hover:text-[#010101] flex-1 truncate">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Items */}
              <div className="pt-2 space-y-1 border-t border-gray-100">
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

            {/* ── Anchored Drawer Footer: Contextual Sign In / Sign Out ── */}
            <div className="p-4 border-t border-gray-100 bg-white shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    setIsMobileDrawerOpen(false);
                    await signOut();
                    router.push("/");
                  }}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-red-400 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span>Sign out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    openAuthModal("login");
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] group/btn cursor-pointer"
                >
                  <span>Sign in</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-current group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
