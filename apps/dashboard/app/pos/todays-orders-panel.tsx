"use client";

import { useState } from "react";
import { formatKobo } from "@gts/utils";

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
  status: "completed" | "voided";
  total: number;
  created_at: string;
  items: TodaysOrderItem[];
}

interface TodaysOrdersPanelProps {
  orders: TodaysOrder[];
  onVoid: (orderId: string, reason: string) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<TodaysOrder["status"], string> = {
  completed: "Completed",
  voided: "Voided",
};

/** gts_03_cashier_spec.md Part 6. */
export default function TodaysOrdersPanel({ orders, onVoid, onClose }: TodaysOrdersPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#1C1C1C] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Today&apos;s Orders</h2>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            &times;
          </button>
        </div>

        {orders.length === 0 && (
          <p className="text-sm text-gray-500 text-center pt-10">No orders yet today.</p>
        )}

        {orders.map((order) => (
          <div key={order.id} className="rounded-[8px] border border-gray-200 dark:border-[#262626] p-3">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(order.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatKobo(order.total)}</p>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    order.status === "completed"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-500 dark:bg-[#242424] dark:text-gray-400"
                  }`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
            </button>

            {expandedId === order.id && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[#262626] space-y-1">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>
                      {item.quantity} x {item.product_snapshot.name}
                    </span>
                    <span>{formatKobo(item.line_total)}</span>
                  </div>
                ))}

                {order.status === "completed" &&
                  (voidingId === order.id ? (
                    <div className="pt-2 space-y-2">
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for void"
                        className="w-full px-2 py-1.5 text-xs rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingId(null);
                            setReason("");
                          }}
                          className="flex-1 py-1.5 text-xs font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]"
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
                          className="flex-1 py-1.5 text-xs font-bold rounded-[6px] bg-red-600 text-white disabled:opacity-40"
                        >
                          Confirm Void
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVoidingId(order.id)}
                      className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400"
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
