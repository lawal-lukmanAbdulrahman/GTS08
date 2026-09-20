"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "../../_components/cart-context";
import { useAuth } from "../../_components/auth-context";
import OrderReceipt from "../../_components/order-receipt";
import { usePaymentStatus } from "../../_lib/use-payment-status";

interface LastCheckout {
  email: string;
  fullName: string;
  phone: string;
}

function readLastCheckout(): LastCheckout | null {
  try {
    const raw = sessionStorage.getItem("gts_last_checkout");
    return raw ? (JSON.parse(raw) as LastCheckout) : null;
  } catch {
    return null;
  }
}

function Complete() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const { state, order } = usePaymentStatus(reference);
  const { clearCart } = useCart();
  const { user, claimAccount } = useAuth();
  const cleared = useRef(false);
  const [last, setLast] = useState<LastCheckout | null>(null);
  const [password, setPassword] = useState("");
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [store, setStore] = useState<{ name?: string; phone?: string | null; website?: string | null } | undefined>();

  // The receipt's name, phone and website are the shop's own Store Details; the defaults apply if they can't be read.
  useEffect(() => {
    if (typeof fetch !== "function") return;
    fetch("/api/v1/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.data && setStore({ name: b.data.store_name, phone: b.data.support_phone, website: b.data.store_website }))
      .catch(() => undefined);
  }, []);

  // The cart is emptied only once the server confirms payment, never just because the customer came back.
  useEffect(() => {
    if (state === "paid" && !cleared.current) {
      cleared.current = true;
      clearCart();
      setLast(readLastCheckout());
    }
  }, [state, clearCart]);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setClaimStatus("Password must be at least 8 characters.");
      return;
    }
    const res = await claimAccount(password, { fullName: last?.fullName ?? "", phone: last?.phone ?? "" });
    setClaimStatus(res.error ?? "Account saved. You can now track your orders any time.");
  }

  return (
    <main className="min-h-[70vh] bg-white px-4 py-12 font-sans">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        {state === "waiting" && (
          <div role="status" className="space-y-3">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#010101] border-t-transparent" />
            <h1 className="font-athelas text-2xl font-extrabold text-[#010101]">Confirming your payment…</h1>
            <p className="text-sm text-gray-500">This usually takes a few seconds. Please don&apos;t close this page.</p>
          </div>
        )}

        {state === "paid" && order && (
          <>
            <div className="space-y-1">
              <h1 className="font-athelas text-3xl font-extrabold text-[#010101]">Payment received</h1>
              <p className="text-sm text-gray-500">Thank you. Your order is confirmed and we&apos;re getting it ready.</p>
            </div>
            <OrderReceipt order={order} store={store} />

            {!user && last && (
              <form onSubmit={claim} className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left">
                <p className="text-xs font-bold text-[#010101]">Save your details and track your order</p>
                <p className="text-[11px] text-gray-600">Choose a password to turn {last.email} into a GTS account.</p>
                {claimStatus ? (
                  <p role="status" className="text-xs font-bold text-emerald-700">{claimStatus}</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      aria-label="Choose a password"
                      placeholder="Password (min 8 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none"
                    />
                    <button type="submit" className="shrink-0 rounded-xl bg-[#010101] px-4 py-2 text-xs font-bold text-white">Save account</button>
                  </div>
                )}
              </form>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/track" className="flex-1 rounded-full bg-[#010101] py-3 text-sm font-bold text-white">Track my order</Link>
              <Link href="/" className="flex-1 rounded-full border border-gray-300 py-3 text-sm font-bold">Continue shopping</Link>
            </div>
          </>
        )}

        {state === "pending" && (
          <div role="status" className="space-y-3">
            <h1 className="font-athelas text-2xl font-extrabold text-[#010101]">We haven&apos;t received confirmation yet</h1>
            <p className="text-sm text-gray-600">
              If your payment went through, your order will be confirmed automatically and you&apos;ll get an email. If you weren&apos;t charged, your
              items will be released and you can check out again.
            </p>
            {order && <p className="text-sm">Order <span className="font-mono font-bold">{order.order_number}</span></p>}
            <Link href="/track" className="inline-block rounded-full bg-[#010101] px-6 py-3 text-sm font-bold text-white">Check my order</Link>
          </div>
        )}

        {state === "not_found" && (
          <div role="alert" className="space-y-3">
            <h1 className="font-athelas text-2xl font-extrabold text-[#010101]">We couldn&apos;t find that payment</h1>
            <p className="text-sm text-gray-600">The link may be incomplete. Your cart hasn&apos;t been touched.</p>
            <Link href="/cart" className="inline-block rounded-full bg-[#010101] px-6 py-3 text-sm font-bold text-white">Back to cart</Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CompleteView() {
  return (
    <Suspense fallback={null}>
      <Complete />
    </Suspense>
  );
}
