"use client";

import { useEffect, useState } from "react";
import { loadDataMode, switchDataMode, type DataMode } from "../../lib/data-mode-api";

interface Props {
  /** Only the super admin can switch; other admins see the mode. */
  canSwitch: boolean;
  /** Called after a successful switch, so the page can reload everything it shows. */
  onSwitched: () => void;
}

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "unready" } | { kind: "ready"; mode: DataMode };

/** Test / Live data: which side of the business the whole app is showing. */
export default function DataModeCard({ canSwitch, onSwitched }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDataMode().then((r) => {
      if (cancelled) return;
      if (!r.ok) setState({ kind: "error", message: r.message });
      else if (!r.ready || !r.mode) setState({ kind: "unready" });
      else setState({ kind: "ready", mode: r.mode });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmSwitch(target: DataMode) {
    setBusy(true);
    setError(null);
    const r = await switchDataMode(target);
    setBusy(false);
    if (r.ok) onSwitched();
    else {
      setError(r.message);
      setConfirming(false);
    }
  }

  const other: DataMode | null = state.kind === "ready" ? (state.mode === "live" ? "test" : "live") : null;

  return (
    <section className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Test and live data</h2>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5">
          Orders, customers, tickets, campaigns and logs are kept in two separate sets. The catalogue, staff and store details are shared.
        </p>
      </div>

      {state.kind === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.kind === "unready" && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Test and live data aren't separated yet: the database needs migration 00017 (supabase/migrations/00017_test_data_isolation.sql) applied first.
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <p className="text-sm text-gray-900 dark:text-white">
            Showing <strong>{state.mode} data</strong>.{" "}
            <span className="text-gray-500 dark:text-[#9CA3AF]">
              {state.mode === "live"
                ? "Everything recorded before the split is kept as test data. Nothing is ever deleted; switch to test to see it."
                : "You're looking at the test records. New sales, orders and sign-ups are recorded as test data until you switch back."}
            </span>
          </p>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {canSwitch && other && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424] text-gray-900 dark:text-white">
              Switch to {other} data
            </button>
          )}
          {canSwitch && other && confirming && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-700 dark:text-gray-300">Everyone using the dashboard and the store will see {other} data straight away.</span>
              <button type="button" disabled={busy} onClick={() => confirmSwitch(other)} className="px-3 py-1.5 text-xs font-bold rounded-[6px] bg-[#010101] text-white disabled:opacity-50">
                {busy ? "Switching..." : `Yes, switch to ${other}`}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
                Cancel
              </button>
            </div>
          )}
          {!canSwitch && <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">Only the super admin can switch between test and live data.</p>}
        </>
      )}
    </section>
  );
}
