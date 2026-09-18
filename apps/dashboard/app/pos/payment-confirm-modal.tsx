"use client";

import { useState } from "react";
import { formatKobo } from "@gts/utils";
import type { PaymentMethod } from "./pos-types";

interface PaymentConfirmModalProps {
  total: number;
  paymentMethod: PaymentMethod;
  itemCount: number;
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
  onCancel,
  onConfirm,
}: PaymentConfirmModalProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-[12px] bg-white dark:bg-[#1C1C1C] p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Confirm Walk-in Order</h2>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatKobo(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Payment</span>
            <span className="text-gray-900 dark:text-white">{PAYMENT_LABEL[paymentMethod]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Items</span>
            <span className="text-gray-900 dark:text-white">{itemCount}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Customer email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Customer email for receipt"
            className="w-full mt-1 px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(email)}
            className="flex-1 py-2.5 rounded-[8px] bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
          >
            Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}
