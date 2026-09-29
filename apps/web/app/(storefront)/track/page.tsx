"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../_components/auth-context";
import { Footer } from "../_components/landing/footer";
import { imageUrl } from "../_lib/catalogue";
import { useStoreInfo } from "../_lib/store-info";
import { formatWAT } from "@gts/utils";

interface TrackedOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: "unpaid" | "paid";
  payment_method?: string | null;
  cancel_reason?: string | null;
  hold_reason?: string | null;
  ready_for_pickup_at?: string | null;
  pickup_deadline?: string | null;
  channel: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  total: number;
  paid_at?: string | null;
  created_at: string;
  customer?: {
    full_name?: string;
    email?: string;
    phone?: string;
  } | null;
  pickup_station?: {
    id: string;
    name: string;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    phone?: string | null;
    operating_hours?: string | null;
    notes?: string | null;
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
  { key: "placed", label: "Order Placed", desc: "We've received your order" },
  { key: "confirmed", label: "Confirmed", desc: "Order verified by our team" },
  { key: "ready_for_pickup", label: "Ready for Pickup", desc: "Ready for collection" },
  { key: "collected", label: "Collected", desc: "Order picked up" },
];

function ItemThumbnail({ image, name }: { image?: string | null; name?: string | null }) {
  const [hasError, setHasError] = useState(false);
  const src = image ? imageUrl(image) : null;
  const isFallback = !src || src.includes("placeholder.svg") || hasError;

  if (isFallback) {
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 shrink-0 flex items-center justify-center text-gray-400">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 shrink-0 relative overflow-hidden flex items-center justify-center">
      <Image
        src={src}
        alt={name || "Product"}
        fill
        unoptimized
        onError={() => setHasError(true)}
        className="object-contain p-1"
      />
    </div>
  );
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const _router = useRouter();
  const { user, customer } = useAuth();

  const loggedInEmail = (customer?.email || user?.email || "").trim();

  const [orderNumber, setOrderNumber] = useState(searchParams.get("order_number") || "");
  const [email, setEmail] = useState(
    loggedInEmail || searchParams.get("email") || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  // The prefilled email address must ALWAYS be the logged-in email address
  useEffect(() => {
    if (loggedInEmail) {
      setEmail(loggedInEmail);
    }
  }, [loggedInEmail]);

  const normalizeOrderNumber = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    return trimmed.toUpperCase().startsWith("GTS-") ? trimmed.toUpperCase() : `GTS-${trimmed.toUpperCase()}`;
  };

  const fetchTracking = async (targetOrderNum: string, targetEmail: string) => {
    const rawNum = targetOrderNum.trim();
    const cleanNum = normalizeOrderNumber(rawNum);
    const cleanEmail = (loggedInEmail || targetEmail).trim();

    if (!cleanNum || !cleanEmail) {
      setError("Please provide both order number and email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/orders/track?order_number=${encodeURIComponent(
          cleanNum
        )}&email=${encodeURIComponent(cleanEmail)}`
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
    const qEmail = loggedInEmail || searchParams.get("email") || "";
    if (qOrderNum && qEmail) {
      setOrderNumber(qOrderNum);
      setEmail(qEmail);
      fetchTracking(qOrderNum, qEmail);
    }
  }, [searchParams, loggedInEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = loggedInEmail || email;
    if (loggedInEmail && email !== loggedInEmail) {
      setEmail(loggedInEmail);
    }
    fetchTracking(orderNumber, targetEmail);
  };

  const storeInfo = useStoreInfo();

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
            Live Pickup & Fulfillment
          </span>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-lg mx-auto">
            Enter your order reference code and checkout email to monitor real-time order and pickup progress.
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
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 font-mono">
                  Email Address
                </label>
                {loggedInEmail && (
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Logged In
                  </span>
                )}
              </div>
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

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Fulfillment Status Badge */}
                  <span
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider font-mono ${
                      order.status === "collected"
                        ? "bg-emerald-100 text-emerald-800"
                        : order.status === "ready_for_pickup"
                        ? "bg-[#EDCF5D] text-[#010101]"
                        : order.status === "confirmed"
                        ? "bg-sky-100 text-sky-800"
                        : order.status === "cancelled" || order.status === "expired"
                        ? "bg-rose-100 text-rose-800"
                        : order.status === "on_hold"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>

                  {/* Separate Payment Status Badge */}
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider font-mono ${
                      order.payment_status === "paid" || order.paid_at
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : "bg-amber-50 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {order.payment_status === "paid" || order.paid_at ? "Paid" : "Payment Due at Pickup"}
                  </span>
                </div>
              </div>

              {/* Off-Track Banners */}
              {order.status === "cancelled" && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                    <svg className="w-5 h-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>Order Cancelled</span>
                  </div>
                  <p>This order has been cancelled.</p>
                  {order.cancel_reason && (
                    <p className="font-medium text-rose-700">Reason: {order.cancel_reason}</p>
                  )}
                  {order.payment_status === "paid" && (
                    <p className="text-emerald-700 font-semibold pt-1">
                      Since you had already paid, our team will process your refund.
                    </p>
                  )}
                </div>
              )}

              {order.status === "expired" && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                    <svg className="w-5 h-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Pickup Window Expired</span>
                  </div>
                  <p>
                    This order was not collected within the pickup window and has expired. Items have been released back to sale.
                  </p>
                </div>
              )}

              {order.status === "on_hold" && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-sm text-purple-900">
                    <svg className="w-5 h-5 shrink-0 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>Order On Temporary Hold</span>
                  </div>
                  <p>Our team is currently reviewing your order. We will notify you once it resumes.</p>
                  {order.hold_reason && (
                    <p className="font-medium text-purple-700">Reason: {order.hold_reason}</p>
                  )}
                </div>
              )}

              {/* Prominent Payment Due Callout when ready for pickup and unpaid */}
              {order.status === "ready_for_pickup" && order.payment_status !== "paid" && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900 uppercase font-mono tracking-wider">
                      Payment Due at Pickup: ₦{(order.total / 100).toLocaleString()}
                    </p>
                    <p className="text-xs text-amber-800">
                      Your order is ready. Please bring your order code <span className="font-mono font-bold text-black">{order.order_number}</span> to the pickup counter. You can pay with cash, card, or transfer.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(order.order_number)}
                    className="px-3.5 py-2 rounded-xl bg-[#010101] text-white hover:bg-black/85 text-xs font-bold font-mono self-start sm:self-auto cursor-pointer shrink-0"
                  >
                    {copied ? "Copied!" : "Copy Order Code"}
                  </button>
                </div>
              )}

              {/* Progress Stepper (4 steps) */}
              <div className={`py-4 ${currentStep === -1 ? "opacity-40 grayscale" : ""}`}>
                <div className="relative">
                  <div className="hidden sm:block absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 z-0" />
                  <div
                    className="hidden sm:block absolute top-1/2 left-0 h-1 bg-[#010101] -translate-y-1/2 transition-all duration-700 z-0"
                    style={{
                      width: `${currentStep === -1 ? 0 : Math.max(0, (currentStep / (ORDER_STEPS.length - 1)) * 100)}%`,
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative z-10">
                    {ORDER_STEPS.map((step, idx) => {
                      const isPast = currentStep !== -1 && idx < currentStep;
                      const isCurrent = currentStep !== -1 && idx === currentStep;

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
            </div>

            {/* Pickup Location & Order Items Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left: Pickup Location */}
              <div className="md:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider font-mono">
                    Pickup Location
                  </h3>
                  <span className="text-[11px] font-mono text-gray-400 uppercase font-semibold">
                    In-Store Pickup
                  </span>
                </div>

                <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
                  <p className="font-bold text-gray-900 text-sm">
                    {order.pickup_station?.name || storeInfo?.store_name || "GTS Main Store"}
                  </p>
                  <p>
                    {order.pickup_station
                      ? [order.pickup_station.address_line1, order.pickup_station.address_line2].filter(Boolean).join(", ")
                      : order.address?.address_line1 || storeInfo?.store_address || "12 Allen Avenue"}
                  </p>
                  <p>
                    {order.pickup_station
                      ? `${order.pickup_station.city}, ${order.pickup_station.state}`
                      : order.address ? `${order.address.city}, ${order.address.state}` : "Ikeja, Lagos"}
                  </p>

                  {(order.pickup_station?.phone || storeInfo?.support_phone) && (
                    <p className="font-mono text-gray-500 pt-1">
                      Tel: {order.pickup_station?.phone || storeInfo?.support_phone}
                    </p>
                  )}

                  {order.pickup_station?.operating_hours && (
                    <p className="text-[11px] text-gray-500">
                      Collection hours: {order.pickup_station.operating_hours}
                    </p>
                  )}

                  {order.pickup_deadline && (
                    <p className="text-[11px] font-mono text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 font-medium">
                      Collect by: {formatWAT(order.pickup_deadline)}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    ₦{(order.total / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Right: Order Items preview */}
              <div className="md:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider font-mono">
                  Items in Order ({order.items?.length || 0})
                </h3>

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
                  {(order.items || []).map((item, idx) => {
                    const snap = item.product_snapshot || {};
                    return (
                      <div key={item.id || idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <ItemThumbnail
                            image={snap.image || snap.image_url}
                            name={snap.name || snap.title}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {snap.name || snap.title || "Garment"}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono">
                              Qty: {item.quantity} {snap.size ? `· Size: ${snap.size}` : ""} {snap.color ? `· Color: ${snap.color}` : ""}
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
