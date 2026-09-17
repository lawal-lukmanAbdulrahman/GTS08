"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@gts/database/client";
import {
  BroadcastDesignConfig,
  CanvasElement,
  computeElementShadow,
  SHAPE_SEAL_POINTS,
  SHAPE_BURST_POINTS,
  SHAPE_SPEECH_PATH,
  SHAPE_CLOUD_PATH,
  SHAPE_ARROW_PATH,
} from "../../../lib/notifications";

interface BroadcastData {
  id: string;
  title?: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  isActive: boolean;
  updatedAt?: string;
  expiresAt?: string;
  rebroadcastedAt?: string;
  designConfig?: BroadcastDesignConfig;
}

/**
 * Version token for a broadcast:
 * - If rebroadcasted: the exact ISO `rebroadcastedAt` timestamp.
 * - Otherwise: "initial".
 * NOTE: We do NOT use `updatedAt` because minor edits or server saves must never
 * cause an already-seen broadcast to re-display to users. Only explicit rebroadcasts
 * will cause the broadcast to be shown again.
 */
function getBroadcastVersion(broadcast: BroadcastData): string {
  return broadcast.rebroadcastedAt || "initial";
}

/**
 * Checks if this broadcast has already been seen by the user.
 * Stored persistently in localStorage with 1-year cookie and sessionStorage fallbacks.
 * Once seen, it will NEVER be shown again unless the admin explicitly rebroadcasts it
 * (which updates `rebroadcastedAt` to a new timestamp).
 */
function hasBeenSeen(broadcast: BroadcastData): boolean {
  if (typeof window === "undefined" || !broadcast || !broadcast.id) return false;

  const storageKey = `gts_broadcast_seen_${broadcast.id}`;

  try {
    // 1. Check persistent localStorage
    const localVal = localStorage.getItem(storageKey);
    if (localVal) {
      if (broadcast.rebroadcastedAt) {
        // If rebroadcasted, only marked as seen if stored version matches current rebroadcastedAt
        if (localVal === broadcast.rebroadcastedAt) return true;
      } else {
        // Not rebroadcasted: any record means the user already saw this campaign
        return true;
      }
    }

    // 2. Check persistent cookie fallback (1-year lifetime)
    const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${storageKey}=([^;]*)`));
    if (cookieMatch && cookieMatch[1]) {
      const cookieVal = decodeURIComponent(cookieMatch[1]);
      if (broadcast.rebroadcastedAt) {
        if (cookieVal === broadcast.rebroadcastedAt) return true;
      } else {
        return true;
      }
    }

    // 3. Check sessionStorage fallback
    const sessionVal = sessionStorage.getItem(storageKey);
    if (sessionVal) {
      if (broadcast.rebroadcastedAt) {
        if (sessionVal === broadcast.rebroadcastedAt) return true;
      } else {
        return true;
      }
    }

    // 4. Check legacy dismissal keys (migration compatibility)
    const legacyKey = `gts_broadcast_dismissed_${broadcast.id}_${broadcast.rebroadcastedAt || broadcast.updatedAt || ""}`;
    if (sessionStorage.getItem(legacyKey) || localStorage.getItem(legacyKey)) {
      markAsSeen(broadcast);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Marks a broadcast as seen across localStorage, persistent cookie, and sessionStorage.
 */
function markAsSeen(broadcast: BroadcastData): void {
  if (typeof window === "undefined" || !broadcast || !broadcast.id) return;

  const version = getBroadcastVersion(broadcast);
  const storageKey = `gts_broadcast_seen_${broadcast.id}`;

  try {
    // 1. Persistent localStorage
    localStorage.setItem(storageKey, version);

    // 2. Persistent cookie (1 year, SameSite=Lax, Path=/)
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${storageKey}=${encodeURIComponent(version)}; max-age=${maxAge}; path=/; SameSite=Lax`;

    // 3. sessionStorage
    sessionStorage.setItem(storageKey, version);
  } catch {}
}

/**
 * Retrieves or generates an anonymous, privacy-safe visitor ID for unique shopper metrics.
 */
function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("gts_visitor_id");
    if (!id) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("gts_visitor_id", id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Detects device category (mobile vs desktop) for device split analytics.
 */
function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  try {
    const isMobileWidth = window.innerWidth < 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    return isMobileWidth || isMobileUA ? "mobile" : "desktop";
  } catch {
    return "desktop";
  }
}

/**
 * Dispatches broadcast telemetry securely and efficiently.
 * Uses navigator.sendBeacon first (survives navigations, doesn't block UI thread),
 * and falls back to fetch() with keepalive: true.
 */
function sendBroadcastAnalytics(
  id: string,
  event: "impression" | "click" | "dismiss",
  attentionSeconds?: number
): void {
  if (!id) return;
  try {
    const payload = JSON.stringify({
      id,
      event,
      device: getDeviceType(),
      visitorId: getVisitorId(),
      attentionSeconds:
        attentionSeconds !== undefined
          ? Math.max(0.1, Math.min(600, Number(attentionSeconds.toFixed(1))))
          : undefined,
    });

    const endpoint = "/api/v1/broadcast/analytics";

    // 1. sendBeacon is non-blocking and ideal for navigation/redirects
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    }

    // 2. Modern fetch with keepalive
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Non-blocking silent catch
  }
}

/**
 * Returns true if the broadcast is worth showing (active, has content, not expired, not dismissed).
 */
function isBroadcastEligible(data: BroadcastData): boolean {
  if (!data || !data.isActive) return false;
  if (data.expiresAt && new Date(data.expiresAt) <= new Date()) return false;
  const hasContent =
    Boolean(data.imageUrl) ||
    Boolean(data.designConfig?.backgroundColor) ||
    Boolean(data.designConfig?.elements && data.designConfig.elements.length > 0) ||
    Boolean(data.title) ||
    Boolean(data.subtitle);
  if (!hasContent) return false;
  return !hasBeenSeen(data);
}

/**
 * Picks a random page threshold gap between 2 and 3 page transitions.
 */
function getRandomPacingGap(): number {
  return Math.random() < 0.5 ? 2 : 3;
}

const SESSION_NAV_COUNT_KEY = "gts_broadcast_page_navs";
const SESSION_GAP_KEY = "gts_broadcast_gap_threshold";
const SESSION_HAS_SHOWN_KEY = "gts_broadcast_session_has_shown";

function getSessionNavCount(): number {
  try {
    return parseInt(sessionStorage.getItem(SESSION_NAV_COUNT_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function setSessionNavCount(count: number): void {
  try {
    sessionStorage.setItem(SESSION_NAV_COUNT_KEY, String(Math.max(0, count)));
  } catch {}
}

function getSessionGapThreshold(): number {
  try {
    const raw = sessionStorage.getItem(SESSION_GAP_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (parsed === 2 || parsed === 3) return parsed;
    }
  } catch {}
  const gap = getRandomPacingGap();
  try {
    sessionStorage.setItem(SESSION_GAP_KEY, String(gap));
  } catch {}
  return gap;
}

function setSessionGapThreshold(gap: number): void {
  try {
    sessionStorage.setItem(SESSION_GAP_KEY, String(gap));
  } catch {}
}

function hasShownInitialInSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem(SESSION_HAS_SHOWN_KEY));
  } catch {
    return false;
  }
}

function markInitialShownInSession(): void {
  try {
    sessionStorage.setItem(SESSION_HAS_SHOWN_KEY, "1");
  } catch {}
}

export function BroadcastModal() {
  const router = useRouter();
  const pathname = usePathname();

  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Queue of broadcasts waiting to show on the next page navigation
  const queueRef = useRef<BroadcastData[]>([]);
  // Whether the modal is currently showing (prevents queue processing mid-display)
  const isShowingRef = useRef(false);
  // Has the page had at least one navigation yet
  const hasNavigatedRef = useRef(false);
  // Track previous pathname to detect actual navigations
  const prevPathnameRef = useRef(pathname);

  // Analytics tracking refs
  const openedAtRef = useRef<number | null>(null);
  const impressionTrackedIdRef = useRef<string | null>(null);

  // Record impression and start dwell/attention timer when modal opens
  useEffect(() => {
    if (isOpen && broadcast) {
      // Mark as seen permanently across storage layers
      markAsSeen(broadcast);
      openedAtRef.current = Date.now();
      if (impressionTrackedIdRef.current !== broadcast.id) {
        impressionTrackedIdRef.current = broadcast.id;
        sendBroadcastAnalytics(broadcast.id, "impression");
      }
    } else if (!isOpen) {
      openedAtRef.current = null;
    }
  }, [isOpen, broadcast]);

  // Capture attention span on tab unload / close if modal was open
  useEffect(() => {
    if (!isOpen || !broadcast) return;
    const handleUnload = () => {
      if (openedAtRef.current && broadcast) {
        const elapsed = (Date.now() - openedAtRef.current) / 1000;
        sendBroadcastAnalytics(broadcast.id, "dismiss", elapsed);
      }
    };
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [isOpen, broadcast]);

  /**
   * Adds a broadcast to the queue if it's eligible and not already queued.
   * Preserves natural campaign order (appends to end).
   */
  const enqueue = useCallback((data: BroadcastData) => {
    if (!isBroadcastEligible(data)) return;
    const version = getBroadcastVersion(data);
    const alreadyQueued = queueRef.current.some(
      (q) => q.id === data.id && getBroadcastVersion(q) === version
    );
    if (!alreadyQueued) {
      queueRef.current = [...queueRef.current.filter((q) => q.id !== data.id), data];
    }
  }, []);

  /**
   * Displays a specific broadcast item with smooth timing,
   * immediately marks it as seen (so it never shows again across visits),
   * updates session records, and sets the next randomized 2-3 page gap.
   */
  const showBroadcast = useCallback((item: BroadcastData, delayMs = 600) => {
    if (isShowingRef.current) return;
    isShowingRef.current = true;
    setBroadcast(item);
    // Mark as seen immediately so user will NEVER see it again across reloads, visits, or tabs
    markAsSeen(item);
    setTimeout(() => {
      setIsOpen(true);
    }, delayMs);
    markInitialShownInSession();
    setSessionNavCount(0);
    setSessionGapThreshold(getRandomPacingGap());
  }, []);

  /**
   * Dequeues and shows the next eligible broadcast.
   * Only called after user traverses 2 to 3 pages without interruptions.
   */
  const showNextFromQueue = useCallback(() => {
    if (isShowingRef.current || queueRef.current.length === 0) return;

    // Find first still-eligible item (may have expired or been dismissed since enqueue)
    const idx = queueRef.current.findIndex(isBroadcastEligible);
    if (idx === -1) {
      queueRef.current = [];
      return;
    }

    const next = queueRef.current.splice(idx, 1)[0];
    if (!next) return;
    showBroadcast(next, 700);
  }, [showBroadcast]);

  // ── Fetch active broadcast(s) from API ────────────────────────────────────────
  const fetchBroadcast = useCallback(
    async (isInitialMount = false) => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch("/api/v1/broadcast", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();

        // Support multiple active campaigns
        const activeList: BroadcastData[] =
          Array.isArray(json.activeBroadcasts) && json.activeBroadcasts.length > 0
            ? json.activeBroadcasts
            : json.data
            ? [json.data]
            : [];

        // Enqueue all active eligible broadcasts
        for (const item of activeList) {
          if (item && item.isActive && isBroadcastEligible(item)) {
            enqueue(item);
          }
        }

        // If initial mount in session and user hasn't seen any broadcast yet, show the first one
        if (isInitialMount && !hasShownInitialInSession() && !isShowingRef.current) {
          const firstIdx = queueRef.current.findIndex(isBroadcastEligible);
          if (firstIdx >= 0) {
            const first = queueRef.current.splice(firstIdx, 1)[0];
            if (first) {
              showBroadcast(first, 1200);
            }
          }
        }
      } catch {
        // Silent fallback
      }
    },
    [enqueue, showBroadcast]
  );

  // ── Initial mount: fetch and show first if eligible ───────────────────────────
  useEffect(() => {
    fetchBroadcast(true);
  }, [fetchBroadcast]);

  // ── Detect page navigations and trigger queue processing with 2-3 page gap pacing ────
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      hasNavigatedRef.current = true;

      // Increment session page navigation counter
      const currentNavs = getSessionNavCount() + 1;
      setSessionNavCount(currentNavs);

      const requiredGap = getSessionGapThreshold();

      // Only show next broadcast if the shopper has navigated at least 2 to 3 pages
      if (currentNavs >= requiredGap && !isShowingRef.current) {
        const t = setTimeout(() => {
          showNextFromQueue();
        }, 300);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, showNextFromQueue]);

  // ── Realtime: listen for admin broadcast updates ─────────────────────────
  useEffect(() => {
    let isMounted = true;

    try {
      const supabase = createClient() as any;
      const channel = supabase.channel("storefront_broadcast", {
        config: { broadcast: { self: false } },
      });

      channel.on("broadcast", { event: "broadcast_updated" }, ({ payload }: any) => {
        if (!isMounted) return;
        const data = payload as BroadcastData;
        if (data && data.isActive) {
          // If eligible (new campaign or freshly rebroadcasted), enqueue it
          if (isBroadcastEligible(data)) {
            enqueue(data);
            // If user hasn't seen any broadcast in this session yet, show it right away
            if (!hasShownInitialInSession() && !isShowingRef.current) {
              const idx = queueRef.current.findIndex((q) => q.id === data.id);
              if (idx >= 0) {
                const item = queueRef.current.splice(idx, 1)[0];
                if (item) showBroadcast(item, 500);
              }
            }
            // Otherwise, it stays in the queue and will smoothly appear after the 2-3 page pacing!
          }
        } else if (data && !data.isActive) {
          // Deactivated broadcast — remove from queue and close if it's the one we're showing
          queueRef.current = queueRef.current.filter((q) => q.id !== data.id);
          if (broadcast?.id === data.id) {
            setIsOpen(false);
            isShowingRef.current = false;
            setBroadcast(null);
          }
        }
      });

      channel.subscribe();

      // Re-fetch on auth events (sign-in, sign-up, session refresh)
      const { data: authSub } = supabase.auth?.onAuthStateChange
        ? supabase.auth.onAuthStateChange((event: string) => {
            if (
              event === "SIGNED_IN" ||
              event === "USER_UPDATED" ||
              event === "INITIAL_SESSION"
            ) {
              fetchBroadcast();
            }
          })
        : { data: null };

      return () => {
        isMounted = false;
        supabase.removeChannel(channel);
        if (authSub?.subscription?.unsubscribe) {
          authSub.subscription.unsubscribe();
        }
      };
    } catch {
      return () => {
        isMounted = false;
      };
    }
  }, [enqueue, fetchBroadcast, broadcast?.id]);

  // ── Offline recovery: when coming back online, fetch and re-check ────────
  useEffect(() => {
    const handleOnline = () => {
      fetchBroadcast();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchBroadcast]);

  // ── Escape key handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    if (broadcast) {
      // Mark as seen permanently across storage layers
      markAsSeen(broadcast);
      if (openedAtRef.current) {
        const elapsed = (Date.now() - openedAtRef.current) / 1000;
        sendBroadcastAnalytics(broadcast.id, "dismiss", elapsed);
        openedAtRef.current = null;
      }
    }
    setIsOpen(false);
    isShowingRef.current = false;
    setBroadcast(null);
    setSessionNavCount(0);
    setSessionGapThreshold(getRandomPacingGap());
  };

  const handleCtaClick = (targetLink?: string) => {
    const currentBroadcast = broadcast;
    if (currentBroadcast) {
      // Mark as seen permanently across storage layers
      markAsSeen(currentBroadcast);
      if (openedAtRef.current) {
        const elapsed = (Date.now() - openedAtRef.current) / 1000;
        sendBroadcastAnalytics(currentBroadcast.id, "click", elapsed);
        openedAtRef.current = null;
      }
    }
    setIsOpen(false);
    isShowingRef.current = false;
    setBroadcast(null);
    setSessionNavCount(0);
    setSessionGapThreshold(getRandomPacingGap());
    const dest = targetLink || currentBroadcast?.ctaLink;
    if (dest) {
      router.push(dest);
    }
  };

  // After the close animation, process the next queued item on next nav
  useEffect(() => {
    if (!isOpen && !isShowingRef.current) {
      // Don't auto-show next until user navigates again
    }
  }, [isOpen]);

  if (!isOpen || !broadcast) return null;

  const design = broadcast.designConfig;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-title"
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
    >
      {/* ── Dark Backdrop overlay with blur ── */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* ── Temu-Style E-commerce Popup Card ── */}
      <div
        style={{
          borderRadius: design?.borderRadius !== undefined ? `${design.borderRadius}px` : undefined,
          backgroundColor: design?.backgroundColor || "#010101",
        }}
        className={`relative z-10 w-full max-w-sm sm:max-w-md overflow-hidden bg-[#010101] text-white animate-in fade-in zoom-in-95 duration-300 ${
          design?.borderRadius === undefined ? "rounded-3xl" : ""
        } ${
          design?.isFrameless
            ? "border-0 shadow-xl"
            : "shadow-2xl border border-white/15"
        }`}
      >
        {/* 1. TOP-RIGHT "X" CANCEL BUTTON */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close notification"
          className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 2. BACKGROUND GRAPHIC CONTAINER */}
        <div
          style={{ backgroundColor: design?.backgroundColor || "#010101" }}
          className="relative w-full aspect-[4/5] overflow-hidden"
        >
          {/* Legacy background image fallback if not present in elements */}
          {broadcast.imageUrl && broadcast.imageUrl.trim() !== "" && (!design?.elements || !design.elements.some((el) => el.id === "bg-image" || el.isBackground)) && (
            <div className="w-full h-full relative">
              <Image
                src={broadcast.imageUrl}
                alt={broadcast.title || "Promotional Announcement"}
                fill
                priority
                unoptimized
                className="object-cover object-center"
              />
            </div>
          )}

          {/* Subtle gradient vignette for text legibility at bottom */}
          {(design?.showBottomShadow !== false) && (!design?.elements || !design.elements.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay")) && (
            <div
              className="absolute inset-x-0 bottom-0 h-[65%] pointer-events-none z-10"
              style={{
                background: "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
              }}
            />
          )}

          {/* Render Elements from Visual Studio (or Classic Fallback) */}
          {design?.elements && design.elements.length > 0 ? (
            design.elements.map((el, elemIdx) => {
              const rot = el.rotation || 0;
              const leftPct = (el.x / 380) * 100;
              const topPct = (el.y / 475) * 100;
              const widthPct = el.width ? (el.width / 380) * 100 : undefined;
              const heightPct = el.height ? (el.height / 475) * 100 : undefined;
              const isBg = el.isBackground || el.id === "bg-image";
              const shadowStyle = isBg ? {} : computeElementShadow(el);

              return (
                <div
                  key={el.id}
                  style={{
                    position: "absolute",
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: widthPct ? `${widthPct}%` : "auto",
                    height: heightPct ? `${heightPct}%` : "auto",
                    transform: `rotate(${rot}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
                    transformOrigin: "center center",
                    zIndex: isBg ? 5 : 10 + elemIdx,
                  }}
                >
                  {el.type === "badge" && (
                    <div
                      style={{
                        backgroundColor: el.backgroundColor || "#EDCF5D",
                        color: el.color || "#000000",
                        borderRadius: el.borderRadius ? `${el.borderRadius}px` : "9999px",
                        fontSize: `${el.fontSize || 10}px`,
                        fontWeight: el.fontWeight || "bold",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "center",
                        boxShadow: shadowStyle.boxShadow || undefined,
                      }}
                      className={`w-full h-full flex items-center px-3 tracking-wider font-mono shadow-md whitespace-nowrap leading-none select-none ${
                        (el.textAlign || "center") === "left"
                          ? "justify-start text-left"
                          : (el.textAlign || "center") === "right"
                          ? "justify-end text-right"
                          : "justify-center text-center"
                      }`}
                    >
                      {el.text}
                    </div>
                  )}

                  {el.type === "title" && (
                    <h2
                      style={{
                        color: el.color || "#FFFFFF",
                        fontSize: `${el.fontSize || 22}px`,
                        fontWeight: el.fontWeight || "black",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "left",
                        filter: shadowStyle.filter || undefined,
                      }}
                      className={`w-full h-full flex items-center tracking-tight leading-tight select-none ${
                        (el.textAlign || "left") === "center"
                          ? "justify-center text-center"
                          : (el.textAlign || "left") === "right"
                          ? "justify-end text-right"
                          : "justify-start text-left"
                      }`}
                    >
                      {el.text}
                    </h2>
                  )}

                  {el.type === "subtitle" && (
                    <p
                      style={{
                        color: el.color || "#E5E5E5",
                        fontSize: `${el.fontSize || 13}px`,
                        fontWeight: el.fontWeight || "normal",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "left",
                        filter: shadowStyle.filter || undefined,
                      }}
                      className={`w-full h-full flex items-center leading-relaxed select-none ${
                        (el.textAlign || "left") === "center"
                          ? "justify-center text-center"
                          : (el.textAlign || "left") === "right"
                          ? "justify-end text-right"
                          : "justify-start text-left"
                      }`}
                    >
                      {el.text}
                    </p>
                  )}

                  {el.type === "button" && (
                    <button
                      type="button"
                      onClick={() => handleCtaClick(el.ctaLink || broadcast.ctaLink)}
                      style={{
                        backgroundColor: el.backgroundColor || "#EDCF5D",
                        color: el.color || "#000000",
                        borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : "16px",
                        fontSize: `${el.fontSize || 13}px`,
                        fontWeight: el.fontWeight || "black",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "center",
                        boxShadow: shadowStyle.boxShadow || undefined,
                      }}
                      className={`w-full h-full px-5 py-3 flex items-center gap-2 tracking-wider select-none font-sans cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${
                        (el.textAlign || "center") === "left"
                          ? "justify-start text-left"
                          : (el.textAlign || "center") === "right"
                          ? "justify-end text-right"
                          : "justify-center text-center"
                      }`}
                    >
                      <span>{el.text}</span>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  )}

                  {el.type === "custom_text" && (
                    <div
                      style={{
                        color: el.color || "#EDCF5D",
                        fontSize: `${el.fontSize || 15}px`,
                        fontWeight: el.fontWeight || "bold",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "left",
                        filter: shadowStyle.filter || undefined,
                      }}
                      className={`w-full h-full flex items-center leading-snug select-none ${
                        (el.textAlign || "left") === "center"
                          ? "justify-center text-center"
                          : (el.textAlign || "left") === "right"
                          ? "justify-end text-right"
                          : "justify-start text-left"
                      }`}
                    >
                      {el.text}
                    </div>
                  )}

                  {el.type === "container" && (
                    <div
                      style={{
                        backgroundColor: el.backgroundColor || "rgba(0, 0, 0, 0.4)",
                        border: `${el.borderWidth ?? 1}px solid ${el.borderColor || "rgba(255,255,255,0.2)"}`,
                        borderRadius: `${el.borderRadius ?? 12}px`,
                        color: el.color || "#FFFFFF",
                        fontFamily: el.fontFamily || undefined,
                        fontSize: `${el.fontSize || 13}px`,
                        fontWeight: el.fontWeight || "normal",
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "none",
                        textAlign: el.textAlign || "center",
                        boxShadow: shadowStyle.boxShadow || undefined,
                      }}
                      className={`w-full h-full p-3 backdrop-blur-md flex items-center select-none overflow-hidden ${
                        (el.textAlign || "center") === "left"
                          ? "justify-start text-left"
                          : (el.textAlign || "center") === "right"
                          ? "justify-end text-right"
                          : "justify-center text-center"
                      }`}
                    >
                      {el.text}
                    </div>
                  )}

                  {el.type === "circle" && (
                    <div
                      style={{
                        backgroundColor: el.backgroundColor || "#EDCF5D",
                        border: el.borderColor ? `${el.borderWidth ?? 1}px solid ${el.borderColor}` : undefined,
                        borderRadius: "9999px",
                        color: el.color || "#000000",
                        fontSize: `${el.fontSize || 12}px`,
                        fontWeight: el.fontWeight || "black",
                        fontFamily: el.fontFamily || undefined,
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.textDecoration || "none",
                        textTransform: el.textTransform || "uppercase",
                        textAlign: el.textAlign || "center",
                        boxShadow: shadowStyle.boxShadow || undefined,
                      }}
                      className={`w-full h-full rounded-full flex items-center p-2 tracking-wider select-none leading-tight font-sans ${
                        (el.textAlign || "center") === "left"
                          ? "justify-start text-left"
                          : (el.textAlign || "center") === "right"
                          ? "justify-end text-right"
                          : "justify-center text-center"
                      }`}
                    >
                      {el.text}
                    </div>
                  )}

                  {el.type === "seal" && (
                    <div
                      style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                      className="w-full h-full relative flex items-center justify-center select-none"
                    >
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon
                          points={SHAPE_SEAL_POINTS}
                          fill={el.backgroundColor || "#EDCF5D"}
                          stroke={el.borderColor || "transparent"}
                          strokeWidth={el.borderWidth || 0}
                        />
                      </svg>
                      {el.text && (
                        <span
                          style={{
                            color: el.color || "#000000",
                            fontSize: `${el.fontSize || 10}px`,
                            fontWeight: el.fontWeight || "black",
                            fontFamily: el.fontFamily || undefined,
                            fontStyle: el.fontStyle || "normal",
                            textDecoration: el.textDecoration || "none",
                            textTransform: el.textTransform || "none",
                          }}
                          className="relative z-10 text-center tracking-wider px-1 max-w-[80%] truncate select-none"
                        >
                          {el.text}
                        </span>
                      )}
                    </div>
                  )}

                  {el.type === "burst" && (
                    <div
                      style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                      className="w-full h-full relative flex items-center justify-center select-none"
                    >
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon
                          points={SHAPE_BURST_POINTS}
                          fill={el.backgroundColor || "#EDCF5D"}
                          stroke={el.borderColor || "transparent"}
                          strokeWidth={el.borderWidth || 0}
                        />
                      </svg>
                      {el.text && (
                        <span
                          style={{
                            color: el.color || "#000000",
                            fontSize: `${el.fontSize || 13}px`,
                            fontWeight: el.fontWeight || "black",
                            fontFamily: el.fontFamily || undefined,
                            fontStyle: el.fontStyle || "normal",
                            textDecoration: el.textDecoration || "none",
                            textTransform: el.textTransform || "none",
                          }}
                          className="relative z-10 text-center tracking-wider px-1 max-w-[75%] truncate select-none"
                        >
                          {el.text}
                        </span>
                      )}
                    </div>
                  )}

                  {el.type === "speech" && (
                    <div
                      style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                      className="w-full h-full relative flex items-center justify-center select-none"
                    >
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                        <path
                          d={SHAPE_SPEECH_PATH}
                          fill={el.backgroundColor || "#EDCF5D"}
                          stroke={el.borderColor || "transparent"}
                          strokeWidth={el.borderWidth || 0}
                        />
                      </svg>
                      {el.text && (
                        <span
                          style={{
                            color: el.color || "#000000",
                            fontSize: `${el.fontSize || 12}px`,
                            fontWeight: el.fontWeight || "black",
                            fontFamily: el.fontFamily || undefined,
                            fontStyle: el.fontStyle || "normal",
                            textDecoration: el.textDecoration || "none",
                            textTransform: el.textTransform || "none",
                            paddingBottom: "12%",
                          }}
                          className="relative z-10 text-center tracking-wider px-2 max-w-[85%] truncate select-none"
                        >
                          {el.text}
                        </span>
                      )}
                    </div>
                  )}

                  {el.type === "cloud" && (
                    <div
                      style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                      className="w-full h-full relative flex items-center justify-center select-none"
                    >
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                        <path
                          d={SHAPE_CLOUD_PATH}
                          fill={el.backgroundColor || "#EDCF5D"}
                          stroke={el.borderColor || "transparent"}
                          strokeWidth={el.borderWidth || 0}
                        />
                      </svg>
                      {el.text && (
                        <span
                          style={{
                            color: el.color || "#000000",
                            fontSize: `${el.fontSize || 12}px`,
                            fontWeight: el.fontWeight || "black",
                            fontFamily: el.fontFamily || undefined,
                            fontStyle: el.fontStyle || "normal",
                            textDecoration: el.textDecoration || "none",
                            textTransform: el.textTransform || "none",
                            paddingBottom: "10%",
                          }}
                          className="relative z-10 text-center tracking-wider px-2 max-w-[80%] truncate select-none"
                        >
                          {el.text}
                        </span>
                      )}
                    </div>
                  )}

                  {el.type === "arrow" && (
                    <div
                      style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                      className="w-full h-full relative flex items-center justify-center select-none"
                    >
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 70" preserveAspectRatio="none">
                        <path
                          d={SHAPE_ARROW_PATH}
                          fill={el.backgroundColor || "#EDCF5D"}
                          stroke={el.borderColor || "transparent"}
                          strokeWidth={el.borderWidth || 0}
                        />
                      </svg>
                      {el.text && (
                        <span
                          style={{
                            color: el.color || "#000000",
                            fontSize: `${el.fontSize || 13}px`,
                            fontWeight: el.fontWeight || "black",
                            fontFamily: el.fontFamily || undefined,
                            fontStyle: el.fontStyle || "normal",
                            textDecoration: el.textDecoration || "none",
                            textTransform: el.textTransform || "none",
                            paddingRight: "15%",
                          }}
                          className="relative z-10 text-center tracking-wider px-1 max-w-[65%] truncate select-none"
                        >
                          {el.text}
                        </span>
                      )}
                    </div>
                  )}

                  {el.type === "image" && el.imageUrl && el.imageUrl.trim() !== "" && (
                    <div
                      style={{
                        borderRadius: el.borderRadius ? `${el.borderRadius}px` : "0px",
                        boxShadow: isBg ? undefined : (shadowStyle.boxShadow || undefined),
                      }}
                      className="w-full h-full relative overflow-hidden select-none"
                    >
                      <Image
                        src={el.imageUrl}
                        alt={el.text || "Poster graphic"}
                        fill
                        unoptimized
                        className="object-cover object-center pointer-events-none"
                      />
                    </div>
                  )}

                  {el.type === "shadow_overlay" && (
                    <div
                      style={{
                        background: el.backgroundColor || "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
                        opacity: el.opacity ?? 1,
                        borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                      }}
                      className="w-full h-full pointer-events-none"
                    />
                  )}
                </div>
              );
            })
          ) : (
            // Default Classic Fallback Layout
            <>
              {(broadcast.title || broadcast.subtitle) && (
                <div className="absolute inset-x-0 bottom-20 p-5 text-center space-y-1.5 z-10">
                  {broadcast.title && (
                    <span
                      id="broadcast-title"
                      className="inline-block px-3 py-1 rounded-full bg-[#EDCF5D] text-[#010101] font-mono text-[11px] font-black uppercase tracking-widest shadow-md"
                    >
                      {broadcast.title}
                    </span>
                  )}
                  {broadcast.subtitle && (
                    <p className="text-xs sm:text-sm text-white/95 font-medium max-w-xs mx-auto drop-shadow-md leading-relaxed">
                      {broadcast.subtitle}
                    </p>
                  )}
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-[#010101] to-transparent z-20">
                <button
                  type="button"
                  onClick={() => handleCtaClick(broadcast.ctaLink)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#EDCF5D] hover:bg-white text-[#010101] font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 font-sans"
                >
                  <span>{broadcast.ctaLabel || "Visit"}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
