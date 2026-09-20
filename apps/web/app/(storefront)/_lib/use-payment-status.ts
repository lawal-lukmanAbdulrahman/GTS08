"use client";

import { useEffect, useState } from "react";
import type { PaidOrder } from "./checkout-client";

export type PaymentState = "waiting" | "paid" | "pending" | "not_found";

interface Options {
  intervalMs?: number;
  giveUpAfterMs?: number;
}

/**
 * After Paystack sends the customer back, waits for the webhook to record the
 * payment. "Paid" means the server says so; coming back from Paystack proves
 * nothing. After a while it stops and says the payment is still pending.
 */
export function usePaymentStatus(reference: string | null, { intervalMs = 2000, giveUpAfterMs = 60_000 }: Options = {}) {
  const [state, setState] = useState<PaymentState>(reference ? "waiting" : "not_found");
  const [order, setOrder] = useState<PaidOrder | null>(null);

  useEffect(() => {
    if (!reference) {
      setState("not_found");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setState("waiting");

    const check = async () => {
      try {
        const res = await fetch(`/api/v1/checkout/status?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) {
          setState("not_found");
          return;
        }
        const body = await res.json().catch(() => null);
        if (res.ok && body?.data) {
          setOrder(body.data as PaidOrder);
          if (body.data.paid) {
            setState("paid");
            return;
          }
        }
      } catch {
        // a blip is retried on the next tick
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= giveUpAfterMs) {
        setState("pending");
        return;
      }
      timer = setTimeout(check, intervalMs);
    };
    void check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reference, intervalMs, giveUpAfterMs]);

  return { state, order };
}
