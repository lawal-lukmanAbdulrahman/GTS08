"use client";

import { useEffect, useState } from "react";
import { loadDataMode, type DataMode } from "../../lib/data-mode-api";
import { demoLoginAvailable, signInToDemo } from "../../lib/demo-login";
import { signOut } from "../../lib/session";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; mode: DataMode };

interface Props {
  /** Where to go after switching into the demo (a full page load, so every screen reloads its data). */
  navigate?: (url: string) => void;
}

/**
 * Which data this account sees, and the switch between them: a real admin can
 * open the demo in one click, and the demo account can leave it. What you see
 * follows the account you're signed in with.
 */
export default function DataModeCard({ navigate = (url) => window.location.assign(url) }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [demoOffered, setDemoOffered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDataMode().then((r) => {
      if (!cancelled) setState(r.ok ? { kind: "ready", mode: r.mode } : { kind: "error", message: r.message });
    });
    demoLoginAvailable().then((on) => {
      if (!cancelled) setDemoOffered(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openDemo = async () => {
    setBusy(true);
    setError(null);
    const r = await signInToDemo();
    setBusy(false);
    if (r.ok) navigate(r.home);
    else setError(r.message);
  };

  const button = "px-3 py-1.5 text-xs font-bold rounded-[6px] disabled:opacity-50";

  return (
    <section className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">Live and demo data</h2>
      {state.kind === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.kind === "ready" && state.mode === "live" && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            You&apos;re looking at the <strong>live shop</strong>. Everything recorded while the app was being built (products, orders,
            customers, broadcasts, logs) is kept as demo data and only the demo account can see it. Nothing was deleted.
          </p>
          {demoOffered && (
            <button type="button" onClick={openDemo} disabled={busy} className={`${button} bg-[#EDCF5D] text-[#010101]`}>
              {busy ? "Opening the demo..." : "Open the demo"}
            </button>
          )}
        </>
      )}
      {state.kind === "ready" && state.mode === "test" && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>This is the demo account.</strong> It shows and changes demo data only: nothing done here reaches the live shop,
            no emails are sent, and store details and staff accounts are read-only.
          </p>
          <button type="button" onClick={() => void signOut()} className={`${button} bg-[#010101] text-white`}>
            Leave the demo
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}
