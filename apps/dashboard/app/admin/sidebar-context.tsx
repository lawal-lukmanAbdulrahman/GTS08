"use client";

import Link from "next/link";
import { NotificationBell, OnShiftAvatars } from "./live-status";
import React, { createContext, useContext, useEffect, useState } from "react";

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

        <NotificationBell />

        {/* Staff on shift right now */}
        <OnShiftAvatars />
      </div>
    </div>
  );
}
