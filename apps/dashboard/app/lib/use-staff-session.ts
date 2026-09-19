"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "./staff-api";
import { signOut as endSession } from "./session";
import type { StaffProfileView } from "./staff-types";

/**
 * The signed-in staff member as the server sees them: identity plus effective
 * permissions. (An expired or suspended session is handled inside apiCall, which
 * signs out and redirects, so this only reports genuine load failures.)
 */
export function useStaffSession() {
  const [profile, setProfile] = useState<StaffProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiCall<StaffProfileView>("/staff/me").then((result) => {
      if (cancelled) return;
      if (result.ok) setProfile(result.data);
      else setError(result.message);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const signOut = useCallback(() => endSession(), []);

  return {
    profile,
    loading,
    error,
    reload,
    signOut,
    isAdmin: profile?.is_admin ?? false,
    canUsePos: profile?.permissions.can_process_pos ?? false,
  };
}
