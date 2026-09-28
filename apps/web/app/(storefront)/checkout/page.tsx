"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatKobo, formatWAT, idempotentFetch } from "@gts/utils";
import { useCart } from "../_components/cart-context";
import { useAuth } from "../_components/auth-context";
import { Footer } from "../_components/landing/footer";
import { toCheckoutLines } from "../_lib/checkout-client";
import { useCheckoutQuote } from "../_lib/use-checkout-quote";
import { useStoreInfo } from "../_lib/store-info";

/** Where the shopper goes when there is nothing to check out. */
const PRODUCT_LISTING = "/search";

function FloatingInput({ id, label, type = "text", value, onChange, autoComplete }: { id: string; label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const [focused, setFocused] = useState(false);
  const isUp = focused || value.length > 0;
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`peer w-full border rounded-xl px-4 pt-5 pb-2 text-sm font-medium text-[#010101] bg-white outline-none transition-all ${
          focused ? "border-[#010101] shadow-[0_0_0_2px_rgba(1,1,1,0.08)]" : "border-gray-200 hover:border-gray-400"
        }`}
      />
      <label htmlFor={id} className={`absolute left-4 transition-all duration-150 pointer-events-none font-medium ${isUp ? "top-1.5 text-[10px] text-[#010101]" : "top-3.5 text-sm text-gray-400"}`}>
        {label}
      </label>
    </div>
  );
}

interface PlacedOrder {
  order_number: string;
  total: number;
  pickup: { deadline: string; address: string | null; store_name: string; hold_hours: number };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function CheckoutPage() {
  const router = useRouter();
  const { cartItems, clearCart, hydrated } = useCart();
  const { user, customer } = useAuth();
  const store = useStoreInfo();
  const { quote, error: quoteError, loading: quoteLoading } = useCheckoutQuote(cartItems);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // Prefill from the signed-in customer.
  useEffect(() => {
    if (customer) {
      if (customer.email) setEmail(customer.email);
      if (customer.full_name) {
        const [first = "", ...rest] = customer.full_name.split(" ");
        setFirstName(first);
        setLastName(rest.join(" "));
      }
      if (customer.phone) setPhone(customer.phone);
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [customer, user]);

  // Nothing to check out (e.g. the last item was removed): straight back to the products.
  useEffect(() => {
    if (hydrated && cartItems.length === 0 && !placed) router.replace(PRODUCT_LISTING);
  }, [hydrated, cartItems.length, placed, router]);

  // The server prices the cart; until it answers, the page shows its own estimate (kobo throughout).
  const estimatedSubtotal = cartItems.reduce((sum, i) => sum + Math.round(i.product.priceNum * 100) * i.quantity, 0);
  const subtotal = quote ? quote.subtotal : estimatedSubtotal;
  const total = Math.max(0, subtotal);
  const holdHours = store?.pickup_hold_hours ?? 48;

  const detailsReady = firstName.trim().length > 0 && lastName.trim().length > 0 && EMAIL.test(email.trim()) && phone.replace(/\D/g, "").length >= 7;
  const canPlaceOrder = cartItems.length > 0 && !quoteLoading && quote?.all_available !== false && detailsReady && !isSubmitting;

  const placeOrder = async () => {
    if (!canPlaceOrder) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await idempotentFetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { email: email.trim(), fullName: `${firstName.trim()} ${lastName.trim()}`, phone: phone.trim() },
          // Only what to buy and how many: the server looks up prices and decides discounts.
          items: toCheckoutLines(cartItems),
          fulfilment: "pickup",
          paymentMethod: "pay_on_pickup",
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success && body.data?.pickup) {
        setPlaced(body.data as PlacedOrder);
        clearCart();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setSubmitError(body?.error || "We couldn't place your order. Please try again.");
      }
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-screen bg-white text-[#010101] font-sans">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-20">
          <div className="rounded-2xl border border-gray-200 bg-[#F9F8F5] p-6 sm:p-8 space-y-5 text-center">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-emerald-700">Order placed</p>
            <h1 className="font-athelas text-2xl sm:text-3xl font-extrabold">We&apos;re holding your order</h1>
            <p className="text-sm text-gray-600">Your order number</p>
            <p className="font-mono text-lg font-bold">{placed.order_number}</p>
            <div className="text-left rounded-xl bg-white border border-gray-200 p-4 space-y-2 text-sm">
              <p>
                <strong>Pay when you collect:</strong> {formatKobo(placed.total)}
              </p>
              <p>
                <strong>Collect from:</strong> {placed.pickup.store_name}
                {placed.pickup.address ? `, ${placed.pickup.address}` : ""}
              </p>
              <p>
                <strong>Collect by:</strong> {formatWAT(placed.pickup.deadline)}
              </p>
              <p className="text-xs text-gray-500">After that the order is cancelled and the items go back on sale. We&apos;ve emailed you these details.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={PRODUCT_LISTING} className="rounded-full bg-[#010101] text-white font-bold text-sm px-6 py-3">
                Continue shopping
              </Link>
              <Link href="/track" className="rounded-full border border-gray-300 font-bold text-sm px-6 py-3">
                Track my order
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const option = "flex gap-3 items-start rounded-2xl border-2 p-4 transition-all";

  return (
    <div className="min-h-screen bg-white text-[#010101] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-6">
          <Link href="/" className="hover:text-[#010101] transition-colors">Home</Link>
          <span>›</span>
          <Link href="/cart" className="hover:text-[#010101] transition-colors">Cart</Link>
          <span>›</span>
          <span className="text-[#010101]">Checkout</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {/* 1. How to get it and pay */}
            <section className="space-y-3">
              <h2 className="font-athelas text-xl font-bold">1. How would you like to get your order?</h2>
              <div className="space-y-3" role="radiogroup" aria-label="Delivery and payment">
                <label className={`${option} border-[#010101] bg-[#FFFBEB] cursor-pointer`}>
                  <input type="radio" name="checkout-mode" value="pay_on_pickup" defaultChecked className="mt-1 accent-[#010101]" aria-describedby="pickup-desc" />
                  <span>
                    <span className="block text-sm font-bold">Pay on pickup</span>
                    <span id="pickup-desc" className="block text-xs text-gray-600 mt-1">
                      Collect from {store?.store_name || "our store"}
                      {store?.store_address ? ` at ${store.store_address}` : ""} and pay at the till. We&apos;ll hold your items for {holdHours} hours.
                    </span>
                  </span>
                </label>
                <label className={`${option} border-gray-200 opacity-50 cursor-not-allowed select-none`} aria-disabled="true">
                  <input type="radio" name="checkout-mode" value="pay_now" disabled className="mt-1" />
                  <span className="blur-[0.6px]">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      Pay now
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 blur-0">Coming soon</span>
                    </span>
                    <span className="block text-xs text-gray-600 mt-1">Pay online by card or transfer and have it delivered.</span>
                  </span>
                </label>
              </div>
            </section>

            {/* 2. Contact details */}
            <section className="space-y-3">
              <h2 className="font-athelas text-xl font-bold">2. Your details</h2>
              <p className="text-xs text-gray-500">So we know who&apos;s collecting and can send your order details.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatingInput id="first-name" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
                <FloatingInput id="last-name" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
                <FloatingInput id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
                <FloatingInput id="phone" label="Phone number" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
              </div>
            </section>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-28">
            <div className="bg-[#F9F8F5] rounded-2xl p-6 border border-gray-200/80">
              <h2 className="font-athelas text-xl font-bold pb-4 border-b border-gray-200 flex items-center justify-between">
                Order summary
                <span className="text-sm font-semibold text-gray-400 font-sans">
                  {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
                </span>
              </h2>

              <div className="divide-y divide-gray-100 my-4 max-h-[260px] overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={`${item.product.id}-${item.color}-${item.size}`} className="flex gap-3 py-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <div className="w-full h-full rounded-xl overflow-hidden bg-[#ECEAE6] border border-gray-200 relative">
                        <Image src={item.product.image} alt={item.product.title} fill className="object-contain p-1.5" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-[#010101] text-white text-[10px] font-bold flex items-center justify-center">{item.quantity}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-tight truncate">{item.product.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{[item.size, item.color].filter(Boolean).join(" · ")}</p>
                      <p className="text-xs font-bold mt-1">{formatKobo(Math.round(item.product.priceNum * 100) * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 border-t border-gray-200 pt-4 text-sm">
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Items ({cartItems.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span className="font-bold text-[#010101]">{formatKobo(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Pickup</span>
                  <span className="font-bold text-[#010101]">Free</span>
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-gray-200 mt-2">
                  <span className="font-extrabold text-base">Pay at pickup</span>
                  <span className="font-athelas font-extrabold text-2xl">{formatKobo(total)}</span>
                </div>
              </div>

              {(submitError || quoteError || (quote && !quote.all_available)) && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
                  {submitError || quoteError || "Some items in your cart are no longer in stock in the quantity you chose. Please update your cart."}
                </p>
              )}

              <button
                type="button"
                disabled={!canPlaceOrder}
                onClick={placeOrder}
                className={`w-full font-bold text-sm py-4 rounded-full mt-4 transition-all ${
                  canPlaceOrder ? "bg-[#EDCF5D] hover:bg-[#010101] text-[#010101] hover:text-white shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? "Placing your order..." : quoteLoading ? "Checking stock..." : "Place order"}
              </button>
              {quoteLoading && <p className="text-[11px] text-gray-500 text-center mt-2">Verifying stock availability...</p>}
              {!detailsReady && <p className="text-[11px] text-gray-500 text-center mt-2">Fill in your details to place the order.</p>}

              <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
                By placing your order you accept the{" "}
                <Link href="/terms" className="text-[#010101] font-bold underline underline-offset-2">
                  Terms &amp; Conditions
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
