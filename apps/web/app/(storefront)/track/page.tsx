"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../_components/auth-context";
import { Footer } from "../_components/landing/footer";

interface TrackedOrder {
  id: string;
  order_number: string;
  status: "pending" | "paid" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  channel: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  total: number;
  carrier_name?: string | null;
  tracking_number?: string | null;
  carrier_tracking_url?: string | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  customer?: {
    full_name?: string;
    email?: string;
    phone?: string;
  } | null;
  address?: {
    full_name?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
  } | null;
  items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot?: {
      name?: string;
      title?: string;
      image?: string;
      image_url?: string;
      size?: string;
      color?: string;
    } | null;
  }>;
}

const ORDER_STEPS = [
  { key: "paid", label: "Order Placed", desc: "Payment confirmed" },
  { key: "confirmed", label: "Confirmed", desc: "Order verified by team" },
  { key: "processing", label: "Tailoring & Packing", desc: "Prepared at warehouse" },
  { key: "shipped", label: "Dispatched", desc: "In transit with courier" },
  { key: "delivered", label: "Delivered", desc: "Package received" },
];

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, customer } = useAuth();

  const [orderNumber, setOrderNumber] = useState(searchParams.get("order_number") || "");
  const [email, setEmail] = useState(
    searchParams.get("email") || customer?.email || user?.email || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTracking = async (targetOrderNum: string, targetEmail: string) => {
    if (!targetOrderNum.trim() || !targetEmail.trim()) {
      setError("Please provide both order number and email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/orders/track?order_number=${encodeURIComponent(
          targetOrderNum.trim()
        )}&email=${encodeURIComponent(targetEmail.trim())}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Order not found. Please verify your order number and email.");
        setOrder(null);
      } else {
        setOrder(json.data);
      }
    } catch {
      setError("Network error while checking order status. Please try again.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const qOrderNum = searchParams.get("order_number");
    const qEmail = searchParams.get("email") || customer?.email || user?.email;
    if (qOrderNum && qEmail) {
      setOrderNumber(qOrderNum);
      setEmail(qEmail);
      fetchTracking(qOrderNum, qEmail);
    }
  }, [searchParams, customer?.email, user?.email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(orderNumber, email);
  };

  const getStepIndex = (status?: string) => {
    if (!status) return 0;
    if (status === "cancelled" || status === "returned") return -1;
    const map: Record<string, number> = {
      pending: 0,
      paid: 0,
      confirmed: 1,
      processing: 2,
      shipped: 3,
      delivered: 4,
    };
    return map[status] ?? 0;
  };

  const currentStep = getStepIndex(order?.status);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF9] font-sans antialiased text-[#010101]">
      {/* ── Breadcrumb & Top Banner ── */}
      <div className="bg-[#010101] text-white py-12 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 space-y-2.5">
          <span className="text-[#EDCF5D] text-xs font-mono tracking-widest uppercase font-bold">
            Live Dispatch & Fulfillment
          </span>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            Enter your order reference code and checkout email to monitor real-time shipment progress.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* ── Lookup Form ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 font-mono">
                Order Number
              </label>
              <input
                type="text"
                placeholder="e.g. GTS-202609-000123"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-mono focus:outline-none focus:border-[#EDCF5D] focus:ring-1 focus:ring-[#EDCF5D] transition-all"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 font-mono">
                Email Address
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#EDCF5D] focus:ring-1 focus:ring-[#EDCF5D] transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] hover:text-[#010101] text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Track</span>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Order Status & Stepper (When loaded) ── */}
        {order && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Status Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                      Reference
                    </span>
                    <span className="font-mono font-black text-base sm:text-lg text-[#010101]">
                      {order.order_number}
                    </span>
                    <button
                      onClick={() => handleCopy(order.order_number)}
                      title="Copy Reference"
                      className="p-1 text-gray-400 hover:text-black rounded transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                    </button>
                    {copied && <span className="text-[11px] text-emerald-600 font-mono">Copied!</span>}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    Placed on{" "}
                    {new Date(order.created_at).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider font-mono ${
                      order.status === "delivered"
                        ? "bg-emerald-100 text-emerald-800"
                        : order.status === "shipped"
                        ? "bg-sky-100 text-sky-800"
                        : order.status === "cancelled"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="py-4">
                <div className="relative">
                  <div className="hidden sm:block absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 z-0" />
                  <div
                    className="hidden sm:block absolute top-1/2 left-0 h-1 bg-[#010101] -translate-y-1/2 transition-all duration-700 z-0"
                    style={{
                      width: `${Math.max(0, (currentStep / (ORDER_STEPS.length - 1)) * 100)}%`,
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
                    {ORDER_STEPS.map((step, idx) => {
                      const isPast = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      const isFuture = idx > currentStep;

                      return (
                        <div
                          key={step.key}
                          className="flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center"
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-all ${
                              isPast
                                ? "bg-[#010101] text-white ring-4 ring-gray-100"
                                : isCurrent
                                ? "bg-[#EDCF5D] text-[#010101] ring-4 ring-[#EDCF5D]/30 scale-110 shadow-md font-black"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {isPast ? "✓" : idx + 1}
                          </div>

                          <div>
                            <p
                              className={`text-xs font-bold leading-tight ${
                                isCurrent
                                  ? "text-[#010101]"
                                  : isPast
                                  ? "text-gray-800"
                                  : "text-gray-400"
                              }`}
                            >
                              {step.label}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Courier & Shipping Metadata */}
              {(order.carrier_name || order.tracking_number) && (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-[#010101] shadow-2xs">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0c-.565.058-.987.538-.987 1.106v.958m12 0A2.25 2.25 0 0116.5 9.75v5.25m-12 0V9.75A2.25 2.25 0 016.75 7.5h7.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {order.carrier_name || "Express Courier Dispatch"}
                      </p>
                      <p className="text-[11px] font-mono text-gray-500">
                        Waybill / Tracking: {order.tracking_number || "Awaiting courier barcode"}
                      </p>
                    </div>
                  </div>

                  {order.carrier_tracking_url && (
                    <a
                      href={order.carrier_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-[#010101] text-white hover:bg-[#EDCF5D] hover:text-[#010101] font-bold text-xs transition-colors self-start sm:self-auto"
                    >
                      Courier Portal →
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Address & Order Items Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left: Shipping Destination */}
              <div className="md:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider font-mono">
                  Delivery Destination
                </h3>
                {order.address ? (
                  <div className="space-y-1.5 text-xs text-gray-600 leading-relaxed">
                    <p className="font-bold text-gray-900 text-sm">{order.address.full_name}</p>
                    <p>{order.address.address_line1}</p>
                    {order.address.address_line2 && <p>{order.address.address_line2}</p>}
                    <p>
                      {order.address.city}, {order.address.state}
                    </p>
                    {order.address.phone && (
                      <p className="font-mono text-gray-500 pt-1">Tel: {order.address.phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No delivery address recorded.</p>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">Total Charged:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    ₦{(order.total / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Right: Order Items preview */}
              <div className="md:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider font-mono">
                  Items in Shipment ({order.items?.length || 0})
                </h3>

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
                  {(order.items || []).map((item, idx) => {
                    const snap = item.product_snapshot || {};
                    return (
                      <div key={item.id || idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 shrink-0 relative overflow-hidden flex items-center justify-center">
                            {snap.image || snap.image_url ? (
                              <Image
                                src={snap.image || snap.image_url!}
                                alt={snap.name || snap.title || "Product"}
                                fill
                                unoptimized
                                className="object-contain p-1"
                              />
                            ) : (
                              <span className="text-lg">👔</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {snap.name || snap.title || "Tailored Garment"}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono">
                              Qty: {item.quantity} {snap.size ? `· Size: ${snap.size}` : ""}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-bold font-mono text-gray-900 shrink-0">
                          ₦{(item.line_total / 100).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFCF9]">
          <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
