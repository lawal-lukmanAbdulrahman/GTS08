"use client";

import { useState, useEffect } from "react";
import { formatWAT, getOrderPickupPin, formatPickupPin } from "@gts/utils";
import { API_BASE } from "../../lib/api-base";
import { authFetch } from "../../lib/session";
import { describeStatus, FORWARD_NEXT, BACKWARD_STEP, requiresReason } from "./order-status-options";

export interface OrderInfoDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: () => Promise<void>;
  initialAction?: "forward" | "backward" | "hold" | "cancel" | "reopen" | "pay" | "complete_pickup" | null;
}

export interface DetailedOrder {
  id: string;
  order_number: string;
  channel?: string;
  status: string;
  payment_status: "unpaid" | "paid";
  payment_method?: string | null;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  created_at: string;
  updated_at?: string;
  delivered_at?: string | null;
  pickup_deadline?: string | null;
  ready_for_pickup_at?: string | null;
  cancel_reason?: string | null;
  hold_reason?: string | null;
  internal_notes?: string | null;
  paid_at?: string | null;
  tracking_number?: string | null;
  pickup_pin?: string | null;
  pickup_station?: {
    id?: string;
    name: string;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    phone?: string | null;
    operating_hours?: string | null;
    notes?: string | null;
  } | null;
  customer?: { full_name?: string; email?: string; phone?: string } | null;
  items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot?: {
      name?: string;
      size?: string | null;
      color?: string | null;
      sku?: string | null;
      image?: string | null;
    } | null;
  }>;
  audit_log?: Array<{
    id: string;
    action: string;
    changes?: any;
    created_at: string;
    actor?: { full_name?: string; email?: string } | null;
  }>;
}

const ORDER_PIPELINE_STEPS = [
  { key: "placed", label: "Placed", desc: "Order placed" },
  { key: "confirmed", label: "Confirmed", desc: "Verified & Packaging" },
  { key: "ready_for_pickup", label: "Ready for Pickup", desc: "Packaged on shelf" },
  { key: "collected", label: "Collected", desc: "Picked up" },
];

export default function OrderInfoDrawer({
  orderId,
  isOpen,
  onClose,
  onStatusUpdated,
  initialAction,
}: OrderInfoDrawerProps) {
  const [order, setOrder] = useState<DetailedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-actions modal state
  const [actionType, setActionType] = useState<"forward" | "backward" | "hold" | "cancel" | "reopen" | "pay" | "complete_pickup" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [selectedPayMethod, setSelectedPayMethod] = useState<"cash" | "pos" | "transfer">("cash");
  const [pickupPinInput, setPickupPinInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  const fetchOrderDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/orders/${id}`);
      if (res.ok) {
        const json = await res.json();
        setOrder(json.data);
      } else {
        setError("Failed to load order details.");
      }
    } catch {
      setError("Network error while loading order details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetail(orderId);
      setActionType(initialAction || null);
      setActionReason("");
      setPickupPinInput("");
      setDrawerNotice(null);
    } else {
      setOrder(null);
      setActionType(null);
      setPickupPinInput("");
    }
  }, [isOpen, orderId, initialAction]);

  if (!isOpen || !orderId) return null;

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

  const getStepIndex = (status?: string) => {
    if (!status) return 0;
    if (status === "cancelled" || status === "expired" || status === "on_hold") return -1;
    const map: Record<string, number> = {
      placed: 0,
      pending: 0,
      pending_payment: 0,
      confirmed: 1,
      ready_for_pickup: 2,
      collected: 3,
    };
    return map[status] ?? 0;
  };

  const currentStep = getStepIndex(order?.status);

  const handleExecuteAction = async () => {
    if (!order || !actionType) return;
    setActionLoading(true);
    setActionError(null);

    const token = localStorage.getItem("gts_token");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    try {
      if (actionType === "forward") {
        const currentNormalized = order.status === "pending_payment" || order.status === "pending" ? "placed" : order.status;
        const next = FORWARD_NEXT[currentNormalized];
        if (!next) return;

        const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: next, reason: actionReason.trim() || undefined }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice(`Order status advanced to ${describeStatus(next)}.`);
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to update order status.");
        }
      } else if (actionType === "backward") {
        const prev = BACKWARD_STEP[order.status];
        if (!prev) return;
        if (!actionReason.trim()) {
          setActionError("A reason is required to move an order backward.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: prev, reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice(`Order moved back to ${describeStatus(prev)}.`);
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to move order backward.");
        }
      } else if (actionType === "hold") {
        if (!actionReason.trim()) {
          setActionError("A reason is required to place an order on hold.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "on_hold", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice("Order placed on hold.");
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to put order on hold.");
        }
      } else if (actionType === "cancel") {
        if (!actionReason.trim()) {
          setActionError("A cancellation reason is required.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "cancelled", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice("Order cancelled and inventory holds released.");
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to cancel order.");
        }
      } else if (actionType === "reopen") {
        if (!actionReason.trim()) {
          setActionError("A reason is required to reopen an expired order.");
          setActionLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "ready_for_pickup", reason: actionReason.trim() }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice("Order reopened to ready for pickup.");
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to reopen order.");
        }
      } else if (actionType === "pay") {
        const res = await fetch(`${API_BASE}/orders/${order.id}/pay`, {
          method: "POST",
          headers,
          body: JSON.stringify({ payment_method: selectedPayMethod, note: actionReason.trim() || undefined }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice(`Payment marked as paid (${selectedPayMethod.toUpperCase()}).`);
          setActionType(null);
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to mark order as paid.");
        }
      } else if (actionType === "complete_pickup") {
        const isWalkIn = order.channel === "pos" || order.channel === "walk_in";
        const cleanPin = pickupPinInput.trim().replace(/\s+/g, "");
        if (!isWalkIn && !cleanPin) {
          setActionError("Customer 6-digit collection PIN is required to complete handover.");
          setActionLoading(false);
          return;
        }
        const isUnpaid = order.payment_status !== "paid";
        const res = await fetch(`${API_BASE}/orders/${order.id}/complete-pickup`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            pickup_pin: !isWalkIn ? cleanPin : undefined,
            mark_paid: isUnpaid,
            payment_method: isUnpaid ? selectedPayMethod : undefined,
            note: actionReason.trim() || undefined,
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setDrawerNotice("Pickup handover completed successfully! Order collected.");
          setActionType(null);
          setPickupPinInput("");
          await fetchOrderDetail(order.id);
          await onStatusUpdated();
        } else {
          setActionError(json?.error || "Failed to complete pickup handover.");
        }
      }
    } catch {
      setActionError("Network error while updating order.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Slide-over Side Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl lg:max-w-3xl bg-white dark:bg-[#151515] border-l border-gray-200 dark:border-[#262626] shadow-2xl flex flex-col justify-between animate-slideLeft">
          {/* Top Sticky Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#242424] flex items-center justify-between bg-white dark:bg-[#151515] sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base sm:text-lg font-black text-gray-900 dark:text-white">
                {order ? order.order_number : "Loading Order..."}
              </span>
              {order && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    order.status === "collected"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : order.status === "ready_for_pickup"
                      ? "bg-[#EDCF5D]/25 text-[#9E7B00] dark:text-[#EDCF5D] font-bold"
                      : order.status === "confirmed"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                      : order.status === "placed" || order.status === "pending_payment"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : order.status === "on_hold"
                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {describeStatus(order.status)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#242424] text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close drawer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading || !order ? (
              <div className="py-32 flex flex-col items-center justify-center gap-3 text-gray-400 font-mono text-xs">
                <div className="w-6 h-6 border-2 border-[#EDCF5D] border-t-transparent rounded-full animate-spin" />
                <span>Loading order information...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            ) : (
              <>
                {drawerNotice && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in shadow-2xs">
                    <span>{drawerNotice}</span>
                    <button type="button" onClick={() => setDrawerNotice(null)} className="text-emerald-600 font-bold ml-2">
                      ✕
                    </button>
                  </div>
                )}

                {/* ── 1. Fulfillment Pipeline Stepper ── */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                      Fulfillment Pipeline
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      Placed {formatWAT(order.created_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {ORDER_PIPELINE_STEPS.map((step, idx) => {
                      const isPast = currentStep !== -1 && idx < currentStep;
                      const isCurrent = currentStep !== -1 && idx === currentStep;

                      return (
                        <div
                          key={step.key}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            isCurrent
                              ? "bg-[#EDCF5D]/20 border-[#EDCF5D] text-black dark:text-white font-bold ring-2 ring-[#EDCF5D]/40"
                              : isPast
                              ? "bg-white dark:bg-[#202020] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-semibold"
                              : "bg-white/50 dark:bg-[#1E1E1E]/50 border-gray-200 dark:border-[#2C2C2C] text-gray-400 opacity-60"
                          }`}
                        >
                          <div className="text-[10px] font-mono uppercase mb-0.5">
                            Step {idx + 1} {isPast ? "✓" : ""}
                          </div>
                          <div className="text-xs font-bold truncate">{step.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── 2. Primary Action / Next Step Card ── */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2A2A2A] shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-gray-400">
                      Current Action Required
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase ${
                        order.payment_status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
                      }`}
                    >
                      {order.payment_status === "paid" ? "Paid" : "Payment Due at Pickup"}
                    </span>
                  </div>

                  {/* If placed / pending */}
                  {(order.status === "placed" || order.status === "pending_payment" || order.status === "pending") && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                        <p className="font-bold">Order Received</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                          Verify the items in the order, confirm availability, and begin packaging. The pickup deadline will not start counting down until the items are packaged and marked ready.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActionType("forward");
                          setActionReason("");
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-[#010101] dark:bg-white text-white dark:text-black hover:opacity-90 font-bold text-xs tracking-wide shadow-sm cursor-pointer transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Confirm Order (Start Packaging) →</span>
                      </button>
                    </div>
                  )}

                  {/* If confirmed */}
                  {order.status === "confirmed" && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-xs text-sky-900 dark:text-sky-200">
                        <p className="font-bold">Packaging in Progress</p>
                        <p className="text-[11px] text-sky-800 dark:text-sky-300 mt-0.5">
                          When the order has been packaged and placed on the collection shelf, click below. This will set the store pickup window and automatically notify the customer that their package is ready with collection hours and direct tracking.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActionType("forward");
                          setActionReason("");
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-[#EDCF5D] hover:bg-[#e2c34d] text-black font-extrabold text-xs tracking-wide shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.25A2.25 2.25 0 010 18.75V10.5m18 10.5h3.75A2.25 2.25 0 0024 18.75V10.5M9.75 21V9.75" />
                        </svg>
                        <span>Mark Ready for Pickup (Packaged & Ready) →</span>
                      </button>
                    </div>
                  )}

                  {/* If ready_for_pickup */}
                  {order.status === "ready_for_pickup" && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Awaiting Customer Collection</span>
                          {order.pickup_deadline && (
                            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">
                              Collect by: {formatWAT(order.pickup_deadline)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          {order.payment_status === "paid"
                            ? "Customer has already paid. Hand over garments upon verifying order reference code."
                            : `Customer must pay ${formatNaira(order.total)} at the till before handing over items.`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionType("complete_pickup");
                            setActionReason("");
                          }}
                          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span>
                            {order.payment_status === "paid"
                              ? "Complete Pickup Handover"
                              : `Atomic Pay (₦${(order.total / 100).toLocaleString()}) & Hand Over Items`}
                          </span>
                        </button>

                        {order.payment_status !== "paid" && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionType("pay");
                              setActionReason("");
                            }}
                            className="w-full py-2 px-3 rounded-xl border border-gray-300 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525] font-bold text-xs cursor-pointer"
                          >
                            Mark Paid Separately (Cash / POS / Transfer)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* If collected */}
                  {order.status === "collected" && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Order completed and collected on {order.delivered_at ? formatWAT(order.delivered_at) : "earlier"}.
                      </span>
                    </div>
                  )}

                  {/* Secondary controls row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-[#282828] flex-wrap">
                    {BACKWARD_STEP[order.status] && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("backward");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2C2C2C] text-gray-600 dark:text-gray-400 hover:bg-gray-100 text-xs font-semibold cursor-pointer"
                      >
                        ← Move back a step
                      </button>
                    )}

                    {["placed", "confirmed", "ready_for_pickup"].includes(order.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("hold");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2C2C2C] text-purple-700 dark:text-purple-400 hover:bg-purple-50 text-xs font-semibold cursor-pointer"
                      >
                        Put on hold
                      </button>
                    )}

                    {order.status !== "collected" && order.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("cancel");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Cancel order
                      </button>
                    )}

                    {order.status === "expired" && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionType("reopen");
                          setActionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold cursor-pointer"
                      >
                        Reopen order
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 3. Customer & Pickup Station Information Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Anti-Theft Verification PIN (for Staff Handover Reference) */}
                  {order.status === "ready_for_pickup" && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between sm:col-span-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[10px] font-bold uppercase text-amber-800 dark:text-amber-400 tracking-wider">
                          Anti-Theft Collection PIN
                        </span>
                        <p className="text-xs text-amber-900 dark:text-amber-300">
                          Customer must provide this 6-digit PIN upon arrival to collect order.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-base font-black tracking-widest text-[#010101] dark:text-white bg-white dark:bg-[#141414] px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-2xs inline-block">
                          {formatPickupPin(order.tracking_number || getOrderPickupPin(order))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Customer Card */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5 shadow-2xs">
                    <span className="font-mono text-[10px] font-bold uppercase text-gray-400">
                      Customer
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {order.customer?.full_name || "Guest Customer"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {order.customer?.email || "No email"}
                    </p>
                    <p className="font-mono text-gray-500">
                      {order.customer?.phone || "No phone"}
                    </p>
                  </div>

                  {/* Pickup Station Card */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5 shadow-2xs">
                    <span className="font-mono text-[10px] font-bold uppercase text-gray-400">
                      Pickup Station
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {order.pickup_station?.name || "Main Store"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {order.pickup_station?.address_line1 || "12 Allen Avenue"}
                    </p>
                    <p className="text-gray-500">
                      {order.pickup_station?.city || "Ikeja"}{order.pickup_station?.state ? `, ${order.pickup_station.state}` : ""}
                    </p>
                    {order.pickup_station?.operating_hours && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-400 pt-0.5">
                        Hours: {order.pickup_station.operating_hours}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── 4. Items Bought Breakdown ── */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#282828]">
                    <h4 className="font-mono font-bold text-xs uppercase text-gray-400">
                      Items Bought ({order.items?.length || 0})
                    </h4>
                    <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                      Total: {formatNaira(order.total)}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-[#282828]">
                    {(order.items || []).map((it) => (
                      <div key={it.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {it.product_snapshot?.image ? (
                            <img
                              src={it.product_snapshot.image}
                              alt={it.product_snapshot.name || "Product"}
                              className="w-10 h-10 rounded-lg object-contain bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#333333] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#202020] flex items-center justify-center text-gray-400 text-xs shrink-0">
                              👕
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                              {it.product_snapshot?.name || "Garment"}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                              Qty: {it.quantity} {it.product_snapshot?.size ? `· ${it.product_snapshot.size}` : ""} {it.product_snapshot?.color ? `· ${it.product_snapshot.color}` : ""}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-gray-900 dark:text-white shrink-0">
                          {formatNaira(it.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-[#282828] space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal:</span>
                      <span>{formatNaira(order.subtotal || order.total)}</span>
                    </div>
                    {order.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount:</span>
                        <span>-{formatNaira(order.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-gray-900 dark:text-white pt-1 border-t border-dashed border-gray-200 dark:border-[#333]">
                      <span>Grand Total:</span>
                      <span>{formatNaira(order.total)}</span>
                    </div>
                  </div>
                </div>

                {/* ── 5. Audit Trail & History ── */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] shadow-2xs space-y-3">
                  <h4 className="font-mono font-bold text-xs uppercase text-gray-400">
                    Audit Trail & History
                  </h4>
                  {(!order.audit_log || order.audit_log.length === 0) ? (
                    <p className="text-xs text-gray-400 italic">No activity logged yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {order.audit_log.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] border border-gray-100 dark:border-[#282828] text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span>{log.actor?.full_name || log.actor?.email || "System"}</span>
                            <span>{formatWAT(log.created_at)}</span>
                          </div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          {log.changes?.reason && (
                            <p className="text-gray-500 italic">Reason: {log.changes.reason}</p>
                          )}
                          {log.changes?.payment_method && (
                            <p className="text-gray-500">Method: {log.changes.payment_method}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ────── ACTION PROMPT / REASON SUB-MODAL ────── */}
      {actionType && order && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-[#262626] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white capitalize">
              {actionType === "complete_pickup"
                ? "Complete Order Pickup"
                : actionType === "pay"
                ? "Mark Order as Paid"
                : actionType === "cancel"
                ? "Cancel Order"
                : actionType === "hold"
                ? "Place Order on Hold"
                : actionType === "backward"
                ? "Move Order Backward"
                : actionType === "reopen"
                ? "Reopen Expired Order"
                : "Advance Order"}
            </h3>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            {(actionType === "complete_pickup" && order.payment_status !== "paid") || actionType === "pay" ? (
              <div className="space-y-2 text-xs">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "pos", "transfer"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedPayMethod(m)}
                      className={`p-2 rounded-xl border text-center font-bold font-mono uppercase cursor-pointer ${
                        selectedPayMethod === m
                          ? "border-black dark:border-white bg-[#010101] text-white dark:bg-white dark:text-black"
                          : "border-gray-200 dark:border-[#2C2C2C] text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 pt-1 font-mono">
                  Amount to Collect: {formatNaira(order.total)}
                </p>
              </div>
            ) : null}

            {actionType === "complete_pickup" && order.channel !== "pos" && order.channel !== "walk_in" && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-amber-900 dark:text-amber-300 font-mono uppercase tracking-wider text-[11px]">
                    Customer 6-Digit Collection PIN *
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase">
                    Anti-Theft Check
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  Enter the 6-digit PIN shown on the customer&apos;s tracking pass or order email.
                </p>
                <input
                  type="text"
                  maxLength={7}
                  placeholder="e.g. 481 920"
                  value={pickupPinInput}
                  onChange={(e) => setPickupPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-[#141414] text-base font-mono font-black tracking-widest text-center text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-gray-700 dark:text-gray-300">
                {requiresReason(order.status, actionType === "forward" ? FORWARD_NEXT[order.status] || "" : actionType)
                  ? "Reason (Required) *"
                  : "Internal Note / Reason (Optional)"}
              </label>
              <textarea
                rows={3}
                placeholder="Enter details for the audit log..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#141414] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#2C2C2C] text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 ${
                  actionType === "cancel"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black hover:opacity-90"
                }`}
              >
                {actionLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                )}
                <span>{actionType === "cancel" ? "Confirm Cancellation" : "Confirm"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
