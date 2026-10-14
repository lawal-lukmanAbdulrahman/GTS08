"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CustomerActionModalProps {
  modalAction: "disable" | "delete" | "reinstate" | null;
  targetCustomer: { id: string; name: string } | null;
  reasonInput: string;
  actionSubmitting: boolean;
  onReasonChange: (r: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CustomerActionModal({
  modalAction,
  targetCustomer,
  reasonInput,
  actionSubmitting,
  onReasonChange,
  onClose,
  onConfirm,
}: CustomerActionModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (modalAction && targetCustomer) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [modalAction, targetCustomer]);

  if (!modalAction || !targetCustomer || !mounted) return null;

  const isDisable = modalAction === "disable";
  const isDelete = modalAction === "delete";
  const isReinstate = modalAction === "reinstate";

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop covering whole screen */}
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => {
            if (!actionSubmitting) onClose();
          }}
        />

        {/* Modal Window */}
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1A1A] p-6 shadow-2xl border border-gray-200 dark:border-[#2E2E2E] space-y-4 animate-in zoom-in-95 duration-150 z-10 font-sans">
          
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isDisable
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                  : isDelete
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
              }`}
            >
              {isDisable && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
              {isDelete && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              )}
              {isReinstate && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {isDisable && `Disable Account: ${targetCustomer.name}`}
                {isDelete && `Delete Account: ${targetCustomer.name}`}
                {isReinstate && `Reinstate Account: ${targetCustomer.name}`}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {isDisable &&
                  "The customer will receive an inbox notification stating the reason and your store support phone number. Ordering & inquiry privileges are suspended."}
                {isDelete &&
                  "The customer will encounter an unremovable dialog upon next login, forcing a signout. The account remains safely redeemable for 30 days."}
                {isReinstate &&
                  "The customer account will be immediately restored with full permissions. An inbox alert and email notification will be sent."}
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Reason for {isDisable ? "Disabling" : isDelete ? "Deletion" : "Reinstatement"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Required</span>
            </div>

            <textarea
              value={reasonInput}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              placeholder={
                isDisable
                  ? "e.g., Unsettled balance, suspicious order activity, or chargeback dispute..."
                  : isDelete
                  ? "e.g., Customer requested account closure or serious terms of service breach..."
                  : "e.g., Identity successfully verified and account clearance granted..."
              }
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-[#383838] bg-gray-50/50 dark:bg-[#202020] text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#282828]">
            <button
              type="button"
              disabled={actionSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-[6px] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionSubmitting || !reasonInput.trim()}
              onClick={onConfirm}
              className={`px-4 py-2 rounded-[6px] text-xs font-bold text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                isDisable
                  ? "bg-amber-600 hover:bg-amber-700"
                  : isDelete
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {actionSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm &amp; Proceed</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
