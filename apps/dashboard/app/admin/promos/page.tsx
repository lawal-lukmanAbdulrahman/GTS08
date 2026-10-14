"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";
import { formatKobo } from "@gts/utils";
import PromoCreateDrawer from "./promo-create-drawer";
import PromoDetailDrawer from "./promo-detail-drawer";
import type { PromoEnhancedView } from "./types";

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoEnhancedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "disabled">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "storewide" | "specific_products">("all");
  const [targetFilter, setTargetFilter] = useState<"all" | "all_customers" | "specific_customers">("all");
  const [sortBy, setSortBy] = useState<"newest" | "most_used" | "discount_desc" | "expiring_soon">("newest");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Header scroll state
  const [scrolled, setScrolled] = useState(false);

  // Drawer States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Scroll listener for sticky header
  useEffect(() => {
    const mainEl = document.querySelector("main");
    const handleScroll = () => {
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      setScrolled(scrollY > 10);
    };

    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Click outside to close filter popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    if (showFilterPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterPopover]);

  // Fetch Promo Codes
  const fetchPromos = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiCall<PromoEnhancedView[]>("/promos");
      if (res.ok) {
        setPromos(res.data ?? []);
      } else {
        setErrorMsg(res.message || "Failed to load promo codes.");
      }
    } catch {
      setErrorMsg("Error loading promo codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, scopeFilter, targetFilter, sortBy]);

  // Copy helper
  const handleCopy = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = promos.length;
    const now = Date.now();
    const active = promos.filter(
      (p) => p.is_active && (!p.expires_at || new Date(p.expires_at).getTime() >= now)
    ).length;
    const totalUses = promos.reduce((sum, p) => sum + (p.used_count || 0), 0);
    const targeted = promos.filter((p) => p.target_type === "specific_customers").length;

    return { total, active, totalUses, targeted };
  }, [promos]);

  // Active filters count for filter pill
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (scopeFilter !== "all") count++;
    if (targetFilter !== "all") count++;
    if (sortBy !== "newest") count++;
    return count;
  }, [statusFilter, scopeFilter, targetFilter, sortBy]);

  // Filtered and Sorted List
  const filteredPromos = useMemo(() => {
    const now = Date.now();
    return promos
      .filter((p) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesCode = p.code?.toLowerCase().includes(q);
          const matchesDesc = (p as any).description?.toLowerCase().includes(q);
          if (!matchesCode && !matchesDesc) return false;
        }

        // Status Filter
        if (statusFilter === "active") {
          if (!p.is_active || (p.expires_at && new Date(p.expires_at).getTime() < now)) return false;
        } else if (statusFilter === "expired") {
          if (!p.expires_at || new Date(p.expires_at).getTime() >= now) return false;
        } else if (statusFilter === "disabled") {
          if (p.is_active) return false;
        }

        // Scope Filter
        if (scopeFilter === "storewide" && p.product_scope !== "all") return false;
        if (scopeFilter === "specific_products" && p.product_scope !== "specific_products") return false;

        // Target Filter
        if (targetFilter === "all_customers" && p.target_type !== "all") return false;
        if (targetFilter === "specific_customers" && p.target_type !== "specific_customers") return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "most_used") return (b.used_count || 0) - (a.used_count || 0);
        if (sortBy === "discount_desc") return (b.discount_value || 0) - (a.discount_value || 0);
        if (sortBy === "expiring_soon") {
          const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
          const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
          return aTime - bTime;
        }
        // default "newest"
        const aStart = new Date(a.starts_at || 0).getTime();
        const bStart = new Date(b.starts_at || 0).getTime();
        return bStart - aStart;
      });
  }, [promos, searchQuery, statusFilter, scopeFilter, targetFilter, sortBy]);

  // Pagination Calculations
  const totalEntries = filteredPromos.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, totalEntries);
  const displayedCount = totalEntries === 0 ? 0 : endIndex - startIndex + 1;
  const paginatedPromos = filteredPromos.slice(
    (validCurrentPage - 1) * pageSize,
    validCurrentPage * pageSize
  );

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (validCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, "...", totalPages];
  };

  const resetAllFilters = () => {
    setStatusFilter("all");
    setScopeFilter("all");
    setTargetFilter("all");
    setSortBy("newest");
    setSearchQuery("");
  };

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200">
      {/* ────── STICKY TOP PAGE HEADER (METADATA + TITLE ROW COMBINED) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2.5 sm:-mx-6 lg:-mx-8 lg:-mt-3.5 sm:px-6 lg:px-8 space-y-3 bg-[#F8F7F4]/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md transition-all duration-200 ${
          scrolled
            ? "border-b border-gray-200 dark:border-[#262626] shadow-2xs"
            : "border-b border-transparent"
        }`}
      >
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Marketing", href: "/admin/promos" },
            { label: "Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Promo Codes
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Manage targeted discount campaigns, margins against product costs, and stock promotions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchPromos}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title="Refresh list"
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span>Refresh</span>
            </button>

            {/* Create Promo Code Button (GTS Gold #EDCF5D) */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] hover:bg-white dark:bg-[#EDCF5D] dark:text-[#121316] dark:hover:bg-white text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Create Promo Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────── KPI METRIC CARDS ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Promo Codes */}
        <div
          role="button"
          tabIndex={0}
          onClick={resetAllFilters}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Promo Codes
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {kpis.total}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.active} currently live & active
            </div>
          )}
        </div>

        {/* Card 2: Active Campaigns */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter((prev) => (prev === "active" ? "all" : "active"))}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "active"
              ? "border-emerald-500/80 ring-2 ring-emerald-500/40 dark:border-emerald-400 dark:ring-emerald-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-emerald-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Active Campaigns
              </span>
              {statusFilter === "active" && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {kpis.active}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.total > 0 ? `${Math.round((kpis.active / kpis.total) * 100)}% available now` : "No active campaigns"}
            </div>
          )}
        </div>

        {/* Card 3: Total Redemptions */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSortBy((prev) => (prev === "most_used" ? "newest" : "most_used"))}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            sortBy === "most_used"
              ? "border-amber-500/80 ring-2 ring-amber-500/40 dark:border-amber-400 dark:ring-amber-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-amber-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Total Redemptions
              </span>
              {sortBy === "most_used" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  Sorted
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {kpis.totalUses}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              Orders discounted at checkout
            </div>
          )}
        </div>

        {/* Card 4: Targeted VIP Promos */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setTargetFilter((prev) => (prev === "specific_customers" ? "all" : "specific_customers"))}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            targetFilter === "specific_customers"
              ? "border-purple-500/80 ring-2 ring-purple-500/40 dark:border-purple-400 dark:ring-purple-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-purple-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Targeted VIP Promos
              </span>
              {targetFilter === "specific_customers" && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {kpis.targeted}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-purple-600 dark:text-purple-400">
              {kpis.targeted > 0 ? "Specific customer accounts" : "All codes currently public"}
            </div>
          )}
        </div>
      </div>

      {/* ────── UNIFIED PROMO TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Filter Popover Button */}
            <div className="relative" ref={filterPopoverRef}>
              <button
                type="button"
                onClick={() => setShowFilterPopover((prev) => !prev)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer ${
                  activeFiltersCount > 0
                    ? "bg-[#EDCF5D]/15 text-[#9E7B00] dark:text-[#EDCF5D] border-[#EDCF5D]/40 font-bold"
                    : "bg-white dark:bg-[#222222] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B]"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 6h9m-9 6h9m-9 6h9M3.75 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0"
                  />
                </svg>
                <span>Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Filter Popover Panel */}
              {showFilterPopover && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-88 max-h-[min(520px,80vh)] overflow-y-auto bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#2A2A2A]">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      Filter Campaigns
                    </span>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Target Audience
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "All Audiences", val: "all" },
                        { label: "Public Only", val: "all_customers" },
                        { label: "VIP / Specific", val: "specific_customers" },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setTargetFilter(item.val as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            targetFilter === item.val
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product Scope */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Product Scope
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "All Scopes", val: "all" },
                        { label: "Storewide", val: "storewide" },
                        { label: "Specific Items", val: "specific_products" },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setScopeFilter(item.val as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            scopeFilter === item.val
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="most_used">Most Used First</option>
                      <option value="discount_desc">Highest Discount Value</option>
                      <option value="expiring_soon">Expiring Soonest</option>
                    </select>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {filteredPromos.length} codes found
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFilterPopover(false)}
                      className="px-4 py-1.5 rounded-lg bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black text-xs font-bold shadow-2xs hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Select Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="all">All Status</option>
                <option value="active">Live</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
              </select>
              <svg
                className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Scope Select Filter */}
            <div className="relative">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="all">All Product Scopes</option>
                <option value="storewide">Storewide (All Items)</option>
                <option value="specific_products">Specific Products</option>
              </select>
              <svg
                className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* Right Actions: Search Box & Clear */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64 md:w-72">
              <svg
                className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code name..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] transition-colors"
              />
              {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
              )}
            </div>
          </div>
        </div>

        {/* ────── TABLE CONTENT OR PULSE SKELETON (EXACTLY MATCHING PRODUCTS PAGE) ────── */}
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[#222222] rounded-xl" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-500 font-mono text-xs">{errorMsg}</div>
        ) : filteredPromos.length === 0 ? (
          promos.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-[#EDCF5D] flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">No promo codes found</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto font-mono">
                Get started by creating your first promotional code to boost customer engagement.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] font-bold text-xs hover:bg-white transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Create Promo Code</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/70 dark:bg-[#151515] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono">
                    <th className="py-3 px-4 font-semibold">Promo Code</th>
                    <th className="py-3 px-4 font-semibold">Discount</th>
                    <th className="py-3 px-4 font-semibold">Product Scope</th>
                    <th className="py-3 px-4 font-semibold">Target Audience</th>
                    <th className="py-3 px-4 font-semibold">Uses & Limits</th>
                    <th className="py-3 px-4 font-semibold">Validity Schedule</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 dark:text-[#666666] font-mono text-xs">
                      No promo codes found matching your search/filter criteria
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/70 dark:bg-[#151515] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono">
                  <th className="py-3 px-4 font-semibold">Promo Code</th>
                  <th className="py-3 px-4 font-semibold">Discount</th>
                  <th className="py-3 px-4 font-semibold">Product Scope</th>
                  <th className="py-3 px-4 font-semibold">Target Audience</th>
                  <th className="py-3 px-4 font-semibold">Uses & Limits</th>
                  <th className="py-3 px-4 font-semibold">Validity Schedule</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#222222]">
                {paginatedPromos.map((p) => {
                  const now = Date.now();
                  const isExpired = p.expires_at && new Date(p.expires_at).getTime() < now;
                  const daysRemaining = p.expires_at
                    ? Math.max(0, Math.ceil((new Date(p.expires_at).getTime() - now) / (1000 * 60 * 60 * 24)))
                    : null;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPromoId(p.id)}
                      className="hover:bg-amber-500/[0.03] dark:hover:bg-[#202020] transition-colors cursor-pointer group"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-gray-900 dark:text-white px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#333] tracking-wider">
                            {p.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(p.code, e)}
                            className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#2B2B2B] transition-colors cursor-pointer"
                            title="Copy promo code"
                          >
                            {copiedCode === p.code ? (
                              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Discount */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-amber-600 dark:text-[#EDCF5D] font-mono text-xs">
                          {p.discount_type === "percentage"
                            ? `${p.discount_value}% OFF`
                            : `${formatKobo(p.discount_value)} OFF`}
                        </span>
                      </td>

                      {/* Product Scope */}
                      <td className="py-3.5 px-4">
                        {p.product_scope === "all" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#242424] text-gray-700 dark:text-gray-300">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
                            </svg>
                            <span>All Products</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                            </svg>
                            <span>{p.product_ids?.length || 0} Product(s)</span>
                          </span>
                        )}
                      </td>

                      {/* Customer Target */}
                      <td className="py-3.5 px-4">
                        {p.target_type === "all" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#242424] text-gray-700 dark:text-gray-300">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                            <span>All Customers</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
                            </svg>
                            <span>{p.customer_ids?.length || 0} Customer(s)</span>
                          </span>
                        )}
                      </td>

                      {/* Uses & Limits */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-gray-900 dark:text-white text-xs">
                          {p.used_count} used
                          {p.max_uses ? <span className="text-gray-400 font-normal"> / {p.max_uses} max</span> : ""}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {p.max_uses_per_customer ? `${p.max_uses_per_customer} use/person` : "Unlimited/person"}
                        </div>
                      </td>

                      {/* Schedule & Duration */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-gray-700 dark:text-gray-300 font-mono flex items-center gap-1">
                          <span>{new Date(p.starts_at).toLocaleDateString()}</span>
                          <span className="text-gray-400">to</span>
                          <span>{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "Never"}</span>
                        </div>
                        {daysRemaining !== null && (
                          <div
                            className={`text-[10px] font-semibold ${
                              isExpired ? "text-rose-500" : daysRemaining <= 3 ? "text-amber-500" : "text-emerald-500"
                            }`}
                          >
                            {isExpired ? "Expired" : `${daysRemaining} day(s) left`}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            !p.is_active
                              ? "bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400"
                              : isExpired
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {!p.is_active ? "Disabled" : isExpired ? "Expired" : "Live"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPromoId(p.id);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#2C2C2C] hover:bg-gray-100 dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Details</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ────── PAGINATION FOOTER BAR ────── */}
        {!loading && totalEntries > 0 && (
          <div className="relative px-4 py-3.5 border-t border-gray-200/80 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] rounded-b-[16px] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-sans">
            {/* Left: Showing entries info */}
            <div className="font-normal text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Showing {displayedCount} of {totalEntries} entries
            </div>

            {/* Center: Pagination Controls */}
            <div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-1.5">
              {/* Previous Page Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={validCurrentPage === 1}
                className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282828] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((pNum, idx) => {
                if (pNum === "...") {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-gray-400">
                      ...
                    </span>
                  );
                }
                const isSelected = pNum === validCurrentPage;
                return (
                  <button
                    key={`page-${pNum}`}
                    type="button"
                    onClick={() => setCurrentPage(pNum as number)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#010101] dark:bg-white text-white dark:text-[#010101] shadow-2xs"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828]"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              {/* Next Page Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage === totalPages}
                className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282828] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Slide-over Drawer for Creating Promos */}
      <PromoCreateDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          fetchPromos();
        }}
      />

      {/* Right Slide-over Drawer for Promo Details & Usage */}
      <PromoDetailDrawer
        isOpen={Boolean(selectedPromoId)}
        promoId={selectedPromoId}
        onClose={() => setSelectedPromoId(null)}
        onUpdated={() => {
          fetchPromos();
        }}
      />
    </div>
  );
}
