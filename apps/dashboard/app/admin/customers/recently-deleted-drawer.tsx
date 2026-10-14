"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { CustomerSummary } from "./types";

interface RecentlyDeletedDrawerProps {
  isOpen: boolean;
  loading: boolean;
  deletedAccounts: CustomerSummary[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClose: () => void;
  onViewInfo: (id: string) => void;
  onReinstate: (id: string, name: string) => void;
}

export default function RecentlyDeletedDrawer({
  isOpen,
  loading,
  deletedAccounts,
  searchQuery,
  onSearchChange,
  onClose,
  onViewInfo,
  onReinstate,
}: RecentlyDeletedDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return deletedAccounts;
    const q = searchQuery.toLowerCase();
    return deletedAccounts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [deletedAccounts, searchQuery]);

  if (!isOpen || !mounted) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-[80] overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white dark:bg-[#181818] shadow-2xl border-l border-gray-200 dark:border-[#2A2A2A] flex flex-col h-full transform transition-transform duration-300 ease-out animate-in slide-in-from-right">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-[#262626] bg-[#F8F7F4]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                  Archive Repository
                </span>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Recently Deleted Accounts
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  Accounts remain redeemable for 30 days before permanent purging
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-gray-200 dark:border-[#333333] hover:bg-gray-100 dark:hover:bg-[#252525] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar at Top of Slide-Over */}
          <div className="p-4 border-b border-gray-100 dark:border-[#262626] bg-gray-50/70 dark:bg-[#141414]/60">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search recently deleted accounts..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#1F1F1F] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          {/* List of Deleted Accounts */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 [scrollbar-width:thin]">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-rose-600 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-500 font-mono">Loading archive...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <p className="font-bold text-sm text-gray-800 dark:text-white">
                  No deleted accounts found
                </p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  {searchQuery ? "No deleted accounts match your search filter." : "There are currently zero accounts in the 30-day grace period."}
                </p>
              </div>
            ) : (
              filtered.map((del) => (
                <div
                  key={del.id}
                  className="rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] p-4 space-y-3 relative shadow-2xs hover:border-gray-300 dark:hover:border-[#383838] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                        {del.fullName}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{del.email}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">ID: {del.id}</p>
                    </div>

                    {/* Days Left Pill */}
                    <span className="shrink-0 inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[10.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {del.daysRemaining ?? 30} days left
                    </span>
                  </div>

                  {/* Deletion Reason */}
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#202020] border border-gray-100 dark:border-[#2D2D2D] text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-0.5">
                      Deletion Reason:
                    </span>
                    <p className="text-gray-800 dark:text-gray-200 font-mono text-[11.5px] leading-relaxed">
                      &quot;{del.deletionReason || "No reason specified"}&quot;
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#262626] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      Deleted: {del.deletedAt ? new Date(del.deletedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : "Recent"}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Info Button: summons Customer Details Slide-Over */}
                      <button
                        type="button"
                        onClick={() => onViewInfo(del.id)}
                        className="px-3 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#222] text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#2B2B2B] text-gray-700 dark:text-gray-300 transition-colors cursor-pointer shadow-2xs"
                      >
                        Info
                      </button>

                      {/* Reinstate Button: opens Reinstate Modal */}
                      <button
                        type="button"
                        onClick={() => onReinstate(del.id, del.fullName)}
                        className="px-3.5 py-1.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Reinstate</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
