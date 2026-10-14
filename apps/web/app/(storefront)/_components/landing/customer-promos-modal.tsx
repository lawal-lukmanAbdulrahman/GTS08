"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatKobo } from "@gts/utils";

export interface CustomerPromoItem {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string | null;
  product_scope: "all" | "specific_products";
  product_ids?: string[];
  products?: Array<{ id: string; name: string; image_url: string; base_price: number }>;
}

interface CustomerPromosModalProps {
  isOpen: boolean;
  onClose: () => void;
  promos: CustomerPromoItem[];
}

export default function CustomerPromosModal({
  isOpen,
  onClose,
  promos,
}: CustomerPromosModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const handleCopy = (code: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#010101]">
                My Available Promo Codes
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Active discounts you can apply directly at checkout or in your cart
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {promos.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M21 11.25H3M21 11.25a2.25 2.25 0 00-2.25-2.25H16.5M3 11.25a2.25 2.25 0 012.25-2.25H7.5m9 0V4.5A2.25 2.25 0 0014.25 2.25h-4.5A2.25 2.25 0 007.5 4.5v4.5m9 0H7.5" />
                </svg>
              </div>
              <div className="text-sm font-bold text-gray-800">No active promo codes right now</div>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Keep an eye out for upcoming holiday deals, flash sales, and special customer discounts!
              </p>
            </div>
          ) : (
            promos.map((p) => {
              const now = Date.now();
              const isExpired = p.expires_at && new Date(p.expires_at).getTime() < now;
              const daysRemaining = p.expires_at
                ? Math.max(0, Math.ceil((new Date(p.expires_at).getTime() - now) / (1000 * 60 * 60 * 24)))
                : null;

              return (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl border border-gray-200/90 bg-gradient-to-br from-white to-[#FAF9F5] shadow-2xs space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base tracking-wider text-[#010101] px-2.5 py-1 bg-white rounded-xl border border-gray-200 shadow-2xs">
                          {p.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(p.code)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-[#EDCF5D] text-gray-700 hover:text-black transition-colors cursor-pointer"
                        >
                          {copiedCode === p.code ? "Copied! ✓" : "Copy"}
                        </button>
                      </div>

                      <div className="text-xs text-gray-500 font-medium">
                        {p.product_scope === "all" ? (
                          <span className="text-emerald-700 font-semibold">
                            Valid across entire store
                          </span>
                        ) : (
                          <span className="text-blue-700 font-semibold">
                            Valid on {p.products?.length || p.product_ids?.length || 0} specific product(s)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-amber-500 block">
                        {p.discount_type === "percentage"
                          ? `${p.discount_value}% OFF`
                          : `${formatKobo(p.discount_value)} OFF`}
                      </span>
                      {daysRemaining !== null && (
                        <span className={`text-[10px] font-bold ${
                          isExpired ? "text-red-500" : daysRemaining <= 3 ? "text-amber-600" : "text-gray-400"
                        }`}>
                          {isExpired ? "Expired" : `Expires in ${daysRemaining} day(s)`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scoped Products Grid if specific */}
                  {p.product_scope === "specific_products" && p.products && p.products.length > 0 && (
                    <div className="pt-3 border-t border-gray-200/60">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                        Eligible Products:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {p.products.map((prod) => (
                          <div
                            key={prod.id}
                            className="p-2 rounded-xl bg-white border border-gray-100 flex items-center gap-2.5 shadow-2xs"
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                                  GTS
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-gray-900 truncate">
                                {prod.name}
                              </div>
                              <div className="text-[11px] text-gray-500 font-mono">
                                {formatKobo(prod.base_price)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <Link
                      href="/cart"
                      onClick={onClose}
                      className="text-xs font-bold text-[#010101] hover:text-[#EDCF5D] underline underline-offset-2 flex items-center gap-1"
                    >
                      <span>Apply in Cart</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-[#FAF9F5] flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            {promos.length} available promo code{promos.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] transition-all cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
