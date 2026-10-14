"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatKobo } from "@gts/utils";
import type { CustomerDetailData } from "./types";

interface CustomerInfoDrawerProps {
  customerDetail: CustomerDetailData | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onDisable: (id: string, name: string) => void;
  onEnable: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

export default function CustomerInfoDrawer({
  customerDetail,
  isOpen,
  loading,
  onClose,
  onDisable,
  onEnable,
  onDelete,
}: CustomerInfoDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "inquiries" | "actions">("orders");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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

  if (!isOpen || !mounted) return null;

  const copyId = (id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const c = customerDetail?.customer;
  const stats = customerDetail?.stats;
  const initial = (c?.fullName || c?.email || "C").charAt(0).toUpperCase();

  const drawerContent = (
    <div className="fixed inset-0 z-[80] overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#181818] shadow-2xl border-l border-gray-200 dark:border-[#2A2A2A] flex flex-col h-full transform transition-transform duration-300 ease-out animate-in slide-in-from-right">
          
          {/* ────── STICKY DRAWER HEADER ────── */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-[#262626] bg-[#F8F7F4]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-[#EDCF5D] text-[#010101] font-black text-base flex items-center justify-center shrink-0 shadow-2xs border border-amber-300/60 dark:border-amber-400/40">
                {initial}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-[#EDCF5D] block">
                  Customer Profile
                </span>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                  {c?.fullName || "Loading details..."}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {c && (
                    <button
                      type="button"
                      onClick={() => copyId(c.id)}
                      className="font-mono text-[10.5px] text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      title="Click to copy ID"
                    >
                      <span>ID: {c.id.slice(0, 10)}...</span>
                      {copiedId ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">Copied!</span>
                      ) : (
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      )}
                    </button>
                  )}

                  {c?.isDisabled && (
                    <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Disabled
                    </span>
                  )}
                  {c && !c.isDisabled && !c.deletedAt && (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  )}
                  {c?.deletedAt && (
                    <span className="inline-flex items-center gap-1 bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Deleted ({c.daysRemaining ?? 30}d left)
                    </span>
                  )}
                </div>
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

          {/* ────── BODY CONTENT ────── */}
          {loading || !customerDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-[#EDCF5D] rounded-full animate-spin" />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Loading customer records...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:thin]">
              
              {/* Account Restriction Alert */}
              {c?.isDisabled && (
                <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/25 p-4 text-xs text-rose-900 dark:text-rose-200 space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      Account Access Restricted
                    </p>
                    {c.disabledAt && (
                      <span className="text-[10px] font-mono opacity-80">
                        {new Date(c.disabledAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed pl-5 font-mono text-[11.5px]">
                    Reason: &quot;{c.disabledReason || "No explicit reason documented."}&quot;
                  </p>
                </div>
              )}

              {/* 3 KPI Stats Grid matching Products Page */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Spend */}
                <div className="p-3.5 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-2xs">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block font-sans">
                    Total Spend
                  </span>
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white block mt-1 font-sans">
                    {formatKobo(stats?.totalSpentKobo ?? 0)}
                  </span>
                  <span className="text-[10.5px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 block">
                    {stats?.totalOrders ?? 0} completed order{stats?.totalOrders === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Net Profit Generated */}
                <div className="p-3.5 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-2xs">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block font-sans">
                    Profit Gotten
                  </span>
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 block mt-1 font-sans">
                    {formatKobo(stats?.totalProfitKobo ?? 0)}
                  </span>
                  <span className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 font-mono font-medium mt-0.5 block">
                    Net business earnings
                  </span>
                </div>

                {/* Margin % */}
                <div className="p-3.5 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-2xs">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-[#EDCF5D] block font-sans">
                    Profit Margin
                  </span>
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-amber-600 dark:text-[#EDCF5D] block mt-1 font-sans">
                    {stats?.profitMarginPct ?? 0}%
                  </span>
                  <span className="text-[10.5px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 block">
                    Gross margin ratio
                  </span>
                </div>
              </div>

              {/* Contact Information Card */}
              <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50/60 dark:bg-[#1C1C1C] p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Email:</span>
                  <a
                    href={`mailto:${c?.email}`}
                    className="font-semibold text-gray-900 dark:text-[#EDCF5D] hover:underline"
                  >
                    {c?.email}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Phone Number:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {c?.phone ? (
                      <a href={`tel:${c.phone}`} className="hover:underline">
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400 font-normal">Not provided</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Customer Since:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {c?.createdAt
                      ? new Date(c.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Segmented Pill Tabs matching Products Page Style */}
              <div className="bg-gray-100 dark:bg-[#222222] p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === "orders"
                      ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white font-bold shadow-2xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Order History ({customerDetail.orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("inquiries")}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === "inquiries"
                      ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white font-bold shadow-2xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Inquiries ({customerDetail.inquiries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("actions")}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === "actions"
                      ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white font-bold shadow-2xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Account Actions
                </button>
              </div>

              {/* TAB 1: ORDER HISTORY & PROFIT PER ORDER */}
              {activeTab === "orders" && (
                <div className="space-y-3">
                  {customerDetail.orders.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-[#666] font-mono text-xs rounded-xl border border-dashed border-gray-200 dark:border-[#2C2C2C]">
                      No recorded orders for this customer yet.
                    </div>
                  ) : (
                    customerDetail.orders.map((ord) => {
                      const isExpanded = expandedOrderId === ord.id;

                      return (
                        <div
                          key={ord.id}
                          className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] overflow-hidden shadow-2xs transition-colors"
                        >
                          <div
                            onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                            className="p-3.5 flex items-center justify-between hover:bg-gray-50/70 dark:hover:bg-[#202020] transition-colors cursor-pointer select-none"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                                  #{ord.orderNumber}
                                </span>
                                <span className="bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  {ord.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                                {new Date(ord.createdAt).toLocaleDateString("en-NG", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })} · {ord.itemCount} item{ord.itemCount === 1 ? "" : "s"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="font-bold text-xs text-gray-900 dark:text-white">
                                {formatKobo(ord.totalKobo)}
                              </p>
                              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                                Profit: +{formatKobo(ord.profitKobo)}
                              </p>
                            </div>
                          </div>

                          {/* Order Items Breakdown */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414] p-3.5 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                Item Breakdown &amp; Profit Contribution
                              </p>
                              <div className="space-y-1.5 divide-y divide-gray-100 dark:divide-[#222]">
                                {ord.items.map((it) => (
                                  <div key={it.id} className="pt-1.5 flex items-center justify-between text-xs">
                                    <div className="min-w-0 pr-2">
                                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                        {it.name}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-mono">
                                        Qty: {it.quantity} × {formatKobo(it.unitPriceKobo)}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="font-bold text-gray-900 dark:text-white">
                                        {formatKobo(it.lineTotalKobo)}
                                      </p>
                                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                        +{formatKobo(it.profitKobo)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: CUSTOMER INQUIRIES */}
              {activeTab === "inquiries" && (
                <div className="space-y-3">
                  {customerDetail.inquiries.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-[#666] font-mono text-xs rounded-xl border border-dashed border-gray-200 dark:border-[#2C2C2C]">
                      No support tickets or inquiries submitted by this customer.
                    </div>
                  ) : (
                    customerDetail.inquiries.map((inq) => (
                      <div
                        key={inq.id}
                        className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] p-4 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-amber-600 dark:text-[#EDCF5D]">
                              #{inq.reference}
                            </span>
                            <span className="bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                              {inq.status}
                            </span>
                          </div>
                          <p className="font-semibold text-xs text-gray-900 dark:text-white mt-1 truncate">
                            {inq.subject}
                          </p>
                          <p className="text-[10.5px] text-gray-400 mt-0.5 font-mono">
                            {new Date(inq.createdAt).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <Link
                          href={`/admin/questions/${inq.id}`}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#383838] hover:bg-[#010101] hover:text-white dark:hover:bg-[#EDCF5D] dark:hover:text-black text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
                        >
                          View Chat
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: ACCOUNT ACTIONS */}
              {activeTab === "actions" && c && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50/60 dark:bg-[#1C1C1C] space-y-3">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                        Account Access Status
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        Control the storefront ordering and inquiry capabilities for this customer.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      {c.isDisabled ? (
                        <button
                          type="button"
                          onClick={() => onEnable(c.id, c.fullName)}
                          className="px-4 py-2 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span>Re-enable Account</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDisable(c.id, c.fullName)}
                          className="px-4 py-2 rounded-[6px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span>Disable Account</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Danger Zone: Delete Account */}
                  <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-400">
                        Delete Account (30-Day Safe Hold)
                      </h4>
                      <p className="text-xs text-rose-900/80 dark:text-rose-300/80 mt-0.5 leading-relaxed">
                        Soft deletes this customer account. The customer will see an unremovable notification dialog on login and be logged out. The account remains redeemable for 30 days before permanent deletion.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(c.id, c.fullName)}
                      className="px-4 py-2 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      <span>Delete Customer Account</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
