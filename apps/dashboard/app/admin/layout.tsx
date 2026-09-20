"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState, useCallback } from "react";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { isAdminInquiryUnread } from "../../lib/notifications";
import { authFetch } from "../lib/session";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ full_name?: string; email?: string; role?: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { isCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  useEffect(() => {
    // Read saved theme preference (default to light)
    const savedTheme = (localStorage.getItem("gts_theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const savedUser = localStorage.getItem("gts_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    }
  }, []);

  const [inquiriesBadge, setInquiriesBadge] = useState<number>(0);

  // Poll for unreplied customer inquiries and listen for immediate read events
  useEffect(() => {
    const fetchInquiryCount = async () => {
      try {
        const res = await authFetch("/api/v1/inquiries?all=true");
        if (res.ok) {
          const json = await res.json();
          const pending = (json.data || []).filter(
            (t: any) => isAdminInquiryUnread(t)
          );
          setInquiriesBadge(pending.length);
        }
      } catch {
        // silent
      }
    };

    fetchInquiryCount();
    const interval = setInterval(fetchInquiryCount, 8000);

    const handleInquiryRead = () => {
      fetchInquiryCount();
    };
    window.addEventListener("gts_inquiry_read", handleInquiryRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener("gts_inquiry_read", handleInquiryRead);
    };
  }, [pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("gts_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = () => {
    document.cookie = "gts_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "gts_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem("gts_user");
    localStorage.removeItem("gts_token");
    router.push("/login");
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin",
      exact: true,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
        </svg>
      ),
    },
    {
      name: "Products Catalog",
      href: "/admin/products",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      name: "Inventory Control",
      href: "/admin/inventory",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    },
    {
      name: "Orders & Shipping",
      href: "/admin/orders",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0c-.565.058-.987.538-.987 1.106v.958m12 0A2.25 2.25 0 0116.5 9.75v5.25m-12 0V9.75A2.25 2.25 0 016.75 7.5h7.5" />
        </svg>
      ),
    },
    {
      name: "Customer Inquiries",
      href: "/admin/questions",
      exact: false,
      badge: inquiriesBadge > 0 ? inquiriesBadge : null,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.874-1.006l.732-1.755A7.838 7.838 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      name: "Broadcast & Popups",
      href: "/admin/broadcast",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.213m3.095-9.18c.253-.962.584-1.892.985-2.783.247-.55.06-1.21-.463-1.511l-.657-.38c-.551-.318-1.26-.117-1.527.461a20.845 20.845 0 00-1.44 4.213m3.095 9.18a44.697 44.697 0 000-9.18m0 9.18c2.09.282 4.148.74 6.143 1.353a.75.75 0 00.957-.72V7.747a.75.75 0 00-.957-.72 45.419 45.419 0 00-6.143 1.353m11.25 1.5a.75.75 0 010 1.5h-1.5a.75.75 0 010-1.5h1.5zm0 3a.75.75 0 010 1.5h-1.5a.75.75 0 010-1.5h1.5z" />
        </svg>
      ),
    },
    {
      name: "Storefront Editor",
      href: "/admin/storefront",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      name: "Staff & Roles",
      href: "/admin/staff",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      name: "Product Flags",
      href: "/admin/flags",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5h13.5l-2.25 4.5 2.25 4.5H3" />
        </svg>
      ),
    },
    {
      name: "Store Details",
      href: "/admin/settings",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: "POS Terminal",
      href: "/pos",
      exact: false,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
  ];

  const recentActions = [
    {
      name: "Added Product",
      time: "2m ago",
      href: "/admin/products",
      icon: (
        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    },
    {
      name: "Adjusted Stock (+50)",
      time: "15m ago",
      href: "/admin/inventory",
      icon: (
        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m13.254-4.636a8.25 8.25 0 00-13.99-3.754l-2.222 2.22m13.254 9.176l-2.22 2.22a8.25 8.25 0 01-13.99-3.754" />
        </svg>
      ),
    },
    {
      name: "Updated Order #1004",
      time: "1h ago",
      href: "/admin/orders",
      icon: (
        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0c-.565.058-.987.538-.987 1.106v.958m12 0A2.25 2.25 0 0116.5 9.75v5.25m-12 0V9.75A2.25 2.25 0 016.75 7.5h7.5" />
        </svg>
      ),
    },
    {
      name: "Issued POS Receipt",
      time: "3h ago",
      href: "/pos",
      icon: (
        <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18m3-12v.75m0 3v.75m0 3v.75m0 3V18M4.5 4.5h15a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 014.5 4.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-[#F8F7F4] dark:bg-[#1C1C1C] text-[#010101] dark:text-[#FFFFFF] font-sans antialiased selection:bg-[#EDCF5D] selection:text-[#010101]">
      
      {/* ────── MOBILE TOP BAR (Visible on < lg screens) ────── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[#151515] border-b border-gray-200 dark:border-[#262626] shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 -ml-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer relative"
            title="Open Menu"
            aria-label="Open Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            {inquiriesBadge > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151515] animate-pulse" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#010101] text-[#EDCF5D] dark:bg-[#EDCF5D] dark:text-[#121316] flex items-center justify-center font-black text-xs shadow-xs">
              G
            </div>
            <span className="font-bold text-sm text-[#010101] dark:text-white tracking-tight">
              GTS Admin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            className="p-1.5 rounded-[6px] text-gray-400 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#292929] transition-all cursor-pointer"
          >
            {theme === "light" ? (
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.966-8.966h-2.25m-13.5 0H3m15.364 6.364l-1.591-1.591M6.759 6.759L5.168 5.168m12.728 0l-1.591 1.591M6.759 17.241l-1.591 1.591M12 15a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            )}
          </button>

          <div className="w-7 h-7 rounded-full bg-[#010101] text-white dark:bg-[#EDCF5D]/20 dark:text-[#EDCF5D] flex items-center justify-center font-bold text-xs border border-gray-300 dark:border-[#EDCF5D]/30">
            {user?.full_name?.charAt(0) || "A"}
          </div>
        </div>
      </header>

      {/* ────── DESKTOP PINNED / TOTALLY COLLAPSIBLE SIDEBAR ────── */}
      <aside
        className={`hidden lg:flex flex-col justify-between shrink-0 select-none bg-white dark:bg-[#151515] border-r border-gray-200 dark:border-[#262626] transition-all duration-300 ease-in-out ${
          isCollapsed
            ? "w-0 min-w-0 max-w-0 opacity-0 -translate-x-full overflow-hidden border-r-0 pointer-events-none"
            : "w-64 opacity-100 translate-x-0"
        }`}
      >
        {/* 1. TOP HEADER: Logo & Theme Toggle (Perfect matching height h-7 with top padding pt-3.5) */}
        <div className="shrink-0 px-3.5 pt-3.5 pb-2.5 space-y-3">
          <div className="flex items-center justify-between px-1 h-7">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-[6px] bg-[#010101] text-[#EDCF5D] dark:bg-[#EDCF5D] dark:text-[#121316] flex items-center justify-center font-black text-xs shadow-xs shrink-0 aspect-square">
                G
              </div>
              <span className="font-bold text-sm text-[#010101] dark:text-white tracking-tight truncate">
                GTS Admin
              </span>
            </div>

            {/* Icon Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              aria-label={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              className="p-1.5 rounded-[6px] text-gray-400 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#292929] transition-all cursor-pointer h-7 w-7 flex items-center justify-center shrink-0"
            >
              {theme === "light" ? (
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.966-8.966h-2.25m-13.5 0H3m15.364 6.364l-1.591-1.591M6.759 6.759L5.168 5.168m12.728 0l-1.591 1.591M6.759 17.241l-1.591 1.591M12 15a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="flex items-center justify-between w-full bg-gray-100 dark:bg-[#292929] border-none rounded-[6px] px-3 py-2 text-xs text-[#010101] dark:text-white">
              <div className="flex items-center gap-2.5">
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <span className="text-gray-400 dark:text-[#6B7280] font-medium">Search</span>
              </div>
              <span className="text-[11px] font-mono text-gray-400 dark:text-[#9CA3AF]">
                ⌘ K
              </span>
            </div>
          </div>

          {/* Inset Divider */}
          <div className="mx-1 pt-1 border-b border-gray-100 dark:border-[#262626]" />
        </div>

        {/* 2. MIDDLE SCROLLABLE NAVIGATION CONTENT */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {/* Navigation Section */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-mono text-gray-400 dark:text-[#6B7280] tracking-wider uppercase mb-1.5">
              Navigation
            </p>

            {navItems.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-2.5 py-2.5 rounded-[6px] text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#010101] text-white dark:bg-[#2B2B2B] dark:text-white border-none shadow-2xs font-bold"
                      : "text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#242424]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.icon}
                    <span className="truncate">{item.name}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full shrink-0 shadow-2xs transition-all ${
                        isActive
                          ? "bg-[#EDCF5D] text-[#010101]"
                          : "bg-rose-500 text-white dark:bg-rose-500 dark:text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* Inset Divider */}
          <div className="mx-2 border-t border-gray-100 dark:border-[#262626] my-1" />

          {/* Section: Recent Actions */}
          <div className="space-y-1.5">
            <p className="px-2 text-[10px] font-mono text-gray-400 dark:text-[#6B7280] tracking-wider uppercase">
              Recent Actions
            </p>

            {recentActions.map((action, idx) => (
              <Link
                key={idx}
                href={action.href}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#242424] transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {action.icon}
                  <span className="font-medium text-[#010101] dark:text-white truncate">
                    {action.name}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-gray-400 dark:text-[#6B7280] shrink-0">
                  {action.time}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 3. PINNED BOTTOM USER PROFILE CARD */}
        <div className="shrink-0 p-2.5 bg-white dark:bg-[#151515]">
          {/* Inset Divider above user card */}
          <div className="mx-1 mb-2.5 border-t border-gray-200 dark:border-[#262626]" />
          <div className="p-2.5 rounded-[8px] bg-gray-50 dark:bg-[#2B2B2B] hover:bg-gray-100 dark:hover:bg-[#333333] border-none flex items-center justify-between transition-all group">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#010101] text-white dark:bg-[#EDCF5D]/20 dark:text-[#EDCF5D] flex items-center justify-center font-bold text-xs shrink-0 border border-gray-300 dark:border-[#EDCF5D]/30">
                {user?.full_name?.charAt(0) || "A"}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[#010101] dark:text-white truncate">
                  {user?.full_name || "Admin Staff"}
                </p>
                <p className="text-[9px] text-gray-500 dark:text-[#9CA3AF] uppercase font-mono">
                  {user?.role || "admin"}
                </p>
              </div>
            </div>

            {/* Vector Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-[6px] text-gray-400 hover:text-red-600 dark:text-[#8E9299] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ────── MOBILE SLIDE-OVER DRAWER (Visible when mobileOpen === true) ────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden font-sans">
          {/* Backdrop overlay */}
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#151515] shadow-2xl flex flex-col justify-between z-50 border-r border-gray-200 dark:border-[#262626] transition-transform duration-300">
            {/* Top Header with Close Button */}
            <div className="shrink-0 p-3.5 border-b border-gray-100 dark:border-[#262626]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-[6px] bg-[#010101] text-[#EDCF5D] dark:bg-[#EDCF5D] dark:text-[#121316] flex items-center justify-center font-black text-xs shadow-xs">
                    G
                  </div>
                  <span className="font-bold text-base text-[#010101] dark:text-white tracking-tight">
                    GTS Admin
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleTheme}
                    title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                    className="p-1.5 rounded-[6px] text-gray-400 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#292929] transition-all cursor-pointer"
                  >
                    {theme === "light" ? (
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.966-8.966h-2.25m-13.5 0H3m15.364 6.364l-1.591-1.591M6.759 6.759L5.168 5.168m12.728 0l-1.591 1.591M6.759 17.241l-1.591 1.591M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                    title="Close Menu"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-mono text-gray-400 dark:text-[#6B7280] tracking-wider uppercase mb-1.5">
                  Navigation
                </p>
                {navItems.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-[#010101] text-white dark:bg-[#2B2B2B] dark:text-white shadow-2xs font-bold"
                          : "text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#242424]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.icon}
                        <span>{item.name}</span>
                      </div>

                      {item.badge ? (
                        <span
                          className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full shrink-0 shadow-2xs transition-all ${
                            isActive
                              ? "bg-[#EDCF5D] text-[#010101]"
                              : "bg-rose-500 text-white dark:bg-rose-500 dark:text-white"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              {/* Section: Recent Actions in Drawer */}
              <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-[#262626]">
                <p className="px-2 text-[10px] font-mono text-gray-400 dark:text-[#6B7280] tracking-wider uppercase">
                  Recent Actions
                </p>
                {recentActions.map((action, idx) => (
                  <Link
                    key={idx}
                    href={action.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#242424] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {action.icon}
                      <span className="font-medium text-[#010101] dark:text-white truncate">
                        {action.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 dark:text-[#6B7280] shrink-0">
                      {action.time}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom Profile in Drawer */}
            <div className="shrink-0 p-3 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#181818]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#010101] text-white dark:bg-[#EDCF5D]/20 dark:text-[#EDCF5D] flex items-center justify-center font-bold text-xs shrink-0 border border-gray-300 dark:border-[#EDCF5D]/30">
                    {user?.full_name?.charAt(0) || "A"}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-[#010101] dark:text-white truncate">
                      {user?.full_name || "Admin Staff"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF] uppercase font-mono">
                      {user?.role || "admin"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:text-[#8E9299] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────── MAIN CONTENT AREA ────── */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        {/* Main Page Scroll Canvas */}
        <main className="flex-1 h-full overflow-y-auto bg-[#F8F7F4] dark:bg-[#1C1C1C] transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  );
}
