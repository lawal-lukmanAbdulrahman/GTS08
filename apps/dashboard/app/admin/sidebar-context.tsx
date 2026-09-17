"use client";

import Link from "next/link";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setMobileOpen: (open: boolean) => void;
  mobileOpen: boolean;
}

export const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleCollapse: () => {},
  setMobileOpen: () => {},
  mobileOpen: false,
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    // Read saved sidebar collapse preference
    const savedCollapsed = localStorage.getItem("gts_sidebar_collapsed");
    if (savedCollapsed === "true") {
      setIsCollapsed(true);
    }
  }, []);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("gts_sidebar_collapsed", nextState ? "true" : "false");
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapse,
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function SidebarToggle({ className = "" }: { className?: string }) {
  const { isCollapsed, toggleCollapse } = useSidebar();
  return (
    <button
      onClick={toggleCollapse}
      title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
      aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      className={`p-1.5 rounded-[6px] text-gray-400 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-[#292929] transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {isCollapsed ? (
        /* Expand icon (Panel with right arrow) */
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <rect width="18" height="18" x="3" y="3" rx="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 9l3 3-3 3" />
        </svg>
      ) : (
        /* Collapse icon (Panel with left chevron inside) */
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <rect width="18" height="18" x="3" y="3" rx="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 9l-3 3 3 3" />
        </svg>
      )}
    </button>
  );
}

export function AdminTopStrip({
  breadcrumbs,
  rightActions,
}: {
  breadcrumbs: { label: string; href?: string }[];
  rightActions?: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };

    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notifOpen]);

  return (
    <div className="flex items-center justify-between gap-3 text-xs border-b border-gray-200/50 dark:border-[#262626]/50 pb-2.5 h-7 relative">
      {/* Left: Collapse Toggle + Clean Breadcrumbs */}
      <div className="flex items-center gap-2">
        <SidebarToggle className="-ml-1" />
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#8E8E8E]" aria-label="Breadcrumb">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <svg className="w-3 h-3 text-gray-300 dark:text-[#444444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
                {isLast || !item.href ? (
                  <span className={`font-semibold ${isLast ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-[#8E8E8E]"}`}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="text-gray-500 hover:text-gray-900 dark:text-[#8E8E8E] dark:hover:text-white transition-colors">
                    {item.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Custom actions + Notifications Button with Dropdown + Live Employee Circles */}
      <div className="flex items-center gap-2">
        {rightActions}

        {/* Notifications Bell with Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            title="Today's Priorities & Notifications"
            aria-label="Today's Priorities & Notifications"
            className="p-1.5 rounded-[6px] text-gray-500 hover:text-[#010101] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#292929] transition-all cursor-pointer relative flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EDCF5D] text-[#010101] font-mono text-[9px] font-black flex items-center justify-center shadow-xs ring-1.5 ring-white dark:ring-[#1C1C1C]">
              4
            </span>
          </button>

          {/* Things To Do Today Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-[8px] bg-white dark:bg-[#151515] border border-gray-200 dark:border-[#262626] shadow-2xl overflow-hidden z-50 font-sans transition-all">
              <div className="flex items-center justify-between p-3.5 border-b border-gray-100 dark:border-[#262626]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="text-xs font-bold text-[#010101] dark:text-white uppercase tracking-wider font-mono">
                    Things To Do Today
                  </h3>
                </div>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs cursor-pointer p-0.5"
                >
                  ✕
                </button>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-[#242424]">
                {/* Item 1: Ready to ship */}
                <Link
                  href="/admin/orders"
                  onClick={() => setNotifOpen(false)}
                  className="py-3 px-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1F1F1F] rounded-none transition-colors group relative bg-[#EDCF5D]/10 dark:bg-[#EDCF5D]/15"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-red-500/15 text-red-500 ring-1 ring-red-500/30 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#010101] dark:text-white">3 Orders Ready to Ship</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">Waiting for package pickup</p>
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280] group-hover:text-[#010101] dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>

                {/* Item 2: Running Low */}
                <Link
                  href="/admin/inventory"
                  onClick={() => setNotifOpen(false)}
                  className="py-3 px-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1F1F1F] rounded-none transition-colors group relative bg-[#EDCF5D]/15 dark:bg-[#EDCF5D]/20 border-l-2 border-[#EDCF5D]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-red-500/15 text-red-500 ring-1 ring-red-500/30 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#010101] dark:text-white">2 Items Running Low</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">Needs restock soon</p>
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280] group-hover:text-[#010101] dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>

                {/* Item 3: Cash Register Balanced */}
                <div className="py-3 px-3.5 flex items-center justify-between rounded-none">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v9.75a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5zm13.5 3h.008v.008h-.008V7.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#010101] dark:text-white">Cash Register Balanced</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">No missing cash today</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-500">✓ Perfect</span>
                </div>

                {/* Item 4: Customer Message */}
                <div className="py-3 px-3.5 flex items-center justify-between rounded-none">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.074-.85 5.978 5.978 0 011.411-2.544C4.305 16.14 3 14.195 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#010101] dark:text-white">1 Customer Message</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">Waiting &gt;1 day for reply</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">Needs reply</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Overlapping Live Employee Avatars (Circles only) */}
        <div className="flex items-center -space-x-1.5 overflow-hidden pl-0.5">
          <div className="inline-flex h-6 w-6 rounded-full bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] ring-2 ring-white dark:ring-[#1C1C1C] items-center justify-center font-black text-[10px] shadow-xs" title="Admin Account">
            A
          </div>
          <div className="inline-flex h-6 w-6 rounded-full bg-blue-600 text-white ring-2 ring-white dark:ring-[#1C1C1C] items-center justify-center font-black text-[10px] shadow-xs" title="Cashier Staff">
            C
          </div>
          <div className="inline-flex h-6 w-6 rounded-full bg-emerald-600 text-white ring-2 ring-white dark:ring-[#1C1C1C] items-center justify-center font-black text-[10px] shadow-xs" title="Inventory Manager">
            I
          </div>
        </div>
      </div>
    </div>
  );
}
