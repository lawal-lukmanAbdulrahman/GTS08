"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminTopStrip } from "./sidebar-context";

interface OverviewData {
  kpis: {
    total_revenue_kobo: number;
    total_revenue_naira: number;
    total_orders: number;
    low_stock_count: number;
    total_customers: number;
  };
  recent_orders: Array<{
    id: string;
    order_number: string;
    channel: string;
    status: string;
    total: number;
    created_at: string;
    customer?: { full_name: string; email: string };
  }>;
  top_products: Array<{
    id: string;
    name: string;
    slug: string;
    base_price: number;
    total_sold: number;
    category?: { name: string };
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [productCutTab, setProductCutTab] = useState<"margin" | "revenue">("margin");
  
  // Scroll state for sticky header border
  const [scrolled, setScrolled] = useState<boolean>(false);

  // Revenue chart interactive hover state (defaults to index 3 - Thursday)
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(3);

  // Content visits traffic visualizer state
  const [visitFilter, setVisitFilter] = useState<string>("30d");
  const [hoveredVisitIndex, setHoveredVisitIndex] = useState<number | null>(29);

  useEffect(() => {
    // Format current time HH:MM
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    // Listen to parent main container scroll
    const mainEl = document.querySelector("main");
    if (mainEl) {
      const handleScroll = () => {
        setScrolled(mainEl.scrollTop > 10);
      };
      mainEl.addEventListener("scroll", handleScroll);
      return () => mainEl.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("gts_token") || getCookie("gts_access_token");
    if (!token) {
      router.push("/login?redirect=/admin");
      return;
    }

    async function fetchOverview() {
      try {
        const res = await fetch("http://localhost:3000/api/v1/analytics/overview", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401 || res.status === 403) {
          router.push("/login?redirect=/admin");
          return;
        }
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, [router]);

  function getCookie(name: string) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return null;
  }

  const formatNaira = (kobo: number) => {
    return "₦" + (kobo / 100).toLocaleString("en-NG");
  };

  const revenueDays = [
    { day: "Mon", val: "₦4,200", heightPct: 44 },
    { day: "Tue", val: "₦7,500", heightPct: 66 },
    { day: "Wed", val: "₦4,400", heightPct: 44 },
    { day: "Thu", val: "₦9,340", heightPct: 86 }, // Middle bar sits in between 7.5 and 12.5 (top at 14%)
    { day: "Fri", val: "₦7,800", heightPct: 68 },
    { day: "Sat", val: "₦4,800", heightPct: 44 },
    { day: "Sun", val: "₦6,400", heightPct: 60 },
  ];

  const activeIndex = (hoveredBarIndex !== null && hoveredBarIndex >= 0 && hoveredBarIndex < revenueDays.length)
    ? hoveredBarIndex
    : 3;
  const activeData = revenueDays[activeIndex] ?? { day: "Thu", val: "₦9,340", heightPct: 86 };

  // Calculate top-left shoulder position of active bar
  // Each bar slot is (100 / 7)% wide.
  // Left shoulder sits at slot_start + padding
  const activeBarLeftPct = (activeIndex / 7) * 100 + (100 / 7) * 0.18;
  const activeTopPct = 100 - activeData.heightPct;

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto transition-colors duration-200">
      {/* ────── STICKY TOP PAGE HEADER (METADATA + GREETING ROW COMBINED) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2 lg:-mx-5 lg:-mt-3.5 lg:px-5 space-y-3 transition-all duration-200 ${
          scrolled
            ? "bg-[#F8F7F4]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#262626] shadow-2xs"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Dashboard", href: "/admin" },
            { label: "Overview" },
          ]}
        />

        {/* Greeting & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-0.5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#010101] dark:text-white">Good morning, Admin</h1>
            <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">Realtime sales update and manage your employees</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Export Button */}
            <button className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              <span>Export</span>
            </button>

            {/* New Product Action Button */}
            <Link
              href="/admin/products"
              className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] hover:bg-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Product</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ────── 2. TOP CARDS WITH SLEEK 3D WATERMARKS IN IMAGE 2 STYLE ────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Bank Payouts - Typical Bank Building Watermark */}
            <div className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28">
              <div className="relative z-10 space-y-1">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                  Bank Payouts
                </span>
                {loading ? (
                  <div className="h-8 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                    ₦285,400
                  </p>
                )}
              </div>
              {loading ? (
                <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
              ) : (
                <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  +18.4% vs last week
                </div>
              )}

              {/* Bank Building Watermark */}
              <div className="absolute -right-5 -bottom-6 w-30 h-24 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
                <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <style>{`
                      .wm-bank-g1-s1 { stop-color: #D1D5DB; }
                      .wm-bank-g1-s2 { stop-color: #9CA3AF; }
                      .wm-bank-g2-s1 { stop-color: #9CA3AF; }
                      .wm-bank-g2-s2 { stop-color: #6B7280; }
                      .wm-bank-stroke1 { stroke: rgba(0, 0, 0, 0.12); }
                      .wm-bank-stroke2 { stroke: rgba(0, 0, 0, 0.10); }
                      .dark .wm-bank-g1-s1 { stop-color: #303030; }
                      .dark .wm-bank-g1-s2 { stop-color: #1A1A1A; }
                      .dark .wm-bank-g2-s1 { stop-color: #3A3A3A; }
                      .dark .wm-bank-g2-s2 { stop-color: #1E1E1E; }
                      .dark .wm-bank-stroke1 { stroke: rgba(255, 255, 255, 0.18); }
                      .dark .wm-bank-stroke2 { stroke: rgba(255, 255, 255, 0.14); }
                    `}</style>
                    <linearGradient id="bankFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="1" />
                    </linearGradient>

                    <mask id="fadeTopLeftBank">
                      <rect x="0" y="0" width="120" height="100" fill="url(#bankFadeMask)" />
                    </mask>

                    <linearGradient id="bankGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-bank-g1-s1" />
                      <stop offset="100%" className="wm-bank-g1-s2" />
                    </linearGradient>
                    <linearGradient id="bankPillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" className="wm-bank-g2-s1" />
                      <stop offset="100%" className="wm-bank-g2-s2" />
                    </linearGradient>
                  </defs>

                  <g mask="url(#fadeTopLeftBank)" transform="rotate(-6 60 50)">
                    {/* Triangular Bank Pediment Roof */}
                    <path
                      d="M 60 12 L 105 32 L 15 32 Z"
                      fill="url(#bankGrad1)"
                      className="wm-bank-stroke1"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />

                    {/* Frieze / Architrave beam */}
                    <rect
                      x="18"
                      y="33"
                      width="84"
                      height="8"
                      rx="2"
                      fill="url(#bankGrad1)"
                      className="wm-bank-stroke1"
                      strokeWidth="1.4"
                    />

                    {/* 4 Bank Pillars/Columns */}
                    <rect x="23" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
                    <rect x="43" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
                    <rect x="63" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
                    <rect x="83" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />

                    {/* Base Steps Platform */}
                    <rect x="12" y="82" width="96" height="7" rx="2" fill="url(#bankGrad1)" className="wm-bank-stroke1" strokeWidth="1.4" />
                    <rect x="8" y="90" width="104" height="8" rx="2" fill="url(#bankGrad1)" className="wm-bank-stroke1" strokeWidth="1.4" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Card 2: Cash In Register - Stacked Cash Banknotes Watermark */}
            <div className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28">
              <div className="relative z-10 space-y-1">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                  Cash In Register
                </span>
                {loading ? (
                  <div className="h-8 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                    ₦45,200
                  </p>
                )}
              </div>
              {loading ? (
                <div className="h-3.5 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
              ) : (
                <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ ₦0 variance
                </div>
              )}

              {/* Stacked Cash Banknotes Watermark */}
              <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
                <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <style>{`
                      .wm-cash-g1-s1 { stop-color: #D1D5DB; }
                      .wm-cash-g1-s2 { stop-color: #9CA3AF; }
                      .wm-cash-g2-s1 { stop-color: #CBD5E1; }
                      .wm-cash-g2-s2 { stop-color: #64748B; }
                      .wm-cash-g3-s1 { stop-color: #94A3B8; }
                      .wm-cash-g3-s2 { stop-color: #475569; }
                      .wm-cash-stroke1 { stroke: rgba(0, 0, 0, 0.12); }
                      .wm-cash-stroke2 { stroke: rgba(0, 0, 0, 0.16); }
                      .wm-cash-naira { fill: #334155; }
                      .wm-cash-line { stroke: rgba(51, 65, 85, 0.6); }
                      .dark .wm-cash-g1-s1 { stop-color: #303030; }
                      .dark .wm-cash-g1-s2 { stop-color: #1B1B1B; }
                      .dark .wm-cash-g2-s1 { stop-color: #252525; }
                      .dark .wm-cash-g2-s2 { stop-color: #161616; }
                      .dark .wm-cash-g3-s1 { stop-color: #1C1C1C; }
                      .dark .wm-cash-g3-s2 { stop-color: #121212; }
                      .dark .wm-cash-stroke1 { stroke: rgba(255, 255, 255, 0.14); }
                      .dark .wm-cash-stroke2 { stroke: rgba(255, 255, 255, 0.18); }
                      .dark .wm-cash-naira { fill: #FFFFFF; }
                      .dark .wm-cash-line { stroke: rgba(255, 255, 255, 0.6); }
                    `}</style>
                    <linearGradient id="cashFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="1" />
                    </linearGradient>

                    <mask id="fadeTopLeftCash">
                      <rect x="0" y="0" width="130" height="100" fill="url(#cashFadeMask)" />
                    </mask>

                    <linearGradient id="cashNoteGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-cash-g1-s1" />
                      <stop offset="100%" className="wm-cash-g1-s2" />
                    </linearGradient>
                    <linearGradient id="cashNoteGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-cash-g2-s1" />
                      <stop offset="100%" className="wm-cash-g2-s2" />
                    </linearGradient>
                    <linearGradient id="cashNoteGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-cash-g3-s1" stopOpacity="0.8" />
                      <stop offset="100%" className="wm-cash-g3-s2" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>

                  <g mask="url(#fadeTopLeftCash)">
                    {/* Note 3 (Back Right) */}
                    <g transform="rotate(12 90 68)">
                      <rect x="42" y="26" width="74" height="42" rx="6" fill="url(#cashNoteGradBack)" className="wm-cash-stroke1" strokeWidth="1.2" />
                      <circle cx="79" cy="47" r="7" className="wm-cash-stroke1" strokeWidth="1.2" />
                    </g>

                    {/* Note 2 (Middle) */}
                    <g transform="rotate(-2 70 58)">
                      <rect x="30" y="24" width="74" height="42" rx="6" fill="url(#cashNoteGradMid)" className="wm-cash-stroke1" strokeWidth="1.4" />
                      <rect x="36" y="30" width="62" height="30" rx="4" className="wm-cash-stroke1" strokeWidth="1.2" />
                      <circle cx="67" cy="45" r="8" className="wm-cash-stroke2" strokeWidth="1.4" />
                    </g>

                    {/* Note 1 (Front Left - Naira Seal & Lines) */}
                    <g transform="rotate(-15 48 54)">
                      <rect x="14" y="22" width="74" height="42" rx="6" fill="url(#cashNoteGradFront)" className="wm-cash-stroke2" strokeWidth="1.6" />
                      <rect x="20" y="28" width="62" height="30" rx="4" className="wm-cash-stroke2" strokeWidth="1.4" />
                      <circle cx="51" cy="43" r="8.5" className="wm-cash-stroke2" strokeWidth="1.6" />
                      <text x="51" y="46" textAnchor="middle" className="wm-cash-naira" fontSize="10" fontWeight="bold" fontFamily="sans-serif">₦</text>
                      <line x1="24" y1="32" x2="32" y2="32" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
                      <line x1="70" y1="54" x2="78" y2="54" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </g>
                </svg>
              </div>
            </div>

            {/* Card 3: Repeat Buyers - Slanted 3D Shopping Cart with Repeat Badge */}
            <div className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28">
              <div className="relative z-10 space-y-1">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                  Repeat Buyers
                </span>
                {loading ? (
                  <div className="h-8 w-20 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-[#EDCF5D] font-sans">
                    42.8%
                  </p>
                )}
              </div>
              {loading ? (
                <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
              ) : (
                <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  +4.2% vs last month
                </div>
              )}

              {/* Slanted 3D Shopping Cart Watermark */}
              <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
                <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <style>{`
                      .wm-cart-g1-s1 { stop-color: #D1D5DB; }
                      .wm-cart-g1-s2 { stop-color: #9CA3AF; }
                      .wm-cart-badge-s1 { stop-color: #9CA3AF; }
                      .wm-cart-badge-s2 { stop-color: #64748B; }
                      .wm-cart-stroke { stroke: rgba(0, 0, 0, 0.14); }
                      .wm-cart-inner-line { stroke: rgba(51, 65, 85, 0.35); }
                      .wm-cart-badge-icon { stroke: #334155; }
                      .dark .wm-cart-g1-s1 { stop-color: #303030; }
                      .dark .wm-cart-g1-s2 { stop-color: #1B1B1B; }
                      .dark .wm-cart-badge-s1 { stop-color: #3A3A3A; }
                      .dark .wm-cart-badge-s2 { stop-color: #222222; }
                      .dark .wm-cart-stroke { stroke: rgba(255, 255, 255, 0.18); }
                      .dark .wm-cart-inner-line { stroke: rgba(255, 255, 255, 0.2); }
                      .dark .wm-cart-badge-icon { stroke: #FFFFFF; }
                    `}</style>
                    <linearGradient id="repeatFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="1" />
                    </linearGradient>

                    <mask id="fadeTopLeftRepeat">
                      <rect x="0" y="0" width="130" height="100" fill="url(#repeatFadeMask)" />
                    </mask>

                    <linearGradient id="cartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-cart-g1-s1" />
                      <stop offset="100%" className="wm-cart-g1-s2" />
                    </linearGradient>
                    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-cart-badge-s1" />
                      <stop offset="100%" className="wm-cart-badge-s2" />
                    </linearGradient>
                  </defs>

                  <g mask="url(#fadeTopLeftRepeat)" transform="rotate(-6 65 50)">
                    {/* Slanted Cart Basket Body */}
                    <path
                      d="M 32 32 L 40 64 C 41 67 44 69 47 69 H 87 C 90 69 93 67 94 64 L 102 32 Z"
                      fill="url(#cartGrad)"
                      className="wm-cart-stroke"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {/* Soft Rounded Cart Top Flange Rim */}
                    <rect
                      x="26"
                      y="25"
                      width="80"
                      height="8"
                      rx="4"
                      fill="url(#cartGrad)"
                      className="wm-cart-stroke"
                      strokeWidth="1.4"
                    />

                    {/* Rounded Handle Bar */}
                    <path
                      d="M 14 27 H 26"
                      className="wm-cart-inner-line"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Slanted inner accent lines inside cart */}
                    <line x1="36" y1="44" x2="98" y2="44" className="wm-cart-inner-line" strokeWidth="2" strokeLinecap="round" />
                    <line x1="38" y1="55" x2="94" y2="55" className="wm-cart-inner-line" strokeWidth="2" strokeLinecap="round" />

                    {/* Soft Rounded Cart Wheels */}
                    <circle cx="48" cy="76" r="5.5" fill="url(#cartGrad)" className="wm-cart-stroke" strokeWidth="1.5" />
                    <circle cx="86" cy="76" r="5.5" fill="url(#cartGrad)" className="wm-cart-stroke" strokeWidth="1.5" />

                    {/* Repeat Icon Badge at Top Right */}
                    <g transform="translate(80, 8)">
                      <circle cx="15" cy="15" r="13.5" fill="url(#badgeGrad)" className="wm-cart-stroke" strokeWidth="1.6" />
                      <path
                        d="M 15 7.5 C 19 7.5 22.2 10.7 22.2 14.7 C 22.2 16 21.8 17.2 21.1 18.2 M 22.2 18.2 L 21.1 18.2 L 20.3 14.7"
                        className="wm-cart-badge-icon"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 15 21.9 C 11 21.9 7.8 18.7 7.8 14.7 C 7.8 13.4 8.2 12.2 8.9 11.2 M 7.8 11.2 L 8.9 11.2 L 9.7 14.7"
                        className="wm-cart-badge-icon"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  </g>
                </svg>
              </div>
            </div>

            {/* Card 4: Completed Sales - Stacked Order Receipts Watermark */}
            <div className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28">
              <div className="relative z-10 space-y-1">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                  Completed Sales
                </span>
                {loading ? (
                  <div className="h-8 w-20 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                    88.4%
                  </p>
                )}
              </div>
              {loading ? (
                <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
              ) : (
                <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  126 paid out of 142
                </div>
              )}

              {/* Stacked Order Receipts Watermark (Image 2 Style) */}
              <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
                <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <style>{`
                      .wm-rcpt-g1-s1 { stop-color: #D1D5DB; }
                      .wm-rcpt-g1-s2 { stop-color: #9CA3AF; }
                      .wm-rcpt-g2-s1 { stop-color: #CBD5E1; }
                      .wm-rcpt-g2-s2 { stop-color: #64748B; }
                      .wm-rcpt-g3-s1 { stop-color: #94A3B8; }
                      .wm-rcpt-g3-s2 { stop-color: #475569; }
                      .wm-rcpt-stroke { stroke: rgba(0, 0, 0, 0.14); }
                      .wm-rcpt-line { stroke: rgba(51, 65, 85, 0.65); }
                      .dark .wm-rcpt-g1-s1 { stop-color: #303030; }
                      .dark .wm-rcpt-g1-s2 { stop-color: #1B1B1B; }
                      .dark .wm-rcpt-g2-s1 { stop-color: #252525; }
                      .dark .wm-rcpt-g2-s2 { stop-color: #161616; }
                      .dark .wm-rcpt-g3-s1 { stop-color: #1C1C1C; }
                      .dark .wm-rcpt-g3-s2 { stop-color: #121212; }
                      .dark .wm-rcpt-stroke { stroke: rgba(255, 255, 255, 0.18); }
                      .dark .wm-rcpt-line { stroke: rgba(255, 255, 255, 0.85); }
                    `}</style>
                    <linearGradient id="receiptFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="1" />
                    </linearGradient>

                    <mask id="fadeTopLeftReceipt">
                      <rect x="0" y="0" width="130" height="100" fill="url(#receiptFadeMask)" />
                    </mask>

                    <linearGradient id="rcptGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-rcpt-g1-s1" />
                      <stop offset="100%" className="wm-rcpt-g1-s2" />
                    </linearGradient>
                    <linearGradient id="rcptGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-rcpt-g2-s1" />
                      <stop offset="100%" className="wm-rcpt-g2-s2" />
                    </linearGradient>
                    <linearGradient id="rcptGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="wm-rcpt-g3-s1" stopOpacity="0.8" />
                      <stop offset="100%" className="wm-rcpt-g3-s2" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>

                  <g mask="url(#fadeTopLeftReceipt)">
                    {/* Receipt 3 (Back Right) */}
                    <g transform="rotate(10 90 68)">
                      <rect x="60" y="24" width="48" height="70" rx="7" fill="url(#rcptGradBack)" className="wm-rcpt-stroke" strokeWidth="1.2" />
                    </g>

                    {/* Receipt 2 (Middle) */}
                    <g transform="rotate(-2 72 60)">
                      <rect x="42" y="20" width="48" height="70" rx="7" fill="url(#rcptGradMid)" className="wm-rcpt-stroke" strokeWidth="1.4" />
                      <line x1="50" y1="48" x2="78" y2="48" className="wm-rcpt-line" strokeWidth="2.5" strokeLinecap="round" />
                    </g>

                    {/* Receipt 1 (Front Left - Notch & Lines) */}
                    <g transform="rotate(-15 46 54)">
                      <path
                        d="M 22 18 L 54 18 L 62 26 L 62 86 C 62 90 58 92 54 92 L 22 92 C 18 92 14 90 14 86 L 14 26 C 14 20 18 18 22 18 Z"
                        fill="url(#rcptGradFront)"
                        className="wm-rcpt-stroke"
                        strokeWidth="1.6"
                      />
                      <line x1="24" y1="30" x2="38" y2="30" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
                      <line x1="24" y1="48" x2="52" y2="48" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
                      <line x1="24" y1="58" x2="52" y2="58" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
                      <line x1="24" y1="68" x2="52" y2="68" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* ────── 3. REVENUE VISUALIZER + PROFIT MARGIN VS BEST SELLERS CUT ────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Revenue Graph Card - Replicated to the Tee with Interactive Cursor Guide */}
            <div className="lg:col-span-7 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] shadow-sm dark:shadow-xl relative overflow-hidden flex flex-col justify-between transition-colors">
              {/* Header Row */}
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E8E] font-sans block">
                    Revenue
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-sans">
                    {formatNaira(data?.kpis.total_revenue_kobo || 1098556)}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#E55353]">
                    <span>2.5%</span>
                    <span>↓</span>
                    <span className="text-gray-500 dark:text-[#8E8E8E]">vs last week</span>
                  </div>
                </div>

                {/* Timeframe Select Button */}
                <div className="relative">
                  <select className="appearance-none bg-gray-100 dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2E2E2E] text-xs font-medium text-gray-800 dark:text-[#D1D5DB] rounded-[8px] px-3 py-1.5 pr-7 focus:outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-[#252525] transition-colors">
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-[#8E8E8E] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Chart Visualiser Area */}
              <div className="relative pt-4 mt-1">
                {/* Y-Axis Canvas Container (176px compact height) */}
                <div className="h-44 relative w-full">
                  {/* Y-Axis Horizontal Grid Lines (With 24% Spacing & Room Below 2.5) */}
                  <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none z-0">
                    {[
                      { label: "12.5", top: "0%" },
                      { label: "7.5", top: "24%" },
                      { label: "5.0", top: "48%" },
                      { label: "2.5", top: "72%" },
                    ].map((g, idx) => (
                      <div key={idx} className="absolute inset-x-0 flex items-center justify-between" style={{ top: g.top }}>
                        <div className="w-full h-[1px] bg-gray-200 dark:bg-[#262626]/80" />
                        <span className="pl-3 text-[11px] font-mono text-gray-400 dark:text-[#666666] min-w-[28px] text-right shrink-0 font-medium -translate-y-1/2">
                          {g.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Dashed Horizontal Guide Line extending from top-left shoulder of active bar */}
                  <div
                    className="absolute right-9 h-[1px] border-t border-dashed border-gray-400 dark:border-white/50 pointer-events-none z-20 transition-all duration-200 ease-out"
                    style={{
                      left: `${activeBarLeftPct}%`,
                      top: `${activeTopPct}%`,
                    }}
                  />

                  {/* Tooltip Chip (Pill shape) - Smart positioning so it never gets cut at the left edge */}
                  <div
                    className={`absolute z-30 -translate-y-1/2 pointer-events-none transition-all duration-200 ease-out ${
                      activeBarLeftPct < 15
                        ? "translate-x-3"
                        : "-translate-x-[calc(100%+8px)]"
                    }`}
                    style={{
                      top: `${activeTopPct}%`,
                      left: `${activeBarLeftPct}%`,
                    }}
                  >
                    <div className="px-2.5 py-0.5 rounded-full bg-gray-900/95 dark:bg-[#181818]/90 border border-gray-700 dark:border-[#3A3A3A] text-[10px] font-mono font-medium text-white shadow-xl whitespace-nowrap">
                      {activeData.val}
                    </div>
                  </div>

                  {/* Blue Indicator Dot resting directly on the top-left shoulder of the active bar (Image 1) */}
                  <div
                    className="absolute z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 ease-out"
                    style={{
                      top: `${activeTopPct}%`,
                      left: `${activeBarLeftPct}%`,
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-[#3B82F6] ring-2 ring-gray-200 dark:ring-[#121212] shadow-lg animate-pulse" />
                  </div>

                  {/* Bar Chart Bars Row (Ends flush at bottom baseline at top 96%) */}
                  <div className="absolute inset-x-0 top-0 bottom-0 flex items-end justify-between px-1 pr-9 z-10 border-b border-gray-200 dark:border-[#262626]/80 pb-0">
                    {revenueDays.map((d, i) => {
                      const isHoveredOrActive = activeIndex === i;
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredBarIndex(i)}
                          onMouseLeave={() => setHoveredBarIndex(3)}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                        >
                          {/* Bar Body */}
                          <div
                            className={`w-full max-w-[40px] rounded-t-[10px] transition-all duration-200 relative ${
                              isHoveredOrActive
                                ? /* Active Bar (Image 2): Vibrant Gold/Orange gradient with top-left glossy glass reflection sheen */
                                  "bg-gradient-to-b from-[#FFF1A8] via-[#EDCF5D] to-[#B89628] scale-y-[1.01] origin-bottom"
                                : /* Inactive Bar (Image 3): Metallic gray top fading out seamlessly into transparent bottom */
                                  "bg-gradient-to-b from-gray-300 via-gray-200 to-transparent dark:from-[#444444] dark:via-[#242424] dark:to-transparent hover:from-gray-400 dark:hover:from-[#555555] border-t border-x border-gray-300/60 dark:border-[#505050]/40 border-b-0"
                            }`}
                            style={{ height: `${d.heightPct}%` }}
                          >
                            {/* Inner Glassy Top-Left Gloss Reflection Overlay (Image 2 style) */}
                            {isHoveredOrActive && (
                              <div className="absolute inset-0 rounded-t-[10px] bg-gradient-to-br from-white/70 via-transparent to-transparent pointer-events-none" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-Axis Day Labels Row - Placed directly below baseline with tight bottom space */}
                <div className="flex items-center justify-between px-1 pr-9 pt-1.5 z-10 relative">
                  {revenueDays.map((d, i) => {
                    const isHoveredOrActive = activeIndex === i;
                    return (
                      <div key={i} className="flex-1 text-center">
                        <span className={`text-[10px] font-mono transition-colors ${
                          isHoveredOrActive ? "text-gray-900 dark:text-[#EDCF5D] font-bold" : "text-gray-500 dark:text-[#8E8E8E]"
                        }`}>
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Profit Margin vs. Revenue Cut Card */}
            <div className="lg:col-span-5 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] shadow-sm dark:shadow-xl flex flex-col transition-colors">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-2 mb-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Product Profits</h3>
                  <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Profit Margin vs. Sales Volume</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-gray-100 dark:bg-[#242424] p-0.5 rounded-[6px]">
                  <button
                    onClick={() => setProductCutTab("margin")}
                    className={`px-2 py-1 text-[10px] font-bold rounded-[5px] transition-all ${
                      productCutTab === "margin"
                        ? "bg-[#EDCF5D] text-[#121316]"
                        : "text-gray-500 dark:text-[#9CA3AF]"
                    }`}
                  >
                    Best Margin
                  </button>
                  <button
                    onClick={() => setProductCutTab("revenue")}
                    className={`px-2 py-1 text-[10px] font-bold rounded-[5px] transition-all ${
                      productCutTab === "revenue"
                        ? "bg-[#EDCF5D] text-[#121316]"
                        : "text-gray-500 dark:text-[#9CA3AF]"
                    }`}
                  >
                    Best Sellers
                  </button>
                </div>
              </div>

              <div className="flex-1 max-h-[250px] overflow-y-auto pr-1">
                {/* Tab 1: Best Margin (Permanently mounted in DOM) */}
                <div className={productCutTab === "margin" ? "block divide-y divide-gray-100 dark:divide-[#262626]" : "hidden"}>
                  {/* Item 1: Urban Vintage Denim Jacket */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/denim_jacket.png"
                          alt="Urban Vintage Denim Jacket"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Urban Vintage Denim Jacket</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Outerwear · Cost ₦18k / Price ₦64.8k</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px]">
                        72% Profit
                      </span>
                    </div>
                  </div>

                  {/* Item 2: Classic Cotton Oxford Shirt */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/oxford_shirt.png"
                          alt="Classic Cotton Oxford Shirt"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Classic Cotton Oxford Shirt</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Men's Shirts · Cost ₦15k / Price ₦48k</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px]">
                        68% Profit
                      </span>
                    </div>
                  </div>

                  {/* Item 3: Heavyweight Oversized Streetwear Hoodie */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/hoodie.png"
                          alt="Heavyweight Oversized Streetwear Hoodie"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Heavyweight Streetwear Hoodie</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Streetwear · Cost ₦22k / Price ₦64.8k</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px]">
                        66% Profit
                      </span>
                    </div>
                  </div>

                  {/* Item 4: Tailored Lightweight Linen Coat */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/linen_coat.png"
                          alt="Tailored Lightweight Linen Coat"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Tailored Lightweight Linen Coat</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Outerwear · Cost ₦26k / Price ₦64.8k</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px]">
                        60% Profit
                      </span>
                    </div>
                  </div>

                  {/* Item 5: Air Jordan 1 Retro High OG */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/hero/air_jordan_retro_1_blue.png"
                          alt="Air Jordan 1 Retro High OG"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Air Jordan 1 Retro High OG</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Footwear · Cost ₦280k / Price ₦450k</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold text-[11px]">
                        38% Profit
                      </span>
                    </div>
                  </div>

                  {/* Item 6: Google Pixel 10 Pro 5G */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/pixel_10.png"
                          alt="Google Pixel 10 Pro 5G"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Google Pixel 10 Pro 5G</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Smartphones · Cost ₦950k / Price ₦1.25M</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold text-[11px]">
                        24% Profit
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tab 2: Best Sellers (Permanently mounted in DOM to prevent reloading/flicker) */}
                <div className={productCutTab === "revenue" ? "block divide-y divide-gray-100 dark:divide-[#262626]" : "hidden"}>
                  {/* Item 1: Air Jordan 1 Retro High OG */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/hero/air_jordan_retro_1_blue.png"
                          alt="Air Jordan 1 Retro High OG"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Air Jordan 1 Retro High OG</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Sneakers & Boots · ₦450,000</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">320 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦144.0M Rev</p>
                    </div>
                  </div>

                  {/* Item 2: Heavyweight Oversized Streetwear Hoodie */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/hoodie.png"
                          alt="Heavyweight Streetwear Hoodie"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Heavyweight Streetwear Hoodie</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Men's Clothing · ₦64,800</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">1,100 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦71.3M Rev</p>
                    </div>
                  </div>

                  {/* Item 3: Urban Vintage Denim Jacket */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/denim_jacket.png"
                          alt="Urban Vintage Denim Jacket"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Urban Vintage Denim Jacket</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Men's Clothing · ₦64,800</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">892 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦57.8M Rev</p>
                    </div>
                  </div>

                  {/* Item 4: Classic Cotton Oxford Shirt */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/oxford_shirt.png"
                          alt="Classic Cotton Oxford Shirt"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Classic Cotton Oxford Shirt</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Men's Clothing · ₦48,000</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">560 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦26.9M Rev</p>
                    </div>
                  </div>

                  {/* Item 5: Google Pixel 10 Pro 5G */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/pixel_10.png"
                          alt="Google Pixel 10 Pro 5G"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Google Pixel 10 Pro 5G</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Smartphones · ₦1,250,000</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">230 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦287.5M Rev</p>
                    </div>
                  </div>

                  {/* Item 6: Tailored Lightweight Linen Coat */}
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img
                          src="/products/linen_coat.png"
                          alt="Tailored Lightweight Linen Coat"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[160px]">Tailored Lightweight Linen Coat</p>
                        <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">Outerwear · ₦64,800</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">150 sold</p>
                      <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF]">₦9.7M Rev</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* ────── 6. RECENT ORDERS STREAM ────── */}
          <div className="p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] space-y-3 shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Orders</h3>
              <Link href="/admin/orders" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
                View all orders →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#262626] text-gray-500 dark:text-[#6B7280] font-semibold uppercase text-[10px]">
                    <th className="pb-3">Order Number</th>
                    <th className="pb-3">Channel</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {!data?.recent_orders || data.recent_orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-[#6B7280] font-mono">
                        No recent orders found
                      </td>
                    </tr>
                  ) : (
                    data.recent_orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-[#242424] transition-colors">
                        <td className="py-3.5 font-mono font-bold text-gray-900 dark:text-white">{o.order_number}</td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase ${
                              o.channel === "online"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {o.channel}
                          </span>
                        </td>
                        <td className="py-3.5 text-gray-600 dark:text-[#9CA3AF]">
                          {o.customer?.full_name || o.customer?.email || "Guest"}
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#262626] text-gray-800 dark:text-white border border-gray-200 dark:border-transparent">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatNaira(o.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ────── 3.5 LEADS BY STATUS + STOREFRONT VISITS TRAFFIC VISUALIZER ────── */}
          {(() => {
            // High-density dataset precisely reproducing the trajectory of reference Image 2
            const visitPoints = [
              { label: "May 01", val: 54, display: "2.1M" },
              { label: "May 02", val: 49, display: "1.9M" },
              { label: "May 03", val: 51, display: "2.0M" },
              { label: "May 04", val: 48, display: "1.9M" },
              { label: "May 05", val: 50, display: "2.0M" },
              { label: "May 06", val: 46, display: "1.8M" },
              { label: "May 07", val: 44, display: "1.7M" },
              { label: "May 08", val: 41, display: "1.6M" },
              { label: "May 09", val: 38, display: "1.5M" },
              { label: "May 10", val: 40, display: "1.6M" },
              { label: "May 11", val: 36, display: "1.4M" },
              { label: "May 12", val: 33, display: "1.3M" },
              { label: "May 13", val: 35, display: "1.4M" },
              { label: "May 14", val: 37, display: "1.5M" },
              { label: "May 15", val: 32, display: "1.3M" },
              { label: "May 16", val: 34, display: "1.3M" },
              { label: "May 17", val: 30, display: "1.2M" },
              { label: "May 18", val: 36, display: "1.4M" },
              { label: "May 19", val: 32, display: "1.3M" },
              { label: "May 20", val: 42, display: "1.7M" },
              { label: "May 21", val: 38, display: "1.5M" },
              { label: "May 22", val: 44, display: "1.7M" },
              { label: "May 23", val: 35, display: "1.4M" },
              { label: "May 24", val: 33, display: "1.3M" },
              { label: "May 25", val: 37, display: "1.5M" },
              { label: "May 26", val: 41, display: "1.6M" },
              { label: "May 27", val: 39, display: "1.5M" },
              { label: "May 28", val: 34, display: "1.3M" },
              { label: "May 29", val: 36, display: "1.4M" },
              { label: "May 30", val: 40, display: "1.6M" },

              { label: "Jun 01", val: 45, display: "1.8M" },
              { label: "Jun 02", val: 43, display: "1.7M" },
              { label: "Jun 03", val: 48, display: "1.9M" },
              { label: "Jun 04", val: 52, display: "2.1M" },
              { label: "Jun 05", val: 47, display: "1.9M" },
              { label: "Jun 06", val: 55, display: "2.2M" },
              { label: "Jun 07", val: 72, display: "2.9M" },
              { label: "Jun 08", val: 64, display: "2.5M" },
              { label: "Jun 09", val: 57, display: "2.3M" },
              { label: "Jun 10", val: 61, display: "2.4M" },
              { label: "Jun 11", val: 63, display: "2.5M" },
              { label: "Jun 12", val: 58, display: "2.3M" },
              { label: "Jun 13", val: 60, display: "2.4M" },
              { label: "Jun 14", val: 56, display: "2.2M" },
              { label: "Jun 15", val: 59, display: "2.3M" },
              { label: "Jun 16", val: 64, display: "2.5M" },
              { label: "Jun 17", val: 62, display: "2.4M" },
              { label: "Jun 18", val: 68, display: "2.7M" },
              { label: "Jun 19", val: 65, display: "2.6M" },
              { label: "Jun 20", val: 63, display: "2.5M" },

              { label: "Jun 21", val: 66, display: "2.6M" },
              { label: "Jun 22", val: 61, display: "2.4M" },
              { label: "Jun 23", val: 67, display: "2.7M" },
              { label: "Jun 24", val: 59, display: "2.3M" },
              { label: "Jun 25", val: 28, display: "1.1M" }, // Signature sharp downward spike dip!
              { label: "Jun 26", val: 63, display: "2.5M" },
              { label: "Jun 27", val: 60, display: "2.4M" },
              { label: "Jun 28", val: 64, display: "2.5M" },
              { label: "Jun 29", val: 58, display: "2.3M" },
              { label: "Jun 30", val: 62, display: "2.5M" },
              { label: "Jul 01", val: 66, display: "2.6M" },
              { label: "Jul 02", val: 71, display: "2.8M" },
              { label: "Jul 03", val: 68, display: "2.7M" },
              { label: "Jul 04", val: 76, display: "3.0M" },
              { label: "Jul 05", val: 72, display: "2.9M" },
              { label: "Jul 06", val: 86, display: "3.4M" },
              { label: "Jul 07", val: 79, display: "3.1M" },
              { label: "Jul 08", val: 70, display: "2.8M" },
              { label: "Jul 09", val: 82, display: "3.3M" },
              { label: "Jul 10", val: 77, display: "3.1M" },
              { label: "Jul 11", val: 94, display: "3.8M" }, // Signature massive peak!
              { label: "Jul 12", val: 88, display: "3.5M" },
              { label: "Jul 13", val: 82, display: "3.3M" },
              { label: "Jul 14", val: 85, display: "3.4M" },
              { label: "Jul 15", val: 79, display: "3.1M" },
            ];

            const activeIndex = hoveredVisitIndex !== null ? Math.min(hoveredVisitIndex, visitPoints.length - 1) : 70;
            const activeVisit = visitPoints[activeIndex] || visitPoints[70]!;
            const maxVal = 100;

            const pointsStr = visitPoints
              .map((pt, i) => {
                const x = (i / (visitPoints.length - 1)) * 100;
                const y = 100 - (pt.val / maxVal) * 85;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ");

            const areaPointsStr = `0,100 ${pointsStr} 100,100`;

            const activeX = (activeIndex / (visitPoints.length - 1)) * 100;
            const activeY = 100 - (activeVisit.val / maxVal) * 85;

            const storefrontFunnelData = [
              { label: "Storefront Visits", widthPct: "84%", count: "102.4M" },
              { label: "Added to Cart", widthPct: "68%", count: "42.8k" },
              { label: "Checkout Reserved", widthPct: "52%", count: "18.4k" },
              { label: "Paid Orders", widthPct: "38%", count: "12.6k" },
              { label: "Abandoned Cart", widthPct: "24%", count: "5.8k" },
            ];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT CARD (Col 4): Storefront Funnel / Checkout Conversion */}
                <div className="lg:col-span-4 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] shadow-sm dark:shadow-xl transition-colors font-sans flex flex-col justify-between">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs font-mono text-gray-500 dark:text-[#8E8E8E] block mb-0.5">
                        Storefront Funnel
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white tracking-tight">
                          68.5%
                        </span>
                        <span className="text-xs font-mono text-gray-400 dark:text-[#666666]">
                          checkout conversion
                        </span>
                      </div>
                    </div>

                    {/* Circular Chevron Button */}
                    <button className="w-6.5 h-6.5 rounded-full bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-all cursor-pointer shadow-2xs shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  {/* 5 Horizontal Faded Pill Progress Bars (Checkout Conversion Funnel) */}
                  <div className="space-y-2.5 my-auto pt-1">
                    {storefrontFunnelData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 justify-between">
                        <div className="flex-1 relative flex items-center">
                          <div
                            className="h-6 rounded-r-full bg-gradient-to-r from-transparent via-amber-500/15 to-[#EDCF5D]/30 border border-[#EDCF5D]/30 border-l-0 flex items-center justify-end px-2.5 text-[10px] font-mono font-medium text-gray-800 dark:text-white/95 shadow-2xs transition-all hover:border-[#EDCF5D]/60 [mask-image:linear-gradient(to_right,transparent_0%,black_24%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_24%,black_100%)]"
                            style={{ width: item.widthPct }}
                          >
                            <span className="whitespace-nowrap truncate">{item.label}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0 min-w-[32px] text-right">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT CARD (Col 8): Storefront visits Traffic Visualizer (Primary GTS Gold Accent) */}
                <div className="lg:col-span-8 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] shadow-sm dark:shadow-xl transition-colors font-sans flex flex-col justify-between">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-xs font-mono text-gray-500 dark:text-[#8E8E8E] block mb-1">
                        Storefront visits
                      </span>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white tracking-tight">
                          102.45M
                        </span>
                        <span className="text-xs font-mono text-gray-400 dark:text-[#666666]">
                          vs last month
                        </span>
                      </div>
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative">
                      <button className="px-3 py-1.5 rounded-[8px] bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-mono text-gray-700 dark:text-gray-300 flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-all cursor-pointer shadow-2xs">
                        <span>Filters</span>
                        <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Main Content Flex: Chart Canvas (Fluid flex-1) + Growth KPI Cards (Fixed w-[84px]) */}
                  <div className="flex flex-col sm:flex-row items-center gap-3.5">
                    {/* Chart Area */}
                    <div className="flex-1 min-w-0 relative h-44 w-full group">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="visitGoldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EDCF5D" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#EDCF5D" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Area Fill */}
                        <polygon points={areaPointsStr} fill="url(#visitGoldGradient)" />

                        {/* High-density Sparkline Stroke Line with GTS Gold Primary Color (#EDCF5D) */}
                        <polyline
                          fill="none"
                          stroke="#EDCF5D"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pointsStr}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Interactive Cursor Tracking Overlay */}
                      <div
                        className="absolute inset-0 cursor-crosshair z-20"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const pct = Math.max(0, Math.min(1, x / rect.width));
                          const idx = Math.round(pct * (visitPoints.length - 1));
                          setHoveredVisitIndex(idx);
                        }}
                        onMouseLeave={() => setHoveredVisitIndex(70)}
                      />

                      {/* Hover Guide Line & Active Indicator */}
                      {activeVisit && (
                        <>
                          <div
                            className="absolute top-0 bottom-0 w-[1px] bg-[#EDCF5D]/50 pointer-events-none z-10"
                            style={{ left: `${activeX}%` }}
                          />
                          <div
                            className="absolute w-2.5 h-2.5 rounded-full bg-[#EDCF5D] border-2 border-white dark:border-[#181818] shadow-md pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                            style={{ left: `${activeX}%`, top: `${activeY}%` }}
                          />
                          <div
                            className="absolute z-30 pointer-events-none -translate-y-full mb-2 transition-all duration-75"
                            style={{
                              left: `${Math.min(90, Math.max(10, activeX))}%`,
                              top: `${activeY}%`,
                              transform: "translate(-50%, -120%)",
                            }}
                          >
                            <div className="px-2 py-0.5 rounded-[6px] bg-gray-900/95 dark:bg-[#111111]/95 border border-gray-700 dark:border-[#333333] text-[10px] font-mono text-white shadow-xl whitespace-nowrap flex items-center gap-1.5">
                              <span className="text-[#EDCF5D] font-bold">{activeVisit.label}:</span>
                              <span>{activeVisit.display} visits</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right Sidebar KPI Growth Cards Stack (Ultra-Compact Width w-[84px]) */}
                    <div className="w-full sm:w-[84px] shrink-0 space-y-1">
                      {/* 1y Growth Card */}
                      <div className="px-2 py-1 rounded-[7px] bg-gray-50 dark:bg-[#141414] border border-gray-200/80 dark:border-[#262626] transition-colors">
                        <p className="text-[8.5px] font-mono text-gray-500 dark:text-[#8E8E8E] leading-tight">1y Growth</p>
                        <p className="text-[9.5px] font-mono font-bold text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-0.5">
                          <span>12.5%</span>
                          <span>↓</span>
                        </p>
                      </div>

                      {/* 6m Growth Card */}
                      <div className="px-2 py-1 rounded-[7px] bg-gray-50 dark:bg-[#141414] border border-gray-200/80 dark:border-[#262626] transition-colors">
                        <p className="text-[8.5px] font-mono text-gray-500 dark:text-[#8E8E8E] leading-tight">6m Growth</p>
                        <p className="text-[9.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5">
                          <span>+25%</span>
                          <span>↑</span>
                        </p>
                      </div>

                      {/* 3m Growth Card */}
                      <div className="px-2 py-1 rounded-[7px] bg-gray-50 dark:bg-[#141414] border border-gray-200/80 dark:border-[#262626] transition-colors">
                        <p className="text-[8.5px] font-mono text-gray-500 dark:text-[#8E8E8E] leading-tight">3m Growth</p>
                        <p className="text-[9.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5">
                          <span>+25%</span>
                          <span>↑</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ────── 4. UNSOLD INVENTORY WARNING + POPULAR SIZES ────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Unsold Inventory Warning Card */}
            <div className="lg:col-span-6 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] space-y-3 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Unsold Inventory</h3>
                  <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Money tied up in stock (No sales &gt;60 days)</p>
                </div>
                <button className="px-3 py-1 rounded-[6px] bg-[#EDCF5D] text-[#121316] text-[10px] font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
                  <svg className="w-3 h-3 text-[#121316]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <span>Flash Sale</span>
                </button>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-[#242424]">
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                      <img
                        src="/products/denim_jacket.png"
                        alt="Urban Vintage Denim Jacket"
                        className="w-full h-full object-contain p-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">GTS Vintage Denim Jacket</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">18 units sitting for 64 days</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-red-500 dark:text-red-400">
                    ₦320,000 Tied Up
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-gray-100 dark:bg-[#242424] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative">
                      <img
                        src="/products/linen_coat.png"
                        alt="Tailored Lightweight Linen Coat"
                        className="w-full h-full object-contain p-0.5"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Tailored Lightweight Linen Coat</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">14 units sitting for 45 days</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    ₦112,000 Tied Up
                  </span>
                </div>
              </div>
            </div>

            {/* Popular Sizes */}
            <div className="lg:col-span-6 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] space-y-3 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Popular Sizes</h3>
                  <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Which sizes sell fastest</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-500 font-bold">M & L Sell Out Fast</span>
              </div>

              <div className="space-y-3 pt-1">
                {/* Size M */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-gray-900 dark:text-white">Size M</span>
                    <span className="text-emerald-600 dark:text-emerald-500 font-bold">48% of sales (Restock needed)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "48%" }} />
                  </div>
                </div>

                {/* Size L */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-gray-900 dark:text-white">Size L</span>
                    <span className="text-emerald-600 dark:text-emerald-500 font-bold">34% of sales</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                    <div className="h-full bg-[#EDCF5D] rounded-full" style={{ width: "34%" }} />
                  </div>
                </div>

                {/* Size S */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-gray-900 dark:text-white">Size S / XL</span>
                    <span className="text-gray-500 dark:text-gray-400">12% of sales</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 dark:bg-gray-600 rounded-full" style={{ width: "12%" }} />
                  </div>
                </div>

                {/* Size XS */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-gray-900 dark:text-white">Size XS</span>
                    <span className="text-red-500">6% of sales (Overstocked)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: "6%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ────── 5. STAFF SALES & PROMO ROI ────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Staff Performance */}
            <div className="lg:col-span-7 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] space-y-3 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Staff Sales & Discounts</h3>
                  <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Cashier performance & manual discounts</p>
                </div>
                <Link href="/admin/staff" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
                  Staff logs →
                </Link>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Cashier Ada</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">42 Orders · Avg Sale ₦7,420</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-gray-900 dark:text-white">₦312,000</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold">✓ No discounts given</span>
                  </div>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      T
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Cashier Tobi</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">38 Orders · Avg Sale ₦6,440</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-amber-600 dark:text-[#EDCF5D]">₦245,000</p>
                    <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold">⚠️ 3 manual discounts given</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Promo Code ROI Tracker */}
            <div className="lg:col-span-5 p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] space-y-3 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Promo Code Profit</h3>
                  <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Sales generated from promo codes</p>
                </div>
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-500 font-bold">+380% Profit</span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-[#242424]">
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#EDCF5D] text-[#121316] text-xs font-mono font-bold">
                      GTS20 (20% OFF)
                    </span>
                    <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF] mt-1">28 Uses · ₦112k Discounted</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 font-mono">₦560,000 Sales</span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded-[4px] bg-gray-100 dark:bg-[#2A2A2A] text-gray-900 dark:text-white border border-gray-200 dark:border-transparent text-xs font-mono font-bold">
                      WELCOME10 (10% OFF)
                    </span>
                    <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF] mt-1">15 Uses · ₦19.5k Discounted</p>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white font-mono">₦195,000 Sales</span>
                </div>
              </div>
            </div>
          </div>

          
    </div>
  );
}
