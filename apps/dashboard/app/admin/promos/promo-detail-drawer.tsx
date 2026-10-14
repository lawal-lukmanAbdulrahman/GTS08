"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatKobo } from "@gts/utils";
import { apiCall } from "../../lib/staff-api";
import type { PromoEnhancedView } from "./types";

interface PromoDetailDrawerProps {
  isOpen: boolean;
  promoId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function PromoDetailDrawer({
  isOpen,
  promoId,
  onClose,
  onUpdated,
}: PromoDetailDrawerProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [promo, setPromo] = useState<PromoEnhancedView | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Toggle active loading state
  const [toggleBusy, setToggleBusy] = useState(false);

  // Destructive delete modal with 3s countdown
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(3);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && promoId) {
      setLoading(true);
      setErrorMsg("");
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      apiCall<PromoEnhancedView>(`/promos/${promoId}`)
        .then((res) => {
          if (res.ok) {
            setPromo(res.data);
          } else {
            setErrorMsg(res.message || "Failed to load promo details.");
          }
        })
        .catch(() => setErrorMsg("Error fetching promo details."))
        .finally(() => setLoading(false));

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, promoId]);

  // Delete countdown timer effect (3s delay for safety)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showDeleteModal && deleteCountdown > 0) {
      timer = setInterval(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showDeleteModal, deleteCountdown]);

  if (!isOpen || !mounted) return null;

  const handleCopyCode = () => {
    if (promo?.code && navigator.clipboard) {
      navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleActive = async () => {
    if (!promo || toggleBusy || deleteLoading) return;
    setToggleBusy(true);
    try {
      const r = await apiCall(`/promos/${promo.id}/activate`, {
        method: "PUT",
        json: { is_active: !promo.is_active },
      });
      if (r.ok) {
        setPromo({ ...promo, is_active: !promo.is_active });
        onUpdated();
      } else {
        alert(r.message || "Failed to update promo status");
      }
    } finally {
      setToggleBusy(false);
    }
  };

  const handleOpenDeleteModal = () => {
    if (!promo || toggleBusy || deleteLoading) return;
    setDeleteCountdown(3);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!promo || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const r = await apiCall(`/promos/${promo.id}`, { method: "DELETE" });
      if (r.ok) {
        setShowDeleteModal(false);
        onUpdated();
        onClose();
      } else {
        alert(r.message || "Failed to delete promo code");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCustomerClick = (customerId?: string | null) => {
    if (!customerId) return;
    // Redirect to customer management page with customerId deep link
    router.push(`/admin/customers?customerId=${customerId}`);
    onClose();
  };

  const isExpired = promo?.expires_at && new Date(promo.expires_at).getTime() < Date.now();
  const daysRemaining = promo?.expires_at
    ? Math.max(0, Math.ceil((new Date(promo.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end overflow-hidden font-sans">
      {/* Dark Viewport Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Right Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#181818] h-full shadow-2xl border-l border-gray-200 dark:border-[#262626] flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-[#262626] bg-white/95 dark:bg-[#181818]/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Promo Code Details
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5">
              Review targeted customers, scope, pricing, and live redemption history
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 bg-gray-100 dark:bg-[#222222] rounded-2xl" />
              <div className="h-20 bg-gray-100 dark:bg-[#222222] rounded-xl" />
              <div className="h-32 bg-gray-100 dark:bg-[#222222] rounded-xl" />
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
              {errorMsg}
            </div>
          ) : !promo ? (
            <div className="py-20 text-center text-xs text-gray-400 font-mono">No promo code found</div>
          ) : (
            <>
              {/* Code Pill & Discount Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/60 dark:from-[#1E1E1E] dark:to-[#141414] border border-gray-200 dark:border-[#2C2C2C] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-black text-gray-900 dark:text-white tracking-widest px-3 py-1 bg-white dark:bg-[#252525] rounded-xl border border-gray-200 dark:border-[#333] shadow-xs">
                      {promo.code}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-200/80 dark:bg-[#2E2E2E] text-gray-700 dark:text-gray-300 hover:bg-gray-300 transition-colors cursor-pointer"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      !promo.is_active
                        ? "bg-gray-200 dark:bg-[#2C2C2C] text-gray-600 dark:text-gray-400"
                        : isExpired
                        ? "bg-red-500/10 text-red-500 border border-red-500/30"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {!promo.is_active ? "Inactive / Disabled" : isExpired ? "Expired" : "Active & Live"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200/60 dark:border-[#2A2A2A]">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Discount</div>
                    <div className="text-base font-black text-amber-500">
                      {promo.discount_type === "percentage"
                        ? `${promo.discount_value}% OFF`
                        : `${formatKobo(promo.discount_value)} OFF`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Uses</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      {promo.used_count} {promo.max_uses ? `/ ${promo.max_uses}` : "times"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Per Person Limit</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      {promo.max_uses_per_customer
                        ? `${promo.max_uses_per_customer} use/person`
                        : "Unlimited"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Associated Products Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Associated Products ({promo.product_scope === "all" ? "All Products" : promo.products?.length || 0})
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Scope: {promo.product_scope === "all" ? "Storewide" : "Specific Items"}
                  </span>
                </div>

                {promo.product_scope === "all" ? (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#262626] text-gray-500 dark:text-gray-400">
                    This promo code is eligible across all items and categories in the storefront.
                  </div>
                ) : !promo.products || promo.products.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#262626] text-gray-400">
                    No specific products attached.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {promo.products.map((p) => {
                      const discountKobo = Math.round((p.base_price * promo.discount_value) / 100);
                      const finalPrice = p.base_price - discountKobo;
                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#262626] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-[#252525] overflow-hidden flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333]">
                              <img
                                src={p.image_url || "/products/denim_jacket.png"}
                                alt={p.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/products/denim_jacket.png";
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white line-clamp-1">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                                <span className="line-through">{formatKobo(p.base_price)}</span>
                                <span className="text-amber-500 font-bold">{formatKobo(finalPrice)}</span>
                                {p.cost_price ? (
                                  <span className="text-gray-400">
                                    • Cost: {formatKobo(p.cost_price)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Assigned Customers Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Assigned Customers ({promo.target_type === "all" ? "All Shoppers" : promo.targeted_customers?.length || promo.customer_ids?.length || 0})
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Audience: {promo.target_type === "all" ? "Storewide" : "Specific Accounts"}
                  </span>
                </div>

                {promo.target_type === "all" ? (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#262626] text-gray-500 dark:text-gray-400">
                    Open to all registered shoppers and guests across the storefront.
                  </div>
                ) : !promo.targeted_customers || promo.targeted_customers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#262626] text-gray-400">
                    {promo.customer_ids && promo.customer_ids.length > 0
                      ? `${promo.customer_ids.length} customer account(s) targeted`
                      : "No specific customers assigned."}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {promo.targeted_customers.map((c) => {
                      const name = (c as any).full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleCustomerClick(c.id)}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#262626] flex items-center justify-between hover:border-[#EDCF5D] hover:bg-amber-500/5 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {(name || "C").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{name}</span>
                                <span className="text-[10px] text-amber-500 font-normal underline inline-flex items-center gap-0.5 shrink-0">
                                  <span>View profile</span>
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono truncate">
                                {c.email} {c.phone ? `• ${c.phone}` : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customers Who Used It Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#262626] pb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Customer Redemptions ({promo.uses?.length || 0})
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Click customer to inspect profile
                  </span>
                </div>

                {!promo.uses || promo.uses.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 border border-dashed border-gray-200 dark:border-[#2A2A2A] rounded-xl">
                    No customers have redeemed this promo code yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {promo.uses.map((use) => (
                      <div
                        key={use.id}
                        onClick={() => handleCustomerClick(use.customer_id)}
                        className={`p-3 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#141414] flex items-center justify-between transition-all ${
                          use.customer_id
                            ? "hover:border-[#EDCF5D] hover:bg-amber-500/5 cursor-pointer"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-400/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                            {(use.customer_name || use.customer_email || "C").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{use.customer_name || "Guest Customer"}</span>
                              {use.customer_id && (
                                <span className="text-[10px] text-amber-500 font-normal underline inline-flex items-center gap-0.5">
                                  <span>View profile</span>
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {use.customer_email || "No email on record"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-500">
                            Saved {formatKobo(use.discount_applied_kobo)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(use.used_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expiry & Validity Section */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#262626] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white text-xs">
                    Validity Schedule
                  </span>
                  {daysRemaining !== null && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      daysRemaining === 0
                        ? "bg-red-500/10 text-red-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {daysRemaining === 0 ? "Expires today" : `Expires in ${daysRemaining} day(s)`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                  <div>
                    <span className="text-gray-400">Active From: </span>
                    <strong className="text-gray-700 dark:text-gray-200 font-mono">
                      {new Date(promo.starts_at).toLocaleDateString()}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-400">Expires On: </span>
                    <strong className="text-gray-700 dark:text-gray-200 font-mono">
                      {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : "Never"}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Actions Bar */}
        {promo && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] flex items-center justify-between sticky bottom-0 z-10">
            <button
              type="button"
              onClick={handleOpenDeleteModal}
              disabled={toggleBusy || deleteLoading}
              className="px-3.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Delete Code
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={toggleBusy || deleteLoading}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  promo.is_active
                    ? "border-amber-400/40 text-amber-500 hover:bg-amber-400/10"
                    : "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                }`}
              >
                {toggleBusy && (
                  <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>
                  {toggleBusy
                    ? promo.is_active ? "Disabling..." : "Enabling..."
                    : promo.is_active ? "Disable Code" : "Enable Code"}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#303030] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Destructive Delete Confirmation Modal with 3-Second Countdown */}
      {showDeleteModal && promo && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 font-sans animate-in zoom-in-95 duration-150">
            {/* Header / Red Warning Icon */}
            <div className="flex items-start gap-3.5">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Delete Promo Code Confirmation
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {promo.used_count > 0 ? (
                    <>
                      This promo code <strong className="text-gray-900 dark:text-white font-mono font-bold">{promo.code}</strong> has been redeemed <strong className="text-gray-900 dark:text-white">{promo.used_count}</strong> time(s). Deleting will deactivate it permanently to preserve order history.
                    </>
                  ) : (
                    <>
                      Are you sure you want to permanently delete promo code <strong className="text-gray-900 dark:text-white font-mono font-bold">{promo.code}</strong>? This action cannot be undone.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#282828] dark:hover:bg-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteCountdown > 0 || deleteLoading}
                onClick={handleConfirmDelete}
                style={{
                  backgroundColor: deleteCountdown > 0 ? "rgba(220, 38, 38, 0.2)" : "#dc2626",
                  color: deleteCountdown > 0 ? "rgba(248, 113, 113, 0.6)" : "#ffffff",
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                  deleteCountdown > 0 || deleteLoading
                    ? "border border-red-500/20 cursor-not-allowed"
                    : "cursor-pointer active:scale-95"
                }`}
              >
                {deleteLoading && (
                  <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>
                  {deleteLoading
                    ? "Deleting..."
                    : deleteCountdown > 0
                    ? `Delete (${deleteCountdown}s)`
                    : "Delete"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
