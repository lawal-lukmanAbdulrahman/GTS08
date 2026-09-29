"use client";

import { useState, useEffect } from "react";
import { formatKobo } from "@gts/utils";
import { resolveProductImageUrl } from "./product-image";
import type { CartLine, PaymentMethod } from "./pos-types";

function WhatsAppCartItemThumb({ line }: { line: CartLine }) {
  const [failed, setFailed] = useState(false);
  const url = line.imageUrl || resolveProductImageUrl(line.primary_image?.cloudinary_id);
  if (!url || failed) {
    return (
      <div data-testid="cart-no-image" className="w-full h-full flex items-center justify-center text-gray-400 dark:text-[#555]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
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

interface FoundOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product_snapshot: { name: string };
}

interface FoundOrder {
  order_number: string;
  total: number;
  pickup_pin?: string;
  items: FoundOrderItem[];
}

export interface PendingWhatsAppOrder {
  id: string;
  order_number: string;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  item_count: number;
  created_at: string;
}

interface WhatsAppPanelProps {
  mode: "create" | "confirm";
  onModeChange: (mode: "create" | "confirm") => void;

  // create mode
  cartLines: CartLine[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onCreateOrder: () => void;
  isCreatingOrder?: boolean;
  createdOrderNumber: string | null;

  // confirm mode
  lookupOrderNumber: string;
  onLookupOrderNumberChange: (value: string) => void;
  onLookup: () => void;
  isLookingUp?: boolean;
  lookupError: string | null;
  foundOrder: FoundOrder | null;
  paymentMethod: PaymentMethod | null;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onConfirmPayment: (code: string) => void;
  isConfirmingPayment?: boolean;
  onCancelOrder: (reason: string) => void;
  cancelledOrderNumber: string | null;
  /** Orders waiting for payment; picking one saves typing its number. */
  pendingOrders?: PendingWhatsAppOrder[];
  pendingLoading?: boolean;
  selectingOrderNumber?: string | null;
  onSelectPending?: (orderNumber: string) => void;
  onRefreshPending?: () => void;
}

/**
 * D001 (docs/00-open-questions.md): a staff member records a WhatsApp order
 * while chatting with the customer (create mode); a cashier later looks it
 * up by the order number the customer was given and confirms payment
 * (confirm mode).
 */
export default function WhatsAppPanel({
  mode,
  onModeChange,
  cartLines,
  customerName,
  customerPhone,
  customerEmail,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onIncrement,
  onDecrement,
  onRemove,
  onCreateOrder,
  isCreatingOrder = false,
  createdOrderNumber,
  lookupOrderNumber,
  onLookupOrderNumberChange,
  onLookup,
  isLookingUp = false,
  lookupError,
  foundOrder,
  paymentMethod,
  onPaymentMethodChange,
  onConfirmPayment,
  isConfirmingPayment = false,
  onCancelOrder,
  cancelledOrderNumber,
  pendingOrders,
  pendingLoading = false,
  selectingOrderNumber = null,
  onSelectPending,
  onRefreshPending,
}: WhatsAppPanelProps) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    setVerificationCode("");
    setCancelling(false);
    setCancelReason("");
  }, [foundOrder?.order_number]);

  const cleanCode = verificationCode.trim().replace(/\s+/g, "");
  const isCodeComplete = cleanCode.length === 6;
  const isCodeVerified = Boolean(
    isCodeComplete &&
    foundOrder?.pickup_pin &&
    cleanCode === foundOrder.pickup_pin.trim()
  );

  const canCreate =
    cartLines.length > 0 &&
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    customerEmail.trim() !== "" &&
    customerEmail.includes("@");

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1C] border-l border-gray-200 dark:border-[#262626] p-3.5 sm:p-4 space-y-3 overflow-y-auto">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange("create")}
          className={`flex-1 py-2 rounded-[6px] text-sm font-semibold transition-colors cursor-pointer ${
            mode === "create" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
          }`}
        >
          Record New Order
        </button>
        <button
          type="button"
          onClick={() => onModeChange("confirm")}
          className={`flex-1 py-2 rounded-[6px] text-sm font-semibold transition-colors cursor-pointer ${
            mode === "confirm" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
          }`}
        >
          Confirm by Order Number
        </button>
      </div>

      {mode === "create" ? (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          <input
            type="text"
            disabled={isCreatingOrder}
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Customer name *"
            className="px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent disabled:opacity-60"
            required
          />
          <input
            type="tel"
            disabled={isCreatingOrder}
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="Customer WhatsApp phone number *"
            className="px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent disabled:opacity-60"
            required
          />
          <input
            type="email"
            disabled={isCreatingOrder}
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
            placeholder="Customer email address * (for tracking & PIN)"
            className="px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent disabled:opacity-60"
            required
          />

          <div className="flex-1 space-y-2">
            {cartLines.length === 0 ? (
              <p className="text-base text-gray-500 text-center pt-6">
                Add products from the left as the customer lists them.
              </p>
            ) : (
              cartLines.map((line) => (
                <div key={line.variantId} className="flex items-center gap-2.5 p-2 rounded-[8px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1E1E1E]">
                  <div className="w-11 h-11 rounded-[6px] bg-gray-100 dark:bg-[#262626] shrink-0 overflow-hidden border border-gray-200/80 dark:border-[#333] flex items-center justify-center">
                    <WhatsAppCartItemThumb line={line} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{line.productName}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button type="button" aria-label="-" disabled={isCreatingOrder} onClick={() => onDecrement(line.variantId)} className="w-5 h-5 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">-</button>
                      <span className="text-sm font-mono w-5 text-center">{line.quantity}</span>
                      <button type="button" aria-label="+" disabled={isCreatingOrder} onClick={() => onIncrement(line.variantId)} className="w-5 h-5 rounded-full border border-gray-300 dark:border-[#383838] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">+</button>
                      <span className="text-xs sm:text-sm font-semibold ml-1 text-gray-900 dark:text-white">{formatKobo(line.unitPrice * line.quantity)}</span>
                    </div>
                  </div>
                  <button type="button" aria-label={`Remove ${line.productName}`} disabled={isCreatingOrder} onClick={() => onRemove(line.variantId)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-base leading-none p-1 cursor-pointer">&times;</button>
                </div>
              ))
            )}
          </div>

          {cartLines.length > 0 && (
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-[#262626] pt-2">
              <span>Order total</span>
              <span>{formatKobo(cartLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))}</span>
            </div>
          )}

          <button
            type="button"
            disabled={!canCreate || isCreatingOrder}
            onClick={onCreateOrder}
            className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] hover:bg-[#e2c453] text-[#010101] font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isCreatingOrder ? (
              <>
                <svg className="w-5 h-5 animate-spin text-[#010101]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Creating Order...</span>
              </>
            ) : (
              "Create Order"
            )}
          </button>

          {createdOrderNumber && (
            <div className="p-3 rounded-[8px] bg-emerald-50 dark:bg-emerald-900/20 text-base text-emerald-800 dark:text-emerald-300">
              Order created: <strong>{createdOrderNumber}</strong>. Share this number with the customer over
              WhatsApp — they&apos;ll need it when a cashier confirms payment later.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              disabled={isLookingUp || Boolean(selectingOrderNumber)}
              value={lookupOrderNumber}
              onChange={(e) => onLookupOrderNumberChange(e.target.value)}
              placeholder="Order number (e.g. GTS-202609-000002)"
              className="flex-1 px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
            />
            <button
              type="button"
              disabled={isLookingUp || !lookupOrderNumber.trim() || Boolean(selectingOrderNumber)}
              onClick={onLookup}
              className="px-4 py-2 text-sm font-semibold rounded-[6px] bg-gray-100 hover:bg-gray-200 dark:bg-[#242424] dark:hover:bg-[#2e2e2e] disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {isLookingUp ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>Looking Up...</span>
                </>
              ) : (
                "Look Up"
              )}
            </button>
          </div>

          {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

          {cancelledOrderNumber && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Order {cancelledOrderNumber} was cancelled and its reserved stock released.
            </p>
          )}

          {!foundOrder && pendingOrders && (
            <div className="space-y-2 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Waiting for payment</p>
                {onRefreshPending && (
                  <button type="button" onClick={onRefreshPending} className="text-sm font-semibold underline cursor-pointer">
                    Refresh
                  </button>
                )}
              </div>
              {pendingLoading ? (
                <p className="text-base text-gray-500 text-center pt-4">Loading orders...</p>
              ) : pendingOrders.length === 0 ? (
                <p className="text-base text-gray-500 text-center pt-4">No WhatsApp orders waiting for payment.</p>
              ) : (
                pendingOrders.map((order) => {
                  const isThisCardLoading = selectingOrderNumber === order.order_number;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      disabled={Boolean(selectingOrderNumber || isLookingUp)}
                      onClick={() => onSelectPending?.(order.order_number)}
                      className={`w-full flex items-center justify-between text-left p-2.5 rounded-[8px] border transition-all cursor-pointer disabled:cursor-wait ${
                        isThisCardLoading
                          ? "border-[#EDCF5D] bg-[#EDCF5D]/10 ring-2 ring-[#EDCF5D]/30"
                          : "border-gray-200 dark:border-[#262626] hover:border-gray-400 dark:hover:border-[#444]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                          {isThisCardLoading && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#b89b2b] dark:text-[#EDCF5D]">
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                              Loading...
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {order.customer_name ?? "Unnamed customer"} · {order.item_count} item{order.item_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900 dark:text-white">{formatKobo(order.total)}</span>
                        {isThisCardLoading ? (
                          <svg className="w-4 h-4 animate-spin text-[#EDCF5D]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {foundOrder && (
            <div className="space-y-3">
              <div className="space-y-1">
                {foundOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-base">
                    <span>
                      {item.quantity} x {item.product_snapshot.name}
                    </span>
                    <span>{formatKobo(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-1 border-t border-gray-100 dark:border-[#262626]">
                  <span>Total</span>
                  <span>{formatKobo(foundOrder.total)}</span>
                </div>
              </div>

              {/* ── Anti-Theft Verification Code ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Collection Verification Code *
                  </label>
                  {isCodeVerified && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={isConfirmingPayment}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className={`w-full px-3 py-2 pr-10 text-base font-mono tracking-widest text-center rounded-[6px] border bg-transparent outline-none transition-colors ${
                      isCodeVerified
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold"
                        : isCodeComplete
                        ? "border-red-500 ring-2 ring-red-500/20 text-red-600 dark:text-red-400"
                        : "border-gray-200 dark:border-[#383838] focus:border-[#EDCF5D]"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    {isCodeVerified ? (
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCodeComplete ? (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : null}
                  </div>
                </div>
                {isCodeComplete && !isCodeVerified && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                    Incorrect code. Please ask customer to re-check their email or tracking page.
                  </p>
                )}
              </div>

              {/* ── Payment Method ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Payment Method
                </label>
                <div className="flex gap-2">
                  {(["cash", "pos_terminal"] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      disabled={isConfirmingPayment}
                      onClick={() => onPaymentMethodChange(method)}
                      className={`flex-1 py-2 rounded-[6px] text-sm font-semibold border transition-colors cursor-pointer ${
                        paymentMethod === method
                          ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                          : "border-gray-200 dark:border-[#383838] hover:border-gray-400 dark:hover:border-[#555]"
                      }`}
                    >
                      {method === "cash" ? "Cash" : "Card Terminal"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Confirm Payment Button ── */}
              <button
                type="button"
                disabled={!paymentMethod || !isCodeVerified || isConfirmingPayment}
                onClick={() => onConfirmPayment(cleanCode)}
                className="w-full py-2.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isConfirmingPayment ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Confirming Payment...</span>
                  </>
                ) : (
                  `Confirm Payment — ${formatKobo(foundOrder.total)}`
                )}
              </button>

              {cancelling ? (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancelling"
                    className="w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCancelling(false);
                        setCancelReason("");
                      }}
                      className="flex-1 py-2 text-sm font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]"
                    >
                      Keep Order
                    </button>
                    <button
                      type="button"
                      disabled={!cancelReason.trim()}
                      onClick={() => {
                        onCancelOrder(cancelReason.trim());
                        setCancelling(false);
                        setCancelReason("");
                      }}
                      className="flex-1 py-2 text-sm font-bold rounded-[6px] bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelling(true)}
                  className="w-full py-1.5 text-sm font-semibold text-red-600 dark:text-red-400"
                >
                  Cancel Order
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

