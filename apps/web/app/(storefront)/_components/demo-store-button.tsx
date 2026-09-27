"use client";

import { useEffect, useState } from "react";

/**
 * "Explore the demo store": signs into the demo account (demo products and
 * orders only) with no password, then reloads so every page shows demo data.
 * Shown only when the server offers the demo (DEMO_LOGIN_ENABLED).
 */
export default function DemoStoreButton({ reload = () => window.location.reload() }: { reload?: () => void }) {
  const [offered, setOffered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/auth/demo-login", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setOffered(b?.data?.enabled === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offered) return null;

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/demo-login", { method: "POST" });
      if (res.ok) return reload();
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error || "The demo couldn't be opened. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 space-y-1.5">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="w-full py-2.5 sm:py-3 rounded-full border-2 border-[#EDCF5D] bg-[#FFF8DC] hover:bg-[#EDCF5D] text-[#010101] font-bold text-xs sm:text-sm transition-all disabled:opacity-50"
      >
        {busy ? "Opening the demo..." : "Explore the demo store"}
      </button>
      <p className="text-[10px] text-gray-500 text-center">Sample products and orders. Nothing you do affects the real shop.</p>
      {error && (
        <p role="alert" className="text-[11px] text-red-600 text-center font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
