"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { API_BASE } from "../../lib/api-base";
import { authFetch } from "../../lib/session";
import { formatWAT } from "@gts/utils";
import { describeStatus } from "./order-status-options";
import { exportOrdersToExcel } from "./order-excel-service";
import OrderInfoDrawer from "./order-info-drawer";

export interface OrderItem {
  id: string;
  order_number: string;
  channel?: string;
  status: string;
  payment_status: "unpaid" | "paid";
  payment_method?: string | null;
  total: number;
  created_at: string;
  pickup_deadline?: string | null;
  pickup_station?: {
    id?: string;
    name: string;
    address_line1: string;
    city: string;
    state: string;
    phone?: string | null;
    operating_hours?: string | null;
  } | null;
  customer?: { full_name?: string; email?: string; phone?: string } | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [stationFilter, setStationFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Selection & Pagination
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Action Menu Portal
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Order Details Drawer
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeDrawerAction, setActiveDrawerAction] = useState<"forward" | "backward" | "hold" | "cancel" | "reopen" | "pay" | "complete_pickup" | null>(null);

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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, paymentFilter, stationFilter, sortBy]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/orders?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, orderId: string) => {
    e.stopPropagation();
    if (openActionMenuId === orderId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 160;
      const opensUpward = rect.bottom + menuHeight > window.innerHeight;

      setMenuPosition({
        top: opensUpward ? Math.max(10, rect.top - menuHeight) : rect.bottom + 4,
        left: Math.max(10, rect.right - 176),
      });
      setOpenActionMenuId(orderId);
    }
  };

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");
  const describeUpdated = (iso: string | undefined) => (iso ? formatWAT(iso) : "—");

  // Dynamic available stations for filter
  const availableStations = useMemo(() => {
    return Array.from(new Set(orders.map((o) => o.pickup_station?.name).filter(Boolean))) as string[];
  }, [orders]);

  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (paymentFilter !== "ALL" ? 1 : 0) +
    (stationFilter !== "ALL" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setStationFilter("ALL");
    setSortBy("newest");
    setSearchQuery("");
  };

  // KPI Calculations
  const totalVolumeKobo = useMemo(() => orders.reduce((acc, o) => acc + (o.total || 0), 0), [orders]);
  const completedCount = useMemo(() => orders.filter((o) => o.status === "collected").length, [orders]);
  const readyCount = useMemo(() => orders.filter((o) => o.status === "ready_for_pickup").length, [orders]);
  const readyUnpaidCount = useMemo(
    () => orders.filter((o) => o.status === "ready_for_pickup" && o.payment_status === "unpaid").length,
    [orders]
  );
  const pendingCount = useMemo(
    () => orders.filter((o) => ["placed", "pending", "pending_payment", "confirmed", "on_hold"].includes(o.status)).length,
    [orders]
  );

  // Filtering & Sorting Logic
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          o.order_number.toLowerCase().includes(q) ||
          (o.customer?.full_name && o.customer.full_name.toLowerCase().includes(q)) ||
          (o.customer?.email && o.customer.email.toLowerCase().includes(q)) ||
          (o.customer?.phone && o.customer.phone.toLowerCase().includes(q)) ||
          (o.pickup_station?.name && o.pickup_station.name.toLowerCase().includes(q));

        let matchesStatus = true;
        if (statusFilter === "ALL") {
          matchesStatus = true;
        } else if (statusFilter === "pending") {
          matchesStatus = ["placed", "pending", "pending_payment", "confirmed", "on_hold"].includes(o.status);
        } else if (statusFilter === "placed") {
          matchesStatus = ["placed", "pending", "pending_payment"].includes(o.status);
        } else {
          matchesStatus = o.status === statusFilter;
        }

        const matchesPayment = paymentFilter === "ALL" || o.payment_status === paymentFilter;

        const matchesStation =
          stationFilter === "ALL" || (o.pickup_station?.name && o.pickup_station.name === stationFilter);

        return matchesSearch && matchesStatus && matchesPayment && matchesStation;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "total_desc") {
          return (b.total || 0) - (a.total || 0);
        }
        if (sortBy === "total_asc") {
          return (a.total || 0) - (b.total || 0);
        }
        // default "newest"
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [orders, searchQuery, statusFilter, paymentFilter, stationFilter, sortBy]);

  // Pagination Calculations
  const totalEntries = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, totalEntries);
  const displayedCount = totalEntries === 0 ? 0 : endIndex - startIndex + 1;
  const paginatedOrders = filteredOrders.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

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

  const handleSelectAll = () => {
    const pageOrderIds = paginatedOrders.map((o) => o.id);
    const allPageSelected = pageOrderIds.length > 0 && pageOrderIds.every((id) => selectedOrders.includes(id));
    if (allPageSelected) {
      setSelectedOrders((prev) => prev.filter((id) => !pageOrderIds.includes(id)));
    } else {
      setSelectedOrders((prev) => Array.from(new Set([...prev, ...pageOrderIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
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
            { label: "Fulfilment", href: "/admin/orders" },
            { label: "Orders" },
          ]}
        />

        {/* Title & Action Buttons Row (ONLY EXPORT BUTTON) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Orders List
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Manage customer orders, track in-store pickup fulfillments, and payments
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Export Button (Excel .xlsx) */}
            <button
              type="button"
              onClick={() =>
                exportOrdersToExcel(
                  filteredOrders,
                  `gts-orders-${new Date().toISOString().slice(0, 10)}.xlsx`
                )
              }
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title={`Export ${filteredOrders.length} Orders to Excel (.xlsx)`}
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────── KPI CARDS (MATCHING PRODUCT CATALOG STYLE) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter("ALL");
            setPaymentFilter("ALL");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Orders
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {orders.length}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Gross: {formatNaira(totalVolumeKobo)}
            </div>
          )}
        </div>

        {/* Card 2: Completed Orders */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter((prev) => (prev === "collected" ? "ALL" : "collected"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "collected"
              ? "border-emerald-500/80 ring-2 ring-emerald-500/40 dark:border-emerald-400 dark:ring-emerald-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-emerald-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Completed Orders
              </span>
              {statusFilter === "collected" && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {completedCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              All items handed over & collected
            </div>
          )}
        </div>

        {/* Card 3: Ready for Pickup */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter((prev) => (prev === "ready_for_pickup" ? "ALL" : "ready_for_pickup"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "ready_for_pickup"
              ? "border-amber-500/80 ring-2 ring-amber-500/40 dark:border-amber-400 dark:ring-amber-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-amber-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Ready for Pickup
              </span>
              {statusFilter === "ready_for_pickup" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-14 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {readyCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              {readyUnpaidCount > 0 ? `${readyUnpaidCount} unpaid at counter` : "Awaiting customer collection"}
            </div>
          )}
        </div>

        {/* Card 4: Pending Action */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter((prev) => (prev === "pending" ? "ALL" : "pending"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "pending"
              ? "border-rose-500/80 ring-2 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-rose-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Pending Action
              </span>
              {statusFilter === "pending" && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {pendingCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-rose-500 dark:text-rose-400">
              {pendingCount > 0 ? "Requires staff processing" : "0 backlog orders"}
            </div>
          )}
        </div>
      </div>

      {/* ────── UNIFIED ORDERS TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + Status Dropdown + Payment Dropdown */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Filter Button with Active Count and Popover */}
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
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-h-[min(520px,80vh)] overflow-y-auto bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs [scrollbar-width:thin]">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        Filter Orders
                      </span>
                      {activeFiltersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#EDCF5D]/20 text-[#9E7B00] dark:text-[#EDCF5D] text-[10.5px] font-bold">
                          {activeFiltersCount} active
                        </span>
                      )}
                    </div>
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

                  {/* Status Options */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Fulfillment Status
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "ALL", label: "All Status" },
                        { key: "placed", label: "Placed" },
                        { key: "confirmed", label: "Confirmed" },
                        { key: "ready_for_pickup", label: "Ready for Pickup" },
                        { key: "collected", label: "Collected" },
                        { key: "on_hold", label: "On Hold" },
                        { key: "cancelled", label: "Cancelled" },
                        { key: "expired", label: "Expired" },
                      ].map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => setStatusFilter(st.key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            statusFilter === st.key
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Status Options */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Payment Status
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "ALL", label: "All Payments" },
                        { key: "paid", label: "Paid" },
                        { key: "unpaid", label: "Unpaid" },
                      ].map((pm) => (
                        <button
                          key={pm.key}
                          type="button"
                          onClick={() => setPaymentFilter(pm.key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            paymentFilter === pm.key
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pickup Stations */}
                  {availableStations.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Pickup Location
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto [scrollbar-width:thin]">
                        <button
                          type="button"
                          onClick={() => setStationFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            stationFilter === "ALL"
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          All Stations
                        </button>
                        {availableStations.map((stName) => (
                          <button
                            key={stName}
                            type="button"
                            onClick={() => setStationFilter(stationFilter === stName ? "ALL" : stName)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              stationFilter === stName
                                ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                                : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                            }`}
                          >
                            {stName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sort By */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="total_desc">Total Amount: High to Low</option>
                      <option value="total_asc">Total Amount: Low to High</option>
                    </select>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {filteredOrders.length} results matching
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Status</option>
                <option value="placed">Placed</option>
                <option value="confirmed">Confirmed</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="collected">Collected</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Payment Select Filter */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Payment</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Bulk Selection Actions (Appears when checkboxes are selected) */}
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200 dark:border-[#333333] transition-all">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mr-0.5">
                  {selectedOrders.length} Selected
                </span>

                {/* Export Selected Icon Button */}
                <div className="relative group">
                  <button
                    onClick={() => {
                      const selected = orders.filter((o) => selectedOrders.includes(o.id));
                      exportOrdersToExcel(
                        selected,
                        `gts-orders-selected-${new Date().toISOString().slice(0, 10)}.xlsx`
                      );
                    }}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden group-hover:flex items-center justify-center px-2.5 py-1 bg-[#1A1A1A] dark:bg-[#2E2E2E] text-white text-[10.5px] font-semibold rounded-md shadow-lg border border-gray-700 dark:border-gray-600 whitespace-nowrap z-50 pointer-events-none">
                    Export Selected
                  </div>
                </div>

                {/* Clear Selection Button */}
                <button
                  onClick={() => setSelectedOrders([])}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center text-xs font-bold"
                  title="Clear Selection"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Right Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders or customer..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[#222222] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
                  <th className="pl-4 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrders.includes(o.id))}
                      onChange={handleSelectAll}
                      className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Order #</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Pickup Location</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Payment</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Total</th>
                  <th className="pr-4 pl-2 py-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 dark:text-[#666666] font-mono">
                      No orders match your search/filter criteria
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => {
                    const isSelected = selectedOrders.includes(o.id);
                    const updatedTimeStr = describeUpdated(o.created_at);

                    return (
                      <tr
                        key={o.id}
                        onClick={(e) => {
                          const target = e.target as HTMLElement | null;
                          if (target?.closest("button, a, input, select, textarea, [role='button'], [data-no-row-toggle]")) {
                            return;
                          }
                          handleToggleSelect(o.id);
                        }}
                        className={`hover:bg-gray-50/80 dark:hover:bg-[#222222]/60 transition-colors cursor-pointer select-none ${
                          isSelected ? "bg-amber-500/5 dark:bg-[#EDCF5D]/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(o.id)}
                            className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                          />
                        </td>

                        {/* Order # & Date */}
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveOrderId(o.id);
                              setActiveDrawerAction(null);
                            }}
                            className="font-mono font-bold text-gray-900 dark:text-white text-xs tracking-tight hover:underline cursor-pointer text-left block"
                          >
                            {o.order_number}
                          </button>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {updatedTimeStr}
                          </p>
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[160px]">
                            {o.customer?.full_name || "Guest Customer"}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono truncate max-w-[160px] mt-0.5">
                            {o.customer?.phone || o.customer?.email || "—"}
                          </p>
                        </td>

                        {/* Pickup Location */}
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[170px]">
                            {o.pickup_station?.name || "Main Store"}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[170px] mt-0.5">
                            {o.pickup_station?.city || "Ikeja"}{o.pickup_station?.state ? `, ${o.pickup_station.state}` : ""}
                          </p>
                        </td>

                        {/* Status Pill Badge */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              o.status === "collected"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : o.status === "ready_for_pickup"
                                ? "bg-[#EDCF5D]/25 text-[#9E7B00] dark:text-[#EDCF5D] font-bold"
                                : o.status === "confirmed"
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                : o.status === "placed" || o.status === "pending" || o.status === "pending_payment"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : o.status === "on_hold"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {describeStatus(o.status)}
                          </span>
                        </td>

                        {/* Payment Pill Badge */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              o.payment_status === "paid"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {o.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </td>

                        {/* Total Price */}
                        <td className="px-3 py-3 font-semibold font-mono text-gray-900 dark:text-white">
                          {formatNaira(o.total)}
                        </td>

                        {/* 3-Dots Vertical Action Button */}
                        <td className="pr-4 pl-2 py-3 text-right">
                          <button
                            onClick={(e) => handleToggleMenu(e, o.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer"
                            title="Actions"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ────── PAGINATION FOOTER BAR (MATCHING PRODUCT CATALOG) ────── */}
        {!loading && totalEntries > 0 && (
          <div className="relative px-4 py-3.5 border-t border-gray-200/80 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-sans">
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

            {/* Right spacer for balance */}
            <div className="hidden sm:block" />
          </div>
        )}
      </div>

      {/* ────── FLOATING FIXED ACTION DROPDOWN MENU (UNCLIPPED VIEWPORT PORTAL) ────── */}
      {openActionMenuId && menuPosition && (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans">
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => setOpenActionMenuId(null)}
          />
          {filteredOrders.map((o) => {
            if (o.id !== openActionMenuId) return null;
            const canCancel = o.status !== "collected" && o.status !== "cancelled";

            return (
              <div
                key={o.id}
                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                className="fixed w-36 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn overflow-hidden pointer-events-auto"
              >
                {/* 1. Info Option */}
                <button
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActiveOrderId(o.id);
                    setActiveDrawerAction(null);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>Info</span>
                </button>

                {/* 2. Cancel Order Option (in red) */}
                {canCancel && (
                  <>
                    <div className="my-1 border-t border-gray-100 dark:border-[#333333]" />
                    <button
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActiveOrderId(o.id);
                        setActiveDrawerAction("cancel");
                      }}
                      className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>Cancel Order</span>
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ────── ORDER DETAIL & MANAGEMENT SIDE PANEL DRAWER ────── */}
      <OrderInfoDrawer
        isOpen={Boolean(activeOrderId)}
        orderId={activeOrderId}
        initialAction={activeDrawerAction}
        onClose={() => {
          setActiveOrderId(null);
          setActiveDrawerAction(null);
        }}
        onStatusUpdated={fetchOrders}
      />
    </div>
  );
}
