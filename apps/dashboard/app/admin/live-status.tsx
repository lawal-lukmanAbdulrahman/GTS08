"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLive } from "../lib/use-live";
import { apiCall } from "../lib/staff-api";
import { isAdminInquiryUnread } from "../../lib/notifications";

export interface LiveCounts {
  orders_to_ship: number;
  whatsapp_waiting: number;
  open_flags: number;
  low_stock: number;
}

interface OnShift {
  id: string;
  full_name: string | null;
  role: string;
  last_action: string;
  last_seen: string;
}

interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  created_at: string;
}

interface LiveSummary {
  counts: LiveCounts;
  active_staff: OnShift[];
  notifications?: { unread: number; latest: StoredNotification[] };
}

export interface NotificationItem {
  key: string;
  count: number;
  title: string;
  hint: string;
  href: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What needs doing, from real numbers: an item only appears while its count is above zero. */
export function buildNotifications(counts: LiveCounts, unreadInquiries: number): NotificationItem[] {
  const all: NotificationItem[] = [
    { key: "ship", count: counts.orders_to_ship, title: `${plural(counts.orders_to_ship, "order", "orders")} ready to ship`, hint: "Paid and waiting to be sent", href: "/admin/orders" },
    { key: "whatsapp", count: counts.whatsapp_waiting, title: `${plural(counts.whatsapp_waiting, "WhatsApp order", "WhatsApp orders")} waiting for payment`, hint: "Stock is held until they pay", href: "/admin/orders" },
    { key: "low", count: counts.low_stock, title: `${plural(counts.low_stock, "item", "items")} running low`, hint: "At or under the restock level", href: "/admin/inventory" },
    { key: "flags", count: counts.open_flags, title: `${plural(counts.open_flags, "product flag", "product flags")} open`, hint: "Raised by cashiers at the till", href: "/admin/flags" },
    { key: "inquiries", count: unreadInquiries, title: `${plural(unreadInquiries, "customer message", "customer messages")} waiting`, hint: "A customer is waiting for a reply", href: "/admin/questions" },
  ];
  return all.filter((i) => i.count > 0);
}

export function NotificationBell() {
  const summary = useLive<LiveSummary>("/live/summary", { intervalMs: 10_000 });
  const inquiries = useLive<Array<{ id: string; lastSenderType: string; lastMessageAt?: string }>>("/inquiries?all=true", { intervalMs: 15_000 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = (Array.isArray(inquiries.data) ? inquiries.data : []).filter((t) => isAdminInquiryUnread(t)).length;
  const items = summary.data ? buildNotifications(summary.data.counts, unread) : [];
  const stored = summary.data?.notifications;
  const total = items.reduce((sum, i) => sum + i.count, 0) + (stored?.unread ?? 0);

  async function markAllRead() {
    await apiCall("/notifications/read-all", { method: "PUT" });
    summary.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={total > 0 ? `Notifications, ${total} need attention` : "Notifications"}
        aria-expanded={open}
        className="p-1.5 rounded-[6px] text-gray-500 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#292929] transition-all cursor-pointer relative flex items-center justify-center"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {total > 0 && (
          <span data-testid="notification-badge" className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EDCF5D] text-[#010101] font-mono text-[9px] font-black flex items-center justify-center shadow-xs ring-1 ring-white dark:ring-[#1C1C1C]">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-[8px] bg-white dark:bg-[#151515] border border-gray-200 dark:border-[#262626] shadow-2xl overflow-hidden z-50 font-sans">
          <div className="flex items-center justify-between p-3.5 border-b border-gray-100 dark:border-[#262626]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${summary.error ? "bg-red-500" : "bg-emerald-500"}`} />
              <h3 className="text-xs font-bold text-[#010101] dark:text-white uppercase tracking-wider font-mono">Things to do</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs cursor-pointer p-0.5">✕</button>
          </div>
          {summary.error && <p className="px-3.5 py-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">We couldn&apos;t refresh just now. These numbers may be out of date.</p>}
          {items.length === 0 && !(stored?.latest.length) ? (
            <p className="px-3.5 py-6 text-center text-xs text-gray-500 dark:text-[#9CA3AF]">You&apos;re all caught up. Nothing needs attention right now.</p>
          ) : (
            <>
            {items.length > 0 && (
            <ul aria-label="Things to do" className="divide-y divide-gray-100 dark:divide-[#242424]">
              {items.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} onClick={() => setOpen(false)} className="py-3 px-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1F1F1F] transition-colors">
                    <span>
                      <span className="block text-xs font-bold text-[#010101] dark:text-white">{item.title}</span>
                      <span className="block text-[10px] text-gray-500 dark:text-[#9CA3AF]">{item.hint}</span>
                    </span>
                    <span aria-hidden="true" className="text-gray-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            )}
            {stored && stored.latest.length > 0 && (
              <div className="border-t border-gray-100 dark:border-[#242424]">
                <div className="flex items-center justify-between px-3.5 pt-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">New</p>
                  <button type="button" onClick={markAllRead} className="text-[11px] font-semibold underline text-gray-600 dark:text-gray-300">Mark all read</button>
                </div>
                <ul aria-label="Recent notifications" className="divide-y divide-gray-100 dark:divide-[#242424]">
                  {stored.latest.map((n) => (
                    <li key={n.id}>
                      <Link href={n.link ?? "/admin"} onClick={() => setOpen(false)} className="py-3 px-3.5 block hover:bg-gray-50 dark:hover:bg-[#1F1F1F] transition-colors">
                        <span className="block text-xs font-bold text-[#010101] dark:text-white">{n.title}</span>
                        <span className="block text-[10px] text-gray-500 dark:text-[#9CA3AF]">{n.message}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const AVATAR_COLOURS = ["bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316]", "bg-blue-600 text-white", "bg-emerald-600 text-white", "bg-violet-600 text-white"];
const MAX_AVATARS = 4;

/** Who is on shift right now: staff who've done something in the last 15 minutes and haven't signed out. */
export function OnShiftAvatars() {
  const { data } = useLive<LiveSummary>("/live/summary", { intervalMs: 10_000 });
  const staff = data?.active_staff ?? [];
  if (staff.length === 0) return null;
  const shown = staff.slice(0, MAX_AVATARS);
  const more = staff.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5 pl-0.5" aria-label={`${staff.length} on shift`}>
      {shown.map((s, i) => (
        <div
          key={s.id}
          data-testid="on-shift-avatar"
          title={`${s.full_name || "Staff member"} · ${s.role.replace("_", " ")}`}
          className={`inline-flex h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#1C1C1C] items-center justify-center font-black text-[10px] shadow-xs ${AVATAR_COLOURS[i % AVATAR_COLOURS.length]}`}
        >
          {(s.full_name || "?").trim().charAt(0).toUpperCase()}
        </div>
      ))}
      {more > 0 && (
        <div className="inline-flex h-6 min-w-6 px-1 rounded-full bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-200 ring-2 ring-white dark:ring-[#1C1C1C] items-center justify-center font-bold text-[10px]">+{more}</div>
      )}
    </div>
  );
}
