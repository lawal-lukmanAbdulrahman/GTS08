"use client";

import { useEffect, useMemo, useState } from "react";
import { toCheckoutLines, type Quote } from "./checkout-client";
import type { CartItem } from "../_components/cart-context";

/** The server's prices and stock for the cart, so the page shows what will really be charged. */
export function useCheckoutQuote(cart: Pick<CartItem, "product" | "size" | "color" | "quantity">[]) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lines = useMemo(() => toCheckoutLines(cart), [cart]);
  const key = JSON.stringify(lines);

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/v1/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines }),
        });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body?.data) {
          setQuote(body.data as Quote);
          setError(null);
        } else {
          setQuote(null);
          setError(body?.error || "We couldn't check your cart just now.");
        }
      } catch {
        if (!cancelled) {
          setQuote(null);
          setError("We couldn't check your cart just now. Please check your connection.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` is the cart's content; `lines` changes identity on every render of a parent.
  }, [key]);

  return { quote, error, loading };
}
