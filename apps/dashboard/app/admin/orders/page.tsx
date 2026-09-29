"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { API_BASE } from "../../lib/api-base";
import { authFetch } from "../../lib/session";
import { formatWAT } from "@gts/utils";
import { describeStatus, FORWARD_NEXT, BACKWARD_STEP, requiresReason } from "./order-status-options";
import { exportOrdersToExcel } from "./order-excel-service";

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

export interface DetailedOrder extends OrderItem {
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  cancel_reason?: string | null;
  hold_reason?: string | null;
  ready_for_pickup_at?: string | null;
  internal_notes?: string | null;
  paid_at?: string | null;
  items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot?: {
      name?: string;
      size?: string | null;
      color?: string | null;
      sku?: string | null;
      image?: string | null;
    } | null;
  }>;
  audit_log?: Array<{
    id: string;
    action: string;
    changes?: any;
    created_at: string;
    actor?: { full_name?: string; email?: string } | null;
  }>;
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

  // Detailed Modal
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<DetailedOrder | null>(null);
  const [loadingActive, setLoadingActive] = useState(false);

  // Sub-modal for actions (reasons, handover payment)
  const [actionType, setActionType] = useState<"forward" | "backward" | "hold" | "cancel" | "reopen" | "pay" | "complete_pickup" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [selectedPayMethod, setSelectedPayMethod] = useState<"cash" | "pos" | "transfer">("cash");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const loadOrderDetail = async (id: string) => {
    setActiveOrderId(id);
    setLoadingActive(true);
    setActionError(null);
    try {
      const res = await authFetch(`${API_BASE}/orders/${id}`);
      if (res.ok) {
        const json = await res.json();
        setActiveOrder(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingActive(false);
    }
  };

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

  const handleExecuteAction = async () => {
    if (!activeOrder || !actionType) return;
    setActionLoading(true);
    setActionError(null);

    const token = localStorage.getItem("gts_token");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    try {
      if (actionType === "forward") {
        const next = FORWARD_NEXT[activeOrder.status];
        if (!next) return;
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: next, reason: actionReason.trim() || undefined }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice(`Order advanced to ${describeStatus(next)}.`);
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to update order status.");
        }
      } else if (actionType === "backward") {
        const prev = BACKWARD_STEP[activeOrder.status];
        if (!prev) return;
        if (!actionReason.trim()) {
          setActionError("A reason is required to move an order backward.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: prev, reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice(`Order moved back to ${describeStatus(prev)}.`);
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to move order backward.");
        }
      } else if (actionType === "hold") {
        if (!actionReason.trim()) {
          setActionError("A reason is required to place an order on hold.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "on_hold", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice("Order placed on hold.");
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to put order on hold.");
        }
      } else if (actionType === "cancel") {
        if (!actionReason.trim()) {
          setActionError("A cancellation reason is required.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "cancelled", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice("Order cancelled and inventory holds released.");
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to cancel order.");
        }
      } else if (actionType === "reopen") {
        if (!actionReason.trim()) {
          setActionError("A reason is required to reopen an expired order.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "ready_for_pickup", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice("Order reopened to ready for pickup.");
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to reopen order.");
        }
      } else if (actionType === "pay") {
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/pay`, {
          method: "POST",
          headers,
          body: JSON.stringify({ payment_method: selectedPayMethod, note: actionReason.trim() || undefined }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice(`Payment marked as paid (${selectedPayMethod.toUpperCase()}).`);
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to mark order as paid.");
        }
      } else if (actionType === "complete_pickup") {
        const isUnpaid = activeOrder.payment_status !== "paid";
        const res = await fetch(`${API_BASE}/orders/${activeOrder.id}/complete-pickup`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            mark_paid: isUnpaid,
            payment_method: isUnpaid ? selectedPayMethod : undefined,
            note: actionReason.trim() || undefined,
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setNotice("Pickup handover completed successfully! Order collected.");
          setActionType(null);
          await loadOrderDetail(activeOrder.id);
          await fetchOrders();
        } else {
          setActionError(json?.error || "Failed to complete pickup handover.");
        }
      }
    } catch {
      setActionError("Network error while updating order.");
    } finally {
      setActionLoading(false);
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
    () => orders.filter((o) => ["placed", "confirmed", "on_hold"].includes(o.status)).length,
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
          matchesStatus = ["placed", "confirmed", "on_hold"].includes(o.status);
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

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in shadow-2xs">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-600 dark:text-emerald-400 font-bold ml-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

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
                              loadOrderDetail(o.id);
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
                                : o.status === "placed"
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
                className="fixed w-44 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn overflow-hidden pointer-events-auto"
              >
                {/* 1. View Details (Info) */}
                <button
                  onClick={() => {
                    setOpenActionMenuId(null);
                    loadOrderDetail(o.id);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>View Details</span>
                </button>

                {/* 2. Contextual Next Step */}
                {o.status === "placed" && (
                  <button
                    onClick={() => {
                      setOpenActionMenuId(null);
                      loadOrderDetail(o.id).then(() => {
                        setActionType("forward");
                        setActionReason("");
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Confirm Order</span>
                  </button>
                )}

                {o.status === "confirmed" && (
                  <button
                    onClick={() => {
                      setOpenActionMenuId(null);
                      loadOrderDetail(o.id).then(() => {
                        setActionType("forward");
                        setActionReason("");
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.25A2.25 2.25 0 010 18.75V10.5m18 10.5h3.75A2.25 2.25 0 0024 18.75V10.5M9.75 21V9.75" />
                    </svg>
                    <span>Ready for Pickup</span>
                  </button>
                )}

                {o.status === "ready_for_pickup" && (
                  <button
                    onClick={() => {
                      setOpenActionMenuId(null);
                      loadOrderDetail(o.id).then(() => {
                        setActionType("complete_pickup");
                        setActionReason("");
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Complete Handover</span>
                  </button>
                )}

                {o.status === "expired" && (
                  <button
                    onClick={() => {
                      setOpenActionMenuId(null);
                      loadOrderDetail(o.id).then(() => {
                        setActionType("reopen");
                        setActionReason("");
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Reopen Order</span>
                  </button>
                )}

                {/* 3. Divider Line */}
                {canCancel && <div className="my-1 border-t border-gray-100 dark:border-[#2A2A2A]" />}

                {/* 4. Cancel Order (in RED) */}
                {canCancel && (
                  <button
                    onClick={() => {
                      setOpenActionMenuId(null);
                      loadOrderDetail(o.id).then(() => {
                        setActionType("cancel");
                        setActionReason("");
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span>Cancel Order</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ────── ORDER DETAIL & MANAGEMENT MODAL ────── */}
      {activeOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
            {loadingActive || !activeOrder ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-mono text-xs">
                <div className="w-5 h-5 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                <span>Loading order details...</span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-gray-100 dark:border-[#262626] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-gray-900 dark:text-white">
                        {activeOrder.order_number}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      Placed on {new Date(activeOrder.created_at).toLocaleString("en-NG")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrderId(null);
                      setActiveOrder(null);
                    }}
                    className="p-1 text-gray-400 hover:text-black dark:hover:text-white text-base cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Badges Row */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#262626] flex-wrap justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-500">Status:</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-extrabold uppercase ${
                        activeOrder.status === "collected"
                          ? "bg-emerald-100 text-emerald-800"
                          : activeOrder.status === "ready_for_pickup"
                          ? "bg-[#EDCF5D] text-black"
                          : activeOrder.status === "confirmed"
                          ? "bg-sky-100 text-sky-800"
                          : activeOrder.status === "cancelled" || activeOrder.status === "expired"
                          ? "bg-rose-100 text-rose-800"
                          : activeOrder.status === "on_hold"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {describeStatus(activeOrder.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-500">Payment:</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                        activeOrder.payment_status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : "bg-amber-50 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {activeOrder.payment_status === "paid" ? "Paid" : "Payment Due at Pickup"}
                    </span>
                  </div>
                </div>

                {/* Pickup Location & Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-[#262626] space-y-1">
                    <span className="font-mono text-[10px] font-bold uppercase text-gray-400">
                      Pickup Station
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {activeOrder.pickup_station?.name || "Main Store"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {activeOrder.pickup_station?.address_line1 || "12 Allen Avenue"}
                    </p>
                    <p className="text-gray-500">
                      {activeOrder.pickup_station?.city || "Ikeja"}{activeOrder.pickup_station?.state ? `, ${activeOrder.pickup_station.state}` : ""}
                    </p>
                    {activeOrder.pickup_station?.phone && (
                      <p className="text-gray-400 font-mono pt-1">Tel: {activeOrder.pickup_station.phone}</p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-[#262626] space-y-1">
                    <span className="font-mono text-[10px] font-bold uppercase text-gray-400">
                      Customer Details
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {activeOrder.customer?.full_name || "Guest Customer"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {activeOrder.customer?.email || "No email"}
                    </p>
                    <p className="font-mono text-gray-500">
                      {activeOrder.customer?.phone || "No phone"}
                    </p>
                  </div>
                </div>

                {/* Items in Order */}
                <div className="space-y-2">
                  <h4 className="font-mono font-bold text-xs uppercase text-gray-500">
                    Items ({activeOrder.items?.length || 0})
                  </h4>
                  <div className="divide-y divide-gray-100 dark:divide-[#262626] border border-gray-200 dark:border-[#262626] rounded-xl p-3 max-h-48 overflow-y-auto">
                    {(activeOrder.items || []).map((it) => (
                      <div key={it.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {it.product_snapshot?.name || "Garment"}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            Qty: {it.quantity} {it.product_snapshot?.size ? `· ${it.product_snapshot.size}` : ""} {it.product_snapshot?.color ? `· ${it.product_snapshot.color}` : ""}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {formatNaira(it.line_total)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between font-bold text-xs">
                      <span>Total Amount:</span>
                      <span className="font-mono text-sm">{formatNaira(activeOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-[#262626]">
                  <span className="block font-mono text-[10px] font-bold uppercase text-gray-400">
                    Fulfillment Handover & Actions
                  </span>

                  {activeOrder.status === "placed" && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionType("forward");
                        setActionReason("");
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#010101] text-white hover:bg-black/85 font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>Mark as Confirmed →</span>
                    </button>
                  )}

                  {activeOrder.status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionType("forward");
                        setActionReason("");
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#EDCF5D] text-black hover:bg-amber-400 font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>Mark Ready for Pickup (Notify Customer) →</span>
                    </button>
                  )}

                  {activeOrder.status === "ready_for_pickup" && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("complete_pickup");
                          setActionReason("");
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>
                          {activeOrder.payment_status === "paid"
                            ? "Complete Pickup (Hand over items)"
                            : "Atomic Pay & Complete Pickup Handover"}
                        </span>
                      </button>

                      {activeOrder.payment_status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionType("pay");
                            setActionReason("");
                          }}
                          className="w-full py-2 px-3 rounded-xl border border-gray-300 dark:border-[#2C2C2C] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#242424] font-bold text-xs cursor-pointer"
                        >
                          Mark Paid Separately (Cash / POS / Transfer)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Secondary Actions (Move back, On Hold, Cancel, Reopen) */}
                  <div className="flex items-center gap-2 pt-2 flex-wrap">
                    {BACKWARD_STEP[activeOrder.status] && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("backward");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2C2C2C] text-gray-600 dark:text-gray-400 hover:bg-gray-100 text-xs font-semibold cursor-pointer"
                      >
                        ← Move back a step
                      </button>
                    )}

                    {["placed", "confirmed", "ready_for_pickup"].includes(activeOrder.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("hold");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2C2C2C] text-purple-700 dark:text-purple-400 hover:bg-purple-50 text-xs font-semibold cursor-pointer"
                      >
                        Put on hold
                      </button>
                    )}

                    {activeOrder.status !== "collected" && activeOrder.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("cancel");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Cancel order
                      </button>
                    )}

                    {activeOrder.status === "expired" && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("reopen");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold cursor-pointer"
                      >
                        Reopen order
                      </button>
                    )}
                  </div>
                </div>

                {/* Audit Trail Section */}
                <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-[#262626]">
                  <h4 className="font-mono font-bold text-xs uppercase text-gray-500">
                    Audit Trail & History
                  </h4>
                  {(!activeOrder.audit_log || activeOrder.audit_log.length === 0) ? (
                    <p className="text-xs text-gray-400 italic">No activity logged yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeOrder.audit_log.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#242424] text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span>{log.actor?.full_name || log.actor?.email || "System"}</span>
                            <span>{new Date(log.created_at).toLocaleString("en-NG")}</span>
                          </div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          {log.changes?.reason && (
                            <p className="text-gray-500 italic">Reason: {log.changes.reason}</p>
                          )}
                          {log.changes?.payment_method && (
                            <p className="text-gray-500">Method: {log.changes.payment_method}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ────── ACTION PROMPT / REASON SUB-MODAL ────── */}
      {actionType && activeOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-[#262626] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white capitalize">
              {actionType === "complete_pickup"
                ? "Complete Order Pickup"
                : actionType === "pay"
                ? "Mark Order as Paid"
                : actionType === "cancel"
                ? "Cancel Order"
                : actionType === "hold"
                ? "Place Order on Hold"
                : actionType === "backward"
                ? "Move Order Backward"
                : actionType === "reopen"
                ? "Reopen Expired Order"
                : "Advance Order"}
            </h3>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            {(actionType === "complete_pickup" && activeOrder.payment_status !== "paid") || actionType === "pay" ? (
              <div className="space-y-2 text-xs">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "pos", "transfer"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedPayMethod(m)}
                      className={`p-2 rounded-xl border text-center font-bold font-mono uppercase cursor-pointer ${
                        selectedPayMethod === m
                          ? "border-black dark:border-white bg-[#010101] text-white dark:bg-white dark:text-black"
                          : "border-gray-200 dark:border-[#2C2C2C] text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 pt-1 font-mono">
                  Amount: {formatNaira(activeOrder.total)}
                </p>
              </div>
            ) : null}

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-gray-700 dark:text-gray-300">
                {requiresReason(activeOrder.status, actionType === "forward" ? FORWARD_NEXT[activeOrder.status] || "" : actionType)
                  ? "Reason (Required) *"
                  : "Internal Note / Reason (Optional)"}
              </label>
              <textarea
                rows={3}
                placeholder="Enter details for the audit log..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 ${
                  actionType === "cancel"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black hover:opacity-90"
                }`}
              >
                {actionLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                )}
                <span>{actionType === "cancel" ? "Confirm Cancellation" : "Confirm"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
