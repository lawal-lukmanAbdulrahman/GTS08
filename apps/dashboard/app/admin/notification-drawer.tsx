"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { apiCall } from "../lib/staff-api";
import type { LiveCounts, NotificationItem } from "./live-status";
import { buildNotifications } from "./live-status";

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read?: boolean;
  created_at: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summaryCounts?: LiveCounts;
  unreadInquiries?: number;
  onRefreshParent?: () => void;
}

type FilterTab = "all" | "tasks" | "messages" | "activity" | "unread";

function formatRelativeTime(dateStr: string): string {
  try {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return "";
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  summaryCounts,
  unreadInquiries = 0,
  onRefreshParent,
}: NotificationDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [storedNotifications, setStoredNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch full list of stored notifications
  const fetchStoredNotifications = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await apiCall<{ data?: StoredNotification[] }>("/notifications?limit=50");
      if (res.ok && res.data) {
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any).data)
          ? (res.data as any).data
          : [];
        setStoredNotifications(list);
        setLastUpdated(new Date());
      } else {
        // Fallback or non-fatal
        setError("Could not refresh notifications. Displaying cached events.");
      }
    } catch {
      setError("Network connection interrupted. Retrying in background.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStoredNotifications(storedNotifications.length === 0);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);

      // Resilient background polling while drawer is open every 12 seconds
      const pollTimer = setInterval(() => {
        fetchStoredNotifications(false);
      }, 12000);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
        clearInterval(pollTimer);
      };
    }
  }, [isOpen]);

  // Operational task items derived from live summary counts
  const liveTasks: NotificationItem[] = useMemo(() => {
    if (!summaryCounts) return [];
    return buildNotifications(summaryCounts, unreadInquiries);
  }, [summaryCounts, unreadInquiries]);

  // Mark all stored notifications as read
  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiCall("/notifications/read-all", { method: "PUT" });
      setStoredNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onRefreshParent?.();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Mark single notification as read
  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Optimistic update
      setStoredNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      await apiCall(`/notifications/${id}/read`, { method: "PUT" });
      onRefreshParent?.();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // Filter calculations
  const unreadStored = storedNotifications.filter((n) => !n.is_read);
  const totalUnreadCount = liveTasks.reduce((acc, t) => acc + t.count, 0) + unreadStored.length;

  const filteredStored = useMemo(() => {
    switch (activeTab) {
      case "unread":
        return storedNotifications.filter((n) => !n.is_read);
      case "tasks":
        return [];
      case "messages":
        return storedNotifications.filter((n) => n.type === "inquiry" || n.type === "message");
      case "activity":
        return storedNotifications.filter((n) => n.type !== "inquiry" && n.type !== "message");
      case "all":
      default:
        return storedNotifications;
    }
  }, [activeTab, storedNotifications]);

  const shouldShowLiveTasks = activeTab === "all" || activeTab === "tasks" || (activeTab === "unread" && liveTasks.length > 0);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Drawer Slide-over Panel */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#151515] h-full shadow-2xl flex flex-col z-10 border-l border-gray-200 dark:border-[#262626] animate-in slide-in-from-right duration-250 ease-out"
        role="dialog"
        aria-label="Notification center"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-[#242424] flex items-center justify-between shrink-0 bg-white dark:bg-[#151515]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#252525] text-[#010101] dark:text-white flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#010101] dark:text-white">
                  Notifications & Activity
                </h2>
                {totalUnreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-[#EDCF5D] text-[#010101]">
                    {totalUnreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live operational stream · Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fetchStoredNotifications(false)}
              disabled={isRefreshing}
              title="Refresh notifications"
              className="p-2 rounded-lg text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#EDCF5D]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center px-4 sm:px-5 border-b border-gray-100 dark:border-[#242424] bg-gray-50/50 dark:bg-[#1A1A1A] gap-2 overflow-x-auto py-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#010101] text-white dark:bg-white dark:text-[#010101]"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "tasks"
                ? "bg-[#010101] text-white dark:bg-white dark:text-[#010101]"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525]"
            }`}
          >
            Tasks
            {liveTasks.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "tasks" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}>
                {liveTasks.reduce((s, t) => s + t.count, 0)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "messages"
                ? "bg-[#010101] text-white dark:bg-white dark:text-[#010101]"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525]"
            }`}
          >
            Messages
            {unreadInquiries > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "messages" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}>
                {unreadInquiries}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "activity"
                ? "bg-[#010101] text-white dark:bg-white dark:text-[#010101]"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525]"
            }`}
          >
            Activity Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "bg-[#010101] text-white dark:bg-white dark:text-[#010101]"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525]"
            }`}
          >
            Unread
            {unreadStored.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "unread" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}>
                {unreadStored.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Alert Banner if error occurred */}
        {error && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between border-b border-amber-200 dark:border-amber-900/50">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchStoredNotifications(false)}
              className="font-bold underline cursor-pointer ml-2 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Scrollable Notifications Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* 1. URGENT OPERATIONAL ACTION ITEMS */}
          {shouldShowLiveTasks && liveTasks.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono">
                  Immediate Attention Required
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {liveTasks.length} active {liveTasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>

              <div className="space-y-2">
                {liveTasks.map((task) => (
                  <Link
                    key={task.key}
                    href={task.href}
                    onClick={onClose}
                    className="p-3.5 rounded-xl border border-gray-200/90 dark:border-[#282828] bg-white dark:bg-[#1C1C1C] hover:border-black dark:hover:border-white/50 transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 flex items-center justify-center shrink-0">
                        {task.key === "ship" ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75m0 3.75h3.75" />
                          </svg>
                        ) : task.key === "whatsapp" ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : task.key === "low" ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        ) : task.key === "inquiries" ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.074-.75 6.47 6.47 0 001.378-3.003A7.472 7.472 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#010101] dark:text-white truncate group-hover:text-[#8D730C] dark:group-hover:text-[#EDCF5D] transition-colors">
                          {task.title}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {task.hint}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#252525] text-xs font-black font-mono flex items-center justify-center text-gray-700 dark:text-gray-200">
                        {task.count}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 2. ACTIVITY & NOTIFICATIONS LOGS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono">
                {activeTab === "unread" ? "Unread Notifications" : "Notifications Stream"}
              </span>

              {unreadStored.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white underline cursor-pointer disabled:opacity-50"
                >
                  {markingAll ? "Marking..." : "Mark all as read"}
                </button>
              )}
            </div>

            {loading && storedNotifications.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-400">Loading notifications...</p>
              </div>
            ) : filteredStored.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-gray-200 dark:border-[#282828] rounded-2xl space-y-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#222] text-gray-400 flex items-center justify-center mx-auto">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {activeTab === "unread" ? "No unread notifications" : "All caught up"}
                </div>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                  There are no notifications in this filter right now. New events will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStored.map((n) => {
                  const isUnread = !n.is_read;
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isUnread
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40"
                          : "bg-white dark:bg-[#1A1A1A] border-gray-200/80 dark:border-[#252525]"
                      }`}
                    >
                      <Link
                        href={n.link || "/admin"}
                        onClick={onClose}
                        className="flex-1 min-w-0 flex items-start gap-3 group"
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          isUnread ? "bg-amber-500" : "bg-transparent"
                        }`} />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-xs font-bold text-[#010101] dark:text-white group-hover:text-[#8D730C] dark:group-hover:text-[#EDCF5D] transition-colors">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono pt-0.5">
                            {formatRelativeTime(n.created_at)}
                          </div>
                        </div>
                      </Link>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkSingleRead(n.id, e)}
                          title="Mark as read"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-gray-100 dark:border-[#242424] bg-gray-50/50 dark:bg-[#151515] flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>Real-time admin sync active</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#010101] text-white dark:bg-white dark:text-[#010101] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
