"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthModal } from "../auth-modal-context";
import { useAuth } from "../auth-context";
import { useCart } from "../cart-context";
import { useWishlist } from "../wishlist-context";
import { createClient } from "@gts/database/client";
import {
  getCustomerInboxSeenAt,
  getCustomerNotifications,
  getCustomerDeletedNotifIds,
} from "../../../../lib/notifications";
import CustomerPromosModal, { type CustomerPromoItem } from "./customer-promos-modal";

export function UserAccountMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const { user, customer, signOut } = useAuth();
  const { totalItemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const menuRef = useRef<HTMLDivElement>(null);

  const [customerPromos, setCustomerPromos] = useState<CustomerPromoItem[]>([]);
  const [showPromosModal, setShowPromosModal] = useState(false);

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch available promo codes for badge and modal
  useEffect(() => {
    const custId = customer?.id || "";
    const userId = user?.id || "";
    const query = new URLSearchParams();
    if (custId) query.set("customerId", custId);
    if (userId) query.set("userId", userId);
    const custQuery = query.toString() ? `?${query.toString()}` : "";
    const token = typeof window !== "undefined" ? localStorage.getItem("gts_customer_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`/api/v1/promos/available${custQuery}`, { headers, credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data)) {
          setCustomerPromos(json.data);
        }
      })
      .catch(() => {});
  }, [customer?.id, user?.id]);

  // ── Realtime Unread Notification Watcher via WebSockets & Local Cache ──
  useEffect(() => {
    const userId = user?.id;
    const customerId = customer?.id;
    const activeKey = userId || customerId;

    if (!activeKey) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;

    const checkUnread = async () => {
      try {
        const seenAt = getCustomerInboxSeenAt();
        const deletedIds = getCustomerDeletedNotifIds(activeKey);
        let count = 0;

        // 1. Database customer notifications (account notices, disabled, reinstated, enabled, etc.)
        try {
          const res = await fetch("/api/v1/notifications/customer");
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data)) {
              const unreadDbNotifs = json.data.filter(
                (n: any) => !n.is_read && !deletedIds.includes(n.id)
              );
              count += unreadDbNotifs.length;
            }
          }
        } catch {}

        // 2. Inquiries from API (tickets replied by staff)
        try {
          const res = await fetch("/api/v1/inquiries");
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data)) {
              const unreadInquiries = json.data.filter((item: any) => {
                if (item.lastSenderType !== "staff") return false;
                if (!seenAt) return true;
                return new Date(item.lastMessageAt).getTime() > new Date(seenAt).getTime();
              });
              count += unreadInquiries.length;
            }
          }
        } catch {}

        // 3. Saved customer notifications (order phase updates, etc.)
        try {
          const notifs = getCustomerNotifications(activeKey);
          const unreadLocal = notifs.filter((n) => {
            if (deletedIds.includes(n.id)) return false;
            if (n.isRead) return false;
            if (!seenAt) return true;
            return new Date(n.createdAt).getTime() > new Date(seenAt).getTime();
          });
          count += unreadLocal.length;
        } catch {}

        if (isMounted) {
          setUnreadCount(count);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("gts_unread_count_changed", { detail: { count } })
            );
          }
        }
      } catch (err) {
        console.error("Failed to check unread notifications:", err);
      }
    };

    checkUnread();

    // ── Supabase Realtime WebSocket Watcher ──
    const supabase = createClient() as any;
    const channelName = `user_nav_notifs_${activeKey}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_notifications",
        },
        () => {
          checkUnread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_messages",
        },
        () => {
          checkUnread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        () => {
          checkUnread();
        }
      )
      .on("broadcast", { event: "new_message" }, () => {
        checkUnread();
      })
      .on("broadcast", { event: "new_inquiry_message" }, () => {
        checkUnread();
      })
      .on("broadcast", { event: "order_status_updated" }, () => {
        checkUnread();
      })
      .on("broadcast", { event: "account_status_changed" }, () => {
        checkUnread();
      })
      .subscribe();

    const handleLocalUpdate = () => {
      checkUnread();
    };

    window.addEventListener("gts_notifications_updated", handleLocalUpdate);
    window.addEventListener("gts_notification_received", handleLocalUpdate);
    window.addEventListener("gts_inbox_read", handleLocalUpdate);
    window.addEventListener("gts_inquiry_read", handleLocalUpdate);

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
      window.removeEventListener("gts_notifications_updated", handleLocalUpdate);
      window.removeEventListener("gts_notification_received", handleLocalUpdate);
      window.removeEventListener("gts_inbox_read", handleLocalUpdate);
      window.removeEventListener("gts_inquiry_read", handleLocalUpdate);
    };
  }, [user?.id, customer?.id]);

  const isDemo =
    typeof window !== "undefined" &&
    (localStorage.getItem("gts_demo_mode") === "true" ||
      document.cookie.includes("gts_demo_mode=true") ||
      Boolean((user as any)?.is_demo));

  const resolvedFullName =
    customer?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim() ||
    (user?.user_metadata?.name as string)?.trim() ||
    (user as any)?.full_name?.trim() ||
    "";

  const displayName = resolvedFullName
    ? `Hi, ${resolvedFullName.split(" ")[0]}`
    : user?.email
    ? `Hi, ${user.email.split("@")[0]}`
    : isDemo
    ? "Hi, Demo"
    : "Welcome shopper";

  return (
    <div ref={menuRef} className="relative inline-block">
      {/* Clickable Trigger Pill */}
      <button
        onClick={toggleMenu}
        aria-expanded={isOpen}
        className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 sm:pr-3.5 h-9 sm:h-[38px] rounded-full bg-transparent hover:bg-[#F2F0EA] transition-colors cursor-pointer group text-[#010101] select-none shrink-0 relative"
      >
        {/* Unread Notifications Badge on Pill (Top-Left) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 z-20 flex items-center justify-center pointer-events-none">
            <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-rose-400 opacity-60" />
            <span className="relative flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[9.5px] font-black border-2 border-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}

        {/* Circle with User Icon anchored to left */}
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F2F0EA] group-hover:bg-[#EDCF5D] flex items-center justify-center text-[#010101] shrink-0 shadow-2xs transition-colors">
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#010101]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>

        {/* Text & Chevron */}
        <span className="text-xs sm:text-sm font-semibold text-[#010101] tracking-tight whitespace-nowrap max-w-[130px] truncate">
          {displayName}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#010101]" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-2 z-50 text-[#010101]"
          >
            <div className="space-y-0.5">
              {/* My Account */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (user) {
                    router.push("/account");
                  } else {
                    openAuthModal("login");
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>My Account</span>
              </button>

              {/* Orders */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (user) {
                    router.push("/account?tab=orders");
                  } else {
                    openAuthModal("login");
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Orders</span>
              </button>

              {/* Inbox / Updates */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (user) {
                    router.push("/account?tab=inbox");
                  } else {
                    openAuthModal("login");
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span>Inbox</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full font-sans shadow-2xs min-w-[20px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Wishlist */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/wishlist");
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  <span>Wishlist</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* Cart */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/cart");
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>My Cart</span>
                </div>
                {totalItemCount > 0 && (
                  <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                    {totalItemCount}
                  </span>
                )}
              </button>

              {/* My Promo Codes */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/account?tab=promos");
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                  <span>My Promo Codes</span>
                </div>
                {customerPromos.length > 0 && (
                  <span className="bg-[#010101] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-sans">
                    {customerPromos.length}
                  </span>
                )}
              </button>
            </div>

            <div className="my-1.5 border-t border-gray-100" />

            {/* Bottom Button: Sign In when logged out, Sign Out when logged in */}
            {user || isDemo ? (
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  await signOut();
                  window.location.reload();
                }}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-600 font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span>{isDemo ? "Exit Demo" : "Sign out"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openAuthModal("login");
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#010101] hover:bg-[#010101]/90 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] group/btn cursor-pointer"
              >
                <span>Sign in</span>
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Available Promo Codes Modal */}
      <CustomerPromosModal
        isOpen={showPromosModal}
        onClose={() => setShowPromosModal(false)}
        promos={customerPromos}
      />
    </div>
  );
}
