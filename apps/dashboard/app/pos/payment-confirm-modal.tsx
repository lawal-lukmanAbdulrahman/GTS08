"use client";

import { useState } from "react";
import { formatKobo } from "@gts/utils";
import type { PaymentMethod } from "./pos-types";

interface PaymentConfirmModalProps {
  total: number;
  paymentMethod: PaymentMethod;
  itemCount: number;
  /** Total units across all lines (shown in place of the line count). */
  unitCount?: number;
  /** Kobo taken off the sale, if any. */
  discountAmount?: number;
  onCancel: () => void;
  onConfirm: (customerEmail: string) => void;
}

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  pos_terminal: "Card Terminal",
};

/** gts_03_cashier_spec.md Part 5.1. */
export default function PaymentConfirmModal({
  total,
  paymentMethod,
  itemCount,
  unitCount,
  discountAmount = 0,
  onCancel,
  onConfirm,
}: PaymentConfirmModalProps) {
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false); // one tap, one sale

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-[12px] bg-white dark:bg-[#1C1C1C] p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Walk-in Order</h2>

        <div className="space-y-1 text-base">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatKobo(total)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Discount</span>
              <span className="text-emerald-600 dark:text-emerald-400">-{formatKobo(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Payment</span>
            <span className="text-gray-900 dark:text-white">{PAYMENT_LABEL[paymentMethod]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Items</span>
            <span className="text-gray-900 dark:text-white">{unitCount === undefined ? itemCount : `${unitCount} unit${unitCount === 1 ? "" : "s"}`}</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Customer email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Customer email for receipt"
            className="w-full mt-1 px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-base font-semibold text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={() => {
              if (confirming) return;
              setConfirming(true);
              onConfirm(email);
            }}
            className="flex-1 py-2.5 rounded-[8px] bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 disabled:opacity-60"
          >
            {confirming ? "Confirming..." : "Confirm Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
