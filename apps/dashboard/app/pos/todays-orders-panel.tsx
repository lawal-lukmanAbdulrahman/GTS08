"use client";

import { useState } from "react";
import { formatKobo } from "@gts/utils";
import { fetchAndDownloadReceipt, fetchAndPrintReceipt } from "./receipt-pdf";

interface TodaysOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_snapshot: { name: string };
}

interface TodaysOrder {
  id: string;
  order_number: string;
  status: "completed" | "collected" | "voided" | string;
  total: number;
  created_at: string;
  items: TodaysOrderItem[];
}

interface TodaysOrdersPanelProps {
  orders: TodaysOrder[];
  loading?: boolean;
  store?: import("./receipt").ReceiptStore;
  /** Whether this staff member holds the void permission (default: yes). */
  canVoid?: boolean;
  onVoid: (orderId: string, reason: string) => void;
  onReprint?: (orderId: string) => void;
  onDownloadReceipt?: (orderId: string) => Promise<void> | void;
  onPrintReceipt?: (orderId: string) => Promise<void> | void;
  reprintError?: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  collected: "Collected",
  voided: "Voided",
};

/** gts_03_cashier_spec.md Part 6. */
export default function TodaysOrdersPanel({
  orders,
  loading = false,
  store,
  canVoid = true,
  onVoid,
  onReprint,
  onDownloadReceipt,
  onPrintReceipt,
  reprintError,
  onClose,
}: TodaysOrdersPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDownload = async (orderId: string) => {
    if (onDownloadReceipt) {
      await onDownloadReceipt(orderId);
      return;
    }
    setDownloadingId(orderId);
    setActionError(null);
    const result = await fetchAndDownloadReceipt(orderId, store);
    if (!result.ok) {
      setActionError(result.message);
    }
    setDownloadingId(null);
  };

  const handlePrint = async (orderId: string) => {
    if (onPrintReceipt) {
      await onPrintReceipt(orderId);
      return;
    }
    if (onReprint) {
      onReprint(orderId);
      return;
    }
    setPrintingId(orderId);
    setActionError(null);
    const result = await fetchAndPrintReceipt(orderId, store);
    if (!result.ok) {
      setActionError(result.message);
    }
    setPrintingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#1C1C1C] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Today&apos;s Orders</h2>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            &times;
          </button>
        </div>

        {reprintError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {reprintError}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 space-y-3">
            <svg
              className="w-8 h-8 animate-spin text-[#010101] dark:text-[#EDCF5D]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Loading today&apos;s orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-base text-gray-500 text-center pt-10">No orders yet today.</p>
        ) : null}

        {orders.map((order) => (
          <div key={order.id} className="rounded-[8px] border border-gray-200 dark:border-[#262626] p-3">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(order.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900 dark:text-white">{formatKobo(order.total)}</p>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    order.status === "completed" || order.status === "collected"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-500 dark:bg-[#242424] dark:text-gray-400"
                  }`}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>
            </button>

            {expandedId === order.id && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-[#262626] space-y-2.5">
                <div className="space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                      <span>
                        {item.quantity} x {item.product_snapshot.name}
                      </span>
                      <span>{formatKobo(item.line_total)}</span>
                    </div>
                  ))}
                </div>

                {actionError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {actionError}
                  </p>
                )}

                {(order.status === "completed" || order.status === "collected") && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={downloadingId === order.id}
                      onClick={() => handleDownload(order.id)}
                      className="flex-1 min-w-[125px] py-1.5 px-3 rounded-[6px] text-xs font-bold border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#242424] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2e2e2e] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {downloadingId === order.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      )}
                      <span>Download Receipt</span>
                    </button>

                    <button
                      type="button"
                      aria-label="Print receipt / Reprint receipt"
                      disabled={printingId === order.id}
                      onClick={() => handlePrint(order.id)}
                      className="flex-1 min-w-[125px] py-1.5 px-3 rounded-[6px] text-xs font-bold bg-[#EDCF5D] hover:bg-[#e2c34d] text-[#010101] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {printingId === order.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.076-.672-2.03-1.27-2.829m13.05 0c-.598.799-1.03 1.753-1.27 2.829m-10.51 0a24.25 24.25 0 0110.51 0m-10.51 0L4.5 18.75m15 0l-1.72-4.921M8.25 9.75h7.5M8.25 6.75h7.5M6 18.75h12M6 18.75a2.25 2.25 0 01-2.25-2.25V9.75a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25" />
                        </svg>
                      )}
                      <span>Print Receipt</span>
                    </button>
                  </div>
                )}

                {order.status === "completed" && !canVoid && (
                  <p className="pt-1 text-sm text-gray-500 dark:text-gray-400">
                    Ask a manager to void this order.
                  </p>
                )}

                {order.status === "completed" &&
                  canVoid &&
                  (voidingId === order.id ? (
                    <div className="pt-1 space-y-2">
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for void"
                        className="w-full px-2 py-1.5 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingId(null);
                            setReason("");
                          }}
                          className="flex-1 py-1.5 text-sm font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!reason.trim()}
                          onClick={() => {
                            onVoid(order.id, reason);
                            setVoidingId(null);
                            setReason("");
                          }}
                          className="flex-1 py-1.5 text-sm font-bold rounded-[6px] bg-red-600 text-white disabled:opacity-40"
                        >
                          Confirm Void
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVoidingId(order.id)}
                      className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Void Order
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
