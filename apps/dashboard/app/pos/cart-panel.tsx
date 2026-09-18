"use client";

import { formatKobo, computeCartTotals } from "@gts/utils";
import type { CartLine, PaymentMethod } from "./pos-types";

interface CartPanelProps {
  lines: CartLine[];
  paymentMethod: PaymentMethod | null;
  promoCode?: string;
  discountAmount?: number;
  promoError?: string | null;
  cashReceived?: string;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCashReceivedChange?: (value: string) => void;
  onPromoCodeChange?: (value: string) => void;
  onApplyPromo?: () => void;
  onRemovePromo?: () => void;
  onConfirm: () => void;
}

export default function CartPanel({
  lines,
  paymentMethod,
  promoCode,
  discountAmount = 0,
  promoError,
  cashReceived,
  onIncrement,
  onDecrement,
  onRemove,
  onPaymentMethodChange,
  onCashReceivedChange,
  onPromoCodeChange,
  onApplyPromo,
  onRemovePromo,
  onConfirm,
}: CartPanelProps) {
  const totals =
    lines.length > 0
      ? computeCartTotals(
          lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
          discountAmount
        )
      : { subtotal: 0, discountAmount: 0, total: 0 };

  const canConfirm = lines.length > 0 && paymentMethod !== null;
  const changeDue =
    paymentMethod === "cash" && cashReceived
      ? Math.max(0, Math.round(Number(cashReceived) * 100) - totals.total)
      : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1C] border-l border-gray-200 dark:border-[#262626]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 px-6">
            Cart is empty. Add products from the left.
          </div>
        ) : (
          lines.map((line) => {
            const variant = [line.size, line.color].filter(Boolean).join(" / ");
            const lineTotal = line.unitPrice * line.quantity;
            const atStockLimit = line.quantity >= line.available;

            return (
              <div
                key={line.variantId}
                className="flex items-center gap-3 p-2.5 rounded-[8px] border border-gray-200 dark:border-[#262626]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {line.productName}
                  </p>
                  {variant && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{variant}</p>
                  )}
                  {atStockLimit && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      Only {line.available} left in stock.
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      aria-label="-"
                      disabled={line.quantity <= 1}
                      onClick={() => onDecrement(line.variantId)}
                      className="w-6 h-6 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="text-sm font-mono w-5 text-center">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="+"
                      disabled={atStockLimit}
                      onClick={() => onIncrement(line.variantId)}
                      className="w-6 h-6 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                    <span className="text-sm font-semibold ml-1">{formatKobo(lineTotal)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${line.productName}`}
                  onClick={() => onRemove(line.variantId)}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-lg leading-none px-1"
                >
                  &times;
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-[#262626] p-4 space-y-3">
        {onPromoCodeChange && (
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode || ""}
                onChange={(e) => onPromoCodeChange(e.target.value)}
                placeholder="Promo code"
                className="flex-1 px-3 py-1.5 text-xs rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
              />
              {discountAmount > 0 ? (
                <button
                  type="button"
                  onClick={onRemovePromo}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 underline"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApplyPromo}
                  className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]"
                >
                  Apply
                </button>
              )}
            </div>
            {promoError && <p className="text-xs text-red-600 mt-1">{promoError}</p>}
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>Subtotal</span>
            <span>{formatKobo(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span>-{formatKobo(totals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-100 dark:border-[#262626]">
            <span>Total</span>
            <span>{formatKobo(totals.total)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Payment Method</p>
          <div className="flex gap-2">
            {(["cash", "pos_terminal"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPaymentMethodChange(method)}
                className={`flex-1 py-2 rounded-[6px] text-xs font-semibold border transition-all ${
                  paymentMethod === method
                    ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                    : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                }`}
              >
                {method === "cash" ? "Cash" : "Card Terminal"}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === "cash" && onCashReceivedChange && (
          <div>
            <input
              type="number"
              value={cashReceived || ""}
              onChange={(e) => onCashReceivedChange(e.target.value)}
              placeholder="Cash received (₦)"
              className="w-full px-3 py-1.5 text-xs rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
            />
            {changeDue !== null && (
              <p className="text-xs text-gray-500 mt-1">Change due: {formatKobo(changeDue)}</p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="w-full py-3 rounded-[8px] bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
        >
          Confirm Payment — {formatKobo(totals.total)}
        </button>
      </div>
    </div>
  );
}
