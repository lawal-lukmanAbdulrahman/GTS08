"use client";

import { useEffect, useRef } from "react";
import { getCartSessionId } from "./server-sync";

export interface AnalyticsPayload {
  product_id: string;
  event_type: "view" | "dwell" | "read_details" | "click" | "wishlist_add" | "cart_add" | "share";
  duration_seconds?: number;
  scroll_depth?: number;
  referrer?: string;
}

/**
 * Dispatches an analytics event reliably.
 * Uses navigator.sendBeacon when possible (ideal for page unloads / background tab switches)
 * with a fallback to keepalive fetch.
 */
export function sendAnalyticsEvent(payload: AnalyticsPayload): void {
  if (typeof window === "undefined" || !payload.product_id) return;

  const sessionId = getCartSessionId();
  const body = JSON.stringify({
    ...payload,
    session_id: sessionId,
  });

  const url = "/api/v1/analytics/event";

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const success = navigator.sendBeacon(url, blob);
    if (success) return;
  }

  // Fallback to fetch with keepalive
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics failures should never crash or interrupt customer experience
  });
}

/**
 * Tracks when a user clicks on a product card from any feed or section
 */
export function trackProductClick(productId: string, source: string = "storefront"): void {
  sendAnalyticsEvent({
    product_id: productId,
    event_type: "click",
    referrer: source,
  });
}

/**
 * Tracks when a user adds/removes a product to/from their wishlist
 */
export function trackProductWishlist(productId: string, action: "add" | "remove"): void {
  if (action === "add") {
    sendAnalyticsEvent({
      product_id: productId,
      event_type: "wishlist_add",
    });
  }
}

/**
 * Tracks when a user adds a product to cart
 */
export function trackProductCart(productId: string): void {
  sendAnalyticsEvent({
    product_id: productId,
    event_type: "cart_add",
  });
}

/**
 * High-precision React hook for Product Detail Pages (PDP):
 * - Records initial view
 * - Tracks active dwell time (pauses if tab is hidden / backgrounded)
 * - Measures max scroll depth (0-100%)
 * - Detects deep reading of description, specifications & reviews ('read_details')
 * - Flushes engagement metrics safely upon tab switch, unmount or page exit
 */
export function useProductDwellTracker(productId: string | undefined | null) {
  const stateRef = useRef<{
    startTime: number;
    activeDurationMs: number;
    lastActiveTime: number;
    isTabVisible: boolean;
    maxScrollDepth: number;
    hasReadDetails: boolean;
    hasFlushed: boolean;
  }>({
    startTime: 0,
    activeDurationMs: 0,
    lastActiveTime: 0,
    isTabVisible: true,
    maxScrollDepth: 0,
    hasReadDetails: false,
    hasFlushed: false,
  });

  useEffect(() => {
    if (!productId || typeof window === "undefined") return;

    // Reset tracking state for new product
    const now = Date.now();
    stateRef.current = {
      startTime: now,
      activeDurationMs: 0,
      lastActiveTime: now,
      isTabVisible: document.visibilityState === "visible",
      maxScrollDepth: 0,
      hasReadDetails: false,
      hasFlushed: false,
    };

    // 1. Send initial product view event
    sendAnalyticsEvent({
      product_id: productId,
      event_type: "view",
    });

    // 2. Scroll depth observer
    const handleScroll = () => {
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        1
      );
      const winHeight = window.innerHeight;
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      const currentDepth = Math.min(100, Math.round(((scrollTop + winHeight) / docHeight) * 100));

      if (currentDepth > stateRef.current.maxScrollDepth) {
        stateRef.current.maxScrollDepth = currentDepth;
      }

      // If user scrolls > 45% down, they are reading details/specs
      if (currentDepth >= 45) {
        stateRef.current.hasReadDetails = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // 3. Tab visibility handler (pause/resume dwell timer)
    const handleVisibilityChange = () => {
      const s = stateRef.current;
      const timestamp = Date.now();

      if (document.visibilityState === "hidden") {
        if (s.isTabVisible) {
          s.activeDurationMs += timestamp - s.lastActiveTime;
          s.isTabVisible = false;
        }
      } else {
        s.lastActiveTime = timestamp;
        s.isTabVisible = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Flush dwell & detail-reading event
    const flushEngagement = () => {
      const s = stateRef.current;
      if (s.hasFlushed) return;

      const timestamp = Date.now();
      let totalMs = s.activeDurationMs;
      if (s.isTabVisible) {
        totalMs += timestamp - s.lastActiveTime;
      }

      const totalSeconds = Math.round(totalMs / 1000);

      // Only record engagement if user spent at least 3 seconds on the product
      if (totalSeconds >= 3) {
        s.hasFlushed = true;
        sendAnalyticsEvent({
          product_id: productId,
          event_type: s.hasReadDetails || totalSeconds >= 20 ? "read_details" : "dwell",
          duration_seconds: totalSeconds,
          scroll_depth: s.maxScrollDepth,
        });
      }
    };

    window.addEventListener("pagehide", flushEngagement);
    window.addEventListener("beforeunload", flushEngagement);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushEngagement);
      window.removeEventListener("beforeunload", flushEngagement);
      flushEngagement();
    };
  }, [productId]);
}
