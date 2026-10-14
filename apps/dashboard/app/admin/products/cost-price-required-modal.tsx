"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CostPriceRequiredModalProps {
  isOpen: boolean;
  initialValue?: string;
  onClose: () => void;
  onApplyCostPrice: (costNaira: string) => void;
}

export default function CostPriceRequiredModal({
  isOpen,
  initialValue = "",
  onClose,
  onApplyCostPrice,
}: CostPriceRequiredModalProps) {
  const [mounted, setMounted] = useState(false);
  const [costInput, setCostInput] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCostInput(initialValue);
      setError(null);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, initialValue]);

  if (!isOpen || !mounted) return null;

  const handleConfirm = () => {
    const num = parseFloat(costInput.replace(/,/g, "").trim());
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid cost price greater than ₦0");
      return;
    }
    onApplyCostPrice(String(num));
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Full Viewport Dark Backdrop */}
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1A1A] p-6 shadow-2xl border border-gray-200 dark:border-[#2E2E2E] space-y-5 animate-in zoom-in-95 duration-150 z-10 font-sans">
          
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Cost Price is Required
              </h3>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                The cost price is the price the product was bought.
              </p>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="rounded-xl bg-[#F8F7F4] dark:bg-[#222222] border border-gray-200/80 dark:border-[#303030] p-3.5 space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            <p>
              To protect your business margins and accurately calculate profit in the Customer Management and Promo Codes systems, every product must have an accurate acquisition cost price.
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Without a cost price, promo codes cannot calculate whether a discount sells below cost or results in a net financial loss.
            </p>
          </div>

          {/* Quick Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
              Product Cost Price (₦) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                ₦
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={costInput}
                onChange={(e) => {
                  setCostInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder="e.g., 25000"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#151515] text-xs font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
                autoFocus
              />
            </div>
            {error && <p className="text-[11px] font-semibold text-rose-500">{error}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#282828]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[6px] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828] cursor-pointer transition-colors"
            >
              Back to Form
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-[6px] bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-[#010101] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Apply &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
