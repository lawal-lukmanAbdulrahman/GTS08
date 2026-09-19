"use client";

import { API_BASE } from "../../lib/api-base";
import { useEffect, useState } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { idempotentFetch } from "@gts/utils";

interface OrderItem {
  id: string;
  order_number: string;
  channel: string;
  status: string;
  total: number;
  created_at: string;
  carrier_name?: string;
  tracking_number?: string;
  customer?: { full_name: string; email: string; phone?: string };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Selected Order Modal
  const [activeOrder, setActiveOrder] = useState<OrderItem | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("gts_token");
      const url =
        selectedStatus === "all"
          ? `${API_BASE}/orders`
          : `${API_BASE}/orders?status=${selectedStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch {
      // API offline fallback
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    try {
      const token = localStorage.getItem("gts_token");
      const res = await idempotentFetch(`${API_BASE}/orders/${activeOrder.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          carrier_name: carrierName || undefined,
          tracking_number: trackingNumber || undefined,
        }),
      });

      if (res.ok) {
        setActiveOrder(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

  const statusOptions = [
    "all",
    "pending_payment",
    "paid",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip
        breadcrumbs={[
          { label: "Orders", href: "/admin/orders" },
          { label: "Fulfillment" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Order Pipeline & Fulfillment</h1>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">Track, process, and update shipping details for online & walk-in sales</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-[#2A2C32]">
        {statusOptions.map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
              selectedStatus === st
                ? "bg-[#EDCF5D] text-[#121316] font-bold shadow-md shadow-[#EDCF5D]/10"
                : "bg-gray-100 dark:bg-[#1C1E22] text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#2A2C32]"
            }`}
          >
            {st.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-[#1C1E22] rounded-xl border border-gray-200 dark:border-[#2A2C32]" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1E22] rounded-2xl border border-gray-200 dark:border-[#2A2C32] overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#2A2C32] bg-gray-50 dark:bg-[#16171A] text-gray-500 dark:text-[#6B7280] font-semibold uppercase text-[10px]">
                <th className="p-4">Order #</th>
                <th className="p-4">Channel</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Status</th>
                <th className="p-4">Courier Info</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2A2C32]/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 dark:text-[#6B7280] font-mono">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-[#23252B] transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">{o.order_number}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {o.channel}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-[#9CA3AF]">
                      <p className="font-bold text-gray-900 dark:text-white">{o.customer?.full_name || "Guest"}</p>
                      <p className="text-[10px] text-gray-400 dark:text-[#6B7280] font-mono">{o.customer?.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#2A2C32] text-gray-800 dark:text-white border border-gray-200 dark:border-transparent">
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-[#9CA3AF]">
                      {o.carrier_name ? (
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{o.carrier_name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-[#6B7280] font-mono">#{o.tracking_number}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-[#6B7280] font-normal">Not assigned</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-[#EDCF5D]">{formatNaira(o.total)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setActiveOrder(o);
                          setNewStatus(o.status);
                          setCarrierName(o.carrier_name || "");
                          setTrackingNumber(o.tracking_number || "");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#2A2C32] text-gray-700 dark:text-white hover:bg-[#EDCF5D] hover:text-[#121316] font-bold text-xs transition-colors cursor-pointer border border-gray-200 dark:border-transparent"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for managing order status & courier info */}
      {activeOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1C1E22] border border-gray-200 dark:border-[#2A2C32] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Order {activeOrder.order_number}</h2>
            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-[#9CA3AF] mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#16171A] border border-gray-200 dark:border-[#2A2C32] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                >
                  <option value="pending_payment">Pending Payment</option>
                  <option value="paid">Paid</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-[#9CA3AF] mb-1">Courier / Carrier Name</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  placeholder="e.g. GIG Logistics / Kwik / DHL"
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#16171A] border border-gray-200 dark:border-[#2A2C32] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-[#9CA3AF] mb-1">Courier Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. GIG-99881122"
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#16171A] border border-gray-200 dark:border-[#2A2C32] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2C32] text-gray-600 dark:text-[#9CA3AF] font-bold hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#16171A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#EDCF5D] text-[#121316] hover:bg-white font-bold"
                >
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
