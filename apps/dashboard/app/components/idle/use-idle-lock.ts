"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type IdleState = "active" | "warning" | "locked";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel"] as const;

interface Options {
  /** Idle time before the "still there?" warning (cashier spec: 25 minutes). */
  warnAfterMs?: number;
  /** Idle time before the screen locks (cashier spec: 30 minutes). */
  lockAfterMs?: number;
  enabled?: boolean;
}

/**
 * Tracks whether the person at the till is still there. After a quiet spell
 * it warns, then locks. It only reports state: locking is an overlay on the
 * page, not a navigation, so the half-built cart is never lost.
 */
export function useIdleLock({ warnAfterMs = 25 * 60_000, lockAfterMs = 30 * 60_000, enabled = true }: Options = {}) {
  const [state, setState] = useState<IdleState>("active");
  const stateRef = useRef<IdleState>("active");
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const set = useCallback((next: IdleState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const start = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(lockTimer.current);
    warnTimer.current = setTimeout(() => set("warning"), warnAfterMs);
    lockTimer.current = setTimeout(() => set("locked"), lockAfterMs);
  }, [set, warnAfterMs, lockAfterMs]);

  useEffect(() => {
    if (!enabled) return;
    start();
    const onActivity = () => {
      // Once locked, only unlock() (a password) gets you back in.
      if (stateRef.current === "locked") return;
      if (stateRef.current === "warning") set("active");
      start();
    };
    for (const type of ACTIVITY_EVENTS) document.addEventListener(type, onActivity, { passive: true });
    return () => {
      for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, onActivity);
      clearTimeout(warnTimer.current);
      clearTimeout(lockTimer.current);
    };
  }, [enabled, start, set]);

  const stayActive = useCallback(() => {
    if (stateRef.current === "locked") return;
    set("active");
    start();
  }, [set, start]);

  const unlock = useCallback(() => {
    set("active");
    start();
  }, [set, start]);

  return { state, stayActive, unlock };
}
