"use client";

import { useState } from "react";
import { formatKobo } from "@gts/utils";
import type { CartLine, PaymentMethod } from "./pos-types";

interface FoundOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product_snapshot: { name: string };
}

interface FoundOrder {
  order_number: string;
  total: number;
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
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onCreateOrder: () => void;
  createdOrderNumber: string | null;

  // confirm mode
  lookupOrderNumber: string;
  onLookupOrderNumberChange: (value: string) => void;
  onLookup: () => void;
  lookupError: string | null;
  foundOrder: FoundOrder | null;
  paymentMethod: PaymentMethod | null;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onConfirmPayment: () => void;
  onCancelOrder: (reason: string) => void;
  cancelledOrderNumber: string | null;
  /** Orders waiting for payment; picking one saves typing its number. */
  pendingOrders?: PendingWhatsAppOrder[];
  pendingLoading?: boolean;
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
  onCustomerNameChange,
  onCustomerPhoneChange,
  onIncrement,
  onDecrement,
  onRemove,
  onCreateOrder,
  createdOrderNumber,
  lookupOrderNumber,
  onLookupOrderNumberChange,
  onLookup,
  lookupError,
  foundOrder,
  paymentMethod,
  onPaymentMethodChange,
  onConfirmPayment,
  onCancelOrder,
  cancelledOrderNumber,
  pendingOrders,
  pendingLoading = false,
  onSelectPending,
  onRefreshPending,
}: WhatsAppPanelProps) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const canCreate = cartLines.length > 0 && customerName.trim() !== "" && customerPhone.trim() !== "";

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange("create")}
          className={`flex-1 py-2 rounded-[6px] text-xs font-semibold ${
            mode === "create" ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
          }`}
        >
          Record New Order
        </button>
        <button
          type="button"
          onClick={() => onModeChange("confirm")}
          className={`flex-1 py-2 rounded-[6px] text-xs font-semibold ${
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
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Customer name"
            className="px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="Customer WhatsApp number"
            className="px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
          />

          <div className="flex-1 space-y-2">
            {cartLines.length === 0 ? (
              <p className="text-sm text-gray-500 text-center pt-6">
                Add products from the left as the customer lists them.
              </p>
            ) : (
              cartLines.map((line) => (
                <div key={line.variantId} className="flex items-center gap-2 p-2 rounded-[6px] border border-gray-200 dark:border-[#262626]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{line.productName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" aria-label="-" onClick={() => onDecrement(line.variantId)} className="w-5 h-5 rounded-full border text-xs">-</button>
                      <span className="text-xs font-mono">{line.quantity}</span>
                      <button type="button" aria-label="+" onClick={() => onIncrement(line.variantId)} className="w-5 h-5 rounded-full border text-xs">+</button>
                      <span className="text-xs font-semibold ml-1">{formatKobo(line.unitPrice * line.quantity)}</span>
                    </div>
                  </div>
                  <button type="button" aria-label={`Remove ${line.productName}`} onClick={() => onRemove(line.variantId)} className="text-gray-400 text-lg">&times;</button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            disabled={!canCreate}
            onClick={onCreateOrder}
            className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Order
          </button>

          {createdOrderNumber && (
            <div className="p-3 rounded-[8px] bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-800 dark:text-emerald-300">
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
              value={lookupOrderNumber}
              onChange={(e) => onLookupOrderNumberChange(e.target.value)}
              placeholder="Order number (e.g. GTS-202609-000002)"
              className="flex-1 px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
            />
            <button type="button" onClick={onLookup} className="px-3 py-2 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
              Look Up
            </button>
          </div>

          {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}

          {cancelledOrderNumber && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Order {cancelledOrderNumber} was cancelled and its reserved stock released.
            </p>
          )}

          {!foundOrder && pendingOrders && (
            <div className="space-y-2 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Waiting for payment</p>
                {onRefreshPending && (
                  <button type="button" onClick={onRefreshPending} className="text-xs font-semibold underline">
                    Refresh
                  </button>
                )}
              </div>
              {pendingLoading ? (
                <p className="text-sm text-gray-500 text-center pt-4">Loading orders...</p>
              ) : pendingOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center pt-4">No WhatsApp orders waiting for payment.</p>
              ) : (
                pendingOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onSelectPending?.(order.order_number)}
                    className="w-full flex items-center justify-between text-left p-2.5 rounded-[8px] border border-gray-200 dark:border-[#262626] hover:border-gray-400 dark:hover:border-[#444]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {order.customer_name ?? "Unnamed customer"} · {order.item_count} item{order.item_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatKobo(order.total)}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {foundOrder && (
            <div className="space-y-3">
              <div className="space-y-1">
                {foundOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
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

              <div className="flex gap-2">
                {(["cash", "pos_terminal"] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onPaymentMethodChange(method)}
                    className={`flex-1 py-2 rounded-[6px] text-xs font-semibold border ${
                      paymentMethod === method
                        ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                        : "border-gray-200 dark:border-[#383838]"
                    }`}
                  >
                    {method === "cash" ? "Cash" : "Card Terminal"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!paymentMethod}
                onClick={onConfirmPayment}
                className="w-full py-2.5 rounded-[8px] bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Payment — {formatKobo(foundOrder.total)}
              </button>

              {cancelling ? (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancelling"
                    className="w-full px-3 py-2 text-xs rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCancelling(false);
                        setCancelReason("");
                      }}
                      className="flex-1 py-2 text-xs font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]"
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
                      className="flex-1 py-2 text-xs font-bold rounded-[6px] bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelling(true)}
                  className="w-full py-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
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
