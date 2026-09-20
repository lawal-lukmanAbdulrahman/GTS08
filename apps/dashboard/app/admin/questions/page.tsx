"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@gts/database/client";
import { AdminTopStrip } from "../sidebar-context";
import { authFetch } from "../../lib/session";
import {
  getAdminViewedInquiries,
  markAdminInquiryViewed,
  isAdminInquiryUnread,
} from "../../../lib/notifications";

interface InquiryThread {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: string;
  productId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderType: "customer" | "staff";
  messageCount: number;
}

export default function AdminQuestionsPage() {
  const [inquiries, setInquiries] = useState<InquiryThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("all");
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [viewedMap, setViewedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setViewedMap(getAdminViewedInquiries());
    const handleInquiryRead = () => {
      setViewedMap(getAdminViewedInquiries());
    };
    window.addEventListener("gts_inquiry_read", handleInquiryRead);
    return () => {
      window.removeEventListener("gts_inquiry_read", handleInquiryRead);
    };
  }, []);

  // Detect scroll for sticky top border
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

  const fetchInquiries = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await authFetch("/api/v1/inquiries?all=true");
      if (res.ok) {
        const json = await res.json();
        setInquiries(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load inquiries:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();

    // Connect to Supabase Realtime WebSockets for inquiries list
    const supabase = createClient() as any;
    const channel = supabase.channel("admin_inquiries", {
      config: { broadcast: { self: false } },
    });

    const handleMessageUpdate = (ticketId: string, msg: any) => {
      setInquiries((prev) => {
        const index = prev.findIndex((item) => item.id === ticketId);
        if (index === -1 || !prev[index]) {
          // Unlisted ticket or new inquiry: fetch list silently
          fetchInquiries(false);
          return prev;
        }

        const existing = prev[index]!;
        const updatedItem: InquiryThread = {
          ...existing,
          lastMessage: msg.body || existing.lastMessage,
          lastMessageAt: msg.sentAt || msg.sent_at || new Date().toISOString(),
          lastSenderType: msg.senderType || msg.sender_type || existing.lastSenderType,
          updatedAt: msg.sentAt || msg.sent_at || new Date().toISOString(),
          messageCount: (existing.messageCount || 0) + 1,
          status:
            msg.senderType === "customer" || msg.sender_type === "customer"
              ? existing.status === "closed"
                ? "open"
                : existing.status
              : existing.status,
        };

        const remaining = prev.filter((_, i) => i !== index);
        return [updatedItem, ...remaining];
      });
    };

    // 1. Broadcast event (instant push)
    channel.on("broadcast", { event: "new_inquiry_message" }, ({ payload }: any) => {
      if (payload?.ticketId && payload?.message) {
        handleMessageUpdate(payload.ticketId, payload.message);
      }
    });

    // 2. Postgres change event on ticket_messages
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
      },
      (payload: any) => {
        const newRow = payload.new;
        if (newRow && newRow.ticket_id) {
          handleMessageUpdate(newRow.ticket_id, {
            body: newRow.body,
            sent_at: newRow.sent_at,
            sender_type: newRow.sender_type,
          });
        }
      }
    );

    // 3. Postgres change event on support_tickets (status update / new ticket)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_tickets",
      },
      (payload: any) => {
        if (payload.eventType === "INSERT") {
          fetchInquiries(false);
        } else if (payload.eventType === "UPDATE" && payload.new?.id) {
          setInquiries((prev) =>
            prev.map((item) =>
              item.id === payload.new.id
                ? { ...item, status: payload.new.status, updatedAt: payload.new.updated_at || item.updatedAt }
                : item
            )
          );
        }
      }
    );

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("[Inquiries Realtime] Connected to admin_inquiries WebSocket");
      }
    });

    // Silent background poll fallback (every 8s) in case of packet loss
    const pollInterval = setInterval(() => {
      fetchInquiries(false);
    }, 8000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered inquiries
  const filtered = useMemo(() => {
    return inquiries.filter((inq) => {
      // Status filter
      if (statusFilter !== "all" && inq.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = inq.customerName?.toLowerCase().includes(q);
        const matchesEmail = inq.customerEmail?.toLowerCase().includes(q);
        const matchesSubject = inq.subject?.toLowerCase().includes(q);
        const matchesRef = inq.reference?.toLowerCase().includes(q);
        const matchesMsg = inq.lastMessage?.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesSubject || matchesRef || matchesMsg;
      }
      return true;
    });
  }, [inquiries, statusFilter, search]);

  const openCount = inquiries.filter((i) => i.status === "open").length;
  const inProgressCount = inquiries.filter((i) => i.status === "in_progress").length;
  const resolvedCount = inquiries.filter((i) => i.status === "resolved").length;

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200">
      {/* ────── STICKY TOP PAGE HEADER (METADATA + TITLE ROW COMBINED) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2.5 lg:-mx-5 lg:-mt-3.5 lg:px-5 space-y-3 bg-[#F8F7F4]/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md transition-all duration-200 ${
          scrolled
            ? "border-b border-gray-200 dark:border-[#262626] shadow-2xs"
            : "border-b border-transparent"
        }`}
      >
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Customer Inquiries", href: "/admin/questions" },
            { label: "Inbox Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Customer Inquiries
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Manage customer discussions, sizing advice, and private product questions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchInquiries()}
              disabled={loading}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2 disabled:opacity-50"
              title="Refresh Inboxes"
            >
              <svg className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m13.254-4.636a8.25 8.25 0 00-13.99-3.754l-2.222 2.22m13.254 9.176l-2.22 2.22a8.25 8.25 0 01-13.99-3.754" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────── KPI CARDS (Matching Products Management Style) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inquiries */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("all")}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Inquiries
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {inquiries.length}
              </p>
            )}
          </div>
          <div className="relative z-10 font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
            All customer threads
          </div>
        </div>

        {/* Card 2: Needs Reply (Open) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("open")}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "open"
              ? "border-amber-500/80 ring-2 ring-amber-500/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-amber-400"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Needs Reply (Open)
              </span>
              {openCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-sans">
                {openCount}
              </p>
            )}
          </div>
          <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
            {openCount > 0 ? "Awaiting staff response" : "Inbox zero"}
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("in_progress")}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "in_progress"
              ? "border-sky-500/80 ring-2 ring-sky-500/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-sky-400"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              In Progress
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-sky-600 dark:text-sky-400 font-sans">
                {inProgressCount}
              </p>
            )}
          </div>
          <div className="relative z-10 font-mono text-xs font-medium text-sky-600 dark:text-sky-400">
            Active conversations
          </div>
        </div>

        {/* Card 4: Resolved */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setStatusFilter("resolved")}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            statusFilter === "resolved"
              ? "border-emerald-500/80 ring-2 ring-emerald-500/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-emerald-400"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Resolved
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-sans">
                {resolvedCount}
              </p>
            )}
          </div>
          <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Answered and closed
          </div>
        </div>
      </div>

      {/* ────── UNIFIED INQUIRIES TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors overflow-hidden">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Status Filter Select */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="all">All Status</option>
                <option value="open">Needs Reply (Open)</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            <span className="text-xs text-gray-400 font-mono hidden sm:inline">
              {filtered.length} {filtered.length === 1 ? "thread" : "threads"}
            </span>
          </div>

          {/* Right Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, question or product..."
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
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-400 mx-auto">
              💬
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white font-sans">
              No inquiries found
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] max-w-sm mx-auto">
              {search ? "No threads match your search query." : "When customers ask questions on the storefront Discussion tab, their private threads will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
                  <th className="pl-4 pr-2 py-3 font-semibold text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Subject / Product</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Latest Message</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Updated</th>
                  <th className="pr-4 pl-2 py-3 w-24 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                {filtered.map((thread) => {
                  const isUnread = isAdminInquiryUnread(thread, viewedMap);
                  const handleItemClick = () => {
                    markAdminInquiryViewed(thread.id, thread.lastMessageAt);
                  };

                  return (
                    <tr
                      key={thread.id}
                      className={`transition-colors cursor-pointer group ${
                        isUnread
                          ? "bg-rose-50/40 dark:bg-rose-950/15 hover:bg-rose-50/70 dark:hover:bg-rose-950/25"
                          : "hover:bg-gray-50/80 dark:hover:bg-[#222222]/60"
                      }`}
                    >
                      {/* Customer (Avatar circle + Customer Name & Email + Unread Badge) */}
                      <td className="pl-4 pr-2 py-3.5">
                        <Link
                          href={`/admin/questions/${thread.id}`}
                          onClick={handleItemClick}
                          className="flex items-center gap-3"
                        >
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-[#010101] text-white dark:bg-[#2B2B2B] flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-[#333333] shadow-2xs group-hover:scale-105 transition-transform">
                              {thread.customerName.charAt(0).toUpperCase()}
                            </div>
                            {isUnread && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#181818] animate-pulse" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-tight group-hover:text-[#EDCF5D] transition-colors truncate">
                                {thread.customerName}
                              </span>
                              {isUnread && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-2xs shrink-0 animate-fade-in font-mono">
                                  New Reply
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 dark:text-[#8E8E8E] block font-mono truncate">
                              {thread.customerEmail}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Subject / Product */}
                      <td className="px-3 py-3.5">
                        <Link href={`/admin/questions/${thread.id}`} onClick={handleItemClick} className="block">
                          <span className="font-semibold text-gray-900 dark:text-gray-200 text-xs truncate max-w-[220px] block">
                            {thread.subject}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 dark:text-[#8E8E8E]">
                            Ref: {thread.reference}
                          </span>
                        </Link>
                      </td>

                      {/* Latest Message Preview */}
                      <td className="px-3 py-3.5 max-w-xs">
                        <Link href={`/admin/questions/${thread.id}`} onClick={handleItemClick} className="block">
                          <p className="text-xs text-gray-600 dark:text-[#B0B0B0] line-clamp-1 italic">
                            <span className="font-semibold not-italic text-gray-500 dark:text-[#8E8E8E]">
                              {thread.lastSenderType === "staff" ? "Staff: " : "Customer: "}
                            </span>
                            &quot;{thread.lastMessage || "No messages yet"}&quot;
                          </p>
                        </Link>
                      </td>

                      {/* Status (Rounded Pill Badge) */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            thread.status === "open"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : thread.status === "in_progress"
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                              : thread.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {thread.status === "open"
                            ? "Needs Reply"
                            : thread.status === "in_progress"
                            ? "In Progress"
                            : thread.status === "resolved"
                            ? "Resolved"
                            : "Closed"}
                        </span>
                      </td>

                      {/* Date Updated */}
                      <td className="px-3 py-3.5 font-mono text-[11px] text-gray-500 dark:text-[#8E8E8E] whitespace-nowrap">
                        {new Date(thread.lastMessageAt || thread.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Action Button */}
                      <td className="pr-4 pl-2 py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/questions/${thread.id}`}
                          onClick={handleItemClick}
                          className="px-3 py-1.5 rounded-[6px] bg-gray-100 hover:bg-[#EDCF5D] text-gray-800 hover:text-[#010101] dark:bg-[#252525] dark:hover:bg-[#EDCF5D] dark:text-gray-200 dark:hover:text-[#010101] font-semibold text-[11px] transition-all inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span>Open</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
