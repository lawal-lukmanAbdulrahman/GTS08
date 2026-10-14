"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";
import { formatKobo } from "@gts/utils";
import CustomerInfoDrawer from "./customer-info-drawer";
import RecentlyDeletedDrawer from "./recently-deleted-drawer";
import CustomerActionModal from "./customer-action-modal";
import type { CustomerSummary, CustomerDetailData } from "./types";

function AdminCustomersContent() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [sortBy, setSortBy] = useState<"profit" | "spend" | "orders" | "newest">("profit");

  // Selection & Pagination
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Slide-over state for Customer Details
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Slide-over state for Recently Deleted Accounts
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false);
  const [deletedAccounts, setDeletedAccounts] = useState<CustomerSummary[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState("");

  // Action Menu Dropdown State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Reason Modals
  const [modalAction, setModalAction] = useState<"disable" | "delete" | "reinstate" | null>(null);
  const [targetCustomer, setTargetCustomer] = useState<{ id: string; name: string } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

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

  // Close action menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    };
    if (openActionMenuId) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [openActionMenuId]);

  // Fetch active / disabled customer list
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall<
        | {
            customers?: CustomerSummary[];
            deletedCount?: number;
            total?: number;
          }
        | CustomerSummary[]
      >("/admin/customers");

      if (!res.ok) {
        setError(res.message || "Failed to load customers");
        return;
      }

      const list: CustomerSummary[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.customers)
        ? (res.data as any).customers
        : [];

      const delCount: number =
        (res.meta as any)?.deletedCount ??
        (res.data as any)?.deletedCount ??
        0;

      setCustomers(list);
      setDeletedCount(delCount);
    } catch {
      setError("Network error while connecting to customer management service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load single customer detail
  const loadCustomerDetail = async (id: string) => {
    setSelectedCustomerId(id);
    setDetailLoading(true);
    try {
      const res = await apiCall<CustomerDetailData>(`/admin/customers/${id}`);
      if (!res.ok) {
        alert(res.message || "Failed to load customer profile details");
        setSelectedCustomerId(null);
        return;
      }
      setCustomerDetail(res.data);
    } catch {
      alert("Error loading customer profile");
      setSelectedCustomerId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Deep-link effect: If customerId query parameter is present, auto-open details
  useEffect(() => {
    if (customerIdParam) {
      loadCustomerDetail(customerIdParam);
    }
  }, [customerIdParam]);

  // Load recently deleted accounts
  const loadRecentlyDeleted = async () => {
    setDeletedLoading(true);
    try {
      const res = await apiCall<
        | {
            deletedAccounts?: CustomerSummary[];
            customers?: CustomerSummary[];
            count?: number;
            deletedCount?: number;
          }
        | CustomerSummary[]
      >("/admin/customers?deleted=true");

      if (res.ok && res.data) {
        const list: CustomerSummary[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any)?.deletedAccounts)
          ? (res.data as any).deletedAccounts
          : Array.isArray((res.data as any)?.customers)
          ? (res.data as any).customers
          : [];

        const count: number =
          (res.meta as any)?.deletedCount ??
          (res.data as any)?.count ??
          (res.data as any)?.deletedCount ??
          list.length;

        setDeletedAccounts(list);
        setDeletedCount(count);
      }
    } catch {
      // ignore
    } finally {
      setDeletedLoading(false);
    }
  };

  useEffect(() => {
    if (showRecentlyDeleted) {
      loadRecentlyDeleted();
    }
  }, [showRecentlyDeleted]);

  // Toggle Action Menu
  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, customerId: string) => {
    e.stopPropagation();
    if (openActionMenuId === customerId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 150;
      const opensUpward = rect.bottom + menuHeight > window.innerHeight;

      setMenuPosition({
        top: opensUpward ? Math.max(10, rect.top - menuHeight) : rect.bottom + 4,
        left: Math.max(10, rect.right - 180),
      });
      setOpenActionMenuId(customerId);
    }
  };

  // Confirm Reason Action (Disable, Delete, Reinstate)
  const handleConfirmAction = async () => {
    if (!modalAction || !targetCustomer || !reasonInput.trim()) return;
    setActionSubmitting(true);
    try {
      let endpoint = "";
      if (modalAction === "disable") endpoint = `/admin/customers/${targetCustomer.id}/disable`;
      if (modalAction === "delete") endpoint = `/admin/customers/${targetCustomer.id}/delete`;
      if (modalAction === "reinstate") endpoint = `/admin/customers/${targetCustomer.id}/reinstate`;

      const res = await apiCall<{ message: string }>(endpoint, {
        method: "POST",
        json: { reason: reasonInput.trim() },
      });

      if (!res.ok) {
        alert(res.message || "Failed to process request");
        return;
      }

      showToast(res.data?.message || "Action completed successfully");
      setModalAction(null);
      setReasonInput("");
      fetchCustomers();
      if (showRecentlyDeleted) loadRecentlyDeleted();

      if (selectedCustomerId === targetCustomer.id) {
        if (modalAction === "delete") {
          setSelectedCustomerId(null);
          setCustomerDetail(null);
        } else {
          loadCustomerDetail(targetCustomer.id);
        }
      }
    } catch (err: any) {
      alert(err.message || "Request failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReenableDirect = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to re-enable ${name}'s account?`)) return;
    try {
      const res = await apiCall<{ message: string }>(`/admin/customers/${id}/enable`, {
        method: "POST",
      });
      if (!res.ok) {
        alert(res.message || "Failed to re-enable account");
        return;
      }
      showToast(res.data?.message || "Customer account re-enabled");
      fetchCustomers();
      if (selectedCustomerId === id) loadCustomerDetail(id);
    } catch {
      alert("Network error re-enabling account");
    }
  };

  // Filter & Sort Logic
  const filteredCustomers = useMemo(() => {
    let list = [...customers];

    // Status filter
    if (statusFilter === "active") {
      list = list.filter((c) => !c.isDisabled);
    } else if (statusFilter === "disabled") {
      list = list.filter((c) => c.isDisabled);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === "profit") {
      list.sort((a, b) => b.totalProfitKobo - a.totalProfitKobo);
    } else if (sortBy === "spend") {
      list.sort((a, b) => b.totalSpentKobo - a.totalSpentKobo);
    } else if (sortBy === "orders") {
      list.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [customers, statusFilter, searchQuery, sortBy]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  // Pagination
  const totalEntries = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);
  const displayedCount = paginatedCustomers.length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomerIds(paginatedCustomers.map((c) => c.id));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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

  // Metrics
  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCount = customers.filter((c) => !c.isDisabled).length;
    const disabledCount = customers.filter((c) => c.isDisabled).length;
    const totalProfitKobo = customers.reduce((sum, c) => sum + c.totalProfitKobo, 0);
    const totalSpendKobo = customers.reduce((sum, c) => sum + c.totalSpentKobo, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    return { totalCustomers, activeCount, disabledCount, totalProfitKobo, totalSpendKobo, totalOrders };
  }, [customers]);

  return (
    <div className="px-4 pt-3.5 pb-12 sm:px-6 lg:px-8 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200">
      
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
            { label: "Customers", href: "/admin/customers" },
            { label: "Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Customer Management
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Track customer spend, inspect individual customer profit, view orders &amp; manage accounts
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Recently Deleted Drawer Button */}
            <button
              type="button"
              onClick={() => setShowRecentlyDeleted(true)}
              className="relative px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title="View accounts deleted in the last 30 days"
            >
              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>Recently Deleted</span>

              {deletedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none ml-0.5">
                  {deletedCount}
                </span>
              )}
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchCustomers()}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title="Refresh Customer Data"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#010101] text-white px-5 py-3 shadow-2xl flex items-center gap-3 border border-gray-700 animate-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ────── 4 KPI CARDS (MATCHING PRODUCTS PAGE EXACT VISUAL STYLE) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Customer Accounts */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "all"
              ? "border-amber-500/80 ring-2 ring-amber-500/40 dark:border-amber-400 dark:ring-amber-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444]"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Customer Accounts
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {metrics.totalCustomers}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {metrics.activeCount} active · {metrics.disabledCount} restricted
            </div>
          )}
        </div>

        {/* Card 2: Total Net Profit Generated */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSortBy("profit");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Profit Generated
            </span>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans truncate">
                {formatKobo(metrics.totalProfitKobo)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {metrics.totalSpendKobo > 0
                ? `${Math.round((metrics.totalProfitKobo / metrics.totalSpendKobo) * 100)}% overall margin`
                : "From completed sales"}
            </div>
          )}
        </div>

        {/* Card 3: Gross Customer Revenue */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSortBy("spend");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Gross Customer Revenue
            </span>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans truncate">
                {formatKobo(metrics.totalSpendKobo)}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
              {metrics.totalOrders} total orders processed
            </div>
          )}
        </div>

        {/* Card 4: Accounts Requiring Attention / Disabled */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter((prev) => (prev === "disabled" ? "all" : "disabled"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "disabled"
              ? "border-rose-500/80 ring-2 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-rose-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Disabled Accounts
              </span>
              {statusFilter === "disabled" && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-14 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {metrics.disabledCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-rose-500 dark:text-rose-400">
              {metrics.disabledCount > 0
                ? `${metrics.disabledCount} account${metrics.disabledCount === 1 ? "" : "s"} restricted`
                : "All accounts active"}
            </div>
          )}
        </div>
      </div>

      {/* ────── UNIFIED TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Left Actions: Status Filter Select + Sort By */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            {/* Status Select */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="all">All Accounts</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Sort Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="profit">Sort: Highest Profit</option>
                <option value="spend">Sort: Highest Spend</option>
                <option value="orders">Sort: Most Orders</option>
                <option value="newest">Sort: Newest First</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Selection Count Pill */}
            {selectedCustomerIds.length > 0 && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200 dark:border-[#333333]">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {selectedCustomerIds.length} Selected
                </span>
                <button
                  onClick={() => setSelectedCustomerIds([])}
                  className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#252525] text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                  title="Clear Selection"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Right Search Input */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or ID..."
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
        ) : error ? (
          <div className="p-8 text-center text-rose-600 dark:text-rose-400 space-y-2">
            <p className="font-bold text-sm">{error}</p>
            <button
              type="button"
              onClick={() => fetchCustomers()}
              className="text-xs underline font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
                  <th className="pl-4 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedCustomers.length > 0 && paginatedCustomers.every((c) => selectedCustomerIds.includes(c.id))}
                      onChange={handleSelectAll}
                      className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Contact Details</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-center">Orders</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Total Spent</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Profit Generated</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 text-center">Status</th>
                  <th className="pr-4 pl-2 py-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 dark:text-[#666666] font-mono">
                      No customer accounts match your search or filter parameters.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c) => {
                    const isSelected = selectedCustomerIds.includes(c.id);
                    const initial = (c.fullName || c.email || "C").charAt(0).toUpperCase();

                    return (
                      <tr
                        key={c.id}
                        onClick={(e) => {
                          const target = e.target as HTMLElement | null;
                          if (target?.closest("button, a, input, select, textarea, [role='button']")) {
                            return;
                          }
                          loadCustomerDetail(c.id);
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
                            onChange={() => handleToggleSelect(c.id)}
                            className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] rounded-[4px] border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1E1E1E] accent-[#010101] dark:accent-[#EDCF5D] [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-[#EDCF5D]/50 focus:ring-offset-0 cursor-pointer transition-colors shadow-2xs"
                          />
                        </td>

                        {/* Customer Avatar & Name */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadCustomerDetail(c.id);
                              }}
                              className="w-8 h-8 rounded-full bg-[#EDCF5D] text-[#010101] border border-amber-300/60 dark:border-amber-400/40 flex items-center justify-center shrink-0 font-black text-xs shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                              title="View Customer Profile"
                            >
                              {initial}
                            </button>
                            <div className="min-w-0">
                              <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-tight transition-colors block truncate">
                                {c.fullName}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="font-mono text-[10px] text-gray-400">
                                  ID: {c.id.slice(0, 8)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(c.id, c.id);
                                  }}
                                  title="Copy full Customer ID"
                                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                >
                                  {copiedId === c.id ? (
                                    <span className="text-[9.5px] text-emerald-600 font-bold">Copied!</span>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="px-3 py-3">
                          <p className="text-gray-900 dark:text-gray-200 font-medium truncate max-w-[190px]">
                            {c.email}
                          </p>
                          <p className="text-gray-400 font-mono text-[11px] mt-0.5">
                            {c.phone || "No phone listed"}
                          </p>
                        </td>

                        {/* Total Orders */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300">
                            {c.totalOrders}
                          </span>
                        </td>

                        {/* Total Spent */}
                        <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatKobo(c.totalSpentKobo)}
                        </td>

                        {/* Net Profit Generated */}
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {formatKobo(c.totalProfitKobo)}
                            </span>
                            {c.profitMarginPct > 0 && (
                              <span className="text-[10px] text-gray-400 font-mono">
                                {c.profitMarginPct}% margin
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Account Status Badge */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {c.isDisabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                              Disabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Active
                            </span>
                          )}
                        </td>

                        {/* 3-Dots Action Button */}
                        <td className="pr-4 pl-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, c.id)}
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

        {/* ────── PAGINATION FOOTER BAR ────── */}
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage === 1}
                className="w-8 h-8 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer"
              >
                ‹
              </button>

              {getPageNumbers().map((num, idx) =>
                num === "..." ? (
                  <span key={idx} className="w-8 h-8 flex items-center justify-center text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentPage(num as number)}
                    className={`w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                      validCurrentPage === num
                        ? "bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-black font-bold shadow-2xs"
                        : "border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs"
                    }`}
                  >
                    {num}
                  </button>
                )
              )}

              {/* Next Page Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage === totalPages}
                className="w-8 h-8 rounded-xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ────── 3-DOTS ACTION FLOATING DROPDOWN MENU ────── */}
      {openActionMenuId && menuPosition && (() => {
        const c = customers.find((item) => item.id === openActionMenuId);
        if (!c) return null;

        return (
          <div
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-50 w-44 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {/* View Details Button */}
            <button
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                loadCustomerDetail(c.id);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#282828] flex items-center gap-2 cursor-pointer transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>View Details</span>
            </button>

            {/* Toggle Enable / Disable */}
            {c.isDisabled ? (
              <button
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  handleReenableDirect(c.id, c.fullName);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Re-enable Account</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setTargetCustomer({ id: c.id, name: c.fullName });
                  setReasonInput("");
                  setModalAction("disable");
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>Disable Account</span>
              </button>
            )}

            {/* Delete Account */}
            <button
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                setTargetCustomer({ id: c.id, name: c.fullName });
                setReasonInput("");
                setModalAction("delete");
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>Delete Account</span>
            </button>
          </div>
        );
      })()}

      {/* ────── SLIDE-OVER 1: CUSTOMER DETAILS DRAWER ────── */}
      <CustomerInfoDrawer
        customerDetail={customerDetail}
        isOpen={Boolean(selectedCustomerId)}
        loading={detailLoading}
        onClose={() => {
          setSelectedCustomerId(null);
          setCustomerDetail(null);
        }}
        onDisable={(id, name) => {
          setTargetCustomer({ id, name });
          setReasonInput("");
          setModalAction("disable");
        }}
        onEnable={(id, name) => {
          handleReenableDirect(id, name);
        }}
        onDelete={(id, name) => {
          setTargetCustomer({ id, name });
          setReasonInput("");
          setModalAction("delete");
        }}
      />

      {/* ────── SLIDE-OVER 2: RECENTLY DELETED ACCOUNTS DRAWER ────── */}
      <RecentlyDeletedDrawer
        isOpen={showRecentlyDeleted}
        loading={deletedLoading}
        deletedAccounts={deletedAccounts}
        searchQuery={deletedSearch}
        onSearchChange={setDeletedSearch}
        onClose={() => setShowRecentlyDeleted(false)}
        onViewInfo={(id) => {
          setShowRecentlyDeleted(false);
          loadCustomerDetail(id);
        }}
        onReinstate={(id, name) => {
          setTargetCustomer({ id, name });
          setReasonInput("");
          setModalAction("reinstate");
        }}
      />

      {/* ────── MODAL: REQUIRED REASON (DISABLE, DELETE, REINSTATE) ────── */}
      <CustomerActionModal
        modalAction={modalAction}
        targetCustomer={targetCustomer}
        reasonInput={reasonInput}
        actionSubmitting={actionSubmitting}
        onReasonChange={setReasonInput}
        onClose={() => {
          if (!actionSubmitting) setModalAction(null);
        }}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center text-xs text-gray-500">Loading customers...</div>}>
      <AdminCustomersContent />
    </Suspense>
  );
}
