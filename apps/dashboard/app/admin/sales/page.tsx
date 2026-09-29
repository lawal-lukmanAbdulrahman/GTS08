"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { formatWAT, parseWhatsAppContact } from "@gts/utils";
import { AdminTopStrip } from "../sidebar-context";
import { API_BASE } from "../../lib/api-base";
import { authFetch } from "../../lib/session";
import { exportSalesToExcel, type SaleRecordItem } from "./sale-excel-service";
import SaleInfoDrawer from "./sale-info-drawer";

export default function AdminSalesPage() {
  const [sales, setSales] = useState<SaleRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Selection & Pagination
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Active Sale Drawer
  const [activeSale, setActiveSale] = useState<SaleRecordItem | null>(null);

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

  // Fetch sales records from API
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/orders?limit=100`);
      if (res.ok) {
        const json = await res.json();
        const orders: SaleRecordItem[] = json.data || [];
        setSales(orders);
      }
    } catch {
      // offline or network fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, channelFilter, paymentFilter, dateFilter, sortBy]);

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

  // KPI Calculations across all sales
  const kpiStats = useMemo(() => {
    let totalRevenue = 0;
    let walkInRevenue = 0;
    let walkInCount = 0;
    let whatsappRevenue = 0;
    let whatsappCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;

    for (const s of sales) {
      const isPaid = s.payment_status?.toLowerCase() === "paid" || s.status === "completed" || s.status === "collected";
      if (!isPaid) continue;

      totalRevenue += s.total || 0;
      if (s.channel === "walk_in") {
        walkInRevenue += s.total || 0;
        walkInCount += 1;
      } else if (s.channel === "whatsapp") {
        whatsappRevenue += s.total || 0;
        whatsappCount += 1;
      } else {
        onlineRevenue += s.total || 0;
        onlineCount += 1;
      }
    }

    return {
      totalRevenue,
      totalCount: walkInCount + whatsappCount + onlineCount,
      walkInRevenue,
      walkInCount,
      whatsappRevenue,
      whatsappCount,
      onlineRevenue,
      onlineCount,
    };
  }, [sales]);

  // Active filter count
  const activeFiltersCount =
    (channelFilter !== "ALL" ? 1 : 0) +
    (paymentFilter !== "ALL" ? 1 : 0) +
    (dateFilter !== "ALL" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  const handleResetFilters = () => {
    setChannelFilter("ALL");
    setPaymentFilter("ALL");
    setDateFilter("ALL");
    setSortBy("newest");
    setSearchQuery("");
  };

  // Filter & Search Logic
  const filteredSales = useMemo(() => {
    return sales
      .filter((sale) => {
        // Search matches: order_number, customer name, customer phone, notes, items
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchOrder = sale.order_number?.toLowerCase().includes(q);
          const matchCustName = sale.customer?.full_name?.toLowerCase().includes(q);
          const matchCustPhone = sale.customer?.phone?.toLowerCase().includes(q);
          const matchNotes = sale.internal_notes?.toLowerCase().includes(q);
          const matchItems = sale.items?.some((i) =>
            i.product_snapshot?.name?.toLowerCase().includes(q)
          );
          if (!matchOrder && !matchCustName && !matchCustPhone && !matchNotes && !matchItems) {
            return false;
          }
        }

        // Channel filter
        if (channelFilter !== "ALL") {
          if (channelFilter === "online") {
            if (sale.channel === "walk_in" || sale.channel === "whatsapp") return false;
          } else if (sale.channel !== channelFilter) {
            return false;
          }
        }

        // Payment Method filter
        if (paymentFilter !== "ALL") {
          if (sale.payment_method?.toLowerCase() !== paymentFilter.toLowerCase()) {
            return false;
          }
        }

        // Date Filter
        if (dateFilter !== "ALL") {
          const saleTime = new Date(sale.created_at).getTime();
          const now = Date.now();
          if (dateFilter === "today") {
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            if (saleTime < oneDayAgo) return false;
          } else if (dateFilter === "week") {
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            if (saleTime < sevenDaysAgo) return false;
          } else if (dateFilter === "month") {
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
            if (saleTime < thirtyDaysAgo) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "highest") {
          return (b.total || 0) - (a.total || 0);
        }
        if (sortBy === "lowest") {
          return (a.total || 0) - (b.total || 0);
        }
        // default newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [sales, searchQuery, channelFilter, paymentFilter, dateFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

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

  const paginatedSales = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, validCurrentPage, pageSize]);

  // Selection
  const isAllSelected =
    paginatedSales.length > 0 && paginatedSales.every((s) => selectedSales.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSales((prev) => prev.filter((id) => !paginatedSales.some((s) => s.id === id)));
    } else {
      setSelectedSales((prev) => Array.from(new Set([...prev, ...paginatedSales.map((s) => s.id)])));
    }
  };

  const handleToggleSelectSale = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSales((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExportSelectedOrAll = () => {
    const exportData =
      selectedSales.length > 0
        ? sales.filter((s) => selectedSales.includes(s.id))
        : filteredSales;
    exportSalesToExcel(
      exportData,
      `gts-sales-log-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
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
            { label: "Sales", href: "/admin/sales" },
            { label: "Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Sales Overview
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              A log book of all sales made across Walk-in, WhatsApp, and Storefront channels
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Export Button (Excel .xlsx) */}
            <button
              type="button"
              onClick={handleExportSelectedOrAll}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title={`Export ${selectedSales.length > 0 ? selectedSales.length : filteredSales.length} Sales to Excel`}
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              <span>{selectedSales.length > 0 ? `Export (${selectedSales.length})` : "Export Sales"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────── 4 KPI GRADIENT SUMMARY CARDS ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales Revenue */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setChannelFilter("ALL");
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            channelFilter === "ALL"
              ? "border-[#EDCF5D] ring-2 ring-[#EDCF5D]/40"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444]"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Sales Revenue
            </span>
            {loading ? (
              <div className="h-8 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {formatNaira(kpiStats.totalRevenue)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpiStats.totalCount} Total Sales Recorded
            </div>
          )}
        </div>

        {/* Card 2: Walk-in Sales */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setChannelFilter((prev) => (prev === "walk_in" ? "ALL" : "walk_in"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            channelFilter === "walk_in"
              ? "border-blue-500/80 ring-2 ring-blue-500/40 dark:border-blue-400 dark:ring-blue-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-blue-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Walk-in Store Sales
              </span>
              {channelFilter === "walk_in" && (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {formatNaira(kpiStats.walkInRevenue)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
              {kpiStats.walkInCount} Walk-in Orders
            </div>
          )}
        </div>

        {/* Card 3: WhatsApp Sales */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setChannelFilter((prev) => (prev === "whatsapp" ? "ALL" : "whatsapp"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            channelFilter === "whatsapp"
              ? "border-emerald-500/80 ring-2 ring-emerald-500/40 dark:border-emerald-400 dark:ring-emerald-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-emerald-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                WhatsApp Orders
              </span>
              {channelFilter === "whatsapp" && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {formatNaira(kpiStats.whatsappRevenue)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpiStats.whatsappCount} WhatsApp Orders
            </div>
          )}
        </div>

        {/* Card 4: Storefront Sales */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setChannelFilter((prev) => (prev === "online" ? "ALL" : "online"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            channelFilter === "online"
              ? "border-purple-500/80 ring-2 ring-purple-500/40 dark:border-purple-400 dark:ring-purple-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-purple-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Storefront (Online)
              </span>
              {channelFilter === "online" && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {formatNaira(kpiStats.onlineRevenue)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-purple-600 dark:text-purple-400">
              {kpiStats.onlineCount} Online Orders
            </div>
          )}
        </div>
      </div>

      {/* ────── UNIFIED SALES LOG TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Toolbar Header Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + Channel Tabs */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
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
                <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9m-9 6h9m-9 6h9M3.75 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0" />
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
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#2A2A2A]">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      Filter Sales Log
                    </span>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Channel Filter */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Channel
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "ALL", label: "All" },
                        { id: "walk_in", label: "Walk-in" },
                        { id: "whatsapp", label: "WhatsApp" },
                        { id: "online", label: "Storefront" },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChannelFilter(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            channelFilter === c.id
                              ? "bg-[#EDCF5D] border-[#EDCF5D] text-black"
                              : "border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method Filter */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Payment Method
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "ALL", label: "All" },
                        { id: "cash", label: "Cash" },
                        { id: "pos_terminal", label: "Card Terminal" },
                        { id: "paystack", label: "Online" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaymentFilter(p.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            paymentFilter === p.id
                              ? "bg-[#EDCF5D] border-[#EDCF5D] text-black"
                              : "border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Date Range
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "ALL", label: "All Time" },
                        { id: "today", label: "Last 24 Hours" },
                        { id: "week", label: "Last 7 Days" },
                        { id: "month", label: "Last 30 Days" },
                      ].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDateFilter(d.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            dateFilter === d.id
                              ? "bg-[#EDCF5D] border-[#EDCF5D] text-black"
                              : "border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-[#2A2A2A]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Sort By
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#333] bg-transparent text-gray-900 dark:text-white"
                    >
                      <option value="newest" className="dark:bg-[#1E1E1E]">Newest First</option>
                      <option value="oldest" className="dark:bg-[#1E1E1E]">Oldest First</option>
                      <option value="highest" className="dark:bg-[#1E1E1E]">Highest Amount</option>
                      <option value="lowest" className="dark:bg-[#1E1E1E]">Lowest Amount</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Channel Select Filter */}
            <div className="relative">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Channels</option>
                <option value="walk_in">Walk-in</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="online">Storefront</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Payment Method Select Filter */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Payment</option>
                <option value="cash">Cash</option>
                <option value="pos_terminal">Card Terminal</option>
                <option value="paystack">Online</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* Right Action: Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search...."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* ────── TABLE CONTENT ────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
              <tr>
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                    aria-label="Select all sales"
                  />
                </th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Sale / Receipt ID</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Channel</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Items</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Payment</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Total Amount</th>
                <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="w-4 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded" /></td>
                    <td className="px-4 py-3.5"><div className="w-32 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded" /></td>
                    <td className="px-3 py-3.5"><div className="w-16 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded-full" /></td>
                    <td className="px-4 py-3.5"><div className="w-28 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded" /></td>
                    <td className="px-4 py-3.5"><div className="w-24 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded" /></td>
                    <td className="px-3 py-3.5"><div className="w-20 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="w-16 h-4 bg-gray-200 dark:bg-[#2F2F2F] rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="w-20 h-7 bg-gray-200 dark:bg-[#2F2F2F] rounded mx-auto" /></td>
                  </tr>
                ))
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-400 dark:text-gray-500">
                    <div className="space-y-2">
                      <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No sales records found</p>
                      <p className="text-xs text-gray-400">Try adjusting your filters or search keywords</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => {
                  const contact = sale.channel === "whatsapp" ? parseWhatsAppContact(sale.internal_notes) : null;
                  const customerName = contact?.name || sale.customer?.full_name || (sale.channel === "walk_in" ? "Walk-in Guest" : "—");
                  const customerPhone = contact?.phone || sale.customer?.phone || null;
                  const itemsCount = sale.items?.reduce((n, i) => n + i.quantity, 0) || 0;
                  const firstItemName = sale.items?.[0]?.product_snapshot?.name;

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setActiveSale(sale)}
                      className="border-b border-gray-100 dark:border-[#262626] hover:bg-gray-50/60 dark:hover:bg-[#1E1E1E]/60 transition-colors cursor-pointer group"
                    >
                      <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSales.includes(sale.id)}
                          onChange={(e) => handleToggleSelectSale(sale.id, e as any)}
                          className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                          aria-label={`Select sale ${sale.order_number}`}
                        />
                      </td>

                      {/* ID & Date */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-900 dark:text-white group-hover:text-[#EDCF5D] transition-colors">
                          {sale.order_number}
                        </span>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                          {formatWAT(sale.created_at)}
                        </p>
                      </td>

                      {/* Channel Badge */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            sale.channel === "walk_in"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"
                              : sale.channel === "whatsapp"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40"
                          }`}
                        >
                          {sale.channel === "walk_in" ? (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.651V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009 9.35c.667 0 1.303-.217 1.828-.615A2.998 2.998 0 0014.25 9.35c.667 0 1.303-.217 1.828-.615a3.001 3.001 0 003.672.615m-16.5 0l1.242-4.14A2.25 2.25 0 016.71 3.75h10.58a2.25 2.25 0 012.16 1.46l1.242 4.14" />
                            </svg>
                          ) : sale.channel === "whatsapp" ? (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.874-1.006l.732-1.755A7.838 7.838 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                            </svg>
                          ) : (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
                            </svg>
                          )}
                          <span>
                            {sale.channel === "walk_in" ? "Walk-in" : sale.channel === "whatsapp" ? "WhatsApp" : "Storefront"}
                          </span>
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {customerName}
                        </p>
                        {customerPhone && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                            {customerPhone}
                          </p>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {itemsCount} item{itemsCount === 1 ? "" : "s"}
                        </span>
                        {firstItemName && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[160px]">
                            {firstItemName}
                          </p>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="px-3 py-3">
                        <div className="space-y-0.5">
                          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize block">
                            {sale.payment_method === "pos_terminal"
                              ? "Card Terminal"
                              : sale.payment_method === "cash"
                              ? "Cash"
                              : sale.payment_method || "Online"}
                          </span>
                          <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {sale.payment_status?.toUpperCase() === "PAID" || sale.status === "completed" || sale.status === "collected" ? "✓ Paid" : sale.payment_status}
                          </span>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                          {formatNaira(sale.total)}
                        </span>
                      </td>

                      {/* Action: Open Side Panel Button */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveSale(sale)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#333] hover:border-gray-400 dark:hover:border-[#555] bg-white dark:bg-[#202020] text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white font-semibold text-xs transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                          title="View sale details and download receipt"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>View Sale</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ────── PAGINATION FOOTER BAR ────── */}
        {!loading && filteredSales.length > 0 && (
          <div className="relative px-4 py-3.5 border-t border-gray-200/80 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-sans">
            {/* Left: Showing entries info */}
            <div className="font-normal text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Showing {filteredSales.length <= pageSize ? `${filteredSales.length} of ${filteredSales.length}` : `${(validCurrentPage - 1) * pageSize + 1} to ${Math.min(validCurrentPage * pageSize, filteredSales.length)} of ${filteredSales.length}`} entries
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

              {/* Page Number Buttons & Ellipsis */}
              {getPageNumbers().map((item, idx) => {
                if (item === "...") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] flex items-center justify-center text-gray-400 select-none font-mono text-xs leading-none"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = Number(item);
                const isActive = pageNum === validCurrentPage;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] text-xs sm:text-sm font-medium flex items-center justify-center text-center leading-none transition-all cursor-pointer select-none ${
                      isActive
                        ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black font-bold shadow-2xs"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828]"
                    }`}
                  >
                    <span className="leading-none inline-flex items-center justify-center">{pageNum}</span>
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

            {/* Right: Empty spacer to balance layout on desktop */}
            <div className="hidden sm:block" />
          </div>
        )}
      </div>

      {/* ────── SALE DETAILS DRAWER ────── */}
      <SaleInfoDrawer
        sale={activeSale}
        isOpen={!!activeSale}
        onClose={() => setActiveSale(null)}
      />
    </div>
  );
}
