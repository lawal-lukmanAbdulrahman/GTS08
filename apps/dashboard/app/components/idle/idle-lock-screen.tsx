"use client";

import { useState } from "react";
import type { IdleState } from "./use-idle-lock";
import type { ReauthResult } from "../../lib/session";

interface Props {
  state: IdleState;
  name: string;
  onStay: () => void;
  onUnlock: (password: string) => Promise<ReauthResult>;
  onSignOut: () => void;
}

/**
 * The idle warning banner and lock screen. It's an overlay on the page, not a
 * navigation, so a half-built cart underneath is untouched (cashier spec Part 8).
 */
export default function IdleLockScreen({ state, name, onStay, onUnlock, onSignOut }: Props) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "active") return null;

  if (state === "warning") {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-[10px] bg-[#010101] text-white px-4 py-2.5 shadow-lg"
      >
        <span className="text-xs">Your session will lock in 5 minutes. Tap to stay logged in.</span>
        <button type="button" onClick={onStay} className="px-3 py-1 text-xs font-bold rounded-[6px] bg-[#EDCF5D] text-[#010101]">
          Stay logged in
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checking || !password) return;
    setChecking(true);
    setError(null);
    const result = await onUnlock(password);
    setChecking(false);
    if (!result.ok) {
      setError(result.message);
      setPassword("");
    } else {
      setPassword("");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[12px] bg-white dark:bg-[#1C1C1C] p-6 space-y-4">
        <div className="space-y-1 text-center">
          <h2 id="lock-title" className="text-lg font-bold text-gray-900 dark:text-white">
            Screen locked
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {name || "Staff member"}, you were away for a while. Your cart is kept. Enter your password to continue.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="unlock-password" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            Password
          </label>
          <input
            id="unlock-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!password || checking}
          className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking ? "Checking..." : "Unlock"}
        </button>
        <button type="button" onClick={onSignOut} className="w-full text-xs font-semibold text-gray-500 hover:text-red-600">
          Sign out instead
        </button>
      </form>
    </div>
  );
}
