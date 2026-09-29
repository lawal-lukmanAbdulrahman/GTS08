"use client";

import { useState } from "react";
import { formatKobo, computeCartTotals, parseNairaInput } from "@gts/utils";
import { percentToNairaText, resolveManualDiscount } from "./manual-discount-input";
import { resolveProductImageUrl } from "./product-image";
import type { CartLine, PaymentMethod } from "./pos-types";

interface CartPanelProps {
  lines: CartLine[];
  paymentMethod: PaymentMethod | null;
  /** Whether this staff member may apply a manual discount at all. */
  canDiscount?: boolean;
  /** Admins may discount past the cashier cap. */
  isAdmin?: boolean;
  /** The discount box's text, in Naira as typed. */
  discountText?: string;
  cashReceived?: string;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCashReceivedChange?: (value: string) => void;
  onDiscountTextChange?: (value: string) => void;
  onFlagLine?: (line: CartLine) => void;
  /** Park this cart to serve someone else. */
  onHold?: () => void;
  onConfirm: () => void;
}

function CartItemThumb({ line }: { line: CartLine }) {
  const [failed, setFailed] = useState(false);
  const url = line.imageUrl || resolveProductImageUrl(line.primary_image?.cloudinary_id);
  if (!url || failed) {
    return (
      <div data-testid="cart-no-image" className="w-full h-full flex items-center justify-center text-gray-400 dark:text-[#555]">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM8.25 8.625a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z" />
        </svg>
      </div>
    );
  }
  const isTransparent = url.toLowerCase().includes(".png") || url.toLowerCase().includes("transparent");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={line.primary_image?.alt ?? line.productName}
      onError={() => setFailed(true)}
      className={`w-full h-full ${isTransparent ? "object-contain p-1" : "object-cover"}`}
    />
  );
}

export default function CartPanel({
  lines,
  paymentMethod,
  canDiscount = false,
  isAdmin = false,
  discountText = "",
  cashReceived,
  onIncrement,
  onDecrement,
  onRemove,
  onPaymentMethodChange,
  onCashReceivedChange,
  onDiscountTextChange,
  onFlagLine,
  onHold,
  onConfirm,
}: CartPanelProps) {
  const rawSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = resolveManualDiscount(discountText, { subtotal: rawSubtotal, isAdmin, canApply: canDiscount || isAdmin });
  const totals =
    lines.length > 0
      ? computeCartTotals(
          lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
          discount.kobo
        )
      : { subtotal: 0, discountAmount: 0, total: 0 };

  const received = paymentMethod === "cash" && cashReceived ? parseNairaInput(cashReceived) : null;
  const changeDue = received === null ? null : Math.max(0, received - totals.total);
  // A cashier who has typed what the customer handed over shouldn't be able to complete an underpaid sale.
  const shortBy = received !== null && received < totals.total ? totals.total - received : null;
  // A discount that was typed but refused must not be silently dropped at the till.
  const canConfirm = lines.length > 0 && paymentMethod !== null && discount.error === null && shortBy === null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1C] border-l border-gray-200 dark:border-[#262626]">
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 px-4">
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
                className="flex items-center gap-2.5 p-2 rounded-[8px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1E1E1E]"
              >
                {/* Thumbnail at start */}
                <div className="w-12 h-12 rounded-[6px] bg-gray-100 dark:bg-[#262626] shrink-0 overflow-hidden border border-gray-200/80 dark:border-[#333] flex items-center justify-center">
                  <CartItemThumb line={line} />
                </div>

                {/* Details on the right */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {line.productName}
                  </p>
                  {variant && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{variant}</p>
                  )}
                  {atStockLimit && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-medium">
                      Only {line.available} left in stock.
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      aria-label="-"
                      disabled={line.quantity <= 1}
                      onClick={() => onDecrement(line.variantId)}
                      className="w-5 h-5 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-mono w-5 text-center">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="+"
                      disabled={atStockLimit}
                      onClick={() => onIncrement(line.variantId)}
                      className="w-5 h-5 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-xs sm:text-sm font-semibold ml-1 text-gray-900 dark:text-white">{formatKobo(lineTotal)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0 self-center">
                  {onFlagLine && (
                    <button
                      type="button"
                      aria-label={`Flag ${line.productName}`}
                      title="Report a problem with this product"
                      onClick={() => onFlagLine(line)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5c3-1.5 6 1.5 9 0s6-1.5 9 0v9c-3-1.5-6 1.5-9 0s-6-1.5-9 0" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${line.productName}`}
                    onClick={() => onRemove(line.variantId)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-base leading-none p-1 cursor-pointer transition-colors"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-[#262626] p-3.5 space-y-2.5">
        {(canDiscount || isAdmin) && onDiscountTextChange && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400" htmlFor="manual-discount">
                Discount (₦)
              </label>
              {!isAdmin && <span className="text-[11px] text-gray-400">Up to 20% of the sale</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                id="manual-discount"
                type="text"
                inputMode="decimal"
                value={discountText}
                onChange={(e) => onDiscountTextChange(e.target.value)}
                placeholder="0"
                className="w-24 sm:w-28 px-2.5 py-1 text-xs sm:text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent focus:outline-none focus:border-[#EDCF5D]"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {[5, 10, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onDiscountTextChange(percentToNairaText(rawSubtotal, pct))}
                    className="px-2 py-1 min-h-[28px] text-xs font-semibold rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-[#242424] dark:hover:bg-[#2e2e2e] text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
                {discountText && (
                  <button type="button" onClick={() => onDiscountTextChange("")} className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 underline cursor-pointer" aria-label="Clear discount">
                    Clear
                  </button>
                )}
              </div>
            </div>
            {discount.error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">
                {discount.error}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1 text-xs sm:text-sm">
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
          <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm sm:text-base pt-1 border-t border-gray-100 dark:border-[#262626]">
            <span>Total</span>
            <span>{formatKobo(totals.total)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Payment Method</p>
          <div className="flex gap-2">
            {(["cash", "pos_terminal"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPaymentMethodChange(method)}
                className={`flex-1 py-1.5 rounded-[6px] text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                  paymentMethod === method
                    ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                    : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-[#555]"
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
              type="text"
              inputMode="decimal"
              value={cashReceived || ""}
              onChange={(e) => onCashReceivedChange(e.target.value)}
              placeholder="Cash received (₦)"
              className="w-full px-2.5 py-1 text-xs sm:text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent focus:outline-none focus:border-[#EDCF5D]"
            />
            {shortBy !== null ? (
              <p role="status" className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">
                Short by {formatKobo(shortBy)}
              </p>
            ) : (
              changeDue !== null && <p className="text-xs text-gray-500 mt-1">Change due: {formatKobo(changeDue)}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {onHold && lines.length > 0 && (
            <button
              type="button"
              onClick={onHold}
              aria-label="Hold sale"
              title="Hold sale (pause)"
              className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 flex items-center justify-center rounded-[8px] border border-gray-200 dark:border-[#383838] bg-gray-50 hover:bg-gray-100 dark:bg-[#242424] dark:hover:bg-[#2e2e2e] text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-[8px] bg-emerald-600 text-white font-bold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center cursor-pointer"
          >
            Confirm Payment — {formatKobo(totals.total)}
          </button>
        </div>
      </div>
    </div>
  );
}
