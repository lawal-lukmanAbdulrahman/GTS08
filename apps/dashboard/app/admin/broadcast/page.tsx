"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@gts/database/client";
import { AdminTopStrip } from "../sidebar-context";
import {
  getLocalBroadcastItems,
  setLocalBroadcastItems,
  type BroadcastItem,
  INITIAL_BROADCAST_ITEMS,
} from "../../../lib/notifications";
import BroadcastAnalyticsDrawer from "./broadcast-analytics-drawer";
import { idempotentFetch } from "@gts/utils";

const CURATED_GRAPHIC_PRESETS = [
  {
    name: "Luxury Tailored Suiting",
    url: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1200&auto=format&fit=crop",
    title: "EXCLUSIVE EDIT",
    subtitle: "Discover bespoke Italian wool suiting tailored for exceptional occasions.",
    cta: "Explore Collection",
    link: "/shop",
  },
  {
    name: "New Season Linen Drop",
    url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1200&auto=format&fit=crop",
    title: "SPRING / SUMMER",
    subtitle: "Breathable pure linens and relaxed modern fits for tropical elegance.",
    cta: "Shop New Arrivals",
    link: "/shop?category=linen",
  },
  {
    name: "Midnight Gala & Velvet",
    url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1200&auto=format&fit=crop",
    title: "BLACK TIE COUTURE",
    subtitle: "Hand-finished satin lapels, double-breasted jackets, and statement evening wear.",
    cta: "View Collection",
    link: "/shop?category=evening",
  },
  {
    name: "Flash Private Sale",
    url: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=1200&auto=format&fit=crop",
    title: "PRIVATE ACCESS",
    subtitle: "Enjoy member-only complimentary bespoke sizing on select wardrobe essentials.",
    cta: "Claim Privilege",
    link: "/shop?sort=trending",
  },
];

export default function AdminBroadcastPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "disabled" | "archived">("ALL");
  const [engagementFilter, setEngagementFilter] = useState<"ALL" | "HIGH" | "STANDARD">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "impressions_desc" | "clicks_desc" | "ctr_desc" | "attention_desc" | "title_asc">("newest");
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([]);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = React.useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Action Menu & Delete Modal States
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deletingBroadcastItem, setDeletingBroadcastItem] = useState<BroadcastItem | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(3);

  // Drawer state
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Fetch broadcasts and synchronize server-authoritative analytics
  const fetchBroadcasts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    let serverBroadcasts: BroadcastItem[] = [];
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
      const res = await fetch("/api/v1/broadcast", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.broadcasts && Array.isArray(json.broadcasts)) {
          serverBroadcasts = json.broadcasts;
        }
      }
    } catch {
      // silent fallback
    }

    // Known mock IDs to completely purge
    const MOCK_IDS = new Set([
      "broadcast-exclusive-edit",
      "broadcast-linen-drop",
      "broadcast-black-tie",
      "broadcast-private-sale",
      "broadcast-fallback",
    ]);

    const localItems = getLocalBroadcastItems().filter((item) => !MOCK_IDS.has(item.id));
    const filteredServer = serverBroadcasts.filter((item) => !MOCK_IDS.has(item.id));
    const merged: BroadcastItem[] = [...localItems];

    for (const sb of filteredServer) {
      const localIdx = merged.findIndex((m) => m.id === sb.id);
      if (localIdx === -1) {
        merged.push(sb);
      } else {
        const existingItem = merged[localIdx];
        if (existingItem) {
          const localUpdated = new Date(existingItem.updatedAt || 0).getTime();
          const serverUpdated = new Date(sb.updatedAt || 0).getTime();
          // Server analytics is the single source of truth for engagement data
          merged[localIdx] = {
            ...(serverUpdated >= localUpdated ? sb : existingItem),
            analytics: sb.analytics || existingItem.analytics,
          };
        }
      }
    }

    setBroadcasts(merged);
    setLocalBroadcastItems(merged);

    // Keep open analytics drawer strictly synchronized with fresh server analytics
    setSelectedBroadcast((prev) => {
      if (!prev) return prev;
      const updated = merged.find((m) => m.id === prev.id);
      return updated || prev;
    });

    if (showLoading) setLoading(false);

    // If server has no campaigns but local storage does, sync active broadcast to server
    if (serverBroadcasts.length === 0 && localItems.length > 0) {
      const activeLocal = localItems.find((b) => b.status === "active") || localItems[0];
      if (activeLocal) {
        idempotentFetch("/api/v1/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...activeLocal,
            action: "rebroadcast",
            broadcast: activeLocal,
          }),
        }).catch(() => {});
      }
    }
  }, []);

  // 1. Initial mount fetch
  useEffect(() => {
    fetchBroadcasts(true);
  }, [fetchBroadcasts]);

  // 2. Realtime listener: instant analytics updates and broadcast changes via Supabase
  useEffect(() => {
    let supabase: any = null;
    let channel: any = null;
    try {
      supabase = createClient();
      channel = supabase.channel("storefront_broadcast", {
        config: { broadcast: { self: true } },
      });

      // Instantly update table rows & open analytics drawer when visitor interacts in storefront
      channel.on("broadcast", { event: "broadcast_analytics_updated" }, ({ payload }: any) => {
        if (!payload || !payload.id || !payload.analytics) return;
        const { id, analytics } = payload;

        setBroadcasts((prev) => {
          const updated = prev.map((b) => (b.id === id ? { ...b, analytics } : b));
          setLocalBroadcastItems(updated);
          return updated;
        });

        setSelectedBroadcast((prev) => {
          if (prev && prev.id === id) {
            return { ...prev, analytics };
          }
          return prev;
        });
      });

      channel.on("broadcast", { event: "broadcast_updated" }, ({ payload }: any) => {
        if (!payload || !payload.id) return;
        fetchBroadcasts(false);
      });

      channel.subscribe();
    } catch (err) {
      console.warn("Realtime broadcast subscription warning:", err);
    }

    return () => {
      if (supabase && channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [fetchBroadcasts]);

  // 3. Fallback background sync: when tab regains focus or every 15s when tab is visible
  useEffect(() => {
    const handleFocus = () => fetchBroadcasts(false);
    window.addEventListener("focus", handleFocus);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchBroadcasts(false);
      }
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [fetchBroadcasts]);

  // Detect scroll for sticky header
  useEffect(() => {
    const mainEl = document.querySelector("main");
    const handleScroll = () => {
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      setScrolled(scrollY > 10);
    };

    if (mainEl) mainEl.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Click outside listener for filter popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setShowFilterPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "ALL") count++;
    if (engagementFilter !== "ALL") count++;
    if (sortBy !== "newest") count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [statusFilter, engagementFilter, sortBy, searchQuery]);

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setEngagementFilter("ALL");
    setSortBy("newest");
    setSearchQuery("");
  };

  // Filtered and sorted broadcasts
  const filteredBroadcasts = useMemo(() => {
    return broadcasts
      .filter((b) => {
        const matchesSearch =
          !searchQuery ||
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.ctaLink.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.ctaLabel.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
          statusFilter === "ALL"
            ? b.status !== "archived" || searchQuery.trim().length > 0
            : b.status === statusFilter;

        const matchesEngagement =
          engagementFilter === "ALL"
            ? true
            : engagementFilter === "HIGH"
            ? b.analytics.avgAttentionSeconds >= 4.5
            : b.analytics.avgAttentionSeconds < 4.5;

        return matchesSearch && matchesStatus && matchesEngagement;
      })
      .sort((a, b) => {
        if (sortBy === "impressions_desc") return b.analytics.impressions - a.analytics.impressions;
        if (sortBy === "clicks_desc") return b.analytics.clicks - a.analytics.clicks;
        if (sortBy === "ctr_desc") return b.analytics.ctrPct - a.analytics.ctrPct;
        if (sortBy === "attention_desc") return b.analytics.avgAttentionSeconds - a.analytics.avgAttentionSeconds;
        if (sortBy === "title_asc") return a.title.localeCompare(b.title);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [broadcasts, searchQuery, statusFilter, engagementFilter, sortBy]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (filteredBroadcasts.length > 0 && filteredBroadcasts.every((b) => selectedBroadcastIds.includes(b.id))) {
      setSelectedBroadcastIds([]);
    } else {
      setSelectedBroadcastIds(filteredBroadcasts.map((b) => b.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedBroadcastIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkArchive = async () => {
    const updated = broadcasts.map((b) =>
      selectedBroadcastIds.includes(b.id) ? { ...b, status: "archived" as const, isActive: false } : b
    );
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);
    const toProcess = [...selectedBroadcastIds];
    setSelectedBroadcastIds([]);
    for (const id of toProcess) {
      try {
        await idempotentFetch("/api/v1/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_status", id, status: "archived" }),
        });
      } catch (e) {
        console.error("Bulk archive error:", e);
      }
    }
  };

  const handleBulkDisable = async () => {
    const updated = broadcasts.map((b) =>
      selectedBroadcastIds.includes(b.id) ? { ...b, status: "disabled" as const, isActive: false } : b
    );
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);
    const toProcess = [...selectedBroadcastIds];
    setSelectedBroadcastIds([]);
    for (const id of toProcess) {
      try {
        await idempotentFetch("/api/v1/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_status", id, status: "disabled" }),
        });
      } catch (e) {
        console.error("Bulk disable error:", e);
      }
    }
  };

  // Aggregate KPI metrics
  const activeBroadcastsCount = broadcasts.filter((b) => b.status === "active").length;
  const totalImpressions = broadcasts.reduce((acc, b) => acc + (b.analytics?.impressions || 0), 0);
  const totalUniqueVisitors = broadcasts.reduce((acc, b) => acc + (b.analytics?.uniqueVisitors || 0), 0);
  const totalClicks = broadcasts.reduce((acc, b) => acc + (b.analytics?.clicks || 0), 0);
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 13.5;
  const avgAttention =
    broadcasts.length > 0
      ? broadcasts.reduce((acc, b) => acc + (b.analytics?.avgAttentionSeconds || 0), 0) / broadcasts.length
      : 6.6;

  // Drawer handlers
  const handleOpenDrawer = (item: BroadcastItem) => {
    setSelectedBroadcast(item);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Toggle Status (Activate / Disable)
  const handleToggleStatus = async (target: BroadcastItem) => {
    const nextStatus: "active" | "disabled" = target.status === "active" ? "disabled" : "active";
    const nextIsActive = nextStatus === "active";
    const now = new Date().toISOString();

    const updatedTarget: BroadcastItem = {
      ...target,
      status: nextStatus,
      isActive: nextIsActive,
      updatedAt: now,
    };

    // Optimistic UI update: allow multiple active campaigns
    const updated: BroadcastItem[] = broadcasts.map((b) =>
      b.id === target.id ? updatedTarget : b
    );
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);

    if (selectedBroadcast?.id === target.id) {
      setSelectedBroadcast(updatedTarget);
    }

    try {
      await idempotentFetch("/api/v1/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          id: target.id,
          status: nextStatus,
          broadcast: updatedTarget,
        }),
      });
      showToast(nextIsActive ? "Broadcast activated successfully." : "Broadcast disabled.", "success");
    } catch (err) {
      console.error("Failed to sync broadcast status:", err);
      showToast("Failed to update status on server.", "error");
    }
  };

  // Archive / Unarchive
  const handleArchive = async (target: BroadcastItem) => {
    const nextStatus: "disabled" | "archived" = target.status === "archived" ? "disabled" : "archived";
    const nextIsActive = false;
    const now = new Date().toISOString();

    const updatedTarget: BroadcastItem = {
      ...target,
      status: nextStatus,
      isActive: nextIsActive,
      updatedAt: now,
    };

    const updated: BroadcastItem[] = broadcasts.map((b) =>
      b.id === target.id ? updatedTarget : b
    );
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);

    if (selectedBroadcast?.id === target.id) {
      setSelectedBroadcast(updatedTarget);
    }

    try {
      await idempotentFetch("/api/v1/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          id: target.id,
          status: nextStatus,
          broadcast: updatedTarget,
        }),
      });
      showToast(nextStatus === "archived" ? "Broadcast archived." : "Broadcast unarchived.", "info");
    } catch (err) {
      console.error("Failed to archive broadcast:", err);
      showToast("Failed to update broadcast status.", "error");
    }
  };

  // Rebroadcast — bumps rebroadcastedAt so all users (new & returning) see it again
  const handleRebroadcast = async (target: BroadcastItem) => {
    const now = new Date().toISOString();
    const updatedTarget: BroadcastItem = {
      ...target,
      rebroadcastedAt: now,
      status: "active" as const,
      isActive: true,
      updatedAt: now,
    };

    const updated: BroadcastItem[] = broadcasts.map((b) =>
      b.id === target.id ? updatedTarget : b
    );
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);

    if (selectedBroadcast?.id === target.id) {
      setSelectedBroadcast(updatedTarget);
    }

    try {
      const res = await idempotentFetch("/api/v1/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rebroadcast",
          id: target.id,
          broadcast: updatedTarget,
          title: updatedTarget.title,
          subtitle: updatedTarget.subtitle,
          imageUrl: updatedTarget.imageUrl,
          ctaLabel: updatedTarget.ctaLabel,
          ctaLink: updatedTarget.ctaLink,
          isActive: true,
          status: "active",
          designConfig: updatedTarget.designConfig,
          rebroadcastedAt: now,
          expiresAt: updatedTarget.expiresAt,
        }),
      });

      if (res?.ok) {
        showToast(
          `"${target.title || "Broadcast"}" rebroadcasted! Showing to all storefront visitors immediately.`,
          "success"
        );
      } else {
        showToast("Rebroadcast saved locally, but server returned an error.", "error");
      }
    } catch (err) {
      console.error("Failed to rebroadcast:", err);
      showToast("Network error while rebroadcasting. Please try again.", "error");
    }
  };

  // Row Action Menu Toggle
  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, broadcastId: string) => {
    e.stopPropagation();
    if (openActionMenuId === broadcastId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 215;
      const opensUpward = rect.bottom + menuHeight > window.innerHeight;

      setMenuPosition({
        top: opensUpward ? Math.max(10, rect.top - menuHeight) : rect.bottom + 4,
        left: Math.max(10, rect.right - 176),
      });
      setOpenActionMenuId(broadcastId);
    }
  };

  // Delete Dialog Handlers & Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deletingBroadcastItem && deleteCountdown > 0) {
      timer = setInterval(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deletingBroadcastItem, deleteCountdown]);

  const handleOpenDeleteDialog = (item: BroadcastItem) => {
    setOpenActionMenuId(null);
    setMenuPosition(null);
    setDeletingBroadcastItem(item);
    setDeleteCountdown(3);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBroadcastItem) return;
    const targetId = deletingBroadcastItem.id;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
      await fetch(`/api/v1/broadcast?id=${targetId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}

    const updated = broadcasts.filter((b) => b.id !== targetId);
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);
    setSelectedBroadcastIds((prev) => prev.filter((id) => id !== targetId));
    if (selectedBroadcast?.id === targetId) {
      setIsDrawerOpen(false);
      setSelectedBroadcast(null);
    }
    setDeletingBroadcastItem(null);
  };

  const handleBulkDelete = async () => {
    if (selectedBroadcastIds.length === 0) return;
    const idsToDelete = [...selectedBroadcastIds];
    const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
    for (const id of idsToDelete) {
      try {
        await fetch(`/api/v1/broadcast?id=${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {}
    }
    const updated = broadcasts.filter((b) => !idsToDelete.includes(b.id));
    setBroadcasts(updated);
    setLocalBroadcastItems(updated);
    setSelectedBroadcastIds([]);
  };

  // Close floating menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (openActionMenuId) {
        setOpenActionMenuId(null);
        setMenuPosition(null);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [openActionMenuId]);

  return (
    <div className="px-4 pt-3.5 pb-12 lg:px-5 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200 relative">
      {/* ────── TOAST NOTIFICATION ────── */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl shadow-2xl backdrop-blur-md border ${
              toast.type === "success"
                ? "bg-emerald-950/95 text-emerald-100 border-emerald-500/40 shadow-emerald-950/60"
                : toast.type === "error"
                ? "bg-red-950/95 text-red-100 border-red-500/40 shadow-red-950/60"
                : "bg-gray-900/95 text-gray-100 border-gray-700 shadow-black/60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" ? (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              )}
              <p className="text-xs sm:text-sm font-medium leading-snug">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2.5 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ────── STICKY TOP PAGE HEADER (METADATA + ACTIONS) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2.5 lg:-mx-5 lg:-mt-3.5 lg:px-5 space-y-3 bg-[#F8F7F4]/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md transition-all duration-200 ${
          scrolled ? "border-b border-gray-200 dark:border-[#262626] shadow-2xs" : "border-b border-transparent"
        }`}
      >
        <AdminTopStrip
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Broadcast", href: "/admin/broadcast" },
            { label: "Campaigns" },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Storefront Broadcasts
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Manage pop-up announcements, promotional takeovers, and engagement analytics
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/broadcast/editor?new=true"
              className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] hover:bg-[#dfbe46] text-black text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add Broadcast</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ────── 4 ISOMETRIC OVERVIEW CARDS (MATCHING PRODUCT PAGE) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Broadcasts */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("active")}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Active Broadcasts
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {activeBroadcastsCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Live on Storefront
            </div>
          )}

          {/* 3D Isometric Digital Screen Watermark (Clean Monotone Gray + Dull Gold) */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-80 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <style>{`
                  .wm-bc-top-s1 { stop-color: #E5E7EB; }
                  .wm-bc-top-s2 { stop-color: #D1D5DB; }
                  .wm-bc-left-s1 { stop-color: #9CA3AF; }
                  .wm-bc-left-s2 { stop-color: #6B7280; }
                  .wm-bc-right-s1 { stop-color: #6B7280; }
                  .wm-bc-right-s2 { stop-color: #4B5563; }
                  .wm-bc-stroke { stroke: rgba(0, 0, 0, 0.16); }
                  .wm-bc-line { stroke: rgba(51, 65, 85, 0.5); }
                  .dark .wm-bc-top-s1 { stop-color: #3A3A3A; }
                  .dark .wm-bc-top-s2 { stop-color: #2D2D2D; }
                  .dark .wm-bc-left-s1 { stop-color: #242424; }
                  .dark .wm-bc-left-s2 { stop-color: #1A1A1A; }
                  .dark .wm-bc-right-s1 { stop-color: #1A1A1A; }
                  .dark .wm-bc-right-s2 { stop-color: #121212; }
                  .dark .wm-bc-stroke { stroke: rgba(255, 255, 255, 0.18); }
                  .dark .wm-bc-line { stroke: rgba(255, 255, 255, 0.35); }
                `}</style>
                <linearGradient id="bcFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeTopLeftBc">
                  <rect x="0" y="0" width="130" height="100" fill="url(#bcFadeMask)" />
                </mask>
                <linearGradient id="bcTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-bc-top-s1" />
                  <stop offset="100%" className="wm-bc-top-s2" />
                </linearGradient>
                <linearGradient id="bcLeftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-bc-left-s1" />
                  <stop offset="100%" className="wm-bc-left-s2" />
                </linearGradient>
                <linearGradient id="bcRightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-bc-right-s1" />
                  <stop offset="100%" className="wm-bc-right-s2" />
                </linearGradient>
              </defs>

              <g mask="url(#fadeTopLeftBc)">
                {/* Base Plinth */}
                <polygon points="26,62 60,46 94,62 60,78" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="26,62 60,78 60,84 26,68" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="60,78 94,62 94,68 60,84" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Vertical Screen Display */}
                <polygon points="38,28 72,14 72,58 38,72" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.4" />
                <polygon points="38,28 42,26 76,12 72,14" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="72,14 76,12 76,56 72,58" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Clean Screen Wireframe Content Lines */}
                <line x1="45" y1="36" x2="62" y2="29" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                <line x1="45" y1="42" x2="66" y2="33" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />

                {/* Mini Dull Gold CTA Pill */}
                <polygon points="45,52 56,47 56,52 45,57" fill="#C5A845" opacity="0.45" />
              </g>
            </svg>
          </div>
        </div>

        {/* Card 2: Total Impressions (Views) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("ALL")}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Shopper Impressions
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {totalImpressions.toLocaleString()}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {totalUniqueVisitors.toLocaleString()} unique shoppers
            </div>
          )}

          {/* 3D Isometric Ocular Disc Watermark (Clean Monotone Gray + Dull Gold) */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-80 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <mask id="fadeTopLeftBc2">
                  <rect x="0" y="0" width="130" height="100" fill="url(#bcFadeMask)" />
                </mask>
              </defs>

              <g mask="url(#fadeTopLeftBc2)">
                {/* Stepped Base Disc */}
                <polygon points="24,54 65,34 106,54 65,74" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="24,54 65,74 65,80 24,60" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="65,74 106,54 106,60 65,80" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Upper Recessed Disc */}
                <polygon points="36,54 65,40 94,54 65,68" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1" />

                {/* Minimal Eye Aperture Outline */}
                <path d="M 46 54 C 53 45, 77 45, 84 54 C 77 63, 53 63, 46 54 Z" fill="url(#bcRightGrad)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
                <ellipse cx="65" cy="54" rx="7" ry="5" fill="#141414" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                <circle cx="67" cy="52" r="1.2" fill="#FFFFFF" opacity="0.8" />

                {/* Subtle Dull Gold Concentric Ring Accent */}
                <polygon points="32,54 65,38 98,54 65,70" fill="none" stroke="rgba(197, 168, 69, 0.35)" strokeWidth="1.2" strokeDasharray="4 3" />
              </g>
            </svg>
          </div>
        </div>

        {/* Card 3: Avg. Attention Span (Dwell Time) */}
        <div
          role="button"
          tabIndex={0}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Avg. Attention Span
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans flex items-baseline gap-1">
                <span>{avgAttention.toFixed(1)}</span>
                <span className="text-base font-normal text-gray-400">sec</span>
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              ★ High Engagement (&gt;4.5s)
            </div>
          )}

          {/* 3D Isometric Chronometer Cylinder Watermark (Clean Monotone Gray + Dull Gold) */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-80 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <mask id="fadeTopLeftBc3">
                  <rect x="0" y="0" width="130" height="100" fill="url(#bcFadeMask)" />
                </mask>
              </defs>

              <g mask="url(#fadeTopLeftBc3)">
                {/* Cylinder Body */}
                <polygon points="28,44 65,26 102,44 65,62" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="28,44 65,62 65,76 28,58" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="65,62 102,44 102,58 65,76" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Top Push-Button */}
                <polygon points="60,18 65,15 70,18 65,21" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1" />
                <polygon points="60,18 65,21 65,24 60,21" fill="url(#bcLeftGrad)" />
                <polygon points="65,21 70,18 70,21 65,24" fill="url(#bcRightGrad)" />

                {/* Dial Rim & Ticks */}
                <polygon points="36,44 65,30 94,44 65,58" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                <line x1="65" y1="30" x2="65" y2="33" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <line x1="94" y1="44" x2="91" y2="44" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <line x1="65" y1="58" x2="65" y2="55" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <line x1="36" y1="44" x2="39" y2="44" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />

                {/* Faint Dull Gold Elapsed Sector */}
                <path d="M 65 44 L 65 30 A 29 14 0 0 1 88 48 Z" fill="rgba(197, 168, 69, 0.08)" stroke="rgba(197, 168, 69, 0.3)" strokeWidth="1" />

                {/* Dull Gold Hands */}
                <circle cx="65" cy="44" r="2" fill="#C5A845" opacity="0.75" />
                <line x1="65" y1="44" x2="56" y2="41" stroke="#C5A845" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                <line x1="65" y1="44" x2="84" y2="47" stroke="#C5A845" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
              </g>
            </svg>
          </div>
        </div>

        {/* Card 4: Action Clicks & CTR */}
        <div
          role="button"
          tabIndex={0}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Action Clicks & CTR
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {totalClicks.toLocaleString()}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {overallCtr.toFixed(1)}% Conversion Rate
            </div>
          )}

          {/* 3D Isometric Keycap Switch Watermark (Clean Monotone Gray + Dull Gold) */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-80 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <mask id="fadeTopLeftBc4">
                  <rect x="0" y="0" width="130" height="100" fill="url(#bcFadeMask)" />
                </mask>
              </defs>

              <g mask="url(#fadeTopLeftBc4)">
                {/* Switch Base Plinth */}
                <polygon points="24,66 62,48 100,66 62,84" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="24,66 62,84 62,90 24,72" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="62,84 100,66 100,72 62,90" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Keycap Button */}
                <polygon points="34,54 62,40 90,54 62,68" fill="url(#bcTopGrad)" className="wm-bc-stroke" strokeWidth="1.4" />
                <polygon points="34,54 62,68 62,74 34,60" fill="url(#bcLeftGrad)" className="wm-bc-stroke" strokeWidth="1.2" />
                <polygon points="62,68 90,54 90,60 62,74" fill="url(#bcRightGrad)" className="wm-bc-stroke" strokeWidth="1.2" />

                {/* Subtle Dull Gold Chevron Accent */}
                <polyline points="57,52 62,55 67,52" stroke="rgba(197, 168, 69, 0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

                {/* Clean 3D Isometric Cursor Arrow */}
                <polygon points="68,22 80,34 74,36 80,46 76,48 70,38 64,42" fill="url(#bcTopGrad)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
                <polygon points="68,22 64,42 62,41 66,21" fill="url(#bcLeftGrad)" />

                {/* Single Faint Dull Gold Base Seam */}
                <polygon points="26,67 62,49 98,67 62,85" fill="none" stroke="rgba(197, 168, 69, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* ────── UNIFIED BROADCAST TOOLBAR & TABLE CONTAINER (MATCHING PRODUCT PAGE) ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + All Status Dropdown + All Engagement Dropdown */}
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
                        Filter Broadcasts
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

                  {/* Status Filter Pills */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Campaign Status
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["ALL", "active", "disabled", "archived"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            statusFilter === st
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          <span className="capitalize">{st === "ALL" ? "All Status" : st}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Engagement Tier Pills */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Engagement Tier
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "ALL", label: "All Tiers" },
                        { id: "HIGH", label: "★ High Engagement (>4.5s)" },
                        { id: "STANDARD", label: "Standard Glance (<4.5s)" },
                      ].map((eg) => (
                        <button
                          key={eg.id}
                          type="button"
                          onClick={() => setEngagementFilter(eg.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            engagementFilter === eg.id
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {eg.label}
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
                      <option value="impressions_desc">Most Impressions</option>
                      <option value="attention_desc">Highest Attention Span</option>
                      <option value="clicks_desc">Most Action Clicks</option>
                      <option value="ctr_desc">Highest Conversion Rate (CTR)</option>
                      <option value="title_asc">Title (A–Z)</option>
                    </select>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {filteredBroadcasts.length} campaigns matching
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

            {/* Status Select Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="archived">Archived</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Engagement Select Filter Dropdown */}
            <div className="relative">
              <select
                value={engagementFilter}
                onChange={(e) => setEngagementFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Stock</option>
                <option value="HIGH">★ High Engagement</option>
                <option value="STANDARD">Standard Glance</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Bulk Selection Actions (when checkboxes are checked) */}
            {selectedBroadcastIds.length > 0 && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200 dark:border-[#333333] transition-all">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mr-0.5">
                  {selectedBroadcastIds.length} Selected
                </span>

                {/* Bulk Archive Icon Button */}
                <button
                  type="button"
                  onClick={handleBulkArchive}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  title="Archive Selected"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </button>

                {/* Bulk Disable Icon Button */}
                <button
                  type="button"
                  onClick={handleBulkDisable}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  title="Disable Selected"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>

                {/* Bulk Delete Icon Button */}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  title="Delete Selected"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                  </svg>
                </button>

                {/* Clear Selection Button */}
                <button
                  type="button"
                  onClick={() => setSelectedBroadcastIds([])}
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
              placeholder="Search...."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Table Content inside the same container */}
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[#222222] rounded-xl" />
            ))}
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-3">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">No campaigns found</p>
            <p className="text-xs">Adjust your search or click "Add Broadcast" to launch a new campaign.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
                  <th className="pl-4 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredBroadcasts.length > 0 && filteredBroadcasts.every((b) => selectedBroadcastIds.includes(b.id))}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Broadcast Creative</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Destination CTA</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Impressions</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Attention Span</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Clicks & CTR</th>
                  <th className="pr-4 pl-2 py-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                {filteredBroadcasts.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDrawer(item)}
                    className="hover:bg-gray-50/70 dark:hover:bg-[#202020] transition-colors cursor-pointer group"
                  >
                    <td className="pl-4 pr-2 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedBroadcastIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                      />
                    </td>
                    {/* Creative & Title */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const thumbnailSrc =
                            (item.imageUrl && item.imageUrl.trim() !== "" ? item.imageUrl : null) ||
                            item.designConfig?.elements?.find((el) => el.type === "image" && el.imageUrl && el.imageUrl.trim() !== "")?.imageUrl ||
                            null;

                          return (
                            <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-[#333] shrink-0 bg-neutral-900 group-hover:scale-105 transition-transform flex items-center justify-center">
                              {thumbnailSrc ? (
                                <Image
                                  src={thumbnailSrc}
                                  alt={item.title || "Creative"}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                  sizes="64px"
                                />
                              ) : (
                                <div
                                  style={{
                                    backgroundColor: item.designConfig?.backgroundColor || "#121212",
                                  }}
                                  className="w-full h-full flex flex-col items-center justify-center p-1 relative select-none"
                                >
                                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-violet-500/15 pointer-events-none" />
                                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                                    <svg className="w-3.5 h-3.5 text-[#EDCF5D] mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                    <span className="text-[9px] font-mono font-bold text-white/90 truncate max-w-[56px] leading-tight">
                                      {item.title || "Studio"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div className="space-y-0.5">
                          <div className="font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-[#EDCF5D] transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-[#888] line-clamp-1 max-w-xs">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Destination CTA */}
                    <td className="px-3 py-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {item.ctaLabel}
                        </span>
                        <div className="font-mono text-[10px] text-gray-400">
                          {item.ctaLink}
                        </div>
                      </div>
                    </td>

                    {/* Status Badge + Expiry Badge */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${
                            item.status === "active"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : item.status === "disabled"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-gray-200 dark:bg-[#2C2C2C] text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#383838]"
                          }`}
                        >
                          {item.status === "active" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {item.status}
                        </span>
                        {/* Expiry badge */}
                        {item.expiresAt && item.status !== "archived" && (() => {
                          const exp = new Date(item.expiresAt);
                          const diffMs = exp.getTime() - Date.now();
                          const diffHrs = diffMs / 3600000;
                          const expiredAlready = diffMs <= 0;
                          const expiringSoon = !expiredAlready && diffHrs <= 24;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold w-fit ${
                                expiredAlready
                                  ? "bg-red-500/15 text-red-500 border border-red-500/30"
                                  : expiringSoon
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                  : "bg-gray-100 dark:bg-[#2A2A2A] text-gray-400 border border-gray-200 dark:border-[#383838]"
                              }`}
                              title={`Expires: ${exp.toLocaleString()}`}
                            >
                              <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {expiredAlready
                                ? "Expired"
                                : expiringSoon
                                ? `${Math.ceil(diffHrs)}h left`
                                : exp.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Impressions */}
                    <td className="px-3 py-3 font-mono font-bold text-gray-900 dark:text-white">
                      {item.analytics.impressions.toLocaleString()}
                    </td>

                    {/* Attention Span */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 font-mono font-bold text-gray-900 dark:text-white">
                        <span>{item.analytics.avgAttentionSeconds.toFixed(1)}s</span>
                        {item.analytics.avgAttentionSeconds >= 4.5 && (
                          <span className="text-[10px] text-amber-500 font-sans">★</span>
                        )}
                      </div>
                    </td>

                    {/* Clicks & CTR */}
                    <td className="px-3 py-3">
                      <div className="font-mono font-bold text-gray-900 dark:text-white">
                        {item.analytics.clicks.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {item.analytics.ctrPct.toFixed(1)}% CTR
                      </div>
                    </td>

                    {/* 3-Dots Vertical Action Button */}
                    <td className="pr-4 pl-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleMenu(e, item.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer"
                        title="Actions"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ────── FLOATING FIXED ACTION DROPDOWN MENU (UNCLIPPED VIEWPORT PORTAL) ────── */}
      {openActionMenuId && menuPosition && (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans">
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => {
              setOpenActionMenuId(null);
              setMenuPosition(null);
            }}
          />
          {filteredBroadcasts.map((item) => {
            if (item.id !== openActionMenuId) return null;
            return (
              <div
                key={item.id}
                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                className="fixed w-44 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn overflow-hidden pointer-events-auto"
              >
                {/* Analytics Option */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                    handleOpenDrawer(item);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <span>Analytics</span>
                </button>

                {/* Edit Option */}
                <Link
                  href={`/admin/broadcast/editor?id=${item.id}`}
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <span>Edit</span>
                </Link>

                {/* Rebroadcast Option */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                    handleRebroadcast(item);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.69z" />
                  </svg>
                  <span>Rebroadcast</span>
                </button>

                {/* Activate / Disable Option */}
                {item.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setMenuPosition(null);
                      handleToggleStatus(item);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                    <span>Disable</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setMenuPosition(null);
                      handleToggleStatus(item);
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Activate</span>
                  </button>
                )}

                <div className="my-1 border-t border-gray-100 dark:border-[#333333]" />

                {/* Delete Option */}
                <button
                  type="button"
                  onClick={() => handleOpenDeleteDialog(item)}
                  className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 flex items-center gap-2 font-medium cursor-pointer transition-colors group"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                    e.currentTarget.style.color = '#ffffff';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '';
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ────── DESTRUCTIVE DELETE DIALOG WITH COUNTDOWN TIMER ────── */}
      {deletingBroadcastItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-fadeIn font-sans">
            <div className="flex items-start gap-3.5">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Delete Broadcast Confirmation
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-gray-900 dark:text-white font-bold">{deletingBroadcastItem.title}</strong>? This will remove the campaign and its recorded analytics permanently.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeletingBroadcastItem(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#282828] dark:hover:bg-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteCountdown > 0}
                onClick={handleConfirmDelete}
                style={{
                  backgroundColor: deleteCountdown > 0 ? "rgba(220, 38, 38, 0.2)" : "#dc2626",
                  color: deleteCountdown > 0 ? "rgba(248, 113, 113, 0.6)" : "#ffffff",
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                  deleteCountdown > 0
                    ? "border border-red-500/20 cursor-not-allowed"
                    : "cursor-pointer active:scale-95"
                }`}
                onMouseEnter={(e) => {
                  if (deleteCountdown === 0) e.currentTarget.style.backgroundColor = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  if (deleteCountdown === 0) e.currentTarget.style.backgroundColor = "#dc2626";
                }}
              >
                {deleteCountdown > 0 ? `Delete in (${deleteCountdown}s)` : "Delete Broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── SLIDE-OVER ANALYTICS RIGHT DRAWER ────── */}
      <BroadcastAnalyticsDrawer
        broadcast={selectedBroadcast}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onToggleStatus={handleToggleStatus}
        onArchive={handleArchive}
        onRebroadcast={handleRebroadcast}
        onRefresh={() => fetchBroadcasts(false)}
        onEdit={(item) => {
          handleCloseDrawer();
          router.push(`/admin/broadcast/editor?id=${item.id}`);
        }}
        onDelete={handleOpenDeleteDialog}
      />
    </div>
  );
}
