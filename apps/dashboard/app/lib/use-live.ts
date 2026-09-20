"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall } from "./staff-api";

interface Options {
  /** Time between refreshes while things are healthy. */
  intervalMs?: number;
  enabled?: boolean;
}

export interface Live<T> {
  data: T | null;
  error: string | null;
  /** When the current data arrived, so a screen can say "updated 3s ago". */
  updatedAt: number | null;
  refresh: () => void;
}

const MAX_BACKOFF_MS = 60_000;

/**
 * Keeps a screen in step with the server by polling an API path. It pauses
 * while the tab is hidden and catches up the moment it's shown again, backs
 * off while the server is failing, keeps the last good data through a failure,
 * and never lets a slow, older response overwrite a newer one.
 */
export function useLive<T>(path: string, { intervalMs = 10_000, enabled = true }: Options = {}): Live<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const refreshRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let latestRequest = 0;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (cancelled || document.hidden) return;
      const delay = Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS);
      timer = setTimeout(load, delay);
    };

    async function load() {
      clear();
      const mine = ++latestRequest;
      const result = await apiCall<T>(path);
      if (cancelled || mine !== latestRequest) return;
      if (result.ok) {
        failures = 0;
        setData(result.data);
        setError(null);
        setUpdatedAt(Date.now());
      } else {
        failures += 1;
        setError(result.message);
      }
      schedule();
    }

    const onVisibility = () => {
      if (document.hidden) clear();
      else void load();
    };

    refreshRef.current = () => void load();
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) void load();

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [path, intervalMs, enabled]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, error, updatedAt, refresh };
}
